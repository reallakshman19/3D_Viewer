import { installPsMappingUtilityTile as installBasePsMappingUtilityTile } from './ps-mapping-utility-tab.js?v=20260611-psmap-support-audit-dominance-1';

const supportOptionState = {
  useBuiltInSupportKeywordLogic: true,
  treatAnchorAsLineStop: true,
};

function schedulePatch(patch) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      patch();
    });
  };
}

function patchSupportConfigControls() {
  const panel = document.querySelector('[data-psmap-panel="config"]');
  if (!panel) return;
  if (panel.querySelector('[data-psmap-support-config]')) return;

  const firstGrid = panel.querySelector('.psmap-grid-2');
  const host = document.createElement('div');
  host.className = 'psmap-grid-2';
  host.setAttribute('data-psmap-support-config', '1');
  host.innerHTML = `
    <label class="psmap-check">
      <input type="checkbox" data-psmap-setup="useBuiltInSupportKeywordLogic" ${supportOptionState.useBuiltInSupportKeywordLogic ? 'checked' : ''}>
      Use built-in support keyword logic
      <span class="psmap-help" title="Recognizes REST, GUIDE, LINE STOP, LINESTOP, STOP, PIPE STOP, ANCHOR and PIPE ANCHOR in both Table-1C ISONOTE and Table-2 DTXR.">i</span>
    </label>
    <label class="psmap-check">
      <input type="checkbox" data-psmap-setup="treatAnchorAsLineStop" ${supportOptionState.treatAnchorAsLineStop ? 'checked' : ''}>
      Treat Anchor as Line Stop
      <span class="psmap-help" title="When ON, DTXR values such as Anchor or Pipe Anchor are normalized to LINE_STOP / STOP for support matching and missing-support audit.">i</span>
    </label>`;

  if (firstGrid?.nextSibling) firstGrid.parentNode.insertBefore(host, firstGrid.nextSibling);
  else panel.querySelector('.psmap-card-body')?.appendChild(host);
}

function getTableInfo(panelName) {
  const table = document.querySelector(`[data-psmap-panel="${panelName}"] table.psmap-table`);
  if (!table) return null;
  const labels = Array.from(table.querySelectorAll('thead tr.psmap-labels th')).map((th) => th.textContent.trim());
  const tbody = table.querySelector('tbody');
  if (!labels.length || !tbody) return null;
  return { table, labels, tbody };
}

function readCell(row, labels, label) {
  const index = labels.indexOf(label);
  return index >= 0 ? row.children[index]?.textContent?.trim() || '' : '';
}

function setCell(row, labels, label, value) {
  const index = labels.indexOf(label);
  if (index < 0) return;
  row.children[index].textContent = value == null ? '' : String(value);
}

function splitSupportList(value) {
  return String(value || '')
    .split(/[;,|/]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.toUpperCase().replace(/^LINE[_\s-]*STOP$/, 'STOP'));
}

function auditKey(row) {
  return [row.node, row.table1PsNo, row.missing].join('|');
}

