import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { extractInputXmlBranches } from '../converters/inputxml-dxf/InputXmlBranchExtractor.js';
import { projectToDxfGeometry } from '../converters/inputxml-dxf/InputXmlToDxfProjector.js';

const fixturePath = new URL('../../Benchmarks/INPUT XML to CII 2019/1001/1001-P - COPY_INPUT.XML', import.meta.url);
const xmlText = await fs.readFile(fixturePath, 'utf8');

const extraction = extractInputXmlBranches(xmlText, { fileName: '1001-P - COPY_INPUT.XML' });
assert.equal(extraction.ok, true, 'extractor ok=true');
assert.ok(extraction.branches.length >= 1, 'fixture has at least one branch');

// Empty selectedBranches → all branches included
const allGeometry = projectToDxfGeometry(extraction.doc, { selectedBranches: '' });
assert.ok(allGeometry.segments.length > 0, 'empty selectedBranches returns all segments');

// Single branch by label (projector matches on label/alias)
const first = extraction.branches[0];
const oneGeometry = projectToDxfGeometry(extraction.doc, { selectedBranches: first.label });
assert.ok(oneGeometry.segments.length > 0, 'single branch label returns segments');
assert.ok(oneGeometry.segments.length <= allGeometry.segments.length, 'single branch ≤ all segments');

// Comma-separated labels (deduplicate when fixture only has one branch)
const second = extraction.branches[1] ?? extraction.branches[0];
const twoGeometry = projectToDxfGeometry(extraction.doc, { selectedBranches: `${first.label},${second.label}` });
assert.ok(twoGeometry.segments.length >= oneGeometry.segments.length, 'comma-separated labels ≥ single branch segments');

// Unknown label produces empty result
const noneGeometry = projectToDxfGeometry(extraction.doc, { selectedBranches: '__NO_SUCH_BRANCH__' });
assert.equal(noneGeometry.segments.length, 0, 'unknown branch label → zero segments');
assert.equal(noneGeometry.supports.length, 0, 'unknown branch label → zero supports');

console.log('inputxml-dxf-branch-picker tests passed');
