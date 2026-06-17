import {
  LINE_NO_METADATA_KEYS,
  firstLineNoValue,
  lineNoFromMetadata,
  normalizeLineNoValue,
} from '../../../utils/line-no-metadata.js';
import {
  bmCiiLineNoFromSideload,
  ensureBmCiiLineNoSideloadLoaded,
} from './bmCiiLineNoSideload.js';

const NA = 'N/A';

const SUPPORT_DISPLAY_FIELDS = [
  ['Type', ['TYPE', 'supportType', 'supportKind', 'kind', 'pcfType', 'type']],
  ['Axis', ['AXIS', 'axis', 'restraintAxis', 'supportAxis', 'supportAxisLabel', 'axisLabel']],
  ['Node', ['NODE', 'node', 'sourceNode', 'supportNode', 'fromNode']],
  ['Source', ['SOURCE', 'source', 'supportSource']],
  ['Stiffness', ['STIFFNESS', 'supportStiffness', 'stiffness', 'restraintStiffness']],
  ['Gap', ['GAP', 'supportGap', 'gap', 'gapMm', 'restraintGap']],
  ['Friction Coef.', ['FRIC_COEF', 'supportFricCoef', 'fricCoef', 'frictionCoefficient', 'mu']],
  ['Tag', ['TAG', 'supportTag', 'tag', 'labelText', 'name']],
  ['GUID', ['GUID', 'supportGuid', 'guid', 'componentGuid', 'supportRecordId', 'recordId']],
];

const IDENTITY_FIELDS = [
  ['ID', ['pcfId', 'id', 'name'], (item) => item?.id],
  ['Engineering Type', ['engineeringType', 'componentType', 'sourceComponentType', 'componentKind', 'pcfType', 'type'], (item) => item?.type],
  ['Mesh Role', ['meshRole', 'glbShape', 'pcfType', 'type'], (item) => item?.object3D?.name || item?.type],
  ['Ref No', ['refNo', 'REF_NO', 'pcfId', 'id'], (item) => item?.refNo || item?.id],
];

const LINE_NODE_FIELDS = [
  ['From Node', ['fromNode', 'FROM_NODE', 'From Node']],
  ['To Node', ['toNode', 'TO_NODE', 'To Node']],
];

const COMPONENT_FIELDS = [
  ['Bore / Diameter', ['bore', 'Bore', 'diameterMm', 'diameter', 'DIAMETER']],
  ['Wall Thickness', ['wallThickness', 'Wall Thickness', 'WALL_THICK']],
  ['Material Thickness', ['materialThickness', 'Material Thickness', 'WALL_THICK']],
  ['Material', ['materialName', 'material', 'Material', 'MATERIAL_NAME']],
];

const PROCESS_FIELDS = [
  ['Pressure', ['pressure', 'Pressure', 'PRESSURE1']],
  ['Hydro Pressure', ['hydroPressure', 'Hydro Pressure', 'HYDRO_PRESSURE']],
  ['Temp1', ['temp1', 'Temp1', 'TEMP_EXP_C1']],
  ['Temp2', ['temp2', 'Temp2', 'TEMP_EXP_C2']],
  ['Temp3', ['temp3', 'Temp3', 'TEMP_EXP_C3']],
];

const ISONOTE_FIELDS = [
  ['Node', ['NODE', 'node', 'sourceNode']],
  ['Source Note Name', ['SOURCE_NOTE_NAME', 'sourceNoteName', 'sourceInfo', 'isonote', 'displayText', 'labelDisplayText', 'labelText']],
  ['Source', ['SOURCE', 'source', 'annotationSource']],
  ['Related Restraints', ['relatedRestraints', 'expectedRestraints', 'parsedRestraints']],
];

const SOURCE_FIELDS = [
  ['Source XML', ['sourceXml', 'SOURCE_XML', 'xmlFile', 'inputXmlFile']],
  ['Source', ['SOURCE', 'source', 'supportSource']],
  ['Source Trace', ['provenanceTrace', 'sourceTrace', 'generationTrace', 'conversionTrace']],
  ['Benchmark', ['benchmarkName', 'benchmark', 'sourceRun']],
];

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function valueText(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(', ');
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined && item !== null && item !== '')
      .map(([key, item]) => `${key}:${valueText(item)}`);
    return entries.join(' ');
  }
  return String(value);
}

function first(data, keys, fallback = '') {
  for (const key of keys) {
    const value = valueText(data?.[key]);
    if (value !== '') return value;
  }
  return valueText(fallback);
}

function firstOrNA(data, keys, fallback = '') {
  return first(data, keys, fallback) || NA;
}

function fieldStatus(value, preferred = '') {
  if (!value || value === NA) return 'Unavailable';
  return preferred || 'Resolved';
}

