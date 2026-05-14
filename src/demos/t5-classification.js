// Topic 5: Klasifikace paketů
// Demos: ACL shadow, multibit trie, HiCuts 2D, Lucent Bit Vector, TCAM lookup.

import { svgEl, clearSvg, arrowDef, esc, ipMatch, parseIp } from '../util.js';

export function initT5() {
  initACL();
  initTrie();
  initHiCuts();
  initBitVector();
  initTCAM();
  initExpand();
  initCrossProd();
  initGeometric();
}

// ------- ACL shadow detection -------
function initACL() {
  document.getElementById('acl-check').addEventListener('click', () => {
    // Pravidlo 4 (deny ICMP 147.229.1.15) je zastíněno pravidlem 3 (permit ICMP 147.229.0.0/16)
    document.getElementById('acl1').textContent = 'NE';
    document.getElementById('acl2').textContent = 'NE';
    document.getElementById('acl3').textContent = 'NE';
    document.getElementById('acl4').textContent = '✗ ZASTÍNĚNO pravidlem 30';
    document.getElementById('acl5').textContent = 'NE';
    document.getElementById('acl4').style.color = 'var(--danger)';
    document.getElementById('acl4').style.fontWeight = '600';
    document.getElementById('acl-result').innerHTML =
      `<strong style="color:var(--danger)">Pravidlo 40 nikdy nezafunguje.</strong> ICMP ze 147.229.1.15 je <em>nejprve</em> povolen pravidlem 30 (permit ICMP 147.229.0.0/16, do kterého 147.229.1.15 patří). ACL aplikuje <strong>první vhodné</strong> pravidlo — k pravidlu 40 paket vůbec nedojde.<br><br><span style="color:var(--text-3);font-size:12px">Řešení: přesunout pravidlo 40 PŘED pravidlo 30, nebo z pravidla 30 vyloučit specifický host.</span>`;
  });
}

