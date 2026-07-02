import assert from 'node:assert/strict';

import { handleTableCategorizedNavigationClick, installTableCategorizedSetupTabNavigation, nextTableCategorizedNavigationState, tableCategorizedNavigationStateFromPopup } from '../xml-compare/table-categorizer/table-categorized-xml-controller.js';
import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { PS_MAPPING_COORDINATE_LOOKUP_SAMPLE, PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE, PS_MAPPING_TABLE_2_MODEL_SAMPLE, PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { TABLE_CATEGORIZED_SETUP_TABS, TABLE_CATEGORIZED_XML_BUTTON_ATTR, flattenLevelDefinitions, levelChildCount, levelPathKey, renderSetupTabStrip, renderTableCategorizedXmlButtonHtml, renderTableCategorizedXmlShellHtml, setupTabForWorkflowTab } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

const includesAll=(html,labels)=>labels.forEach((label)=>assert.ok(html.includes(label), `missing ${label}`));
const excludesAll=(html,labels)=>labels.forEach((label)=>assert.ok(!html.includes(label), `unexpected ${label}`));
const tagFor=(html,marker)=>{const start=html.indexOf(marker);const open=html.lastIndexOf('<button',start);const end=html.indexOf('>',start);return start>=0&&open>=0&&end>=0?html.slice(open,end+1):'';};
const setupTag=(html,id)=>tagFor(html,`data-table-categorized-setup-tab="${id}"`);
const workflowTag=(html,id)=>tagFor(html,`data-table-categorized-tab="${id}"`);
const panelBlock=(html,title)=>{const summary=html.indexOf(`<summary><b>${title}`);const start=html.lastIndexOf('<details',summary);const end=html.indexOf('</details>',summary);return summary>=0&&start>=0&&end>=0?html.slice(start,end):'';};
const activePreviewButton=(html,label)=>html.match(new RegExp(`<button[^>]*class="is-active"[^>]*>${label}</button>`))?.[0]||'';
const assertActivePreview=(html,label)=>assert.ok(activePreviewButton(html,label), `preview tab not active: ${label}`);
const assertActiveSetupTab=(html,id)=>{const tag=setupTag(html,id);assert.ok(tag.includes('class="is-active"'), `setup tab is not active: ${id}`);assert.ok(tag.includes('aria-selected="true"'), `active setup tab is not selected: ${id}`);assert.ok(html.includes(`data-setup-body="${id}"`), `setup body missing: ${id}`);};
const assertSetupEnabled=(html,id,enabled)=>assert.ok(setupTag(html,id).includes(`data-setup-enabled="${enabled?'true':'false'}"`), `${id} enabled state mismatch`);
const assertSetupStatus=(html,id,status)=>assert.ok(setupTag(html,id).includes(`data-setup-status="${status}"`), `${id} status mismatch`);
const assertWorkflowStatus=(html,id,status)=>assert.ok(workflowTag(html,id).includes(`data-workflow-status="${status}"`), `${id} workflow status mismatch`);
const assertWorkflowClass=(html,id,status)=>assert.ok(workflowTag(html,id).includes(`is-status-${status}`), `${id} workflow class mismatch`);
const assertPanelStatus=(html,title,status)=>assert.ok(panelBlock(html,title).includes(`data-panel-status="${status}"`), `panel ${title} not ${status}`);
const assertShellBasics=(html)=>includesAll(html,['Live Preview','<details','table-categorized-setup-tabs','data-setup-body','data-panel-group','data-table-categorized-status','data-workflow-status','data-setup-status','data-setup-enabled']);
const fakeTarget=(selector,dataset,extra={})=>({closest:(query)=>query===selector?{dataset,...extra}:null});
const fakePopup=(workflowTab,setupTab)=>({querySelector(selector){if(selector==='[data-table-categorized-tab].is-active')return {dataset:{tableCategorizedTab:workflowTab}};if(selector==='[data-table-categorized-setup-tab].is-active')return {dataset:{tableCategorizedSetupTab:setupTab}};return null;}});

const button=renderTableCategorizedXmlButtonHtml();
assert.ok(button.includes('Table to Categorized XML'));
assert.ok(button.includes(TABLE_CATEGORIZED_XML_BUTTON_ATTR));
assert.equal(setupTabForWorkflowTab('source'),'source');
assert.equal(setupTabForWorkflowTab('levels'),'fields');
assert.equal(setupTabForWorkflowTab('graph'),'structure');
assert.equal(setupTabForWorkflowTab('validation'),'quality');
assert.equal(setupTabForWorkflowTab('export'),'output');
assert.ok(renderSetupTabStrip('fields',{activeTab:'levels'}).includes('aria-selected="true"'));

const shell=renderTableCategorizedXmlShellHtml();
assertShellBasics(shell);
includesAll(shell,['Fullscreen','1 Import Table','2 Map Fields & Rules','3 Build Structure','4 Check','5 Export','(a) 🟦 Source','(b) 🟪 Fields','(c) 🟧 Relationships','(d) 🟨 Structure','(e) 🟫 Rules','(f) 🟨 Quality','(g) 🟩 Output','(h) ⚙ Recipe','style="font-size:0.5em"','data-live-preview-compact-header="true"','data-stage-compact-header="true"']);
assertActiveSetupTab(shell,'source');
assertActivePreview(shell,'Rows');
assertSetupEnabled(shell,'source',true);
assertSetupEnabled(shell,'recipe',true);
for(const id of ['fields','relationships','structure','rules','quality','output'])assertSetupEnabled(shell,id,false);
assertWorkflowStatus(shell,'source','pending');
assertWorkflowStatus(shell,'export','locked');
assertWorkflowClass(shell,'source','pending');
assertWorkflowClass(shell,'export','locked');
assertSetupStatus(shell,'output','locked');
assert.ok(!shell.includes('>pending<'));
assert.ok(!shell.includes('>review<'));
assert.ok(!shell.includes('>ready<'));
assert.ok(!shell.includes('>locked<'));
assert.ok(!shell.includes('>blocked<'));

const fullscreenShell=renderTableCategorizedXmlShellHtml({isFullscreen:true});
includesAll(fullscreenShell,['data-table-categorized-fullscreen="true"','is-fullscreen','Exit Fullscreen']);

const workflowMatrix=[
  ['source',['source','recipe']],
  ['levels',['fields','relationships','rules','recipe']],
  ['graph',['structure','recipe']],
  ['validation',['quality','recipe']],
  ['export',['output','recipe']]
];
for(const [activeTab,enabledIds] of workflowMatrix){
  const html=renderTableCategorizedXmlShellHtml({activeTab});
  for(const [id] of TABLE_CATEGORIZED_SETUP_TABS)assertSetupEnabled(html,id,enabledIds.includes(id));
  assertActiveSetupTab(html,setupTabForWorkflowTab(activeTab));
}
assertActiveSetupTab(renderTableCategorizedXmlShellHtml({activeTab:'source',activeSetupTab:'recipe'}),'recipe');
assertActiveSetupTab(renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'rules'}),'rules');
assertActiveSetupTab(renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'relationships'}),'relationships');

