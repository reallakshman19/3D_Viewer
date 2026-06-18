import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260518-statusbar-theme-12';
import { AvevaJsonLoader } from '../rvm/AvevaJsonLoader.js';
import {
  convertUxmlDocumentToAvevaHierarchy,
  isUxmlDocument,
} from '../rvm/UxmlToAvevaJsonAdapter.js?v=20260618-support-index-attrs-1';
import {
  applyRvmSupportSymbolSettings,
  getRvmSupportSymbolSettings,
} from '../rvm-viewer/RvmSupportSymbols.js?v=20260618-support-css-1';
import '../rvm-viewer/RvmSupportIndexAttributeBridge.js?v=20260618-support-index-attrs-1';

const SUPPORT_DEFAULT_SCALE = 1.0;
const SUPPORT_MAX_LABELS = 16;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeUiSupportScale(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return SUPPORT_DEFAULT_SCALE;
  return Math.max(0.25, Math.min(2.0, n));
}

function initialSupportScale() {
  const saved = Number(getRvmSupportSymbolSettings().scaleMultiplier);
  // Old builds saved 3.00x, which floods the model. Reset only oversized saved values.
  if (!Number.isFinite(saved) || saved > 2.0) return SUPPORT_DEFAULT_SCALE;
  return normalizeUiSupportScale(saved);
}

function makeAsyncSession(statusEl) {
  let stale = false;
  return {
    update(stage, percent) {
      if (statusEl) statusEl.textContent = `${stage} ${Number.isFinite(percent) ? `${percent}%` : ''}`.trim();
    },
    complete() {
      if (statusEl) statusEl.textContent = 'Loaded';
    },
    cancel() { stale = true; },
    isStale() { return stale; },
    isCancelled() { return stale; },
  };
}

function parseJsonSource(text, fileName = '') {
  const doc = JSON.parse(text);
  if (isUxmlDocument(doc)) {
    return convertUxmlDocumentToAvevaHierarchy(doc, { fileName });
  }
  if (isUxmlDocument(doc?.uxml)) {
    return convertUxmlDocumentToAvevaHierarchy(doc.uxml, { fileName });
  }
  if (isUxmlDocument(doc?.document)) {
    return convertUxmlDocumentToAvevaHierarchy(doc.document, { fileName });
  }
  if (Array.isArray(doc)) return doc;
  if (doc?.hierarchy && Array.isArray(doc.hierarchy)) return doc.hierarchy;
  if (doc?.nodes && Array.isArray(doc.nodes)) return doc.nodes;
  return doc;
}

function supportOptions(scaleMultiplier, labelsVisible) {
  return {
    scaleMultiplier: normalizeUiSupportScale(scaleMultiplier),
    labelsVisible: Boolean(labelsVisible),
    maxVisibleLabels: labelsVisible ? SUPPORT_MAX_LABELS : 0,
    labelGridFactor: 2.2,
  };
}

async function loadJsonOrUxmlFile(file, viewer, statusEl, scaleMultiplier, labelsVisible) {
  const text = await file.text();
  const source = parseJsonSource(text, file.name);
  const loader = new AvevaJsonLoader();
  const payload = await loader.load(source, {}, makeAsyncSession(statusEl));
  if (!payload?.gltf?.scene) throw new Error('RVM/AVEVA JSON loader produced no scene.');
  viewer.setModel(payload.gltf.scene, payload.manifest?.runtime?.upAxis || 'Z');
  applyRvmSupportSymbolSettings(viewer, supportOptions(scaleMultiplier, labelsVisible));
  return payload;
}

