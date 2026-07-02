import assert from 'node:assert/strict';

import { handleTableCategorizedNavigationClick, installTableCategorizedSetupTabNavigation, nextTableCategorizedNavigationState, tableCategorizedNavigationStateFromPopup } from '../xml-compare/table-categorizer/table-categorized-xml-controller.js';
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
const assertActiveSetupTab=(html,id)=>{
  const tag=setupTabButtonTag(html,id);
  assert.ok(tag, `setup tab button missing: ${id}`);
  assert.ok(tag.includes('class="is-active"'), `setup tab is not active: ${id}`);
  assert.ok(tag.includes('aria-selected="true"'), `active setup tab is not selected: ${id}`);
  assert.ok(html.includes(`data-setup-body="${id}"`), `setup body missing: ${id}`);
};
const assertShellBasics=(html)=>includesAll(html,['Live Preview','<details','table-categorized-setup-tabs','data-setup-body','data-panel-group','data-table-categorized-status']);
const fakeTarget=(selector,dataset)=>({closest:(query)=>query===selector?{dataset}:null});
const fakePopup=(workflowTab,setupTab)=>({querySelector(selector){if(selector==='[data-table-categorized-tab].is-active')return {dataset:{tableCategorizedTab:workflowTab}};if(selector==='[data-table-categorized-setup-tab].is-active')return {dataset:{tableCategorizedSetupTab:setupTab}};return null;}});

const button=renderTableCategorizedXmlButtonHtml();
assert.ok(button.includes('Table to Categorized XML'));
assert.ok(button.includes(TABLE_CATEGORIZED_XML_BUTTON_ATTR));

const shell=renderTableCategorizedXmlShellHtml();
assertShellBasics(shell);
includesAll(shell,['Table to Categorized XML','Build a categorized graph from any table','1 Import Table','2 Map Fields & Rules','3 Build Structure','4 Check','5 Export','Base Key','Final Group','data-panel-group="source"','data-setup-body="source"']);
assertActivePreview(shell,'Rows');
assert.ok(shell.includes('Showing raw rows for the selected source.'));
assertSetupTabStatus(shell,'source','pending');
assertSetupTabStatus(shell,'output','locked');
assertSetupTabStatus(shell,'quality','pending');
for(const [id,label] of TABLE_CATEGORIZED_SETUP_TABS){assert.ok(shell.includes(label.replace(/^\S+\s+/u,'')), `setup tab label missing: ${label}`);assert.ok(shell.includes(`data-table-categorized-setup-tab="${id}"`), `setup tab marker missing: ${id}`);}

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

