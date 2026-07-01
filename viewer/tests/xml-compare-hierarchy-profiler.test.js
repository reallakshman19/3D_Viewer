import assert from 'node:assert/strict';
import { createXmlCompareHierarchyProfile } from '../xml-compare/XmlCompareHierarchyProfiler.js';
import { createXmlCompareCanvasLevelModel } from '../xml-compare/XmlCompareCanvasLevelModel.js';
import { renderXmlCompareCanvasLevelSelectorHtml } from '../xml-compare/XmlCompareCanvasLevelSelector.js';

const records=[
  {uid:'source:B1:10',branchName:'/B1',lineNo:'L-100',nodeNumber:'10',nodeName:'N10',componentType:'PIPE',componentRefNo:'C10',position:{x:1,y:2,z:3},pipingClass:'31441C4',dtxrPs:'PS-10',dtxrPos:'REST',process:{pressure1:'700',temperature1:'120',fluidDensity:'69',materialNumber:'106'}},
  {uid:'source:B1:20',branchName:'/B1',lineNo:'L-100',nodeNumber:'20',nodeName:'N20',componentType:'ATTA',componentRefNo:'C20',position:{x:4,y:5,z:6},pipingClass:'31441C4',dtxrPs:'PS-20',dtxrPos:'GUIDE',process:{pressure1:'700',temperature1:'120',fluidDensity:'69',materialNumber:'106'}},
  {uid:'source:B2:30',branchName:'/B2',lineNo:'L-200',nodeNumber:'30',nodeName:'N30',componentType:'PIPE',componentRefNo:'C30',position:{x:7,y:8,z:9}}
];

const profile=createXmlCompareHierarchyProfile({side:'source',fileName:'a_enriched.xml',profile:'xml-cii2019-enriched-xml',records,summary:{recordCount:3,lineCount:2,nodeCount:3}});
assert.equal(profile.schema,'xml-compare-hierarchy-profile/v1');
assert.deepEqual(profile.levels.map((level)=>level.levelId),['root','branch','node','evidence']);
assert.equal(profile.levels.find((level)=>level.levelId==='branch').recordCount,2);
assert.ok(profile.levels.find((level)=>level.levelId==='node').fields.includes('nodeNumber'));
assert.ok(profile.levels.find((level)=>level.levelId==='node').fields.includes('process.pressure1'));
assert.equal(profile.levels.find((level)=>level.levelId==='evidence').recordCount,4);

const nodeView=createXmlCompareCanvasLevelModel({side:'source',fileName:'a_enriched.xml',profile:'xml-cii2019-enriched-xml',records,selection:{}});
assert.equal(nodeView.levelId,'node');
assert.equal(nodeView.layout,'line-node');
assert.equal(nodeView.records.length,3);

const branchView=createXmlCompareCanvasLevelModel({side:'source',fileName:'a_enriched.xml',profile:'xml-cii2019-enriched-xml',records,selection:{levelId:'branch',displayField:'branchName',keyField:'lineNo'}});
assert.equal(branchView.levelId,'branch');
assert.equal(branchView.layout,'cards');
assert.equal(branchView.records.length,2);
assert.equal(branchView.displayField,'branchName');
assert.equal(branchView.keyField,'lineNo');

const html=renderXmlCompareCanvasLevelSelectorHtml({side:'source',levelView:branchView});
assert.match(html,/data-xml-compare-level-selector="source"/);
assert.match(html,/Branch \(2\)/);
assert.match(html,/data-xml-compare-level-select="levelId"/);
assert.match(html,/branchName/);
assert.match(html,/lineNo/);

console.log('xml-compare-hierarchy-profiler: all assertions passed');
