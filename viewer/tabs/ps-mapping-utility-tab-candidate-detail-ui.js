import { installPsMappingUtilityTile as installBasePsMappingUtilityTile } from './ps-mapping-utility-tab-source-ux-ui.js?v=20260612-psmap-source-ux-gap-dedupe-1';

const STYLE_ID = 'psmap-candidate-detail-toggle-style';
const STORAGE_KEY = 'psmap.showDetailDiagnosticColumns';

const DETAIL_LABELS = new Set([
  'boreBasis',
  'Bore Basis',
  'lineBasis',
  'Line Basis',
  'supportBasis',
  'Support Basis',
  'supportMatch',
  'Support Match',
  'lineRegexBasis',
  'Line Regex Basis',
  'nodeLineRegexBasis',
  'Node Line Regex Basis',
  'nearDistance',
  'Near Distance',
  'Near Line Diff',
  'eligible',
  'Eligible',
  'Passes Basic Checks',
  'autoSelectable',
  'Auto Selectable',
  'Auto-map Allowed',
  'reviewRequired',
  'Review Required',
  'Needs Review',
  'selected',
  'Selected',
  'Chosen Mapping',
  'finalStatus',
  'Final Status',
  'Mapping Status',
  'confidence',
  'Confidence',
  'Confidence Level',
  'confidenceScore',
  'Confidence Score',
  'Confidence /100',
  'score',
  'Score',
  'Internal Rank',
  'warnings',
  'Warnings',
]);

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psmap-candidate-detail-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0 10px;padding:9px 11px;border:1px solid rgba(148,163,184,.25);border-radius:10px;background:rgba(15,23,42,.72);color:#e2e8f0;font-size:12px}.psmap-candidate-detail-toggle label{display:flex;align-items:center;gap:8px;font-weight:800;cursor:pointer}.psmap-candidate-detail-toggle input{accent-color:#38bdf8}.psmap-candidate-detail-help{color:#94a3b8;font-size:11px}.psmap-hide-detail-columns thead tr.psmap-group{display:none}.psmap-detail-hidden{display:none!important}
`;
  document.head.appendChild(style);
}

function readShowDetails() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

function writeShowDetails(value) {
  try { localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); } catch {}
}

function candidatePanel() {
  return document.querySelector('[data-psmap-panel="candidates"]');
}

function candidateTable() {
  return candidatePanel()?.querySelector('table.psmap-table') || null;
}

function detailColumnIndexes(table) {
  const headerRow = table?.querySelector('thead tr.psmap-labels');
  if (!headerRow) return [];
  return [...headerRow.children]
    .map((th, index) => ({ index, label: String(th.textContent || '').trim(), th }))
    .filter(({ label, th }) => th.dataset.psmapGapSentinel !== '1' && DETAIL_LABELS.has(label))
    .map(({ index }) => index);
}

function setColumnHidden(table, indexes, hidden) {
  const hiddenSet = new Set(indexes);
  for (const row of table.querySelectorAll('thead tr.psmap-labels, tbody tr')) {
    [...row.children].forEach((cell, index) => {
      if (hiddenSet.has(index)) cell.classList.toggle('psmap-detail-hidden', hidden);
      else cell.classList.remove('psmap-detail-hidden');
    });
  }
  table.classList.toggle('psmap-hide-detail-columns', hidden);
}

function ensureToggle() {
  const panel = candidatePanel();
  const table = candidateTable();
  if (!panel || !table) return null;

  let toggle = panel.querySelector('[data-psmap-candidate-detail-toggle]');
  if (!toggle) {
    toggle = document.createElement('div');
    toggle.className = 'psmap-candidate-detail-toggle';
    toggle.setAttribute('data-psmap-candidate-detail-toggle', '1');
    toggle.innerHTML = `
      <label>
        <input type="checkbox" data-psmap-candidate-detail-checkbox>
        <span>Show detail diagnostic columns</span>
      </label>
      <span class="psmap-candidate-detail-help">Default off. Shows internal basis, review flags, score and warnings for debugging.</span>
    `;
    table.parentNode?.insertBefore(toggle, table);
  }

  const checkbox = toggle.querySelector('[data-psmap-candidate-detail-checkbox]');
  if (checkbox && checkbox.dataset.bound !== '1') {
    checkbox.dataset.bound = '1';
    checkbox.checked = readShowDetails();
    checkbox.addEventListener('change', () => {
      writeShowDetails(checkbox.checked);
      applyCandidateDetailVisibility();
    });
  }
  if (checkbox) checkbox.checked = readShowDetails();
  return toggle;
}

function applyCandidateDetailVisibility() {
  installStyle();
  ensureToggle();
  const table = candidateTable();
  if (!table) return;
  const show = readShowDetails();
  const indexes = detailColumnIndexes(table);
  setColumnHidden(table, indexes, !show);
}

function installCandidateDetailPatch() {
  installStyle();
  const patch = (() => {
    let queued = false;
    return () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        applyCandidateDetailVisibility();
      });
    };
  })();
  const observer = new MutationObserver(patch);
  observer.observe(document.body, { childList: true, subtree: true });
  patch();
  return () => observer.disconnect();
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  const destroyBase = installBasePsMappingUtilityTile(container, ctx);
  const destroyDetail = installCandidateDetailPatch();
  return () => {
    try { destroyDetail?.(); } catch {}
    try { destroyBase?.(); } catch {}
  };
}
