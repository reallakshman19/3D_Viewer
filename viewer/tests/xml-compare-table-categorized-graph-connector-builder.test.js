import assert from 'node:assert/strict';

import { createCategorizedGraphCanvasModel } from '../xml-compare/table-categorizer/table-categorized-xml-graph-canvas-adapter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { buildCategorizedGraphConnectors } from '../xml-compare/table-categorizer/table-categorized-xml-graph-connector-builder.js';
import { comparePsMappingCategorizedGraphs } from '../xml-compare/table-categorizer/table-categorized-xml-ps-mapping-compare.js';
import { PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';

const targetText=`PS NO\tBore\tpipe\tDTXR\tSupport Gap\tMandatory\tX\tY\tZ
PS-XYZ.1\tDN80\tLINE-A\tGUIDE\t25\tYES\t1000\t2000\t3000
PS-XYZ.2\tDN80\tLINE-A\tLINE STOP\t0\tYES\t1001\t2000\t3000
PS-XYZ.10\tDN80\tLINE-A\tGUIDE\t10\tYES\t1000.2\t2000\t3000
PS-XYZ.3\tDN80\tLINE-A\tGUIDE\t10\tYES\t1500\t2000\t3000
PS-ABC.1\tDN80\tLINE-A\tGUIDE\t10\tNO\t1000\t2000\t3000
PS-NEW.1\tDN80\tLINE-A\tGUIDE\t10\tYES\t3000\t2000\t3000`;

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1',sourceName:'Model Table 2'});
const target=parseTableSource(targetText,{sourceId:'S1',sourceName:'Reference Table 2'});
const sourceGraph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const targetGraph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[target]);
const sourceCanvasModel=createCategorizedGraphCanvasModel({graph:sourceGraph,side:'source',title:'Source Graph'});
const targetCanvasModel=createCategorizedGraphCanvasModel({graph:targetGraph,side:'target',title:'Target Graph'});
const graphCompareResult=comparePsMappingCategorizedGraphs({sourceGraph,targetGraph});
const connectors=buildCategorizedGraphConnectors({sourceCanvasModel,targetCanvasModel,graphCompareResult});

assert.equal(connectors.schema,'table-categorized-xml-graph-connectors/v1');
assert.equal(connectors.matchMap.schema,'table-categorized-xml-graph-match-map/v1');
assert.equal(connectors.connectorCandidates.schema,'table-categorized-xml-graph-connector-candidates/v1');
assert.equal(connectors.matchMap.request.scope,'categorized-graph');
assert.equal(connectors.matchMap.request.sourceSide,'source');
assert.equal(connectors.matchMap.request.targetSide,'target');
assert.equal(connectors.connectorCandidates.summary.enabled,true);

const mappedFeature=connectors.matchMap.matches.find((connector)=>connector.compareLevel==='SupportFeature'&&connector.sourceKey==='PS-XYZ.1_GUIDE'&&connector.matchType==='MATCHED');
assert.ok(mappedFeature,'Mapped SupportFeature creates matchMap connector');
assert.equal(mappedFeature.id,'graph-conn:SupportFeature:PS-XYZ.1_GUIDE');
assert.equal(mappedFeature.sourceUid,'graph:source:SupportFeature:PS-XYZ.1_GUIDE');
assert.equal(mappedFeature.targetUid,'graph:target:SupportFeature:PS-XYZ.1_GUIDE');
assert.equal(mappedFeature.type,'EXACT');
assert.equal(mappedFeature.connectorKind,'GRAPH_COMPARE');
assert.equal(mappedFeature.compareLevel,'SupportFeature');
assert.equal(mappedFeature.matchType,'MATCHED');
assert.equal(mappedFeature.severity,'INFO');
assert.equal(mappedFeature.sourceKey,'PS-XYZ.1_GUIDE');
assert.equal(mappedFeature.targetKey,'PS-XYZ.1_GUIDE');
assert.ok(mappedFeature.sourceRefs.includes('S1:1'));
assert.ok(mappedFeature.targetRefs.includes('S1:1'));

const mismatch=connectors.matchMap.matches.find((connector)=>connector.matchType==='MISMATCH'&&connector.compareLevel==='Gap'&&connector.sourceKey==='PS-XYZ.1_GUIDE_Gap');
assert.ok(mismatch,'Gap mismatch creates semantic mismatch connector');
assert.equal(mismatch.type,'CANDIDATE');
assert.equal(mismatch.severity,'WARNING');
assert.equal(mismatch.targetKey,'PS-XYZ.1_GUIDE_Gap');
assert.ok(mismatch.finding.includes('Gap mismatch'));

