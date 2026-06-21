import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}

const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const exportBridgeSource = await fs.readFile(new URL('../tabs/RvmNativeSceneGlbExportBridge.js', import.meta.url), 'utf8');
const profileBridgeSource = await fs.readFile(new URL('../tabs/RvmGlbExportProfileBridge.js', import.meta.url), 'utf8');
const acceptanceSource = await fs.readFile(new URL('../tabs/RvmGlbAcceptancePackBridge.js', import.meta.url), 'utf8');
const supportEngineSource = await fs.readFile(new URL('../tabs/RvmIntelligentSupportEngineBridge.js', import.meta.url), 'utf8');
const supportGeometrySource = await fs.readFile(new URL('../tabs/RvmSupportGeometryBridge.js', import.meta.url), 'utf8');
const supportAttSource = await fs.readFile(new URL('../tabs/RvmSupportAttMappingBridge.js', import.meta.url), 'utf8');
const validationBridgeSource = await fs.readFile(new URL('../tabs/RvmGlbExportValidationBridge.js', import.meta.url), 'utf8');
const roundTripBridgeSource = await fs.readFile(new URL('../tabs/RvmGlbRoundTripValidationBridge.js', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../core/app.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');

check(rendererSource.includes('RvmNativeSceneGlbExportBridge.js?v=20260620-rvm-glb-component-hierarchy-v3-1'), 'renderer still loads component hierarchy GLB export bridge');
check(rendererSource.includes('RvmGlbExportProfileBridge.js?v=20260620-rvm-glb-export-profile-units-1'), 'renderer loads GLB export profile bridge');
check(rendererSource.includes('installRvmGlbExportProfileBridge()'), 'renderer installs GLB export profile bridge');
check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260620-rvm-glb-export-profile-units-1'), 'renderer cache key bumped for GLB export profile');
check(rendererSource.indexOf('installRvmNativeSceneGlbExportBridge()') < rendererSource.indexOf('installRvmGlbExportProfileBridge()'), 'profile bridge installs after native exporter');
check(rendererSource.indexOf('installRvmGlbExportProfileBridge()') < rendererSource.indexOf('installRvmGlbExportValidationBridge()'), 'profile bridge installs before validation bridge');
check(exportBridgeSource.includes('rvm-native-scene-glb-export/v3-component-hierarchy'), 'native GLB export schema v3 remains available');
check(exportBridgeSource.includes('RVM_EXPORT_ROOT') && exportBridgeSource.includes('componentHierarchySchema'), 'native exporter still emits component hierarchy');
check(exportBridgeSource.includes('componentGroups') && exportBridgeSource.includes('glbExportNodePath'), 'native exporter still audits component paths');
check(profileBridgeSource.includes('rvm-glb-export-profile/v1-units-orientation-contract'), 'GLB export profile schema present');
check(profileBridgeSource.includes('RVM_NATIVE_SCENE_METERS_WORLD_MATRIX_V1'), 'GLB export profile id present');
check(profileBridgeSource.includes('unitScaleToMeters') && profileBridgeSource.includes('glbUnits') && profileBridgeSource.includes('sourceUnits'), 'unit contract is declared');
check(profileBridgeSource.includes('coordinateSystem') && profileBridgeSource.includes('axisRemap') && profileBridgeSource.includes('transformPolicy'), 'coordinate/orientation contract is declared');
check(profileBridgeSource.includes('glbExportProfile') && profileBridgeSource.includes('node.userData'), 'profile is written to exported node extras');
check(profileBridgeSource.includes('ExportProfile') && profileBridgeSource.includes('Profile JSON'), 'profile controls are present');
check(profileBridgeSource.includes('__PCF_GLB_RVM_GLB_EXPORT_PROFILE_DIAGNOSTICS__'), 'profile diagnostics global is exposed');
check(acceptanceSource.includes('rvm-glb-acceptance-pack/v1-end-to-end'), 'acceptance pack remains available');
check(supportEngineSource.includes('rvm-intelligent-support-engine/v1-scored-mappable'), 'support engine remains available');
check(supportGeometrySource.includes('rvm-support-geometry/v1-exportable-overlay'), 'support geometry bridge remains available');
check(supportAttSource.includes('rvm-support-att-stagedjson-mapping/v1-support-extras'), 'support ATT mapping remains available');
check(validationBridgeSource.includes('rvm-glb-export-validation/v1-json-bin-extras'), 'GLB export validation still present');
check(roundTripBridgeSource.includes('rvm-glb-roundtrip-validation/v1-loader-extras-bounds'), 'GLB roundtrip validation still present');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260620-rvm-glb-export-profile-units-1'), 'app loads GLB export profile renderer');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260620-rvm-glb-export-profile-units-1'), 'index loads GLB export profile entrypoint');
check(entrySource.includes('core/app.js?v=20260620-rvm-glb-export-profile-units-1'), 'entrypoint loads GLB export profile app cache key');
check(entrySource.includes('Promise.allSettled') && entrySource.includes('optional startup module failed'), 'guarded entrypoint remains protected');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
