import assert from 'node:assert/strict';

import { createXmlComparePnmAutoMap } from '../xml-compare/XmlComparePnmAutoMapper.js';
import { renderXmlCompareAutoMapPopupHtml, _test as popupTest } from '../xml-compare/XmlCompareAutoMapPopup.js';

const sourceNodes=[
  {uid:'S10',levelId:'node',recordKind:'NODE',nodeNumber:'10',displayName:'10',globalX:'100',globalY:'200',globalZ:'300',tag:' Alpha  Support ',position:{x:0,y:0,z:0}},
  {uid:'S20',levelId:'node',recordKind:'NODE',nodeNumber:'20',displayName:'20',globalX:'110',globalY:'200',globalZ:'300',tag:'Guide',position:{x:10,y:0,z:0}}
];
const targetNodes=[
  {uid:'T1010',levelId:'node',recordKind:'NODE',nodeNumber:'1010',displayName:'1010',globalX:'1100',globalY:'1200',globalZ:'1300',tag:'alpha support',position:{x:1000,y:0,z:0}},
  {uid:'T1020',levelId:'node',recordKind:'NODE',nodeNumber:'1020',displayName:'1020',globalX:'1110',globalY:'1200',globalZ:'1300',tag:'Guide',position:{x:1010,y:0,z:0}}
];
const validationSource={records:sourceNodes,baseRecords:sourceNodes,levelView:{levelId:'node',fields:['globalX','globalY','globalZ','tag']}};
const validationTarget={records:targetNodes,baseRecords:targetNodes,levelView:{levelId:'node',fields:['globalX','globalY','globalZ','tag']}};
const validationMatchMap={request:{scope:'node',sourceUid:'S10',targetUid:'T1010',validationLayer:'node',toleranceMm:1},matches:[],transform:null,summary:{matchCount:1}};
const html=renderXmlCompareAutoMapPopupHtml({matchMap:validationMatchMap,source:validationSource,target:validationTarget,compareFields:['globalX','globalY','globalZ']});
assert.match(html,/Validation Panel/);
assert.doesNotMatch(html,/Matched Items/);
assert.doesNotMatch(html,/Matched Nodes/);
assert.match(html,/SRSS/);
assert.match(html,/Expected Target XYZ/);
assert.match(html,/Nearest Target Item/);
assert.match(html,/Coordinate transform nearest target/);
assert.match(html,/Tolerance: 1\.0 mm/);
assert.match(html,/1110\.000, 1200\.000, 1300\.000/);
assert.match(html,/T1020|1020/);
const fieldHtml=renderXmlCompareAutoMapPopupHtml({matchMap:validationMatchMap,source:validationSource,target:validationTarget,compareFields:['tag']});
assert.match(fieldHtml,/Validation Panel/);
assert.match(fieldHtml,/Field compare/);
assert.match(fieldHtml,/tag/);
assert.match(fieldHtml,/alpha support/);
assert.doesNotMatch(fieldHtml,/Matched Items/);
const validationRows=popupTest.matchedRows(validationMatchMap,validationSource.records,validationTarget.records);
assert.equal(validationRows.length,2);
assert.ok(popupTest.scopedFields(validationRows,'node').includes('globalX'));
assert.equal(popupTest.fieldBlock('node','globalX'),'GlobalCoordinateBlock');
assert.equal(popupTest.fieldScope('tag'),'node');

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
const transferHtml=renderXmlCompareAutoMapPopupHtml({matchMap:request,source:{records:[sourceNode],baseRecords:[sourceNode,...sourceEvidence]},target:{records:[targetNode],baseRecords:[targetNode,...targetEvidence]}});
assert.match(transferHtml,/Auto Map Review/);
assert.match(transferHtml,/Validation Panel/);
assert.match(transferHtml,/Node-owned blocks/);
assert.match(transferHtml,/Add to selection/);
assert.match(transferHtml,/Selected node block\(s\)/);
assert.match(transferHtml,/data-xml-compare-transfer-pair/);
assert.match(transferHtml,/DerivedCoordinateBlock/);
assert.match(transferHtml,/RestraintsBlock/);
assert.match(transferHtml,/DisplacementsBlock/);
assert.match(transferHtml,/Source available \/ Target available/);
assert.match(transferHtml,/Source available \/ Target missing/);
assert.doesNotMatch(transferHtml,/MiscBlock/);

