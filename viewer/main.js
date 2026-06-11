import { init } from './core/app.js';

function reportStartupError(error) {
  console.error('3D Viewer failed to start', error);

  const label = document.getElementById('app-loading-label');
  if (label) {
    label.textContent = 'Failed to start viewer. Check the browser console for details.';
  }

  const overlay = document.getElementById('app-loading-overlay');
  if (overlay) {
    overlay.classList.add('is-error');
  }
}

async function start() {
  try {
    await init({
      nav: document.getElementById('tab-bar'),
      main: document.getElementById('tab-content'),
    });
  } catch (error) {
    reportStartupError(error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
