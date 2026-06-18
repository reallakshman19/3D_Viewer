import assert from 'node:assert/strict';
import { convertUxmlDocumentToAvevaHierarchy } from '../rvm/UxmlToAvevaJsonAdapter.js';

const doc = {
  schemaVersion: 'uxml/v1',
  profile: 'UXML_TEST',
  header: { modelId: 'uxml-support-parity-test' },
  pipelines: [
    { id: 'pipe:main', pipelineRef: 'TEST-LINE', lineKey: 'TEST-LINE', rawAttributes: { NAME: 'TEST-LINE', TYPE: 'BRAN' } },
  ],
  anchors: [
    { id: 'a:pipe:start', componentId: 'cmp:pipe:00001', role: 'START', point: { x: 0, y: 0, z: 0 } },
    { id: 'a:pipe:end', componentId: 'cmp:pipe:00001', role: 'END', point: { x: 1000, y: 0, z: 0 } },
    { id: 'a:support:pos', componentId: 'cmp:support:00002', role: 'CENTER', point: { x: 500, y: -120, z: 0 } },
  ],
  ports: [
    { id: 'p:pipe:start', componentId: 'cmp:pipe:00001', anchorId: 'a:pipe:start', role: 'START', bore: 250, boreField: 'ABORE' },
    { id: 'p:pipe:end', componentId: 'cmp:pipe:00001', anchorId: 'a:pipe:end', role: 'END', bore: 250, boreField: 'LBORE' },
    { id: 'p:support:pos', componentId: 'cmp:support:00002', anchorId: 'a:support:pos', role: 'CENTER' },
  ],
  segments: [
    { id: 'seg:pipe:00001', componentId: 'cmp:pipe:00001', type: 'CENTERLINE', startAnchorId: 'a:pipe:start', endAnchorId: 'a:pipe:end', bore: 250, startBore: 250, endBore: 250 },
  ],
  components: [
    {
      id: 'cmp:pipe:00001',
      type: 'PIPE',
      normalizedType: 'PIPE',
      pipelineRef: 'pipe:main',
      lineKey: 'TEST-LINE',
      name: 'PIPE AUTO TEST',
      bore: 250,
      anchorIds: ['a:pipe:start', 'a:pipe:end'],
      portIds: ['p:pipe:start', 'p:pipe:end'],
      segmentIds: ['seg:pipe:00001'],
      rawAttributes: { TYPE: 'PIPE', NAME: 'PIPE AUTO TEST', BORE: '250mm' },
    },
    {
      id: 'cmp:support:00002',
      type: 'SUPPORT',
      normalizedType: 'SUPPORT',
      pipelineRef: 'pipe:main',
      lineKey: 'TEST-LINE',
      name: 'PS-TEST GUIDE',
      anchorIds: ['a:support:pos'],
      portIds: ['p:support:pos'],
      segmentIds: [],
      rawAttributes: { TYPE: 'SUPPORT', NAME: 'PS-TEST GUIDE', CMPSUPTYPE: 'GUIDE' },
    },
  ],
  supports: [
    {
      id: 'sup:test:00001',
      componentId: 'cmp:support:00002',
      type: 'GUIDE',
      skey: '',
      supportAnchorId: 'a:support:pos',
      hostCandidates: [],
      restraints: [],
    },
  ],
};

const hierarchy = convertUxmlDocumentToAvevaHierarchy(doc, { fileName: 'uxml-support-parity-test.uxml.json' });
const support = hierarchy[0].children.find((child) => child.attributes?.UXML_COMPONENT_ID === 'cmp:support:00002');
assert.ok(support, 'support component should be converted');

const attrs = support.attributes;
assert.equal(attrs.UXML_SUPPORT_PARITY, 'true');
assert.equal(attrs.SUPPORT_KIND, 'GUIDE');
assert.equal(attrs.SUPPORT_MAPPER_KIND, 'GUIDE');
assert.deepEqual(attrs.SUPPORTCOORD, { x: 500, y: -120, z: 0 });
assert.equal(attrs.ATTACHED_COMPONENT_ID, 'cmp:pipe:00001');
assert.equal(attrs.ATTACHED_PIPE_SEGMENT_ID, 'seg:pipe:00001');
assert.equal(attrs.PIPE_AXIS, 'X');
assert.equal(attrs.ATTACHED_PIPE_BORE, '250mm');
assert.equal(attrs.ATTACHED_PIPE_OD, '250mm');

console.log('✅ UXML support parity contract passed.');
