import assert from 'node:assert/strict';
import { createXmlCompareWorkspaceModel } from '../xml-compare/XmlCompareWorkspaceModel.js';
import { renderXmlCompareWorkspaceShellHtml } from '../xml-compare/XmlCompareWorkspaceShell.js';

const emptyModel=createXmlCompareWorkspaceModel({fileA:null,textA:'',fileB:null,textB:'',report:null});
assert.equal(emptyModel.source.records.length,0);
assert.equal(emptyModel.target.records.length,0);
assert.equal(emptyModel.source.summary.nodeCount,0);
assert.equal(emptyModel.target.summary.nodeCount,0);
renderXmlCompareWorkspaceShellHtml({source:emptyModel.source,target:emptyModel.target,logs:emptyModel.logs,diagnostics:emptyModel.diagnostics});

const report={datasets:{A:{componentCount:2},B:{componentCount:3}},topologyIssues:{summary:{issueCount:1},issues:[{code:'TOPOLOGY-MISSING-COMPONENT',componentId:'A:1',message:'Missing component'}]},parseErrors:[]};
const model=createXmlCompareWorkspaceModel({fileA:{name:'A_enriched_staged.json'},textA:'{"schema":"xml-cii2019-enriched-stage/v1","branches":[]}',fileB:{name:'B_enriched.xml'},textB:'<Root><Branch><Branchname>B1</Branchname><MaterialNumber>106</MaterialNumber><Node><NodeNumber>10</NodeNumber><ElementLengthMm>100</ElementLengthMm></Node></Branch></Root>',report});
assert.equal(model.source.profile,'xml-cii2019-enriched-stage');
assert.equal(model.target.profile,'xml-cii2019-enriched-xml');
assert.equal(model.source.summary.nodeCount,2);
assert.equal(model.target.summary.nodeCount,3);
assert.equal(model.diagnostics.length,1);
assert.ok(model.logs.some((entry)=>entry.code==='XML-COMPARE-REPORT-READY'));
const html=renderXmlCompareWorkspaceShellHtml({source:model.source,target:model.target,logs:model.logs,diagnostics:model.diagnostics});
assert.match(html,/A_enriched_staged\.json/);
assert.match(html,/B_enriched\.xml/);
assert.match(html,/TOPOLOGY-MISSING-COMPONENT/);
console.log('xml-compare-workspace-model: all assertions passed');
