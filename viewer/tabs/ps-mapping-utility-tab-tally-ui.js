import { installPsMappingUtilityTile as installBasePsMappingUtilityTile } from './ps-mapping-utility-tab-candidate-detail-ui.js?v=20260612-psmap-optional-unmatched-config-1';
import {
  DEFAULT_OPTIONS,
  runPsMappingResolver,
} from './ps-mapping-utility/ps-mapping-engine-diagnostics-v2.js?v=20260612-tally-source-ledger-toggle-1';

const STYLE_ID = 'psmap-tally-ui-style';
const TALLY_ROW_ID_TOGGLE_KEY = 'psmap.tally.showRowIds';

const BASE_TALLY_COLUMNS = [
  ['section', 'Section'],
  ['sourceTotal', 'Source'],
  ['matched', 'Matched'],
  ['mandatoryUnmatched', 'Mandatory Unmatched'],
  ['optionalUnmatched', 'Optional Unmatched'],
  ['formula', 'Check Formula'],
  ['check', 'Check'],
  ['action', 'Action'],
];

const ROW_ID_TALLY_COLUMNS = [
  ['matchedRows', 'Matched Rows'],
  ['mandatoryUnmatchedRows', 'Mandatory Unmatched Rows'],
  ['optionalUnmatchedRows', 'Optional Unmatched Rows'],
];

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readShowRowIds() {
  try {
    const raw = localStorage.getItem(TALLY_ROW_ID_TOGGLE_KEY);
    return raw === '1' || raw === 'true';
  } catch {
    return false;
  }
}

function writeShowRowIds(value) {
  try {
    localStorage.setItem(TALLY_ROW_ID_TOGGLE_KEY, value ? '1' : '0');
  } catch {}
}

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.psmap-tally-note{display:grid;gap:6px;font-size:12px;line-height:1.45;color:#cfe4ff;border:1px solid rgba(56,189,248,.24);background:rgba(8,47,73,.22);border-radius:10px;padding:10px}.psmap-tally-note b{color:#bae6fd}.psmap-tally-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap}.psmap-tally-panel .psmap-table td{white-space:normal;min-width:90px}.psmap-tally-panel .psmap-table td:nth-child(8){min-width:220px}.psmap-tally-formula{font-family:ui-monospace,Consolas,monospace;color:#fde68a}.psmap-tally-toggle{display:flex;gap:6px;align-items:center;font-size:12px;color:#cfe4ff;white-space:nowrap}.psmap-tally-toggle input{accent-color:#38bdf8}`;
  document.head.appendChild(style);
}

function display(value) {
  if (Array.isArray(value)) return value.join('|');
  return value ?? '';
}

function splitKeyLabel(key) {
  const matched = key.match(/^matchedRows(\d+)$/);
  if (matched) return `Matched Rows.${matched[1]}`;
  const mandatory = key.match(/^mandatoryUnmatchedRows(\d+)$/);
  if (mandatory) return `Mandatory Unmatched Rows.${mandatory[1]}`;
  const optional = key.match(/^optionalUnmatchedRows(\d+)$/);
  if (optional) return `Optional Unmatched Rows.${optional[1]}`;
  return key;
}

