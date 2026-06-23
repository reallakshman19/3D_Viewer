import { applyInputXmlSupportGraphicsOverlay } from './RvmInputXmlSupportGraphics.js?v=20260619-source-bend-collapse-1';
import { refreshInputXmlGraphics } from './RvmInputXmlAutoBendGraphics.js?v=20260619-source-bend-collapse-1';
import { readSourceAxisTransformSettings, writeSourceAxisTransformSettings } from '../overlays/source-tools/SourceAxisTransform.js';

const PANEL_KEY_LEFT = 'rvm.panel.left.width.v2';
const PANEL_KEY_RIGHT = 'rvm.panel.right.width.v2';
const INPUTXML_SCALE_DEFAULT = 0.75;
const INPUTXML_SUPPORT_SYMBOLS_KEY = 'rvm.inputxml.supportSymbols';

function findViewer() {
  return window.__rvmInputXmlSupportGraphicsViewer || window.__3D_RVM_VIEWER__ || null;
}

function root() {
  return document.querySelector('[data-rvm-viewer]');
}

function readBool(key, fallback = true) {
  try {
    const v = localStorage.getItem(key);
    if (v === 'on') return true;
    if (v === 'off') return false;
  } catch {}
  return fallback;
}

function writeBool(key, value) {
  try { localStorage.setItem(key, value ? 'on' : 'off'); } catch {}
}

function normalizeScale(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0.25, Math.min(1.5, n)) : INPUTXML_SCALE_DEFAULT;
}

function optionsFromUi() {
  const r = root();
  const scaleEl = r?.querySelector?.('#rvm-support-scale');
  const scale = normalizeScale(scaleEl?.value);
  const labelsVisible = r?.querySelector?.('#rvm-support-labels')?.getAttribute?.('aria-pressed') === 'true';
  const autoBendEnabled = r?.querySelector?.('#rvm-inputxml-auto-bend')?.checked ?? readBool('rvm.inputxml.autoBend', true);
  const supportSymbolsEnabled = r?.querySelector?.('#rvm-inputxml-support-symbols')?.checked ?? readBool(INPUTXML_SUPPORT_SYMBOLS_KEY, false);
  return {
    scaleMultiplier: scale,
    labelsVisible,
    autoBendEnabled,
    supportSymbolsEnabled,
    axisTransform: readSourceAxisTransformSettings(),
  };
}

function refresh() {
  const viewer = findViewer();
  if (!viewer) return;
  setTimeout(() => {
    const options = optionsFromUi();
    refreshInputXmlGraphics(viewer, options);
    applyInputXmlSupportGraphicsOverlay(viewer, options);
    reapplyNonPrimitiveSourceTools(viewer);
    updateStatusChip('Applied');
  }, 0);
}

function reapplyNonPrimitiveSourceTools(viewer) {
  const r = root();
  if (!r || !viewer) return;
  try { window.__PCF_GLB_RVM_NON_PRIMITIVE_SOURCE_TOOLS_UI__?.reapply?.(r, viewer); } catch {}
  try { window.__PCF_GLB_RVM_NON_PRIMITIVE_SUPPORT_OVERLAY__?.applyFromSource?.({
    viewer,
    source: viewer?.modelGroup?.userData?.__rvmNonPrimitiveSourceHierarchy || viewer?.scene?.userData?.__rvmNonPrimitiveSourceHierarchy,
    sourceKind: r.dataset?.rvmLoadedSourceKind || 'json',
  }); } catch {}
}

