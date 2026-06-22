const CACHE_KEY = '20260622-rvm-raw-support-final-suppression-1';
const GLOBAL_KEY = '__PCF_GLB_RVM_RAW_SUPPORT_FINAL_SUPPRESSION__';
const GENERATED_ROOTS = [
  '__RVM_GEOMETRY_SUPPORT_SYMBOLS__',
  '__RVM_SUPPORT_ASSEMBLY_MARKERS__',
  '__RVM_EXPORTABLE_SUPPORT_GEOMETRY__',
];
const PROCESS_RE = /\bPE_\d+_(PIPE|BEND|ELBOW|VALVE|FLANGE|FLANGE_PAIR|TEE|REDUCER|UNSPECIFIED)\b|\b(PIPE|BEND|ELBOW|VALVE|FLANGE|TEE)\b/i;
const SUPPORT_RE = /\bINPUTXML-\d+-(REST|GUIDE|LINESTOP|SUPPORT|ANCHOR|LIMIT|SPRING)\b|\b(REST|GUIDE|LINE\s*STOP|LINESTOP|SUPPORT|ANCHOR|SHOE)\b/i;

export function installRvmRawSupportFinalSuppressionBridge() {
  let attempts = 0;
  const attach = () => {
    attempts += 1;
    const root = document.querySelector('[data-rvm-viewer]');
    const viewer = globalThis.__3D_RVM_VIEWER__;
    if (root && viewer) bind(root, viewer);
    if ((!root || !viewer) && attempts < 180) setTimeout(attach, 300);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true });
  else attach();
}

function bind(root, viewer) {
  if (!root || root.dataset.rvmRawSupportFinalSuppression === CACHE_KEY) return;
  root.dataset.rvmRawSupportFinalSuppression = CACHE_KEY;
  const run = () => apply(root, viewer);
  for (const delay of [120, 360, 800, 1500, 3000, 6000]) setTimeout(run, delay);
  const timer = setInterval(run, 650);
  root._rvmRawSupportFinalSuppressionCleanup = () => clearInterval(timer);
  globalThis[GLOBAL_KEY] = { cacheKey: CACHE_KEY, apply: run, last: null };
}

function apply(root, viewer) {
  const mode = supportMode(root);
  const diag = {
    schema: 'rvm-raw-support-final-suppression/v1',
    cacheKey: CACHE_KEY,
    mode,
    removedGeneratedRootCount: 0,
    scrubbedProcessSupportFlagCount: 0,
    hiddenGeneratedProcessObjectCount: 0,
  };

  if (mode === 'raw') {
    for (const name of GENERATED_ROOTS) diag.removedGeneratedRootCount += removeRoot(viewer, name);
  }

  viewer?.modelGroup?.traverse?.((obj) => {
    if (!obj) return;
    const text = objectText(obj);
    const processLike = PROCESS_RE.test(text) && !SUPPORT_RE.test(text);
    const data = obj.userData || {};
    if (processLike && hasSupportFlags(data)) {
      clearSupportFlags(data);
      diag.scrubbedProcessSupportFlagCount += 1;
    }
    if (mode === 'raw' && processLike && (data.rvmSupportGeometryGenerated || data.supportSymbol || data.rvmSupportSymbolGenerated || data.rvmSupportAssembly)) {
      obj.visible = false;
      data.nonSelectableReason = 'raw mode hides generated process-like support overlay';
      diag.hiddenGeneratedProcessObjectCount += 1;
    }
  });

  globalThis[GLOBAL_KEY] = { cacheKey: CACHE_KEY, apply: () => apply(root, viewer), last: diag };
  return diag;
}

function removeRoot(viewer, name) {
  const scene = viewer?.scene || viewer?.modelGroup;
  const found = scene?.getObjectByName?.(name) || viewer?.modelGroup?.getObjectByName?.(name);
  if (!found) return 0;
  found.parent?.remove?.(found);
  dispose(found);
  return 1;
}

function supportMode(root) {
  const explicit = String(root?.dataset?.rvmSupportMode || '').toLowerCase();
  if (explicit) return explicit;
  try {
    const saved = String(localStorage.getItem('rvm_support_render_mode_v1') || '').toLowerCase();
    return ['raw', 'symbol', 'both'].includes(saved) ? saved : 'raw';
  } catch (_) {
    return 'raw';
  }
}

function objectText(obj) {
  const data = obj?.userData || {};
  const attrs = data.browserRvmAttributes || data.attributes || {};
  const props = data.browserRvmProperties || {};
  return [
    obj?.name,
    data.displayName,
    data.sourcePath,
    data.type,
    data.kind,
    data.effectiveRenderPrimitive,
    attrs.NAME,
    attrs.TYPE,
    attrs.SOURCE_PATH,
    attrs.RVM_OWNER_NAME,
    attrs.RVM_OWNER_PATH,
    attrs.RVM_BROWSER_SUPPORT_KIND,
    props.sourcePath,
  ].map((value) => String(value || '')).join(' ');
}

function hasSupportFlags(data) {
  return Boolean(data.rvmSupportCandidate || data.rvmSupportCandidateKind || data.rvmSupportEngineMapped || data.RVM_BROWSER_SUPPORT_HINT === 'true' || data.RVM_BROWSER_SUPPORT_KIND);
}

function clearSupportFlags(data) {
  for (const key of ['rvmSupportCandidate', 'rvmSupportCandidateKind', 'rvmSupportEngineMapped', 'rvmSupportEngineConfidence', 'RVM_BROWSER_SUPPORT_HINT', 'RVM_BROWSER_SUPPORT_KIND']) delete data[key];
  const attrs = data.browserRvmAttributes;
  if (attrs && typeof attrs === 'object') for (const key of ['TYPE', 'SUPPORT_KIND', 'RVM_BROWSER_SUPPORT_HINT', 'RVM_BROWSER_SUPPORT_KIND', 'supportStagedJsonRole', 'supportEngineSchema']) delete attrs[key];
}

function dispose(root) {
  root?.traverse?.((obj) => {
    obj.geometry?.dispose?.();
    if (Array.isArray(obj.material)) obj.material.forEach((mat) => mat?.dispose?.());
    else obj.material?.dispose?.();
  });
}
