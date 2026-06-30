import assert from 'node:assert/strict';

import { buildXmlCompareLinewiseWorkspaceModel, detectXmlCompareLinewiseFormat, _test } from '../xml-compare/XmlCompareLinewiseWorkspaceModel.js';

const inputXml=`<CAESARII><PIPINGMODEL>
<PIPINGELEMENT FROM_NODE="10.000000" TO_NODE="20.000000" LINE_ID="/ASIM-1835-4&quot;-P8810212-31441C4-PP/B1" DELTA_X="0.000000" DELTA_Y="0.000000" DELTA_Z="-108.000000" DIAMETER="114.300000" TEMP_EXP_C1="120.000000" PRESSURE1="700.000000" MATERIAL_NAME="A106 GR.B">
<SIF SIF_NUM="1" NODE="10.000000" TYPE="3.000000"/>
</PIPINGELEMENT>
<PIPINGELEMENT FROM_NODE="20.000000" TO_NODE="30.000000" LINE_ID="/ASIM-1835-4&quot;-P8810212-31441C4-PP/B1" DELTA_X="0.000000" DELTA_Y="0.000000" DELTA_Z="-992.000000" DIAMETER="-1.010100" WALL_THICK="-1.010100" INSUL_THICK="-1.010100">
<RESTRAINT NUM="1" NODE="20.000000" TYPE="7.000000" GAP="5.000000" TAG="PS-20"/>
<RESTRAINT NUM="2" NODE="-1.010100" TYPE="-1.010100" GAP="-1.010100"/>
</PIPINGMODEL></CAESARII>`;

assert.equal(detectXmlCompareLinewiseFormat(inputXml),'InputXML');
const model=buildXmlCompareLinewiseWorkspaceModel(inputXml,'sample.txt');
assert.equal(model.format,'InputXML');
assert.equal(model.lineCount,1);
assert.equal(model.elementCount,2,'open-tag-only PIPINGELEMENT rows must stay visible');
assert.ok(model.lines[0].lineBlockNames.includes('ProcessBlock'),'ProcessBlock is line-level in workspace model');
assert.ok(model.lines[0].lineBlockNames.includes('MaterialBlock'),'MaterialBlock is line-level in workspace model');
assert.equal(model.lines[0].elements[0].elementKey,'10->20');
assert.equal(model.lines[0].elements[0].derivedFacts.ElementLengthMm.value,'108.000');
assert.equal(model.lines[0].elements[0].derivedFacts.MaterialName.value,'A106 GR.B');
assert.ok(!model.lines[0].elements[0].blockNames.includes('ProcessBlock'),'ProcessBlock must not appear as an element block');
assert.ok(!model.lines[0].elements[0].blockNames.includes('MaterialBlock'),'MaterialBlock must not appear as an element block');
assert.equal(model.lines[0].elements[1].elementKey,'20->30');
assert.equal(model.lines[0].elements[1].derivedFacts.ElementLengthMm.value,'992.000');
assert.equal(model.lines[0].elements[1].nodeBlockCounts.RESTRAINT,1);
assert.ok(model.lines[0].elements[1].blockNames.includes('RestraintsBlock'));
assert.ok(!model.lines[0].elements[1].blockNames.includes('SectionDimensionBlock'),'sentinel-only section dimensions should not surface as a useful block');

const categorized=`<CategorizedInputXML><Line id="/L/B1"><LineBlocks><ProcessBlock scope="line"><PRESSURE1>700</PRESSURE1></ProcessBlock><MaterialBlock scope="line"><MATERIAL_NAME>A106 GR.B</MATERIAL_NAME></MaterialBlock></LineBlocks><Element fromNode="30" toNode="35" elementKey="30->35"><DerivedBlock><PipingClass>31441C4</PipingClass><Rating>150</Rating><BoreMm>100.000</BoreMm><ElementLengthMm>1542.290</ElementLengthMm><MaterialName>A106 GR.B</MaterialName></DerivedBlock><OriginalElement><![CDATA[<PIPINGELEMENT FROM_NODE="30.000000" TO_NODE="35.000000"/>]]></OriginalElement></Element></Line></CategorizedInputXML>`;
const categorizedModel=buildXmlCompareLinewiseWorkspaceModel(categorized,'cat.xml');
assert.equal(categorizedModel.format,'CategorizedInputXML');
assert.equal(categorizedModel.lineCount,1);
assert.equal(categorizedModel.elementCount,1);
assert.ok(categorizedModel.lines[0].lineBlockNames.includes('LineBlocks'));
assert.ok(categorizedModel.lines[0].lineBlockNames.includes('ProcessBlock'));
assert.ok(categorizedModel.lines[0].lineBlockNames.includes('MaterialBlock'));
assert.equal(categorizedModel.lines[0].elements[0].derivedFacts.PipingClass.value,'31441C4');
assert.equal(categorizedModel.lines[0].elements[0].derivedFacts.ElementLengthMm.value,'1542.290');
assert.ok(!categorizedModel.lines[0].elements[0].blockNames.includes('ProcessBlock'));
assert.ok(!categorizedModel.lines[0].elements[0].blockNames.includes('MaterialBlock'));

assert.equal(_test.elementLength({DELTA_X:'3',DELTA_Y:'4',DELTA_Z:'0'}),'5.000');
assert.equal(_test.deriveBore({},'/A-4"-B/C'),(4*25.4).toFixed(3));
assert.deepEqual(_test.lineBlockNamesForInputElement({TEMP_EXP_C1:'120',MATERIAL_NAME:'A106 B'}),['ProcessBlock','MaterialBlock']);

console.log('xml-compare-linewise-workspace-model: all assertions passed');
