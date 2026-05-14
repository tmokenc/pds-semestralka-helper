// Topic 4: Architektura směrovačů
// Demos: RIB→FIB compilation, packet context evolution, slow/fast path classifier,
// Process/Fast/CEF timing comparison, CEF mtrie lookup.

import { svgEl, clearSvg, arrowDef, esc } from '../util.js';

export function initT4() {
  initRibFib();
  initContext();
  initSlowFast();
  initCEFTiming();
  initCEFTrie();
  initFragmentation();
  initHeaderChanges();
  initPMTUD();
}

// ------- RIB → FIB compilation -------
function initRibFib() {
  const POOL = [
    { prefix: '10.0.0.0/8', src: 'Static', ad: 1, metric: 0, nh: '192.168.0.254', mac: 'AA:BB:CC:11:22:33', iface: 'eth0' },
    { prefix: '10.5.0.0/16', src: 'eBGP', ad: 20, metric: 0, nh: '203.0.113.1', mac: 'DD:EE:FF:00:11:22', iface: 'eth1' },
    { prefix: '10.5.1.0/24', src: 'OSPF', ad: 110, metric: 25, nh: '192.168.1.1', mac: '11:22:33:44:55:66', iface: 'eth2' },
    { prefix: '10.5.1.0/24', src: 'EIGRP', ad: 90, metric: 156160, nh: '192.168.2.1', mac: '77:88:99:AA:BB:CC', iface: 'eth3' },
    { prefix: '172.16.0.0/12', src: 'RIP', ad: 120, metric: 4, nh: '192.168.1.5', mac: '01:02:03:04:05:06', iface: 'eth0' },
    { prefix: '0.0.0.0/0', src: 'Static', ad: 1, metric: 0, nh: '203.0.113.254', mac: 'FE:DC:BA:98:76:54', iface: 'eth1' },
    { prefix: '172.16.0.0/12', src: 'iBGP', ad: 200, metric: 0, nh: '203.0.113.2', mac: '99:88:77:66:55:44', iface: 'eth1' },
  ];
  let rib = [];

  function render() {
    const ribRows = document.getElementById('rib-rows');
    ribRows.innerHTML = rib.map(r => `<tr><td class="mono">${r.prefix}</td><td>${r.src}</td><td class="mono">${r.ad}</td><td class="mono">${r.metric}</td><td class="mono">${r.nh}</td></tr>`).join('');

    // FIB = best per prefix
    const byPrefix = {};
    rib.forEach(r => {
      if (!byPrefix[r.prefix] || byPrefix[r.prefix].ad > r.ad ||
        (byPrefix[r.prefix].ad === r.ad && byPrefix[r.prefix].metric > r.metric)) {
        byPrefix[r.prefix] = r;
      }
    });
    const fibRows = document.getElementById('fib-rows');
    fibRows.innerHTML = Object.values(byPrefix).map(r => `<tr><td class="mono">${r.prefix}</td><td>${r.iface}</td><td class="mono">${r.mac}</td></tr>`).join('');
  }
  document.getElementById('rib-add').addEventListener('click', () => {
    const remaining = POOL.filter(p => !rib.some(r => r.prefix === p.prefix && r.src === p.src));
    if (remaining.length === 0) return;
    rib.push(remaining[Math.floor(Math.random() * remaining.length)]);
    render();
  });
  document.getElementById('rib-reset').addEventListener('click', () => { rib = []; render(); });
  // Seed
  rib = [POOL[2], POOL[3]];
  render();
}

