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
  assert.ok(result.diagnostics.unsupportedBinaryDecoding, 'fallback must remain honest about partial binary decoding');

  const emptyBinary = await parseRvmArrayBuffer(new ArrayBuffer(32), { fileName: 'empty.rvm' });
  assert.equal(emptyBinary.ok, true);
  assert.equal(emptyBinary.hierarchy[0].children.length, 1, 'unrecognised RVM should still open as placeholder');
  assert.equal(emptyBinary.diagnostics.parseFidelity, 'PLACEHOLDER_ONLY');

  console.log('Browser RVM parser smoke test passed');
}

run();
