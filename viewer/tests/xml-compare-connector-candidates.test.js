import assert from 'node:assert/strict';
import { createXmlCompareConnectorCandidateModel } from '../xml-compare/XmlCompareConnectorCandidateModel.js';
import { createXmlCompareWorkspaceModel } from '../xml-compare/XmlCompareWorkspaceModel.js';
import { renderXmlCompareGraphConnectorLaneHtml } from '../xml-compare/XmlCompareGraphConnectorLane.js';

const source={
  levelView:{levelId:'node',keyField:'dtxrPs',displayField:'nodeNumber',fields:['nodeNumber','lineNo','dtxrPs','dtxrPos']},
  records:[
    {uid:'s-1',nodeNumber:'10',lineNo:'L-100',dtxrPs:'PS-100',dtxrPos:'REST'},
    {uid:'s-2',nodeNumber:'20',lineNo:'L-100',dtxrPs:'PS-200',dtxrPos:'GUIDE'}
  ]
};
const target={
  levelView:{levelId:'node',keyField:'dtxrPs',displayField:'nodeNumber',fields:['nodeNumber','lineNo','dtxrPs','dtxrPos']},
  records:[
    {uid:'t-1',nodeNumber:'110',lineNo:'L-900',dtxrPs:'ps-100',dtxrPos:'REST'},
    {uid:'t-2',nodeNumber:'120',lineNo:'L-900',dtxrPs:'PS-300',dtxrPos:'ANCHOR'}
  ]
};
const model=createXmlCompareConnectorCandidateModel({source,target});
assert.equal(model.schema,'xml-compare-connector-candidate-model/v2');
assert.equal(model.summary.candidateCount,1);
assert.equal(model.candidates[0].sourceUid,'s-1');
assert.equal(model.candidates[0].targetUid,'t-1');
assert.equal(model.candidates[0].sourceField,'dtxrPs');
assert.equal(model.candidates[0].type,'CANDIDATE');

const workspace=createXmlCompareWorkspaceModel({
  fileA:{name:'A.xml',size:10},
  textA:'<CAESARII><PIPINGMODEL><PIPINGELEMENT FROM_NODE="10" TO_NODE="20"><DTXR_PS>PS-100</DTXR_PS></PIPINGELEMENT></PIPINGMODEL></CAESARII>',
  fileB:{name:'B.xml',size:10},
  textB:'<CAESARII><PIPINGMODEL><PIPINGELEMENT FROM_NODE="110" TO_NODE="120"><DTXR_PS>PS-100</DTXR_PS></PIPINGELEMENT></PIPINGMODEL></CAESARII>',
  canvasState:{levelViews:{source:{levelId:'node',keyField:'dtxrPs'},target:{levelId:'node',keyField:'dtxrPs'}}}
});
assert.equal(workspace.connectorCandidates.summary.candidateCount,1);
assert.ok(workspace.logs.some((entry)=>entry.code==='XML-COMPARE-CANDIDATES'));

const html=renderXmlCompareGraphConnectorLaneHtml({connectorCandidates:model});
assert.match(html,/Candidate/);
assert.match(html,/PS-100/);
assert.match(html,/CAND/);

console.log('xml-compare-connector-candidates: all assertions passed');