// ------- Packet context evolution -------
function initContext() {
  const PHASES = [
    {
      name: '1. Vstup na rozhraní (Network Interface)',
      desc: 'NIC odstraní L2, ověří FCS, vytvoří kontext.',
      ctx: {
        'Ingress IF': 'eth0', 'Ingress type': 'Ethernet',
        'Src MAC': 'AA:BB:CC:11:22:33', 'Dst MAC': 'DD:EE:FF:99:88:77',
        'Src IP': '10.5.1.42', 'Dst IP': '203.0.113.99',
        'Protocol': 'TCP', 'DSCP': '0',
        'Src Port': '54321', 'Dst Port': '443',
      }
    },
    {
      name: '2. Forwarding Engine (FE)',
      desc: 'FIB lookup → next-hop + výstupní rozhraní.',
      ctx: {
        'Ingress IF': 'eth0', 'Src IP': '10.5.1.42', 'Dst IP': '203.0.113.99',
        'Protocol': 'TCP', 'Src Port': '54321', 'Dst Port': '443',
        'Next-hop': '203.0.113.254 ← (z FIB)', 'Egress IF': 'eth1 ← (z FIB)',
      }
    },
    {
      name: '3. Backplane (přesun na výstupní modul)',
      desc: 'Paket fyzicky přesunut přes switching fabric.',
      ctx: {
        'Src IP': '10.5.1.42', 'Dst IP': '203.0.113.99', 'TTL': '63 ← (decrement)',
        'Next-hop': '203.0.113.254', 'Egress IF': 'eth1',
      }
    },
    {
      name: '4. Queue Manager',
      desc: 'Zařazení do výstupní fronty podle priority (DSCP).',
      ctx: {
        'Dst IP': '203.0.113.99', 'TTL': '63', 'Priority queue': 'best-effort (DSCP=0)',
        'Egress IF': 'eth1',
      }
    },
    {
      name: '5. Traffic Manager',
      desc: 'Shaping/policing — token bucket, leaky bucket.',
      ctx: {
        'Dst IP': '203.0.113.99', 'Egress IF': 'eth1',
        'Shaping': 'OK (under rate)', 'Policing': 'OK',
      }
    },
    {
      name: '6. Výstup (Network Interface)',
      desc: 'Nová L2 hlavička, přepočet checksumu, paket fyzicky odeslán.',
      ctx: {
        'New Src MAC': 'aa:00:01:eth1', 'New Dst MAC': 'FE:DC:BA:98:76:54 ← (z Adjacency)',
        'TTL': '63', 'IP Checksum': 'přepočítán',
        'L2 Frame': 'sestaven s CRC', 'Status': 'odesláno na drát',
      }
    },
  ];
  let phase = 0;

  function draw() {
    const svg = document.getElementById('ctx-svg');
    clearSvg(svg);
    arrowDef(svg, 'ctx-arr', '#0066cc');
    const W = 700;
    const stepW = (W - 60) / 6;
    PHASES.forEach((p, i) => {
      const x = 30 + i * stepW;
      const isActive = i === phase;
      const isDone = i < phase;
      const fill = isActive ? '#0066cc' : isDone ? '#b8d4ff' : '#fff';
      const stroke = isActive ? '#003d7a' : '#0066cc';
      svgEl('rect', { x: x + 4, y: 90, width: stepW - 12, height: 100, fill, stroke, 'stroke-width': isActive ? 3 : 1.5, rx: 6 }, svg);
      const lines = p.name.split(' ');
      svgEl('text', { x: x + stepW / 2, y: 115, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: isActive ? 'white' : '#1a1a1a', text: lines[0] }, svg);
      svgEl('text', { x: x + stepW / 2, y: 132, 'text-anchor': 'middle', 'font-size': 10, fill: isActive ? 'white' : '#444', text: lines.slice(1, 3).join(' ') }, svg);
      svgEl('text', { x: x + stepW / 2, y: 150, 'text-anchor': 'middle', 'font-size': 10, fill: isActive ? 'white' : '#444', text: lines.slice(3).join(' ') }, svg);
      if (i < PHASES.length - 1) {
        svgEl('line', { x1: x + stepW - 4, y1: 140, x2: x + stepW + 4, y2: 140, stroke: '#888', 'stroke-width': 1.5, 'marker-end': 'url(#ctx-arr)' }, svg);
      }
    });
    svgEl('text', { x: W / 2, y: 50, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 600, text: `Fáze ${phase + 1} / 6: ${PHASES[phase].name}` }, svg);
    svgEl('text', { x: W / 2, y: 70, 'text-anchor': 'middle', 'font-size': 12, fill: '#666', text: PHASES[phase].desc }, svg);
    svgEl('text', { x: W / 2, y: 250, 'text-anchor': 'middle', 'font-size': 11, fill: '#7a3ea1', text: 'Kontext paketu putuje s paketem skrz moduly (ne paket sám)' }, svg);

    const rows = document.getElementById('ctx-rows');
    rows.innerHTML = Object.entries(PHASES[phase].ctx).map(([k, v]) => `<tr><td class="mono" style="color:#7a3ea1">${k}</td><td class="mono">${v}</td></tr>`).join('');

    document.getElementById('ctx-phase-label').textContent = `Fáze ${phase + 1}/6`;
  }
  document.getElementById('ctx-step').addEventListener('click', () => {
    phase = (phase + 1) % PHASES.length;
    draw();
  });
  document.getElementById('ctx-reset').addEventListener('click', () => { phase = 0; draw(); });
  draw();
}

