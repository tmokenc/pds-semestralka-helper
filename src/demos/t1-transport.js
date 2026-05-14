// Topic 1: Transportní protokoly
// Interactive demos: PER calculator, sequence number space, EWMA, flow control animation,
// GBN efficiency, TCP handshake, AIMD simulator.

import { svgEl, clearSvg, arrowDef } from '../util.js';

export function initT1() {
  initPER();
  initSeqSpace();
  initEWMA();
  initFlowControl();
  initGBN();
  initTCPHandshake();
  initAIMD();
  initVariantsComparison();
  initDupAck();
  initRTT();
  initSCTP();
  initMPTCP();
}

// ------- PER calculator -------
function initPER() {
  const calc = () => {
    const be = parseFloat(document.getElementById('ber-input').value);
    const sz = parseInt(document.getElementById('ber-pktsize').value, 10);
    const bits = sz * 8;
    const pOk = Math.pow(1 - be, bits);
    const pErr = 1 - pOk;
    document.getElementById('ber-output').innerHTML =
      `<strong>p<sub>ok</sub> = (1 − ${be})^${bits} ≈ ${(pOk * 100).toFixed(3)} %</strong><br>` +
      `<strong>p<sub>err</sub> ≈ ${(pErr * 100).toFixed(3)} %</strong> chyba na paket o velikosti ${sz} B.<br>` +
      `<span style="color:var(--text-muted);font-size:12px">Pravděpodobnost ztráty roste s délkou paketu exponenciálně.</span>`;
  };
  document.getElementById('ber-calc').addEventListener('click', calc);
  calc();
}

// ------- Sequence number space -------
function initSeqSpace() {
  const calc = () => {
    const mpl = parseFloat(document.getElementById('seq-mpl').value);
    const t = parseFloat(document.getElementById('seq-t').value);
    const a = parseFloat(document.getElementById('seq-a').value);
    const bw = parseFloat(document.getElementById('seq-bw').value) * 1e6; // Mb/s → b/s
    const pkt = parseInt(document.getElementById('seq-pkt').value, 10);
    const R = bw / (pkt * 8);  // packets/s
    const need = (2 * mpl + t + a) * R;
    const n = Math.ceil(Math.log2(need));
    document.getElementById('seq-output').innerHTML =
      `Rychlost <strong>R = ${R.toFixed(0)} paketů/s</strong><br>` +
      `Prostor sek. čísel ≥ <strong>${need.toFixed(0)}</strong> = (2·${mpl} + ${t} + ${a}) × ${R.toFixed(0)}<br>` +
      `Potřebných bitů: <strong>n ≥ log₂(${need.toFixed(0)}) ≈ ${n} bitů</strong><br>` +
      `<span style="color:var(--text-muted);font-size:12px">TCP má 32 bitů, aby zvládl gigabitové linky.</span>`;
  };
  document.getElementById('seq-calc').addEventListener('click', calc);
  calc();
}

// ------- EWMA timeout simulator -------
let ewmaState = null;
function ewmaReset() {
  ewmaState = {
    rtts: [],
    samples: [],
    srtt: 0,
    rttvar: 0,
    timeouts: [],
  };
  drawEWMA();
}
function ewmaStep() {
  if (!ewmaState) ewmaReset();
  const alpha = parseFloat(document.getElementById('ewma-alpha').value);
  // Sample RTT: base 80ms + noise + occasional spike
  const noise = (Math.random() - 0.5) * 30;
  const spike = Math.random() < 0.12 ? Math.random() * 90 : 0;
  const rtt = Math.max(30, 80 + noise + spike);

  if (ewmaState.samples.length === 0) {
    ewmaState.srtt = rtt;
    ewmaState.rttvar = rtt / 2;
  } else {
    ewmaState.rttvar = 0.75 * ewmaState.rttvar + 0.25 * Math.abs(ewmaState.srtt - rtt);
    ewmaState.srtt = (1 - alpha) * ewmaState.srtt + alpha * rtt;
  }
  const timeout = ewmaState.srtt + 4 * ewmaState.rttvar;
  ewmaState.samples.push(rtt);
  ewmaState.rtts.push(ewmaState.srtt);
  ewmaState.timeouts.push(timeout);
  if (ewmaState.samples.length > 30) {
    ewmaState.samples.shift();
    ewmaState.rtts.shift();
    ewmaState.timeouts.shift();
  }
  drawEWMA();
}
function drawEWMA() {
  const svg = document.getElementById('ewma-svg');
  if (!svg) return;
  clearSvg(svg);
  if (!ewmaState || ewmaState.samples.length === 0) {
    svgEl('text', { x: 350, y: 120, 'text-anchor': 'middle', fill: '#888', text: 'Klikněte „Další paket"' }, svg);
    return;
  }
  const W = 700, H = 240, pad = 30;
  const maxY = Math.max(...ewmaState.samples, ...ewmaState.timeouts) * 1.1;
  const xScale = i => pad + (W - 2 * pad) * (i / Math.max(29, ewmaState.samples.length - 1));
  const yScale = v => H - pad - (H - 2 * pad) * (v / maxY);

  // axes
  svgEl('line', { x1: pad, y1: H - pad, x2: W - pad, y2: H - pad, stroke: '#888' }, svg);
  svgEl('line', { x1: pad, y1: pad, x2: pad, y2: H - pad, stroke: '#888' }, svg);
  svgEl('text', { x: 10, y: pad, fill: '#666', 'font-size': 10, text: maxY.toFixed(0) + ' ms' }, svg);
  svgEl('text', { x: 10, y: H - pad + 4, fill: '#666', 'font-size': 10, text: '0' }, svg);

  // dotted lines + points
  const polyRtts = ewmaState.rtts.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ');
  const polyTo = ewmaState.timeouts.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ');
  svgEl('polyline', { points: polyTo, fill: 'none', stroke: '#c73a1f', 'stroke-width': 2, 'stroke-dasharray': '4 2' }, svg);
  svgEl('polyline', { points: polyRtts, fill: 'none', stroke: '#0066cc', 'stroke-width': 2 }, svg);
  ewmaState.samples.forEach((v, i) => {
    svgEl('circle', { cx: xScale(i), cy: yScale(v), r: 3, fill: '#7a3ea1' }, svg);
  });

  // legend
  svgEl('rect', { x: W - 200, y: 10, width: 180, height: 60, fill: 'white', stroke: '#ddd' }, svg);
  svgEl('line', { x1: W - 190, y1: 25, x2: W - 165, y2: 25, stroke: '#0066cc', 'stroke-width': 2 }, svg);
  svgEl('text', { x: W - 160, y: 28, 'font-size': 11, text: 'srtt (EWMA)' }, svg);
  svgEl('line', { x1: W - 190, y1: 42, x2: W - 165, y2: 42, stroke: '#c73a1f', 'stroke-width': 2, 'stroke-dasharray': '4 2' }, svg);
  svgEl('text', { x: W - 160, y: 45, 'font-size': 11, text: 'timeout = srtt + 4·var' }, svg);
  svgEl('circle', { cx: W - 178, cy: 59, r: 3, fill: '#7a3ea1' }, svg);
  svgEl('text', { x: W - 160, y: 62, 'font-size': 11, text: 'naměřené RTT' }, svg);
}
function initEWMA() {
  document.getElementById('ewma-step').addEventListener('click', ewmaStep);
  document.getElementById('ewma-reset').addEventListener('click', ewmaReset);
  const slider = document.getElementById('ewma-alpha');
  const val = document.getElementById('ewma-alpha-val');
  slider.addEventListener('input', () => { val.textContent = slider.value; });
  ewmaReset();
}

