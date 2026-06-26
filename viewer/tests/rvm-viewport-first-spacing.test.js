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

assert.ok(renderer.includes("RvmViewportFirstSpacingBridge.js?v=20260626-rvm-viewport-first-spacing-1"), 'renderer must import viewport-first spacing bridge with explicit cache key');
assert.ok(renderer.includes('installRvmViewportFirstSpacingBridge();'), 'renderer must install viewport-first spacing bridge');
assert.ok(renderer.indexOf('installRvmToolbarCompactBridge();') < renderer.indexOf('installRvmViewportFirstSpacingBridge();'), 'spacing must apply after compact toolbar policy');
assert.ok(renderer.indexOf('installRvmViewportFirstSpacingBridge();') < renderer.indexOf('installRvmViewerUiShell();'), 'spacing must apply before UI shell install');
assert.ok(bridge.includes("const VERSION = '20260626-rvm-viewport-first-spacing-1'"), 'bridge must expose a stable version marker');
assert.ok(bridge.includes('STYLE_ID') && bridge.includes('rvm-viewport-first-spacing-style'), 'bridge must own one style element id');
assert.ok(bridge.includes('data-rvm-viewer'), 'bridge must scope to RVM viewer root');
for (const selector of ['.rvm-capability-banner', '.geo-top-ribbon', '.rvm-status-strip', '.rvm-left-panel', '.rvm-right-panel', '.viewer-statusbar']) {
  assert.ok(bridge.includes(`[data-rvm-viewer] ${selector}`), `bridge must scope ${selector}`);
}
for (const forbidden of ['.app-shell', '.app-nav', '#tab-bar', '#tab-content', 'PCF GLB VIEWER']) {
  assert.ok(!bridge.includes(forbidden), `bridge must not style landing/app chrome selector ${forbidden}`);
}
assert.ok(index.includes('viewer3d-rvm-tab.css?v=20260620-rvm-direct-tab-1'), 'landing HTML stylesheet cache remains untouched by this RVM-internal bridge');

console.log('Verified RVM viewport-first spacing bridge is RVM-scoped and does not touch landing/app chrome.');
