export const RVM_BENCHMARK_ACCEPTANCE_SCHEMA = 'RvmDiagnosticsBenchmarkAcceptance.v1';
export const RVM_BENCHMARK_IDS = Object.freeze(['GAS', 'RMSS', 'SYNTHETIC']);
export const RVM_BENCHMARK_ACCEPTANCE_CATEGORIES = Object.freeze([
  'sourceIdentity',
  'preflight',
  'diagnosticsReport',
  'nativeCodeCounts',
  'hierarchyDepth',
  'noStageModel',
  'noRenderPlan',
  'noGeometryChunks',
]);
export const RVM_BENCHMARK_REJECTION_CODES = Object.freeze({
  MISSING_SOURCE_IDENTITY: 'RVM_BENCHMARK_MISSING_SOURCE_IDENTITY',
  MISSING_DIAGNOSTIC: 'RVM_BENCHMARK_MISSING_DIAGNOSTIC',
  MISSING_COUNT: 'RVM_BENCHMARK_MISSING_COUNT',
  BELOW_MINIMUM: 'RVM_BENCHMARK_COUNT_BELOW_MINIMUM',
  MISSING_NATIVE_CODE_COUNTS: 'RVM_BENCHMARK_MISSING_NATIVE_CODE_COUNTS',
  FORBIDDEN_STAGE_MODEL: 'RVM_BENCHMARK_FORBIDDEN_STAGE_MODEL',
  FORBIDDEN_RENDER_PLAN: 'RVM_BENCHMARK_FORBIDDEN_RENDER_PLAN',
  FORBIDDEN_MANIFEST: 'RVM_BENCHMARK_FORBIDDEN_MANIFEST',
  FORBIDDEN_GEOMETRY_CHUNKS: 'RVM_BENCHMARK_FORBIDDEN_GEOMETRY_CHUNKS',
  VISUAL_READY_CLAIM: 'RVM_BENCHMARK_VISUAL_READY_CLAIM',
  PARSER_COMPLETE_CLAIM: 'RVM_BENCHMARK_PARSER_COMPLETE_CLAIM',
  SEMANTIC_VISIBLE_CLAIM: 'RVM_BENCHMARK_SEMANTIC_VISIBLE_CLAIM',
});

export function createRvmBenchmarkCase(options = {}) {
  return {
    id: RVM_BENCHMARK_IDS.includes(options.id) ? options.id : 'SYNTHETIC',
    label: options.label || 'Synthetic diagnostics benchmark',
    fileName: options.fileName || '',
    fileHash: options.fileHash || '',
    expectedMinimums: { cntb: 0, cnte: 0, prim: 0, code4: 0, code11: 0, nativePrimitiveRecords: 0, ...(options.expectedMinimums || {}) },
    requiredDiagnostics: { sourceIdentity: true, preflight: true, diagnosticsReport: true, nativeCodeCounts: true, hierarchyDepth: true, noStageModel: true, noRenderPlan: true, noGeometryChunks: true, ...(options.requiredDiagnostics || {}) },
  };
}

export function createRvmBenchmarkAcceptanceResult(options = {}) {
  const errors = options.errors || [];
  const warnings = options.warnings || [];
  return {
    schema: RVM_BENCHMARK_ACCEPTANCE_SCHEMA,
    benchmarkId: options.benchmarkId || 'SYNTHETIC',
    label: options.label || '',
    valid: options.valid ?? errors.length === 0,
    diagnosticsOnly: true,
    parserComplete: false,
    visualReady: false,
    errors,
    warnings,
    summary: options.summary || {},
  };
}

export function evaluateRvmDiagnosticsBenchmark(report = {}, benchmarkCase = createRvmBenchmarkCase(), options = {}) {
  const bench = createRvmBenchmarkCase(benchmarkCase);
  const errors = [];
  const warnings = [];
  validateRequiredEvidence(report, bench, errors);
  validateForbiddenOutputs(report, errors);
  validateClaims(report, errors);
  validateCounts(report, bench, errors);
  collectDiagnosticWarnings(report, warnings);
  const summary = buildSummary(report, bench, options);
  return createRvmBenchmarkAcceptanceResult({ benchmarkId: bench.id, label: bench.label, errors, warnings, summary });
}

