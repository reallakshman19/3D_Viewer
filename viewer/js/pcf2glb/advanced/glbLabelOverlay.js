import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const DEFAULT_MAX_LABELS = 250;
const LABEL_TOGGLE_PANEL_ID = 'glb-label-toggle-panel';
const LABEL_VISIBILITY_STORAGE_KEY = 'pcf-glb-label-visibility-v1';

export const DEFAULT_GLB_LABEL_VISIBILITY = Object.freeze({
  node: true,
  support: true,
  valve: true,
  flange: true,
  tee: true,
  terminal: true,
  component: true,
});

const LABEL_TOGGLE_DEFS = Object.freeze([
  ['node', 'Node labels'],
  ['support', 'Support / restraint text'],
  ['valve', 'Valve text'],
  ['flange', 'Flange text'],
  ['tee', 'Tee / branch text'],
  ['terminal', 'Terminal / nozzle text'],
  ['component', 'Other component text'],
]);

function text(value) {
  return String(value ?? '').trim();
}

function safeStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function normalizeVisibility(value = {}) {
  return {
    ...DEFAULT_GLB_LABEL_VISIBILITY,
    ...(value && typeof value === 'object' ? value : {}),
  };
}

export function readGlbLabelVisibility() {
  const storage = safeStorage();
  if (!storage) return { ...DEFAULT_GLB_LABEL_VISIBILITY };

  try {
    return normalizeVisibility(JSON.parse(storage.getItem(LABEL_VISIBILITY_STORAGE_KEY) || '{}'));
  } catch {
    return { ...DEFAULT_GLB_LABEL_VISIBILITY };
  }
}

function writeGlbLabelVisibility(visibility) {
  const storage = safeStorage();
  if (!storage) return;

  try {
    storage.setItem(LABEL_VISIBILITY_STORAGE_KEY, JSON.stringify(normalizeVisibility(visibility)));
  } catch {
    // Best-effort persistence only.
  }
}

function isLabelSuppressed(object) {
  const data = object?.userData || {};
  return data.EXPORT_LABEL === false || data.exportLabel === false || data.hideLabel === true;
}

function isLabelCandidate(object) {
  if (isLabelSuppressed(object)) return false;
  return !!object?.userData?.labelText && (
    object.userData.labelAnchor === true ||
    object.name?.startsWith?.('label:') ||
    object.name?.startsWith?.('node-label:') ||
    object.userData.labelKind === 'node' ||
    object.userData.supportKind ||
    object.userData.glbShape
  );
}

function labelClassFor(object) {
  const data = object?.userData || {};
  if (data.labelKind === 'node' || data.glbShape === 'node-label-anchor') return 'node';
  if (data.labelKind === 'terminal' || data.glbShape?.includes?.('terminal')) return 'terminal';
  if (data.supportKind) return 'support';
  if (data.glbShape?.startsWith?.('valve')) return 'valve';
  if (data.glbShape?.startsWith?.('flange')) return 'flange';
  if (data.glbShape?.startsWith?.('tee')) return 'tee';
  return 'component';
}

export function shouldShowGlbLabelKind(kind, visibility = {}) {
  const normalized = normalizeVisibility(visibility);
  const key = kind && normalized[kind] !== undefined ? kind : 'component';
  return normalized[key] !== false;
}

function makeLabelElement(label, kind) {
  const div = document.createElement('div');
  div.textContent = label;
  const palette = {
    node: ['#172554', '#dbeafe', 'rgba(37,99,235,0.96)'],
    support: ['#052e16', '#bbf7d0', 'rgba(22,163,74,0.94)'],
    valve: ['#052e16', '#bbf7d0', 'rgba(22,163,74,0.94)'],
    flange: ['#052e16', '#dcfce7', 'rgba(21,128,61,0.94)'],
    tee: ['#052e2b', '#ccfbf1', 'rgba(20,184,166,0.94)'],
    terminal: ['#431407', '#fed7aa', 'rgba(249,115,22,0.95)'],
    component: ['#172554', '#bfdbfe', 'rgba(37,99,235,0.92)'],
  }[kind] || ['#172554', '#bfdbfe', 'rgba(37,99,235,0.92)'];
  const fontSize = kind === 'node' ? 12 : 11;
  div.style.cssText = `
    font: 800 ${fontSize}px/1.15 "Inter", "Segoe UI", Arial, sans-serif;
    color: ${palette[1]};
    background: ${palette[2]};
    padding: 3px 7px;
    border: 1px solid ${palette[1]};
    border-radius: 5px;
    pointer-events: none;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0,0,0,0.48);
    letter-spacing: 0.02em;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px rgba(0,0,0,0.65);
    z-index: 20;
  `;
  return div;
}

