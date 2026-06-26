#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  applyXmlCiiTopologyElementLengths,
  collectXmlCiiTopologyElementLengthAssignments,
} from '../viewer/converters/xml-cii2019-core/topology/xml-cii-topology-element-length.js';

function tag(name, value = '') { return `<${name}>${value}</${name}>`; }
function restraint(type, stiffness = 0, gap = 0, friction = 0.3) {
  return `<Restraint>${tag('Type', type)}${tag('Stiffness', stiffness)}${tag('Gap', gap)}${tag('Friction', friction)}</Restraint>`;
}
function node(fields, extra = '') {
  return '<Node>' + Object.entries(fields).map(([key, value]) => tag(key, value)).join('') + extra + '</Node>';
}
function doc(nodes) {
  return '<?xml version="1.0"?><Root><Branch><Branchname>/TEST/B1</Branchname>' + nodes.join('\n') + '</Branch></Root>';
}
function byNode(assignments, nodeNumber) {
  return assignments.find((assignment) => String(assignment.nodeNumber) === String(nodeNumber));
}
function skippedByNode(skipped, nodeNumber) {
  return skipped.find((item) => String(item.nodeNumber) === String(nodeNumber));
}
function lengthFromXml(xmlText, nodeNumber) {
  const block = (String(xmlText || '').match(/<Node\b[\s\S]*?<\/Node>/gi) || []).find((item) => item.includes(tag('NodeNumber', nodeNumber))) || '';
  const value = block.match(/<ElementLengthMm>([\s\S]*?)<\/ElementLengthMm>/i)?.[1];
  return Number(value);
}

const supportElbowOletFixture = doc([
  node({ NodeNumber: 440, NodeName: 'PS-11314/DATUM', Endpoint: 0, ComponentType: 'ATTA', ComponentRefNo: '=1006649732/114320', Position: '189526.22 -1101825.00 102509.55' }, restraint('+Y', 1751270031350)),
  node({ NodeNumber: 450, NodeName: 'PS-11314/SREF', Endpoint: 0, ComponentType: 'ATTA', ComponentRefNo: '=1006649732/114321', Position: '189526.22 -1101825.00 102509.55' }),
  node({ NodeNumber: 460, NodeName: 'PS-11314.1', Endpoint: 0, ComponentType: 'ATTA', ComponentRefNo: '=1006649732/114322', Position: '189526.22 -1101825.00 102509.55' }, restraint('Z')),
  node({ NodeNumber: -1, Endpoint: 1, ComponentType: 'ELBO', ComponentRefNo: '=1006649732/114323', Position: '189078.22 -1101825.00 102509.55', BendRadius: 305 }),
  node({ NodeNumber: 470, Endpoint: 0, ComponentType: 'ELBO', ComponentRefNo: '=1006649732/114323', Position: '188773.22 -1101825.00 102509.55', BendRadius: 305 }),
  node({ NodeNumber: -1, Endpoint: 2, ComponentType: 'ELBO', ComponentRefNo: '=1006649732/114323', Position: '188773.22 -1101520.00 102509.55', BendRadius: 305 }),
  node({ NodeNumber: -1, Endpoint: 1, ComponentType: 'ELBO', ComponentRefNo: '=1006649732/114324', Position: '188773.22 -1100930.00 102509.55', BendRadius: 305 }),
  node({ NodeNumber: 480, Endpoint: 0, ComponentType: 'ELBO', ComponentRefNo: '=1006649732/114324', Position: '188773.22 -1100625.00 102509.55', BendRadius: 305 }),
  node({ NodeNumber: -1, Endpoint: 2, ComponentType: 'ELBO', ComponentRefNo: '=1006649732/114324', Position: '188468.22 -1100625.00 102509.55', BendRadius: 305 }),
  node({ NodeNumber: -1, Endpoint: 1, ComponentType: 'ELBO', ComponentRefNo: '=1006649732/114325', Position: '187578.22 -1100625.00 102509.55', BendRadius: 305 }),
  node({ NodeNumber: 490, Endpoint: 0, ComponentType: 'ELBO', ComponentRefNo: '=1006649732/114325', Position: '187273.22 -1100625.00 102509.55', BendRadius: 305 }),
  node({ NodeNumber: -1, Endpoint: 2, ComponentType: 'ELBO', ComponentRefNo: '=1006649732/114325', Position: '187273.22 -1100625.00 102204.55', BendRadius: 305 }),
  node({ NodeNumber: -1, Endpoint: 1, ComponentType: 'OLET', ComponentRefNo: '=1006649732/114326', Position: '187273.22 -1100625.00 101654.55' }),
  node({ NodeNumber: -1, Endpoint: 3, ComponentType: 'OLET', ComponentRefNo: '=1006649732/114326', Position: '187273.22 -1100477.35 101654.55' }),
  node({ NodeNumber: 500, Endpoint: 0, ComponentType: 'OLET', ComponentRefNo: '=1006649732/114326', Position: '187273.22 -1100625.00 101654.55' }),
]);

