import assert from 'node:assert/strict';

import { categorizedFileName, categorizedInputXmlToInputXml, inputXmlToCategorizedInputXml } from '../xml-compare/CategorizedInputXmlConverter.js';

const input=`<CAESARII><PIPINGMODEL>
<PIPINGELEMENT FROM_NODE="30.000000" TO_NODE="35.000000" FROM_NAME="N30" TO_NAME="N35" LINE_ID="/L/B1" DELTA_X="0.000000" DELTA_Y="0.000000" DELTA_Z="-1542.290000" DIAMETER="114.300000" WALL_THICK="6.000000" INSUL_THICK="20.000000" TEMP_EXP_C1="120.000000" PRESSURE1="700.000000" HYDRO_PRESSURE="5.000000" MATERIAL_NUM="106.000000" MATERIAL_NAME="A106 B" CORR_ALLOW="0.000000" FROM_GLOBAL_X="23227.580" TO_GLOBAL_Z="-22442.290">
<BEND RADIUS="114.299995" TYPE="-1.010100" ANGLE1="45.000000" NODE1="219.000000"/>
<SIF SIF_NUM="1" NODE="70.000000" TYPE="3.000000" SIF_IN="-1.010100"/>
<RIGID WEIGHT="186.808350" TYPE="Flange Pair"/>
<FLANGES METHOD="NC-3658.3" BOLT_CIRCLE_DIA="119.000000"/>
</PIPINGELEMENT>
<RESTRAINT NUM="1" NODE="30.000000" TYPE="7.000000" STIFFNESS="0.000000" GAP="5.000000" FRIC_COEF="0.300000" CNODE="-1.010100" TAG="PS-30" GUID="G-30"/>
<DISPLACEMENTS DISP_NUM="1" NODE_NUM="30.000000"><VECTOR NUMBER="1" DX="-75.000000" DY="0.000000" DZ="5.000000"/></DISPLACEMENTS>
<FORCESMOMENTS FORCMNT_NUM="1" NODE_NUM="30.000000"><VECTOR NUMBER="1" FX="1.000000" FY="2.000000" FZ="3.000000" MX="0.000000" MY="0.000000" MZ="0.000000"/></FORCESMOMENTS>
</PIPINGMODEL></CAESARII>`;

const categorized=inputXmlToCategorizedInputXml(input,{sourceName:'sample.txt'});
assert.match(categorized,/CategorizedInputXML/);
assert.match(categorized,/NameBlock/);
assert.match(categorized,/RouteGeometryBlock/);
assert.match(categorized,/SectionDimensionBlock/);
assert.match(categorized,/ProcessBlock/);
assert.match(categorized,/MaterialBlock/);
assert.match(categorized,/DerivedCoordinateBlock/);
assert.match(categorized,/BendBlock/);
assert.match(categorized,/SifBlock/);
assert.match(categorized,/RigidBlock/);
assert.match(categorized,/FlangeBlock/);
assert.match(categorized,/RestraintsBlock/);
assert.match(categorized,/DisplacementBlock/);
assert.match(categorized,/ForceMomentBlock/);
assert.match(categorized,/MiscBlock/);
assert.match(categorized,/OriginalElement/);
assert.match(categorized,/TEMP_EXP_C1/);
assert.match(categorized,/PRESSURE1/);

const roundTrip=categorizedInputXmlToInputXml(categorized);
assert.match(roundTrip,/PIPINGELEMENT FROM_NODE="30\.000000" TO_NODE="35\.000000"/);
assert.match(roundTrip,/<BEND RADIUS="114\.299995"/);
assert.match(roundTrip,/<SIF SIF_NUM="1"/);
assert.match(roundTrip,/<RIGID WEIGHT="186\.808350"/);
assert.match(roundTrip,/<FLANGES METHOD="NC-3658\.3"/);
assert.match(roundTrip,/<RESTRAINT NUM="1" NODE="30\.000000"/);
assert.match(roundTrip,/<DISPLACEMENTS DISP_NUM="1" NODE_NUM="30\.000000"/);
assert.match(roundTrip,/<FORCESMOMENTS FORCMNT_NUM="1" NODE_NUM="30\.000000"/);
assert.equal(categorizedFileName('sample.txt','input-to-categorized'),'sample_categorized_enriched.xml');
assert.equal(categorizedFileName('sample_categorized_enriched.xml','categorized-to-input'),'sample_categorized_enriched_inputxml.xml');

console.log('xml-compare-categorized-inputxml-converter: all assertions passed');
