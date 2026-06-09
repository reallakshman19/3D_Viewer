import { EditablePreviewTable } from '../../shared/EditablePreviewTable.js';
import { deriveLineKeyFromBranchName, tokenAtPosition } from '../../../../converters/xml-cii2019-core/regex-line-key.js';
import { findAllWeightCandidates } from '../../../../converters/xml-cii2019-core/weight-match-model.js';
import { buildPipingClassIndex } from '../../../../converters/xml-cii2019-core/piping-class-resolver.js';
import { resolveBranchProcessData } from '../../../../converters/xml-cii2019-core/branch-process-resolver.js';
import { buildStagedDtxrIndex, resolveXmlCiiNodeDtxr } from '../../../../converters/xml-cii2019-core/dtxr-resolver.js';
import {
  applyPreviewOverrideFillDown,
  applyPreviewProcessFillDown,
  markPreviewOverrideManual,
  markPreviewProcessManual,
} from '../../shared/preview-filldown.js';

function _toText(val) {
  if (val === null || val === undefined) return '';
  return String(val);
}

function _toFiniteNumber(value, fallback) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return fallback;
}

function _esc(value) {
  return _toText(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function _xmlLocalName(node) {
  return _toText(node?.localName || node?.nodeName).replace(/^.*:/, '');
}

function _xmlChildrenByName(parent, localName) {
  return [...(parent?.childNodes || [])].filter((child) => child.nodeType === 1 && _xmlLocalName(child) === localName);
}

function _xmlFirstChild(parent, localName) {
  return _xmlChildrenByName(parent, localName)[0] || null;
}

function _xmlText(parent, localName) {
  return _toText(_xmlFirstChild(parent, localName)?.textContent).trim();
}

function _normalizePoint(point) {
  if (point === undefined || point === null || point === '') return null;
  if (Array.isArray(point) && point.length >= 3) {
    const x = Number(point[0]);
    const y = Number(point[1]);
    const z = Number(point[2]);
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x, y, z } : null;
  }
  if (typeof point === 'object') {
    const x = Number(point.x ?? point.X);
    const y = Number(point.y ?? point.Y);
    const z = Number(point.z ?? point.Z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    return { x, y, z };
  }
  const text = _toText(point).trim();
  if (!text) return null;
  const values = text.match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  return values.length >= 3 ? { x: values[0], y: values[1], z: values[2] } : null;
}

function _pointDistanceMm(a, b) {
  const pa = _normalizePoint(a);
  const pb = _normalizePoint(b);
  if (!pa || !pb) return null;
  return Math.sqrt(((pa.x - pb.x) ** 2) + ((pa.y - pb.y) ** 2) + ((pa.z - pb.z) ** 2));
}

function _regexGroup(text, pattern, groupIndex = 1) {
  const source = _toText(text);
  const patternText = _toText(pattern).trim();
  if (!source || !patternText) return '';
  try {
    const match = new RegExp(patternText, 'i').exec(source);
    const index = Math.max(0, Number(groupIndex || 0));
    return _toText(match?.[index] || '').trim();
  } catch {
    return '';
  }
}

function _rowText(row, keys) {
  if (!row || typeof row !== 'object') return '';
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(row, k) && row[k] !== undefined && row[k] !== null) {
      return _toText(row[k]).trim();
    }
  }
  return '';
}

