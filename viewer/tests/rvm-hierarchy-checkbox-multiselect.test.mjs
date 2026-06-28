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
const bridge = read('tabs/RvmHierarchyCheckboxMultiSelectBridge.js');

assert.ok(bridge.includes("VERSION = '20260628-rvm-hierarchy-checkbox-multiselect-1'"), 'bridge must expose checkbox multiselect version');
assert.ok(bridge.includes('data-rvm-hierarchy-row-checkbox'), 'bridge must add row checkboxes');
assert.ok(bridge.includes('data-rvm-hierarchy-select-visible'), 'bridge must add header/select-visible checkbox');
assert.ok(bridge.includes('header.indeterminate'), 'header checkbox must support tri-state/partial state');
assert.ok(bridge.includes('selectedIds: new Set()'), 'bridge must maintain a selected-ID Set');
assert.ok(bridge.includes('event.shiftKey'), 'bridge must support shift-range selection');
assert.ok(bridge.includes('rvm-hierarchy-multiselect-change'), 'bridge must dispatch multiselect change event');
assert.ok(bridge.includes('rvm-hierarchy-multiselect-action'), 'bridge must dispatch multi-action event');
assert.ok(bridge.includes('data-rvm-hierarchy-multi-action="fit"'), 'bridge must expose fit selected action');
assert.ok(bridge.includes('data-rvm-hierarchy-multi-action="isolate"'), 'bridge must expose isolate selected action');
assert.ok(bridge.includes('data-rvm-hierarchy-multi-action="hide"'), 'bridge must expose hide selected action');
assert.ok(bridge.includes('data-rvm-hierarchy-multi-action="show"'), 'bridge must expose show selected action');
assert.ok(bridge.includes('event.stopPropagation()'), 'checkbox changes must not break normal row click selection');
assert.ok(bridge.includes('grid-template-columns:20px 18px minmax(0,1fr) max-content max-content'), 'checkbox column must be integrated into adaptive tree grid');
assert.ok(renderer.includes('RvmHierarchyCheckboxMultiSelectBridge.js?v=20260628-rvm-hierarchy-checkbox-multiselect-1'), 'renderer must import checkbox multiselect bridge');
assert.ok(renderer.includes('installRvmHierarchyCheckboxMultiSelectBridge()'), 'renderer must install checkbox multiselect bridge');

console.log('Verified hierarchy checkbox multi-select bridge contract.');
