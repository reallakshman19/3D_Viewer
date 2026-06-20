import * as THREE from 'three';

const PATCH_FLAG = Symbol.for('pcf-glb-rvm-progressive-model-root-patch-v1');

export function installRvmProgressiveModelRootPatch(RvmViewer3D) {
  const proto = RvmViewer3D?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;

  const originalSetModel = proto.setModel;

  proto.setProgressiveModelRoot = function setProgressiveModelRoot(model, upAxis = 'Z', options = {}) {
    const oldChildren = Array.from(this.modelGroup?.children || []);
    this.modelGroup?.clear?.();
    scheduleDisposal(oldChildren);

    this._stpGroup = null;
    this._upAxis = upAxis;
    this._modelDiag = positiveNumber(options.estimatedDiagonal, positiveNumber(this._modelDiag, 5000));
    this._progressiveModelRoot = model || null;
    this._progressiveModelBounds = normalizeBounds(options.bounds || model?.userData?.bounds || model?.userData?.diagnostics?.bounds || null);

    if (this.modelGroup) {
      if (String(upAxis || '').toUpperCase() === 'Z') this.modelGroup.rotation.set(-Math.PI / 2, 0, 0);
      else this.modelGroup.rotation.set(0, 0, 0);
      if (model) this.modelGroup.add(model);
      this.modelGroup.updateMatrix();
      this.modelGroup.matrixWorldNeedsUpdate = true;
    }

    bindModulesWithoutFullTraversal(this);

    if (options.fit === true && this._progressiveModelBounds) {
      this.fitProgressiveBounds(this._progressiveModelBounds);
    }

    return model;
  };

  proto.fitProgressiveBounds = function fitProgressiveBounds(bounds) {
    const box = boxFromBounds(bounds || this._progressiveModelBounds);
    if (!box || box.isEmpty()) return false;
    this._modelDiag = Math.max(box.getSize(new THREE.Vector3()).length(), 1);
    this._fitBox(box);
    return true;
  };

  proto.setModel = function patchedSetModel(model, upAxis = 'Y', options = {}) {
    const progressive = options?.progressive === true
      || model?.userData?.browserRvmWorkerFirstPipeline === true
      || model?.userData?.browserRvmProgressiveRenderEnabled === true
      || model?.userData?.source === 'browser-rvm-worker-progressive-root';

    if (progressive && typeof this.setProgressiveModelRoot === 'function') {
      return this.setProgressiveModelRoot(model, upAxis, options);
    }

    return originalSetModel.call(this, model, upAxis, options);
  };

  proto[PATCH_FLAG] = true;
}

function bindModulesWithoutFullTraversal(viewer) {
  const identityMap = viewer.ctx?.identityMap || null;

  if (viewer.sectioning) {
    viewer.sectioning.modelGroup = viewer.modelGroup;
    if (viewer.sectioning._sectionMode !== 'OFF') {
      viewer.sectioning.disableSection?.();
    }
  }

  if (viewer.visibility) {
    viewer.visibility.modelGroup = viewer.modelGroup;
    viewer.visibility.identityMap = identityMap || viewer.visibility.identityMap;
  }

  if (viewer.selection) {
    viewer.selection.modelGroup = viewer.modelGroup;
    viewer.selection.identityMap = identityMap || viewer.selection.identityMap;
    viewer.selection._selectedCanonicalId = null;
    viewer.selection._selectedCanonicalIds = [];
    viewer.selection._selectedRenderIds = [];
    viewer.selection._originalMaterials?.clear?.();
  }
}

function scheduleDisposal(children = []) {
  if (!children.length) return;
  const queue = [...children];
  const disposeSlice = () => {
    const started = performanceNow();
    while (queue.length && performanceNow() - started < 6) {
      disposeObject(queue.pop());
    }
    if (queue.length) scheduleIdle(disposeSlice);
  };
  scheduleIdle(disposeSlice);
}

function disposeObject(root) {
  if (!root) return;
  root.traverse?.((obj) => {
    if (obj.geometry?.dispose) obj.geometry.dispose();
    const materials = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
    for (const mat of materials) mat?.dispose?.();
  });
}

function scheduleIdle(fn) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 250 });
  else setTimeout(fn, 0);
}

function performanceNow() {
  return (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
}

function positiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeBounds(bounds) {
  if (!bounds || typeof bounds !== 'object') return null;
  const min = bounds.min || bounds.minimum || null;
  const max = bounds.max || bounds.maximum || null;
  if (min && max) {
    const out = {
      min: { x: Number(min.x), y: Number(min.y), z: Number(min.z) },
      max: { x: Number(max.x), y: Number(max.y), z: Number(max.z) }
    };
    return isFiniteBounds(out) ? out : null;
  }
  return isFiniteBounds(bounds) ? bounds : null;
}

function boxFromBounds(bounds) {
  const normalized = normalizeBounds(bounds);
  if (!normalized) return null;
  return new THREE.Box3(
    new THREE.Vector3(normalized.min.x, normalized.min.y, normalized.min.z),
    new THREE.Vector3(normalized.max.x, normalized.max.y, normalized.max.z)
  );
}

function isFiniteBounds(bounds) {
  return ['x', 'y', 'z'].every((axis) => Number.isFinite(bounds?.min?.[axis]) && Number.isFinite(bounds?.max?.[axis]));
}
