export const RVM_UI_STATUS = Object.freeze({
  parsed: 'RVM parsed into staged model',
  diagnosticsOnly: 'RVM diagnostics only — parser could not build staged model',
  preflightFailed: 'RVM preflight failed',
});

export const RVM_MVP_WARNING = 'MVP parser slice — not full RVM parity';

export function classifyRvmWorkerResult(result = {}) {
  const code = result?.error?.code || '';
  const hasStage = Boolean(result?.ok && result?.stageModel?.schema === 'RvmStageModel.v1');
  if (hasStage) return { kind: 'parser-success', statusText: RVM_UI_STATUS.parsed, warning: RVM_MVP_WARNING };
  if (code === 'STAGE_RVM_PREFLIGHT_FAILED') return { kind: 'preflight-failed', statusText: RVM_UI_STATUS.preflightFailed };
  if (code === 'STAGE_RVM_PARSING_NOT_IMPLEMENTED') return { kind: 'diagnostics-only', statusText: RVM_UI_STATUS.diagnosticsOnly };
  return { kind: 'rvm-failed', statusText: RVM_UI_STATUS.diagnosticsOnly };
}

export function summarizeRvmUiHandoff(result = {}) {
  const context = result?.error?.context || result?.context || {};
  return {
    parserReportSummary: context.parserReportSummary || result?.parserReport?.summary || result?.parserReportSummary || null,
    diagnosticsReportSummary: context.rvmDiagnosticsSummary || context.rvmDiagnosticsReport?.summary || null,
    preflightSummary: context.preflightSummary || context.preflight?.summary || context.preflight || null,
  };
}

export function createRvmUiDiagnostics(result = {}) {
  const handoff = classifyRvmWorkerResult(result);
  const summary = summarizeRvmUiHandoff(result);
  const diagnostics = [];
  if (handoff.warning) diagnostics.push(info('STAGE_RVM_MVP_PARSER_SLICE', handoff.warning));
  if (summary.preflightSummary) diagnostics.push(info('STAGE_RVM_PREFLIGHT_SUMMARY', compact(summary.preflightSummary)));
  if (summary.diagnosticsReportSummary) diagnostics.push(info('STAGE_RVM_DIAGNOSTICS_SUMMARY', compact(summary.diagnosticsReportSummary)));
  if (summary.parserReportSummary) diagnostics.push(info('STAGE_RVM_PARSER_SUMMARY', compact(summary.parserReportSummary)));
  return diagnostics;
}

export function isRvmParserSuccess(result = {}) {
  return classifyRvmWorkerResult(result).kind === 'parser-success';
}

function info(code, message) {
  return { severity: 'info', code, message };
}

function compact(value) {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); }
  catch { return String(value); }
}
