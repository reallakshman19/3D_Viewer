import './psnm-phase4e-acceptance-ui.js?v=20260609-phase4e-1';

const PSNM_P2_VERSION = '20260609-p2-2';

function PSNM_P2_escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function PSNM_P2_slug(value) {
  return String(value || 'psnm-table')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'psnm-table';
}

function PSNM_P2_downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function PSNM_P2_tableToCsv(card) {
  const rows = Array.from(card.querySelectorAll('table tr'));
  if (!rows.length) {
    const title = card.querySelector('.psnm-card-head b')?.textContent?.trim() || 'PSNM Export';
    return `${PSNM_P2_escapeCsv(title)}\n${PSNM_P2_escapeCsv(card.textContent.trim())}`;
  }
  return rows.map((row) => Array.from(row.children).map((cell) => PSNM_P2_escapeCsv(cell.textContent.trim())).join(',')).join('\n');
}

function PSNM_P2_installStyles() {
  if (document.getElementById('psnm-p2-style')) return;
  const style = document.createElement('style');
  style.id = 'psnm-p2-style';
  style.textContent = `
    .psnm-p2-fullscreen .psnm-modal{width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;border-radius:0!important;}
    .psnm-p2-fullscreen{padding:0!important;}
    .psnm-p2-download{font-size:12px;padding:6px 9px;background:#0f766e!important;}
    .psnm-p2-card-actions{display:flex;gap:6px;align-items:center;}
    .psnm-p2-legend{display:flex;gap:8px;flex-wrap:wrap;align-items:center;border:1px solid rgba(143,197,255,.16);border-radius:12px;background:#0b1220;padding:8px 10px;font-size:12px;color:#b7c9dd;}
    .psnm-p2-legend b{color:#cfe4ff;margin-right:2px;}
    .psnm-p2-dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:4px;vertical-align:-1px;}
    .psnm-p2-dot-green{background:#22c55e;}.psnm-p2-dot-yellow{background:#f59e0b;}.psnm-p2-dot-red{background:#ef4444;}.psnm-p2-dot-blue{background:#3b82f6;}.psnm-p2-dot-purple{background:#a855f7;}
    .psnm-table th:first-child,.psnm-table td:first-child{position:sticky;left:0;z-index:2;background:#101a2b;box-shadow:1px 0 0 rgba(143,197,255,.12);}
    .psnm-table th:first-child{z-index:4;background:#1e293b;}
    .psnm-table th:nth-child(2),.psnm-table td:nth-child(2){position:sticky;left:160px;z-index:2;background:#101a2b;box-shadow:1px 0 0 rgba(143,197,255,.08);}
    .psnm-table th:nth-child(2){z-index:4;background:#1e293b;}
    .psnm-table th:first-child,.psnm-table td:first-child{min-width:160px;max-width:260px;}
    .psnm-table th:nth-child(2),.psnm-table td:nth-child(2){min-width:120px;max-width:220px;}
    .psnm-tab-btn[aria-selected="true"]{outline:2px solid rgba(143,197,255,.45);outline-offset:1px;}
    .psnm-p2-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
  `;
  document.head.appendChild(style);
}

function PSNM_P2_getCardKey(action) {
  if (action === 'copyMatch') return 'match-preview';
  if (action === 'copyCandidates') return 'candidate-resolver';
  if (action === 'copyCoverage') return 'mandatory-coverage';
  if (action === 'copyUser') return 'user-log';
  if (action === 'copyDebug') return 'debug-console';
  return 'psnm-table';
}

function PSNM_P2_enhanceCard(card) {
  const head = card.querySelector('.psnm-card-head');
  if (!head || head.dataset.psnmP2Card === '1') return;
  head.dataset.psnmP2Card = '1';
  const copyButton = head.querySelector('[data-psnm-action^="copy"]');
  if (!copyButton) return;
  const action = copyButton.dataset.psnmAction;
  const title = head.querySelector('b')?.textContent?.trim() || PSNM_P2_getCardKey(action);
  const actions = document.createElement('div');
  actions.className = 'psnm-p2-card-actions';
  copyButton.replaceWith(actions);
  actions.appendChild(copyButton);
  const download = document.createElement('button');
  download.type = 'button';
  download.className = 'psnm-btn psnm-btn-secondary psnm-p2-download';
  download.textContent = 'Download CSV';
  download.dataset.psnmP2Download = PSNM_P2_getCardKey(action);
  download.dataset.psnmP2Title = title;
  actions.appendChild(download);
}

function PSNM_P2_addLegend(modal) {
  const body = modal.querySelector('.psnm-modal-body');
  if (!body || body.querySelector('[data-psnm-p2-legend]')) return;
  const summary = body.querySelector('[data-psnm="summary"]');
  const legend = document.createElement('div');
  legend.className = 'psnm-p2-legend';
  legend.dataset.psnmP2Legend = '1';
  legend.innerHTML = `
    <b>Legend:</b>
    <span><i class="psnm-p2-dot psnm-p2-dot-green"></i>Selected / exact</span>
    <span><i class="psnm-p2-dot psnm-p2-dot-yellow"></i>Approx / warning</span>
    <span><i class="psnm-p2-dot psnm-p2-dot-red"></i>No match / error / ambiguous</span>
    <span><i class="psnm-p2-dot psnm-p2-dot-blue"></i>Mandatory</span>
    <span><i class="psnm-p2-dot psnm-p2-dot-purple"></i>Approx 3 / bore ignored</span>
  `;
  if (summary?.nextSibling) body.insertBefore(legend, summary.nextSibling);
  else body.prepend(legend);
}

