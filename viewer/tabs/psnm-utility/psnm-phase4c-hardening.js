import { PSNM_runMasterSmokeTest } from './psnm-master-smoke-test.js';

const STYLE_ID = 'psnm-phase4c-hardening-style';
const STATE_BY_MODAL = new WeakMap();
let scanScheduled = false;

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psnm-4c-gate{border:1px solid rgba(251,191,36,.35);background:rgba(120,53,15,.25);color:#fde68a;border-radius:10px;padding:9px 10px;font-size:12px;line-height:1.45;margin:0 0 10px}.psnm-4c-gate.ok{border-color:rgba(34,197,94,.35);background:rgba(20,83,45,.22);color:#bbf7d0}.psnm-4c-gate.error{border-color:rgba(248,113,113,.35);background:rgba(127,29,29,.25);color:#fecaca}.psnm-4c-blocked{opacity:.5;cursor:not-allowed!important}.psnm-4c-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.psnm-4c-download{background:#065f46!important}.psnm-4c-smoke-ok{color:#86efac;font-weight:800}.psnm-4c-smoke-fail{color:#fca5a5;font-weight:800}.psnm-4c-smoke-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}.psnm-4c-smoke-table th,.psnm-4c-smoke-table td{border-bottom:1px solid rgba(143,197,255,.12);padding:6px 8px;text-align:left}`;
  document.head.appendChild(style);
}

