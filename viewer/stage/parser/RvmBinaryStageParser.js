import {
  addStageDiagnostic,
  createDiagnosticFallback,
  createEmptyRvmStageModel,
  createNativeGeometryMetadata,
  createNativeRecordRef,
} from '../contracts/RvmStageModelContract.js';

export const RVM_BINARY_STAGE_PARSER_VERSION = '20260701-rvm-binary-stage-parser-mvp-v1';
export const RVM_BINARY_STAGE_PARSER_SCHEMA = 'RvmBinaryParserReport.v1';
export const RVM_BINARY_STAGE_PARSER_LIMITS = Object.freeze({ maxScanBytes: 2_000_000, maxRecords: 128 });
export const RVM_BINARY_STAGE_RECORD_CONFIDENCE = Object.freeze({ candidate: 'candidate', decoded: 'decoded', unsupported: 'unsupported' });

export function createRvmBinaryParserReport(options = {}) {
  const byteLength = byteLengthOf(options.arrayBuffer);
  return {
    schema: RVM_BINARY_STAGE_PARSER_SCHEMA,
    parserVersion: RVM_BINARY_STAGE_PARSER_VERSION,
    source: { jobId: options.jobId || '', fileName: options.fileName || '', fileHash: options.fileHash || '', byteLength },
    mode: 'mvp-vertical-slice',
    parserComplete: false,
    visualParityClaimed: false,
    records: { candidateCntb: 0, candidateCnte: 0, candidatePrim: 0, balancedHierarchy: false, decodedPrimitiveCount: 0, unsupportedPrimitiveCount: 0, diagnosticPrimitiveCount: 0 },
    decodedCodes: { 8: 0 },
    unsupportedCodes: {},
    hierarchy: { rootNodeId: 'node-root', nodeCount: 0, maxDepth: 0 },
    byteRanges: [],
    diagnostics: [],
    errors: [],
    warnings: [],
  };
}

export function parseRvmBinaryToStageModel(input = {}) {
  const report = createRvmBinaryParserReport(input);
  try {
    const bytes = byteView(input.arrayBuffer);
    if (!bytes.byteLength) return fail(report, 'STAGE_RVM_PARSER_EMPTY_BINARY', 'binary byteLength must be greater than zero');
    const candidates = scanCandidates(bytes, report);
    const parsed = candidates.prim.map((candidate) => decodePrimitive(bytes, candidate, report));
    const decoded = parsed.filter((item) => item.decoded);
    const unsupported = parsed.filter((item) => !item.decoded);
    if (!report.records.balancedHierarchy || decoded.length < 1) return { ok: false, report, errors: report.errors, warnings: report.warnings };
    const stageModel = buildStageModel(input, report, decoded, unsupported);
    return { ok: true, stageModel, report, errors: [], warnings: report.warnings };
  } catch (error) {
    report.errors.push(diag('STAGE_RVM_PARSER_FAILED', error?.message || String(error), 'error'));
    return { ok: false, report, errors: report.errors, warnings: report.warnings };
  }
}

export function validateRvmBinaryParserReport(report) {
  const errors = [];
  if (!report || typeof report !== 'object') return invalid('report must be an object');
  if (report.schema !== RVM_BINARY_STAGE_PARSER_SCHEMA) errors.push(`schema must be ${RVM_BINARY_STAGE_PARSER_SCHEMA}`);
  if (report.parserVersion !== RVM_BINARY_STAGE_PARSER_VERSION) errors.push('parserVersion is invalid');
  if (report.mode !== 'mvp-vertical-slice') errors.push('mode must be mvp-vertical-slice');
  if (report.parserComplete !== false) errors.push('parserComplete must remain false');
  if (report.visualParityClaimed !== false) errors.push('visualParityClaimed must remain false');
  for (const key of ['candidateCntb', 'candidateCnte', 'candidatePrim', 'decodedPrimitiveCount', 'unsupportedPrimitiveCount', 'diagnosticPrimitiveCount']) if (!Number.isFinite(report.records?.[key])) errors.push(`records.${key} must be finite`);
  for (const key of ['byteRanges', 'diagnostics', 'errors', 'warnings']) if (!Array.isArray(report[key])) errors.push(`${key} must be an array`);
  return { valid: errors.length === 0, errors };
}

