import assert from 'node:assert/strict';

import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { createBlankUniversalProfile } from '../xml-compare/table-categorizer/table-categorized-xml-profile-designer.js';
import { PS_MAPPING_COORDINATE_LOOKUP_SAMPLE, PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE, PS_MAPPING_TABLE_2_MODEL_SAMPLE, PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { TABLE_CATEGORIZED_SETUP_TABS, TABLE_CATEGORIZED_XML_BUTTON_ATTR, flattenLevelDefinitions, levelChildCount, levelPathKey, renderSetupTabStrip, renderTableCategorizedXmlButtonHtml, renderTableCategorizedXmlShellHtml, setupTabForWorkflowTab } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

const includesAll=(html,labels)=>labels.forEach((label)=>assert.ok(html.includes(label), `missing ${label}`));
const excludesAll=(html,labels)=>labels.forEach((label)=>assert.ok(!html.includes(label), `unexpected ${label}`));
const setupTabButtonTag=(html,id)=>html.match(new RegExp(`<button[^>]*data-table-categorized-setup-tab="${id}"[^>]*>`))?.[0]||'';
const setupTabBlock=(html,id)=>{const start=html.indexOf(`data-table-categorized-setup-tab="${id}"`);const end=html.indexOf('</button>',start);return start>=0&&end>=0?html.slice(start,end):'';};
const panelBlock=(html,title)=>{const summary=html.indexOf(`<summary><b>${title}`);const start=html.lastIndexOf('<details',summary);const end=html.indexOf('</details>',summary);return summary>=0&&start>=0&&end>=0?html.slice(start,end):'';};
const activePreviewButton=(html,label)=>html.match(new RegExp(`<button[^>]*class="is-active"[^>]*>${label}</button>`))?.[0]||'';
const assertActivePreview=(html,label)=>assert.ok(activePreviewButton(html,label), `preview tab not active: ${label}`);
const assertSetupTabStatus=(html,id,status)=>assert.ok(setupTabBlock(html,id).includes(`data-table-categorized-status="${status}"`), `setup ${id} not ${status}`);
const assertPanelStatus=(html,title,status)=>assert.ok(panelBlock(html,title).includes(`data-panel-status="${status}"`), `panel ${title} not ${status}`);
const assertStatusLabel=(html,status)=>assert.ok(html.includes(`data-table-categorized-status="${status}"`), `status missing: ${status}`);
const assertActiveSetupTab=(html,id)=>{const tag=setupTabButtonTag(html,id);assert.ok(tag, `setup tab button missing: ${id}`);assert.ok(tag.includes('class="is-active"'), `setup tab is not active: ${id}`);assert.ok(tag.includes('aria-selected="true"'), `active setup tab is not selected: ${id}`);assert.ok(html.includes(`data-setup-body="${id}"`), `setup body missing: ${id}`);};
const assertShellBasics=(html)=>includesAll(html,['Live Preview','<details','table-categorized-setup-tabs','data-setup-body','data-panel-group','data-table-categorized-status']);

const button=renderTableCategorizedXmlButtonHtml();
assert.ok(button.includes('Table to Categorized XML'));
assert.ok(button.includes(TABLE_CATEGORIZED_XML_BUTTON_ATTR));

const shell=renderTableCategorizedXmlShellHtml();
assertShellBasics(shell);
includesAll(shell,['1 Import Table','2 Map Fields & Rules','3 Build Structure','4 Check','5 Export','Live Preview','Base Key','Final Group','data-panel-group="source"','data-setup-body="source"']);
assertActivePreview(shell,'Rows');
assertSetupTabStatus(shell,'source','pending');
assertSetupTabStatus(shell,'output','locked');
assertSetupTabStatus(shell,'quality','pending');
for(const [id,label] of TABLE_CATEGORIZED_SETUP_TABS){assert.ok(shell.includes(label.replace(/^\S+\s+/u,'')), `setup tab label missing: ${label}`);assert.ok(shell.includes(`data-table-categorized-setup-tab="${id}"`), `setup tab marker missing: ${id}`);}
for(const status of ['ready','review','pending','optional','locked'])assertStatusLabel(shell+renderTableCategorizedXmlShellHtml({activeTab:'export',activeSetupTab:'output',validationResults:[{severity:'BLOCKER'}]}),status);
assert.equal(setupTabForWorkflowTab('source'),'source');
assert.equal(setupTabForWorkflowTab('levels'),'fields');
assert.equal(setupTabForWorkflowTab('graph'),'structure');
assert.equal(setupTabForWorkflowTab('validation'),'quality');
assert.equal(setupTabForWorkflowTab('export'),'output');
assert.ok(renderSetupTabStrip('fields').includes('aria-selected="true"'));
assertActiveSetupTab(renderTableCategorizedXmlShellHtml({activeTab:'source'}),'source');
assertActiveSetupTab(renderTableCategorizedXmlShellHtml({activeTab:'levels'}),'fields');
assertActiveSetupTab(renderTableCategorizedXmlShellHtml({activeTab:'graph'}),'structure');
assertActiveSetupTab(renderTableCategorizedXmlShellHtml({activeTab:'validation'}),'quality');
assertActiveSetupTab(renderTableCategorizedXmlShellHtml({activeTab:'export'}),'output');

const s1=parseTableSource(PS_MAPPING_TABLE_2_MODEL_SAMPLE,{sourceId:'S1',sourceName:'Table 2 Model Data'});
const s2=parseTableSource(PS_MAPPING_COORDINATE_LOOKUP_SAMPLE,{sourceId:'S2',sourceName:'Coordinate Lookup'});
const sourceShell=renderTableCategorizedXmlShellHtml({activeTab:'source',activeSetupTab:'source',sources:[s1,s2],activeSourceId:'S2'});
assertActiveSetupTab(sourceShell,'source');assertShellBasics(sourceShell);assertActivePreview(sourceShell,'Rows');assertPanelStatus(sourceShell,'Source Tables','ready');assertPanelStatus(sourceShell,'Parsed Rows','ready');includesAll(sourceShell,['Source Tables','Parsed Tables','Parsed Rows','Source Messages','Import Settings','Raw Table Preview','data-panel-group="source"']);
const fieldsShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'fields',sources:[s1,s2],activeSourceId:'S1'});
assertActiveSetupTab(fieldsShell,'fields');assertShellBasics(fieldsShell);assertActivePreview(fieldsShell,'Base Key');assertPanelStatus(fieldsShell,'Column Mapping','review');includesAll(fieldsShell,['Column Mapping','Data Types / Units','Defaults / Blank Handling','Calculated Fields','data-panel-group="fields"']);
const relationshipsShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'relationships',sources:[s1,s2],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE});
assertActiveSetupTab(relationshipsShell,'relationships');assertShellBasics(relationshipsShell);assertActivePreview(relationshipsShell,'Final Group');includesAll(relationshipsShell,['Primary / Composite Keys','Parent / Child Links','Join Another Table','Duplicate / Missing Match Rules','join_table2_coordinates','data-panel-group="relationships"']);
const rulesShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'rules',sources:[s1,s2],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE});
assertActiveSetupTab(rulesShell,'rules');assertShellBasics(rulesShell);assertActivePreview(rulesShell,'Coordinate Group');includesAll(rulesShell,['Rule Builder','Filters / Conditions','Fallbacks','Classifiers','Coordinate Grouping','data-panel-group="rules"']);
const qualityShell=renderTableCategorizedXmlShellHtml({activeTab:'validation',activeSetupTab:'quality'});
assertActiveSetupTab(qualityShell,'quality');assertShellBasics(qualityShell);assertActivePreview(qualityShell,'Graph View');assertPanelStatus(qualityShell,'Required Checks','pending');includesAll(qualityShell,['Required Checks','Validation Settings','Warnings','Audit Trail','data-panel-group="quality"']);

