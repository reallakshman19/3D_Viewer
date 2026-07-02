import assert from 'node:assert/strict';

import { renderXmlCompareAutoMapPopupHtml, _test as popupTest } from '../xml-compare/XmlCompareAutoMapPopup.js';

const sourceNodes=[
  {uid:'S10',levelId:'node',recordKind:'NODE',nodeNumber:'10',displayName:'10',globalX:'100',globalY:'200',globalZ:'300',tag:' Alpha  Support ',position:{x:0,y:0,z:0}},
  {uid:'S20',levelId:'node',recordKind:'NODE',nodeNumber:'20',displayName:'20',globalX:'110',globalY:'200',globalZ:'300',tag:'Guide',position:{x:10,y:0,z:0}}
];
const targetNodes=[
  {uid:'T1010',levelId:'node',recordKind:'NODE',nodeNumber:'1010',displayName:'1010',globalX:'1100',globalY:'1200',globalZ:'1300',tag:'alpha support',position:{x:1000,y:0,z:0}},
  {uid:'T1020',levelId:'node',recordKind:'NODE',nodeNumber:'1020',displayName:'1020',globalX:'1110',globalY:'1200',globalZ:'1300',tag:'Guide',position:{x:1010,y:0,z:0}}
];
const source={records:sourceNodes,baseRecords:sourceNodes,levelView:{levelId:'node',fields:['globalX','globalY','globalZ','tag']}};
const target={records:targetNodes,baseRecords:targetNodes,levelView:{levelId:'node',fields:['globalX','globalY','globalZ','tag']}};
const matchMap={request:{scope:'node',sourceUid:'S10',targetUid:'T1010',validationLayer:'node',toleranceMm:1},matches:[],transform:null,summary:{matchCount:1}};
const html=renderXmlCompareAutoMapPopupHtml({matchMap,source,target,compareFields:['globalX','globalY','globalZ']});
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
const fieldHtml=renderXmlCompareAutoMapPopupHtml({matchMap,source,target,compareFields:['tag']});
assert.match(fieldHtml,/Validation Panel/);
assert.match(fieldHtml,/Field compare/);
assert.match(fieldHtml,/tag/);
assert.match(fieldHtml,/alpha support/);
assert.doesNotMatch(fieldHtml,/Matched Items/);
const rows=popupTest.matchedRows(matchMap,source.records,target.records);
assert.equal(rows.length,2);
assert.ok(popupTest.scopedFields(rows,'node').includes('globalX'));
assert.equal(popupTest.fieldBlock('node','globalX'),'GlobalCoordinateBlock');
assert.equal(popupTest.fieldScope('tag'),'node');
console.log('xml-compare-automap-popup: all assertions passed');
