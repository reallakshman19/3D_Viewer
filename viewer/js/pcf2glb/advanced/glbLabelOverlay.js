import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const DEFAULT_MAX_LABELS = 250;

function text(value) {
  return String(value ?? '').trim();
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
  if (data.supportKind) return 'support';
  if (data.glbShape?.startsWith?.('valve')) return 'valve';
  if (data.glbShape?.startsWith?.('flange')) return 'flange';
  if (data.glbShape?.startsWith?.('tee')) return 'tee';
  return 'component';
}

function makeLabelElement(label, kind) {
  const div = document.createElement('div');
  div.textContent = label;
  const palette = {
    node: ['#172554', '#bfdbfe', 'rgba(37,99,235,0.94)'],
    support: ['#052e16', '#86efac', 'rgba(34,197,94,0.92)'],
    valve: ['#450a0a', '#fecaca', 'rgba(239,68,68,0.92)'],
    flange: ['#1f2937', '#e5e7eb', 'rgba(107,114,128,0.92)'],
    tee: ['#052e2b', '#99f6e4', 'rgba(20,184,166,0.92)'],
    component: ['#172554', '#bfdbfe', 'rgba(37,99,235,0.92)'],
  }[kind] || ['#172554', '#bfdbfe', 'rgba(37,99,235,0.92)'];
  div.style.cssText = `
    font: 700 10px/1.15 "Inter", "Segoe UI", Arial, sans-serif;
    color: ${palette[1]};
    background: ${palette[2]};
    padding: 3px 6px;
    border: 1px solid ${palette[1]};
    border-radius: 5px;
    pointer-events: none;
    white-space: nowrap;
    box-shadow: 0 2px 7px rgba(0,0,0,0.36);
    letter-spacing: 0.02em;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
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

export function installGlbLabelOverlay(root, labelGroup, options = {}) {
  clearGlbLabels(labelGroup);
  if (!labelGroup) return [];

  const labels = collectGlbLabelAnchors(root, options);
  const offsetY = Number.isFinite(Number(options.offsetY)) ? Number(options.offsetY) : 8;

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

  return labels;
}
