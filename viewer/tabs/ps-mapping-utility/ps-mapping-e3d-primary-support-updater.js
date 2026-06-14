const SUPPORT_PARENT_LABEL = {
  REST: 'REST',
  GUIDE: 'GUIDE',
  LINE_STOP: 'LINE STOP',
};

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function hkey(value) {
  return clean(value).toLowerCase().replace(/[_.\-/]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitLines(text) {
  return String(text || '').split(/\r?\n/).filter((line) => clean(line));
}

function splitCells(line) {
  const raw = String(line || '');
  if (raw.includes('\t')) return raw.split('\t').map((value) => value.trim());
  return raw.split(/ {2,}/).map((value) => value.trim()).filter(Boolean);
}

function joinCells(cells, delimiter = '\t') {
  return (cells || []).map((value) => String(value ?? '').trim()).join(delimiter);
}

function findHeaderIndex(headers, aliases) {
  const allowed = new Set((aliases || []).map(hkey));
  return (headers || []).findIndex((header) => allowed.has(hkey(header)));
}

function splitList(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function stripPrefix(value) {
  return String(value ?? '')
    .replace(/^\s*\/+/, '')
    .replace(/^FDN[-_/]*/i, '')
    .trim();
}

export function normalizeE3dPrimarySupportKey(value) {
  const raw = clean(value);
  let body = stripPrefix(raw);
  body = body.split('|')[0].trim();
  body = body.replace(/\/\s*DATUM\b/gi, '').replace(/\bDATUM\b/gi, '').trim();
  body = body.replace(/\.$/, '').trim();
  const exactKey = body.toUpperCase().replace(/\s+/g, '');
  const baseKey = exactKey.replace(/\.\d+\b/g, '').replace(/\.$/, '');
  return { raw, exactKey, baseKey };
}

function parentFromSupportType(value) {
  const text = clean(value).toUpperCase();
  if (!text) return '';
  if (/LINE\s*[- ]?STOP|\bSTOP\b|PIPE\s*STOP/.test(text)) return 'LINE_STOP';
  if (/\bGUIDE\b/.test(text)) return 'GUIDE';
  if (/\bREST\b|\bSHOE\b|\bUBOLT\b|U[- ]?BOLT/.test(text)) return 'REST';
  return '';
}

function parentFromDescription(value) {
  const text = clean(value).toUpperCase();
  if (!text) return '';
  // Strong line-stop words win over the word SHOE in "Directional Anchor On Shoe".
  if (/DIRECTIONAL\s+ANCHOR|PIPE\s*STOP|LINE\s*[- ]?STOP|\bXST\d*/.test(text)) return 'LINE_STOP';
  if (/\bGUIDE\b/.test(text)) return 'GUIDE';
  if (/PIPE\s+REST|\bXRT\b|PIPE\s+SHOE|WEAR\s+PLATE|\bSHOE\b|U[- ]?BOLT/.test(text)) return 'REST';
  return '';
}

function supportParent(typeValue, descriptionValue) {
  return parentFromSupportType(typeValue) || parentFromDescription(descriptionValue);
}

function actionParent(actionText) {
  const action = clean(actionText);
  if (!action || /\bGAP\b/i.test(action)) return '';
  const match = action.match(/\bRemove\s+extra\s+(GUIDE|LINE\s*STOP|STOP)\b/i);
  if (!match) return '';
  const raw = match[1].toUpperCase().replace(/\s+/g, ' ');
  if (raw === 'GUIDE') return 'GUIDE';
  if (raw === 'STOP' || raw === 'LINE STOP') return 'LINE_STOP';
  return '';
}

function rowValue(row, names) {
  for (const name of names) {
    if (row && Object.prototype.hasOwnProperty.call(row, name)) return row[name];
  }
  return '';
}

function actionRowsFromCandidates(candidateRows = []) {
  const actions = [];
  for (const row of candidateRows || []) {
    const psRaw = rowValue(row, ['psnoModel', 'PSNO_Model', 'PSNO Model', 'PS NO', 'PS No']);
    const action = rowValue(row, ['psNoWiseAction', 'PS No. Wise Action', 'action', 'Action']);
    const parent = actionParent(action);
    if (!psRaw || !parent) continue;
    const key = normalizeE3dPrimarySupportKey(psRaw);
    actions.push({ psRaw: clean(psRaw), action: clean(action), parent, ...key });
  }
  return actions;
}

function buildActionIndex(actions = []) {
  const byExact = new Map();
  const byBase = new Map();
  for (const action of actions) {
    if (action.exactKey) {
      if (!byExact.has(action.exactKey)) byExact.set(action.exactKey, []);
      byExact.get(action.exactKey).push(action);
    }
    if (action.baseKey) {
      if (!byBase.has(action.baseKey)) byBase.set(action.baseKey, []);
      byBase.get(action.baseKey).push(action);
    }
  }
  return { byExact, byBase };
}

function matchingActionForToken(token, targetParent, actionIndex) {
  const key = normalizeE3dPrimarySupportKey(token);
  const exact = (actionIndex.byExact.get(key.exactKey) || []).find((item) => item.parent === targetParent);
  if (exact) return exact;
  return (actionIndex.byBase.get(key.baseKey) || []).find((item) => item.parent === targetParent) || null;
}

function applyActionsToCompositeRow({ cells, psIndex, typeIndex, descIndex, actionIndex, sourceRow }) {
  const psItems = splitList(cells[psIndex]);
  const typeItems = splitList(cells[typeIndex]);
  const descItems = splitList(cells[descIndex]);
  const count = Math.max(psItems.length, typeItems.length, descItems.length);
  const keepPs = [];
  const keepType = [];
  const keepDesc = [];
  const auditRows = [];
  let changed = false;

  for (let i = 0; i < count; i += 1) {
    const ps = psItems[i] || '';
    const type = typeItems[i] || '';
    const desc = descItems[i] || '';
    const parent = supportParent(type, desc);
    const action = ps && parent ? matchingActionForToken(ps, parent, actionIndex) : null;
    if (action) {
      changed = true;
      auditRows.push({
        status: 'REMOVED',
        sourceRow,
        psnoModel: ps,
        normalizedBaseKey: normalizeE3dPrimarySupportKey(ps).baseKey,
        removedSupportParent: SUPPORT_PARENT_LABEL[parent] || parent,
        removedSupportType: type,
        removedPrimarySupportDescription: desc,
        action: action.action,
      });
      continue;
    }
    if (ps) keepPs.push(ps);
    if (type) keepType.push(type);
    if (desc) keepDesc.push(desc);
  }

  if (changed) {
    cells[psIndex] = keepPs.join(', ');
    cells[typeIndex] = keepType.join(', ');
    cells[descIndex] = keepDesc.join(', ');
  }
  return { cells, changed, auditRows };
}

export function applyE3dPrimarySupportActions(primarySupportText, candidateRows = [], options = {}) {
  const delimiter = options.delimiter || '\t';
  const lines = splitLines(primarySupportText);
  if (!lines.length) {
    return { patchedText: '', auditRows: [], stats: { sourceRows: 0, actions: 0, changedRows: 0, removedItems: 0 } };
  }
  const headers = splitCells(lines[0]);
  const psIndex = findHeaderIndex(headers, ['piping primary support', 'primary support', 'psno model', 'psno_model', 'ps no', 'ps name']);
  const typeIndex = findHeaderIndex(headers, ['support type', 'support types']);
  const descIndex = findHeaderIndex(headers, ['primary support description', 'support description', 'description']);
  if (psIndex < 0 || typeIndex < 0 || descIndex < 0) {
    throw new Error(`Required E3D columns not found. Need PIPING PRIMARY SUPPORT, SUPPORT TYPE, and PRIMARY SUPPORT DESCRIPTION. Headers: ${headers.join(' | ')}`);
  }

  const actions = actionRowsFromCandidates(candidateRows);
  const actionIndex = buildActionIndex(actions);
  const out = [joinCells(headers, delimiter)];
  const auditRows = [];
  let changedRows = 0;

  for (const [offset, line] of lines.slice(1).entries()) {
    const sourceRow = offset + 2;
    const cells = splitCells(line);
    while (cells.length < headers.length) cells.push('');
    const result = applyActionsToCompositeRow({ cells, psIndex, typeIndex, descIndex, actionIndex, sourceRow });
    if (result.changed) changedRows += 1;
    auditRows.push(...result.auditRows);
    out.push(joinCells(result.cells, delimiter));
  }

  return {
    patchedText: out.join('\n'),
    auditRows,
    stats: {
      sourceRows: Math.max(0, lines.length - 1),
      actions: actions.length,
      changedRows,
      removedItems: auditRows.length,
    },
  };
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function rowsToAuditCsv(rows = []) {
  const columns = [
    'status',
    'sourceRow',
    'psnoModel',
    'normalizedBaseKey',
    'removedSupportParent',
    'removedSupportType',
    'removedPrimarySupportDescription',
    'action',
  ];
  return [
    columns.map(csvEscape).join(','),
    ...rows.map((row) => columns.map((key) => csvEscape(row[key])).join(',')),
  ].join('\n');
}

export function buildE3dPrimarySupportPatchAuditCsv(primarySupportText, candidateRows = [], options = {}) {
  const result = applyE3dPrimarySupportActions(primarySupportText, candidateRows, options);
  return rowsToAuditCsv(result.auditRows);
}
