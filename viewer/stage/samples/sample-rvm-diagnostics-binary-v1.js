export const SAMPLE_RVM_DIAGNOSTICS_BINARY_NOTE = 'Synthetic scanner-only fixtures; not real AVEVA Review RVM models.';

export function createSampleRvmDiagnosticsBinaryV1() {
  return createBalancedRvmDiagnosticsBinaryV1();
}

export function createBalancedRvmDiagnosticsBinaryV1() {
  const bytes = new Uint8Array(128);
  writeAscii(bytes, 0, 'CNTBROOT');
  writePrim(bytes, 16, 4);
  writePrim(bytes, 32, 8);
  writePrim(bytes, 48, 11);
  writeBbox(bytes, 64, [0, 0, 0, 1, 2, 3]);
  writeAscii(bytes, 96, 'CNTE');
  return bytes.buffer;
}

export function createUnmatchedCntbRvmDiagnosticsBinaryV1() {
  const bytes = new Uint8Array(48);
  writeAscii(bytes, 0, 'CNTBOPEN');
  writePrim(bytes, 16, 4);
  return bytes.buffer;
}

export function createUnmatchedCnteRvmDiagnosticsBinaryV1() {
  const bytes = new Uint8Array(32);
  writeAscii(bytes, 0, 'CNTE');
  writePrim(bytes, 8, 4);
  return bytes.buffer;
}

export function createSuspiciousNativeCodeRvmDiagnosticsBinaryV1() {
  const bytes = new Uint8Array(32);
  writeAscii(bytes, 0, 'CNTBROOT');
  writePrim(bytes, 12, 900_001);
  writeAscii(bytes, 24, 'CNTE');
  return bytes.buffer;
}

export function createInvalidBboxRvmDiagnosticsBinaryV1() {
  const bytes = new Uint8Array(48);
  writeAscii(bytes, 0, 'CNTBROOT');
  writeBbox(bytes, 12, [3, 0, 0, 1, 2, 3]);
  writeAscii(bytes, 40, 'CNTE');
  return bytes.buffer;
}

export function createTruncatedScanRvmDiagnosticsBinaryV1() {
  const bytes = new Uint8Array(2_000_010);
  writeAscii(bytes, 0, 'CNTBROOT');
  writePrim(bytes, 16, 4);
  return bytes.buffer;
}

export function expectedSampleRvmDiagnosticsSummaryV1() {
  return {
    byteLength: 128,
    totalCandidateRecords: 5,
    cntb: 1,
    cnte: 1,
    prim: 3,
    nativePrimitiveRecords: 3,
    code4: 1,
    code11: 1,
    unknownNativeCodes: 0,
    undecodedRecords: 3,
    candidateBboxRecords: 1,
    invalidBboxRecords: 0,
    nativeCodeCounts: { 4: 1, 8: 1, 11: 1 },
    candidateRootCount: 1,
    maxCandidateDepth: 1,
    namedRecordCount: 1,
    warningCount: 0,
    errorCount: 0,
  };
}

function writePrim(bytes, offset, code) {
  writeAscii(bytes, offset, 'PRIM');
  new DataView(bytes.buffer).setUint32(offset + 4, code, true);
}

function writeBbox(bytes, offset, values) {
  writeAscii(bytes, offset, 'BBOX');
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setFloat32(offset + 4 + index * 4, value, true));
}

function writeAscii(bytes, offset, text) {
  for (let index = 0; index < text.length; index += 1) bytes[offset + index] = text.charCodeAt(index);
}
