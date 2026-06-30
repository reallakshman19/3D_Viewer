import assert from 'node:assert/strict';

import { createXmlCompareLineNodeHierarchy } from '../xml-compare/XmlCompareLineNodeHierarchy.js';
import { createXmlComparePnmAutoMap } from '../xml-compare/XmlComparePnmAutoMapper.js';
import { renderXmlCompareAutoMapPopupHtml, _test as popupTest } from '../xml-compare/XmlCompareAutoMapPopup.js';

const sourceHierarchy=createXmlCompareLineNodeHierarchy([
  {uid:'SRC-1',lineNo:'L-1',points:[{x:0,y:0,z:0}],position:{x:0,y:0,z:0},attributes:{Temperature1:'120',Pressure1:'700','COMPONENT-ATTRIBUTE2':'120','COMPONENT-ATTRIBUTE1':'700',TEMP_EXP_C1:'120',PRESSURE1:'700',DESIGN_PRESSURE:'900',INSUL_THICK:'50',PIPELINE_REFERENCE:'PIPE-A'}},
  {uid:'SRC-2',lineNo:'L-1',points:[{x:10,y:0,z:0}],position:{x:10,y:0,z:0},attributes:{Temperature1:'121',Pressure1:'701',HYDRO_PRESSURE:'1200'}}
]);
const targetHierarchy=createXmlCompareLineNodeHierarchy([
  {uid:'TGT-1',lineNo:'L-9',points:[{x:1000,y:500,z:0}],position:{x:1000,y:500,z:0},attributes:{Temperature1:'',Pressure1:''}},
  {uid:'TGT-2',lineNo:'L-9',points:[{x:1010,y:500,z:0}],position:{x:1010,y:500,z:0},attributes:{Temperature1:'',Pressure1:''}}
]);

assert.equal(sourceHierarchy.records[0].transferFields.Temperature1,'120');
assert.equal(sourceHierarchy.records[0].transferFields.Pressure1,'700');
assert.equal(sourceHierarchy.records[0].sourceAttributes.DESIGN_PRESSURE,'900');
assert.equal(sourceHierarchy.records[0].sourceAttributes.INSUL_THICK,'50');

const childFields=popupTest.normalizedChildFields(sourceHierarchy.records[0]);
assert.equal(childFields.DESIGN_PRESSURE,'900');
assert.equal(childFields.INSUL_THICK,'50');
assert.equal(childFields.Pressure1,'700');
assert.equal(childFields.Temperature1,'120');

const matchMap=createXmlComparePnmAutoMap({sourceRecords:sourceHierarchy.records,targetRecords:targetHierarchy.records});
const matchMapWithRequest={...matchMap,request:{scope:'node',sourceUid:sourceHierarchy.records[0].uid,targetUid:targetHierarchy.records[0].uid}};
const html=renderXmlCompareAutoMapPopupHtml({matchMap:matchMapWithRequest,source:{records:sourceHierarchy.records},target:{records:targetHierarchy.records}});

assert.match(html,/Auto Map Review/);
assert.match(html,/Matched Nodes/);
assert.match(html,/Node pair\(s\)/);
assert.match(html,/Max Δ SRSS/);
assert.match(html,/Select ≤ limit/);
assert.match(html,/Transfer/);
assert.match(html,/Compare/);
assert.match(html,/Temperature1/);
assert.match(html,/Pressure1/);
assert.match(html,/DESIGN_PRESSURE/);
assert.match(html,/INSUL_THICK/);
assert.match(html,/HYDRO_PRESSURE/);
assert.match(html,/copy-source-node-fields-to-target-node-fields/);
assert.match(html,/preview-only/);
assert.match(html,/data-xml-compare-node-pair/);

console.log('xml-compare-automap-popup: all assertions passed');