export function summarizeRvmBinaryParserReport(report) {
  return {
    schema: report?.schema || '',
    parserVersion: report?.parserVersion || '',
    mode: report?.mode || '',
    parserComplete: report?.parserComplete === true,
    visualParityClaimed: report?.visualParityClaimed === true,
    candidateCntb: Number(report?.records?.candidateCntb) || 0,
    candidateCnte: Number(report?.records?.candidateCnte) || 0,
    candidatePrim: Number(report?.records?.candidatePrim) || 0,
    balancedHierarchy: report?.records?.balancedHierarchy === true,
    decodedPrimitiveCount: Number(report?.records?.decodedPrimitiveCount) || 0,
    unsupportedPrimitiveCount: Number(report?.records?.unsupportedPrimitiveCount) || 0,
    diagnosticPrimitiveCount: Number(report?.records?.diagnosticPrimitiveCount) || 0,
    decodedCodes: report?.decodedCodes || {},
    unsupportedCodes: report?.unsupportedCodes || {},
    errorCount: Array.isArray(report?.errors) ? report.errors.length : 0,
    warningCount: Array.isArray(report?.warnings) ? report.warnings.length : 0,
  };
}

function scanCandidates(bytes, report) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const candidates = { prim: [] };
  let depth = 0;
  const limit = Math.min(bytes.byteLength - 3, RVM_BINARY_STAGE_PARSER_LIMITS.maxScanBytes);
  for (let offset = 0; offset < limit && report.byteRanges.length < RVM_BINARY_STAGE_PARSER_LIMITS.maxRecords; offset += 1) {
    const tag = ascii4(bytes, offset);
    if (tag === 'CNTB') { depth += 1; report.records.candidateCntb += 1; report.hierarchy.maxDepth = Math.max(report.hierarchy.maxDepth, depth); addRange(report, tag, offset, offset + 4); }
    if (tag === 'CNTE') { report.records.candidateCnte += 1; depth = Math.max(depth - 1, 0); addRange(report, tag, offset, offset + 4); }
    if (tag === 'PRIM') addPrimCandidate(view, candidates, report, offset);
  }
  report.records.balancedHierarchy = report.records.candidateCntb > 0 && report.records.candidateCntb === report.records.candidateCnte;
  report.hierarchy.nodeCount = report.records.balancedHierarchy ? 2 : 1;
  if (!report.records.balancedHierarchy) report.warnings.push(diag('STAGE_RVM_PARSER_UNBALANCED_HIERARCHY', 'CNTB/CNTE candidate nesting is not balanced', 'warning'));
  return candidates;
}

function addPrimCandidate(view, candidates, report, offset) {
  if (offset + 12 > view.byteLength) return;
  const code = readU32(view, offset + 4);
  const payloadLength = readU32(view, offset + 8);
  const end = offset + 12 + payloadLength;
  if (!Number.isInteger(code) || !Number.isInteger(payloadLength) || end > view.byteLength) return;
  candidates.prim.push({ offset, code, payloadStart: offset + 12, payloadLength, end });
  report.records.candidatePrim += 1;
  addRange(report, 'PRIM', offset, end);
}

function decodePrimitive(bytes, candidate, report) {
  if (candidate.code !== 8) return unsupportedPrimitive(candidate, report);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (candidate.payloadLength < 80) return unsupportedPrimitive(candidate, report, 'short-code8-payload');
  const transform3x4 = readF32Array(view, candidate.payloadStart, 12);
  const bboxWorld = readF32Array(view, candidate.payloadStart + 48, 6);
  const radius = readF32(view, candidate.payloadStart + 72);
  const length = readF32(view, candidate.payloadStart + 76);
  if (!isMatrix(transform3x4) || !isBbox(bboxWorld) || !Number.isFinite(radius) || !Number.isFinite(length)) return unsupportedPrimitive(candidate, report, 'invalid-code8-payload');
  report.records.decodedPrimitiveCount += 1;
  report.decodedCodes[8] += 1;
  return { decoded: true, code: 8, offset: candidate.offset, end: candidate.end, transform3x4, bboxWorld, params: { radius, length } };
}

