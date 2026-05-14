// Theme toggle — persists user choice in localStorage, falls back to system preference.

export function initTheme() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  function set(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pds-theme', theme);
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    set(current === 'dark' ? 'light' : 'dark');
  });

  // Respond to system theme changes if user hasn't picked one
  if (!localStorage.getItem('pds-theme')) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('pds-theme')) {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    });
  }
}