// ------- Multibit trie builder -------
function initTrie() {
  function build() {
    const mode = document.getElementById('trie-mode').value;
    const stride = mode === 'binary' ? 1 : parseInt(mode.replace('stride', ''), 10);
    const prefixes = document.getElementById('trie-prefixes').value
      .split(',')
      .map(p => p.trim().replace('*', ''))
      .filter(Boolean);

    // Prefix expansion to multiple of stride
    const expanded = [];
    prefixes.forEach(orig => {
      const len = orig.length;
      const padded = Math.ceil(len / stride) * stride;
      if (len === padded) {
        expanded.push({ key: orig, orig, depth: padded / stride });
      } else {
        const extra = padded - len;
        const count = 1 << extra;
        for (let i = 0; i < count; i++) {
          expanded.push({ key: orig + i.toString(2).padStart(extra, '0'), orig, depth: padded / stride });
        }
      }
    });

    // Build trie levels
    const svg = document.getElementById('trie-svg');
    clearSvg(svg);
    const W = 700, H = 360;
    const branchN = 1 << stride;
    const nodes = []; // { x, y, depth, label, rule, parent, slot }

    // Group expanded prefixes by depth
    const root = { x: W / 2, y: 40, depth: 0, label: 'root' };
    nodes.push(root);

    // Simple layout: place children
    function layout(parent, prefix, depth) {
      if (depth > 4) return;
      // Find expanded prefixes that go through this node at this depth
      const childrenAtLevel = {};
      expanded.forEach(e => {
        const len = depth * stride;
        if (e.key.length >= len + stride && e.key.startsWith(prefix)) {
          const slot = parseInt(e.key.substring(len, len + stride), 2);
          if (!childrenAtLevel[slot]) childrenAtLevel[slot] = [];
          childrenAtLevel[slot].push(e);
        }
      });
      const slots = Object.keys(childrenAtLevel).map(Number).sort((a, b) => a - b);
      if (slots.length === 0) return;
      const totalW = (W - 60);
      const childW = totalW / Math.max(slots.length, 1);
      slots.forEach((slot, i) => {
        const cx = 30 + childW / 2 + i * childW;
        const cy = parent.y + 70;
        // Check if this is a leaf (exact match) or has further children
        const exactMatches = childrenAtLevel[slot].filter(e => e.key.length === (depth + 1) * stride);
        const rule = exactMatches.length > 0 ? exactMatches[0].orig : null;
        const node = { x: cx, y: cy, depth: depth + 1, label: slot.toString(2).padStart(stride, '0'), rule, parent };
        nodes.push(node);
        // Draw later
        layout(node, prefix + slot.toString(2).padStart(stride, '0'), depth + 1);
      });
    }
    layout(root, '', 0);

    // Draw edges then nodes
    nodes.forEach(n => {
      if (n.parent) {
        svgEl('line', { x1: n.parent.x, y1: n.parent.y + 18, x2: n.x, y2: n.y - 14, stroke: 'var(--text-3)', 'stroke-width': 1.5 }, svg);
      }
    });
    nodes.forEach(n => {
      const hasRule = !!n.rule;
      svgEl('circle', { cx: n.x, cy: n.y, r: 18, fill: hasRule ? 'var(--info-bg)' : 'var(--node-fill)', stroke: hasRule ? 'var(--info)' : 'var(--text-3)', 'stroke-width': hasRule ? 2 : 1.5 }, svg);
      svgEl('text', { x: n.x, y: n.y + 4, 'text-anchor': 'middle', 'font-size': 10, 'font-family': 'monospace', text: n.label || '·' }, svg);
      if (hasRule) {
        svgEl('text', { x: n.x, y: n.y + 32, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--info)', text: n.rule + '*' }, svg);
      }
    });

    document.getElementById('trie-result').innerHTML =
      `<strong>Trie postaven se stride ${stride}</strong>. Maximální hloubka ${Math.ceil(Math.max(...expanded.map(e => e.depth)))} úrovní. ` +
      `Počet uzlů ${nodes.length}. Při stride ${stride}: každý uzel má ${branchN} potomků (pole velikosti ${branchN}).<br>` +
      `<span style="color:var(--text-3);font-size:12px">Pro IPv4 by stride 8 = 256-way mtrie, jen 4 úrovně. To je přesně CEF z kapitoly 4.</span>`;
  }

  function lookup() {
    const key = document.getElementById('trie-key').value.trim();
    const mode = document.getElementById('trie-mode').value;
    const stride = mode === 'binary' ? 1 : parseInt(mode.replace('stride', ''), 10);
    const prefixes = document.getElementById('trie-prefixes').value
      .split(',').map(p => p.trim().replace('*', '')).filter(Boolean);
    // Find longest matching prefix
    let best = null;
    prefixes.forEach(p => {
      if (key.startsWith(p) && (!best || p.length > best.length)) best = p;
    });
    document.getElementById('trie-result').innerHTML += best
      ? `<br><br><strong style="color:var(--success)">LPM pro „${key}": prefix ${best}*</strong>`
      : `<br><br><span class="warn">Žádný prefix se neshoduje s ${key}</span>`;
  }
  const rebuild = () => { build(); lookup(); };
  ['trie-prefixes', 'trie-key', 'trie-mode'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', rebuild);
    el.addEventListener('change', rebuild);
  });
  rebuild();
}

