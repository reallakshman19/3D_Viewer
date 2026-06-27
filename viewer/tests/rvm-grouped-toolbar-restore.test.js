import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  const file = path.join(viewerRoot, relativePath);
  assert.ok(fs.existsSync(file), `missing source file: ${relativePath}`);
  return fs.readFileSync(file, 'utf8');
}

const index = read('index.html');
const entry = read('main-rhbg-fitguard.js');
const app = read('core/app.js');
const runtime = read('core/app-label-perf-runtime.js');
const renderer = read('tabs/viewer3d-rvm-tab-renderer.js');
const toolbar = read('tabs/RvmToolbarCompactBridge.js');
const overflow = read('tabs/RvmToolbarOverflowController.js');
const pointer = read('tabs/RvmGroupedToolbarPointerBridge.js');
const hierarchy = read('tabs/RvmHierarchySelectionBridge.js');
const treeSync = read('tabs/RvmSelectionTreeSyncBridge.js');
const smartGrid = read('tabs/RvmHierarchySmartGridBridge.js');

assert.ok(index.includes('main-rhbg-fitguard.js?v=20260627-rvm-view-expanded-nonempty-menus-1'), 'index must use expanded View startup key');
assert.ok(entry.includes('core/app.js?v=20260627-rvm-view-expanded-nonempty-menus-1'), 'entrypoint must use expanded View app delegate key');
assert.ok(app.includes('app-label-perf-runtime.js?v=20260627-rvm-view-expanded-nonempty-menus-1'), 'app delegate must use expanded View runtime key');
assert.ok(runtime.includes('viewer3d-rvm-tab-renderer.js?v=20260627-rvm-view-expanded-nonempty-menus-1'), 'runtime must use expanded View renderer key');
assert.ok(renderer.includes('RvmToolbarCompactBridge.js?v=20260627-rvm-toolbar-view-expanded-nonempty-1'), 'renderer must import expanded View toolbar owner');
assert.ok(renderer.includes('RvmGroupedToolbarPointerBridge.js?v=20260627-rvm-grouped-toolbar-pointer-1'), 'renderer must import deterministic grouped toolbar pointer bridge');
assert.ok(renderer.includes('RvmHierarchySmartGridBridge.js?v=20260627-rvm-hierarchy-smart-grid-1'), 'renderer must import hierarchy smart grid bridge');
assert.ok(toolbar.includes("const VERSION = '20260627-rvm-toolbar-view-expanded-nonempty-1'"), 'toolbar must expose expanded View/nonempty menu version');
assert.ok(toolbar.includes("const PREVIOUS_VERSION = '20260627-rvm-toolbar-view-orient-split-1'"), 'toolbar must retain previous view/orient split marker');
assert.ok(toolbar.includes("const CORE_LABELS = new Set(['navigate', 'view', 'navigate / view', 'review'])"), 'toolbar must keep View as a top-level/core section');
assert.ok(!toolbar.includes("{ id: 'view', label: 'View'"), 'toolbar must not recreate a View dropdown');
assert.ok(toolbar.includes("{ id: 'orient', label: 'Orient'"), 'toolbar may keep Orient as a populated-only grouped menu');
assert.ok(toolbar.includes('menuRoot.hidden = !hasSections'), 'toolbar must hide grouped menus with no real sections');
assert.ok(toolbar.includes('hiddenEmptyMenus'), 'toolbar diagnostics must expose hidden empty groups');
assert.ok(toolbar.includes('visibleSecondaryMenus'), 'toolbar diagnostics must expose visible populated groups');
assert.ok(toolbar.includes('clearSecondaryDataset(section)'), 'salvaged View sections must be restored as core toolbar sections');
assert.ok(toolbar.includes('RvmToolbarOverflowController.js?v=20260627-rvm-toolbar-overflow-controller-grouped-restore-1'), 'toolbar must import restored grouped overflow controller');
assert.ok(overflow.includes("const VERSION = '20260627-rvm-toolbar-overflow-controller-grouped-restore-1'"), 'overflow controller must expose restored grouped version');
assert.ok(overflow.includes('getMenuEntries') && overflow.includes('openMenuId'), 'overflow controller must support multiple named grouped menus');
assert.ok(overflow.includes('positionMenu(entry)') && overflow.includes("menu.style.position = 'fixed'"), 'grouped menus must open as fixed-position panels');
assert.ok(pointer.includes("const VERSION = '20260627-rvm-grouped-toolbar-pointer-1'"), 'pointer bridge must expose deterministic pointer version');
assert.ok(pointer.includes('pointerdown-deterministic') && pointer.includes('suppressClickButton'), 'pointer bridge must open on pointerdown and suppress the follow-up click');
assert.ok(pointer.includes('[data-rvm-toolbar-more] *{pointer-events:none;}'), 'pointer bridge must make nested label/caret clicks deterministic');
for (const label of ['Orient', 'Visibility', 'Inspect', 'Export', 'Source', 'Diag']) assert.ok(toolbar.includes(`label: '${label}'`), `toolbar must define ${label} menu`);
assert.ok(toolbar.includes('rvm-toolbar-secondary-orient') && toolbar.includes('content:attr(aria-label)'), 'Orient menu must show text labels for icon-only orientation buttons when populated');
assert.ok(!toolbar.includes('More tools</span>'), 'single generic More tools label must not return');
assert.ok(renderer.includes('RvmHierarchySelectionBridge.js?v=20260626-rvm-hierarchy-text-hit-target-sync-1'), 'renderer must preserve hierarchy text-hit-target bridge');
assert.ok(renderer.includes('RvmSelectionTreeSyncBridge.js?v=20260626-rvm-hierarchy-selection-sync-2'), 'renderer must preserve hierarchy canvas sync bridge');
assert.ok(hierarchy.includes("const BRIDGE_VERSION = 'rvm-hierarchy-selection-bridge/v3-text-hit-target-sync'"), 'hierarchy bridge version must remain active');
assert.ok(treeSync.includes("const BRIDGE_VERSION = '20260626-rvm-hierarchy-selection-sync-2'"), 'tree sync bridge version must remain active');
assert.ok(smartGrid.includes("const VERSION = '20260627-rvm-hierarchy-smart-grid-1'"), 'smart grid bridge must expose current version');
assert.ok(smartGrid.includes('grid-template-columns:22px minmax(0,1fr) 34px 34px'), 'smart grid must define Navis row columns for expander/select/off/on');
assert.ok(smartGrid.includes('.rvm-navis-select{grid-column:2;min-width:0;width:100%;'), 'smart grid must allocate a flexible select/label column');
assert.ok(smartGrid.includes('overflow-x:hidden'), 'smart grid must suppress horizontal row overflow');

console.log('Verified expanded top-level View toolbar, hidden empty grouped menus, deterministic pointer toggles, hierarchy smart grid, and hierarchy selection sync coexist.');
