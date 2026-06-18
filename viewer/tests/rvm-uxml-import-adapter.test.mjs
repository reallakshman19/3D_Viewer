import assert from 'node:assert/strict';
import {
  convertUxmlDocumentToAvevaHierarchy,
  isUxmlDocument,
} from '../rvm/UxmlToAvevaJsonAdapter.js';

const uxml = {
  schemaVersion: 'uxml-topology-v1',
  profile: 'UXML-TOPOLOGY-FULL',
  header: { modelId: 'UNIT-RVM-UXML' },
  pipelines: [
    { id: 'pipe:P-1001', pipelineRef: 'P-1001', lineKey: 'P1001', lineNo: 'P-1001' },
  ],
  components: [
    {
      id: 'cmp:pipe-001',
      type: 'PIPE',
      normalizedType: 'PIPE',
      pipelineRef: 'pipe:P-1001',
      lineKey: 'P1001',
      refNo: 'PIPE-001',
      name: 'PIPE 001',
      bore: 100,
      anchorIds: ['anc:pipe-001:APOS', 'anc:pipe-001:LPOS'],
      portIds: ['prt:pipe-001:APOS', 'prt:pipe-001:LPOS'],
      segmentIds: ['seg:pipe-001'],
      rawAttributes: { SPRE: 'PIPE-SPEC' },
    },
    {
      id: 'cmp:support-001',
      type: 'SUPPORT',
      normalizedType: 'SUPPORT',
      pipelineRef: 'pipe:P-1001',
      lineKey: 'P1001',
      refNo: 'SUP-001',
      name: 'SUPPORT 001',
      anchorIds: ['anc:support-001:POS'],
      portIds: ['prt:support-001:POS'],
      segmentIds: [],
      rawAttributes: { CMPSUPTYPE: 'GUIDE' },
    },
  ],
  anchors: [
    { id: 'anc:pipe-001:APOS', componentId: 'cmp:pipe-001', role: 'START', point: { x: 0, y: 0, z: 0 } },
    { id: 'anc:pipe-001:LPOS', componentId: 'cmp:pipe-001', role: 'END', point: { x: 1000, y: 0, z: 0 } },
    { id: 'anc:support-001:POS', componentId: 'cmp:support-001', role: 'CENTER', point: { x: 500, y: 0, z: 0 } },
  ],
  ports: [
    { id: 'prt:pipe-001:APOS', componentId: 'cmp:pipe-001', anchorId: 'anc:pipe-001:APOS', role: 'START' },
    { id: 'prt:pipe-001:LPOS', componentId: 'cmp:pipe-001', anchorId: 'anc:pipe-001:LPOS', role: 'END' },
    { id: 'prt:support-001:POS', componentId: 'cmp:support-001', anchorId: 'anc:support-001:POS', role: 'CENTER' },
  ],
  segments: [
    { id: 'seg:pipe-001', componentId: 'cmp:pipe-001', startAnchorId: 'anc:pipe-001:APOS', endAnchorId: 'anc:pipe-001:LPOS', bore: 100 },
  ],
  supports: [
    { id: 'sup:001', componentId: 'cmp:support-001', type: 'GUIDE', supportAnchorId: 'anc:support-001:POS' },
  ],
};

assert.equal(isUxmlDocument(uxml), true);

const hierarchy = convertUxmlDocumentToAvevaHierarchy(uxml, { fileName: 'unit.managed_stage.uxml.json' });
assert.equal(hierarchy.length, 1);
assert.equal(hierarchy[0].type, 'BRANCH');
assert.equal(hierarchy[0].children.length, 2);

const pipe = hierarchy[0].children.find((child) => child.type === 'PIPE');
assert.ok(pipe, 'PIPE component should be mapped');
assert.deepEqual(pipe.attributes.APOS, { x: 0, y: 0, z: 0 });
assert.deepEqual(pipe.attributes.LPOS, { x: 1000, y: 0, z: 0 });
assert.equal(pipe.attributes.BORE, 100);
assert.equal(pipe.attributes.SOURCE_FORMAT, 'UXML');
assert.equal(pipe.attributes.UXML_COMPONENT_ID, 'cmp:pipe-001');

const support = hierarchy[0].children.find((child) => child.type === 'SUPPORT');
assert.ok(support, 'SUPPORT component should be mapped');
assert.deepEqual(support.attributes.POS, { x: 500, y: 0, z: 0 });
assert.equal(support.attributes.CMPSUPTYPE, 'GUIDE');

console.log('✅ RVM UXML import adapter test passed.');
