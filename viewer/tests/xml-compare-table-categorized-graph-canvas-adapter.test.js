import assert from 'node:assert/strict';

import { createCategorizedGraphCanvasModel } from '../xml-compare/table-categorizer/table-categorized-xml-graph-canvas-adapter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1',sourceName:'PS Mapping Table 2'});
const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const model=createCategorizedGraphCanvasModel({graph,side:'source',title:'Source Graph'});

assert.equal(model.schema,'table-categorized-xml-graph-canvas-model/v1');
assert.equal(model.side,'source');
assert.equal(model.title,'Source Graph');
assert.equal(model.profileId,'ps-mapping-table-2-shadow-profile');
assert.equal(model.levelView,model.levelViews.SupportFeature);
assert.equal(model.levelView.label,'Support Features');
assert.equal(model.levelView.layout,'cards');
assert.equal(model.levelView.displayField,'displayName');
assert.equal(model.levelView.keyField,'featureKey');

const family=model.levelViews.SupportFamily.records.find((record)=>record.familyKey==='PS-XYZ__C001');
assert.ok(family,'SupportFamily record is created for PS-XYZ__C001');
assert.equal(family.uid,'graph:source:SupportFamily:PS-XYZ__C001');
assert.equal(family.displayName,'PS-XYZ');
assert.ok(family.sourceRefs.includes('S1:1'));

const occurrence=model.levelViews.SupportOccurrence.records.find((record)=>record.occurrenceKey==='PS-XYZ.1');
assert.ok(occurrence,'SupportOccurrence record is created for PS-XYZ.1');
assert.equal(occurrence.uid,'graph:source:SupportOccurrence:PS-XYZ.1');
assert.equal(occurrence.familyKey,'PS-XYZ__C001');
assert.equal(occurrence.bore,'DN80');
assert.equal(occurrence.pipe,'LINE-A');
assert.equal(occurrence.mandatory,'YES');
assert.ok(occurrence.sourceRefs.includes('S1:1'));

const feature=model.levelViews.SupportFeature.records.find((record)=>record.featureKey==='PS-XYZ.1_GUIDE');
assert.ok(feature,'SupportFeature record is created for PS-XYZ.1_GUIDE');
assert.equal(feature.uid,'graph:source:SupportFeature:PS-XYZ.1_GUIDE');
assert.equal(feature.graphNodeId.startsWith('node_'),true);
assert.equal(feature.compareLevel,'SupportFeature');
assert.equal(feature.levelId,'supportFeature');
assert.equal(feature.familyKey,'PS-XYZ__C001');
assert.equal(feature.occurrenceKey,'PS-XYZ.1');
assert.equal(feature.featureType,'GUIDE');
assert.equal(feature.gapValue,'10');
assert.equal(feature.bore,'DN80');
assert.equal(feature.pipe,'LINE-A');
assert.equal(feature.mandatory,'YES');
assert.equal(feature.dtxr,'GUIDE');
assert.equal(feature.displayName,'PS-XYZ.1 GUIDE');
assert.equal(feature.key,'PS-XYZ.1_GUIDE');
assert.ok(feature.sourceRefs.includes('S1:1'));

const gap=model.levelViews.Gap.records.find((record)=>record.key==='PS-XYZ.1_GUIDE_Gap');
assert.ok(gap,'Gap record is created for PS-XYZ.1_GUIDE_Gap');
assert.equal(gap.uid,'graph:source:Gap:PS-XYZ.1_GUIDE_Gap');
assert.equal(gap.featureType,'GUIDE');
assert.equal(gap.gapValue,'10');
assert.equal(gap.displayName,'PS-XYZ.1 GUIDE Gap 10');
assert.ok(gap.sourceRefs.includes('S1:1'));

const targetModel=createCategorizedGraphCanvasModel({graph,side:'target',title:'Target Graph'});
assert.ok(targetModel.levelViews.SupportFeature.records.some((record)=>record.uid==='graph:target:SupportFeature:PS-XYZ.1_GUIDE'));
assert.ok(model.levelViews.SupportFeature.records.some((record)=>record.uid==='graph:source:SupportFeature:PS-XYZ.1_GUIDE'));

