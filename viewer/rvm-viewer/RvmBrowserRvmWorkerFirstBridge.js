import { isLikelyRvmFileName } from '../rvm/BrowserRvmParser.js';
import { loadRvmFileInBrowser } from '../rvm/BrowserRvmLoadBridge.js?v=20260620-rvm-worker-first-1';
import { applyRvmSupportSymbolSettings } from './RvmSupportSymbols.js?v=20260618-support-kind-authority-1';

const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-worker-first-direct-bridge-v1');
const LISTENER_FLAG = '__pcfGlbRvmWorkerFirstDirectLoadListener';
const ACTIVE_JOB = Symbol.for('pcf-glb-rvm-worker-first-active-job-v1');
const MAX_TREE_ROWS = 320;

export function installBrowserRvmWorkerFirstBridge(root = document) {
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;

  patchRvmInputs(root);
  globalThis.addEventListener?.('rvm-browser-parse-diagnostics', (event) => renderWorkerDiagnostics(event.detail, document));

  if (typeof MutationObserver === 'function' && typeof document !== 'undefined') {
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type !== 'childList') continue;
        for (const node of record.addedNodes || []) {
          patchRvmInputs(node.nodeType === 1 ? node : document);
        }
      }
    });
    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
  }
}

function patchRvmInputs(root = document) {
  if (!root?.querySelectorAll) return;
  const inputs = root.querySelectorAll('#rvm-file-input, input[data-browser-rvm-fallback="true"]');
  inputs.forEach((input) => {
    input.setAttribute('accept', '.json,.uxml,.uxml.json,.rvm,.rev,.att');
    input.setAttribute('multiple', 'multiple');
    input.setAttribute('data-browser-rvm-worker-first', 'true');
    if (input[LISTENER_FLAG]) return;
    input.addEventListener('change', (event) => handleWorkerFirstRvmChange(event, input), { capture: true });
    input[LISTENER_FLAG] = true;
  });
}

function handleWorkerFirstRvmChange(event, input) {
  const files = Array.from(input?.files || []);
  const rvmFile = files.find((file) => isLikelyRvmFileName(file?.name));
  if (!rvmFile) return false;

  const viewer = globalThis.__3D_RVM_VIEWER__;
  if (!viewer) return false;

  event?.preventDefault?.();
  event?.stopPropagation?.();
  event?.stopImmediatePropagation?.();

  const root = input.closest?.('[data-rvm-viewer]') || document;
  cancelActiveJob(root);
  const abortController = new AbortController();
  root[ACTIVE_JOB] = { abortController, fileName: rvmFile.name };

  void loadWorkerFirstRvm({ root, viewer, files, rvmFile, abortController });
  return true;
}

