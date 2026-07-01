import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const planningFiles = [
  new URL('../../../docs/3d-json-viewer-phase310a-gas-rmss-benchmark-acceptance-plan.md', import.meta.url),
  new URL('../../../docs/3d-json-viewer-rvm-parser-acceptance-vocabulary.md', import.meta.url),
  new URL('./rvm-diagnostics-benchmark-checklist.md', import.meta.url),
];

const requiredPhrases = [
  'diagnostics-only',
  'code 4',
  'code 11',
  'CNTB',
  'CNTE',
  'PRIM',
  'no stage model',
  'no render plan',
  'no geometry chunks',
  'semantic-only',
  'old RVM Viewer',
];

const prohibitedClaims = [
  'RVM rendering is implemented',
  'RVM parser is complete',
  'code 4 rendering is complete',
  'code 11 rendering is complete',
];

test('benchmark planning files contain required acceptance phrases', () => {
  const text = combinedText();
  for (const phrase of requiredPhrases) assert.ok(text.includes(phrase.toLowerCase()), `missing phrase: ${phrase}`);
});

test('benchmark planning files avoid unsupported implementation claims', () => {
  const text = combinedRawText();
  for (const claim of prohibitedClaims) assert.equal(text.includes(claim), false, `unsupported claim found: ${claim}`);
});

test('benchmark planning files avoid forbidden legacy parser tokens', () => {
  const text = combinedRawText();
  for (const token of forbiddenTokens()) assert.equal(text.includes(token), false, `forbidden token found: ${token}`);
});

test('new benchmark planning files remain under 300 lines', () => {
  for (const file of [
    ...planningFiles,
    new URL('./rvm-benchmark-plan-source-guards.test.js', import.meta.url),
  ]) {
    assert.ok(readText(file).split('\n').length < 300, `${file.pathname} exceeds line limit`);
  }
});

function combinedText() {
  return combinedRawText().toLowerCase();
}

function combinedRawText() {
  return planningFiles.map(readText).join('\n');
}

function readText(fileUrl) {
  return readFileSync(fileUrl, 'utf8');
}

function forbiddenTokens() {
  const rvm = 'Rvm';
  const browser = 'Browser' + rvm;
  return [
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
