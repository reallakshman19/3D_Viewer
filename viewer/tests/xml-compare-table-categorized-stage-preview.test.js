import assert from 'node:assert/strict';

import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { TABLE_CATEGORIZED_XML_STAGE_PREVIEW_STYLE_ID, buildStagePreviewModel, previewStageForSetupTab, renderTableCategorizedStagePreview } from '../xml-compare/table-categorizer/table-categorized-xml-stage-preview.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1',sourceName:'Table 2 - Model PS Data'});
const activePreviewButton=(html,label)=>html.match(new RegExp(`<button[^>]*class="is-active"[^>]*>${label}</button>`))?.[0]||'';
const assertActivePreview=(html,label)=>assert.ok(activePreviewButton(html,label), `preview tab not active: ${label}`);

assert.equal(previewStageForSetupTab('source'),'raw');
assert.equal(previewStageForSetupTab('fields'),'base');
assert.equal(previewStageForSetupTab('relationships'),'family');
assert.equal(previewStageForSetupTab('rules'),'cluster');
assert.equal(previewStageForSetupTab('structure'),'graph');
assert.equal(previewStageForSetupTab('quality'),'graph');
assert.equal(previewStageForSetupTab('output'),'xml');
assert.equal(previewStageForSetupTab('recipe'),'base');

const baseModel=buildStagePreviewModel({activeTab:'levels',sources:[source],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE},'family');
assert.equal(baseModel.rows.length,6);
assert.equal(baseModel.baseRows[0].value,'PS-XYZ');
assert.equal(baseModel.clusterRows[0].value,'C001');
assert.equal(baseModel.familyRows[0].value,'PS-XYZ__C001');
assert.equal(baseModel.familyRows[4].value,'PS-XYZ__C002');
assert.equal(baseModel.familyRows[5].value,'PS-ABC__C001');
assert.equal(TABLE_CATEGORIZED_XML_STAGE_PREVIEW_STYLE_ID,'table-categorized-stage-preview-style');

const sourceHtml=renderTableCategorizedStagePreview({activeTab:'source',activeSetupTab:'source',sources:[source],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assert.ok(sourceHtml.includes('Live Preview'));
assert.ok(sourceHtml.includes('data-stage-compact-header="true"'));
assert.ok(sourceHtml.includes('data-live-preview-compact-header="true"'));
assert.ok(sourceHtml.includes('Rows exactly as read from the table.'));
assert.ok(sourceHtml.includes('Imported Rows Proof'));
assertActivePreview(sourceHtml,'Rows');

const fieldsHtml=renderTableCategorizedStagePreview({activeTab:'levels',activeSetupTab:'fields',sources:[source],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assertActivePreview(fieldsHtml,'Base Key');
assert.ok(fieldsHtml.includes('Column Mapping Proof'));
assert.ok(fieldsHtml.includes('Source Column'));
assert.ok(fieldsHtml.includes('Table Value'));
assert.ok(fieldsHtml.includes('Common Group Key'));
assert.ok(fieldsHtml.includes('Meaning'));
assert.ok(fieldsHtml.includes('PS-XYZ.1 belongs under PS-XYZ'));
assert.ok(!fieldsHtml.includes('regexExtract'));
assert.ok(!fieldsHtml.includes('Regex Test Box'));

const familyHtml=renderTableCategorizedStagePreview({activeTab:'levels',activeSetupTab:'relationships',sources:[source],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assert.ok(familyHtml.includes('Live Preview'));
assertActivePreview(familyHtml,'Final Group');
assert.ok(familyHtml.includes('Final Group Proof'));
assert.ok(familyHtml.includes('Base Key'));
assert.ok(familyHtml.includes('Coordinate Group'));
assert.ok(familyHtml.includes('PS-XYZ__C001'));
assert.ok(familyHtml.includes('coordinate_group_found'));

const clusterHtml=renderTableCategorizedStagePreview({activeTab:'levels',activeSetupTab:'rules',sources:[source],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assertActivePreview(clusterHtml,'Coordinate Group');
assert.ok(clusterHtml.includes('Coordinate Group Proof'));
assert.ok(clusterHtml.includes('C001'));

const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const validationResults=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph});
const exportResult=exportCategorizedGraphArtifacts({graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,validationResults,sources:[source]});
const graphHtml=renderTableCategorizedStagePreview({activeTab:'graph',activeSetupTab:'structure',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph});
assertActivePreview(graphHtml,'Graph View');
assert.ok(graphHtml.includes('Graph Build Proof'));
assert.ok(graphHtml.includes('PS-XYZ__C001'));
const qualityHtml=renderTableCategorizedStagePreview({activeTab:'validation',activeSetupTab:'quality',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,validationResults});
assertActivePreview(qualityHtml,'Graph View');
assert.ok(qualityHtml.includes('Graph Build Proof'));
const xmlHtml=renderTableCategorizedStagePreview({activeTab:'export',activeSetupTab:'output',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,exportResult});
assertActivePreview(xmlHtml,'XML View');
assert.ok(xmlHtml.includes('XML Output Proof'));
assert.ok(xmlHtml.includes('&lt;CategorizedTableXml'));
const recipeHtml=renderTableCategorizedStagePreview({activeTab:'levels',activeSetupTab:'recipe',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assertActivePreview(recipeHtml,'Base Key');
const manualOverrideHtml=renderTableCategorizedStagePreview({activeTab:'export',activeSetupTab:'output',activePreviewStage:'graph',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,exportResult});
assertActivePreview(manualOverrideHtml,'Graph View');

console.log('xml-compare-table-categorized-stage-preview: all assertions passed');
