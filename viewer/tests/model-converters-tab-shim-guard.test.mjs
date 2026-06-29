import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerRoot = path.resolve(__dirname, '..');
const tabPath = path.join(viewerRoot, 'tabs', 'model-converters-tab.js');
const source = fs.readFileSync(tabPath, 'utf8');

assert.ok(source.includes("MODEL_CONVERTERS_SHIM_VERSION = '20260629-clear-native-overrides-1'"), 'tab entry must expose the active version');
assert.ok(source.includes('index.js?v=20260629-clear-native-overrides-1'), 'tab entry must load the clear-native-overrides canonical module key');
assert.ok(source.includes('export function renderModelConvertersTab'), 'tab entry must export the expected app-shell renderer');
assert.ok(source.includes('import(CANONICAL_MODULE)'), 'tab entry must lazy-load the canonical Model Converters module');
assert.ok(source.includes('renderLegacyFallback'), 'tab entry must provide a legacy fallback if canonical import fails');
assert.ok(source.includes('renderDiagnostic'), 'tab entry must render an in-tab diagnostic');
assert.ok(!source.includes('export { renderModelConvertersTab } from'), 'tab entry must not statically re-export the deep module chain');
assert.ok(source.includes('canonical renderer failed; trying legacy fallback'), 'tab entry must log canonical import failures with fallback context');

const moduleUrl = new URL(`file://${tabPath.split(path.sep).join('/')}`);
const module = await import(moduleUrl.href);
assert.equal(typeof module.renderModelConvertersTab, 'function', 'tab entry import must expose renderModelConvertersTab');
assert.equal(module.__MODEL_CONVERTERS_TAB_SHIM_VERSION__, '20260629-clear-native-overrides-1', 'tab entry version export must match');

console.log('Verified Model Converters tab entry guard.');
