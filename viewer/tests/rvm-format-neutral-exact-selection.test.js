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
const exactSelection = read('tabs/RvmFormatNeutralExactSelectionBridge.js');

assert.ok(renderer.includes('RvmFormatNeutralExactSelectionBridge.js?v=20260630-rvm-format-neutral-exact-rvm-1'), 'renderer must import the exact source-selection bridge');
assert.ok(renderer.indexOf('installRvmFormatNeutralExactSelectionBridge();') < renderer.indexOf('installRvmHierarchySelectionBridge(RvmViewer3D)'), 'exact source-selection bridge must install before legacy hierarchy selection bridge');
assert.ok(exactSelection.includes("const VERSION = '20260630-rvm-exact-native-selection-1'"), 'exact selection bridge must expose current diagnostics version');
assert.ok(exactSelection.includes("root?.dataset?.rvmHierarchyController === 'format-neutral'"), 'bridge must only run on format-neutral source trees');
assert.ok(exactSelection.includes('EXACT_SELECTION_SOURCE_KINDS'), 'bridge must be gated to source-preview-like formats');
assert.ok(exactSelection.includes('descendantsForNode(root, node)'), 'branch/group selection must include descendant source nodes');
assert.ok(exactSelection.includes('idCandidatesForNodes'), 'bridge must select from node/subtree render ids before labels');
assert.ok(exactSelection.includes('forceViewerResize(viewer)'), 'hierarchy selection must refresh viewer/canvas sizing around fit');
assert.ok(exactSelection.includes('requestAnimationFrame(() => { forceViewerResize(viewer);'), 'fit must repeat after layout settles');
assert.ok(exactSelection.includes('data-rvm-source-hierarchy-diagnostics'), 'selection panel must expose source hierarchy diagnostics');
assert.ok(exactSelection.includes('__rvmSourceHierarchySelectionDiagnostics'), 'diagnostics must be stored for runtime inspection');
assert.ok(exactSelection.includes('matchedRenderIds'), 'diagnostics must show matched render IDs');
assert.ok(exactSelection.includes('Candidate IDs'), 'diagnostics must show candidate ID count');
assert.ok(exactSelection.includes('GENERIC_LABELS'), 'bridge must block generic label fallback such as FLANGE/VALVE/PIPE');
assert.ok(exactSelection.includes('scopeNodeCount'), 'selection event must expose branch/component hierarchy scope size');
assert.ok(exactSelection.includes('diagnostics: root.__rvmSourceHierarchySelectionDiagnostics'), 'selection event must include diagnostics payload');
assert.ok(exactSelection.includes("event?.stopImmediatePropagation?.()"), 'bridge must stop the legacy capture handler after exact source selection');
assert.ok(exactSelection.includes("'rvm'"), 'bridge must handle native RVM hierarchy selection');
assert.ok(exactSelection.includes('!nativeRvm'), 'native RVM hierarchy selection must skip label fallback matching');

console.log('Verified format-neutral source hierarchy selection diagnostics contract.');