function clearGlbLabels(labelGroup) {
  if (!labelGroup?.children) return;
  for (let i = labelGroup.children.length - 1; i >= 0; i -= 1) {
    const child = labelGroup.children[i];
    if (child?.userData?.type === 'glb-userdata-label') {
      labelGroup.remove(child);
      child.element?.remove?.();
    }
  }
}

export function collectGlbLabelAnchors(root, options = {}) {
  const maxLabels = Number.isFinite(Number(options.maxLabels))
    ? Math.max(0, Number(options.maxLabels))
    : DEFAULT_MAX_LABELS;
  const labels = [];
  if (!root?.traverse || maxLabels <= 0) return labels;

  root.updateMatrixWorld?.(true);
  const seen = new Set();
  const position = new THREE.Vector3();

  root.traverse((object) => {
    if (labels.length >= maxLabels) return;
    if (!isLabelCandidate(object)) return;

    const label = text(object.userData.labelText);
    if (!label) return;

    object.getWorldPosition(position);
    const key = `${label}|${position.x.toFixed(1)}|${position.y.toFixed(1)}|${position.z.toFixed(1)}`;
    if (seen.has(key)) return;
    seen.add(key);

    labels.push({
      text: label,
      kind: labelClassFor(object),
      position: position.clone(),
      sourceName: object.name || object.userData.pcfId || '',
      sourceId: object.userData.pcfId || '',
    });
  });

  return labels;
}

export function summarizeGlbLabels(labels = []) {
  const summary = {
    total: labels.length,
    node: 0,
    support: 0,
    valve: 0,
    flange: 0,
    tee: 0,
    terminal: 0,
    component: 0,
  };

  for (const label of labels) {
    const kind = label?.kind || 'component';
    summary[kind] = (summary[kind] || 0) + 1;
  }

  return summary;
}

export function applyGlbLabelVisibility(labelGroup, visibility = {}) {
  const normalized = normalizeVisibility(visibility);
  let visible = 0;
  let hidden = 0;

  for (const child of labelGroup?.children || []) {
    if (child?.userData?.type !== 'glb-userdata-label') continue;
    const show = shouldShowGlbLabelKind(child.userData.labelKind, normalized);
    child.visible = show;
    if (child.element) child.element.style.display = show ? '' : 'none';
    if (show) visible += 1;
    else hidden += 1;
  }

  labelGroup.userData = {
    ...(labelGroup.userData || {}),
    glbLabelVisibility: normalized,
    glbLabelVisibleCount: visible,
    glbLabelHiddenCount: hidden,
  };

  return { visible, hidden, visibility: normalized };
}

function panelStyle() {
  return `
    position: fixed;
    right: 86px;
    top: 116px;
    z-index: 900;
    width: 220px;
    max-width: calc(100vw - 120px);
    border-radius: 14px;
    border: 1px solid rgba(147,197,253,0.22);
    background: rgba(15, 28, 45, 0.93);
    color: #e5f2ff;
    box-shadow: 0 14px 38px rgba(0,0,0,0.38);
    padding: 11px 12px;
    font: 12px/1.35 "Inter", "Segoe UI", Arial, sans-serif;
    backdrop-filter: blur(6px);
  `;
}

