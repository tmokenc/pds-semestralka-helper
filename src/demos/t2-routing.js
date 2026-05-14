// Topic 2: Teorie směrování
// Demos: route selection, Dijkstra/BF step-by-step, counting-to-infinity, BGP selection, MPLS.

import { svgEl, clearSvg, arrowDef, esc, ipMatch, shuffle, pick } from '../util.js';

export function initT2() {
  initRouteSelector();
  initShortestPath();
  initCountToInf();
  initOSPFCost();
  initBGPSelector();
  initMPLS();
  initLSAFlood();
  initEIGRPFeas();
  initNSAP();
  initMPLSStack();
}

// ------- Route selector (AD + LPM) -------
function initRouteSelector() {
  const ROUTES_POOL = [
    { prefix: '10.5.1.0/24', src: 'OSPF', ad: 110, metric: 25, nh: '192.168.1.1' },
    { prefix: '10.5.0.0/16', src: 'eBGP', ad: 20, metric: 0, nh: '203.0.113.1' },
    { prefix: '10.0.0.0/8', src: 'Static', ad: 1, metric: 0, nh: '192.168.0.254' },
    { prefix: '10.5.1.0/24', src: 'EIGRP', ad: 90, metric: 156160, nh: '192.168.2.1' },
    { prefix: '10.5.1.128/25', src: 'RIP', ad: 120, metric: 3, nh: '192.168.3.1' },
    { prefix: '10.5.0.0/24', src: 'OSPF', ad: 110, metric: 40, nh: '192.168.4.1' },
    { prefix: '10.0.0.0/8', src: 'iBGP', ad: 200, metric: 0, nh: '203.0.113.2' },
    { prefix: '0.0.0.0/0', src: 'Static', ad: 1, metric: 0, nh: '203.0.113.254' },
  ];

  function isMatch(prefix, ip) {
    const [pf, len] = prefix.split('/');
    const plen = parseInt(len, 10);
    const ipParts = ip.split('.').map(p => parseInt(p, 10));
    const pfParts = pf.split('.').map(p => parseInt(p, 10));
    let bits = '';
    let pfbits = '';
    for (let i = 0; i < 4; i++) {
      bits += ipParts[i].toString(2).padStart(8, '0');
      pfbits += pfParts[i].toString(2).padStart(8, '0');
    }
    return bits.substring(0, plen) === pfbits.substring(0, plen);
  }
  function prefixLen(p) { return parseInt(p.split('/')[1], 10); }

  function render() {
    const rows = document.getElementById('route-rows');
    const dst = document.getElementById('route-dst').textContent;
    rows.innerHTML = ROUTES_POOL.map(r => {
      const m = isMatch(r.prefix, dst);
      return `<tr style="${m ? 'background:var(--success-bg)' : 'opacity:0.5'}"><td class="mono">${r.prefix}</td><td>${r.src}</td><td class="mono">${r.ad}</td><td class="mono">${r.metric}</td><td class="mono">${r.nh}</td><td>${m ? '<strong style="color:var(--success)">✓ match</strong>' : '— ne'}</td></tr>`;
    }).join('');

    // Pick winner: longest prefix → lowest AD → lowest metric
    const matches = ROUTES_POOL.filter(r => isMatch(r.prefix, dst));
    if (matches.length === 0) {
      document.getElementById('route-result').innerHTML = '<strong>Žádná cesta — paket se zahodí.</strong>';
      return;
    }
    matches.sort((a, b) => prefixLen(b.prefix) - prefixLen(a.prefix) || a.ad - b.ad || a.metric - b.metric);
    const winner = matches[0];
    document.getElementById('route-result').innerHTML = `<strong>Vítěz: ${winner.prefix} přes ${winner.src} (AD=${winner.ad}, metrika=${winner.metric}) → next-hop ${winner.nh}</strong><br><span style="color:var(--text-3);font-size:12px">Pravidlo: nejdříve nejdelší prefix, pak nejnižší AD, pak nejnižší metrika.</span>`;
  }

  document.getElementById('route-randomize').addEventListener('click', () => {
    const o2 = Math.floor(Math.random() * 12);
    const o3 = Math.floor(Math.random() * 8);
    const o4 = Math.floor(Math.random() * 254);
    document.getElementById('route-dst').textContent = `10.${o2}.${o3}.${o4 + 1}`;
    render();
  });
  render();
}

