import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  RVM_MVP_WARNING,
  classifyRvmWorkerResult,
  createRvmUiDiagnostics,
  summarizeRvmUiHandoff,
} from '../stage/ui/RvmUiHandoff.js';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const rendererSource = fs.readFileSync(path.join(root, 'viewer/tabs/viewer3d-json-tab-renderer.js'), 'utf8');
const shellSource = fs.readFileSync(path.join(root, 'viewer/stage/ui/JsonViewerShell.js'), 'utf8');
const handoffSource = fs.readFileSync(path.join(root, 'viewer/stage/ui/RvmUiHandoff.js'), 'utf8');

const parserSuccess = {
  ok: true,
  stageModel: { schema: 'RvmStageModel.v1' },
  rvmParserReport: { schema: 'RvmBinaryParserReport.v1', records: { decodedPrimitiveCount: 1 }, decodedCodes: { 8: 1 } },
  rvmDiagnosticsReport: { schema: 'RvmDiagnosticsReport.v1', counts: { prim: 2 }, nativeCodeCounts: { 8: 1 } },
};
const success = classifyRvmWorkerResult(parserSuccess);
assert.equal(success.kind, 'parser-success');
assert.equal(success.statusText, 'RVM parsed into staged model');
assert.equal(success.warning, RVM_MVP_WARNING);
assert.ok(createRvmUiDiagnostics(parserSuccess).some((item) => item.message.includes('MVP parser slice')));
assert.ok(createRvmUiDiagnostics(parserSuccess).some((item) => item.code === 'STAGE_RVM_PARSER_SUMMARY'));
assert.ok(createRvmUiDiagnostics(parserSuccess).some((item) => item.code === 'STAGE_RVM_DIAGNOSTICS_SUMMARY'));

const diagnosticsOnly = classifyRvmWorkerResult({ ok: false, error: { code: 'STAGE_RVM_PARSING_NOT_IMPLEMENTED', context: { rvmDiagnosticsSummary: { prim: 2 } } } });
assert.equal(diagnosticsOnly.kind, 'diagnostics-only');
assert.match(diagnosticsOnly.statusText, /RVM diagnostics only/);

const preflightFailed = classifyRvmWorkerResult({ ok: false, error: { code: 'STAGE_RVM_PREFLIGHT_FAILED', context: { preflight: { errors: [{ code: 'BAD' }] } } } });
assert.equal(preflightFailed.kind, 'preflight-failed');
assert.equal(preflightFailed.statusText, 'RVM preflight failed');

const summary = summarizeRvmUiHandoff({
  error: { context: { preflightSummary: { valid: true }, rvmDiagnosticsReport: { counts: { code4: 1 } }, rvmParserReport: { records: { decodedPrimitiveCount: 1 } } } },
});
assert.deepEqual(summary.preflightSummary, { valid: true });
assert.deepEqual(summary.diagnosticsReportSummary.counts, { code4: 1 });
assert.deepEqual(summary.parserReportSummary.records, { decodedPrimitiveCount: 1 });

assert.ok(shellSource.includes("'Open RVM'"));
assert.equal(shellSource.includes('Open RVM (dry-run)'), false);
assert.ok(rendererSource.includes("applyWorkerResult(result, file.name, handles, state, 'rvm-binary')"));
assert.ok(rendererSource.includes('Worker accepted Stage JSON'));
assert.ok(handoffSource.includes('RVM parsed into staged model'));
for (const forbidden of ['Native RVM support complete', 'Loaded RVM', 'Navis parity', 'Review parity', 'code 11 complete']) {
  assert.equal((rendererSource + shellSource + handoffSource).includes(forbidden), false, forbidden);
}

console.log('3D Json Viewer RVM UI handoff tests passed');