// ------- HiCuts 2D -------
function initHiCuts() {
  const SPACE = 280;        // logical coord space (rules + recursion)
  const OFFSET = 20;        // SVG draw offset
  let rules = [];

  function genRules() {
    rules = [];
    const n = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const x1 = Math.floor(Math.random() * (SPACE - 60));
      const y1 = Math.floor(Math.random() * (SPACE - 60));
      const w = 40 + Math.floor(Math.random() * 100);
      const h = 40 + Math.floor(Math.random() * 100);
      rules.push({
        id: 'R' + (i + 1),
        x1, y1,
        x2: Math.min(SPACE, x1 + w),
        y2: Math.min(SPACE, y1 + h),
        color: `hsl(${(i * 67) % 360}, 60%, 55%)`,
      });
    }
    build();
  }

  function build() {
    const binth = parseInt(document.getElementById('hicuts-binth').value, 10);
    const spfac = parseInt(document.getElementById('hicuts-spfac').value, 10);

    const svg = document.getElementById('hicuts-geo');
    clearSvg(svg);
    // Outer space box (SVG coords)
    svgEl('rect', { x: OFFSET, y: OFFSET, width: SPACE, height: SPACE, fill: 'var(--surface)', stroke: 'var(--node-stroke)', 'stroke-width': 1.5 }, svg);
    // Axes labels
    svgEl('text', { x: OFFSET + SPACE / 2, y: OFFSET + SPACE + 16, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-2)', text: 'F1 →' }, svg);
    svgEl('text', { x: OFFSET - 8, y: OFFSET + SPACE / 2, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--text-2)', transform: `rotate(-90 ${OFFSET - 8} ${OFFSET + SPACE / 2})`, text: 'F2 →' }, svg);

    // Recursive cuts — all in LOGICAL (0..SPACE) coordinates
    const cutLines = [];
    function recurse(x1, y1, x2, y2, rulesInRegion, depth, treeNode) {
      if (rulesInRegion.length <= binth || depth >= 4) {
        treeNode.leaf = true;
        treeNode.rules = rulesInRegion.map(r => r.id);
        treeNode.bounds = { x1, y1, x2, y2 };
        return;
      }
      // HiCuts: pick the dimension whose cut yields the smallest worst-case child bucket
      // (cost function from Gupta-McKeown 1999). Tie → smaller average bucket.
      function simulate(axis) {
        const lo = axis === 'F1' ? x1 : y1;
        const hi = axis === 'F1' ? x2 : y2;
        const step = (hi - lo) / spfac;
        let max = 0, sum = 0;
        for (let i = 0; i < spfac; i++) {
          const s1 = lo + i * step, s2 = lo + (i + 1) * step;
          const subset = axis === 'F1'
            ? rulesInRegion.filter(r => !(r.x2 <= s1 || r.x1 >= s2))
            : rulesInRegion.filter(r => !(r.y2 <= s1 || r.y1 >= s2));
          if (subset.length > max) max = subset.length;
          sum += subset.length;
        }
        return { max, sum };
      }
      const sX = simulate('F1'), sY = simulate('F2');
      let dim;
      if (sX.max !== sY.max) dim = sX.max < sY.max ? 'F1' : 'F2';
      else if (sX.sum !== sY.sum) dim = sX.sum < sY.sum ? 'F1' : 'F2';
      else dim = (depth % 2 === 0) ? 'F1' : 'F2';
      treeNode.dim = dim;
      treeNode.cuts = spfac;
      treeNode.bounds = { x1, y1, x2, y2 };
      treeNode.children = [];
      if (dim === 'F1') {
        const step = (x2 - x1) / spfac;
        for (let i = 0; i < spfac; i++) {
          const sx1 = x1 + i * step, sx2 = x1 + (i + 1) * step;
          const subset = rulesInRegion.filter(r => !(r.x2 <= sx1 || r.x1 >= sx2));
          if (i > 0) cutLines.push({ type: 'v', x: sx1, y1, y2, depth });
          const child = { rangeLabel: `${Math.round(sx1)}–${Math.round(sx2)}` };
          treeNode.children.push(child);
          recurse(sx1, y1, sx2, y2, subset, depth + 1, child);
        }
      } else {
        const step = (y2 - y1) / spfac;
        for (let i = 0; i < spfac; i++) {
          const sy1 = y1 + i * step, sy2 = y1 + (i + 1) * step;
          const subset = rulesInRegion.filter(r => !(r.y2 <= sy1 || r.y1 >= sy2));
          if (i > 0) cutLines.push({ type: 'h', y: sy1, x1, x2, depth });
          const child = { rangeLabel: `${Math.round(sy1)}–${Math.round(sy2)}` };
          treeNode.children.push(child);
          recurse(x1, sy1, x2, sy2, subset, depth + 1, child);
        }
      }
    }
    const root = {};
    recurse(0, 0, SPACE, SPACE, rules, 0, root);

    // Draw rules (apply OFFSET when going to SVG coords)
    rules.forEach(r => {
      svgEl('rect', {
        x: OFFSET + r.x1, y: OFFSET + r.y1,
        width: r.x2 - r.x1, height: r.y2 - r.y1,
        fill: r.color, opacity: 0.35,
        stroke: r.color, 'stroke-width': 1.5,
      }, svg);
      svgEl('text', { x: OFFSET + r.x1 + 6, y: OFFSET + r.y1 + 14, 'font-size': 11, 'font-weight': 600, fill: 'var(--text)', text: r.id }, svg);
    });

    // Draw cut lines on top
    cutLines.forEach(c => {
      const alpha = Math.max(0.5, 1 - c.depth * 0.18);
      const strokeW = Math.max(1, 2.5 - c.depth * 0.5);
      if (c.type === 'v') {
        svgEl('line', {
          x1: OFFSET + c.x, y1: OFFSET + c.y1,
          x2: OFFSET + c.x, y2: OFFSET + c.y2,
          stroke: 'var(--accent)', 'stroke-width': strokeW, opacity: alpha,
        }, svg);
      } else {
        svgEl('line', {
          x1: OFFSET + c.x1, y1: OFFSET + c.y,
          x2: OFFSET + c.x2, y2: OFFSET + c.y,
          stroke: 'var(--accent)', 'stroke-width': strokeW, opacity: alpha,
        }, svg);
      }
    });

    // Decision tree (right SVG)
    const treeSvg = document.getElementById('hicuts-tree');
    clearSvg(treeSvg);

    // First, compute layout: get tree depth and assign x positions to leaves
    function getLeafCount(n) {
      if (n.leaf) return 1;
      return (n.children || []).reduce((sum, c) => sum + getLeafCount(c), 0);
    }
    function getDepth(n) {
      if (n.leaf) return 1;
      return 1 + Math.max(...(n.children || []).map(getDepth));
    }
    const totalLeaves = Math.max(1, getLeafCount(root));
    const totalDepth  = Math.max(1, getDepth(root));
    const treeW = 380, treeH = 320;
    const yStep = Math.min(60, (treeH - 40) / totalDepth);

    let leafCursor = 0;
    function layout(node, depth) {
      if (node.leaf) {
        node._x = 20 + ((leafCursor + 0.5) / totalLeaves) * (treeW - 40);
        node._y = 30 + depth * yStep;
        leafCursor++;
      } else {
        node.children.forEach(c => layout(c, depth + 1));
        // x position = average of children
        const xs = node.children.map(c => c._x);
        node._x = xs.reduce((a, b) => a + b, 0) / xs.length;
        node._y = 30 + depth * yStep;
      }
    }
    layout(root, 0);

    function drawTreeNode(node) {
      // Edges to children first
      if (node.children) {
        node.children.forEach(c => {
          svgEl('line', { x1: node._x, y1: node._y + 12, x2: c._x, y2: c._y - 12, stroke: 'var(--border-2)', 'stroke-width': 1 }, treeSvg);
          // Range label on edge
          const mx = (node._x + c._x) / 2;
          const my = (node._y + c._y) / 2;
          svgEl('text', { x: mx + 4, y: my, 'font-size': 9, fill: 'var(--text-2)', 'font-family': 'monospace', text: c.rangeLabel || '' }, treeSvg);
          drawTreeNode(c);
        });
      }
      // Node itself
      const fill = node.leaf ? 'var(--success-bg)' : 'var(--accent-bg)';
      const stroke = node.leaf ? 'var(--success)' : 'var(--accent)';
      const r = node.leaf ? 16 : 14;
      svgEl('circle', { cx: node._x, cy: node._y, r, fill, stroke, 'stroke-width': 1.5 }, treeSvg);
      if (node.leaf) {
        const txt = (node.rules || []).length === 0 ? '∅' : (node.rules || []).join(',');
        svgEl('text', { x: node._x, y: node._y + 4, 'text-anchor': 'middle', 'font-size': 9, 'font-family': 'monospace', 'font-weight': 600, fill: 'var(--node-stroke)', text: txt }, treeSvg);
      } else {
        svgEl('text', { x: node._x, y: node._y + 4, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: 'var(--accent)', text: node.dim || '?' }, treeSvg);
      }
    }
    drawTreeNode(root);

    // Tree title
    svgEl('text', { x: treeW / 2, y: 14, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, fill: 'var(--node-stroke)', text: `Rozhodovací strom · binth=${binth} spfac=${spfac}` }, treeSvg);

    // Legend below tree
    svgEl('circle', { cx: 28, cy: treeH - 14, r: 7, fill: 'var(--accent-bg)', stroke: 'var(--accent)' }, treeSvg);
    svgEl('text', { x: 40, y: treeH - 10, 'font-size': 10, fill: 'var(--node-stroke)', text: 'vnitřní (řez)' }, treeSvg);
    svgEl('circle', { cx: 140, cy: treeH - 14, r: 8, fill: 'var(--success-bg)', stroke: 'var(--success)' }, treeSvg);
    svgEl('text', { x: 154, y: treeH - 10, 'font-size': 10, fill: 'var(--node-stroke)', text: 'list (≤ binth pravidel)' }, treeSvg);
  }

  document.getElementById('hicuts-build').addEventListener('click', build);
  document.getElementById('hicuts-newrules').addEventListener('click', genRules);
  ['hicuts-binth', 'hicuts-spfac'].forEach(id => document.getElementById(id).addEventListener('input', build));
  genRules();
}

// ------- Lucent Bit Vector classifier -------
function initBitVector() {
  const RULES = [
    { dst: '147.229.*.*', src: '*', dport: 25, sport: '*', proto: '*' },
    { dst: '147.229.*.*', src: '*', dport: 53, sport: '*', proto: 'UDP' },
    { dst: '147.229.*.*', src: '*', dport: 22, sport: '*', proto: 'TCP' },
    { dst: '147.229.5.1', src: '153.13.2.5', dport: 123, sport: 123, proto: 'UDP' },
    { dst: '*', src: '117.16.*.*', dport: '*', sport: '*', proto: 'IP' },
    { dst: '*', src: '*', dport: '*', sport: '*', proto: '*' },
  ];

  function match(field, ruleVal, headerVal) {
    if (ruleVal === '*') return true;
    if (field.includes('IP')) {
      return ipMatch(ruleVal, headerVal);
    }
    if (ruleVal === 'IP') return true; // IP encompasses all
    return String(ruleVal) === String(headerVal);
  }

  // Build & render the compiled per-dimension lookup tables that the
  // Lucent Bit Vector classifier would precompute. For each unique rule
  // value V in a dimension, compute the bit vector indicating which rules
  // could possibly match V.
  function buildCompiledTables() {
    const dims = [
      { name: 'Dst IP',  key: 'dst',   matchField: 'dstIP'  },
      { name: 'Src IP',  key: 'src',   matchField: 'srcIP'  },
      { name: 'Dst port', key: 'dport', matchField: 'dport'  },
      { name: 'Src port', key: 'sport', matchField: 'sport'  },
      { name: 'Proto',   key: 'proto', matchField: 'proto'  },
    ];
    let html = '<div style="font-family:var(--mono);font-size:10px;color:var(--accent);text-transform:uppercase;letter-spacing:0.14em;margin-bottom:6px;font-weight:600">Compiled lookup tables (per dimension)</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px">';
    dims.forEach(d => {
      // Unique rule values for this dimension
      const seen = new Set();
      const values = [];
      RULES.forEach(r => {
        const v = String(r[d.key]);
        if (!seen.has(v)) { seen.add(v); values.push(v); }
      });
      // Sort: most specific first, wildcards last
      values.sort((a, b) => {
        if (a === '*' && b !== '*') return 1;
        if (b === '*' && a !== '*') return -1;
        return b.length - a.length;
      });

      html += '<div style="border:1px solid var(--border);background:var(--surface);padding:8px 10px;border-radius:6px">';
      html += `<div style="font-weight:600;font-size:12px;color:var(--text);margin-bottom:6px">${d.name}</div>`;
      html += '<table style="font-size:11px;width:100%;border:none;margin:0;background:transparent">';
      html += '<thead><tr><th style="padding:2px 6px;border:none">value</th><th style="padding:2px 6px;border:none">vec R1…R6</th></tr></thead><tbody>';
      values.forEach(v => {
        const vec = RULES.map(r => match(d.matchField, String(r[d.key]), v) ? '1' : '0').join('');
        html += `<tr><td class="mono" style="padding:2px 6px;border:none;border-top:1px dotted var(--border)">${esc(v)}</td><td class="mono" style="padding:2px 6px;border:none;border-top:1px dotted var(--border);color:var(--accent);font-weight:600">${vec}</td></tr>`;
      });
      html += '</tbody></table>';
      html += '<div style="font-size:10px;color:var(--text-3);margin-top:6px;font-style:italic">LPM lookup vrátí vektor pro nejdelší vyhovující řádek</div>';
      html += '</div>';
    });
    html += '</div>';
    document.getElementById('bv-compiled-tables').innerHTML = html;
  }

  function classify() {
    const dst = document.getElementById('bv-dst').value.trim();
    const src = document.getElementById('bv-src').value.trim();
    const dport = parseInt(document.getElementById('bv-dport').value, 10);
    const sport = parseInt(document.getElementById('bv-sport').value, 10);
    const proto = document.getElementById('bv-proto').value;

    const vDst = RULES.map(r => match('dstIP', r.dst, dst) ? 1 : 0);
    const vSrc = RULES.map(r => match('srcIP', r.src, src) ? 1 : 0);
    const vDp = RULES.map(r => match('dport', r.dport, dport) ? 1 : 0);
    const vSp = RULES.map(r => match('sport', r.sport, sport) ? 1 : 0);
    const vPr = RULES.map(r => match('proto', r.proto, proto) ? 1 : 0);

    const and = vDst.map((_, i) => vDst[i] & vSrc[i] & vDp[i] & vSp[i] & vPr[i]);
    const firstMatch = and.findIndex(x => x === 1);

    const fmt = v => `<code style="font-family:monospace;font-size:13px">${v.join('')}</code>`;
    document.getElementById('bv-vectors').innerHTML =
      `<table style="font-size:13px"><tr><td><strong>Dst IP</strong> ${dst}</td><td>${fmt(vDst)}</td></tr>` +
      `<tr><td><strong>Src IP</strong> ${src}</td><td>${fmt(vSrc)}</td></tr>` +
      `<tr><td><strong>DstP</strong> ${dport}</td><td>${fmt(vDp)}</td></tr>` +
      `<tr><td><strong>SrcP</strong> ${sport}</td><td>${fmt(vSp)}</td></tr>` +
      `<tr><td><strong>Proto</strong> ${proto}</td><td>${fmt(vPr)}</td></tr>` +
      `<tr style="border-top:2px solid #0066cc"><td><strong style="color:var(--info)">AND všech</strong></td><td><code style="font-family:monospace;font-size:14px;font-weight:700;color:var(--info)">${and.join('')}</code></td></tr></table>` +
      (firstMatch >= 0
        ? `<div style="margin-top:8px"><strong>První 1 = pravidlo R${firstMatch + 1}</strong>: ${JSON.stringify(RULES[firstMatch])}</div>`
        : `<div class="warn">Žádné pravidlo se neshoduje</div>`);
  }
  ['bv-dst', 'bv-src', 'bv-dport', 'bv-sport', 'bv-proto'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', classify);
      el.addEventListener('change', classify);
    }
  });
  buildCompiledTables();
  classify();
}

