import assert from 'node:assert/strict';

import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { createBlankUniversalProfile } from '../xml-compare/table-categorizer/table-categorized-xml-profile-designer.js';
import { PS_MAPPING_COORDINATE_LOOKUP_SAMPLE, PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE, PS_MAPPING_TABLE_2_MODEL_SAMPLE, PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { TABLE_CATEGORIZED_SETUP_TABS, TABLE_CATEGORIZED_XML_BUTTON_ATTR, renderSetupTabStrip, renderTableCategorizedXmlButtonHtml, renderTableCategorizedXmlShellHtml, setupTabForWorkflowTab } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

const button=renderTableCategorizedXmlButtonHtml();
assert.ok(button.includes('Table to Categorized XML'));
assert.ok(button.includes(TABLE_CATEGORIZED_XML_BUTTON_ATTR));

const shell=renderTableCategorizedXmlShellHtml();
assert.ok(shell.includes('Table to Categorized XML'));
assert.ok(shell.includes('Build a categorized graph from any table'));
assert.ok(shell.includes('1 Import Table'));
assert.ok(shell.includes('2 Map Fields & Rules'));
assert.ok(shell.includes('3 Build Structure'));
assert.ok(shell.includes('4 Check'));
assert.ok(shell.includes('5 Export'));
assert.ok(shell.includes('table-categorized-setup-tabs'));
assert.ok(shell.includes('Live Preview'));
assert.ok(shell.includes('Base Key'));
assert.ok(shell.includes('Final Group'));
assert.ok(shell.includes('<details'));
assert.ok(shell.includes('data-panel-group="source"'));

for(const [id,label] of TABLE_CATEGORIZED_SETUP_TABS){
  assert.ok(shell.includes(label.replace(/^\S+\s+/u,'')), `setup tab label missing: ${label}`);
  assert.ok(shell.includes(`data-table-categorized-setup-tab="${id}"`), `setup tab marker missing: ${id}`);
}

const setupTabButtonTag=(html,id)=>html.match(new RegExp(`<button[^>]*data-table-categorized-setup-tab="${id}"[^>]*>`))?.[0]||'';
const assertActiveSetupTab=(html,id)=>{
  const tag=setupTabButtonTag(html,id);
  assert.ok(tag, `setup tab button missing: ${id}`);
  assert.ok(tag.includes('class="is-active"'), `setup tab is not active: ${id}`);
  assert.ok(tag.includes('aria-selected="true"'), `active setup tab is not selected: ${id}`);
};
assert.equal(setupTabForWorkflowTab('source'),'source');
assert.equal(setupTabForWorkflowTab('levels'),'fields');
assert.equal(setupTabForWorkflowTab('graph'),'structure');
assert.equal(setupTabForWorkflowTab('validation'),'quality');
assert.equal(setupTabForWorkflowTab('export'),'output');
assertActiveSetupTab(renderTableCategorizedXmlShellHtml({activeTab:'source'}),'source');
assertActiveSetupTab(renderTableCategorizedXmlShellHtml({activeTab:'levels'}),'fields');
assertActiveSetupTab(renderTableCategorizedXmlShellHtml({activeTab:'graph'}),'structure');
assertActiveSetupTab(renderTableCategorizedXmlShellHtml({activeTab:'validation'}),'quality');
assertActiveSetupTab(renderTableCategorizedXmlShellHtml({activeTab:'export'}),'output');
assertActiveSetupTab(renderTableCategorizedXmlShellHtml({activeTab:'source',activeSetupTab:'recipe'}),'recipe');
assertActiveSetupTab(renderSetupTabStrip('fields'),'fields');

const s1=parseTableSource(PS_MAPPING_TABLE_2_MODEL_SAMPLE,{sourceId:'S1',sourceName:'Table 2 Model Data'});
const s2=parseTableSource(PS_MAPPING_COORDINATE_LOOKUP_SAMPLE,{sourceId:'S2',sourceName:'Coordinate Lookup'});
const sourceShell=renderTableCategorizedXmlShellHtml({activeTab:'source',sources:[s1,s2],activeSourceId:'S2'});
assert.ok(sourceShell.includes('Source Tables'));
assert.ok(sourceShell.includes('Parsed Tables'));
assert.ok(sourceShell.includes('Parsed Rows'));
assert.ok(sourceShell.includes('Source Messages'));
assert.ok(sourceShell.includes('S1'));
assert.ok(sourceShell.includes('S2'));
assert.ok(sourceShell.includes('Add Table'));
assert.ok(sourceShell.includes('Remove Table'));
assert.ok(sourceShell.includes('Read Active Table'));
assert.ok(sourceShell.includes('Load Coordinate Lookup Sample'));
assert.ok(sourceShell.includes('Raw Table Preview'));
assert.ok(sourceShell.includes('Imported Rows'));

const beforeExportShell=renderTableCategorizedXmlShellHtml({activeTab:'export'});
assert.ok(beforeExportShell.includes('Build Preview Graph first.'));
assert.ok(beforeExportShell.includes('Canvas Link'));
assert.ok(!beforeExportShell.includes('data-table-categorized-action="send-source"'));

const levelShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',sources:[s1,s2],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE});
assert.ok(levelShell.includes('Mapping Studio'));
assert.ok(levelShell.includes('Universal Profile / Level Designer v1'));
assert.ok(levelShell.includes('Configuration Options'));
assert.ok(levelShell.includes('Recipe / Preset'));
assert.ok(levelShell.includes('Grouping Strategy'));
assert.ok(levelShell.includes('Column Mapping'));
assert.ok(levelShell.includes('Rule Builder'));
assert.ok(levelShell.includes('Model Split'));
assert.ok(levelShell.includes('RootPartition'));
assert.ok(levelShell.includes('Graph Structure'));
assert.ok(levelShell.includes('More Nested Levels'));
assert.ok(levelShell.includes('Join Another Table'));
assert.ok(levelShell.includes('join_table2_coordinates'));
assert.ok(levelShell.includes('Rule Source Table'));
assert.ok(levelShell.includes('Coordinate Grouping Setup'));
assert.ok(levelShell.includes('PS Mapping Table 2 + Coordinate Lookup Profile'));
assert.ok(levelShell.includes('Final Group'));
assert.ok(levelShell.includes('data-panel-group="mapping"'));
assert.ok(levelShell.includes('data-panel-group="structure"'));
assert.ok(levelShell.includes('data-panel-group="quality"'));
assert.ok(!levelShell.includes('parentTabs'));

const blankLevelShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',profile:createBlankUniversalProfile(),sources:[s1]});
assert.ok(blankLevelShell.includes('Blank Universal Profile'));
assert.ok(blankLevelShell.includes('First Group Name'));

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1',sourceName:'Table 2 - Model PS Data'});
const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const validationResults=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph});
const exportResult=exportCategorizedGraphArtifacts({graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,validationResults,sources:[source]});
const graphShell=renderTableCategorizedXmlShellHtml({activeTab:'graph',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,validationResults});
assert.ok(graphShell.includes('PS-XYZ__C001'));
assert.ok(graphShell.includes('PS-XYZ.10'));
assert.ok(graphShell.includes('featureType=GUIDE'));
assert.ok(graphShell.includes('Go to Export / Link'));
assert.ok(graphShell.includes('Structure'));
assert.ok(graphShell.includes('Preview Graph'));
const validationShell=renderTableCategorizedXmlShellHtml({activeTab:'validation',validationResults,exportResult});
assert.ok(validationShell.includes('graph_has_single_document_root'));
assert.ok(validationShell.includes('required_columns_present'));
assert.ok(validationShell.includes('Export allowed.'));
assert.ok(validationShell.includes('Warnings'));
assert.ok(validationShell.includes('Audit Trail'));
const exportShell=renderTableCategorizedXmlShellHtml({activeTab:'export',graph,validationResults,exportResult});
assert.ok(exportShell.includes('XML Preview'));
assert.ok(exportShell.includes('&lt;CategorizedTableXml'));
assert.ok(exportShell.includes('XML View'));
assert.ok(exportShell.includes('Download Categorized XML'));
assert.ok(exportShell.includes('Download Graph JSON'));
assert.ok(exportShell.includes('Download Recipe JSON'));
assert.ok(exportShell.includes('Send to SourceXML Canvas'));
assert.ok(exportShell.includes('Send to TargetXML Canvas'));
assert.ok(exportShell.includes('data-panel-group="output"'));
assert.ok(!exportShell.includes('CategorizedInputXML'));
const blockedResults=[{gate:'required_columns_present',severity:'BLOCKER',status:'FAIL',message:'blocked',ref:''}];
const blockedShell=renderTableCategorizedXmlShellHtml({activeTab:'export',graph,validationResults:blockedResults,exportResult:null});
assert.ok(blockedShell.includes('Export is blocked by validation.'));
assert.ok(!blockedShell.includes('Download Graph JSON'));
console.log('xml-compare-table-categorized-shell: all assertions passed');