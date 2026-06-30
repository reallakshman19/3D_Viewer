import assert from 'node:assert/strict';

import { applyXmlCompareSideload, buildXmlCompareSideloadFileName, buildXmlCompareSideloadIndex } from '../xml-compare/XmlCompareSideloadEnricher.js';

const xml='<CAESARII><PIPINGMODEL><PIPINGELEMENT FROM_NODE="10.000000" TO_NODE="20.000000" DELTA_X="-1.010100" DELTA_Y="-1.010100" DELTA_Z="-107.999992" /><PIPINGELEMENT FROM_NODE="20.000000" TO_NODE="30.000000" DELTA_X="-1.010100" DELTA_Y="-1.010100" DELTA_Z="-992.000000" /><RESTRAINT NODE="20.000000" TYPE="7.000000" STIFFNESS="0.000000" GAP="5.000000" MU="0.300000" CNODE="-1.010100" TAG="" GUID="" /></PIPINGMODEL></CAESARII>';
const tables={
  lineIdText:'FROM_NODE\tTO_NODE\tLINE_ID\n10\t20\t/ASIM-1835-6-S8811941/B1',
  nodeNameText:'FROM_NODE,TO_NODE,FROM_NAME,TO_NAME\n10,20,N10,N20',
  restraintTagText:'FROM_NODE\tTO_NODE\tNODE\tTYPE\tSTIFFNESS\tGAP\tMU\tCNODE\tTAG\n10\t20\t20\t7\t0\t5\t0.3\t-1.0101\tPS-123',
  coordinateText:'NODE\tGLOBAL_X\tGLOBAL_Y\tGLOBAL_Z\n10\t23227.580 mm.\t3257.150 mm.\t-19800.000 mm.'
};

const index=buildXmlCompareSideloadIndex(tables);
assert.equal(index.stats.lineIdRows,1);
assert.equal(index.stats.nodeNameRows,1);
assert.equal(index.stats.tagRows,1);
assert.equal(index.stats.coordinateRows,1);
assert.equal(index.nodeCoordinates.get('10').x,23227.58);

const result=applyXmlCompareSideload(xml,tables);
assert.equal(result.report.lineIdsApplied,1);
assert.equal(result.report.nodeNamesApplied,1);
assert.equal(result.report.tagsApplied,1);
assert.equal(result.report.coordinatesApplied,2);
assert.equal(result.report.coordinateNodesResolved,3);
assert.match(result.xmlText,/LINE_ID="\/ASIM-1835-6-S8811941\/B1"/);
assert.match(result.xmlText,/FROM_NAME="N10"/);
assert.match(result.xmlText,/TO_NAME="N20"/);
assert.match(result.xmlText,/TAG="PS-123"/);
assert.match(result.xmlText,/FROM_GLOBAL_X="23227\.580"/);
assert.match(result.xmlText,/FROM_GLOBAL_Y="3257\.150"/);
assert.match(result.xmlText,/FROM_GLOBAL_Z="-19800\.000"/);
assert.match(result.xmlText,/TO_GLOBAL_X="23227\.580"/);
assert.match(result.xmlText,/TO_GLOBAL_Y="3257\.150"/);
assert.match(result.xmlText,/TO_GLOBAL_Z="-19908\.000"/);
assert.match(result.xmlText,/FROM_NODE="20\.000000"[^>]*FROM_GLOBAL_Z="-19908\.000"/);
assert.match(result.xmlText,/FROM_NODE="20\.000000"[^>]*TO_GLOBAL_Z="-20900\.000"/);
assert.match(result.xmlText,/GLOBAL_COORD_BASIS_NODE="10"/);
assert.equal(buildXmlCompareSideloadFileName('source_required.txt'),'source_required_sideloaded.xml');

console.log('xml-compare-sideload-enricher: all assertions passed');