// ------- Flow control — step-by-step animation -------
function initFlowControl() {
  const W = 720;
  let state = { method: 'saw', lossPkt: 2, idx: 0, events: [], info: '', auto: null };

  // Each event: { y, from: 'c'|'s', label, kind: 'data'|'ack'|'dupack'|'lost'|'note', state, comment }
  function buildEvents(method, lossPkt) {
    const events = [];
    let y = 70;
    if (method === 'saw') {
      events.push({ y, from: 'c', label: 'pkt 0',          kind: 'data', state: 'sender: poslal pkt 0',    comment: 'Stop-and-Wait: jen 1 paket v letu' });            y += 38;
      events.push({ y, from: 's', label: 'ACK 0',          kind: 'ack',  state: 'receiver: přijal a ACK',   comment: 'RTT prošlo — sender může pokračovat' });          y += 38;
      events.push({ y, from: 'c', label: 'pkt 1 (LOST)',   kind: 'lost', state: 'sender: poslal pkt 1',     comment: 'Paket zmizel v síti' });                          y += 38;
      events.push({ y, from: 'c', label: '⏱ TIMEOUT',      kind: 'note', state: 'sender: timeout vypršel',  comment: 'Žádný ACK nedorazil → retransmit', selfTimer: true }); y += 38;
      events.push({ y, from: 'c', label: 'pkt 1 (retry)',  kind: 'data', state: 'retransmit pkt 1',         comment: 'Posíláme znovu — Stop-and-Wait je pomalý!' });    y += 38;
      events.push({ y, from: 's', label: 'ACK 1',          kind: 'ack',  state: 'receiver: ACK po retry',   comment: 'Konečně se to povedlo' });                        y += 38;
      state.info = 'Stop-and-Wait: jeden paket za RTT. Při ztrátě timeout (drahý) a opakování. Propustnost tragická.';
    } else if (method === 'gbn') {
      // Sender pushes window of 4
      for (let i = 0; i < 4; i++) {
        const lost = i === lossPkt;
        events.push({
          y, from: 'c',
          label: lost ? `pkt ${i} (LOST)` : `pkt ${i}`,
          kind: lost ? 'lost' : 'data',
          state: `sender: pkt ${i} odeslán`,
          comment: lost ? '→ se ztratí v síti' : 'okno = 4',
        });
        y += 28;
      }
      y += 12;
      // Receiver responds
      for (let i = 0; i < 4; i++) {
        if (i < lossPkt) {
          events.push({ y, from: 's', label: `ACK ${i}`, kind: 'ack', state: `receiver: pkt ${i} OK`, comment: 'kumulativní ACK' });
        } else if (i === lossPkt) {
          events.push({ y, from: 's', label: `(očekává pkt ${i}, nepřišel)`, kind: 'note', state: `receiver: vstup. okno čeká`, comment: 'GBN nemá buffer pro out-of-order' });
        } else {
          events.push({ y, from: 's', label: `pkt ${i} — DROP (out-of-order)`, kind: 'lost', state: `receiver: zahazuje`, comment: 'GBN je striktně in-order' });
        }
        y += 28;
      }
      y += 10;
      events.push({ y, from: 'c', label: '⏱ TIMEOUT', kind: 'note', state: 'sender: timeout', comment: `Žádný ACK pro pkt ${lossPkt} → retransmit OKNA od ${lossPkt}` });
      y += 30;
      for (let i = lossPkt; i < 4; i++) {
        events.push({ y, from: 'c', label: `pkt ${i} (retry)`, kind: 'data', state: `retransmit pkt ${i}`, comment: 'Posíláme celé okno znovu' });
        y += 28;
      }
      state.info = 'Go-Back-N: okno N paketů. Při ztrátě jediného — RETRANSMIT CELÉHO OKNA od ztraceného. Receiver zahazuje out-of-order.';
    } else if (method === 'sr') {
      for (let i = 0; i < 4; i++) {
        const lost = i === lossPkt;
        events.push({
          y, from: 'c',
          label: lost ? `pkt ${i} (LOST)` : `pkt ${i}`,
          kind: lost ? 'lost' : 'data',
          state: `sender: pkt ${i} odeslán`,
          comment: 'okno = 4',
        });
        y += 28;
      }
      y += 12;
      for (let i = 0; i < 4; i++) {
        if (i === lossPkt) {
          events.push({ y, from: 's', label: `(pkt ${i} chybí → buffer)`, kind: 'note', state: `receiver: čeká, ale buffer`, comment: 'SR má buffer pro out-of-order pakety' });
        } else if (i < lossPkt) {
          events.push({ y, from: 's', label: `ACK ${i}`, kind: 'ack', state: `receiver: in-order ACK`, comment: '' });
        } else {
          events.push({ y, from: 's', label: `dup-ACK ${lossPkt}`, kind: 'dupack', state: `receiver: dup-ACK pro chybějící`, comment: 'Implicitní NACK pro Fast Retransmit' });
        }
        y += 28;
      }
      y += 10;
      events.push({ y, from: 'c', label: '3 dup-ACK → Fast Retransmit', kind: 'note', state: 'sender: 3 dup-ACK detekováno', comment: 'Bez čekání na timeout!' });
      y += 30;
      events.push({ y, from: 'c', label: `pkt ${lossPkt} (retry)`, kind: 'data', state: `retransmit JEN ${lossPkt}`, comment: 'SR posílá pouze ztracený paket' });
      y += 28;
      events.push({ y, from: 's', label: `ACK ${3}`, kind: 'ack', state: 'receiver: vše doručeno in-order', comment: 'Cumul. ACK po opravě mezery' });
      state.info = 'Selective Repeat: znovuposílá JEN ztracený paket. Receiver má buffer; tři dup-ACK spustí Fast Retransmit.';
    } else if (method === 'fec') {
      const k = 3;
      for (let i = 0; i < k; i++) {
        const lost = i === lossPkt;
        events.push({
          y, from: 'c',
          label: lost ? `data ${i} (LOST)` : `data ${i}`,
          kind: lost ? 'lost' : 'data',
          state: `sender: data ${i}`,
          comment: lost ? '→ tento se ztratí' : `${i + 1}. ze ${k} datových bloků`,
        });
        y += 32;
      }
      events.push({ y, from: 'c', label: `parita = XOR(d0,d1,d2)`, kind: 'parity', state: 'sender: paritní blok', comment: 'Redundance pro recovery' });
      y += 38;
      events.push({ y, from: 's', label: `dopočítá data ${lossPkt} = XOR(ostatní, parita)`, kind: 'note', state: 'receiver: rekonstrukce', comment: 'BEZ retransmise — pakety se doplní z parity' });
      y += 28;
      events.push({ y, from: 's', label: 'všechna data OK ✓', kind: 'ack', state: 'receiver: kompletní', comment: 'FEC = RAID 5 pro pakety' });
      state.info = 'FEC: k datových + m paritních. Lze ztratit až m a vše se obnoví. Cena: trvalá režie redundance + latence celého bloku.';
    }
    return events;
  }

  function reset() {
    if (state.auto) { clearInterval(state.auto); state.auto = null; }
    state.method = document.getElementById('flow-method').value;
    state.lossPkt = parseInt(document.getElementById('flow-loss').value, 10);
    state.idx = 0;
    state.events = buildEvents(state.method, state.lossPkt);
    draw();
  }

  function step() {
    if (state.auto) { clearInterval(state.auto); state.auto = null; }
    if (state.idx >= state.events.length) state.idx = 0;
    else state.idx++;
    draw();
  }

  function autoPlay() {
    if (state.auto) { clearInterval(state.auto); state.auto = null; }
    state.idx = 0;
    draw();
    state.auto = setInterval(() => {
      state.idx++;
      draw();
      if (state.idx >= state.events.length) {
        clearInterval(state.auto);
        state.auto = null;
      }
    }, 700);
  }

  function draw() {
    const svg = document.getElementById('flow-svg');
    clearSvg(svg);
    arrowDef(svg, 'flow-arr-data', '#1F4B8A');
    arrowDef(svg, 'flow-arr-ack', '#1F7A4E');
    arrowDef(svg, 'flow-arr-dup', '#7a3ea1');
    arrowDef(svg, 'flow-arr-lost', '#D6553D');
    arrowDef(svg, 'flow-arr-parity', '#B86F00');

    const total = state.events.length;
    const methodLabels = { saw: 'Stop-and-Wait', gbn: 'Go-Back-N (w=4)', sr: 'Selective Repeat (w=4)', fec: 'FEC (k=3 + 1 parity)' };
    const cur = state.idx > 0 && state.idx <= total ? state.events[state.idx - 1] : null;
    const curColor = cur ? colorForKind(cur.kind) : '#525969';

    // Phase banner
    svgEl('rect', { x: 0, y: 0, width: W, height: 56, fill: '#F4F4F0' }, svg);
    svgEl('text', { x: 18, y: 22, 'font-size': 14, 'font-weight': 700, fill: '#0F1419', text: methodLabels[state.method] || state.method }, svg);
    svgEl('text', {
      x: 18, y: 42, 'font-size': 12, fill: curColor, 'font-weight': 600,
      text: cur ? `◉ ${cur.state}` : '⏸ Připraveno — klikni „Další krok"',
    }, svg);
    svgEl('text', {
      x: W - 18, y: 22, 'text-anchor': 'end', 'font-size': 12, fill: '#525969',
      text: `událost ${state.idx} / ${total}`,
    }, svg);
    svgEl('text', {
      x: W - 18, y: 42, 'text-anchor': 'end', 'font-size': 11, fill: '#525969',
      'font-style': 'italic',
      text: cur && cur.comment ? cur.comment : '',
    }, svg);

    // Lifelines
    svgEl('line', { x1: 130, y1: 64, x2: 130, y2: 488, stroke: '#0F1419', 'stroke-width': 1.5 }, svg);
    svgEl('line', { x1: W - 130, y1: 64, x2: W - 130, y2: 488, stroke: '#0F1419', 'stroke-width': 1.5 }, svg);
    svgEl('rect', { x: 75, y: 60, width: 110, height: 22, fill: '#E8EFFF', stroke: '#1F4B8A', rx: 3 }, svg);
    svgEl('text', { x: 130, y: 76, 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 11, fill: '#1F4B8A', text: 'Odesílatel' }, svg);
    svgEl('rect', { x: W - 185, y: 60, width: 110, height: 22, fill: '#F0FFF5', stroke: '#1F7A4E', rx: 3 }, svg);
    svgEl('text', { x: W - 130, y: 76, 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 11, fill: '#1F7A4E', text: 'Příjemce' }, svg);

    // Events up to idx
    for (let i = 0; i < state.idx && i < total; i++) {
      const e = state.events[i];
      const isCurrent = i === state.idx - 1;
      const op = isCurrent ? 1.0 : 0.45;
      const color = colorForKind(e.kind);
      const arrId = arrowIdForKind(e.kind);

      if (e.kind === 'note') {
        // Inline note, not a transmission arrow
        const x = e.from === 'c' ? 145 : W - 145;
        svgEl('text', {
          x, y: e.y + 12,
          'text-anchor': e.from === 'c' ? 'start' : 'end',
          'font-size': 12, fill: color, 'font-weight': isCurrent ? 700 : 500, opacity: op,
          text: e.label,
        }, svg);
      } else {
        const x1 = e.from === 'c' ? 132 : W - 132;
        const x2 = e.kind === 'lost'
          ? (e.from === 'c' ? 400 : 320)
          : (e.from === 'c' ? W - 132 : 132);
        const dy = e.kind === 'lost' ? 14 : 22;
        const dasharray = e.kind === 'ack' || e.kind === 'dupack' ? '4 3'
                        : e.kind === 'lost' ? '5 3'
                        : '';
        svgEl('line', {
          x1, y1: e.y + 4, x2, y2: e.y + dy,
          stroke: color, 'stroke-width': isCurrent ? 3 : 1.8,
          'marker-end': e.kind === 'lost' ? '' : `url(#${arrId})`,
          'stroke-dasharray': dasharray, opacity: op,
        }, svg);
        if (e.kind === 'lost') {
          svgEl('text', { x: 420, y: e.y + 18, 'font-size': 12, fill: '#D6553D', 'font-weight': 700, opacity: op, text: '✗' }, svg);
        }
        // Label
        const midX = e.kind === 'lost' ? 250 : (x1 + x2) / 2;
        svgEl('text', {
          x: midX, y: e.y - 2, 'text-anchor': 'middle',
          'font-size': 11.5, fill: color, 'font-weight': isCurrent ? 700 : 500,
          opacity: op, text: e.label,
        }, svg);
      }
    }

    // Legend
    const legY = 478;
    let lx = 18;
    function leg(name, color, dash, marker) {
      svgEl('line', { x1: lx, y1: legY - 4, x2: lx + 22, y2: legY - 4, stroke: color, 'stroke-width': 2, 'stroke-dasharray': dash || '' }, svg);
      svgEl('text', { x: lx + 28, y: legY, 'font-size': 10, fill: '#0F1419', text: name }, svg);
      lx += 90 + name.length * 2;
    }
    leg('data',     '#1F4B8A', '');
    leg('ACK',      '#1F7A4E', '4 3');
    leg('dup-ACK',  '#7a3ea1', '4 3');
    leg('LOST',     '#D6553D', '5 3');
    leg('parita',   '#B86F00', '');

    // Step button label
    const btn = document.getElementById('flow-step');
    if (btn) btn.textContent = state.idx >= total ? '↺ Restart' : '▸ Další krok';

    // Info text below
    const info = document.getElementById('flow-info');
    if (info) info.textContent = state.info;
  }

  function colorForKind(k) {
    return ({
      data: '#1F4B8A', ack: '#1F7A4E', dupack: '#7a3ea1',
      lost: '#D6553D', parity: '#B86F00', note: '#525969',
    })[k] || '#0F1419';
  }
  function arrowIdForKind(k) {
    return ({ data: 'flow-arr-data', ack: 'flow-arr-ack', dupack: 'flow-arr-dup', lost: 'flow-arr-lost', parity: 'flow-arr-parity' })[k] || 'flow-arr-data';
  }

  document.getElementById('flow-step').addEventListener('click', step);
  document.getElementById('flow-play').addEventListener('click', autoPlay);
  document.getElementById('flow-reset').addEventListener('click', reset);
  document.getElementById('flow-method').addEventListener('change', reset);
  document.getElementById('flow-loss').addEventListener('change', reset);
  reset();
}

