import assert from 'node:assert/strict';

import { createCoordinateClusterState } from '../xml-compare/table-categorizer/table-categorized-xml-coordinate-cluster.js';
import { createResolverContext, runResolver } from '../xml-compare/table-categorizer/table-categorized-xml-resolver-engine.js';

const row={rowId:'S1:1',rawByHeader:{'PS NO':' PS-XYZ.10 ',DTXR:'LINE STOP','Support Gap':'10 mm',X:'1000',Y:'2000',Z:'3000'}};
const rowNear={rowId:'S1:2',rawByHeader:{X:'1001',Y:'2000',Z:'3000'}};
const rowFar={rowId:'S1:3',rawByHeader:{X:'1500',Y:'2000',Z:'3000'}};

const full=runResolver({op:'trim',column:'PS NO'},row);
assert.equal(full.value,'PS-XYZ.10');

const base=runResolver({op:'regexExtract',input:{op:'trim',column:'PS NO'},pattern:'^(.+?)\\.\\d+$',group:1},row);
assert.equal(base.value,'PS-XYZ');

const classified=runResolver({op:'classifier',column:'DTXR'},row);
assert.equal(classified.value,'LINE_STOP');

const parsed=runResolver({op:'numberParser',column:'Support Gap'},row);
assert.equal(parsed.value,10);

const context=createResolverContext({tolerance:2});
assert.equal(runResolver({op:'coordinateCluster'},row,context).value,'C001');
assert.equal(runResolver({op:'coordinateCluster'},rowNear,context).value,'C001');
assert.equal(runResolver({op:'coordinateCluster'},rowFar,context).value,'C002');

const missing=runResolver({op:'coordinateCluster'}, {rowId:'S1:4',rawByHeader:{}}, createResolverContext());
assert.equal(missing.ok,false);
assert.equal(missing.diagnostics[0].severity,'WARNING');

const state=createCoordinateClusterState({tolerance:1});
assert.equal(state.clusters.length,0);
console.log('xml-compare-table-categorized-resolver-engine: all assertions passed');
