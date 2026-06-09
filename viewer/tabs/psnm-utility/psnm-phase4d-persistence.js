const PSNM_PERSISTENCE_KEY = 'psnm.workbench.snapshot.v1';
const PSNM_PERSISTENCE_STYLE_ID = 'psnm-phase4d-persistence-style';
let saveTimer = null;

function installStyle() {
  if (document.getElementById(PSNM_PERSISTENCE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PSNM_PERSISTENCE_STYLE_ID;
  style.textContent = `
.psnm-4d-btn{background:#4c1d95!important}.psnm-4d-note{border:1px solid rgba(167,139,250,.35);background:rgba(76,29,149,.20);color:#ddd6fe;border-radius:10px;padding:8px 10px;font-size:12px;margin:0 0 10px}.psnm-4d-note.ok{border-color:rgba(34,197,94,.35);background:rgba(20,83,45,.22);color:#bbf7d0}.psnm-4d-note.warn{border-color:rgba(251,191,36,.35);background:rgba(120,53,15,.22);color:#fde68a}`;
  document.head.appendChild(style);
}

function findModal(target) {
  return target?.closest?.('[data-psnm="modal"]') || document.querySelector('[data-psnm="modal"]');
}

function safeJsonParse(value) {
  try { return JSON.parse(value); } catch { return null; }
}

function getSnapshot() {
  return safeJsonParse(localStorage.getItem(PSNM_PERSISTENCE_KEY) || '');
}

function setSnapshot(snapshot) {
  localStorage.setItem(PSNM_PERSISTENCE_KEY, JSON.stringify(snapshot));
}

function collectSnapshot(modal) {
  const source = {};
  modal.querySelectorAll('[data-source]').forEach((el) => {
    source[el.dataset.source] = el.value ?? '';
  });

  const setup = {};
  modal.querySelectorAll('[data-setup]').forEach((el) => {
    setup[el.dataset.setup] = el.type === 'checkbox' ? el.checked : (el.value ?? '');
  });

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    source,
    setup,
  };
}

function dispatchFieldEvents(el) {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function applySnapshot(modal, snapshot) {
  if (!snapshot || snapshot.version !== 1) return false;
  let count = 0;
  for (const [key, value] of Object.entries(snapshot.source || {})) {
    const el = modal.querySelector(`[data-source="${CSS.escape(key)}"]`);
    if (!el) continue;
    el.value = value ?? '';
    dispatchFieldEvents(el);
    count += 1;
  }
  for (const [key, value] of Object.entries(snapshot.setup || {})) {
    const el = modal.querySelector(`[data-setup="${CSS.escape(key)}"]`);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = value === true;
    else el.value = value ?? '';
    dispatchFieldEvents(el);
    count += 1;
  }
  return count > 0;
}

function showNote(modal, message, cls = 'ok') {
  const body = modal.querySelector('.psnm-body');
  if (!body) return;
  let note = modal.querySelector('[data-psnm-4d-note]');
  if (!note) {
    note = document.createElement('div');
    note.dataset.psnm4dNote = '1';
    body.insertBefore(note, body.firstElementChild?.nextSibling || body.firstChild);
  }
  note.className = `psnm-4d-note ${cls}`;
  note.textContent = message;
}

function saveNow(modal, silent = false) {
  if (!modal) return;
  const snapshot = collectSnapshot(modal);
  setSnapshot(snapshot);
  if (!silent) showNote(modal, `Snapshot saved: ${snapshot.savedAt}`, 'ok');
}

function autoSave(modal) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow(modal, true), 350);
}

function ensureButtons(modal) {
  installStyle();
  const actions = modal.querySelector('.psnm-statusbar .psnm-actions');
  if (!actions || actions.querySelector('[data-psnm-4d-action="save"]')) return;

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'psnm-btn psnm-btn-secondary psnm-4d-btn';
  save.dataset.psnm4dAction = 'save';
  save.textContent = 'Save Snapshot';
  actions.appendChild(save);

  const load = document.createElement('button');
  load.type = 'button';
  load.className = 'psnm-btn psnm-btn-secondary psnm-4d-btn';
  load.dataset.psnm4dAction = 'load';
  load.textContent = 'Load Snapshot';
  actions.appendChild(load);

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'psnm-btn psnm-btn-secondary psnm-4d-btn';
  clear.dataset.psnm4dAction = 'clear';
  clear.textContent = 'Clear Snapshot';
  actions.appendChild(clear);
}

function enhanceModal(modal) {
  ensureButtons(modal);
  const snapshot = getSnapshot();
  if (snapshot && !modal.dataset.psnm4dRestorePrompted) {
    modal.dataset.psnm4dRestorePrompted = '1';
    showNote(modal, `Saved snapshot available from ${snapshot.savedAt}. Use Load Snapshot to restore source/setup values.`, 'warn');
  }
}

document.addEventListener('input', (event) => {
  const modal = findModal(event.target);
  if (!modal) return;
  if (event.target.closest('[data-source], [data-setup]')) autoSave(modal);
}, true);

document.addEventListener('change', (event) => {
  const modal = findModal(event.target);
  if (!modal) return;
  if (event.target.closest('[data-source], [data-setup]')) autoSave(modal);
}, true);

document.addEventListener('click', (event) => {
  const modal = findModal(event.target);
  if (!modal) return;
  const action = event.target.closest('[data-psnm-4d-action]')?.dataset?.psnm4dAction;
  if (!action) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  if (action === 'save') {
    saveNow(modal, false);
    return;
  }
  if (action === 'load') {
    const snapshot = getSnapshot();
    if (!snapshot) {
      showNote(modal, 'No saved PSNM snapshot found.', 'warn');
      return;
    }
    const ok = applySnapshot(modal, snapshot);
    showNote(modal, ok ? `Snapshot loaded: ${snapshot.savedAt}. Rebuild Master Tables before matching.` : 'Snapshot found, but no matching source/setup fields were visible on this tab.', ok ? 'ok' : 'warn');
    return;
  }
  if (action === 'clear') {
    localStorage.removeItem(PSNM_PERSISTENCE_KEY);
    showNote(modal, 'Saved PSNM snapshot cleared.', 'warn');
  }
}, true);

const observer = new MutationObserver(() => {
  document.querySelectorAll('[data-psnm="modal"]').forEach(enhanceModal);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
setTimeout(() => document.querySelectorAll('[data-psnm="modal"]').forEach(enhanceModal), 0);

export function PSNM_phase4dPersistenceInstalled() {
  return true;
}