// ------- Go-Back-N efficiency -------
function initGBN() {
  const draw = () => {
    const svg = document.getElementById('gbn-svg');
    if (!svg) return;
    clearSvg(svg);
    const w = parseInt(document.getElementById('gbn-w').value, 10);
    const p = parseFloat(document.getElementById('gbn-p').value);
    document.getElementById('gbn-w-val').textContent = w;
    document.getElementById('gbn-p-val').textContent = p.toFixed(4);

    // Plot efficiency vs p for current w
    const W = 700, H = 220, pad = 40;
    svgEl('line', { x1: pad, y1: H - pad, x2: W - pad, y2: H - pad, stroke: '#888' }, svg);
    svgEl('line', { x1: pad, y1: pad, x2: pad, y2: H - pad, stroke: '#888' }, svg);
    svgEl('text', { x: 10, y: pad + 4, fill: '#666', 'font-size': 11, text: '100%' }, svg);
    svgEl('text', { x: 10, y: H - pad + 4, fill: '#666', 'font-size': 11, text: '0%' }, svg);
    svgEl('text', { x: W / 2, y: H - 10, 'text-anchor': 'middle', fill: '#666', 'font-size': 11, text: 'chybovost p (0 → 5%)' }, svg);
    svgEl('text', { x: 15, y: H / 2, fill: '#666', 'font-size': 11, transform: `rotate(-90 15 ${H / 2})`, text: 'eff' }, svg);

    // Plot curve
    const pts = [];
    for (let i = 0; i <= 200; i++) {
      const pi = i / 200 * 0.05;
      const eff = (1 - pi) / (1 - pi + pi * w);
      const x = pad + (W - 2 * pad) * (i / 200);
      const y = H - pad - (H - 2 * pad) * eff;
      pts.push(`${x},${y}`);
    }
    svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: '#0066cc', 'stroke-width': 2 }, svg);

    // Current point
    const eff = (1 - p) / (1 - p + p * w);
    const x = pad + (W - 2 * pad) * (p / 0.05);
    const y = H - pad - (H - 2 * pad) * eff;
    svgEl('circle', { cx: x, cy: y, r: 6, fill: '#c73a1f' }, svg);
    svgEl('text', { x: x + 10, y: y - 8, 'font-size': 12, fill: '#c73a1f', 'font-weight': 600, text: `${(eff * 100).toFixed(1)} %` }, svg);
  };
  ['gbn-w', 'gbn-p'].forEach(id => document.getElementById(id).addEventListener('input', draw));
  draw();
}

