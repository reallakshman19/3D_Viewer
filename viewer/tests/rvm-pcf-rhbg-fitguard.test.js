import fs from 'node:fs/promises';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}
async function read(path) { return fs.readFile(new URL(path, import.meta.url), 'utf8'); }

const renderer = await read('../tabs/viewer3d-rvm-tab-renderer.js');
const runtime = await read('../core/app-label-perf-runtime.js');
const entry = await read('../main-rhbg-fitguard.js');
const tab = await read('../tabs/viewer3d-rvm-tab.js');
const deferred = await read('../tabs/RvmDeferredBridgeLoader.js');
const hierarchy = await read('../tabs/RvmHierarchySelectionBridge.js');
const treeSync = await read('../tabs/RvmSelectionTreeSyncBridge.js');
const exact = await read('../tabs/RvmFormatNeutralExactSelectionBridge.js');
const toolbar = await read('../tabs/RvmToolbarCompactBridge.js');

check(entry.includes('core/app.js?v=20260627-rvm-format-neutral-hierarchy-1'), 'entrypoint uses format-neutral app cache key');
check(runtime.includes('viewer3d-rvm-tab-renderer.js?v=20260627-rvm-format-neutral-hierarchy-1'), 'runtime uses format-neutral renderer cache key');
check(renderer.includes('viewer3d-rvm-tab.js?v=20260627-rvm-format-neutral-hierarchy-1'), 'renderer uses format-neutral tab cache key');
check(renderer.includes('RvmHierarchySelectionBridge.js?v=20260627-rvm-hierarchy-navis-safe-1'), 'renderer imports navis-safe hierarchy bridge');
check(renderer.includes('RvmFormatNeutralExactSelectionBridge.js?v=20260627-rvm-format-neutral-exact-selection-1'), 'renderer imports exact selection bridge');
check(renderer.includes('RvmSelectionTreeSyncBridge.js?v=20260627-rvm-hierarchy-selection-sync-dispose-1'), 'renderer imports disposable tree sync bridge');
check(renderer.includes('installRvmFormatNeutralExactSelectionBridge()'), 'exact selection bridge installs from renderer');
check(hierarchy.includes("const BRIDGE_VERSION = 'rvm-hierarchy-selection-bridge/v4-format-neutral-navis-safe'"), 'hierarchy bridge exposes current version');
check(treeSync.includes("const BRIDGE_VERSION = '20260627-rvm-hierarchy-selection-sync-dispose-1'"), 'tree sync exposes current version');
check(exact.includes('GENERIC_LABELS'), 'exact selection bridge blocks generic kind labels');
check(tab.includes('sourceKindForJsonFileName') && tab.includes("return 'stagedjson'") && tab.includes("return 'txt'"), 'mounted tab directly classifies stagedJSON and TXT');
check(tab.includes('renderLoadedHierarchyTree(root, payload'), 'mounted tab renders format-neutral hierarchy tree');
check(deferred.includes('RvmSourceKindPolicy.js') && deferred.includes('isRvmSourcePreviewKind(sourceKind)') && !deferred.includes('SOURCE_PREVIEW_KIND_RE'), 'deferred loader gates stagedJSON source-preview bridges through shared source-kind policy');
check(toolbar.includes("const VERSION = '20260627-rvm-toolbar-scroll-misc-1'"), 'toolbar scroll/misc version remains current');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
