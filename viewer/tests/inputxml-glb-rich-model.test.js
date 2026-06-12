import assert from 'node:assert/strict';
import fs from 'node:fs';

import { extractInputXmlBranches } from '../converters/inputxml-dxf/InputXmlBranchExtractor.js';
import { adaptUxmlToGlbModel } from '../converters/inputxml-glb/UxmlToGlbModelAdapter.js';
import { buildComponentObject } from '../js/pcf2glb/glb/buildComponentObject.js';

const fixtureUrl = new URL('../../Benchmarks/INPUT XML to CII 2019/1001/1001-P - COPY_INPUT.XML', import.meta.url);
const xmlText = fs.readFileSync(fixtureUrl, 'utf8');

const extracted = extractInputXmlBranches(xmlText, {
  sourceId: 'inputxml-glb-test',
  fileName: 'benchmark.xml',
});

assert.equal(extracted.ok, true);
assert.ok(extracted.doc.components.length > 0);
assert.ok(extracted.doc.segments.length > 0);

const { model, stats, diagnostics } = adaptUxmlToGlbModel(extracted.doc);
assert.equal(model.schema, 'inputxml-glb-model/v1');
assert.ok(model.components.length > 0);
assert.equal(stats.componentCount, model.components.length);
assert.ok(stats.typeCounts.PIPE > 0);

const pipe = model.components.find((component) => component.type === 'PIPE');
assert.ok(pipe);
assert.ok(Number.isFinite(pipe.ep1.x));
assert.ok(Number.isFinite(pipe.ep2.x));
assert.ok(pipe.bore > 0);
assert.ok(pipe.attributes.uxmlSegmentId);

const supports = model.components.filter((component) => component.type === 'SUPPORT');
assert.ok(supports.length > 0);
assert.ok(supports.every((support) => support.coOrds));
assert.ok(supports.every((support) => support.supportKind));
assert.ok(Object.keys(stats.supportKindCounts).length > 0);

const filtered = adaptUxmlToGlbModel(extracted.doc, {
  selectedBranches: extracted.branches[0]?.id || '',
});
assert.ok(filtered.model.components.length <= model.components.length);
assert.deepEqual(diagnostics.filter((item) => item.severity === 'ERROR'), []);

function sampleComponent(type, id = type) {
  return {
    id,
    type,
    bore: 20,
    ep1: { x: 0, y: 0, z: 0, bore: 20 },
    ep2: { x: 100, y: 0, z: 0, bore: 20 },
    centrePoint: { x: 50, y: 0, z: 0 },
    branch1Point: { x: 50, y: 60, z: 0, bore: 15 },
    refNo: id,
    attributes: { COMPONENT_IDENTIFIER: id },
  };
}

const elbowObject = buildComponentObject(sampleComponent('ELBOW', 'ELBOW-TEST'));
assert.equal(elbowObject.userData.glbShape, 'rounded-elbow-tube');
assert.equal(elbowObject.geometry?.type, 'TubeGeometry');

const teeObject = buildComponentObject(sampleComponent('TEE', 'TEE-TEST'));
assert.equal(teeObject.userData.glbShape, 'tee-branch-collar');
assert.ok(teeObject.getObjectByName('TEE-TEST-main-run'));
assert.ok(teeObject.getObjectByName('TEE-TEST-branch'));
assert.ok(teeObject.getObjectByName('TEE-TEST-tee-collar'));

const flangeObject = buildComponentObject(sampleComponent('FLANGE', 'FLANGE-TEST'));
assert.equal(flangeObject.userData.glbShape, 'flange-ring-pair');
assert.ok(flangeObject.getObjectByName('FLANGE-TEST-flange-ring-1'));
assert.ok(flangeObject.getObjectByName('FLANGE-TEST-flange-ring-2'));

const valveObject = buildComponentObject(sampleComponent('VALVE', 'VALVE-TEST'));
assert.equal(valveObject.userData.glbShape, 'valve-body-handwheel');
assert.ok(valveObject.getObjectByName('VALVE-TEST-valve-body'));
assert.ok(valveObject.getObjectByName('VALVE-TEST-valve-handwheel'));
assert.match(valveObject.getObjectByName('label:VALVE-TEST')?.name || '', /label:/);

const tabSource = fs.readFileSync(new URL('../tabs/model-converters-tab.js', import.meta.url), 'utf8');
assert.match(tabSource, /installInputXmlGlbLegacyBridge/);

const runnerSource = fs.readFileSync(new URL('../converters/inputxml-glb/inputxml-to-glb-runner.js', import.meta.url), 'utf8');
assert.match(runnerSource, /buildExportScene/);
assert.match(runnerSource, /exportSceneToGLB/);

const bridgeSource = fs.readFileSync(new URL('../tabs/model-converters/inputxml-glb-legacy-bridge.js', import.meta.url), 'utf8');
assert.match(bridgeSource, /InputXML.*GLB Rich 3D Model/);
assert.match(bridgeSource, /data-inputxml-glb-output/);

console.log('inputxml-glb-rich-model.test.js passed');
