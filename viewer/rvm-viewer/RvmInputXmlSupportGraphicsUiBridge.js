import { applyInputXmlSupportGraphicsOverlay } from './RvmInputXmlSupportGraphics.js?v=20260619-inputxml-selectable-pipe-only-1';
import { refreshInputXmlGraphics } from './RvmInputXmlAutoBendGraphics.js?v=20260619-inputxml-selectable-pipe-only-1';

const PANEL_KEY_LEFT = 'rvm.panel.left.width.v2';
const PANEL_KEY_RIGHT = 'rvm.panel.right.width.v2';
const INPUTXML_SCALE_DEFAULT = 3;

function findViewer() {
  return window.__rvmInputXmlSupportGraphicsViewer || null;
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
  return Number.isFinite(n) ? Math.max(0.25, Math.min(4, n)) : INPUTXML_SCALE_DEFAULT;
}

function optionsFromUi() {
  const r = root();
  const scaleEl = r?.querySelector?.('#rvm-support-scale');
  const scale = normalizeScale(scaleEl?.value);
  const labelsVisible = r?.querySelector?.('#rvm-support-labels')?.getAttribute?.('aria-pressed') === 'true';
  const autoBendEnabled = r?.querySelector?.('#rvm-inputxml-auto-bend')?.checked ?? readBool('rvm.inputxml.autoBend', true);
  return {
    scaleMultiplier: scale,
    labelsVisible,
    autoBendEnabled,
  };
}

function refresh() {
  const viewer = findViewer();
  if (!viewer) return;
  setTimeout(() => {
    const options = optionsFromUi();
    refreshInputXmlGraphics(viewer, options);
    applyInputXmlSupportGraphicsOverlay(viewer, options);
  }, 0);
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
  scale.max = '4';
  scale.step = '0.25';
  if (r.dataset.inputXmlScaleDefaultApplied !== 'true') {
    const current = Number(scale.value);
    // Earlier test builds persisted 0.75/1.00 as the default. Normalize those to the requested 3x.
    if (!Number.isFinite(current) || current <= 1.0) scale.value = String(INPUTXML_SCALE_DEFAULT);
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
  const vAxis = currentAxis('rvm.inputxml.verticalAxis', 'Y');
  const nAxis = currentAxis('rvm.inputxml.northAxis', 'X');
  host.innerHTML = `
    <label class="rvm-inputxml-check"><input id="rvm-inputxml-auto-bend" type="checkbox" ${autoBend ? 'checked' : ''}> Auto Bend</label>
    <label class="rvm-inputxml-check"><input id="rvm-canvas-axis-toggle" type="checkbox" ${axisOn ? 'checked' : ''}> Axis</label>
    ${selectHtml('rvm-inputxml-vertical-axis', vAxis, 'Vertical', ['X','Y','Z'])}
    ${selectHtml('rvm-inputxml-north-axis', nAxis, 'North', ['X','Y','Z'])}
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

document.addEventListener('input', (event) => {
  const id = event.target?.id || '';
  if (id === 'rvm-support-scale') refresh();
  if (id === 'rvm-inputxml-auto-bend') { writeBool('rvm.inputxml.autoBend', event.target.checked); refresh(); }
  if (id === 'rvm-canvas-axis-toggle') { writeBool('rvm.canvasAxis.visible', event.target.checked); refresh(); }
  if (id === 'rvm-inputxml-vertical-axis') { try { localStorage.setItem('rvm.inputxml.verticalAxis', event.target.value); } catch {}; refresh(); }
  if (id === 'rvm-inputxml-north-axis') { try { localStorage.setItem('rvm.inputxml.northAxis', event.target.value); } catch {}; refresh(); }
}, true);

document.addEventListener('click', (event) => {
  if (event.target?.closest?.('#rvm-support-labels')) refresh();
}, true);
