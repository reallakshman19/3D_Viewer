import * as THREE from 'three';
import { buildComponentObject } from './buildComponentObject.js';
import { enhanceTeeBodyProxy } from './enhanceTeeBodyProxy.js';

export function buildExportScene(model, log) {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = 'PCF_EXPORT_ROOT';
  scene.add(root);

  for (const comp of model.components) {
    try {
      let obj = buildComponentObject(comp, log);
      if (obj && comp.type === 'TEE') obj = enhanceTeeBodyProxy(obj, comp);
      if (obj) root.add(obj);
    } catch (err) {
      if (log) {
          log.error('COMPONENT_BUILD_FAILED', {
              id: comp.id,
              type: comp.type,
              message: String(err?.message || err),
          });
      }
    }
  }

  return scene;
}