assert.deepEqual(nextTableCategorizedNavigationState({activeTab:'levels',activeSetupTab:'fields'},{type:'setup-tab',setupTab:'relationships'}),{activeTab:'levels',activeSetupTab:'relationships',activePreviewStage:'family'});
assert.deepEqual(nextTableCategorizedNavigationState({activeTab:'levels',activeSetupTab:'relationships'},{type:'workflow-tab',activeTab:'graph'}),{activeTab:'graph',activeSetupTab:'structure',activePreviewStage:'graph'});
assert.deepEqual(tableCategorizedNavigationStateFromPopup(fakePopup('levels','relationships'),{}),{activeTab:'levels',activeSetupTab:'relationships',activePreviewStage:'family'});
let rendered='';
const setupClick=handleTableCategorizedNavigationClick({target:fakeTarget('[data-table-categorized-setup-tab]',{tableCategorizedSetupTab:'relationships'}),preventDefault(){}},{activeTab:'levels',activeSetupTab:'fields'},(next)=>{rendered=renderTableCategorizedXmlShellHtml(next);});
assert.ok(setupClick.handled);
assert.equal(setupClick.state.activeTab,'levels');
assert.equal(setupClick.state.activeSetupTab,'relationships');
assert.equal(setupClick.state.activePreviewStage,'family');
assertActiveSetupTab(rendered,'relationships');
assertActivePreview(rendered,'Final Group');
includesAll(rendered,['data-setup-body="relationships"','Join Another Table','Live Preview']);
const outputClick=handleTableCategorizedNavigationClick({target:fakeTarget('[data-table-categorized-setup-tab]',{tableCategorizedSetupTab:'output'}),preventDefault(){}},setupClick.state,(next)=>{rendered=renderTableCategorizedXmlShellHtml(next);});
assert.equal(outputClick.state.activeSetupTab,'output');
assert.equal(outputClick.state.activePreviewStage,'xml');
assertActiveSetupTab(rendered,'output');
assertActivePreview(rendered,'XML View');
includesAll(rendered,['data-setup-body="output"','XML Shape','Live Preview']);
const workflowClick=handleTableCategorizedNavigationClick({target:fakeTarget('[data-table-categorized-tab]',{tableCategorizedTab:'graph'}),preventDefault(){}},outputClick.state,(next)=>{rendered=renderTableCategorizedXmlShellHtml(next);});
assert.equal(workflowClick.state.activeTab,'graph');
assert.equal(workflowClick.state.activeSetupTab,'structure');
assert.equal(workflowClick.state.activePreviewStage,'graph');
assertActiveSetupTab(rendered,'structure');
assertActivePreview(rendered,'Graph View');

let registeredClick=null;
let removedClick=null;
let outerHtml='';
const livePopup={querySelector:fakePopup('levels','fields').querySelector,set outerHTML(value){outerHtml=value;},get outerHTML(){return outerHtml;}};
const liveRoot={addEventListener(type,handler){if(type==='click')registeredClick=handler;},removeEventListener(type,handler){if(type==='click')removedClick=handler;}};
const installHandle=installTableCategorizedSetupTabNavigation(liveRoot,{activeTab:'levels',activeSetupTab:'fields'});
assert.ok(registeredClick);
registeredClick({target:{closest(selector){if(selector==='[data-xml-compare-table-categorized-popup]')return livePopup;if(selector==='[data-table-categorized-setup-tab]')return {dataset:{tableCategorizedSetupTab:'relationships'}};return null;}},preventDefault(){}});
assert.equal(installHandle.getState().activeSetupTab,'relationships');
assert.equal(installHandle.getState().activePreviewStage,'family');
assert.ok(outerHtml.includes('data-setup-body="relationships"'));
assert.ok(outerHtml.includes('Final Group'));
installHandle.destroy();
assert.ok(removedClick);

const s1=parseTableSource(PS_MAPPING_TABLE_2_MODEL_SAMPLE,{sourceId:'S1',sourceName:'Table 2 Model Data'});
const s2=parseTableSource(PS_MAPPING_COORDINATE_LOOKUP_SAMPLE,{sourceId:'S2',sourceName:'Coordinate Lookup'});
const sourceShell=renderTableCategorizedXmlShellHtml({activeTab:'source',activeSetupTab:'source',sources:[s1,s2],activeSourceId:'S2'});
assertActiveSetupTab(sourceShell,'source');
assertShellBasics(sourceShell);
assertActivePreview(sourceShell,'Rows');
assertSetupTabStatus(sourceShell,'source','ready');
assertPanelStatus(sourceShell,'Source Tables','ready');
assertPanelStatus(sourceShell,'Parsed Rows','ready');
includesAll(sourceShell,['Source Tables','Parsed Tables','Parsed Rows','Source Messages','Import Settings','File Type / Paste Mode','Delimiter','Header Row','Skip Rows','Encoding','Trim Blank Rows','Duplicate Header Handling','Column Cleanup','Column Rename','Include / Exclude Columns','Source Table ID','Source Table Role','Add Table','Remove Table','Read Active Table','Load Coordinate Lookup Sample','Raw Table Preview','Imported Rows','data-panel-group="source"']);
excludesAll(sourceShell,['Join Another Table','XML Shape']);

const fieldsShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'fields',sources:[s1,s2],activeSourceId:'S1'});
assertActiveSetupTab(fieldsShell,'fields');
assertShellBasics(fieldsShell);
assertActivePreview(fieldsShell,'Base Key');
assertSetupTabStatus(fieldsShell,'fields','review');
assertPanelStatus(fieldsShell,'Column Mapping','review');
includesAll(fieldsShell,['Column Mapping','Data Types / Units','Detected Type','Selected Type','Text / Number / Date / Boolean / Coordinate','Unit','Required / Optional','Defaults / Blank Handling','Blank Policy','Invalid Value Policy','Default Value','Alias Names','Calculated Fields','Calculated Column Formula','Formula','data-panel-group="fields"']);

const relationshipsShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'relationships',sources:[s1,s2],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE});
assertActiveSetupTab(relationshipsShell,'relationships');
assertShellBasics(relationshipsShell);
assertActivePreview(relationshipsShell,'Final Group');
includesAll(relationshipsShell,['Primary / Composite Keys','Primary Key','Composite Key Parts','Parent / Child Links','Parent Key','Child Key','Foreign Key','Cardinality','one-to-one','one-to-many','many-to-one','many-to-many','Join Another Table','Join Type','left','inner','full','Match Method','exact','case-insensitive','trimmed','regex key','coordinate proximity','Duplicate / Missing Match Rules','Duplicate Key Policy','Missing Parent Policy','Orphan Row Policy','join_table2_coordinates','data-panel-group="relationships"']);

const structureShell=renderTableCategorizedXmlShellHtml({activeTab:'graph',activeSetupTab:'structure',sources:[s1,s2],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE});
assertActiveSetupTab(structureShell,'structure');
assertShellBasics(structureShell);
assertActivePreview(structureShell,'Graph View');
includesAll(structureShell,['Graph Levels / Tree Editor','Selected Level','Add Child Level','Add Sibling Level','Duplicate Level','Move Up','Move Down','Delete Level','Level Name','XML Tag','Create From Column / Rule','Key Rule','Display Rule','Create Only When','Sort By','Model Split','Model Split Strategy','one model','per source','per column','per rule','Add / Move / Delete Levels','More Nested Levels','Sort Order','Sort Groups By Key','Sort Items By Source Row Order','Sort Details By Priority','Natural Sort','Numeric Sort','Custom Order List','RootPartition','data-panel-group="structure"']);
excludesAll(structureShell,['Column Mapping','Source Messages','XML Shape']);

const rulesShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'rules',sources:[s1,s2],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE});
assertActiveSetupTab(rulesShell,'rules');
assertShellBasics(rulesShell);
assertActivePreview(rulesShell,'Coordinate Group');
includesAll(rulesShell,['Rule Builder','Rule Chain Order','Test Selected Row','Preview Affected Rows','Regex Test Box','Split Text','Replace Text','Prefix / Suffix','Concat Parts','Filters / Conditions','Include Rows Where','Exclude Rows Where','Create Level Only When','Create Field Only When','Fallbacks','If Blank','If No Match','Fallback Value','Classifiers','Classifier Dictionary','Coordinate Grouping','Coordinate Tolerance','Coordinate Rounding','Coordinate Unit Conversion','Cluster Method','Rule Source Table','data-panel-group="rules"']);

const qualityShellEmpty=renderTableCategorizedXmlShellHtml({activeTab:'validation',activeSetupTab:'quality'});
assertActiveSetupTab(qualityShellEmpty,'quality');
assertShellBasics(qualityShellEmpty);
assertActivePreview(qualityShellEmpty,'Graph View');
assertSetupTabStatus(qualityShellEmpty,'quality','pending');
assertPanelStatus(qualityShellEmpty,'Required Checks','pending');
includesAll(qualityShellEmpty,['Required Checks','Required Columns','Required Levels','Unique Key Checks','Missing Parent Checks','Duplicate Key Checks','Invalid Number Checks','Invalid Coordinate Checks','Validation Settings','Rule Failure Severity','Blocker / Warning / Info','Blocker / Warning / Info Mapping','Export Blocking Rules','Warnings','Audit Trail','data-panel-group="quality"']);

