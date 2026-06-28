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

assert.ok(bridge.includes("RVM_HIERARCHY_PROVIDER_DEBUG_VERSION = '20260628-rvm-provider-debug-reload-hook-1'"), 'debug bridge must expose reload hook version');
assert.ok(bridge.includes('rvm-hierarchy-provider-debug'), 'debug bridge must create debug panel');
assert.ok(bridge.includes('Hierarchy Provider'), 'debug view must title the provider panel');
assert.ok(bridge.includes('Source kind'), 'debug view must show source kind');
assert.ok(bridge.includes('Authority'), 'debug view must show provider authority');
assert.ok(bridge.includes('Node count'), 'debug view must show node count');
assert.ok(bridge.includes('data-rvm-provider-tree-toggle'), 'debug view must expose provider tree opt-in toggle');
assert.ok(bridge.includes('data-rvm-provider-tree-apply-reload'), 'debug view must expose explicit reload apply button');
assert.ok(bridge.includes('sessionStorage'), 'reload hook must persist opt-in only for the browser session');
assert.ok(bridge.includes('rvm-provider-tree-read-path-toggle'), 'toggle must dispatch a debug event');
assert.ok(bridge.includes('rvm-provider-tree-read-path-reload-request'), 'reload apply must dispatch a debug event');
assert.ok(bridge.includes('location.reload()'), 'reload apply must request a clean page reload only after explicit click');
assert.ok(bridge.includes('rvm-tree-rendered'), 'debug bridge must update after tree render');
assert.ok(bridge.includes('rvm-hierarchy-provider-attached'), 'debug bridge must update after native provider attachment');
assert.ok(renderer.includes('RvmHierarchyProviderDebugBridge.js?v=20260628-rvm-provider-debug-reload-hook-1'), 'renderer must import provider debug bridge with reload hook cache key');
assert.ok(renderer.includes('installRvmHierarchyProviderDebugBridge()'), 'renderer must install provider debug bridge');

console.log('Verified hierarchy provider debug reload hook contract.');
