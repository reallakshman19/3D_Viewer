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
const sceneBuilderSource = await read('../rvm/BrowserRvmRenderSceneBuilder.js');

check(
  adapterSource.includes("rvm-browser-render-instructions/v4-preserve-raw-support-cylinders"),
  'render adapter schema records raw support cylinder preservation'
);

check(
  adapterSource.includes('shouldPreserveRawSupportCylinder') && adapterSource.includes('RAW_SUPPORT_CYLINDER_RE'),
  'render adapter has explicit raw support cylinder guard'
);

check(
  adapterSource.includes("code === 8") && adapterSource.includes('RVM_BROWSER_SUPPORT_RAW_CYLINDER_PRESERVED'),
  'RVM code-8 support cylinders are preserved as raw cylinders'
);

check(
  adapterSource.includes("support-preserved-rvm-cylinder-raw") && adapterSource.includes("support-hint-promoted-contract"),
  'adapter distinguishes preserved raw cylinders from promoted support placeholders'
);

check(
  !adapterSource.includes("renderPrimitive: supportHint.isSupport ? 'SUPPORT_BBOX_PLACEHOLDER' : primitive"),
  'adapter no longer blindly converts all support hints into support stand placeholders'
);

check(
  sceneBuilderSource.indexOf("primitive === 'CYLINDER_BBOX'") < sceneBuilderSource.indexOf("primitive === 'SUPPORT_BBOX_PLACEHOLDER'"),
  'scene builder resolves cylinder primitives before support stand placeholders'
);

if (failed) {
  console.error(`FAILURES: ${failed}`);
  process.exit(1);
}
console.log(`All raw support cylinder checks passed (${passed}).`);
