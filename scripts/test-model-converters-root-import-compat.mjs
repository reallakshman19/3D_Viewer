import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const compatPath = path.resolve('tabs/model-converters-tab.js');
const compat = fs.readFileSync(compatPath, 'utf8');
const canonical = fs.readFileSync(path.resolve('viewer/tabs/model-converters/index.js'), 'utf8');

assert.match(compat, /renderModelConvertersTab/);
assert.match(compat, /\.\.\/viewer\/tabs\/model-converters\/index\.js\?v=20260627-inputxml-cii2019-live-guard-1/);
assert.match(canonical, /export \{ renderModelConvertersTab \}/);

console.log('model-converters-root-import-compat: all assertions passed');
