import {
  LINE_NO_METADATA_KEYS,
  firstLineNoValue,
  lineNoFromMetadata,
} from '../../../utils/line-no-metadata.js';

const SUPPORT_DISPLAY_FIELDS = [
  ['TYPE', ['TYPE', 'supportType', 'supportKind', 'kind', 'pcfType', 'type']],
  ['AXIS', ['AXIS', 'axis', 'restraintAxis', 'supportAxis']],
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
  return trace.entity === 'support'
    || trace.semanticCategory === 'support'
    || Boolean(meta.supportRecordId || meta.supportKind || meta.supportSource)
    || String(item?.type || '').toUpperCase().includes('SUPPORT');
}

export function createPropertyPanel(propPanel, propContent) {
  function lineNoForItem(item, meta) {
    return firstLineNoValue(
      lineNoFromMetadata(meta, LINE_NO_METADATA_KEYS),
      meta?.lineNo,
      meta?.['Line No'],
      item?.lineNo,
      item?.object3D?.userData?.lineNo
    );
  }

  return {
    show: (item) => {
      if (!item) {
        propPanel.style.display = 'none';
        return;
      }

      const meta = { ...(item.rawMeta || {}), ...mergedUserData(item.object3D) };
      const lineNo = lineNoForItem(item, meta);
      if (lineNo) meta.lineNo = lineNo;

      let html = '<div style="font-family: monospace; font-size: 12px; margin-bottom: 10px; line-height: 1.42;">';
      if (isSupportLike(meta, item)) {
        for (const [label, keys] of SUPPORT_DISPLAY_FIELDS) {
          html += `<strong>${esc(label)}:</strong> ${esc(firstOrNA(meta, keys))}<br/>`;
        }
        html += '<hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.18); margin: 8px 0;"/>';
      }
      for (const [label, keys] of DISPLAY_FIELDS) {
        const fallback = label === 'ID' ? item.id : label === 'Type' ? item.type : label === 'Ref No' ? item.refNo : label === 'Bore' ? item.bore : '';
        html += `<strong>${esc(label)}:</strong> ${esc(firstOrNA(meta, keys, fallback))}<br/>`;
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
    },
    hide: () => {
      propPanel.style.display = 'none';
    }
  };
}
