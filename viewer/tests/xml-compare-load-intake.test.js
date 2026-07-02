import assert from 'node:assert/strict';

import { createXmlCompareLoadIntake } from '../xml-compare/XmlCompareLoadIntake.js';
import { createXmlCompareWorkspaceModel } from '../xml-compare/XmlCompareWorkspaceModel.js';

const xml = [
  '<CAESARII><PIPINGMODEL>',
  '<PIPINGELEMENT FROM_NODE="10" TO_NODE="20" LINE_ID="/B1" FROM_NAME="N10" TO_NAME="N20"><ComponentType>ATTA</ComponentType><Position>1 2 3</Position><DTXR_PS>PS-123</DTXR_PS><DTXR_POS>GUIDE NODE 20</DTXR_POS></PIPINGELEMENT>',
  '<PIPINGELEMENT FROM_NODE="20" TO_NODE="30" DELTA_X="10" DELTA_Y="0" DELTA_Z="0" />',
  '<RESTRAINT NODE="20" TYPE="7" GAP="5" TAG="PS-123" />',
  '<RESTRAINT NODE="30" TYPE="0" TAG="" />',
  '</PIPINGMODEL></CAESARII>'
].join('');

const intake = createXmlCompareLoadIntake({ name: 'source.xml', text: xml, profile: 'inputxml' });
assert.equal(intake.summary.pipingElementCount, 2);
assert.equal(intake.summary.restraintCount, 2);
assert.equal(intake.summary.lineIdCount, 1);
assert.equal(intake.summary.fromNameCount, 1);
assert.equal(intake.summary.toNameCount, 1);
assert.equal(intake.summary.restraintTagCount, 1);
assert.equal(intake.summary.blankRestraintTagCount, 1);
assert.equal(intake.summary.dtxrPsCount, 1);
assert.equal(intake.summary.dtxrPosCount, 1);
assert.equal(intake.records.length, 2);
assert.equal(intake.records[0].branchName, '/B1');
assert.equal(intake.records[0].componentType, 'ATTA');

const workspace = createXmlCompareWorkspaceModel({ fileA: { name: 'source.xml', size: xml.length }, textA: xml });
assert.equal(workspace.source.records.length, 2);
assert.equal(workspace.source.summary.recordCount, 2);
assert.equal(workspace.source.summary.pipingElementCount, 2);
assert.equal(workspace.source.summary.restraintCount, 2);
assert.match(workspace.logs[0].message, /2 load record/);

const enrichedXml = [
  '<PipeStressExport><Pipe><Branch>',
  '<Branchname>/ASIM-1835-6-P881/B1</Branchname><LineNo>L-100</LineNo><MaterialNumber>106</MaterialNumber>',
  '<Pressure><Pressure1>700</Pressure1><HydroPressure>1050</HydroPressure></Pressure>',
  '<Temperature><Temperature1>120</Temperature1><Temperature2>309</Temperature2><Temperature3>-5</Temperature3></Temperature>',
  '<FluidDensity>69</FluidDensity>',
  '<Node><NodeNumber>10</NodeNumber><NodeName>N10</NodeName><Endpoint>0</Endpoint><ComponentType>PIPE</ComponentType><ComponentRefNo>C10</ComponentRefNo><Position>1 2 3</Position><PipingClass>31441C4</PipingClass><Rating>150</Rating><BoreMm>100</BoreMm><WallThickness>6.02</WallThickness><CorrosionAllowance>1.5</CorrosionAllowance><MaterialName>A106 B</MaterialName><MaterialCode>106</MaterialCode><ElementLengthMm>1000</ElementLengthMm><DTXR_PS>PS-10</DTXR_PS><DTXR_POS>REST</DTXR_POS></Node>',
  '<Node><NodeNumber>20</NodeNumber><NodeName>N20</NodeName><Endpoint>1</Endpoint><ComponentType>ATTA</ComponentType><ComponentRefNo>C20</ComponentRefNo><Position>4 5 6</Position><PipingClass>31441C4</PipingClass><Rating>150</Rating><BoreMm>100</BoreMm><WallThickness>6.02</WallThickness><CorrosionAllowance>1.5</CorrosionAllowance><MaterialName>A106 B</MaterialName><MaterialCode>106</MaterialCode><ElementLengthMm>0</ElementLengthMm><DTXR_PS>PS-20</DTXR_PS><DTXR_POS>GUIDE</DTXR_POS></Node>',
  '</Branch></Pipe></PipeStressExport>'
].join('');