export function summarizeRvmBenchmarkAcceptance(result) {
  return {
    schema: result?.schema || '',
    benchmarkId: result?.benchmarkId || '',
    valid: Boolean(result?.valid),
    diagnosticsOnly: result?.diagnosticsOnly === true,
    parserComplete: result?.parserComplete === true,
    visualReady: result?.visualReady === true,
    errorCount: Array.isArray(result?.errors) ? result.errors.length : 0,
    warningCount: Array.isArray(result?.warnings) ? result.warnings.length : 0,
    counts: result?.summary?.counts || {},
  };
}

export function validateRvmBenchmarkAcceptanceResult(result) {
  const errors = [];
  if (!result || typeof result !== 'object') return invalid('result must be an object');
  if (result.schema !== RVM_BENCHMARK_ACCEPTANCE_SCHEMA) errors.push('schema is invalid');
  if (!RVM_BENCHMARK_IDS.includes(result.benchmarkId)) errors.push('benchmarkId is invalid');
  if (typeof result.valid !== 'boolean') errors.push('valid must be boolean');
  if (result.diagnosticsOnly !== true) errors.push('diagnosticsOnly must be true');
  if (result.parserComplete !== false) errors.push('parserComplete must be false');
  if (result.visualReady !== false) errors.push('visualReady must be false');
  if (!Array.isArray(result.errors)) errors.push('errors must be an array');
  if (!Array.isArray(result.warnings)) errors.push('warnings must be an array');
  if (!result.summary || typeof result.summary !== 'object') errors.push('summary must be an object');
  return { valid: errors.length === 0, errors };
}

function validateRequiredEvidence(report, bench, errors) {
  if (bench.requiredDiagnostics.sourceIdentity && !hasSourceIdentity(report, bench)) add(errors, 'MISSING_SOURCE_IDENTITY', 'source identity is required');
  for (const key of ['preflight', 'diagnosticsReport']) if (bench.requiredDiagnostics[key] && !report[key]) add(errors, 'MISSING_DIAGNOSTIC', `${key} is required`, { key });
  if (bench.requiredDiagnostics.hierarchyDepth && !Number.isFinite(numberAt(report, ['diagnosticsReport', 'hierarchyDepth'], report.hierarchyDepth))) add(errors, 'MISSING_DIAGNOSTIC', 'hierarchyDepth is required', { key: 'hierarchyDepth' });
}

function validateForbiddenOutputs(report, errors) {
  if (report.stageModel !== undefined) add(errors, 'FORBIDDEN_STAGE_MODEL', 'stageModel is forbidden in diagnostics-only acceptance');
  if (report.renderPlan !== undefined) add(errors, 'FORBIDDEN_RENDER_PLAN', 'renderPlan is forbidden in diagnostics-only acceptance');
  if (report.manifest !== undefined) add(errors, 'FORBIDDEN_MANIFEST', 'manifest is forbidden in diagnostics-only acceptance');
  if (report.geometryChunks !== undefined) add(errors, 'FORBIDDEN_GEOMETRY_CHUNKS', 'geometryChunks are forbidden in diagnostics-only acceptance');
}

function validateClaims(report, errors) {
  if (report.visualReady === true || report.claims?.visualReady === true) add(errors, 'VISUAL_READY_CLAIM', 'visual-ready claim is forbidden');
  if (report.parserComplete === true || report.claims?.parserComplete === true) add(errors, 'PARSER_COMPLETE_CLAIM', 'parser-complete claim is forbidden');
  if (report.evidence?.semanticOnlyVisibleGeometry === true || report.claims?.semanticOnlyVisibleGeometry === true) add(errors, 'SEMANTIC_VISIBLE_CLAIM', 'semantic-only visible geometry claim is forbidden');
}

