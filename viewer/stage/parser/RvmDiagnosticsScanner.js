export const RVM_DIAGNOSTICS_SCANNER_VERSION = '20260701-rvm-diagnostics-scanner-evidence-v1';
export const RVM_DIAGNOSTICS_RECORD_TYPES = Object.freeze({ CNTB: 'CNTB', CNTE: 'CNTE', PRIM: 'PRIM', BBOX: 'BBOX' });
export const RVM_DIAGNOSTICS_LIMITS = Object.freeze({ maxScanBytes: 2_000_000, maxByteRanges: 64, maxWarnings: 40 });

const SCHEMA = 'RvmDiagnosticsReport.v1';
const COUNT_KEYS = Object.freeze(['totalCandidateRecords', 'cntb', 'cnte', 'prim', 'nativePrimitiveRecords', 'code4', 'code11', 'unknownNativeCodes', 'undecodedRecords', 'candidateBboxRecords', 'invalidBboxRecords', 'unmatchedCntb', 'unmatchedCnte', 'truncatedCandidateRecords', 'malformedCandidateRecords', 'suspiciousNativeCodes', 'scanLimitReached']);

export function createRvmDiagnosticsReport(options = {}) {
  const byteLength = byteLengthOf(options.arrayBuffer);
  return {
    schema: SCHEMA,
    scannerVersion: RVM_DIAGNOSTICS_SCANNER_VERSION,
    source: { jobId: options.jobId || '', fileName: options.fileName || '', fileHash: options.fileHash || '', byteLength },
    evidence: { candidateOnly: true, confirmedRecords: 0, confidence: 'low', reasonCodes: ['STAGE_RVM_DIAGNOSTICS_CANDIDATE_ONLY'] },
    counts: Object.fromEntries(COUNT_KEYS.map((key) => [key, 0])),
    nativeCodeCounts: { 4: 0, 8: 0, 11: 0 },
    hierarchy: { candidateRootCount: 0, maxCandidateDepth: 0, namedRecordCount: 0 },
    byteRanges: [],
    warnings: [],
    errors: [],
  };
}

export function scanRvmBinaryDiagnostics(input = {}) {
  const report = createRvmDiagnosticsReport(input);
  try {
    const bytes = byteView(input.arrayBuffer);
    if (!bytes.length) {
      report.errors.push(error('STAGE_RVM_DIAGNOSTICS_EMPTY_BINARY', 'binary byteLength must be greater than zero'));
      report.counts.malformedCandidateRecords += 1;
      return report;
    }
    scanBytes(bytes, report);
    finalizeEvidence(bytes, report);
  } catch (scanError) {
    report.errors.push(error('STAGE_RVM_DIAGNOSTICS_SCAN_FAILED', scanError?.message || String(scanError)));
    report.counts.malformedCandidateRecords += 1;
  }
  return report;
}

export function summarizeRvmDiagnostics(report) {
  return {
    schema: report?.schema || SCHEMA,
    scannerVersion: report?.scannerVersion || RVM_DIAGNOSTICS_SCANNER_VERSION,
    byteLength: Number(report?.source?.byteLength) || 0,
    candidateOnly: report?.evidence?.candidateOnly !== false,
    confirmedRecords: Number(report?.evidence?.confirmedRecords) || 0,
    confidence: report?.evidence?.confidence || 'low',
    totalCandidateRecords: count(report, 'totalCandidateRecords'),
    cntb: count(report, 'cntb'), cnte: count(report, 'cnte'), prim: count(report, 'prim'),
    nativePrimitiveRecords: count(report, 'nativePrimitiveRecords'), code4: count(report, 'code4'), code11: count(report, 'code11'),
    unknownNativeCodes: count(report, 'unknownNativeCodes'), undecodedRecords: count(report, 'undecodedRecords'), candidateBboxRecords: count(report, 'candidateBboxRecords'), invalidBboxRecords: count(report, 'invalidBboxRecords'),
    unmatchedCntb: count(report, 'unmatchedCntb'), unmatchedCnte: count(report, 'unmatchedCnte'), truncatedCandidateRecords: count(report, 'truncatedCandidateRecords'), malformedCandidateRecords: count(report, 'malformedCandidateRecords'), suspiciousNativeCodes: count(report, 'suspiciousNativeCodes'), scanLimitReached: count(report, 'scanLimitReached'),
    nativeCodeCounts: report?.nativeCodeCounts || {},
    candidateRootCount: Number(report?.hierarchy?.candidateRootCount) || 0,
    maxCandidateDepth: Number(report?.hierarchy?.maxCandidateDepth) || 0,
    namedRecordCount: Number(report?.hierarchy?.namedRecordCount) || 0,
    warningCount: Array.isArray(report?.warnings) ? report.warnings.length : 0,
    errorCount: Array.isArray(report?.errors) ? report.errors.length : 0,
  };
}

