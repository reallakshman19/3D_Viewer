import { init } from './core/app.js';

function reportStartupError(error) {
  console.error('[main] Failed to initialize viewer application.', error);

  const loadingLabel = document.getElementById('app-loading-label');
  if (loadingLabel) {
    loadingLabel.textContent = 'Failed to load application. Check console for details.';
  }

  const toastHost = document.getElementById('app-toast-container');
  if (toastHost) {
    const item = document.createElement('div');
    item.className = 'toast toast-error';
    item.textContent = `Application startup failed: ${error?.message || error}`;
    toastHost.appendChild(item);
  }
}

function start() {
  init().catch(reportStartupError);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