// ------- TCP handshake — step-by-step animation -------
function initTCPHandshake() {
  const W = 720;
  const SCENARIOS = {
    open: {
      title: 'Navázání spojení — 3-way handshake',
      msgs: [
        { from: 'c', y: 100, label: 'SYN, seq=x',                       color: '#1F4B8A', state: 'klient: SYN_SENT',     comment: 'Klient navrhuje vlastní seq=x' },
        { from: 's', y: 160, label: 'SYN+ACK, seq=y, ack=x+1',          color: '#D6553D', state: 'server: SYN_RCVD',     comment: 'Server akceptuje x, navrhuje y' },
        { from: 'c', y: 220, label: 'ACK, ack=y+1',                     color: '#1F7A4E', state: 'oba: ESTABLISHED',     comment: 'Spojení vytvořeno, lze posílat data' },
        { from: 'c', y: 290, label: 'DATA →',                           color: '#7a3ea1', state: 'data flow',            comment: 'Sequence number = OFFSET BAJTU, ne pořadí paketu', kind: 'data' },
      ],
    },
    close: {
      title: 'Ukončení — 4-way close (full-duplex)',
      msgs: [
        { from: 'c', y: 100, label: 'FIN',                              color: '#D6553D', state: 'klient: FIN_WAIT_1',   comment: 'Klient končí SVŮJ směr; druhý směr žije' },
        { from: 's', y: 145, label: 'ACK (potvrzení FIN)',              color: '#1F7A4E', state: 'klient: FIN_WAIT_2 · server: CLOSE_WAIT', comment: 'Server stále může posílat data' },
        { from: 's', y: 200, label: '(server může ještě posílat data)', color: '#7a3ea1', state: 'server: CLOSE_WAIT',   comment: 'Half-close: jen jeden směr uzavřen', kind: 'data' },
        { from: 's', y: 260, label: 'FIN',                              color: '#D6553D', state: 'server: LAST_ACK',     comment: 'Server uzavírá svůj směr' },
        { from: 'c', y: 320, label: 'ACK',                              color: '#1F7A4E', state: 'klient: TIME_WAIT (2·MSL)', comment: 'TIME_WAIT chrání před opožděnými duplikáty' },
      ],
    },
    halfclose: {
      title: 'Half-close — proč 4-way místo 3-way',
      msgs: [
        { from: 'c', y: 100, label: 'FIN — uzavírám svůj směr',         color: '#D6553D', state: 'klient: FIN_WAIT_1',   comment: 'Klient končí; server zatím POKRAČUJE posílat' },
        { from: 's', y: 145, label: 'ACK',                              color: '#1F7A4E', state: 'half-close',           comment: 'Půl spojení uzavřena, druhá běží' },
        { from: 's', y: 195, label: 'pokračující data ↓',               color: '#7a3ea1', state: 'server stále posílá',  comment: 'Pointa: kdyby šlo o 3-way, server by tu možnost neměl', kind: 'data' },
        { from: 's', y: 250, label: 'pokračující data ↓',               color: '#7a3ea1', state: 'server stále posílá',  kind: 'data' },
        { from: 's', y: 305, label: 'FIN',                              color: '#D6553D', state: 'server: LAST_ACK',     comment: 'Konečně i server končí svůj směr' },
        { from: 'c', y: 350, label: 'ACK',                              color: '#1F7A4E', state: 'CLOSED' },
      ],
    },
  };

  let state = { idx: 0, scenario: 'open', auto: null };

  function reset() {
    if (state.auto) { clearInterval(state.auto); state.auto = null; }
    state.idx = 0;
    state.scenario = document.getElementById('tcp-scenario').value;
    draw();
  }

  function step() {
    if (state.auto) { clearInterval(state.auto); state.auto = null; }
    const sc = SCENARIOS[state.scenario];
    if (state.idx >= sc.msgs.length) state.idx = 0; // wrap to start
    else state.idx++;
    draw();
  }

  function autoPlay() {
    if (state.auto) { clearInterval(state.auto); state.auto = null; }
    state.idx = 0;
    draw();
    state.auto = setInterval(() => {
      state.idx++;
      draw();
      if (state.idx >= SCENARIOS[state.scenario].msgs.length) {
        clearInterval(state.auto);
        state.auto = null;
      }
    }, 850);
  }

  function draw() {
    const svg = document.getElementById('tcp-svg');
    clearSvg(svg);
    arrowDef(svg, 'tcp-arr-blue',  '#1F4B8A');
    arrowDef(svg, 'tcp-arr-red',   '#D6553D');
    arrowDef(svg, 'tcp-arr-green', '#1F7A4E');
    arrowDef(svg, 'tcp-arr-plum',  '#7a3ea1');

    const sc = SCENARIOS[state.scenario];
    const total = sc.msgs.length;

    // Phase banner
    svgEl('rect', { x: 0, y: 0, width: W, height: 50, fill: '#F4F4F0' }, svg);
    svgEl('text', { x: 18, y: 22, 'font-size': 14, 'font-weight': 700, fill: '#0F1419', text: sc.title }, svg);
    const curMsg = state.idx > 0 && state.idx <= total ? sc.msgs[state.idx - 1] : null;
    svgEl('text', {
      x: 18, y: 40, 'font-size': 12,
      fill: curMsg ? curMsg.color : '#525969',
      'font-weight': 600,
      text: curMsg ? `◉ ${curMsg.state}` : '⏸ Připraveno — klikni „Další krok"',
    }, svg);
    svgEl('text', {
      x: W - 18, y: 40, 'text-anchor': 'end',
      'font-size': 12, fill: '#525969',
      text: `krok ${state.idx} / ${total}`,
    }, svg);

    // Lifelines
    svgEl('line', { x1: 130, y1: 64, x2: 130, y2: 410, stroke: '#0F1419', 'stroke-width': 1.5 }, svg);
    svgEl('line', { x1: W - 130, y1: 64, x2: W - 130, y2: 410, stroke: '#0F1419', 'stroke-width': 1.5 }, svg);
    svgEl('rect', { x: 70, y: 60, width: 120, height: 22, fill: '#E8EFFF', stroke: '#1F4B8A', rx: 3 }, svg);
    svgEl('text', { x: 130, y: 76, 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 12, fill: '#1F4B8A', text: 'Klient' }, svg);
    svgEl('rect', { x: W - 190, y: 60, width: 120, height: 22, fill: '#FFF0EC', stroke: '#D6553D', rx: 3 }, svg);
    svgEl('text', { x: W - 130, y: 76, 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 12, fill: '#D6553D', text: 'Server' }, svg);

    // Past messages (faded) + current message (highlighted)
    for (let i = 0; i < state.idx && i < total; i++) {
      const m = sc.msgs[i];
      const isCurrent = i === state.idx - 1;
      const opacity = isCurrent ? 1.0 : 0.45;
      const x1 = m.from === 'c' ? 132 : W - 132;
      const x2 = m.from === 'c' ? W - 132 : 132;
      const arrId = m.color === '#1F4B8A' ? 'tcp-arr-blue'
                  : m.color === '#D6553D' ? 'tcp-arr-red'
                  : m.color === '#1F7A4E' ? 'tcp-arr-green'
                  : 'tcp-arr-plum';
      svgEl('line', {
        x1, y1: m.y + 8, x2, y2: m.y + 22,
        stroke: m.color, 'stroke-width': isCurrent ? 3 : 1.8,
        'marker-end': `url(#${arrId})`,
        opacity,
      }, svg);
      svgEl('text', {
        x: (x1 + x2) / 2, y: m.y, 'text-anchor': 'middle',
        'font-size': 12, fill: m.color,
        'font-weight': isCurrent ? 700 : 500,
        opacity,
        text: m.label,
      }, svg);
      if (isCurrent && m.comment) {
        svgEl('text', {
          x: (x1 + x2) / 2, y: m.y + 36, 'text-anchor': 'middle',
          'font-size': 11, fill: '#525969',
          'font-style': 'italic',
          text: m.comment,
        }, svg);
      }
    }

    // Step button label
    const btn = document.getElementById('tcp-step');
    if (btn) {
      btn.textContent = state.idx >= total ? '↺ Restart' : '▸ Další krok';
    }
  }

  document.getElementById('tcp-step').addEventListener('click', step);
  document.getElementById('tcp-play').addEventListener('click', autoPlay);
  document.getElementById('tcp-reset').addEventListener('click', reset);
  document.getElementById('tcp-scenario').addEventListener('change', reset);
  reset();
}

