import assert from 'node:assert/strict';
import { createXmlCompareConnectorCandidateModel } from '../xml-compare/XmlCompareConnectorCandidateModel.js';

function side(levelId,records,keyField,displayField){
  return {levelView:{levelId,keyField,displayField,fields:Object.keys(records[0]||{}),hierarchyProfile:{levels:[{levelId,records}]}},records:[]};
}

const lineA=side('line',[{uid:'la',lineNo:'/L1',branchName:'/L1',pipingClass:'31441C4',rating:'31441'}],'pipingClass','lineNo');
const lineB=side('line',[{uid:'lb',lineNo:'/OTHER',branchName:'/OTHER',pipingClass:'31441C4',rating:'31441'}],'pipingClass','lineNo');
const lineModel=createXmlCompareConnectorCandidateModel({source:lineA,target:lineB});
assert.equal(lineModel.summary.sourceLevel,'line');
assert.equal(lineModel.summary.candidateCount,1);
assert.equal(lineModel.candidates[0].sourceField,'pipingClass');

const elementA=side('element',[{uid:'ea',elementKey:'400->10',fromNode:'400',toNode:'10',deltaX:'1258.800049',materialName:'A106 B'}],'elementKey','elementKey');
const elementB=side('element',[{uid:'eb',elementKey:'400->10',fromNode:'400',toNode:'10',deltaX:'1258.800049',materialName:'A106 B'}],'elementKey','elementKey');
const elementModel=createXmlCompareConnectorCandidateModel({source:elementA,target:elementB});
assert.equal(elementModel.summary.candidateCount,1);
assert.equal(elementModel.candidates[0].sourceField,'elementKey');

const nodeA=side('node',[{uid:'na',elementKey:'400->10',nodeNumber:'10',role:'TO',globalX:'23227.580',temperature2:'95.377998'}],'elementKey','nodeNumber');
const nodeB=side('node',[{uid:'nb',elementKey:'400->10',nodeNumber:'10',role:'TO',globalX:'23227.580',temperature2:'95.377998'}],'elementKey','nodeNumber');
const nodeModel=createXmlCompareConnectorCandidateModel({source:nodeA,target:nodeB});
assert.equal(nodeModel.summary.candidateCount,1);
assert.equal(nodeModel.candidates[0].sourceField,'elementKey');

const evidenceA=side('evidence',[{uid:'va',elementKey:'400->10',nodeNumber:'10',role:'TO',evidenceKind:'RestraintsBlock',itemCount:'1'}],'evidenceKind','nodeNumber');
const evidenceB=side('evidence',[{uid:'vb',elementKey:'400->10',nodeNumber:'10',role:'TO',evidenceKind:'RestraintsBlock',itemCount:'1'}],'evidenceKind','nodeNumber');
const evidenceModel=createXmlCompareConnectorCandidateModel({source:evidenceA,target:evidenceB});
assert.equal(evidenceModel.summary.candidateCount,1);
assert.equal(evidenceModel.candidates[0].sourceField,'evidenceKind');
assert.equal(evidenceModel.summary.sourceRecordCount,1);
assert.equal(evidenceModel.summary.targetRecordCount,1);

console.log('xml-compare-categorized-level-candidates: all assertions passed');
