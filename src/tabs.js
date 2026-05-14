// Tab switching + keyboard navigation

export function initTabs() {
  const tabs = document.querySelectorAll('nav.tabs button');
  const sections = document.querySelectorAll('section.topic');

  function activate(name) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    sections.forEach(s => s.classList.toggle('active', s.id === `tab-${name}`));
    window.scrollTo({ top: 0, behavior: 'instant' });
    try { history.replaceState(null, '', `#${name}`); } catch (e) {}
  }

  tabs.forEach(t => {
    t.addEventListener('click', () => activate(t.dataset.tab));
  });

  // Keyboard arrows for tab navigation
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    const order = Array.from(tabs).map(t => t.dataset.tab);
    const active = document.querySelector('nav.tabs button.active');
    if (!active) return;
    const idx = order.indexOf(active.dataset.tab);
    if (e.key === 'ArrowRight' && idx < order.length - 1) activate(order[idx + 1]);
    else if (e.key === 'ArrowLeft' && idx > 0) activate(order[idx - 1]);
  });

  // Open from URL hash
  const initial = location.hash.replace('#', '');
  if (initial && document.getElementById(`tab-${initial}`)) {
    activate(initial);
  }

  // Expose for overview cards
  window.PDS_activate = activate;
}
