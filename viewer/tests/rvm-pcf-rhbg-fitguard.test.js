import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}

const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const exportBridgeSource = await fs.readFile(new URL('../tabs/RvmNativeSceneGlbExportBridge.js', import.meta.url), 'utf8');
const acceptanceSource = await fs.readFile(new URL('../tabs/RvmGlbAcceptancePackBridge.js', import.meta.url), 'utf8');
const supportEngineSource = await fs.readFile(new URL('../tabs/RvmIntelligentSupportEngineBridge.js', import.meta.url), 'utf8');
const supportGeometrySource = await fs.readFile(new URL('../tabs/RvmSupportGeometryBridge.js', import.meta.url), 'utf8');
const supportAttSource = await fs.readFile(new URL('../tabs/RvmSupportAttMappingBridge.js', import.meta.url), 'utf8');
const validationBridgeSource = await fs.readFile(new URL('../tabs/RvmGlbExportValidationBridge.js', import.meta.url), 'utf8');
const roundTripBridgeSource = await fs.readFile(new URL('../tabs/RvmGlbRoundTripValidationBridge.js', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../core/app.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');

check(rendererSource.includes('RvmNativeSceneGlbExportBridge.js?v=20260620-rvm-glb-export-logic-v2-1'), 'renderer loads hardened GLB export logic bridge');
check(rendererSource.includes('installRvmNativeSceneGlbExportBridge()'), 'renderer installs native GLB export bridge');
check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260620-rvm-glb-export-logic-v2-1'), 'renderer cache key bumped for GLB export logic');
check(rendererSource.indexOf('installRvmNativeSceneGlbExportBridge()') < rendererSource.indexOf('installRvmGlbExportValidationBridge()'), 'export bridge installs before validation bridge');
check(exportBridgeSource.includes('rvm-native-scene-glb-export/v2-pipeline-preflight'), 'native GLB export schema v2 present');
check(exportBridgeSource.includes('20260620-rvm-glb-export-logic-v2-1'), 'native GLB export cache key present');
check(exportBridgeSource.includes('pipelineStages') && exportBridgeSource.includes('preflight-gate'), 'export pipeline stages audited');
check(exportBridgeSource.includes('prepareVisible') && exportBridgeSource.includes('prepareSelected') && exportBridgeSource.includes('exportScope'), 'export API exposes prepare/export functions');
check(exportBridgeSource.includes('Plan JSON') && exportBridgeSource.includes('downloadPlan'), 'export plan JSON control present');
check(exportBridgeSource.includes('collect-source-meshes') && exportBridgeSource.includes('normalize-rvm-att-metadata'), 'export logic documents collection and metadata normalization');
check(exportBridgeSource.includes('clone-world-transformed-rendered-objects'), 'export logic uses world-transformed rendered objects');
check(exportBridgeSource.includes('metadataFieldCounts') && exportBridgeSource.includes('glbExportNormalizedMetadata'), 'metadata normalization is exported and audited');
check(exportBridgeSource.includes('blockInvalidBounds') && exportBridgeSource.includes('fallback-objects-present'), 'preflight policy gates invalid bounds and optional fallbacks');
check(exportBridgeSource.includes('supportEngineDiagnostics') && exportBridgeSource.includes('supportAttDiagnostics'), 'support export diagnostics are attached to audit');
check(acceptanceSource.includes('rvm-glb-acceptance-pack/v1-end-to-end'), 'acceptance pack remains available');
check(acceptanceSource.includes('exportVisible') && acceptanceSource.includes('validateBlob') && acceptanceSource.includes('validateBlobRoundTrip'), 'acceptance pack chains export, validation, and roundtrip');
check(supportEngineSource.includes('rvm-intelligent-support-engine/v1-scored-mappable'), 'support engine remains available');
check(supportGeometrySource.includes('rvm-support-geometry/v1-exportable-overlay'), 'support geometry bridge remains available');
check(supportAttSource.includes('rvm-support-att-stagedjson-mapping/v1-support-extras'), 'support ATT mapping remains available');
check(validationBridgeSource.includes('rvm-glb-export-validation/v1-json-bin-extras'), 'GLB export validation still present');
check(roundTripBridgeSource.includes('rvm-glb-roundtrip-validation/v1-loader-extras-bounds'), 'GLB roundtrip validation still present');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260620-rvm-glb-export-logic-v2-1'), 'app loads GLB export logic renderer');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260620-rvm-glb-export-logic-v2-1'), 'index loads GLB export logic entrypoint');
check(entrySource.includes('core/app.js?v=20260620-rvm-glb-export-logic-v2-1'), 'entrypoint loads GLB export logic app cache key');
check(entrySource.includes('Promise.allSettled') && entrySource.includes('optional startup module failed'), 'guarded entrypoint remains protected');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
