const STORAGE_KEY = 'psnm.workbench.lastSourceSetup.v1';
const STYLE_ID = 'psnm-manual-anchor-style';
let applying = false;
let timer = null;

function modal() {
  return document.querySelector('[data-psnm="modal"]');
}

function loadSnapshot() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return parsed?.version === 1 ? parsed : { version: 1 };
  } catch {
    return { version: 1 };
  }
}

function saveSnapshot(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSnapshot(), ...next, version: 1, savedAt: new Date().toISOString() }));
  } catch {}
}

function text(option) {
  return String(option?.textContent || '').replace(/\s+/g, ' ').trim();
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `.psnm-anchor-required{font-size:12px;line-height:1.5;color:#fde68a;border:1px solid rgba(252,211,77,.35);background:#422006;border-radius:10px;padding:10px;margin-bottom:10px}.psnm-anchor-select-required{outline:2px solid rgba(252,211,77,.6)}`;
  document.head.appendChild(style);
}

function selectFor(root, key) {
  return root?.querySelector(`select[data-setup="${key}"]`) || null;
}

function ensureBlankOption(select, label) {
  if (!select) return;
  const first = select.options[0];
  if (first?.value === '') {
    first.textContent = label;
    return;
  }
  const option = document.createElement('option');
  option.value = '';
  option.textContent = label;
  select.insertBefore(option, first || null);
}

function findSavedOption(select, saved = {}) {
  if (!select) return null;
  const options = Array.from(select.options).filter((option) => option.value !== '');
  return options.find((option) => option.value === saved.value)
    || options.find((option) => text(option) === saved.label)
    || null;
}

function setWithoutEvent(select, value) {
  if (!select) return;
  select.value = value;
}

function dispatchChange(select) {
  select?.dispatchEvent(new Event('change', { bubbles: true }));
}

function saveManualSelection(root) {
  if (applying) return;
  const ps = selectFor(root, 'anchorPsRowId');
  const node = selectFor(root, 'anchorNodeRowId');
  const saved = loadSnapshot();
  saveSnapshot({
    manualAnchors: {
      ...(saved.manualAnchors || {}),
      ps: ps?.value ? { value: ps.value, label: text(ps.selectedOptions?.[0]) } : null,
      node: node?.value ? { value: node.value, label: text(node.selectedOptions?.[0]) } : null,
    },
  });
}

function showRequired(root, message = 'Anchor PS and Anchor Node must be selected manually. No default anchor is allowed.') {
  const setup = root?.querySelector('[data-psnm-panel="setup"]');
  if (!setup) return;
  let banner = setup.querySelector('[data-psnm-anchor-required]');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'psnm-anchor-required';
    banner.dataset.psnmAnchorRequired = '1';
    setup.prepend(banner);
  }
  banner.textContent = message;
}

function clearRequired(root) {
  root?.querySelector('[data-psnm-anchor-required]')?.remove();
  root?.querySelectorAll('.psnm-anchor-select-required').forEach((el) => el.classList.remove('psnm-anchor-select-required'));
}

function applyPolicy(root = modal()) {
  if (!root || applying) return;
  installStyle();
  const ps = selectFor(root, 'anchorPsRowId');
  const node = selectFor(root, 'anchorNodeRowId');
  if (!ps || !node) return;
  applying = true;
  ensureBlankOption(ps, 'Select Anchor PS manually');
  ensureBlankOption(node, 'Select Anchor Node manually');

  const saved = loadSnapshot().manualAnchors || {};
  const psSaved = findSavedOption(ps, saved.ps || {});
  const nodeSaved = findSavedOption(node, saved.node || {});

  if (psSaved) {
    if (ps.value !== psSaved.value) {
      ps.value = psSaved.value;
      dispatchChange(ps);
    }
  } else {
    setWithoutEvent(ps, '');
  }

  if (nodeSaved) {
    if (node.value !== nodeSaved.value) {
      node.value = nodeSaved.value;
      dispatchChange(node);
    }
  } else {
    setWithoutEvent(node, '');
  }

  const ready = Boolean(ps.value && node.value);
  ps.classList.toggle('psnm-anchor-select-required', !ps.value);
  node.classList.toggle('psnm-anchor-select-required', !node.value);
  if (ready) clearRequired(root);
  applying = false;
}

function schedulePolicy(delay = 120) {
  clearTimeout(timer);
  timer = setTimeout(() => applyPolicy(modal()), delay);
}

function anchorsSelected(root = modal()) {
  const ps = selectFor(root, 'anchorPsRowId');
  const node = selectFor(root, 'anchorNodeRowId');
  return Boolean(ps?.value && node?.value);
}

document.addEventListener('click', (event) => {
  if (event.target.closest?.('[data-psnm-action="runMatch"]')) {
    const root = modal();
    applyPolicy(root);
    if (!anchorsSelected(root)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const ps = selectFor(root, 'anchorPsRowId');
      const node = selectFor(root, 'anchorNodeRowId');
      ps?.classList.add('psnm-anchor-select-required');
      node?.classList.add('psnm-anchor-select-required');
      showRequired(root, 'Run blocked: select Anchor PS and Anchor Node manually. Defaults are disabled; only a saved local-storage anchor can be restored.');
      return;
    }
  }
  if (event.target.closest?.('[data-psnm-action="open"], [data-psnm-tab="setup"], [data-psnm-action="resolveMasters"]')) {
    schedulePolicy(180);
    setTimeout(() => applyPolicy(modal()), 400);
  }
}, true);

document.addEventListener('change', (event) => {
  const target = event.target?.closest?.('select[data-setup="anchorPsRowId"], select[data-setup="anchorNodeRowId"]');
  if (!target || applying) return;
  const root = target.closest('[data-psnm="modal"]') || modal();
  if (target.value) saveManualSelection(root);
  schedulePolicy(60);
}, true);

installStyle();

export function PSNM_manualAnchorPolicyInstalled() {
  return true;
}
