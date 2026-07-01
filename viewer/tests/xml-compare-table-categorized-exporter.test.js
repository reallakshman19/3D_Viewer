import assert from 'node:assert/strict';

import { exportCategorizedGraphArtifacts, xmlAttr } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1'});
const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const validationResults=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph});
const result=exportCategorizedGraphArtifacts({graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,validationResults,sources:[source]});

assert.equal(result.ok,true);
assert.equal((result.xmlText.match(/<CategorizedTableXml\b/g)||[]).length,1);
assert.ok(result.xmlText.trim().endsWith('</CategorizedTableXml>'));
assert.ok(result.xmlText.includes('<RootPartition key="MODEL_SIDE"'));
assert.ok(result.xmlText.includes('<SupportFamily key="PS-XYZ__C001"'));
assert.ok(result.xmlText.includes('<SupportOccurrence key="PS-XYZ.10"'));
assert.ok(result.xmlText.includes('<SupportFeature key="PS-XYZ.1_GUIDE"'));
assert.ok(result.xmlText.includes('<Gap key="PS-XYZ.1_GUIDE_Gap"'));
assert.ok(result.xmlText.indexOf('<SupportFeature key="PS-XYZ.1_GUIDE"')<result.xmlText.indexOf('<Gap key="PS-XYZ.1_GUIDE_Gap"'));
assert.equal(result.xmlText.includes('keyResolver'),false);
assert.equal(result.xmlText.includes('fieldResolvers'),false);
assert.equal(result.xmlText.includes('<CategorizedInputXML'),false);

const blocked=exportCategorizedGraphArtifacts({graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,validationResults:[{gate:'required_columns_present',severity:'BLOCKER',status:'FAIL',message:'blocked'}],sources:[source]});
assert.equal(blocked.ok,false);
assert.equal(blocked.xmlText,'');
assert.equal(blocked.diagnostics[0].code,'export_blocked_by_validation');

const escapedGraph={...graph,documentRootNodeIds:['root'],nodes:[
  {schema:'GraphNode.v1',id:'root',levelId:'categorizedTableGraph',levelType:'container',key:'root',displayName:'root',parentId:null,sourceRefs:[],fields:{documentRoot:true},evidence:[],diagnostics:[]},
  {schema:'GraphNode.v1',id:'part',levelId:'rootPartition',levelType:'partition',key:'A&B<root>"\'',displayName:'A&B<root>"\'',parentId:'root',sourceRefs:['S1:1'],fields:{},evidence:[],diagnostics:[]}
],edges:[{schema:'GraphEdge.v1',id:'e1',edgeType:'owns',fromNodeId:'root',toNodeId:'part'}]};
const escaped=exportCategorizedGraphArtifacts({graph:escapedGraph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,validationResults:[],sources:[source]});
assert.ok(escaped.xmlText.includes('A&amp;B&lt;root&gt;&quot;&apos;'));
assert.equal(xmlAttr('&<>"\''),'&amp;&lt;&gt;&quot;&apos;');

const graphJson=JSON.parse(result.graphJson);
const profileJson=JSON.parse(result.profileJson);
const diagnosticsJson=JSON.parse(result.diagnosticsJson);
const auditJson=JSON.parse(result.auditJson);
assert.ok(graphJson.nodes.some((node)=>node.schema==='GraphNode.v1'));
assert.ok(graphJson.edges.some((edge)=>edge.schema==='GraphEdge.v1'));
assert.equal(profileJson.profileId,'ps-mapping-table-2-shadow-profile');
assert.ok(diagnosticsJson.some((item)=>item.gate==='graph_has_single_document_root'));
assert.equal(auditJson.graphNodeCount,graph.nodes.length);
assert.equal(auditJson.graphEdgeCount,graph.edges.length);
assert.ok(auditJson.sourceRefsCoverage.uniqueSourceRefs.includes('S1:1'));

console.log('xml-compare-table-categorized-exporter: all assertions passed');