const compareActions=['use-current-graph-source-canvas','import-target-graph-json','use-imported-graph-target-canvas','run-graph-compare-canvas','build-graph-connectors','download-graph-connectors-json','clear-compare-canvas-preview'];
const beforeExportShell=renderTableCategorizedXmlShellHtml({activeTab:'export',activeSetupTab:'output'});
assertActiveSetupTab(beforeExportShell,'output');
assertShellBasics(beforeExportShell);
assertActivePreview(beforeExportShell,'XML View');
assertSetupTabStatus(beforeExportShell,'output','locked');
assertPanelStatus(beforeExportShell,'Download Files','locked');
includesAll(beforeExportShell,['XML Names','XML Root Tag','Partition Tag','Level Tag Names','Field Tag Names','XML Shape','Attribute vs Element','Text Node vs Child Element','Element Order','Empty Value Policy','Namespace','Schema Version','Indentation','CDATA Option','One XML document root only','Logical splits are child partitions below the root','Download Files','Build Preview Graph first.','Canvas Link','Graph Compare Canvas Preview','Shadow preview','Source records','Target records','Mapped connectors','Mismatch connectors','Missing markers','Extra markers','Diagnostics','data-panel-group="output"']);
for(const action of compareActions)assert.ok(beforeExportShell.includes(`data-table-categorized-action="${action}"`),`missing compare action ${action}`);
assert.ok(!beforeExportShell.includes('data-table-categorized-action="send-source"'));
assert.ok(!beforeExportShell.includes('data-table-categorized-action="send-target"'));
assert.ok(!beforeExportShell.includes('PSNM'));
assert.ok(!beforeExportShell.includes('PS Mapping Graph Compare Canvas Preview'));
const manualPreviewShell=renderTableCategorizedXmlShellHtml({activeTab:'export',activeSetupTab:'output',activePreviewStage:'graph'});
assertActiveSetupTab(manualPreviewShell,'output');
assertActivePreview(manualPreviewShell,'Graph View');

const recipeShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'recipe',profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE});
assertActiveSetupTab(recipeShell,'recipe');
assertShellBasics(recipeShell);
assertActivePreview(recipeShell,'Base Key');
includesAll(recipeShell,['Recipe / Preset','Recipe Name','Recipe ID','Save / Load Recipe','Save Recipe','Load Recipe','Duplicate Recipe','Reset Recipe','Recipe Version / Notes','Version','Description','Author Notes','Import / Export Recipe JSON','Import Recipe JSON','Export Recipe JSON','Compare Recipe Changes','PS Mapping Table 2 + Coordinate Lookup Profile','data-panel-group="recipe"']);
const blankRecipeShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'recipe',profile:createBlankUniversalProfile(),sources:[s1]});
assert.ok(blankRecipeShell.includes('Blank Universal Profile'));

