// Topic 3: Architektura přepínačů
// Demos: bus/memory/crossbar calculator, HoL+VOQ, Take-a-Ticket/PIM/iSLIP, Clos builder, Beneš builder.

import { svgEl, clearSvg, arrowDef, esc, pick } from '../util.js';

export function initT3() {
  initSwitchCalc();
  initHoLDemo();
  initMatchingDemo();
  initClosBuilder();
  initBenesBuilder();
  initESLIP();
  initPriority();
}

// ------- Switch architecture calculator -------
function initSwitchCalc() {
  const calc = () => {
    const N = parseInt(document.getElementById('sw-n').value, 10);
    const R = parseFloat(document.getElementById('sw-r').value) * 1e9; // Gb → b/s
    const clk = parseFloat(document.getElementById('sw-clk').value) * 1e6; // MHz → Hz
    const C = parseInt(document.getElementById('sw-cell').value, 10) * 8; // B → bits

    const throughput = N * R;
    const busWidth = throughput / clk;
    const memBW = 2 * N * R;
    const cellTime = C / memBW * 1e9; // ns
    const crossX = N * N;

    let bus = `OK (${busWidth.toFixed(0)} b)`;
    if (busWidth > 256) bus = `<span class="warn">${busWidth.toFixed(0)} b — fyzicky problematické</span>`;
    let mem = `${cellTime.toFixed(2)} ns/cell`;
    if (cellTime < 1) mem = `<span class="warn">${cellTime.toFixed(2)} ns — pod rychlostí DRAM (~5 ns)</span>`;
    let cross = `${crossX.toLocaleString()} crosspointů`;
    if (crossX > 10000) cross = `<span class="warn">${crossX.toLocaleString()} — neúnosné</span>`;

    document.getElementById('sw-out').innerHTML =
      `<strong>Propustnost</strong>: N·R = ${(throughput / 1e9).toFixed(1)} Gb/s<br>` +
      `<strong>Sdílená sběrnice</strong>: w = N·R/r = ${bus}<br>` +
      `<strong>Sdílená paměť</strong>: BW = 2NR = ${(memBW / 1e9).toFixed(1)} Gb/s, čas na buňku = ${mem}<br>` +
      `<strong>Crossbar</strong>: N² = ${cross}<br>` +
      `<span style="color:var(--text-3);font-size:12px">Doporučení: bus pro malé, paměť do 10 Gb/s, crossbar do ~128 portů, jinak multistage Clos.</span>`;
  };
  ['sw-n', 'sw-r', 'sw-clk', 'sw-cell'].forEach(id =>
    document.getElementById(id).addEventListener('input', calc));
  calc();
}

