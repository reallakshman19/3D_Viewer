/**
 * JSON/RVM→PCF adapter Preview/Run wiring test.
 *
 * This validates adapter-level sequencing only. It does not certify full UXML
 * topology quality or PCF text dialect correctness.
 */

import fs from 'node:fs/promises';

const { jsonRvmPcfWorkflowAdapter } = await import('../tabs/model-converters/workflow/adapters/json-rvm-pcf-workflow-adapter.js');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

const adapterSource = await fs.readFile(
  new URL('../tabs/model-converters/workflow/adapters/json-rvm-pcf-workflow-adapter.js', import.meta.url),
  'utf8'
);

assert(adapterSource.includes('prepareXmlCiiMasterContext'), 'A1: adapter imports shared master context');
assert(adapterSource.includes('enrichRowsForFinalPcf'), 'A1: adapter imports row enricher');
assert(adapterSource.includes('runUxmlTopologyForRvmRows'), 'A1: adapter imports real UXML topology bridge');
assert(adapterSource.includes('RvmPcfEmitter'), 'A1: adapter imports PCF emitter');
assert(!adapterSource.includes('_notYetImplemented'), 'A1: adapter no longer uses deferred placeholder helper');

const sampleRows = [
  {
    rowNo: 1,
    type: 'VALVE',
    nodeName: '88-VGT-20359',
    pipelineRef: '88-TEST',
    convertedBore: 100,
    rating: '150',
    lengthMm: 326.7,
    ep1: { x: 0, y: 0, z: 0 },
    ep2: { x: 326.7, y: 0, z: 0 },
    ca: {},
  },
];

const inlineConfig = {
  linelist: { masterRows: [] },
  material: { mapRows: [] },
  pipingClass: { masterRows: [] },
  weight: { masterRows: [] },
  pcf: { allowPartialPcf: true },
};

let order = [];
const injectedServices = {
  async enrichRowsForFinalPcf(args) {
    order.push(`enrich:${args.mode}:${args.commit === false ? 'dry' : 'commit'}`);
    return {
      rows: (args.rows || []).map((row) => ({
        ...row,
        enrichedByTest: true,
        previewOnly: args.mode === 'preview' || args.commit === false,
      })),
      diagnostics: [{ type: `enriched-${args.mode}`, severity: 'INFO' }],
      context: { config: args.config || inlineConfig, lineRows: [] },
    };
  },
  async runTopologyForRows(rows, options) {
    order.push('topology');
    return {
      ok: true,
      rows,
      legacyRows: rows.map((row) => ({ ...row, topologyApplied: true })),
      acceptedTopologyHandoff: { rows: [] },
      readinessGate: { pass: true, diagnostics: [] },
      diagnostics: [{ type: 'topology-pass', severity: 'INFO', options }],
    };
  },
  emitPcf(rows) {
    order.push('emit');
    return {
      pcfTextByPipelineRef: { '88-TEST': 'ISOGEN-FILES ISOGEN.FLS\r\n' },
      errors: [],
      warnings: [{ type: 'emit-warning', severity: 'WARN', rowCount: rows.length }],
    };
  },
};

const preview = await jsonRvmPcfWorkflowAdapter.buildPreviewModel({
  source: { rows: sampleRows, stagedJsonText: '{}' },
  config: inlineConfig,
  services: injectedServices,
});

assert(preview.ok === true, 'A2: preview succeeds');
assert(preview.previewOnly === true, 'A2: preview is preview-only');
assert(preview.commit === false, 'A2: preview is non-committing');
assert(preview.rows.length === 1, 'A2: preview returns enriched rows');
assert(preview.rows[0].previewOnly === true, 'A2: preview row is marked previewOnly by dry-run enrichment');
assert(order.join('>') === 'enrich:preview:dry', 'A2: preview runs enrichment only, no topology or emitter');

order = [];
const finalResult = await jsonRvmPcfWorkflowAdapter.runFinal({
  source: { rows: sampleRows, stagedJsonText: '{}' },
  config: inlineConfig,
  services: injectedServices,
});

assert(finalResult.ok === true, 'A3: final run succeeds when topology accepts and emitter has no errors');
assert(order.join('>') === 'topology>enrich:run:commit>emit', 'A3: final run order is topology → enrichment → emitter');
assert(finalResult.enrichedRows[0].topologyApplied === true, 'A3: final enrichment receives topology-applied legacy rows');
assert(finalResult.pcfTextByPipelineRef['88-TEST'].includes('ISOGEN-FILES'), 'A3: final returns emitted PCF text');
assert(finalResult.diagnostics.some((d) => d.type === 'topology-pass'), 'A3: final includes topology diagnostics');
assert(finalResult.diagnostics.some((d) => d.type === 'enriched-run'), 'A3: final includes enrichment diagnostics');
assert(finalResult.diagnostics.some((d) => d.type === 'emit-warning'), 'A3: final includes emitter warnings');

order = [];
const rejected = await jsonRvmPcfWorkflowAdapter.runFinal({
  source: { rows: sampleRows, stagedJsonText: '{}' },
  config: inlineConfig,
  services: {
    ...injectedServices,
    async runTopologyForRows() {
      order.push('topology');
      return {
        ok: false,
        readinessGate: { pass: false, diagnostics: [{ type: 'topology-block', severity: 'ERROR' }] },
        diagnostics: [{ type: 'topology-block', severity: 'ERROR' }],
      };
    },
    async enrichRowsForFinalPcf() {
      order.push('enrich-should-not-run');
      return { rows: [], diagnostics: [] };
    },
    emitPcf() {
      order.push('emit-should-not-run');
      return { pcfTextByPipelineRef: {}, errors: [], warnings: [] };
    },
  },
});

assert(rejected.ok === false, 'A4: final run rejects when topology rejects');
assert(order.join('>') === 'topology', 'A4: rejected topology prevents enrichment and emitter');
assert(Object.keys(rejected.pcfTextByPipelineRef || {}).length === 0, 'A4: rejected topology emits no PCF');
assert(rejected.errors.some((d) => d.type === 'topology-block'), 'A4: rejected topology exposes diagnostics as errors');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
