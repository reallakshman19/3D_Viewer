import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const coreDir = path.join(__dirname, '../viewer/converters/xml-cii2019-core');

const { parseXmlCiiEnrichmentConfig } = await import(new URL(`file://${path.join(coreDir, 'config.js').replace(/\\/g, '/')}`).href);
const support = await import(new URL(`file://${path.join(coreDir, 'support-mapping.js').replace(/\\/g, '/')}`).href);

const {
  buildStagedSupportIndex,
  resolveXmlCiiSupportDescriptor,
  resolveXmlCiiSupportKind,
  restraintEntriesFromSupportKind,
  xmlCiiRestraintEntriesFromSupportMatch,
  xmlCiiTypeEntriesFromSupportKind,
} = support;

const config = parseXmlCiiEnrichmentConfig('');

assert.strictEqual(resolveXmlCiiSupportKind({ CMPSUPTYPE: 'BP-100' }, config), 'REST');
assert.strictEqual(resolveXmlCiiSupportKind({ CMPSUPTYPE: 'PG-200' }, config), 'GUIDE');
assert.strictEqual(resolveXmlCiiSupportKind({ CMPSUPTYPE: 'LS-300' }, config), 'LINESTOP');

const descriptor = resolveXmlCiiSupportDescriptor({ SKEY: 'CA100', CMPSUPTYPE: 'PG-200' }, config);
assert.strictEqual(descriptor.primaryKind, 'REST');
assert.deepStrictEqual(descriptor.kinds, ['REST', 'GUIDE']);

assert.deepStrictEqual(xmlCiiTypeEntriesFromSupportKind('REST', config), ['+Y']);
assert.deepStrictEqual(xmlCiiTypeEntriesFromSupportKind('GUIDE', config), ['GUI']);
assert.deepStrictEqual(xmlCiiTypeEntriesFromSupportKind('LINESTOP', config), ['LIM']);

const staged = [
  {
    type: 'SUPPORT',
    name: '/PS-100.1',
    attributes: {
      CMPSUPTYPE: 'PG-100',
      SUPPORTCOORD: '100 200 300',
      PIPE_AXIS_COSINES: '2 0 0',
    },
  },
];

const diagnostics = [];
const index = buildStagedSupportIndex(JSON.stringify(staged), config, diagnostics);
assert.strictEqual(index.count, 1);
assert.ok(index.byCoord.has('100|200|300'), 'coordinate key must use real coordinates, not a unit vector');
assert.ok(index.byTag.has('PS-100'));
assert.strictEqual(diagnostics[0].type, 'staged-support-index');

const restEntries = restraintEntriesFromSupportKind('REST', {}, null, config);
assert.strictEqual(restEntries[0].type, '+Y');
assert.deepStrictEqual(restEntries[0].direction, { x: 0, y: 1, z: 0 });

const lineStopEntries = xmlCiiRestraintEntriesFromSupportMatch({
  kind: 'LINESTOP',
  attrs: { PIPE_AXIS_COSINES: '2 0 0' },
}, null, config);
assert.strictEqual(lineStopEntries[0].type, 'LIM');
assert.strictEqual(lineStopEntries[0].frictionMode, 'sentinel');
assert.deepStrictEqual(lineStopEntries[0].direction, { x: 1, y: 0, z: 0 });

const guideEntries = xmlCiiRestraintEntriesFromSupportMatch({
  kind: 'GUIDE',
  attrs: { PIPE_AXIS_COSINES: '2 0 0' },
}, null, config);
assert.strictEqual(guideEntries[0].type, 'GUI');
assert.strictEqual(guideEntries[0].frictionMode, 'sentinel');
assert.ok(Math.abs(guideEntries[0].direction.x - 0) < 1e-12);
assert.ok(Math.abs(guideEntries[0].direction.y - 0) < 1e-12);
assert.ok(Math.abs(Math.abs(guideEntries[0].direction.z) - 1) < 1e-12);

console.log('✅ support mapping core regression tests passed');
