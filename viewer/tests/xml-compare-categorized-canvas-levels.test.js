import assert from 'node:assert/strict';
import { detectXmlCompareProfile, XML_COMPARE_PROFILE_TYPES } from '../xml-compare/XmlCompareProfileDetector.js';
import { createXmlCompareLoadIntake } from '../xml-compare/XmlCompareLoadIntake.js';
import { createXmlCompareCanvasLevelModel } from '../xml-compare/XmlCompareCanvasLevelModel.js';

const xml=`<?xml version="1.0" encoding="UTF-8"?>
<CategorizedInputXML schema="categorized-inputxml/v3" sourceName="BM_CII_INPUT_SOURCE.xml">
 <Line id="/ASIM-1835-4&quot;-P8810212-31441C4-PP/B1">
  <LineBlock>
    <Branchname>/ASIM-1835-4&quot;-P8810212-31441C4-PP/B1</Branchname>
    <LineNo>/ASIM-1835-4&quot;-P8810212-31441C4-PP/B1</LineNo>
    <PipingClass source="line-token">31441C4</PipingClass>
    <Rating source="piping-class">31441</Rating>
  </LineBlock>
  <Element fromNode="400" toNode="10" elementKey="400-&gt;10">
    <NameBlock><NAME>400-&gt;10</NAME></NameBlock>
    <RouteGeometryBlock><DELTA_X>1258.800049</DELTA_X></RouteGeometryBlock>
    <DerivedBlock><ElementLengthMm source="delta-vector">1258.800</ElementLengthMm><MaterialName source="existing-field">A106 B</MaterialName></DerivedBlock>
    <NodesBlock>
      <Node nodeNumber="10" role="TO" elementKey="400-&gt;10">
        <DerivedCoordinateBlock><TO_GLOBAL_X>23227.580</TO_GLOBAL_X><TO_GLOBAL_Y>3257.150</TO_GLOBAL_Y><TO_GLOBAL_Z>-22942.292</TO_GLOBAL_Z></DerivedCoordinateBlock>
        <TemperatureBlock source="element-non-sentinel"><Temperature2 sourceField="TEMP_EXP_C2">95.377998</Temperature2></TemperatureBlock>
        <RestraintsBlock><RESTRAINT NUM="1" NODE="10.000000" TYPE="7.000000" GAP="5.000000"/></RestraintsBlock>
        <DisplacementsBlock><DISPLACEMENTS DISP_NUM="1" NODE_NUM="10.000000"><VECTOR NUMBER="1" DX="-75.000000" DY="0.000000" DZ="5.000000"/></DISPLACEMENTS></DisplacementsBlock>
        <ForcesMomentsBlock />
        <SifBlock><SIF SIF_NUM="1" NODE="10.000000" TYPE="3.000000"/></SifBlock>
      </Node>
    </NodesBlock>
    <OriginalElement><![CDATA[<PIPINGELEMENT FROM_NODE="400.000000" TO_NODE="10.000000"/>]]></OriginalElement>
  </Element>
 </Line>
</CategorizedInputXML>`;

const detected=detectXmlCompareProfile({name:'BM_CII_INPUT_SOURCE_categorized_enriched.xml',text:xml});
assert.equal(detected.type,XML_COMPARE_PROFILE_TYPES.CATEGORIZED_XML);
const intake=createXmlCompareLoadIntake({name:'BM_CII_INPUT_SOURCE_categorized_enriched.xml',text:xml,profile:detected.type});
assert.ok(intake.records.some((record)=>record.levelHint==='line'));
assert.ok(intake.records.some((record)=>record.levelHint==='element'));
assert.ok(intake.records.some((record)=>record.levelHint==='node'));
assert.ok(intake.records.some((record)=>record.levelHint==='evidence'));
const node=intake.records.find((record)=>record.levelHint==='node');
assert.equal(node.nodeNumber,'10');
assert.equal(node.role,'TO');
assert.equal(node.temperature2,'95.377998');
assert.equal(node.restraintCount,1);
assert.equal(node.displacementsCount,1);
assert.equal(node.sifCount,1);
const lineView=createXmlCompareCanvasLevelModel({side:'source',fileName:'BM_CII_INPUT_SOURCE_categorized_enriched.xml',profile:detected.type,records:intake.records,selection:{levelId:'line',displayField:'pipingClass',keyField:'lineNo'}});
assert.equal(lineView.levelId,'line');
assert.ok(lineView.fields.includes('pipingClass'));
const nodeView=createXmlCompareCanvasLevelModel({side:'source',fileName:'BM_CII_INPUT_SOURCE_categorized_enriched.xml',profile:detected.type,records:intake.records,selection:{levelId:'node',displayField:'nodeNumber',keyField:'elementKey'}});
assert.equal(nodeView.levelId,'node');
assert.equal(nodeView.records.length,1);
assert.ok(nodeView.fields.includes('temperature2'));
const evidenceView=createXmlCompareCanvasLevelModel({side:'source',fileName:'BM_CII_INPUT_SOURCE_categorized_enriched.xml',profile:detected.type,records:intake.records,selection:{levelId:'evidence',displayField:'evidenceKind',keyField:'elementKey'}});
assert.equal(evidenceView.levelId,'evidence');
assert.ok(evidenceView.records.length>=3);
assert.ok(evidenceView.fields.includes('evidenceKind'));

console.log('xml-compare-categorized-canvas-levels: all assertions passed');