function h(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getState(modal) {
  if (!STATE_BY_MODAL.has(modal)) STATE_BY_MODAL.set(modal, { sourceDirty: false, masterEditDirty: false });
  return STATE_BY_MODAL.get(modal);
}

function findModal(target) {
  return target?.closest?.('[data-psnm="modal"]') || document.querySelector('[data-psnm="modal"]');
}

function masterIsBuilt(modal) {
  const text = modal.textContent || '';
  if (/Master PS No is not built|Master Node is not built|Not Built/i.test(text)) return false;
  return /Master Tables Ready|Complete|Master PS\s*\d+|Master Node\s*\d+|Master PS|Master Node/i.test(text);
}

function runIsBlocked(modal) {
  const state = getState(modal);
  if (state.sourceDirty) return 'Source tables changed. Click Resolve Master Tables before running match.';
  if (state.masterEditDirty) return 'Master tables were edited. Click Apply Master Edits before running match.';
  if (!masterIsBuilt(modal)) return 'Master Tables are not built. Click Resolve Master Tables first.';
  return '';
}

function setHtmlIfChanged(el, html) {
  if (el.dataset.psnmLastHtml === html) return;
  el.dataset.psnmLastHtml = html;
  el.innerHTML = html;
}

function setClassIfChanged(el, className) {
  if (el.className === className) return;
  el.className = className;
}

function ensureGate(modal) {
  const body = modal.querySelector('.psnm-body');
  if (!body) return;
  let gate = modal.querySelector('[data-psnm-4c-gate]');
  if (!gate) {
    gate = document.createElement('div');
    gate.dataset.psnm4cGate = '1';
    body.insertBefore(gate, body.firstElementChild?.nextSibling || body.firstChild);
  }
  const blockReason = runIsBlocked(modal);
  setClassIfChanged(gate, `psnm-4c-gate ${blockReason ? 'error' : 'ok'}`);
  setHtmlIfChanged(gate, blockReason ? `<b>Workflow Gate:</b> ${h(blockReason)}` : '<b>Workflow Gate:</b> Ready. Matching will use Master PS No + Master Node only.');
  modal.querySelectorAll('[data-psnm-action="runMatch"]').forEach((button) => {
    const blocked = Boolean(blockReason);
    button.classList.toggle('psnm-4c-blocked', blocked);
    if (blocked) {
      button.setAttribute('aria-disabled', 'true');
      button.title = blockReason;
    } else {
      button.removeAttribute('aria-disabled');
      button.title = '';
    }
  });
}

function ensureMasterActions(modal) {
  const masterCard = Array.from(modal.querySelectorAll('.psnm-card')).find((card) => /Master Tables/i.test(card.querySelector('.psnm-card-head')?.textContent || ''));
  const head = masterCard?.querySelector('.psnm-card-head .psnm-actions') || masterCard?.querySelector('.psnm-card-head');
  if (!head || head.querySelector('[data-psnm-4c-action="applyEdits"]')) return;
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'psnm-btn psnm-btn-secondary';
  apply.dataset.psnm4cAction = 'applyEdits';
  apply.textContent = 'Apply Master Edits';
  head.appendChild(apply);
}

function ensureDownloadButtons(modal) {
  modal.querySelectorAll('.psnm-card').forEach((card, index) => {
    if (!card.querySelector('table')) return;
    const head = card.querySelector('.psnm-card-head');
    if (!head || head.querySelector('[data-psnm-4c-download]')) return;
    const actions = head.querySelector('.psnm-actions') || head.appendChild(document.createElement('div'));
    actions.classList.add('psnm-4c-actions');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'psnm-btn psnm-btn-secondary psnm-4c-download';
    btn.dataset.psnm4cDownload = String(index);
    btn.textContent = 'Download CSV';
    actions.appendChild(btn);
  });
}

function ensureSmokeButton(modal) {
  const actions = modal.querySelector('.psnm-statusbar .psnm-actions');
  if (!actions || actions.querySelector('[data-psnm-4c-action="smoke"]')) return;
  const smoke = document.createElement('button');
  smoke.type = 'button';
  smoke.className = 'psnm-btn psnm-btn-secondary';
  smoke.dataset.psnm4cAction = 'smoke';
  smoke.textContent = 'Run Smoke Test';
  actions.appendChild(smoke);
}

function tableToCsv(card) {
  return Array.from(card.querySelectorAll('table tr')).map((tr) => Array.from(tr.querySelectorAll('th,td')).map((cell) => {
    const input = cell.querySelector('input,select,textarea');
    const value = input ? (input.type === 'checkbox' ? (input.checked ? 'YES' : 'NO') : input.value) : cell.textContent;
    return `"${String(value ?? '').replace(/"/g, '""').trim()}"`;
  }).join(',')).join('\n');
}

function downloadText(filename, text) {
  const blob = new Blob([String(text || '')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function showSmokeResult(modal, result) {
  const body = modal.querySelector('.psnm-body');
  if (!body) return;
  let panel = modal.querySelector('[data-psnm-4c-smoke-result]');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'psnm-card';
    panel.dataset.psnm4cSmokeResult = '1';
    body.appendChild(panel);
  }
  const html = `<div class="psnm-card-head"><b>Phase 4C Smoke Test</b><span class="${result.ok ? 'psnm-4c-smoke-ok' : 'psnm-4c-smoke-fail'}">${result.ok ? 'PASS' : 'FAIL'}</span></div><div class="psnm-card-body"><div class="psnm-banner">Master PS: ${result.counts.masterPs} | Master Node: ${result.counts.masterNode} | Match Rows: ${result.counts.matchRows}</div><table class="psnm-4c-smoke-table"><thead><tr><th>Check</th><th>Status</th><th>Details</th></tr></thead><tbody>${result.checks.map((item) => `<tr><td>${h(item.name)}</td><td class="${item.pass ? 'psnm-4c-smoke-ok' : 'psnm-4c-smoke-fail'}">${item.pass ? 'PASS' : 'FAIL'}</td><td>${h(item.details)}</td></tr>`).join('')}</tbody></table></div>`;
  setHtmlIfChanged(panel, html);
}

function enhanceModal(modal) {
  if (!modal || modal.dataset.psnm4cEnhancing === '1') return;
  modal.dataset.psnm4cEnhancing = '1';
  installStyle();
  ensureGate(modal);
  ensureMasterActions(modal);
  ensureDownloadButtons(modal);
  ensureSmokeButton(modal);
  modal.dataset.psnm4cEnhancing = '0';
}

function scheduleScan() {
  if (scanScheduled) return;
  scanScheduled = true;
  requestAnimationFrame(() => {
    scanScheduled = false;
    document.querySelectorAll('[data-psnm="modal"]').forEach(enhanceModal);
  });
}

document.addEventListener('input', (event) => {
  const modal = findModal(event.target);
  if (!modal) return;
  if (event.target.closest('[data-source]')) Object.assign(getState(modal), { sourceDirty: true, masterEditDirty: false });
  if (event.target.closest('[data-master-ps-field], [data-master-node-field]')) Object.assign(getState(modal), { masterEditDirty: true });
  scheduleScan();
}, true);

document.addEventListener('change', (event) => {
  const modal = findModal(event.target);
  if (!modal) return;
  if (event.target.closest('[data-source]')) Object.assign(getState(modal), { sourceDirty: true, masterEditDirty: false });
  if (event.target.closest('[data-master-ps-field], [data-master-node-field]')) Object.assign(getState(modal), { masterEditDirty: true });
  scheduleScan();
}, true);

document.addEventListener('click', (event) => {
  const modal = findModal(event.target);
  if (!modal) return;
  const action = event.target.closest('[data-psnm-action]')?.dataset?.psnmAction;
  const hardAction = event.target.closest('[data-psnm-4c-action]')?.dataset?.psnm4cAction;
  if (action === 'runMatch') {
    const reason = runIsBlocked(modal);
    if (reason) {
      event.preventDefault();
      event.stopImmediatePropagation();
      scheduleScan();
      return;
    }
  }
  if (action === 'resolveMasters') {
    Object.assign(getState(modal), { sourceDirty: false, masterEditDirty: false });
    setTimeout(scheduleScan, 80);
    return;
  }
  if (hardAction === 'applyEdits') {
    event.preventDefault();
    event.stopImmediatePropagation();
    Object.assign(getState(modal), { masterEditDirty: false });
    scheduleScan();
    return;
  }
  if (hardAction === 'smoke') {
    event.preventDefault();
    event.stopImmediatePropagation();
    showSmokeResult(modal, PSNM_runMasterSmokeTest());
    return;
  }
  const download = event.target.closest('[data-psnm-4c-download]');
  if (download) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const card = download.closest('.psnm-card');
    const title = (card?.querySelector('.psnm-card-head b')?.textContent || 'psnm-table').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    downloadText(`${title || 'psnm-table'}.csv`, tableToCsv(card));
  }
}, true);

const observer = new MutationObserver(scheduleScan);
observer.observe(document.documentElement, { childList: true, subtree: true });
scheduleScan();

export function PSNM_phase4cHardeningInstalled() {
  return true;
}
