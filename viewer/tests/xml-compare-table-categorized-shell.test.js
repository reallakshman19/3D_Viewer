import assert from 'node:assert/strict';

import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { createBlankUniversalProfile } from '../xml-compare/table-categorizer/table-categorized-xml-profile-designer.js';
import { PS_MAPPING_COORDINATE_LOOKUP_SAMPLE, PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE, PS_MAPPING_TABLE_2_MODEL_SAMPLE, PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { TABLE_CATEGORIZED_SETUP_TABS, TABLE_CATEGORIZED_XML_BUTTON_ATTR, renderSetupTabStrip, renderTableCategorizedXmlButtonHtml, renderTableCategorizedXmlShellHtml, setupTabForWorkflowTab } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

const includesAll=(html,labels)=>labels.forEach((label)=>assert.ok(html.includes(label), `missing ${label}`));
const excludesAll=(html,labels)=>labels.forEach((label)=>assert.ok(!html.includes(label), `unexpected ${label}`));
const setupTabButtonTag=(html,id)=>html.match(new RegExp(`<button[^>]*data-table-categorized-setup-tab="${id}"[^>]*>`))?.[0]||'';
const assertActiveSetupTab=(html,id)=>{
  const tag=setupTabButtonTag(html,id);
  assert.ok(tag, `setup tab button missing: ${id}`);
  assert.ok(tag.includes('class="is-active"'), `setup tab is not active: ${id}`);
  assert.ok(tag.includes('aria-selected="true"'), `active setup tab is not selected: ${id}`);
  assert.ok(html.includes(`data-setup-body="${id}"`), `setup body missing: ${id}`);
};
const assertShellBasics=(html)=>{
  assert.ok(html.includes('Live Preview'));
  assert.ok(html.includes('<details'));
  assert.ok(html.includes('table-categorized-setup-tabs'));
};

const button=renderTableCategorizedXmlButtonHtml();
assert.ok(button.includes('Table to Categorized XML'));
assert.ok(button.includes(TABLE_CATEGORIZED_XML_BUTTON_ATTR));

const shell=renderTableCategorizedXmlShellHtml();
includesAll(shell,['Table to Categorized XML','Build a categorized graph from any table','1 Import Table','2 Map Fields & Rules','3 Build Structure','4 Check','5 Export','Live Preview','Base Key','Final Group','data-panel-group="source"','data-setup-body="source"']);
assert.ok(shell.includes('<details'));

for(const [id,label] of TABLE_CATEGORIZED_SETUP_TABS){
  assert.ok(shell.includes(label.replace(/^\S+\s+/u,'')), `setup tab label missing: ${label}`);
  assert.ok(shell.includes(`data-table-categorized-setup-tab="${id}"`), `setup tab marker missing: ${id}`);
}

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
assert.ok(renderSetupTabStrip('fields').includes('data-table-categorized-setup-tab="fields"'));
assert.ok(renderSetupTabStrip('fields').includes('aria-selected="true"'));

const s1=parseTableSource(PS_MAPPING_TABLE_2_MODEL_SAMPLE,{sourceId:'S1',sourceName:'Table 2 Model Data'});
const s2=parseTableSource(PS_MAPPING_COORDINATE_LOOKUP_SAMPLE,{sourceId:'S2',sourceName:'Coordinate Lookup'});

const sourceShell=renderTableCategorizedXmlShellHtml({activeTab:'source',activeSetupTab:'source',sources:[s1,s2],activeSourceId:'S2'});
assertActiveSetupTab(sourceShell,'source');
assertShellBasics(sourceShell);
includesAll(sourceShell,['Source Tables','Parsed Tables','Parsed Rows','Source Messages','Import Settings','File Type / Paste Mode','Delimiter','Header Row','Skip Rows','Encoding','Trim Blank Rows','Duplicate Header Handling','Column Cleanup','Column Rename','Include / Exclude Columns','Source Table ID','Source Table Role','Add Table','Remove Table','Read Active Table','Load Coordinate Lookup Sample','Raw Table Preview','Imported Rows','data-panel-group="source"']);
excludesAll(sourceShell,['Join Another Table','XML Shape']);

const fieldsShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'fields',sources:[s1,s2],activeSourceId:'S1'});
assertActiveSetupTab(fieldsShell,'fields');
assertShellBasics(fieldsShell);
includesAll(fieldsShell,['Column Mapping','Data Types / Units','Detected Type','Selected Type','Text / Number / Date / Boolean / Coordinate','Unit','Required / Optional','Defaults / Blank Handling','Blank Policy','Invalid Value Policy','Default Value','Alias Names','Calculated Fields','Calculated Column Formula','Formula','data-panel-group="fields"']);
excludesAll(fieldsShell,['Source Messages','Join Another Table','XML Shape']);

const relationshipsShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'relationships',sources:[s1,s2],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE});
assertActiveSetupTab(relationshipsShell,'relationships');
assertShellBasics(relationshipsShell);
includesAll(relationshipsShell,['Primary / Composite Keys','Primary Key','Composite Key Parts','Parent / Child Links','Parent Key','Child Key','Foreign Key','Cardinality','one-to-one','one-to-many','many-to-one','many-to-many','Join Another Table','Join Type','left','inner','full','Match Method','exact','case-insensitive','trimmed','regex key','coordinate proximity','Duplicate / Missing Match Rules','Duplicate Key Policy','Missing Parent Policy','Orphan Row Policy','join_table2_coordinates','data-panel-group="relationships"']);
excludesAll(relationshipsShell,['Source Messages','Data Types / Units','XML Shape']);

