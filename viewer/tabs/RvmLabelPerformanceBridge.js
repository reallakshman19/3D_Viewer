// Runtime bridge for keeping large browser-RVM loads responsive when labels are off.
// The RVM geometry must remain WebGL/Three.js. HTML/CSS labels are optional UI overlays.

const PATCH_FLAG = Symbol.for('pcf-glb-rvm-label-performance-bridge-v1');
const DOM_FLAG = Symbol.for('pcf-glb-rvm-label-performance-dom-v1');
const LARGE_MODEL_RENDERABLE_THRESHOLD = 3000;
const SMALL_MODEL_FRAME_MS = 33;
const LARGE_MODEL_FRAME_MS = 66;
const IDLE_HEARTBEAT_MS = 500;
const LABEL_CONFIRM_THRESHOLD = 28;

export function installRvmLabelPerformanceBridge(RvmViewer3D) {
  const proto = RvmViewer3D?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;

  const originalSetModel = proto.setModel;
  if (typeof originalSetModel === 'function') {
    proto.setModel = function patchedSetModelForLabelDefaultOff(model, upAxis = 'Y') {
      const result = originalSetModel.call(this, model, upAxis);
      this.__rvmRenderDirty = true;
      this.__rvmRenderableEstimate = estimateRenderableCount(this);
      setViewerLabelLayerVisible(this, false);
      return result;
    };
  }

  proto.setRvmLabelLayerVisible = function setRvmLabelLayerVisible(visible) {
    setViewerLabelLayerVisible(this, visible);
    this.__rvmRenderDirty = true;
  };

  proto.getRvmLabelLayerVisible = function getRvmLabelLayerVisible() {
    return this.__rvmLabelLayerVisible === true;
  };

  proto.requestRvmRender = function requestRvmRender() {
    this.__rvmRenderDirty = true;
  };

  proto._animate = function patchedLargeRvmAnimate() {
    if (this._disposed) return;
    this._animationFrameId = requestAnimationFrame(this._animate);

    const controlsChanged = !!this.controls?.update?.();
    const now = nowMs();
    const estimate = resolveRenderableEstimate(this);
    const large = estimate >= LARGE_MODEL_RENDERABLE_THRESHOLD;
    const minFrameMs = large ? LARGE_MODEL_FRAME_MS : SMALL_MODEL_FRAME_MS;
    const last = Number(this.__rvmLastRenderAt || 0);
    const labelLayerVisible = this.__rvmLabelLayerVisible === true;
    const shouldRender =
      this.__rvmRenderDirty !== false ||
      controlsChanged ||
      labelLayerVisible ||
      now - last >= (large ? IDLE_HEARTBEAT_MS : minFrameMs);

    if (!shouldRender || now - last < minFrameMs) return;

    this.renderer?.render?.(this.scene, this.camera);
    if (labelLayerVisible) this.labelRenderer?.render?.(this.scene, this.camera);
    this.__rvmLastRenderAt = now;
    this.__rvmRenderDirty = false;
  };

  proto[PATCH_FLAG] = true;
}

export function installRvmLabelButtonBridge() {
  if (typeof document === 'undefined') return;
  const bindAll = () => {
    document.querySelectorAll?.('[data-rvm-viewer]')?.forEach((root) => bindRoot(root));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindAll, { once: true });
  else bindAll();

  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(bindAll);
    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
  }
}

function bindRoot(root) {
  if (!root || root[DOM_FLAG]) return;
  const button = root.querySelector?.('#rvm-support-labels');
  if (!button) return;
  root[DOM_FLAG] = true;

  setButtonState(button, false);
  setActiveViewerLabelLayer(false);

  button.addEventListener('click', (event) => {
    // Override the older target-phase listener that rebuilt support symbols even
    // when the user only wanted the label overlay on/off.
    event.preventDefault();
    event.stopImmediatePropagation();

    const next = button.getAttribute('aria-pressed') !== 'true';
    const viewer = globalThis.__3D_RVM_VIEWER__;

    if (next) {
      const scopeIds = selectedCanonicalIds(viewer);
      if (!scopeIds.length) {
        setStatus(root, 'Labels are scoped: select a hierarchy/canvas item first, then switch Labels On.', true);
        setButtonState(button, false);
        setActiveViewerLabelLayer(false);
        return;
      }

      const estimated = estimateScopedLabelCount(viewer, scopeIds);
      if (estimated > LABEL_CONFIRM_THRESHOLD) {
        const ok = window.confirm?.(`This selected hierarchy has about ${estimated} label candidate(s). Continue with scoped labels?`);
        if (!ok) {
          setStatus(root, `Labels cancelled. Refine hierarchy selection below ${LABEL_CONFIRM_THRESHOLD} labels.`, true);
          setButtonState(button, false);
          setActiveViewerLabelLayer(false);
          return;
        }
      }

      setButtonState(button, true);
      try {
        viewer?.setSupportSymbolLabelsVisible?.(true);
        if (typeof viewer?.setSupportSymbolOptions === 'function') {
          viewer.setSupportSymbolOptions({ labelsVisible: true, maxVisibleLabels: Math.max(LABEL_CONFIRM_THRESHOLD, estimated || 18) });
        }
        applyScopedSupportLabelVisibility(viewer, scopeIds, true);
        setActiveViewerLabelLayer(true);
        setStatus(root, `Labels On for selected hierarchy scope (${scopeIds.length} selection id${scopeIds.length === 1 ? '' : 's'}).`);
        viewer?.requestRvmRender?.();
      } catch (error) {
        console.warn('[RVM labels] scoped label toggle failed', error);
      }
      return;
    }

    setButtonState(button, false);
    setActiveViewerLabelLayer(false);
    try {
      viewer?.setSupportSymbolLabelsVisible?.(false);
      applyScopedSupportLabelVisibility(viewer, [], false);
      viewer?.requestRvmRender?.();
    } catch (error) {
      console.warn('[RVM labels] label hide failed', error);
    }
  }, true);

  root.addEventListener('rvm-tab-dispose', () => {
    setActiveViewerLabelLayer(false);
  }, { once: true });
}

