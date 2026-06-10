/**
 * Shared workflow adapter contract tests - plain Node ESM, no DOM required.
 */

const { WORKFLOW_MODES, assertWorkflowAdapter } = await import('../../../tabs/model-converters/workflow/WorkflowAdapterContract.js');
const { getWorkflowAdapter, listWorkflowAdapters } = await import('../../../tabs/model-converters/workflow/adapters/workflow-adapter-registry.js');

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

assert(WORKFLOW_MODES.XML_CII_2019 === 'xml_cii_2019', 'T1: XML_CII_2019 mode is stable');
assert(WORKFLOW_MODES.JSON_RVM_PCF === 'json_rvm_pcf', 'T1: JSON_RVM_PCF mode is stable');

const xmlAdapter = getWorkflowAdapter(WORKFLOW_MODES.XML_CII_2019);
const jsonAdapter = getWorkflowAdapter(WORKFLOW_MODES.JSON_RVM_PCF);

assert(assertWorkflowAdapter(xmlAdapter) === xmlAdapter, 'T2: XML adapter satisfies contract');
assert(assertWorkflowAdapter(jsonAdapter) === jsonAdapter, 'T2: JSON/RVM PCF adapter satisfies contract');

assert(xmlAdapter.id === WORKFLOW_MODES.XML_CII_2019, 'T3: XML adapter id matches mode');
assert(jsonAdapter.id === WORKFLOW_MODES.JSON_RVM_PCF, 'T3: JSON adapter id matches mode');

const jsonPhaseModel = jsonAdapter.getPhaseModel({});
const phaseIds = (jsonPhaseModel.phases || []).map((phase) => phase.id);
assert(phaseIds.includes('importMasters'), 'T4: JSON adapter reuses Import Masters phase');
assert(phaseIds.includes('weightMatch'), 'T4: JSON adapter reuses Weight Match phase');
assert(phaseIds.includes('supportTypes'), 'T4: JSON adapter reuses Support Types phase');
assert(phaseIds.includes('run'), 'T4: JSON adapter exposes Run phase');
assert(jsonPhaseModel.notes?.preview?.includes('dry-run'), 'T5: JSON preview note marks dry-run enrichment');
assert(jsonPhaseModel.notes?.run?.includes('topology'), 'T5: JSON run note states topology-first flow');

const adapters = listWorkflowAdapters();
assert(adapters.length >= 2, 'T6: registry exposes at least two adapters');
assert(getWorkflowAdapter('missing-adapter').id === WORKFLOW_MODES.JSON_RVM_PCF, 'T7: registry fallback is JSON/RVM PCF');

const preview = await jsonAdapter.buildPreviewModel({});
assert(preview.previewOnly === true, 'T8: JSON preview model is preview-only');
assert(preview.commit === false, 'T8: JSON preview model is non-committing');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
