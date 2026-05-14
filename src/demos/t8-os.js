// Topic 8: Zpracování paketu v OS
// Demos: packet rate calculator, netfilter trace, architecture comparison.

import { svgEl, clearSvg, arrowDef, esc } from '../util.js';

export function initT8() {
  initPacketRate();
  initNetfilter();
  initAcc();
  initSKB();
  initRSS();
  initXDP();
  initIptables();
}

// ------- Packet rate calculator -------
function initPacketRate() {
  const calc = () => {
    const linkBps = parseFloat(document.getElementById('rate-link').value);
    const pktB = parseInt(document.getElementById('rate-pkt').value, 10);
    // Ethernet overhead: 8 preamble + 14 header + 4 FCS + 12 IPG = 38 B
    const totalB = pktB + 38;
    const pps = linkBps / (totalB * 8);
    const nsPerPkt = 1e9 / pps;
    const cyclesAt3GHz = nsPerPkt * 3;
    const dramAccess = nsPerPkt / 50;

    let warning = '';
    if (nsPerPkt < 10) {
      warning = '<br><span class="warn"><strong>⚠ Krize:</strong> nestihnete jediný DRAM access (~50 ns)!</span>';
    }

    document.getElementById('rate-out').innerHTML =
      `Linka: ${(linkBps / 1e9).toFixed(0)} Gb/s, paket: ${pktB} B (+ 38 B Ethernet overhead)<br>` +
      `<strong>Pakety za sekundu: ${(pps / 1e6).toFixed(2)} Mpps</strong><br>` +
      `<strong>Čas na paket: ${nsPerPkt.toFixed(2)} ns</strong> ≈ ${cyclesAt3GHz.toFixed(0)} cyklů při 3 GHz CPU<br>` +
      `Možných DRAM accessů na paket: <strong>${dramAccess.toFixed(2)}</strong> (DRAM ~50 ns)${warning}<br>` +
      `<span style="font-size:12px;color:var(--text-3)">Proto se používá batching, kernel bypass (DPDK), in-kernel akcelerace (XDP).</span>`;
  };
  ['rate-link', 'rate-pkt'].forEach(id =>
    document.getElementById(id).addEventListener('input', calc));
  // The link selector fires 'change' for native; opt-tabs replacement uses click → dispatched 'change' too.
  document.getElementById('rate-link').addEventListener('change', calc);
  calc();
}

