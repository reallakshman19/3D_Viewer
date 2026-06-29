import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const indexHtml=fs.readFileSync(path.resolve('viewer/index.html'),'utf8');
const tabCss=fs.readFileSync(path.resolve('viewer/tabs/xml-compare-tab.css'),'utf8');

assert.match(indexHtml,/tabs\/xml-compare-tab\.css\?v=/,'XML Compare stylesheet must be loaded by the app shell');
assert.match(indexHtml,/20260628-xml-compare-sideload-ui-1/,'XML Compare stylesheet cache key must be visible');
assert.match(tabCss,/\.xml-compare-workspace-grid\s*\{/,'workspace grid style must exist');
assert.match(tabCss,/\.xml-compare-sideload-dialog\s*\{/,'sideload dialog style must exist');
assert.match(tabCss,/\.xml-compare-layout\s*\{/,'legacy topology layout style must exist');

console.log('xml-compare-tab-css-load: all assertions passed');
