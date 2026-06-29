import assert from 'node:assert/strict';

import { createXmlCompareLineNodeHierarchy } from '../xml-compare/XmlCompareLineNodeHierarchy.js';
import { createXmlComparePnmAutoMap } from '../xml-compare/XmlComparePnmAutoMapper.js';

const sourceComponents=[
  {uid:'C1',lineNo:'L-100',points:[{x:0,y:0,z:0},{x:100,y:0,z:0}],raw:{source:{from:'10',to:'20',lineNo:'L-100'}}},
  {uid:'C2',lineNo:'L-100',points:[{x:100,y:0,z:0},{x:200,y:0,z:0}],raw:{source:{from:'20',to:'30',lineNo:'L-100'}}},
  {uid:'C3',lineNo:'L-200',points:[{x:0,y:50,z:0},{x:0,y:100,z:0}],raw:{source:{from:'100',to:'110',lineNo:'L-200'}}}
];

const targetComponents=[
  {uid:'D1',lineNo:'L-100',points:[{x:1000,y:500,z:0},{x:1100,y:500,z:0}],raw:{source:{from:'10',to:'20',lineNo:'L-100'}}},
  {uid:'D2',lineNo:'L-100',points:[{x:1100,y:500,z:0},{x:1200,y:500,z:0}],raw:{source:{from:'20',to:'30',lineNo:'L-100'}}},
  {uid:'D3',lineNo:'L-200',points:[{x:1000,y:550,z:0},{x:1000,y:600,z:0}],raw:{source:{from:'100',to:'110',lineNo:'L-200'}}}
];

const sourceHierarchy=createXmlCompareLineNodeHierarchy(sourceComponents);
assert.equal(sourceHierarchy.lineCount,2);
assert.equal(sourceHierarchy.nodeCount,5);
assert.deepEqual(sourceHierarchy.lines.map((line)=>line.lineNo),['L-100','L-200']);
assert.ok(sourceHierarchy.records.every((record)=>record.componentType==='NODE'));
assert.ok(sourceHierarchy.records.some((record)=>record.uid==='L-100::20'));

const targetHierarchy=createXmlCompareLineNodeHierarchy(targetComponents);
const autoMap=createXmlComparePnmAutoMap({sourceRecords:sourceHierarchy.records,targetRecords:targetHierarchy.records});
assert.equal(autoMap.summary.matchCount,5);
assert.ok(autoMap.matches.every((match)=>match.basis.includes('coordinate-transform')));
assert.ok(autoMap.matches.some((match)=>match.sourceUid==='L-100::10'&&match.targetUid==='L-100::10'));
assert.ok(autoMap.transform);

console.log('xml-compare-line-node-hierarchy: all assertions passed');
