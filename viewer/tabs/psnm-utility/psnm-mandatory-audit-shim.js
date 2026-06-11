// psnm-mandatory-audit-shim.js
// Strict mandatory audit visibility for PSNM source rows.
// This shim is intentionally UI/read-only: it does not change matching, ranking, anchors, or exports.

const TRUE_RE = /^(yes|y|true|1|m|mandatory|required|req|must|audit|100%)$/i;
const INSTALLED = new WeakSet();

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function splitLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^-{3,}$/.test(line));
}

function splitCells(line) {
  const raw = String(line || '').trim();
  if (!raw) return [];
  if (raw.includes('\t')) return raw.split('\t').map((cell) => cell.trim());
  if (raw.includes(',')) return raw.split(',').map((cell) => cell.trim());
  return raw.split(/ {2,}/).map((cell) => cell.trim()).filter(Boolean);
}

function norm(value) {
  return String(value ?? '').toLowerCase().replace(/[_.-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function idx(headers, aliases) {
  const set = new Set(aliases.map(norm));
  return headers.findIndex((header) => set.has(norm(header)));
}

function isTrue(value) {
  return TRUE_RE.test(String(value ?? '').trim());
}

function number(value) {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function hasXyz(cells, headers, xIdx, yIdx, zIdx, posIdx) {
  const x = xIdx >= 0 ? number(cells[xIdx]) : NaN;
  const y = yIdx >= 0 ? number(cells[yIdx]) : NaN;
  const z = zIdx >= 0 ? number(cells[zIdx]) : NaN;
  if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) return true;
  const pos = posIdx >= 0 ? String(cells[posIdx] ?? '').trim() : '';
  if (!pos) return false;
  const nums = pos.match(/-?\d+(?:\.\d+)?/g) || [];
  return nums.length >= 3;
}

function parseMandatoryPsAuditRows(table1Text) {
  const lines = splitLines(table1Text);
  if (lines.length < 2) return [];
  const headers = splitCells(lines[0]).map(norm);
  const psIdx = idx(headers, ['ps name', 'psname', 'ps no', 'ps number', 'name', 'mandatory ps name']);
  const posIdx = idx(headers, ['position', 'ps position', 'position raw', 'coordinates', 'coord', 'coordinate']);
  const boreIdx = idx(headers, ['p1bore', 'p1 bore', 'bore', 'nb', 'dn', 'bore mm', 'bore(mm)']);
  const mandatoryIdx = idx(headers, ['mandatory', 'required', 'is mandatory', 'must match', 'req', 'mand', 'm', 'audit']);
  if (mandatoryIdx < 0) return [];

  const rows = [];
  for (const [offset, line] of lines.slice(1).entries()) {
    const sourceRow = offset + 2;
    const cells = splitCells(line);
    if (!isTrue(cells[mandatoryIdx])) continue;
    const psName = psIdx >= 0 ? String(cells[psIdx] ?? '').trim() : '';
    const position = posIdx >= 0 ? String(cells[posIdx] ?? '').trim() : '';
    const p1bore = boreIdx >= 0 ? number(cells[boreIdx]) : NaN;

    if (!psName) {
      rows.push({
        kind: 'ps',
        psName: `Table-1 row ${sourceRow}`,
        mandatorySource: 'TABLE1',
        matchedNode: '',
        occurrenceId: '',
        nodeMandatory: false,
        status: 'AUDIT_REQUIRED_PS_NAME_MISSING',
        level: 'ERROR',
        reason: 'Mandatory PS row has no PS Name.',
        action: 'Add/verify PS Name in Table 1 for this mandatory audit row.',
      });
      continue;
    }
    if (!position) {
      rows.push({
        kind: 'ps',
        psName,
        mandatorySource: 'TABLE1',
        matchedNode: '',
        occurrenceId: '',
        nodeMandatory: false,
        status: 'AUDIT_REQUIRED_PS_POSITION_MISSING',
        level: 'ERROR',
        reason: 'Mandatory PS row has no Position.',
        action: 'Add/verify E/S/U position in Table 1 for this mandatory PS.',
      });
    }
    if (boreIdx >= 0 && !Number.isFinite(p1bore)) {
      rows.push({
        kind: 'ps',
        psName,
        mandatorySource: 'TABLE1',
        matchedNode: '',
        occurrenceId: '',
        nodeMandatory: false,
        status: 'AUDIT_REQUIRED_PS_BORE_MISSING',
        level: 'WARNING',
        reason: 'Mandatory PS row has no p1bore/Bore value.',
        action: 'Add/verify p1bore if bore audit is required for this mandatory PS.',
      });
    }
  }
  return rows;
}

function parseMandatoryNodeAuditRows(table2Text) {
  const lines = splitLines(table2Text);
  if (lines.length < 2) return [];
  const headers = splitCells(lines[0]).map(norm);
  const nodeIdx = idx(headers, ['node', 'node no', 'node number', 'mandatory node', 'mandatory node no']);
  const xIdx = idx(headers, ['x', 'raw x']);
  const yIdx = idx(headers, ['y', 'raw y']);
  const zIdx = idx(headers, ['z', 'raw z']);
  const posIdx = idx(headers, ['position', 'position(x,y,z)', 'position(x,y,z) transformed', 'transformed position']);
  const mandatoryIdx = idx(headers, ['mandatory', 'required', 'is mandatory', 'must match', 'req', 'mand', 'm', 'audit']);
  if (mandatoryIdx < 0) return [];

  const rows = [];
  for (const [offset, line] of lines.slice(1).entries()) {
    const sourceRow = offset + 2;
    const cells = splitCells(line);
    if (!isTrue(cells[mandatoryIdx])) continue;
    const node = nodeIdx >= 0 ? String(cells[nodeIdx] ?? '').trim() : '';
    if (!node) {
      rows.push({
        kind: 'node',
        node: `Table-2 row ${sourceRow}`,
        occurrenceId: '',
        mandatorySource: 'TABLE2',
        inMasterNode: false,
        matchedPs: '',
        status: 'AUDIT_REQUIRED_NODE_NAME_MISSING',
        level: 'ERROR',
        reason: 'Mandatory Node row has no Node number/name.',
        action: 'Add/verify Node value in Table 2 for this mandatory audit row.',
      });
      continue;
    }
    if (!hasXyz(cells, headers, xIdx, yIdx, zIdx, posIdx)) {
      rows.push({
        kind: 'node',
        node,
        occurrenceId: '',
        mandatorySource: 'TABLE2',
        inMasterNode: false,
        matchedPs: '',
        status: 'AUDIT_REQUIRED_NODE_COORDINATE_MISSING',
        level: 'ERROR',
        reason: 'Mandatory Node row has no valid X/Y/Z or Position.',
        action: 'Add/verify Node X/Y/Z coordinates in Table 2 for this mandatory node.',
      });
    }
  }
  return rows;
}

function getSourceValue(container, key) {
  const input = container.querySelector(`[data-source="${key}"]`);
  return input ? input.value : '';
}

function ensureCoverageTable(panel, tableIndex, headers, headingText) {
  const existingTables = panel.querySelectorAll('table.psnm-table');
  if (existingTables[tableIndex]) return existingTables[tableIndex];

  const headings = Array.from(panel.querySelectorAll('h3'));
  const heading = headings.find((h3) => h3.textContent.includes(headingText)) || headings[tableIndex];
  if (!heading) return null;
  const tableWrap = document.createElement('div');
  tableWrap.className = 'psnm-tablewrap';
  tableWrap.innerHTML = `<table class="psnm-table"><thead><tr>${headers.map((header) => `<th>${h(header)}</th>`).join('')}</tr></thead><tbody></tbody></table>`;
  heading.insertAdjacentElement('afterend', tableWrap);
  return tableWrap.querySelector('table.psnm-table');
}

function appendRows(table, rows, cells) {
  if (!table || !rows.length) return;
  const tbody = table.querySelector('tbody') || table.appendChild(document.createElement('tbody'));
  tbody.querySelectorAll('tr[data-psnm-audit-shim="1"]').forEach((row) => row.remove());
  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.dataset.psnmAuditShim = '1';
    tr.innerHTML = cells.map((cell) => `<td>${h(typeof cell === 'function' ? cell(row) : row[cell])}</td>`).join('');
    tbody.appendChild(tr);
  }
}

function appendUserLogRows(container, rows) {
  if (!rows.length) return;
  const panel = container.querySelector('[data-psnm-panel="user"]');
  const table = panel?.querySelector('table.psnm-table');
  if (!table) return;
  const tbody = table.querySelector('tbody') || table.appendChild(document.createElement('tbody'));
  tbody.querySelectorAll('tr[data-psnm-audit-shim="1"]').forEach((row) => row.remove());
  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.dataset.psnmAuditShim = '1';
    tr.innerHTML = [row.level, 'Mandatory Audit', row.kind === 'ps' ? 'Table 1' : 'Table 2', row.kind === 'ps' ? row.psName : row.node, row.reason, row.action]
      .map((value) => `<td>${h(value)}</td>`).join('');
    tbody.appendChild(tr);
  }
}

function patchMandatoryAudit(container) {
  const table1Text = getSourceValue(container, 'table1Text');
  const table2Text = getSourceValue(container, 'table2Text');
  if (!table1Text && !table2Text) return;

  const psRows = parseMandatoryPsAuditRows(table1Text);
  const nodeRows = parseMandatoryNodeAuditRows(table2Text);
  const allRows = [...psRows, ...nodeRows];

  const coveragePanel = container.querySelector('[data-psnm-panel="coverage"]');
  if (coveragePanel) {
    const psTable = ensureCoverageTable(coveragePanel, 0, ['psName', 'mandatorySource', 'matchedNode', 'occurrenceId', 'nodeMandatory', 'status'], 'Mandatory PS Coverage');
    const nodeTable = ensureCoverageTable(coveragePanel, 1, ['node', 'occurrenceId', 'mandatorySource', 'inMasterNode', 'matchedPs', 'status'], 'Mandatory Node Coverage');
    appendRows(psTable, psRows, ['psName', 'mandatorySource', 'matchedNode', 'occurrenceId', (row) => row.nodeMandatory ? 'YES' : 'NO', 'status']);
    appendRows(nodeTable, nodeRows, ['node', 'occurrenceId', 'mandatorySource', (row) => row.inMasterNode ? 'YES' : 'NO', 'matchedPs', 'status']);
  }

  appendUserLogRows(container, allRows);
}

export function installPsnmMandatoryAuditShim(container, ctx = {}) {
  if (!container || INSTALLED.has(container)) return () => {};
  INSTALLED.add(container);

  let timer = null;
  function schedulePatch(delay = 80) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { patchMandatoryAudit(container); }
      catch (error) { try { ctx?.showToast?.(`PSNM mandatory audit shim failed: ${error.message || error}`, 'error'); } catch {} }
    }, delay);
  }

  function onAnyUiEvent(event) {
    if (event.type === 'click') {
      const action = event.target?.closest?.('[data-psnm-action]')?.dataset?.psnmAction;
      const tab = event.target?.closest?.('[data-psnm-tab]')?.dataset?.psnmTab;
      if (action === 'resolveMasters' || action === 'runMatch' || tab === 'coverage' || tab === 'user' || action === 'open') {
        schedulePatch(120);
        setTimeout(() => schedulePatch(0), 650);
        setTimeout(() => schedulePatch(0), 1500);
      }
      return;
    }
    if (event.target?.closest?.('[data-source]')) schedulePatch(120);
  }

  container.addEventListener('click', onAnyUiEvent);
  container.addEventListener('input', onAnyUiEvent);
  container.addEventListener('change', onAnyUiEvent);
  schedulePatch(250);

  return () => {
    clearTimeout(timer);
    container.removeEventListener('click', onAnyUiEvent);
    container.removeEventListener('input', onAnyUiEvent);
    container.removeEventListener('change', onAnyUiEvent);
    INSTALLED.delete(container);
  };
}
