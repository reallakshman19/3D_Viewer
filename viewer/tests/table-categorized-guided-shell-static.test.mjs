import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=(path)=>readFileSync(resolve(repoRoot,path),'utf8');
const shell=read('viewer/xml-compare/table-categorizer/table-categorized-xml-shell.js');
const runtime=read('viewer/tabs/xml-compare-table-categorized-runtime.js');
const gate=read('viewer/tabs/xml-compare-linewise-toolbar-gate.js');

for(const step of ['table','columns','structure','preview','export']){
  assert.ok(shell.includes(`'${step}'`)||shell.includes(`"${step}"`),`shell missing step ${step}`);
}
assert.ok(shell.includes('TABLE_CATEGORIZED_STEPS'));
assert.ok(shell.includes('createTableCategorizedStepStatus'));
assert.ok(shell.includes('export function renderDisclosure'));
assert.ok(shell.includes('<details'));
assert.ok(shell.includes('<summary>'));
assert.ok(shell.includes('data-table-categorized-disclosure'));
assert.ok(shell.includes('data-table-categorized-step'));
assert.ok(!shell.includes('TABLE_CATEGORIZED_SETUP_TABS=Object.freeze([\n  ['));
assert.ok(!shell.includes('renderTableCategorizedStagePreview'));

for(const id of ['source-options','column-details','structure-options','check-details','more-export-files','canvas-comparison-tools']){
  assert.ok(shell.includes(id),`missing disclosure ${id}`);
}
for(const label of ['Load Coordinate Sample','Load Two-source Template','Download Diagnostics JSON','Download Audit JSON','Run Graph Compare','Build Graph Connectors','Send to SourceXML Canvas','Send to TargetXML Canvas']){
  assert.ok(shell.includes(label),`missing retained secondary action ${label}`);
}

assert.ok(runtime.includes("activeStep:'table'"));
assert.ok(runtime.includes('const TAB_TO_STEP=Object.freeze'));
assert.ok(runtime.includes('const STEP_TO_TAB=Object.freeze'));
assert.ok(runtime.includes('function setActiveStep(step)'));
assert.ok(runtime.includes("closest('[data-table-categorized-step]')"));
assert.ok(runtime.includes('dataset.tableCategorizedStep'));
assert.ok(runtime.includes('setActiveStep(step)'));
assert.ok(runtime.includes('installTableCategorizedRuntime'));
assert.ok(runtime.includes('let runtimeInstalled=false'));
assert.equal(runtime.includes('function install(){'),false);
assert.equal(gate.includes('installTableCategorizedSetupTabNavigation'),false);

for(const banned of ['table-categorized-xml-source-parser.js.bak','table-categorized-xml-exporter-shadow','alternate parser','legacy shim']){
  assert.equal(shell.includes(banned)||runtime.includes(banned),false);
}

console.log('table-categorized-guided-shell-static: disclosure cleanup assertions passed');