function dynamicTallyColumns(rows = [], { showRowIds = false } = {}) {
  const columns = [...BASE_TALLY_COLUMNS];
  const known = new Set(columns.map(([key]) => key));
  if (!showRowIds) return columns;

  for (const [key, label] of ROW_ID_TALLY_COLUMNS) {
    if (!known.has(key)) {
      columns.push([key, label]);
      known.add(key);
    }
  }

  const extraMatched = new Set();
  const extraMandatory = new Set();
  const extraOptional = new Set();

  for (const row of rows || []) {
    for (const key of Object.keys(row || {})) {
      if (/^matchedRows\d+$/.test(key)) extraMatched.add(key);
      if (/^mandatoryUnmatchedRows\d+$/.test(key)) extraMandatory.add(key);
      if (/^optionalUnmatchedRows\d+$/.test(key)) extraOptional.add(key);
    }
  }

  const numericSort = (a, b) => Number(a.replace(/\D+/g, '')) - Number(b.replace(/\D+/g, ''));
  const insertAfter = (afterKey, extras) => {
    let index = columns.findIndex(([key]) => key === afterKey);
    if (index < 0) index = columns.length - 1;
    for (const key of [...extras].sort(numericSort)) {
      if (known.has(key)) continue;
      index += 1;
      columns.splice(index, 0, [key, splitKeyLabel(key)]);
      known.add(key);
    }
  };

  insertAfter('matchedRows', extraMatched);
  insertAfter('mandatoryUnmatchedRows', extraMandatory);
  insertAfter('optionalUnmatchedRows', extraOptional);
  return columns;
}

function rowsToTsv(rows = [], { showRowIds = readShowRowIds() } = {}) {
  const columns = dynamicTallyColumns(rows, { showRowIds });
  return [columns.map(([, label]) => label), ...rows.map((row) => columns.map(([key]) => display(row?.[key])))]
    .map((line) => line.map((value) => String(value ?? '').replace(/\t/g, ' ')).join('\t'))
    .join('\n');
}

function modal() {
  return document.querySelector('[data-psmap-modal]');
}

function readSource(name) {
  return modal()?.querySelector(`[data-psmap-source="${name}"]`)?.value || '';
}

function readSetup() {
  const setup = { ...DEFAULT_OPTIONS };
  for (const input of modal()?.querySelectorAll('[data-psmap-setup]') || []) {
    const key = input.dataset.psmapSetup;
    if (!key) continue;
    if (input.type === 'checkbox') setup[key] = input.checked === true;
    else if (input.type === 'number') setup[key] = Number(input.value);
    else setup[key] = input.value;
  }
  return setup;
}

function computeTallyRows() {
  const result = runPsMappingResolver({
    table1PsNodeText: readSource('table1Text'),
    table1aNodeDiaText: readSource('table1AText'),
    table1bNodeLineText: readSource('table1BText'),
    table1cNodeIsonoteText: readSource('table1CText'),
    table1dKeywordText: readSource('table1DText'),
    table2ModelText: readSource('table2Text'),
    options: readSetup(),
  });
  return Array.isArray(result?.tallyRows) ? result.tallyRows : [];
}

