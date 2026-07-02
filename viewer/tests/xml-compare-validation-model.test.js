import assert from 'node:assert/strict';

import {
  applyAnchorTransform,
  createAnchorTransform,
  createXmlCompareValidationModel,
  detectCoordinateFieldGroup,
  findNearestTargetRecord,
  normalizeToleranceMm,
  normalizeValidationLayer,
  readRecordField,
  recordCoordinate
} from '../xml-compare/XmlCompareValidationModel.js';

const sourceNodes=[
  {uid:'S10',levelId:'node',recordKind:'NODE',nodeNumber:'10',displayName:'10',globalX:'100',globalY:'200',globalZ:'300',tag:' Alpha  Support '},
  {uid:'S20',levelId:'node',recordKind:'NODE',nodeNumber:'20',displayName:'20',globalX:'110',globalY:'200',globalZ:'300',tag:'guide support'}
];
const targetNodes=[
  {uid:'T1010',levelId:'node',recordKind:'NODE',nodeNumber:'1010',displayName:'1010',globalX:'1100',globalY:'1200',globalZ:'1300',tag:'alpha support'},
  {uid:'T1020',levelId:'node',recordKind:'NODE',nodeNumber:'1020',displayName:'1020',globalX:'1110',globalY:'1200',globalZ:'1300',tag:'GUIDE   SUPPORT'}
];
const source={records:[sourceNodes[0]],baseRecords:sourceNodes,levelView:{levelId:'node'}};
const target={records:[targetNodes[0]],baseRecords:targetNodes,levelView:{levelId:'node'}};
const matchMap={request:{sourceUid:'S10',targetUid:'T1010'}};

assert.equal(normalizeValidationLayer('evidence'),'nodeEvidence');
assert.equal(normalizeValidationLayer('line'),'lineBlock');
assert.equal(normalizeToleranceMm('bad'),1);
assert.equal(readRecordField({attributes:{GLOBAL_X:'1'}},'GLOBAL_X'),'1');
assert.ok(detectCoordinateFieldGroup(['globalX','globalY','globalZ']));
assert.ok(detectCoordinateFieldGroup(['globalY','globalX','globalZ']));
assert.equal(detectCoordinateFieldGroup(['DIAMETER','WALL_THICK']),null);
const group=detectCoordinateFieldGroup(['globalX','globalY','globalZ']);
assert.deepEqual(recordCoordinate(sourceNodes[0],group),{x:100,y:200,z:300});
const transform=createAnchorTransform({sourceAnchor:sourceNodes[0],targetAnchor:targetNodes[0],coordinateGroup:group});
assert.deepEqual(transform.offset,{x:1000,y:1000,z:1000});
assert.deepEqual(applyAnchorTransform({x:110,y:200,z:300},transform),{x:1110,y:1200,z:1300});
const nearest=findNearestTargetRecord({expectedCoordinate:{x:1110,y:1200,z:1300},targetRecords:targetNodes,coordinateGroup:group});
assert.equal(nearest.record.uid,'T1020');
assert.equal(nearest.srss,0);
const model=createXmlCompareValidationModel({source,target,matchMap,compareFields:['globalX','globalY','globalZ'],validationLayer:'node',toleranceMm:1});
assert.equal(model.mode,'coordinate-transform-nearest');
assert.equal(model.anchor.sourceUid,'S10');
assert.equal(model.anchor.targetUid,'T1010');
assert.equal(model.rows.length,2);
assert.equal(model.rows[0].targetUid,'T1010');
assert.equal(model.rows[0].srss,0);
assert.equal(model.rows[1].targetUid,'T1020');
assert.equal(model.rows[1].srss,0);
assert.equal(model.summary.sourceCount,2);
assert.equal(model.summary.validatedCount,2);
assert.equal(model.summary.okCount,2);
const missingSource={records:[sourceNodes[0]],baseRecords:[...sourceNodes,{uid:'S30',levelId:'node',recordKind:'NODE',displayName:'30'}],levelView:{levelId:'node'}};
const missingModel=createXmlCompareValidationModel({source:missingSource,target,matchMap,compareFields:['globalX','globalY','globalZ'],validationLayer:'node'});
assert.equal(missingModel.rows.find((row)=>row.sourceUid==='S30').status,'MISSING_SOURCE_COORDINATE');
const noAnchor=createXmlCompareValidationModel({source,target,matchMap:{request:{}},compareFields:['globalX','globalY','globalZ'],validationLayer:'node'});
assert.equal(noAnchor.mode,'field-compare');
assert.ok(noAnchor.diagnostics.includes('ANCHOR_MISSING'));
const duplicateTarget={records:[targetNodes[0]],baseRecords:[targetNodes[0]],levelView:{levelId:'node'}};
const duplicateModel=createXmlCompareValidationModel({source,target:duplicateTarget,matchMap,compareFields:['globalX','globalY','globalZ'],validationLayer:'node',toleranceMm:9999});
assert.equal(duplicateModel.summary.duplicateNearestTargetCount,1);
const strictTarget={records:[targetNodes[0]],baseRecords:[targetNodes[0],{...targetNodes[1],globalX:'1115'}],levelView:{levelId:'node'}};
const strictModel=createXmlCompareValidationModel({source,target:strictTarget,matchMap,compareFields:['globalX','globalY','globalZ'],validationLayer:'node',toleranceMm:1});
assert.equal(strictModel.rows.find((row)=>row.sourceUid==='S20').status,'MISMATCH');
const looseModel=createXmlCompareValidationModel({source,target:strictTarget,matchMap,compareFields:['globalX','globalY','globalZ'],validationLayer:'node',toleranceMm:6});
assert.equal(looseModel.rows.find((row)=>row.sourceUid==='S20').status,'OK');
const fieldModel=createXmlCompareValidationModel({source,target,matchMap,compareFields:['tag'],validationLayer:'node'});
assert.equal(fieldModel.mode,'field-compare');
assert.equal(fieldModel.rows[0].status,'OK');
assert.equal(fieldModel.rows[0].valueType,'text');
console.log('xml-compare-validation-model: all assertions passed');
