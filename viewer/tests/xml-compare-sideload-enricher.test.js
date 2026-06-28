import assert from 'node:assert/strict';

import { applyXmlCompareSideload, buildXmlCompareSideloadFileName, buildXmlCompareSideloadIndex } from '../xml-compare/XmlCompareSideloadEnricher.js';

const xml='<CAESARII><PIPINGMODEL><PIPINGELEMENT FROM_NODE="10.000000" TO_NODE="20.000000" DELTA_X="1" /><RESTRAINT NODE="20.000000" TYPE="7.000000" STIFFNESS="0.000000" GAP="5.000000" MU="0.300000" CNODE="-1.010100" TAG="" GUID="" /></PIPINGMODEL></CAESARII>';
const tables={
  lineIdText:'FROM_NODE\tTO_NODE\tLINE_ID\n10\t20\t/ASIM-1835-6-S8811941/B1',
  nodeNameText:'FROM_NODE,TO_NODE,FROM_NAME,TO_NAME\n10,20,N10,N20',
  restraintTagText:'FROM_NODE\tTO_NODE\tNODE\tTYPE\tSTIFFNESS\tGAP\tMU\tCNODE\tTAG\n10\t20\t20\t7\t0\t5\t0.3\t-1.0101\tPS-123'
};

const index=buildXmlCompareSideloadIndex(tables);
assert.equal(index.stats.lineIdRows,1);
assert.equal(index.stats.nodeNameRows,1);
assert.equal(index.stats.tagRows,1);

const result=applyXmlCompareSideload(xml,tables);
assert.equal(result.report.lineIdsApplied,1);
assert.equal(result.report.nodeNamesApplied,1);
assert.equal(result.report.tagsApplied,1);
assert.match(result.xmlText,/LINE_ID="\/ASIM-1835-6-S8811941\/B1"/);
assert.match(result.xmlText,/FROM_NAME="N10"/);
assert.match(result.xmlText,/TO_NAME="N20"/);
assert.match(result.xmlText,/TAG="PS-123"/);
assert.equal(buildXmlCompareSideloadFileName('source_required.txt'),'source_required_sideloaded.xml');

console.log('xml-compare-sideload-enricher: all assertions passed');
