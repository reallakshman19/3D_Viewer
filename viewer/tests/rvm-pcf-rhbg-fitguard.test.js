import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}

const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const acceptanceSource = await fs.readFile(new URL('../tabs/RvmGlbAcceptancePackBridge.js', import.meta.url), 'utf8');
const supportEngineSource = await fs.readFile(new URL('../tabs/RvmIntelligentSupportEngineBridge.js', import.meta.url), 'utf8');
const supportGeometrySource = await fs.readFile(new URL('../tabs/RvmSupportGeometryBridge.js', import.meta.url), 'utf8');
const supportAttSource = await fs.readFile(new URL('../tabs/RvmSupportAttMappingBridge.js', import.meta.url), 'utf8');
const exportBridgeSource = await fs.readFile(new URL('../tabs/RvmNativeSceneGlbExportBridge.js', import.meta.url), 'utf8');
const validationBridgeSource = await fs.readFile(new URL('../tabs/RvmGlbExportValidationBridge.js', import.meta.url), 'utf8');
const roundTripBridgeSource = await fs.readFile(new URL('../tabs/RvmGlbRoundTripValidationBridge.js', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../core/app.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');

check(rendererSource.includes('RvmGlbAcceptancePackBridge.js?v=20260620-rvm-glb-acceptance-pack-1'), 'renderer loads GLB acceptance pack bridge');
check(rendererSource.includes('installRvmGlbAcceptancePackBridge()'), 'renderer installs GLB acceptance pack bridge');
check(rendererSource.indexOf('installRvmGlbSelectionParityBridge()') < rendererSource.indexOf('installRvmGlbAcceptancePackBridge()'), 'acceptance pack runs after GLB validation/detail bridges');
check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260620-rvm-glb-acceptance-pack-1'), 'renderer cache key bumped');
check(acceptanceSource.includes('rvm-glb-acceptance-pack/v1-end-to-end'), 'acceptance pack schema present');
check(acceptanceSource.includes('__PCF_GLB_RVM_GLB_ACCEPTANCE_PACK_DIAGNOSTICS__'), 'acceptance diagnostics global present');
check(acceptanceSource.includes('__PCF_GLB_RVM_GLB_ACCEPTANCE_PACK__'), 'acceptance API global present');
check(acceptanceSource.includes('Accept') && acceptanceSource.includes('Geometry') && acceptanceSource.includes('Support'), 'acceptance controls present');
check(acceptanceSource.includes('exportVisible') && acceptanceSource.includes('validateBlob') && acceptanceSource.includes('validateBlobRoundTrip'), 'acceptance pack chains export, validation, and roundtrip');
check(acceptanceSource.includes('support-engine-api-not-ready') && acceptanceSource.includes('rvm_support_geometry_mode_v1'), 'acceptance pack controls support engine/geometry mode');
check(acceptanceSource.includes('supportMetadataMapped') && acceptanceSource.includes('metadataRoundTripPassed'), 'acceptance gates support metadata and metadata roundtrip');
check(supportEngineSource.includes('rvm-intelligent-support-engine/v1-scored-mappable'), 'support engine remains available');
check(supportGeometrySource.includes('rvm-support-geometry/v1-exportable-overlay'), 'support geometry bridge remains available');
check(supportAttSource.includes('rvm-support-att-stagedjson-mapping/v1-support-extras'), 'support ATT mapping remains available');
check(exportBridgeSource.includes('rvm-native-scene-glb-export/v1-att-extras'), 'native GLB export still present');
check(validationBridgeSource.includes('rvm-glb-export-validation/v1-json-bin-extras'), 'GLB export validation still present');
check(roundTripBridgeSource.includes('rvm-glb-roundtrip-validation/v1-loader-extras-bounds'), 'GLB roundtrip validation still present');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260620-rvm-glb-acceptance-pack-1'), 'app loads GLB acceptance renderer');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260620-rvm-glb-acceptance-pack-1'), 'index loads GLB acceptance entrypoint');
check(entrySource.includes('core/app.js?v=20260620-rvm-glb-acceptance-pack-1'), 'entrypoint loads GLB acceptance app cache key');
check(entrySource.includes('Promise.allSettled') && entrySource.includes('optional startup module failed'), 'guarded entrypoint remains protected');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
