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
const bridge = read('tabs/RvmHierarchyProviderHealthBridge.js');

assert.ok(bridge.includes("RVM_HIERARCHY_PROVIDER_HEALTH_VERSION = '20260628-rvm-provider-health-check-1'"), 'health bridge must expose version');
assert.ok(bridge.includes('evaluateRvmHierarchyProviderHealth'), 'health bridge must expose evaluator');
assert.ok(bridge.includes('source-provider-missing'), 'health bridge must flag missing source provider');
assert.ok(bridge.includes('native-rvm-provider-missing'), 'health bridge must flag missing native RVM provider');
assert.ok(bridge.includes('provider-node-count-mismatch'), 'health bridge must flag node count mismatch');
assert.ok(bridge.includes('__rvmHierarchyProviderHealth'), 'health bridge must store latest health result on root');
assert.ok(bridge.includes('rvm-hierarchy-provider-health'), 'health bridge must dispatch health event');
assert.ok(bridge.includes('rvm-tree-rendered'), 'health bridge must update after tree render');
assert.ok(bridge.includes('rvm-hierarchy-provider-attached'), 'health bridge must update after native provider attach');
assert.ok(renderer.includes('RvmHierarchyProviderHealthBridge.js?v=20260628-rvm-provider-health-check-1'), 'renderer must import health bridge');
assert.ok(renderer.includes('installRvmHierarchyProviderHealthBridge()'), 'renderer must install health bridge');

console.log('Verified hierarchy provider health bridge contract.');
