import assert from 'node:assert/strict';

import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { TABLE_CATEGORIZED_USER_FLOW_STEPS, TABLE_CATEGORIZED_XML_STAGE_PREVIEW_STYLE_ID, buildStagePreviewModel, previewStageForSetupTab, renderTableCategorizedStagePreview } from '../xml-compare/table-categorizer/table-categorized-xml-stage-preview.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1',sourceName:'Table 2 - Model PS Data'});
const activePreviewButton=(html,label)=>html.match(new RegExp(`<button[^>]*class="is-active"[^>]*>${label}</button>`))?.[0]||'';
const assertActivePreview=(html,label)=>assert.ok(activePreviewButton(html,label), `preview tab not active: ${label}`);
const assertCurrentNext=(html,current,next)=>{assert.ok(html.includes(`Current: ${current}`),`missing current ${current}`);assert.ok(html.includes(`Next: ${next}`),`missing next ${next}`);assert.ok(html.includes('data-current-next-step'));};

assert.equal(previewStageForSetupTab('source'),'raw');
assert.equal(previewStageForSetupTab('fields'),'base');
assert.equal(previewStageForSetupTab('relationships'),'family');
assert.equal(previewStageForSetupTab('rules'),'cluster');
assert.equal(previewStageForSetupTab('structure'),'graph');
assert.equal(previewStageForSetupTab('quality'),'graph');
assert.equal(previewStageForSetupTab('output'),'xml');
assert.equal(previewStageForSetupTab('recipe'),'base');
assert.deepEqual(TABLE_CATEGORIZED_USER_FLOW_STEPS.map(([id])=>id),['source','fields','rules','relationships','structure','quality','output','recipe']);

const baseModel=buildStagePreviewModel({activeTab:'levels',activeSetupTab:'relationships',sources:[source],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE},'family');
assert.equal(baseModel.rows.length,6);
assert.equal(baseModel.activeSetupTab,'relationships');
assert.equal(baseModel.baseRows[0].value,'PS-XYZ');
assert.equal(baseModel.clusterRows[0].value,'C001');
assert.equal(baseModel.familyRows[0].value,'PS-XYZ__C001');
assert.equal(baseModel.familyRows[4].value,'PS-XYZ__C002');
assert.equal(baseModel.familyRows[5].value,'PS-ABC__C001');
assert.equal(TABLE_CATEGORIZED_XML_STAGE_PREVIEW_STYLE_ID,'table-categorized-stage-preview-style');