function ensureGlbLabelTogglePanel(labelGroup, labels, visibility) {
  if (typeof document === 'undefined') return null;
  if (!labels.length) {
    const existing = document.getElementById(LABEL_TOGGLE_PANEL_ID);
    if (existing) existing.style.display = 'none';
    return null;
  }

  let panel = document.getElementById(LABEL_TOGGLE_PANEL_ID);
  if (!panel) {
    panel = document.createElement('div');
    panel.id = LABEL_TOGGLE_PANEL_ID;
    document.body.appendChild(panel);
  }

  const summary = summarizeGlbLabels(labels);
  panel.style.cssText = panelStyle();
  panel.style.display = '';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
      <strong style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#bfdbfe;">Labels</strong>
      <span style="font-size:11px;color:#93c5fd;">${summary.total}</span>
    </div>
    <div style="display:grid;gap:5px;margin-bottom:9px;">
      ${LABEL_TOGGLE_DEFS.map(([key, label]) => `
        <label style="display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none;">
          <input data-glb-label-toggle="${key}" type="checkbox" ${visibility[key] === false ? '' : 'checked'} style="accent-color:#60a5fa;">
          <span>${label}</span>
          <span style="margin-left:auto;color:#94a3b8;font-size:10px;">${summary[key] || 0}</span>
        </label>
      `).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      <button type="button" data-glb-label-action="all" style="border:1px solid rgba(147,197,253,0.28);border-radius:8px;background:#1e3a5f;color:#dbeafe;padding:5px 7px;cursor:pointer;">All</button>
      <button type="button" data-glb-label-action="none" style="border:1px solid rgba(147,197,253,0.28);border-radius:8px;background:#1e293b;color:#dbeafe;padding:5px 7px;cursor:pointer;">None</button>
    </div>
  `;

  const current = normalizeVisibility(visibility);

  const commit = (next) => {
    const normalized = normalizeVisibility(next);
    writeGlbLabelVisibility(normalized);
    applyGlbLabelVisibility(labelGroup, normalized);
    panel.querySelectorAll('[data-glb-label-toggle]').forEach((input) => {
      const key = input.getAttribute('data-glb-label-toggle');
      input.checked = normalized[key] !== false;
    });
  };

  panel.querySelectorAll('[data-glb-label-toggle]').forEach((input) => {
    input.addEventListener('change', () => {
      current[input.getAttribute('data-glb-label-toggle')] = input.checked;
      commit(current);
    });
  });

  panel.querySelector('[data-glb-label-action="all"]')?.addEventListener('click', () => {
    for (const [key] of LABEL_TOGGLE_DEFS) current[key] = true;
    commit(current);
  });

  panel.querySelector('[data-glb-label-action="none"]')?.addEventListener('click', () => {
    for (const [key] of LABEL_TOGGLE_DEFS) current[key] = false;
    commit(current);
  });

  return panel;
}

export function installGlbLabelOverlay(root, labelGroup, options = {}) {
  clearGlbLabels(labelGroup);
  if (!labelGroup) return [];

  const labels = collectGlbLabelAnchors(root, options);
  const offsetY = Number.isFinite(Number(options.offsetY)) ? Number(options.offsetY) : 8;
  const visibility = normalizeVisibility(options.labelVisibility || readGlbLabelVisibility());

  for (const label of labels) {
    const obj = new CSS2DObject(makeLabelElement(label.text, label.kind));
    obj.position.copy(label.position);
    obj.position.y += offsetY;
    obj.userData = {
      type: 'glb-userdata-label',
      labelText: label.text,
      labelKind: label.kind,
      sourceName: label.sourceName,
      sourceId: label.sourceId,
    };
    labelGroup.add(obj);
  }

  const summary = summarizeGlbLabels(labels);
  const visibilityStats = applyGlbLabelVisibility(labelGroup, visibility);
  ensureGlbLabelTogglePanel(labelGroup, labels, visibilityStats.visibility);

  labelGroup.userData = {
    ...(labelGroup.userData || {}),
    glbLabelSummary: summary,
  };
  root.userData = {
    ...(root.userData || {}),
    glbLabelSummary: summary,
    glbLabelVisibility: visibilityStats.visibility,
    glbLabelVisibleCount: visibilityStats.visible,
    glbLabelHiddenCount: visibilityStats.hidden,
  };

  return labels;
}