assert.deepEqual(nextTableCategorizedNavigationState({activeTab:'levels',activeSetupTab:'fields'},{type:'setup-tab',setupTab:'relationships'}),{activeTab:'levels',activeSetupTab:'relationships',activePreviewStage:'family'});
assert.deepEqual(nextTableCategorizedNavigationState({activeTab:'levels',activeSetupTab:'relationships'},{type:'workflow-tab',activeTab:'graph'}),{activeTab:'graph',activeSetupTab:'structure',activePreviewStage:'graph'});
assert.deepEqual(tableCategorizedNavigationStateFromPopup(fakePopup('levels','relationships'),{}),{activeTab:'levels',activeSetupTab:'relationships',activePreviewStage:'family'});

let rendered='';
const setupClick=handleTableCategorizedNavigationClick({target:fakeTarget('[data-table-categorized-setup-tab]',{tableCategorizedSetupTab:'relationships',setupEnabled:'true'}),preventDefault(){}},{activeTab:'levels',activeSetupTab:'fields'},(next)=>{rendered=renderTableCategorizedXmlShellHtml(next);});
assert.equal(setupClick.handled,true);
assert.equal(setupClick.state.activeTab,'levels');
assert.equal(setupClick.state.activeSetupTab,'relationships');
assert.equal(setupClick.state.activePreviewStage,'family');
assertActiveSetupTab(rendered,'relationships');
assertActivePreview(rendered,'Final Group');
includesAll(rendered,['data-setup-body="relationships"','Join Another Table','Live Preview']);

