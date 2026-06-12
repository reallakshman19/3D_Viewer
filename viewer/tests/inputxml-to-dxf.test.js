import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { extractInputXmlBranches } from '../converters/inputxml-dxf/InputXmlBranchExtractor.js';
import { projectToDxfGeometry } from '../converters/inputxml-dxf/InputXmlToDxfProjector.js';
import { writeInputXmlDxf } from '../converters/inputxml-dxf/InputXmlToDxfWriter.js';
import { run } from '../converters/inputxml-dxf/inputxml-to-dxf-runner.js';
import { lineEntity, pointEntity } from '../vendor/dxf-lines.js';
import { lineEntity as packageLineEntity, pointEntity as packagePointEntity } from '../../third_party/pipe-component-data/src/dxf/dxfLines.js';

const fixturePath = new URL('../../Benchmarks/INPUT XML to CII 2019/1001/1001-P - COPY_INPUT.XML', import.meta.url);
const xmlText = await fs.readFile(fixturePath, 'utf8');

const extraction = extractInputXmlBranches(xmlText, { fileName: '1001-P - COPY_INPUT.XML' });
assert.equal(extraction.ok, true, 'extractor returns ok=true for benchmark InputXML');
assert.ok(extraction.branches.length >= 1, 'extractor returns at least one branch');
assert.ok(extraction.branches.every((branch) => branch.id && branch.label && Array.isArray(branch.aliases)), 'branches have id/label/aliases');
assert.ok(extraction.branches.reduce((sum, branch) => sum + branch.componentCount, 0) > 0, 'branch component counts are populated');
assert.ok(extraction.doc.components.length > 0, 'UXML doc has components');
assert.ok(extraction.doc.anchors.length > 0, 'UXML doc has anchors');

const allGeometry = projectToDxfGeometry(extraction.doc, { selectedBranches: '' });
assert.ok(allGeometry.segments.length > 0, 'all-branch projection emits segments');
assert.equal(allGeometry.supports.length, 5, '1001 fixture projects 5 support points');

const componentById = new Map((extraction.doc.components || []).map((component) => [component.id, component]));
for (const segment of allGeometry.segments) {
  const component = componentById.get(segment.componentId);
  const type = String(component?.type || component?.normalizedType || '').toUpperCase();
  assert.ok(!type.includes('SUPPORT'), 'support component is not also drawn as a segment');
}

const firstBranch = extraction.branches[0];
const selectedGeometry = projectToDxfGeometry(extraction.doc, { selectedBranches: firstBranch.id });
assert.ok(selectedGeometry.segments.length <= allGeometry.segments.length, 'selected branch exports fewer or equal segments than all branches');

const unknownGeometry = projectToDxfGeometry(extraction.doc, { selectedBranches: '__UNKNOWN_BRANCH__' });
assert.equal(unknownGeometry.segments.length, 0, 'unknown branch exports zero segments');
assert.equal(unknownGeometry.supports.length, 0, 'unknown branch exports zero supports');

const { dxf, sidecar } = writeInputXmlDxf({
  segments: allGeometry.segments,
  supports: allGeometry.supports,
  branches: extraction.branches,
  diagnostics: allGeometry.diagnostics,
}, {
  sourceName: '1001-P - COPY_INPUT.XML',
  dxfScale: 1,
});

assert.ok(dxf.includes('SECTION'), 'DXF contains SECTION');
assert.ok(dxf.includes('HEADER'), 'DXF contains HEADER');
assert.ok(dxf.includes('$INSUNITS'), 'DXF contains INSUNITS header');
assert.ok(dxf.includes('TABLES'), 'DXF contains TABLES');
assert.ok(dxf.includes('ENTITIES'), 'DXF contains ENTITIES');
assert.ok(dxf.includes('LINE'), 'DXF contains LINE entities');
assert.ok(dxf.trim().endsWith('EOF'), 'DXF ends with EOF');
assert.equal(sidecar.segmentCount, allGeometry.segments.length, 'sidecar segmentCount matches projection');
assert.equal(sidecar.supportCount, allGeometry.supports.length, 'sidecar supportCount matches projection');
assert.equal(sidecar.branchCount, extraction.branches.length, 'sidecar branchCount matches extraction');
assert.ok(Array.isArray(sidecar.branches), 'sidecar exposes branch manifest');
assert.equal(sidecar.branches.length, extraction.branches.length, 'sidecar branch manifest length matches extraction');
assert.ok(sidecar.branches[0].id, 'sidecar branch manifest exposes branch id');
assert.ok(Array.isArray(sidecar.branches[0].aliases), 'sidecar branch manifest exposes aliases');
assert.equal(sidecar.selectedBranchCount, extraction.branches.length, 'empty selectedBranchIds means all branches selected in sidecar');
assert.deepEqual(sidecar.selectedBranchIds, [], 'empty selection keeps selectedBranchIds empty');
assert.equal(sidecar.selectedBranches.length, extraction.branches.length, 'empty selection lists all selectedBranches');

