import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260518-statusbar-theme-12';
import { AvevaJsonLoader } from '../rvm/AvevaJsonLoader.js';
import {
  convertUxmlDocumentToAvevaHierarchy,
  isUxmlDocument,
} from '../rvm/UxmlToAvevaJsonAdapter.js?v=20260618-support-index-attrs-1';
import {
  applyRvmSupportSymbolSettings,
  getRvmSupportSymbolSettings,
} from '../rvm-viewer/RvmSupportSymbols.js?v=20260618-support-polish-1';
import '../rvm-viewer/RvmSupportIndexAttributeBridge.js?v=20260618-support-index-attrs-1';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

async function loadJsonOrUxmlFile(file, viewer, statusEl) {
  const text = await file.text();
  const source = parseJsonSource(text, file.name);
  const loader = new AvevaJsonLoader();
  const payload = await loader.load(source, {}, makeAsyncSession(statusEl));
  if (!payload?.gltf?.scene) throw new Error('RVM/AVEVA JSON loader produced no scene.');
  viewer.setModel(payload.gltf.scene, payload.manifest?.runtime?.upAxis || 'Z');
  applyRvmSupportSymbolSettings(viewer, viewer.supportSymbolOptions || {});
  return payload;
}

function renderShell(container) {
  const scale = getRvmSupportSymbolSettings().scaleMultiplier;
  container.innerHTML = `
    <div class="rvm-viewer-root geo-theme-navisdark" data-rvm-viewer>
      <div class="rvm-ribbon" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <div class="rvm-ribbon-title" style="display:flex;align-items:center;gap:8px;min-width:260px;white-space:nowrap;">
          <strong>3D RVM Viewer</strong>
          <span style="opacity:.78;font-size:12px;">RVM / JSON / UXML</span>
        </div>
        <div class="rvm-ribbon-section rvm-tool-group"><span class="rvm-ribbon-label">Navigate</span><div class="rvm-ribbon-button-row"><button class="rvm-tool-btn is-active" type="button">Orbit</button><button class="rvm-tool-btn" id="rvm-fit-all" type="button">Fit All</button></div></div>
      </div>
      <div class="rvm-toolbar" aria-label="RVM inputs" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <label class="rvm-file-btn">
          <span>Load JSON/UXML</span>
          <input id="rvm-file-input" type="file" accept=".json,.uxml,.uxml.json" />
        </label>
        <label class="support-scale-control" title="Support symbol size multiplier" style="display:flex;align-items:center;gap:6px;">
          <span>Support scale</span>
          <input id="rvm-support-scale" type="range" min="0.25" max="4" step="0.25" value="${escapeHtml(scale)}" />
          <output id="rvm-support-scale-value">${Number(scale).toFixed(2)}×</output>
        </label>
        <button id="rvm-support-labels" type="button" class="rvm-secondary-btn" aria-pressed="false">Labels: Smart</button>
        <div class="rvm-toolbar-status" id="rvm-status">Ready</div>
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

  const refreshLabelButton = () => {
    labelsBtn.textContent = labelsVisible ? 'Labels: Smart On' : 'Labels: Smart';
    labelsBtn.setAttribute('aria-pressed', String(labelsVisible));
  };

  const updateStatusWithDiagnostics = (fileName = '') => {
    const supportDiag = viewer.supportSymbolDiagnostics || {};
    const prefix = fileName ? `Loaded ${fileName}` : 'Supports updated';
    statusEl.textContent = `${prefix}; supports=${supportDiag.created ?? 0}; labels=${supportDiag.labelCount ?? 0}/${supportDiag.maxVisibleLabels ?? 0}; indexAttrs=${viewer.supportIndexAttributeBridgeDiagnostics?.injected ?? 0}`;
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      statusEl.textContent = `Loading ${file.name}`;
      const payload = await loadJsonOrUxmlFile(file, viewer, statusEl);
      applyRvmSupportSymbolSettings(viewer, { labelsVisible });
      updateStatusWithDiagnostics(file.name);
      ctx.emit?.('rvm-model-loaded', payload);
    } catch (error) {
      console.error(error);
      statusEl.textContent = `Load failed: ${error?.message || error}`;
    }
  };

  const onScale = () => {
    const value = Number(scaleInput.value);
    scaleValue.textContent = `${value.toFixed(2)}×`;
    applyRvmSupportSymbolSettings(viewer, { scaleMultiplier: value, labelsVisible });
    updateStatusWithDiagnostics();
  };

  const onLabels = () => {
    labelsVisible = !labelsVisible;
    refreshLabelButton();
    applyRvmSupportSymbolSettings(viewer, { labelsVisible });
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
