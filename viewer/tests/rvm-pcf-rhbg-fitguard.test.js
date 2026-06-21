import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}

const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const stagedJsonSource = await fs.readFile(new URL('../tabs/RvmStagedJsonExportBridge.js', import.meta.url), 'utf8');
const acceptanceSource = await fs.readFile(new URL('../tabs/RvmGlbAcceptancePackBridge.js', import.meta.url), 'utf8');
const exportBridgeSource = await fs.readFile(new URL('../tabs/RvmNativeSceneGlbExportBridge.js', import.meta.url), 'utf8');
const profileBridgeSource = await fs.readFile(new URL('../tabs/RvmGlbExportProfileBridge.js', import.meta.url), 'utf8');
const supportEngineSource = await fs.readFile(new URL('../tabs/RvmIntelligentSupportEngineBridge.js', import.meta.url), 'utf8');
const supportGeometrySource = await fs.readFile(new URL('../tabs/RvmSupportGeometryBridge.js', import.meta.url), 'utf8');
const supportAttSource = await fs.readFile(new URL('../tabs/RvmSupportAttMappingBridge.js', import.meta.url), 'utf8');
const validationBridgeSource = await fs.readFile(new URL('../tabs/RvmGlbExportValidationBridge.js', import.meta.url), 'utf8');
const roundTripBridgeSource = await fs.readFile(new URL('../tabs/RvmGlbRoundTripValidationBridge.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');

check(rendererSource.includes('RvmStagedJsonExportBridge.js?v=20260620-rvm-stagedjson-export-1'), 'renderer loads stagedJSON export bridge');
check(rendererSource.includes('installRvmStagedJsonExportBridge()'), 'renderer installs stagedJSON export bridge');
check(rendererSource.indexOf('installRvmSupportAttMappingBridge()') < rendererSource.indexOf('installRvmStagedJsonExportBridge()'), 'stagedJSON installs after support ATT mapping');
check(rendererSource.indexOf('installRvmStagedJsonExportBridge()') < rendererSource.indexOf('installRvmNativeSceneGlbExportBridge()'), 'stagedJSON installs before GLB export/validation flows');
check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260620-rvm-stagedjson-export-1'), 'renderer cache key bumped for stagedJSON export');
check(stagedJsonSource.includes('rvm-stagedjson-export/v1-rvm-att-components-supports'), 'stagedJSON schema present');
check(stagedJsonSource.includes('__PCF_GLB_RVM_STAGEDJSON_EXPORT__') && stagedJsonSource.includes('__PCF_GLB_RVM_STAGEDJSON_EXPORT_DIAGNOSTICS__'), 'stagedJSON API and diagnostics globals present');
check(stagedJsonSource.includes('StagedJSON') && stagedJsonSource.includes('Geometry') && stagedJsonSource.includes('Support'), 'stagedJSON controls expose geometry and support export');
check(stagedJsonSource.includes('branches') && stagedJsonSource.includes('supportRecords'), 'stagedJSON output includes branch/component and support records');
check(stagedJsonSource.includes('APOS') && stagedJsonSource.includes('LPOS') && stagedJsonSource.includes('BPOS') && stagedJsonSource.includes('HBOR'), 'stagedJSON preserves positional and bore fields');
check(stagedJsonSource.includes('SUPPORT_KIND') && stagedJsonSource.includes('PS_NO') && stagedJsonSource.includes('SOURCE_UUIDS'), 'support stagedJSON fields are present');
check(acceptanceSource.includes('rvm-glb-acceptance-pack/v2-stagedjson'), 'acceptance pack schema upgraded for stagedJSON');
check(acceptanceSource.includes('__PCF_GLB_RVM_STAGEDJSON_EXPORT__') && acceptanceSource.includes('stagedJsonExported'), 'acceptance pack requires stagedJSON evidence');
check(exportBridgeSource.includes('rvm-native-scene-glb-export/v3-component-hierarchy'), 'native GLB export schema v3 remains available');
check(profileBridgeSource.includes('rvm-glb-export-profile/v1-units-orientation-contract'), 'GLB export profile remains available');
check(supportEngineSource.includes('rvm-intelligent-support-engine/v1-scored-mappable'), 'support engine remains available');
check(supportGeometrySource.includes('rvm-support-geometry/v1-exportable-overlay'), 'support geometry bridge remains available');
check(supportAttSource.includes('rvm-support-att-stagedjson-mapping/v1-support-extras'), 'support ATT mapping remains available');
check(validationBridgeSource.includes('rvm-glb-export-validation/v1-json-bin-extras'), 'GLB export validation still present');
check(roundTripBridgeSource.includes('rvm-glb-roundtrip-validation/v1-loader-extras-bounds'), 'GLB roundtrip validation still present');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260620-rvm-stagedjson-export-1'), 'index loads stagedJSON entrypoint cache');
check(entrySource.includes('core/app.js?v=20260620-rvm-stagedjson-export-1'), 'entrypoint loads stagedJSON app cache key');
check(entrySource.includes('Promise.allSettled') && entrySource.includes('optional startup module failed'), 'guarded entrypoint remains protected');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