function makeAuditRowsFromCoverage() {
  const info = getTableInfo('coverage');
  if (!info) return [];
  const rows = [];
  const seen = new Set();
  for (const tr of info.tbody.querySelectorAll('tr')) {
    const node = readCell(tr, info.labels, 'Node');
    const table1PsNo = readCell(tr, info.labels, 'Table-1 PS No');
    const missingMasterKeywords = readCell(tr, info.labels, 'Missing Master Keywords');
    for (const missing of splitSupportList(missingMasterKeywords)) {
      const row = {
        node,
        candidateNode: node,
        table1PsNo,
        tag: readCell(tr, info.labels, 'Tag'),
        source: readCell(tr, info.labels, 'Source'),
        lineFamily: readCell(tr, info.labels, 'Line Family'),
        pipeSizeRaw: readCell(tr, info.labels, 'Pipe Size'),
        derivedDn: readCell(tr, info.labels, 'Derived DN'),
        isonote: readCell(tr, info.labels, 'ISONOTE'),
        masterKeywords: readCell(tr, info.labels, 'Master Keywords'),
        missing,
        supportMatch: `${missing} missing`,
        supportBasis: 'SUPPORT_MISSING_MASTER_REQUIRED',
        finalStatus: 'SUPPORT_MISSING_REQUIRED',
        confidence: 'AUDIT',
        confidenceScore: '0',
        warnings: `SUPPORT_MISSING_REQUIRED: ${missing}`,
        action: `Add Table-2 DTXR/model support row for ${missing}, or revise Table-1C ISONOTE if ${missing} is not required.`,
        note: `${missing} missing from mapped Table-2 DTXR for Node ${node || '-'}.`,
      };
      const key = auditKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  return rows;
}

function appendAuditRow(info, row, fill) {
  const key = auditKey(row);
  if (info.tbody.querySelector(`[data-psmap-support-audit-key="${CSS.escape(key)}"]`)) return;
  const tr = document.createElement('tr');
  tr.setAttribute('data-psmap-support-audit-key', key);
  tr.setAttribute('data-psmap-support-audit-row', '1');
  for (let i = 0; i < info.labels.length; i += 1) {
    const td = document.createElement('td');
    td.className = 'group-diagnostic';
    tr.appendChild(td);
  }
  fill(tr, info.labels, row);
  info.tbody.appendChild(tr);
}

function patchValidatorMissingSupportAuditRows(auditRows) {
  const info = getTableInfo('validator');
  if (!info) return;
  for (const audit of auditRows) {
    appendAuditRow(info, audit, (tr, labels, row) => {
      setCell(tr, labels, 'PSNO_Model', '-');
      setCell(tr, labels, 'Node', row.node);
      setCell(tr, labels, 'Table-1 PS No', row.table1PsNo);
      setCell(tr, labels, 'Tag', row.tag);
      setCell(tr, labels, 'T1 Source', row.source);
      setCell(tr, labels, 'T1 Line Family', row.lineFamily);
      setCell(tr, labels, 'T1 Derived DN', row.derivedDn);
      setCell(tr, labels, 'Support Match', row.supportMatch);
      setCell(tr, labels, 'Basis', `PS_BASE + BORE_DN_FROM_NPS + ${row.supportBasis}`);
      setCell(tr, labels, 'Enabled', '');
      setCell(tr, labels, 'Final Status', row.finalStatus);
      setCell(tr, labels, 'Confidence', row.confidence);
      setCell(tr, labels, 'Confidence Score', row.confidenceScore);
      setCell(tr, labels, 'Review Action', row.action);
      setCell(tr, labels, 'Warnings', row.warnings);
      setCell(tr, labels, 'Node Coverage Note', row.note);
    });
  }
}

function patchCandidateMissingSupportAuditRows(auditRows) {
  const info = getTableInfo('candidates');
  if (!info) return;
  for (const audit of auditRows) {
    appendAuditRow(info, audit, (tr, labels, row) => {
      setCell(tr, labels, 'PSNO_Model', '-');
      setCell(tr, labels, 'Candidate Node', row.candidateNode);
      setCell(tr, labels, 'Table-1 PS No', row.table1PsNo);
      setCell(tr, labels, 'Tag', row.tag);
      setCell(tr, labels, 'Source', row.source);
      setCell(tr, labels, 'T1 Line Family', row.lineFamily);
      setCell(tr, labels, 'Pipe Size', row.pipeSizeRaw);
      setCell(tr, labels, 'Derived DN', row.derivedDn);
      setCell(tr, labels, 'ISONOTE', row.isonote);
      setCell(tr, labels, 'PS Basis', 'PS_BASE');
      setCell(tr, labels, 'Bore Basis', row.derivedDn ? 'BORE_DN_FROM_NPS' : '');
      setCell(tr, labels, 'Line Basis', '-');
      setCell(tr, labels, 'Support Basis', row.supportBasis);
      setCell(tr, labels, 'Support Match', row.supportMatch);
      setCell(tr, labels, 'Eligible', '');
      setCell(tr, labels, 'Auto Selectable', '');
      setCell(tr, labels, 'Review Required', 'YES');
      setCell(tr, labels, 'Selected', '');
      setCell(tr, labels, 'Final Status', row.finalStatus);
      setCell(tr, labels, 'Confidence', row.confidence);
      setCell(tr, labels, 'Confidence Score', row.confidenceScore);
      setCell(tr, labels, 'Score', '999999');
      setCell(tr, labels, 'Warnings', row.warnings);
      setCell(tr, labels, 'Reason', row.action);
      setCell(tr, labels, 'Node Coverage Note', row.note);
    });
  }
}

function patchMissingSupportAuditRows() {
  const auditRows = makeAuditRowsFromCoverage();
  if (!auditRows.length) return;
  patchValidatorMissingSupportAuditRows(auditRows);
  patchCandidateMissingSupportAuditRows(auditRows);
}

function readValidatorDtxrMap() {
  const map = new Map();
  const table = document.querySelector('[data-psmap-panel="validator"] table.psmap-table');
  if (!table) return map;
  const labels = Array.from(table.querySelectorAll('thead tr.psmap-labels th')).map((th) => th.textContent.trim());
  const psIndex = labels.indexOf('PSNO_Model');
  const dtxrIndex = labels.indexOf('T2 DTXR');
  if (psIndex < 0 || dtxrIndex < 0) return map;
  for (const row of table.querySelectorAll('tbody tr')) {
    const cells = row.children;
    const psno = cells[psIndex]?.textContent?.trim();
    const dtxr = cells[dtxrIndex]?.textContent?.trim();
    if (psno && dtxr && !map.has(psno)) map.set(psno, dtxr);
  }
  return map;
}

function patchCandidateDtxrColumn() {
  const table = document.querySelector('[data-psmap-panel="candidates"] table.psmap-table');
  if (!table) return;
  const labelsRow = table.querySelector('thead tr.psmap-labels');
  if (!labelsRow) return;
  const labels = Array.from(labelsRow.children).map((th) => th.textContent.trim());
  if (labels.includes('T2 DTXR')) return;

  const psIndex = labels.indexOf('PSNO_Model');
  const insertAfter = labels.indexOf('T2 Line Family');
  if (psIndex < 0 || insertAfter < 0) return;

  const groupRow = table.querySelector('thead tr.psmap-group');
  const t2Group = Array.from(groupRow?.children || []).find((th) => th.textContent.trim() === 'Table-2 Source');
  if (t2Group) t2Group.colSpan = Number(t2Group.colSpan || 1) + 1;

  const th = document.createElement('th');
  th.textContent = 'T2 DTXR';
  labelsRow.children[insertAfter].after(th);

  const dtxrByPs = readValidatorDtxrMap();
  for (const row of table.querySelectorAll('tbody tr')) {
    const cells = row.children;
    const psno = cells[psIndex]?.textContent?.trim();
    const td = document.createElement('td');
    td.className = cells[insertAfter]?.className || 'group-source';
    td.textContent = dtxrByPs.get(psno) || '';
    cells[insertAfter]?.after(td);
  }
}

function installPsMappingSupportUiBridge() {
  const patch = () => {
    patchSupportConfigControls();
    patchCandidateDtxrColumn();
    patchMissingSupportAuditRows();
  };
  const runPatch = schedulePatch(patch);
  const observer = new MutationObserver(runPatch);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('change', onSupportOptionChange, true);
  runPatch();
  return () => {
    observer.disconnect();
    document.removeEventListener('change', onSupportOptionChange, true);
  };
}

function onSupportOptionChange(event) {
  const target = event.target;
  const key = target?.dataset?.psmapSetup;
  if (key === 'useBuiltInSupportKeywordLogic' || key === 'treatAnchorAsLineStop') {
    supportOptionState[key] = target.checked === true;
  }
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  const destroyBase = installBasePsMappingUtilityTile(container, ctx);
  const destroyBridge = installPsMappingSupportUiBridge();
  return () => {
    try { destroyBridge?.(); } catch {}
    try { destroyBase?.(); } catch {}
  };
}
