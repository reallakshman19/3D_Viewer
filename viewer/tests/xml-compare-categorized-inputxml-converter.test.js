import assert from 'node:assert/strict';

import { categorizedFileName, categorizedInputXmlToInputXml, inputXmlToCategorizedInputXml } from '../xml-compare/CategorizedInputXmlConverter.js';

const input=`<CAESARII><PIPINGMODEL>
<PIPINGELEMENT FROM_NODE="30.000000" TO_NODE="35.000000" FROM_NAME="N30" TO_NAME="N35" LINE_ID="/ASIM-1835-4&quot;-P8810212-31441C4-PP/B1" DELTA_X="0.000000" DELTA_Y="0.000000" DELTA_Z="-1542.290000" DIAMETER="114.300000" WALL_THICK="6.000000" INSUL_THICK="20.000000" TEMP_EXP_C1="120.000000" TEMP_EXP_C2="-1.010100" PRESSURE1="700.000000" HYDRO_PRESSURE="-1.010100" INSUL_DENSITY="-1.010100" FLUID_DENSITY="-1.010100" MATERIAL_NUM="106.000000" MATERIAL_NAME="A106 B" CORR_ALLOW="-1.010100" MILL_TOL_PLUS="-1.010100" MILL_TOL_MINUS="-1.010100" SEAM_WELD="-1.010100" FROM_GLOBAL_X="23227.580" TO_GLOBAL_Z="-22442.290">
<BEND RADIUS="114.299995" TYPE="-1.010100" ANGLE1="45.000000" NODE1="219.000000"/>
<SIF SIF_NUM="1" NODE="70.000000" TYPE="3.000000" SIF_IN="-1.010100"/>
<SIF SIF_NUM="2" NODE="-1.010100" TYPE="-1.010100" SIF_IN="-1.010100" SIF_OUT="-1.010100"/>
<RIGID WEIGHT="186.808350" TYPE="Flange Pair"/>
<FLANGES METHOD="NC-3658.3" BOLT_CIRCLE_DIA="119.000000"/>
</PIPINGELEMENT>
<PIPINGELEMENT FROM_NODE="35.000000" TO_NODE="36.000000" LINE_ID="/ASIM-1835-4&quot;-P8810212-31441C4-PP/B1" DELTA_X="-1.010100" DELTA_Y="-1.010100" DELTA_Z="-1.010100" DIAMETER="-1.010100" WALL_THICK="-1.010100" INSUL_THICK="-1.010100" TEMP_EXP_C1="-1.010100" TEMP_EXP_C2="-1.010100" PRESSURE1="-1.010100" PRESSURE2="-1.010100" HYDRO_PRESSURE="-1.010100" INSUL_DENSITY="-1.010100" FLUID_DENSITY="-1.010100" MATERIAL_NAME="-1.010100" CORR_ALLOW="-1.010100" MILL_TOL_PLUS="-1.010100" MILL_TOL_MINUS="-1.010100" SEAM_WELD="-1.010100">
<RESTRAINT NUM="1" NODE="30.000000" TYPE="7.000000" STIFFNESS="0.000000" GAP="5.000000" FRIC_COEF="0.300000" CNODE="-1.010100" TAG="PS-30" GUID="G-30"/>
<RESTRAINT NUM="2" NODE="-1.010100" TYPE="-1.010100" STIFFNESS="-1.010100" GAP="-1.010100" FRIC_COEF="-1.010100" CNODE="-1.010100" XCOSINE="0.000000" YCOSINE="0.000000" ZCOSINE="0.000000" TAG="" GUID=""/>
<DISPLACEMENTS DISP_NUM="1" NODE_NUM="30.000000"><VECTOR NUMBER="1" DX="-75.000000" DY="0.000000" DZ="5.000000"/></DISPLACEMENTS>
<DISPLACEMENTS DISP_NUM="2" NODE_NUM="-1.010100"><VECTOR NUMBER="1" DX="-1.010100" DY="-1.010100" DZ="-1.010100" RX="-1.010100" RY="-1.010100" RZ="-1.010100"/></DISPLACEMENTS>
<FORCESMOMENTS FORCMNT_NUM="1" NODE_NUM="30.000000"><VECTOR NUMBER="1" FX="1.000000" FY="2.000000" FZ="3.000000" MX="0.000000" MY="0.000000" MZ="0.000000"/></FORCESMOMENTS>
<FORCESMOMENTS FORCMNT_NUM="2" NODE_NUM="-1.010100"><VECTOR NUMBER="1" FX="-1.010100" FY="-1.010100" FZ="-1.010100" MX="-1.010100" MY="-1.010100" MZ="-1.010100"/></FORCESMOMENTS>
<ALLOWABLESTRESS COLD_ALLOW="-1.010100" EFF="-1.010100" SY="-1.010100" SU="-1.010100" SUPP_RQR="0" MAT_LP="0"><CASE NUM="1" HOT_ALLOW="-1.010100" HOT_SY="0.000000" HOT_SU="0.000000" CYC_RED_FACTOR="-1.010100"/></ALLOWABLESTRESS>
</PIPINGMODEL></CAESARII>`;

