import assert from 'node:assert/strict';
import fs from 'node:fs';

const picker=fs.readFileSync('viewer/tabs/xml-compare-enriched-sample-pickers.js','utf8');
const shell=fs.readFileSync('viewer/xml-compare/XmlCompareWorkspaceShell.js','utf8');
const data=fs.readFileSync('viewer/tabs/xml-compare-enriched-samples-data.js','utf8');

assert.match(picker,/function ensureImportTab\(\)/);
assert.match(picker,/data-xml-compare-linewise-tab="import"/);
assert.match(picker,/function importControl\(\)/);
assert.match(picker,/input\[data-xml-compare-categorized-import\]/);
assert.match(picker,/selectCanvasSide\(side\)/);
assert.match(picker,/setInputFile\(input,file\)/);
assert.match(picker,/Line-wise workflow import control not found/);
assert.match(picker,/BM_CII_INPUT_SOURCE FILE_sideloaded_categorized_enriched\.xml/);
assert.match(picker,/BM_CII_LINEBASIS_INPUT_TARGET FILE_categorized_enriched\.xml/);
assert.match(picker,/xml-compare-enriched-samples-data\.js\?v=20260701-bm-cii-categorized-samples-1/);
assert.match(shell,/xml-compare-enriched-sample-pickers\.js\?v=20260701-bm-cii-categorized-samples-1/);
assert.match(data,/xml-compare-enriched-samples-data\/v2/);
assert.match(data,/BM_CII_INPUT_SOURCE FILE_sideloaded_categorized_enriched\.xml/);
assert.match(data,/BM_CII_LINEBASIS_INPUT_TARGET FILE_categorized_enriched\.xml/);
assert.match(data,/DecompressionStream\('gzip'\)/);

console.log('xml-compare-linewise-sample-import: all assertions passed');
