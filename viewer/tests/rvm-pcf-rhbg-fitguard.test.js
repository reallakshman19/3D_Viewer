import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}

const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const fallbackBridgeSource = await fs.readFile(new URL('../tabs/RvmPrimitiveFallbackBridge.js', import.meta.url), 'utf8');
const exportBridgeSource = await fs.readFile(new URL('../tabs/RvmNativeSceneGlbExportBridge.js', import.meta.url), 'utf8');
const validationBridgeSource = await fs.readFile(new URL('../tabs/RvmGlbExportValidationBridge.js', import.meta.url), 'utf8');
const roundTripBridgeSource = await fs.readFile(new URL('../tabs/RvmGlbRoundTripValidationBridge.js', import.meta.url), 'utf8');
const selectionParitySource = await fs.readFile(new URL('../tabs/RvmGlbSelectionParityBridge.js', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../core/app.js', import.meta.url), 'utf8');
const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const entrySource = await fs.readFile(new URL('../main-rhbg-fitguard.js', import.meta.url), 'utf8');

check(rendererSource.includes('RvmPrimitiveFallbackBridge.js?v=20260620-rvm-primitive-fallback-clickable-1'), 'renderer loads clickable primitive fallback bridge');
check(rendererSource.includes('installRvmPrimitiveFallbackBridge()'), 'renderer installs primitive fallback bridge');
check(rendererSource.includes('RvmNativeSceneGlbExportBridge.js?v=20260620-rvm-native-scene-glb-export-1'), 'renderer loads native scene GLB export bridge');
check(rendererSource.includes('installRvmNativeSceneGlbExportBridge()'), 'renderer installs native scene GLB export bridge');
check(rendererSource.includes('RvmGlbExportValidationBridge.js?v=20260620-rvm-glb-export-validation-1'), 'renderer loads GLB export validation bridge');
check(rendererSource.includes('installRvmGlbExportValidationBridge()'), 'renderer installs GLB export validation bridge');
check(rendererSource.includes('RvmGlbRoundTripValidationBridge.js?v=20260620-rvm-glb-roundtrip-validation-1'), 'renderer loads GLB round-trip validation bridge');
check(rendererSource.includes('installRvmGlbRoundTripValidationBridge()'), 'renderer installs GLB round-trip validation bridge');
check(rendererSource.includes('RvmGlbSelectionParityBridge.js?v=20260620-rvm-glb-selection-details-parity-1'), 'renderer loads GLB selection parity bridge');
check(rendererSource.includes('installRvmGlbSelectionParityBridge()'), 'renderer installs GLB selection parity bridge');
check(rendererSource.includes('viewer3d-rvm-tab.js?v=20260620-rvm-glb-selection-details-parity-1'), 'renderer loads GLB selection parity tab cache key');
check(fallbackBridgeSource.includes('rvm-primitive-fallback-review/v2-clickable-rows'), 'clickable fallback schema present');
check(fallbackBridgeSource.includes('__PCF_GLB_RVM_PRIMITIVE_FALLBACK_DIAGNOSTICS__'), 'fallback diagnostics global present');
check(fallbackBridgeSource.includes('selectFallback') && fallbackBridgeSource.includes('data-rvm-fallback-id'), 'fallback rows are selectable');
check(fallbackBridgeSource.includes('setSelectionFromObjects') && fallbackBridgeSource.includes('fitSelection'), 'fallback row selection fits selected object');
check(exportBridgeSource.includes('rvm-native-scene-glb-export/v1-att-extras'), 'native GLB export schema present');
check(exportBridgeSource.includes('exportSceneToGLB') && exportBridgeSource.includes('Visible GLB'), 'native export uses GLB exporter and visible action');
check(exportBridgeSource.includes('Selected GLB') && exportBridgeSource.includes('viewer._rvmCanvasSelectedMeshes'), 'selected native GLB export uses canvas selection');
check(exportBridgeSource.includes('browserRvmAttributes') && exportBridgeSource.includes('glbExportSchema'), 'ATT/userData metadata is preserved as GLB node extras');
check(validationBridgeSource.includes('rvm-glb-export-validation/v1-json-bin-extras'), 'GLB validation schema present');
check(validationBridgeSource.includes('__PCF_GLB_RVM_GLB_EXPORT_VALIDATION_DIAGNOSTICS__'), 'GLB validation diagnostics global present');
check(validationBridgeSource.includes('invalid-glb-magic') && validationBridgeSource.includes('missing-json-chunk'), 'GLB binary header/chunk validation present');
check(validationBridgeSource.includes('nodesWithExtras') && validationBridgeSource.includes('glbExportSchema'), 'GLB node extras validation present');
check(roundTripBridgeSource.includes('rvm-glb-roundtrip-validation/v1-loader-extras-bounds'), 'GLB round-trip schema present');
check(roundTripBridgeSource.includes('GLTFLoader') && roundTripBridgeSource.includes('loader.parse'), 'GLB round-trip uses GLTFLoader parse');
check(roundTripBridgeSource.includes('__PCF_GLB_RVM_GLB_ROUNDTRIP_VALIDATION_DIAGNOSTICS__'), 'GLB round-trip diagnostics global present');
check(roundTripBridgeSource.includes('meshCountMatched') && roundTripBridgeSource.includes('metadataRoundTripPassed'), 'GLB round-trip quality gates present');
check(roundTripBridgeSource.includes('boundsWithinTolerance') && roundTripBridgeSource.includes('importedBounds'), 'GLB round-trip bounds validation present');
check(roundTripBridgeSource.includes('RoundTrip') && roundTripBridgeSource.includes('Visible') && roundTripBridgeSource.includes('Selected'), 'GLB round-trip ribbon controls present');
check(selectionParitySource.includes('rvm-glb-selection-details-parity/v1-extras-selection-map'), 'GLB selection parity schema present');
check(selectionParitySource.includes('__PCF_GLB_RVM_GLB_SELECTION_PARITY_DIAGNOSTICS__'), 'GLB selection parity diagnostics global present');
check(selectionParitySource.includes('GLTFLoader') && selectionParitySource.includes('glbExportSourceUuid'), 'GLB selection parity parses node extras and source UUIDs');
check(selectionParitySource.includes('selectSourceUuid') && selectionParitySource.includes('setSelectionFromObjects'), 'GLB selection parity rows can select original RVM source objects');
check(selectionParitySource.includes('browserRvmAttributes') && selectionParitySource.includes('nodesWithAtt'), 'GLB selection parity validates ATT metadata presence');
check(appSource.includes('viewer3d-rvm-tab-renderer.js?v=20260620-rvm-glb-selection-details-parity-1'), 'app loads GLB selection parity renderer');
check(indexSource.includes('main-rhbg-fitguard.js?v=20260620-rvm-glb-selection-details-parity-1'), 'index loads GLB selection parity entrypoint');
check(entrySource.includes('core/app.js?v=20260620-rvm-glb-selection-details-parity-1'), 'entrypoint loads GLB selection parity app cache key');
check(entrySource.includes('Promise.allSettled') && entrySource.includes('optional startup module failed'), 'guarded entrypoint remains protected');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
