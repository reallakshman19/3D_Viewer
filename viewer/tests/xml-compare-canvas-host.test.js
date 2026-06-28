import assert from 'node:assert/strict';
import { createXmlCompareCanvasHostModel, renderXmlCompareCanvasHostHtml } from '../xml-compare/XmlCompareCanvasHost.js';
import { renderXmlCompareWorkspaceShellHtml } from '../xml-compare/XmlCompareWorkspaceShell.js';

const record={uid:'source:node:10',nodeNumber:'10',componentType:'PIPE',componentRefNo:'C-1',branchName:'B1',lineNo:'L1',position:{x:0,y:0,z:0},process:{pressure1:'700'}};
const data={profile:'xml-cii2019-enriched-stage',fileName:'A.json',summary:{nodeCount:1,diagnosticCount:0},records:[record],hoverRecord:record};
const model=createXmlCompareCanvasHostModel({side:'source',title:'Source',data});
assert.equal(model.recordCount,1);
assert.equal(model.fitOk,true);
assert.equal(model.fitCount,1);
const html=renderXmlCompareCanvasHostHtml({side:'source',title:'Source',data});
assert.match(html,/data-xml-compare-canvas-host="source"/);
assert.match(html,/data-xml-compare-nav-mode="select"/);
assert.match(html,/Fit All/);
assert.match(html,/process.pressure1/);
const shell=renderXmlCompareWorkspaceShellHtml({source:data,target:{profile:'inputxml',summary:{nodeCount:0}}});
assert.match(shell,/data-xml-compare-canvas-host="source"/);
assert.match(shell,/data-xml-compare-canvas-host="target"/);
console.log('xml-compare-canvas-host: all assertions passed');