function statusChip(status) {
  const label = esc(status || 'Resolved');
  const color = status === 'Unavailable'
    ? '#94a3b8'
    : status === 'Sideloaded'
      ? '#fbbf24'
      : status === 'Debug'
        ? '#a78bfa'
        : '#86efac';
  return `<span style="float:right; color:${color}; font-size:10px; letter-spacing:.02em;">${label}</span>`;
}

function normalizeNodeId(value) {
  const raw = valueText(value).trim();
  if (!raw) return '';
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? String(Math.trunc(numeric)) : raw;
}

function identityText(item = {}, meta = {}) {
  const parts = [
    item?.id,
    item?.type,
    item?.refNo,
    item?.name,
    item?.rawMeta?.id,
    item?.rawMeta?.name,
    meta?.id,
    meta?.pcfId,
    meta?.name,
    meta?.supportRecordId,
    meta?.recordId,
    meta?.labelText,
    meta?.labelDisplayText,
    meta?.sourceInfo,
  ];
  let current = item?.object3D || null;
  while (current) {
    parts.push(current.name, current.uuid);
    current = current.parent || null;
  }
  return parts.map(valueText).filter(Boolean).join(' ');
}

function nodeFromIdentity(item = {}, meta = {}) {
  const raw = identityText(item, meta);
  if (!raw) return '';
  const patterns = [
    /(?:^|[_\s:;-])node[_\s:;-]*([0-9]+(?:\.[0-9]+)?)/i,
    /(?:^|[_\s:;-])support[_\s:;-]*node[_\s:;-]*([0-9]+(?:\.[0-9]+)?)/i,
    /\bN(?:ODE)?\s*([0-9]+(?:\.[0-9]+)?)\b/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    const node = normalizeNodeId(match?.[1]);
    if (node) return node;
  }
  return '';
}

function kindFromIdentity(item = {}, meta = {}) {
  const raw = identityText(item, meta).toUpperCase();
  if (raw.includes('FLAT-FLOW-BLOCKING') || raw.includes('ANCHOR') || raw.includes(':ANC') || raw.includes(' ANC')) return 'ANCHOR';
  if (raw.includes('LINESTOP') || raw.includes('LINE-STOP') || raw.includes('LINE STOP')) return 'LINESTOP';
  if (raw.includes('GUIDE')) return 'GUIDE';
  if (raw.includes('SPRING') || raw.includes('HANGER')) return 'SPRING';
  if (raw.includes('LIMIT')) return 'LIMIT';
  if (raw.includes('HOLDDOWN') || raw.includes('HOLD-DOWN')) return 'HOLDDOWN';
  if (raw.includes('REST')) return 'REST';
  return '';
}

function sourceFromIdentity(item = {}, meta = {}) {
  const raw = identityText(item, meta).toUpperCase();
  if (raw.includes('ISONOTE')) return 'isonote';
  if (raw.includes('INPUTXML') || raw.includes('BM_CII')) return 'inputxml';
  return '';
}

function mergedUserData(object3D) {
  const chain = [];
  const traceChain = [];
  let current = object3D || null;
  while (current) {
    if (current.userData && Object.keys(current.userData).length) {
      chain.unshift(current.userData);
      if (current.userData.bmCiiTrace && typeof current.userData.bmCiiTrace === 'object') {
        traceChain.unshift(current.userData.bmCiiTrace);
      }
    }
    current = current.parent || null;
  }
  const mergedTrace = Object.assign({}, ...traceChain);
  const merged = Object.assign({}, ...chain, object3D?.userData || {});
  const currentTrace = merged.bmCiiTrace && typeof merged.bmCiiTrace === 'object' ? merged.bmCiiTrace : {};
  return {
    ...mergedTrace,
    ...merged,
    bmCiiTrace: { ...mergedTrace, ...currentTrace },
  };
}

function isSupportLike(meta = {}, item = {}) {
  const trace = meta.bmCiiTrace && typeof meta.bmCiiTrace === 'object' ? meta.bmCiiTrace : {};
  const raw = identityText(item, meta).toUpperCase();
  return trace.entity === 'support'
    || trace.entity === 'supportPart'
    || trace.semanticCategory === 'support'
    || Boolean(meta.supportRecordId || meta.supportKind || meta.supportSource || meta.supportGlyphRole)
    || String(item?.type || '').toUpperCase().includes('SUPPORT')
    || raw.includes('SUPPORT')
    || raw.includes('RESTRAINT')
    || raw.includes('BM_CII_BAKED_SUPPORT');
}

