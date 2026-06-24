import assert from 'node:assert/strict';
import { normalizeSupportTag as normalizeDtxrSupportTag, buildStagedDtxrIndex, resolveDtxrForXmlNode } from '../viewer/converters/xml-cii2019-core/dtxr-resolver.js';
import { normalizeSupportTag as normalizeMappingSupportTag, buildStagedSupportIndex, xmlCiiRestraintEntriesFromSupportMatch } from '../viewer/converters/xml-cii2019-core/support-mapping.js';
import { normalizeSupportTag as normalizePcfSupportTag, resolveSupportMatchForPcfRow } from '../viewer/converters/xml-cii2019-core/support-pcf-row-matcher.js';
import { normalizePsKey, psCandidateKeys } from '../viewer/converters/xml-cii2019-core/sideload-resolver.js';

for (const normalize of [normalizeDtxrSupportTag, normalizeMappingSupportTag, normalizePcfSupportTag]) {
  assert.equal(normalize('PS-11236.8'), 'PS-11236.8');
  assert.equal(normalize('/ps-11236.8'), 'PS-11236.8');
  assert.equal(normalize('PS-11236'), 'PS-11236');
}
assert.equal(normalizePsKey('/ps-11236.8'), 'PS-11236.8');
assert.deepEqual(psCandidateKeys('PS-11236.8'), ['PS-11236.8']);

const stagedJson = JSON.stringify({ type: 'BRANCH', children: [
  { type: 'SUPPORT', attributes: { TYPE: 'SUPPORT', DTXR_PS: 'PS-11236', SUPPORT_KIND: 'GUIDE', CMPSUPGAP: '10' } },
  { type: 'SUPPORT', attributes: { TYPE: 'SUPPORT', DTXR_PS: 'PS-11236.8', SUPPORT_KIND: 'LINESTOP', CMPSUPGAP: '25' } },
] });

const xmlSupportNode = { ComponentType: 'SUPPORT', NodeName: '/ps-11236.8', ComponentRefNo: 'PS-11236.8', SupportTag: '/ps-11236.8' };
const resolved = resolveDtxrForXmlNode({ xmlNode: xmlSupportNode, context: buildStagedDtxrIndex(stagedJson), purpose: 'support-restraint', trustExistingXmlDtxr: false });
assert.equal(resolved.matchedKey, 'PS-11236.8');
assert.equal(resolved.dtxrPs, 'PS-11236.8');
assert.equal(resolved.cmpSupGap, '25');

const supportConfig = { supportKindToXmlType: { GUIDE: ['GUI'], LINESTOP: ['LIM'] } };
const supportIndex = buildStagedSupportIndex(stagedJson, supportConfig, []);
assert.equal(supportIndex.byTag.get('PS-11236.8')?.[0]?.attrs?.DTXR_PS, 'PS-11236.8');
assert.ok(!supportIndex.byTag.get('PS-11236.8')?.some((item) => item.attrs?.DTXR_PS === 'PS-11236'));
const supportMatch = resolveSupportMatchForPcfRow({ nodeName: '/ps-11236.8' }, supportIndex, supportConfig);
assert.equal(supportMatch?.attrs?.DTXR_PS, 'PS-11236.8');
assert.equal(supportMatch?.primaryKind, 'LINESTOP');
const restraints = xmlCiiRestraintEntriesFromSupportMatch(supportMatch, null, supportConfig);
assert.equal(restraints[0]?.supportKind, 'LINESTOP');
assert.equal(restraints[0]?.type, 'LIM');

console.log('✓ XML CII exact decimal PS tag restraint regression passed');
