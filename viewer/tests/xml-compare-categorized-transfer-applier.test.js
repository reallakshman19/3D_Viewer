import assert from 'node:assert/strict';

import { applyCategorizedTransferPlan, _test } from '../xml-compare/XmlCompareCategorizedTransferApplier.js';

const sourceXml=`<?xml version="1.0" encoding="UTF-8"?>
<CategorizedInputXML schema="categorized-inputxml/v2">
 <Line id="SRC-LINE">
  <LineBlocks>
    <ProcessBlock scope="line"><PRESSURE1>700</PRESSURE1><TEMP_EXP_C1>120</TEMP_EXP_C1></ProcessBlock>
    <MaterialBlock scope="line"><MATERIAL_NAME>A106 B</MATERIAL_NAME></MaterialBlock>
  </LineBlocks>
  <Element fromNode="10" toNode="20" elementKey="10->20">
    <RouteGeometryBlock><DELTA_X>10</DELTA_X><DELTA_Y>0</DELTA_Y><DELTA_Z>0</DELTA_Z></RouteGeometryBlock>
    <SectionDimensionBlock><DIAMETER>114.3</DIAMETER><WALL_THICK>6</WALL_THICK></SectionDimensionBlock>
    <RestraintsBlock><RESTRAINT NODE="10" TYPE="7" TAG="PS-10"/></RestraintsBlock>
  </Element>
  <Element fromNode="30" toNode="35" elementKey="30->35">
    <NodesBlock>
      <Node nodeNumber="30" role="FROM"><RestraintsBlock/></Node>
      <Node nodeNumber="35" role="TO"><RestraintsBlock><RESTRAINT NODE="35.000000" TYPE="17"/><RESTRAINT NODE="35.000000" TYPE="1"/><RESTRAINT NODE="35.000000" TYPE="3"/></RestraintsBlock></Node>
    </NodesBlock>
  </Element>
 </Line>
</CategorizedInputXML>`;

const targetXml=`<?xml version="1.0" encoding="UTF-8"?>
<CategorizedInputXML schema="categorized-inputxml/v2">
 <Line id="TGT-LINE">
  <LineBlocks>
    <ProcessBlock scope="line"><PRESSURE1>100</PRESSURE1></ProcessBlock>
  </LineBlocks>
  <Element fromNode="1000" toNode="1010" elementKey="1000->1010">
    <RouteGeometryBlock><DELTA_X>1</DELTA_X></RouteGeometryBlock>
    <SectionDimensionBlock><DIAMETER>1</DIAMETER></SectionDimensionBlock>
  </Element>
  <Element fromNode="1020" toNode="1030" elementKey="1020->1030">
    <NodesBlock>
      <Node nodeNumber="1020" role="FROM"><RestraintsBlock/></Node>
      <Node nodeNumber="1030" role="TO"><RestraintsBlock><RESTRAINT NODE="1030.000000" TYPE="17"/><RESTRAINT NODE="1030.000000" TYPE="3"/></RestraintsBlock></Node>
    </NodesBlock>
  </Element>
 </Line>
</CategorizedInputXML>`;

assert.equal(_test.lineIdFromOpen('<Line id="SRC-LINE">'),'SRC-LINE');
assert.equal(_test.elementKey({elementKey:'10->20'}),'10->20');
assert.equal(_test.findElement(sourceXml,'10->20').open,'<Element fromNode="10" toNode="20" elementKey="10->20">');
assert.match(_test.rewriteNodeReferences('<RESTRAINT NODE="10.000000" CNODE="-1.010100"/>','10','1000'),/NODE="1000"/);
assert.equal(_test.sourceBlocksByElement(sourceXml,'10->20',['RouteGeometryBlock']).length,1);
assert.equal(_test.sourceBlocksByLine(sourceXml,'SRC-LINE',['ProcessBlock','MaterialBlock']).length,2);
assert.equal(_test.sourceNodeBlocks(sourceXml,'10',['RestraintsBlock']).length,1);
assert.equal(_test.sourceNodeBlocks(sourceXml,'35',['RestraintsBlock'],'30->35','TO').length,1);

