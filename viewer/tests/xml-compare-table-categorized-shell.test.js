import assert from 'node:assert/strict';

import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { TABLE_CATEGORIZED_STEPS, TABLE_CATEGORIZED_STEP_LABELS, TABLE_CATEGORIZED_XML_BUTTON_ATTR, createTableCategorizedStepStatus, flattenLevelDefinitions, levelChildCount, levelPathKey, renderDisclosure, renderTableCategorizedXmlButtonHtml, renderTableCategorizedXmlShellHtml, setupTabForWorkflowTab } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

const includesAll=(html,labels)=>labels.forEach((label)=>assert.ok(html.includes(label),`missing ${label}`));
const excludesAll=(html,labels)=>labels.forEach((label)=>assert.ok(!html.includes(label),`unexpected ${label}`));
const insideDisclosure=(html,id,label)=>{const marker=`data-table-categorized-disclosure="${id}"`;const start=html.indexOf(marker);const end=html.indexOf('</details>',start);assert.ok(start>=0,`missing disclosure ${id}`);assert.ok(html.slice(start,end).includes(label),`${label} not inside ${id}`);};

assert.deepEqual(TABLE_CATEGORIZED_STEPS,['table','columns','structure','preview','export']);
assert.equal(TABLE_CATEGORIZED_STEP_LABELS.table,'Table');
assert.equal(setupTabForWorkflowTab('source'),'source');
assert.equal(setupTabForWorkflowTab('levels'),'fields');
assert.ok(renderTableCategorizedXmlButtonHtml().includes(TABLE_CATEGORIZED_XML_BUTTON_ATTR));

const disclosure=renderDisclosure({id:'source-options',title:'More table options',body:'Body'});
includesAll(disclosure,['<details','<summary>','data-table-categorized-disclosure="source-options"','More table options','Body']);

const shell=renderTableCategorizedXmlShellHtml();
includesAll(shell,['1 Table','2 Columns','3 Structure','4 Preview','5 Export','data-table-categorized-step="table"','Read Table','Paste table text','More table options']);
excludesAll(shell,['(a) 🟦 Source','(b) 🟪 Fields','Base Key','Coordinate Group','Final Group','Graph View','XML View']);
assert.equal((shell.match(/class="is-primary"/g)||[]).length,1,'one primary CTA is visible for the active step');
insideDisclosure(shell,'source-options','Load Coordinate Sample');
insideDisclosure(shell,'source-options','Load Two-source Template');
insideDisclosure(shell,'source-options','Delimiter');
insideDisclosure(shell,'source-options','data-table-categorized-delimiter-mode');
includesAll(shell,['Auto-detect','Comma','Pipe','Semicolon','Whitespace']);

for(const term of ['Resolver','LevelDefinition','RootPartition','GraphNode','SourceRefs','Validation gate','Canonical graph']){
  assert.equal(shell.includes(term),false,`default shell exposes internal term ${term}`);
}

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1',sourceName:'Table 2'});
const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const validationResults=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph});
const exportResult=exportCategorizedGraphArtifacts({graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,validationResults,sources:[source]});

assert.deepEqual(createTableCategorizedStepStatus({sources:[source],graph,validationResults,exportResult}).export,'complete');
const commaShell=renderTableCategorizedXmlShellHtml({sources:[{...source,delimiterMode:'comma'}],activeSourceId:'S1'});
includesAll(commaShell,['value="comma" selected','data-table-categorized-delimiter-mode']);

const columnsHtml=renderTableCategorizedXmlShellHtml({activeStep:'columns',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
includesAll(columnsHtml,['Columns detected','Confirm Columns','Column details','PS NO','DTXR']);
insideDisclosure(columnsHtml,'column-details','XML format');
assert.equal((columnsHtml.match(/class="is-primary"/g)||[]).length,1);

const structureHtml=renderTableCategorizedXmlShellHtml({activeStep:'structure',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE});
includesAll(structureHtml,['Suggested XML structure','Build Graph','Structure options','Root']);
insideDisclosure(structureHtml,'structure-options','Load Structure Recipe');
assert.equal((structureHtml.match(/class="is-primary"/g)||[]).length,1);

const previewHtml=renderTableCategorizedXmlShellHtml({activeStep:'preview',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,validationResults});
includesAll(previewHtml,['Structure preview and checks','Check Output','Check details','Structure preview ready:']);
insideDisclosure(previewHtml,'check-details','INFO');
assert.equal((previewHtml.match(/class="is-primary"/g)||[]).length,1);

const exportHtml=renderTableCategorizedXmlShellHtml({activeStep:'export',sources:[source],profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,graph,validationResults,exportResult});
includesAll(exportHtml,['XML is ready','Download XML','More export files','Canvas and comparison tools']);
insideDisclosure(exportHtml,'more-export-files','Download Diagnostics JSON');
insideDisclosure(exportHtml,'more-export-files','Download Audit JSON');
insideDisclosure(exportHtml,'canvas-comparison-tools','Run Graph Compare');
insideDisclosure(exportHtml,'canvas-comparison-tools','Send to SourceXML Canvas');
assert.equal((exportHtml.match(/class="is-primary"/g)||[]).length,1);

const recursiveProfile={levelDefinitions:[{levelId:'root',displayName:'Root',children:[{levelId:'child',displayName:'Child',children:[{levelId:'grandchild',displayName:'Grandchild'}]}]}]};
assert.equal(levelPathKey([0,0,0]),'0.0.0');
assert.equal(levelChildCount(recursiveProfile.levelDefinitions[0]),1);
assert.equal(flattenLevelDefinitions(recursiveProfile.levelDefinitions).length,3);

console.log('xml-compare-table-categorized-shell: disclosure and delimiter assertions passed');
