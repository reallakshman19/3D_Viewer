import assert from 'node:assert/strict';
import { detectXmlCompareProfile, XML_COMPARE_PROFILE_TYPES } from '../xml-compare/XmlCompareProfileDetector.js';
import { createXmlCompareLoadIntake } from '../xml-compare/XmlCompareLoadIntake.js';
import { createXmlCompareCanvasLevelModel } from '../xml-compare/XmlCompareCanvasLevelModel.js';
import { renderXmlCompareGraphCanvasHtml } from '../xml-compare/XmlCompareGraphCanvas.js';
import { createCategorizedInputXmlCanvasModel } from '../xml-compare/XmlCompareCategorizedInputXmlCanvasBuilder.js';

const xml=`<?xml version="1.0" encoding="UTF-8"?>
<CategorizedInputXML schema="categorized-inputxml/v3" sourceName="BM_CII_INPUT_SOURCE.xml">
 <Line id="LINENO1">
  <LineBlock><Branchname>BRANCH-1</Branchname><LineNo>LINENO1</LineNo><PipingClass>31441C4</PipingClass><Rating>31441</Rating></LineBlock>
  <LineBlocks><TemperatureBlock><Temperature1>120</Temperature1></TemperatureBlock><PressureBlock><Pressure1>700</Pressure1></PressureBlock></LineBlocks>
  <Element fromNode="10" toNode="20" elementKey="10-&gt;20">
   <NameBlock><NAME>10-&gt;20</NAME><FROM_NAME>N10</FROM_NAME><TO_NAME>N20</TO_NAME></NameBlock>
   <RouteGeometryBlock><DELTA_X>1000</DELTA_X><DELTA_Y>0</DELTA_Y><DELTA_Z>0</DELTA_Z></RouteGeometryBlock>
   <SectionDimensionBlock><DIAMETER>88.9</DIAMETER><WALL_THICK>5.49</WALL_THICK></SectionDimensionBlock>
   <DerivedBlock><ElementLengthMm>1000</ElementLengthMm><MaterialName>A106 B</MaterialName></DerivedBlock>
   <NodesBlock>
    <Node nodeNumber="10" role="FROM" elementKey="10-&gt;20"><DerivedCoordinateBlock><FROM_GLOBAL_X>1</FROM_GLOBAL_X><FROM_GLOBAL_Y>2</FROM_GLOBAL_Y><FROM_GLOBAL_Z>3</FROM_GLOBAL_Z></DerivedCoordinateBlock><TemperatureBlock><Temperature1>120</Temperature1><Temperature2>95</Temperature2></TemperatureBlock><RestraintsBlock><RESTRAINT NUM="1" NODE="10" TYPE="7" GAP="5"/></RestraintsBlock><DisplacementsBlock><DISPLACEMENTS DISP_NUM="1"><VECTOR DX="1"/></DISPLACEMENTS></DisplacementsBlock><ForcesMomentsBlock /><SifBlock><SIF SIF_NUM="1" NODE="10"/></SifBlock></Node>
    <Node nodeNumber="20" role="TO" elementKey="10-&gt;20"><DerivedCoordinateBlock><TO_GLOBAL_X>11</TO_GLOBAL_X><TO_GLOBAL_Y>2</TO_GLOBAL_Y><TO_GLOBAL_Z>3</TO_GLOBAL_Z></DerivedCoordinateBlock><TemperatureBlock /><RestraintsBlock /></Node>
   </NodesBlock>
   <OriginalElement><![CDATA[<PIPINGELEMENT FROM_NODE="10" TO_NODE="20"><Element fromNode="999" toNode="1000" elementKey="fake"/></PIPINGELEMENT>]]></OriginalElement>
  </Element>
  <Element fromNode="20" toNode="30" elementKey="20-&gt;30"><NameBlock><NAME>20-&gt;30</NAME></NameBlock><RouteGeometryBlock><DELTA_X>0</DELTA_X><DELTA_Y>500</DELTA_Y><DELTA_Z>0</DELTA_Z></RouteGeometryBlock><DerivedBlock><ElementLengthMm>500</ElementLengthMm></DerivedBlock><NodesBlock><Node nodeNumber="20" role="FROM" elementKey="20-&gt;30"><DerivedCoordinateBlock><FROM_GLOBAL_X>11</FROM_GLOBAL_X><FROM_GLOBAL_Y>2</FROM_GLOBAL_Y><FROM_GLOBAL_Z>3</FROM_GLOBAL_Z></DerivedCoordinateBlock><MiscBlock><NOTE>connected</NOTE></MiscBlock></Node><Node nodeNumber="30" role="TO" elementKey="20-&gt;30"><DerivedCoordinateBlock><TO_GLOBAL_X>11</TO_GLOBAL_X><TO_GLOBAL_Y>7</TO_GLOBAL_Y><TO_GLOBAL_Z>3</TO_GLOBAL_Z></DerivedCoordinateBlock><SifBlock /></Node></NodesBlock></Element>
 </Line>
 <Line id="LINENO2">
  <LineBlock><Branchname>BRANCH-2</Branchname><LineNo>LINENO2</LineNo></LineBlock>
  <Element fromNode="100" toNode="110" elementKey="100-&gt;110"><RouteGeometryBlock><DELTA_X>250</DELTA_X></RouteGeometryBlock><DerivedBlock><ElementLengthMm>250</ElementLengthMm><MaterialName>A333</MaterialName></DerivedBlock><NodesBlock><Node nodeNumber="100" role="FROM" elementKey="100-&gt;110"><DerivedCoordinateBlock><FROM_GLOBAL_X>100</FROM_GLOBAL_X><FROM_GLOBAL_Y>0</FROM_GLOBAL_Y><FROM_GLOBAL_Z>0</FROM_GLOBAL_Z></DerivedCoordinateBlock><TemperatureBlock><Temperature3>-5</Temperature3></TemperatureBlock></Node><Node nodeNumber="110" role="TO" elementKey="100-&gt;110"><DerivedCoordinateBlock><TO_GLOBAL_X>350</TO_GLOBAL_X><TO_GLOBAL_Y>0</TO_GLOBAL_Y><TO_GLOBAL_Z>0</TO_GLOBAL_Z></DerivedCoordinateBlock></Node></NodesBlock></Element>
  <Element fromNode="110" toNode="120" elementKey="110-&gt;120"><NameBlock><NAME>110-&gt;120</NAME></NameBlock><RigidBlock><TYPE>RIGID</TYPE><WEIGHT>25</WEIGHT></RigidBlock><NodesBlock><Node nodeNumber="110" role="FROM" elementKey="110-&gt;120"><DerivedCoordinateBlock><FROM_GLOBAL_X>350</FROM_GLOBAL_X><FROM_GLOBAL_Y>0</FROM_GLOBAL_Y><FROM_GLOBAL_Z>0</FROM_GLOBAL_Z></DerivedCoordinateBlock></Node><Node nodeNumber="120" role="TO" elementKey="110-&gt;120"><DerivedCoordinateBlock><TO_GLOBAL_X>500</TO_GLOBAL_X><TO_GLOBAL_Y>0</TO_GLOBAL_Y><TO_GLOBAL_Z>0</TO_GLOBAL_Z></DerivedCoordinateBlock><ForcesMomentsBlock><FORCESMOMENTS NUMBER="1"/></ForcesMomentsBlock></Node></NodesBlock></Element>
 </Line>
</CategorizedInputXML>`;

