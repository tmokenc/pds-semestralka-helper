// Entry point. Vite bundles this into a single optimized asset.
import './styles.css';

import { initTabs } from './tabs.js';
import { initOverview } from './overview.js';
import { convertSelectsToTabs } from './select-as-tabs.js';
import { initTheme } from './theme.js';
import { restructureSubtopicsForTwoColumns } from './two-column.js';

import { initT1 } from './demos/t1-transport.js';
import { initT2 } from './demos/t2-routing.js';
import { initT3 } from './demos/t3-switches.js';
import { initT4 } from './demos/t4-routers.js';
import { initT5 } from './demos/t5-classification.js';
import { initT6 } from './demos/t6-p2p.js';
import { initT7 } from './demos/t7-ids.js';
import { initT8 } from './demos/t8-os.js';
import { initT9 } from './demos/t9-sdn.js';

window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initTabs();
  initOverview();
  initT1();
  initT2();
  initT3();
  initT4();
  initT5();
  initT6();
  initT7();
  initT8();
  initT9();
  // After all demo init handlers are attached, swap each <select> for a
  // segmented tab control. The hidden <select> stays in the DOM, so its
  // `.value` and `change`/`input` listeners continue to work.
  convertSelectsToTabs();
  // Reorganise each .subtopic into theory + viz columns. Element identity
  // is preserved, so existing event listeners survive the re-parenting.
  restructureSubtopicsForTwoColumns();
});
