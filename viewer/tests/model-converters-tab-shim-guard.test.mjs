import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerRoot = path.resolve(__dirname, '..');
const shimPath = path.join(viewerRoot, 'tabs', 'model-converters-tab.js');
const source = fs.readFileSync(shimPath, 'utf8');

assert.ok(source.includes("MODEL_CONVERTERS_SHIM_VERSION = '20260629-model-converters-lazy-render-guard-1'"), 'shim must expose lazy render guard version');
assert.ok(source.includes('export function renderModelConvertersTab'), 'shim must export the expected app-shell renderer');
assert.ok(source.includes('import(CANONICAL_MODULE)'), 'shim must lazy-load the canonical Model Converters module');
assert.ok(source.includes('renderLegacyFallback'), 'shim must provide a legacy fallback if canonical import fails');
assert.ok(source.includes('renderDiagnostic'), 'shim must render an in-tab diagnostic instead of throwing to the app shell');
assert.ok(!source.includes('export { renderModelConvertersTab } from'), 'shim must not statically re-export the deep module chain');
assert.ok(source.includes('canonical renderer failed; trying legacy fallback'), 'shim must log canonical import failures with fallback context');

const moduleUrl = new URL(`file://${shimPath.split(path.sep).join('/')}`);
const module = await import(moduleUrl.href);
assert.equal(typeof module.renderModelConvertersTab, 'function', 'shim import must succeed and expose renderModelConvertersTab');
assert.equal(module.__MODEL_CONVERTERS_TAB_SHIM_VERSION__, '20260629-model-converters-lazy-render-guard-1', 'shim version export must match');

console.log('Verified Model Converters tab lazy shim guard.');
