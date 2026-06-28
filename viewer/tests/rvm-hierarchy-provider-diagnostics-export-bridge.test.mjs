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
const bridge = read('tabs/RvmHierarchyProviderDiagnosticsExportBridge.js');

assert.ok(bridge.includes("RVM_HIERARCHY_PROVIDER_DIAGNOSTICS_EXPORT_VERSION = '20260628-rvm-provider-diagnostics-export-1'"), 'export bridge must expose version');
assert.ok(bridge.includes('buildRvmHierarchyProviderDiagnosticsExport'), 'export bridge must expose builder');
assert.ok(bridge.includes('__rvmHierarchyProviderHealth'), 'export must include health report');
assert.ok(bridge.includes('__rvmHierarchyProviderParityAudit'), 'export must include parity report');
assert.ok(bridge.includes('rvm-hierarchy-provider-diagnostics-export'), 'export bridge must create export panel/button');
assert.ok(bridge.includes('Export provider diagnostics'), 'export button must be visible in diagnostics');
assert.ok(bridge.includes('Blob'), 'export bridge must create downloadable JSON');
assert.ok(bridge.includes('rvm-hierarchy-provider-diagnostics-exported'), 'export bridge must dispatch exported event');
assert.ok(bridge.includes('rvm-hierarchy-provider-parity-audit'), 'export bridge must update after parity audit');
assert.ok(renderer.includes('RvmHierarchyProviderDiagnosticsExportBridge.js?v=20260628-rvm-provider-diagnostics-export-1'), 'renderer must import diagnostics export bridge');
assert.ok(renderer.includes('installRvmHierarchyProviderDiagnosticsExportBridge()'), 'renderer must install diagnostics export bridge');

console.log('Verified hierarchy provider diagnostics export bridge contract.');