function setButtonState(button, visible) {
  if (!button) return;
  button.setAttribute('aria-pressed', visible ? 'true' : 'false');
  button.textContent = visible ? 'Labels On' : 'Labels Off';
  button.classList.toggle('is-active', !!visible);
  button.title = visible ? 'Hide scoped RVM labels' : 'Show labels for the selected hierarchy branch';
}

function setStatus(root, message, warning = false) {
  const el = root?.querySelector?.('#rvm-sb-msg');
  if (!el) return;
  el.textContent = message;
  el.style.color = warning ? '#ffcf70' : '';
}

function selectedCanonicalIds(viewer) {
  const fromViewer = viewer?.selection?.getSelectedCanonicalIds?.();
  if (Array.isArray(fromViewer) && fromViewer.length) return fromViewer.filter(Boolean).map(String);
  const fromState = globalThis?.__PCF_GLB_STATE__?.rvm?.selection?.canonicalObjectIds;
  if (Array.isArray(fromState) && fromState.length) return fromState.filter(Boolean).map(String);
  return [];
}

function setActiveViewerLabelLayer(visible) {
  const viewer = globalThis.__3D_RVM_VIEWER__;
  if (viewer?.setRvmLabelLayerVisible) viewer.setRvmLabelLayerVisible(visible);
  else setViewerLabelLayerVisible(viewer, visible);
}

function setViewerLabelLayerVisible(viewer, visible) {
  if (!viewer) return;
  viewer.__rvmLabelLayerVisible = visible === true;
  const el = viewer.labelRenderer?.domElement;
  if (el?.style) {
    el.style.display = visible ? '' : 'none';
    el.style.pointerEvents = 'none';
  }
}

function labelSearchText(labelObject) {
  const parent = labelObject?.parent || {};
  const attrs = parent.userData?.attributes || parent.userData?.rawAttributes || {};
  return [
    labelObject?.name,
    parent.name,
    parent.userData?.canonicalObjectId,
    parent.userData?.sourceObjectId,
    parent.userData?.supportTag,
    attrs.NAME,
    attrs.RVM_OWNER_NAME,
    attrs.RVM_OWNER_PATH,
    attrs.SUPPORT_TAG,
    attrs.CMPSUPREFN,
  ].map((value) => String(value || '')).join(' ');
}

function labelMatchesScope(labelObject, scopeIds = []) {
  if (!scopeIds.length) return false;
  const text = labelSearchText(labelObject);
  return scopeIds.some((id) => id && text.includes(id));
}

function estimateScopedLabelCount(viewer, scopeIds = []) {
  let count = 0;
  viewer?.scene?.traverse?.((obj) => {
    if (!obj?.userData?.supportSymbolLabel) return;
    if (labelMatchesScope(obj, scopeIds)) count += 1;
  });
  return count;
}

function applyScopedSupportLabelVisibility(viewer, scopeIds = [], visible = true) {
  let shown = 0;
  viewer?.scene?.traverse?.((obj) => {
    if (!obj?.userData?.supportSymbolLabel || !obj.element) return;
    const eligible = obj.userData.supportSymbolLabelEligible !== false;
    const scoped = labelMatchesScope(obj, scopeIds);
    obj.element.style.display = visible && eligible && scoped ? 'block' : 'none';
    if (obj.element.style.display !== 'none') shown += 1;
  });
  viewer.__rvmScopedLabelDiagnostics = { shown, scopeIds: [...scopeIds], threshold: LABEL_CONFIRM_THRESHOLD };
  return shown;
}

function resolveRenderableEstimate(viewer) {
  const explicit = Number(viewer?.__rvmRenderableEstimate);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const progressive = viewer?.modelGroup?.children?.[0]?.userData?.browserRvmRender || viewer?._progressiveModelRoot?.userData?.browserRvmRender;
  const fromProgressive = Number(progressive?.renderableCount ?? progressive?.browserRvmRenderableCount);
  if (Number.isFinite(fromProgressive) && fromProgressive > 0) {
    viewer.__rvmRenderableEstimate = fromProgressive;
    return fromProgressive;
  }

  const estimated = estimateRenderableCount(viewer);
  if (estimated > 0) viewer.__rvmRenderableEstimate = estimated;
  return estimated;
}

function estimateRenderableCount(viewer) {
  let count = 0;
  viewer?.modelGroup?.traverse?.((obj) => {
    if (count > 10000) return;
    if (obj?.isMesh || obj?.isLine || obj?.isPoints) count += 1;
  });
  return count;
}

function nowMs() {
  return (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
}
