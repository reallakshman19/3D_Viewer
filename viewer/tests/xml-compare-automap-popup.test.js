import assert from 'node:assert/strict';

import { createXmlComparePnmAutoMap } from '../xml-compare/XmlComparePnmAutoMapper.js';
import { renderXmlCompareAutoMapPopupHtml, _test as popupTest } from '../xml-compare/XmlCompareAutoMapPopup.js';

const sourceNode={uid:'S-N10',levelId:'node',lineNo:'LINENO1',elementKey:'10->20',nodeNumber:'10',role:'FROM',displayName:'FROM 10',position:{x:0,y:0,z:0},points:[{x:0,y:0,z:0}]};
const targetNode={uid:'T-N100',levelId:'node',lineNo:'LINENO1',elementKey:'100->200',nodeNumber:'100',role:'FROM',displayName:'FROM 100',position:{x:1,y:0,z:0},points:[{x:1,y:0,z:0}]};
const sourceEvidence=[
  {uid:'S-E1',levelId:'nodeEvidence',recordKind:'NODE_EVIDENCE',lineNo:'LINENO1',elementKey:'10->20',nodeNumber:'10',role:'FROM',blockName:'DerivedCoordinateBlock',evidenceKind:'DerivedCoordinateBlock',itemCount:4,compactFields:{FROM_GLOBAL_X:'1'}},
  {uid:'S-E2',levelId:'nodeEvidence',recordKind:'NODE_EVIDENCE',lineNo:'LINENO1',elementKey:'10->20',nodeNumber:'10',role:'FROM',blockName:'RestraintsBlock',evidenceKind:'RestraintsBlock',itemCount:3,compactFields:{TYPE:'7'}},
  {uid:'S-E3',levelId:'nodeEvidence',recordKind:'NODE_EVIDENCE',lineNo:'LINENO1',elementKey:'10->20',nodeNumber:'10',role:'FROM',blockName:'DisplacementsBlock',evidenceKind:'DisplacementsBlock',itemCount:0,compactFields:{}},
  {uid:'S-E4',levelId:'nodeEvidence',recordKind:'NODE_EVIDENCE',lineNo:'LINENO1',elementKey:'20->30',nodeNumber:'10',role:'FROM',blockName:'MiscBlock',evidenceKind:'MiscBlock',itemCount:1,compactFields:{NOTE:'other element'}}
];
const targetEvidence=[
  {uid:'T-E1',levelId:'nodeEvidence',recordKind:'NODE_EVIDENCE',lineNo:'LINENO1',elementKey:'100->200',nodeNumber:'100',role:'FROM',blockName:'DerivedCoordinateBlock',evidenceKind:'DerivedCoordinateBlock',itemCount:4,compactFields:{FROM_GLOBAL_X:'2'}},
  {uid:'T-E2',levelId:'nodeEvidence',recordKind:'NODE_EVIDENCE',lineNo:'LINENO1',elementKey:'100->200',nodeNumber:'100',role:'FROM',blockName:'RestraintsBlock',evidenceKind:'RestraintsBlock',itemCount:2,compactFields:{TYPE:'7'}}
];
const matchMap=createXmlComparePnmAutoMap({sourceRecords:[sourceNode],targetRecords:[targetNode]});
const request={...matchMap,request:{scope:'node',sourceUid:sourceNode.uid,targetUid:targetNode.uid}};
const rows=popupTest.matchedRows(request,[sourceNode],[targetNode]);
assert.equal(rows.length,1);
const cases=popupTest.nodeTransferCases(rows,{records:[sourceNode],baseRecords:[sourceNode,...sourceEvidence]},{records:[targetNode],baseRecords:[targetNode,...targetEvidence]});
assert.deepEqual(cases.map((item)=>item.blockName),['DerivedCoordinateBlock','RestraintsBlock','DisplacementsBlock']);
assert.equal(cases.find((item)=>item.blockName==='DerivedCoordinateBlock').status,'replace');
assert.equal(cases.find((item)=>item.blockName==='RestraintsBlock').status,'replace');
assert.equal(cases.find((item)=>item.blockName==='DisplacementsBlock').status,'add');
assert.ok(!cases.some((item)=>item.blockName==='MiscBlock'));
const plan=popupTest.nodeTransferPlan(rows,[],['RestraintsBlock'],cases);
assert.equal(plan.length,1);
assert.equal(plan[0].sourceElement,'10->20');
assert.equal(plan[0].targetElement,'100->200');
assert.deepEqual(plan[0].selectedBlocks,['RestraintsBlock']);
assert.ok(plan[0].approvedCaseIds.some((id)=>id.includes('RestraintsBlock')));
const html=renderXmlCompareAutoMapPopupHtml({matchMap:request,source:{records:[sourceNode],baseRecords:[sourceNode,...sourceEvidence]},target:{records:[targetNode],baseRecords:[targetNode,...targetEvidence]}});
assert.match(html,/Auto Map Review/);
assert.match(html,/Matched Items/);
assert.match(html,/Node-owned blocks/);
assert.match(html,/Add to selection/);
assert.match(html,/Selected node block\(s\)/);
assert.match(html,/data-xml-compare-transfer-pair/);
assert.match(html,/Select all/);
assert.match(html,/Select none/);
assert.match(html,/DerivedCoordinateBlock/);
assert.match(html,/RestraintsBlock/);
assert.match(html,/DisplacementsBlock/);
assert.match(html,/Source available \/ Target available/);
assert.match(html,/Source available \/ Target missing/);
assert.doesNotMatch(html,/MiscBlock/);
const noBlocks=renderXmlCompareAutoMapPopupHtml({matchMap:request,source:{records:[sourceNode]},target:{records:[targetNode]}});
assert.match(noBlocks,/No node-owned blocks found for selected node identity/);
console.log('xml-compare-automap-popup: all assertions passed');
