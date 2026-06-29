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
const leftPanel = read('tabs/RvmLeftPanelResizeCollapseBridge.js');
const smartGrid = read('tabs/RvmHierarchySmartGridBridge.js');

assert.ok(leftPanel.includes("VERSION = '20260628-rvm-adaptive-hierarchy-columns-1'"), 'left panel bridge must expose adaptive-column version');
assert.ok(smartGrid.includes("VERSION = '20260628-rvm-hierarchy-adaptive-columns-1'"), 'smart-grid bridge must expose adaptive-column version');
assert.ok(!leftPanel.includes('Tree W</span><input type="range"'), 'Tree W range slider must be removed');
assert.ok(!leftPanel.includes('data-rvm-hierarchy-width-field="width"'), 'tree width slider field must be removed');
assert.ok(!leftPanel.includes('data-rvm-hierarchy-width-field="kindWidth"'), 'kind width slider field must be removed');
assert.ok(!leftPanel.includes('data-rvm-hierarchy-width-field="countWidth"'), 'count width slider field must be removed');
assert.ok(!leftPanel.includes('data-rvm-hierarchy-width-field="actionWidth"'), 'action width slider field must be removed');
assert.ok(leftPanel.includes('removeHierarchyWidthControls'), 'bridge must remove stale slider controls from existing DOM');
assert.ok(leftPanel.includes('rvmHierarchyAdaptiveColumns'), 'tree must be stamped with adaptive-column marker');
assert.ok(leftPanel.includes('width:100%!important'), 'tree width must fill the panel adaptively');
assert.ok(leftPanel.includes('grid-template-columns:20px minmax(0,1fr) max-content max-content'), 'row columns must be adaptive, not slider-variable based');
assert.ok(smartGrid.includes('grid-template-columns:16px minmax(38px,max-content) minmax(0,1fr) minmax(24px,max-content)'), 'smart-grid select columns must be adaptive');
assert.ok(!smartGrid.includes('var(--rvm-tree-kind-w'), 'smart-grid must not rely on manual kind width variable');
assert.ok(!smartGrid.includes('var(--rvm-tree-count-w'), 'smart-grid must not rely on manual count width variable');
assert.ok(!smartGrid.includes('var(--rvm-tree-action-w'), 'smart-grid must not rely on manual action width variable');
assert.ok(renderer.includes('RvmHierarchySmartGridBridge.js?v=20260628-rvm-hierarchy-adaptive-columns-1'), 'renderer must load adaptive smart-grid key');
assert.ok(renderer.includes('RvmLeftPanelResizeCollapseBridge.js?v=20260628-rvm-adaptive-hierarchy-columns-1'), 'renderer must load adaptive left-panel key');

console.log('Verified adaptive hierarchy columns without tree width sliders.');
