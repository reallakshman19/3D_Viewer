import { PSNM_PHASE_SUITE_VERSION } from './psnm-phase-suite.js';

const STYLE_ID = 'psnm-cache-health-style';

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psnm-cache-btn{background:#155e75!important}.psnm-cache-table{width:100%;border-collapse:collapse;font-size:12px}.psnm-cache-table th,.psnm-cache-table td{border-bottom:1px solid rgba(143,197,255,.12);padding:7px 8px;text-align:left}.psnm-cache-ok{color:#86efac;font-weight:800}.psnm-cache-warn{color:#fde68a;font-weight:800}`;
  document.head.appendChild(style);
}

function h(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function findModal(target) {
  return target?.closest?.('[data-psnm="modal"]') || document.querySelector('[data-psnm="modal"]');
}

function ensureButton(modal) {
  installStyle();
  const actions = modal.querySelector('.psnm-statusbar .psnm-actions');
  if (!actions || actions.querySelector('[data-psnm-cache-action="health"]')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'psnm-btn psnm-btn-secondary psnm-cache-btn';
  btn.dataset.psnmCacheAction = 'health';
  btn.textContent = 'Cache Health';
  actions.appendChild(btn);
}

function showHealth(modal) {
  const body = modal.querySelector('.psnm-body');
  if (!body) return;
  let panel = modal.querySelector('[data-psnm-cache-health]');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'psnm-card';
    panel.dataset.psnmCacheHealth = '1';
    body.appendChild(panel);
  }
  const rows = [
    ['Phase suite module', PSNM_PHASE_SUITE_VERSION, 'OK'],
    ['window.PSNM_PHASE_SUITE_VERSION', window.PSNM_PHASE_SUITE_VERSION || '', window.PSNM_PHASE_SUITE_VERSION === PSNM_PHASE_SUITE_VERSION ? 'OK' : 'CHECK'],
    ['Acceptance suite function', typeof window.PSNM_runMasterAcceptanceSuite, typeof window.PSNM_runMasterAcceptanceSuite === 'function' ? 'OK' : 'CHECK'],
    ['Phase manifest function', typeof window.PSNM_getPhaseManifest, typeof window.PSNM_getPhaseManifest === 'function' ? 'OK' : 'CHECK'],
    ['Current page URL', location.href, 'INFO'],
  ];
  panel.innerHTML = `<div class="psnm-card-head"><b>PSNM Cache Health</b><span class="psnm-cache-ok">${h(PSNM_PHASE_SUITE_VERSION)}</span></div><div class="psnm-card-body"><table class="psnm-cache-table"><thead><tr><th>Item</th><th>Value</th><th>Status</th></tr></thead><tbody>${rows.map(([item, value, status]) => `<tr><td>${h(item)}</td><td>${h(value)}</td><td class="${status === 'OK' ? 'psnm-cache-ok' : 'psnm-cache-warn'}">${h(status)}</td></tr>`).join('')}</tbody></table></div>`;
}

document.addEventListener('click', (event) => {
  const modal = findModal(event.target);
  if (!modal) return;
  const action = event.target.closest('[data-psnm-cache-action]')?.dataset?.psnmCacheAction;
  if (action !== 'health') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  showHealth(modal);
}, true);

const observer = new MutationObserver(() => {
  document.querySelectorAll('[data-psnm="modal"]').forEach(ensureButton);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
setTimeout(() => document.querySelectorAll('[data-psnm="modal"]').forEach(ensureButton), 0);

export function PSNM_cacheHealthUiInstalled() {
  return true;
}