function unsupportedPrimitive(candidate, report, reason = 'unsupported-native-code') {
  report.records.unsupportedPrimitiveCount += 1;
  report.records.diagnosticPrimitiveCount += 1;
  increment(report.unsupportedCodes, candidate.code);
  report.diagnostics.push(diag('STAGE_RVM_PARSER_UNSUPPORTED_PRIMITIVE', `Primitive code ${candidate.code} is diagnostic-only in the MVP parser`, 'warning', { nativeCode: candidate.code, recordOffset: candidate.offset, reason }));
  return { decoded: false, code: candidate.code, offset: candidate.offset, end: candidate.end, reason, bboxWorld: [0, 0, 0, 1, 1, 1] };
}

function buildStageModel(input, report, decoded, unsupported) {
  const model = createEmptyRvmStageModel({ fileName: input.fileName, fileSize: byteLengthOf(input.arrayBuffer), fileHash: input.fileHash, units: 'm' });
  model.materials.push({ id: 'mat-rvm-mvp-default', name: 'RVM MVP default material', color: [0.72, 0.72, 0.72, 1] }, { id: 'mat-rvm-mvp-diagnostic', name: 'RVM MVP diagnostic material', color: [1, 0.6, 0.2, 1] });
  const all = [...decoded, ...unsupported];
  model.hierarchy.nodes.push({ id: 'node-rvm-mvp-000001', parentId: 'node-root', name: 'RVM MVP parsed group', path: '/RVM_MVP', kind: 'RVM_MVP_GROUP', componentIds: [], primitiveIds: [], bboxWorld: unionBbox(all.map((item) => item.bboxWorld)) });
  all.forEach((item, index) => addPrimitiveBundle(model, report, item, index + 1));
  return model;
}

function addPrimitiveBundle(model, report, item, number) {
  const node = model.hierarchy.nodes[0];
  const componentId = id('comp', number);
  const primitiveId = id('prim', number);
  const decoded = item.decoded === true;
  const bboxWorld = item.bboxWorld;
  node.componentIds.push(componentId);
  node.primitiveIds.push(primitiveId);
  model.components.push({ id: componentId, nodeId: node.id, semanticType: decoded ? 'PIPE' : 'UNKNOWN', name: decoded ? 'RVM MVP decoded primitive' : 'RVM MVP diagnostic primitive', ownerPath: node.path, primitiveIds: [primitiveId], bboxWorld, confidence: { geometry: decoded ? 'native' : 'diagnostic', semantic: decoded ? 'attribute' : 'unknown' }, renderPolicy: renderPolicy(), diagnostics: [] });
  model.primitives.push(decoded ? createCylinderPrimitive(item, node.id, componentId, primitiveId) : createDiagnosticPrimitive(item, node.id, componentId, primitiveId, model, report));
}

function createCylinderPrimitive(item, nodeId, componentId, primitiveId) {
  const nativeRecord = createNativeRecordRef({ source: 'rvm-binary-mvp', recordType: 'RVM_PRIMITIVE', recordOffset: item.offset, nativeCode: 8, recordLength: item.end - item.offset, decoded: true });
  const nativeParams = { ...item.params, parserMode: 'mvp-vertical-slice' };
  return { id: primitiveId, nodeId, componentId, native: { recordOffset: item.offset, code: 8, kind: 'CYLINDER', decoded: true }, nativeRecord, nativeParams, nativeGeometry: createNativeGeometryMetadata({ nativeRecord, nativeParams, transform3x4: item.transform3x4, bboxLocal: item.bboxWorld, bboxWorld: item.bboxWorld }), transform3x4: item.transform3x4, bboxLocal: item.bboxWorld, bboxWorld: item.bboxWorld, transform: { matrix3x4: item.transform3x4, bboxLocal: item.bboxWorld, bboxWorld: item.bboxWorld }, params: item.params, confidence: { geometry: 'native', semantic: 'attribute' }, renderKind: 'CYLINDER', materialId: 'mat-rvm-mvp-default', recipeSource: { source: 'native', quality: 'full', output: 'procedural', recipeId: 'mvp-code8-cylinder' }, diagnostics: [] };
}

