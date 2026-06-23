import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260622-rvm-leaf-picking-2';
import { readNonPrimitiveAutoBendSettings, writeNonPrimitiveAutoBendSettings } from '../overlays/autobend/NonPrimitiveAutoBendSettings.js';
import { readNonPrimitiveSupportOverlaySettings, writeNonPrimitiveSupportOverlaySettings } from '../overlays/support/SupportOverlaySettings.js';
import {
  buildNonPrimitiveSourceToolsDiagnosticsSnapshot,
  sourceToolsDiagnosticsFileName,
} from '../overlays/source-tools/NonPrimitiveSourceToolsDiagnostics.js';

export const RVM_NON_PRIMITIVE_SOURCE_TOOLS_UI_SCHEMA = 'rvm-non-primitive-source-tools-ui/v3';

const PATCH_FLAG = Symbol.for('pcf-glb-rvm-non-primitive-source-tools-ui-v3');
const VIEWER_PATCH_FLAG = Symbol.for('pcf-glb-rvm-non-primitive-source-tools-ui-viewer-v3');
const ROOT_SELECTOR = '[data-rvm-viewer]';
const PANEL_ID = 'rvm-nonprimitive-source-tools-panel';
const SOURCE_KIND_RE = /^(json|jscon|inputxml|txt|source-preview)$/i;
const PRIMITIVE_KIND_RE = /^(rvm|glb|gltf|rev)$/i;
const SUPPORT_FILTER_FAMILIES = Object.freeze(['REST', 'GUIDE', 'LINESTOP', 'LIMIT', 'LIM', 'HOLDDOWN', 'SPRING_CAN', 'UNKNOWN']);
const MAX_INLINE_WARNINGS = 3;
const viewerContexts = new WeakMap();

export function installRvmNonPrimitiveSourceToolsUiBridge() {
  if (globalThis[PATCH_FLAG]) return;
  globalThis[PATCH_FLAG] = true;
  globalThis.__PCF_GLB_RVM_NON_PRIMITIVE_SOURCE_TOOLS_UI__ = {
    schema: RVM_NON_PRIMITIVE_SOURCE_TOOLS_UI_SCHEMA,
    sync: syncAllSourceToolsUi,
    render: renderSourceToolsUi,
    reapply: reapplyFromControls,
    snapshot: buildSourceToolsDiagnosticsSnapshot,
    copyDiagnostics: copySourceToolsDiagnostics,
    downloadDiagnostics: downloadSourceToolsDiagnostics,
  };
  patchRvmViewerSetModelForSourceToolsUi();
  try { globalThis.addEventListener?.('rvm-model-loaded', () => syncAllSourceToolsUi()); } catch (_) {}
  queueMicrotask(syncAllSourceToolsUi);
}

function patchRvmViewerSetModelForSourceToolsUi() {
  const proto = RvmViewer3D?.prototype;
  if (!proto || proto[VIEWER_PATCH_FLAG] || typeof proto.setModel !== 'function') return;
  const originalSetModel = proto.setModel;
  proto.setModel = function setModelWithNonPrimitiveSourceToolsUi(model, upAxis = 'Y') {
    const result = originalSetModel.call(this, model, upAxis);
    const context = contextFromModel(model, this);
    if (context.source) viewerContexts.set(this, context);
    else viewerContexts.delete(this);
    syncAllSourceToolsUi();
    return result;
  };
  proto[VIEWER_PATCH_FLAG] = true;
}

function contextFromModel(model, viewer) {
  const source = model?.userData?.__rvmNonPrimitiveAutoBendSourceHierarchy
    || model?.userData?.__rvmNonPrimitiveSourceHierarchy
    || null;
  const supportSource = model?.userData?.__rvmNonPrimitiveSourceHierarchy || source;
  const sourceKind = normalizeSourceKind(
    model?.userData?.__rvmNonPrimitiveAutoBendSourceKind
      || model?.userData?.__rvmNonPrimitiveSourceKind
      || model?.userData?.sourceKind
      || viewer?.sourceKind
      || ''
  );
  return { source, supportSource, sourceKind, fileName: model?.userData?.fileName || '' };
}

export function syncAllSourceToolsUi() {
  const roots = globalThis.document?.querySelectorAll?.(ROOT_SELECTOR) || [];
  for (const root of roots) renderSourceToolsUi(root, globalThis.__3D_RVM_VIEWER__);
}

