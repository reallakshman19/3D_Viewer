import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const patch = readFileSync('viewer/tabs/model-converters/xml-cii-master-preserve-patch.js', 'utf8');
const tab = readFileSync('viewer/tabs/model-converters/ModelConvertersTab.js', 'utf8');

assert.match(patch, /installXmlCiiMasterPreservePatch/);
assert.match(patch, /lastGood/);
assert.match(patch, /restoreMissingMasters/);
assert.match(patch, /data-xml-cii-save-master/);
assert.match(patch, /data-native-save-master/);
assert.match(patch, /data-xml-cii-clear-master/);
assert.match(patch, /data-native-clear-master/);
assert.match(patch, /markExplicitClear/);
assert.match(patch, /supportConfigJson/);

assert.match(tab, /installXmlCiiMasterPreservePatch/);
assert.match(tab, /xml-cii-master-preserve-patch\.js\?v=20260620-master-preserve-1/);
assert.match(tab, /master-preserve-1/);

console.log('XML CII master preserve patch regression passed');