// ------- Slow path vs Fast path classifier -------
function initSlowFast() {
  const CLASSIFICATIONS = {
    'Obyčejný IP forward (next-hop známý)': {
      path: 'FAST',
      reason: 'CEF Adjacency Table má předkompilovanou L2 hlavičku → ASIC zpracuje v jednom cyklu.',
    },
    'Forward, ARP záznam expiroval (glean)': {
      path: 'SLOW',
      reason: 'L2 hlavička není známa → punted do CPU, kernel pošle ARP request, počká odpověď, sestaví L2 hlavičku, propaguje zpět do CEF.',
    },
    'IP options (Record Route)': {
      path: 'SLOW',
      reason: 'Router musí aktualizovat seznam navštívených routerů v paketu — netriviální logika, do hardwaru se nedostala.',
    },
    'TTL = 1, generovat ICMP Time Exceeded': {
      path: 'SLOW',
      reason: 'Hardware nemá engine pro vytvoření zcela nového paketu s ICMP hlavičkou a daty z původního.',
    },
    'Fragment, MTU překročeno': {
      path: 'SLOW',
      reason: 'Vytváření nových paketů, kopírování dat, výpočet checksumů — drahá operace s buffery a timeoutem. V IPv6 router NEFRAGMENTUJE, zahodí + ICMPv6 Packet Too Big.',
    },
    'BGP update (TCP port 179, dst = my IP)': {
      path: 'SLOW',
      reason: 'Paket je pro samotný router (control plane). Kernel ho předá do BGP démona.',
    },
    'SNMP get-request': {
      path: 'SLOW',
      reason: 'Management plane — kernel předá do SNMP démona, který přečte MIB a odpoví.',
    },
    'Multicast IGMP report': {
      path: 'SLOW',
      reason: 'Update členství v multicast skupinách → mění multicast tabulky → control plane.',
    },
  };

  document.getElementById('slowfast-check').addEventListener('click', () => {
    const sel = document.getElementById('slowfast-type').value;
    const c = CLASSIFICATIONS[sel];
    const out = document.getElementById('slowfast-out');
    out.innerHTML =
      `<strong style="color:${c.path === 'FAST' ? 'var(--num)' : 'var(--warn)'};font-size:16px">${c.path === 'FAST' ? '⚡ FAST PATH (ASIC, data plane)' : '🐢 SLOW PATH (CPU, control plane)'}</strong>` +
      `<div style="margin-top:8px">${c.reason}</div>`;
  });
}

