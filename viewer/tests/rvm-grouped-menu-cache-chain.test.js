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

const entry = read('main-rhbg-fitguard.js');
const runtime = read('core/app-label-perf-runtime.js');
const renderer = read('tabs/viewer3d-rvm-tab-renderer.js');
const toolbar = read('tabs/RvmToolbarCompactBridge.js');
const overflow = read('tabs/RvmToolbarOverflowController.js');

assert.ok(entry.includes('core/app-label-perf-runtime.js?v=20260626-rvm-grouped-menu-cache-chain-1'), 'entrypoint must import cache-busted runtime for grouped menu fix');
assert.ok(runtime.includes('viewer3d-rvm-tab-renderer.js?v=20260626-rvm-grouped-menu-click-fix-1'), 'runtime must import cache-busted RVM renderer for grouped menu fix');
assert.ok(renderer.includes('RvmToolbarCompactBridge.js?v=20260626-rvm-toolbar-secondary-groups-2'), 'renderer must import grouped toolbar click-fix owner');
assert.ok(toolbar.includes('RvmToolbarOverflowController.js?v=20260626-rvm-toolbar-overflow-controller-4'), 'toolbar must import grouped menu click-fix controller');
assert.ok(overflow.includes("const VERSION = '20260626-rvm-toolbar-overflow-controller-4'"), 'overflow controller v4 must be present');
assert.ok(overflow.includes('positionMenu(entry)'), 'overflow controller must position active grouped menus');

console.log('Verified RVM grouped menu click fix is reachable through entrypoint -> runtime -> renderer -> toolbar -> overflow controller.');