const src35To={uid:'S-30-35-TO',levelId:'node',lineNo:'LINENO1',elementKey:'30->35',nodeNumber:'35',role:'TO',position:{x:0,y:0,z:0},points:[{x:0,y:0,z:0}]};
const src35From={uid:'S-35-70-FROM',levelId:'node',lineNo:'LINENO1',elementKey:'35->70',nodeNumber:'35',role:'FROM',position:{x:25,y:0,z:0},points:[{x:25,y:0,z:0}]};
const tgt1030To={uid:'T-1020-1030-TO',levelId:'node',lineNo:'LINENO1',elementKey:'1020->1030',nodeNumber:'1030',role:'TO',position:{x:0,y:0,z:0},points:[{x:0,y:0,z:0}]};
const tgt1030From={uid:'T-1030-1040-FROM',levelId:'node',lineNo:'LINENO1',elementKey:'1030->1040',nodeNumber:'1030',role:'FROM',position:{x:25,y:0,z:0},points:[{x:25,y:0,z:0}]};
const physicalRow={index:6,source:src35From,target:tgt1030From,sourceFields:{globalX:'23227.580'},targetFields:{globalX:'123227.602'},delta:{dx:0,dy:0,dz:25,srss:25,maxAbs:25},match:{}};
const physicalSourceEvidence=[
  {uid:'S-30-35-TO-R',levelId:'nodeEvidence',recordKind:'NODE_EVIDENCE',lineNo:'LINENO1',elementKey:'30->35',nodeNumber:'35',role:'TO',blockName:'RestraintsBlock',evidenceKind:'RestraintsBlock',itemCount:3,compactFields:{TYPE:'17,1,3'}},
  {uid:'S-35-70-FROM-R',levelId:'nodeEvidence',recordKind:'NODE_EVIDENCE',lineNo:'LINENO1',elementKey:'35->70',nodeNumber:'35',role:'FROM',blockName:'RestraintsBlock',evidenceKind:'RestraintsBlock',itemCount:0,compactFields:{}},
  {uid:'S-35-70-FROM-D',levelId:'nodeEvidence',recordKind:'NODE_EVIDENCE',lineNo:'LINENO1',elementKey:'35->70',nodeNumber:'35',role:'FROM',blockName:'DerivedCoordinateBlock',evidenceKind:'DerivedCoordinateBlock',itemCount:4,compactFields:{globalX:'23227.580'}}
];
const physicalTargetEvidence=[
  {uid:'T-1020-1030-TO-R',levelId:'nodeEvidence',recordKind:'NODE_EVIDENCE',lineNo:'LINENO1',elementKey:'1020->1030',nodeNumber:'1030',role:'TO',blockName:'RestraintsBlock',evidenceKind:'RestraintsBlock',itemCount:2,compactFields:{TYPE:'17,3'}},
  {uid:'T-1030-1040-FROM-R',levelId:'nodeEvidence',recordKind:'NODE_EVIDENCE',lineNo:'LINENO1',elementKey:'1030->1040',nodeNumber:'1030',role:'FROM',blockName:'RestraintsBlock',evidenceKind:'RestraintsBlock',itemCount:0,compactFields:{}},
  {uid:'T-1030-1040-FROM-D',levelId:'nodeEvidence',recordKind:'NODE_EVIDENCE',lineNo:'LINENO1',elementKey:'1030->1040',nodeNumber:'1030',role:'FROM',blockName:'DerivedCoordinateBlock',evidenceKind:'DerivedCoordinateBlock',itemCount:4,compactFields:{globalX:'123227.602'}}
];
const physicalCases=popupTest.nodeTransferCases([physicalRow],{records:[src35From],baseRecords:[src35To,src35From,...physicalSourceEvidence]},{records:[tgt1030From],baseRecords:[tgt1030To,tgt1030From,...physicalTargetEvidence]});
const restraintCase=physicalCases.find((item)=>item.blockName==='RestraintsBlock');
assert.equal(restraintCase.sourceElement,'30->35');
assert.equal(restraintCase.sourceRole,'TO');
assert.equal(restraintCase.targetElement,'1020->1030');
assert.equal(restraintCase.targetRole,'TO');
assert.equal(restraintCase.resolution,'physical-node-block-occurrence');
const physicalPlan=popupTest.nodeTransferPlan([physicalRow],[],['RestraintsBlock'],physicalCases);
assert.equal(physicalPlan.length,1);
assert.equal(physicalPlan[0].sourceElement,'30->35');
assert.equal(physicalPlan[0].sourceRole,'TO');
assert.equal(physicalPlan[0].targetElement,'1020->1030');
assert.equal(physicalPlan[0].targetRole,'TO');
assert.deepEqual(physicalPlan[0].selectedBlocks,['RestraintsBlock']);
assert.ok(physicalPlan[0].approvedCaseIds[0].includes('30->35:35->1020->1030:1030:RestraintsBlock'));
const noBlocks=renderXmlCompareAutoMapPopupHtml({matchMap:request,source:{records:[sourceNode]},target:{records:[targetNode]}});
assert.match(noBlocks,/No affected node-owned block cases found|No node-owned blocks found for selected node identity/);
console.log('xml-compare-automap-popup: all assertions passed');
