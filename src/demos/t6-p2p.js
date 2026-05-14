// Topic 6: Sítě P2P
// Demos: Milgram chart, unstructured search animation, Kademlia XOR + k-buckets + FIND_VALUE,
// BitTorrent swarm.

import { svgEl, clearSvg, arrowDef, esc, shuffle, pick } from '../util.js';

export function initT6() {
  initMilgram();
  initUnstructured();
  initXOR();
  initKademlia();
  initBitTorrent();
  initChord();
  initLMS();
  initBencoding();
  initSybil();
}

// ------- Milgram chart -------
function initMilgram() {
  // Approximate Milgram results: chain lengths 2-11, median 5
  const data = [
    { len: 2, count: 1 }, { len: 3, count: 4 }, { len: 4, count: 6 },
    { len: 5, count: 8 }, { len: 6, count: 8 }, { len: 7, count: 6 },
    { len: 8, count: 5 }, { len: 9, count: 3 }, { len: 10, count: 2 }, { len: 11, count: 1 },
  ];
  const g = document.getElementById('milgram-bars');
  if (!g) return;
  const maxC = Math.max(...data.map(d => d.count));
  const barW = 50;
  const startX = 80;
  data.forEach((d, i) => {
    const h = 120 * d.count / maxC;
    const x = startX + i * (barW + 5);
    const y = 170 - h;
    svgEl('rect', { x, y, width: barW, height: h, fill: 'var(--secondary)', opacity: 0.7 }, g);
    svgEl('text', { x: x + barW / 2, y: y - 4, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-2)', text: d.count }, g);
    svgEl('text', { x: x + barW / 2, y: 184, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-3)', text: d.len }, g);
    if (d.len === 5) {
      svgEl('text', { x: x + barW / 2, y: y - 18, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--danger)', 'font-weight': 600, text: 'medián' }, g);
    }
  });
}

// ------- Unstructured search -------
function initUnstructured() {
  // Generate random P2P graph
  const NUM_NODES = 14;
  const TARGET_NODE = 11;
  let nodes, edges, visited, queue, ttl, step, log;

  function readTTL() {
    const el = document.getElementById('unstr-ttl');
    const v = el ? parseInt(el.value, 10) : 3;
    return Math.max(1, Math.min(10, isNaN(v) ? 3 : v));
  }

  function initGraph() {
    nodes = [];
    for (let i = 0; i < NUM_NODES; i++) {
      const angle = (i / NUM_NODES) * 2 * Math.PI;
      const r = 130;
      nodes.push({
        id: i,
        x: 350 + Math.cos(angle) * r,
        y: 180 + Math.sin(angle) * r,
      });
    }
    edges = new Set();
    nodes.forEach((n, i) => {
      const k = 3 + Math.floor(Math.random() * 2);
      const targets = shuffle(nodes.filter(m => m.id !== i)).slice(0, k);
      targets.forEach(t => {
        const key = i < t.id ? `${i}-${t.id}` : `${t.id}-${i}`;
        edges.add(key);
      });
    });
    const method = document.getElementById('unstr-method')?.value || 'flood';
    visited = new Set([0]);
    // Initial TTL depends on method:
    // - flood: user-set TTL (one big flood, one shot)
    // - ring: starts at 1 and grows on each step (so first step = small ring)
    // - walk / lms: user-set TTL = max walker steps
    const userTtl = readTTL();
    if (method === 'ring') {
      ttl = 1;
      queue = [{ node: 0, ttl: 1, from: null }];
    } else {
      ttl = userTtl;
      queue = [{ node: 0, ttl: userTtl, from: null }];
    }
    step = 0;
    log = [];
  }

  function getNeighbors(id) {
    const result = [];
    edges.forEach(e => {
      const [a, b] = e.split('-').map(Number);
      if (a === id) result.push(b);
      else if (b === id) result.push(a);
    });
    return result;
  }

  function doStep() {
    const method = document.getElementById('unstr-method').value;
    if (queue.length === 0) {
      log.push('Hotovo (nic dalšího k prohledávání)');
      return false;
    }
    step++;
    if (method === 'flood') {
      const next = [];
      queue.forEach(item => {
        if (item.ttl <= 0) return;
        const ns = getNeighbors(item.node).filter(n => !visited.has(n));
        ns.forEach(n => {
          visited.add(n);
          next.push({ node: n, ttl: item.ttl - 1, from: item.node });
          if (n === TARGET_NODE) log.push(`✓ NALEZENO! Uzel ${TARGET_NODE} obsahuje data, krok ${step}`);
        });
      });
      log.push(`Krok ${step}: rozesláno ${next.length} dotazů (TTL klesá)`);
      queue = next;
    } else if (method === 'ring') {
      // Expanding ring: each step re-floods from scratch with progressively
      // larger TTL until the user-set max is reached. Demonstrates the
      // "start small, expand only if not found" optimization.
      const maxTtl = readTTL();
      if (ttl > maxTtl) {
        log.push(`Krok ${step}: TTL=${ttl} přesáhlo max (${maxTtl}) — zastavuji`);
        queue = [];
      } else {
        visited = new Set([0]);
        let curr = [{ node: 0, depth: 0 }];
        let foundAtThisTtl = false;
        for (let depth = 0; depth < ttl; depth++) {
          const nx = [];
          curr.forEach(it => {
            const ns = getNeighbors(it.node).filter(n => !visited.has(n));
            ns.forEach(n => {
              visited.add(n);
              nx.push({ node: n, depth: depth + 1 });
              if (n === TARGET_NODE) foundAtThisTtl = true;
            });
          });
          curr = nx;
        }
        queue = [];
        log.push(`Krok ${step}: expanding ring s TTL=${ttl}, navštíveno ${visited.size}` +
                 (foundAtThisTtl ? ` ✓ NALEZENO!` : ` — nenalezeno, rozšiřuji`));
        if (!foundAtThisTtl) {
          ttl++;
          queue = [{ node: 0, depth: 0 }];  // marker that we should continue
        }
      }
    } else if (method === 'walk') {
      const item = queue[0];
      const ns = getNeighbors(item.node).filter(n => n !== item.from);
      if (ns.length === 0) { queue = []; log.push(`Krok ${step}: walker zaseknutý`); return false; }
      const next = ns[Math.floor(Math.random() * ns.length)];
      visited.add(next);
      queue = [{ node: next, ttl: item.ttl - 1, from: item.node }];
      log.push(`Krok ${step}: walker → uzel ${next}`);
      if (next === TARGET_NODE) log.push(`✓ NALEZENO! Walker dorazil k uzlu ${TARGET_NODE}`);
    } else if (method === 'lms') {
      // LMS: walk + deterministic last step toward minimum distance
      const item = queue[0];
      const ns = getNeighbors(item.node);
      if (ns.length === 0) { queue = []; return false; }
      // Compute "distance" to TARGET (just XOR of IDs as proxy)
      let best = ns[0]; let bestD = ns[0] ^ TARGET_NODE;
      ns.forEach(n => { const d = n ^ TARGET_NODE; if (d < bestD) { bestD = d; best = n; } });
      visited.add(best);
      queue = [{ node: best, ttl: item.ttl - 1, from: item.node }];
      log.push(`Krok ${step}: LMS → uzel ${best} (XOR dist ${bestD})`);
      if (best === TARGET_NODE) log.push(`✓ Lokální minimum dosaženo (uzel ${TARGET_NODE})`);
    }
    return true;
  }

  function draw() {
    const svg = document.getElementById('unstr-svg');
    clearSvg(svg);
    // edges
    edges.forEach(e => {
      const [a, b] = e.split('-').map(Number);
      svgEl('line', { x1: nodes[a].x, y1: nodes[a].y, x2: nodes[b].x, y2: nodes[b].y, stroke: 'var(--border-2)', 'stroke-width': 1 }, svg);
    });
    // nodes
    nodes.forEach(n => {
      const isTarget = n.id === TARGET_NODE;
      const isVisited = visited.has(n.id);
      const inQueue = queue.some(q => q.node === n.id);
      const fill = isTarget ? 'var(--success)' : inQueue ? 'var(--info)' : isVisited ? 'var(--info-bg)' : 'var(--surface)';
      const stroke = isTarget ? 'var(--success)' : inQueue ? 'var(--info-strong)' : 'var(--text-3)';
      svgEl('circle', { cx: n.x, cy: n.y, r: 16, fill, stroke, 'stroke-width': 2 }, svg);
      svgEl('text', { x: n.x, y: n.y + 4, 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': 12, fill: (isTarget || inQueue) ? 'white' : 'var(--text-2)', text: n.id }, svg);
    });
    svgEl('text', { x: 350, y: 30, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 600, text: `Cíl: uzel ${TARGET_NODE} (zelený). Zdroj: uzel 0.` }, svg);
    document.getElementById('unstr-info').innerHTML = log.slice(-5).map(l => `<div>${esc(l)}</div>`).join('');
  }

  function reset() {
    initGraph();
    draw();
  }

  document.getElementById('unstr-step').addEventListener('click', () => { doStep(); draw(); });
  document.getElementById('unstr-auto').addEventListener('click', () => {
    const id = setInterval(() => {
      const ok = doStep();
      draw();
      if (!ok || visited.has(TARGET_NODE) || step > 20) clearInterval(id);
    }, 500);
  });
  document.getElementById('unstr-reset').addEventListener('click', reset);
  document.getElementById('unstr-method').addEventListener('change', reset);
  document.getElementById('unstr-ttl').addEventListener('input', reset);
  reset();
}

// ------- XOR distance -------
function initXOR() {
  const calc = () => {
    const a = document.getElementById('xor-a').value.trim();
    const b = document.getElementById('xor-b').value.trim();
    if (!/^[01]+$/.test(a) || !/^[01]+$/.test(b) || a.length !== b.length) {
      document.getElementById('xor-result').innerHTML = '<span class="warn">Zadejte binární řetězce stejné délky</span>';
      return;
    }
    const aNum = parseInt(a, 2), bNum = parseInt(b, 2);
    const xor = aNum ^ bNum;
    const xorBin = xor.toString(2).padStart(a.length, '0');
    // Find longest common prefix length
    let prefix = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) prefix++;
      else break;
    }
    document.getElementById('xor-result').innerHTML =
      `<table style="font-family:monospace;font-size:14px"><tr><td>A</td><td>${a}</td><td>(${aNum})</td></tr>` +
      `<tr><td>B</td><td>${b}</td><td>(${bNum})</td></tr>` +
      `<tr style="border-top:1px solid #999"><td>XOR</td><td style="color:var(--secondary);font-weight:700">${xorBin}</td><td>(${xor})</td></tr></table>` +
      `<div style="margin-top:8px">Vzdálenost <strong>d(A, B) = ${xor}</strong>. Společný prefix: <strong>${prefix} bitů</strong>.</div>` +
      `<div style="font-size:12px;color:var(--text-3);margin-top:4px">Bity, ve kterých se ID liší, jsou přesně hloubka stromu, kde se uzly rozcházejí. Proto má Kademlia logaritmické k-buckety.</div>`;
  };
  ['xor-a', 'xor-b'].forEach(id => document.getElementById(id).addEventListener('input', calc));
  calc();
}

// ------- Kademlia FIND_VALUE — hop-by-hop animation -------
function initKademlia() {
  const N = 32;  // 5-bit IDs
  const k = 3;
  const W = 720, H = 400;
  let state = { self: 2, target: 26, traversal: [], shownHops: 0 };

  // Return the set of nodes that `node` knows about — up to k nodes per
  // k-bucket (distance range [2^i, 2^(i+1))). This is the LOCAL knowledge
  // each node has; without this constraint the demo would always reach the
  // target in one hop (the lookup would just pick the target globally).
  function knownNodesOf(node) {
    const known = new Set();
    for (let i = 0; i < 5; i++) {
      const lo = 1 << i;
      const hi = 1 << (i + 1);
      const inBucket = [];
      for (let j = 0; j < N; j++) {
        if (j === node) continue;
        const d = j ^ node;
        if (d >= lo && d < hi) inBucket.push(j);
      }
      // First k in numerical order (deterministic for demo)
      inBucket.sort((a, b) => a - b);
      inBucket.slice(0, k).forEach(n => known.add(n));
    }
    return known;
  }

  function computeTraversal() {
    state.self = parseInt(document.getElementById('kad-self').value, 10);
    state.target = parseInt(document.getElementById('kad-target').value, 10);
    state.traversal = [];
    let current = state.self;
    let iter = 0;
    while (current !== state.target && iter < 8) {
      const xor = current ^ state.target;
      // Only consider nodes the current node KNOWS (its k-buckets).
      const known = knownNodesOf(current);
      let best = current;
      let bestDist = xor;
      known.forEach(n => {
        const d = n ^ state.target;
        if (d < bestDist) { bestDist = d; best = n; }
      });
      // If none of the known nodes is closer, terminate — closest known
      // candidate to the target IS the answer (real Kademlia returns this
      // node, which is responsible for the key in the DHT).
      if (best === current) break;
      state.traversal.push({ from: current, to: best, dist: bestDist, xorBefore: xor });
      current = best;
      iter++;
    }
  }

  function reset() {
    computeTraversal();
    state.shownHops = 0;
    draw();
  }

  function step() {
    if (state.traversal.length === 0) computeTraversal();
    if (state.shownHops >= state.traversal.length) state.shownHops = 0;
    else state.shownHops++;
    draw();
  }

  function findAll() {
    if (state.traversal.length === 0) computeTraversal();
    state.shownHops = state.traversal.length;
    draw();
  }

  function draw() {
    const svg = document.getElementById('kad-svg');
    clearSvg(svg);
    arrowDef(svg, 'kad-arr-cur',  'var(--accent)');
    arrowDef(svg, 'kad-arr-past', 'var(--secondary)');

    const ringR = 125;
    const cx = W / 2 + 60, cy = H / 2 + 10;
    const totalHops = state.traversal.length;
    const cur = state.shownHops > 0 ? state.traversal[state.shownHops - 1] : null;
    const reached = cur && cur.to === state.target;

    // Phase banner
    svgEl('rect', { x: 0, y: 0, width: W, height: 50, fill: 'var(--bg-2)' }, svg);
    svgEl('text', { x: 18, y: 22, 'font-size': 14, 'font-weight': 700, fill: 'var(--node-stroke)',
      text: `FIND_VALUE  ·  klíč ${state.target}  ·  z uzlu ${state.self}` }, svg);
    if (cur) {
      const xorFromCurrent = cur.to ^ state.target;
      svgEl('text', { x: 18, y: 40, 'font-size': 12, fill: reached ? 'var(--success)' : 'var(--accent)', 'font-weight': 600,
        text: reached
          ? `✓ Cíl nalezen po ${totalHops} skocích — XOR dist=0`
          : `◉ Hop ${state.shownHops}: ${cur.from} → ${cur.to}, XOR zmenšeno z ${cur.xorBefore} na ${xorFromCurrent}`,
      }, svg);
    } else {
      svgEl('text', { x: 18, y: 40, 'font-size': 12, fill: 'var(--text-2)', 'font-weight': 600,
        text: '⏸ Klikni „Další hop" pro postupné zobrazení cesty' }, svg);
    }
    svgEl('text', { x: W - 18, y: 22, 'text-anchor': 'end', 'font-size': 12, fill: 'var(--text-2)',
      text: `hop ${state.shownHops} / ${totalHops}` }, svg);
    svgEl('text', { x: W - 18, y: 40, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--text-2)', 'font-style': 'italic',
      text: `očekáváno ~log₂${N} = ${Math.log2(N).toFixed(1)} skoků` }, svg);

    // Ring of nodes
    for (let i = 0; i < N; i++) {
      const a = (i / N) * 2 * Math.PI - Math.PI / 2;
      const x = cx + Math.cos(a) * ringR;
      const y = cy + Math.sin(a) * ringR;
      const isSelf = i === state.self;
      const isTarget = i === state.target;
      const traversedTo = state.traversal.slice(0, state.shownHops).find(s => s.to === i);
      const isVisited = state.traversal.slice(0, state.shownHops).some(s => s.from === i || s.to === i);
      const isCurrent = cur && cur.to === i;

      let fill = 'var(--node-fill)', stroke = 'var(--border-2)', textFill = 'var(--node-stroke)';
      if (isTarget && reached) { fill = 'var(--success)'; stroke = 'var(--success)'; textFill = 'var(--node-fill)'; }
      else if (isTarget) { fill = 'var(--warning-bg)'; stroke = 'var(--accent)'; }
      else if (isSelf) { fill = 'var(--info-strong)'; stroke = 'var(--info-strong)'; textFill = 'var(--node-fill)'; }
      else if (isCurrent) { fill = 'var(--accent)'; stroke = 'var(--danger)'; textFill = 'var(--node-fill)'; }
      else if (isVisited) { fill = 'var(--accent-soft)'; stroke = 'var(--accent)'; }

      svgEl('circle', { cx: x, cy: y, r: 13, fill, stroke, 'stroke-width': 2 }, svg);
      svgEl('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': 11, fill: textFill, text: i }, svg);
    }
    // Center label
    svgEl('text', { x: cx, y: cy - 4, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-2)', text: `N=${N}, k=${k}` }, svg);
    svgEl('text', { x: cx, y: cy + 10, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-2)', text: 'XOR metric' }, svg);

    // Traversal arrows
    for (let i = 0; i < state.shownHops; i++) {
      const s = state.traversal[i];
      const a1 = (s.from / N) * 2 * Math.PI - Math.PI / 2;
      const a2 = (s.to / N) * 2 * Math.PI - Math.PI / 2;
      const x1 = cx + Math.cos(a1) * (ringR - 13);
      const y1 = cy + Math.sin(a1) * (ringR - 13);
      const x2 = cx + Math.cos(a2) * (ringR - 13);
      const y2 = cy + Math.sin(a2) * (ringR - 13);
      const mx = (x1 + x2 + cx) / 3, my = (y1 + y2 + cy) / 3;
      const isCurrent = i === state.shownHops - 1;
      svgEl('path', {
        d: `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`,
        fill: 'none',
        stroke: isCurrent ? 'var(--accent)' : 'var(--secondary)',
        'stroke-width': isCurrent ? 3 : 2,
        opacity: isCurrent ? 1 : 0.55,
        'marker-end': `url(#${isCurrent ? 'kad-arr-cur' : 'kad-arr-past'})`,
      }, svg);
      // Hop number label
      svgEl('text', { x: mx, y: my, 'text-anchor': 'middle', 'font-size': 10, fill: isCurrent ? 'var(--accent)' : 'var(--secondary)', 'font-weight': 600, text: `#${i + 1}` }, svg);
    }

    // k-buckets panel (left)
    svgEl('rect', { x: 18, y: 58, width: 215, height: 200, fill: 'var(--bg-2)', stroke: 'var(--border)' }, svg);
    svgEl('text', { x: 28, y: 76, 'font-family': 'monospace', 'font-size': 11, 'font-weight': 700, fill: 'var(--node-stroke)',
      text: `k-buckety uzlu ${state.self}` }, svg);
    svgEl('text', { x: 28, y: 90, 'font-size': 10, fill: 'var(--text-2)', text: `k=${k}, vzd. třída [2^i, 2^(i+1))` }, svg);
    for (let i = 0; i < 5; i++) {
      const y = 110 + i * 28;
      const inBucket = [];
      for (let j = 0; j < N; j++) {
        if (j === state.self) continue;
        const d = j ^ state.self;
        if (d >= (1 << i) && d < (1 << (i + 1))) inBucket.push(j);
      }
      svgEl('text', { x: 28, y, 'font-family': 'monospace', 'font-size': 10, fill: 'var(--secondary)',
        text: `bucket ${i} [${1 << i}-${(1 << (i + 1)) - 1}]:` }, svg);
      svgEl('text', { x: 28, y: y + 12, 'font-family': 'monospace', 'font-size': 11, fill: 'var(--node-stroke)',
        text: inBucket.slice(0, k).join(', ') || '—' }, svg);
    }

    // Step button label
    const btn = document.getElementById('kad-step');
    if (btn) {
      btn.textContent = state.shownHops >= totalHops
        ? (totalHops === 0 ? '▸ Spočítat' : '↺ Restart')
        : '▸ Další hop';
    }

    // Step log
    const log = document.getElementById('kad-steps');
    if (log) {
      log.innerHTML = state.shownHops > 0
        ? `<li class="done">Hledám klíč <strong>${state.target}</strong> z uzlu <strong>${state.self}</strong>, počáteční XOR dist = <code>${state.self ^ state.target}</code></li>` +
          state.traversal.slice(0, state.shownHops).map((s, i) => {
            const isLast = i === state.shownHops - 1;
            return `<li class="${isLast ? 'active' : 'done'}">Hop ${i + 1}: uzel ${s.from} → ${s.to} · XOR dist od cíle = <code>${s.dist}</code></li>`;
          }).join('') +
          (reached ? `<li class="active" style="color:var(--success)">✓ Cíl ${state.target} dosažen po ${totalHops} skocích</li>` : '')
        : '<li>Klikni „Další hop" nebo „FIND_VALUE (auto)"</li>';
    }
  }

  document.getElementById('kad-step').addEventListener('click', step);
  document.getElementById('kad-find').addEventListener('click', findAll);
  document.getElementById('kad-reset').addEventListener('click', reset);
  ['kad-self', 'kad-target'].forEach(id => document.getElementById(id).addEventListener('input', reset));
  reset();
}

// ------- BitTorrent swarm -------
function initBitTorrent() {
  // Simple swarm simulation: 5 peers, 6 pieces, each peer has subset
  const NUM_PIECES = 6;
  let peers = [];
  let step = 0;

  function reset() {
    peers = [
      { id: 'seed', pieces: new Set([0, 1, 2, 3, 4, 5]), x: 350, y: 50 },
      { id: 'P1', pieces: new Set([0, 2]), x: 150, y: 150 },
      { id: 'P2', pieces: new Set([1, 3, 5]), x: 550, y: 150 },
      { id: 'P3', pieces: new Set([2, 4]), x: 150, y: 280 },
      { id: 'P4', pieces: new Set([0, 1, 5]), x: 550, y: 280 },
    ];
    step = 0;
    draw();
  }

  function addPeer() {
    if (peers.length >= 8) return;
    const id = 'P' + peers.length;
    peers.push({ id, pieces: new Set(), x: 100 + (peers.length - 1) * 100 + Math.random() * 30, y: 320 + Math.random() * 20 });
    draw();
  }

  function stepFn() {
    step++;
    // Each peer downloads a piece from another peer
    peers.forEach(p => {
      if (p.pieces.size === NUM_PIECES) return;
      // Find a missing piece, find someone who has it (rarest first heuristic)
      const missing = [];
      for (let i = 0; i < NUM_PIECES; i++) if (!p.pieces.has(i)) missing.push(i);
      if (missing.length === 0) return;
      // Find rarest missing
      let rare = missing[0], rareCount = Infinity;
      missing.forEach(m => {
        const cnt = peers.filter(o => o !== p && o.pieces.has(m)).length;
        if (cnt > 0 && cnt < rareCount) { rareCount = cnt; rare = m; }
      });
      const seeders = peers.filter(o => o !== p && o.pieces.has(rare));
      if (seeders.length === 0) return;
      // Download from random seeder
      const from = seeders[Math.floor(Math.random() * seeders.length)];
      p.pieces.add(rare);
      p.lastFrom = from.id;
      p.lastPiece = rare;
    });
    draw();
  }

  function draw() {
    const svg = document.getElementById('bt-svg');
    clearSvg(svg);
    arrowDef(svg, 'bt-arr', 'var(--info)');
    // Draw peers
    peers.forEach(p => {
      const isSeed = p.id === 'seed';
      const isDone = p.pieces.size === NUM_PIECES;
      const fill = isSeed ? 'var(--success)' : isDone ? 'var(--info-bg)' : 'var(--node-fill)';
      svgEl('rect', { x: p.x - 50, y: p.y - 30, width: 100, height: 60, fill, stroke: isSeed ? 'var(--success)' : 'var(--info)', 'stroke-width': 2, rx: 6 }, svg);
      svgEl('text', { x: p.x, y: p.y - 16, 'text-anchor': 'middle', 'font-weight': 600, 'font-size': 13, fill: isSeed ? 'white' : 'var(--text)', text: p.id }, svg);
      // Pieces bar
      for (let i = 0; i < NUM_PIECES; i++) {
        const has = p.pieces.has(i);
        svgEl('rect', { x: p.x - 36 + i * 12, y: p.y - 4, width: 10, height: 14, fill: has ? 'var(--info)' : 'var(--border)', stroke: 'var(--text-3)', 'stroke-width': 0.5 }, svg);
      }
      svgEl('text', { x: p.x, y: p.y + 24, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-3)', text: `${p.pieces.size}/${NUM_PIECES} dílů` }, svg);
    });
    // Last transfers
    peers.forEach(p => {
      if (p.lastFrom) {
        const from = peers.find(o => o.id === p.lastFrom);
        if (from) {
          svgEl('line', { x1: from.x, y1: from.y, x2: p.x, y2: p.y, stroke: 'var(--secondary)', 'stroke-width': 1.5, 'stroke-dasharray': '4 2', 'marker-end': 'url(#bt-arr)' }, svg);
        }
      }
    });
    document.getElementById('bt-info').innerHTML = `Krok ${step}. ${peers.filter(p => p.pieces.size === NUM_PIECES).length}/${peers.length} peerů má kompletní soubor. <span style="color:var(--text-3)">Heuristika „rarest first" — peer si stahuje nejvzácnější chybějící díl.</span>`;
  }

  document.getElementById('bt-join').addEventListener('click', addPeer);
  document.getElementById('bt-step').addEventListener('click', stepFn);
  document.getElementById('bt-reset').addEventListener('click', reset);
  reset();
}

// ------- Chord ring routing -------
function initChord() {
  const M = 6; // 6-bit IDs (64 slots)
  const SIZE = 1 << M;
  // Active nodes (subset of slots)
  const NODES = [4, 8, 16, 21, 32, 38, 48, 54, 60];

  function successor(k) {
    for (const n of NODES) if (n >= k) return n;
    return NODES[0]; // wrap-around
  }

  function fingerTable(node) {
    const fingers = [];
    for (let i = 0; i < M; i++) {
      fingers.push(successor((node + (1 << i)) % SIZE));
    }
    return fingers;
  }

  function find() {
    const src = parseInt(document.getElementById('chord-src').value, 10);
    const key = parseInt(document.getElementById('chord-key').value, 10);
    const path = [src];
    let curr = src;
    let steps = 0;
    while (steps < M) {
      if (key === curr || (NODES.includes(curr) && successor(((curr + 1) % SIZE)) === curr && key < successor((curr + 1) % SIZE))) break;
      const fingers = fingerTable(curr);
      // Pick largest finger ≤ key (modular)
      let next = curr;
      for (let i = M - 1; i >= 0; i--) {
        // Check if finger[i] is between curr and key on the ring
        const f = fingers[i];
        const distToF = (f - curr + SIZE) % SIZE;
        const distToKey = (key - curr + SIZE) % SIZE;
        if (distToF > 0 && distToF < distToKey) { next = f; break; }
      }
      if (next === curr) {
        // Use finger 0 (immediate successor)
        next = fingers[0];
      }
      path.push(next);
      curr = next;
      if (curr === successor(key)) break;
      steps++;
    }
    draw(path, key);
  }

  function draw(path = [], key = null) {
    const svg = document.getElementById('chord-svg');
    clearSvg(svg);
    const cx = 350, cy = 190, r = 130;
    // Draw circle
    svgEl('circle', { cx, cy, r, fill: 'none', stroke: 'var(--border)', 'stroke-width': 2 }, svg);

    // Draw all slot labels (sparsely)
    for (let i = 0; i < SIZE; i += 4) {
      const a = (i / SIZE) * 2 * Math.PI - Math.PI / 2;
      const lx = cx + Math.cos(a) * (r + 15);
      const ly = cy + Math.sin(a) * (r + 15);
      svgEl('text', { x: lx, y: ly + 3, 'text-anchor': 'middle', 'font-size': 9, fill: 'var(--text-3)', text: i }, svg);
    }

    // Draw nodes
    NODES.forEach(n => {
      const a = (n / SIZE) * 2 * Math.PI - Math.PI / 2;
      const nx = cx + Math.cos(a) * r;
      const ny = cy + Math.sin(a) * r;
      const onPath = path.includes(n);
      svgEl('circle', { cx: nx, cy: ny, r: 12, fill: onPath ? 'var(--info)' : 'var(--node-fill)', stroke: 'var(--info)', 'stroke-width': 2 }, svg);
      svgEl('text', { x: nx, y: ny + 4, 'text-anchor': 'middle', 'font-size': 10, fill: onPath ? 'white' : 'var(--text)', text: n }, svg);
    });

    // Highlight key location
    if (key != null) {
      const a = (key / SIZE) * 2 * Math.PI - Math.PI / 2;
      const kx = cx + Math.cos(a) * r;
      const ky = cy + Math.sin(a) * r;
      svgEl('circle', { cx: kx, cy: ky, r: 8, fill: 'var(--danger)', opacity: 0.8 }, svg);
      svgEl('text', { x: kx, y: ky - 14, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--danger)', 'font-weight': 600, text: `klíč ${key}` }, svg);
    }

    // Draw path arrows
    arrowDef(svg, 'chord-arr', 'var(--secondary)');
    for (let i = 0; i < path.length - 1; i++) {
      const a1 = (path[i] / SIZE) * 2 * Math.PI - Math.PI / 2;
      const a2 = (path[i + 1] / SIZE) * 2 * Math.PI - Math.PI / 2;
      const x1 = cx + Math.cos(a1) * (r - 12);
      const y1 = cy + Math.sin(a1) * (r - 12);
      const x2 = cx + Math.cos(a2) * (r - 12);
      const y2 = cy + Math.sin(a2) * (r - 12);
      // bezier through center
      const mx = (x1 + x2) / 2 + (cx - (x1 + x2) / 2) * 0.5;
      const my = (y1 + y2) / 2 + (cy - (y1 + y2) / 2) * 0.5;
      svgEl('path', { d: `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`, fill: 'none', stroke: 'var(--secondary)', 'stroke-width': 2.5, 'marker-end': 'url(#chord-arr)' }, svg);
    }

    svgEl('text', { x: cx, y: cy - 4, 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 14, text: `Chord ring 2^${M} = ${SIZE}` }, svg);
    svgEl('text', { x: cx, y: cy + 12, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-3)', text: `${NODES.length} aktivních uzlů` }, svg);

    // Step log
    const ol = document.getElementById('chord-steps');
    ol.innerHTML = path.length > 0
      ? path.map((p, i) => `<li class="${i === path.length - 1 ? 'active' : 'done'}">Krok ${i}: ${i === 0 ? 'start uzel' : 'finger →'} <strong>${p}</strong></li>`).join('') +
      (key != null ? `<li>klíč ${key} se uloží na successor(${key}) = <strong>${successor(key)}</strong></li>` : '')
      : '<li>Klikněte „Najdi" pro start.</li>';
  }
  ['chord-src', 'chord-key'].forEach(id =>
    document.getElementById(id).addEventListener('input', find));
  find();
}

// ------- LMS step-by-step -------
function initLMS() {
  // Generate small P2P network with "metric" = distance in some scalar space
  let nodes = [];
  let edges = new Set();
  let target = 0;
  let walker = null;
  let path = [];
  let phase = 'walk'; // walk or finish

  function init() {
    nodes = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * 2 * Math.PI;
      nodes.push({ id: i, x: 350 + Math.cos(angle) * 130, y: 180 + Math.sin(angle) * 130, metric: Math.floor(Math.random() * 100) });
    }
    target = nodes.reduce((a, b) => a.metric < b.metric ? a : b).id;
    nodes[target].isTarget = true;
    edges = new Set();
    nodes.forEach((n, i) => {
      const k = 3;
      for (let j = 0; j < k; j++) {
        const tgt = Math.floor(Math.random() * nodes.length);
        if (tgt !== i) {
          const key = i < tgt ? `${i}-${tgt}` : `${tgt}-${i}`;
          edges.add(key);
        }
      }
    });
    walker = 6;
    path = [6];
    phase = 'walk';
    draw();
  }

  function getNeighbors(id) {
    const ns = [];
    edges.forEach(e => {
      const [a, b] = e.split('-').map(Number);
      if (a === id) ns.push(b);
      else if (b === id) ns.push(a);
    });
    return ns;
  }

  function step() {
    if (path.length >= 8 && phase === 'walk') {
      phase = 'finish';
    }
    if (phase === 'walk') {
      const ns = getNeighbors(walker);
      const next = ns[Math.floor(Math.random() * ns.length)];
      walker = next;
      path.push(next);
    } else {
      // Deterministic descent: choose neighbor with lowest metric
      const ns = getNeighbors(walker);
      const best = ns.reduce((a, b) => nodes[a].metric < nodes[b].metric ? a : b);
      if (nodes[best].metric < nodes[walker].metric) {
        walker = best;
        path.push(best);
      } else {
        // Local minimum reached
        return;
      }
    }
    draw();
  }

  function draw() {
    const svg = document.getElementById('lms-svg');
    clearSvg(svg);
    edges.forEach(e => {
      const [a, b] = e.split('-').map(Number);
      svgEl('line', { x1: nodes[a].x, y1: nodes[a].y, x2: nodes[b].x, y2: nodes[b].y, stroke: 'var(--border-2)' }, svg);
    });
    arrowDef(svg, 'lms-arr', 'var(--secondary)');
    for (let i = 0; i < path.length - 1; i++) {
      svgEl('line', { x1: nodes[path[i]].x, y1: nodes[path[i]].y, x2: nodes[path[i + 1]].x, y2: nodes[path[i + 1]].y, stroke: 'var(--secondary)', 'stroke-width': 2.5, 'marker-end': 'url(#lms-arr)' }, svg);
    }
    nodes.forEach(n => {
      const isWalker = n.id === walker;
      const isTarget = n.isTarget;
      const onPath = path.includes(n.id);
      const fill = isWalker ? 'var(--info)' : isTarget ? 'var(--success)' : onPath ? 'var(--info-bg)' : 'var(--node-fill)';
      svgEl('circle', { cx: n.x, cy: n.y, r: 18, fill, stroke: 'var(--text-2)', 'stroke-width': 2 }, svg);
      svgEl('text', { x: n.x, y: n.y - 2, 'text-anchor': 'middle', 'font-size': 11, fill: (isWalker || isTarget) ? 'white' : 'var(--text)', text: n.id }, svg);
      svgEl('text', { x: n.x, y: n.y + 11, 'text-anchor': 'middle', 'font-size': 9, fill: (isWalker || isTarget) ? 'var(--node-fill)' : 'var(--text-3)', text: `d=${n.metric}` }, svg);
    });
    document.getElementById('lms-info').innerHTML =
      `<strong>Fáze: ${phase === 'walk' ? 'NÁHODNÝ PRŮCHOD' : 'DETERMINISTICKÝ FINIŠ'}</strong>. ` +
      `Walker je v uzlu <strong>${walker}</strong> (d=${nodes[walker].metric}). Cíl (lokální minimum): uzel <strong>${target}</strong> (d=${nodes[target].metric}). ` +
      `Cesta: ${path.join(' → ')}.<br>` +
      `<span style="font-size:12px;color:var(--text-3)">Po náhodném průchodu (walk-length) LMS přejde do deterministického snižování metriky — uzel je lokální minimum, když má menší d než všichni sousedi.</span>`;
  }
  document.getElementById('lms-step').addEventListener('click', step);
  document.getElementById('lms-reset').addEventListener('click', init);
  init();
}

// ------- Bencoding decoder -------
function initBencoding() {
  function decode(s, pos = 0) {
    if (pos >= s.length) return [null, pos];
    const c = s[pos];
    if (c === 'i') {
      const end = s.indexOf('e', pos);
      return [parseInt(s.substring(pos + 1, end), 10), end + 1];
    }
    if (c === 'l') {
      pos++;
      const list = [];
      while (s[pos] !== 'e') {
        const [item, np] = decode(s, pos);
        list.push(item);
        pos = np;
      }
      return [list, pos + 1];
    }
    if (c === 'd') {
      pos++;
      const dict = {};
      while (s[pos] !== 'e') {
        const [key, np1] = decode(s, pos);
        const [val, np2] = decode(s, np1);
        dict[key] = val;
        pos = np2;
      }
      return [dict, pos + 1];
    }
    if (/[0-9]/.test(c)) {
      const colon = s.indexOf(':', pos);
      const len = parseInt(s.substring(pos, colon), 10);
      const str = s.substring(colon + 1, colon + 1 + len);
      return [str, colon + 1 + len];
    }
    return [null, s.length];
  }

  function go() {
    const s = document.getElementById('bencode-input').value.trim();
    try {
      const [obj] = decode(s);
      document.getElementById('bencode-out').textContent = JSON.stringify(obj, null, 2);
    } catch (e) {
      document.getElementById('bencode-out').textContent = 'Chyba: ' + e.message;
    }
  }
  document.getElementById('bencode-input').addEventListener('input', go);
  go();
}

// ------- Sybil attack -------
function initSybil() {
  function go() {
    const sybilCount = parseInt(document.getElementById('sybil-count').value, 10);
    const lru = document.getElementById('sybil-lru').checked;
    const k = 8; // bucket size
    const NODES = 200;
    const HONEST = NODES;
    const totalNodes = HONEST + sybilCount;

    // Without LRU: Sybils randomly fill buckets → P(Sybil in bucket) = sybil / total
    // With LRU: only if old node evicted → assume churn rate 0.1, so P(slot opens) is low
    let bucketFillSybil;
    if (lru) {
      const churn = 0.1; // 10% honest nodes leave
      const slotsOpening = k * churn; // out of k slots
      const sybilPick = sybilCount / totalNodes;
      bucketFillSybil = slotsOpening * sybilPick;
    } else {
      bucketFillSybil = k * sybilCount / totalNodes;
    }

    const svg = document.getElementById('sybil-svg');
    clearSvg(svg);
    const W = 700, H = 240;
    // Draw bucket
    svgEl('text', { x: 30, y: 30, 'font-weight': 600, 'font-size': 14, text: 'Oběťin k-bucket (k=8)' }, svg);
    for (let i = 0; i < k; i++) {
      const sybilProb = bucketFillSybil / k;
      const isSybil = i / k < sybilProb;
      svgEl('rect', { x: 30 + i * 80, y: 50, width: 70, height: 60, fill: isSybil ? 'var(--danger)' : 'var(--success)', opacity: 0.7 }, svg);
      svgEl('text', { x: 65 + i * 80, y: 85, 'text-anchor': 'middle', fill: 'white', 'font-size': 13, 'font-weight': 600, text: isSybil ? 'SYBIL' : 'OK' }, svg);
    }
    svgEl('text', { x: 30, y: 140, 'font-weight': 600, fill: 'var(--secondary)', text: `${sybilCount} Sybil uzlů, ${HONEST} poctivých` }, svg);
    svgEl('text', { x: 30, y: 160, 'font-size': 12, fill: 'var(--text-2)', text: `LRU obrana: ${lru ? 'AKTIVNÍ — preferují se starší kontakty' : 'VYPNUTA'}` }, svg);
    const ratio = (bucketFillSybil / k) * 100;
    svgEl('text', { x: 30, y: 180, 'font-size': 13, 'font-weight': 600, fill: ratio > 50 ? 'var(--danger)' : ratio > 25 ? 'var(--warning)' : 'var(--success)', text: `Odhad obsazení Sybilem: ${ratio.toFixed(1)} %` }, svg);

    document.getElementById('sybil-info').innerHTML =
      lru
        ? `<strong>S LRU obranou:</strong> Sybil node musí počkat na odchod existujícího uzlu (churn). Při churn rate 10 %/period to znamená, že Sybil získá slot s P ≈ ${(bucketFillSybil / k * 100).toFixed(2)} % per bucket — i ${sybilCount} Sybilu zabere mnoho period.`
        : `<strong>Bez obrany:</strong> Sybil zabere buckety přímo poměrně k jejich počtu — ${(bucketFillSybil / k * 100).toFixed(1)} % slotů. Při ${sybilCount} Sybilu nad ${HONEST} uzly už podstatná kontrola routingu.`;
  }
  ['sybil-count', 'sybil-lru'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', go);
    el.addEventListener('change', go);
  });
  go();
}