// ------- AIMD — step-by-step simulator with mode coloring -------
function initAIMD() {
  const W = 720, H = 360, pad = 50;
  const RTTS = 100;
  const STEP_SIZE = 8;  // RTTs revealed per click

  let state = {
    variant: 'reno', lossPct: 2, ssthreshStart: 32,
    shownTo: 0,    // how many RTTs are revealed
    data: [],      // [{ cwnd, mode, event }]
    events: [],    // loss events { t, type, ssthresh, cwndAfter }
    auto: null,
  };

  function simulate() {
    state.variant = document.getElementById('aimd-variant').value;
    state.lossPct = parseFloat(document.getElementById('aimd-loss').value);
    state.ssthreshStart = parseInt(document.getElementById('aimd-ssthresh').value, 10);
    document.getElementById('aimd-loss-val').textContent = state.lossPct.toFixed(1);

    let cwnd = 1;
    let ssthresh = state.ssthreshStart;
    let mode = 'ss';
    const lossProb = state.lossPct / 100;
    state.data = [];
    state.events = [];

    for (let t = 0; t < RTTS; t++) {
      state.data.push({ cwnd, mode, ssthresh });
      const loss = Math.random() < lossProb && cwnd > 2;
      if (loss) {
        const timeout = Math.random() < 0.3;
        ssthresh = Math.max(2, Math.floor(cwnd / 2));
        if (timeout) {
          state.events.push({ t, type: 'timeout', label: 'timeout', cwndAfter: 1, ssthresh });
          cwnd = 1; mode = 'ss';
        } else if (state.variant === 'tahoe') {
          state.events.push({ t, type: '3dup', label: '3 dup-ACK', cwndAfter: 1, ssthresh });
          cwnd = 1; mode = 'ss';
        } else {
          state.events.push({ t, type: '3dup', label: '3 dup-ACK', cwndAfter: ssthresh, ssthresh });
          cwnd = ssthresh; mode = 'ca';
        }
      } else {
        if (mode === 'ss') {
          cwnd = cwnd * 2;
          if (cwnd >= ssthresh) { cwnd = ssthresh; mode = 'ca'; }
        } else if (state.variant === 'cubic') {
          const Wmax = ssthresh * 2;
          const diff = Wmax - cwnd;
          cwnd += diff > 0 ? Math.max(0.3, diff * 0.05) : 0.15;
          mode = 'cubic';
        } else {
          cwnd += 1;
          mode = 'ca';
        }
      }
    }
  }

  function reset() {
    if (state.auto) { clearInterval(state.auto); state.auto = null; }
    simulate();
    state.shownTo = 0;
    draw();
  }

  function step() {
    if (state.auto) { clearInterval(state.auto); state.auto = null; }
    if (state.shownTo >= RTTS) { state.shownTo = 0; simulate(); }
    else state.shownTo = Math.min(RTTS, state.shownTo + STEP_SIZE);
    draw();
  }

  function autoPlay() {
    if (state.auto) { clearInterval(state.auto); state.auto = null; }
    state.shownTo = 0;
    simulate();
    draw();
    state.auto = setInterval(() => {
      state.shownTo += 2;
      draw();
      if (state.shownTo >= RTTS) { clearInterval(state.auto); state.auto = null; }
    }, 80);
  }

  function modeColor(m) {
    return m === 'ss'    ? '#B86F00'
         : m === 'ca'    ? '#1F4B8A'
         : m === 'cubic' ? '#1F7A4E'
         :                 '#525969';
  }

  function draw() {
    const svg = document.getElementById('aimd-svg');
    if (!svg) return;
    clearSvg(svg);

    const total = state.data.length;
    const maxC = Math.max(1, ...state.data.map(d => d.cwnd));
    const xS = i => pad + (W - 2 * pad) * (i / (RTTS - 1));
    const yS = c => H - pad - (H - pad - 60) * (c / maxC);

    // Phase banner
    const cur = state.shownTo > 0 ? state.data[Math.min(state.shownTo - 1, total - 1)] : null;
    const lastEvent = [...state.events].reverse().find(e => e.t < state.shownTo);
    svgEl('rect', { x: 0, y: 0, width: W, height: 50, fill: '#F4F4F0' }, svg);
    const variantLabel = { tahoe: 'TCP Tahoe', reno: 'TCP Reno', cubic: 'CUBIC' }[state.variant];
    svgEl('text', { x: 18, y: 22, 'font-size': 14, 'font-weight': 700, fill: '#0F1419', text: `AIMD — ${variantLabel}` }, svg);
    if (cur) {
      const modeLabel = cur.mode === 'ss' ? 'Slow Start (exponenciální)'
                      : cur.mode === 'ca' ? 'Congestion Avoidance (lineární)'
                      : 'CUBIC (bikubický)';
      svgEl('text', { x: 18, y: 40, 'font-size': 12, fill: modeColor(cur.mode), 'font-weight': 600,
        text: `◉ ${modeLabel}  ·  cwnd=${cur.cwnd.toFixed(1)}  ssthresh=${cur.ssthresh}` }, svg);
    } else {
      svgEl('text', { x: 18, y: 40, 'font-size': 12, fill: '#525969', 'font-weight': 600, text: '⏸ Klikni „Další etapa" pro start' }, svg);
    }
    svgEl('text', { x: W - 18, y: 22, 'text-anchor': 'end', 'font-size': 12, fill: '#525969',
      text: `RTT ${state.shownTo} / ${RTTS}` }, svg);
    if (lastEvent) {
      svgEl('text', { x: W - 18, y: 40, 'text-anchor': 'end', 'font-size': 11, fill: '#D6553D', 'font-style': 'italic',
        text: `poslední: ${lastEvent.label} @ RTT ${lastEvent.t}` }, svg);
    }

    // Axes
    svgEl('line', { x1: pad, y1: H - pad, x2: W - pad, y2: H - pad, stroke: '#0F1419', 'stroke-width': 1.2 }, svg);
    svgEl('line', { x1: pad, y1: 60, x2: pad, y2: H - pad, stroke: '#0F1419', 'stroke-width': 1.2 }, svg);
    svgEl('text', { x: pad - 12, y: 70, 'text-anchor': 'end', fill: '#525969', 'font-size': 11, text: 'cwnd' }, svg);
    svgEl('text', { x: pad - 12, y: H - pad + 4, 'text-anchor': 'end', fill: '#525969', 'font-size': 10, text: '0' }, svg);
    svgEl('text', { x: pad - 12, y: yS(maxC) + 4, 'text-anchor': 'end', fill: '#525969', 'font-size': 10, text: maxC.toFixed(0) }, svg);
    svgEl('text', { x: W - pad + 4, y: H - pad + 4, fill: '#525969', 'font-size': 10, text: 'RTT' }, svg);

    // Initial ssthresh line
    svgEl('line', {
      x1: pad, y1: yS(state.ssthreshStart),
      x2: W - pad, y2: yS(state.ssthreshStart),
      stroke: '#D6553D', 'stroke-dasharray': '4 3', 'stroke-width': 1.2, opacity: 0.6,
    }, svg);
    svgEl('text', { x: W - pad - 5, y: yS(state.ssthreshStart) - 4, 'text-anchor': 'end', fill: '#D6553D', 'font-size': 10, text: `ssthresh start = ${state.ssthreshStart}` }, svg);

    // Mode-colored segments
    let segStart = 0;
    let prevMode = state.data[0]?.mode;
    for (let i = 1; i <= state.shownTo && i < total; i++) {
      const m = state.data[i].mode;
      if (m !== prevMode || i === state.shownTo) {
        // emit segment from segStart..i with prevMode color
        const segData = state.data.slice(segStart, i + 1);
        const pts = segData.map((d, k) => `${xS(segStart + k)},${yS(d.cwnd)}`).join(' ');
        svgEl('polyline', {
          points: pts, fill: 'none', stroke: modeColor(prevMode), 'stroke-width': 2.5,
        }, svg);
        segStart = i;
        prevMode = m;
      }
    }
    // Final segment if not emitted yet
    if (segStart < state.shownTo) {
      const segData = state.data.slice(segStart, state.shownTo);
      const pts = segData.map((d, k) => `${xS(segStart + k)},${yS(d.cwnd)}`).join(' ');
      svgEl('polyline', { points: pts, fill: 'none', stroke: modeColor(prevMode), 'stroke-width': 2.5 }, svg);
    }

    // Loss events
    state.events.filter(e => e.t < state.shownTo).forEach(e => {
      const isTimeout = e.type === 'timeout';
      const r = isTimeout ? 7 : 4;
      svgEl('circle', { cx: xS(e.t), cy: yS(state.data[e.t].cwnd), r, fill: '#D6553D', stroke: '#8E1F1A', 'stroke-width': 1.5 }, svg);
      svgEl('line', { x1: xS(e.t), y1: yS(state.data[e.t].cwnd), x2: xS(e.t), y2: H - pad, stroke: '#D6553D', 'stroke-width': 0.8, 'stroke-dasharray': '2 2', opacity: 0.5 }, svg);
      svgEl('text', { x: xS(e.t), y: yS(state.data[e.t].cwnd) - 12, 'text-anchor': 'middle', 'font-size': 9, fill: '#D6553D', text: isTimeout ? 'T/O' : '3dup' }, svg);
    });

    // Current point indicator
    if (state.shownTo > 0 && state.shownTo <= total) {
      const idx = state.shownTo - 1;
      const d = state.data[idx];
      svgEl('circle', { cx: xS(idx), cy: yS(d.cwnd), r: 5, fill: '#0F1419' }, svg);
    }

    // Legend
    const legY = H - 14;
    let lx = pad;
    function leg(name, color) {
      svgEl('line', { x1: lx, y1: legY - 4, x2: lx + 22, y2: legY - 4, stroke: color, 'stroke-width': 2.5 }, svg);
      svgEl('text', { x: lx + 28, y: legY, 'font-size': 10, fill: '#0F1419', text: name }, svg);
      lx += 30 + name.length * 6.5;
    }
    leg('Slow Start',           '#B86F00');
    leg('Cong. Avoidance',      '#1F4B8A');
    if (state.variant === 'cubic') leg('CUBIC growth', '#1F7A4E');
    svgEl('circle', { cx: lx + 6, cy: legY - 4, r: 4, fill: '#D6553D' }, svg);
    svgEl('text', { x: lx + 16, y: legY, 'font-size': 10, fill: '#0F1419', text: '3 dup-ACK' }, svg);
    lx += 80;
    svgEl('circle', { cx: lx + 6, cy: legY - 4, r: 7, fill: '#D6553D' }, svg);
    svgEl('text', { x: lx + 18, y: legY, 'font-size': 10, fill: '#0F1419', text: 'timeout' }, svg);

    // Step button label
    const btn = document.getElementById('aimd-step');
    if (btn) btn.textContent = state.shownTo >= RTTS ? '↺ Nový průběh' : '▸ Další etapa';
  }

  document.getElementById('aimd-step').addEventListener('click', step);
  document.getElementById('aimd-play').addEventListener('click', autoPlay);
  document.getElementById('aimd-reset').addEventListener('click', reset);
  ['aimd-variant', 'aimd-loss', 'aimd-ssthresh'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
      if (id === 'aimd-loss') document.getElementById('aimd-loss-val').textContent = parseFloat(el.value).toFixed(1);
      reset();
    });
  });
  reset();
}

