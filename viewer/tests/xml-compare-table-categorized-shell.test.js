import assert from 'node:assert/strict';

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
const activePreviewButton=(html,label)=>html.match(new RegExp(`<button[^>]*class="is-active"[^>]*>${label}</button>`))?.[0]||'';
const assertActivePreview=(html,label)=>assert.ok(activePreviewButton(html,label), `preview tab not active: ${label}`);
const assertActiveSetupTab=(html,id)=>{const tag=setupTag(html,id);assert.ok(tag.includes('class="is-active"'), `setup tab is not active: ${id}`);assert.ok(tag.includes('aria-selected="true"'), `active setup tab is not selected: ${id}`);assert.ok(html.includes(`data-setup-body="${id}"`), `setup body missing: ${id}`);};
const assertSetupEnabled=(html,id,enabled)=>assert.ok(setupTag(html,id).includes(`data-setup-enabled="${enabled?'true':'false'}"`), `${id} enabled state mismatch`);
const assertSetupStatus=(html,id,status)=>assert.ok(setupTag(html,id).includes(`data-setup-status="${status}"`), `${id} status mismatch`);
const assertWorkflowStatus=(html,id,status)=>assert.ok(workflowTag(html,id).includes(`data-workflow-status="${status}"`), `${id} workflow status mismatch`);
const assertShellBasics=(html)=>includesAll(html,['Live Preview','<details','table-categorized-setup-tabs','data-setup-body','data-panel-group','data-table-categorized-status','data-workflow-status','data-setup-status','data-setup-enabled']);

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

const s1=parseTableSource(PS_MAPPING_TABLE_2_MODEL_SAMPLE,{sourceId:'S1',sourceName:'Table 2 Model Data'});
const s2=parseTableSource(PS_MAPPING_COORDINATE_LOOKUP_SAMPLE,{sourceId:'S2',sourceName:'Coordinate Lookup'});
const sourceShell=renderTableCategorizedXmlShellHtml({activeTab:'source',sources:[s1,s2],activeSourceId:'S2'});
assertShellBasics(sourceShell);
assertSetupStatus(sourceShell,'source','ready');
assertWorkflowStatus(sourceShell,'source','ready');
includesAll(sourceShell,['PS Mapping Table 2 Sample','Load Coordinate Lookup Sample','Build Preview Graph','Imported Rows Proof']);

const fieldsShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',sources:[s1,s2],activeSourceId:'S1'});
assertActiveSetupTab(fieldsShell,'fields');
assertSetupStatus(fieldsShell,'fields','ready');
assertWorkflowStatus(fieldsShell,'levels','ready');
assertActivePreview(fieldsShell,'Base Key');
includesAll(fieldsShell,['Column Mapping','Column Mapping Proof','Source Column','Table Value','Common Group Key','Meaning']);
excludesAll(fieldsShell,['Regex Test Box','regexExtract']);

const relationshipsShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'relationships',sources:[s1,s2],profile:PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE});
assertActiveSetupTab(relationshipsShell,'relationships');
assertActivePreview(relationshipsShell,'Final Group');
includesAll(relationshipsShell,['Primary / Composite Keys','Parent / Child Links','Join Another Table','Duplicate / Missing Match Rules']);

const recursiveProfile={profileId:'recursive-level-test-profile',displayName:'Recursive Level Test Profile',levelDefinitions:[{levelId:'documentRoot',displayName:'Document Root',levelType:'document',creationMode:'single',xmlTag:'CategorizedTableXml',children:[{levelId:'modelSplit',displayName:'Model Split',levelType:'partition',creationMode:'static',xmlTag:'RootPartition',children:[{levelId:'groupA',displayName:'Group A',levelType:'group',creationMode:'perKey',xmlTag:'GroupA',children:[{levelId:'child1',displayName:'Child One',levelType:'item',creationMode:'perRow',xmlTag:'ChildOne'},{levelId:'child2',displayName:'Child Two',levelType:'item',creationMode:'perRow',xmlTag:'ChildTwo'},{levelId:'child3',displayName:'Child Three',levelType:'item',creationMode:'perRow',xmlTag:'ChildThree',children:[{levelId:'grandchild1',displayName:'Grandchild One',levelType:'detailGroup',creationMode:'perKey',xmlTag:'GrandchildOne',children:[{levelId:'greatGrandchild1',displayName:'Great Grandchild One',levelType:'detail',creationMode:'perValue',xmlTag:'GreatGrandchildOne',keyResolver:{op:'column',sourceId:'S1',column:'GreatKey'},displayNameResolver:{op:'column',sourceId:'S1',column:'GreatName'},fieldResolvers:{note:{op:'column',sourceId:'S1',column:'Notes'}},createOnlyWhen:'GreatKey exists',sortBy:'GreatKey',sourceScope:['S1'],notes:'Deep nested shell test'}]}]}]},{levelId:'groupB',displayName:'Group B',levelType:'group',creationMode:'perKey',xmlTag:'GroupB'}]}]}]};
const rows=flattenLevelDefinitions(recursiveProfile.levelDefinitions);
assert.ok(rows.length>=7);
assert.equal(levelPathKey([0,0,0,2,0,0]),'0.0.0.2.0.0');
assert.equal(levelChildCount(recursiveProfile.levelDefinitions[0].children[0].children[0]),3);
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
includesAll(graphShell,['Preview Graph','Graph Build Proof','PS-XYZ__C001']);
const exportShell=renderTableCategorizedXmlShellHtml({activeTab:'export',graph,validationResults,exportResult});
assertSetupStatus(exportShell,'output','ready');
assertWorkflowStatus(exportShell,'export','ready');
includesAll(exportShell,['XML Output Proof','Download Categorized XML','Send to SourceXML Canvas','Send to TargetXML Canvas','Graph Compare Canvas Preview','One XML document root only','Logical splits are child partitions below the root']);
const blockedResults=[{gate:'required_columns_present',severity:'BLOCKER',status:'FAIL',message:'blocked',ref:''}];
const blockedQuality=renderTableCategorizedXmlShellHtml({activeTab:'validation',validationResults:blockedResults});
assertSetupStatus(blockedQuality,'quality','blocked');
assertWorkflowStatus(blockedQuality,'validation','blocked');
const blockedOutput=renderTableCategorizedXmlShellHtml({activeTab:'export',graph,validationResults:blockedResults,exportResult:null});
assertSetupStatus(blockedOutput,'output','blocked');
assertWorkflowStatus(blockedOutput,'export','blocked');
assert.ok(blockedOutput.includes('Export is blocked by validation.'));
assert.ok(!blockedOutput.includes('data-setup-body="quality"'));
assert.ok(!blockedOutput.includes('data-panel-group="quality"'));
assert.ok(!blockedOutput.includes('PSNM'));

console.log('xml-compare-table-categorized-shell: all assertions passed');
