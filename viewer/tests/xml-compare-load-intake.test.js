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

console.log('xml-compare-load-intake: all assertions passed');