export function renderSourceToolsUi(root, viewer = globalThis.__3D_RVM_VIEWER__) {
  if (!root) return null;
  const mode = String(root.dataset?.rvmModelPrimitiveMode || '').toLowerCase();
  const kind = normalizeSourceKind(root.dataset?.rvmLoadedSourceKind || viewerContexts.get(viewer)?.sourceKind || '');
  const shouldShow = mode === 'source-preview' && isNonPrimitiveKind(kind);
  const panel = ensurePanel(root);
  if (!panel) return null;
  panel.hidden = !shouldShow;
  panel.dataset.sourceToolsActive = shouldShow ? 'true' : 'false';
  if (!shouldShow) return panel;
  panel.innerHTML = renderPanelHtml({ auto: readNonPrimitiveAutoBendSettings(), support: readNonPrimitiveSupportOverlaySettings(), viewer });
  bindPanel(root, panel, viewer);
  return panel;
}

function ensurePanel(root) {
  let panel = root.querySelector(`#${PANEL_ID}`);
  if (panel) return panel;
  const rightPanel = root.querySelector('.rvm-right-panel');
  if (!rightPanel) return null;
  const header = globalThis.document?.createElement?.('div');
  panel = globalThis.document?.createElement?.('div');
  if (!header || !panel) return null;
  header.className = 'rvm-panel-header';
  header.dataset.rvmNonPrimitiveSourceToolsHeader = 'true';
  header.textContent = 'Source Tools';
  panel.id = PANEL_ID;
  panel.className = 'rvm-source-tools-panel rvm-tag-list';
  panel.dataset.rvmNonPrimitiveSourceTools = 'true';
  const diagnosticsHeader = rightPanel.querySelector('[data-rvm-browser-diagnostics-header="true"]');
  if (diagnosticsHeader) {
    rightPanel.insertBefore(header, diagnosticsHeader);
    rightPanel.insertBefore(panel, diagnosticsHeader);
  } else {
    rightPanel.append(header, panel);
  }
  return panel;
}

function renderPanelHtml({ auto, support, viewer }) {
  const autoDiag = viewer?.nonPrimitiveAutoBendDiagnostics || {};
  const supportDiag = viewer?.nonPrimitiveSupportOverlayDiagnostics || {};
  const supportWarningCount = Number(supportDiag.warningCount ?? supportDiag.warnings?.length ?? 0) || 0;
  const snapshot = buildSourceToolsDiagnosticsSnapshot(viewer);
  return `
    <div class="rvm-source-tools-grid" data-source-tools-schema="${escapeHtml(RVM_NON_PRIMITIVE_SOURCE_TOOLS_UI_SCHEMA)}">
      <label class="rvm-source-tools-row"><span>Auto Bend</span><input type="checkbox" data-source-tool="auto-enabled" ${auto.enabled ? 'checked' : ''}></label>
      <label class="rvm-source-tools-row"><span>Radius</span><select data-source-tool="auto-radius-mode"><option value="source-or-od" ${auto.radiusMode === 'source-or-od' ? 'selected' : ''}>Source / OD×${escapeHtml(auto.defaultRadiusFactor)}</option><option value="source-only" ${auto.radiusMode === 'source-only' ? 'selected' : ''}>Source only</option></select></label>
      <label class="rvm-source-tools-row"><span>Bend diagnostics</span><input type="checkbox" data-source-tool="auto-diagnostics" ${auto.showDiagnostics ? 'checked' : ''}></label>
      <div class="rvm-source-tools-diag" data-source-tool-diag="auto">Bends: ${escapeHtml(autoDiag.bendCount ?? 0)} · Trims: ${escapeHtml(autoDiag.trimCount ?? 0)} · ${escapeHtml(autoDiag.status || 'idle')}</div>
      <label class="rvm-source-tools-row"><span>Support Overlay</span><input type="checkbox" data-source-tool="support-enabled" ${support.enabled ? 'checked' : ''}></label>
      <label class="rvm-source-tools-row"><span>Support scale</span><input type="range" min="0.2" max="10" step="0.1" value="${escapeHtml(support.scale)}" data-source-tool="support-scale"><strong data-source-tool-scale-value>${escapeHtml(formatScale(support.scale))}</strong></label>
      <label class="rvm-source-tools-row"><span>Support labels</span><input type="checkbox" data-source-tool="support-labels" ${support.labels ? 'checked' : ''}></label>
      <label class="rvm-source-tools-row"><span>Warnings only</span><input type="checkbox" data-source-tool="support-warnings" ${support.warningsOnly ? 'checked' : ''}></label>
      <div class="rvm-source-tools-filters" data-source-tool-filters="support"><span>Family filters</span>${renderSupportFamilyFilters(support.filters)}</div>
      <div class="rvm-source-tools-diag" data-source-tool-diag="support">Supports: ${escapeHtml(supportDiag.created ?? 0)} · Warnings: ${escapeHtml(supportWarningCount)} · ${escapeHtml(supportDiag.status || 'idle')}</div>
      ${renderSupportWarnings(supportDiag.warnings)}
      <div class="rvm-source-tools-actions" data-source-tool-actions="diagnostics">
        <button type="button" data-source-tool-action="copy-diagnostics">Copy diagnostics JSON</button>
        <button type="button" data-source-tool-action="download-diagnostics">Download diagnostics JSON</button>
        <span class="rvm-source-tools-diag" data-source-tool-diag="diagnostics-snapshot">Snapshot: auto ${escapeHtml(snapshot.autoBend.status || 'idle')} · support ${escapeHtml(snapshot.supportOverlay.status || 'idle')}</span>
      </div>
    </div>`;
}

