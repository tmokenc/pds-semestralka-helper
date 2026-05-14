/*
 * Replace each <select> inside .demo-controls with a segmented tab control.
 * The original <select> element stays in the DOM (hidden) so demo code that
 * reads `select.value` or listens for `change`/`input` events keeps working.
 *
 * Run AFTER all demo init functions have attached their listeners.
 */
export function convertSelectsToTabs() {
  document.querySelectorAll('.demo-controls select').forEach(select => {
    if (select.dataset.tabsApplied === 'true') return;
    select.dataset.tabsApplied = 'true';

    const tabs = document.createElement('div');
    tabs.className = 'opt-tabs';
    tabs.setAttribute('role', 'tablist');

    const options = Array.from(select.options);
    let activeValue = select.value || (options[0] && options[0].value);

    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'opt-tab';
      if (opt.value === activeValue) btn.classList.add('active');
      btn.dataset.value = opt.value;
      btn.textContent = opt.textContent;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', opt.value === activeValue ? 'true' : 'false');
      btn.addEventListener('click', () => {
        tabs.querySelectorAll('.opt-tab').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        if (select.value !== opt.value) {
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          select.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      tabs.appendChild(btn);
    });

    // Hide the original <select> visually but keep it functional in the DOM
    select.style.display = 'none';
    select.parentNode.insertBefore(tabs, select.nextSibling);
  });
}