const missing=connectors.connectorCandidates.candidates.find((connector)=>connector.matchType==='MISSING_IN_TARGET'&&connector.sourceKey==='PS-XYZ.7_REST');
assert.ok(missing,'Missing SupportFeature creates source-only marker');
assert.equal(missing.type,'MISSING');
assert.equal(missing.severity,'BLOCKER');
assert.equal(missing.sourceUid,'graph:source:SupportFeature:PS-XYZ.7_REST');
assert.equal(missing.targetUid,'');

const extra=connectors.connectorCandidates.candidates.find((connector)=>connector.matchType==='EXTRA_IN_TARGET'&&connector.targetKey==='PS-NEW.1_GUIDE');
assert.ok(extra,'Extra SupportFeature creates target-only marker');
assert.equal(extra.type,'EXTRA');
assert.equal(extra.severity,'WARNING');
assert.equal(extra.sourceUid,'');
assert.equal(extra.targetUid,'graph:target:SupportFeature:PS-NEW.1_GUIDE');

assert.equal(connectors.connectorCandidates.summary.missingCount,connectors.connectorCandidates.candidates.filter((c)=>c.matchType==='MISSING_IN_TARGET').length);
assert.equal(connectors.connectorCandidates.summary.extraCount,connectors.connectorCandidates.candidates.filter((c)=>c.matchType==='EXTRA_IN_TARGET').length);
assert.equal(connectors.connectorCandidates.summary.mismatchCount,connectors.matchMap.matches.filter((c)=>c.matchType==='MISMATCH').length);

assert.ok(!connectors.matchMap.matches.some((connector)=>connector.sourceKey==='PS-XYZ.1_GUIDE'&&connector.targetKey==='PS-XYZ.10_GUIDE'));
assert.ok(!connectors.matchMap.matches.some((connector)=>connector.sourceKey==='PS-XYZ__C001'&&connector.targetKey==='PS-XYZ__C002'));

const duplicateSource={...sourceCanvasModel,records:[...sourceCanvasModel.records,{...sourceCanvasModel.records.find((record)=>record.compareLevel==='SupportFeature'&&record.key==='PS-XYZ.1_GUIDE'),uid:'graph:source:SupportFeature:PS-XYZ.1_GUIDE_DUP'}]};
const duplicateResult=buildCategorizedGraphConnectors({sourceCanvasModel:duplicateSource,targetCanvasModel,graphCompareResult});
assert.ok(duplicateResult.diagnostics.some((diagnostic)=>diagnostic.code==='duplicate_canvas_key'));

const unresolvedSource=buildCategorizedGraphConnectors({sourceCanvasModel,targetCanvasModel,graphCompareResult:{mapped:[{level:'SupportFeature',path:'PS-XYZ__C001/PS-MISSING.1/PS-MISSING.1_GUIDE',sourcePath:'PS-XYZ__C001/PS-MISSING.1/PS-MISSING.1_GUIDE',targetPath:'PS-XYZ__C001/PS-XYZ.1/PS-XYZ.1_GUIDE'}],mismatches:[],missing:[],extra:[]}});
assert.ok(unresolvedSource.diagnostics.some((diagnostic)=>diagnostic.code==='unresolved_source_key'));
const unresolvedTarget=buildCategorizedGraphConnectors({sourceCanvasModel,targetCanvasModel,graphCompareResult:{mapped:[{level:'SupportFeature',path:'PS-XYZ__C001/PS-XYZ.1/PS-XYZ.1_GUIDE',sourcePath:'PS-XYZ__C001/PS-XYZ.1/PS-XYZ.1_GUIDE',targetPath:'PS-XYZ__C001/PS-MISSING.1/PS-MISSING.1_GUIDE'}],mismatches:[],missing:[],extra:[]}});
assert.ok(unresolvedTarget.diagnostics.some((diagnostic)=>diagnostic.code==='unresolved_target_key'));

const malformed=buildCategorizedGraphConnectors({sourceCanvasModel,targetCanvasModel,graphCompareResult:{mapped:[null,{level:'SupportFeature'}],mismatches:[],missing:[],extra:[{level:'UnknownLevel',path:'A'}]}});
assert.ok(malformed.diagnostics.some((diagnostic)=>diagnostic.code==='malformed_compare_item'));
assert.ok(malformed.diagnostics.some((diagnostic)=>diagnostic.code==='unsupported_compare_level'));

const missingInputs=buildCategorizedGraphConnectors({});
assert.ok(missingInputs.diagnostics.some((diagnostic)=>diagnostic.code==='missing_source_canvas_model'));
assert.ok(missingInputs.diagnostics.some((diagnostic)=>diagnostic.code==='missing_target_canvas_model'));
assert.ok(missingInputs.diagnostics.some((diagnostic)=>diagnostic.code==='missing_graph_compare_result'));

console.log('xml-compare-table-categorized-graph-connector-builder: all assertions passed');