const compareActions=['use-current-graph-source-canvas','import-target-graph-json','use-imported-graph-target-canvas','run-graph-compare-canvas','build-graph-connectors','download-graph-connectors-json','clear-compare-canvas-preview'];
const beforeExportShell=renderTableCategorizedXmlShellHtml({activeTab:'export',activeSetupTab:'output'});
assertActiveSetupTab(beforeExportShell,'output');assertShellBasics(beforeExportShell);assertActivePreview(beforeExportShell,'XML View');assertPanelStatus(beforeExportShell,'Download Files','locked');
includesAll(beforeExportShell,['XML Names','XML Shape','One XML document root only','Logical splits are child partitions below the root','Download Files','Build Preview Graph first.','Canvas Link','Graph Compare Canvas Preview','Shadow preview','Source records','Target records','Mapped connectors','Mismatch connectors','Missing markers','Extra markers','Diagnostics','data-panel-group="output"']);
for(const action of compareActions)assert.ok(beforeExportShell.includes(`data-table-categorized-action="${action}"`),`missing compare action ${action}`);
assert.ok(!beforeExportShell.includes('data-table-categorized-action="send-source"'));
assert.ok(!beforeExportShell.includes('data-table-categorized-action="send-target"'));
assert.ok(!beforeExportShell.includes('PS Mapping Graph Compare Canvas Preview'));
assert.ok(!beforeExportShell.includes('PSNM'));

const recipeShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'recipe',profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE,profileMessages:[{severity:'ERROR',code:'imported-invalid',message:'Invalid recipe JSON'}]});
assertActiveSetupTab(recipeShell,'recipe');assertShellBasics(recipeShell);assertActivePreview(recipeShell,'Base Key');assertPanelStatus(recipeShell,'Profile Messages','blocked');
includesAll(recipeShell,['Recipe / Preset','Mapping recipe controls','Recipe summary','Active recipe name','Recipe ID','Recipe version','Source / preset type','Graph levels','Flattened level count','Joins','Root partitions','Coordinate grouping','Profile Messages','imported-invalid','Invalid recipe JSON','Recipe JSON Preview','&quot;profileId&quot;: &quot;ps-mapping-table-2-coordinate-lookup-profile&quot;','New Blank Recipe','Load PS Table 2 Recipe','Load Two-Table Coordinate Recipe','Import Recipe JSON','Download Recipe JSON','Reset','data-panel-group="recipe"']);
const blankRecipeShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'recipe',profile:createBlankUniversalProfile(),sources:[s1]});
assert.ok(blankRecipeShell.includes('Blank Universal Profile'));

const recursiveProfile={profileId:'recursive-level-test-profile',displayName:'Recursive Level Test Profile',levelDefinitions:[{levelId:'documentRoot',displayName:'Document Root',levelType:'document',creationMode:'single',xmlTag:'CategorizedTableXml',children:[{levelId:'modelSplit',displayName:'Model Split',levelType:'partition',creationMode:'static',xmlTag:'RootPartition',children:[{levelId:'groupA',displayName:'Group A',levelType:'group',creationMode:'perKey',xmlTag:'GroupA',children:[{levelId:'child1',displayName:'Child One',levelType:'item',creationMode:'perRow',xmlTag:'ChildOne',children:[{levelId:'detail1',displayName:'Detail One',levelType:'detail',creationMode:'perValue',xmlTag:'DetailOne'},{levelId:'detail2',displayName:'Detail Two',levelType:'detail',creationMode:'perValue',xmlTag:'DetailTwo'}]},{levelId:'child2',displayName:'Child Two',levelType:'item',creationMode:'perRow',xmlTag:'ChildTwo'},{levelId:'child3',displayName:'Child Three',levelType:'item',creationMode:'perRow',xmlTag:'ChildThree',children:[{levelId:'grandchild1',displayName:'Grandchild One',levelType:'detailGroup',creationMode:'perKey',xmlTag:'GrandchildOne',children:[{levelId:'greatGrandchild1',displayName:'Great Grandchild One',levelType:'detail',creationMode:'perValue',xmlTag:'GreatGrandchildOne',keyResolver:{op:'column',sourceId:'S1',column:'GreatKey'},displayNameResolver:{op:'column',sourceId:'S1',column:'GreatName'},fieldResolvers:{note:{op:'column',sourceId:'S1',column:'Notes'}},createOnlyWhen:'GreatKey exists',sortBy:'GreatKey',sourceScope:['S1'],notes:'Deep nested shell test'}]}]}]},{levelId:'groupB',displayName:'Group B',levelType:'group',creationMode:'perKey',xmlTag:'GroupB'}]}]}]};
const rows=flattenLevelDefinitions(recursiveProfile.levelDefinitions);
assert.ok(rows.length>=10);assert.equal(levelPathKey([0,0,0,2,0,0]),'0.0.0.2.0.0');assert.equal(levelChildCount(recursiveProfile.levelDefinitions[0].children[0].children[0]),3);
const recursiveShell=renderTableCategorizedXmlShellHtml({activeTab:'graph',activeSetupTab:'structure',profile:recursiveProfile,selectedLevelPath:'0.0.0.2.0.0'});
assertActiveSetupTab(recursiveShell,'structure');assertActivePreview(recursiveShell,'Graph View');assertShellBasics(recursiveShell);
includesAll(recursiveShell,['data-level-tree','data-level-node','data-level-id="greatGrandchild1"','data-level-path="0.0.0.2.0.0"','data-level-depth="5"','data-level-child-count="3"','Document Root','Model Split','Group A','Child One','Child Two','Child Three','Grandchild One','Great Grandchild One','Selected Level','Level ID','Display Name','Level Name','Level Type','Creation Mode','XML Tag','Create From Column / Rule','Key Rule','Display Rule','Field Resolvers','Create Only When','Sort By','Child Levels','Source Scope','Notes','S1.GreatKey','S1.GreatName','note: S1.Notes','Deep nested shell test','data-level-action="add-child"','data-level-action="add-sibling"','data-level-action="duplicate"','data-level-action="move-up"','data-level-action="move-down"','data-level-action="delete"']);

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1',sourceName:'Table 2 - Model PS Data'});
const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const validationResults=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph});
const exportResult=exportCategorizedGraphArtifacts({graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,validationResults,sources:[source]});
const graphShell=renderTableCategorizedXmlShellHtml({activeTab:'graph',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,validationResults});
assertActiveSetupTab(graphShell,'structure');assertActivePreview(graphShell,'Graph View');assertPanelStatus(graphShell,'Preview Graph','ready');includesAll(graphShell,['Preview Graph','PS-XYZ__C001','PS-XYZ.10','featureType=GUIDE','Go to Export / Link']);
const exportShell=renderTableCategorizedXmlShellHtml({activeTab:'export',graph,validationResults,exportResult});
assertActiveSetupTab(exportShell,'output');assertActivePreview(exportShell,'XML View');assertPanelStatus(exportShell,'Download Files','ready');assertPanelStatus(exportShell,'Canvas Link','ready');includesAll(exportShell,['XML Preview','&lt;CategorizedTableXml','Download Categorized XML','Download Graph JSON','Download Recipe JSON','Send to SourceXML Canvas','Send to TargetXML Canvas','Graph Compare Canvas Preview','One XML document root only']);
const blockedResults=[{gate:'required_columns_present',severity:'BLOCKER',status:'FAIL',message:'blocked',ref:''}];
const blockedShell=renderTableCategorizedXmlShellHtml({activeTab:'export',graph,validationResults:blockedResults,exportResult:null});
assertActiveSetupTab(blockedShell,'output');assertActivePreview(blockedShell,'XML View');assertSetupTabStatus(blockedShell,'output','blocked');assertPanelStatus(blockedShell,'Download Files','blocked');assert.ok(blockedShell.includes('Export is blocked by validation.'));assert.ok(!blockedShell.includes('data-setup-body="quality"'));assert.ok(!blockedShell.includes('data-panel-group="quality"'));
const statusCorpus=[shell,sourceShell,fieldsShell,relationshipsShell,rulesShell,qualityShell,beforeExportShell,recipeShell,graphShell,exportShell,blockedShell,recursiveShell].join('');
for(const status of ['ready','review','pending','optional','locked','blocked'])assertStatusLabel(statusCorpus,status);
for(const html of [sourceShell,fieldsShell,relationshipsShell,rulesShell,qualityShell,beforeExportShell,recipeShell,graphShell,exportShell,blockedShell,recursiveShell])assertShellBasics(html);
console.log('xml-compare-table-categorized-shell: all assertions passed');
