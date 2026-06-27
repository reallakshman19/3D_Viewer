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

assert.ok(renderer.includes('RvmFormatNeutralExactSelectionBridge.js?v=20260627-rvm-format-neutral-exact-selection-1'), 'renderer must import the exact source-selection bridge');
assert.ok(renderer.indexOf('installRvmFormatNeutralExactSelectionBridge()') < renderer.indexOf('installRvmHierarchySelectionBridge'), 'exact source-selection bridge must install before legacy hierarchy selection bridge');
assert.ok(exactSelection.includes("const VERSION = '20260627-rvm-format-neutral-exact-selection-1'"), 'exact selection bridge must expose current version');
assert.ok(exactSelection.includes("root?.dataset?.rvmHierarchyController === 'format-neutral'"), 'bridge must only run on format-neutral source trees');
assert.ok(exactSelection.includes('EXACT_SELECTION_SOURCE_KINDS'), 'bridge must be gated to source-preview-like formats');
assert.ok(exactSelection.includes('idCandidates(node, row)'), 'bridge must select from node/render ids before labels');
assert.ok(exactSelection.includes('GENERIC_LABELS'), 'bridge must block generic label fallback such as FLANGE/VALVE/PIPE');
assert.ok(exactSelection.includes("event?.stopImmediatePropagation?.()"), 'bridge must stop the legacy capture handler after exact source selection');
assert.ok(!exactSelection.includes("sourceKind(root) === 'rvm'"), 'bridge must not hijack binary RVM hierarchy selection');

console.log('Verified format-neutral source hierarchy exact selection guard.');
