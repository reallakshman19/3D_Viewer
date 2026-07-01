import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const guardedFiles = [
  new URL('../stage/benchmark/RvmDiagnosticsBenchmarkAcceptance.js', import.meta.url),
  new URL('../../docs/3d-json-viewer-phase310b-rvm-diagnostics-benchmark-acceptance-harness.md', import.meta.url),
  new URL('./rvm-diagnostics-benchmark-acceptance.test.js', import.meta.url),
];

const lineLimitFiles = [
  ...guardedFiles,
  new URL('./rvm-diagnostics-benchmark-acceptance-source-guards.test.js', import.meta.url),
];

test('diagnostics benchmark acceptance sources avoid forbidden imports and tokens', () => {
  const source = guardedFiles.map(readText).join('\n').toLowerCase();
  for (const token of forbiddenTokens()) assert.equal(source.includes(token.toLowerCase()), false, `forbidden token found: ${token}`);
});

test('new diagnostics benchmark acceptance JS files remain under 300 lines', () => {
  for (const file of lineLimitFiles) assert.ok(readText(file).split('\n').length < 300, `${file.pathname} exceeds line limit`);
});

function readText(fileUrl) {
  return readFileSync(fileUrl, 'utf8');
}

function forbiddenTokens() {
  const stage = 'viewer/stage/';
  const rvm = 'Rvm';
  const browser = 'Browser' + rvm;
  return [
    stage + 'parser/',
    stage + 'worker/',
    stage + 'contracts/',
    stage + 'samples/',
    stage + 'render/',
    stage + 'ui/',
    'viewer/tabs/',
    'three',
    'indexedDB',
    'parse' + rvm,
    'read' + rvm,
    rvm + 'Parser',
    rvm + 'DeferredBridgeLoader',
    rvm + 'SupportGeometryBridge',
    rvm + 'PrimitiveFallbackBridge',
    rvm + 'VisualQualityControlsBridge',
    rvm + 'ZoneLodContextBridge',
    browser + 'RenderSceneBuilder',
    browser + 'Code4ElbowRenderBridge',
    browser + 'TransformParser',
    browser + 'HierarchyTransformParser',
  ];
}
