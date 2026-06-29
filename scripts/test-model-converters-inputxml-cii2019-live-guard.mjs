#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LIVE_GUARD_VERSION = '20260627-inputxml-cii2019-live-guard-1';
const SHIM_GUARD_VERSION = '20260629-model-converters-lazy-render-guard-1';
const shim = readFileSync('viewer/tabs/model-converters-tab.js', 'utf8');
const index = readFileSync('viewer/tabs/model-converters/index.js', 'utf8');
const tab = readFileSync('viewer/tabs/model-converters/ModelConvertersTab.js', 'utf8');

assert.ok(shim.includes(`MODEL_CONVERTERS_SHIM_VERSION = '${SHIM_GUARD_VERSION}'`), 'model-converters-tab.js must expose the lazy render guard version');
assert.ok(shim.includes(`./model-converters/index.js?v=${SHIM_GUARD_VERSION}`), 'model-converters-tab.js must lazily bust the public entrypoint');
assert.ok(shim.includes('import(CANONICAL_MODULE)'), 'model-converters-tab.js must lazy-load the canonical renderer');
assert.ok(shim.includes('renderLegacyFallback'), 'model-converters-tab.js must keep a legacy fallback path');
assert.ok(!shim.includes('export { renderModelConvertersTab } from'), 'model-converters-tab.js must not statically re-export the deep module chain');
assert.ok(index.includes(`./ModelConvertersTab.js?v=${LIVE_GUARD_VERSION}`), 'index.js must bust the tab shell');
assert.ok(tab.includes(`./legacy-adapter.js?v=${LIVE_GUARD_VERSION}`), 'ModelConvertersTab.js must bust the legacy adapter');
assert.ok(tab.includes(`./converters/inputxml-to-cii2019.js?v=${LIVE_GUARD_VERSION}`), 'ModelConvertersTab.js must directly import the fixed InputXML->CII(2019) runner with a live cache key');
assert.ok(tab.includes('CONVERTERS as LIVE_MODEL_CONVERTERS'), 'ModelConvertersTab.js must import the same converter registry namespace used by legacy-adapter');
assert.ok(tab.includes('function installInputXmlCii2019LiveRunnerGuard()'), 'ModelConvertersTab.js must install an explicit live runner guard');
assert.ok(tab.includes("entry?.id === 'inputxml_to_cii2019'"), 'live guard must target only InputXML->CII(2019)');
assert.ok(tab.includes('converter.run = inputXmlToCii2019LiveRun'), 'live guard must replace the stale registry runner with the fixed runner');
assert.ok(tab.includes('installInputXmlCii2019LiveRunnerGuard(); ensureModelConvertersStyles(); renderLegacyModelConvertersTab'), 'live guard must run before legacy adapter renders and binds conversion handlers');
assert.ok(tab.includes('__INPUTXML_CII2019_LIVE_GUARD_VERSION__'), 'live guard version must be exported for diagnostics/tests');

console.log('model-converters-inputxml-cii2019-live-guard: all assertions passed');