export function validateRvmDiagnosticsReport(report) {
  const errors = [];
  if (!report || typeof report !== 'object') return invalid('report must be an object');
  if (report.schema !== SCHEMA) errors.push(`schema must be ${SCHEMA}`);
  if (report.scannerVersion !== RVM_DIAGNOSTICS_SCANNER_VERSION) errors.push('scannerVersion is invalid');
  if (!report.source || typeof report.source !== 'object') errors.push('source is required');
  validateEvidence(report, errors);
  for (const key of COUNT_KEYS) if (!Number.isFinite(report.counts?.[key])) errors.push(`counts.${key} must be finite`);
  if (!report.nativeCodeCounts || typeof report.nativeCodeCounts !== 'object') errors.push('nativeCodeCounts object is required');
  for (const key of ['candidateRootCount', 'maxCandidateDepth', 'namedRecordCount']) if (!Number.isFinite(report.hierarchy?.[key])) errors.push(`hierarchy.${key} must be finite`);
  for (const key of ['byteRanges', 'warnings', 'errors']) if (!Array.isArray(report[key])) errors.push(`${key} must be an array`);
  for (const range of report.byteRanges || []) validateRange(range, errors);
  return { valid: errors.length === 0, errors };
}

function scanBytes(bytes, report) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let depth = 0;
  const limit = Math.min(Math.max(bytes.byteLength - 3, 0), RVM_DIAGNOSTICS_LIMITS.maxScanBytes);
  for (let offset = 0; offset < limit; offset += 1) {
    const tag = ascii4(bytes, offset);
    if (tag === 'CNTB') { depth += 1; countRecord(report, 'cntb', tag, offset, 4, ['STAGE_RVM_CANDIDATE_CNTB']); report.hierarchy.candidateRootCount += depth === 1 ? 1 : 0; report.hierarchy.maxCandidateDepth = Math.max(report.hierarchy.maxCandidateDepth, depth); if (hasPrintableName(bytes, offset + 4)) report.hierarchy.namedRecordCount += 1; }
    if (tag === 'CNTE') { if (depth === 0) report.counts.unmatchedCnte += 1; countRecord(report, 'cnte', tag, offset, 4, ['STAGE_RVM_CANDIDATE_CNTE']); depth = Math.max(depth - 1, 0); }
    if (tag === 'PRIM') scanPrimitiveCandidate(view, report, offset);
    if (tag === 'BBOX') scanBboxCandidate(view, report, offset);
  }
  report.counts.unmatchedCntb = depth;
}

function scanPrimitiveCandidate(view, report, offset) {
  countRecord(report, 'prim', 'PRIM', offset, 8, ['STAGE_RVM_CANDIDATE_PRIM']);
  report.counts.nativePrimitiveRecords += 1;
  report.counts.undecodedRecords += 1;
  const code = readU32(view, offset + 4);
  if (!Number.isInteger(code)) return markUnknownCode(report, 'STAGE_RVM_NATIVE_CODE_UNAVAILABLE');
  if (code > 4096) { report.counts.suspiciousNativeCodes += 1; return markUnknownCode(report, 'STAGE_RVM_NATIVE_CODE_SUSPICIOUS'); }
  const key = String(code);
  report.nativeCodeCounts[key] = (report.nativeCodeCounts[key] || 0) + 1;
  if (code === 4) report.counts.code4 += 1;
  if (code === 11) report.counts.code11 += 1;
}

function scanBboxCandidate(view, report, offset) {
  const values = [];
  for (let index = 0; index < 6; index += 1) values.push(readF32(view, offset + 4 + index * 4));
  const valid = values.every(Number.isFinite) && values[0] <= values[3] && values[1] <= values[4] && values[2] <= values[5];
  if (valid) report.counts.candidateBboxRecords += 1;
  else { report.counts.invalidBboxRecords += 1; report.counts.malformedCandidateRecords += 1; }
  addRange(report, 'BBOX', offset, Math.min(offset + 28, view.byteLength), ['STAGE_RVM_CANDIDATE_BBOX', valid ? 'STAGE_RVM_BBOX_FINITE_ORDERED' : 'STAGE_RVM_BBOX_INVALID']);
}

