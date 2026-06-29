import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(viewerRoot, 'tabs', 'RvmSelectionDetailsInspectorBridge.js');
const rendererPath = path.join(viewerRoot, 'tabs', 'viewer3d-rvm-tab-renderer.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const renderer = fs.readFileSync(rendererPath, 'utf8');

assert.ok(source.includes("BRIDGE_VERSION = '20260629-rvm-selection-details-syntax-fix-1'"), 'selection details bridge must expose syntax-fix version');
assert.ok(source.includes("function normalizePath(value)"), 'selection details bridge must normalize source paths safely');
assert.ok(source.includes("split('\\\\').join('/')"), 'path normalization must avoid malformed regex literals');
assert.ok(!source.includes("replace(/\\/g"), 'selection details bridge must not contain malformed backslash regex');
assert.ok(source.includes('export function installRvmSelectionDetailsInspectorBridge()'), 'selection details bridge must export installer');
assert.ok(source.includes('RuntimeEvents.RVM_NODE_SELECTED'), 'selection details bridge must still listen for RVM selection events');
assert.ok(renderer.includes('RvmSelectionDetailsInspectorBridge.js?v=20260629-rvm-selection-details-syntax-fix-1'), 'renderer must import syntax-fixed selection details bridge cache key');

new Function(source.replace(/^import .*$/gm, '').replace(/export function /g, 'function '));

console.log('Verified RVM selection details bridge syntax fix.');
