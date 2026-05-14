// Topic 7: Identifikace provozu a detekce anomálií
// Demos: LCS step-by-step, SPID byte frequency, KL divergence, JA3 builder, DPA.

import { svgEl, clearSvg, esc } from '../util.js';

export function initT7() {
  initLCS();
  initSPID();
  initKL();
  initJA3();
  initDPA();
  initPortLimits();
  initJA4();
  initThresholdTuner();
}

// ------- LCS iteration -------
function initLCS() {
  const FLOW_SAMPLES = [
    'HTTP/1.1 200 OK\nServer: LimeWire/4.18.8\nContent-type: image/jpeg',
    'HTTP/1.1 200 OK\nServer: MorpheusOS/2.1\nContent-type: video/mpeg',
    'HTTP/1.1 200 OK\nServer: LimeWire/5.0\nContent-type: audio/mp3',
    'HTTP/1.1 200 OK\nServer: BearShare/3.2\nContent-type: text/plain',
    'HTTP/1.1 200 OK\nServer: LimeWire/4.9\nContent-type: image/png',
  ];
  let flows = [];
  let candidate = null;

  function lcsString(a, b) {
    // Simple LCS for short strings — find longest common substrings, kept word-based
    const wa = a.split(/(\s+|\n)/);
    const wb = b.split(/(\s+|\n)/);
    const dp = Array.from({ length: wa.length + 1 }, () => Array(wb.length + 1).fill(0));
    const result = [];
    for (let i = 1; i <= wa.length; i++) {
      for (let j = 1; j <= wb.length; j++) {
        if (wa[i - 1] === wb[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    // Reconstruct
    const seq = [];
    let i = wa.length, j = wb.length;
    while (i > 0 && j > 0) {
      if (wa[i - 1] === wb[j - 1]) { seq.unshift(wa[i - 1]); i--; j--; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
      else j--;
    }
    return seq.join('');
  }

  function render() {
    document.getElementById('lcs-flows').innerHTML = flows.length === 0
      ? '<span style="color:var(--text-3)">Žádné toky. Klikněte „Přidej tok".</span>'
      : flows.map((f, i) => `<div style="margin-bottom:8px"><strong style="color:var(--info)">Flow ${i + 1}:</strong><br>${esc(f).replace(/\n/g, '<br>')}</div>`).join('');
    document.getElementById('lcs-candidate').innerHTML = candidate
      ? `<strong>Candidate signature (po ${flows.length - 1} iteracích):</strong><br><code style="padding:6px 10px;display:inline-block;margin-top:4px">${esc(candidate).replace(/\n/g, '<br>') || '∅ (žádný společný podřetězec)'}</code><br><span style="color:var(--text-3);font-size:12px;margin-top:4px;display:block">${flows.length >= 5 ? '✓ Signatura se ustálila — máte invariantní část protokolu.' : 'Přidejte další tok pro stabilizaci.'}</span>`
      : '';
  }

  function addFlow() {
    if (flows.length >= FLOW_SAMPLES.length) return;
    const f = FLOW_SAMPLES[flows.length];
    flows.push(f);
    if (flows.length === 1) {
      candidate = null;
    } else if (flows.length === 2) {
      candidate = lcsString(flows[0], flows[1]);
    } else {
      candidate = lcsString(candidate, f);
    }
    render();
  }

  document.getElementById('lcs-add').addEventListener('click', addFlow);
  document.getElementById('lcs-reset').addEventListener('click', () => { flows = []; candidate = null; render(); });
  render();
}

// ------- SPID byte frequency -------
function initSPID() {
  function analyze() {
    const text = document.getElementById('spid-input').value;
    const counts = new Array(256).fill(0);
    [...text].forEach(c => counts[c.charCodeAt(0)]++);
    const total = text.length || 1;
    const probs = counts.map(c => c / total);

    const svg = document.getElementById('spid-svg');
    clearSvg(svg);
    const W = 700, H = 220, pad = 40;
    // Axes
    svgEl('line', { x1: pad, y1: H - pad, x2: W - pad, y2: H - pad, stroke: 'var(--text-3)' }, svg);
    svgEl('line', { x1: pad, y1: 20, x2: pad, y2: H - pad, stroke: 'var(--text-3)' }, svg);
    // Bars for non-zero
    const maxP = Math.max(...probs);
    const barW = (W - 2 * pad) / 256;
    probs.forEach((p, i) => {
      if (p === 0) return;
      const x = pad + i * barW;
      const h = (H - pad - 20) * p / maxP;
      svgEl('rect', { x, y: H - pad - h, width: Math.max(1, barW - 0.5), height: h, fill: 'var(--info)', opacity: 0.7 }, svg);
      if (p > maxP * 0.2) {
        const ch = i >= 32 && i < 127 ? String.fromCharCode(i) : i;
        svgEl('text', { x: x + barW / 2, y: H - pad - h - 4, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-2)', text: `${ch}` }, svg);
      }
    });
    svgEl('text', { x: W / 2, y: H - 10, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-3)', text: 'ASCII kód (0-255)' }, svg);
    svgEl('text', { x: 10, y: H / 2, 'font-size': 11, fill: 'var(--text-3)', transform: `rotate(-90 10 ${H / 2})`, text: 'P(byte)' }, svg);

    // Show top 10
    const top = probs.map((p, i) => ({ i, p })).filter(x => x.p > 0).sort((a, b) => b.p - a.p).slice(0, 8);
    document.getElementById('spid-result').innerHTML =
      `<strong>Délka:</strong> ${text.length} bytů, ${top.length} unikátních. ` +
      `<strong>Top frekvence:</strong> ` +
      top.map(t => `<code>${t.i >= 32 && t.i < 127 ? `'${String.fromCharCode(t.i)}'` : t.i}=${t.p.toFixed(3)}</code>`).join(' ');
  }
  document.getElementById('spid-input').addEventListener('input', analyze);
  analyze();
}

// ------- KL divergence -------
function initKL() {
  const calc = () => {
    const P = document.getElementById('kl-p').value.split(',').map(x => parseFloat(x.trim()));
    const Q = document.getElementById('kl-q').value.split(',').map(x => parseFloat(x.trim()));
    if (P.length !== Q.length || P.some(isNaN) || Q.some(isNaN)) {
      document.getElementById('kl-result').innerHTML = '<span class="warn">Stejný počet hodnot v P i Q</span>';
      return;
    }
    const sumP = P.reduce((a, b) => a + b, 0);
    const sumQ = Q.reduce((a, b) => a + b, 0);
    const Pn = P.map(x => x / sumP);
    const Qn = Q.map(x => x / sumQ);
    let klPQ = 0, klQP = 0;
    Pn.forEach((p, i) => {
      const q = Qn[i];
      if (p > 0 && q > 0) klPQ += p * Math.log2(p / q);
      if (q > 0 && p > 0) klQP += q * Math.log2(q / p);
    });
    document.getElementById('kl-result').innerHTML =
      `<table style="font-family:monospace;font-size:13px">` +
      `<tr><td><strong>P (normalizováno)</strong></td><td>[${Pn.map(x => x.toFixed(3)).join(', ')}]</td></tr>` +
      `<tr><td><strong>Q (normalizováno)</strong></td><td>[${Qn.map(x => x.toFixed(3)).join(', ')}]</td></tr>` +
      `<tr><td><strong style="color:var(--info)">D<sub>KL</sub>(P‖Q)</strong></td><td><strong>${klPQ.toFixed(4)}</strong></td></tr>` +
      `<tr><td><strong style="color:var(--secondary)">D<sub>KL</sub>(Q‖P)</strong></td><td><strong>${klQP.toFixed(4)}</strong></td></tr>` +
      `</table>` +
      `<div style="margin-top:6px;font-size:12px;color:var(--text-3)">Není symetrická! D(P‖Q) ≠ D(Q‖P). SPID hledá protokol s nejmenší průměrnou KL přes atributy.</div>`;
  };
  ['kl-p', 'kl-q'].forEach(id => document.getElementById(id).addEventListener('input', calc));
  calc();
}

// ------- JA3 builder -------
function initJA3() {
  async function md5(str) {
    // Use SubtleCrypto with SHA-1 as a stand-in (MD5 not in browser standard);
    // For visualization we'll compute SHA-256 and truncate to 32 hex chars to mimic MD5 length.
    // Real JA3 uses MD5 but we cannot easily compute MD5 in browser without a lib.
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  document.getElementById('ja3-build').addEventListener('click', async () => {
    const ver = document.getElementById('ja3-ver').value;
    const cs = document.getElementById('ja3-cs').value;
    const ext = document.getElementById('ja3-ext').value;
    const g = document.getElementById('ja3-g').value;
    const ec = document.getElementById('ja3-ec').value;
    const ja3str = `${ver},${cs},${ext},${g},${ec}`;
    const hash = await md5(ja3str);
    document.getElementById('ja3-result').innerHTML =
      `<strong>JA3 řetězec:</strong><br><code style="font-size:13px;display:block;margin:6px 0;padding:6px 8px">${esc(ja3str)}</code>` +
      `<strong>Hash (truncovaná SHA-256 jako simulace MD5):</strong><br><code style="font-size:14px;color:var(--secondary);font-weight:600">${hash}</code><br>` +
      `<span style="font-size:12px;color:var(--text-3);margin-top:6px;display:block">⚠ V prohlížeči nelze přímo MD5; reálné JA3 je MD5 hash. GREASE hodnoty (0x?A?A pattern) by se odstranily před hashováním.</span>`;
  });
}

// ------- DPA (Deterministic Probabilistic Automaton) -------
function initDPA() {
  const SAMPLES = [
    ['A', 'B', 'C', 'D'],
    ['A', 'B', 'C', 'D'],
    ['A', 'B', 'E'],
    ['A', 'B', 'C', 'D'],
    ['A', 'B', 'E'],
  ];
  let added = 0;
  let states = null;

  function rebuild() {
    // Build PT first (each unique prefix is a state)
    states = [{ id: 0, label: 'q0', incoming: 0, outgoing: {} }];
    let totalSeqs = 0;
    for (let s = 0; s < added; s++) {
      const seq = SAMPLES[s];
      let curr = states[0];
      curr.incoming++;
      seq.forEach((sym) => {
        if (!curr.outgoing[sym]) {
          const newState = { id: states.length, label: `q${states.length}`, incoming: 0, outgoing: {}, parent: curr.id, sym };
          states.push(newState);
          curr.outgoing[sym] = { target: newState.id, count: 0 };
        }
        curr.outgoing[sym].count++;
        curr = states[curr.outgoing[sym].target];
        curr.incoming++;
      });
      totalSeqs++;
    }
    // Simple Alergia-like merge: merge states with same outgoing alphabet (after a fixed prefix)
    // For demo, we'll just merge final states with no outgoing
    const finals = states.filter(s => Object.keys(s.outgoing).length === 0 && s.id !== 0);
    if (finals.length > 1) {
      const target = finals[0];
      finals.slice(1).forEach(f => {
        // Re-point parents to target
        states.forEach(p => {
          for (const sym in p.outgoing) {
            if (p.outgoing[sym].target === f.id) p.outgoing[sym].target = target.id;
          }
        });
        target.incoming += f.incoming;
        f.merged = true;
      });
      states = states.filter(s => !s.merged);
    }
    draw();
  }

  function draw() {
    const svg = document.getElementById('dpa-svg');
    clearSvg(svg);
    if (!states || states.length <= 1) {
      svgEl('text', { x: 350, y: 120, 'text-anchor': 'middle', fill: 'var(--text-3)', text: 'Přidejte trénovací sekvence' }, svg);
      return;
    }

    // BFS layout by depth
    const depth = new Map();
    depth.set(0, 0);
    let queue = [0];
    while (queue.length) {
      const next = [];
      queue.forEach(id => {
        const s = states.find(x => x.id === id);
        Object.values(s.outgoing).forEach(o => {
          if (!depth.has(o.target)) {
            depth.set(o.target, depth.get(id) + 1);
            next.push(o.target);
          }
        });
      });
      queue = next;
    }
    const maxD = Math.max(...depth.values());
    const byDepth = {};
    depth.forEach((d, id) => { (byDepth[d] = byDepth[d] || []).push(id); });

    states.forEach(s => {
      const d = depth.get(s.id) ?? 0;
      const idx = byDepth[d].indexOf(s.id);
      const x = 60 + d * (600 / Math.max(maxD, 1));
      const y = 30 + (idx + 0.5) * (180 / byDepth[d].length);
      s.x = x; s.y = y;
    });

    // Edges
    states.forEach(s => {
      Object.entries(s.outgoing).forEach(([sym, o]) => {
        const t = states.find(x => x.id === o.target);
        if (!t) return;
        const prob = o.count / (s.incoming || 1);
        svgEl('line', { x1: s.x + 14, y1: s.y, x2: t.x - 14, y2: t.y, stroke: 'var(--info)', 'stroke-width': 1 + prob * 3 }, svg);
        const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
        svgEl('text', { x: mx, y: my - 6, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--secondary)', text: `${sym} (${prob.toFixed(2)})` }, svg);
      });
    });
    // Nodes
    states.forEach(s => {
      const isStart = s.id === 0;
      svgEl('circle', { cx: s.x, cy: s.y, r: 14, fill: isStart ? 'var(--info)' : 'var(--node-fill)', stroke: 'var(--info)', 'stroke-width': 2 }, svg);
      svgEl('text', { x: s.x, y: s.y + 4, 'text-anchor': 'middle', 'font-size': 10, fill: isStart ? 'white' : 'var(--text-2)', text: s.label }, svg);
    });
  }

  function test() {
    const inp = document.getElementById('dpa-test').value.split(',').map(x => x.trim().toUpperCase());
    let curr = states[0];
    let prob = 1;
    let traceLog = [];
    for (const sym of inp) {
      if (!curr.outgoing[sym]) {
        document.getElementById('dpa-result').innerHTML = `<strong class="warn">✗ ANOMÁLIE</strong>: symbol „${sym}" není možný v stavu ${curr.label}. Tato konverzace není v modelu — pravděpodobnost = 0.<br>Trace: ${traceLog.join(' → ')}`;
        return;
      }
      const o = curr.outgoing[sym];
      const p = o.count / (curr.incoming || 1);
      prob *= p;
      traceLog.push(`${curr.label} --${sym}(${p.toFixed(2)})--> ${states.find(s => s.id === o.target).label}`);
      curr = states.find(s => s.id === o.target);
    }
    document.getElementById('dpa-result').innerHTML =
      `<strong style="color:var(--success)">✓ NORMÁLNÍ</strong>: P(${inp.join(',')}) = <strong>${prob.toFixed(4)}</strong><br><span style="font-size:12px;color:var(--text-3)">${traceLog.join(' → ')}</span>`;
  }

  document.getElementById('dpa-add').addEventListener('click', () => {
    if (added < SAMPLES.length) { added++; rebuild(); }
  });
  document.getElementById('dpa-reset').addEventListener('click', () => { added = 0; states = null; draw(); });
  document.getElementById('dpa-check').addEventListener('click', test);
  rebuild();
}

// ------- Port-based limits -------
function initPortLimits() {
  const PORT_USES = {
    443: [
      'Legitimní HTTPS (web)',
      'HTTP/3 (QUIC) — modernější',
      'Microsoft Teams, Zoom (real-time)',
      'WebRTC (peer-to-peer video)',
      'Malware C2 (Cobalt Strike, IcedID, Sliver)',
      'DoH (DNS over HTTPS) — RFC 8484',
      'TCP-over-TLS tunnel (obejití firewallů)',
      'VPN přes TLS (OpenVPN+TLS, SSLVPN)',
      'Data exfiltrace přes HTTPS POST',
    ],
    53: ['DNS dotazy (UDP)', 'DNS odpovědi (TCP pro velké odpovědi)', 'DNS exfiltrace (tunelování v TXT records)', 'AXFR zone transfers'],
    80: ['HTTP (cleartext)', 'WebSocket nad HTTP (CONNECT)', 'Tor pluggable transports', 'Tunelované P2P (BitTorrent over HTTP)'],
    22: ['SSH', 'SFTP', 'SCP', 'SSH tunelování (-L, -R, -D SOCKS)', 'rsync přes SSH'],
    25: ['SMTP', 'Spam SMTP relay'],
    8080: ['HTTP proxy', 'Alternativní web', 'Webové admin rozhraní'],
  };
  function go() {
    const p = parseInt(document.getElementById('port-input').value, 10);
    const uses = PORT_USES[p] || ['Neregistrovaný port — může být cokoli'];
    document.getElementById('port-out').innerHTML =
      `<strong>Port ${p}</strong>: <em>${p === 443 ? 'HTTPS (oficiálně)' : p === 53 ? 'DNS' : p === 80 ? 'HTTP' : p === 22 ? 'SSH' : p === 25 ? 'SMTP' : 'různé'}</em><br>` +
      `<strong>Co se na něm reálně může objevit:</strong>` +
      `<ul style="margin-top:6px">${uses.map(u => `<li>${esc(u)}</li>`).join('')}</ul>` +
      `<span style="font-size:12px;color:var(--text-3)">Důsledek: <strong>port sám o sobě nic neznamená</strong>. Potřebujeme signaturu, statistiku, nebo TLS otisk.</span>`;
  }
  document.getElementById('port-input').addEventListener('input', go);
  go();
}

// ------- JA4 builder -------
function initJA4() {
  async function sha256trunc(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  async function build() {
    const tx = document.getElementById('ja4-tx').value;
    const ver = document.getElementById('ja4-ver').value;
    const sni = document.getElementById('ja4-sni').value;
    const cn = String(parseInt(document.getElementById('ja4-cn').value, 10)).padStart(2, '0');
    const en = String(parseInt(document.getElementById('ja4-en').value, 10)).padStart(2, '0');
    const alpn = document.getElementById('ja4-alpn').value.substring(0, 2).padEnd(2, '0');
    const a = `${tx}${ver}${sni}${cn}${en}${alpn}`;
    // Cipher list (mock)
    const ciphers = '49195,49196,52393,49199,49200,52392,158,159';
    const exts = '0,11,10,35,13,15,16,11,10,22';
    const b = await sha256trunc(ciphers);
    const c = await sha256trunc(exts);
    const ja4 = `${a}_${b}_${c}`;
    document.getElementById('ja4-out').innerHTML =
      `<table style="font-family:monospace;font-size:13px">` +
      `<tr><td><strong>JA4_a</strong> (meta)</td><td>${a}</td><td>${tx === 't' ? 'TCP' : 'QUIC'}, TLS ${ver === '13' ? '1.3' : '1.2'}, SNI ${sni}, ${parseInt(cn, 10)} ciphers, ${parseInt(en, 10)} exts, ALPN ${alpn}</td></tr>` +
      `<tr><td><strong>JA4_b</strong> (ciphers)</td><td>${b}</td><td>truncated SHA-256 sorted cipher suites</td></tr>` +
      `<tr><td><strong>JA4_c</strong> (exts)</td><td>${c}</td><td>truncated SHA-256 sorted extensions</td></tr>` +
      `<tr style="border-top:2px solid #0066cc"><td><strong style="color:var(--info)">JA4</strong></td><td colspan="2" style="font-weight:700;color:var(--secondary)">${ja4}</td></tr></table>` +
      `<div style="margin-top:8px;font-size:12px;color:var(--text-3)">Známé Chrome: <code>t13d1518h2_8daaf6152771_e5627efa2ab1</code>. Detekuje malware: IcedID, Sliver, Cobalt Strike, reverse SSH shells.</div>`;
  }
  ['ja4-tx','ja4-ver','ja4-sni','ja4-cn','ja4-en','ja4-alpn'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', build);
    el.addEventListener('change', build);  // selects fire 'change'
  });
  build();
}

// ------- Anomaly threshold tuner -------
function initThresholdTuner() {
  // Mock data: normal traffic scores 0-40, anomalies score 50-100
  const samples = [];
  for (let i = 0; i < 80; i++) samples.push({ score: 10 + Math.random() * 30, isAnomaly: false });
  for (let i = 0; i < 20; i++) samples.push({ score: 50 + Math.random() * 45, isAnomaly: true });

  function draw() {
    const thresh = parseInt(document.getElementById('ads-thresh').value, 10);
    document.getElementById('ads-thresh-val').textContent = thresh;
    const svg = document.getElementById('ads-svg');
    clearSvg(svg);
    const W = 700, H = 280, pad = 50;
    svgEl('line', { x1: pad, y1: H - pad, x2: W - pad, y2: H - pad, stroke: 'var(--text-3)' }, svg);
    svgEl('text', { x: W / 2, y: H - 10, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--text-3)', text: 'Anomaly score' }, svg);
    // Threshold line
    const tx = pad + (W - 2 * pad) * (thresh / 100);
    svgEl('line', { x1: tx, y1: 30, x2: tx, y2: H - pad, stroke: 'var(--danger)', 'stroke-width': 2, 'stroke-dasharray': '4 3' }, svg);
    svgEl('text', { x: tx, y: 22, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--danger)', 'font-weight': 600, text: `Práh = ${thresh}` }, svg);

    // Score buckets
    const buckets = new Array(100).fill(0);
    const aBuckets = new Array(100).fill(0);
    samples.forEach(s => {
      const i = Math.floor(s.score);
      if (s.isAnomaly) aBuckets[i]++;
      else buckets[i]++;
    });
    const maxC = Math.max(...buckets, ...aBuckets);
    for (let i = 0; i < 100; i++) {
      const x = pad + (W - 2 * pad) * (i / 99);
      const norm = buckets[i];
      const anom = aBuckets[i];
      if (norm > 0) svgEl('rect', { x, y: H - pad - (H - pad - 30) * (norm / maxC), width: 4, height: (H - pad - 30) * (norm / maxC), fill: 'var(--success)', opacity: 0.7 }, svg);
      if (anom > 0) svgEl('rect', { x: x + 4, y: H - pad - (H - pad - 30) * (anom / maxC), width: 4, height: (H - pad - 30) * (anom / maxC), fill: 'var(--danger)', opacity: 0.7 }, svg);
    }
    svgEl('rect', { x: W - 110, y: 35, width: 14, height: 10, fill: 'var(--success)', opacity: 0.7 }, svg);
    svgEl('text', { x: W - 92, y: 45, 'font-size': 11, text: 'normal' }, svg);
    svgEl('rect', { x: W - 110, y: 50, width: 14, height: 10, fill: 'var(--danger)', opacity: 0.7 }, svg);
    svgEl('text', { x: W - 92, y: 60, 'font-size': 11, text: 'anomaly' }, svg);

    // Compute confusion matrix
    const TP = samples.filter(s => s.isAnomaly && s.score >= thresh).length;
    const FN = samples.filter(s => s.isAnomaly && s.score < thresh).length;
    const FP = samples.filter(s => !s.isAnomaly && s.score >= thresh).length;
    const TN = samples.filter(s => !s.isAnomaly && s.score < thresh).length;
    const total = samples.length;
    const fpRate = FP / (FP + TN) * 100;
    const fnRate = FN / (FN + TP) * 100;
    let comment = '';
    if (fpRate > 10) comment = '<span style="color:var(--danger)">⚠ FP rate &gt; 10 % — operátor začne alarmy ignorovat (alarm fatigue).</span>';
    else if (fnRate > 20) comment = '<span style="color:var(--danger)">⚠ FN rate &gt; 20 % — útoky procházejí nezachycené.</span>';
    else comment = '<span style="color:var(--success)">✓ Rozumný kompromis FP/FN.</span>';

    document.getElementById('ads-info').innerHTML =
      `Confusion matrix (n=${total}): TP=${TP}, FN=${FN}, FP=${FP}, TN=${TN}<br>` +
      `<strong>False positive rate: ${fpRate.toFixed(1)} %</strong>, <strong>False negative rate: ${fnRate.toFixed(1)} %</strong><br>` +
      comment;
  }
  document.getElementById('ads-thresh').addEventListener('input', draw);
  draw();
}