function renderShell(container) {
  const scale = initialSupportScale();
  container.innerHTML = `
    <style>
      .rvm-viewer-root {
        height: calc(100vh - 48px);
        min-height: 620px;
        display: grid;
        grid-template-rows: auto 1fr;
        background: #07111d;
        color: #dbeafe;
        font: 12px/1.35 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        overflow: hidden;
      }
      .rvm-topbar {
        display: grid;
        grid-template-columns: minmax(230px, auto) 1fr auto;
        gap: 10px;
        align-items: center;
        padding: 8px 10px;
        border-bottom: 1px solid rgba(96, 165, 250, .22);
        background: linear-gradient(180deg, rgba(15, 33, 54, .98), rgba(6, 18, 31, .98));
        box-shadow: 0 6px 18px rgba(0, 0, 0, .28);
        position: relative;
        z-index: 4;
      }
      .rvm-title {
        display: flex;
        align-items: baseline;
        gap: 9px;
        white-space: nowrap;
        min-width: 0;
      }
      .rvm-title strong {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: .02em;
        color: #f8fbff;
      }
      .rvm-title span {
        color: #93a9c7;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      .rvm-controls,
      .rvm-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        min-width: 0;
      }
      .rvm-actions { justify-content: flex-end; }
      .rvm-chip,
      .rvm-tool-btn,
      .rvm-secondary-btn,
      .rvm-file-btn {
        height: 30px;
        border-radius: 9px;
        border: 1px solid rgba(93, 156, 220, .42);
        background: rgba(16, 39, 65, .88);
        color: #eaf4ff;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0 10px;
        font-weight: 750;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
      }
      .rvm-tool-btn.is-active,
      .rvm-secondary-btn.is-on {
        background: linear-gradient(180deg, #2d8ee8, #176ab3);
        border-color: rgba(125, 200, 255, .76);
      }
      .rvm-file-btn input {
        max-width: 185px;
        color: #dbeafe;
        font-size: 11px;
      }
      .rvm-support-scale {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-width: 238px;
      }
      .rvm-support-scale input { width: 112px; accent-color: #38bdf8; }
      .rvm-support-scale output {
        min-width: 44px;
        text-align: right;
        color: #f8fbff;
        font-variant-numeric: tabular-nums;
      }
      .rvm-status {
        min-width: min(720px, 52vw);
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #b9d7ff;
        font-weight: 650;
      }
      .rvm-canvas-shell {
        position: relative;
        min-height: 0;
        overflow: hidden;
        background: #050d18;
      }
      .rvm-canvas {
        position: absolute;
        inset: 0;
      }
      .rvm-side-panel {
        position: absolute;
        left: 12px;
        bottom: 12px;
        z-index: 3;
        min-width: 210px;
        max-width: 360px;
        padding: 10px 12px;
        border: 1px solid rgba(90, 145, 210, .32);
        border-radius: 12px;
        background: rgba(5, 13, 24, .78);
        box-shadow: 0 10px 26px rgba(0,0,0,.34);
      }
      .rvm-side-panel h3 {
        margin: 0 0 4px;
        font-size: 11px;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: #93c5fd;
      }
      .rvm-side-panel pre {
        margin: 0;
        white-space: pre-wrap;
        color: #dbeafe;
        max-height: 160px;
        overflow: auto;
      }
      .rvm-viewer-root.rvm-support-labels-off .rvm-support-symbol-label {
        display: none !important;
      }
      .rvm-support-symbol-label {
        pointer-events: none;
        filter: drop-shadow(0 3px 8px rgba(0,0,0,.45));
      }
      @media (max-width: 1100px) {
        .rvm-topbar { grid-template-columns: 1fr; }
        .rvm-actions { justify-content: flex-start; }
        .rvm-status { min-width: 0; }
      }
    </style>
    <div class="rvm-viewer-root geo-theme-navisdark rvm-support-labels-off" data-rvm-viewer>
      <div class="rvm-topbar">
        <div class="rvm-title"><strong>3D RVM Viewer</strong><span>RVM / JSON / UXML</span></div>
        <div class="rvm-controls" aria-label="RVM viewer controls">
          <button class="rvm-tool-btn is-active" type="button">Orbit</button>
          <button class="rvm-tool-btn" id="rvm-fit-all" type="button">Fit All</button>
          <label class="rvm-file-btn">
            <span>Load</span>
            <input id="rvm-file-input" type="file" accept=".json,.uxml,.uxml.json" />
          </label>
          <label class="rvm-chip rvm-support-scale" title="Support symbol size multiplier">
            <span>Support</span>
            <input id="rvm-support-scale" type="range" min="0.25" max="2" step="0.25" value="${escapeHtml(scale)}" />
            <output id="rvm-support-scale-value">${Number(scale).toFixed(2)}×</output>
          </label>
          <button id="rvm-support-labels" type="button" class="rvm-secondary-btn" aria-pressed="false">Labels Off</button>
        </div>
        <div class="rvm-actions"><div class="rvm-status" id="rvm-status">Ready</div></div>
      </div>
      <div class="rvm-canvas-shell">
        <div id="rvm-canvas" class="rvm-canvas"></div>
        <div class="rvm-side-panel"><h3>Selection</h3><pre id="rvm-selection">No selection</pre></div>
      </div>
    </div>
  `;
}

