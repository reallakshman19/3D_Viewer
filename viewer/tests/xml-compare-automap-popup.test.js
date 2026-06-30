import assert from 'node:assert/strict';

import { createXmlCompareLineNodeHierarchy } from '../xml-compare/XmlCompareLineNodeHierarchy.js';
import { createXmlComparePnmAutoMap } from '../xml-compare/XmlComparePnmAutoMapper.js';
import { renderXmlCompareAutoMapPopupHtml, _test as popupTest } from '../xml-compare/XmlCompareAutoMapPopup.js';

const sourceHierarchy=createXmlCompareLineNodeHierarchy([
  {uid:'SRC-1',lineNo:'L-1',points:[{x:0,y:0,z:0}],position:{x:0,y:0,z:0},attributes:{from:'10',to:'20',Temperature1:'120',Pressure1:'700','COMPONENT-ATTRIBUTE2':'120','COMPONENT-ATTRIBUTE1':'700',TEMP_EXP_C1:'120',PRESSURE1:'700',DESIGN_PRESSURE:'900',INSUL_THICK:'50',MATERIAL_NAME:'A106 B',PIPELINE_REFERENCE:'PIPE-A'}},
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
assert.equal(childFields.MATERIAL_NAME,'A106 B');
assert.equal(childFields.from,undefined);
assert.equal(childFields.to,undefined);
assert.equal(popupTest.isTransferableField('from'),false);
assert.equal(popupTest.isTransferableField('to'),false);
assert.equal(popupTest.fieldBlock('Pressure1'),'ProcessBlock');
assert.equal(popupTest.fieldBlock('INSUL_THICK'),'SectionDimensionBlock');
assert.equal(popupTest.fieldBlock('MATERIAL_NAME'),'MaterialBlock');

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
assert.match(html,/Source node block fields/);
assert.match(html,/select multiple/);
assert.match(html,/ProcessBlock/);
assert.match(html,/SectionDimensionBlock/);
assert.match(html,/MaterialBlock/);
assert.match(html,/Temperature1/);
assert.match(html,/Pressure1/);
assert.match(html,/DESIGN_PRESSURE/);
assert.match(html,/INSUL_THICK/);
assert.match(html,/HYDRO_PRESSURE/);
assert.match(html,/copy-source-node-block-fields-to-target-node-block-fields/);
assert.match(html,/all-matched-node-pairs/);
assert.match(html,/preview-only/);
assert.match(html,/data-xml-compare-node-pair/);
assert.doesNotMatch(html,/<option value="from">from<\/option>/);
assert.doesNotMatch(html,/<option value="to">to<\/option>/);

const fields=popupTest.fieldNames(popupTest.matchedRows(matchMapWithRequest,sourceHierarchy.records,targetHierarchy.records));
assert.ok(fields.includes('Temperature1'));
assert.ok(fields.includes('DESIGN_PRESSURE'));
assert.ok(!fields.includes('from'));
assert.ok(!fields.includes('to'));
const plan=popupTest.transferPlan(popupTest.matchedRows(matchMapWithRequest,sourceHierarchy.records,targetHierarchy.records),fields);
assert.equal(plan.length,2);
assert.equal(plan[0].targetNode,'1000');
assert.equal(plan[0].fields.Temperature1,'120');
assert.ok(plan[0].selectedBlocks.includes('ProcessBlock'));

console.log('xml-compare-automap-popup: all assertions passed');
