import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=(path)=>readFileSync(resolve(repoRoot,path),'utf8');

const gate=read('viewer/tabs/xml-compare-linewise-toolbar-gate.js');
const runtime=read('viewer/tabs/xml-compare-table-categorized-runtime.js');
const shell=read('viewer/xml-compare/XmlCompareWorkspaceShell.js');

assert.ok(!gate.includes('installTableCategorizedSetupTabNavigation'));
assert.ok(!gate.includes('tableCategorizedNavigationHandle'));
assert.ok(!gate.includes('table-categorized-xml-controller.js'));
assert.ok(gate.includes('installXmlCompareLinewiseToolbarGate'));
assert.ok(gate.includes('if(installed||!doc?.addEventListener)return false'));

assert.ok(runtime.includes('data-xml-compare-table-categorized-open'));
assert.ok(runtime.includes('let runtimeInstalled=false'));
assert.ok(runtime.includes('let tableCategorizedObserver=null'));
assert.ok(runtime.includes('export function installTableCategorizedRuntime'));
assert.ok(runtime.includes('if(runtimeInstalled||!doc?.addEventListener)return false'));
assert.ok(runtime.includes('runtimeInstalled=true'));
assert.ok(runtime.includes("doc.addEventListener('click',clickHandler,{capture:true})"));
assert.ok(runtime.includes("doc.addEventListener('input',inputHandler,{capture:true})"));
assert.ok(runtime.includes("doc.addEventListener('change',changeHandler,{capture:true})"));
assert.ok(runtime.includes('new MutationObserver(()=>injectButton(doc))'));
assert.ok(runtime.includes('installTableCategorizedRuntime();'));
assert.equal(runtime.includes('function install(){'),false);

assert.ok(shell.includes('let loadTableCategorizedPromise=null'));
assert.ok(shell.includes('if(loadTableCategorizedPromise)return'));
assert.ok(shell.includes('xml-compare-table-categorized-runtime.js'));

console.log('table-categorized-runtime-ownership: ownership assertions passed');
