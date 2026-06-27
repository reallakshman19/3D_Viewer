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
const hierarchy = read('tabs/RvmHierarchySelectionBridge.js');
const treeSync = read('tabs/RvmSelectionTreeSyncBridge.js');

assert.ok(index.includes('main-rhbg-fitguard.js?v=20260627-rvm-toolbar-restore-hierarchy-1'), 'index must use grouped-toolbar restore startup key');
assert.ok(entry.includes('core/app.js?v=20260627-rvm-toolbar-restore-hierarchy-1'), 'entrypoint must use grouped-toolbar restore app delegate key');
assert.ok(app.includes('app-label-perf-runtime.js?v=20260627-rvm-toolbar-restore-hierarchy-1'), 'app delegate must use grouped-toolbar restore runtime key');
assert.ok(runtime.includes('viewer3d-rvm-tab-renderer.js?v=20260627-rvm-toolbar-restore-hierarchy-1'), 'runtime must use grouped-toolbar restore renderer key');
assert.ok(renderer.includes('RvmToolbarCompactBridge.js?v=20260627-rvm-toolbar-secondary-groups-restore-1'), 'renderer must import restored grouped toolbar owner');
assert.ok(toolbar.includes("const VERSION = '20260627-rvm-toolbar-secondary-groups-restore-1'"), 'toolbar must expose restored grouped version');
assert.ok(toolbar.includes('RvmToolbarOverflowController.js?v=20260627-rvm-toolbar-overflow-controller-grouped-restore-1'), 'toolbar must import restored grouped overflow controller');
assert.ok(overflow.includes("const VERSION = '20260627-rvm-toolbar-overflow-controller-grouped-restore-1'"), 'overflow controller must expose restored grouped version');
assert.ok(overflow.includes('getMenuEntries') && overflow.includes('openMenuId'), 'overflow controller must support multiple named grouped menus');
assert.ok(overflow.includes('positionMenu(entry)') && overflow.includes("menu.style.position = 'fixed'"), 'grouped menus must open as fixed-position panels');
for (const label of ['View', 'Visibility', 'Inspect', 'Export', 'Source', 'Diag']) {
  assert.ok(toolbar.includes(`label: '${label}'`), `toolbar must define ${label} menu`);
}
assert.ok(!toolbar.includes('More tools</span>'), 'single generic More tools label must not return');
assert.ok(renderer.includes('RvmHierarchySelectionBridge.js?v=20260626-rvm-hierarchy-text-hit-target-sync-1'), 'renderer must preserve hierarchy text-hit-target bridge');
assert.ok(renderer.includes('RvmSelectionTreeSyncBridge.js?v=20260626-rvm-hierarchy-selection-sync-2'), 'renderer must preserve hierarchy canvas sync bridge');
assert.ok(hierarchy.includes("const BRIDGE_VERSION = 'rvm-hierarchy-selection-bridge/v3-text-hit-target-sync'"), 'hierarchy bridge version must remain active');
assert.ok(treeSync.includes("const BRIDGE_VERSION = '20260626-rvm-hierarchy-selection-sync-2'"), 'tree sync bridge version must remain active');

console.log('Verified grouped RVM toolbar menus are restored without reverting hierarchy selection sync.');
