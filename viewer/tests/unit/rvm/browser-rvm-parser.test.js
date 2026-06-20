import assert from 'node:assert/strict';
import { TextEncoder } from 'node:util';
import { parseRvmArrayBuffer, isLikelyRvmFileName } from '../../../rvm/BrowserRvmParser.js';

function bufferFromText(text) {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function run() {
  assert.equal(isLikelyRvmFileName('model.rvm'), true);
  assert.equal(isLikelyRvmFileName('model.rev'), true);
  assert.equal(isLikelyRvmFileName('model.json'), false);

  const sample = [
    'AVEVA RVM BINARY TEST HEADER',
    'CYLI PIPE MAIN RUN',
    'FLAN 150RF',
    'VALV GATE VALVE',
    'SUPPORT GUIDE'
  ].join('\u0000');
  const result = await parseRvmArrayBuffer(bufferFromText(sample), { fileName: 'sample.rvm' });
  assert.equal(result.ok, true);
  assert.equal(result.sourceFormat, 'RVM_BINARY_BROWSER_FALLBACK');
  assert.ok(Array.isArray(result.hierarchy));
  assert.ok(result.hierarchy[0].children.length >= 4, 'primitive strings should create fallback render nodes');
  assert.ok(result.hierarchy[0].children.some((child) => child.type === 'PIPE'));
  assert.ok(result.hierarchy[0].children.some((child) => child.type === 'FLANGE'));
  assert.ok(result.hierarchy[0].children.some((child) => child.type === 'VALVE'));
  assert.ok(result.hierarchy[0].children.some((child) => child.type === 'SUPPORT'));
  assert.ok(result.diagnostics.unsupportedBinaryDecoding, 'string-marker fallback must remain honest about binary decoding');

  const structured = await parseRvmArrayBuffer(bufferFromText([
    'AVEVA REVIEW RVM',
    'CYLI APOS 0 0 0 LPOS 1000 0 0 HBOR 57.15',
    'BOX BBOX -10 -20 -30 10 20 30',
    'VALV 1000 0 0 1200 0 0 90'
  ].join('\u0000')), { fileName: 'structured.rvm' });
  assert.equal(structured.ok, true);
  assert.equal(structured.diagnostics.parseFidelity, 'PARTIAL_PRIMITIVE_RECORDS');
  assert.equal(structured.diagnostics.structuredRecordCount, 3);
  assert.equal(structured.diagnostics.unsupportedBinaryDecoding, false);
  const pipe = structured.hierarchy[0].children.find((child) => child.type === 'PIPE');
  assert.ok(pipe, 'structured CYLI should create PIPE node');
  assert.deepEqual(pipe.attributes.APOS, { x: 0, y: 0, z: 0 });
  assert.deepEqual(pipe.attributes.LPOS, { x: 1000, y: 0, z: 0 });
  assert.equal(pipe.attributes.HBOR, '57.15');
  assert.equal(pipe.attributes.BROWSER_PARSE_METHOD, 'named-endpoints');
  const box = structured.hierarchy[0].children.find((child) => child.type === 'BOX');
  assert.deepEqual(box.bbox, [-10, -20, -30, 10, 20, 30]);

  const emptyBinary = await parseRvmArrayBuffer(new ArrayBuffer(32), { fileName: 'empty.rvm' });
  assert.equal(emptyBinary.ok, true);
  assert.equal(emptyBinary.hierarchy[0].children.length, 1, 'unrecognised RVM should still open as placeholder');
  assert.equal(emptyBinary.diagnostics.parseFidelity, 'PLACEHOLDER_ONLY');

  console.log('Browser RVM parser smoke test passed');
}

run();
