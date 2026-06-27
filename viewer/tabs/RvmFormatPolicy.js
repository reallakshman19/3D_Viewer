export const RVM_FORMAT_POLICY_VERSION = '20260627-rvm-right-panel-format-policy-1';

const PRIMITIVE_SOURCE_KINDS = new Set(['rvm', 'rev', 'glb', 'gltf']);
const SOURCE_PREVIEW_KINDS = new Set(['json', 'jscon', 'inputxml', 'uxml', 'txt', 'source-preview', 'stagedjson']);

const BASE_SELECTION_POLICY = Object.freeze({
  showSelection: true,
  showNativeDiagnostics: false,
  showSourceTools: false,
  showSupportDetails: false,
  showNodeMarkers: false,
  showStagedJsonReview: false,
});

const POLICY_BY_KIND = Object.freeze({
  rvm: Object.freeze({ ...BASE_SELECTION_POLICY, showNativeDiagnostics: true }),
  rev: Object.freeze({ ...BASE_SELECTION_POLICY, showNativeDiagnostics: true }),
  glb: Object.freeze({ ...BASE_SELECTION_POLICY, showNativeDiagnostics: true }),
  gltf: Object.freeze({ ...BASE_SELECTION_POLICY, showNativeDiagnostics: true }),
  json: Object.freeze({ ...BASE_SELECTION_POLICY, showSourceTools: true, showSupportDetails: true, showNodeMarkers: true }),
  jscon: Object.freeze({ ...BASE_SELECTION_POLICY, showSourceTools: true, showSupportDetails: true, showNodeMarkers: true }),
  inputxml: Object.freeze({ ...BASE_SELECTION_POLICY, showSourceTools: true, showSupportDetails: true, showNodeMarkers: true }),
  uxml: Object.freeze({ ...BASE_SELECTION_POLICY, showSourceTools: true, showSupportDetails: true, showNodeMarkers: true }),
  txt: Object.freeze({ ...BASE_SELECTION_POLICY, showSourceTools: true, showSupportDetails: true, showNodeMarkers: true }),
  'source-preview': Object.freeze({ ...BASE_SELECTION_POLICY, showSourceTools: true, showSupportDetails: true, showNodeMarkers: true }),
  stagedjson: Object.freeze({ ...BASE_SELECTION_POLICY, showSourceTools: true, showSupportDetails: true, showNodeMarkers: true, showStagedJsonReview: true }),
  unknown: BASE_SELECTION_POLICY,
});

export function normalizeRvmSourceKind(value = '') {
  const kind = String(value || '').trim().toLowerCase().replace(/^\./, '');
  if (!kind || kind === 'aveva-json') return 'json';
  if (kind === 'xml') return 'inputxml';
  if (kind === 'staged-json' || kind === 'staged_json' || kind === 'staged.json') return 'stagedjson';
  if (kind === 'rvm_binary' || kind === 'rvm-binary') return 'rvm';
  return kind;
}

export function sourceKindFromFileName(fileName = '') {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.stagedjson') || lower.endsWith('.staged.json')) return 'stagedjson';
  if (lower.endsWith('.jscon')) return 'jscon';
  if (lower.endsWith('.uxml') || lower.endsWith('.uxml.json')) return 'inputxml';
  if (lower.endsWith('.txt')) return 'txt';
  if (lower.endsWith('.rev')) return 'rev';
  if (lower.endsWith('.rvm')) return 'rvm';
  if (lower.endsWith('.glb')) return 'glb';
  if (lower.endsWith('.gltf')) return 'gltf';
  if (lower.endsWith('.json')) return 'json';
  return '';
}

export function isRvmPrimitiveSourceKind(kind) {
  return PRIMITIVE_SOURCE_KINDS.has(normalizeRvmSourceKind(kind));
}

export function isRvmSourcePreviewKind(kind) {
  return SOURCE_PREVIEW_KINDS.has(normalizeRvmSourceKind(kind));
}

export function getRvmRightPanelPolicy(kind, primitiveMode = '') {
  const sourceKind = normalizeRvmSourceKind(kind || 'unknown');
  const base = POLICY_BY_KIND[sourceKind] || POLICY_BY_KIND.unknown;
  if (String(primitiveMode || '').toLowerCase() === 'source-preview' && isRvmSourcePreviewKind(sourceKind)) return base;
  if (isRvmPrimitiveSourceKind(sourceKind)) return POLICY_BY_KIND[sourceKind] || POLICY_BY_KIND.unknown;
  return base;
}

export function resolveRvmFormatContext({ root = null, viewer = globalThis.__3D_RVM_VIEWER__ } = {}) {
  const activeRoot = root || globalThis.document?.querySelector?.('[data-rvm-viewer]') || null;
  const model = viewer?.modelGroup || viewer?.scene || null;
  const userData = model?.userData || {};
  const fileName = String(
    userData.fileName
      || viewer?.loadedFileName
      || viewer?.sourceFileName
      || activeRoot?.dataset?.rvmFileName
      || ''
  );
  const fileKind = sourceKindFromFileName(fileName);
  const stampedKind = normalizeRvmSourceKind(
    activeRoot?.dataset?.rvmLoadedSourceKind
      || userData.__rvmNonPrimitiveSourceKind
      || userData.__rvmNonPrimitiveAutoBendSourceKind
      || userData.sourceKind
      || viewer?.sourceKind
      || ''
  );
  const detectedKind = fileKind === 'stagedjson' && (!stampedKind || stampedKind === 'json' || stampedKind === 'source-preview')
    ? 'stagedjson'
    : normalizeRvmSourceKind(stampedKind || fileKind || 'unknown');
  const primitiveMode = String(activeRoot?.dataset?.rvmModelPrimitiveMode || viewer?.modelPrimitiveMode || '').toLowerCase();
  const source = userData.__rvmNonPrimitiveAutoBendSourceHierarchy || userData.__rvmNonPrimitiveSourceHierarchy || null;
  const supportSource = userData.__rvmNonPrimitiveSourceHierarchy || source;
  const policy = getRvmRightPanelPolicy(detectedKind, primitiveMode);
  return {
    root: activeRoot,
    viewer,
    model,
    userData,
    sourceKind: detectedKind,
    primitiveMode,
    fileName,
    source,
    supportSource,
    policy,
    isPrimitive: isRvmPrimitiveSourceKind(detectedKind),
    isSourcePreview: primitiveMode === 'source-preview' && isRvmSourcePreviewKind(detectedKind),
    version: RVM_FORMAT_POLICY_VERSION,
  };
}
