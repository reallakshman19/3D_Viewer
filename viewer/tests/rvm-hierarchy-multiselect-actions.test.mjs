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

const renderer = read('tabs/viewer3d-rvm-tab-renderer.js');
const actionBridge = read('tabs/RvmHierarchyMultiSelectActionBridge.js');
const visibility = read('rvm-viewer/RvmVisibilityController.js');

assert.ok(actionBridge.includes("VERSION = '20260628-rvm-hierarchy-multiselect-actions-2'"), 'action bridge must expose hardened visibility semantics version');
assert.ok(actionBridge.includes("document.addEventListener('rvm-hierarchy-multiselect-action'"), 'action bridge must listen to multiselect action events');
assert.ok(actionBridge.includes('dispatchHierarchyMultiSelectAction'), 'action bridge must export dispatch helper');
assert.ok(actionBridge.includes('viewer.selectCanonicalIds?.(selectedIds, { additive: false })'), 'fit action must select canonical IDs');
assert.ok(actionBridge.includes('viewer.fitSelection?.()'), 'fit action must call viewer fitSelection');
assert.ok(actionBridge.includes('viewer.visibility?.isolate?.(selectedIds)'), 'isolate action must call visibility isolate');
assert.ok(actionBridge.includes('viewer.visibility?.hide?.(selectedIds)'), 'hide action must call visibility hide');
assert.ok(actionBridge.includes('viewer.visibility.show(selectedIds)'), 'show action must call selected visibility show when available');
assert.ok(actionBridge.includes('visibilityState(viewer)'), 'action bridge must collect visibility diagnostics');
assert.ok(actionBridge.includes('hiddenCount'), 'action result must expose hidden count');
assert.ok(actionBridge.includes('isolatedCount'), 'action result must expose isolated count');
assert.ok(actionBridge.includes('rvmHierarchyMultiselectHiddenCount'), 'root dataset must expose hidden count');
assert.ok(actionBridge.includes('rvmHierarchyMultiselectIsolatedCount'), 'root dataset must expose isolated count');
assert.ok(actionBridge.includes('rvm-hierarchy-multiselect-action-applied'), 'action bridge must emit applied result event');
assert.ok(actionBridge.includes('root.dataset.rvmHierarchyMultiselectLastActionHandled'), 'action bridge must stamp handled state');
assert.ok(visibility.includes('show(canonicalIds)'), 'visibility controller must support selected canonical show');
assert.ok(visibility.includes('const isolatedMode = this._isolatedCanonicalIds.size > 0'), 'selected show must detect isolate mode');
assert.ok(visibility.includes('if (isolatedMode) this._isolatedCanonicalIds.add(id)'), 'selected show must add selected IDs to isolate set so they become visible');
assert.ok(!visibility.includes('this._isolatedCanonicalIds.delete(id);'), 'selected show must not remove selected IDs from isolate set');
assert.ok(visibility.includes('getVisibilityState()'), 'visibility controller must expose diagnostic state');
assert.ok(renderer.includes('RvmHierarchyMultiSelectActionBridge.js?v=20260628-rvm-hierarchy-multiselect-actions-1'), 'renderer must import action bridge cache key');
assert.ok(renderer.includes('installRvmHierarchyMultiSelectActionBridge()'), 'renderer must install action bridge');

console.log('Verified hardened hierarchy multi-select visibility semantics.');
