import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}

async function read(path) {
  return fs.readFile(new URL(path, import.meta.url), 'utf8');
}

const adapterSource = await read('../rvm/BrowserRvmRenderContractAdapter.js');
const workerSource = await read('../rvm/browser-rvm-worker.js');
const sceneBuilderSource = await read('../rvm/BrowserRvmRenderSceneBuilder.js');
const rendererSource = await read('../tabs/viewer3d-rvm-tab-renderer.js');
const deferredLoaderSource = await read('../tabs/RvmDeferredBridgeLoader.js');
const bottomDiagnosticsSource = await read('../tabs/RvmBottomDiagnosticsDrawerBridge.js');
const purgeBridgeSource = await read('../tabs/RvmRetiredSupportToolsPurgeBridge.js');
const leafCanvasPickSource = await read('../tabs/RvmLeafCanvasPickBridge.js');

check(
  adapterSource.includes('rvm-browser-render-instructions/v5-raw-first-support-primitives'),
  'render adapter schema records raw-first support primitive preservation'
);

check(
  adapterSource.includes('shouldPreserveRawSupportPrimitive') && adapterSource.includes('RAW_RENDERABLE_RVM_CODES'),
  'render adapter preserves renderable raw RVM support primitives, not only cylinders'
);

check(
  adapterSource.includes('code === 8') && adapterSource.includes('RVM_BROWSER_SUPPORT_RAW_CYLINDER_PRESERVED'),
  'RVM code-8 support cylinders are preserved as raw cylinders'
);

check(
  adapterSource.includes('support-preserved-rvm-cylinder-raw') && adapterSource.includes('support-hint-promoted-contract'),
  'adapter distinguishes preserved raw cylinders from promoted support placeholders'
);

check(
  adapterSource.includes("supportHint.isSupport && !preserveRawSupportPrimitive ? 'SUPPORT_BBOX_PLACEHOLDER' : primitive"),
  'adapter only promotes non-renderable support hints to synthetic support placeholder'
);

check(
  sceneBuilderSource.indexOf("primitive === 'CYLINDER_BBOX'") < sceneBuilderSource.indexOf("primitive === 'SUPPORT_BBOX_PLACEHOLDER'"),
  'scene builder resolves cylinder primitives before support stand placeholders'
);

for (const retired of [
  'RvmSupportSummaryBridge',
  'RvmSupportAssemblyBridge',
  'RvmIntelligentSupportEngineBridge',
  'RvmSupportGeometryBridge',
  'RvmSupportAttMappingBridge',
]) {
  check(!deferredLoaderSource.includes(retired), `deferred loader does not import retired ${retired}`);
}

check(
  !rendererSource.includes('RvmSupportAssemblyMarkerModeBridge') && !rendererSource.includes('RvmRawSupportCylinderGuardBridge'),
  'RVM tab renderer no longer installs support marker/raw-support guard bridges'
);

check(
  rendererSource.includes('RvmRetiredSupportToolsPurgeBridge') && rendererSource.includes('installRvmRetiredSupportToolsPurgeBridge()'),
  'RVM tab renderer installs retired support tools purge bridge'
);

check(
  rendererSource.includes("import { installRvmUiEventSafetyBridge }") && rendererSource.includes('installRvmUiEventSafetyBridge()'),
  'RVM tab renderer imports and installs UI event safety bridge'
);

check(
  rendererSource.includes('RvmLeafCanvasPickBridge.js?v=20260622-rvm-leaf-canvas-pick-orbit-guard-2'),
  'RVM tab renderer loads navigation-safe leaf canvas pick bridge'
);

check(
  leafCanvasPickSource.includes("if (mode !== 'select')")
    && leafCanvasPickSource.includes('Do not stop propagation here.')
    && !leafCanvasPickSource.includes('Block later canvas-selection listeners'),
  'leaf canvas pick bridge lets orbit/pan/marquee/measure pointerup propagate'
);

for (const retiredSelector of [
  'data-rvm-support-att-panel',
  'data-rvm-support-engine-panel',
  'data-rvm-support-geometry-panel',
  'rvm-support-att-mapping-diagnostics',
  'rvm-intelligent-support-engine-diagnostics',
  'rvm-support-geometry-diagnostics',
]) {
  check(!bottomDiagnosticsSource.includes(retiredSelector), `bottom diagnostics drawer excludes ${retiredSelector}`);
}

for (const retiredRoot of [
  '__RVM_GEOMETRY_SUPPORT_SYMBOLS__',
  '__RVM_SUPPORT_ASSEMBLY_MARKERS__',
  '__RVM_EXPORTABLE_SUPPORT_GEOMETRY__',
]) {
  check(purgeBridgeSource.includes(retiredRoot), `purge bridge removes retired scene root ${retiredRoot}`);
}

check(
  purgeBridgeSource.includes('#rvm-support-summary') && purgeBridgeSource.includes('#rvm-support-scale') && purgeBridgeSource.includes('#rvm-support-labels'),
  'purge bridge removes legacy support summary and support-scale UI nodes'
);

if (failed) {
  console.error(`FAILURES: ${failed}`);
  process.exit(1);
}
console.log(`All raw support cylinder, retired support-tool, and canvas navigation checks passed (${passed}).`);