function _rowNumber(row, keys) {
  const text = _rowText(row, keys);
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function _xmlCiiLineKeyRegexValue(value, pattern, groupIndex) {
  const text = _toText(value).trim();
  const patternText = _toText(pattern).trim();
  if (!text || !patternText) return text;
  const regexHit = _regexGroup(text, patternText, groupIndex || 1);
  return regexHit || text;
}

function _xmlCiiNormalizeLineKey(value) {
  return _toText(value).trim().toUpperCase().replace(/\s+/g, '');
}

function _xmlCiiFindLineListRow(branchLineKey, config) {
  const rows = Array.isArray(config.linelist?.masterRows) ? config.linelist.masterRows : [];
  if (!rows.length) return null;
  const lookupKey = _xmlCiiNormalizeLineKey(branchLineKey);
  const columnRegex = config.linelist?.linelistColumnRegex || '';
  const columnGroup = config.linelist?.linelistColumnGroup || 1;
  for (const row of rows) {
    const rawKey = _rowText(row, ['lineNo', 'lineKey', 'LineNo', 'Line No', 'PipelineReference']);
    const cleanKey = _xmlCiiNormalizeLineKey(_xmlCiiLineKeyRegexValue(rawKey, columnRegex, columnGroup));
    if (cleanKey && cleanKey === lookupKey) return row;
  }
  return null;
}

function _xmlCiiProcessValue(pdOverride, row, overrideKey, rowKeys) {
  if (pdOverride && Object.prototype.hasOwnProperty.call(pdOverride, overrideKey)) {
    return _toText(pdOverride[overrideKey]).trim();
  }
  return _rowText(row, rowKeys);
}

function _derivePipingClassFromBranchName(branchName, config) {
  const byRegex = _regexGroup(branchName, config.rating?.pipingClassRegex, config.rating?.pipingClassGroup || 1);
  if (byRegex) return byRegex;
  return tokenAtPosition(branchName, config.rating?.tokenDelimiter || '-', config.rating?.pipingClassTokenIndex || 5);
}

function _deriveRatingFromPipingClass(pipingClass, config) {
  const text = _toText(pipingClass).trim().toUpperCase();
  if (!text) return '';
  const sequence = Array.isArray(config.rating?.ratingSequence) ? config.rating.ratingSequence : [];
  for (const pair of sequence) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const prefix = _toText(pair[0]).toUpperCase();
    if (prefix && text.startsWith(prefix)) return _toText(pair[1]);
  }
  return '';
}

function _nominalDnFromNps(inches, config) {
  if (!Number.isFinite(inches)) return null;
  const map = config.weight?.npsToDn && typeof config.weight.npsToDn === 'object' ? config.weight.npsToDn : {};
  const key = String(Number(inches));
  const mapped = Number(map[key] ?? map[inches] ?? map[inches.toFixed(3)]);
  if (Number.isFinite(mapped)) return mapped;
  return inches * _toFiniteNumber(config.weight?.inchToMm, 25.4);
}

function _deriveBoreFromBranchName(branchName, config) {
  const raw = _regexGroup(branchName, config.weight?.boreRegex, config.weight?.boreGroup || 1)
    || tokenAtPosition(branchName, config.weight?.tokenDelimiter || '-', config.weight?.boreTokenIndex || 3);
  const inches = Number(_toText(raw).replace(/[^0-9.+-]/g, ''));
  return _nominalDnFromNps(inches, config);
}

function _fieldOverrideKey(editType, derivedKey) {
  return _toText(derivedKey).trim();
}

export function xmlCiiRenderPreviewPhase(xmlFile, config) {
  const llRows = Array.isArray(config.linelist?.masterRows) ? config.linelist.masterRows.length : 0;
  const pcRows = Array.isArray(config.pipingClass?.masterRows) ? config.pipingClass.masterRows.length : 0;

  if (!xmlFile) {
    return `
      <div class="model-converters-workflow-detail-title">4 Preview</div>
      <div class="model-converters-workflow-detail-note">
        ⚠ Load an XML file in the sidebar first, then return here to preview enrichment.
      </div>`;
  }
  if (!llRows && !pcRows) {
    return `
      <div class="model-converters-workflow-detail-title">4 Preview</div>
      <div class="model-converters-workflow-detail-note">
        ⚠ Import at least one master in 2 Import Masters, then return here.
      </div>`;
  }
  return `
    <div class="model-converters-workflow-detail-title">4 Preview</div>
    <div class="model-converters-workflow-detail-text">
      Dry-run enrichment per branch — editable overrides and group-wise fill-down.
    </div>
    <div id="mc-preview-table-host">
      <div class="model-converters-workflow-detail-note" style="text-align:center;padding:18px;">
        Loading preview...
      </div>
    </div>`;
}

