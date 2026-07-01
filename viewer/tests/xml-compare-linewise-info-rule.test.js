import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync('viewer/tabs/xml-compare-linewise-info-rule-runtime.js','utf8');
const shell=fs.readFileSync('viewer/xml-compare/XmlCompareWorkspaceShell.js','utf8');

assert.match(runtime,/Line-wise Categorized XML ownership rule/);
assert.match(runtime,/LineBlock/);
assert.match(runtime,/PipingClass/);
assert.match(runtime,/Rating/);
assert.match(runtime,/Element owns the route span/);
assert.match(runtime,/RouteGeometryBlock/);
assert.match(runtime,/DELTA_X/);
assert.match(runtime,/DELTA_Y/);
assert.match(runtime,/DELTA_Z/);
assert.match(runtime,/NodesBlock is a child of Element/);
assert.match(runtime,/RestraintsBlock is a child of Node/);
assert.match(runtime,/DISPLACEMENTS by NODE_NUM/);
assert.match(runtime,/FORCESMOMENTS by NODE_NUM/);
assert.match(runtime,/SIF by NODE/);
assert.match(runtime,/Sentinel suppression/);
assert.match(runtime,/data-xml-compare-linewise-info-rule/);
assert.match(shell,/xml-compare-linewise-info-rule-runtime\.js\?v=20260701-linewise-rule-info-1/);
assert.match(shell,/loadLinewiseInfoRuleRuntime\(\)/);

console.log('xml-compare-linewise-info-rule: all assertions passed');
