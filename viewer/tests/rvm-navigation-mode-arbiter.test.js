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
const uiSafetySource = fs.readFileSync(
  new URL('../tabs/RvmUiEventSafetyBridge.js', import.meta.url),
  'utf8',
);
const uiRegistrySource = fs.readFileSync(
  new URL('../tabs/RvmUiEventRegistry.js', import.meta.url),
  'utf8',
);

assert.match(arbiterSource, /rvm-navigation-mode-arbiter\/v3-interaction-contract/);
assert.match(arbiterSource, /ensureDefaultNavigationMode/);
assert.match(arbiterSource, /shouldForceSelect/);
assert.match(arbiterSource, /setNavMode\('select'\)/);
assert.match(arbiterSource, /__rvmNavigationUserMode/);
assert.match(arbiterSource, /__rvmInteractionCurrentMode/, 'arbiter must read the canonical interaction current-mode contract');
assert.match(arbiterSource, /staleTransientExplicit/, 'arbiter must detect stale transient explicit modes after zoom\/marquee completion');
assert.match(arbiterSource, /escapeDelegated/, 'arbiter should delegate Escape to the interaction controller when available');
assert.match(arbiterSource, /bindUniversalEscape/);
assert.match(arbiterSource, /clearViewerSelection/);
assert.match(arbiterSource, /repairRvmNavigationPointerStack/);
assert.match(arbiterSource, /labelRenderer\.domElement\.style\.pointerEvents = 'none'/);
assert.match(arbiterSource, /potentialCanvasBlockers/);
assert.match(arbiterSource, /__PCF_GLB_RVM_NAVIGATION_ARBITER__/);
assert.doesNotMatch(arbiterSource, /shouldForceOrbit/);

assert.match(rendererSource, /installRvmNavigationModeArbiterBridge/);
assert.match(rendererSource, /RvmViewerInteractionPatch\.js\?v=20260626-rvm-canvas-selection-registry-1/);
assert.match(rendererSource, /RvmCanvasSelectionSinglePickGuardBridge\.js\?v=20260626-rvm-canvas-single-pick-registry-1/);
assert.match(rendererSource, /RvmNavigationModeArbiterBridge\.js\?v=20260624-rvm-navigation-interaction-contract-1/);
assert.match(rendererSource, /RvmUiEventSafetyBridge\.js\?v=20260626-rvm-ui-event-registry-1/);
assert.match(rendererSource, /installRvmUiEventSafetyBridge\(\);[\s\S]*installRvmNavigationModeArbiterBridge\(\);/, 'UI event safety must install before navigation mode arbiter');

assert.match(uiRegistrySource, /20260626-rvm-ui-event-registry-1/);
assert.match(uiRegistrySource, /__PCF_GLB_RVM_UI_EVENT_REGISTRY__/);
assert.match(uiRegistrySource, /registerRvmUiEvent/);
assert.match(uiRegistrySource, /routeRvmUiEvent/);
assert.match(uiRegistrySource, /getRvmUiEventRegistryDiagnostics/);
assert.match(uiSafetySource, /RvmUiEventRegistry\.js\?v=20260626-rvm-ui-event-registry-1/);
assert.match(uiSafetySource, /installRvmUiEventRegistry/);
assert.match(uiSafetySource, /registerRvmUiEvent\('toolbar-action'/);
assert.match(uiSafetySource, /registerRvmUiEvent\('tree-click'/);
assert.match(uiSafetySource, /registerRvmUiEvent\('tree-visibility-change'/);
assert.match(uiSafetySource, /registerRvmUiEvent\('tree-context-menu'/);
assert.match(uiSafetySource, /registerRvmUiEvent\('document-pointerdown'/);
assert.match(uiSafetySource, /routeRvmUiEvent\(root, 'toolbar-action'/);
assert.match(uiSafetySource, /routeRvmUiEvent\(root, 'tree-click'/);
assert.match(uiSafetySource, /getEventRegistryDiagnostics/);

assert.match(interactionSource, /20260626-rvm-canvas-selection-registry-1/, 'interaction patch must publish the registry-backed version');
assert.match(interactionSource, /RvmUiEventRegistry\.js\?v=20260626-rvm-ui-event-registry-1/);
assert.match(interactionSource, /registerRvmUiEvent\('canvas-primitive-select'/);
assert.match(interactionSource, /routeRvmUiEvent\(root, 'canvas-primitive-select'/);
assert.match(interactionSource, /selectGeometryAtClientPoint/, 'existing primitive raycast selection path must remain present');
assert.match(interactionSource, /prepareModeTransition/, 'mode changes must clear incompatible transient measure\/marquee state');
assert.match(interactionSource, /publishInteractionState/, 'mode changes must publish one canonical interaction state');
assert.match(interactionSource, /__PCF_GLB_RVM_INTERACTION_STATE__/, 'global diagnostics must expose current interaction state');
assert.match(interactionSource, /modeAtUp !== 'select'\) return/, 'canvas selection must not run during Orbit\/Pan\/transient modes');
assert.match(interactionSource, /Esc: selection cleared, Select mode/, 'Esc must clear selection and return to Select in one action');
assert.match(leafPickSource, /currentMode/);
assert.match(singlePickSource, /20260626-rvm-canvas-single-pick-registry-1/);
assert.match(singlePickSource, /RvmUiEventRegistry\.js\?v=20260626-rvm-ui-event-registry-1/);
assert.match(singlePickSource, /registerRvmUiEvent\('canvas-single-pick'/);
assert.match(singlePickSource, /routeRvmUiEvent\(document\.querySelector\('\[data-rvm-viewer\]'\), 'canvas-single-pick'/);
assert.match(singlePickSource, /routedPointerUps/);
assert.match(singlePickSource, /_rvmInteractionMode \|\| viewer\?\._navMode \|\| 'select'/, 'single-pick guard still only runs in select and is covered by Select defaulting');

assert.doesNotMatch(arbiterSource, /SupportSummary|SupportATT|SupportEngine|RvmSupportSummaryBridge|RvmSupportGeometryBridge/);
assert.doesNotMatch(rendererSource, /RvmSupportSummaryBridge|RvmSupportGeometryBridge|RvmSupportAttMappingBridge|RvmIntelligentSupportEngineBridge/);

console.log('rvm-navigation-mode-arbiter.test.js passed');
