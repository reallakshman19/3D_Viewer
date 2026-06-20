import * as THREE from 'three';

const BRIDGE_VERSION = '20260620-rvm-scale-leak-1';
const SUPPORT_WORDS_RE = /\b(SUPPORT|SUPP|GUIDE|ANCHOR|LINE\s*STOP|LINESTOP|REST|SHOE|HANGER|SPRING|CLAMP|TRUNNION|SADDLE|DUMMY|U[-_ ]?BOLT)\b/i;

export function installRvmSupportSummaryBridge() {
  let attempts = 0;
  const attach = () => {
    attempts += 1;
    const root = document.querySelector('[data-rvm-viewer]');
    const viewer = globalThis.__3D_RVM_VIEWER__;
    if (root && viewer) bind(root, viewer);
    if ((!root || !viewer) && attempts < 180) setTimeout(attach, 350);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true });
  else attach();
}

function bind(root, viewer) {
  if (!root || root.dataset.rvmSupportSummaryBridge === BRIDGE_VERSION) return;
  root.dataset.rvmSupportSummaryBridge = BRIDGE_VERSION;
  let last = '';
  const tick = () => {
    const supports = collectSupportObjects(viewer);
    const key = supports.map((item) => `${item.uuid}:${item.visible}`).sort().join('|');
    if (key !== last) {
      last = key;
      renderSupportSummary(root, supports);
    }
  };
  const timer = setInterval(tick, 1000);
  root._rvmSupportSummaryCleanup = () => clearInterval(timer);
  setTimeout(tick, 100);
  setTimeout(tick, 1500);
  setTimeout(tick, 3500);
}

function collectSupportObjects(viewer) {
  const out = [];
  viewer?.modelGroup?.traverse?.((obj) => {
    if (!obj?.isMesh || obj.visible === false) return;
    if (isSupportObject(obj)) out.push(obj);
  });
  return out;
}

function isSupportObject(obj) {
  const data = obj?.userData || {};
  const props = data.browserRvmProperties || {};
  const attrs = data.browserRvmAttributes || data.attributes || props.attributes || {};
  const text = [
    data.type,
    data.kind,
    data.renderPrimitive,
    data.effectiveRenderPrimitive,
    data.sourcePath,
    data.displayName,
    props.displayName,
    props.sourcePath,
    attrs.RVM_BROWSER_SUPPORT_HINT,
    attrs.RVM_BROWSER_SUPPORT_KIND,
    attrs.TYPE,
    attrs.NAME,
    attrs.RVM_OWNER_NAME,
    attrs.RVM_OWNER_PATH,
    attrs.RVM_PRIMITIVE_KIND,
  ].map((value) => String(value || '')).join(' ');
  if (data.type === 'SUPPORT' || attrs.RVM_BROWSER_SUPPORT_HINT === 'true' || SUPPORT_WORDS_RE.test(text)) return true;
  return isSupportLikeByGeometry(obj, attrs);
}

function isSupportLikeByGeometry(obj, attrs = {}) {
  const primitive = String(attrs.RVM_BROWSER_RENDER_PRIMITIVE || obj.userData?.renderPrimitive || obj.userData?.effectiveRenderPrimitive || '').toUpperCase();
  const type = String(attrs.TYPE || obj.userData?.type || '').toUpperCase();
  if (!/BOX|SUPPORT|STRUCTURE|RVM_PRIM_CODE_2/.test(`${primitive} ${type}`)) return false;
  let size = null;
  try {
    obj.updateMatrixWorld?.(true);
    if (!obj.geometry?.boundingBox) obj.geometry?.computeBoundingBox?.();
    const localBox = obj.geometry?.boundingBox?.clone?.() || null;
    const worldBox = localBox ? localBox.applyMatrix4(obj.matrixWorld) : new THREE.Box3().setFromObject(obj);
    if (worldBox && !worldBox.isEmpty()) size = worldBox.getSize(new THREE.Vector3());
  } catch (_) {}
  if (!size || ![size.x, size.y, size.z].every(Number.isFinite)) return false;
  const dims = [Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)].sort((a, b) => a - b);
  const [a, b, c] = dims;
  if (c <= 0 || b <= 0) return false;
  const slender = c >= Math.max(a, b) * 3;
  const smallSection = a <= 0.35 && b <= 0.75;
  const plausibleLength = c >= 0.35 && c <= 8;
  return slender && smallSection && plausibleLength;
}

function renderSupportSummary(root, supports) {
  const chip = root.querySelector('[data-rvm-status-chip="supports"]');
  if (chip) chip.textContent = `Supports: ${supports.length}`;
  const panel = root.querySelector('#rvm-support-summary');
  if (!panel) return;
  if (!supports.length) {
    panel.innerHTML = '<div class="rvm-empty-state">No supports detected in rendered RVM objects.</div>';
    return;
  }
  const rows = supports.slice(0, 24).map((obj) => {
    const data = obj.userData || {};
    const attrs = data.browserRvmAttributes || data.browserRvmProperties?.attributes || {};
    const label = data.displayName || data.browserRvmProperties?.displayName || attrs.NAME || obj.name || 'Support';
    const kind = attrs.RVM_BROWSER_SUPPORT_KIND || data.kind || attrs.RVM_PRIMITIVE_KIND || (isSupportLikeByGeometry(obj, attrs) ? 'GEOM-SUPPORT' : 'SUPPORT');
    return `<button type="button" class="rvm-support-summary-row" data-rvm-support-object="${escapeHtml(obj.uuid)}"><span>${escapeHtml(kind)}</span><b>${escapeHtml(label)}</b></button>`;
  }).join('');
  const suffix = supports.length > 24 ? `<div class="rvm-empty-state">Showing 24 of ${supports.length} support-like objects.</div>` : '';
  panel.innerHTML = `<div class="rvm-support-summary-list">${rows}</div>${suffix}`;
  panel.querySelectorAll('[data-rvm-support-object]').forEach((button) => {
    button.addEventListener('click', () => {
      const uuid = button.dataset.rvmSupportObject;
      const obj = supports.find((item) => item.uuid === uuid);
      const api = globalThis.__PCF_GLB_RVM_INTERACTION__;
      if (obj && api?.setSelectionFromObjects) {
        api.setSelectionFromObjects([obj], { sourceObject: obj });
        api.fitSelection?.();
      }
    });
  });
}

function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
