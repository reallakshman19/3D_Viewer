import assert from 'node:assert/strict';

import {
  buildRvmJsonPcfRequestPayload,
  normalizeRvmJsonPcfRequestPayload,
  resolveRvmJsonPcfScope,
  RVM_JSON_PCF_DEFAULT_PANEL,
  RVM_JSON_PCF_DEFAULT_PHASE,
  RVM_JSON_PCF_SOURCE_KIND,
} from '../tabs/rvm-json-pcf-trigger-helpers.js';
import { WORKFLOW_MODES } from '../tabs/model-converters/workflow/WorkflowAdapterContract.js';

/**
 * Trigger helper scaffold test.
 * This validates the payload/state model used by the 3D RVM Viewer trigger and
 * rvm-json-pcf-extract receiver. It does not prove DOM wiring is complete.
 */

function testBuildPayloadFromCurrentRvmSelection() {
  const payload = buildRvmJsonPcfRequestPayload({
    appState: {
      rvm: {
        selection: {
          canonicalObjectIds: ['A', 'B'],
        },
      },
    },
  });

  assert.equal(payload.mode, WORKFLOW_MODES.JSON_RVM_PCF);
  assert.equal(payload.workflowAdapterId, WORKFLOW_MODES.JSON_RVM_PCF);
  assert.equal(payload.sourceKind, RVM_JSON_PCF_SOURCE_KIND);
  assert.equal(payload.scope, 'selected');
  assert.deepEqual(payload.selectedCanonicalIds, ['A', 'B']);
  assert.equal(payload.openWorkflow, true);
  assert.equal(payload.requestedPanel, RVM_JSON_PCF_DEFAULT_PANEL);
  assert.equal(payload.requestedPhase, RVM_JSON_PCF_DEFAULT_PHASE);
}

function testBuildPayloadFallsBackToFullScope() {
  const payload = buildRvmJsonPcfRequestPayload({ appState: {} });
  assert.equal(payload.scope, 'full');
  assert.deepEqual(payload.selectedCanonicalIds, []);
}

function testExplicitSelectedIdsOverrideState() {
  const payload = buildRvmJsonPcfRequestPayload({
    appState: {
      rvm: {
        selection: {
          canonicalObjectIds: ['STATE-ID'],
        },
      },
    },
    overrides: {
      selectedCanonicalIds: ['OVERRIDE-ID'],
      requestedPhase: 'weight_match',
    },
  });

  assert.equal(payload.scope, 'selected');
  assert.deepEqual(payload.selectedCanonicalIds, ['OVERRIDE-ID']);
  assert.equal(payload.requestedPhase, 'weight_match');
}

function testNormalizePayloadForExtractState() {
  const next = normalizeRvmJsonPcfRequestPayload({
    payload: {
      selectedCanonicalIds: ['X'],
      requestedPanel: 'workflow',
      requestedPhase: 'preview',
    },
    appState: {},
  });

  assert.equal(next.workflowMode, WORKFLOW_MODES.JSON_RVM_PCF);
  assert.equal(next.workflowAdapterId, WORKFLOW_MODES.JSON_RVM_PCF);
  assert.equal(next.sourceKind, RVM_JSON_PCF_SOURCE_KIND);
  assert.equal(next.scope, 'selected');
  assert.deepEqual(next.selectedCanonicalIds, ['X']);
  assert.equal(next.activeWorkflowPhase, 'preview');
  assert.equal(next.requestedPanel, 'workflow');
  assert.equal(next.openWorkflow, true);
}

function testNormalizePayloadUsesExistingSelectedIdsFallback() {
  const next = normalizeRvmJsonPcfRequestPayload({
    payload: {},
    appState: {
      rvmPcfExtract: {
        selectedCanonicalIds: ['KEEP-ME'],
      },
    },
  });

  assert.equal(next.scope, 'selected');
  assert.deepEqual(next.selectedCanonicalIds, ['KEEP-ME']);
}

function testScopeResolver() {
  assert.equal(resolveRvmJsonPcfScope({ selectedCanonicalIds: [] }), 'full');
  assert.equal(resolveRvmJsonPcfScope({ selectedCanonicalIds: ['A'] }), 'selected');
  assert.equal(resolveRvmJsonPcfScope({ scope: 'selected', selectedCanonicalIds: [] }), 'selected');
}

const tests = [
  testBuildPayloadFromCurrentRvmSelection,
  testBuildPayloadFallsBackToFullScope,
  testExplicitSelectedIdsOverrideState,
  testNormalizePayloadForExtractState,
  testNormalizePayloadUsesExistingSelectedIdsFallback,
  testScopeResolver,
];

for (const test of tests) {
  test();
}

console.log(`rvm-pcf-trigger-helpers: ${tests.length} checks passed`);