// ------- Dijkstra / Bellman-Ford step-by-step -------
function initShortestPath() {
  // Sample graph
  const nodes = [
    { id: 'A', x: 100, y: 100 },
    { id: 'B', x: 280, y: 60 },
    { id: 'C', x: 460, y: 90 },
    { id: 'D', x: 600, y: 180 },
    { id: 'E', x: 460, y: 280 },
    { id: 'F', x: 280, y: 320 },
    { id: 'G', x: 100, y: 240 },
  ];
  const edges = [
    ['A', 'B', 7], ['A', 'G', 4], ['B', 'C', 5], ['B', 'F', 9],
    ['C', 'D', 3], ['C', 'E', 6], ['D', 'E', 4], ['E', 'F', 5],
    ['F', 'G', 6], ['B', 'G', 8], ['C', 'F', 4],
  ];

  const sourceSel = document.getElementById('sp-source');
  sourceSel.innerHTML = nodes.map(n => `<option value="${n.id}">${n.id}</option>`).join('');

  let state = null;

  function init() {
    const algo = document.getElementById('sp-algo').value;
    const src = sourceSel.value;
    state = {
      algo,
      src,
      dist: Object.fromEntries(nodes.map(n => [n.id, n.id === src ? 0 : Infinity])),
      prev: Object.fromEntries(nodes.map(n => [n.id, null])),
      visited: new Set(),
      current: null,
      iter: 0,
      done: false,
      log: [],
    };
    state.log.push(`Inicializace: zdroj ${src}, d(${src})=0, ostatní ∞`);
    draw();
  }

  function step() {
    if (!state || state.done) return;
    if (state.algo === 'dijkstra') {
      // Pick unvisited node with min dist
      let candidates = nodes.filter(n => !state.visited.has(n.id));
      candidates.sort((a, b) => state.dist[a.id] - state.dist[b.id]);
      const u = candidates[0];
      if (!u || state.dist[u.id] === Infinity) { state.done = true; state.log.push('Hotovo: zbývající uzly nedosažitelné'); draw(); return; }
      state.current = u.id;
      state.visited.add(u.id);
      state.log.push(`Vybrán uzel ${u.id} (d=${state.dist[u.id]}), relaxuji sousedy`);
      // Relax neighbors
      edges.forEach(([a, b, w]) => {
        let v = null;
        if (a === u.id) v = b;
        else if (b === u.id) v = a;
        if (!v || state.visited.has(v)) return;
        if (state.dist[u.id] + w < state.dist[v]) {
          state.dist[v] = state.dist[u.id] + w;
          state.prev[v] = u.id;
          state.log.push(`  Relax ${u.id}→${v}: d(${v}) = ${state.dist[v]}`);
        }
      });
      if (state.visited.size === nodes.length) state.done = true;
    } else {
      // Bellman-Ford: one pass over all edges
      state.iter++;
      let changed = false;
      edges.forEach(([a, b, w]) => {
        // Undirected: try both directions
        [[a, b], [b, a]].forEach(([u, v]) => {
          if (state.dist[u] + w < state.dist[v]) {
            state.dist[v] = state.dist[u] + w;
            state.prev[v] = u;
            state.log.push(`  Iter ${state.iter}: relax ${u}→${v} (w=${w}), d(${v}) = ${state.dist[v]}`);
            changed = true;
          }
        });
      });
      state.log.push(`Iterace ${state.iter} ${changed ? 'změnila' : 'nezměnila'} žádné hodnoty`);
      if (!changed || state.iter >= nodes.length - 1) state.done = true;
    }
    draw();
  }

  function auto() {
    if (!state) init();
    const id = setInterval(() => {
      step();
      if (state.done) clearInterval(id);
    }, 600);
  }

  function draw() {
    const svg = document.getElementById('sp-svg');
    clearSvg(svg);
    arrowDef(svg, 'sp-arr', 'var(--text-3)');
    // edges
    edges.forEach(([a, b, w]) => {
      const na = nodes.find(n => n.id === a);
      const nb = nodes.find(n => n.id === b);
      const usedForward = state && state.prev[b] === a;
      const usedBack = state && state.prev[a] === b;
      const used = usedForward || usedBack;
      svgEl('line', { x1: na.x, y1: na.y, x2: nb.x, y2: nb.y, stroke: used ? 'var(--info)' : 'var(--border-2)', 'stroke-width': used ? 3 : 1.5 }, svg);
      const mx = (na.x + nb.x) / 2, my = (na.y + nb.y) / 2;
      svgEl('text', { x: mx, y: my - 4, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-2)', text: String(w) }, svg);
    });
    // nodes
    nodes.forEach(n => {
      const visited = state && state.visited.has(n.id);
      const current = state && state.current === n.id;
      const fill = current ? 'var(--info)' : visited ? 'var(--info-bg)' : 'var(--surface)';
      svgEl('circle', { cx: n.x, cy: n.y, r: 22, fill, stroke: current ? 'var(--info-strong)' : 'var(--info)', 'stroke-width': current ? 3 : 2 }, svg);
      svgEl('text', { x: n.x, y: n.y + 4, 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': 14, 'font-weight': 700, fill: current ? 'white' : 'var(--text)', text: n.id }, svg);
      const d = state ? (state.dist[n.id] === Infinity ? '∞' : state.dist[n.id]) : '∞';
      svgEl('text', { x: n.x, y: n.y + 38, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--secondary)', text: `d=${d}` }, svg);
    });
    // steps
    const ol = document.getElementById('sp-steps');
    ol.innerHTML = (state ? state.log : []).slice(-12).map((l, i, arr) => `<li class="${i === arr.length - 1 ? 'active' : 'done'}">${esc(l)}</li>`).join('');
  }

  document.getElementById('sp-step').addEventListener('click', () => { if (!state) init(); step(); });
  document.getElementById('sp-auto').addEventListener('click', () => { if (!state) init(); auto(); });
  document.getElementById('sp-reset').addEventListener('click', init);
  document.getElementById('sp-algo').addEventListener('change', init);
  sourceSel.addEventListener('change', init);
  init();
}

// ------- Counting-to-infinity demo -------
function initCountToInf() {
  let state = null;
  function reset() {
    state = {
      defense: document.getElementById('cti-defense').value,
      step: 0,
      broken: false,
      A_to_dst: 1,
      B_to_dst: 2,    // via A
      C_to_dst: 3,    // via B
      log: [],
    };
    draw();
  }
  function brk() {
    if (!state) reset();
    state.broken = true;
    state.A_to_dst = 16;
    state.log.push('A: cesta k cíli padla! A inzeruje 16 (∞)');
    // Run several update rounds
    for (let i = 0; i < 10; i++) {
      step();
      if (state.B_to_dst >= 16 && state.C_to_dst >= 16) break;
    }
    draw();
  }
  function step() {
    if (!state) reset();
    state.step++;
    const def = state.defense;
    // B's view: reachable via A; A says ∞. But B might still have old advert from C saying C can reach (which goes B→C→B loop).
    if (def === 'none') {
      const oldB = state.B_to_dst;
      // B sees A=∞ but C still says C can reach in 3 (via B → loop) → B = C + 1
      state.B_to_dst = Math.min(16, state.C_to_dst + 1);
      const oldC = state.C_to_dst;
      state.C_to_dst = Math.min(16, state.B_to_dst + 1);
      state.log.push(`Iter ${state.step}: B=${state.B_to_dst} (přes C, ten ještě nezná), C=${state.C_to_dst}`);
    }
    else if (def === 'maximum') {
      state.B_to_dst = Math.min(16, state.C_to_dst + 1);
      state.C_to_dst = Math.min(16, state.B_to_dst + 1);
      state.log.push(`Iter ${state.step}: B=${state.B_to_dst}, C=${state.C_to_dst} (limit 16 = ∞)`);
    }
    else if (def === 'splithorizon') {
      // B nesděluje cestu zpět do A; ale C taky neinzeruje zpět B → A=∞ propagace bez loop
      state.B_to_dst = 16;
      state.C_to_dst = 16;
      state.log.push(`Iter ${state.step}: Split Horizon — B i C nepošlou info zpět směrem, odkud přišlo. ∞ se šíří přímo.`);
    }
    else if (def === 'poison') {
      state.B_to_dst = 16;
      state.C_to_dst = 16;
      state.log.push(`Iter ${state.step}: Poison Reverse — A explicitně inzeruje "tato cesta je u mě ∞". B okamžitě 16.`);
    }
  }
  function draw() {
    const svg = document.getElementById('cti-svg');
    clearSvg(svg);
    const nodes = [
      { id: 'dst', x: 50, y: 100, label: 'cíl' },
      { id: 'A', x: 200, y: 100, val: state ? state.A_to_dst : 1 },
      { id: 'B', x: 380, y: 100, val: state ? state.B_to_dst : 2 },
      { id: 'C', x: 560, y: 100, val: state ? state.C_to_dst : 3 },
    ];
    // edges
    svgEl('line', { x1: 70, y1: 100, x2: 180, y2: 100, stroke: state && state.broken ? 'var(--danger)' : 'var(--info)', 'stroke-width': 3, 'stroke-dasharray': state && state.broken ? '4 3' : 'none' }, svg);
    if (state && state.broken) svgEl('text', { x: 125, y: 90, 'text-anchor': 'middle', 'font-size': 14, fill: 'var(--danger)', text: '✗' }, svg);
    svgEl('line', { x1: 220, y1: 100, x2: 360, y2: 100, stroke: 'var(--info)', 'stroke-width': 2 }, svg);
    svgEl('line', { x1: 400, y1: 100, x2: 540, y2: 100, stroke: 'var(--info)', 'stroke-width': 2 }, svg);
    // node circles
    nodes.forEach(n => {
      svgEl('circle', { cx: n.x, cy: n.y, r: 22, fill: 'var(--surface)', stroke: 'var(--info)', 'stroke-width': 2 }, svg);
      svgEl('text', { x: n.x, y: n.y + 5, 'text-anchor': 'middle', 'font-weight': 700, text: n.id }, svg);
      if (n.val != null) {
        svgEl('text', { x: n.x, y: n.y + 42, 'text-anchor': 'middle', 'font-size': 12, fill: n.val >= 16 ? 'var(--danger)' : 'var(--secondary)', text: `d→cíl = ${n.val >= 16 ? '∞' : n.val}` }, svg);
      }
    });
    const ol = document.getElementById('cti-steps');
    ol.innerHTML = (state ? state.log : []).slice(-10).map((l, i, arr) => `<li class="${i === arr.length - 1 ? 'active' : 'done'}">${esc(l)}</li>`).join('');
  }
  document.getElementById('cti-break').addEventListener('click', brk);
  document.getElementById('cti-reset').addEventListener('click', reset);
  document.getElementById('cti-defense').addEventListener('change', reset);
  reset();
}

// ------- OSPF cost -------
function initOSPFCost() {
  const calc = () => {
    const bw = parseFloat(document.getElementById('ospf-bw').value);
    const cost = Math.max(1, Math.round(100 / bw));
    document.getElementById('ospf-out').innerHTML =
      `Cost = 100 Mbps / ${bw} Mbps = <strong>${cost}</strong>` +
      `<br><span style="color:var(--text-3);font-size:12px">Cisco používá minimální cost 1. Vyšší bandwidth → nižší cost (lepší cesta).</span>`;
  };
  document.getElementById('ospf-bw').addEventListener('input', calc);
  calc();
}

// ------- BGP route selection -------
function initBGPSelector() {
  let routes = null;
  function gen() {
    routes = ['Cesta 1', 'Cesta 2', 'Cesta 3'].map(n => ({
      name: n,
      weight: pick([0, 100, 200, 500]),
      localPref: pick([100, 200, 300]),
      locally: pick([false, false, false, true]),
      asPath: '65001 ' + Array.from({ length: 1 + Math.floor(Math.random() * 4) }, () => Math.floor(Math.random() * 65000) + 1000).join(' '),
      origin: pick(['IGP', 'EGP', 'incomplete']),
      med: Math.floor(Math.random() * 200),
      ebgp: pick([true, true, false]),
    }));
    render();
  }
  function render() {
    const rows = document.getElementById('bgp-rows');
    rows.innerHTML = routes.map(r => `<tr><td><strong>${r.name}</strong></td><td class="mono">${r.weight}</td><td class="mono">${r.localPref}</td><td>${r.locally ? '✓' : '—'}</td><td class="mono">${r.asPath}</td><td>${r.origin}</td><td class="mono">${r.med}</td><td>${r.ebgp ? 'eBGP' : 'iBGP'}</td></tr>`).join('');
    document.getElementById('bgp-result').textContent = '';
  }
  function decide() {
    const ranks = [
      ['Weight (vyšší)', (a, b) => b.weight - a.weight],
      ['LOCAL_PREF (vyšší)', (a, b) => b.localPref - a.localPref],
      ['Locally generated', (a, b) => (b.locally - a.locally)],
      ['AS-PATH (kratší)', (a, b) => a.asPath.split(' ').length - b.asPath.split(' ').length],
      ['ORIGIN (IGP<EGP<incomplete)', (a, b) => ({ IGP: 0, EGP: 1, incomplete: 2 }[a.origin] - { IGP: 0, EGP: 1, incomplete: 2 }[b.origin])],
      ['MED (nižší)', (a, b) => a.med - b.med],
      ['eBGP před iBGP', (a, b) => (b.ebgp - a.ebgp)],
    ];
    let candidates = routes.slice();
    const reasons = [];
    for (const [name, cmp] of ranks) {
      candidates.sort(cmp);
      const top = candidates[0];
      const tied = candidates.filter(c => cmp(c, top) === 0);
      reasons.push(`<strong>${name}</strong>: ${tied.map(t => t.name).join(', ')}${tied.length === 1 ? ' ← rozhodnutí' : ' (remíza, zkusím další pravidlo)'}`);
      if (tied.length === 1) {
        document.getElementById('bgp-result').innerHTML = reasons.join('<br>') + `<br><br><strong style="color:var(--success)">Vítěz: ${top.name}</strong>`;
        return;
      }
      candidates = tied;
    }
    document.getElementById('bgp-result').innerHTML = reasons.join('<br>') + `<br><br><strong>Vítěz (po tie-break IGP cost/age/router-id): ${candidates[0].name}</strong>`;
  }
  document.getElementById('bgp-decide').addEventListener('click', decide);
  document.getElementById('bgp-shuffle').addEventListener('click', gen);
  gen();
}

// ------- MPLS LSP simulator -------
function initMPLS() {
  const lsrs = [
    { id: 'CE1', x: 50, y: 100, type: 'ce', label: '— IP paket —' },
    { id: 'LER-in', x: 180, y: 100, type: 'ler-in', label: 'PUSH lbl 17' },
    { id: 'LSR1', x: 320, y: 100, type: 'lsr', label: 'SWAP 17→23' },
    { id: 'LSR2', x: 460, y: 100, type: 'lsr', label: 'SWAP 23→42' },
    { id: 'LER-out', x: 600, y: 100, type: 'ler-out', label: 'POP → IP' },
  ];
  let played = false;

  function draw() {
    const svg = document.getElementById('mpls-svg');
    clearSvg(svg);
    arrowDef(svg, 'mpls-arr', 'var(--info)');
    lsrs.forEach((n, i) => {
      const color = n.type === 'lsr' ? 'var(--info-bg)' : n.type.includes('ler') ? 'var(--warning-bg)' : 'var(--bg-2)';
      svgEl('rect', { x: n.x - 50, y: n.y - 22, width: 100, height: 44, fill: color, stroke: 'var(--info)', 'stroke-width': 2, rx: 6 }, svg);
      svgEl('text', { x: n.x, y: n.y - 4, 'text-anchor': 'middle', 'font-weight': 600, 'font-size': 12, text: n.id }, svg);
      svgEl('text', { x: n.x, y: n.y + 14, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-2)', text: n.label }, svg);
      if (i < lsrs.length - 1) {
        const next = lsrs[i + 1];
        svgEl('line', { x1: n.x + 50, y1: n.y, x2: next.x - 50, y2: next.y, stroke: 'var(--text-3)', 'stroke-width': 1.5 }, svg);
      }
    });
    if (played) {
      const packet = svgEl('g', {}, svg);
      svgEl('rect', { x: 30, y: 165, width: 130, height: 50, fill: 'var(--node-fill)', stroke: 'var(--info)', 'stroke-width': 2 }, packet);
      svgEl('text', { x: 95, y: 158, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--secondary)', text: 'Paket prochází:' }, packet);
      // Animation steps
      svgEl('rect', { x: 35, y: 170, width: 40, height: 18, fill: 'var(--warning-bg)', stroke: 'var(--warning)' }, packet);
      svgEl('text', { x: 55, y: 183, 'text-anchor': 'middle', 'font-size': 10, text: 'L2' }, packet);
      svgEl('rect', { x: 75, y: 170, width: 80, height: 18, fill: 'var(--success-bg)', stroke: 'var(--success)' }, packet);
      svgEl('text', { x: 115, y: 183, 'text-anchor': 'middle', 'font-size': 10, text: 'IP' }, packet);
      svgEl('text', { x: 95, y: 205, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-3)', text: 'na CE1: čistý IP' }, packet);

      svgEl('g', { transform: 'translate(170, 0)' }, packet);
      svgEl('rect', { x: 170, y: 170, width: 30, height: 18, fill: 'var(--warning-bg)', stroke: 'var(--warning)' }, svg);
      svgEl('text', { x: 185, y: 183, 'text-anchor': 'middle', 'font-size': 10, text: 'L2' }, svg);
      svgEl('rect', { x: 200, y: 170, width: 40, height: 18, fill: 'var(--secondary-bg)', stroke: 'var(--secondary)' }, svg);
      svgEl('text', { x: 220, y: 183, 'text-anchor': 'middle', 'font-size': 9, text: 'lbl 17' }, svg);
      svgEl('rect', { x: 240, y: 170, width: 60, height: 18, fill: 'var(--success-bg)', stroke: 'var(--success)' }, svg);
      svgEl('text', { x: 270, y: 183, 'text-anchor': 'middle', 'font-size': 10, text: 'IP' }, svg);
      svgEl('text', { x: 235, y: 205, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-3)', text: 'po PUSH: shim 17' }, svg);

      svgEl('rect', { x: 310, y: 170, width: 30, height: 18, fill: 'var(--warning-bg)', stroke: 'var(--warning)' }, svg);
      svgEl('text', { x: 325, y: 183, 'text-anchor': 'middle', 'font-size': 10, text: 'L2' }, svg);
      svgEl('rect', { x: 340, y: 170, width: 40, height: 18, fill: 'var(--secondary-bg)', stroke: 'var(--secondary)' }, svg);
      svgEl('text', { x: 360, y: 183, 'text-anchor': 'middle', 'font-size': 9, text: 'lbl 23' }, svg);
      svgEl('rect', { x: 380, y: 170, width: 60, height: 18, fill: 'var(--success-bg)', stroke: 'var(--success)' }, svg);
      svgEl('text', { x: 410, y: 183, 'text-anchor': 'middle', 'font-size': 10, text: 'IP' }, svg);
      svgEl('text', { x: 375, y: 205, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-3)', text: 'SWAP 17→23' }, svg);

      svgEl('rect', { x: 450, y: 170, width: 30, height: 18, fill: 'var(--warning-bg)', stroke: 'var(--warning)' }, svg);
      svgEl('text', { x: 465, y: 183, 'text-anchor': 'middle', 'font-size': 10, text: 'L2' }, svg);
      svgEl('rect', { x: 480, y: 170, width: 40, height: 18, fill: 'var(--secondary-bg)', stroke: 'var(--secondary)' }, svg);
      svgEl('text', { x: 500, y: 183, 'text-anchor': 'middle', 'font-size': 9, text: 'lbl 42' }, svg);
      svgEl('rect', { x: 520, y: 170, width: 60, height: 18, fill: 'var(--success-bg)', stroke: 'var(--success)' }, svg);
      svgEl('text', { x: 550, y: 183, 'text-anchor': 'middle', 'font-size': 10, text: 'IP' }, svg);
      svgEl('text', { x: 515, y: 205, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-3)', text: 'SWAP 23→42' }, svg);

      svgEl('rect', { x: 595, y: 170, width: 30, height: 18, fill: 'var(--warning-bg)', stroke: 'var(--warning)' }, svg);
      svgEl('text', { x: 610, y: 183, 'text-anchor': 'middle', 'font-size': 10, text: 'L2' }, svg);
      svgEl('rect', { x: 625, y: 170, width: 60, height: 18, fill: 'var(--success-bg)', stroke: 'var(--success)' }, svg);
      svgEl('text', { x: 655, y: 183, 'text-anchor': 'middle', 'font-size': 10, text: 'IP' }, svg);
      svgEl('text', { x: 645, y: 205, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-3)', text: 'po POP: čistý IP' }, svg);
    }
    document.getElementById('mpls-info').innerHTML = played
      ? `LSP <code>CE1 → LER-in → LSR1 → LSR2 → LER-out → CE2</code>. Labely jsou <em>locally significant</em> — každý LSR má svou LIB s mapováním in-label → out-label.`
      : 'Klikněte „Pošli paket" pro animaci PUSH/SWAP/SWAP/POP.';
  }
  document.getElementById('mpls-play').addEventListener('click', () => { played = true; draw(); });
  document.getElementById('mpls-reset').addEventListener('click', () => { played = false; draw(); });
  draw();
}

// ------- LSA flooding -------
function initLSAFlood() {
  const NODES = [
    { id: 'R1', x: 100, y: 80 },
    { id: 'R2', x: 280, y: 60 },
    { id: 'R3', x: 460, y: 80 },
    { id: 'R4', x: 600, y: 180 },
    { id: 'R5', x: 460, y: 280 },
    { id: 'R6', x: 280, y: 300 },
    { id: 'R7', x: 100, y: 280 },
    { id: 'R8', x: 280, y: 180 },
  ];
  const LINKS = [['R1','R2'],['R2','R3'],['R3','R4'],['R4','R5'],['R5','R6'],['R6','R7'],['R7','R1'],['R2','R8'],['R3','R8'],['R5','R8'],['R7','R8']];
  let received = new Set(['R1']);
  let waves = []; // each wave: list of {from, to}
  let waveIdx = 0;
  let log = [];

  function reset() {
    received = new Set(['R1']);
    waves = [];
    waveIdx = 0;
    log = ['R1 detekoval změnu topologie — generuje LSA.'];
    draw();
  }

  function bfsFlood() {
    // BFS waves of flooding
    let frontier = ['R1'];
    while (frontier.length > 0) {
      const newFrontier = [];
      const wave = [];
      frontier.forEach(from => {
        LINKS.forEach(([a, b]) => {
          let neighbor = null;
          if (a === from && !received.has(b)) neighbor = b;
          else if (b === from && !received.has(a)) neighbor = a;
          if (neighbor) {
            received.add(neighbor);
            wave.push({ from, to: neighbor });
            newFrontier.push(neighbor);
          }
        });
      });
      if (wave.length === 0) break;
      waves.push(wave);
      frontier = newFrontier;
    }
    waveIdx = 0;
    log.push(`Flooding má ${waves.length} vln. Klikněte „Spustit" znovu pro krokování.`);
    received = new Set(['R1']);
    draw();
  }

  function step() {
    if (waveIdx >= waves.length) {
      log.push('Hotovo — všechny routery mají LSA, LSDB konvergována.');
      draw();
      return;
    }
    const wave = waves[waveIdx];
    wave.forEach(({ from, to }) => {
      received.add(to);
      log.push(`${from} → ${to}: forward LSA (kromě zpět odkud přišlo)`);
    });
    waveIdx++;
    draw();
  }

  function draw() {
    const svg = document.getElementById('lsa-svg');
    clearSvg(svg);
    LINKS.forEach(([a, b]) => {
      const na = NODES.find(n => n.id === a);
      const nb = NODES.find(n => n.id === b);
      svgEl('line', { x1: na.x, y1: na.y, x2: nb.x, y2: nb.y, stroke: 'var(--border-2)', 'stroke-width': 1.5 }, svg);
    });
    // Current wave arrows
    if (waveIdx > 0 && waveIdx <= waves.length) {
      arrowDef(svg, 'lsa-arr', 'var(--danger)');
      waves[waveIdx - 1].forEach(({ from, to }) => {
        const a = NODES.find(n => n.id === from);
        const b = NODES.find(n => n.id === to);
        svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'var(--danger)', 'stroke-width': 3, 'marker-end': 'url(#lsa-arr)' }, svg);
      });
    }
    NODES.forEach(n => {
      const fill = n.id === 'R1' ? 'var(--danger)' : received.has(n.id) ? 'var(--success)' : 'var(--node-fill)';
      svgEl('circle', { cx: n.x, cy: n.y, r: 22, fill, stroke: 'var(--text-2)', 'stroke-width': 2 }, svg);
      svgEl('text', { x: n.x, y: n.y + 4, 'text-anchor': 'middle', 'font-weight': 600, fill: received.has(n.id) || n.id === 'R1' ? 'white' : 'var(--text)', text: n.id }, svg);
    });
    const ol = document.getElementById('lsa-steps');
    ol.innerHTML = log.slice(-8).map((l, i, arr) => `<li class="${i === arr.length - 1 ? 'active' : 'done'}">${esc(l)}</li>`).join('');
  }

  document.getElementById('lsa-flood').addEventListener('click', () => {
    if (waves.length === 0) bfsFlood();
    step();
  });
  document.getElementById('lsa-reset').addEventListener('click', reset);
  reset();
}

// ------- EIGRP feasibility -------
function initEIGRPFeas() {
  function draw() {
    const fd = parseInt(document.getElementById('eigrp-fd').value, 10);
    const rdB = parseInt(document.getElementById('eigrp-rdb').value, 10);
    const rdC = parseInt(document.getElementById('eigrp-rdc').value, 10);
    const svg = document.getElementById('eigrp-svg');
    clearSvg(svg);
    // Draw 4 nodes A (us), B, C, target
    const nodes = [
      { id: 'A (my)', x: 100, y: 120, color: 'var(--info)' },
      { id: 'B', x: 350, y: 60, color: 'var(--secondary)' },
      { id: 'C', x: 350, y: 180, color: 'var(--warning)' },
      { id: 'cíl', x: 600, y: 120, color: 'var(--success)' },
    ];
    nodes.forEach(n => {
      svgEl('circle', { cx: n.x, cy: n.y, r: 22, fill: 'var(--surface)', stroke: n.color, 'stroke-width': 2.5 }, svg);
      svgEl('text', { x: n.x, y: n.y + 4, 'text-anchor': 'middle', 'font-weight': 700, fill: n.color, text: n.id }, svg);
    });
    // Edges
    svgEl('line', { x1: 122, y1: 110, x2: 328, y2: 70, stroke: 'var(--text-3)', 'stroke-width': 2 }, svg);
    svgEl('line', { x1: 122, y1: 130, x2: 328, y2: 170, stroke: 'var(--text-3)', 'stroke-width': 2 }, svg);
    svgEl('line', { x1: 372, y1: 60, x2: 578, y2: 110, stroke: 'var(--text-3)', 'stroke-width': 2 }, svg);
    svgEl('line', { x1: 372, y1: 180, x2: 578, y2: 130, stroke: 'var(--text-3)', 'stroke-width': 2 }, svg);
    // Labels
    svgEl('text', { x: 100, y: 220, 'text-anchor': 'middle', 'font-size': 12, text: `FD = ${fd}` }, svg);
    svgEl('text', { x: 350, y: 30, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--secondary)', text: `B→cíl: ${rdB}` }, svg);
    svgEl('text', { x: 350, y: 215, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--warning)', text: `C→cíl: ${rdC}` }, svg);

    const okB = rdB < fd;
    const okC = rdC < fd;
    document.getElementById('eigrp-out').innerHTML =
      `<table style="font-size:13px"><tr><th>Soused</th><th>RD</th><th>FD</th><th>RD &lt; FD?</th><th>Status</th></tr>` +
      `<tr><td>B</td><td class="mono">${rdB}</td><td class="mono">${fd}</td><td>${okB ? '✓' : '✗'}</td><td style="color:${okB ? 'var(--success)' : 'var(--danger)'}">${okB ? 'FEASIBLE — loop-free, lze použít' : 'NE-feasible — možná smyčka, EIGRP odmítá'}</td></tr>` +
      `<tr><td>C</td><td class="mono">${rdC}</td><td class="mono">${fd}</td><td>${okC ? '✓' : '✗'}</td><td style="color:${okC ? 'var(--success)' : 'var(--danger)'}">${okC ? 'FEASIBLE' : 'NE-feasible'}</td></tr></table>` +
      `<div style="font-size:12px;color:var(--text-3);margin-top:6px">Logika: pokud má soused k cíli kratší cestu, určitě nejde přes nás — kdyby ano, jeho vzdálenost by zahrnovala naši FD.</div>`;
  }
  ['eigrp-fd','eigrp-rdb','eigrp-rdc'].forEach(id => document.getElementById(id).addEventListener('input', draw));
  draw();
}

// ------- NSAP parser -------
function initNSAP() {
  function parse() {
    const raw = document.getElementById('nsap-input').value.replace(/\./g, '').trim();
    if (!/^[0-9a-fA-F]+$/.test(raw)) {
      document.getElementById('nsap-out').innerHTML = '<span class="warn">Neplatný NSAP (hex znaky a tečky)</span>';
      return;
    }
    if (raw.length < 16) {
      document.getElementById('nsap-out').innerHTML = '<span class="warn">NSAP je krátký (min. 16 hex znaků)</span>';
      return;
    }
    // Standard interpretation:
    // AFI (1B) | Area (variable) | System ID (6B = 12 hex) | NSEL (1B = 2 hex)
    const afi = raw.substring(0, 2);
    const nsel = raw.substring(raw.length - 2);
    const sysId = raw.substring(raw.length - 14, raw.length - 2);
    const area = raw.substring(2, raw.length - 14);
    document.getElementById('nsap-out').innerHTML =
      `<table style="font-size:13px"><tr><th>Pole</th><th>Velikost</th><th>Hex</th><th>Význam</th></tr>` +
      `<tr><td>AFI</td><td>1 B</td><td class="mono">${afi}</td><td>${afi === '49' ? 'Privátní doména' : afi === '47' ? 'ICD' : 'Authority Format Identifier'}</td></tr>` +
      `<tr><td>Area ID</td><td>${area.length / 2} B</td><td class="mono">${area || '—'}</td><td>Oblast (analog OSPF Area)</td></tr>` +
      `<tr><td>System ID</td><td>6 B</td><td class="mono">${sysId}</td><td>Unikátní identifikátor uzlu (jako MAC)</td></tr>` +
      `<tr><td>NSEL</td><td>1 B</td><td class="mono">${nsel}</td><td>${nsel === '00' ? 'Network Entity Title (router sám)' : 'Service selector'}</td></tr></table>` +
      `<div style="font-size:12px;color:var(--text-3);margin-top:6px"><strong>Klíčový rozdíl od IP:</strong> NSAP identifikuje <em>uzel jako celek</em>, ne jednotlivá rozhraní.</div>`;
  }
  document.getElementById('nsap-input').addEventListener('input', parse);
  parse();
}

// ------- MPLS label stack -------
function initMPLSStack() {
  function draw() {
    const depth = parseInt(document.getElementById('stack-depth').value, 10);
    const svg = document.getElementById('stack-svg');
    clearSvg(svg);
    const W = 700;
    svgEl('text', { x: W / 2, y: 25, 'text-anchor': 'middle', 'font-weight': 600, 'font-size': 14, text: `MPLS label stack (hloubka ${depth})` }, svg);

    // L2 frame
    svgEl('rect', { x: 30, y: 60, width: 80, height: 60, fill: 'var(--warning-bg)', stroke: 'var(--warning)', 'stroke-width': 2 }, svg);
    svgEl('text', { x: 70, y: 95, 'text-anchor': 'middle', 'font-size': 13, text: 'L2 hdr' }, svg);

    // Labels (top → bottom of stack)
    const colors = ['var(--secondary)', 'var(--info)', 'var(--danger)', 'var(--success)', 'var(--warning)'];
    for (let i = 0; i < depth; i++) {
      const x = 120 + i * 100;
      const isBottom = i === depth - 1;
      svgEl('rect', { x, y: 60, width: 90, height: 60, fill: 'var(--secondary-bg)', stroke: colors[i], 'stroke-width': 2 }, svg);
      svgEl('text', { x: x + 45, y: 80, 'text-anchor': 'middle', 'font-weight': 600, 'font-size': 11, text: `Label ${depth - i}` }, svg);
      svgEl('text', { x: x + 45, y: 96, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-2)', text: '20b + 3b EXP' }, svg);
      svgEl('text', { x: x + 45, y: 110, 'text-anchor': 'middle', 'font-size': 10, fill: isBottom ? 'var(--danger)' : 'var(--text-2)', 'font-weight': isBottom ? 700 : 400, text: `S=${isBottom ? '1' : '0'} TTL` }, svg);
      svgEl('text', { x: x + 45, y: 135, 'text-anchor': 'middle', 'font-size': 9, fill: 'var(--text-3)', text: i === 0 ? '← vnější (core)' : isBottom ? '← vnitřní (service)' : '' }, svg);
    }

    // IP packet
    const ipX = 120 + depth * 100;
    svgEl('rect', { x: ipX, y: 60, width: W - ipX - 30, height: 60, fill: 'var(--success-bg)', stroke: 'var(--success)', 'stroke-width': 2 }, svg);
    svgEl('text', { x: (ipX + W - 30) / 2, y: 95, 'text-anchor': 'middle', 'font-size': 13, text: 'IP packet (payload)' }, svg);

    svgEl('text', { x: W / 2, y: 170, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text-3)', text: 'Vnější label řeší core (P routery), vnitřní service (VPN, TE tunel)' }, svg);
    svgEl('text', { x: W / 2, y: 195, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--secondary)', text: 'PHP (Penultimate Hop Popping): poslední LSR sundá vnější label před egress, ušetří POP operaci' }, svg);
    svgEl('text', { x: W / 2, y: 215, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--secondary)', text: 'S bit = 1 znamená "tohle je poslední label, pod ním je už nativní paket"' }, svg);
  }
  document.getElementById('stack-depth').addEventListener('input', draw);
  draw();
}
