import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  const file = path.join(viewerRoot, relativePath);
  assert.ok(fs.existsSync(file), `missing source file: ${relativePath}`);
  return fs.readFileSync(file, 'utf8');
}

const renderer = read('tabs/viewer3d-rvm-tab-renderer.js');
const bridge = read('tabs/RvmViewportFirstSpacingBridge.js');
const index = read('index.html');
const viewer3dCss = read('styles/viewer3d.css');

assert.ok(viewer3dCss.includes('justify-content: space-between'), 'audit must keep evidence of inherited generic 3D Viewer ribbon distribution');
assert.ok(renderer.includes('RvmViewportFirstSpacingBridge.js?v=20260626-rvm-viewport-first-spacing-3'), 'renderer must import grouped secondary spacing bridge with explicit cache key');
assert.ok(renderer.includes('Previous RVM viewport spacing cache key: RvmViewportFirstSpacingBridge.js?v=20260626-rvm-viewport-first-spacing-2'), 'renderer must preserve previous spacing cache evidence');
assert.ok(renderer.includes('RvmToolbarCompactBridge.js?v=20260626-rvm-toolbar-secondary-groups-1'), 'renderer must import grouped secondary toolbar policy');
assert.ok(renderer.includes('Previous RVM compact toolbar cache key: RvmToolbarCompactBridge.js?v=20260626-rvm-toolbar-compact-policy-3'), 'renderer must preserve previous toolbar cache evidence');
assert.ok(renderer.includes('installRvmViewportFirstSpacingBridge();'), 'renderer must install viewport-first spacing bridge');
assert.ok(renderer.indexOf('installRvmToolbarCompactBridge();') < renderer.indexOf('installRvmViewportFirstSpacingBridge();'), 'spacing must apply after grouped toolbar policy');
assert.ok(renderer.indexOf('installRvmViewportFirstSpacingBridge();') < renderer.indexOf('installRvmViewerUiShell();'), 'spacing must apply before UI shell install');
assert.ok(bridge.includes("const VERSION = '20260626-rvm-viewport-first-spacing-3'"), 'bridge must expose grouped secondary spacing version marker');
assert.ok(bridge.includes("const PREVIOUS_VERSION = '20260626-rvm-viewport-first-spacing-2'"), 'bridge must preserve previous spacing version');
assert.ok(bridge.includes('STYLE_ID') && bridge.includes('rvm-viewport-first-spacing-style'), 'bridge must own one style element id');
assert.ok(bridge.includes('let style = document.getElementById(STYLE_ID)'), 'bridge must update an existing old style element instead of leaving stale CSS live');
assert.ok(bridge.includes('rootCause') && bridge.includes('secondary tools now use named groups'), 'bridge diagnostics must record grouped menu spacing root cause');
assert.ok(bridge.includes('toolbarPackedLeft: true'), 'bridge diagnostics must certify compact toolbar packing');
assert.ok(bridge.includes("secondaryToolbarGroups: ['view', 'visibility', 'inspect', 'export', 'source', 'diag']"), 'bridge diagnostics must list grouped secondary menus');
assert.ok(bridge.includes('data-rvm-viewer'), 'bridge must scope to RVM viewer root');
for (const selector of ['.rvm-capability-banner', '.geo-top-ribbon', '.rvm-status-strip', '.rvm-left-panel', '.rvm-right-panel', '.viewer-statusbar']) {
  assert.ok(bridge.includes(`[data-rvm-viewer] ${selector}`), `bridge must scope ${selector}`);
}
assert.ok(bridge.includes('[data-rvm-viewer] .geo-top-ribbon{display:flex;justify-content:flex-start!important;'), 'RVM toolbar must override inherited generic space-between layout');
for (const marker of ['.rvm-ribbon-load{order:1', '.rvm-ribbon-navigate-view{order:2', '.rvm-ribbon-review{order:3', '.rvm-toolbar-secondary-view{order:41', '.rvm-toolbar-secondary-visibility{order:42', '.rvm-toolbar-secondary-inspect{order:43', '.rvm-toolbar-secondary-export{order:44', '.rvm-toolbar-secondary-source{order:45', '.rvm-toolbar-secondary-diag{order:46', '.mode-chip{order:5']) {
  assert.ok(bridge.includes(marker), `RVM toolbar grouped order must include ${marker}`);
}
for (const forbidden of ['.app-shell', '.app-nav', '#tab-bar', '#tab-content', 'PCF GLB VIEWER']) {
  assert.ok(!bridge.includes(forbidden), `bridge must not style landing/app chrome selector ${forbidden}`);
}
assert.ok(index.includes('viewer3d-rvm-tab.css?v=20260620-rvm-direct-tab-1'), 'landing HTML stylesheet cache remains untouched by this RVM-internal bridge');

console.log('Verified RVM grouped secondary toolbar spacing is packed-left, RVM-scoped, cache-busted, and does not touch landing/app chrome.');