const recursiveProfile={
  profileId:'recursive-level-test-profile',
  displayName:'Recursive Level Test Profile',
  levelDefinitions:[{
    levelId:'documentRoot',displayName:'Document Root',levelType:'document',creationMode:'single',xmlTag:'CategorizedTableXml',children:[{
      levelId:'modelSplit',displayName:'Model Split',levelType:'partition',creationMode:'static',xmlTag:'RootPartition',children:[{
        levelId:'groupA',displayName:'Group A',levelType:'group',creationMode:'perKey',xmlTag:'GroupA',keyResolver:{op:'column',sourceId:'S1',column:'Primary key'},displayNameResolver:{op:'column',sourceId:'S1',column:'Display'},fieldResolvers:{measure:{op:'column',sourceId:'S1',column:'Value / measure'}},children:[
          {levelId:'child1',displayName:'Child One',levelType:'item',creationMode:'perRow',xmlTag:'ChildOne',children:[{levelId:'detail1',displayName:'Detail One',levelType:'detail',creationMode:'perValue',xmlTag:'DetailOne'},{levelId:'detail2',displayName:'Detail Two',levelType:'detail',creationMode:'perValue',xmlTag:'DetailTwo'}]},
          {levelId:'child2',displayName:'Child Two',levelType:'item',creationMode:'perRow',xmlTag:'ChildTwo'},
          {levelId:'child3',displayName:'Child Three',levelType:'item',creationMode:'perRow',xmlTag:'ChildThree',children:[{levelId:'grandchild1',displayName:'Grandchild One',levelType:'detailGroup',creationMode:'perKey',xmlTag:'GrandchildOne',children:[{levelId:'greatGrandchild1',displayName:'Great Grandchild One',levelType:'detail',creationMode:'perValue',xmlTag:'GreatGrandchildOne',keyResolver:{op:'column',sourceId:'S1',column:'GreatKey'},displayNameResolver:{op:'column',sourceId:'S1',column:'GreatName'},fieldResolvers:{note:{op:'column',sourceId:'S1',column:'Notes'}},createOnlyWhen:'GreatKey exists',sortBy:'GreatKey',sourceScope:['S1'],notes:'Deep nested shell test'}]}]}
        ]
      },{levelId:'groupB',displayName:'Group B',levelType:'group',creationMode:'perKey',xmlTag:'GroupB'}]
    }]
  }]
};
const rows=flattenLevelDefinitions(recursiveProfile.levelDefinitions);
assert.ok(rows.length>=10);
assert.equal(levelPathKey([0,0,0,2,0,0]),'0.0.0.2.0.0');
assert.equal(levelChildCount(recursiveProfile.levelDefinitions[0].children[0].children[0]),3);
assert.equal(rows.find((row)=>row.level.levelId==='greatGrandchild1')?.depth,5);
const recursiveShell=renderTableCategorizedXmlShellHtml({activeTab:'graph',activeSetupTab:'structure',profile:recursiveProfile,selectedLevelPath:'0.0.0.2.0.0'});
assertActiveSetupTab(recursiveShell,'structure');
assertActivePreview(recursiveShell,'Graph View');
assertShellBasics(recursiveShell);
includesAll(recursiveShell,['data-level-tree','data-level-node','data-level-id="documentRoot"','data-level-id="modelSplit"','data-level-id="groupA"','data-level-id="child1"','data-level-id="child2"','data-level-id="child3"','data-level-id="grandchild1"','data-level-id="greatGrandchild1"','data-level-path="0.0.0.2.0.0"','data-level-depth="5"','data-level-child-count="3"','Document Root','Model Split','Group A','Group B','Child One','Child Two','Child Three','Detail One','Detail Two','Grandchild One','Great Grandchild One']);
includesAll(recursiveShell,['Selected Level','Level ID','Display Name','Level Name','Level Type','Creation Mode','XML Tag','Create From Column / Rule','Key Rule','Display Rule','Field Resolvers','Create Only When','Sort By','Child Levels','Source Scope','Notes','greatGrandchild1','GreatGrandchildOne','S1.GreatKey','S1.GreatName','note: S1.Notes','Deep nested shell test']);
includesAll(recursiveShell,['Add Child Level','Add Sibling Level','Duplicate Level','Move Up','Move Down','Delete Level','data-level-action="add-child"','data-level-action="add-sibling"','data-level-action="duplicate"','data-level-action="move-up"','data-level-action="move-down"','data-level-action="delete"']);

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1',sourceName:'Table 2 - Model PS Data'});
const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const validationResults=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph});
const exportResult=exportCategorizedGraphArtifacts({graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,validationResults,sources:[source]});
const graphShell=renderTableCategorizedXmlShellHtml({activeTab:'graph',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,validationResults});
assertActiveSetupTab(graphShell,'structure');
assertActivePreview(graphShell,'Graph View');
assertSetupTabStatus(graphShell,'structure','ready');
assertPanelStatus(graphShell,'Preview Graph','ready');
includesAll(graphShell,['Preview Graph','PS-XYZ__C001','PS-XYZ.10','featureType=GUIDE','Go to Export / Link','Structure']);
const validationShell=renderTableCategorizedXmlShellHtml({activeTab:'validation',validationResults,exportResult});
assertActiveSetupTab(validationShell,'quality');
assertActivePreview(validationShell,'Graph View');
includesAll(validationShell,['graph_has_single_document_root','required_columns_present','Export allowed.','Warnings','Validation Settings','Audit Trail']);
const exportShell=renderTableCategorizedXmlShellHtml({activeTab:'export',graph,validationResults,exportResult});
assertActiveSetupTab(exportShell,'output');
assertActivePreview(exportShell,'XML View');
assertSetupTabStatus(exportShell,'output','ready');
assertPanelStatus(exportShell,'Download Files','ready');
assertPanelStatus(exportShell,'Canvas Link','ready');
includesAll(exportShell,['XML Preview','&lt;CategorizedTableXml','XML View','Download Categorized XML','Download Graph JSON','Download Recipe JSON','Send to SourceXML Canvas','Send to TargetXML Canvas','Graph Compare Canvas Preview','data-panel-group="output"']);
assert.ok(!exportShell.includes('PS Mapping Graph Compare Canvas Preview'));
assert.ok(!exportShell.includes('CategorizedInputXML'));
const blockedResults=[{gate:'required_columns_present',severity:'BLOCKER',status:'FAIL',message:'blocked',ref:''}];
const qualityBlockedShell=renderTableCategorizedXmlShellHtml({activeTab:'validation',activeSetupTab:'quality',graph,validationResults:blockedResults,exportResult:null});
assertSetupTabStatus(qualityBlockedShell,'quality','blocked');
assertPanelStatus(qualityBlockedShell,'Required Checks','blocked');
const blockedShell=renderTableCategorizedXmlShellHtml({activeTab:'export',graph,validationResults:blockedResults,exportResult:null});
assertActiveSetupTab(blockedShell,'output');
assertActivePreview(blockedShell,'XML View');
assertSetupTabStatus(blockedShell,'output','blocked');
assertPanelStatus(blockedShell,'Download Files','blocked');
assert.ok(blockedShell.includes('Export is blocked by validation.'));
assert.ok(blockedShell.includes('data-setup-body="output"'));
assert.ok(!blockedShell.includes('data-setup-body="quality"'));
assert.ok(!blockedShell.includes('data-panel-group="quality"'));
assert.ok(!blockedShell.includes('Download Graph JSON'));
const statusCorpus=[shell,sourceShell,fieldsShell,relationshipsShell,structureShell,rulesShell,qualityShellEmpty,beforeExportShell,recipeShell,graphShell,validationShell,exportShell,qualityBlockedShell,blockedShell,recursiveShell].join('');
for(const status of ['ready','review','pending','optional','locked','blocked'])assertStatusLabel(statusCorpus,status);
for(const html of [sourceShell,fieldsShell,relationshipsShell,structureShell,rulesShell,qualityShellEmpty,beforeExportShell,recipeShell,graphShell,exportShell,blockedShell,recursiveShell])assertShellBasics(html);
assert.ok(beforeExportShell.includes('One XML document root only'));
assert.ok(beforeExportShell.includes('Logical splits are child partitions below the root'));
assert.ok(exportShell.includes('One XML document root only'));
console.log('xml-compare-table-categorized-shell: all assertions passed');
