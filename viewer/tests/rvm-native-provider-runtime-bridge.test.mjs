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
const bridge = read('tabs/RvmNativeHierarchyProviderRuntimeBridge.js');

assert.ok(bridge.includes("RVM_NATIVE_HIERARCHY_PROVIDER_RUNTIME_VERSION = '20260628-rvm-native-provider-runtime-1'"), 'runtime bridge must expose version');
assert.ok(bridge.includes("attachNativeRvmHierarchyProvider(state, payload)"), 'runtime bridge must attach native provider through adapter');
assert.ok(bridge.includes("rvm-tree-rendered"), 'runtime bridge must attach during hierarchy render event');
assert.ok(bridge.includes("kind === 'rvm' || mode === 'rvm-native'"), 'runtime bridge must only activate for native RVM trees');
assert.ok(bridge.includes("__rvmNativeHierarchyProvider"), 'runtime bridge must store provider on root');
assert.ok(bridge.includes("rvm-hierarchy-provider-attached"), 'runtime bridge must dispatch attachment event');
assert.ok(renderer.includes('RvmNativeHierarchyProviderRuntimeBridge.js?v=20260628-rvm-native-provider-runtime-1'), 'renderer must import native provider runtime bridge');
assert.ok(renderer.includes('installRvmNativeHierarchyProviderRuntimeBridge()'), 'renderer must install native provider runtime bridge');

console.log('Verified native RVM provider runtime bridge contract.');