// ------- TCP variants side-by-side -------
function initVariantsComparison() {
  function simulate(variant, lossProb, RTTS) {
    let cwnd = 1, ssthresh = 32, mode = 'ss';
    const data = [];
    for (let t = 0; t < RTTS; t++) {
      data.push(cwnd);
      const loss = Math.random() < lossProb && cwnd > 2;
      if (loss) {
        ssthresh = Math.max(2, Math.floor(cwnd / 2));
        if (variant === 'tahoe') { cwnd = 1; mode = 'ss'; }
        else if (variant === 'reno') { cwnd = ssthresh; mode = 'ca'; }
        else if (variant === 'cubic') { cwnd = ssthresh; mode = 'ca'; }
      } else {
        if (mode === 'ss') {
          cwnd *= 2;
          if (cwnd >= ssthresh) { cwnd = ssthresh; mode = 'ca'; }
        } else if (variant === 'cubic') {
          const Wmax = ssthresh * 2;
          const diff = Wmax - cwnd;
          cwnd += diff > 0 ? Math.max(0.3, diff * 0.05) : 0.15;
        } else {
          cwnd += 1;
        }
      }
    }
    return data;
  }

  function draw() {
    const svg = document.getElementById('variants-svg');
    clearSvg(svg);
    const loss = parseFloat(document.getElementById('variants-loss').value) / 100;
    document.getElementById('variants-loss-val').textContent = (loss * 100).toFixed(1);
    const RTTS = 80;
    // Same random seed by using deterministic Math.random surrogate
    const seed = Date.now();
    let rng = () => { let x = Math.sin(seed * 9999 + Math.random() * 1000) * 10000; return Math.abs(x - Math.floor(x)); };
    const tahoe = simulate('tahoe', loss, RTTS);
    const reno = simulate('reno', loss, RTTS);
    const cubic = simulate('cubic', loss, RTTS);

    const W = 700, H = 280, pad = 40;
    const maxC = Math.max(...tahoe, ...reno, ...cubic, 16);
    const xS = i => pad + (W - 2 * pad) * (i / (RTTS - 1));
    const yS = c => H - pad - (H - 2 * pad) * (c / maxC);

    svgEl('line', { x1: pad, y1: H - pad, x2: W - pad, y2: H - pad, stroke: '#888' }, svg);
    svgEl('line', { x1: pad, y1: 20, x2: pad, y2: H - pad, stroke: '#888' }, svg);
    svgEl('text', { x: W / 2, y: H - 8, 'text-anchor': 'middle', fill: '#666', 'font-size': 11, text: 'RTT' }, svg);
    svgEl('text', { x: 15, y: 20, fill: '#666', 'font-size': 11, text: 'cwnd' }, svg);

    const variants = [
      { data: tahoe, label: 'Tahoe', color: '#c73a1f' },
      { data: reno, label: 'Reno', color: '#0066cc' },
      { data: cubic, label: 'CUBIC', color: '#0a7a3d' },
    ];
    variants.forEach((v, vi) => {
      const pts = v.data.map((c, i) => `${xS(i)},${yS(c)}`).join(' ');
      svgEl('polyline', { points: pts, fill: 'none', stroke: v.color, 'stroke-width': 2 }, svg);
      svgEl('rect', { x: W - 110, y: 20 + vi * 18, width: 12, height: 4, fill: v.color }, svg);
      svgEl('text', { x: W - 92, y: 26 + vi * 18, 'font-size': 11, text: v.label }, svg);
    });
  }
  document.getElementById('variants-play').addEventListener('click', draw);
  document.getElementById('variants-loss').addEventListener('input', draw);
  draw();
}

