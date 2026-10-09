import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const compat = fs.readFileSync(path.resolve('tabs/model-converters-tab.js'), 'utf8');
const canonical = fs.readFileSync(path.resolve('viewer/tabs/model-converters/index.js'), 'utf8');

assert.match(compat, /renderModelConvertersTab/);
assert.match(
  compat,
  /\.\.\/viewer\/tabs\/model-converters\/index\.js\?v=20260627-inputxml-cii2019-live-guard-1/,
);
assert.match(canonical, /export \{ renderModelConvertersTab \}/);

console.log('uxml-model-converters-root-import-compat: all assertions passed');