async function loadWorkerFirstRvm({ root, viewer, files, rvmFile, abortController }) {
  const status = root?.querySelector?.('#rvm-sb-msg') || null;
  const startedAt = Date.now();
  setStatus(status, `Loading ${rvmFile.name} with worker-first RVM path…`);
  renderWorkerDiagnostics({
    fileName: rvmFile.name,
    browserRvmWorkerFirstPipeline: true,
    browserRvmWorkerEnabled: true,
    browserRvmProgressiveRenderEnabled: true,
    browserRvmLoadState: 'starting'
  }, root);

  try {
    const attText = await readBestAttSidecarText(files, rvmFile.name);
    const payload = await loadRvmFileInBrowser(rvmFile, viewer, {
      statusEl: status,
      attText,
      signal: abortController.signal,
      renderOptions: {
        maxRenderableObjects: 6000,
        batchSize: 64,
        timeSliceMs: 8
      },
      onDiagnostics: (diagnostics) => renderWorkerDiagnostics(diagnostics, root),
      onProgress: (progress) => {
        renderWorkerDiagnostics({
          fileName: rvmFile.name,
          browserRvmWorkerFirstPipeline: true,
          browserRvmWorkerEnabled: true,
          browserRvmProgressiveRenderEnabled: true,
          browserRvmLoadState: progress.stage || 'loading',
          browserRvmProgressProcessed: progress.processed,
          browserRvmProgressTotal: progress.total,
          browserRvmRenderableCount: progress.renderableCount,
          browserRvmSkippedCount: progress.skippedCount
        }, root);
      }
    });

    if (abortController.signal.aborted) return;
    updateRvmTabTreeFromPayload(root, payload);
    root?.querySelector?.('#rvm-placeholder')?.remove?.();
    try { applyRvmSupportSymbolSettings(viewer, browserSupportOptions(root)); } catch (_) {}
    renderWorkerDiagnostics(payload?.browserRvmParser || {}, root);
    const renderCount = payload?.browserRvmRender?.renderableCount ?? payload?.manifest?.browserRvmRenderScene?.renderableCount;
    setStatus(status, `Loaded browser RVM ${rvmFile.name}${Number.isFinite(renderCount) ? ` (${renderCount} renderable)` : ''}`);
    console.info('[BrowserRVM] worker-first load completed', {
      fileName: rvmFile.name,
      elapsedMs: Date.now() - startedAt,
      diagnostics: payload?.browserRvmParser || null
    });
  } catch (error) {
    if (abortController.signal.aborted || error?.name === 'AbortError') {
      setStatus(status, `Cancelled RVM load ${rvmFile.name}`);
      return;
    }
    setStatus(status, `RVM worker-first load failed: ${error?.message || error}`);
    renderWorkerDiagnostics({
      fileName: rvmFile.name,
      browserRvmWorkerFirstPipeline: true,
      browserRvmLoadFailed: true,
      error: error?.message || String(error)
    }, root);
    console.error('[BrowserRVM] worker-first direct load failed', error);
  } finally {
    if (root?.[ACTIVE_JOB]?.abortController === abortController) root[ACTIVE_JOB] = null;
  }
}

function cancelActiveJob(root) {
  try { root?.[ACTIVE_JOB]?.abortController?.abort?.(); } catch (_) {}
}

function setStatus(status, text) {
  if (status) status.textContent = text;
}

function isLikelyAttFileName(fileName = '') {
  return /\.att$/i.test(String(fileName || '').trim());
}

function sidecarKey(fileName = '') {
  return String(fileName || '').trim().toLowerCase().replace(/\.[^.]+$/, '');
}

async function readBestAttSidecarText(files, rvmFileName) {
  const list = Array.from(files || []);
  const rvmKey = sidecarKey(rvmFileName);
  const matching = list.find((file) => isLikelyAttFileName(file?.name) && sidecarKey(file.name) === rvmKey);
  if (!matching || typeof matching.text !== 'function') return '';
  try { return String(await matching.text() || ''); } catch (_) { return ''; }
}

function browserSupportOptions(root) {
  const rawScale = Number(root?.querySelector?.('#rvm-support-scale')?.value);
  const scale = Number.isFinite(rawScale) ? Math.max(0.25, Math.min(2.0, rawScale)) : 1.0;
  const labelsVisible = root?.querySelector?.('#rvm-support-labels')?.getAttribute('aria-pressed') === 'true';
  return {
    scaleMultiplier: scale,
    labelsVisible,
    maxVisibleLabels: labelsVisible ? 18 : 0,
    labelGridFactor: 2.1
  };
}

function updateRvmTabTreeFromPayload(root, payload) {
  const tree = root?.querySelector?.('#rvm-tree');
  if (!tree) return;
  const nodes = payload?.manifest?.nodes || payload?.manifest?.items || payload?.manifest?.runtime?.nodes || [];
  tree.innerHTML = buildVirtualTree(nodes);
}

