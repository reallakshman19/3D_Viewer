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
const remainingPatchSource = await read('../rvm/BrowserRvmRemainingPrimitiveRuntimePatch.js');
const supportSummarySource = await read('../tabs/RvmSupportSummaryBridge.js');
const supportGeomSource = await read('../tabs/RvmSupportGeometryBridge.js');

check(
  adapterSource.includes('rvm-browser-render-instructions/v5-raw-first-support-primitives'),
  'render adapter schema records raw-first support primitive preservation'
);

check(
  adapterSource.includes('shouldPreserveRawSupportPrimitive') && adapterSource.includes('RAW_RENDERABLE_RVM_CODES'),
  'render adapter preserves renderable raw RVM support primitives, not only cylinders'
);

check(
  adapterSource.includes('RVM_BROWSER_SUPPORT_RAW_PRIMITIVE_PRESERVED') && adapterSource.includes('support-preserved-rvm-primitive-raw'),
  'raw support primitive preservation is carried in instruction metadata'
);

check(
  workerSource.includes('RVM_BROWSER_SUPPORT_RAW_PRIMITIVE_PRESERVED') && workerSource.includes('RVM_BROWSER_SUPPORT_RAW_PRIMITIVE_POLICY'),
  'worker compact transfer keeps raw support preservation metadata'
);

check(
  adapterSource.includes("supportHint.isSupport && !preserveRawSupportPrimitive ? 'SUPPORT_BBOX_PLACEHOLDER' : primitive"),
  'adapter only promotes non-renderable support hints to synthetic support placeholder'
);

check(
  sceneBuilderSource.indexOf("primitive === 'CYLINDER_BBOX'") < sceneBuilderSource.indexOf("primitive === 'SUPPORT_BBOX_PLACEHOLDER'"),
  'scene builder resolves cylinder primitives before support stand placeholders'
);

check(
  remainingPatchSource.includes('support-code1-pyramid-solid-upgrade-disabled') && remainingPatchSource.includes('isGeneratedSupportOrChild'),
  'remaining primitive patch cannot create solid code-1 support pyramids or upgrade generated support children'
);

check(
  supportSummarySource.includes("const SUPPORT_MODE_STORAGE_KEY = 'rvm_support_render_mode_v2'") && supportSummarySource.includes("let saved = 'raw'") && supportSummarySource.includes('rawDefaultNoGeneratedRoot'),
  'support summary defaults to raw-only and does not create hidden generated symbol roots in raw mode'
);

check(
  supportGeomSource.includes("const STORAGE_KEY = 'rvm_support_geometry_mode_v2'") && supportGeomSource.includes("let v = 'off'") && supportGeomSource.includes('optInOnly: true'),
  'support geometry overlay ignores old persisted overlay mode and remains opt-in only'
);

check(
  !adapterSource.includes("renderPrimitive: supportHint.isSupport ? 'SUPPORT_BBOX_PLACEHOLDER' : primitive"),
  'adapter no longer blindly converts all support hints into support stand placeholders'
);

if (failed) {
  console.error(`FAILURES: ${failed}`);
  process.exit(1);
}
console.log(`All raw-first support viewer checks passed (${passed}).`);