// ------- Process/Fast/CEF timing comparison -------
function initCEFTiming() {
  function draw() {
    const svg = document.getElementById('cef-svg');
    clearSvg(svg);
    const count = parseInt(document.getElementById('cef-count').value, 10);
    const change = document.getElementById('cef-change').checked;

    // Simulate per-packet latency for 3 schemes
    const PROCESS = 100; // ns per packet (CPU lookup)
    const FAST_FIRST = 100;
    const FAST_REST = 5;
    const CEF = 3;

    let proc = count * PROCESS;
    let fast = FAST_FIRST + (count - 1) * FAST_REST;
    let cef = count * CEF;

    if (change) {
      // RIB change invalidates Fast cache
      fast += FAST_FIRST * 5; // multiple cache misses
    }

    const W = 700, H = 240;
    const barH = 40;
    const maxV = Math.max(proc, fast, cef);
    const xS = v => 100 + (W - 160) * (v / maxV);

    const bars = [
      { label: 'Process Switching', v: proc, color: '#c73a1f' },
      { label: 'Fast Switching', v: fast, color: '#cc8f00' },
      { label: 'CEF', v: cef, color: '#0a7a3d' },
    ];
    bars.forEach((b, i) => {
      const y = 40 + i * (barH + 20);
      svgEl('text', { x: 90, y: y + barH / 2 + 4, 'text-anchor': 'end', 'font-size': 12, 'font-weight': 600, text: b.label }, svg);
      svgEl('rect', { x: 100, y, width: xS(b.v) - 100, height: barH, fill: b.color, opacity: 0.85 }, svg);
      svgEl('text', { x: xS(b.v) + 10, y: y + barH / 2 + 4, 'font-size': 12, fill: '#444', text: `${b.v.toLocaleString()} ns` }, svg);
    });

    document.getElementById('cef-info').innerHTML =
      `Pro <strong>${count}</strong> paketů jednoho toku ${change ? '<span class="warn">se změnou RIB</span>' : ''}:<br>` +
      `Process Switching: každý paket plný RIB+ARP lookup na CPU = ${proc.toLocaleString()} ns<br>` +
      `Fast Switching: první paket pomalý + cache hit pro ostatní = ${fast.toLocaleString()} ns ${change ? '(cache thrashing!)' : ''}<br>` +
      `CEF: FIB předpočítaná z RIB, žádný cache miss penalty = ${cef.toLocaleString()} ns<br>` +
      `<span style="color:var(--text-muted);font-size:12px">Hodnoty jsou ilustrativní — reálný ASIC zvládá CEF v ~1 ns.</span>`;
  }
  document.getElementById('cef-run').addEventListener('click', draw);
  draw();
}

