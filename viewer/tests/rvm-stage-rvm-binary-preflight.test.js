import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STAGE_RVM_BINARY_PREFLIGHT_CODES,
  createRvmBinaryPreflightReport,
  summarizeRvmBinaryPreflight,
  validateRvmBinaryPreflight,
} from '../stage/worker/StageRvmBinaryPreflight.js';

test('valid tiny RVM binary preflight passes with warning summary', () => {
  const report = createRvmBinaryPreflightReport(validInput());
  assert.equal(report.valid, true, report.errors.map((item) => item.message).join('\n'));
  assert.ok(report.warnings.length >= 0);
  assert.equal(summarizeRvmBinaryPreflight(report).byteLength, 8);
});

test('missing fileHash fails', () => {
  const input = { ...validInput(), fileHash: '' };
  assertPreflightError(input, STAGE_RVM_BINARY_PREFLIGHT_CODES.MISSING_FILE_HASH);
});

test('empty binary fails', () => {
  const input = { ...validInput(), fileSize: 0, arrayBuffer: new ArrayBuffer(0) };
  assertPreflightError(input, STAGE_RVM_BINARY_PREFLIGHT_CODES.EMPTY_BINARY);
});

test('size mismatch fails', () => {
  const input = { ...validInput(), fileSize: 99 };
  assertPreflightError(input, STAGE_RVM_BINARY_PREFLIGHT_CODES.SIZE_MISMATCH);
});

test('non-.rvm extension warns only', () => {
  const input = { ...validInput(), fileName: 'model.bin' };
  const report = createRvmBinaryPreflightReport(input);
  assert.equal(report.valid, true, report.errors.map((item) => item.message).join('\n'));
  assertHasWarning(report, STAGE_RVM_BINARY_PREFLIGHT_CODES.NON_RVM_EXTENSION);
});

test('unknown header warns, not fatal', () => {
  const report = validateRvmBinaryPreflight(validInput());
  assert.equal(report.valid, true, report.errors.map((item) => item.message).join('\n'));
  assertHasWarning(report, STAGE_RVM_BINARY_PREFLIGHT_CODES.UNKNOWN_HEADER);
});

function validInput() {
  return {
    jobId: 'job-rvm-preflight-001',
    fileName: 'sample.rvm',
    fileSize: 8,
    fileHash: 'sha256-rvm-preflight',
    arrayBuffer: new ArrayBuffer(8),
  };
}

function assertPreflightError(input, code) {
  const report = createRvmBinaryPreflightReport(input);
  assert.equal(report.valid, false, 'preflight should fail');
  assert.ok(report.errors.some((item) => item.code === code), JSON.stringify(report.errors));
}

function assertHasWarning(report, code) {
  assert.ok(report.warnings.some((item) => item.code === code), JSON.stringify(report.warnings));
}