// ------- TCAM lookup -------
function initTCAM() {
  const TCAM = [
    { value: '00001', mask: 11111, action: 'permit (R1)' },
    { value: '1000?', mask: 11110, action: 'permit (R2)' },
    { value: '1001?', mask: 11110, action: 'deny (R3)' },
    { value: '1010?', mask: 11110, action: 'permit (R4)' },
    { value: '1011?', mask: 11110, action: 'permit (R5)' },
    { value: '001??', mask: 11100, action: 'permit (R6)' },
    { value: '111??', mask: 11100, action: 'permit (R7)' },
    { value: '0????', mask: 10000, action: 'permit (R8, default 0*)' },
    { value: '1????', mask: 10000, action: 'permit (R9, default 1*)' },
  ];

  function tcamMatch(key, value) {
    if (key.length !== value.length) return false;
    for (let i = 0; i < key.length; i++) {
      if (value[i] === '?') continue;
      if (value[i] !== key[i]) return false;
    }
    return true;
  }

  function lookup() {
    const key = document.getElementById('tcam-key').value.trim();
    if (key.length !== 8 || !/^[01]+$/.test(key)) {
      document.getElementById('tcam-result').innerHTML = '<span class="warn">Klíč musí být 8 bitů (0/1)</span>';
      return;
    }
    // Use first 5 bits for matching
    const k5 = key.substring(0, 5);

    const svg = document.getElementById('tcam-svg');
    clearSvg(svg);
    const W = 700, rowH = 22;
    svgEl('text', { x: 100, y: 24, 'font-size': 13, 'font-weight': 600, text: 'Klíč: ' }, svg);
    [...key].forEach((b, i) => {
      const bgCol = i < 5 ? 'var(--info-bg)' : 'var(--bg-2)';
      svgEl('rect', { x: 150 + i * 30, y: 10, width: 25, height: 22, fill: bgCol, stroke: 'var(--info)' }, svg);
      svgEl('text', { x: 162 + i * 30, y: 26, 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': 13, text: b }, svg);
    });
    svgEl('text', { x: 420, y: 26, 'font-size': 11, fill: 'var(--text-3)', text: '(porovnáváme prvních 5 bitů)' }, svg);

    let firstMatchIdx = -1;
    TCAM.forEach((row, i) => {
      const y = 50 + i * rowH;
      const isMatch = tcamMatch(k5, row.value);
      if (isMatch && firstMatchIdx === -1) firstMatchIdx = i;
      const fill = i === firstMatchIdx ? 'var(--success)' : isMatch ? 'var(--info-bg)' : 'var(--surface)';
      svgEl('rect', { x: 100, y, width: W - 220, height: rowH - 2, fill, stroke: 'var(--text-3)' }, svg);
      [...row.value].forEach((b, j) => {
        svgEl('rect', { x: 150 + j * 30, y, width: 25, height: rowH - 2, fill: b === '?' ? 'var(--secondary-bg)' : 'transparent', stroke: 'none' }, svg);
        svgEl('text', { x: 162 + j * 30, y: y + 16, 'text-anchor': 'middle', 'font-family': 'monospace', 'font-size': 13, fill: i === firstMatchIdx ? 'white' : 'var(--text-2)', text: b }, svg);
      });
      svgEl('text', { x: 320, y: y + 16, 'font-size': 11, fill: i === firstMatchIdx ? 'white' : isMatch ? 'var(--info)' : 'var(--text-3)', text: row.action }, svg);
      svgEl('text', { x: 90, y: y + 16, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--text-3)', text: i + 1 }, svg);
    });

    // Priority encoder result
    if (firstMatchIdx >= 0) {
      svgEl('text', { x: 480, y: 50 + firstMatchIdx * rowH + 16, 'font-size': 12, fill: 'var(--success)', 'font-weight': 600, text: `← Priority Encoder vybere první 1` }, svg);
    }

    document.getElementById('tcam-result').innerHTML = firstMatchIdx >= 0
      ? `<strong>Match v 1 hodinovém cyklu</strong>: řádek ${firstMatchIdx + 1}, akce „${TCAM[firstMatchIdx].action}".<br><span style="color:var(--text-3);font-size:12px">TCAM porovnává paralelně všechny řádky najednou; priority encoder vrátí index nejvyšší shody.</span>`
      : '<span class="warn">Žádná shoda</span>';
  }
  document.getElementById('tcam-key').addEventListener('input', lookup);
  lookup();
}

// ------- Prefix expansion -------
function initExpand() {
  function go() {
    const pfx = document.getElementById('expand-prefix').value.replace('*', '').trim();
    const stride = parseInt(document.getElementById('expand-stride').value, 10);
    if (!/^[01]*$/.test(pfx)) {
      document.getElementById('expand-result').innerHTML = '<span class="warn">Prefix musí být binární (0/1)</span>';
      return;
    }
    const len = pfx.length;
    const padded = Math.ceil(len / stride) * stride;
    const extra = padded - len;
    const count = 1 << extra;
    let expansions = [];
    if (extra === 0) {
      expansions = [pfx];
    } else {
      for (let i = 0; i < count; i++) {
        expansions.push(pfx + i.toString(2).padStart(extra, '0'));
      }
    }
    document.getElementById('expand-result').innerHTML =
      `<strong>Originální prefix:</strong> <code>${pfx || '∅'}*</code> (délka ${len})<br>` +
      `<strong>Cílová délka (násobek stride ${stride}):</strong> ${padded} bitů → extra ${extra} bitů<br>` +
      `<strong>Počet expanzí:</strong> 2<sup>${extra}</sup> = <strong>${count}</strong><br><br>` +
      `<div style="display:flex;flex-wrap:wrap;gap:6px">${expansions.map(e => `<code style="padding:3px 8px;border-radius:3px">${e.substring(0, len)}<span style="color:var(--accent)">${e.substring(len)}</span></code>`).join('')}</div>` +
      `<div style="margin-top:8px;font-size:12px;color:var(--text-3)">Červeně = expandované bity (zaplnění do násobku stride). Tato expanze je cena za rychlejší lookup.</div>`;
  }
  ['expand-prefix', 'expand-stride'].forEach(id => document.getElementById(id).addEventListener('input', go));
  go();
}

// ------- Cross Product -------
function initCrossProd() {
  function gen() {
    const dims = parseInt(document.getElementById('cp-dims').value, 10);
    const vals = parseInt(document.getElementById('cp-vals').value, 10);
    const total = Math.pow(vals, dims);
    // For visualization, limit table to first 20 combinations
    const sample = [];
    const idxs = new Array(dims).fill(0);
    let n = 0;
    while (n < Math.min(total, 16)) {
      sample.push(idxs.slice());
      // increment
      let pos = dims - 1;
      while (pos >= 0) {
        idxs[pos]++;
        if (idxs[pos] < vals) break;
        idxs[pos] = 0;
        pos--;
      }
      if (pos < 0) break;
      n++;
    }
    let html = `<strong>Počet dimenzí:</strong> ${dims}, hodnot per dim.: ${vals}<br>` +
      `<strong>Velikost kartézského součinu:</strong> ${vals}<sup>${dims}</sup> = <strong style="color:var(--danger)">${total.toLocaleString()}</strong> kombinací<br><br>`;
    html += `<table style="font-size:12px"><thead><tr>` +
      Array.from({ length: dims }, (_, i) => `<th>D${i + 1}</th>`).join('') +
      `<th>Akce</th></tr></thead><tbody>`;
    sample.forEach((row, i) => {
      html += `<tr>${row.map(v => `<td class="mono">${v}</td>`).join('')}<td>R${(i % 5) + 1}</td></tr>`;
    });
    if (total > sample.length) {
      html += `<tr><td colspan="${dims + 1}" style="text-align:center;color:var(--text-3)">... a dalších ${(total - sample.length).toLocaleString()} kombinací</td></tr>`;
    }
    html += `</tbody></table>`;
    if (total > 1e6) html += `<div style="color:var(--danger);margin-top:6px"><strong>Prostorová exploze!</strong> ${(total / 1e6).toFixed(1)}M záznamů — nereálné. Řešením je RFC (Recursive Flow Classification) s postupným slučováním.</div>`;
    document.getElementById('cp-out').innerHTML = html;
  }
  ['cp-dims', 'cp-vals'].forEach(id => document.getElementById(id).addEventListener('input', gen));
  gen();
}

// ------- Geometric view -------
function initGeometric() {
  let rules = [];

  function newRules() {
    rules = [];
    for (let i = 0; i < 5; i++) {
      const x1 = Math.random() * 500 + 50;
      const y1 = Math.random() * 200 + 30;
      const w = 80 + Math.random() * 150;
      const h = 50 + Math.random() * 100;
      rules.push({
        id: 'R' + (i + 1),
        x: Math.max(20, x1),
        y: Math.max(20, y1),
        w: Math.min(660 - x1, w),
        h: Math.min(330 - y1, h),
        priority: 5 - i,
        color: `hsl(${(i * 73) % 360}, 60%, 55%)`,
      });
    }
    draw();
  }

  function draw(clickedPt = null) {
    const svg = document.getElementById('geo-svg');
    clearSvg(svg);
    // Axes
    svgEl('line', { x1: 20, y1: 340, x2: 680, y2: 340, stroke: 'var(--text-3)' }, svg);
    svgEl('line', { x1: 20, y1: 10, x2: 20, y2: 340, stroke: 'var(--text-3)' }, svg);
    svgEl('text', { x: 350, y: 358, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text-3)', text: 'F1 (dimenze 1, např. src IP)' }, svg);
    svgEl('text', { x: 10, y: 175, 'font-size': 11, fill: 'var(--text-3)', transform: 'rotate(-90 10 175)', text: 'F2 (např. dst port)' }, svg);

    // Rules (sorted by priority desc — higher draws on top)
    const sorted = rules.slice().sort((a, b) => a.priority - b.priority);
    sorted.forEach(r => {
      svgEl('rect', { x: r.x, y: r.y, width: r.w, height: r.h, fill: r.color, opacity: 0.4, stroke: r.color, 'stroke-width': 2 }, svg);
      svgEl('text', { x: r.x + 6, y: r.y + 16, 'font-size': 12, 'font-weight': 700, fill: 'var(--text)', text: `${r.id} (pri ${r.priority})` }, svg);
    });

    // Clicked point
    if (clickedPt) {
      const matching = rules.filter(r => clickedPt.x >= r.x && clickedPt.x <= r.x + r.w && clickedPt.y >= r.y && clickedPt.y <= r.y + r.h);
      matching.sort((a, b) => b.priority - a.priority);
      const winner = matching[0];
      svgEl('circle', { cx: clickedPt.x, cy: clickedPt.y, r: 6, fill: 'var(--text)', stroke: 'white', 'stroke-width': 2 }, svg);
      svgEl('text', { x: clickedPt.x, y: clickedPt.y - 10, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--text)', 'font-weight': 600, text: winner ? `→ ${winner.id}` : 'no match' }, svg);
      document.getElementById('geo-info').innerHTML = winner
        ? `Paket v bodě (${clickedPt.x.toFixed(0)}, ${clickedPt.y.toFixed(0)}) leží v regionech: <strong>${matching.map(m => m.id).join(', ')}</strong>. Vítězí <strong style="color:${winner.color}">${winner.id}</strong> (nejvyšší priorita ${winner.priority}).`
        : `Bod (${clickedPt.x.toFixed(0)}, ${clickedPt.y.toFixed(0)}) není v žádném regionu — paket spadne do default deny.`;
    } else {
      document.getElementById('geo-info').innerHTML = 'Klikni do prostoru pro klasifikaci bodu. Pravidla s vyšší prioritou kreslena nahoře.';
    }
  }

  document.getElementById('geo-new').addEventListener('click', newRules);
  document.getElementById('geo-clear').addEventListener('click', () => { rules = []; draw(); });
  document.getElementById('geo-svg').addEventListener('click', (e) => {
    const rect = e.target.closest('svg').getBoundingClientRect();
    const viewBox = e.target.closest('svg').viewBox.baseVal;
    const x = (e.clientX - rect.left) * viewBox.width / rect.width;
    const y = (e.clientY - rect.top) * viewBox.height / rect.height;
    draw({ x, y });
  });
  newRules();
}
