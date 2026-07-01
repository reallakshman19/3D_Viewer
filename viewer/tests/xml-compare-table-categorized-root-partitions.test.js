import assert from 'node:assert/strict';

import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { PS_MAPPING_COORDINATE_LOOKUP_SAMPLE, PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE, PS_MAPPING_TABLE_2_MODEL_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE, PS_MAPPING_TABLE_2_SAMPLE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

const s1=parseTableSource(PS_MAPPING_TABLE_2_MODEL_SAMPLE,{sourceId:'S1'});
const s2=parseTableSource(PS_MAPPING_COORDINATE_LOOKUP_SAMPLE,{sourceId:'S2'});
const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE,[s1,s2]);
const families=graph.nodes.filter((node)=>node.levelId==='supportFamily');
assert.ok(families.find((node)=>node.key==='PS-XYZ__C001'));
assert.ok(families.find((node)=>node.key==='PS-XYZ__C002'));
assert.ok(families.find((node)=>node.key==='PS-ABC__C001'));
const xyz=graph.nodes.find((node)=>node.key==='PS-XYZ__C001');
const childIds=new Set(graph.edges.filter((edge)=>edge.fromNodeId===xyz.id).map((edge)=>edge.toNodeId));
const childKeys=graph.nodes.filter((node)=>childIds.has(node.id)).map((node)=>node.key);
assert.deepEqual(childKeys.sort(),['PS-XYZ.1','PS-XYZ.10','PS-XYZ.2','PS-XYZ.7'].sort());
assert.ok(xyz.sourceRefs.includes('S1:1'));
assert.ok(xyz.sourceRefs.includes('S2:1'));

const validation=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE,sources:[s1,s2],graph});
const exported=exportCategorizedGraphArtifacts({graph,profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE,validationResults:validation,sources:[s1,s2]});
assert.equal((exported.xmlText.match(/<CategorizedTableXml\b/g)||[]).length,1);
assert.ok(exported.xmlText.includes('<RootPartition key="MODEL_SIDE"'));
assert.ok(exported.xmlText.includes('sourceRefs="S1:1'));
assert.ok(JSON.parse(exported.auditJson).sourceSummary.length===2);

const perSource={...PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE,rootPartitionMode:'perSource'};
const perSourceGraph=buildCategorizedGraph(perSource,[s1,s2]);
const partitions=perSourceGraph.nodes.filter((node)=>node.levelId==='rootPartition');
assert.equal(partitions.length,2);
assert.ok(partitions.find((node)=>node.key==='S1'));
assert.ok(partitions.find((node)=>node.key==='S2'));

const oneSource=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1'});
const oneGraph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[oneSource]);
assert.ok(oneGraph.nodes.find((node)=>node.key==='PS-XYZ__C001'));

console.log('xml-compare-table-categorized-root-partitions: all assertions passed');