// ------- Netfilter hook trace -------
function initNetfilter() {
  const PIPELINES = {
    forward: {
      hooks: ['PRE_ROUTING', 'routing', 'FORWARD', 'POST_ROUTING'],
      desc: 'Paket pro někoho jiného: prochází routem a forwarduje se',
    },
    'local-in': {
      hooks: ['PRE_ROUTING', 'routing', 'LOCAL_IN', 'lokální proces'],
      desc: 'Paket pro tento host: po routingu jde do lokální aplikace',
    },
    'local-out': {
      hooks: ['lokální proces', 'LOCAL_OUT', 'routing', 'POST_ROUTING'],
      desc: 'Lokálně vygenerovaný paket: po LOCAL_OUT prochází routem',
    },
  };
  let activeIdx = -1;

  function draw() {
    const type = document.getElementById('nf-type').value;
    const pipe = PIPELINES[type];
    const svg = document.getElementById('nf-svg');
    clearSvg(svg);
    arrowDef(svg, 'nf-arr', 'var(--info)');

    const W = 700;
    const stepW = (W - 60) / pipe.hooks.length;

    pipe.hooks.forEach((h, i) => {
      const x = 30 + i * stepW + 8;
      const isActive = i === activeIdx;
      const isDone = i < activeIdx;
      const isHook = h.toUpperCase() === h && h !== 'routing';
      const fill = isActive ? 'var(--info)' : isDone ? 'var(--info-bg)' : isHook ? 'var(--secondary-bg)' : 'var(--node-fill)';
      svgEl('rect', { class: `hook-box ${isActive ? 'active' : ''}`, x, y: 90, width: stepW - 16, height: 60, fill, stroke: isActive ? 'var(--info-strong)' : 'var(--secondary)', 'stroke-width': isActive ? 3 : 1.5, rx: 6 }, svg);
      svgEl('text', { x: x + (stepW - 16) / 2, y: 120, 'text-anchor': 'middle', 'font-weight': 600, 'font-size': 12, 'font-family': 'monospace', fill: isActive ? 'white' : 'var(--text)', text: h }, svg);
      svgEl('text', { x: x + (stepW - 16) / 2, y: 138, 'text-anchor': 'middle', 'font-size': 10, fill: isActive ? 'white' : 'var(--text-3)', text: isHook ? 'netfilter hook' : h === 'routing' ? 'FIB lookup' : 'aplikace' }, svg);
      if (i < pipe.hooks.length - 1) {
        const ax = x + stepW - 14, ay = 120;
        svgEl('line', { x1: ax, y1: ay, x2: ax + 14, y2: ay, stroke: 'var(--info)', 'stroke-width': 2, 'marker-end': 'url(#nf-arr)' }, svg);
      }
    });

    svgEl('text', { x: W / 2, y: 50, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, text: pipe.desc }, svg);
    if (activeIdx >= 0 && activeIdx < pipe.hooks.length) {
      svgEl('text', { x: W / 2, y: 70, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--secondary)', text: `Aktuálně: ${pipe.hooks[activeIdx]}` }, svg);
    }

    // iptables tables active here
    const tableMap = {
      'PRE_ROUTING': 'raw, mangle, nat (DNAT), conntrack',
      'LOCAL_IN': 'mangle, filter (INPUT), security',
      'FORWARD': 'mangle, filter (FORWARD)',
      'POST_ROUTING': 'mangle, nat (SNAT)',
      'LOCAL_OUT': 'raw, mangle, nat, filter, security',
    };
    if (activeIdx >= 0 && tableMap[pipe.hooks[activeIdx]]) {
      document.getElementById('nf-info').innerHTML =
        `Hook <code>${pipe.hooks[activeIdx]}</code> spouští tabulky: <strong>${tableMap[pipe.hooks[activeIdx]]}</strong>`;
    } else if (activeIdx >= pipe.hooks.length) {
      document.getElementById('nf-info').innerHTML = '<strong style="color:var(--success)">✓ Paket doručen (nebo odeslán na drát).</strong>';
    } else {
      document.getElementById('nf-info').innerHTML = 'Klikněte „Pošli paket" pro spuštění.';
    }
  }

  document.getElementById('nf-play').addEventListener('click', () => {
    const type = document.getElementById('nf-type').value;
    const pipe = PIPELINES[type];
    activeIdx = 0;
    draw();
    const id = setInterval(() => {
      activeIdx++;
      draw();
      if (activeIdx >= pipe.hooks.length) clearInterval(id);
    }, 800);
  });
  document.getElementById('nf-reset').addEventListener('click', () => { activeIdx = -1; draw(); });
  document.getElementById('nf-type').addEventListener('change', () => { activeIdx = -1; draw(); });
  draw();
}

// ------- Acceleration comparison -------
function initAcc() {
  const TECHS = {
    'Standardní Linux': {
      flow: ['NIC IRQ', 'Driver', 'sk_buff alloc', 'softirq', 'IP stack', 'TCP stack', 'socket buffer', 'syscall recv()', 'User app'],
      maxRate: '~1-5 Gbps',
      bypass: false,
      latency: 'vysoká',
      notes: 'Univerzální, ale na vysokých rychlostech nestihne. Každý paket prochází celým kernelem.',
    },
    'NAPI + offloady': {
      flow: ['NIC (poll mode)', 'Driver (batch)', 'GRO sloučí', 'IP/TCP stack', 'socket', 'app'],
      maxRate: '~10-40 Gbps',
      bypass: false,
      latency: 'střední',
      notes: 'NAPI: interrupt + polling pod zátěží. GSO/GRO pracuje s 64 kB chunky. Checksum offload na NIC.',
    },
    'PF_RING ZC': {
      flow: ['NIC', 'PF_RING ring buffer', 'mmap() → User app (zero-copy)'],
      maxRate: '~10-40 Gbps',
      bypass: true,
      latency: 'nízká',
      notes: 'Kernel bypass přes mmap. Packet Dispatcher distribuuje mezi víc aplikací. Vhodné pro IDS (Snort, Suricata), n2disk.',
    },
    'DPDK': {
      flow: ['NIC', 'PMD (poll mode driver)', 'User app + DPDK lib (dedicated CPU)'],
      maxRate: 'line rate 100+ Gbps',
      bypass: true,
      latency: 'velmi nízká',
      notes: 'Plný kernel bypass. PMD = busy loop. Hugepages, lockless rings, NUMA-aware. App musí používat DPDK API.',
    },
    'XDP/eBPF': {
      flow: ['NIC', 'XDP program v driveru', 'Pass / Drop / Redirect / Tx'],
      maxRate: 'line rate 100+ Gbps',
      bypass: false,
      latency: 'velmi nízká',
      notes: 'NENÍ kernel bypass! Běží v driveru, ale uvnitř kernelu. Sdílí CPU s ostatními procesy. Cloudflare DDoS, Facebook Katran.',
    },
  };

  function draw() {
    const tech = document.getElementById('acc-tech').value;
    const t = TECHS[tech];
    const svg = document.getElementById('acc-svg');
    clearSvg(svg);
    arrowDef(svg, 'acc-arr', 'var(--info)');

    const W = 700, H = 260;
    const stepW = (W - 60) / t.flow.length;

    // Show kernel/userspace divide
    const userspaceFrom = t.flow.findIndex(f => f.toLowerCase().includes('user') || f.toLowerCase().includes('app'));
    if (userspaceFrom > 0) {
      const splitX = 30 + userspaceFrom * stepW;
      svgEl('rect', { x: 30, y: 60, width: splitX - 30, height: 140, fill: 'var(--danger-bg)', stroke: 'none' }, svg);
      svgEl('text', { x: (30 + splitX) / 2, y: 50, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--danger)', text: 'KERNEL SPACE' }, svg);
      svgEl('rect', { x: splitX, y: 60, width: W - 30 - splitX, height: 140, fill: 'var(--success-bg)', stroke: 'none' }, svg);
      svgEl('text', { x: (splitX + W - 30) / 2, y: 50, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--success)', text: 'USER SPACE' }, svg);
    }

    t.flow.forEach((step, i) => {
      const x = 30 + i * stepW + 6;
      const isBypass = t.bypass && (step.includes('app') || step.includes('PMD') || step.includes('User'));
      const fill = isBypass ? 'var(--success)' : 'var(--info-bg)';
      svgEl('rect', { x, y: 100, width: stepW - 12, height: 50, fill, stroke: 'var(--info)', 'stroke-width': 1.5, rx: 4 }, svg);
      svgEl('text', { x: x + (stepW - 12) / 2, y: 124, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, fill: isBypass ? 'white' : 'var(--text)', text: step }, svg);
      if (i < t.flow.length - 1) {
        const ax = x + stepW - 10;
        svgEl('line', { x1: ax, y1: 125, x2: ax + 10, y2: 125, stroke: 'var(--info)', 'stroke-width': 2, 'marker-end': 'url(#acc-arr)' }, svg);
      }
    });

    svgEl('text', { x: W / 2, y: 220, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text-3)', text: `Max. propustnost: ${t.maxRate}, latence: ${t.latency}, kernel bypass: ${t.bypass ? 'ANO' : 'NE'}` }, svg);

    document.getElementById('acc-info').innerHTML = `<strong>${tech}</strong><br>${t.notes}`;
  }
  document.getElementById('acc-tech').addEventListener('change', draw);
  draw();
}

// ------- sk_buff push/pull -------
function initSKB() {
  let headers = []; // stack of headers
  function reset() { headers = ['payload']; draw(); }
  function push() { const HDRS = ['UDP/TCP', 'IP', 'Ethernet']; const next = HDRS[headers.length - 1]; if (next) { headers.unshift(next); draw(); } }
  function pull() { if (headers.length > 1) { headers.shift(); draw(); } }
  function draw() {
    const svg = document.getElementById('skb-svg');
    clearSvg(svg);
    const W = 700, H = 240;
    // SKB structure box
    svgEl('rect', { x: 30, y: 20, width: 160, height: 200, fill: 'var(--info-bg)', stroke: 'var(--info)', 'stroke-width': 2, rx: 6 }, svg);
    svgEl('text', { x: 110, y: 40, 'text-anchor': 'middle', 'font-weight': 600, text: 'struct sk_buff' }, svg);
    svgEl('text', { x: 40, y: 70, 'font-family': 'monospace', 'font-size': 11, text: 'head ──┐' }, svg);
    svgEl('text', { x: 40, y: 90, 'font-family': 'monospace', 'font-size': 11, text: 'data ─┐│' }, svg);
    svgEl('text', { x: 40, y: 110, 'font-family': 'monospace', 'font-size': 11, text: 'tail ┐││' }, svg);
    svgEl('text', { x: 40, y: 130, 'font-family': 'monospace', 'font-size': 11, text: 'end ─┘││' }, svg);

    // Data buffer
    const bufX = 240, bufY = 40, bufW = 420, bufH = 130;
    svgEl('rect', { x: bufX, y: bufY, width: bufW, height: bufH, fill: 'var(--surface)', stroke: 'var(--text-3)', 'stroke-width': 2 }, svg);
    svgEl('text', { x: bufX + bufW / 2, y: 30, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text-3)', text: 'Packet data storage' }, svg);
    // Headroom
    const headroomW = 30;
    svgEl('rect', { x: bufX, y: bufY, width: headroomW, height: bufH, fill: 'var(--bg-2)' }, svg);
    svgEl('text', { x: bufX + headroomW / 2, y: bufY + bufH / 2, 'text-anchor': 'middle', 'font-size': 9, fill: 'var(--text-3)', transform: `rotate(-90 ${bufX + headroomW / 2} ${bufY + bufH / 2})`, text: 'headroom' }, svg);

    // Headers
    const palette = ['var(--secondary)', 'var(--info)', 'var(--warning)', 'var(--success)'];
    let x = bufX + headroomW;
    const dataW = bufW - headroomW - 30;
    const slotW = dataW / 4;
    headers.forEach((h, i) => {
      const isPayload = h === 'payload';
      const fill = isPayload ? 'var(--success-bg)' : palette[(headers.length - 1 - i) % palette.length];
      svgEl('rect', { x, y: bufY, width: slotW, height: bufH, fill, stroke: 'var(--text-2)', 'stroke-width': 1.5 }, svg);
      svgEl('text', { x: x + slotW / 2, y: bufY + bufH / 2 + 4, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, fill: isPayload ? 'var(--text)' : 'white', text: h }, svg);
      x += slotW;
    });
    // Tailroom
    svgEl('rect', { x: x, y: bufY, width: bufX + bufW - x, height: bufH, fill: 'var(--bg-2)' }, svg);

    // Pointers
    svgEl('line', { x1: 190, y1: 75, x2: bufX - 2, y2: bufY + 5, stroke: 'var(--info)', 'stroke-width': 1.5 }, svg);
    svgEl('text', { x: bufX - 8, y: bufY + 2, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--info)', text: 'head' }, svg);

    svgEl('line', { x1: 190, y1: 95, x2: bufX + headroomW - 2, y2: bufY + 60, stroke: 'var(--info)', 'stroke-width': 1.5 }, svg);
    svgEl('text', { x: bufX + headroomW - 4, y: bufY + 55, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--info)', 'font-weight': 600, text: 'data ↓' }, svg);

    svgEl('line', { x1: 190, y1: 115, x2: x + 2, y2: bufY + 80, stroke: 'var(--info)', 'stroke-width': 1.5 }, svg);
    svgEl('text', { x: x + 5, y: bufY + 75, 'font-size': 10, fill: 'var(--info)', 'font-weight': 600, text: '↓ tail' }, svg);

    svgEl('line', { x1: 190, y1: 135, x2: bufX + bufW + 2, y2: bufY + 115, stroke: 'var(--info)', 'stroke-width': 1.5 }, svg);
    svgEl('text', { x: bufX + bufW + 5, y: bufY + 110, 'font-size': 10, fill: 'var(--info)', text: 'end' }, svg);

    document.getElementById('skb-info').innerHTML =
      `Aktuální hlavičky: <code>${headers.join(' → ')}</code>. <strong>skb_push posune data← (přidá hlavičku)</strong>, skb_pull posune data→ (odebere). Vlastní paket se nekopíruje — jen ukazatele.`;
  }
  document.getElementById('skb-push').addEventListener('click', push);
  document.getElementById('skb-pull').addEventListener('click', pull);
  document.getElementById('skb-reset').addEventListener('click', reset);
  reset();
}

// ------- RSS hash -------
function initRSS() {
  function hash5(s, d, sp, dp) {
    // Simple FNV-1a style hash for demo
    let h = 2166136261;
    const data = `${s}|${d}|${sp}|${dp}`;
    for (let i = 0; i < data.length; i++) {
      h ^= data.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function go() {
    const src = document.getElementById('rss-src').value;
    const dst = document.getElementById('rss-dst').value;
    const sp = parseInt(document.getElementById('rss-sport').value, 10);
    const dp = parseInt(document.getElementById('rss-dport').value, 10);
    const q = parseInt(document.getElementById('rss-queues').value, 10);
    const h = hash5(src, dst, sp, dp);
    const queue = h % q;

    const svg = document.getElementById('rss-svg');
    clearSvg(svg);
    const W = 700;
    svgEl('text', { x: 30, y: 30, 'font-weight': 600, text: `5-tuple: ${src} ${dst} ${sp} ${dp} → hash 0x${h.toString(16)}` }, svg);
    svgEl('text', { x: 30, y: 50, 'font-size': 12, fill: 'var(--text-3)', text: `hash % ${q} = ${queue}` }, svg);

    const qW = (W - 60) / q;
    for (let i = 0; i < q; i++) {
      const isSel = i === queue;
      svgEl('rect', { x: 30 + i * qW, y: 80, width: qW - 4, height: 60, fill: isSel ? 'var(--info)' : 'var(--node-fill)', stroke: isSel ? 'var(--info-strong)' : 'var(--text-3)', 'stroke-width': isSel ? 3 : 1.5, rx: 4 }, svg);
      svgEl('text', { x: 30 + i * qW + (qW - 4) / 2, y: 110, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, fill: isSel ? 'white' : 'var(--text-2)', text: `Queue ${i}` }, svg);
      svgEl('text', { x: 30 + i * qW + (qW - 4) / 2, y: 128, 'text-anchor': 'middle', 'font-size': 10, fill: isSel ? 'white' : 'var(--text-3)', text: `CPU ${i}` }, svg);
    }
    svgEl('text', { x: 350, y: 175, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--secondary)', text: 'Stejný flow → vždy stejná queue → stejný CPU (no reorder)' }, svg);
    svgEl('text', { x: 350, y: 195, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--danger)', text: 'Tunelování (GRE, IPSec) má stejnou vnější hlavičku → všechen traffic v jedné queue!' }, svg);

    document.getElementById('rss-info').textContent = `Hash distribuuje flow rovnoměrně přes ${q} front, ale jeden velký flow je omezený rychlostí JEDNOHO CPU jádra.`;
  }
  ['rss-src','rss-dst','rss-sport','rss-dport','rss-queues'].forEach(id => document.getElementById(id).addEventListener('input', go));
  go();
}

// ------- XDP action flow -------
function initXDP() {
  const SCENARIOS = {
    ddos: { action: 'XDP_DROP', why: 'SYN flood — zahodit hned v driveru, žádný sk_buff alloc, žádný kernel stack overhead. Cloudflare drop ~50 Mpps per CPU jádro.', color: 'var(--danger)' },
    lb: { action: 'XDP_TX', why: 'L4 load balancer (Katran/Facebook): přepiš dst IP/MAC na backend a pošli zpět ven. Žádný kernel routing, ~10× rychlejší než iptables.', color: 'var(--secondary)' },
    monitor: { action: 'XDP_PASS', why: 'Pouhý monitoring/IDS — neměnit, kopírovat do user space přes perf buffer, paket pokračuje normálním stackem.', color: 'var(--success)' },
    ping: { action: 'XDP_TX', why: 'Echo reply přímo z driveru — přepiš src/dst a pošli zpět. Pro testing nebo „heartbeat odpovědi" bez zatížení kernelu.', color: 'var(--warning)' },
    route: { action: 'XDP_REDIRECT', why: 'Bridge mezi 2 NIC bez kernel routingu. AF_XDP socket dostane paket nebo se pošle na druhý interface přímo.', color: 'var(--info)' },
  };
  function go() {
    const sc = document.getElementById('xdp-scenario').value;
    const s = SCENARIOS[sc];
    const svg = document.getElementById('xdp-svg');
    clearSvg(svg);
    arrowDef(svg, 'xdp-arr', 'var(--info)');
    const W = 700;
    svgEl('rect', { x: 30, y: 40, width: 130, height: 60, fill: 'var(--info-bg)', stroke: 'var(--info)', 'stroke-width': 2, rx: 6 }, svg);
    svgEl('text', { x: 95, y: 75, 'text-anchor': 'middle', 'font-weight': 600, text: 'NIC (driver)' }, svg);
    svgEl('rect', { x: 200, y: 40, width: 160, height: 60, fill: 'var(--secondary-bg)', stroke: 'var(--secondary)', 'stroke-width': 2, rx: 6 }, svg);
    svgEl('text', { x: 280, y: 65, 'text-anchor': 'middle', 'font-weight': 600, text: 'eBPF/XDP program' }, svg);
    svgEl('text', { x: 280, y: 82, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-3)', text: 'rozhodnutí ↓' }, svg);
    // Arrow
    svgEl('line', { x1: 160, y1: 70, x2: 198, y2: 70, stroke: 'var(--info)', 'stroke-width': 2, 'marker-end': 'url(#xdp-arr)' }, svg);

    // Actions
    const actions = [
      { name: 'DROP', y: 150, color: 'var(--danger)', desc: 'zahodit' },
      { name: 'PASS', y: 150, color: 'var(--success)', desc: 'do kernel stacku', x: 420 },
      { name: 'REDIRECT', y: 220, color: 'var(--info)', desc: 'na jiný interface' },
      { name: 'TX', y: 220, color: 'var(--warning)', desc: 'zpět odesílateli', x: 420 },
    ];
    let pos = 0;
    actions.forEach((a, i) => {
      const x = a.x || 70 + (i % 2) * 130;
      const isSelected = s.action.includes(a.name);
      svgEl('rect', { x, y: a.y, width: 140, height: 50, fill: isSelected ? a.color : 'var(--node-fill)', stroke: a.color, 'stroke-width': isSelected ? 3 : 2, rx: 6 }, svg);
      svgEl('text', { x: x + 70, y: a.y + 22, 'text-anchor': 'middle', 'font-weight': 600, 'font-size': 13, fill: isSelected ? 'white' : a.color, text: `XDP_${a.name}` }, svg);
      svgEl('text', { x: x + 70, y: a.y + 40, 'text-anchor': 'middle', 'font-size': 11, fill: isSelected ? 'white' : 'var(--text-3)', text: a.desc }, svg);
      // Arrow from program
      if (isSelected) {
        svgEl('line', { x1: 280, y1: 100, x2: x + 70, y2: a.y - 4, stroke: s.color, 'stroke-width': 3, 'marker-end': 'url(#xdp-arr)' }, svg);
      }
    });

    document.getElementById('xdp-info').innerHTML =
      `<strong style="color:${s.color}">Vybrána akce: ${s.action}</strong><br>${s.why}`;
  }
  document.getElementById('xdp-scenario').addEventListener('change', go);
  go();
}

// ------- iptables rule analyzer -------
function initIptables() {
  function go() {
    const rule = document.getElementById('ipt-rule').value;
    const tableMatch = rule.match(/-t\s+(\w+)/);
    const table = tableMatch ? tableMatch[1] : 'filter';
    const chainMatch = rule.match(/-A\s+(\w+)/);
    const chain = chainMatch ? chainMatch[1] : null;

    const CHAIN_TO_HOOK = {
      'PREROUTING': 'NF_IP_PRE_ROUTING',
      'INPUT': 'NF_IP_LOCAL_IN',
      'FORWARD': 'NF_IP_FORWARD',
      'OUTPUT': 'NF_IP_LOCAL_OUT',
      'POSTROUTING': 'NF_IP_POST_ROUTING',
    };
    const hook = chain ? CHAIN_TO_HOOK[chain] : '?';
    const targetMatch = rule.match(/-j\s+(\w+)/);
    const target = targetMatch ? targetMatch[1] : '?';

    document.getElementById('ipt-out').innerHTML =
      `<table style="font-size:13px">` +
      `<tr><td><strong>Tabulka</strong></td><td class="mono">${table}</td><td>${{filter:'firewall (default)','nat':'NAT/DNAT/SNAT','mangle':'modifikace polí (TTL, MARK, DSCP)','raw':'paket neprochází conntrack','security':'SELinux'}[table] || 'unknown'}</td></tr>` +
      `<tr><td><strong>Řetězec</strong></td><td class="mono">${chain || '?'}</td><td>${chain ? 'mapuje na hook' : 'chybí -A'}</td></tr>` +
      `<tr><td><strong>Netfilter hook</strong></td><td class="mono" style="color:var(--info)"><strong>${hook}</strong></td><td>${hook === '?' ? '' : 'zde se pravidlo vyhodnotí'}</td></tr>` +
      `<tr><td><strong>Akce (target)</strong></td><td class="mono">${target}</td><td>${{ACCEPT:'pokračovat',DROP:'zahodit',REJECT:'zahodit + ICMP',MASQUERADE:'SNAT na výstupní IF IP',SNAT:'src NAT',DNAT:'dst NAT',LOG:'syslog'}[target] || ''}</td></tr>` +
      `</table>` +
      `<div style="margin-top:8px;font-size:12px;color:var(--text-3)">Příklad pochopení: <code>POSTROUTING + MASQUERADE</code> = NAT na výstupu pomocí adresy výstupního rozhraní (klasické sdílení internetu).</div>`;
  }
  document.getElementById('ipt-rule').addEventListener('input', go);
  go();
}
