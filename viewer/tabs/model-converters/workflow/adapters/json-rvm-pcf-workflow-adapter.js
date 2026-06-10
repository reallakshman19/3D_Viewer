import { WORKFLOW_MODES } from '../WorkflowAdapterContract.js';

const PHASES = Object.freeze([
  { id: 'regex', label: 'Regex' },
  { id: 'importMasters', label: 'Import Masters' },
  { id: 'preview', label: 'Preview' },
  { id: 'diagnostics', label: 'Topology + Row Diagnostics' },
  { id: 'weightMatch', label: 'Weight Match' },
  { id: 'run', label: 'Run PCF' },
  { id: 'supportTypes', label: 'Support Types' },
  { id: 'config', label: 'Config' },
]);

function _baseModel(extra = {}) {
  return {
    mode: WORKFLOW_MODES.JSON_RVM_PCF,
    adapterId: WORKFLOW_MODES.JSON_RVM_PCF,
    title: 'JSON/RVM → PCF',
    subtitle: 'Uses the shared XML→CII(2019) master/enrichment workflow UI through adapter models.',
    ...extra,
  };
}

function _notYetImplemented(methodName) {
  return async () => _baseModel({
    ok: false,
    deferred: true,
    message: `${methodName} is adapter-owned and will be wired to the existing RVM extract workflow in the row-enrichment branch.`,
  });
}

export const jsonRvmPcfWorkflowAdapter = Object.freeze({
  id: WORKFLOW_MODES.JSON_RVM_PCF,
  label: 'JSON/RVM → PCF',

  getPhaseModel() {
    return _baseModel({
      defaultPhase: 'preview',
      phases: PHASES,
      notes: {
        preview: 'Preview is dry-run enrichment only; final PCF export still requires topology acceptance first.',
        run: 'Final run sequence is topology → enrichment → RvmPcfEmitter.',
      },
    });
  },

  async loadSource({ rows = [], stagedJsonText = '', primaryText = '', secondaryText = '' } = {}) {
    return _baseModel({
      ok: true,
      sourceKind: 'RVM_VIEWER_CURRENT_MODEL',
      rows,
      stagedJsonText: stagedJsonText || secondaryText || primaryText || '',
      primaryText,
      secondaryText,
    });
  },

  buildMasterContext: _notYetImplemented('buildMasterContext'),

  async buildRegexModel() {
    return _baseModel({
      phase: 'regex',
      description: 'Uses the shared XML→CII regex/line-key rules against pipelineRef, branchName, and lineNoKey from legacy PCF rows.',
    });
  },

  async buildImportMastersModel() {
    return _baseModel({
      phase: 'importMasters',
      description: 'Reuses the existing XML→CII Import Masters UI and master definitions. No JSON/RVM-specific Masters tab is created.',
    });
  },

  async buildPreviewModel() {
    return _baseModel({
      phase: 'preview',
      previewOnly: true,
      commit: false,
      description: 'Dry-run legacy row enrichment preview. It must not emit PCF and must not commit final enrichment before topology acceptance.',
      columns: [
        'pipelineRef',
        'lineNoKey',
        'type',
        'nodeName',
        'resolvedPipingClass',
        'rating',
        'material',
        'wallThicknessMm',
        'corrosionAllowanceMm',
        'dtxr',
        'weight',
        'supportKind',
        'ca',
      ],
      rows: [],
      diagnostics: [],
    });
  },

  async runDiagnostics() {
    return _baseModel({
      phase: 'diagnostics',
      description: 'Shows topology and row-enrichment diagnostics for JSON/RVM→PCF mode.',
      diagnostics: [],
    });
  },

  async runWeightMatch() {
    return _baseModel({
      phase: 'weightMatch',
      description: 'Reuses XML→CII valve/weight ranking against legacy PCF rows.',
      candidates: [],
    });
  },

  async runSupportTypes() {
    return _baseModel({
      phase: 'supportTypes',
      description: 'Reuses support mapping services to populate PCF support row metadata only. CII restraint functions remain outside this route.',
      rows: [],
    });
  },

  async buildConfigModel() {
    return _baseModel({
      phase: 'config',
      options: {
        runTopologyBeforeEnrichment: true,
        rejectFinalPcfIfTopologyFails: true,
        preserveExistingCaValues: true,
        overwriteCaFromEnrichment: false,
      },
    });
  },

  async runFinal() {
    return _baseModel({
      phase: 'run',
      ok: false,
      deferred: true,
      finalRunOrder: [
        'Build geometry-only PCF',
        'PCF → Standard XML → UXML topology gate',
        'Apply topology handoff to legacy rows',
        'Enrich rows using XML→CII shared master/resolver services',
        'Emit final PCF using RvmPcfEmitter',
      ],
      message: 'Final JSON/RVM→PCF run is intentionally deferred until row enrichment and topology-gate service wiring are added.',
    });
  },
});