function tableHtml(rows = [], { showRowIds = readShowRowIds() } = {}) {
  if (!rows.length) return '<div class="psmap-banner">No tally rows yet. Paste source data and run mapping, or open this tab to calculate from current source tables.</div>';
  const columns = dynamicTallyColumns(rows, { showRowIds });
  return `<div class="psmap-tablewrap"><table class="psmap-table"><thead><tr class="psmap-labels">${columns.map(([, label]) => `<th>${h(label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map(([key]) => `<td>${h(display(row?.[key]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function panelHtml(rows = [], { showRowIds = readShowRowIds() } = {}) {
  const checked = showRowIds ? 'checked' : '';
  return `<section class="psmap-panel psmap-tally-panel" data-psmap-panel="tally"><section class="psmap-card"><div class="psmap-card-head"><b>Tally Log</b><div class="psmap-tally-actions"><label class="psmap-tally-toggle"><input type="checkbox" data-psmap-tally-show-rows="1" ${checked}>Show matched / unmatched row IDs</label><button class="psmap-btn secondary" type="button" data-psmap-tally-action="refresh">Refresh Tally</button><button class="psmap-btn secondary" type="button" data-psmap-tally-action="copy">Copy Tally</button></div></div><div class="psmap-card-body"><div class="psmap-tally-note"><b>Source ledger tally:</b><span>For each source side, Matched + Mandatory Unmatched + Optional Unmatched = Source. Row-ID columns are hidden by default; enable the toggle to show compact source IDs. Table-2 uses PS No.; Table-1 uses Node No.</span><span class="psmap-tally-formula">Matched + Mandatory Unmatched + Optional Unmatched = Source</span></div>${tableHtml(rows, { showRowIds })}</div></section></section>`;
}

function ensureTallyShell() {
  const m = modal();
  if (!m) return;
  installStyle();
  const tabs = m.querySelector('.psmap-tabs');
  const body = m.querySelector('.psmap-body');
  if (!tabs || !body) return;
  if (!tabs.querySelector('[data-psmap-tally-tab]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'psmap-tab';
    button.setAttribute('data-psmap-tally-tab', '1');
    button.textContent = 'Tally Log';
    const after = tabs.querySelector('[data-psmap-tab="candidates"]') || tabs.lastElementChild;
    if (after?.nextSibling) tabs.insertBefore(button, after.nextSibling);
    else tabs.appendChild(button);
  }
  if (!body.querySelector('[data-psmap-panel="tally"]')) {
    body.insertAdjacentHTML('beforeend', panelHtml([]));
  }
}

function activateTally() {
  ensureTallyShell();
  const m = modal();
  if (!m) return;
  for (const tab of m.querySelectorAll('.psmap-tab')) tab.classList.remove('active');
  for (const panel of m.querySelectorAll('.psmap-panel')) panel.classList.remove('active');
  const tallyTab = m.querySelector('[data-psmap-tally-tab]');
  const tallyPanel = m.querySelector('[data-psmap-panel="tally"]');
  tallyTab?.classList.add('active');
  tallyPanel?.classList.add('active');
  renderTally();
}

function renderTally() {
  const panel = modal()?.querySelector('[data-psmap-panel="tally"]');
  if (!panel) return;
  const rows = computeTallyRows();
  const showRowIds = readShowRowIds();
  panel.outerHTML = panelHtml(rows, { showRowIds }).replace('psmap-panel psmap-tally-panel', 'psmap-panel psmap-tally-panel active');
}

function scheduleEnsure() {
  requestAnimationFrame(() => requestAnimationFrame(ensureTallyShell));
}

function installTallyTabPatch(ctx = {}) {
  installStyle();
  let lastRows = [];
  const onClick = (event) => {
    if (event.target?.closest?.('[data-psmap-tally-tab]')) {
      event.preventDefault();
      event.stopPropagation();
      activateTally();
      return;
    }
    const tallyAction = event.target?.closest?.('[data-psmap-tally-action]')?.dataset?.psmapTallyAction;
    if (tallyAction === 'refresh') {
      event.preventDefault();
      lastRows = computeTallyRows();
      const panel = modal()?.querySelector('[data-psmap-panel="tally"]');
      if (panel) panel.outerHTML = panelHtml(lastRows, { showRowIds: readShowRowIds() }).replace('psmap-panel psmap-tally-panel', 'psmap-panel psmap-tally-panel active');
      return;
    }
    if (tallyAction === 'copy') {
      event.preventDefault();
      lastRows = computeTallyRows();
      navigator.clipboard?.writeText(rowsToTsv(lastRows, { showRowIds: readShowRowIds() })).then(() => ctx.showToast?.('Tally copied.', 'success')).catch((error) => ctx.showToast?.(`Copy failed: ${error.message || error}`, 'error'));
      return;
    }
    if (event.target?.closest?.('[data-psmap-action], [data-psmap-tab]')) scheduleEnsure();
  };
  const onChange = (event) => {
    const toggle = event.target?.closest?.('[data-psmap-tally-show-rows]');
    if (!toggle) return;
    writeShowRowIds(toggle.checked === true);
    renderTally();
  };
  document.addEventListener('click', onClick, true);
  document.addEventListener('change', onChange, true);
  scheduleEnsure();
  return () => {
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('change', onChange, true);
  };
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  const destroyBase = installBasePsMappingUtilityTile(container, ctx);
  const destroyTally = installTallyTabPatch(ctx);
  return () => {
    try { destroyTally?.(); } catch {}
    try { destroyBase?.(); } catch {}
  };
}
