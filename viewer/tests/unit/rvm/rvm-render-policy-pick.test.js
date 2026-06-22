import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}
async function read(path) { return fs.readFile(new URL(path, import.meta.url), 'utf8'); }

const renderer = await read('../../../tabs/viewer3d-rvm-tab-renderer.js');
const policy = await read('../../../rvm/BrowserRvmRenderPolicyBridge.js');
const pick = await read('../../../rvm/BrowserRvmPickDiagnosticsBridge.js');
const selection = await read('../../../rvm-viewer/RvmSelectionAdapter.js');
const hierarchy = await read('../../../tabs/RvmHierarchyModelBuilder.js');
const zone = await read('../../../tabs/RvmCanonicalZoneSelectorBridge.js');

check(renderer.includes('installBrowserRvmRenderPolicyBridge()'), 'renderer installs central render policy');
check(renderer.includes('installBrowserRvmPickDiagnosticsBridge()'), 'renderer installs debug pick diagnostics');
check(policy.includes("browser-rvm-render-policy/v1"), 'render policy schema is versioned');
check(policy.includes('bbox-placeholder-diagnostic-wireframe'), 'bbox placeholders are diagnostic wireframe');
check(policy.includes('native-facet-diagnostic-edge-overlay'), 'native facet helper edges are diagnostic');
check(policy.includes('suspicious-large-cone-fan-envelope'), 'suspicious cone/fan geometry is detected');
check(policy.includes('visibleNonPickableCount') && policy.includes('nonPickableReasons'), 'visible non-pickable diagnostics are counted');
check(pick.includes('__PCF_GLB_RVM_DEBUG_PICK__'), 'debug pick API is published');
check(pick.includes('inspectAtClientPoint') && pick.includes('summarizeNonPickableVisibleObjects'), 'debug pick API exposes required methods');
check(selection.includes('data.pickable !== false') && selection.includes('data.selectable !== false'), 'selection honors pickable/selectable metadata');
check(selection.includes('diagnosticHit') && selection.includes('nonSelectableReason'), 'diagnostic clicks report a reason');
check(hierarchy.includes("rvm-canonical-hierarchy-model/v1") && hierarchy.includes('normalizeRvmReviewPath'), 'canonical hierarchy builder exists');
check(hierarchy.includes('TECHNICAL_CONTAINER_NAMES') && hierarchy.includes('STRUCTURE'), 'hierarchy builder normalizes technical structure containers');
check(zone.includes('buildRvmHierarchyModelFromZoneRows') && zone.includes('browser-rvm-zone-selection/v3-canonical-hierarchy-checkbox-tree'), 'canonical zone selector uses hierarchy model');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
