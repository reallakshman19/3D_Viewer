const VERSION = 'rvm-primitive-fallback-review/v1';
const PANEL_ID = 'rvm-primitive-fallback-review';
const GLOBAL_KEY = '__PCF_GLB_RVM_PRIMITIVE_FALLBACK_DIAGNOSTICS__';
const NATIVE_RE = /native-cpp|tessellated|capped/i;
const FALLBACK_RE = /BBOX|PLACEHOLDER|BOX_SOLID|FALLBACK|UNKNOWN/i;

export function installRvmPrimitiveFallbackBridge() {
  injectStyle();
  const state = { version: VERSION, runNow: renderReview, getDiagnostics: () => globalThis[GLOBAL_KEY] || null };
  globalThis.__PCF_GLB_RVM_PRIMITIVE_FALLBACK_REVIEW__ = state;
  const schedule = () => renderReview();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true }); else schedule();
  for (const eventName of ['rvm-browser-parse-diagnostics','rvm-native-tessellation-diagnostics','rvm-remaining-primitive-diagnostics','rvm-torus-parity-diagnostics','rvm-snout-parity-diagnostics','rvm-dish-tessellation-diagnostics']) {
    try { globalThis.addEventListener?.(eventName, schedule); } catch (_) {}
  }
  for (const delay of [1200, 3000, 6500]) setTimeout(schedule, delay);
  return state;
}

function renderReview() {
  const root = document.querySelector('[data-rvm-viewer]');
  const basePanel = root?.querySelector?.('#rvm-browser-parse-diagnostics');
  if (!root || !basePanel) return null;
  let panel = root.querySelector(`#${PANEL_ID}`);
  if (!panel) {
    const header = document.createElement('div');
    header.className = 'rvm-panel-header';
    header.textContent = 'Primitive Fallback Review';
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'rvm-tag-list rvm-primitive-fallback-review';
    const after = root.querySelector('#rvm-native-tessellation-diagnostics') || basePanel;
    after.insertAdjacentElement('afterend', panel);
    after.insertAdjacentElement('afterend', header);
  }
  const diagnostics = collectDiagnostics();
  panel.innerHTML = `<div class="rvm-primitive-fallback-card"><button type="button" class="rvm-btn" data-rvm-primitive-fallback-rescan="true">Re-scan</button><div class="rvm-browser-diag-grid">${row('Schema', VERSION)}${row('Scanned', diagnostics.scannedObjectCount)}${row('Native upgraded', diagnostics.nativeUpgradedObjectCount)}${row('Fallback objects', diagnostics.fallbackObjectCount)}${row('Decoded by code', counts(diagnostics.primitiveDecodedKindCounts))}${row('Native by code', counts(diagnostics.primitiveNativeUpgradedKindCounts))}${row('Fallback by code', counts(diagnostics.primitiveFallbackKindCounts))}${row('Fallback reasons', counts(diagnostics.fallbackReasonCounts))}</div></div>`;
  panel.querySelector('[data-rvm-primitive-fallback-rescan]')?.addEventListener('click', renderReview, { once: true });
  return diagnostics;
}

function collectDiagnostics() {
  const out = { schemaVersion: VERSION, capturedAt: new Date().toISOString(), scannedObjectCount: 0, nativeUpgradedObjectCount: 0, fallbackObjectCount: 0, primitiveDecodedKindCounts: {}, primitiveNativeUpgradedKindCounts: {}, primitiveFallbackKindCounts: {}, fallbackReasonCounts: {} };
  const viewer = globalThis.__3D_RVM_VIEWER__;
  viewer?.modelGroup?.traverse?.((object) => {
    if (!object?.isMesh && !object?.isLine && !object?.isPoints) return;
    out.scannedObjectCount += 1;
    const attrs = object.userData?.browserRvmAttributes || object.userData?.attributes || object.userData?.browserRvmProperties?.attributes || {};
    const params = parse(attrs.RVM_NATIVE_PRIMITIVE_PARAMS);
    const code = String(Math.trunc(Number(params?.kind || attrs.RVM_PRIMITIVE_CODE || 0)) || '');
    if (!code) return;
    bump(out.primitiveDecodedKindCounts, code);
    const text = `${object.userData?.effectiveRenderPrimitive || ''} ${object.userData?.renderPrimitive || ''} ${object.userData?.renderQuality || ''} ${attrs.RVM_BROWSER_RENDER_PRIMITIVE || ''}`;
    if (/^RVM_NATIVE_/i.test(text) || NATIVE_RE.test(text) || object.userData?.browserRvmRemainingPrimitiveUpgraded || object.userData?.browserRvmSnoutParityUpgraded || object.userData?.browserRvmDishTessellated || object.userData?.browserRvmTorusParityUpgraded) {
      out.nativeUpgradedObjectCount += 1; bump(out.primitiveNativeUpgradedKindCounts, code); return;
    }
    if (FALLBACK_RE.test(text) || attrs.RVM_RECORD_TAG === 'PRIM') {
      out.fallbackObjectCount += 1; bump(out.primitiveFallbackKindCounts, code); bump(out.fallbackReasonCounts, reason(text, params));
    }
  });
  globalThis[GLOBAL_KEY] = out;
  try { globalThis.dispatchEvent?.(new CustomEvent('rvm-primitive-fallback-diagnostics', { detail: out })); } catch (_) {}
  return out;
}

function reason(text, params) { const upper = String(text).toUpperCase(); if (upper.includes('BBOX')) return 'bbox-placeholder'; if (upper.includes('BOX_SOLID')) return 'box-solid-fallback'; if (!params?.decoded) return 'native-params-not-decoded'; return 'not-native-upgraded'; }
function parse(value) { try { return value ? JSON.parse(String(value)) : null; } catch (_) { return null; } }
function bump(map, key) { map[key || 'UNKNOWN'] = (map[key || 'UNKNOWN'] || 0) + 1; }
function counts(map) { const entries = Object.entries(map || {}).filter(([, value]) => Number(value) > 0); return entries.length ? entries.slice(0, 10).map(([key, value]) => `${key}:${value}`).join(', ') : '-'; }
function row(key, value) { return `<div class="rvm-browser-diag-row"><span>${esc(key)}</span><b>${esc(value ?? '-')}</b></div>`; }
function esc(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function injectStyle() { if (document.getElementById('rvm-primitive-fallback-review-style')) return; const style = document.createElement('style'); style.id = 'rvm-primitive-fallback-review-style'; style.textContent = '.rvm-primitive-fallback-card{display:grid;gap:8px}.rvm-primitive-fallback-card .rvm-btn{width:max-content;padding:4px 8px;font-size:12px}'; document.head.appendChild(style); }