const disabledClick=handleTableCategorizedNavigationClick({target:fakeTarget('[data-table-categorized-setup-tab]',{tableCategorizedSetupTab:'fields',setupEnabled:'false'},{disabled:true}),preventDefault(){}},{activeTab:'source',activeSetupTab:'source'},()=>{});
assert.equal(disabledClick.handled,false);
assert.equal(disabledClick.state.activeSetupTab,'source');

const fullscreenClick=handleTableCategorizedNavigationClick({target:fakeTarget('[data-table-categorized-action]',{tableCategorizedAction:'toggle-fullscreen'}),preventDefault(){}},{activeTab:'source',activeSetupTab:'source'},(next)=>{rendered=renderTableCategorizedXmlShellHtml(next);});
assert.equal(fullscreenClick.handled,true);
assert.equal(fullscreenClick.state.isFullscreen,true);
assert.ok(rendered.includes('data-table-categorized-fullscreen="true"'));
assert.ok(rendered.includes('Exit Fullscreen'));

let registeredClick=null;
let removedClick=null;
let outerHtml='';
const livePopup={querySelector:fakePopup('levels','fields').querySelector,set outerHTML(value){outerHtml=value;},get outerHTML(){return outerHtml;}};
const liveRoot={addEventListener(type,handler){if(type==='click')registeredClick=handler;},removeEventListener(type,handler){if(type==='click')removedClick=handler;}};
const installHandle=installTableCategorizedSetupTabNavigation(liveRoot,{activeTab:'levels',activeSetupTab:'fields'});
assert.ok(registeredClick);
registeredClick({target:{closest(selector){if(selector==='[data-xml-compare-table-categorized-popup]')return livePopup;if(selector==='[data-table-categorized-setup-tab]')return {dataset:{tableCategorizedSetupTab:'relationships',setupEnabled:'true'}};return null;}},preventDefault(){}});
assert.equal(installHandle.getState().activeSetupTab,'relationships');
assert.equal(installHandle.getState().activePreviewStage,'family');
assert.ok(outerHtml.includes('data-setup-body="relationships"'));
assert.ok(outerHtml.includes('Final Group'));
installHandle.destroy();
assert.ok(removedClick);

const s1=parseTableSource(PS_MAPPING_TABLE_2_MODEL_SAMPLE,{sourceId:'S1',sourceName:'Table 2 Model Data'});
const s2=parseTableSource(PS_MAPPING_COORDINATE_LOOKUP_SAMPLE,{sourceId:'S2',sourceName:'Coordinate Lookup'});
const sourceShell=renderTableCategorizedXmlShellHtml({activeTab:'source',sources:[s1,s2],activeSourceId:'S2'});
assertShellBasics(sourceShell);
assertSetupStatus(sourceShell,'source','ready');
assertWorkflowStatus(sourceShell,'source','ready');
assertWorkflowClass(sourceShell,'source','ready');
assertPanelStatus(sourceShell,'Source Tables','ready');
assertPanelStatus(sourceShell,'Parsed Rows','ready');
includesAll(sourceShell,['PS Mapping Table 2 Sample','Load Coordinate Lookup Sample','Build Preview Graph','Imported Rows Proof','Raw Table Preview','Source Messages']);
excludesAll(sourceShell,['XML Shape','Send to SourceXML Canvas','Send to TargetXML Canvas']);

const fieldsShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',sources:[s1,s2],activeSourceId:'S1'});
assertActiveSetupTab(fieldsShell,'fields');
assertSetupStatus(fieldsShell,'fields','ready');
assertWorkflowStatus(fieldsShell,'levels','ready');
assertWorkflowClass(fieldsShell,'levels','ready');
assertActivePreview(fieldsShell,'Base Key');
includesAll(fieldsShell,['Column Mapping','Column Mapping Proof','Source Column','Table Value','Common Group Key','Meaning','Data Types / Units','Defaults / Blank Handling','Calculated Fields']);
excludesAll(fieldsShell,['Regex Test Box','regexExtract']);

const relationshipsShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'relationships',sources:[s1,s2],profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE});
assertActiveSetupTab(relationshipsShell,'relationships');
assertActivePreview(relationshipsShell,'Final Group');
includesAll(relationshipsShell,['Primary / Composite Keys','Parent / Child Links','Join Another Table','Duplicate / Missing Match Rules','join_table2_coordinates']);

const rulesShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'rules',sources:[s1,s2],profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE});
assertActiveSetupTab(rulesShell,'rules');
assertActivePreview(rulesShell,'Coordinate Group');
includesAll(rulesShell,['Rule Builder','Filters / Conditions','Fallbacks','Classifiers','Coordinate Grouping','Coordinate Group Proof']);

const qualityShell=renderTableCategorizedXmlShellHtml({activeTab:'validation'});
assertActiveSetupTab(qualityShell,'quality');
assertActivePreview(qualityShell,'Graph View');
includesAll(qualityShell,['Required Checks','Validation Settings','Warnings','Audit Trail']);

const beforeExportShell=renderTableCategorizedXmlShellHtml({activeTab:'export'});
assertActiveSetupTab(beforeExportShell,'output');
assertActivePreview(beforeExportShell,'XML View');
assertSetupStatus(beforeExportShell,'output','locked');
assertPanelStatus(beforeExportShell,'Download Files','locked');
includesAll(beforeExportShell,['One XML document root only','Logical splits are child partitions below the root','Graph Compare Canvas Preview','Build Preview Graph first.']);
excludesAll(beforeExportShell,['data-table-categorized-action="send-source"','data-table-categorized-action="send-target"','PS Mapping Graph Compare Canvas Preview','PSNM']);

