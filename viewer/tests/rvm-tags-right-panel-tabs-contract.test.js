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

const tab = read('tabs/viewer3d-rvm-tab.js');
const renderer = read('tabs/viewer3d-rvm-tab-renderer.js');
const deferredLoader = read('tabs/RvmDeferredBridgeLoader.js');
const tagTools = read('tabs/RvmTagToolsBridge.js');
const rightTabs = read('tabs/RvmRightPanelTabsBridge.js');
const rightPartition = read('tabs/RvmRightPanelPartitionBridge.js');
const dynamicCheckbox = read('tabs/RvmHierarchyDynamicChildCheckboxBridge.js');
const workerFirst = read('rvm-viewer/RvmBrowserRvmWorkerFirstBridge.js');
const tagStore = read('rvm/RvmTagXmlStore.js');

assert.ok(renderer.includes('RvmRightPanelTabsBridge.js?v=20260629-rvm-right-panel-tabs-1'), 'renderer must eagerly install right-panel tabs');
assert.ok(renderer.includes('RvmTagToolsBridge.js?v=20260630-rvm-tag-tools-2'), 'renderer must eagerly install tag tools');
assert.ok(deferredLoader.includes("id: 'right-panel-tabs'"), 'deferred loader must retry right-panel tabs after model load');
assert.ok(deferredLoader.includes("id: 'right-panel-partition'"), 'deferred loader must retry strict right-panel partition after model load');
assert.ok(deferredLoader.includes('RvmRightPanelPartitionBridge.js?v=20260630-rvm-right-panel-partition-1'), 'deferred loader must import right-panel partition bridge with cache key');
assert.ok(deferredLoader.includes("id: 'hierarchy-dynamic-child-checkbox'"), 'deferred loader must install dynamic child checkbox bridge after model load');
assert.ok(deferredLoader.includes('RvmHierarchyDynamicChildCheckboxBridge.js?v=20260630-rvm-hierarchy-dynamic-child-checkbox-1'), 'deferred loader must cache-bust dynamic child checkbox bridge');
assert.ok(deferredLoader.includes("id: 'tag-tools'"), 'deferred loader must retry tag tools after model load');

assert.ok(rightTabs.includes('__PCF_GLB_RVM_RIGHT_PANEL_TABS__'), 'right-panel tabs must publish the requested global API');
assert.ok(rightTabs.includes('function orderTabs'), 'right-panel tabs must keep the stable tab order even when Tags is created first');
for (const method of ['ensureTab', 'moveToTab', 'activate', 'refresh']) {
  assert.ok(rightTabs.includes(method), `right-panel tabs API must include ${method}`);
}
for (const tabId of ["id: 'properties'", "id: 'tags'", "id: 'diagnostics'", "id: 'exports'"]) {
  assert.ok(rightTabs.includes(tabId), `right-panel tabs must define stable tab ${tabId}`);
}
assert.ok(rightTabs.includes('panel.appendChild(node)'), 'right-panel tabs must move existing legacy nodes instead of cloning them');
assert.ok(rightPartition.includes('RvmRightPanelPartitionBridge'), 'right partition bridge source must be readable');
assert.ok(rightPartition.includes('20260630-rvm-right-panel-partition-1'), 'right partition bridge must expose version');
assert.ok(rightPartition.includes('#rvm-tags-panel'), 'right partition bridge must explicitly route Tags panel');
assert.ok(rightPartition.includes('#rvm-browser-parse-diagnostics'), 'right partition bridge must explicitly route browser diagnostics panel');
assert.ok(rightPartition.includes('#rvm-attributes-panel'), 'right partition bridge must keep selected entity/properties separate');
assert.ok(rightPartition.includes('sanitizeTab(root, \'tags\''), 'right partition bridge must sanitize accidental diagnostics inside Tags');
assert.ok(rightPartition.includes('sanitizeTab(root, \'diagnostics\''), 'right partition bridge must sanitize accidental Tags inside Diagnostics');
assert.ok(dynamicCheckbox.includes('20260630-rvm-hierarchy-dynamic-child-checkbox-1'), 'dynamic child checkbox bridge must expose version');
assert.ok(dynamicCheckbox.includes('ensureRowCheckbox'), 'dynamic child checkbox bridge must inject missing row checkboxes');
assert.ok(dynamicCheckbox.includes('onCheckboxChange'), 'dynamic child checkbox bridge must listen to checkbox changes');
assert.ok(dynamicCheckbox.includes('querySelectorAll(\':scope li[data-node-id] [data-rvm-hierarchy-row-checkbox]\')'), 'dynamic child checkbox bridge must cascade selection to children');
assert.ok(dynamicCheckbox.includes('indeterminate'), 'dynamic child checkbox bridge must maintain partial parent state');