function validateCounts(report, bench, errors) {
  const counts = extractCounts(report);
  for (const key of ['cntb', 'cnte', 'prim', 'nativePrimitiveRecords']) validateMinimum(key, counts[key], bench.expectedMinimums[key], errors);
  validateNativeCodeCounts(report, bench, errors);
}

function validateNativeCodeCounts(report, bench, errors) {
  const nativeCodeCounts = report.nativeCodeCounts || report.diagnosticsReport?.nativeCodeCounts;
  if (!nativeCodeCounts || typeof nativeCodeCounts !== 'object') return add(errors, 'MISSING_NATIVE_CODE_COUNTS', 'nativeCodeCounts are required');
  validateNativeCodeMinimum(nativeCodeCounts, 4, 'code4', bench.expectedMinimums.code4, errors);
  validateNativeCodeMinimum(nativeCodeCounts, 11, 'code11', bench.expectedMinimums.code11, errors);
}

function validateNativeCodeMinimum(nativeCodeCounts, code, key, minimum, errors) {
  if (minimum <= 0 && !hasCode(nativeCodeCounts, code)) return;
  if (minimum > 0 && !hasCode(nativeCodeCounts, code)) return add(errors, 'MISSING_COUNT', `nativeCodeCounts[${code}] is required`, { key });
  validateMinimum(key, codeCount(nativeCodeCounts, code), minimum, errors);
}

function validateMinimum(key, actual, minimum, errors) {
  if (!Number.isFinite(actual)) return add(errors, 'MISSING_COUNT', `${key} count is required`, { key });
  if (actual < minimum) add(errors, 'BELOW_MINIMUM', `${key} count ${actual} is below expected minimum ${minimum}`, { key, actual, minimum });
}

function collectDiagnosticWarnings(report, warnings) {
  const counts = extractCounts(report);
  for (const key of ['unknown', 'undecoded']) if (Number.isFinite(counts[key]) && counts[key] > 0) warnings.push({ code: `RVM_BENCHMARK_${key.toUpperCase()}_COUNT`, message: `${key} records are present`, count: counts[key] });
}

function buildSummary(report, bench, options) {
  return { benchmarkId: bench.id, label: bench.label, diagnosticsOnly: true, parserComplete: false, visualReady: false, counts: extractCounts(report), fileName: report.sourceIdentity?.fileName || bench.fileName || '', fileHash: report.sourceIdentity?.fileHash || bench.fileHash || '', note: options.note || '' };
}

function extractCounts(report) {
  const source = report.recordCounts || report.diagnosticsReport?.recordCounts || report.counts || {};
  const nativeCodeCounts = report.nativeCodeCounts || report.diagnosticsReport?.nativeCodeCounts || {};
  return { cntb: num(source.cntb ?? source.CNTB), cnte: num(source.cnte ?? source.CNTE), prim: num(source.prim ?? source.PRIM), nativePrimitiveRecords: num(source.nativePrimitiveRecords), code4: codeCount(nativeCodeCounts, 4), code11: codeCount(nativeCodeCounts, 11), unknown: num(source.unknown ?? nativeCodeCounts.unknown), undecoded: num(source.undecoded ?? nativeCodeCounts.undecoded) };
}

function hasSourceIdentity(report, bench) {
  const identity = report.sourceIdentity || report.source || {};
  return Boolean((identity.fileName || bench.fileName) && (identity.fileHash || bench.fileHash));
}

function numberAt(primary, path, fallback) {
  let value = primary;
  for (const key of path) value = value?.[key];
  return num(value ?? fallback);
}

function hasCode(counts, code) {
  return counts?.[String(code)] !== undefined || counts?.[code] !== undefined || counts?.[`code${code}`] !== undefined;
}

function codeCount(counts, code) {
  return num(counts?.[String(code)] ?? counts?.[code] ?? counts?.[`code${code}`]);
}

function num(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function add(errors, key, message, details = {}) {
  errors.push({ code: RVM_BENCHMARK_REJECTION_CODES[key], message, ...details });
}

function invalid(message) {
  return { valid: false, errors: [message] };
}