const recursiveProfile={profileId:'recursive-level-test-profile',displayName:'Recursive Level Test Profile',levelDefinitions:[{levelId:'documentRoot',displayName:'Document Root',levelType:'document',creationMode:'single',xmlTag:'CategorizedTableXml',children:[{levelId:'modelSplit',displayName:'Model Split',levelType:'partition',creationMode:'static',xmlTag:'RootPartition',children:[{levelId:'groupA',displayName:'Group A',levelType:'group',creationMode:'perKey',xmlTag:'GroupA',children:[{levelId:'child1',displayName:'Child One',levelType:'item',creationMode:'perRow',xmlTag:'ChildOne'},{levelId:'child2',displayName:'Child Two',levelType:'item',creationMode:'perRow',xmlTag:'ChildTwo'},{levelId:'child3',displayName:'Child Three',levelType:'item',creationMode:'perRow',xmlTag:'ChildThree',children:[{levelId:'grandchild1',displayName:'Grandchild One',levelType:'detailGroup',creationMode:'perKey',xmlTag:'GrandchildOne',children:[{levelId:'greatGrandchild1',displayName:'Great Grandchild One',levelType:'detail',creationMode:'perValue',xmlTag:'GreatGrandchildOne',keyResolver:{op:'column',sourceId:'S1',column:'GreatKey'},displayNameResolver:{op:'column',sourceId:'S1',column:'GreatName'},fieldResolvers:{note:{op:'column',sourceId:'S1',column:'Notes'}},createOnlyWhen:'GreatKey exists',sortBy:'GreatKey',sourceScope:['S1'],notes:'Deep nested shell test'}]}]}]},{levelId:'groupB',displayName:'Group B',levelType:'group',creationMode:'perKey',xmlTag:'GroupB'}]}]}]};
const rows=flattenLevelDefinitions(recursiveProfile.levelDefinitions);
assert.ok(rows.length>=8);
assert.equal(levelPathKey([0,0,0,2,0,0]),'0.0.0.2.0.0');
assert.equal(levelChildCount(recursiveProfile.levelDefinitions[0].children[0].children[0]),3);
assert.equal(rows.find((row)=>row.level.levelId==='greatGrandchild1')?.depth,5);
const recursiveShell=renderTableCategorizedXmlShellHtml({activeTab:'graph',activeSetupTab:'structure',profile:recursiveProfile,selectedLevelPath:'0.0.0.2.0.0'});
assertActiveSetupTab(recursiveShell,'structure');
assertActivePreview(recursiveShell,'Graph View');
includesAll(recursiveShell,['Graph Levels / Tree Editor','data-level-tree','data-level-node','data-level-id="greatGrandchild1"','data-level-path="0.0.0.2.0.0"','data-level-depth="5"','data-level-child-count="3"','Great Grandchild One','Selected Level','Level ID','Display Name','Level Name','Level Type','Creation Mode','XML Tag','Create From Column / Rule','Key Rule','Display Rule','Field Resolvers','Create Only When','Sort By','Child Levels','Source Scope','Notes','data-level-action="add-child"','data-level-action="delete"']);

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1',sourceName:'Table 2 - Model PS Data'});
const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const validationResults=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph});
const exportResult=exportCategorizedGraphArtifacts({graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,validationResults,sources:[source]});
const graphShell=renderTableCategorizedXmlShellHtml({activeTab:'graph',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,validationResults});
assertSetupStatus(graphShell,'structure','ready');
assertWorkflowStatus(graphShell,'graph','ready');
assertWorkflowClass(graphShell,'graph','ready');
assertPanelStatus(graphShell,'Preview Graph','ready');
includesAll(graphShell,['Preview Graph','Graph Build Proof','PS-XYZ__C001']);
const exportShell=renderTableCategorizedXmlShellHtml({activeTab:'export',graph,validationResults,exportResult});
assertSetupStatus(exportShell,'output','ready');
assertWorkflowStatus(exportShell,'export','ready');
assertWorkflowClass(exportShell,'export','ready');
assertPanelStatus(exportShell,'Download Files','ready');
assertPanelStatus(exportShell,'Canvas Link','ready');
includesAll(exportShell,['XML Output Proof','XML Preview','&lt;CategorizedTableXml','Download Categorized XML','Download Graph JSON','Download Recipe JSON','Download Diagnostics JSON','Download Audit JSON','Send to SourceXML Canvas','Send to TargetXML Canvas','Graph Compare Canvas Preview','One XML document root only','Logical splits are child partitions below the root']);
const blockedResults=[{gate:'required_columns_present',severity:'BLOCKER',status:'FAIL',message:'blocked',ref:''}];
const blockedQuality=renderTableCategorizedXmlShellHtml({activeTab:'validation',validationResults:blockedResults});
assertSetupStatus(blockedQuality,'quality','blocked');
assertWorkflowStatus(blockedQuality,'validation','blocked');
assertWorkflowClass(blockedQuality,'validation','blocked');
const blockedOutput=renderTableCategorizedXmlShellHtml({activeTab:'export',graph,validationResults:blockedResults,exportResult:null});
assertSetupStatus(blockedOutput,'output','blocked');
assertWorkflowStatus(blockedOutput,'export','blocked');
assertWorkflowClass(blockedOutput,'export','blocked');
assertPanelStatus(blockedOutput,'Download Files','blocked');
assert.ok(blockedOutput.includes('Export is blocked by validation.'));
assert.ok(!blockedOutput.includes('data-setup-body="quality"'));
assert.ok(!blockedOutput.includes('data-panel-group="quality"'));
assert.ok(!blockedOutput.includes('PSNM'));

console.log('xml-compare-table-categorized-shell: all assertions passed');