function isIsonoteLike(meta = {}, item = {}) {
  const raw = identityText(item, meta).toUpperCase();
  const trace = meta.bmCiiTrace && typeof meta.bmCiiTrace === 'object' ? meta.bmCiiTrace : {};
  return raw.includes('ISONOTE')
    || String(meta.TYPE || meta.type || '').toUpperCase().includes('ISONOTE')
    || String(meta.annotationType || '').toUpperCase().includes('ISONOTE')
    || String(trace.annotationType || '').toUpperCase().includes('ISONOTE');
}

function promoteSupportMeta(item, meta) {
  const promoted = { ...meta };
  const kind = first(promoted, ['TYPE', 'supportType', 'supportKind', 'kind']) || kindFromIdentity(item, promoted);
  const node = normalizeNodeId(first(promoted, ['NODE', 'node', 'sourceNode', 'supportNode', 'fromNode'])) || nodeFromIdentity(item, promoted);
  const source = first(promoted, ['SOURCE', 'source', 'supportSource']) || sourceFromIdentity(item, promoted);
  const id = first(promoted, ['pcfId', 'id', 'name'], item?.id || item?.object3D?.name || '');

  if (kind) {
    promoted.TYPE = first(promoted, ['TYPE']) || kind;
    promoted.supportType = first(promoted, ['supportType']) || promoted.TYPE;
    promoted.supportKind = first(promoted, ['supportKind']) || kind;
    promoted.kind = first(promoted, ['kind']) || kind;
    if (!first(promoted, ['pcfType', 'type']) || first(promoted, ['pcfType', 'type']) === 'UNKNOWN') {
      promoted.pcfType = 'SUPPORT_SYMBOL';
      promoted.type = 'SUPPORT_SYMBOL';
    }
  }
  if (node) {
    promoted.NODE = first(promoted, ['NODE']) || node;
    promoted.node = first(promoted, ['node']) || node;
    promoted.supportNode = first(promoted, ['supportNode']) || node;
  }
  if (source) {
    promoted.SOURCE = first(promoted, ['SOURCE']) || source;
    promoted.supportSource = first(promoted, ['supportSource']) || source;
  }
  if (id) {
    promoted.id = first(promoted, ['id']) || id;
    promoted.name = first(promoted, ['name']) || id;
    promoted.supportGuid = first(promoted, ['supportGuid']) || first(promoted, ['supportRecordId', 'recordId'], id);
  }
  return promoted;
}

function clearInvalidLineNoFields(meta = {}) {
  for (const key of LINE_NO_METADATA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(meta, key) && !normalizeLineNoValue(meta[key])) {
      meta[key] = '';
    }
  }
  if (Object.prototype.hasOwnProperty.call(meta, 'Line No') && !normalizeLineNoValue(meta['Line No'])) meta['Line No'] = '';
  if (Object.prototype.hasOwnProperty.call(meta, 'lineNo') && !normalizeLineNoValue(meta.lineNo)) meta.lineNo = '';
}

function renderSection(title, rows, options = {}) {
  const filtered = rows.filter((row) => options.showEmpty || (row.value && row.value !== NA));
  if (!filtered.length && options.hideIfEmpty) return '';
  let html = `<section style="margin: 0 0 10px 0; border:1px solid rgba(148,163,184,.22); border-radius:8px; overflow:hidden;">`;
  html += `<div style="background:rgba(15,23,42,.88); color:#e2e8f0; padding:6px 8px; font-weight:700;">${esc(title)}</div>`;
  html += '<div style="padding:6px 8px;">';
  for (const row of filtered) {
    const value = row.value || NA;
    html += `<div style="padding:3px 0; border-bottom:1px solid rgba(148,163,184,.10);">`;
    html += `<strong>${esc(row.label)}:</strong> <span style="color:#fff;">${esc(value)}</span>`;
    if (row.status) html += statusChip(row.status);
    html += '</div>';
  }
  html += '</div></section>';
  return html;
}

function rowsFromFields(meta, item, fields, status = '') {
  return fields.map(([label, keys, fallback]) => {
    const fallbackValue = typeof fallback === 'function' ? fallback(item, meta) : fallback;
    const value = firstOrNA(meta, keys, fallbackValue || '');
    return { label, value, status: fieldStatus(value, status) };
  });
}

function debugRows(meta) {
  return Object.entries(meta)
    .map(([key, value]) => ({ key, value: valueText(value) }))
    .filter((row) => row.value !== '');
}

