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
const bridge = read('tabs/RvmHierarchyProviderDebugBridge.js');

assert.ok(bridge.includes("RVM_HIERARCHY_PROVIDER_DEBUG_VERSION = '20260629-rvm-provider-runtime-telemetry-1'"), 'debug bridge must expose runtime telemetry version');
assert.ok(bridge.includes('rvm-hierarchy-provider-debug'), 'debug bridge must create debug panel');
assert.ok(bridge.includes('data-rvm-provider-tree-toggle'), 'debug view must expose provider tree opt-in toggle');
assert.ok(bridge.includes('data-rvm-provider-tree-apply-reload'), 'debug view must expose explicit reload apply button');
assert.ok(bridge.includes('parityHardFailures'), 'debug bridge must evaluate parity hard failures before reload');
assert.ok(bridge.includes('providerTreeReloadAllowed'), 'debug bridge must gate provider-tree reload');
assert.ok(bridge.includes('data-rvm-provider-tree-parity-override'), 'debug bridge must expose explicit parity override');
assert.ok(bridge.includes('rvm-provider-tree-read-path-reload-blocked'), 'blocked reload must dispatch event');
assert.ok(bridge.includes('rvm-provider-tree-parity-override-toggle'), 'override toggle must dispatch event');
assert.ok(bridge.includes('SESSION_PARITY_OVERRIDE_KEY'), 'override must be browser-session scoped');
assert.ok(bridge.includes('rvm-provider-tree-read-path-reload-request'), 'allowed reload must dispatch reload request event');
assert.ok(bridge.includes('location.reload()'), 'allowed reload must request clean page reload only after explicit click');
assert.ok(bridge.includes('rvm-hierarchy-provider-parity-audit'), 'debug bridge must update when parity audit changes');
assert.ok(bridge.includes('__PCF_GLB_RVM_HIERARCHY_READ_PATH_TELEMETRY__'), 'debug bridge must read runtime read-path telemetry');
assert.ok(bridge.includes('rvmHierarchyReadPath'), 'debug bridge must stamp read path dataset marker');
assert.ok(bridge.includes('rvmHierarchyProviderCandidateCount'), 'debug bridge must stamp provider candidate count');
assert.ok(bridge.includes('Tree read path'), 'debug panel must display tree read path');
assert.ok(bridge.includes('Provider candidates'), 'debug panel must display provider candidate count');
assert.ok(renderer.includes('RvmHierarchyProviderDebugBridge.js?v=20260629-rvm-provider-runtime-telemetry-1'), 'renderer must import provider debug bridge with telemetry cache key');
assert.ok(renderer.includes('installRvmHierarchyProviderDebugBridge()'), 'renderer must install provider debug bridge');

console.log('Verified hierarchy provider runtime telemetry debug contract.');