assert.ok(model.records.length>=model.levelViews.SupportFeature.records.length);
assert.deepEqual(model.levelViews.SupportFamily.fields,['familyKey','sourceRefs']);
assert.deepEqual(model.levelViews.SupportOccurrence.fields,['familyKey','bore','pipe','mandatory','sourceRefs']);
assert.deepEqual(model.levelViews.SupportFeature.fields,['featureType','gapValue','bore','pipe','mandatory','sourceRefs']);
assert.deepEqual(model.levelViews.Gap.fields,['featureType','gapValue','sourceRefs']);
assert.ok(model.hierarchy.rootKeys.includes('PS-XYZ__C001'));
assert.ok(model.hierarchy.familyToOccurrences['PS-XYZ__C001'].includes('PS-XYZ.1'));
assert.ok(model.hierarchy.occurrenceToFeatures['PS-XYZ.1'].includes('PS-XYZ.1_GUIDE'));
assert.ok(model.hierarchy.featureToGaps['PS-XYZ.1_GUIDE'].includes('PS-XYZ.1_GUIDE_Gap'));
assert.deepEqual(model.diagnostics.filter((d)=>d.severity==='ERROR'),[]);

const duplicateGraph={...graph,nodes:[...graph.nodes,graph.nodes.find((node)=>node.levelId==='supportFeature'&&node.key==='PS-XYZ.1_GUIDE')]};
const duplicateModel=createCategorizedGraphCanvasModel({graph:duplicateGraph,side:'source'});
assert.ok(duplicateModel.diagnostics.some((diagnostic)=>diagnostic.code==='duplicate_generated_uid'));

const featureNode=graph.nodes.find((node)=>node.levelId==='supportFeature'&&node.key==='PS-XYZ.1_GUIDE');
const orphanFeatureGraph={...graph,nodes:[{...featureNode,id:'orphan_feature_1',parentId:null}],edges:[]};
const orphanFeatureModel=createCategorizedGraphCanvasModel({graph:orphanFeatureGraph,side:'source'});
assert.ok(orphanFeatureModel.diagnostics.some((diagnostic)=>diagnostic.code==='orphan_feature_without_occurrence'));

const gapNode=graph.nodes.find((node)=>node.levelId==='gap'&&node.key==='PS-XYZ.1_GUIDE_Gap');
const orphanGapGraph={...graph,nodes:[{...gapNode,id:'orphan_gap_1',parentId:null}],edges:[]};
const orphanGapModel=createCategorizedGraphCanvasModel({graph:orphanGapGraph,side:'source'});
assert.ok(orphanGapModel.diagnostics.some((diagnostic)=>diagnostic.code==='orphan_gap_without_feature'));

const noGraph=createCategorizedGraphCanvasModel({graph:null});
assert.ok(noGraph.diagnostics.some((diagnostic)=>diagnostic.code==='missing_graph'));
const empty=createCategorizedGraphCanvasModel({graph:{profileId:'empty',nodes:[],edges:[]}});
assert.ok(empty.diagnostics.some((diagnostic)=>diagnostic.code==='graph_has_no_nodes'));
const unsupported=createCategorizedGraphCanvasModel({graph:{profileId:'x',nodes:[{id:'n1',levelId:'unknownLevel',levelType:'unknown',key:'A',displayName:'A',sourceRefs:[],fields:{},evidence:[]}],edges:[]}});
assert.ok(unsupported.diagnostics.some((diagnostic)=>diagnostic.code==='unsupported_level_ignored'));
const missingKey=createCategorizedGraphCanvasModel({graph:{profileId:'x',nodes:[{id:'n1',levelId:'supportFamily',levelType:'group',key:'',displayName:'No key',sourceRefs:[],fields:{},evidence:[]}],edges:[]}});
assert.ok(missingKey.diagnostics.some((diagnostic)=>diagnostic.code==='missing_key_on_graph_node'));

console.log('xml-compare-table-categorized-graph-canvas-adapter: all assertions passed');