function renderSupportFamilyFilters(filters = {}) {
  return SUPPORT_FILTER_FAMILIES.map((family) => {
    const checked = filters?.[family] !== false;
    const label = family === 'SPRING_CAN' ? 'SPRING' : family;
    return `<label class="rvm-source-tools-chip" data-source-tool-family-chip="${escapeHtml(family)}"><input type="checkbox" data-source-tool="support-filter" data-source-tool-family="${escapeHtml(family)}" ${checked ? 'checked' : ''}>${escapeHtml(label)}</label>`;
  }).join('');
}

function renderSupportWarnings(warnings = []) {
  const rows = Array.isArray(warnings) ? warnings.slice(0, MAX_INLINE_WARNINGS) : [];
  if (!rows.length) return '<div class="rvm-source-tools-diag" data-source-tool-diag="support-warnings">No support overlay warnings.</div>';
  const items = rows.map((warning) => {
    const id = warning.supportId || warning.nodeId || warning.family || 'support';
    const code = warning.code || warning.message || String(warning);
    return `<li>${escapeHtml(id)}: ${escapeHtml(code)}</li>`;
  }).join('');
  return `<div class="rvm-source-tools-diag" data-source-tool-diag="support-warnings"><span>Top warnings</span><ul>${items}</ul></div>`;
}

function bindPanel(root, panel, viewer) {
  if (panel.dataset.boundSourceToolsUi === 'true') return;
  panel.dataset.boundSourceToolsUi = 'true';
  panel.addEventListener('change', (event) => {
    const control = event.target?.closest?.('[data-source-tool]');
    if (!control) return;
    const tool = control.dataset.sourceTool;
    if (tool === 'auto-enabled') writeNonPrimitiveAutoBendSettings({ enabled: !!control.checked });
    else if (tool === 'auto-radius-mode') writeNonPrimitiveAutoBendSettings({ radiusMode: control.value || 'source-or-od' });
    else if (tool === 'auto-diagnostics') writeNonPrimitiveAutoBendSettings({ showDiagnostics: !!control.checked });
    else if (tool === 'support-enabled') writeNonPrimitiveSupportOverlaySettings({ enabled: !!control.checked });
    else if (tool === 'support-scale') writeNonPrimitiveSupportOverlaySettings({ scale: Number(control.value) || 1 });
    else if (tool === 'support-labels') writeNonPrimitiveSupportOverlaySettings({ labels: !!control.checked });
    else if (tool === 'support-warnings') writeNonPrimitiveSupportOverlaySettings({ warningsOnly: !!control.checked });
    else if (tool === 'support-filter') writeNonPrimitiveSupportOverlaySettings({ filters: nextSupportFilters(control) });
    reapplyFromControls(root, viewer || globalThis.__3D_RVM_VIEWER__);
  });
  panel.addEventListener('click', (event) => {
    const control = event.target?.closest?.('[data-source-tool-action]');
    if (!control) return;
    const action = control.dataset.sourceToolAction;
    if (action === 'copy-diagnostics') {
      copySourceToolsDiagnostics(viewer || globalThis.__3D_RVM_VIEWER__).catch?.(() => {});
    } else if (action === 'download-diagnostics') {
      downloadSourceToolsDiagnostics(viewer || globalThis.__3D_RVM_VIEWER__);
    }
  });
}

function nextSupportFilters(control) {
  const family = String(control.dataset?.sourceToolFamily || '').toUpperCase();
  const current = readNonPrimitiveSupportOverlaySettings().filters || {};
  if (!SUPPORT_FILTER_FAMILIES.includes(family)) return current;
  return { ...current, [family]: !!control.checked };
}