function renderDebug(meta) {
  const rows = debugRows(meta);
  if (!rows.length) return '';
  let html = '<details style="margin-top:8px;"><summary style="cursor:pointer; color:#c4b5fd; font-weight:700;">Raw / Debug Metadata</summary>';
  html += '<div style="background: rgba(0,0,0,0.46); padding: 5px; border-radius: 4px; margin-top: 5px; max-height: 240px; overflow-y: auto;"><table style="width: 100%; text-align: left; border-collapse: collapse;">';
  for (const row of rows) {
    html += `<tr><td style="padding: 4px; border-bottom: 1px solid #444; color: #aaa; width: 40%; word-break: break-word;">${esc(row.key)}</td><td style="padding: 4px; border-bottom: 1px solid #444; color: #fff; word-break: break-word;">${esc(row.value)}</td></tr>`;
  }
  html += '</table></div></details>';
  return html;
}

export function createPropertyPanel(propPanel, propContent) {
  let activeItem = null;

  function lineNoForItem(item, meta, supportLike) {
    const explicit = firstLineNoValue(
      lineNoFromMetadata(meta, LINE_NO_METADATA_KEYS),
      meta?.lineNo,
      meta?.['Line No'],
      item?.lineNo,
      item?.object3D?.userData?.lineNo
    );
    if (explicit) return { value: explicit, source: 'explicit component metadata', scope: 'component metadata' };
    return bmCiiLineNoFromSideload(item, meta, supportLike);
  }

  function show(item) {
    activeItem = item || null;
    if (!item) {
      propPanel.style.display = 'none';
      return;
    }

    let meta = { ...(item.rawMeta || {}), ...mergedUserData(item.object3D) };
    const supportLike = isSupportLike(meta, item);
    const isonoteLike = isIsonoteLike(meta, item);
    if (supportLike) meta = promoteSupportMeta(item, meta);

    clearInvalidLineNoFields(meta);
    const lineNo = lineNoForItem(item, meta, supportLike);
    if (lineNo?.pending) {
      ensureBmCiiLineNoSideloadLoaded()?.then?.(() => {
        if (activeItem === item) show(item);
      });
    }
    if (lineNo?.value) {
      meta.lineNo = lineNo.value;
      meta.LINE_NO_SOURCE = lineNo.source;
      meta.LINE_NO_SCOPE = lineNo.scope;
      if (lineNo.anchorNode) meta.LINE_NO_ANCHOR_NODE = lineNo.anchorNode;
    } else {
      meta.lineNo = '';
      meta['Line No'] = '';
      meta.LINE_NO = '';
    }

    let html = '<div style="font-family: monospace; font-size: 12px; margin-bottom: 10px; line-height: 1.42; color:#e5e7eb;">';

    if (supportLike) {
      html += renderSection('Support / Restraint', rowsFromFields(meta, item, SUPPORT_DISPLAY_FIELDS, 'Record scoped'), { showEmpty: true });
      html += '<div style="margin: -4px 0 10px 0; color:#fbbf24; font-size:11px;">Carry-forward: Not applicable to supports/restraints.</div>';
    }

    html += renderSection('Identity', rowsFromFields(meta, item, IDENTITY_FIELDS), { showEmpty: true });

    const lineRows = [
      { label: 'Line No.', value: lineNo?.value || NA, status: lineNo?.value ? 'Sideloaded' : 'Unavailable' },
      { label: 'Line No Source', value: meta.LINE_NO_SOURCE || NA, status: meta.LINE_NO_SOURCE ? 'Debug' : 'Unavailable' },
      { label: 'Line No Anchor Node', value: meta.LINE_NO_ANCHOR_NODE || NA, status: meta.LINE_NO_ANCHOR_NODE ? 'Debug' : 'Unavailable' },
      { label: 'Line No Scope', value: meta.LINE_NO_SCOPE || NA, status: meta.LINE_NO_SCOPE ? 'Debug' : 'Unavailable' },
      ...rowsFromFields(meta, item, LINE_NODE_FIELDS),
    ];
    html += renderSection('Line / Node', lineRows, { showEmpty: true });

    if (isonoteLike) {
      html += renderSection('ISONOTE Annotation', rowsFromFields(meta, item, ISONOTE_FIELDS, 'Sideloaded'), { showEmpty: true });
    }

    if (!supportLike && !isonoteLike) {
      html += renderSection('Component Data', rowsFromFields(meta, item, COMPONENT_FIELDS), { showEmpty: true });
      html += renderSection('Process / Analysis', rowsFromFields(meta, item, PROCESS_FIELDS), { showEmpty: true });
    }

    html += renderSection('Source / Debug Summary', rowsFromFields(meta, item, SOURCE_FIELDS, 'Debug'), { hideIfEmpty: true });
    html += renderDebug(meta);
    html += '</div>';

    propContent.innerHTML = html;
    propPanel.style.display = 'block';
  }

  ensureBmCiiLineNoSideloadLoaded();

  return {
    show,
    hide: () => {
      activeItem = null;
      propPanel.style.display = 'none';
    }
  };
}