function PSNM_P2_addFullscreenButton(modal) {
  const head = modal.querySelector('.psnm-modal-head');
  if (!head || head.querySelector('[data-psnm-p2-fullscreen]')) return;
  const close = head.querySelector('[data-psnm-action="close"]');
  const toolbar = document.createElement('div');
  toolbar.className = 'psnm-p2-toolbar';
  const full = document.createElement('button');
  full.type = 'button';
  full.className = 'psnm-btn psnm-btn-secondary';
  full.dataset.psnmP2Fullscreen = '1';
  full.textContent = 'Full Screen';
  if (close) {
    close.replaceWith(toolbar);
    toolbar.appendChild(full);
    toolbar.appendChild(close);
  } else {
    head.appendChild(full);
  }
}

function PSNM_P2_updateTabAria(modal) {
  const tabs = Array.from(modal.querySelectorAll('[data-psnm-tabbtn]'));
  const panels = Array.from(modal.querySelectorAll('[data-psnm-panel]'));
  const tablist = modal.querySelector('.psnm-tabs');
  tablist?.setAttribute('role', 'tablist');
  tabs.forEach((tab, index) => {
    const id = tab.dataset.psnmTabbtn;
    const active = tab.classList.contains('active');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('id', `psnm-tab-${id}`);
    tab.setAttribute('aria-controls', `psnm-panel-${id}`);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
    tab.setAttribute('tabindex', active ? '0' : '-1');
    tab.dataset.psnmP2TabIndex = String(index);
  });
  panels.forEach((panel) => {
    const id = panel.dataset.psnmPanel;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('id', `psnm-panel-${id}`);
    panel.setAttribute('aria-labelledby', `psnm-tab-${id}`);
    panel.hidden = !panel.classList.contains('active');
  });
}

function PSNM_P2_clickTab(tab) {
  tab?.click?.();
  setTimeout(() => {
    const modal = tab.closest('.psnm-modal');
    if (modal) PSNM_P2_updateTabAria(modal);
    tab.focus?.();
  }, 0);
}

function PSNM_P2_handleKeydown(event) {
  const tab = event.target?.closest?.('[data-psnm-tabbtn]');
  if (!tab) return;
  const modal = tab.closest('.psnm-modal');
  const tabs = Array.from(modal?.querySelectorAll('[data-psnm-tabbtn]') || []);
  const current = tabs.indexOf(tab);
  if (current < 0) return;
  let next = null;
  if (event.key === 'ArrowRight') next = tabs[(current + 1) % tabs.length];
  else if (event.key === 'ArrowLeft') next = tabs[(current - 1 + tabs.length) % tabs.length];
  else if (event.key === 'Home') next = tabs[0];
  else if (event.key === 'End') next = tabs[tabs.length - 1];
  if (next) {
    event.preventDefault();
    PSNM_P2_clickTab(next);
  }
}

function PSNM_P2_handleClick(event) {
  const full = event.target?.closest?.('[data-psnm-p2-fullscreen]');
  if (full) {
    const backdrop = full.closest('.psnm-modal-bg');
    backdrop?.classList.toggle('psnm-p2-fullscreen');
    full.textContent = backdrop?.classList.contains('psnm-p2-fullscreen') ? 'Restore' : 'Full Screen';
    return;
  }
  const download = event.target?.closest?.('[data-psnm-p2-download]');
  if (download) {
    const card = download.closest('.psnm-card');
    const key = download.dataset.psnmP2Download || 'psnm-table';
    const csv = PSNM_P2_tableToCsv(card);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    PSNM_P2_downloadText(`psnm-${PSNM_P2_slug(key)}-${stamp}.csv`, csv);
    return;
  }
  const tab = event.target?.closest?.('[data-psnm-tabbtn]');
  if (tab) setTimeout(() => PSNM_P2_updateTabAria(tab.closest('.psnm-modal')), 0);
}

function PSNM_P2_enhanceModal(modal) {
  if (!modal || modal.dataset.psnmP2Enhancing === '1') return;
  modal.dataset.psnmP2Enhancing = '1';
  PSNM_P2_installStyles();
  PSNM_P2_addFullscreenButton(modal);
  PSNM_P2_addLegend(modal);
  modal.querySelectorAll('.psnm-card').forEach(PSNM_P2_enhanceCard);
  PSNM_P2_updateTabAria(modal);
  modal.dataset.psnmP2Version = PSNM_P2_VERSION;
  modal.dataset.psnmP2Enhancing = '0';
}

function PSNM_P2_scan(root = document) {
  root.querySelectorAll?.('.psnm-modal')?.forEach(PSNM_P2_enhanceModal);
}

let PSNM_P2_OBSERVER = null;

function PSNM_P2_start() {
  if (PSNM_P2_OBSERVER) return;
  PSNM_P2_installStyles();
  PSNM_P2_scan(document);
  document.addEventListener('click', PSNM_P2_handleClick, true);
  document.addEventListener('keydown', PSNM_P2_handleKeydown, true);
  PSNM_P2_OBSERVER = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) PSNM_P2_scan(node);
      }
    }
    PSNM_P2_scan(document);
  });
  PSNM_P2_OBSERVER.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', PSNM_P2_start, { once: true });
} else {
  PSNM_P2_start();
}

export function PSNM_P2_isInstalled() {
  return Boolean(PSNM_P2_OBSERVER);
}
