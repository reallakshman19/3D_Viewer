import assert from 'node:assert/strict';

import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1'});
const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);

function nodes(levelId){return graph.nodes.filter((node)=>node.levelId===levelId);}
function node(levelId,key){return graph.nodes.find((item)=>item.levelId===levelId&&item.key===key);}
function childKeys(parent){
  const childIds=new Set(graph.edges.filter((edge)=>edge.fromNodeId===parent.id).map((edge)=>edge.toNodeId));
  return graph.nodes.filter((item)=>childIds.has(item.id)).map((item)=>item.key);
}

assert.equal(nodes('categorizedTableGraph').length,1,'static root created once');
assert.equal(nodes('rootPartition').length,1,'MODEL_SIDE partition created once');

const xyzC001=node('supportFamily','PS-XYZ__C001');
assert.ok(xyzC001);
assert.deepEqual(childKeys(xyzC001).sort(),['PS-XYZ.1','PS-XYZ.10','PS-XYZ.2','PS-XYZ.7'].sort());

const xyzC002=node('supportFamily','PS-XYZ__C002');
assert.ok(xyzC002);
assert.deepEqual(childKeys(xyzC002),['PS-XYZ.3']);

const abcC001=node('supportFamily','PS-ABC__C001');
assert.ok(abcC001);
assert.deepEqual(childKeys(abcC001),['PS-ABC.1']);

assert.ok(node('supportOccurrence','PS-XYZ.10'),'SupportOccurrence preserves suffix');
assert.equal(node('supportFeature','PS-XYZ.2_LINE_STOP').fields.featureType,'LINE_STOP');

const feature=node('supportFeature','PS-XYZ.1_GUIDE');
const gapKey=childKeys(feature)[0];
assert.equal(gapKey,'PS-XYZ.1_GUIDE_Gap','Gap is under SupportFeature');
assert.equal(node('gap','PS-XYZ.1_GUIDE_Gap').fields.value,10);
assert.ok(node('supportOccurrence','PS-XYZ.1').sourceRefs.includes('S1:1'));
assert.ok(graph.edges.length>0,'ownership edges are explicit');
assert.ok(!JSON.stringify(graph).includes('<CategorizedInputXML'));

console.log('xml-compare-table-categorized-graph-builder: all assertions passed');