// ------- Fast Retransmit dup-ACK -------
function initDupAck() {
  const W = 720;
  // Time-ordered events. y values give enough vertical room for the text caption
  // (drawn above the arrow) and the slanted line below it without overlapping
  // the next event.
  const EVENTS = [
    { y: 60,  from: 'c', label: 'seq=100 (data 100–199)',           color: '#0066cc' },
    { y: 105, from: 'c', label: 'seq=200 (ZTRACENO v síti)',        color: '#c73a1f', lost: true },
    { y: 150, from: 's', label: 'ACK=200 (potvrzeno seq=100)',      color: '#0a7a3d' },
    { y: 195, from: 'c', label: 'seq=300',                           color: '#0066cc' },
    { y: 240, from: 's', label: 'dup-ACK=200 (mám 300, chybí 200)', color: '#7a3ea1' },
    { y: 285, from: 'c', label: 'seq=400',                           color: '#0066cc' },
    { y: 330, from: 's', label: 'dup-ACK=200 (mám 400, stále chybí)', color: '#7a3ea1' },
    { y: 375, from: 'c', label: 'seq=500',                           color: '#0066cc' },
    { y: 415, from: 's', label: 'dup-ACK=200 (3. dup → trigger!)',  color: '#7a3ea1', bold: true },
    { y: 455, from: 'c', label: '⚡ Fast Retransmit seq=200',        color: '#c73a1f', bold: true },
    { y: 495, from: 's', label: 'ACK=600 (vše doručeno)',           color: '#0a7a3d', bold: true },
  ];

  let animTimer = null;

  function drawBase() {
    const svg = document.getElementById('dupack-svg');
    clearSvg(svg);
    arrowDef(svg, 'dup-arr', '#0066cc');
    arrowDef(svg, 'dup-arr-red', '#c73a1f');
    arrowDef(svg, 'dup-arr-purple', '#7a3ea1');
    arrowDef(svg, 'dup-arr-green', '#0a7a3d');
    // Lifelines
    svgEl('line', { x1: 130, y1: 38, x2: 130, y2: 510, stroke: '#444', 'stroke-width': 1.5 }, svg);
    svgEl('line', { x1: W - 130, y1: 38, x2: W - 130, y2: 510, stroke: '#444', 'stroke-width': 1.5 }, svg);
    // Header labels
    svgEl('rect', { x: 80, y: 14, width: 100, height: 20, fill: '#e8efff', stroke: '#0066cc', rx: 3 }, svg);
    svgEl('text', { x: 130, y: 29, 'text-anchor': 'middle', 'font-weight': 600, 'font-size': 12, text: 'Odesílatel' }, svg);
    svgEl('rect', { x: W - 180, y: 14, width: 100, height: 20, fill: '#f0fff5', stroke: '#0a7a3d', rx: 3 }, svg);
    svgEl('text', { x: W - 130, y: 29, 'text-anchor': 'middle', 'font-weight': 600, 'font-size': 12, text: 'Příjemce' }, svg);
  }

  function drawEvent(e) {
    const svg = document.getElementById('dupack-svg');
    const x1 = e.from === 'c' ? 132 : W - 132;
    const x2 = e.from === 'c' ? (e.lost ? 380 : W - 132) : 132;
    const arrId = e.color === '#c73a1f' ? 'dup-arr-red'
                : e.color === '#7a3ea1' ? 'dup-arr-purple'
                : e.color === '#0a7a3d' ? 'dup-arr-green'
                : 'dup-arr';
    svgEl('line', {
      x1, y1: e.y + 8, x2, y2: e.y + 22,
      stroke: e.color, 'stroke-width': e.bold ? 3 : 1.8,
      'marker-end': e.lost ? '' : `url(#${arrId})`,
      'stroke-dasharray': e.lost ? '5 3' : '',
    }, svg);
    // Caption ABOVE the arrow, centered
    const captionX = e.lost ? 250 : (x1 + x2) / 2;
    svgEl('text', {
      x: captionX, y: e.y, 'text-anchor': 'middle',
      'font-size': 12, fill: e.color,
      'font-weight': e.bold ? 700 : 500, text: e.label,
    }, svg);
    if (e.lost) {
      svgEl('text', { x: 400, y: e.y + 28, 'font-size': 12, fill: '#c73a1f', 'font-weight': 700, text: '✗' }, svg);
    }
  }

  function play() {
    if (animTimer) clearInterval(animTimer);
    drawBase();
    let idx = 0;
    document.getElementById('dupack-info').innerHTML = '<span style="color:#7a3ea1">Animace běží…</span>';
    animTimer = setInterval(() => {
      if (idx >= EVENTS.length) {
        clearInterval(animTimer);
        animTimer = null;
        document.getElementById('dupack-info').innerHTML =
          '<strong>Hotovo.</strong> 3 dup-ACK na seq=200 spustily Fast Retransmit — bez čekání na timeout. TCP <em>nemá explicitní NACK</em>; tři duplicate ACK fungují jako implicitní signál „chybí mi seq=200".';
        return;
      }
      drawEvent(EVENTS[idx]);
      idx++;
    }, 550);
  }

  function reset() {
    if (animTimer) clearInterval(animTimer);
    animTimer = null;
    drawBase();
    document.getElementById('dupack-info').innerHTML =
      'Klikněte <strong>Přehrát animaci</strong> pro krokované zobrazení Fast Retransmit scénáře. Modré šipky = data (klient → server), zelené = ACK, fialové = dup-ACK, červená = ztráta a retransmit.';
  }

  document.getElementById('dupack-play').addEventListener('click', play);
  document.getElementById('dupack-reset').addEventListener('click', reset);
  reset(); // initial state shows lifelines + hint
}

// ------- RTT comparison -------
function initRTT() {
  function draw() {
    const svg = document.getElementById('rtt-svg');
    clearSvg(svg);
    const rtt = parseFloat(document.getElementById('rtt-input').value);
    const W = 700, H = 320;
    const protocols = [
      { name: 'TCP (cleartext)', rtts: 1, color: '#0066cc' },
      { name: 'TCP + TLS 1.2', rtts: 3, color: '#7a3ea1' },
      { name: 'TCP + TLS 1.3', rtts: 2, color: '#c73a1f' },
      { name: 'QUIC 1-RTT (poprvé)', rtts: 1, color: '#cc8f00' },
      { name: 'QUIC 0-RTT (opakovaně)', rtts: 0, color: '#0a7a3d' },
    ];
    const maxRtts = 3;
    const barH = 36;
    const xStart = 200;
    const xEnd = W - 40;
    const W_PER_RTT = (xEnd - xStart) / maxRtts;

    protocols.forEach((p, i) => {
      const y = 30 + i * (barH + 18);
      svgEl('text', { x: 190, y: y + barH / 2 + 4, 'text-anchor': 'end', 'font-weight': 600, 'font-size': 12, text: p.name }, svg);
      // Draw RTT segments
      for (let r = 0; r < p.rtts; r++) {
        svgEl('rect', { x: xStart + r * W_PER_RTT, y, width: W_PER_RTT - 6, height: barH, fill: p.color, opacity: 0.7 }, svg);
        svgEl('text', { x: xStart + r * W_PER_RTT + (W_PER_RTT - 6) / 2, y: y + barH / 2 + 4, 'text-anchor': 'middle', 'font-size': 11, fill: 'white', text: `RTT ${r + 1}` }, svg);
      }
      // Application data arrow
      svgEl('rect', { x: xStart + p.rtts * W_PER_RTT, y, width: 60, height: barH, fill: '#1a1a1a' }, svg);
      svgEl('text', { x: xStart + p.rtts * W_PER_RTT + 30, y: y + barH / 2 + 4, 'text-anchor': 'middle', 'font-size': 10, fill: 'white', text: '✉ data' }, svg);
      // Total time
      const total = p.rtts * rtt;
      svgEl('text', { x: xStart + p.rtts * W_PER_RTT + 80, y: y + barH / 2 + 4, 'font-size': 11, fill: '#444', text: `${total.toFixed(0)} ms` }, svg);
    });

    // Axis at top
    for (let r = 0; r <= maxRtts; r++) {
      svgEl('line', { x1: xStart + r * W_PER_RTT, y1: 20, x2: xStart + r * W_PER_RTT, y2: H - 30, stroke: '#ddd', 'stroke-dasharray': '2 2' }, svg);
      svgEl('text', { x: xStart + r * W_PER_RTT, y: 15, 'text-anchor': 'middle', 'font-size': 10, fill: '#888', text: `${r}× RTT` }, svg);
    }

    document.getElementById('rtt-info').innerHTML =
      `Pro RTT = ${rtt} ms: TCP+TLS 1.2 čeká <strong>${(3 * rtt).toFixed(0)} ms</strong> před prvním aplikačním bajtem. QUIC 0-RTT začne <strong>okamžitě</strong> (replay attack riziko — STK token má omezenou platnost).`;
  }
  document.getElementById('rtt-show').addEventListener('click', draw);
  document.getElementById('rtt-input').addEventListener('input', draw);
  draw();
}

