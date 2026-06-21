const STARTUP_SIDE_EFFECT_MODULES = [
  './rvm/AvevaJsonAutoConnectOverride.js?v=20260618-inputxml-auto-connect-1',
  './rvm-viewer/RvmInputXmlSupportGraphicsSetModelBridge.js?v=20260619-source-bend-collapse-1',
  './rvm-viewer/RvmInputXmlSupportGraphicsUiBridge.js?v=20260619-source-bend-collapse-1',
  './tabs/model-converters/xml-cii-finalise-run-button.js?v=20260619-workflow-perf-1',
];
// Legacy static-contract marker: core/app.js?v=20260620-rvm-stagedjson-validation-1
// Previous cache marker: core/app.js?v=20260621-rvm-perf-lazy-bridges-1
// Previous cache marker: core/app.js?v=20260621-rvm-button-hardening-1
// Previous cache marker: core/app.js?v=20260621-rvm-ui-interaction-panels-1
// Active cache key: core/app.js?v=20260621-rvm-property-collapse-1

function startupMount() {
  return document.getElementById('app') || document.getElementById('app-layout') || document.getElementById('app-shell') || document.body;
}

function reportStartupError(error) {
  console.error('3D Viewer startup error', error);
  const label = document.getElementById('app-loading-label');
  if (label) label.textContent = 'Viewer startup error. Check the browser console.';
  const shell = startupMount();
  if (!shell) return;
  shell.innerHTML = '';
  const panel = document.createElement('div');
  panel.style.cssText = 'padding:24px;color:#fca5a5;background:#111827;min-height:100vh;font-family:system-ui,sans-serif;';
  const title = document.createElement('h1');
  title.style.cssText = 'margin-top:0;color:#fecaca;';
  title.textContent = '3D Viewer startup error';
  const message = document.createElement('p');
  message.textContent = 'Refresh once. If the problem remains, check the browser console.';
  panel.append(title, message);
  shell.appendChild(panel);
}

async function loadStartupSideEffects() {
  const results = await Promise.allSettled(STARTUP_SIDE_EFFECT_MODULES.map((specifier) => import(specifier)));
  const failures = results
    .map((result, index) => ({ result, specifier: STARTUP_SIDE_EFFECT_MODULES[index] }))
    .filter(({ result }) => result.status === 'rejected');
  for (const { result, specifier } of failures) {
    console.warn(`[3D Viewer] optional startup module failed: ${specifier}`, result.reason);
  }
  return failures;
}

function scheduleDeferredStartupSideEffects() {
  const run = () => loadStartupSideEffects().catch((error) => {
    console.warn('[3D Viewer] deferred startup side effects failed', error);
  });
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 1600 });
  } else if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => setTimeout(run, 0));
  } else {
    setTimeout(run, 0);
  }
}

async function startViewer() {
  const { init } = await import('./core/app.js?v=20260621-rvm-property-collapse-1');
  await init();
  scheduleDeferredStartupSideEffects();
}

startViewer().catch(reportStartupError);
