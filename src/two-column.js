/*
 * For each .subtopic that contains a .demo, split its children into two
 * stacked columns: .col-theory (text/notes/tables) and .col-viz (demos).
 *
 * The H3 stays at the top spanning both columns; .grid-2/.grid-3 card
 * groups also stay full-width below.  At narrow viewports CSS collapses the
 * two columns back to a single stack.
 *
 * Element identity is preserved (just re-parented), so getElementById and
 * any attached event listeners continue to work.
 */
export function restructureSubtopicsForTwoColumns() {
  document.querySelectorAll('.subtopic').forEach(subtopic => {
    if (subtopic.dataset.twoCol === 'true') return;

    const hasDemo = subtopic.querySelector(':scope > .demo, :scope > figure');
    if (!hasDemo) return;

    const children = Array.from(subtopic.children);
    const h3 = subtopic.querySelector(':scope > h3');

    const theory = document.createElement('div');
    theory.className = 'col-theory';
    const viz = document.createElement('div');
    viz.className = 'col-viz';
    // Full-width row beneath the two columns (for card grids that should stay
    // full width: .grid-2, .grid-3, large tables)
    const wide = document.createElement('div');
    wide.className = 'col-wide';

    children.forEach(child => {
      if (child === h3) return;
      const cls = child.classList;
      const tag = child.tagName;
      // Visualizations → viz column
      if (cls && (cls.contains('demo') || tag === 'FIGURE')) {
        viz.appendChild(child);
      }
      // Wide content that doesn't fit a 28% column → full-width row below
      else if (
        tag === 'TABLE' ||
        tag === 'PRE' ||
        (cls && (cls.contains('grid-2') || cls.contains('grid-3')))
      ) {
        wide.appendChild(child);
      }
      // Everything else (paragraphs, h4, lists, notes) → theory column
      else {
        theory.appendChild(child);
      }
    });

    // Re-append in canonical order: h3 (already in place), theory, viz, wide
    if (h3) subtopic.appendChild(h3);
    if (theory.childNodes.length) subtopic.appendChild(theory);
    if (viz.childNodes.length) subtopic.appendChild(viz);
    if (wide.childNodes.length) subtopic.appendChild(wide);

    subtopic.dataset.twoCol = 'true';
  });
}
