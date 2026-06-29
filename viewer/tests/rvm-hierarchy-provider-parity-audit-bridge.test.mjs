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
const bridge = read('tabs/RvmHierarchyProviderParityAuditBridge.js');

assert.ok(bridge.includes("RVM_HIERARCHY_PROVIDER_PARITY_AUDIT_VERSION = '20260628-rvm-provider-parity-audit-1'"), 'parity bridge must expose version');
assert.ok(bridge.includes('evaluateRvmHierarchyProviderParity'), 'parity bridge must expose evaluator');
assert.ok(bridge.includes('missingInProvider'), 'parity audit must track IDs missing in provider');
assert.ok(bridge.includes('missingInLegacy'), 'parity audit must track IDs missing in legacy tree');
assert.ok(bridge.includes('duplicateLegacyIds'), 'parity audit must track duplicate legacy IDs');
assert.ok(bridge.includes('duplicateProviderIds'), 'parity audit must track duplicate provider IDs');
assert.ok(bridge.includes('parentMismatches'), 'parity audit must track parent mismatches');
assert.ok(bridge.includes('__rvmHierarchyProviderParityAudit'), 'parity audit must store latest report on root');
assert.ok(bridge.includes('rvm-hierarchy-provider-parity-audit'), 'parity audit must dispatch event');
assert.ok(bridge.includes('rvm-tree-rendered'), 'parity audit must update after tree render');
assert.ok(bridge.includes('rvm-hierarchy-provider-attached'), 'parity audit must update after provider attach');
assert.ok(renderer.includes('RvmHierarchyProviderParityAuditBridge.js?v=20260628-rvm-provider-parity-audit-1'), 'renderer must import parity bridge');
assert.ok(renderer.includes('installRvmHierarchyProviderParityAuditBridge()'), 'renderer must install parity bridge');

console.log('Verified hierarchy provider parity audit bridge contract.');
