import assert from 'node:assert/strict';

import { extractInputXmlBranches } from '../converters/inputxml-dxf/InputXmlBranchExtractor.js';
import { applyInputXmlCaesarSupportMetadata } from '../converters/inputxml-glb/InputXmlCaesarSupportMetadata.js';
import { appendInputXmlGlbNodeLabels } from '../converters/inputxml-glb/InputXmlGlbNodeLabels.js';
import { adaptUxmlToGlbModel } from '../converters/inputxml-glb/UxmlToGlbModelAdapter.js';
import { buildExportScene } from '../js/pcf2glb/glb/buildExportScene.js';

const xmlText = [
  '<CAESARII>',
  '<PIPINGMODEL LineNo="L-200-A">',
  '<PIPINGELEMENT FROM_NODE="200" TO_NODE="205" DELTA_X="100" DELTA_Y="0" DELTA_Z="0" DIAMETER="20">',
  '<RESTRAINT NODE="205" TYPE="1" XCOSINE="0" YCOSINE="1" ZCOSINE="0"/>',
  '</PIPINGELEMENT>',
  '</PIPINGMODEL>',
  '</CAESARII>',
].join('');

const extracted = extractInputXmlBranches(xmlText, {
  sourceId: 'line-no-node-label-test',
  fileName: 'line-no.xml',
});

assert.equal(extracted.ok, true);
assert.equal(extracted.branches[0]?.lineNo, 'L-200-A');

applyInputXmlCaesarSupportMetadata(xmlText, extracted.doc, { sourceId: 'line-no-node-label-test' });
const { model, stats } = adaptUxmlToGlbModel(extracted.doc);
const nodeLabelStats = appendInputXmlGlbNodeLabels(model, extracted.doc, stats);

assert.equal(model.lineNo, 'L-200-A');
assert.deepEqual(model.lineNos, ['L-200-A']);
assert.equal(stats.lineNo, 'L-200-A');
assert.deepEqual(stats.lineNos, ['L-200-A']);

const nodeNumbers = [...new Set(extracted.doc.anchors.map((anchor) => anchor.nodeNumber).filter(Boolean))].sort();
assert.deepEqual(nodeNumbers, ['200', '205']);
assert.equal(nodeLabelStats.nodeLabelCount, 2);

const nodeLabels = model.components
  .filter((component) => component.type === 'NODE_LABEL')
  .map((component) => component.label)
  .sort();
assert.deepEqual(nodeLabels, ['200', '205']);
assert.ok(nodeLabels.every((label) => !/EP[12]|SUPPORT_POINT|IX-A/i.test(label)));

const pipe = model.components.find((component) => component.type === 'PIPE');
assert.ok(pipe);
assert.equal(pipe.lineNo, 'L-200-A');
assert.equal(pipe.attributes.lineNo, 'L-200-A');

const scene = buildExportScene(model);
const root = scene.getObjectByName('PCF_EXPORT_ROOT');
assert.ok(root);
assert.equal(root.userData.lineNo, 'L-200-A');
assert.deepEqual(root.userData.lineNos, ['L-200-A']);

const pipeObject = scene.getObjectByName(pipe.id);
assert.ok(pipeObject);
assert.equal(pipeObject.userData.lineNo, 'L-200-A');

console.log('inputxml-glb-line-no-metadata.test.js passed');
