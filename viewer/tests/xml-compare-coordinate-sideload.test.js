import assert from 'node:assert/strict';

import { createXmlCompareValidationModel } from '../xml-compare/XmlCompareValidationModel.js';
import { applyXmlCompareSideload } from '../xml-compare/XmlCompareSideloadEnricher.js';
import { inputXmlToCategorizedInputXml } from '../xml-compare/CategorizedInputXmlConverter.js';
import { createCategorizedInputXmlCanvasModel } from '../xml-compare/XmlCompareCategorizedInputXmlCanvasBuilder.js';
import { deltaComponent, deltaVectorFromElement, isCaesarUnsetNumber, parseCoordinateSideloadTable, parseCoordinateValue, solveElementCoordinates } from '../xml-compare/XmlCompareCoordinateSideload.js';

const near=(actual,expected,tol=0.01)=>assert.ok(Math.abs(Number(actual)-expected)<=tol,`${actual} != ${expected}`);
const table4='NodeNumber GlobalX GlobalY GlobalZ\n10    23227.580 mm.    3257.150 mm.    -19800.000 mm.';
const elements=[
  {fromNode:'10',toNode:'20',DELTA_X:'-1.010100',DELTA_Y:'-1.010100',DELTA_Z:'-107.999992'},
  {fromNode:'20',toNode:'30',DELTA_X:'-1.010100',DELTA_Y:'-1.010100',DELTA_Z:'-992.000000'},
  {fromNode:'30',toNode:'200',DELTA_X:'-1.010100',DELTA_Y:'342.400909',DELTA_Z:'-1.010100'},
  {fromNode:'200',toNode:'205',DELTA_X:'-1213.787109',DELTA_Y:'-1.010100',DELTA_Z:'-1.010100'},
  {fromNode:'255',toNode:'260',DELTA_X:'0.000000',DELTA_Y:'-0.000488',DELTA_Z:'-271.601563'}
];
const parsed=parseCoordinateSideloadTable(table4);
assert.equal(parsed.coordinates.length,1);
assert.equal(parsed.coordinates[0].node,'10');
near(parsed.coordinates[0].x,23227.58);
assert.equal(parseCoordinateSideloadTable('Node,GlobalX,GlobalY,GlobalZ\n10,23227.580 mm.,3257.150 mm.,-19800.000 mm.').coordinates.length,1);
assert.equal(parseCoordinateSideloadTable('10\t23227.580 mm.\t3257.150 mm.\t-19800.000 mm.').coordinates.length,1);
assert.equal(parseCoordinateValue('23227.580 mm.'),23227.58);
assert.equal(isCaesarUnsetNumber('-1.010100'),true);
assert.equal(deltaComponent('-1.010100'),0);
assert.equal(deltaComponent('0.000000'),0);
assert.equal(deltaComponent('-0.000488'),-0.000488);
assert.deepEqual(deltaVectorFromElement(elements[4]),{x:0,y:-0.000488,z:-271.601563});
const solved=solveElementCoordinates({elements,originCoordinates:parsed.coordinates,toleranceMm:0.01});
near(solved.solvedNodes['20'].z,-19908);
near(solved.solvedNodes['30'].z,-20900);
near(solved.solvedNodes['200'].y,3599.551,0.001);
near(solved.solvedNodes['205'].x,22013.793,0.001);
assert.ok(solved.diagnostics.some((d)=>d.code==='coordinate_unresolved_element'));
const reverse=solveElementCoordinates({elements:[elements[4]],originCoordinates:[{node:'260',x:1,y:2,z:3}],toleranceMm:0.01});
near(reverse.solvedNodes['255'].x,1);
near(reverse.solvedNodes['255'].y,2.000488,0.000001);
near(reverse.solvedNodes['255'].z,274.601563,0.000001);
assert.equal(parseCoordinateSideloadTable('10 1 2 3\n10 1 2 3').diagnostics[0].code,'coordinate_duplicate_node');
assert.equal(parseCoordinateSideloadTable('10 1 2 3\n10 1 2 4').diagnostics[0].code,'coordinate_conflict');
const target=solveElementCoordinates({elements:[{fromNode:'1000',toNode:'1010',DELTA_Z:'-107.999992'}],originCoordinates:[{node:'1000',x:123227.602,y:3257.15,z:19800}],toleranceMm:0.01});
near(target.solvedNodes['1010'].z,19692);
const xml=`<CAESARII><PIPINGMODEL>${elements.slice(0,4).map((e)=>`<PIPINGELEMENT FROM_NODE="${e.fromNode}" TO_NODE="${e.toNode}" DELTA_X="${e.DELTA_X}" DELTA_Y="${e.DELTA_Y}" DELTA_Z="${e.DELTA_Z}" />`).join('')}<PIPINGELEMENT FROM_NODE="999" TO_NODE="1000"><OriginalElement><![CDATA[<PIPINGELEMENT FROM_NODE="1" TO_NODE="2" />]]></OriginalElement></PIPINGELEMENT></PIPINGMODEL></CAESARII>`;
const enriched=applyXmlCompareSideload(xml,{coordinateText:table4});
assert.match(enriched.xmlText,/FROM_GLOBAL_X="23227\.580"/);
assert.match(enriched.xmlText,/FROM_GLOBAL_Y="3257\.150"/);
assert.match(enriched.xmlText,/FROM_GLOBAL_Z="-19800\.000"/);
assert.match(enriched.xmlText,/TO_GLOBAL_X="23227\.580"/);
assert.match(enriched.xmlText,/TO_GLOBAL_Y="3257\.150"/);
assert.match(enriched.xmlText,/TO_GLOBAL_Z="-19908\.000"/);
assert.match(enriched.xmlText,/GLOBAL_COORD_BASIS_NODE="10"/);
assert.ok(enriched.report.diagnostics.some((d)=>d.code==='coordinate_unresolved_element'));
const categorized=inputXmlToCategorizedInputXml(enriched.xmlText,{sourceName:'table4.xml'});
assert.match(categorized,/<DerivedCoordinateBlock>[\s\S]*<GLOBAL_COORD_BASIS_NODE>10<\/GLOBAL_COORD_BASIS_NODE>/);
assert.match(categorized,/<UnmappedAttribute name="FROM_GLOBAL_X">23227\.580<\/UnmappedAttribute>/);
assert.match(categorized,/<UnmappedAttribute name="TO_GLOBAL_Z">-19908\.000<\/UnmappedAttribute>/);
const model=createCategorizedInputXmlCanvasModel({sourceName:'table4.xml',xmlText:categorized,side:'source'});
const node20=model.records.find((r)=>r.levelId==='node'&&r.nodeNumber==='20'&&r.role==='TO');
assert.equal(node20.globalX,'23227.580');
assert.equal(node20.globalY,'3257.150');
assert.equal(node20.globalZ,'-19908.000');
const targetCategorized=inputXmlToCategorizedInputXml(applyXmlCompareSideload('<CAESARII><PIPINGMODEL><PIPINGELEMENT FROM_NODE="1000" TO_NODE="1010" DELTA_Z="-107.999992" /></PIPINGMODEL></CAESARII>',{coordinateText:'1000 123227.602 mm. 3257.150 mm. 19800.000 mm.'}).xmlText,{sourceName:'target.xml'});
const targetModel=createCategorizedInputXmlCanvasModel({sourceName:'target.xml',xmlText:targetCategorized,side:'target'});
const sourceAnchor=model.records.find((r)=>r.levelId==='node'&&r.nodeNumber==='10');
const targetAnchor=targetModel.records.find((r)=>r.levelId==='node'&&r.nodeNumber==='1000');
const validation=createXmlCompareValidationModel({source:{baseRecords:model.records,records:model.records,levelView:{levelId:'node'}},target:{baseRecords:targetModel.records,records:targetModel.records,levelView:{levelId:'node'}},matchMap:{request:{sourceUid:sourceAnchor.uid,targetUid:targetAnchor.uid}},compareFields:['globalX','globalY','globalZ'],validationLayer:'node'});
assert.equal(validation.mode,'coordinate-transform-nearest');
assert.ok(validation.rows.length>=2);
console.log('xml-compare-coordinate-sideload: all assertions passed');
