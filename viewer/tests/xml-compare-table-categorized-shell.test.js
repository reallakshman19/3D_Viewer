import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { TABLE_CATEGORIZED_SETUP_TABS, TABLE_CATEGORIZED_XML_BUTTON_ATTR, flattenLevelDefinitions, levelChildCount, levelPathKey, renderTableCategorizedXmlButtonHtml, renderTableCategorizedXmlShellHtml, setupTabForWorkflowTab } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

const includesAll=(html,labels)=>labels.forEach((label)=>assert.ok(html.includes(label),`missing ${label}`));
const excludesAll=(html,labels)=>labels.forEach((label)=>assert.ok(!html.includes(label),`unexpected ${label}`));
const tagFor=(html,marker)=>{const at=html.indexOf(marker);const start=html.lastIndexOf('<button',at);const end=html.indexOf('>',at);return at>=0&&start>=0&&end>=0?html.slice(start,end+1):'';};
const setupTag=(html,id)=>tagFor(html,`data-table-categorized-setup-tab="${id}"`);
const workflowTag=(html,id)=>tagFor(html,`data-table-categorized-tab="${id}"`);
const activePreview=(html,label)=>html.match(new RegExp(`<button[^>]*class="is-active"[^>]*>${label}</button>`))?.[0]||'';
const assertSetup=(html,id)=>{assert.ok(setupTag(html,id).includes('is-active'));assert.ok(html.includes(`data-setup-body="${id}"`));};
const assertSetupEnabled=(html,id,value)=>assert.ok(setupTag(html,id).includes(`data-setup-enabled="${value?'true':'false'}"`));
const assertSetupStatus=(html,id,status)=>assert.ok(setupTag(html,id).includes(`data-setup-status="${status}"`));
const assertWorkflowStatus=(html,id,status)=>assert.ok(workflowTag(html,id).includes(`data-workflow-status="${status}"`));
const assertBasics=(html)=>includesAll(html,['Live Preview','<details','data-setup-body','data-panel-group','data-table-categorized-status','data-workflow-status','data-setup-status','data-setup-enabled','data-current-next-step']);
const assertCurrentNext=(html,current,next,instruction)=>includesAll(html,[`Current: ${current}`,`Next: ${next}`,instruction]);

const docsPath=new URL('../../docs/xml-compare/table-categorized-user-flow.md',import.meta.url);
assert.ok(existsSync(docsPath),'docs/xml-compare/table-categorized-user-flow.md must exist');
const docsText=readFileSync(docsPath,'utf8');
includesAll(docsText,['Load PS Mapping Table 2 Sample','Build Preview Graph','Download Categorized XML','Final Group','Graph not built','Source pending','Fields missing columns','Graph not built yet','Export blocked','Download disabled']);

const button=renderTableCategorizedXmlButtonHtml();
assert.ok(button.includes('Table to Categorized XML'));
assert.ok(button.includes(TABLE_CATEGORIZED_XML_BUTTON_ATTR));
assert.equal(setupTabForWorkflowTab('source'),'source');
assert.equal(setupTabForWorkflowTab('levels'),'fields');
assert.equal(setupTabForWorkflowTab('graph'),'structure');
assert.equal(setupTabForWorkflowTab('validation'),'quality');
assert.equal(setupTabForWorkflowTab('export'),'output');

const shell=renderTableCategorizedXmlShellHtml();
assertBasics(shell);
includesAll(shell,['Fullscreen','1 Import Table','2 Map Fields & Rules','3 Build Structure','4 Check','5 Export','(a) 🟦 Source','(h) ⚙ Recipe','style="font-size:0.5em"']);
assertSetup(shell,'source');
assert.ok(activePreview(shell,'Rows'));
assertCurrentNext(shell,'Source','Fields','Load or paste table.');
assertSetupEnabled(shell,'source',true);
assertSetupEnabled(shell,'recipe',true);
for(const id of ['fields','relationships','structure','rules','quality','output'])assertSetupEnabled(shell,id,false);
assertWorkflowStatus(shell,'source','pending');
assertWorkflowStatus(shell,'export','locked');
assertSetupStatus(shell,'output','locked');
assert.ok(!shell.includes('>pending<'));
assert.ok(!shell.includes('>ready<'));
includesAll(renderTableCategorizedXmlShellHtml({isFullscreen:true}),['data-table-categorized-fullscreen="true"','is-fullscreen','Exit Fullscreen']);

const matrix=[['source',['source','recipe']],['levels',['fields','relationships','rules','recipe']],['graph',['structure','recipe']],['validation',['quality','recipe']],['export',['output','recipe']]];
for(const [activeTab,enabled] of matrix){const html=renderTableCategorizedXmlShellHtml({activeTab});for(const [id] of TABLE_CATEGORIZED_SETUP_TABS)assertSetupEnabled(html,id,enabled.includes(id));assertSetup(html,setupTabForWorkflowTab(activeTab));}

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1',sourceName:'Table 2'});
const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const validationResults=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph});
const exportResult=exportCategorizedGraphArtifacts({graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,validationResults,sources:[source]});