// ------- HoL blocking demo -------
function initHoLDemo() {
  let state = null;
  function reset() {
    state = {
      voq: document.getElementById('hol-voq').checked,
      step: 0,
      inputs: [
        [{ to: 1, id: 'a' }, { to: 2, id: 'b' }, { to: 1, id: 'c' }],
        [{ to: 1, id: 'd' }, { to: 0, id: 'e' }],
        [{ to: 2, id: 'f' }, { to: 1, id: 'g' }, { to: 3, id: 'h' }],
        [{ to: 0, id: 'i' }],
      ],
      delivered: 0,
      blocked: 0,
    };
    draw();
  }
  function step() {
    if (!state) reset();
    state.step++;
    // Each output can accept one packet per cycle
    const outputs = new Set();
    if (state.voq) {
      // VOQ: scan all inputs, choose any head from VOQ for free output
      for (let i = 0; i < state.inputs.length; i++) {
        for (let k = 0; k < state.inputs[i].length; k++) {
          const pkt = state.inputs[i][k];
          if (!outputs.has(pkt.to)) {
            outputs.add(pkt.to);
            state.inputs[i].splice(k, 1);
            state.delivered++;
            break;
          }
        }
      }
    } else {
      // FIFO: only head of input queue is candidate
      for (let i = 0; i < state.inputs.length; i++) {
        const q = state.inputs[i];
        if (q.length === 0) continue;
        const head = q[0];
        if (!outputs.has(head.to)) {
          outputs.add(head.to);
          q.shift();
          state.delivered++;
        } else {
          state.blocked++;
        }
      }
    }
    draw();
  }
  function draw() {
    const svg = document.getElementById('hol-svg');
    clearSvg(svg);
    const N = state.inputs.length;
    // Inputs (left)
    state.inputs.forEach((q, i) => {
      const y = 40 + i * 50;
      svgEl('text', { x: 30, y: y + 4, 'font-size': 13, 'font-weight': 600, text: `in${i}` }, svg);
      if (state.voq) {
        // Separate VOQ per output
        for (let o = 0; o < 4; o++) {
          svgEl('rect', { x: 60 + o * 90, y: y - 14, width: 80, height: 28, fill: 'var(--node-fill)', stroke: 'var(--border-2)' }, svg);
          svgEl('text', { x: 100 + o * 90, y: y + 4, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-3)', text: `→out${o}` }, svg);
        }
        q.forEach((pkt, k) => {
          const x = 60 + pkt.to * 90 + 4 + k * 14;
          svgEl('circle', { cx: x, cy: y, r: 7, fill: 'var(--info)' }, svg);
          svgEl('text', { x, y: y + 3, 'text-anchor': 'middle', 'font-size': 9, fill: 'white', text: pkt.id }, svg);
        });
      } else {
        // Single FIFO
        svgEl('rect', { x: 60, y: y - 14, width: 360, height: 28, fill: 'var(--node-fill)', stroke: 'var(--border-2)' }, svg);
        q.slice(0, 8).forEach((pkt, k) => {
          const x = 75 + k * 40;
          svgEl('circle', { cx: x, cy: y, r: 11, fill: 'var(--info)' }, svg);
          svgEl('text', { x, y: y + 3, 'text-anchor': 'middle', 'font-size': 11, fill: 'white', text: pkt.id }, svg);
          svgEl('text', { x, y: y + 28, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-3)', text: `→${pkt.to}` }, svg);
        });
      }
    });
    // Outputs (right)
    for (let o = 0; o < 4; o++) {
      const y = 40 + o * 50;
      svgEl('rect', { x: 550, y: y - 14, width: 110, height: 28, fill: 'var(--success-bg)', stroke: 'var(--success)' }, svg);
      svgEl('text', { x: 605, y: y + 4, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--success)', text: `out${o}` }, svg);
    }
    document.getElementById('hol-info').innerHTML =
      `Krok ${state.step}: doručeno <strong>${state.delivered}</strong>, blokováno <strong>${state.blocked}</strong>. ` +
      (state.voq
        ? `<span style="color:var(--success)">S VOQ: každý vstup má frontu pro každý výstup, scheduler vidí všechny VOQ.</span>`
        : `<span style="color:var(--danger)">Bez VOQ: FIFO trpí HoL — paket vepředu blokuje další. Teoretický limit propustnosti ~58,6 %.</span>`);
  }
  document.getElementById('hol-voq').addEventListener('change', reset);
  document.getElementById('hol-step').addEventListener('click', step);
  document.getElementById('hol-reset').addEventListener('click', reset);
  reset();
}

// ------- Matching algorithms: Take-a-Ticket, PIM, iSLIP -------
// Three-phase visualization: REQUEST → GRANT → ACCEPT. Each click on the step
// button advances by exactly one phase. After ACCEPT, the matching is committed
// (its VOQ cells cleared) and the next click starts REQUEST for a new iteration.
function initMatchingDemo() {
  let state = null;

  const PHASE_LABELS = {
    idle:    { ord: '⏸',  cz: 'Připraveno',   help: 'Klikni „Krok" pro Request' },
    request: { ord: '①', cz: 'REQUEST',       help: 'Vstupní porty posílají žádosti všem výstupům, kam chtějí' },
    grant:   { ord: '②', cz: 'GRANT',         help: 'Výstupy vyberou JEDNU žádost (algoritmus-specifické)' },
    accept:  { ord: '③', cz: 'ACCEPT',        help: 'Vstupy vyberou JEDEN grant — výsledné párování' },
  };

  function reset() {
    const N = parseInt(document.getElementById('match-n').value, 10);
    state = {
      N,
      algo: document.getElementById('match-algo').value,
      voq: Array.from({ length: N }, () => Array(N).fill(0)),
      acceptPtr: Array(N).fill(0),
      grantPtr: Array(N).fill(0),
      iter: 0,
      phase: 'idle',
      requests: [],     // {input, output}
      grants: [],       // {output, input}
      accepts: [],      // {input, output} — committed matching this iter
      lastMatch: [],
      log: [],
    };
    // Random initial VOQ contents
    for (let i = 0; i < N; i++) {
      const k = 1 + Math.floor(Math.random() * (N - 1));
      const chosen = [];
      while (chosen.length < k) {
        const j = Math.floor(Math.random() * N);
        if (!chosen.includes(j)) chosen.push(j);
      }
      chosen.forEach(j => state.voq[i][j] = 1);
    }
    draw();
  }

  function newRequests() {
    const N = state.N;
    state.voq = Array.from({ length: N }, () => Array(N).fill(0));
    for (let i = 0; i < N; i++) {
      const k = 1 + Math.floor(Math.random() * (N - 1));
      const chosen = [];
      while (chosen.length < k) {
        const j = Math.floor(Math.random() * N);
        if (!chosen.includes(j)) chosen.push(j);
      }
      chosen.forEach(j => state.voq[i][j] = 1);
    }
    state.log = [];
    state.iter = 0;
    state.phase = 'idle';
    state.requests = [];
    state.grants = [];
    state.accepts = [];
    state.lastMatch = [];
    draw();
  }

  function toggleCell(i, j) {
    state.voq[i][j] = state.voq[i][j] ? 0 : 1;
    state.lastMatch = [];
    state.log = [];
    state.iter = 0;
    state.phase = 'idle';
    state.requests = [];
    state.grants = [];
    state.accepts = [];
    draw();
  }

  function phaseRequest() {
    state.iter++;
    state.phase = 'request';
    state.requests = [];
    state.grants = [];
    state.accepts = [];
    state.lastMatch = [];
    const N = state.N;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (state.voq[i][j]) state.requests.push({ input: i, output: j });
      }
    }
    state.log.push(`Iter ${state.iter} · ① REQUEST — ${state.requests.length} žádostí celkem`);
  }

  function phaseGrant() {
    state.phase = 'grant';
    state.grants = [];
    const N = state.N;
    for (let j = 0; j < N; j++) {
      const reqs = state.requests.filter(r => r.output === j);
      if (reqs.length === 0) continue;
      let chosenInput = null;
      if (state.algo === 'ticket') {
        reqs.sort((a, b) => a.input - b.input);
        chosenInput = reqs[0].input;
      } else if (state.algo === 'pim') {
        chosenInput = reqs[Math.floor(Math.random() * reqs.length)].input;
      } else if (state.algo === 'islip') {
        for (let off = 0; off < N; off++) {
          const i = (state.grantPtr[j] + off) % N;
          if (reqs.some(r => r.input === i)) { chosenInput = i; break; }
        }
      }
      if (chosenInput != null) state.grants.push({ output: j, input: chosenInput });
    }
    const ruleDesc = state.algo === 'ticket' ? 'nejnižší index vstupu'
                   : state.algo === 'pim'    ? 'náhodný vstup'
                   :                            'round-robin od grantPtr';
    state.log.push(`② GRANT (${ruleDesc}) — ${state.grants.length} grantů uděleno`);
  }

  function phaseAccept() {
    state.phase = 'accept';
    state.accepts = [];
    const N = state.N;
    const used = new Set();
    for (let i = 0; i < N; i++) {
      const myGrants = state.grants.filter(g => g.input === i);
      if (myGrants.length === 0) continue;
      let chosenOutput = null;
      if (state.algo === 'ticket') {
        chosenOutput = myGrants[0].output;
      } else if (state.algo === 'pim') {
        chosenOutput = myGrants[Math.floor(Math.random() * myGrants.length)].output;
      } else if (state.algo === 'islip') {
        for (let off = 0; off < N; off++) {
          const j = (state.acceptPtr[i] + off) % N;
          if (myGrants.some(g => g.output === j)) { chosenOutput = j; break; }
        }
      }
      if (chosenOutput != null && !used.has(chosenOutput)) {
        state.accepts.push({ input: i, output: chosenOutput });
        used.add(chosenOutput);
        // iSLIP: update pointers only on first iteration
        if (state.algo === 'islip' && state.iter === 1) {
          state.acceptPtr[i] = (chosenOutput + 1) % N;
          state.grantPtr[chosenOutput] = (i + 1) % N;
        }
      }
    }
    // Commit: clear matched VOQ cells
    state.accepts.forEach(a => state.voq[a.input][a.output] = 0);
    state.lastMatch = state.accepts.map(a => [a.input, a.output]);
    const ruleDesc = state.algo === 'ticket' ? 'auto'
                   : state.algo === 'pim'    ? 'náhodný grant'
                   :                            'round-robin od acceptPtr';
    state.log.push(`③ ACCEPT (${ruleDesc}) — ${state.accepts.length} párů spojeno ✓`);
  }

  function step() {
    if (!state) reset();
    if (state.phase === 'idle' || state.phase === 'accept') phaseRequest();
    else if (state.phase === 'request') phaseGrant();
    else if (state.phase === 'grant')   phaseAccept();
    draw();
  }

  function draw() {
    const svg = document.getElementById('match-svg');
    if (!svg) return;
    clearSvg(svg);
    const N = state.N;
    const cellSize = Math.min(36, 220 / N);
    const W = 720, H = 380;

    // ---- Phase banner (top) ----
    const ph = PHASE_LABELS[state.phase];
    const phColor = state.phase === 'accept' ? 'var(--success)'
                  : state.phase === 'grant'  ? 'var(--accent)'
                  : state.phase === 'request' ? 'var(--warning)'
                  : 'var(--text-2)';
    svgEl('rect', { x: 0, y: 0, width: W, height: 38, fill: 'var(--bg-2)' }, svg);
    svgEl('text', {
      x: 18, y: 24, 'font-size': 14, 'font-weight': 700, fill: phColor,
      text: `${ph.ord}  ${ph.cz}`,
    }, svg);
    svgEl('text', {
      x: 200, y: 24, 'font-size': 12, fill: 'var(--text-2)', text: ph.help,
    }, svg);
    svgEl('text', {
      x: W - 18, y: 24, 'text-anchor': 'end',
      'font-size': 12, fill: 'var(--text-2)',
      text: `iter #${state.iter}  ·  ${state.algo === 'ticket' ? 'Take-a-Ticket'
                                   : state.algo === 'pim'   ? 'PIM (náhoda)'
                                   :                         'iSLIP (det.)'}`,
    }, svg);

    // ---- VOQ grid (left) ----
    const gridX = 80, gridY = 80;
    svgEl('text', { x: gridX + cellSize * N / 2, y: gridY - 12, 'text-anchor': 'middle', 'font-weight': 600, 'font-size': 12, fill: 'var(--node-stroke)', text: 'VOQ — klikni pro toggle' }, svg);
    svgEl('text', { x: gridX - 40, y: gridY + cellSize * N / 2, 'font-weight': 600, 'font-size': 11, fill: 'var(--text-2)', transform: `rotate(-90 ${gridX - 40} ${gridY + cellSize * N / 2})`, text: 'vstupy →' }, svg);
    for (let i = 0; i < N; i++) {
      svgEl('text', { x: gridX - 8, y: gridY + i * cellSize + cellSize / 2 + 4, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--text-2)', text: `in${i}` }, svg);
      svgEl('text', { x: gridX + i * cellSize + cellSize / 2, y: gridY - 2, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-2)', text: `o${i}` }, svg);
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const wasMatched = state.lastMatch.some(([a, b]) => a === i && b === j) && state.phase === 'accept';
        const hasPkt = state.voq[i][j];
        const fill = wasMatched ? 'var(--success)' : hasPkt ? 'var(--accent-bg)' : 'var(--node-fill)';
        const rect = svgEl('rect', { class: 'islip-cell', x: gridX + j * cellSize, y: gridY + i * cellSize, width: cellSize, height: cellSize, fill, stroke: 'var(--border-2)', 'stroke-width': 1 }, svg);
        rect.addEventListener('click', () => toggleCell(i, j));
        if (hasPkt || wasMatched) {
          svgEl('text', { x: gridX + j * cellSize + cellSize / 2, y: gridY + i * cellSize + cellSize / 2 + 4, 'text-anchor': 'middle', 'font-size': 11, fill: wasMatched ? 'var(--node-fill)' : 'var(--accent)', 'pointer-events': 'none', text: wasMatched ? '✓' : '•' }, svg);
        }
      }
    }

    // ---- Bipartite view (right) ----
    const bipX = gridX + cellSize * N + 100;
    const bipR = 13, gap = 160;
    const nodeY = (i) => gridY + 12 + i * cellSize;
    svgEl('text', { x: bipX + gap / 2, y: gridY - 12, 'text-anchor': 'middle', 'font-weight': 600, 'font-size': 12, fill: 'var(--node-stroke)', text: 'Bipartitní matching' }, svg);

    // Phase ordering for line layering
    const phaseIdx = { idle: 0, request: 1, grant: 2, accept: 3 }[state.phase];

    // Request lines (faint, dashed) — show when phase >= request
    if (phaseIdx >= 1) {
      state.requests.forEach(r => {
        svgEl('line', {
          x1: bipX + bipR, y1: nodeY(r.input),
          x2: bipX + gap - bipR, y2: nodeY(r.output),
          stroke: 'var(--text-3)', 'stroke-width': 1, 'stroke-dasharray': '3 3',
          opacity: 0.6,
        }, svg);
      });
    }
    // Grant lines (medium accent) — when phase >= grant
    if (phaseIdx >= 2) {
      state.grants.forEach(g => {
        svgEl('line', {
          x1: bipX + bipR, y1: nodeY(g.input),
          x2: bipX + gap - bipR, y2: nodeY(g.output),
          stroke: 'var(--accent)', 'stroke-width': 2,
        }, svg);
      });
    }
    // Accept lines (bold green) — when phase == accept
    if (phaseIdx === 3) {
      state.accepts.forEach(a => {
        svgEl('line', {
          x1: bipX + bipR, y1: nodeY(a.input),
          x2: bipX + gap - bipR, y2: nodeY(a.output),
          stroke: 'var(--success)', 'stroke-width': 4,
        }, svg);
      });
    }

    // Nodes (on top of lines)
    for (let i = 0; i < N; i++) {
      svgEl('circle', { cx: bipX, cy: nodeY(i), r: bipR, fill: 'var(--node-fill)', stroke: 'var(--node-stroke)', 'stroke-width': 2 }, svg);
      svgEl('text', { x: bipX, y: nodeY(i) + 4, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--node-stroke)', text: `i${i}` }, svg);
      svgEl('circle', { cx: bipX + gap, cy: nodeY(i), r: bipR, fill: 'var(--node-fill)', stroke: 'var(--node-stroke)', 'stroke-width': 2 }, svg);
      svgEl('text', { x: bipX + gap, y: nodeY(i) + 4, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--node-stroke)', text: `o${i}` }, svg);
    }

    // Pointers (iSLIP only)
    if (state.algo === 'islip') {
      for (let i = 0; i < N; i++) {
        svgEl('text', { x: bipX - 30, y: nodeY(i) + 4, 'font-size': 9, fill: 'var(--secondary)', 'text-anchor': 'end', text: `aP=${state.acceptPtr[i]}` }, svg);
        svgEl('text', { x: bipX + gap + 30, y: nodeY(i) + 4, 'font-size': 9, fill: 'var(--info-strong)', text: `gP=${state.grantPtr[i]}` }, svg);
      }
    }

    // ---- Legend (bottom) ----
    const legY = H - 18;
    let lx = 18;
    function legendEntry(label, color, weight, dash) {
      svgEl('line', { x1: lx, y1: legY - 4, x2: lx + 26, y2: legY - 4, stroke: color, 'stroke-width': weight, 'stroke-dasharray': dash || '' }, svg);
      svgEl('text', { x: lx + 32, y: legY, 'font-size': 11, fill: 'var(--node-stroke)', text: label }, svg);
      lx += 110;
    }
    legendEntry('① Request', 'var(--text-3)', 1, '3 3');
    legendEntry('② Grant',   'var(--accent)', 2);
    legendEntry('③ Accept',  'var(--success)', 4);
    svgEl('text', { x: W - 18, y: legY, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--text-2)', text: 'oranžová buňka = paket ve VOQ' }, svg);

    // ---- Update step button label ----
    const btn = document.getElementById('match-step');
    if (btn) {
      const nextPhase = state.phase === 'idle' ? 'Request'
                      : state.phase === 'request' ? 'Grant'
                      : state.phase === 'grant'   ? 'Accept'
                      :                              'Nová iter.';
      btn.textContent = `▸ ${nextPhase}`;
    }

    // ---- Step log ----
    const ol = document.getElementById('match-steps');
    if (ol) {
      ol.innerHTML = state.log.slice(-8).map((l, i, arr) =>
        `<li class="${i === arr.length - 1 ? 'active' : 'done'}">${esc(l)}</li>`
      ).join('');
    }
  }

  document.getElementById('match-algo').addEventListener('change', reset);
  document.getElementById('match-n').addEventListener('change', reset);
  document.getElementById('match-step').addEventListener('click', step);
  document.getElementById('match-newreq').addEventListener('click', newRequests);
  document.getElementById('match-reset').addEventListener('click', reset);
  reset();
}

// ------- Clos network builder -------
function initClosBuilder() {
  function draw() {
    const m = parseInt(document.getElementById('clos-m').value, 10);
    const n = parseInt(document.getElementById('clos-n').value, 10);
    const r = parseInt(document.getElementById('clos-r').value, 10);
    const svg = document.getElementById('clos-svg');
    clearSvg(svg);

    const W = 700, H = 360;
    const blockH = 32, blockW = 70;

    // Input blocks (left): r blocks, each n×m
    const leftX = 80;
    const inputs = [];
    for (let i = 0; i < r; i++) {
      const y = (H / (r + 1)) * (i + 1) - blockH / 2;
      svgEl('rect', { x: leftX, y, width: blockW, height: blockH, fill: 'var(--info-bg)', stroke: 'var(--info)', 'stroke-width': 2, rx: 4 }, svg);
      svgEl('text', { x: leftX + blockW / 2, y: y + blockH / 2 + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, text: `${n}×${m}` }, svg);
      svgEl('text', { x: leftX - 8, y: y + blockH / 2 + 4, 'text-anchor': 'end', 'font-size': 10, text: `in${i + 1}` }, svg);
      inputs.push({ x: leftX + blockW, y: y + blockH / 2 });
    }

    // Middle blocks: m blocks, each r×r
    const midX = (W - blockW) / 2;
    const middles = [];
    for (let i = 0; i < m; i++) {
      const y = (H / (m + 1)) * (i + 1) - blockH / 2;
      svgEl('rect', { x: midX, y, width: blockW, height: blockH, fill: 'var(--secondary-bg)', stroke: 'var(--secondary)', 'stroke-width': 2, rx: 4 }, svg);
      svgEl('text', { x: midX + blockW / 2, y: y + blockH / 2 + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, text: `${r}×${r}` }, svg);
      middles.push({ xL: midX, xR: midX + blockW, y: y + blockH / 2 });
    }

    // Output blocks: r blocks, each m×n
    const rightX = W - 80 - blockW;
    const outputs = [];
    for (let i = 0; i < r; i++) {
      const y = (H / (r + 1)) * (i + 1) - blockH / 2;
      svgEl('rect', { x: rightX, y, width: blockW, height: blockH, fill: 'var(--info-bg)', stroke: 'var(--info)', 'stroke-width': 2, rx: 4 }, svg);
      svgEl('text', { x: rightX + blockW / 2, y: y + blockH / 2 + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, text: `${m}×${n}` }, svg);
      svgEl('text', { x: rightX + blockW + 8, y: y + blockH / 2 + 4, 'font-size': 10, text: `out${i + 1}` }, svg);
      outputs.push({ x: rightX, y: y + blockH / 2 });
    }

    // Lines: each input → all middles
    inputs.forEach(p => middles.forEach(mb => {
      svgEl('line', { x1: p.x, y1: p.y, x2: mb.xL, y2: mb.y, stroke: 'var(--text-3)', 'stroke-width': 0.7 }, svg);
    }));
    middles.forEach(mb => outputs.forEach(p => {
      svgEl('line', { x1: mb.xR, y1: mb.y, x2: p.x, y2: p.y, stroke: 'var(--text-3)', 'stroke-width': 0.7 }, svg);
    }));

    // Status
    const strictlyOK = m >= 2 * n - 1;
    const rearrOK = m >= n;
    const cond = strictlyOK ? '<strong style="color:var(--success)">✓ Strictly nonblocking</strong> (m ≥ 2n−1)'
      : rearrOK ? '<strong style="color:var(--warning)">⚠ Rearrangeably nonblocking</strong> (m ≥ n, ale m &lt; 2n−1)'
        : '<strong class="warn">✗ Blokující</strong> (m &lt; n)';
    const totalPorts = n * r;
    const totalCross = r * (n * m) + m * (r * r) + r * (m * n);
    const naiveCross = totalPorts * totalPorts;
    document.getElementById('clos-info').innerHTML =
      `<strong>Clos(${m}, ${n}, ${r})</strong> — ${totalPorts} portů, ${totalCross} crosspointů vs. ${naiveCross} u plochého crossbaru<br>` +
      `Closova podmínka: ${cond}<br>` +
      `<span style="color:var(--text-3);font-size:12px">Pro 2n−1 = ${2 * n - 1}; máte m = ${m}.</span>`;
  }
  ['clos-m', 'clos-n', 'clos-r'].forEach(id =>
    document.getElementById(id).addEventListener('input', draw));
  draw();
}

// ------- Beneš network builder (proper recursive topology) -------
function initBenesBuilder() {
  /*
   * BN_n recursive definition:
   *   BN_1 = single 2x2 switch
   *   BN_n = input stage (N/2 switches) + 2 × BN_{n-1} (upper + lower) + output stage (N/2 switches)
   *
   * Connection pattern between input stage and recursive subnets:
   *   For each switch j in input stage:
   *     top output  → upper subnet stage 0 switch ⌊j/2⌋, port (j mod 2)
   *     bottom out  → lower subnet stage 0 switch ⌊j/2⌋, port (j mod 2)
   *   Symmetric pattern between recursive subnets and output stage.
   */

  function draw() {
    const n = parseInt(document.getElementById('benes-n').value, 10);
    const N = 1 << n;
    const svg = document.getElementById('benes-svg');
    clearSvg(svg);

    const stages = 2 * n - 1;
    const switchesPerStage = N / 2;
    const W = 800, H = 380;
    const padX = 80, padY = 50;
    const innerW = W - 2 * padX, innerH = H - padY - 30;
    const xStage = (s) => padX + (s + 0.5) * (innerW / stages);
    const ySw = (k) => padY + (k + 0.5) * (innerH / switchesPerStage);
    const yPort = (k, port) => ySw(k) + (port === 0 ? -7 : 7);

    const blockW = Math.min(46, innerW / stages * 0.55);
    const blockH = Math.min(28, innerH / switchesPerStage * 0.55);

    // ---- 1. Collect switches and sub-network boxes recursively ----
    const switches = []; // {stage, swIdx}
    const boxes = []; // {level, fromStage, toStage, topSwIdx, bottomSwIdx}

    function build(level, stage0, topSwIdx, bottomSwIdx) {
      if (level === 1) {
        switches.push({ stage: stage0, swIdx: topSwIdx, level: 1 });
        return;
      }
      const lastStage = stage0 + 2 * level - 2;
      const halfSwIdx = (topSwIdx + bottomSwIdx + 1) >> 1;
      // Input and output stages
      for (let i = topSwIdx; i <= bottomSwIdx; i++) {
        switches.push({ stage: stage0, swIdx: i, level });
        if (lastStage !== stage0) switches.push({ stage: lastStage, swIdx: i, level });
      }
      // Add box for this BN_level (skip the outermost — we know it's the whole network)
      if (level < n) {
        boxes.push({ level, fromStage: stage0, toStage: lastStage, topSwIdx, bottomSwIdx });
      }
      // Recurse upper and lower
      build(level - 1, stage0 + 1, topSwIdx, halfSwIdx - 1);
      build(level - 1, stage0 + 1, halfSwIdx, bottomSwIdx);
    }
    build(n, 0, 0, switchesPerStage - 1);

    // ---- 2. Collect connections recursively ----
    const conns = [];
    function connect(level, stage0, topSwIdx, bottomSwIdx) {
      if (level === 1) return;
      const lastStage = stage0 + 2 * level - 2;
      const halfSwIdx = (topSwIdx + bottomSwIdx + 1) >> 1;
      const halfSize = halfSwIdx - topSwIdx; // size of each sub-network in switches

      for (let i = topSwIdx; i <= bottomSwIdx; i++) {
        const rel = i - topSwIdx;
        const upperSw = topSwIdx + Math.floor(rel / 2);
        const lowerSw = halfSwIdx + Math.floor(rel / 2);
        const port = rel % 2;
        // input stage j → upper subnet first stage
        conns.push({ s1: stage0, k1: i, p1: 0, s2: stage0 + 1, k2: upperSw, p2: port });
        // input stage j → lower subnet first stage
        conns.push({ s1: stage0, k1: i, p1: 1, s2: stage0 + 1, k2: lowerSw, p2: port });
        // symmetric: subnet last stage → output stage
        conns.push({ s1: lastStage - 1, k1: upperSw, p1: port, s2: lastStage, k2: i, p2: 0 });
        conns.push({ s1: lastStage - 1, k1: lowerSw, p1: port, s2: lastStage, k2: i, p2: 1 });
      }
      connect(level - 1, stage0 + 1, topSwIdx, halfSwIdx - 1);
      connect(level - 1, stage0 + 1, halfSwIdx, bottomSwIdx);
    }
    connect(n, 0, 0, switchesPerStage - 1);

    // ---- 3. Draw recursive sub-network boxes (FIRST, so they're behind) ----
    const palette = ['var(--secondary)', 'var(--warning)', 'var(--success)', 'var(--info)', 'var(--danger)'];
    boxes.sort((a, b) => b.level - a.level); // outer first
    boxes.forEach(b => {
      const x1 = xStage(b.fromStage) - blockW / 2 - 8;
      const x2 = xStage(b.toStage) + blockW / 2 + 8;
      const y1 = ySw(b.topSwIdx) - blockH / 2 - 8;
      const y2 = ySw(b.bottomSwIdx) + blockH / 2 + 8;
      const color = palette[(b.level - 1) % palette.length];
      svgEl('rect', { x: x1, y: y1, width: x2 - x1, height: y2 - y1, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-dasharray': '5 3', rx: 8 }, svg);
      svgEl('text', { x: x1 + 6, y: y1 + 14, 'font-size': 11, 'font-weight': 700, fill: color, text: `BN${b.level}` }, svg);
    });

    // ---- 4. Draw external inputs and outputs ----
    for (let i = 0; i < N; i++) {
      const yi = padY + 20 + i * (innerH - 40) / (N - 1);
      // input dot
      svgEl('circle', { cx: 30, cy: yi, r: 7, fill: 'var(--success)', stroke: 'var(--success)', 'stroke-width': 1 }, svg);
      svgEl('text', { x: 14, y: yi + 4, 'font-size': 11, 'text-anchor': 'middle', 'font-family': 'monospace', 'font-weight': 600, text: i }, svg);
      // line to first-stage switch port
      const swIdx = Math.floor(i / 2);
      const port = i % 2;
      svgEl('line', { x1: 37, y1: yi, x2: xStage(0) - blockW / 2, y2: yPort(swIdx, port), stroke: 'var(--border-2)', 'stroke-width': 1 }, svg);

      // output dot
      svgEl('circle', { cx: W - 30, cy: yi, r: 7, fill: 'var(--secondary)', stroke: 'var(--secondary)', 'stroke-width': 1 }, svg);
      svgEl('text', { x: W - 14, y: yi + 4, 'font-size': 11, 'text-anchor': 'middle', 'font-family': 'monospace', 'font-weight': 600, text: i }, svg);
      // line from last-stage switch port to output dot
      svgEl('line', { x1: xStage(stages - 1) + blockW / 2, y1: yPort(swIdx, port), x2: W - 37, y2: yi, stroke: 'var(--border-2)', 'stroke-width': 1 }, svg);
    }

    // ---- 5. Draw inter-stage connections ----
    conns.forEach(c => {
      const x1 = xStage(c.s1) + blockW / 2;
      const y1 = yPort(c.k1, c.p1);
      const x2 = xStage(c.s2) - blockW / 2;
      const y2 = yPort(c.k2, c.p2);
      svgEl('line', { x1, y1, x2, y2, stroke: 'var(--text-3)', 'stroke-width': 0.9 }, svg);
    });

    // ---- 6. Draw switches on top ----
    switches.forEach(sw => {
      const x = xStage(sw.stage);
      const y = ySw(sw.swIdx);
      svgEl('rect', { x: x - blockW / 2, y: y - blockH / 2, width: blockW, height: blockH, fill: 'var(--node-fill)', stroke: 'var(--info)', 'stroke-width': 1.5, rx: 3 }, svg);
      svgEl('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: 'var(--info)', text: '2×2' }, svg);
    });

    // ---- 7. Stage labels ----
    for (let s = 0; s < stages; s++) {
      svgEl('text', { x: xStage(s), y: H - 12, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-3)', text: `s${s + 1}` }, svg);
    }
    // Title
    svgEl('text', { x: W / 2, y: 22, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, text: `Beneš BN${n} — ${N} portů, ${stages} stupňů` }, svg);

    document.getElementById('benes-info').innerHTML =
      `<strong>BN<sub>${n}</sub></strong>: ${N} portů, ${stages} stupňů (= 2·log₂${N} − 1), ` +
      `${switches.length} 2×2 přepínačů (${switchesPerStage * stages} teoreticky).<br>` +
      `<strong>Rekurzivní rozklad</strong> (barevné rámečky): BN<sub>${n}</sub> = vstup. vrstva + 2× BN<sub>${n - 1}</sub> + výstup. vrstva. Každý BN<sub>${n - 1}</sub> se dělí dál.<br>` +
      `Connection pattern: input switch <em>j</em> top out → upper BN<sub>${n - 1}</sub> switch ⌊j/2⌋ port <em>j</em> mod 2; bottom out → lower BN<sub>${n - 1}</sub>.<br>` +
      `Rearrangeably nonblocking, looping algoritmus O(N). Crossbar ${N * N} crosspointů vs. Beneš ${switches.length * 4} (${((1 - (switches.length * 4) / (N * N)) * 100).toFixed(0)} % úspora).`;
  }
  document.getElementById('benes-n').addEventListener('input', draw);
  draw();
}

// ------- ESLIP multicast -------
function initESLIP() {
  let state = null;
  function reset() {
    state = {
      N: 4,
      mode: document.getElementById('eslip-mode').value,
      targets: document.getElementById('eslip-targets').value.split(',').map(s => parseInt(s.trim(), 10)).filter(x => !isNaN(x) && x >= 0 && x < 4),
      remaining: null,
      step: 0,
      log: [],
    };
    state.remaining = new Set(state.targets);
    draw();
  }
  function step() {
    if (!state) reset();
    state.step++;
    if (state.mode === 'no') {
      // Wait until all outputs free, then send to all
      if (state.remaining.size > 0) {
        const free = Array.from(state.remaining);
        state.log.push(`Krok ${state.step}: no-fanout — rozeslat všem ${free.length} výstupům najednou`);
        state.remaining.clear();
      } else {
        state.log.push(`Krok ${state.step}: hotovo`);
      }
    } else {
      // Fanout splitting: subset of outputs each slot
      if (state.remaining.size > 0) {
        const free = Array.from(state.remaining);
        const subset = free.slice(0, Math.max(1, Math.floor(free.length * 0.6)));
        subset.forEach(o => state.remaining.delete(o));
        state.log.push(`Krok ${state.step}: fanout-split — výstupy ${subset.join(', ')} (zbývá ${state.remaining.size})`);
      } else {
        state.log.push(`Krok ${state.step}: hotovo`);
      }
    }
    draw();
  }
  function draw() {
    if (!state) reset();
    const svg = document.getElementById('eslip-svg');
    clearSvg(svg);
    const N = state.N;
    // Source on left
    svgEl('rect', { x: 30, y: 20, width: 100, height: 240, fill: 'var(--info-bg)', stroke: 'var(--info)', 'stroke-width': 2, rx: 6 }, svg);
    svgEl('text', { x: 80, y: 40, 'text-anchor': 'middle', 'font-weight': 600, text: 'in0 (multicast)' }, svg);
    svgEl('text', { x: 80, y: 60, 'text-anchor': 'middle', 'font-size': 11, text: `cíle: ${state.targets.join(', ')}` }, svg);

    // Outputs on right
    for (let i = 0; i < N; i++) {
      const y = 30 + i * 60;
      const isTarget = state.targets.includes(i);
      const isDelivered = isTarget && !state.remaining.has(i);
      svgEl('rect', { x: 540, y, width: 120, height: 50, fill: isDelivered ? 'var(--success)' : isTarget ? 'var(--warning-bg)' : 'var(--node-fill)', stroke: isTarget ? 'var(--warning)' : 'var(--text-3)', 'stroke-width': 1.5, rx: 4 }, svg);
      svgEl('text', { x: 600, y: y + 30, 'text-anchor': 'middle', 'font-weight': 600, fill: isDelivered ? 'white' : 'var(--text)', text: `out${i}` }, svg);
      // Show "delivered" or pending
      if (isTarget) {
        svgEl('text', { x: 600, y: y + 45, 'text-anchor': 'middle', 'font-size': 10, fill: isDelivered ? 'var(--success-bg)' : 'var(--warning)', text: isDelivered ? '✓ delivered' : 'pending' }, svg);
      }
      // Crosspoint lines for active outputs (this step)
      if (isTarget) {
        svgEl('line', { x1: 130, y1: 140, x2: 540, y2: y + 25, stroke: isDelivered ? 'var(--success)' : 'var(--border-2)', 'stroke-width': isDelivered ? 2 : 1, 'stroke-dasharray': isDelivered ? '' : '3 2' }, svg);
      }
    }
    document.getElementById('eslip-info').innerHTML = state.log.slice(-4).map(l => `<div>${esc(l)}</div>`).join('') +
      (state.remaining.size === 0 ? '<strong style="color:var(--success)">✓ Všechny multicast cíle obslouženy.</strong>' : '');
  }
  document.getElementById('eslip-step').addEventListener('click', step);
  document.getElementById('eslip-reset').addEventListener('click', reset);
  ['eslip-mode', 'eslip-targets'].forEach(id => document.getElementById(id).addEventListener('change', reset));
  reset();
}

// ------- Priority iSLIP -------
function initPriority() {
  let queues = { HI: [], LO: [] };
  let served = [];
  function add(pri) {
    const out = Math.floor(Math.random() * 4);
    queues[pri].push({ pri, out, id: queues[pri].length + 1 });
    draw();
  }
  function step() {
    // Always serve HI first if any
    if (queues.HI.length > 0) {
      const pkt = queues.HI.shift();
      served.push({ ...pkt, when: served.length + 1 });
    } else if (queues.LO.length > 0) {
      const pkt = queues.LO.shift();
      served.push({ ...pkt, when: served.length + 1 });
    }
    draw();
  }
  function reset() { queues = { HI: [], LO: [] }; served = []; draw(); }
  function draw() {
    const svg = document.getElementById('pri-svg');
    clearSvg(svg);
    svgEl('text', { x: 30, y: 30, 'font-weight': 600, fill: 'var(--danger)', text: 'HI prioritní VOQ' }, svg);
    queues.HI.forEach((p, i) => {
      svgEl('rect', { x: 30 + i * 50, y: 40, width: 44, height: 30, fill: 'var(--danger)', opacity: 0.7 }, svg);
      svgEl('text', { x: 52 + i * 50, y: 60, 'text-anchor': 'middle', 'font-size': 11, fill: 'white', text: `→${p.out}` }, svg);
    });
    svgEl('text', { x: 30, y: 110, 'font-weight': 600, fill: 'var(--info)', text: 'LO prioritní VOQ' }, svg);
    queues.LO.forEach((p, i) => {
      svgEl('rect', { x: 30 + i * 50, y: 120, width: 44, height: 30, fill: 'var(--info)', opacity: 0.7 }, svg);
      svgEl('text', { x: 52 + i * 50, y: 140, 'text-anchor': 'middle', 'font-size': 11, fill: 'white', text: `→${p.out}` }, svg);
    });
    svgEl('text', { x: 30, y: 195, 'font-weight': 600, fill: 'var(--success)', text: 'Obsloužené (v pořadí)' }, svg);
    served.slice(-10).forEach((p, i) => {
      const color = p.pri === 'HI' ? 'var(--danger)' : 'var(--info)';
      svgEl('rect', { x: 30 + i * 50, y: 205, width: 44, height: 30, fill: color, opacity: 0.5, stroke: 'var(--success)' }, svg);
      svgEl('text', { x: 52 + i * 50, y: 225, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text)', text: `${p.pri}→${p.out}` }, svg);
    });
    document.getElementById('pri-info').innerHTML = `HI: ${queues.HI.length}, LO: ${queues.LO.length}, obslouženo: ${served.length}. <strong>Pravidlo: vždy vyhrává nejvyšší přítomná priorita</strong> → LO trpí, pokud HI nezastaví. V iSLIP každá priorita má vlastní VOQ a vlastní accept/grant ukazatele.`;
  }
  document.getElementById('pri-add-hi').addEventListener('click', () => add('HI'));
  document.getElementById('pri-add-lo').addEventListener('click', () => add('LO'));
  document.getElementById('pri-step').addEventListener('click', step);
  document.getElementById('pri-reset').addEventListener('click', reset);
  reset();
}