function createDiagnosticPrimitive(item, nodeId, componentId, primitiveId, model, report) {
  const fallback = createDiagnosticFallback({ kind: 'unsupported-native-record', visible: true, message: `Primitive code ${item.code} is unsupported in the MVP parser.` });
  const diagnostic = { severity: 'warning', code: 'STAGE_FALLBACK_UNKNOWN_NATIVE_CODE', message: fallback.message, ref: { nodeId, componentId, primitiveId, nativeCode: item.code, recordOffset: item.offset }, fallback: { reason: fallback.kind, renderKind: 'UNKNOWN_DIAGNOSTIC', recipe: 'diagnostic-bbox' } };
  model.diagnostics = addStageDiagnostic(model.diagnostics, diagnostic);
  return { id: primitiveId, nodeId, componentId, native: { recordOffset: item.offset, code: item.code, kind: 'Unknown', decoded: false }, transform: { matrix3x4: identity(), bboxLocal: item.bboxWorld, bboxWorld: item.bboxWorld }, params: { diagnosticOnly: true }, confidence: { geometry: 'diagnostic', semantic: 'unknown' }, renderKind: 'UNKNOWN_DIAGNOSTIC', materialId: 'mat-rvm-mvp-diagnostic', recipeSource: { source: 'diagnostic-fallback', quality: 'full', output: 'bbox', recipeId: 'mvp-unsupported-diagnostic' }, diagnosticFallback: fallback, diagnostics: report.diagnostics.filter((entry) => entry.ref?.recordOffset === item.offset).concat(diagnostic) };
}

function fail(report, code, message) { report.errors.push(diag(code, message, 'error')); return { ok: false, report, errors: report.errors, warnings: report.warnings }; }
function renderPolicy() { return { full: 'native-primitives', medium: 'simplified-primitives', light: 'proxy-bbox', skeleton: 'centerline-or-icon', hidden: 'hide' }; }
function id(prefix, number) { return `${prefix}-${String(number).padStart(6, '0')}`; }
function identity() { return [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; }
function unionBbox(boxes) { const valid = boxes.filter(isBbox); if (!valid.length) return [0, 0, 0, 1, 1, 1]; return [Math.min(...valid.map((b) => b[0])), Math.min(...valid.map((b) => b[1])), Math.min(...valid.map((b) => b[2])), Math.max(...valid.map((b) => b[3])), Math.max(...valid.map((b) => b[4])), Math.max(...valid.map((b) => b[5]))]; }
function addRange(report, type, start, end) { report.byteRanges.push({ type, start, end, confidence: RVM_BINARY_STAGE_RECORD_CONFIDENCE.candidate }); }
function ascii4(bytes, offset) { return offset >= 0 && offset + 4 <= bytes.byteLength ? String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]) : ''; }
function readU32(view, offset) { return offset >= 0 && offset + 4 <= view.byteLength ? view.getUint32(offset, true) : NaN; }
function readF32(view, offset) { return offset >= 0 && offset + 4 <= view.byteLength ? view.getFloat32(offset, true) : NaN; }
function readF32Array(view, offset, count) { return Array.from({ length: count }, (_, index) => readF32(view, offset + index * 4)); }
function isMatrix(value) { return Array.isArray(value) && value.length === 12 && value.every(Number.isFinite); }
function isBbox(value) { return Array.isArray(value) && value.length === 6 && value.every(Number.isFinite) && value[0] <= value[3] && value[1] <= value[4] && value[2] <= value[5]; }
function byteLengthOf(value) { return value instanceof ArrayBuffer || ArrayBuffer.isView(value) ? value.byteLength : 0; }
function byteView(value) { if (value instanceof ArrayBuffer) return new Uint8Array(value); return ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : new Uint8Array(0); }
function increment(target, key) { const text = String(key); target[text] = (target[text] || 0) + 1; }
function diag(code, message, severity, ref = {}) { return { severity, code, message, ref }; }
function invalid(message) { return { valid: false, errors: [message] }; }
