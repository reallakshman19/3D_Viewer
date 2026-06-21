import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}

const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const supportEngineSource = await fs.readFile(new URL('../tabs/RvmIntelligentSupportEngineBridge.js', import.meta.url), 'utf8');
const supportGeometrySource = await fs.readFile(new URL('../tabs/RvmSupportGeometryBridge.js', import.meta.url), 'utf8');
const supportAttSource = await fs.readFile(new URL('../tabs/RvmSupportAttMappingBridge.js', import.meta.url), 'utf8');
const exportBridgeSource = await fs.readFile(new URL('../tabs/RvmNativeSceneGlbExportBridge.js', import.meta.url), 'utf8');
const validationBridgeSource = await fs.readFile(new URL('../tabs/RvmGlbExportValidationBridge.js', import.meta.url), 'utf8');
const roundTripBridgeSource = await fs.readFile(new URL('../tabs/RvmGlbRoundTripValidationBridge.js', import.meta.url), 'utf8');
const selectionParitySource = await fs.readFile(new URL('../tabs/RvmGlbSelectionParityBridge.js', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../core/app.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');

check(rendererSource.includes('RvmIntelligentSupportEngineBridge.js?v=20260620-rvm-intelligent-support-engine-1'), 'renderer loads intelligent support engine bridge');
check(rendererSource.includes('installRvmIntelligentSupportEngineBridge()'), 'renderer installs intelligent support engine bridge');
check(rendererSource.indexOf('installRvmIntelligentSupportEngineBridge()') < rendererSource.indexOf('installRvmSupportGeometryBridge()'), 'engine runs before support geometry overlay');
check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260620-rvm-intelligent-support-engine-1'), 'renderer cache key bumped');
check(supportEngineSource.includes('rvm-intelligent-support-engine/v1-scored-mappable'), 'support engine schema present');
check(supportEngineSource.includes('__PCF_GLB_RVM_INTELLIGENT_SUPPORT_ENGINE_DIAGNOSTICS__'), 'support engine diagnostics global present');
check(supportEngineSource.includes('__PCF_GLB_RVM_INTELLIGENT_SUPPORT_ENGINE__'), 'support engine API global present');
check(supportEngineSource.includes('SupportEngine') && supportEngineSource.includes('Scan') && supportEngineSource.includes('AutoMap') && supportEngineSource.includes('Clear'), 'support engine controls present');
check(supportEngineSource.includes('SUPPORT_ENGINE_CONFIDENCE') && supportEngineSource.includes('SUPPORT_ENGINE_REASON'), 'support engine writes confidence and reason metadata');
check(supportEngineSource.includes('rvmSupportCandidate') && supportEngineSource.includes('RVM_BROWSER_SUPPORT_HINT'), 'support engine marks support candidates for geometry overlay');
check(supportEngineSource.includes('nearestPipeDistance') && supportEngineSource.includes('mappingReady'), 'support engine proximity and mapping readiness scoring present');
check(supportEngineSource.includes('supportStagedJsonRecords') && supportEngineSource.includes('SOURCE_UUIDS'), 'support engine emits stagedJSON-style support records');
check(supportEngineSource.includes('data-rvm-support-engine-uuid') && supportEngineSource.includes('setSelectionFromObjects'), 'support engine rows can select candidate objects');
check(supportGeometrySource.includes('rvm-support-geometry/v1-exportable-overlay'), 'support geometry bridge remains available');
check(supportGeometrySource.includes('SupportGeom') && supportGeometrySource.includes('Overlay') && supportGeometrySource.includes('Replace'), 'support geometry modes remain available');
check(supportAttSource.includes('rvm-support-att-stagedjson-mapping/v1-support-extras'), 'support ATT mapping bridge remains available');
check(supportAttSource.includes('supportAttMapped') && supportAttSource.includes('browserRvmAttributes'), 'support ATT mapping still writes node extras');
check(exportBridgeSource.includes('rvm-native-scene-glb-export/v1-att-extras'), 'native GLB export still present');
check(validationBridgeSource.includes('rvm-glb-export-validation/v1-json-bin-extras'), 'GLB export validation still present');
check(roundTripBridgeSource.includes('rvm-glb-roundtrip-validation/v1-loader-extras-bounds'), 'GLB roundtrip validation still present');
check(selectionParitySource.includes('rvm-glb-selection-details-parity/v1-extras-selection-map'), 'GLB selection parity still present');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260620-rvm-intelligent-support-engine-1'), 'app loads intelligent support engine renderer');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260620-rvm-intelligent-support-engine-1'), 'index loads intelligent support engine entrypoint');
check(entrySource.includes('core/app.js?v=20260620-rvm-intelligent-support-engine-1'), 'entrypoint loads intelligent support engine app cache key');
check(entrySource.includes('Promise.allSettled') && entrySource.includes('optional startup module failed'), 'guarded entrypoint remains protected');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