const detected=detectXmlCompareProfile({name:'BM_CII_INPUT_SOURCE_categorized_enriched.xml',text:xml});
assert.equal(detected.type,XML_COMPARE_PROFILE_TYPES.CATEGORIZED_XML);
const model=createCategorizedInputXmlCanvasModel({sourceName:'BM_CII_INPUT_SOURCE_categorized_enriched.xml',xmlText:xml,side:'source'});
assert.equal(model.schema,'xml-compare-categorized-inputxml-canvas-model/v1');
assert.equal(model.profile,'categorized-inputxml');
assert.equal(model.rootTag,'CategorizedInputXML');
assert.deepEqual(model.levels.map((level)=>level.levelId),['lineBlock','element','node','nodeEvidence']);
assert.equal(model.summary.lineCount,2);
assert.equal(model.summary.elementCount,4);
assert.equal(model.summary.nodeCount,8);
assert.equal(model.summary.pipingElementCount,0);
const intake=createXmlCompareLoadIntake({name:'BM_CII_INPUT_SOURCE_categorized_enriched.xml',text:xml,profile:detected.type});
assert.equal(intake.profile,'categorized-inputxml');
assert.equal(intake.summary.elementCount,4);
assert.equal(intake.summary.nodeCount,8);
assert.equal(intake.summary.pipingElementCount,0);
assert.equal(intake.records.filter((record)=>record.levelId==='lineBlock').length,2);
assert.equal(intake.records.filter((record)=>record.levelId==='element').length,4);
assert.equal(intake.records.filter((record)=>record.levelId==='node').length,8);
assert.ok(intake.records.some((record)=>record.levelId==='nodeEvidence'&&record.blockName==='RestraintsBlock'));
assert.ok(intake.records.some((record)=>record.levelId==='nodeEvidence'&&record.blockName==='DerivedCoordinateBlock'));
assert.ok(intake.records.some((record)=>record.levelId==='nodeEvidence'&&record.blockName==='TemperatureBlock'));
assert.ok(intake.records.some((record)=>record.levelId==='nodeEvidence'&&record.blockName==='ForcesMomentsBlock'&&record.itemCount===0));
const lineView=createXmlCompareCanvasLevelModel({side:'source',fileName:'BM_CII_INPUT_SOURCE_categorized_enriched.xml',profile:intake.profile,records:intake.records,summary:intake.summary,selection:{levelId:'line',displayField:'lineNo',keyField:'lineNo'}});
assert.equal(lineView.levelId,'lineBlock');
assert.equal(lineView.layout,'tiles');
assert.equal(lineView.records.length,2);
const elementView=createXmlCompareCanvasLevelModel({side:'source',fileName:'BM_CII_INPUT_SOURCE_categorized_enriched.xml',profile:intake.profile,records:intake.records,summary:intake.summary,selection:{levelId:'element',displayField:'elementKey',keyField:'lineNo'}});
assert.equal(elementView.levelId,'element');
assert.equal(elementView.layout,'grouped-tree');
assert.equal(elementView.records.length,4);
assert.deepEqual([...new Set(elementView.records.map((record)=>record.lineNo))],['LINENO1','LINENO2']);
const nodeView=createXmlCompareCanvasLevelModel({side:'source',fileName:'BM_CII_INPUT_SOURCE_categorized_enriched.xml',profile:intake.profile,records:intake.records,summary:intake.summary,selection:{levelId:'node',displayField:'nodeNumber',keyField:'elementKey'}});
assert.equal(nodeView.levelId,'node');
assert.equal(nodeView.layout,'grouped-tree');
assert.equal(nodeView.records.length,8);
assert.ok(nodeView.records.some((record)=>record.lineNo==='LINENO1'&&record.elementKey==='10->20'));
const evidenceView=createXmlCompareCanvasLevelModel({side:'source',fileName:'BM_CII_INPUT_SOURCE_categorized_enriched.xml',profile:intake.profile,records:intake.records,summary:intake.summary,selection:{levelId:'evidence',displayField:'evidenceKind',keyField:'elementKey'}});
assert.equal(evidenceView.levelId,'nodeEvidence');
assert.equal(evidenceView.layout,'grouped-compact-tree');
assert.ok(evidenceView.records.some((record)=>record.lineNo==='LINENO1'&&record.elementKey==='10->20'&&record.nodeNumber==='10'));
const lineHtml=renderXmlCompareGraphCanvasHtml({side:'source',title:'Source',data:{fileName:'BM_CII_INPUT_SOURCE_categorized_enriched.xml',profile:intake.profile,levelView:lineView,records:intake.records}});
assert.match(lineHtml,/LineBlock \(2\)/);
assert.match(lineHtml,/xml-compare-dynamic-tile/);
assert.match(lineHtml,/data-xml-compare-record-uid/);
const elementHtml=renderXmlCompareGraphCanvasHtml({side:'source',title:'Source',data:{fileName:'BM_CII_INPUT_SOURCE_categorized_enriched.xml',profile:intake.profile,levelView:elementView,records:intake.records}});
assert.match(elementHtml,/xml-compare-dynamic-tree/);
assert.match(elementHtml,/xml-compare-dynamic-line-group/);
assert.match(elementHtml,/Element 10-&gt;20/);
const nodeHtml=renderXmlCompareGraphCanvasHtml({side:'source',title:'Source',data:{fileName:'BM_CII_INPUT_SOURCE_categorized_enriched.xml',profile:intake.profile,levelView:nodeView,records:intake.records}});
assert.match(nodeHtml,/xml-compare-dynamic-element-group/);
assert.match(nodeHtml,/xml-compare-dynamic-list/);
const evidenceHtml=renderXmlCompareGraphCanvasHtml({side:'source',title:'Source',data:{fileName:'BM_CII_INPUT_SOURCE_categorized_enriched.xml',profile:intake.profile,levelView:evidenceView,records:intake.records}});
assert.match(evidenceHtml,/xml-compare-dynamic-node-group/);
assert.match(evidenceHtml,/xml-compare-dynamic-evidence-row/);
assert.match(evidenceHtml,/DerivedCoordinateBlock/);
console.log('xml-compare-categorized-canvas-levels: all assertions passed');
