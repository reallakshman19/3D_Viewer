import assert from 'node:assert/strict';

import { createXmlCompareOwnershipIndex, _test } from '../xml-compare/XmlCompareOwnershipIndex.js';

const xml=`<CAESARII><PIPINGMODEL>
<PIPINGELEMENT FROM_NODE="10.000000" TO_NODE="20.000000" LINE_ID="/L-4&quot;-P-31441C4/B1" DELTA_X="0.000000" DELTA_Y="0.000000" DELTA_Z="-108.000000" DIAMETER="114.300000" WALL_THICK="6.000000" INSUL_THICK="50.000000" TEMP_EXP_C1="120.000000" PRESSURE1="700.000000" HYDRO_PRESSURE="5.000000" MATERIAL_NUM="106.000000" MATERIAL_NAME="A106 B" MODULUS="203000.000000" FROM_NAME="N10" TO_NAME="N20" FROM_GLOBAL_X="100.000000" FROM_GLOBAL_Y="200.000000" FROM_GLOBAL_Z="300.000000" TO_GLOBAL_X="100.000000" TO_GLOBAL_Y="200.000000" TO_GLOBAL_Z="192.000000">
<SIF SIF_NUM="1" NODE="20.000000" TYPE="3.000000"/>
</PIPINGELEMENT>
<PIPINGELEMENT FROM_NODE="20.000000" TO_NODE="30.000000" LINE_ID="/L-4&quot;-P-31441C4/B1" DELTA_X="0.000000" DELTA_Y="0.000000" DELTA_Z="-992.000000" DIAMETER="114.300000" TEMP_EXP_C1="120.000000" PRESSURE1="700.000000" MATERIAL_NAME="A106 B">
<RESTRAINT NUM="1" NODE="10.000000" TYPE="7.000000" GAP="5.000000" TAG="PS-10"/>
<DISPLACEMENTS DISP_NUM="1" NODE_NUM="20.000000"><VECTOR NUMBER="1" DX="1.000000" DY="2.000000" DZ="3.000000"/></DISPLACEMENTS>
<FORCESMOMENTS FORCMNT_NUM="1" NODE_NUM="30.000000"><VECTOR NUMBER="1" FX="1.000000" FY="2.000000" FZ="3.000000"/></FORCESMOMENTS>
<ALLOWABLESTRESS COLD_ALLOW="138.000000"><CASE NUM="1" HOT_ALLOW="120.000000"/></ALLOWABLESTRESS>
</PIPINGMODEL></CAESARII>`;

const index=createXmlCompareOwnershipIndex(xml,{sourceName:'unit.xml'});
const line=index.lines['/L-4&quot;-P-31441C4/B1'];
assert.ok(line,'line should be indexed');
assert.ok(line.lineBlocks.ProcessBlock,'ProcessBlock is line-owned');
assert.ok(line.lineBlocks.MaterialBlock,'MaterialBlock is line-owned');
assert.ok(line.lineBlocks.AllowableStressBlock,'AllowableStressBlock is line-owned');
assert.equal(line.lineBlocks.ProcessBlock[0].TEMP_EXP_C1,'120.000000');
assert.equal(line.lineBlocks.MaterialBlock[0].MATERIAL_NAME,'A106 B');

const element=index.elements['10->20'];
assert.ok(element,'element should be indexed');
assert.ok(element.elementBlocks.RouteGeometryBlock,'RouteGeometryBlock is element-owned');
assert.ok(element.elementBlocks.SectionDimensionBlock,'SectionDimensionBlock is element-owned');
assert.ok(element.elementBlocks.SifBlock,'SIF is element-owned');
assert.equal(element.elementBlocks.ProcessBlock,undefined,'ProcessBlock must not be element-owned');
assert.equal(element.elementBlocks.MaterialBlock,undefined,'MaterialBlock must not be element-owned');
assert.deepEqual(index.links.elementToNodes['10->20'],['10','20']);
assert.equal(index.links.elementToLine['10->20'],'/L-4&quot;-P-31441C4/B1');

assert.ok(index.nodes['10'].nodeBlocks.FromNodeFacts,'from node facts indexed');
assert.ok(index.nodes['20'].nodeBlocks.ToNodeFacts,'to node facts indexed');
assert.ok(index.nodes['10'].nodeBlocks.RestraintBlock,'RestraintBlock is node-owned');
assert.ok(index.nodes['20'].nodeBlocks.DisplacementBlock,'DisplacementBlock is node-owned');
assert.ok(index.nodes['30'].nodeBlocks.ForceMomentBlock,'ForceMomentBlock is node-owned');
assert.deepEqual(index.links.nodeToElements['20'],['10->20','20->30']);

assert.ok(_test.lineBlocksFromElementAttrs({TEMP_EXP_C1:'120',MATERIAL_NAME:'A106 B'}).ProcessBlock);
assert.ok(_test.lineBlocksFromElementAttrs({TEMP_EXP_C1:'120',MATERIAL_NAME:'A106 B'}).MaterialBlock);
assert.equal(_test.elementBlocksFromAttrs({TEMP_EXP_C1:'120',MATERIAL_NAME:'A106 B'}).ProcessBlock,undefined);

console.log('xml-compare-ownership-index: all assertions passed');
