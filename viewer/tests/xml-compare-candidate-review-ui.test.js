import assert from 'node:assert/strict';
import fs from 'node:fs';

const lane = fs.readFileSync('viewer/xml-compare/XmlCompareGraphConnectorLane.js','utf8');
const shell = fs.readFileSync('viewer/xml-compare/XmlCompareWorkspaceShell.js','utf8');
const runtime = fs.readFileSync('viewer/tabs/xml-compare-candidate-review-runtime.js','utf8');

assert.match(lane,/data-xml-compare-candidate-action/);
assert.match(lane,/data-source-uid/);
assert.match(lane,/data-target-uid/);
assert.match(lane,/Accept/);
assert.match(lane,/Reject/);
assert.match(shell,/xml-compare-candidate-review-runtime\.js\?v=20260701-candidate-review-1/);
assert.match(runtime,/findRecordButton/);
assert.match(runtime,/sourceButton\.click/);
assert.match(runtime,/targetButton\.click/);
assert.match(runtime,/data-xml-compare-candidate-hidden/);

console.log('xml-compare-candidate-review-ui: all assertions passed');