export function xmlCiiDryRunPreview(xmlText, config, stagedJsonText) {
  if (typeof DOMParser === 'undefined') return { branchRows: [], nodeRows: [] };
  let document;
  try {
    document = new DOMParser().parseFromString(_toText(xmlText), 'application/xml');
    if (document.getElementsByTagName('parsererror').length) return { branchRows: [], nodeRows: [] };
  } catch { return { branchRows: [], nodeRows: [] }; }

  const branchRows = [];
  const nodeRows = [];

  const pipingClassIndex = buildPipingClassIndex(config.pipingClass?.masterRows || []);
  const stagedIndex = buildStagedDtxrIndex(stagedJsonText || '', config);
  const materialMap = config.material?.mapRows || [];

  for (const branch of [...document.getElementsByTagName('Branch')]) {
    const branchName = _xmlText(branch, 'Branchname');
    const lineKey = deriveLineKeyFromBranchName(branchName, config);
    const lineListMatch = lineKey ? _xmlCiiFindLineListRow(lineKey, config) : null;
    const derivedClassRaw = _derivePipingClassFromBranchName(branchName, config) || _rowText(lineListMatch, ['pipingClass', 'PipingClass']);
    const boreMm = _deriveBoreFromBranchName(branchName, config) || _rowNumber(lineListMatch, ['convertedBore', 'Bore']);

    const resolved = resolveBranchProcessData({
      branchName,
      lineKey,
      lineRow: lineListMatch,
      boreMm,
      componentType: 'PIPE',
      rating: _deriveRatingFromPipingClass(derivedClassRaw, config) || _rowText(lineListMatch, ['rating', 'Rating']),
      materialMap,
      pipingClassIndex,
      overrides: config.overrides || {},
      xmlNode: null,
      xmlBranch: branch,
      config
    });

    const branchRating = resolved.pipingClassMatchedRow?.rating || _deriveRatingFromPipingClass(resolved.pipingClass, config) || _rowText(lineListMatch, ['rating', 'Rating']);

    const pdOverride = (lineKey && config?.overrides?.processData?.[lineKey]) || {};
    const p1 = _xmlCiiProcessValue(pdOverride, lineListMatch, 'p1', ['p1']);
    const t1 = _xmlCiiProcessValue(pdOverride, lineListMatch, 't1', ['t1']);
    const t2 = _xmlCiiProcessValue(pdOverride, lineListMatch, 't2', ['t2']);
    const t3 = _xmlCiiProcessValue(pdOverride, lineListMatch, 't3', ['t3']);
    const density = _xmlCiiProcessValue(pdOverride, lineListMatch, 'density', ['density']);
    const p1Source = Object.prototype.hasOwnProperty.call(pdOverride, 'p1') ? 'override' : (p1 ? 'linelist' : 'none');
    const t1Source = Object.prototype.hasOwnProperty.call(pdOverride, 't1') ? 'override' : (t1 ? 'linelist' : 'none');
    const t2Source = Object.prototype.hasOwnProperty.call(pdOverride, 't2') ? 'override' : (t2 ? 'linelist' : 'none');
    const t3Source = Object.prototype.hasOwnProperty.call(pdOverride, 't3') ? 'override' : (t3 ? 'linelist' : 'none');
    const densitySource = Object.prototype.hasOwnProperty.call(pdOverride, 'density') ? 'override' : (density ? 'linelist' : 'none');

    const wallThickness = resolved.wallThicknessMm ? Number(resolved.wallThicknessMm.toPrecision(6)).toString() : '';

    let matMethod = 'none';
    if (resolved.materialSource === 'override') matMethod = 'override';
    else if (resolved.materialSource === 'line-list-material-map' || resolved.materialSource === 'piping-class-material-map') matMethod = 'exact';
    else if (resolved.materialSource === 'xml-fallback') matMethod = 'xml-fallback';

    branchRows.push({
      branchName,
      lineKey,
      lineMiss: !lineListMatch,
      size: boreMm != null ? `${boreMm}mm` : '',
      sizeMm: boreMm,
      pipingClass: resolved.pipingClass || '',
      pipingClassDerived: derivedClassRaw || '',
      pipingClassMethod: resolved.pipingClassMatchMethod,
      pipingClassConfidence: resolved.pipingClassConfidence,
      pipingClassNeedsReview: resolved.pipingClassNeedsReview,
      pipingClassCandidates: resolved.pipingClassCandidates || [],
      material: resolved.material || '',
      materialCode: resolved.materialCode || '',
      materialCodeMethod: matMethod,
      materialCodeNeedsReview: !resolved.materialCode && !!resolved.material,
      rating: branchRating || '',
      p1, t1, t2, t3, density,
      p1Source, t1Source, t2Source, t3Source, densitySource,
      wallThickness,
      corrosion: resolved.corrosionAllowanceMm != null ? String(resolved.corrosionAllowanceMm) : '',
    });

    let previousPosition = null;
    for (const node of _xmlChildrenByName(branch, 'Node')) {
      const positionText = _xmlText(node, 'Position');
      const lengthMm = previousPosition ? _pointDistanceMm(previousPosition, positionText) : null;
      const nodeNumber = _xmlText(node, 'NodeNumber');
      const componentType = _xmlText(node, 'ComponentType');
      const nodeNoNum = Number(nodeNumber);
      const isSkipType = /^(TEE|TEES|ELBO|ELBOW|OLET|BRANCH|DATUM|BEND|BENDS|GASK|GASKET|REDU|REDUCER)$/i.test(componentType);

      const dtxrRes = resolveXmlCiiNodeDtxr(node, stagedIndex, config);
      const dtxr = dtxrRes.value || '';
      const dtxrSource = dtxrRes.source || 'none';

      const candidates = (boreMm != null && branchRating && lengthMm != null)
        ? findAllWeightCandidates({ boreMm, rating: branchRating, lengthMm }, config)
        : [];
      if (nodeNoNum > 0 && !isSkipType && candidates.length) {
        nodeRows.push({
          branchName,
          nodeNumber,
          componentType,
          boreMm,
          rating: branchRating,
          lengthMm,
          dtxr,
          dtxrSource,
          weightMatch: candidates[0] || null,
          weightCandidates: candidates,
        });
      }
      previousPosition = positionText || previousPosition;
    }
  }
  return { branchRows, nodeRows };
}