const sourceHtml=renderTableCategorizedStagePreview({activeTab:'source',activeSetupTab:'source',sources:[source],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assert.ok(sourceHtml.includes('Live Preview'));
assert.ok(sourceHtml.includes('Rows exactly as read from the table.'));
assert.ok(sourceHtml.includes('Imported Rows Proof'));
assert.ok(sourceHtml.includes('Load or paste table.'));
assertCurrentNext(sourceHtml,'Source','Fields');
assertActivePreview(sourceHtml,'Rows');

const fieldsHtml=renderTableCategorizedStagePreview({activeTab:'levels',activeSetupTab:'fields',sources:[source],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assertActivePreview(fieldsHtml,'Base Key');
assert.ok(fieldsHtml.includes('Column Mapping Proof'));
assert.ok(fieldsHtml.includes('Confirm column mapping.'));
assertCurrentNext(fieldsHtml,'Fields','Rules');
assert.ok(fieldsHtml.includes('Source Column'));
assert.ok(fieldsHtml.includes('Table Value'));
assert.ok(fieldsHtml.includes('Common Group Key'));
assert.ok(fieldsHtml.includes('Meaning'));
assert.ok(fieldsHtml.includes('PS-XYZ.1 belongs under PS-XYZ'));
assert.ok(!fieldsHtml.includes('regexExtract'));

const clusterHtml=renderTableCategorizedStagePreview({activeTab:'levels',activeSetupTab:'rules',sources:[source],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assertActivePreview(clusterHtml,'Coordinate Group');
assert.ok(clusterHtml.includes('Coordinate Group Proof'));
assert.ok(clusterHtml.includes('Confirm coordinate/grouping logic.'));
assertCurrentNext(clusterHtml,'Rules','Relationships');
assert.ok(clusterHtml.includes('C001'));

const familyHtml=renderTableCategorizedStagePreview({activeTab:'levels',activeSetupTab:'relationships',sources:[source],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assertActivePreview(familyHtml,'Final Group');
assert.ok(familyHtml.includes('Final Group Proof'));
assert.ok(familyHtml.includes('Confirm final group.'));
assertCurrentNext(familyHtml,'Relationships','Structure');
assert.ok(familyHtml.includes('Final Group is ready.'));
assert.ok(familyHtml.includes('Next step: Build Graph.'));
assert.ok(familyHtml.includes('data-table-categorized-action="build-graph"'));
assert.ok(familyHtml.includes('PS-XYZ__C001'));

const noGraphHtml=renderTableCategorizedStagePreview({activeTab:'graph',activeSetupTab:'structure',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assertActivePreview(noGraphHtml,'Graph View');
assertCurrentNext(noGraphHtml,'Structure','Quality');
assert.ok(noGraphHtml.includes('Build/review graph.'));
assert.ok(noGraphHtml.includes('Graph not built yet.'));
assert.ok(noGraphHtml.includes('Your table rows are grouped, but graph nodes have not been created yet.'));
assert.ok(noGraphHtml.includes('Document Root'));
assert.ok(noGraphHtml.includes('Details / Values'));
assert.ok(noGraphHtml.includes('data-table-categorized-action="build-graph"'));

const noXmlHtml=renderTableCategorizedStagePreview({activeTab:'export',activeSetupTab:'output',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assertActivePreview(noXmlHtml,'XML View');
assertCurrentNext(noXmlHtml,'Output','Output');
assert.ok(noXmlHtml.includes('Download categorized XML.'));
assert.ok(noXmlHtml.includes('Export not ready.'));
assert.ok(noXmlHtml.includes('Build the preview graph first.'));
assert.ok(noXmlHtml.includes('data-table-categorized-action="build-graph"'));

const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const validationResults=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph});
const exportResult=exportCategorizedGraphArtifacts({graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,validationResults,sources:[source]});
const graphHtml=renderTableCategorizedStagePreview({activeTab:'graph',activeSetupTab:'structure',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph});
assertActivePreview(graphHtml,'Graph View');
assertCurrentNext(graphHtml,'Structure','Quality');
assert.ok(graphHtml.includes('Graph built successfully.'));
assert.ok(graphHtml.includes('Check Quality'));
assert.ok(graphHtml.includes('Go to Output'));
assert.ok(graphHtml.includes('data-table-categorized-tab="validation"'));
assert.ok(graphHtml.includes('data-table-categorized-tab="export"'));
assert.ok(!graphHtml.includes('Graph not built yet.'));

const qualityHtml=renderTableCategorizedStagePreview({activeTab:'validation',activeSetupTab:'quality',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,validationResults});
assertActivePreview(qualityHtml,'Graph View');
assertCurrentNext(qualityHtml,'Quality','Output');
assert.ok(qualityHtml.includes('Review blockers/warnings.'));
assert.ok(qualityHtml.includes('Graph built successfully.'));

const xmlHtml=renderTableCategorizedStagePreview({activeTab:'export',activeSetupTab:'output',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,exportResult});
assertActivePreview(xmlHtml,'XML View');
assertCurrentNext(xmlHtml,'Output','Output');
assert.ok(xmlHtml.includes('Categorized XML ready.'));
assert.ok(xmlHtml.includes('This XML is enriched from the table into a categorized graph structure.'));
assert.ok(xmlHtml.includes('&lt;CategorizedTableXml'));
const recipeHtml=renderTableCategorizedStagePreview({activeTab:'levels',activeSetupTab:'recipe',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assertActivePreview(recipeHtml,'Base Key');
assertCurrentNext(recipeHtml,'Recipe','Source');
const manualOverrideHtml=renderTableCategorizedStagePreview({activeTab:'export',activeSetupTab:'output',activePreviewStage:'graph',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,exportResult});
assertActivePreview(manualOverrideHtml,'Graph View');
assertCurrentNext(manualOverrideHtml,'Output','Output');

console.log('xml-compare-table-categorized-stage-preview: all assertions passed');
