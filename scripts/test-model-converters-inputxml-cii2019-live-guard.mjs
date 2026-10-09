#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LIVE_GUARD_VERSION = '20260627-inputxml-cii2019-live-guard-1';
const SHIM_GUARD_VERSION = '20260629-model-converters-lazy-render-guard-1';
const TRAILING_MINUS_WORKER_VERSION = '20260629-trailing-minus-xml-1';
const shim = readFileSync('viewer/tabs/model-converters-tab.js', 'utf8');
const index = readFileSync('viewer/tabs/model-converters/index.js', 'utf8');
const tab = readFileSync('viewer/tabs/model-converters/ModelConvertersTab.js', 'utf8');
const executor = readFileSync('viewer/converters/BrowserConverterExecutor.js', 'utf8');

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
assert.ok(executor.includes('normalizeTrailingMinusNumericXmlText'), 'Browser converter executor must expose XML trailing-minus numeric normalization');
assert.ok(executor.includes(`py-worker.js?v=${TRAILING_MINUS_WORKER_VERSION}`), 'Browser converter executor must bust the worker after trailing-minus normalization');
assert.ok(executor.includes("'xml_to_cii'"), 'Browser converter executor must normalize XML->CII inputs');
assert.ok(executor.includes("'inputxml_to_cii2019'"), 'Browser converter executor must normalize InputXML->CII2019 inputs');

const { normalizeTrailingMinusNumericXmlText } = await import('../viewer/converters/BrowserConverterExecutor.js');
const rawXml = '<Temperature1>50.478-</Temperature1><Pressure1>700</Pressure1><Temperature2>1.2E+03-</Temperature2>';
assert.equal(
  normalizeTrailingMinusNumericXmlText(rawXml),
  '<Temperature1>-50.478</Temperature1><Pressure1>700</Pressure1><Temperature2>-1.2E+03</Temperature2>',
  'trailing-minus numeric XML text must be normalized before py-worker execution',
);

console.log('model-converters-inputxml-cii2019-live-guard: all assertions passed');