function buildVirtualTree(nodes = []) {
  const list = Array.isArray(nodes) ? nodes : [];
  const roots = list.filter((node) => !node?.parentCanonicalObjectId).slice(0, MAX_TREE_ROWS);
  const rows = (roots.length ? roots : list.slice(0, MAX_TREE_ROWS)).map((node) => {
    const id = escapeHtml(node?.canonicalObjectId || node?.sourceObjectId || node?.id || '');
    const kind = escapeHtml(String(node?.kind || node?.type || node?.attributes?.TYPE || 'NODE').toUpperCase());
    const name = escapeHtml(node?.name || node?.canonicalObjectId || node?.sourceObjectId || 'RVM node');
    return `<li data-node-id="${id}" data-depth="0"><button type="button" class="rvm-tree-node"><span class="rvm-kind">${kind}</span><span>${name}</span></button></li>`;
  });
  const suffix = list.length > MAX_TREE_ROWS ? `<li class="rvm-empty-state">Tree capped at ${MAX_TREE_ROWS} rows during progressive RVM load. Use search/properties after render.</li>` : '';
  return rows.join('') + suffix || '<li class="rvm-empty-state">No hierarchy nodes.</li>';
}

function ensureWorkerDiagnosticsPanel(root = document) {
  if (!root?.querySelector) return null;
  const doc = root.ownerDocument || document;
  let panel = root.querySelector('#rvm-browser-parse-diagnostics') || doc.querySelector('#rvm-browser-parse-diagnostics');
  if (panel) return panel;
  const rightPanel = root.querySelector('.rvm-right-panel') || doc.querySelector('.rvm-right-panel');
  if (!rightPanel) return null;

  const header = doc.createElement('div');
  header.className = 'rvm-panel-header';
  header.textContent = 'Browser RVM Performance';
  header.setAttribute('data-rvm-browser-diagnostics-header', 'true');

  panel = doc.createElement('div');
  panel.id = 'rvm-browser-parse-diagnostics';
  panel.className = 'rvm-tag-list rvm-browser-parse-diagnostics';
  panel.setAttribute('aria-live', 'polite');
  panel.setAttribute('data-browser-rvm-diagnostics-panel', 'true');
  panel.innerHTML = '<div class="rvm-empty-state">No browser RVM load yet.</div>';

  rightPanel.append(header, panel);
  return panel;
}

function renderWorkerDiagnostics(diagnostics = {}, root = document) {
  if (!diagnostics || typeof diagnostics !== 'object') return;
  const panel = ensureWorkerDiagnosticsPanel(root);
  if (!panel) return;
  const timings = diagnostics.browserRvmStageTimingsMs || diagnostics.browserRvmWorkerTimingsMs || {};
  panel.innerHTML = `
    <div class="rvm-browser-diag-grid">
      ${diagnosticRow('File', diagnostics.fileName)}
      ${diagnosticRow('State', diagnostics.browserRvmLoadState || (diagnostics.browserRvmLoadFailed ? 'failed' : 'loaded'))}
      ${diagnosticRow('Worker enabled', boolText(diagnostics.browserRvmWorkerEnabled))}
      ${diagnosticRow('Progressive render', boolText(diagnostics.browserRvmProgressiveRenderEnabled))}
      ${diagnosticRow('Parse time', timingText(timings['worker.parse.renderInstructions'] ?? timings.parse))}
      ${diagnosticRow('Instruction time', timingText(timings.renderInstructionGeneration))}
      ${diagnosticRow('Scene creation', timingText(timings['scene.progressiveCreate']))}
      ${diagnosticRow('Objects', diagnostics.browserRvmRenderableCount)}
      ${diagnosticRow('Skipped', diagnostics.browserRvmSkippedCount)}
      ${diagnosticRow('Max event-loop stall', timingText(diagnostics.browserRvmMaxEventLoopStallMs))}
      ${diagnosticRow('Binary PRIM', diagnostics.binaryPrimitiveRecordCount)}
      ${diagnosticRow('Hierarchy groups', diagnostics.hierarchyGroupCount)}
    </div>
    ${diagnostics.error ? `<div class="rvm-browser-diag-warning">${escapeHtml(diagnostics.error)}</div>` : ''}
  `;
}

function diagnosticRow(label, value) {
  return `<div class="rvm-browser-diag-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value === undefined || value === null || value === '' ? '-' : value)}</b></div>`;
}

function boolText(value) {
  return value === undefined || value === null ? '-' : (value ? 'yes' : 'no');
}

function timingText(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)} ms` : '-';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

installBrowserRvmWorkerFirstBridge();