const enrichedWorkspace = createXmlCompareWorkspaceModel({ fileA: { name: 'a_enriched.xml', size: enrichedXml.length }, textA: enrichedXml });
assert.equal(enrichedWorkspace.source.profile, 'xml-cii2019-enriched-xml');
assert.equal(enrichedWorkspace.source.adapter.profile, 'xml-cii2019-enriched-xml');
assert.equal(enrichedWorkspace.source.adapter.records.length, 2);
assert.equal(enrichedWorkspace.source.records.length, 2);
assert.equal(enrichedWorkspace.source.summary.recordCount, 2);
assert.equal(enrichedWorkspace.source.summary.lineCount, 1);
assert.equal(enrichedWorkspace.source.records[0].lineNo, 'L-100');
assert.equal(enrichedWorkspace.source.records[0].nodeNumber, '10');

const categorized=`<CategorizedInputXML schema="categorized-inputxml/v3" sourceName="coord.xml"><Line id="L1"><LineBlock><LineNo>L1</LineNo></LineBlock><Element fromNode="10" toNode="20" elementKey="10-&gt;20"><NodesBlock><Node nodeNumber="10" role="FROM" elementKey="10-&gt;20"><DerivedCoordinateBlock><FROM_GLOBAL_X>1.000</FROM_GLOBAL_X><FROM_GLOBAL_Y>2.000</FROM_GLOBAL_Y><FROM_GLOBAL_Z>3.000</FROM_GLOBAL_Z><GLOBAL_COORD_BASIS_NODE>10</GLOBAL_COORD_BASIS_NODE></DerivedCoordinateBlock></Node></NodesBlock></Element></Line></CategorizedInputXML>`;
const coordinateIntake=createXmlCompareLoadIntake({name:'coord_categorized_enriched.xml',text:categorized,profile:'categorized-inputxml'});
const coordinateNode=coordinateIntake.records.find((record)=>record.levelId==='node');
assert.equal(coordinateNode.globalX,'1.000');
assert.equal(coordinateNode.globalY,'2.000');
assert.equal(coordinateNode.globalZ,'3.000');
assert.equal(coordinateNode.coordinateBasisNode,'10');

const enrichedStage = JSON.stringify({
  schema: 'xml-cii2019-enriched-stage/v1',
  source: 'stage.json',
  branches: [{
    branchName: '/ASIM-1835-6-P881/B1',
    lineNo: 'L-200',
    pressure: { Pressure1: '700' },
    temperature: { Temperature1: '120' },
    fluidDensity: '69',
    materialNumber: '106',
    nodes: [{ nodeNumber: '30', nodeName: 'N30', componentType: 'PIPE', componentRefNo: 'C30', position: { x: 7, y: 8, z: 9 }, elementLengthMm: '500' }]
  }]
});
const stageWorkspace = createXmlCompareWorkspaceModel({ fileA: { name: 'a_enriched_staged.json', size: enrichedStage.length }, textA: enrichedStage });
assert.equal(stageWorkspace.source.profile, 'xml-cii2019-enriched-stage');
assert.equal(stageWorkspace.source.adapter.records.length, 1);
assert.equal(stageWorkspace.source.records.length, 1);
assert.equal(stageWorkspace.source.summary.lineCount, 1);
assert.equal(stageWorkspace.source.records[0].lineNo, 'L-200');

console.log('xml-compare-load-intake: all assertions passed');
