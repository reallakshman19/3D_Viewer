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
const bridge = read('tabs/RvmHierarchyProviderValidationRecipeBridge.js');

assert.ok(bridge.includes("RVM_HIERARCHY_PROVIDER_VALIDATION_RECIPE_VERSION = '20260628-rvm-provider-validation-recipe-1'"), 'validation recipe bridge must expose version');
assert.ok(bridge.includes('rvm-hierarchy-provider-validation-recipe'), 'validation recipe panel must be created');
assert.ok(bridge.includes('Provider tree validation recipe'), 'validation recipe must have visible title');
assert.ok(bridge.includes('Load stagedJSON/source-preview with provider tree disabled'), 'recipe must start with baseline legacy mode');
assert.ok(bridge.includes('Export provider diagnostics before changing mode'), 'recipe must ask for diagnostics before switching');
assert.ok(bridge.includes('Enable Provider tree read path only when parity is OK'), 'recipe must require parity OK before provider-tree mode');
assert.ok(bridge.includes('Apply provider tree on reload'), 'recipe must reference explicit reload flow');
assert.ok(bridge.includes('rvm-hierarchy-provider-diagnostics-exported'), 'recipe must update after diagnostics export');
assert.ok(renderer.includes('RvmHierarchyProviderValidationRecipeBridge.js?v=20260628-rvm-provider-validation-recipe-1'), 'renderer must import validation recipe bridge');
assert.ok(renderer.includes('installRvmHierarchyProviderValidationRecipeBridge()'), 'renderer must install validation recipe bridge');

console.log('Verified hierarchy provider validation recipe bridge contract.');