function countRecord(report, key, tag, offset, length, reasonCodes) {
  report.counts.totalCandidateRecords += 1;
  report.counts[key] += 1;
  addRange(report, tag, offset, offset + length, reasonCodes);
}

function finalizeEvidence(bytes, report) {
  if (bytes.byteLength > RVM_DIAGNOSTICS_LIMITS.maxScanBytes) {
    report.counts.scanLimitReached += 1;
    report.counts.truncatedCandidateRecords += 1;
    report.warnings.push(warn('STAGE_RVM_DIAGNOSTICS_SCAN_TRUNCATED', 'diagnostic scan truncated by safety limit'));
  }
  if (!report.counts.totalCandidateRecords) report.warnings.push(warn('STAGE_RVM_DIAGNOSTICS_NO_SIGNATURES', 'no conservative record signatures were detected'));
  report.evidence.confidence = confidenceFor(report);
  if (report.counts.unmatchedCntb) report.warnings.push(warn('STAGE_RVM_DIAGNOSTICS_UNMATCHED_CNTB', 'candidate CNTB records were not closed by candidate CNTE records'));
  if (report.counts.unmatchedCnte) report.warnings.push(warn('STAGE_RVM_DIAGNOSTICS_UNMATCHED_CNTE', 'candidate CNTE records appeared without an open candidate CNTB'));
}

function markUnknownCode(report, reasonCode) {
  report.counts.unknownNativeCodes += 1;
  report.warnings.push(warn(reasonCode, 'candidate primitive native code could not be safely decoded'));
}

function addRange(report, type, start, end, reasonCodes) {
  if (report.byteRanges.length >= RVM_DIAGNOSTICS_LIMITS.maxByteRanges) return;
  const truncated = end > Number(report.source.byteLength);
  if (truncated) report.counts.truncatedCandidateRecords += 1;
  report.byteRanges.push({ type, start, end: Math.min(end, report.source.byteLength), confirmed: false, confidence: 'low', reasonCodes: [...reasonCodes, 'STAGE_RVM_RANGE_CANDIDATE_ONLY'] });
}

function confidenceFor(report) { return report.counts.totalCandidateRecords >= 3 && !report.errors.length ? 'medium' : 'low'; }
function validateEvidence(report, errors) { if (report.evidence?.candidateOnly !== true) errors.push('evidence.candidateOnly must be true'); if (report.evidence?.confirmedRecords !== 0) errors.push('evidence.confirmedRecords must be 0'); if (!['low', 'medium'].includes(report.evidence?.confidence)) errors.push('evidence.confidence is invalid'); if (!Array.isArray(report.evidence?.reasonCodes)) errors.push('evidence.reasonCodes must be an array'); }
function validateRange(range, errors) { if (!range || typeof range !== 'object') errors.push('byteRanges entry must be object'); else { if (range.confirmed !== false) errors.push('byteRanges entry confirmed must be false'); if (!['low', 'medium'].includes(range.confidence)) errors.push('byteRanges entry confidence is invalid'); if (!Array.isArray(range.reasonCodes)) errors.push('byteRanges entry reasonCodes must be an array'); } }
function count(report, key) { return Number(report?.counts?.[key]) || 0; }
function ascii4(bytes, offset) { return offset >= 0 && offset + 4 <= bytes.byteLength ? String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]) : ''; }
function readU32(view, offset) { return offset >= 0 && offset + 4 <= view.byteLength ? view.getUint32(offset, true) : null; }
function readF32(view, offset) { return offset >= 0 && offset + 4 <= view.byteLength ? view.getFloat32(offset, true) : NaN; }
function byteLengthOf(value) { return value instanceof ArrayBuffer || ArrayBuffer.isView(value) ? value.byteLength : 0; }
function byteView(value) { if (value instanceof ArrayBuffer) return new Uint8Array(value); return ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : new Uint8Array(0); }
function hasPrintableName(bytes, offset) { return offset < bytes.byteLength && bytes[offset] >= 32 && bytes[offset] <= 126; }
function warn(code, message) { return { severity: 'warning', code, message }; }
function error(code, message) { return { severity: 'error', code, message }; }
function invalid(message) { return { valid: false, errors: [message] }; }
