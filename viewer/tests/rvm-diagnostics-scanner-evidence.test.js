import assert from 'node:assert/strict';
import {
  scanRvmBinaryDiagnostics,
  summarizeRvmDiagnostics,
  validateRvmDiagnosticsReport,
} from '../stage/parser/RvmDiagnosticsScanner.js';
import {
  createBalancedRvmDiagnosticsBinaryV1,
  createInvalidBboxRvmDiagnosticsBinaryV1,
  createSuspiciousNativeCodeRvmDiagnosticsBinaryV1,
  createTruncatedScanRvmDiagnosticsBinaryV1,
  createUnmatchedCntbRvmDiagnosticsBinaryV1,
  createUnmatchedCnteRvmDiagnosticsBinaryV1,
} from '../stage/samples/sample-rvm-diagnostics-binary-v1.js';

function scan(arrayBuffer, name = 'fixture.rvm') {
  return scanRvmBinaryDiagnostics({ jobId: `job-${name}`, fileName: name, fileHash: `sha256-${name}`, arrayBuffer });
}

const balanced = scan(createBalancedRvmDiagnosticsBinaryV1(), 'balanced.rvm');
assert.equal(validateRvmDiagnosticsReport(balanced).valid, true);
assert.equal(balanced.evidence.candidateOnly, true);
assert.equal(balanced.evidence.confirmedRecords, 0);
assert.ok(['low', 'medium'].includes(balanced.evidence.confidence));
assert.ok(balanced.evidence.reasonCodes.includes('STAGE_RVM_DIAGNOSTICS_CANDIDATE_ONLY'));
assert.ok(balanced.byteRanges.length > 0);
for (const range of balanced.byteRanges) {
  assert.equal(range.confirmed, false);
  assert.ok(['low', 'medium'].includes(range.confidence));
  assert.ok(Array.isArray(range.reasonCodes));
  assert.ok(range.reasonCodes.includes('STAGE_RVM_RANGE_CANDIDATE_ONLY'));
}
const balancedSummary = summarizeRvmDiagnostics(balanced);
assert.equal(balancedSummary.candidateOnly, true);
assert.equal(balancedSummary.confirmedRecords, 0);
assert.equal(balancedSummary.confidence, 'medium');

const unmatchedCntb = scan(createUnmatchedCntbRvmDiagnosticsBinaryV1(), 'unmatched-cntb.rvm');
assert.equal(unmatchedCntb.counts.unmatchedCntb, 1);
assert.ok(unmatchedCntb.warnings.some((item) => item.code === 'STAGE_RVM_DIAGNOSTICS_UNMATCHED_CNTB'));

const unmatchedCnte = scan(createUnmatchedCnteRvmDiagnosticsBinaryV1(), 'unmatched-cnte.rvm');
assert.equal(unmatchedCnte.counts.unmatchedCnte, 1);
assert.ok(unmatchedCnte.warnings.some((item) => item.code === 'STAGE_RVM_DIAGNOSTICS_UNMATCHED_CNTE'));

const suspicious = scan(createSuspiciousNativeCodeRvmDiagnosticsBinaryV1(), 'suspicious-code.rvm');
assert.equal(suspicious.counts.suspiciousNativeCodes, 1);
assert.equal(suspicious.counts.unknownNativeCodes, 1);
assert.ok(suspicious.warnings.some((item) => item.code === 'STAGE_RVM_NATIVE_CODE_SUSPICIOUS'));

const invalidBbox = scan(createInvalidBboxRvmDiagnosticsBinaryV1(), 'invalid-bbox.rvm');
assert.equal(invalidBbox.counts.invalidBboxRecords, 1);
assert.equal(invalidBbox.counts.malformedCandidateRecords, 1);

const truncated = scan(createTruncatedScanRvmDiagnosticsBinaryV1(), 'truncated.rvm');
assert.equal(truncated.counts.scanLimitReached, 1);
assert.equal(truncated.counts.truncatedCandidateRecords, 1);
assert.ok(truncated.warnings.some((item) => item.code === 'STAGE_RVM_DIAGNOSTICS_SCAN_TRUNCATED'));

const malformed = scanRvmBinaryDiagnostics({ jobId: 'bad', fileName: 'bad.rvm', fileHash: 'sha256-bad', arrayBuffer: null });
assert.equal(malformed.errors.length, 1);
assert.equal(malformed.evidence.candidateOnly, true);
assert.equal(malformed.evidence.confirmedRecords, 0);
assert.equal(validateRvmDiagnosticsReport(malformed).valid, true);

console.log('RVM diagnostics scanner evidence tests passed');
