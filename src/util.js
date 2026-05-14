// Shared utility helpers

export const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgEl(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) {
    if (k === 'text') el.textContent = attrs[k];
    else el.setAttribute(k, attrs[k]);
  }
  if (parent) parent.appendChild(el);
  return el;
}

export function clearSvg(svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

export function arrowDef(svg, id, color = '#666') {
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = svgEl('defs', {}, svg);
    svg.insertBefore(defs, svg.firstChild);
  }
  const marker = svgEl('marker', {
    id, markerWidth: 8, markerHeight: 8, refX: 7, refY: 4, orient: 'auto'
  }, defs);
  svgEl('path', { d: 'M0,0 L8,4 L0,8 z', fill: color }, marker);
}

export function fmt(n, decimals = 2) {
  if (Math.abs(n) >= 1e6) return n.toExponential(decimals);
  return Number(n.toFixed(decimals)).toString();
}

export function bitCount(s) {
  return [...s].filter(c => c === '1').length;
}

// Parse "147.229.5.1" or wildcard "147.229.*.*"
export function parseIp(ip) {
  return ip.split('.').map(p => p === '*' ? null : parseInt(p, 10));
}

export function ipMatch(prefix, ip) {
  const p = parseIp(prefix), q = parseIp(ip);
  for (let i = 0; i < 4; i++) {
    if (p[i] === null) continue;
    if (p[i] !== q[i]) return false;
  }
  return true;
}

// Random pick
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// HTML escape
export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}
