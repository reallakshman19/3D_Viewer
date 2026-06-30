import assert from 'node:assert/strict';

import { createXmlCompareLineNodeHierarchy } from '../xml-compare/XmlCompareLineNodeHierarchy.js';
import { createXmlComparePnmAutoMap } from '../xml-compare/XmlComparePnmAutoMapper.js';
import { renderXmlCompareAutoMapPopupHtml } from '../xml-compare/XmlCompareAutoMapPopup.js';

const sourceHierarchy=createXmlCompareLineNodeHierarchy([
  {
    uid:'SRC-1',
    lineNo:'L-1',
    points:[{x:0,y:0,z:0}],
    position:{x:0,y:0,z:0},
    attributes:{Temperature1:'120',Pressure1:'700','COMPONENT-ATTRIBUTE2':'120','COMPONENT-ATTRIBUTE1':'700'}
  }
]);
const targetHierarchy=createXmlCompareLineNodeHierarchy([
  {uid:'TGT-1',lineNo:'L-1',points:[{x:1000,y:500,z:0}],position:{x:1000,y:500,z:0},attributes:{Temperature1:'',Pressure1:''}}
]);

assert.equal(sourceHierarchy.records[0].transferFields.Temperature1,'120');
assert.equal(sourceHierarchy.records[0].transferFields.Pressure1,'700');

const matchMap=createXmlComparePnmAutoMap({sourceRecords:sourceHierarchy.records,targetRecords:targetHierarchy.records});
const matchMapWithRequest={...matchMap,request:{scope:'node',sourceUid:sourceHierarchy.records[0].uid,targetUid:targetHierarchy.records[0].uid}};
const html=renderXmlCompareAutoMapPopupHtml({matchMap:matchMapWithRequest,source:{records:sourceHierarchy.records},target:{records:targetHierarchy.records}});

assert.match(html,/Auto Map Review/);
assert.match(html,/Transfer source properties to target fields/);
assert.match(html,/Coordinate match review/);
assert.match(html,/Temperature1/);
assert.match(html,/Pressure1/);
assert.match(html,/copy-source-node-fields-to-target-node-fields/);
assert.match(html,/preview-only/);

console.log('xml-compare-automap-popup: all assertions passed');
