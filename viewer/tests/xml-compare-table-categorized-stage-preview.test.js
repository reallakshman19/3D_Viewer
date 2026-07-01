import assert from 'node:assert/strict';

import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { TABLE_CATEGORIZED_XML_STAGE_PREVIEW_STYLE_ID, buildStagePreviewModel, renderTableCategorizedStagePreview } from '../xml-compare/table-categorizer/table-categorized-xml-stage-preview.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1',sourceName:'Table 2 - Model PS Data'});

const baseModel=buildStagePreviewModel({activeTab:'levels',sources:[source],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE},'family');
assert.equal(baseModel.rows.length,6);
assert.equal(baseModel.baseRows[0].value,'PS-XYZ');
assert.equal(baseModel.clusterRows[0].value,'C001');
assert.equal(baseModel.familyRows[0].value,'PS-XYZ__C001');
assert.equal(baseModel.familyRows[4].value,'PS-XYZ__C002');
assert.equal(baseModel.familyRows[5].value,'PS-ABC__C001');

assert.equal(TABLE_CATEGORIZED_XML_STAGE_PREVIEW_STYLE_ID,'table-categorized-stage-preview-style');

const familyHtml=renderTableCategorizedStagePreview({activeTab:'levels',previewStage:'family',sources:[source],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assert.ok(familyHtml.includes('Stage Preview'));
assert.ok(familyHtml.includes('right inspector'));
assert.ok(familyHtml.includes('SupportFamily Grouping'));
assert.ok(familyHtml.includes('PS Base'));
assert.ok(familyHtml.includes('Cluster'));
assert.ok(familyHtml.includes('PS-XYZ__C001'));
assert.ok(familyHtml.includes('coordinate_cluster_resolved'));
assert.ok(familyHtml.includes('<svg'));
assert.ok(familyHtml.includes('mapping-flow'));
assert.ok(familyHtml.includes('TABLE COLUMNS'));
assert.ok(familyHtml.includes('RESOLVERS'));
assert.ok(familyHtml.includes('CANONICAL GRAPH'));

const clusterHtml=renderTableCategorizedStagePreview({activeTab:'levels',previewStage:'cluster',sources:[source],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assert.ok(clusterHtml.includes('Coordinate Cluster'));
assert.ok(clusterHtml.includes('Tolerance'));
assert.ok(clusterHtml.includes('C001'));
assert.ok(clusterHtml.includes('<svg'));

const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const validationResults=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph});
const exportResult=exportCategorizedGraphArtifacts({graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,validationResults,sources:[source]});
const graphHtml=renderTableCategorizedStagePreview({activeTab:'graph',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph});
assert.ok(graphHtml.includes('Canonical Graph'));
assert.ok(graphHtml.includes('PS-XYZ__C001'));
assert.ok(graphHtml.includes('graph-flow'));
const xmlHtml=renderTableCategorizedStagePreview({activeTab:'export',previewStage:'xml',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,exportResult});
assert.ok(xmlHtml.includes('XML Snippet'));
assert.ok(xmlHtml.includes('&lt;CategorizedTableXml'));
assert.ok(xmlHtml.includes('graph-flow'));

console.log('xml-compare-table-categorized-stage-preview: all assertions passed');