const sourceState=renderTableCategorizedXmlShellHtml({activeTab:'source',activeSetupTab:'source',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assertBasics(sourceState);
assertSetup(sourceState,'source');
assertCurrentNext(sourceState,'Source','Fields','Load or paste table.');
assert.ok(activePreview(sourceState,'Rows'));

const fieldsState=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'fields',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assertBasics(fieldsState);
assertSetup(fieldsState,'fields');
assertCurrentNext(fieldsState,'Fields','Rules','Confirm column mapping.');
includesAll(fieldsState,['Column Mapping Proof','Source Column','Table Value','Common Group Key','Meaning']);

const rulesState=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'rules',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assertBasics(rulesState);
assertSetup(rulesState,'rules');
assertCurrentNext(rulesState,'Rules','Relationships','Confirm coordinate/grouping logic.');
includesAll(rulesState,['Coordinate Group Proof','C001']);

const relationshipsState=renderTableCategorizedXmlShellHtml({activeTab:'levels',activeSetupTab:'relationships',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
assertBasics(relationshipsState);
assertSetup(relationshipsState,'relationships');
assertCurrentNext(relationshipsState,'Relationships','Structure','Confirm final group.');
includesAll(relationshipsState,['Final Group Proof','Final Group is ready.','Next step: Build Graph.','data-table-categorized-action="build-graph"']);

const structureState=renderTableCategorizedXmlShellHtml({activeTab:'graph',activeSetupTab:'structure',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,validationResults});
assertBasics(structureState);
assertSetup(structureState,'structure');
assertCurrentNext(structureState,'Structure','Quality','Build/review graph.');
assertSetupStatus(structureState,'structure','ready');
includesAll(structureState,['Graph built successfully.','Check Quality','Go to Output','data-table-categorized-tab="validation"','data-table-categorized-tab="export"']);

const qualityState=renderTableCategorizedXmlShellHtml({activeTab:'validation',activeSetupTab:'quality',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,validationResults});
assertBasics(qualityState);
assertSetup(qualityState,'quality');
assertCurrentNext(qualityState,'Quality','Output','Review blockers/warnings.');
includesAll(qualityState,['Required Checks','Graph built successfully.']);

const outputState=renderTableCategorizedXmlShellHtml({activeTab:'export',activeSetupTab:'output',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,validationResults,exportResult});
assertBasics(outputState);
assertSetup(outputState,'output');
assertCurrentNext(outputState,'Output','Output','Download categorized XML.');
assertSetupStatus(outputState,'output','ready');
assertWorkflowStatus(outputState,'export','ready');
includesAll(outputState,['Categorized XML ready.','This XML is enriched from the table into a categorized graph structure.','Download Categorized XML','Download Graph JSON','Download Recipe JSON','Download Diagnostics JSON','Download Audit JSON','data-table-categorized-download="xml"','data-table-categorized-download="graph"','data-table-categorized-download="profile"','data-table-categorized-download="diagnostics"','data-table-categorized-download="audit"','Send to SourceXML Canvas','Send to TargetXML Canvas']);

const beforeOutput=renderTableCategorizedXmlShellHtml({activeTab:'export',activeSetupTab:'output'});
includesAll(beforeOutput,['Export not ready.','Build the preview graph first.','Build Preview Graph first.','data-table-categorized-action="build-graph"','Graph Compare Canvas Preview','One XML document root only','Logical splits are child partitions below the root']);
excludesAll(beforeOutput,['Download Categorized XML','data-table-categorized-download="xml"','Send to SourceXML Canvas','Send to TargetXML Canvas','PSNM']);

const recursiveProfile={levelDefinitions:[{levelId:'root',displayName:'Root',children:[{levelId:'split',displayName:'Model Split',children:[{levelId:'group',displayName:'Group',children:[{levelId:'child1',displayName:'Child One'},{levelId:'child2',displayName:'Child Two'},{levelId:'child3',displayName:'Child Three',children:[{levelId:'grandchild1',displayName:'Grandchild One',children:[{levelId:'greatGrandchild1',displayName:'Great Grandchild One'}]}]}]}]}]}]};
assert.equal(levelPathKey([0,0,0,2,0,0]),'0.0.0.2.0.0');
assert.equal(levelChildCount(recursiveProfile.levelDefinitions[0].children[0].children[0]),3);
assert.ok(flattenLevelDefinitions(recursiveProfile.levelDefinitions).length>=6);
const recursiveShell=renderTableCategorizedXmlShellHtml({activeTab:'graph',activeSetupTab:'structure',profile:recursiveProfile,selectedLevelPath:'0.0.0.2.0.0'});
includesAll(recursiveShell,['data-level-tree','data-level-node','data-level-id="greatGrandchild1"','data-level-path="0.0.0.2.0.0"','Great Grandchild One','Selected Level','data-level-action="add-child"','data-level-action="delete"']);
const blocked=renderTableCategorizedXmlShellHtml({activeTab:'export',graph,validationResults:[{severity:'BLOCKER',status:'FAIL',message:'blocked'}],exportResult:null});
assertSetupStatus(blocked,'output','blocked');
assert.ok(blocked.includes('Export is blocked by validation.'));
assert.ok(!blocked.includes('data-setup-body="quality"'));
assert.ok(!blocked.includes('Download Categorized XML'));
assert.ok(!blocked.includes('PSNM'));
console.log('xml-compare-table-categorized-shell: all assertions passed');