const structureShell=renderTableCategorizedXmlShellHtml({activeTab:'graph',activeSetupTab:'structure',sources:[s1,s2],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE});
assertActiveSetupTab(structureShell,'structure');
assertShellBasics(structureShell);
includesAll(structureShell,['Graph Levels / Tree Editor','Selected Level','Add Child Level','Add Sibling Level','Duplicate Level','Move Up','Move Down','Delete Level','Level Name','XML Tag','Create From Column / Rule','Key Rule','Display Rule','Create Only When','Sort By','Model Split','Model Split Strategy','one model','per source','per column','per rule','Add / Move / Delete Levels','More Nested Levels','Sort Order','Sort Groups By Key','Sort Items By Source Row Order','Sort Details By Priority','Natural Sort','Numeric Sort','Custom Order List','RootPartition','data-panel-group="structure"']);
excludesAll(structureShell,['Column Mapping','Source Messages','XML Shape']);

const rulesShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'rules',sources:[s1,s2],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE});
assertActiveSetupTab(rulesShell,'rules');
assertShellBasics(rulesShell);
includesAll(rulesShell,['Rule Builder','Rule Chain Order','Test Selected Row','Preview Affected Rows','Regex Test Box','Split Text','Replace Text','Prefix / Suffix','Concat Parts','Filters / Conditions','Include Rows Where','Exclude Rows Where','Create Level Only When','Create Field Only When','Fallbacks','If Blank','If No Match','Fallback Value','Classifiers','Classifier Dictionary','Coordinate Grouping','Coordinate Tolerance','Coordinate Rounding','Coordinate Unit Conversion','Cluster Method','Rule Source Table','data-panel-group="rules"']);
excludesAll(rulesShell,['Source Messages','XML Shape']);

const qualityShellEmpty=renderTableCategorizedXmlShellHtml({activeTab:'validation',activeSetupTab:'quality'});
assertActiveSetupTab(qualityShellEmpty,'quality');
assertShellBasics(qualityShellEmpty);
includesAll(qualityShellEmpty,['Required Checks','Required Columns','Required Levels','Unique Key Checks','Missing Parent Checks','Duplicate Key Checks','Invalid Number Checks','Invalid Coordinate Checks','Validation Settings','Rule Failure Severity','Blocker / Warning / Info','Blocker / Warning / Info Mapping','Export Blocking Rules','Warnings','Audit Trail','data-panel-group="quality"']);
excludesAll(qualityShellEmpty,['Source Messages','XML Shape']);

const beforeExportShell=renderTableCategorizedXmlShellHtml({activeTab:'export',activeSetupTab:'output'});
assertActiveSetupTab(beforeExportShell,'output');
assertShellBasics(beforeExportShell);
includesAll(beforeExportShell,['XML Names','XML Root Tag','Partition Tag','Level Tag Names','Field Tag Names','XML Shape','Attribute vs Element','Text Node vs Child Element','Element Order','Empty Value Policy','Namespace','Schema Version','Indentation','CDATA Option','One XML document root only','Logical splits are child partitions below the root','Download Files','Build Preview Graph first.','Canvas Link','data-panel-group="output"']);
assert.ok(!beforeExportShell.includes('data-table-categorized-action="send-source"'));
assert.ok(!beforeExportShell.includes('data-table-categorized-action="send-target"'));

const recipeShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'recipe',profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE});
assertActiveSetupTab(recipeShell,'recipe');
assertShellBasics(recipeShell);
includesAll(recipeShell,['Recipe / Preset','Recipe Name','Recipe ID','Save / Load Recipe','Save Recipe','Load Recipe','Duplicate Recipe','Reset Recipe','Recipe Version / Notes','Version','Description','Author Notes','Import / Export Recipe JSON','Import Recipe JSON','Export Recipe JSON','Compare Recipe Changes','PS Mapping Table 2 + Coordinate Lookup Profile','data-panel-group="recipe"']);
excludesAll(recipeShell,['Source Messages','XML Shape']);

const blankRecipeShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'recipe',profile:createBlankUniversalProfile(),sources:[s1]});
assert.ok(blankRecipeShell.includes('Blank Universal Profile'));

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1',sourceName:'Table 2 - Model PS Data'});
const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const validationResults=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph});
const exportResult=exportCategorizedGraphArtifacts({graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,validationResults,sources:[source]});
const graphShell=renderTableCategorizedXmlShellHtml({activeTab:'graph',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,validationResults});
assertActiveSetupTab(graphShell,'structure');
includesAll(graphShell,['Preview Graph','PS-XYZ__C001','PS-XYZ.10','featureType=GUIDE','Go to Export / Link','Structure']);
const validationShell=renderTableCategorizedXmlShellHtml({activeTab:'validation',validationResults,exportResult});
assertActiveSetupTab(validationShell,'quality');
includesAll(validationShell,['graph_has_single_document_root','required_columns_present','Export allowed.','Warnings','Validation Settings','Audit Trail']);
const exportShell=renderTableCategorizedXmlShellHtml({activeTab:'export',graph,validationResults,exportResult});
assertActiveSetupTab(exportShell,'output');
includesAll(exportShell,['XML Preview','&lt;CategorizedTableXml','XML View','Download Categorized XML','Download Graph JSON','Download Recipe JSON','Send to SourceXML Canvas','Send to TargetXML Canvas','data-panel-group="output"']);
assert.ok(!exportShell.includes('CategorizedInputXML'));
const blockedResults=[{gate:'required_columns_present',severity:'BLOCKER',status:'FAIL',message:'blocked',ref:''}];
const blockedShell=renderTableCategorizedXmlShellHtml({activeTab:'export',graph,validationResults:blockedResults,exportResult:null});
assert.ok(blockedShell.includes('Export is blocked by validation.'));
assert.ok(!blockedShell.includes('Download Graph JSON'));
console.log('xml-compare-table-categorized-shell: all assertions passed');
