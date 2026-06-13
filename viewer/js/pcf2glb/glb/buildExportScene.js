import * as THREE from 'three';
import { applyEngineeringPalette } from './applyEngineeringPalette.js';
import { buildComponentObject } from './buildComponentObject.js';
import { buildNodeLabelObject } from './buildNodeLabelObject.js';
import { enhanceLocalizedBendProxy } from './enhanceLocalizedBendProxy.js';
import { enhanceSupportDirectionProxy } from './enhanceSupportDirectionProxyReferenceV2.js';
import { enhanceTeeBodyProxy } from './enhanceTeeBodyProxy.js';
import { hideGlbLabelAnchorMarkers } from './hideGlbLabelAnchorMarkers.js';

function text(value) {
  return String(value ?? '').trim();
}

function collectLineNos(model = {}) {
  return Array.from(new Set([
    text(model.lineNo),
    ...((model.lineNos || []).map(text)),
    ...((model.components || []).map((component) => text(component.lineNo || component.attributes?.lineNo || component.raw?.lineNo))),
  ].filter(Boolean))).sort();
}

export function buildExportScene(model, log, options = {}) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = 'PCF_EXPORT_ROOT';
  scene.add(root);

  for (const comp of model.components) {
    try {
      let obj = comp.type === 'NODE_LABEL'
        ? buildNodeLabelObject(comp)
        : buildComponentObject(comp, log);
      if (obj && comp.type === 'TEE') obj = enhanceTeeBodyProxy(obj, comp);
      if (obj && comp.type === 'SUPPORT') obj = enhanceSupportDirectionProxy(obj, comp, options);
      if (obj) obj = enhanceLocalizedBendProxy(obj, comp);
      if (obj) root.add(obj);
    } catch (err) {
      if (log) {
          log.error('COMPONENT_BUILD_FAILED', {
              id: comp.id,
              type: comp.type,
              message: String((err && err.message) || err),
          });
      }
    }
  }

  const colorMode = options.colorMode || (model.options && model.options.colorMode) || 'engineering';
  const paletteStats = applyEngineeringPalette(root, { colorMode });
  const labelAnchorStats = hideGlbLabelAnchorMarkers(root);
  const lineNos = collectLineNos(model);
  root.userData = {
    ...root.userData,
    lineNo: lineNos[0] || '',
    lineNos,
    engineeringPaletteStats: paletteStats,
    labelAnchorStats,
  };

  return scene;
}
