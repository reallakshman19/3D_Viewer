import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.resolve('viewer/tabs/xml-compare-tab.js'),'utf8');
assert.match(source,/createXmlCompareWorkspaceModel/);
assert.match(source,/renderXmlCompareWorkspaceShellHtml\(workspace\)/);
assert.match(source,/createXmlCompareCanvasState/);
assert.match(source,/applyXmlCompareCanvasAction/);
assert.match(source,/data-xml-compare-nav-mode/);
assert.match(source,/data-xml-compare-nav-action/);
assert.match(source,/fileA: state\.fileA/);
assert.match(source,/fileB: state\.fileB/);
assert.match(source,/accept="\.xml,\.XML,\.json,\.JSON"/);
assert.match(source,/Source-target XML comparison workspace/);
console.log('xml-compare-tab-workspace-mount: all assertions passed');
