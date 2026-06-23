const STARTUP_SIDE_EFFECT_MODULES = [
  './rvm/AvevaJsonAutoConnectOverride.js?v=20260618-inputxml-auto-connect-1',
  './rvm-viewer/RvmInputXmlSupportGraphicsSetModelBridge.js?v=20260619-source-bend-collapse-1',
  './rvm-viewer/RvmInputXmlSupportGraphicsUiBridge.js?v=20260619-source-bend-collapse-1',
  './tabs/model-converters/xml-cii-finalise-run-button.js?v=20260619-workflow-perf-1',
];
// Previous cache marker: core/app.js?v=20260622-geometry-import-tree-1
// Previous cache marker: core/app.js?v=20260622-geometry-enriched-stagedjson-1
// Previous cache marker: core/app.js?v=20260622-geometry-support-load-inputs-1
// Previous cache marker: core/app.js?v=20260622-pipe-support-load-input-hydrator-1
// Previous cache marker: core/app.js?v=20260622-input-review-lock-1
// Previous cache marker: core/app.js?v=20260622-input-review-override-lock-1
// Active cache key: core/app.js?v=20260623-support-load-master-data-1
function startupMount() { return document.getElementById('app') || document.getElementById('app-layout') || document.getElementById('app-shell') || document.body; }
function reportStartupError(error) { console.error('3D Viewer startup error', error); const label = document.getElementById('app-loading-label'); if (label) label.textContent = 'Viewer startup error. Check the browser console.'; const shell = startupMount(); if (!shell) return; shell.innerHTML = '<div style="padding:24px;color:#fca5a5;background:#111827;min-height:100vh;font-family:system-ui,sans-serif;"><h1 style="margin-top:0;color:#fecaca;">3D Viewer startup error</h1><p>Refresh once. If the problem remains, check the browser console.</p></div>'; }
async function loadStartupSideEffects() { const results = await Promise.allSettled(STARTUP_SIDE_EFFECT_MODULES.map((specifier) => import(specifier))); const failures = results.map((result, index) => ({ result, specifier: STARTUP_SIDE_EFFECT_MODULES[index] })).filter(({ result }) => result.status === 'rejected'); for (const { result, specifier } of failures) console.warn(`[3D Viewer] optional startup module failed: ${specifier}`, result.reason); return failures; }
function scheduleDeferredStartupSideEffects() { const run = () => loadStartupSideEffects().catch((error) => { console.warn('[3D Viewer] deferred startup side effects failed', error); }); if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 1600 }); else if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(() => setTimeout(run, 0)); else setTimeout(run, 0); }
async function startViewer() { const { init } = await import('./core/app.js?v=20260623-support-load-master-data-1'); await init(startupMount()); scheduleDeferredStartupSideEffects(); }
startViewer().catch(reportStartupError);