const supportElbowOlet = collectXmlCiiTopologyElementLengthAssignments(supportElbowOletFixture);
assert.equal(byNode(supportElbowOlet.assignments, 470).lengthMm, 753.000, 'node 470 must store support-location to elbow-node incoming span');
assert.equal(byNode(supportElbowOlet.assignments, 480).lengthMm, 1200.000, 'node 480 must store 470->480 incoming route span');
assert.equal(byNode(supportElbowOlet.assignments, 490).lengthMm, 1500.000, 'node 490 must store 480->490 incoming route span');
assert.equal(byNode(supportElbowOlet.assignments, 500).lengthMm, 855.000, 'node 500 must store 490->OLET incoming route span');
assert.equal(skippedByNode(supportElbowOlet.skipped, 450).reason, 'support-reference-sref', 'SREF node must be reference-only, not a route span target');
assert.equal(skippedByNode(supportElbowOlet.skipped, 440).reason, 'support-restraint-no-element-length', 'support restraint must not receive ElementLengthMm');

const appliedSupportElbowOlet = applyXmlCiiTopologyElementLengths(supportElbowOletFixture);
assert.equal(lengthFromXml(appliedSupportElbowOlet.xmlText, 470), 753.000);
assert.equal(lengthFromXml(appliedSupportElbowOlet.xmlText, 480), 1200.000);
assert.equal(lengthFromXml(appliedSupportElbowOlet.xmlText, 490), 1500.000);
assert.equal(lengthFromXml(appliedSupportElbowOlet.xmlText, 500), 855.000);

const rigidBeforeSplitFixture = doc([
  node({ NodeNumber: 100, Endpoint: 0, ComponentType: 'PIPE', ComponentRefNo: '=P1', Position: '0 0 0' }),
  node({ NodeNumber: 110, Endpoint: 0, ComponentType: 'RIGID', ComponentRefNo: '=R1', Position: '600 0 0', ElementLengthMm: '0.000' }),
  node({ NodeNumber: 120, Endpoint: 0, ComponentType: 'PIPE', ComponentRefNo: '=P2', Position: '900 0 0' }),
]);
const rigidBeforeSplit = collectXmlCiiTopologyElementLengthAssignments(rigidBeforeSplitFixture);
assert.equal(byNode(rigidBeforeSplit.assignments, 110).lengthMm, 600.000, 'single pre-split RIGID node must store incoming route span');
assert.equal(byNode(rigidBeforeSplit.assignments, 120).lengthMm, 300.000, 'downstream pipe must continue from corrected RIGID route point');

const rigidAfterSplitFixture = doc([
  node({ NodeNumber: 100, Endpoint: 0, ComponentType: 'PIPE', ComponentRefNo: '=P1', Position: '0 0 0' }),
  node({ NodeNumber: 105, Endpoint: 1, ComponentType: 'RIGID', ComponentRefNo: '=R1', Position: '3.2 0 0', ElementLengthMm: '600.000' }),
  node({ NodeNumber: 110, Endpoint: 2, ComponentType: 'RIGID', ComponentRefNo: '=R1', Position: '603.2 0 0', ElementLengthMm: '600.000' }),
  node({ NodeNumber: 120, Endpoint: 0, ComponentType: 'PIPE', ComponentRefNo: '=P2', Position: '900 0 0' }),
]);
const rigidAfterSplit = collectXmlCiiTopologyElementLengthAssignments(rigidAfterSplitFixture);
assert.equal(byNode(rigidAfterSplit.assignments, 105).lengthMm, 3.200, 'post-split RIGID endpoint 1 must store incoming short gap');
assert.equal(byNode(rigidAfterSplit.assignments, 110).lengthMm, 600.000, 'post-split RIGID endpoint 2 must store RIGID component span');
assert.equal(byNode(rigidAfterSplit.assignments, 120).lengthMm, 296.800, 'downstream pipe must continue after RIGID endpoint 2');

const valveSplitFixture = doc([
  node({ NodeNumber: 1466, Endpoint: 2, ComponentType: 'FLAN', ComponentRefNo: '=F1', ElementLengthMm: '147.000', Position: '189617.99 -1103125.00 101184.15' }),
  node({ NodeNumber: 1467, Endpoint: 1, ComponentType: 'VALV', ComponentRefNo: '=V1', ElementLengthMm: '610.000', Position: '189621.19 -1103125.00 101184.15' }),
  node({ NodeNumber: 1468, Endpoint: 2, ComponentType: 'VALV', ComponentRefNo: '=V1', ElementLengthMm: '610.000', Position: '190231.19 -1103125.00 101184.15' }),
]);
const valveSplit = collectXmlCiiTopologyElementLengthAssignments(valveSplitFixture);
assert.equal(byNode(valveSplit.assignments, 1467).lengthMm, 3.200, 'VALV endpoint 1 must store incoming gap from previous FLAN endpoint');
assert.equal(byNode(valveSplit.assignments, 1468).lengthMm, 610.000, 'VALV endpoint 2 must store valve pair span');

console.log('XML CII topology element length test passed', {
  supportElbowOletAssignments: supportElbowOlet.assignments.length,
  rigidBeforeSplitAssignments: rigidBeforeSplit.assignments.length,
  rigidAfterSplitAssignments: rigidAfterSplit.assignments.length,
  valveSplitAssignments: valveSplit.assignments.length,
});
