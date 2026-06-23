import assert from 'node:assert/strict';
import fs from 'node:fs';

const rendererSource = fs.readFileSync(
  new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url),
  'utf8',
);
const arbiterSource = fs.readFileSync(
  new URL('../tabs/RvmNavigationModeArbiterBridge.js', import.meta.url),
  'utf8',
);
const interactionSource = fs.readFileSync(
  new URL('../tabs/RvmViewerInteractionPatch.js', import.meta.url),
  'utf8',
);
const leafPickSource = fs.readFileSync(
  new URL('../tabs/RvmLeafCanvasPickBridge.js', import.meta.url),
  'utf8',
);
const singlePickSource = fs.readFileSync(
  new URL('../tabs/RvmCanvasSelectionSinglePickGuardBridge.js', import.meta.url),
  'utf8',
);

assert.match(arbiterSource, /rvm-navigation-mode-arbiter\/v1/);
assert.match(arbiterSource, /ensureDefaultNavigationMode/);
assert.match(arbiterSource, /shouldForceOrbit/);
assert.match(arbiterSource, /setNavMode\('orbit'\)/);
assert.match(arbiterSource, /__rvmNavigationUserMode/);
assert.match(arbiterSource, /repairRvmNavigationPointerStack/);
assert.match(arbiterSource, /labelRenderer\.domElement\.style\.pointerEvents = 'none'/);
assert.match(arbiterSource, /potentialCanvasBlockers/);
assert.match(arbiterSource, /__PCF_GLB_RVM_NAVIGATION_ARBITER__/);

assert.match(rendererSource, /installRvmNavigationModeArbiterBridge/);
assert.match(rendererSource, /RvmNavigationModeArbiterBridge\.js\?v=20260623-rvm-navigation-arbiter-1/);
assert.match(rendererSource, /installRvmUiEventSafetyBridge\(\);\s*\ninstallRvmNavigationModeArbiterBridge\(\);/);

assert.match(interactionSource, /if \(!viewer\._rvmInteractionMode\) setMode\(viewer, 'select'\)/, 'RCA guard documents old forced-select behavior that arbiter must override');
assert.match(leafPickSource, /currentMode/);
assert.match(singlePickSource, /_rvmInteractionMode \|\| viewer\?\._navMode \|\| 'select'/, 'single-pick guard still only runs in select and is covered by arbiter defaulting');

assert.doesNotMatch(arbiterSource, /SupportSummary|SupportATT|SupportEngine|RvmSupportSummaryBridge|RvmSupportGeometryBridge/);
assert.doesNotMatch(rendererSource, /RvmSupportSummaryBridge|RvmSupportGeometryBridge|RvmSupportAttMappingBridge|RvmIntelligentSupportEngineBridge/);

console.log('rvm-navigation-mode-arbiter.test.js passed');
