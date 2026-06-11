#!/usr/bin/env node

/**
 * Static/drop-in panel tests for the RVM JSON/RVM -> PCF workflow panel.
 * These tests validate the mountable shared-workflow panel adapter boundary only.
 * They do not validate final topology/enrichment/emitter execution.
 */

import assert from 'node:assert/strict';
import {
  buildRvmJsonPcfWorkflowPanelModel,
  renderRvmJsonPcfWorkflowPanel,
  createRvmJsonPcfWorkflowActions,
  RVM_JSON_PCF_WORKFLOW_DEFAULTS,
} from '../tabs/rvm-json-pcf-workflow-panel.js';
import { WORKFLOW_MODES } from '../tabs/model-converters/workflow/WorkflowAdapterContract.js';

function testDefaultModelUsesJsonRvmPcfAdapter() {
  const model = buildRvmJsonPcfWorkflowPanelModel({});

  assert.equal(model.adapterId, WORKFLOW_MODES.JSON_RVM_PCF);
  assert.equal(model.workflowState.workflowMode, WORKFLOW_MODES.JSON_RVM_PCF);
  assert.equal(model.workflowState.workflowAdapterId, WORKFLOW_MODES.JSON_RVM_PCF);
  assert.equal(model.workflowState.sourceKind, 'RVM_VIEWER_CURRENT_MODEL');
  assert.equal(model.activePhase, 'preview');
  assert.equal(model.scope.scope, 'full');
}

function testExplicitPhaseAndSelectionArePreserved() {
  const model = buildRvmJsonPcfWorkflowPanelModel({
    activeWorkflowPhase: 'run',
    scope: 'selected',
    selectedCanonicalIds: ['A', 'B'],
  });

  assert.equal(model.activePhase, 'run');
  assert.equal(model.scope.scope, 'selected');
  assert.equal(model.scope.selectedCount, 2);
}

function testRenderIncludesSharedWorkflowShellAndDryRunNotice() {
  const html = renderRvmJsonPcfWorkflowPanel({
    extractState: {
      activeWorkflowPhase: 'preview',
      selectedCanonicalIds: ['A'],
    },
  });

  assert.match(html, /data-rvm-json-pcf-workflow="true"/);
  assert.match(html, /data-workflow-adapter="json_rvm_pcf"/);
  assert.match(html, /Preview is dry-run only/);
  assert.match(html, /Final PCF export must run topology, then enrichment, then RvmPcfEmitter/);
  assert.match(html, /Import Masters/);
  assert.match(html, /Run PCF/);
}

function testActionsUpdateWorkflowPhase() {
  const calls = [];
  let refreshed = 0;
  const actions = createRvmJsonPcfWorkflowActions({
    updateExtractState(patch, reason) {
      calls.push({ patch, reason });
    },
    refresh() {
      refreshed += 1;
    },
  });

  actions.setActiveWorkflowPhase('weightMatch');

  assert.deepEqual(calls, [{
    patch: { activeWorkflowPhase: 'weightMatch', requestedPanel: 'workflow' },
    reason: 'workflow-phase',
  }]);
  assert.equal(refreshed, 1);
}

function testDefaultsAreExportedForStateWiring() {
  assert.equal(RVM_JSON_PCF_WORKFLOW_DEFAULTS.workflowMode, WORKFLOW_MODES.JSON_RVM_PCF);
  assert.equal(RVM_JSON_PCF_WORKFLOW_DEFAULTS.workflowAdapterId, WORKFLOW_MODES.JSON_RVM_PCF);
  assert.equal(RVM_JSON_PCF_WORKFLOW_DEFAULTS.requestedPanel, 'workflow');
  assert.equal(RVM_JSON_PCF_WORKFLOW_DEFAULTS.activeWorkflowPhase, 'preview');
}

function run() {
  testDefaultModelUsesJsonRvmPcfAdapter();
  testExplicitPhaseAndSelectionArePreserved();
  testRenderIncludesSharedWorkflowShellAndDryRunNotice();
  testActionsUpdateWorkflowPhase();
  testDefaultsAreExportedForStateWiring();
  console.log('rvm-pcf-workflow-panel tests passed');
}

run();
