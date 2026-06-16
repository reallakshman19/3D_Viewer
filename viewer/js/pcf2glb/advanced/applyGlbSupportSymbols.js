const GLB_SUPPORT_SYMBOLS_GROUP = '__GLB_SUPPORT_SYMBOLS_RUNTIME_DISABLED__';

function disposeGroup(group) {
  group?.traverse?.((node) => {
    if (!node.isMesh) return;
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach((mat) => mat?.dispose?.());
    else node.material?.dispose?.();
  });
}

function hasRuntimeOverlayDisableFlag(root) {
  if (!root) return false;
  if (root.userData?.plantOnlyMode === true || root.userData?.disableRuntimeSupportOverlay === true) return true;
  let disabled = false;
  root.traverse?.((object) => {
    if (disabled) return;
    const data = object.userData || {};
    if (data.plantOnlyMode === true || data.disableRuntimeSupportOverlay === true) disabled = true;
  });
  return disabled;
}

function removeExistingRuntimeOverlay(root, scene) {
  const existing = scene?.getObjectByName?.(GLB_SUPPORT_SYMBOLS_GROUP)
    || root?.getObjectByName?.(GLB_SUPPORT_SYMBOLS_GROUP)
    || scene?.getObjectByName?.('__GLB_SUPPORT_SYMBOLS_v1__')
    || root?.getObjectByName?.('__GLB_SUPPORT_SYMBOLS_v1__');
  if (existing) {
    existing.parent?.remove?.(existing);
    disposeGroup(existing);
  }
}

/**
 * Runtime support-symbol overlays are intentionally disabled for the BM_CII
 * visual recovery path. Support/restraint geometry must be source-record backed
 * and baked into the GLB, not inferred from arbitrary plant meshes at viewer
 * load time. This prevents UNKNOWN/non-support plant components from receiving
 * orange fallback support markers.
 */
export function applyGlbSupportSymbols(root, scene, options = {}) {
  removeExistingRuntimeOverlay(root, scene);

  if (hasRuntimeOverlayDisableFlag(root) || options.disableRuntimeSupportOverlay !== false) {
    return {
      created: 0,
      scanned: 0,
      hidden: 0,
      skipped: true,
      reason: hasRuntimeOverlayDisableFlag(root)
        ? 'disableRuntimeSupportOverlay/plantOnlyMode'
        : 'runtime support overlay disabled; use baked source-backed support glyphs',
    };
  }

  return {
    created: 0,
    scanned: 0,
    hidden: 0,
    skipped: true,
    reason: 'runtime support overlay disabled; use baked source-backed support glyphs',
  };
}