const categorized=inputXmlToCategorizedInputXml(input,{sourceName:'sample.txt'});
assert.match(categorized,/CategorizedInputXML/);
assert.match(categorized,/schema="categorized-inputxml\/v3"/);
assert.match(categorized,/<LineBlock>/);
assert.match(categorized,/<LineBlocks>/);
assert.match(categorized,/<LineBlocks>[\s\S]*<ProcessBlock scope="line">/);
assert.match(categorized,/<LineBlocks>[\s\S]*<MaterialBlock scope="line">/);
assert.match(categorized,/NameBlock/);
assert.match(categorized,/RouteGeometryBlock/);
assert.match(categorized,/SectionDimensionBlock/);
assert.match(categorized,/DerivedBlock/);
assert.match(categorized,/NodesBlock/);
assert.match(categorized,/DerivedCoordinateBlock/);
assert.match(categorized,/TemperatureBlock/);
assert.match(categorized,/BendBlock/);
assert.match(categorized,/SifBlock/);
assert.match(categorized,/RigidBlock/);
assert.match(categorized,/FlangeBlock/);
assert.match(categorized,/RestraintsBlock/);
assert.match(categorized,/DisplacementsBlock/);
assert.match(categorized,/ForcesMomentsBlock/);
assert.match(categorized,/MiscBlock/);
assert.match(categorized,/OriginalElement/);
assert.doesNotMatch(categorized,/OriginalDocument/);
assert.match(categorized,/TEMP_EXP_C1/);
assert.match(categorized,/PRESSURE1/);
assert.match(categorized,/<PipingClass source="line-token">31441C4<\/PipingClass>/);
assert.match(categorized,/<Rating source="piping-class">31441<\/Rating>/);
assert.match(categorized,/<BoreMm source="line-size-token">101\.600<\/BoreMm>/);
assert.match(categorized,/<ElementLengthMm source="delta-vector">1542\.290<\/ElementLengthMm>/);
assert.match(categorized,/<MaterialName source="existing-field">A106 B<\/MaterialName>/);
assert.match(categorized,/<Node nodeNumber="30" role="FROM" elementKey="30-&gt;35">/);
assert.match(categorized,/<Node nodeNumber="35" role="TO" elementKey="30-&gt;35">/);
assert.match(categorized,/<Node nodeNumber="70" role="NODE" elementKey="30-&gt;35">[\s\S]*<SifBlock>/);
assert.match(categorized,/<Node nodeNumber="30" role="FROM" elementKey="30-&gt;35">[\s\S]*<RestraintsBlock>[\s\S]*<RESTRAINT NUM="1"/);
assert.match(categorized,/<Node nodeNumber="30" role="FROM" elementKey="30-&gt;35">[\s\S]*<DisplacementsBlock>[\s\S]*<DISPLACEMENTS DISP_NUM="1"/);
assert.match(categorized,/<Node nodeNumber="30" role="FROM" elementKey="30-&gt;35">[\s\S]*<ForcesMomentsBlock>[\s\S]*<FORCESMOMENTS FORCMNT_NUM="1"/);
assert.match(categorized,/<Node nodeNumber="30" role="FROM" elementKey="30-&gt;35">[\s\S]*<TemperatureBlock source="element-non-sentinel">[\s\S]*<Temperature1 sourceField="TEMP_EXP_C1">120\.000000<\/Temperature1>/);
assert.doesNotMatch(categorized,/<TEMP_EXP_C2>-1\.010100<\/TEMP_EXP_C2>/);
assert.doesNotMatch(categorized,/<HYDRO_PRESSURE>-1\.010100<\/HYDRO_PRESSURE>/);
assert.doesNotMatch(categorized,/<INSUL_DENSITY>-1\.010100<\/INSUL_DENSITY>/);
assert.doesNotMatch(categorized,/<FLUID_DENSITY>-1\.010100<\/FLUID_DENSITY>/);
assert.doesNotMatch(categorized,/<CORR_ALLOW>-1\.010100<\/CORR_ALLOW>/);
assert.doesNotMatch(categorized,/<MILL_TOL_PLUS>-1\.010100<\/MILL_TOL_PLUS>/);
assert.doesNotMatch(categorized,/<MILL_TOL_MINUS>-1\.010100<\/MILL_TOL_MINUS>/);
assert.doesNotMatch(categorized,/<SEAM_WELD>-1\.010100<\/SEAM_WELD>/);
assert.doesNotMatch(categorized,/<DIAMETER>-1\.010100<\/DIAMETER>/);
assert.match(categorized,/<SIF SIF_NUM="1"/);
assert.doesNotMatch(categorized,/<SIF SIF_NUM="2"/);
assert.doesNotMatch(categorized,/<RESTRAINT NUM="2"/);
assert.doesNotMatch(categorized,/<DISPLACEMENTS DISP_NUM="2"/);
assert.doesNotMatch(categorized,/<FORCESMOMENTS FORCMNT_NUM="2"/);
assert.doesNotMatch(categorized,/<AllowableStressBlock>/);
assert.equal((categorized.match(/<Element /g)||[]).length,2,'open-tag-only PIPINGELEMENT rows remain visible as elements');

