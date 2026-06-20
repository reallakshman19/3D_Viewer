#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tabPath = 'viewer/tabs/model-converters/ModelConvertersTab.js';
const patchPath = 'viewer/tabs/model-converters/xml-cii-linekey-select-patch.js';

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

const tab = read(tabPath);
const patch = read(patchPath);

assert(tab.includes('installXmlCiiLineKeySelectPatch'), 'ModelConvertersTab must install the Line Key selector patch');
assert(patch.includes("const LINE_KEY_PATH = 'linelist.lineKeyTokenPositions'"), 'patch must target linelist.lineKeyTokenPositions');
assert(patch.includes("document.createElement('select')"), 'patch must replace the Line Key text input with a select/list-box');
assert(patch.includes('shiftedLineKeyPosition(tokens, configured)'), 'patch must detect shifted Branchname token layout');
assert(patch.includes('persistLineKeyPosition(shifted)'), 'patch must persist corrected shifted line-key position');
assert(patch.includes('data-native-regex-path'), 'patch must support native popup Regex fields');
assert(patch.includes('data-xml-cii-regex-path'), 'patch must support legacy Regex fields');

console.log('✅ XML CII Line Key selector patch static test passed');
