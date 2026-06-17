import {
  LINE_NO_METADATA_KEYS,
  firstLineNoValue,
  lineNoFromMetadata,
} from '../../../utils/line-no-metadata.js';
import {
  bmCiiLineNoFromSideload,
  ensureBmCiiLineNoSideloadLoaded,
} from './bmCiiLineNoSideload.js';

const SUPPORT_DISPLAY_FIELDS = [
  ['TYPE', ['TYPE', 'supportType', 'supportKind', 'kind', 'pcfType', 'type']],
  ['AXIS', ['AXIS', 'axis', 'restraintAxis', 'supportAxis', 'supportAxisLabel', 'axisLabel']],
  ['NODE', ['NODE', 'node', 'sourceNode', 'supportNode', 'fromNode']],
  ['SOURCE', ['SOURCE', 'source', 'supportSource']],
  ['STIFFNESS', ['STIFFNESS', 'supportStiffness', 'stiffness', 'restraintStiffness']],
  ['GAP', ['GAP', 'supportGap', 'gap', 'gapMm', 'restraintGap']],
  ['FRIC_COEF', ['FRIC_COEF', 'supportFricCoef', 'fricCoef', 'frictionCoefficient', 'mu']],
  ['TAG', ['TAG', 'supportTag', 'tag', 'labelText', 'name']],
  ['GUID', ['GUID', 'supportGuid', 'guid', 'componentGuid', 'supportRecordId', 'recordId']],
];

const DISPLAY_FIELDS = [
  ['ID', ['pcfId', 'id', 'name']],
  ['Type', ['pcfType', 'type', 'sourceComponentType', 'componentKind']],
  ['Ref No', ['refNo', 'REF_NO', 'pcfId', 'id']],
  ['Line No.', ['lineNo', 'Line No']],
  ['From Node', ['fromNode']],
  ['To Node', ['toNode']],
  ['Bore', ['bore', 'Bore', 'diameterMm']],
  ['Wall Thickness', ['wallThickness', 'Wall Thickness']],
  ['Material', ['materialName', 'Material']],
  ['Pressure', ['pressure', 'Pressure']],
  ['Hydro Pressure', ['hydroPressure', 'Hydro Pressure']],
  ['Material Thickness', ['materialThickness', 'Material Thickness']],
  ['Temp1', ['temp1', 'Temp1']],
  ['Temp2', ['temp2', 'Temp2']],
  ['Temp3', ['temp3', 'Temp3']],
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
    if (Array.isArray(value)) return value.map(valueText).join(', ');
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
  return first(data, keys, fallback) || 'N/A';
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
    if (supportLike) meta = promoteSupportMeta(item, meta);
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
    }

    let html = '<div style="font-family: monospace; font-size: 12px; margin-bottom: 10px; line-height: 1.42;">';
    if (supportLike) {
      html += '<strong>Selected Object:</strong> BM_CII support glyph<br/>';
      for (const [label, keys] of SUPPORT_DISPLAY_FIELDS) {
        html += `<strong>${esc(label)}:</strong> ${esc(firstOrNA(meta, keys))}<br/>`;
      }
      html += '<hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.18); margin: 8px 0;"/>';
    }
    for (const [label, keys] of DISPLAY_FIELDS) {
      const fallback = label === 'ID' ? item.id : label === 'Type' ? item.type : label === 'Ref No' ? item.refNo : label === 'Bore' ? item.bore : '';
      html += `<strong>${esc(label)}:</strong> ${esc(firstOrNA(meta, keys, fallback))}<br/>`;
    }
    if (meta.LINE_NO_SOURCE) {
      html += `<strong>Line No Source:</strong> ${esc(meta.LINE_NO_SOURCE)}<br/>`;
      if (meta.LINE_NO_ANCHOR_NODE) html += `<strong>Line No Anchor Node:</strong> ${esc(meta.LINE_NO_ANCHOR_NODE)}<br/>`;
      if (meta.LINE_NO_SCOPE) html += `<strong>Line No Scope:</strong> ${esc(meta.LINE_NO_SCOPE)}<br/>`;
    }
    html += '</div>';

    html += '<strong>Fallback Properties</strong><div style="background: rgba(0,0,0,0.5); padding: 5px; border-radius: 4px; margin-top: 5px; max-height: 220px; overflow-y: auto;"><table style="width: 100%; text-align: left; border-collapse: collapse;">';
    const fallbackMeta = Object.keys(meta).length > 0 ? meta : { uuid: item.uuid, name: item.object3D?.name };
    for (const [key, value] of Object.entries(fallbackMeta)) {
      const display = valueText(value);
      if (display === '') continue;
      html += `<tr><td style="padding: 4px; border-bottom: 1px solid #444; color: #aaa; width: 40%; word-break: break-word;">${esc(key)}</td><td style="padding: 4px; border-bottom: 1px solid #444; color: #fff; word-break: break-word;">${esc(display)}</td></tr>`;
    }
    html += '</table></div>';

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
