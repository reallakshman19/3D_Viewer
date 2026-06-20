const STARTUP_SIDE_EFFECT_MODULES = [
  './rvm/AvevaJsonAutoConnectOverride.js?v=20260618-inputxml-auto-connect-1',
  './rvm-viewer/RvmInputXmlSupportGraphicsSetModelBridge.js?v=20260619-source-bend-collapse-1',
  './rvm-viewer/RvmInputXmlSupportGraphicsUiBridge.js?v=20260619-source-bend-collapse-1',
  './tabs/model-converters/xml-cii-finalise-run-button.js?v=20260619-workflow-perf-1',
];

function startupMount() {
  return document.getElementById('app')
    || document.getElementById('app-layout')
    || document.getElementById('app-shell')
    || document.body;
}

function reportStartupError(error) {
  console.error('3D Viewer failed to start', error);
  const label = document.getElementById('app-loading-label');
  if (label) label.textContent = 'Failed to start viewer. Check the browser console for details.';
  const shell = startupMount();
  if (!shell) return;
  shell.innerHTML = '';
  const panel = document.createElement('div');
  panel.style.cssText = 'padding:24px;color:#fca5a5;background:#111827;min-height:100vh;font-family:system-ui,sans-serif;';
  const title = document.createElement('h1');
  title.style.cssText = 'margin-top:0;color:#fecaca;';
  title.textContent = '3D Viewer failed to start';
  const message = document.createElement('p');
  message.textContent = 'The startup module failed before the tab shell could render. Please refresh once; if it remains, check the browser console for the full error.';
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

async function startViewer() {
  await loadStartupSideEffects();
  const { init } = await import('./core/app.js?v=20260620-rvm-scale-safe-1');
  await init();
}

startViewer().catch(reportStartupError);
