#!/usr/bin/env node
import assert from 'node:assert/strict';
import { cleanXmlCiiNodeBlocks } from '../viewer/converters/xml-cii2019-core/xml-cii-node-block-cleanup.js';
import { applyXmlCiiPostSplitElementLengthCleanup } from '../viewer/converters/xml-cii2019-core/post-split-element-length-cleanup.js';
import { applyXmlCiiStagedGeometryAuthority } from '../viewer/converters/xml-cii2019-core/staged-geometry-authority.js';

const fixture = `<?xml version="1.0"?><Root><Branch><Branchname>/TEST-4\"-P8810212-31441C4-PP/B1</Branchname>
<Node><NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType><ComponentRefNo>P1</ComponentRefNo><ElementLengthMm>100</ElementLengthMm><Position>0 0 0</Position></Node>
<Node><NodeNumber>20</NodeNumber><ComponentType>GASK</ComponentType><ComponentRefNo>G1</ComponentRefNo><ElementLengthMm>3.2</ElementLengthMm><Position>10 0 0</Position></Node>
<Node><NodeNumber>30</NodeNumber><ComponentType>ATTA</ComponentType><ComponentRefNo>A1</ComponentRefNo><ElementLengthMm>0.0</ElementLengthMm><Position>20 0 0</Position></Node>
<Node><NodeNumber>40</NodeNumber><ComponentType>OLET</ComponentType><ComponentRefNo>O1</ComponentRefNo><ElementLengthMm>0.02</ElementLengthMm><Position>30 0 0</Position></Node>
<Node><NodeNumber>50</NodeNumber><ComponentType>RIGID</ComponentType><ComponentRefNo>R1</ComponentRefNo><ElementLengthMm>5.9</ElementLengthMm><Position>40 0 0</Position></Node>
<Node><NodeNumber>60</NodeNumber><ComponentType>PIPE</ComponentType><ComponentRefNo>P2</ComponentRefNo><ElementLengthMm>250</ElementLengthMm><Position>250 0 0</Position></Node>
</Branch></Root>`;

function assertNoShortNodes(xmlText, threshold = 6) {
  for (const block of xmlText.match(/<Node\b[\s\S]*?<\/Node>/gi) || []) {
    const length = Number(block.match(/<ElementLengthMm>([\s\S]*?)<\/ElementLengthMm>/i)?.[1]);
    const type = block.match(/<ComponentType>([\s\S]*?)<\/ComponentType>/i)?.[1] || '';
    assert.notEqual(type, 'GASK', 'GASK node block must be removed');
    assert.ok(!Number.isFinite(length) || length > threshold, `short node survived: ${type} ${length}`);
  }
}
function nodeBlock(xmlText, nodeNumber) { return (xmlText.match(/<Node\b[\s\S]*?<\/Node>/gi) || []).find((block) => block.includes(`<NodeNumber>${nodeNumber}</NodeNumber>`)) || ''; }

const direct = cleanXmlCiiNodeBlocks(fixture, { stage: 'unit-pre-enrichment-source' });
assert.equal(direct.stats.gasketNodesDropped, 1);
assert.equal(direct.stats.shortElementLengthNodesDropped, 4);
assert.equal(direct.stats.shortElementLengthNodesDroppedByType.GASK, 1);
assert.equal(direct.stats.shortElementLengthNodesDroppedByType.ATTA, 1);
assert.equal(direct.stats.shortElementLengthNodesDroppedByType.OLET, 1);
assert.equal(direct.stats.shortElementLengthNodesDroppedByType.RIGID, 1);
assertNoShortNodes(direct.xmlText);
assert.match(direct.xmlText, /<ComponentType>PIPE<\/ComponentType>/);

const valveEndpointFixture = `<?xml version="1.0"?><Root><Branch><Branchname>/TEST/B1</Branchname>
<Node><NodeNumber>1466</NodeNumber><Endpoint>2</Endpoint><ComponentType>FLAN</ComponentType><ComponentRefNo>=F1</ComponentRefNo><ElementLengthMm>147.000</ElementLengthMm><Position>189617.99 -1103125.00 101184.15</Position></Node>
<Node><NodeNumber>1467</NodeNumber><Endpoint>1</Endpoint><ComponentType>VALV</ComponentType><ComponentRefNo>=V1</ComponentRefNo><ElementLengthMm>610.000</ElementLengthMm><Position>189621.19 -1103125.00 101184.15</Position></Node>
<Node><NodeNumber>1468</NodeNumber><Endpoint>2</Endpoint><ComponentType>VALV</ComponentType><ComponentRefNo>=V1</ComponentRefNo><ElementLengthMm>610.000</ElementLengthMm><Position>190231.19 -1103125.00 101184.15</Position></Node>
</Branch></Root>`;
const valveNoDrop = applyXmlCiiPostSplitElementLengthCleanup(valveEndpointFixture, { config: { shortElementLengthDropThresholdMm: 0 } });
assert.match(nodeBlock(valveNoDrop.xmlText, 1467), /<ElementLengthMm>3\.200<\/ElementLengthMm>/, 'Endpoint 1 VALV must use incoming 3.2 mm adjacent gap, not the 610 mm paired valve span');
assert.match(nodeBlock(valveNoDrop.xmlText, 1468), /<ElementLengthMm>610\.000<\/ElementLengthMm>/, 'Endpoint 2 VALV must retain paired valve span');
const valveDrop = applyXmlCiiPostSplitElementLengthCleanup(valveEndpointFixture, {});
assert.equal(nodeBlock(valveDrop.xmlText, 1467), '', 'Endpoint 1 VALV with 3.2 mm length must be removed by short-node cleanup');
assert.notEqual(nodeBlock(valveDrop.xmlText, 1468), '', 'Endpoint 2 VALV with 610 mm length must be retained');

const staged = applyXmlCiiStagedGeometryAuthority(fixture, '', { config: { dropShortElementLengthNodes: false, dropGasketNodes: false, dropGasketsInEnrichment: false } });
assertNoShortNodes(staged.xmlText);
assert.equal(staged.stats.shortElementLengthNodesDropped, 4, 'staged authority must enforce short-node cleanup even if stale config disables it');
assert.ok(staged.diagnostics.some((row) => row.type === 'short-element-length-node-dropped' && row.componentType === 'ATTA'));
assert.ok(staged.diagnostics.some((row) => row.type === 'short-element-length-node-dropped' && row.componentType === 'OLET'));
console.log('XML CII short node invariant cleanup test passed', { direct: direct.stats, staged: staged.stats });
