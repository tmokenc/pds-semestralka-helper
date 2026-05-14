// Topic 9: Datová centra, SDN, P4
// Demos: DC topology builder, oversubscription, OpenFlow flow entry tester.

import { svgEl, clearSvg, arrowDef, esc, shuffle } from '../util.js';

export function initT9() {
  initDCTopo();
  initOversubscription();
  initOpenFlow();
  initECMP();
  initReactiveVsProactive();
  initP4Pipeline();
  initVxLAN();
}

// ------- DC topology builder + ECMP path trace -------
function initDCTopo() {
  function draw() {
    const topo = document.getElementById('dc-topo').value;
    const svg = document.getElementById('dc-svg');
    clearSvg(svg);
    arrowDef(svg, 'dc-arr', '#c73a1f');

    const W = 700, H = 360;
    let info = '';

    if (topo === 'tree') {
      // 3-tier: 1 core, 2 aggregation, 4 access, 8 servers
      const core = [{ x: W / 2, y: 40 }];
      const agg = [{ x: 200, y: 130 }, { x: 500, y: 130 }];
      const acc = [{ x: 100, y: 220 }, { x: 300, y: 220 }, { x: 400, y: 220 }, { x: 600, y: 220 }];
      const srv = [];
      for (let i = 0; i < 8; i++) srv.push({ x: 80 + i * 80, y: 310 });

      [...core].forEach(n => drawNode(svg, n.x, n.y, 'core', '#c73a1f'));
      agg.forEach(n => drawNode(svg, n.x, n.y, 'agg', '#cc8f00'));
      acc.forEach(n => drawNode(svg, n.x, n.y, 'leaf', '#0066cc'));
      srv.forEach((n, i) => drawNode(svg, n.x, n.y, 's' + i, '#0a7a3d', 12));

      agg.forEach(a => svgEl('line', { x1: a.x, y1: a.y - 16, x2: core[0].x, y2: core[0].y + 16, stroke: '#888', 'stroke-width': 2 }, svg));
      acc.forEach((a, i) => {
        const parent = agg[Math.floor(i / 2)];
        svgEl('line', { x1: a.x, y1: a.y - 16, x2: parent.x, y2: parent.y + 16, stroke: '#888', 'stroke-width': 2 }, svg);
      });
      srv.forEach((s, i) => {
        const parent = acc[Math.floor(i / 2)];
        svgEl('line', { x1: s.x, y1: s.y - 12, x2: parent.x, y2: parent.y + 16, stroke: '#bbb', 'stroke-width': 1.5 }, svg);
      });
      info = `Klasická 3-tier: Core/Agg/Edge. Oversubscription u core (1 core × 4 agg-links). Single point of failure.`;
    }
    else if (topo === 'leafspine') {
      const NSP = 4, NLF = 6;
      const spines = [];
      const leafs = [];
      for (let i = 0; i < NSP; i++) spines.push({ x: 120 + i * 150, y: 80 });
      for (let i = 0; i < NLF; i++) leafs.push({ x: 60 + i * 120, y: 240 });
      // Full mesh
      spines.forEach(s => leafs.forEach(l => svgEl('line', { x1: s.x, y1: s.y + 16, x2: l.x, y2: l.y - 16, stroke: '#888', 'stroke-width': 0.8 }, svg)));
      spines.forEach((n, i) => drawNode(svg, n.x, n.y, 'spine' + (i + 1), '#7a3ea1'));
      leafs.forEach((n, i) => drawNode(svg, n.x, n.y, 'leaf' + (i + 1), '#0066cc'));
      info = `Leaf-spine: ${NLF} leaf × ${NSP} spine, full mesh. ECMP přes všechny spiny. Předvídatelná latence (2 hopy: leaf → spine → leaf).`;
    }
    else if (topo === 'fattree') {
      // k=4 fat-tree
      const k = 4;
      const numPods = k;
      const numCore = (k * k) / 4;
      const cores = [];
      for (let i = 0; i < numCore; i++) cores.push({ x: 100 + i * ((W - 200) / (numCore - 1)), y: 40 });
      const pods = [];
      const podW = (W - 100) / numPods;
      for (let p = 0; p < numPods; p++) {
        const podX = 50 + p * podW + podW / 2;
        pods.push({ aggs: [], edges: [], srvs: [], x: podX });
        for (let a = 0; a < k / 2; a++) pods[p].aggs.push({ x: podX - 30 + a * 60, y: 130 });
        for (let e = 0; e < k / 2; e++) pods[p].edges.push({ x: podX - 30 + e * 60, y: 230 });
        for (let s = 0; s < k; s++) pods[p].srvs.push({ x: podX - 35 + s * 25, y: 320 });
      }
      // Connections
      cores.forEach(c => pods.forEach(p => p.aggs.forEach(a => svgEl('line', { x1: c.x, y1: c.y + 14, x2: a.x, y2: a.y - 14, stroke: '#bbb', 'stroke-width': 0.5 }, svg))));
      pods.forEach(p => p.aggs.forEach(a => p.edges.forEach(e => svgEl('line', { x1: a.x, y1: a.y + 14, x2: e.x, y2: e.y - 14, stroke: '#bbb', 'stroke-width': 0.7 }, svg))));
      pods.forEach(p => p.edges.forEach((e, i) => {
        p.srvs.slice(i * 2, i * 2 + 2).forEach(s => svgEl('line', { x1: e.x, y1: e.y + 14, x2: s.x, y2: s.y - 8, stroke: '#ddd', 'stroke-width': 0.5 }, svg));
      }));
      cores.forEach((n, i) => drawNode(svg, n.x, n.y, 'C' + (i + 1), '#c73a1f', 12));
      pods.forEach(p => {
        p.aggs.forEach((a, i) => drawNode(svg, a.x, a.y, 'A' + (i + 1), '#cc8f00', 12));
        p.edges.forEach((e, i) => drawNode(svg, e.x, e.y, 'E' + (i + 1), '#0066cc', 12));
        p.srvs.forEach((s, i) => drawNode(svg, s.x, s.y, '', '#0a7a3d', 6));
      });
      info = `Fat-tree (k=${k}): ${numCore} core, ${numPods} pody po ${k} servery. Více paralelních cest blíže ke kořeni.`;
    }
    else if (topo === 'folded') {
      // Pod-based Clos
      const numPods = 3, switchesPerPod = 4;
      const superSpines = 3;
      const ss = [];
      for (let i = 0; i < superSpines; i++) ss.push({ x: 150 + i * 200, y: 40 });
      const pods = [];
      for (let p = 0; p < numPods; p++) {
        const podX = 80 + p * 220;
        const podSwitches = [];
        for (let s = 0; s < switchesPerPod; s++) {
          podSwitches.push({ x: podX + (s % 2) * 60, y: 160 + Math.floor(s / 2) * 70 });
        }
        pods.push({ x: podX, switches: podSwitches });
      }
      // Connections: super-spine to top of pod
      ss.forEach(s => pods.forEach(p => p.switches.slice(0, 2).forEach(sw => svgEl('line', { x1: s.x, y1: s.y + 14, x2: sw.x, y2: sw.y - 12, stroke: '#bbb', 'stroke-width': 0.6 }, svg))));
      pods.forEach(p => {
        p.switches.slice(0, 2).forEach(top => p.switches.slice(2).forEach(bot => svgEl('line', { x1: top.x, y1: top.y + 12, x2: bot.x, y2: bot.y - 12, stroke: '#bbb' }, svg)));
        svgEl('rect', { x: p.x - 10, y: 130, width: 110, height: 200, fill: 'none', stroke: '#7a3ea1', 'stroke-width': 1, 'stroke-dasharray': '4 3' }, svg);
        svgEl('text', { x: p.x + 45, y: 145, 'text-anchor': 'middle', 'font-size': 11, fill: '#7a3ea1', text: `Pod ${pods.indexOf(p) + 1}` }, svg);
      });
      ss.forEach((n, i) => drawNode(svg, n.x, n.y, 'SS' + (i + 1), '#c73a1f', 14));
      pods.forEach(p => p.switches.forEach((sw, i) => drawNode(svg, sw.x, sw.y, '', '#0066cc', 10)));
      info = `Folded Clos / pod-based: ${numPods} pody, super-spine vrstva nahoře. Facebook Fabric, Google Jupiter používají tuto topologii.`;
    }

    document.getElementById('dc-info').innerHTML = info;
  }

  function drawNode(svg, x, y, label, color, r = 14) {
    svgEl('circle', { cx: x, cy: y, r, fill: color, stroke: '#444', 'stroke-width': 1 }, svg);
    if (label) svgEl('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 9, fill: 'white', text: label }, svg);
  }

  document.getElementById('dc-redraw').addEventListener('click', draw);
  document.getElementById('dc-topo').addEventListener('change', draw);
  document.getElementById('dc-trace').addEventListener('click', () => {
    draw();
    const svg = document.getElementById('dc-svg');
    const topo = document.getElementById('dc-topo').value;
    if (topo === 'leafspine') {
      // Highlight a path: leaf1 → some spine → leaf6
      svgEl('text', { x: 350, y: 340, 'text-anchor': 'middle', 'font-size': 12, fill: '#c73a1f', 'font-weight': 600, text: 'ECMP: hash(5-tuple) vybírá 1 ze 4 spinů' }, svg);
      const spineIdx = Math.floor(Math.random() * 4);
      const sx = 120 + spineIdx * 150;
      svgEl('line', { x1: 60, y1: 224, x2: sx, y2: 96, stroke: '#c73a1f', 'stroke-width': 3 }, svg);
      svgEl('line', { x1: sx, y1: 96, x2: 660, y2: 224, stroke: '#c73a1f', 'stroke-width': 3 }, svg);
    }
  });
  draw();
}

// ------- Oversubscription -------
function initOversubscription() {
  document.getElementById('over-calc').addEventListener('click', () => {
    const up = parseFloat(document.getElementById('over-up').value);
    const down = parseFloat(document.getElementById('over-down').value);
    if (up <= 0 || down <= 0) {
      document.getElementById('over-out').innerHTML = '<span class="warn">Zadejte kladné hodnoty</span>';
      return;
    }
    const ratio = down / up;
    let comment = '';
    if (ratio <= 1) comment = '<span style="color:var(--num)">Full bisection bandwidth (1:1) — ideální</span>';
    else if (ratio <= 3) comment = 'Mírný oversubscription — typický pro moderní leaf-spine';
    else if (ratio <= 8) comment = 'Klasická 3-tier enterprise topologie';
    else comment = '<span class="warn">Vysoký oversubscription — riziko zahlcení při AllReduce/MapReduce</span>';
    document.getElementById('over-out').innerHTML =
      `<strong>Oversubscription: ${ratio.toFixed(1)}:1</strong> (${down} Gb/s dolů / ${up} Gb/s nahoru)<br>${comment}<br>` +
      `<span style="font-size:12px;color:var(--text-muted)">V kampusu OK (nejsou všichni aktivní). V DC s clusterem compute (AllReduce) je 4:1 = 75 % paketů musí zahodit.</span>`;
  });
}

// ------- OpenFlow flow entry tester -------
function initOpenFlow() {
  let flows = [
    { pri: 100, match: { srcmac: 'AA:BB:CC' }, action: 'output port 2', count: 0 },
    { pri: 90, match: { dstip: '10.0.0.5' }, action: 'output port 3', count: 0 },
    { pri: 80, match: { dport: 80 }, action: 'output port 4 (web)', count: 0 },
    { pri: 70, match: { dport: 443 }, action: 'output port 4 (web)', count: 0 },
    { pri: 0, match: {}, action: 'CONTROLLER (default)', count: 0 },
  ];

  function matchFlow(packet, flow) {
    if (flow.match.srcmac && !packet.srcmac.startsWith(flow.match.srcmac)) return false;
    if (flow.match.dstip && packet.dstip !== flow.match.dstip) return false;
    if (flow.match.dport && parseInt(packet.dport, 10) !== flow.match.dport) return false;
    return true;
  }

  function render() {
    const rows = document.getElementById('of-rows');
    rows.innerHTML = flows.map(f => {
      const matchStr = Object.entries(f.match).map(([k, v]) => `${k}=${v}`).join(', ') || '* (default)';
      return `<tr><td class="mono">${f.pri}</td><td class="mono">${matchStr}</td><td>${f.action}</td><td class="mono">${f.count}</td></tr>`;
    }).join('');
  }

  function send() {
    const packet = {
      srcmac: document.getElementById('of-srcmac').value.trim(),
      dstip: document.getElementById('of-dstip').value.trim(),
      dport: document.getElementById('of-dport').value.trim(),
    };
    // Sort by priority desc and find first match
    const sorted = flows.slice().sort((a, b) => b.pri - a.pri);
    const idx = flows.findIndex(f => f === sorted.find(s => matchFlow(packet, s)));
    if (idx >= 0) {
      flows[idx].count++;
      render();
      const f = flows[idx];
      const matchStr = Object.entries(f.match).map(([k, v]) => `${k}=${v}`).join(', ') || '* (default)';
      document.getElementById('of-result').innerHTML =
        `<strong style="color:var(--num)">✓ Match flow priority ${f.pri}</strong>: ${matchStr}<br>` +
        `Akce: <strong>${f.action}</strong><br>` +
        `Statistics: counter ${f.count}<br>` +
        (f.pri === 0 ? `<span style="font-size:12px;color:var(--warn)">⚠ Tento paket je <em>první svého druhu</em> — controller dostane PACKET_IN a může nainstalovat nové pravidlo (reactive mód).</span>` : '');
    } else {
      document.getElementById('of-result').innerHTML = '<span class="warn">Žádný match — paket drop (table-miss).</span>';
    }
  }

  document.getElementById('of-send').addEventListener('click', send);
  document.getElementById('of-reset').addEventListener('click', () => {
    flows.forEach(f => f.count = 0);
    render();
    document.getElementById('of-result').textContent = '';
  });
  render();
}

// ------- ECMP -------
function initECMP() {
  function hash5(s, d, sp, dp) {
    let h = 2166136261;
    const data = `${s}|${d}|${sp}|${dp}`;
    for (let i = 0; i < data.length; i++) {
      h ^= data.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  let history = [];
  function go() {
    const src = document.getElementById('ecmp-src').value;
    const dst = document.getElementById('ecmp-dst').value;
    const sp = parseInt(document.getElementById('ecmp-sport').value, 10);
    const dp = parseInt(document.getElementById('ecmp-dport').value, 10);
    const NSPINES = 4;
    const path = hash5(src, dst, sp, dp) % NSPINES;
    history.push({ src, dst, sp, dp, path });
    draw();
  }
  function rand100() {
    history = [];
    for (let i = 0; i < 100; i++) {
      const src = `10.5.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
      const dst = `10.5.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
      const sp = 1024 + Math.floor(Math.random() * 64000);
      const dp = [80, 443, 22, 25, 53][Math.floor(Math.random() * 5)];
      const path = hash5(src, dst, sp, dp) % 4;
      history.push({ src, dst, sp, dp, path });
    }
    draw();
  }
  function draw() {
    const svg = document.getElementById('ecmp-svg');
    clearSvg(svg);
    arrowDef(svg, 'ecmp-arr', '#c73a1f');
    // Leaf and spines
    const leafL = { x: 80, y: 200 };
    const leafR = { x: 620, y: 200 };
    const spines = [];
    for (let i = 0; i < 4; i++) spines.push({ x: 200 + i * 100, y: 60 });
    spines.forEach(s => svgEl('circle', { cx: s.x, cy: s.y, r: 18, fill: '#fce5ff', stroke: '#7a3ea1', 'stroke-width': 2 }, svg));
    spines.forEach((s, i) => svgEl('text', { x: s.x, y: s.y + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, text: `Sp${i + 1}` }, svg));
    [leafL, leafR].forEach((l, i) => {
      svgEl('rect', { x: l.x - 30, y: l.y - 20, width: 60, height: 40, fill: '#b8d4ff', stroke: '#0066cc', 'stroke-width': 2, rx: 4 }, svg);
      svgEl('text', { x: l.x, y: l.y + 4, 'text-anchor': 'middle', 'font-weight': 600, text: i === 0 ? 'leaf-A' : 'leaf-B' }, svg);
    });
    // ECMP links (faint)
    spines.forEach(s => {
      svgEl('line', { x1: leafL.x + 30, y1: leafL.y - 10, x2: s.x - 18, y2: s.y + 14, stroke: '#ddd' }, svg);
      svgEl('line', { x1: leafR.x - 30, y1: leafR.y - 10, x2: s.x + 18, y2: s.y + 14, stroke: '#ddd' }, svg);
    });

    // Count per spine
    const counts = [0, 0, 0, 0];
    history.forEach(h => counts[h.path]++);
    counts.forEach((c, i) => {
      svgEl('text', { x: spines[i].x, y: spines[i].y - 26, 'text-anchor': 'middle', 'font-size': 11, fill: '#7a3ea1', 'font-weight': 600, text: c } , svg);
    });

    // Last flow highlight
    if (history.length > 0) {
      const last = history[history.length - 1];
      const sp = spines[last.path];
      svgEl('line', { x1: leafL.x + 30, y1: leafL.y - 10, x2: sp.x - 18, y2: sp.y + 14, stroke: '#c73a1f', 'stroke-width': 3, 'marker-end': 'url(#ecmp-arr)' }, svg);
      svgEl('line', { x1: sp.x + 18, y1: sp.y + 14, x2: leafR.x - 30, y2: leafR.y - 10, stroke: '#c73a1f', 'stroke-width': 3, 'marker-end': 'url(#ecmp-arr)' }, svg);
    }

    document.getElementById('ecmp-info').innerHTML = history.length === 0
      ? 'Klikněte „Trasuj" nebo „100 random flow".'
      : `Celkem flow: ${history.length}. Rozložení per spine: ${counts.map((c, i) => `Sp${i + 1}=${c}`).join(', ')}. ` +
        (history.length > 1 ? `<span style="color:var(--text-muted);font-size:12px">Hash distribuuje rovnoměrně, ale jeden velký flow je omezen jedním linkem (elephant flow problem).</span>` : '');
  }
  document.getElementById('ecmp-go').addEventListener('click', go);
  document.getElementById('ecmp-random').addEventListener('click', rand100);
  draw();
}

// ------- Reactive vs Proactive timing -------
function initReactiveVsProactive() {
  function draw() {
    const rtt = parseFloat(document.getElementById('of-rtt').value);
    const len = parseInt(document.getElementById('of-len').value, 10);
    const reactiveTotal = rtt + len * 0.01; // First packet waits RTT, others ~10us
    const proactiveTotal = len * 0.01;
    const svg = document.getElementById('of-compare-svg');
    clearSvg(svg);
    const maxV = Math.max(reactiveTotal, proactiveTotal, rtt);
    const xS = v => 30 + (640 * v / maxV);

    svgEl('text', { x: 30, y: 30, 'font-weight': 600, text: 'Reactive' }, svg);
    svgEl('rect', { x: 30, y: 50, width: xS(rtt) - 30, height: 30, fill: '#c73a1f', opacity: 0.8 }, svg);
    svgEl('text', { x: 30 + (xS(rtt) - 30) / 2, y: 70, 'text-anchor': 'middle', 'font-size': 11, fill: 'white', text: `RTT do controlleru (${rtt}ms)` }, svg);
    svgEl('rect', { x: xS(rtt), y: 50, width: xS(reactiveTotal) - xS(rtt), height: 30, fill: '#0066cc', opacity: 0.7 }, svg);
    svgEl('text', { x: (xS(rtt) + xS(reactiveTotal)) / 2, y: 70, 'text-anchor': 'middle', 'font-size': 11, fill: 'white', text: `${len} paketů` }, svg);
    svgEl('text', { x: xS(reactiveTotal) + 10, y: 70, 'font-size': 11, fill: '#444', text: `${reactiveTotal.toFixed(2)} ms` }, svg);

    svgEl('text', { x: 30, y: 130, 'font-weight': 600, text: 'Proactive' }, svg);
    svgEl('rect', { x: 30, y: 150, width: xS(proactiveTotal) - 30, height: 30, fill: '#0a7a3d', opacity: 0.8 }, svg);
    svgEl('text', { x: 30 + (xS(proactiveTotal) - 30) / 2, y: 170, 'text-anchor': 'middle', 'font-size': 11, fill: 'white', text: `${len} paketů (žádný overhead)` }, svg);
    svgEl('text', { x: xS(proactiveTotal) + 10, y: 170, 'font-size': 11, fill: '#444', text: `${proactiveTotal.toFixed(2)} ms` }, svg);

    document.getElementById('of-compare-info').innerHTML =
      `Pro short-lived flow (${len} paketů) je <strong>reactive ${((reactiveTotal / proactiveTotal)).toFixed(1)}× pomalejší</strong>. Pro DNS dotaz (1-2 pakety) může být reactive 100× pomalejší než proactive! Proto se v praxi míchá: stabilní toky proactively, ad-hoc pravidla reactively.`;
  }
  document.getElementById('of-compare').addEventListener('click', draw);
  ['of-rtt', 'of-len'].forEach(id => document.getElementById(id).addEventListener('input', draw));
  draw();
}

// ------- P4 pipeline -------
function initP4Pipeline() {
  function draw() {
    const svg = document.getElementById('p4-svg');
    clearSvg(svg);
    arrowDef(svg, 'p4-arr', '#0066cc');
    const stages = [
      { name: 'Parser', desc: 'extract(eth); switch(etherType)', x: 30 },
      { name: 'Match-Action Pipeline', desc: 'table.apply() — match → action', x: 230 },
      { name: 'Deparser', desc: 'emit(eth); emit(ip); ...', x: 470 },
    ];
    const stageW = 200, stageH = 100;
    stages.forEach((s, i) => {
      const color = ['#7a3ea1', '#0066cc', '#0a7a3d'][i];
      svgEl('rect', { x: s.x, y: 80, width: stageW, height: stageH, fill: '#fff', stroke: color, 'stroke-width': 2, rx: 6 }, svg);
      svgEl('text', { x: s.x + stageW / 2, y: 105, 'text-anchor': 'middle', 'font-weight': 700, fill: color, text: s.name }, svg);
      svgEl('text', { x: s.x + stageW / 2, y: 130, 'text-anchor': 'middle', 'font-size': 11, 'font-family': 'monospace', fill: '#444', text: s.desc }, svg);
      if (i < 2) {
        svgEl('line', { x1: s.x + stageW, y1: 130, x2: stages[i + 1].x, y2: 130, stroke: '#0066cc', 'stroke-width': 2, 'marker-end': 'url(#p4-arr)' }, svg);
      }
    });
    // Inputs/outputs
    svgEl('text', { x: 15, y: 70, 'font-size': 11, fill: '#666', text: 'raw bytes →' }, svg);
    svgEl('text', { x: 670, y: 70, 'text-anchor': 'end', 'font-size': 11, fill: '#666', text: '→ raw bytes (out)' }, svg);

    svgEl('text', { x: 350, y: 220, 'text-anchor': 'middle', 'font-size': 12, fill: '#7a3ea1', text: 'Klíčové: parser, match-action a deparser jsou plně definované programátorem v P4' }, svg);
    svgEl('text', { x: 350, y: 240, 'text-anchor': 'middle', 'font-size': 11, fill: '#666', text: 'Žádné předem dané hlavičky (jako u OpenFlow) — můžete přidat libovolný custom protokol' }, svg);
    svgEl('text', { x: 350, y: 260, 'text-anchor': 'middle', 'font-size': 11, fill: '#666', text: 'Kompilátor cílí na Tofino ASIC, BMv2 (software), FPGA, eBPF/XDP, ...' }, svg);

    document.getElementById('p4-info').innerHTML = 'P4 program běží uvnitř NIC/switch — žádný kernel stack, žádný controller na fast path.';
  }
  document.getElementById('p4-go').addEventListener('click', draw);
  draw();
}

// ------- VxLAN -------
function initVxLAN() {
  const svg = document.getElementById('vxlan-svg');
  if (!svg) return;
  // Show packet layers
  const layers = [
    { name: 'Outer Ethernet', bytes: 14, color: '#ffe9a3' },
    { name: 'Outer IP (UDP)', bytes: 20, color: '#f0fff5' },
    { name: 'UDP (4789)', bytes: 8, color: '#fce5ff' },
    { name: 'VxLAN (VNI 24b)', bytes: 8, color: '#0066cc', textColor: 'white' },
    { name: 'Inner Ethernet', bytes: 14, color: '#ffe9a3' },
    { name: 'Inner IP', bytes: 20, color: '#f0fff5' },
    { name: 'Inner L4', bytes: 8, color: '#fce5ff' },
    { name: 'Payload', bytes: 100, color: '#fff' },
  ];
  const total = layers.reduce((a, b) => a + b.bytes, 0);
  let x = 20;
  layers.forEach(l => {
    const w = (l.bytes / total) * 660;
    svgEl('rect', { x, y: 50, width: w, height: 60, fill: l.color, stroke: '#555', 'stroke-width': 1.5 }, svg);
    svgEl('text', { x: x + w / 2, y: 85, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 600, fill: l.textColor || '#1a1a1a', text: l.name }, svg);
    svgEl('text', { x: x + w / 2, y: 100, 'text-anchor': 'middle', 'font-size': 9, fill: l.textColor || '#666', text: `${l.bytes} B` }, svg);
    x += w;
  });
  svgEl('text', { x: 350, y: 30, 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 14, text: 'VxLAN encapsulated frame' }, svg);
  svgEl('text', { x: 350, y: 140, 'text-anchor': 'middle', 'font-size': 11, fill: '#7a3ea1', text: 'VNI = 24 bit → 16,7 M tenant sítí na sdílené fyzické infrastruktuře' }, svg);
  svgEl('text', { x: 350, y: 160, 'text-anchor': 'middle', 'font-size': 11, fill: '#666', text: 'L2-over-L3 tunel: vnitřní Ethernet rámec teče přes IP/UDP, takže VM v různých rackích jsou "ve stejné LAN"' }, svg);
  svgEl('text', { x: 350, y: 180, 'text-anchor': 'middle', 'font-size': 11, fill: '#c73a1f', text: 'Overhead: ~50 B → MTU musí být ≥ 1550 B v underlay (nebo PMTUD na VM)' }, svg);
}