// ------- SCTP 4-way handshake — step-by-step -------
function initSCTP() {
  const W = 720;
  const MSGS = [
    { y: 100, from: 'c', label: 'INIT (init tag, ASCONF)',                  color: '#1F4B8A', state: 'klient → server',          comment: 'Klient inicializuje. Server zatím NEVYTVÁŘÍ stav!' },
    { y: 165, from: 's', label: 'INIT_ACK + State Cookie (HMAC podepsaný)', color: '#D6553D', state: 'server: žádný stav',       comment: 'Server vrací podepsaný „cookie" obsahující kontext. Stále žádná paměť!' },
    { y: 235, from: 'c', label: 'COOKIE_ECHO (vrací cookie)',               color: '#1F7A4E', state: 'klient: posílá cookie zpět', comment: 'Klient prokazuje znalost cookie — proof-of-work pro server' },
    { y: 305, from: 's', label: 'COOKIE_ACK → server alokuje stav',         color: '#7a3ea1', state: 'server: ESTABLISHED',      comment: 'Cookie ověřeno (HMAC) → teď server vytvoří asociaci' },
    { y: 365, from: 'c', label: 'DATA →',                                   color: '#B86F00', state: 'data flow',                comment: 'Asociace připravena; multi-streaming, multi-homing' },
  ];
  let state = { idx: 0, auto: null };

  function reset() {
    if (state.auto) { clearInterval(state.auto); state.auto = null; }
    state.idx = 0;
    draw();
  }

  function step() {
    if (state.auto) { clearInterval(state.auto); state.auto = null; }
    if (state.idx >= MSGS.length) state.idx = 0;
    else state.idx++;
    draw();
  }

  function autoPlay() {
    if (state.auto) { clearInterval(state.auto); state.auto = null; }
    state.idx = 0;
    draw();
    state.auto = setInterval(() => {
      state.idx++;
      draw();
      if (state.idx >= MSGS.length) {
        clearInterval(state.auto);
        state.auto = null;
      }
    }, 900);
  }

  function draw() {
    const svg = document.getElementById('sctp-svg');
    clearSvg(svg);
    arrowDef(svg, 'sctp-arr-blue',  '#1F4B8A');
    arrowDef(svg, 'sctp-arr-red',   '#D6553D');
    arrowDef(svg, 'sctp-arr-green', '#1F7A4E');
    arrowDef(svg, 'sctp-arr-plum',  '#7a3ea1');
    arrowDef(svg, 'sctp-arr-ochre', '#B86F00');

    const total = MSGS.length;
    const cur = state.idx > 0 && state.idx <= total ? MSGS[state.idx - 1] : null;

    // Phase banner
    svgEl('rect', { x: 0, y: 0, width: W, height: 56, fill: '#F4F4F0' }, svg);
    svgEl('text', { x: 18, y: 22, 'font-size': 14, 'font-weight': 700, fill: '#0F1419', text: 'SCTP 4-way handshake (anti-SYN-flood)' }, svg);
    svgEl('text', {
      x: 18, y: 42, 'font-size': 12,
      fill: cur ? cur.color : '#525969', 'font-weight': 600,
      text: cur ? `◉ ${cur.state}` : '⏸ Klikni „Další krok"',
    }, svg);
    svgEl('text', { x: W - 18, y: 22, 'text-anchor': 'end', 'font-size': 12, fill: '#525969', text: `krok ${state.idx} / ${total}` }, svg);
    if (cur && cur.comment) {
      svgEl('text', { x: W - 18, y: 42, 'text-anchor': 'end', 'font-size': 11, fill: '#525969', 'font-style': 'italic', text: cur.comment }, svg);
    }

    // Lifelines
    svgEl('line', { x1: 130, y1: 64, x2: 130, y2: 405, stroke: '#0F1419', 'stroke-width': 1.5 }, svg);
    svgEl('line', { x1: W - 130, y1: 64, x2: W - 130, y2: 405, stroke: '#0F1419', 'stroke-width': 1.5 }, svg);
    svgEl('rect', { x: 75, y: 60, width: 110, height: 22, fill: '#E8EFFF', stroke: '#1F4B8A', rx: 3 }, svg);
    svgEl('text', { x: 130, y: 76, 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 11, fill: '#1F4B8A', text: 'Klient' }, svg);
    svgEl('rect', { x: W - 185, y: 60, width: 110, height: 22, fill: '#FFF0EC', stroke: '#D6553D', rx: 3 }, svg);
    // Server state label
    const serverEstablished = state.idx >= 4;
    svgEl('text', { x: W - 130, y: 76, 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 11, fill: serverEstablished ? '#1F7A4E' : '#D6553D', text: serverEstablished ? 'Server (ESTABLISHED)' : 'Server (no state!)' }, svg);

    // Messages
    for (let i = 0; i < state.idx && i < total; i++) {
      const m = MSGS[i];
      const isCurrent = i === state.idx - 1;
      const op = isCurrent ? 1.0 : 0.45;
      const x1 = m.from === 'c' ? 132 : W - 132;
      const x2 = m.from === 'c' ? W - 132 : 132;
      const arrId = m.color === '#1F4B8A' ? 'sctp-arr-blue'
                  : m.color === '#D6553D' ? 'sctp-arr-red'
                  : m.color === '#1F7A4E' ? 'sctp-arr-green'
                  : m.color === '#7a3ea1' ? 'sctp-arr-plum'
                  : 'sctp-arr-ochre';
      svgEl('line', {
        x1, y1: m.y + 8, x2, y2: m.y + 22,
        stroke: m.color, 'stroke-width': isCurrent ? 3 : 1.8,
        'marker-end': `url(#${arrId})`, opacity: op,
      }, svg);
      svgEl('text', {
        x: (x1 + x2) / 2, y: m.y, 'text-anchor': 'middle',
        'font-size': 12, fill: m.color, 'font-weight': isCurrent ? 700 : 500,
        opacity: op, text: m.label,
      }, svg);
    }

    // Highlight the "no state" zone after step 1 and 2
    if (state.idx >= 1 && state.idx < 4) {
      svgEl('rect', { x: W - 195, y: 90, width: 130, height: 130, fill: '#FFF0EC', stroke: '#D6553D', 'stroke-dasharray': '4 3', opacity: 0.4 }, svg);
      svgEl('text', { x: W - 130, y: 110, 'text-anchor': 'middle', 'font-size': 10, fill: '#D6553D', 'font-weight': 700, text: '⓪ Žádný stav' }, svg);
      svgEl('text', { x: W - 130, y: 124, 'text-anchor': 'middle', 'font-size': 10, fill: '#D6553D', text: 'odolnost vs SYN-flood' }, svg);
    }

    // Step button label
    const btn = document.getElementById('sctp-step');
    if (btn) btn.textContent = state.idx >= total ? '↺ Restart' : '▸ Další krok';
  }

  document.getElementById('sctp-step').addEventListener('click', step);
  document.getElementById('sctp-play').addEventListener('click', autoPlay);
  document.getElementById('sctp-reset').addEventListener('click', reset);
  reset();
}

// ------- MPTCP subflows -------
function initMPTCP() {
  function draw() {
    const svg = document.getElementById('mptcp-svg');
    clearSvg(svg);
    const paths = parseInt(document.getElementById('mptcp-paths').value, 10);
    const shared = document.getElementById('mptcp-shared').checked;
    const W = 700, H = 240;
    // Sender / receiver
    svgEl('rect', { x: 30, y: H / 2 - 30, width: 110, height: 60, fill: '#b8d4ff', stroke: '#0066cc', 'stroke-width': 2, rx: 6 }, svg);
    svgEl('text', { x: 85, y: H / 2 + 4, 'text-anchor': 'middle', 'font-weight': 600, text: 'Klient' }, svg);
    svgEl('rect', { x: W - 140, y: H / 2 - 30, width: 110, height: 60, fill: '#b8d4ff', stroke: '#0066cc', 'stroke-width': 2, rx: 6 }, svg);
    svgEl('text', { x: W - 85, y: H / 2 + 4, 'text-anchor': 'middle', 'font-weight': 600, text: 'Server' }, svg);

    // Bottleneck box if shared
    if (shared) {
      svgEl('rect', { x: W / 2 - 60, y: H / 2 - 80, width: 120, height: 160, fill: '#ffe9a3', stroke: '#cc8f00', 'stroke-width': 2, 'stroke-dasharray': '4 3' }, svg);
      svgEl('text', { x: W / 2, y: H / 2 - 60, 'text-anchor': 'middle', 'font-size': 11, fill: '#cc8f00', 'font-weight': 600, text: 'Shared bottleneck' }, svg);
    }

    // Subflows
    for (let i = 0; i < paths; i++) {
      const offset = (i - (paths - 1) / 2) * 30;
      const y = H / 2 + offset;
      const color = ['#0066cc', '#7a3ea1', '#cc8f00', '#0a7a3d'][i];
      svgEl('path', { d: `M 145 ${H / 2} Q ${W / 2} ${y - 10} ${W - 145} ${H / 2}`, fill: 'none', stroke: color, 'stroke-width': 2 }, svg);
      svgEl('text', { x: W / 2, y: y + 8, 'text-anchor': 'middle', 'font-size': 11, fill: color, 'font-weight': 600, text: `Subflow ${i + 1} (MP_${i === 0 ? 'CAPABLE' : 'JOIN'})` }, svg);
    }

    const total = shared ? 1 : paths;
    document.getElementById('mptcp-info').innerHTML =
      `<strong>${paths} subflow${paths > 1 ? 's' : ''}, ${shared ? 'SHARED' : 'DISJUNKTNÍ'} bottleneck.</strong><br>` +
      `Coupled AIMD: ${shared ? 'celkový throughput = 1× TCP (férové vůči TCP)' : `~${paths}× TCP throughput (pásmo se sčítá)`}. ` +
      `Dvě úrovně sekvenčních čísel: subflow seq (uvnitř každého) + Data Sequence Number (DSN) pro reordering napříč subflow.`;
  }
  document.getElementById('mptcp-go').addEventListener('click', draw);
  ['mptcp-paths', 'mptcp-shared'].forEach(id => document.getElementById(id).addEventListener('input', draw));
  draw();
}