export function renderViewer3DRvm(container, ctx = {}) {
  renderShell(container);

  const root = container.querySelector('[data-rvm-viewer]');
  const canvas = container.querySelector('#rvm-canvas');
  const statusEl = container.querySelector('#rvm-status');
  const fileInput = container.querySelector('#rvm-file-input');
  const scaleInput = container.querySelector('#rvm-support-scale');
  const scaleValue = container.querySelector('#rvm-support-scale-value');
  const fitBtn = container.querySelector('#rvm-fit-all');
  const labelsBtn = container.querySelector('#rvm-support-labels');

  const viewer = new RvmViewer3D(canvas, ctx);
  let labelsVisible = false;
  statusEl.textContent = 'Ready';

  const currentScale = () => normalizeUiSupportScale(scaleInput.value);
  const currentSupportOptions = () => supportOptions(currentScale(), labelsVisible);

  const refreshLabelButton = () => {
    labelsBtn.textContent = labelsVisible ? `Labels Smart (${SUPPORT_MAX_LABELS})` : 'Labels Off';
    labelsBtn.classList.toggle('is-on', labelsVisible);
    labelsBtn.setAttribute('aria-pressed', String(labelsVisible));
    root.classList.toggle('rvm-support-labels-off', !labelsVisible);
  };

  const updateStatusWithDiagnostics = (fileName = '') => {
    const supportDiag = viewer.supportSymbolDiagnostics || {};
    const prefix = fileName ? `Loaded ${fileName}` : 'Supports updated';
    statusEl.textContent = `${prefix}; supports=${supportDiag.created ?? 0}; labels=${labelsVisible ? `${supportDiag.labelCount ?? 0}/${supportDiag.maxVisibleLabels ?? 0}` : 'off'}; indexAttrs=${viewer.supportIndexAttributeBridgeDiagnostics?.injected ?? 0}`;
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      statusEl.textContent = `Loading ${file.name}`;
      const payload = await loadJsonOrUxmlFile(file, viewer, statusEl, currentScale(), labelsVisible);
      applyRvmSupportSymbolSettings(viewer, currentSupportOptions());
      updateStatusWithDiagnostics(file.name);
      ctx.emit?.('rvm-model-loaded', payload);
    } catch (error) {
      console.error(error);
      statusEl.textContent = `Load failed: ${error?.message || error}`;
    }
  };

  const onScale = () => {
    const value = currentScale();
    scaleValue.textContent = `${value.toFixed(2)}×`;
    applyRvmSupportSymbolSettings(viewer, currentSupportOptions());
    updateStatusWithDiagnostics();
  };

  const onLabels = () => {
    labelsVisible = !labelsVisible;
    refreshLabelButton();
    applyRvmSupportSymbolSettings(viewer, currentSupportOptions());
    updateStatusWithDiagnostics();
  };

  refreshLabelButton();
  fileInput.addEventListener('change', onFile);
  scaleInput.addEventListener('input', onScale);
  labelsBtn?.addEventListener('click', onLabels);
  fitBtn?.addEventListener('click', () => viewer.fitAll?.());

  return () => {
    fileInput.removeEventListener('change', onFile);
    scaleInput.removeEventListener('input', onScale);
    labelsBtn?.removeEventListener('click', onLabels);
    viewer.dispose?.();
    container.innerHTML = '';
  };
}
