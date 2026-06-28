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
const viewer = read('rvm-viewer/RvmViewer3D.js');
const visibility = read('rvm-viewer/RvmVisibilityController.js');

assert.ok(actionBridge.includes("VERSION = '20260628-rvm-hierarchy-multiselect-actions-1'"), 'action bridge must expose version');
assert.ok(actionBridge.includes("document.addEventListener('rvm-hierarchy-multiselect-action'"), 'action bridge must listen to multiselect action events');
assert.ok(actionBridge.includes('dispatchHierarchyMultiSelectAction'), 'action bridge must export dispatch helper');
assert.ok(actionBridge.includes('fitCanonicalIds'), 'fit action must bind to viewer fitCanonicalIds');
assert.ok(actionBridge.includes('isolateCanonicalIds'), 'isolate action must bind to viewer isolateCanonicalIds');
assert.ok(actionBridge.includes('hideCanonicalIds'), 'hide action must bind to viewer hideCanonicalIds');
assert.ok(actionBridge.includes('showCanonicalIds'), 'show action must bind to viewer showCanonicalIds');
assert.ok(actionBridge.includes('rvm-hierarchy-multiselect-action-applied'), 'action bridge must emit applied result event');
assert.ok(actionBridge.includes('viewer.selectCanonicalIds?.(selectedIds'), 'fit fallback must select canonical IDs before fitting');
assert.ok(viewer.includes('fitCanonicalIds(ids = [])'), 'viewer must expose fitCanonicalIds');
assert.ok(viewer.includes('isolateCanonicalIds(ids = [])'), 'viewer must expose isolateCanonicalIds');
assert.ok(viewer.includes('hideCanonicalIds(ids = [])'), 'viewer must expose hideCanonicalIds');
assert.ok(viewer.includes('showCanonicalIds(ids = [])'), 'viewer must expose showCanonicalIds');
assert.ok(viewer.includes('this.selectCanonicalIds(canonicalIds, { additive: false })'), 'fitCanonicalIds must select exact canonical IDs before fit');
assert.ok(viewer.includes('this.visibility.isolate(canonicalIds)'), 'isolateCanonicalIds must call visibility isolate');
assert.ok(viewer.includes('this.visibility.hide(canonicalIds)'), 'hideCanonicalIds must call visibility hide');
assert.ok(visibility.includes('show(canonicalIds)'), 'visibility controller must support selected canonical show');
assert.ok(visibility.includes('this._hiddenCanonicalIds.delete(id)'), 'selected show must remove hidden canonical IDs');
assert.ok(visibility.includes('this._isolatedCanonicalIds.delete(id)'), 'selected show must remove selected IDs from isolation set');
assert.ok(renderer.includes('RvmHierarchyMultiSelectActionBridge.js?v=20260628-rvm-hierarchy-multiselect-actions-1'), 'renderer must import action bridge with cache key');
assert.ok(renderer.includes('installRvmHierarchyMultiSelectActionBridge()'), 'renderer must install action bridge');

console.log('Verified hierarchy multi-select actions bind to viewer operations.');