export async function xmlCiiBuildAndRenderPreview(rootEl, xmlText, config, options = {}) {
  const {
    onSaveConfig,
    openOverridePopup,
    ensureOverrides,
    stagedJsonText
  } = options;
  const host = rootEl?.querySelector('#mc-preview-table-host');
  if (!host) return;

  const { branchRows, nodeRows } = xmlCiiDryRunPreview(xmlText, config, stagedJsonText);

  if (!branchRows.length) {
    host.innerHTML = '<div class="model-converters-workflow-detail-note">No branches found in XML.</div>';
    return;
  }

  const nodesByBranch = {};
  for (const nr of nodeRows) {
    (nodesByBranch[nr.branchName] = nodesByBranch[nr.branchName] || []).push(nr);
  }

  const table = new EditablePreviewTable({
    branchRows,
    nodesByBranch,
    matchBadgeHtmlRenderer: (method, confidence, needsReview, value, derived) => {
      const valEsc = _esc(value || '—');
      const derivedEsc = _esc(derived || '');
      if (method === 'override') {
        return `<span class="mc-preview-editable-val">${valEsc}</span> <span class="mc-preview-badge exact">✓ override</span>`;
      }
      if (method === 'exact') {
        return `<span class="mc-preview-editable-val">${valEsc}</span> <span class="mc-preview-badge exact">✓ exact</span>`;
      }
      if (method === 'startsWith' || method === 'leading-numeric-base' || method === 'prefix-base') {
        return `<span class="mc-preview-editable-val">${valEsc}</span> <span class="mc-preview-badge amber" title="Approximate match from ${derivedEsc}">approx</span>`;
      }
      if (method === 'fuzzy' || method === 'numeric-near') {
        const pct = confidence != null ? Math.round(confidence * 100) : null;
        const pctText = pct != null ? ` ${pct}%` : '';
        const badgeClass = needsReview ? 'orange' : 'amber';
        return `<span class="mc-preview-editable-val">${valEsc}</span> <span class="mc-preview-badge ${badgeClass}" title="Approximate match${pctText} to ${derivedEsc}">fuzzy${pctText}</span>`;
      }
      if (method === 'ambiguous' || method === 'ambiguous-approximate') {
        return `<span class="mc-preview-editable-val">—</span> <span class="mc-preview-badge bad" title="Ambiguous match for ${derivedEsc}">ambiguous</span>`;
      }
      if (needsReview) {
        return `<span class="mc-preview-editable-val">—</span> <span class="mc-preview-badge bad" title="No match for ${derivedEsc}">review</span>`;
      }
      return `<span class="mc-preview-editable-val">${valEsc}</span>`;
    },
    processInputHtmlRenderer: (fieldKey, lineKey, val, src, ri) => {
      const cellClass = src === 'override'
        ? 'mc-preview-pd-cell mc-preview-pd-override'
        : (src === 'linelist' ? 'mc-preview-pd-cell mc-preview-pd-linelist' : 'mc-preview-pd-cell mc-preview-pd-empty');
      const placeholder = fieldKey === 'p1' ? 'P1' : (fieldKey === 't1' ? 'T1' : (fieldKey === 't2' ? 'T2' : (fieldKey === 't3' ? 'T3' : 'density')));
      return `
        <div class="${cellClass}">
          <input type="text" class="mc-preview-pd-input" value="${_esc(val)}"
                 placeholder="${placeholder}"
                 data-mc-pd-field="${_esc(fieldKey)}"
                 data-mc-pd-linekey="${_esc(lineKey)}"
                 data-mc-pd-row="${ri}">
          <button type="button" class="mc-preview-filldown-btn mc-pd-filldown"
                  data-mc-fill-field="${_esc(fieldKey)}"
                  data-mc-fill-from="${ri}" title="Group-wise fill down: blanks/auto-filled cells only, stop at next manual value">↓</button>
        </div>
      `;
    },
    onCellEditClick: ({ editType, derivedKey, currentVal, rowIndex, td }) => {
      openOverridePopup({ editType, derivedKey, currentVal, config, onSave: (newVal) => {
        const overrides = ensureOverrides(config);
        if (editType === 'pipingClass') overrides.pipingClass = { ...overrides.pipingClass, [derivedKey]: newVal };
        else if (editType === 'materialCode') overrides.material = { ...overrides.material, [derivedKey]: newVal };

        markPreviewOverrideManual({
          config,
          ensureOverrides,
          field: editType,
          key: _fieldOverrideKey(editType, derivedKey),
          value: newVal,
        });

        onSaveConfig(config);
        const valSpan = td.querySelector('.mc-preview-editable-val');
        if (valSpan) valSpan.textContent = newVal;
        const badge = td.querySelector('.mc-preview-badge');
        if (badge) { badge.textContent = '✓ override'; badge.className = 'mc-preview-badge exact'; }
      }});
    },
    onFillDownClick: ({ field, fromRow, currentVal }) => {
      const filled = applyPreviewOverrideFillDown({
        host,
        config,
        ensureOverrides,
        field,
        fromRow,
        currentValue: currentVal,
      });
      if (filled > 0) onSaveConfig(config);
    },
    onProcessInputChange: ({ field, fieldKey, lineKey, value, input }) => {
      const overrides = ensureOverrides(config);
      if (!overrides.processData) overrides.processData = {};
      if (!overrides.processData[lineKey]) overrides.processData[lineKey] = {};
      const cleanVal = _toText(value).trim();
      const actualField = field || fieldKey;
      if (cleanVal === '') delete overrides.processData[lineKey][actualField];
      else overrides.processData[lineKey][actualField] = cleanVal;
      if (Object.keys(overrides.processData[lineKey]).length === 0) delete overrides.processData[lineKey];

      markPreviewProcessManual({
        config,
        ensureOverrides,
        field: actualField,
        lineKey,
        value: cleanVal,
      });

      onSaveConfig(config);
      const cell = input.closest('.mc-preview-pd-cell');
      if (cell) {
        cell.className = cleanVal ? 'mc-preview-pd-cell mc-preview-pd-override' : 'mc-preview-pd-cell mc-preview-pd-empty';
      }
    },
    onProcessFillDownClick: ({ fieldKey, fromRow, value }) => {
      const filled = applyPreviewProcessFillDown({
        host,
        config,
        ensureOverrides,
        field: fieldKey,
        fromRow,
        currentValue: value,
      });
      if (filled > 0) onSaveConfig(config);
    }
  });

  host.innerHTML = table.renderHTML();
  table.bind(host);
}