const selectedWrite = writeInputXmlDxf({
  segments: selectedGeometry.segments,
  supports: selectedGeometry.supports,
  branches: extraction.branches,
  diagnostics: selectedGeometry.diagnostics,
}, {
  sourceName: '1001-P - COPY_INPUT.XML',
  selectedBranchIds: selectedGeometry.selectedBranchIds,
});
assert.equal(selectedWrite.sidecar.selectedBranchCount, 1, 'selected sidecar reports one selected branch');
assert.deepEqual(selectedWrite.sidecar.selectedBranchIds, [firstBranch.id], 'selected sidecar preserves selected branch id');
assert.equal(selectedWrite.sidecar.selectedBranches.length, 1, 'selected sidecar lists selected branch metadata');

const scaled = writeInputXmlDxf({
  segments: [{ id: 'scale', layer: 'PIPING', p1: { x: 1, y: 2, z: 3 }, p2: { x: 4, y: 5, z: 6 }, label: '' }],
  supports: [],
  branches: [],
}, { dxfScale: 2, showLabels: false }).dxf;
assert.ok(scaled.includes('\n10\n2\n20\n4\n30\n6\n'), 'scale=2 doubles start coordinate once');

const sampleStart = { x: 1.2345678, y: 2, z: 3 };
const sampleEnd = { x: 4, y: 5.4321987, z: 6 };
assert.deepEqual(lineEntity('L1', sampleStart, sampleEnd, 'PIPING'), packageLineEntity('L1', sampleStart, sampleEnd, 'PIPING'), 'vendor LINE tokens match package writer');
assert.deepEqual(pointEntity('P1', sampleStart, 'SUPPORTS'), packagePointEntity('P1', sampleStart, 'SUPPORTS'), 'vendor POINT tokens match package writer');

const output = await run({
  inputFiles: [{ role: 'primary', name: '1001.xml', text: xmlText }],
  options: { selectedBranches: '', includeSidecarJson: true },
  setStatus: () => {},
});
assert.equal(output.ok, true, 'runner returns ok=true');
assert.ok(output.outputs.some((item) => item.name === '1001.dxf'), 'runner emits stem.dxf');
assert.ok(output.outputs.some((item) => item.name === '1001-sidecar.json'), 'runner emits stem-sidecar.json');
assert.ok(Array.isArray(output.logs.stdout) && output.logs.stdout.length > 0, 'runner logs stdout entries');
assert.ok(output.logs.stdout.some((line) => line.includes('Available branches')), 'runner logs available branch manifest');
assert.ok(output.logs.stdout.some((line) => line.includes(firstBranch.id)), 'runner logs a copyable branch id');
assert.ok(output.logs.stdout.some((line) => line.includes('Selected branch ids: <all branches')), 'runner logs all-branch selection hint');

const sidecarOutput = output.outputs.find((item) => item.name === '1001-sidecar.json');
const parsedSidecar = JSON.parse(sidecarOutput.text);
assert.equal(parsedSidecar.segmentCount, allGeometry.segments.length, 'runner sidecar segmentCount is stable');
assert.ok(Array.isArray(parsedSidecar.branches), 'runner sidecar exposes branches');
assert.ok(parsedSidecar.branches.some((branch) => branch.id === firstBranch.id), 'runner sidecar includes copyable branch id');

const selectedOutput = await run({
  inputFiles: [{ role: 'primary', name: '1001.xml', text: xmlText }],
  options: { selectedBranches: firstBranch.id, includeSidecarJson: true },
  setStatus: () => {},
});
assert.equal(selectedOutput.ok, true, 'selected runner returns ok=true');
assert.ok(selectedOutput.logs.stdout.some((line) => line.includes(`Selected branch ids: ${firstBranch.id}`)), 'selected runner logs selected branch id');
const selectedSidecar = JSON.parse(selectedOutput.outputs.find((item) => item.name === '1001-sidecar.json').text);
assert.deepEqual(selectedSidecar.selectedBranchIds, [firstBranch.id], 'selected runner sidecar preserves selectedBranchIds');
assert.equal(selectedSidecar.selectedBranches.length, 1, 'selected runner sidecar exposes selected branch metadata');

const empty = await run({
  inputFiles: [{ role: 'primary', name: 'empty.xml', text: '' }],
  options: {},
  setStatus: () => {},
});
assert.equal(empty.ok, false, 'empty XML returns ok=false');
assert.ok(empty.logs.stderr.join('\n').includes('failed'), 'empty XML has failure log');

try {
  const { getConverterById } = await import('../tabs/model-converters/converter-registry.js');
  const converter = getConverterById('inputxml_to_dxf');
  assert.ok(converter, 'converter registry contains inputxml_to_dxf');
  assert.equal(converter.group, 'CAESAR II', 'converter is grouped under CAESAR II');
  assert.ok(converter.inputs[0].accept.includes('.xml'), 'converter accepts XML input');
} catch {
  const registryPath = new URL('../tabs/model-converters/converter-registry.js', import.meta.url);
  const source = await fs.readFile(registryPath, 'utf8');
  assert.ok(source.includes('inputxml_to_dxf'), 'registry source contains inputxml_to_dxf');
  assert.ok(source.includes('InputXML→DXF'), 'registry source contains InputXML→DXF label');
}

console.log('inputxml-to-dxf tests passed');