// ------- CEF 256-way mtrie lookup -------
function initCEFTrie() {
  const PREFIXES = [
    { prefix: '10.0.0.0/8', nh: '192.168.0.254 / eth0' },
    { prefix: '10.5.0.0/16', nh: '192.168.1.1 / eth1' },
    { prefix: '10.5.23.0/24', nh: '192.168.2.1 / eth2' },
    { prefix: '172.16.0.0/12', nh: '192.168.3.1 / eth3' },
    { prefix: '203.0.113.0/24', nh: '203.0.113.254 / eth4' },
  ];

  function lookup() {
    const ip = document.getElementById('cef-ip').value.trim();
    const parts = ip.split('.').map(p => parseInt(p, 10));
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      document.getElementById('cef-result').innerHTML = '<span class="warn">Neplatná IP adresa</span>';
      return;
    }
    const svg = document.getElementById('cef-trie-svg');
    clearSvg(svg);
    arrowDef(svg, 'cef-arr', '#0066cc');

    // Find LPM
    let match = null;
    let matchLen = -1;
    PREFIXES.forEach(p => {
      const [pf, len] = p.prefix.split('/');
      const plen = parseInt(len, 10);
      const ipParts = parts;
      const pfParts = pf.split('.').map(x => parseInt(x, 10));
      let bits = '', pb = '';
      for (let i = 0; i < 4; i++) {
        bits += ipParts[i].toString(2).padStart(8, '0');
        pb += pfParts[i].toString(2).padStart(8, '0');
      }
      if (bits.substring(0, plen) === pb.substring(0, plen) && plen > matchLen) {
        matchLen = plen;
        match = p;
      }
    });

    // Visualize 4 levels of 256-way mtrie
    const W = 700;
    parts.forEach((b, i) => {
      const x = 30 + i * 165;
      svgEl('rect', { x, y: 40, width: 140, height: 100, fill: '#b8d4ff', stroke: '#0066cc', 'stroke-width': 2, rx: 6 }, svg);
      svgEl('text', { x: x + 70, y: 60, 'text-anchor': 'middle', 'font-weight': 600, 'font-size': 13, text: `Úroveň ${i + 1}` }, svg);
      svgEl('text', { x: x + 70, y: 82, 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': 18, fill: '#003d7a', text: b.toString().padStart(3, '0') }, svg);
      svgEl('text', { x: x + 70, y: 105, 'text-anchor': 'middle', 'font-size': 10, fill: '#444', text: `${b}.toString(2) = ${b.toString(2).padStart(8, '0')}` }, svg);
      svgEl('text', { x: x + 70, y: 130, 'text-anchor': 'middle', 'font-size': 11, fill: '#7a3ea1', text: `lookup [${b}] v poli 256 položek` }, svg);
      if (i < 3) {
        svgEl('line', { x1: x + 140, y1: 90, x2: x + 165, y2: 90, stroke: '#0066cc', 'stroke-width': 2, 'marker-end': 'url(#cef-arr)' }, svg);
      }
    });

    document.getElementById('cef-result').innerHTML = match
      ? `<strong>LPM: ${match.prefix} → ${match.nh}</strong><br><span style="color:var(--text-muted);font-size:12px">4 paměťové přístupy místo 32 (binární trie). 256-way mtrie je optimální pro IPv4.</span>`
      : '<span class="warn">Žádný prefix se neshoduje — paket se zahodí (nebo default route).</span>';
  }
  document.getElementById('cef-lookup').addEventListener('click', lookup);
  lookup();
}

// ------- IPv4 fragmentation -------
function initFragmentation() {
  function go() {
    const size = parseInt(document.getElementById('frag-size').value, 10);
    const mtu = parseInt(document.getElementById('frag-mtu').value, 10);
    if (size <= mtu) {
      document.getElementById('frag-info').innerHTML = `<strong>Žádná fragmentace</strong>: paket ${size} B se vejde do MTU ${mtu} B.`;
      document.getElementById('frag-rows').innerHTML = '';
      clearSvg(document.getElementById('frag-svg'));
      return;
    }
    const headerSize = 20;
    const dataSize = size - headerSize;
    const maxFragData = Math.floor((mtu - headerSize) / 8) * 8; // must be multiple of 8
    const fragments = [];
    let offset = 0;
    const id = Math.floor(Math.random() * 65535);
    while (offset < dataSize) {
      const remaining = dataSize - offset;
      const thisData = Math.min(maxFragData, remaining);
      const mf = (offset + thisData < dataSize) ? 1 : 0;
      fragments.push({
        id,
        mf,
        offset: offset / 8,
        totalLen: headerSize + thisData,
        data: `${offset}..${offset + thisData - 1}`,
      });
      offset += thisData;
    }

    const svg = document.getElementById('frag-svg');
    clearSvg(svg);
    // Original packet
    svgEl('rect', { x: 30, y: 20, width: 640, height: 50, fill: '#b8d4ff', stroke: '#0066cc', 'stroke-width': 2, rx: 4 }, svg);
    svgEl('text', { x: 350, y: 50, 'text-anchor': 'middle', 'font-weight': 600, text: `Původní paket: ${size} B (hdr ${headerSize} + data ${dataSize})` }, svg);

    // Arrow down
    svgEl('text', { x: 350, y: 95, 'text-anchor': 'middle', 'font-size': 12, fill: '#c73a1f', text: `↓ MTU = ${mtu} B → fragmentace` }, svg);

    // Fragments
    const totalDataW = 640;
    let x = 30;
    fragments.forEach((f, i) => {
      const w = (f.totalLen / size) * totalDataW;
      svgEl('rect', { x, y: 130, width: w - 4, height: 50, fill: '#fce5ff', stroke: '#7a3ea1', 'stroke-width': 2, rx: 4 }, svg);
      svgEl('text', { x: x + w / 2, y: 153, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, text: `Frag ${i + 1}` }, svg);
      svgEl('text', { x: x + w / 2, y: 168, 'text-anchor': 'middle', 'font-size': 10, fill: '#444', text: `${f.totalLen} B, MF=${f.mf}` }, svg);
      x += w;
    });

    // On receiver
    svgEl('text', { x: 350, y: 220, 'text-anchor': 'middle', 'font-size': 13, fill: '#0a7a3d', 'font-weight': 600, text: '✓ Cílový host složí podle stejného Identifier + Offset' }, svg);
    svgEl('text', { x: 350, y: 245, 'text-anchor': 'middle', 'font-size': 11, fill: '#c73a1f', text: '⚠ Pokud se ZTRATÍ JEDINÝ fragment → celý paket je ztracen (žádná částečná data)' }, svg);
    svgEl('text', { x: 350, y: 265, 'text-anchor': 'middle', 'font-size': 11, fill: '#666', text: 'Mezilehlé routery NESKLÁDAJÍ fragmenty — defragmentace jen na cílovém hostu' }, svg);

    const rows = document.getElementById('frag-rows');
    rows.innerHTML = fragments.map((f, i) => `<tr><td>${i + 1}</td><td class="mono">${f.id}</td><td class="mono">${f.mf}</td><td class="mono">${f.offset}</td><td class="mono">${f.totalLen}</td><td class="mono">${f.data}</td></tr>`).join('');

    document.getElementById('frag-info').innerHTML =
      `<strong>${fragments.length} fragmentů.</strong> Identifier všech stejný (${id}). MF=1 u všech kromě posledního, kde MF=0. ` +
      `Offset v jednotkách 8 B. Header Checksum se přepočítá. <em>Defragmentace jen na cíli</em>.<br>` +
      `<span style="color:var(--warn);font-size:12px">IPv6 by tuto operaci v routeru ZAKÁZALO — paket by se zahodil + ICMPv6 Packet Too Big.</span>`;
  }
  document.getElementById('frag-go').addEventListener('click', go);
  ['frag-size', 'frag-mtu'].forEach(id => document.getElementById(id).addEventListener('input', go));
  go();
}

// ------- IP header changes -------
function initHeaderChanges() {
  const SCENARIOS = {
    normal: [
      { field: 'Version', before: '4', after: '4', changed: false },
      { field: 'IHL', before: '5', after: '5', changed: false },
      { field: 'Total Length', before: '1500', after: '1500', changed: false },
      { field: 'Identifier', before: '12345', after: '12345', changed: false },
      { field: 'Flags (DF, MF)', before: 'DF=1, MF=0', after: 'DF=1, MF=0', changed: false },
      { field: 'TTL', before: '64', after: '63', changed: true, note: 'Vždy dekrement' },
      { field: 'Header Checksum', before: '0xA1B2', after: '0xA0B2', changed: true, note: 'Přepočítán po změně TTL' },
      { field: 'Src IP', before: '10.5.1.42', after: '10.5.1.42', changed: false },
      { field: 'Dst IP', before: '203.0.113.99', after: '203.0.113.99', changed: false },
    ],
    nat: [
      { field: 'TTL', before: '64', after: '63', changed: true, note: 'Vždy dekrement' },
      { field: 'Header Checksum', before: '0xA1B2', after: '0x55C3', changed: true, note: 'Přepočítán' },
      { field: 'Src IP', before: '10.5.1.42 (privátní)', after: '203.0.113.10 (veřejná)', changed: true, note: 'SNAT' },
      { field: 'Src Port (TCP/UDP)', before: '54321', after: '32198', changed: true, note: 'NAT port translation' },
      { field: 'TCP/UDP Checksum', before: '0x...', after: '0x... (nový)', changed: true, note: 'Přepočítán kvůli pseudo-header' },
      { field: 'Dst IP', before: '203.0.113.99', after: '203.0.113.99', changed: false },
    ],
    frag: [
      { field: 'TTL', before: '64', after: '63', changed: true, note: '' },
      { field: 'Total Length', before: '3000', after: '1500 / 1500 / ...', changed: true, note: 'Per fragment' },
      { field: 'Identifier', before: '12345', after: '12345 (stejný)', changed: false, note: 'Všechny fragmenty stejné ID' },
      { field: 'Flags MF', before: 'MF=0', after: 'MF=1, MF=1, ..., MF=0', changed: true, note: 'Poslední fragment má MF=0' },
      { field: 'Fragment Offset', before: '0', after: '0, 185, 370, ...', changed: true, note: 'V jednotkách 8 B' },
      { field: 'Header Checksum', before: '0xA1B2', after: 'Nový per fragment', changed: true, note: '' },
    ],
    ttl: [
      { field: 'TTL', before: '1', after: '0', changed: true, note: '⚠ Vyprší' },
      { field: 'Akce', before: 'Forward', after: 'Drop + ICMP Time Exceeded', changed: true, note: 'Punted do slow path, kernel vygeneruje ICMP zpět odesílateli' },
    ],
  };

  function render() {
    const sc = document.getElementById('hdr-scenario').value;
    const rows = document.getElementById('hdr-rows');
    rows.innerHTML = SCENARIOS[sc].map(r => `<tr style="${r.changed ? 'background:#fff4f0' : ''}"><td class="mono">${r.field}</td><td class="mono">${r.before}</td><td class="mono">${r.after}</td><td>${r.changed ? `<span style="color:var(--warn)">${r.note || 'změna'}</span>` : '—'}</td></tr>`).join('');
  }
  document.getElementById('hdr-show').addEventListener('click', render);
  document.getElementById('hdr-scenario').addEventListener('change', render);
  render();
}

// ------- PMTUD -------
function initPMTUD() {
  let log = [];
  let step = 0;
  function play() {
    log = [];
    step = 0;
    const path = [
      { name: 'eth0 (klient)', mtu: 1500 },
      { name: 'R1', mtu: 1500 },
      { name: 'R2 (DSL)', mtu: 1492 },
      { name: 'R3', mtu: 1500 },
      { name: 'R4 (tunel)', mtu: 1400 },
      { name: 'server', mtu: 1500 },
    ];
    log.push(`Klient pošle paket 1500 B s DF=1.`);
    log.push(`R1 OK (MTU 1500).`);
    log.push(`R2: MTU 1492 < 1500 → drop + ICMP Frag Needed (next-hop MTU=1492).`);
    log.push(`Klient přijme ICMP, sníží PMTU na 1492. Retransmit.`);
    log.push(`R2 OK, R3 OK, R4: MTU 1400 < 1492 → drop + ICMP (next-hop MTU=1400).`);
    log.push(`Klient sníží PMTU na 1400. Retransmit.`);
    log.push(`✓ Paket projde celou cestou (MTU 1400).`);

    // Draw
    const svg = document.getElementById('pmtud-svg');
    clearSvg(svg);
    arrowDef(svg, 'pmtud-arr', '#0066cc');
    path.forEach((p, i) => {
      const x = 30 + i * 110;
      const isBottleneck = p.mtu < 1500;
      svgEl('rect', { x, y: 80, width: 95, height: 60, fill: isBottleneck ? '#ffe9a3' : '#b8d4ff', stroke: isBottleneck ? '#cc8f00' : '#0066cc', 'stroke-width': 2, rx: 4 }, svg);
      svgEl('text', { x: x + 47, y: 100, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, text: p.name }, svg);
      svgEl('text', { x: x + 47, y: 118, 'text-anchor': 'middle', 'font-size': 10, fill: '#444', text: `MTU ${p.mtu}` }, svg);
      if (isBottleneck) svgEl('text', { x: x + 47, y: 158, 'text-anchor': 'middle', 'font-size': 10, fill: '#c73a1f', text: '⚠ bottleneck' }, svg);
      if (i < path.length - 1) svgEl('line', { x1: x + 95, y1: 110, x2: x + 110, y2: 110, stroke: '#0066cc', 'stroke-width': 2, 'marker-end': 'url(#pmtud-arr)' }, svg);
    });
    svgEl('text', { x: 350, y: 220, 'text-anchor': 'middle', 'font-weight': 600, fill: '#0a7a3d', text: '✓ PMTU = min(MTU všech hopů) = 1400' }, svg);
    svgEl('text', { x: 350, y: 240, 'text-anchor': 'middle', 'font-size': 11, fill: '#666', text: 'Pro IPv6 je PMTUD POVINNÉ — router nesmí fragmentovat za vás' }, svg);

    const ol = document.getElementById('pmtud-steps');
    ol.innerHTML = log.map((l, i) => `<li class="${i === log.length - 1 ? 'active' : 'done'}">${esc(l)}</li>`).join('');
  }
  document.getElementById('pmtud-play').addEventListener('click', play);
  document.getElementById('pmtud-reset').addEventListener('click', () => { clearSvg(document.getElementById('pmtud-svg')); document.getElementById('pmtud-steps').innerHTML = ''; });
  play();
}