function selectHtml(id, value, label, options) {
  return `<label class="rvm-inputxml-mini"><span>${label}</span><select id="${id}">${options.map((o) => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
}

function currentAxis(key, fallback) {
  try {
    const v = String(localStorage.getItem(key) || fallback).toUpperCase();
    return ['X', 'Y', 'Z'].includes(v) ? v : fallback;
  } catch { return fallback; }
}

function ensureSupportScaleDefaults(r) {
  const scale = r?.querySelector?.('#rvm-support-scale');
  const value = r?.querySelector?.('#rvm-support-scale-value');
  if (!scale) return;
  scale.max = '1.5';
  scale.step = '0.25';
  if (r.dataset.inputXmlScaleDefaultApplied !== 'true') {
    const current = Number(scale.value);
    if (!Number.isFinite(current) || current <= 0 || current > 1.5) scale.value = String(INPUTXML_SCALE_DEFAULT);
    r.dataset.inputXmlScaleDefaultApplied = 'true';
  }
  const normalized = normalizeScale(scale.value);
  scale.value = String(normalized);
  if (value) value.textContent = `${normalized.toFixed(2)}×`;
}

function removeStaleModeChip(r) {
  const chip = r?.querySelector?.('#rvm-mode-chip');
  if (chip) chip.remove();
}

function updateStatusChip(text) {
  const chip = root()?.querySelector?.('[data-rvm-inputxml-transform-status]');
  if (chip) chip.textContent = text || 'Ready';
}

function injectControls() {
  const r = root();
  if (!r) return;
  ensureSupportScaleDefaults(r);
  removeStaleModeChip(r);
  if (r.querySelector('#rvm-inputxml-graphics-controls')) return;
  const ribbon = r.querySelector('.geo-top-ribbon');
  if (!ribbon) return;
  const host = document.createElement('div');
  host.id = 'rvm-inputxml-graphics-controls';
  host.className = 'rvm-ribbon-section rvm-inputxml-controls';
  const autoBend = readBool('rvm.inputxml.autoBend', true);
  const axisOn = readBool('rvm.canvasAxis.visible', true);
  const supportSymbols = readBool(INPUTXML_SUPPORT_SYMBOLS_KEY, false);
  const axisTransform = readSourceAxisTransformSettings();
  const vAxis = currentAxis('rvm.inputxml.verticalAxis', axisTransform.verticalAxis || 'Y');
  const nAxis = currentAxis('rvm.inputxml.northAxis', axisTransform.northAxis || 'X');
  host.innerHTML = `
    <label class="rvm-inputxml-check" title="Rebuild generated bends where stagedJSON/InputXML has no bend primitive"><input id="rvm-inputxml-auto-bend" type="checkbox" ${autoBend ? 'checked' : ''}> Auto Bend</label>
    <label class="rvm-inputxml-check" title="Show source support symbols"><input id="rvm-inputxml-support-symbols" type="checkbox" ${supportSymbols ? 'checked' : ''}> Support symbols</label>
    <label class="rvm-inputxml-check" title="Show or hide axis triad"><input id="rvm-canvas-axis-toggle" type="checkbox" ${axisOn ? 'checked' : ''}> Axis</label>
    ${selectHtml('rvm-inputxml-vertical-axis', vAxis, 'Vertical', ['X','Y','Z'])}
    ${selectHtml('rvm-inputxml-north-axis', nAxis, 'North', ['X','Y','Z'])}
    <button type="button" id="rvm-inputxml-apply-transform" title="Apply axis transform to generated bends, support overlay and support resolvers">Apply</button>
    <span class="rvm-inputxml-status" data-rvm-inputxml-transform-status>Ready</span>
  `;
  const supportSection = r.querySelector('#rvm-support-scale')?.closest?.('.rvm-ribbon-section');
  ribbon.insertBefore(host, supportSection || ribbon.firstChild);
}

function persistPanelWidths() {
  const r = root();
  if (!r) return;
  const left = r.querySelector('.rvm-left-panel');
  const right = r.querySelector('.rvm-right-panel');
  try {
    const lw = localStorage.getItem(PANEL_KEY_LEFT);
    const rw = localStorage.getItem(PANEL_KEY_RIGHT);
    if (lw) left?.style?.setProperty('--rvm-left-w', lw);
    if (rw) right?.style?.setProperty('--rvm-right-w', rw);
  } catch {}
}

function ensureResizeHandles() {
  const r = root();
  if (!r || r.dataset.resizeHandlesReady === 'true') return;
  const left = r.querySelector('.rvm-left-panel');
  const right = r.querySelector('.rvm-right-panel');
  if (!left || !right) return;
  r.dataset.resizeHandlesReady = 'true';
  persistPanelWidths();
  const mk = (panel, side, key) => {
    const h = document.createElement('div');
    h.className = `rvm-panel-resizer rvm-panel-resizer-${side}`;
    panel.appendChild(h);
    let down = false;
    const move = (event) => {
      if (!down) return;
      const rect = r.getBoundingClientRect();
      let w = side === 'left' ? event.clientX - rect.left : rect.right - event.clientX;
      w = Math.max(180, Math.min(520, Math.round(w)));
      const value = `${w}px`;
      panel.style.setProperty(side === 'left' ? '--rvm-left-w' : '--rvm-right-w', value);
      try { localStorage.setItem(key, value); } catch {}
      window.dispatchEvent(new Event('resize'));
    };
    const up = () => { down = false; document.body.style.cursor = ''; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    h.addEventListener('mousedown', (event) => {
      down = true;
      document.body.style.cursor = 'col-resize';
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      event.preventDefault();
    });
  };
  mk(left, 'left', PANEL_KEY_LEFT);
  mk(right, 'right', PANEL_KEY_RIGHT);
}

function tickUi() {
  injectControls();
  ensureResizeHandles();
}

setInterval(tickUi, 650);
setTimeout(tickUi, 0);
setTimeout(tickUi, 150);

function handleControlEvent(event) {
  const id = event.target?.id || '';
  if (id === 'rvm-support-scale') refresh();
  if (id === 'rvm-inputxml-auto-bend') { writeBool('rvm.inputxml.autoBend', event.target.checked); refresh(); }
  if (id === 'rvm-inputxml-support-symbols') { writeBool(INPUTXML_SUPPORT_SYMBOLS_KEY, event.target.checked); refresh(); }
  if (id === 'rvm-canvas-axis-toggle') { writeBool('rvm.canvasAxis.visible', event.target.checked); refresh(); }
  if (id === 'rvm-inputxml-vertical-axis') { writeSourceAxisTransformSettings({ verticalAxis: event.target.value }); refresh(); }
  if (id === 'rvm-inputxml-north-axis') { writeSourceAxisTransformSettings({ northAxis: event.target.value }); refresh(); }
}

document.addEventListener('input', handleControlEvent, true);
document.addEventListener('change', handleControlEvent, true);

document.addEventListener('click', (event) => {
  if (event.target?.closest?.('#rvm-support-labels')) refresh();
  if (event.target?.closest?.('#rvm-inputxml-apply-transform')) {
    event.preventDefault();
    refresh();
  }
}, true);