export function reapplyFromControls(root, viewer = globalThis.__3D_RVM_VIEWER__) {
  const context = viewer ? viewerContexts.get(viewer) : null;
  const kind = normalizeSourceKind(root?.dataset?.rvmLoadedSourceKind || context?.sourceKind || '');
  if (!viewer || !context?.source || !isNonPrimitiveKind(kind)) return { status: 'skipped', reason: 'missing-nonprimitive-context' };

  const auto = readNonPrimitiveAutoBendSettings();
  const support = readNonPrimitiveSupportOverlaySettings();

  if (auto.enabled) globalThis.__PCF_GLB_RVM_NON_PRIMITIVE_AUTO_BEND__?.applyFromSource?.({ viewer, source: context.source, sourceKind: kind, fileName: context.fileName });
  else globalThis.__PCF_GLB_RVM_NON_PRIMITIVE_AUTO_BEND__?.clear?.(viewer, 'source-tools-disabled');

  if (support.enabled) globalThis.__PCF_GLB_RVM_NON_PRIMITIVE_SUPPORT_OVERLAY__?.applyFromSource?.({ viewer, source: context.supportSource || context.source, sourceKind: kind, fileName: context.fileName });
  else globalThis.__PCF_GLB_RVM_NON_PRIMITIVE_SUPPORT_OVERLAY__?.clear?.(viewer, 'source-tools-disabled');

  renderSourceToolsUi(root, viewer);
  return { status: 'applied', autoEnabled: auto.enabled, supportEnabled: support.enabled };
}

export function buildSourceToolsDiagnosticsSnapshot(viewer = globalThis.__3D_RVM_VIEWER__, context = {}) {
  return buildNonPrimitiveSourceToolsDiagnosticsSnapshot({
    viewer,
    context,
    uiSchema: RVM_NON_PRIMITIVE_SOURCE_TOOLS_UI_SCHEMA,
    normalizeSourceKind,
  });
}

export async function copySourceToolsDiagnostics(viewer = globalThis.__3D_RVM_VIEWER__, context = {}) {
  const text = JSON.stringify(buildSourceToolsDiagnosticsSnapshot(viewer, context), null, 2);
  if (globalThis.navigator?.clipboard?.writeText) {
    await globalThis.navigator.clipboard.writeText(text);
    return { status: 'copied', bytes: text.length };
  }
  const textarea = globalThis.document?.createElement?.('textarea');
  if (!textarea) return { status: 'unavailable', reason: 'clipboard-api-missing', bytes: text.length };
  textarea.value = text;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  globalThis.document.body?.appendChild?.(textarea);
  textarea.select?.();
  let copied = false;
  try { copied = !!globalThis.document.execCommand?.('copy'); } catch (_) { copied = false; }
  textarea.remove?.();
  return { status: copied ? 'copied' : 'unavailable', bytes: text.length };
}

export function downloadSourceToolsDiagnostics(viewer = globalThis.__3D_RVM_VIEWER__, context = {}) {
  const snapshot = buildSourceToolsDiagnosticsSnapshot(viewer, context);
  const text = JSON.stringify(snapshot, null, 2);
  const doc = globalThis.document;
  const BlobCtor = globalThis.Blob;
  const URLApi = globalThis.URL;
  if (!doc?.createElement || !BlobCtor || !URLApi?.createObjectURL) return { status: 'unavailable', reason: 'download-api-missing', bytes: text.length };
  const blob = new BlobCtor([text], { type: 'application/json' });
  const url = URLApi.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = sourceToolsDiagnosticsFileName(snapshot);
  link.style.display = 'none';
  doc.body?.appendChild?.(link);
  link.click?.();
  link.remove?.();
  setTimeout(() => URLApi.revokeObjectURL?.(url), 0);
  return { status: 'downloaded', fileName: link.download, bytes: text.length };
}

function isNonPrimitiveKind(kind) {
  const normalized = normalizeSourceKind(kind);
  return SOURCE_KIND_RE.test(normalized) && !PRIMITIVE_KIND_RE.test(normalized);
}

function normalizeSourceKind(value) {
  const kind = String(value || '').trim().toLowerCase().replace(/^\./, '');
  if (!kind || kind === 'aveva-json' || kind === 'source-preview') return 'json';
  if (kind === 'xml' || kind === 'uxml') return 'inputxml';
  return kind;
}

function formatScale(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 1;
  return `${Math.round(safe * 100)}%`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