const elementBodies=[...categorized.matchAll(/<Element\b[\s\S]*?<\/Element>/g)].map((match)=>match[0]);
assert.ok(elementBodies.length>=2);
assert.ok(elementBodies.every((body)=>!body.includes('<ProcessBlock')),'ProcessBlock must not be emitted inside Element');
assert.ok(elementBodies.every((body)=>!body.includes('<MaterialBlock')),'MaterialBlock must not be emitted inside Element');
assert.ok(elementBodies.every((body)=>!body.includes('<RestraintsBlock>')||body.includes('<NodesBlock>')),'RestraintsBlock must be under NodesBlock');

const roundTrip=categorizedInputXmlToInputXml(categorized);
assert.match(roundTrip,/PIPINGELEMENT FROM_NODE="30\.000000" TO_NODE="35\.000000"/);
assert.match(roundTrip,/<SIF SIF_NUM="2" NODE="-1\.010100"/,'OriginalElement preserves element-level child placeholders for reverse conversion');
assert.match(roundTrip,/<RESTRAINT NUM="1" NODE="30\.000000"/);
assert.match(roundTrip,/<DISPLACEMENTS DISP_NUM="1" NODE_NUM="30\.000000"/);
assert.match(roundTrip,/<FORCESMOMENTS FORCMNT_NUM="1" NODE_NUM="30\.000000"/);
assert.doesNotMatch(roundTrip,/<RESTRAINT NUM="2" NODE="-1\.010100"/);
assert.doesNotMatch(roundTrip,/<DISPLACEMENTS DISP_NUM="2" NODE_NUM="-1\.010100"/);
assert.doesNotMatch(roundTrip,/<FORCESMOMENTS FORCMNT_NUM="2" NODE_NUM="-1\.010100"/);
assert.doesNotMatch(roundTrip,/<ALLOWABLESTRESS COLD_ALLOW="-1\.010100"/);
assert.equal(categorizedFileName('sample.txt','input-to-categorized'),'sample_categorized_enriched.xml');
assert.equal(categorizedFileName('sample_categorized_enriched.xml','categorized-to-input'),'sample_categorized_enriched_inputxml.xml');

console.log('xml-compare-categorized-inputxml-converter: all assertions passed');
