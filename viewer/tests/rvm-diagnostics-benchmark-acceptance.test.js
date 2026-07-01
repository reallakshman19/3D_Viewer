import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RVM_BENCHMARK_ACCEPTANCE_CATEGORIES,
  RVM_BENCHMARK_ACCEPTANCE_SCHEMA,
  RVM_BENCHMARK_IDS,
  RVM_BENCHMARK_REJECTION_CODES,
  createRvmBenchmarkCase,
  createRvmBenchmarkAcceptanceResult,
  evaluateRvmDiagnosticsBenchmark,
  summarizeRvmBenchmarkAcceptance,
  validateRvmBenchmarkAcceptanceResult,
} from '../stage/benchmark/RvmDiagnosticsBenchmarkAcceptance.js';

test('harness exports exist', () => {
  assert.equal(RVM_BENCHMARK_ACCEPTANCE_SCHEMA, 'RvmDiagnosticsBenchmarkAcceptance.v1');
  assert.ok(RVM_BENCHMARK_IDS.includes('GAS'));
  assert.ok(RVM_BENCHMARK_ACCEPTANCE_CATEGORIES.includes('nativeCodeCounts'));
  assert.equal(RVM_BENCHMARK_REJECTION_CODES.FORBIDDEN_STAGE_MODEL, 'RVM_BENCHMARK_FORBIDDEN_STAGE_MODEL');
  assert.equal(typeof createRvmBenchmarkAcceptanceResult, 'function');
});

test('valid synthetic diagnostics report passes diagnostics acceptance', () => {
  const result = evaluateRvmDiagnosticsBenchmark(validReport(), benchmarkCase());
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.diagnosticsOnly, true);
  assert.equal(result.parserComplete, false);
  assert.equal(result.visualReady, false);
});

test('missing source identity fails', () => {
  const report = validReport();
  delete report.sourceIdentity;
  assertResultError(report, 'RVM_BENCHMARK_MISSING_SOURCE_IDENTITY');
});

test('missing nativeCodeCounts fails', () => {
  const report = validReport();
  delete report.nativeCodeCounts;
  delete report.diagnosticsReport.nativeCodeCounts;
  assertResultError(report, 'RVM_BENCHMARK_MISSING_NATIVE_CODE_COUNTS');
});

test('missing code 4 key fails when code4 minimum is non-zero', () => {
  const report = validReport();
  delete report.nativeCodeCounts[4];
  assertResultError(report, 'RVM_BENCHMARK_MISSING_COUNT');
});

test('missing code 11 key fails when code11 minimum is non-zero', () => {
  const report = validReport();
  delete report.nativeCodeCounts[11];
  assertResultError(report, 'RVM_BENCHMARK_MISSING_COUNT');
});

test('count below expected minimum fails', () => {
  const report = validReport();
  report.recordCounts.prim = 1;
  assertResultError(report, 'RVM_BENCHMARK_COUNT_BELOW_MINIMUM');
});

test('report with stageModel fails', () => {
  assertResultError({ ...validReport(), stageModel: {} }, 'RVM_BENCHMARK_FORBIDDEN_STAGE_MODEL');
});

test('report with renderPlan fails', () => {
  assertResultError({ ...validReport(), renderPlan: {} }, 'RVM_BENCHMARK_FORBIDDEN_RENDER_PLAN');
});

test('report with manifest fails', () => {
  assertResultError({ ...validReport(), manifest: {} }, 'RVM_BENCHMARK_FORBIDDEN_MANIFEST');
});

test('report with geometryChunks fails', () => {
  assertResultError({ ...validReport(), geometryChunks: [] }, 'RVM_BENCHMARK_FORBIDDEN_GEOMETRY_CHUNKS');
});

test('visual-ready claim fails', () => {
  assertResultError({ ...validReport(), claims: { visualReady: true } }, 'RVM_BENCHMARK_VISUAL_READY_CLAIM');
});

test('parser-complete claim fails', () => {
  assertResultError({ ...validReport(), claims: { parserComplete: true } }, 'RVM_BENCHMARK_PARSER_COMPLETE_CLAIM');
});

test('semantic-only visible geometry claim fails', () => {
  assertResultError({ ...validReport(), evidence: { semanticOnlyVisibleGeometry: true } }, 'RVM_BENCHMARK_SEMANTIC_VISIBLE_CLAIM');
});

test('unknown and undecoded counts produce warnings but do not automatically fail', () => {
  const report = validReport();
  report.recordCounts.unknown = 2;
  report.recordCounts.undecoded = 3;
  const result = evaluateRvmDiagnosticsBenchmark(report, benchmarkCase());
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.warnings.length, 2);
});

test('summarizeRvmBenchmarkAcceptance returns deterministic summary', () => {
  const summary = summarizeRvmBenchmarkAcceptance(evaluateRvmDiagnosticsBenchmark(validReport(), benchmarkCase()));
  assert.deepEqual(summary, {
    schema: RVM_BENCHMARK_ACCEPTANCE_SCHEMA,
    benchmarkId: 'SYNTHETIC',
    valid: true,
    diagnosticsOnly: true,
    parserComplete: false,
    visualReady: false,
    errorCount: 0,
    warningCount: 0,
    counts: { cntb: 2, cnte: 2, prim: 5, nativePrimitiveRecords: 5, code4: 1, code11: 1, unknown: 0, undecoded: 0 },
  });
});

test('validateRvmBenchmarkAcceptanceResult validates shape', () => {
  const result = evaluateRvmDiagnosticsBenchmark(validReport(), benchmarkCase());
  const validation = validateRvmBenchmarkAcceptanceResult(result);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});

function benchmarkCase() {
  return createRvmBenchmarkCase({
    id: 'SYNTHETIC',
    label: 'Synthetic benchmark',
    fileName: 'synthetic.rvm',
    fileHash: 'sha256-synthetic',
    expectedMinimums: { cntb: 1, cnte: 1, prim: 4, code4: 1, code11: 1, nativePrimitiveRecords: 4 },
  });
}

function validReport() {
  return {
    sourceIdentity: { fileName: 'synthetic.rvm', fileHash: 'sha256-synthetic' },
    preflight: { valid: true },
    diagnosticsReport: { hierarchyDepth: 3, nativeCodeCounts: { 4: 1, 11: 1 }, recordCounts: { cntb: 2, cnte: 2, prim: 5, nativePrimitiveRecords: 5 } },
    recordCounts: { cntb: 2, cnte: 2, prim: 5, nativePrimitiveRecords: 5, unknown: 0, undecoded: 0 },
    nativeCodeCounts: { 4: 1, 11: 1 },
  };
}

function assertResultError(report, code) {
  const result = evaluateRvmDiagnosticsBenchmark(report, benchmarkCase());
  assert.equal(result.valid, false, 'result should fail');
  assert.ok(result.errors.some((item) => item.code === code), JSON.stringify(result.errors));
}