const lineResult=applyCategorizedTransferPlan(targetXml,sourceXml,{transferScope:'line',selectedBlocks:['ProcessBlock','MaterialBlock'],pairs:[{sourceLine:'SRC-LINE',targetLine:'TGT-LINE'}]});
assert.equal(lineResult.audit[0].status,'updated');
assert.match(lineResult.xml,/<LineBlocks>[\s\S]*<ProcessBlock scope="line"><PRESSURE1>700<\/PRESSURE1><TEMP_EXP_C1>120<\/TEMP_EXP_C1><\/ProcessBlock>/);
assert.match(lineResult.xml,/<MaterialBlock scope="line"><MATERIAL_NAME>A106 B<\/MATERIAL_NAME><\/MaterialBlock>/);
assert.doesNotMatch(lineResult.xml,/<PRESSURE1>100<\/PRESSURE1>/);

const elementResult=applyCategorizedTransferPlan(targetXml,sourceXml,{transferScope:'element',selectedBlocks:['RouteGeometryBlock','SectionDimensionBlock'],pairs:[{sourceElement:'10->20',targetElement:'1000->1010'}]});
assert.equal(elementResult.audit.length,1);
assert.equal(elementResult.audit[0].status,'updated');
assert.match(elementResult.xml,/<RouteGeometryBlock><DELTA_X>10<\/DELTA_X><DELTA_Y>0<\/DELTA_Y><DELTA_Z>0<\/DELTA_Z><\/RouteGeometryBlock>/);
assert.match(elementResult.xml,/<SectionDimensionBlock><DIAMETER>114\.3<\/DIAMETER><WALL_THICK>6<\/WALL_THICK><\/SectionDimensionBlock>/);

const legacyNodeResult=applyCategorizedTransferPlan(targetXml,sourceXml,{transferScope:'node',selectedBlocks:['RestraintsBlock'],pairs:[{sourceNode:'10',targetNode:'1000',targetElement:'1000->1010'}]});
assert.equal(legacyNodeResult.audit[0].status,'updated');
assert.match(legacyNodeResult.xml,/<RestraintsBlock><RESTRAINT NODE="1000" TYPE="7" TAG="PS-10"\/><\/RestraintsBlock>/);
assert.doesNotMatch(legacyNodeResult.xml,/NODE="10" TYPE="7"/);

const scopedNodeResult=applyCategorizedTransferPlan(targetXml,sourceXml,{transferScope:'node',selectedBlocks:['RestraintsBlock'],approvedPairIds:['case-restraints'],pairs:[{id:'pair-35-1030',approvedCaseIds:['case-restraints'],sourceNode:'35',sourceRole:'TO',targetNode:'1030',targetRole:'TO',sourceElement:'30->35',targetElement:'1020->1030'}]});
assert.equal(scopedNodeResult.audit[0].status,'updated');
assert.equal(scopedNodeResult.audit[0].changedBlocks[0].status,'replaced');
assert.match(scopedNodeResult.xml,/<Node nodeNumber="1030" role="TO">[\s\S]*<RESTRAINT NODE="1030" TYPE="17"\/>[\s\S]*<RESTRAINT NODE="1030" TYPE="1"\/>[\s\S]*<RESTRAINT NODE="1030" TYPE="3"\/>[\s\S]*<\/Node>/);
assert.doesNotMatch(scopedNodeResult.xml,/<Node nodeNumber="1030" role="TO">[\s\S]*NODE="35/);
assert.match(scopedNodeResult.xml,/<Node nodeNumber="1020" role="FROM"><RestraintsBlock\/><\/Node>/,'FROM node block must remain unchanged');

const skippedByApproval=applyCategorizedTransferPlan(targetXml,sourceXml,{transferScope:'node',selectedBlocks:['RestraintsBlock'],approvedPairIds:['different-case'],pairs:[{id:'pair-35-1030',approvedCaseIds:['case-restraints'],sourceNode:'35',targetNode:'1030',sourceElement:'30->35',targetElement:'1020->1030'}]});
assert.equal(skippedByApproval.audit[0].reason,'not-approved');
assert.doesNotMatch(skippedByApproval.xml,/TYPE="1"/);

const unsupported=applyCategorizedTransferPlan(targetXml,sourceXml,{transferScope:'unknown'});
assert.equal(unsupported.audit[0].status,'skipped');
assert.equal(unsupported.audit[0].reason,'unsupported-transfer-scope');
console.log('xml-compare-categorized-transfer-applier: all assertions passed');
