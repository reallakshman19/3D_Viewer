/**
 * model-converters-tab.js — compatibility shim.
 *
 * All tab orchestration now lives in:
 *   viewer/tabs/model-converters/ModelConvertersTab.js
 *
 * This shim intentionally avoids a static re-export so a deep syntax/runtime
 * failure in an optional Model Converters module cannot abort app-shell tab
 * rendering at import time.
 */

const MODEL_CONVERTERS_SHIM_VERSION = '20260629-model-converters-lazy-render-guard-1';
const CANONICAL_MODULE = './model-converters/index.js?v=20260629-model-converters-lazy-render-guard-1';
const LEGACY_MODULE = './model-converters/legacy-adapter.js?v=20260629-model-converters-lazy-render-guard-1';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[ch]);
}

function renderDiagnostic(container, title, error) {
  if (!container) return;
  const message = String(error?.message || error || 'Unknown error');
  container.innerHTML = `
    <section class="model-converters-tab model-converters-tab--error" data-model-converters-shim="${escapeHtml(MODEL_CONVERTERS_SHIM_VERSION)}">
      <h2>${escapeHtml(title)}</h2>
      <p>The Model Converters tab could not load its full workflow module. The app shell stayed alive and caught the module failure.</p>
      <pre>${escapeHtml(message)}</pre>
    </section>`;
}

function callRenderer(renderer, container, ctx) {
  if (typeof renderer !== 'function') throw new Error('Model Converters renderer export is missing.');
  return renderer(container, ctx);
}

function renderLegacyFallback(container, ctx, cause) {
  return import(LEGACY_MODULE)
    .then((module) => callRenderer(module.renderLegacyModelConvertersTab, container, ctx))
    .catch((fallbackError) => {
      console.error('[ModelConvertersTab] legacy fallback failed after canonical import failure', { cause, fallbackError });
      renderDiagnostic(container, 'Could not load Model Converters', fallbackError || cause);
      return null;
    });
}

export function renderModelConvertersTab(container, ctx) {
  if (container?.dataset) container.dataset.modelConvertersShim = MODEL_CONVERTERS_SHIM_VERSION;
  import(CANONICAL_MODULE)
    .then((module) => callRenderer(module.renderModelConvertersTab, container, ctx))
    .catch((error) => {
      console.error('[ModelConvertersTab] canonical renderer failed; trying legacy fallback', error);
      return renderLegacyFallback(container, ctx, error);
    });
  return null;
}

export const __MODEL_CONVERTERS_TAB_SHIM_VERSION__ = MODEL_CONVERTERS_SHIM_VERSION;