assert.ok(tab.includes('id="rvm-attributes-panel"'), 'RVM shell must preserve legacy attributes panel id');
assert.ok(tab.includes('id="rvm-browser-parse-diagnostics"'), 'RVM shell must preserve legacy browser diagnostics id');

assert.ok(tagTools.includes('__PCF_GLB_RVM_TAGS__'), 'tag tools must publish the requested global API');
assert.ok(tagTools.includes('RvmTagXmlStore'), 'tag tools must use RvmTagXmlStore for import/export/store');
for (const method of ['createManualTag', 'importXmlText', 'exportXmlText', 'deleteTag', 'focusTag', 'getDiagnostics']) {
  assert.ok(tagTools.includes(method), `tag tools API must include ${method}`);
}
assert.ok(tagTools.includes('data-rvm-tag-action="create"'), 'tag toolbar must expose create action');
assert.ok(tagTools.includes('data-rvm-tag-action="import"'), 'tag toolbar must expose import action');
assert.ok(tagTools.includes('data-rvm-tag-action="export"'), 'tag toolbar must expose export action');
assert.ok(tagTools.includes('data-rvm-tag-draft-form'), 'two-click tag capture must finish in a compact form');
assert.ok(tagTools.includes('createTextPlane'), 'tag rendering must create visible label planes');
assert.ok(tagTools.includes("navisPointForTag(tag, viewer, 'pos1')"), 'Navis-only imported tags must reconstruct an anchor from redline pos1');
assert.ok(tagTools.includes("navisPointForTag(tag, viewer, 'pos2')"), 'Navis-only imported tags must reconstruct a label point from redline pos2');
assert.ok(tagTools.includes('RuntimeEvents.RVM_TAG_CREATED'), 'tag lifecycle must keep existing created event');
assert.ok(tagTools.includes('RuntimeEvents.RVM_TAG_DELETED'), 'tag lifecycle must keep existing deleted event');
assert.ok(tagStore.includes('function appendDefaultClipplaneset'), 'Navis tag export must include a disabled clip plane set');
assert.ok(tagStore.includes('function cameraRotationFromState'), 'Navis tag export must convert app camera target state to rotation quaternion');
assert.ok(tagStore.includes('navisModelFilename(this.bundleId'), 'Navis tag export must use the model filename, not tags.xml');
assert.ok(tagStore.includes('guid: navisGuid'), 'Navis tag export must emit a plain Navis-style UUID view guid');
assert.doesNotMatch(tagStore, /rltagEl\.setAttribute\('severity'/, 'Navis rltag export must not emit app-only severity attribute');
assert.doesNotMatch(tagStore, /rltagEl\.setAttribute\('bundleId'/, 'Navis rltag export must not emit app-only bundleId attribute');
assert.doesNotMatch(tagStore, /appendPoint3f\(doc, rltagEl, 'pos3d'/, 'Navis rltag export must not emit app-only pos3d child');
assert.doesNotMatch(tagStore, /appendBox3f\(doc, rltagEl, 'bounds'/, 'Navis rltag export must not emit app-only bounds child');

assert.ok(tab.includes('function visibilityToggleHtml'), 'shared hierarchy rows must render a compact visibility toggle');
assert.ok(tab.includes('data-rvm-visibility-toggle'), 'shared hierarchy rows must expose visibility toggle data');
assert.ok(tab.includes('root.dataset.rvmLoadedFileName'), 'loaded model filename must key per-session tag state');
assert.ok(workerFirst.includes('<li data-node-id='), 'worker-first RVM tree must use li[data-node-id] row contract');
assert.ok(workerFirst.includes('class="rvm-tree-node"'), 'worker-first RVM tree must use shared rvm-tree-node row body');
assert.ok(workerFirst.includes('data-rvm-visibility-toggle'), 'worker-first RVM tree must expose row visibility controls');
assert.doesNotMatch(workerFirst, /class="rvm-tree-row"/, 'worker-first RVM tree must not revive legacy .rvm-tree-row buttons');

console.log('RVM tag tools, right-panel tabs/partition, dynamic child checkboxes, and unified tree contracts passed');
