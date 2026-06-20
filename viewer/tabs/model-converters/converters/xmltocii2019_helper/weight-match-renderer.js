import { collectXmlCiiWeightMatchRows } from '../../../../converters/xml-cii2019-core/weight-match-model.js?v=20260620-weight-fallback-1';
import {
  ensureValveHintConfig,
  formatValveHint,
  rankXmlCiiWeightCandidates,
  valveHintLengthToleranceMm,
  valveHintMappingRows,
} from '../../../../converters/xml-cii2019-core/weight-valve-hints.js?v=20260620-weight-fallback-1';
import { getXmlCiiPreviewRuntimeConfig } from '../../shared/preview-filldown.js?v=20260620-rating-runtime-1';

function t(value) { return value === null || value === undefined ? '' : String(value); }
function clean(value) { return t(value).replace(/\s+/g, ' ').trim(); }
function esc(value) { return t(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function attr(value) { return esc(value).replaceAll("'", '&#39;'); }
function nfmt(value, digits = 1) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric.toFixed(digits) : ''; }
function desc(candidate) { return clean(candidate?.typeDesc || candidate?.valveType || candidate?.type || 'Unknown') || 'Unknown'; }
function selectedWeight(candidate) { return candidate?.selectedWeight ?? candidate?.suggestedWeight ?? candidate?.weight ?? ''; }
function convOn(config) { return config?.weight?.convertSmallLengthsInToMm === true; }
function allowedType(value) { const type = clean(value).toUpperCase(); return type === 'RIGID' || type.startsWith('FLAN') || ['VALV', 'VALVE', 'VLV'].includes(type); }
function unsafeDtxr(row) { const source = clean(row?.dtxrSource).toLowerCase(); const dtxr = clean(row?.dtxr).toUpperCase(); return /owner|support|ps-tag/.test(source) && /(PIPE REST|SUPPORT|GUIDE|STOP|SHOE|WEAR PLATE|TEE|ELBOW|BEND|REDUCER)/.test(dtxr); }
function cleanRow(row) { if (!allowedType(row?.componentType)) return null; return unsafeDtxr(row) ? { ...row, dtxr: '', dtxrSource: 'weight-dtxr-suppressed' } : row; }
async function stagedText(stagedJsonText) { const direct = clean(stagedJsonText); if (direct) return direct; const file = document?.querySelector?.('#model-converters-secondary-input')?.files?.[0]; return file ? await file.text().catch(() => '') : ''; }
function currentXmlFile(passedFile) { return passedFile || document?.querySelector?.('#model-converters-primary-input')?.files?.[0] || null; }

function parseConfigText(value) {
  try {
    const parsed = JSON.parse(clean(value) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function currentDomSupportConfig() {
  const input = document?.querySelector?.('[data-option-key="supportConfigJson"]');
  return input && 'value' in input ? parseConfigText(input.value) : {};
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergeSection(out, live, sectionName, rowsKey) {
  const liveSection = plainObject(live?.[sectionName]) ? live[sectionName] : null;
  if (!liveSection) return;
  const outSection = plainObject(out?.[sectionName]) ? out[sectionName] : {};
  out[sectionName] = { ...liveSection, ...outSection };
  const liveRows = Array.isArray(liveSection[rowsKey]) ? liveSection[rowsKey] : [];
  const outRows = Array.isArray(outSection[rowsKey]) ? outSection[rowsKey] : [];
  if (liveRows.length && !outRows.length) out[sectionName][rowsKey] = liveRows;
  if (plainObject(liveSection.fieldMap) && !plainObject(outSection.fieldMap)) out[sectionName].fieldMap = liveSection.fieldMap;
}

function mergeRuntimeOverrides(baseConfig, liveConfig) {
  const out = { ...(baseConfig || {}) };
  const live = plainObject(liveConfig) ? liveConfig : {};
  mergeSection(out, live, 'linelist', 'masterRows');
  mergeSection(out, live, 'pipingClass', 'masterRows');
  mergeSection(out, live, 'material', 'mapRows');
  mergeSection(out, live, 'weight', 'masterRows');
  const liveOverrides = live.overrides && typeof live.overrides === 'object' && !Array.isArray(live.overrides)
    ? live.overrides
    : {};
  if (Object.keys(liveOverrides).length) {
    out.overrides = out.overrides && typeof out.overrides === 'object' && !Array.isArray(out.overrides) ? { ...out.overrides } : {};
    for (const [bucketName, bucketValue] of Object.entries(liveOverrides)) {
      if (bucketValue && typeof bucketValue === 'object' && !Array.isArray(bucketValue)) {
        out.overrides[bucketName] = { ...(out.overrides[bucketName] || {}), ...bucketValue };
      } else if (clean(bucketValue)) {
        out.overrides[bucketName] = bucketValue;
      }
    }
  }
  if (clean(live?.rating?.defaultRating)) out.rating = { ...(out.rating || {}), defaultRating: clean(live.rating.defaultRating) };
  return out;
}

function overrideValue(config, bucketName, keys) {
  const bucket = config?.overrides?.[bucketName];
  if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) return '';
  for (const key of keys.filter(Boolean)) {
    const value = bucket[key];
    if (clean(value)) return clean(value);
  }
  return '';
}

function processRating(config, keys) {
  const bucket = config?.overrides?.processData;
  if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) return '';
  for (const key of keys.filter(Boolean)) {
    const value = bucket[key]?.rating;
    if (clean(value)) return clean(value);
  }
  return '';
}

function ratingFromConfig(row, config) {
  const keys = [row?.lineKey, row?.branchName, row?.requestedPipingClass, row?.resolvedPipingClass, row?.nodeNumber];
  return overrideValue(config, 'rating', keys)
    || processRating(config, keys)
    || clean(row?.rating)
    || clean(config?.rating?.defaultRating || config?.defaultRating);
}

function rerankWithRating(row, config) {
  const rating = ratingFromConfig(row, config);
  const ranking = rankXmlCiiWeightCandidates({
    boreMm: row.boreMm,
    rating,
    lengthMm: row.lengthMm,
    nodeName: row.nodeName,
    componentType: row.componentType,
    componentRefNo: row.componentRefNo,
    dtxr: row.dtxr,
  }, config, { includeRejected: true });
  return {
    ...row,
    rating,
    valveHint: formatValveHint(ranking.nodeHint),
    nodeHint: ranking.nodeHint,
    candidates: ranking.candidates.slice(0, 5),
    rejectedCandidates: ranking.rejectedCandidates.slice(0, 3),
    ranking,
  };
}

function helpText(config) {
  return [
    'Rows included: only RIGID, FLAN*, VALV / VALVE / VLV.',
    'Rows excluded: support-only, TEE, ELBO/BEND, REDUCER, OLET, PIPE, GASK.',
    `Length rule: master length must be within ±${valveHintLengthToleranceMm(config)} mm of XML ElementLengthMm.`,
    'Rating is read from line list / manual override / processData / Preview runtime cache before candidate ranking.',
  ].join('\n');
}

function hintRows(config) {
  return valveHintMappingRows(config).map((row, index) => `<tr><td><input type="checkbox" data-hint-i="${index}" data-hint-f="on" ${row.on ? 'checked' : ''}></td><td><input type="number" data-hint-i="${index}" data-hint-f="priority" value="${attr(row.priority)}"></td><td><input data-hint-i="${index}" data-hint-f="code" value="${attr(row.code)}"></td><td><input data-hint-i="${index}" data-hint-f="label" value="${attr(row.label)}"></td><td><input data-hint-i="${index}" data-hint-f="nodeNameRegex" value="${attr(row.nodeNameRegex)}"></td><td><input data-hint-i="${index}" data-hint-f="masterRegex" value="${attr(row.masterRegex)}"></td></tr>`).join('');
}

function hintPanel(config) {
  ensureValveHintConfig(config);
  const on = config.weight.useNodeNameValveHints !== false;
  const tolerance = valveHintLengthToleranceMm(config);
  return `<style>.mc-wm-rules-card{margin:10px 0;padding:10px;background:#0c1520;border:1px solid #243247;border-radius:8px}.mc-wm-rules-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin-top:10px}.mc-wm-rules-grid label{display:flex;align-items:center;gap:7px;min-width:0;color:#d7e6ff;font-size:12px}.mc-wm-rules-grid input[type="number"]{width:76px;min-width:0;background:#182334;color:#e6edf5;border:1px solid #31455f;border-radius:6px;padding:4px 6px}.mc-wm-hint-table-wrap{margin-top:10px;overflow:auto;max-height:180px;border:1px solid #243247;border-radius:8px}.mc-wm-hint-table{border-collapse:collapse;font-size:11px;min-width:760px;width:100%}.mc-wm-hint-table th,.mc-wm-hint-table td{padding:4px 5px;border-bottom:1px solid #243247;color:#d7e6ff;white-space:nowrap}.mc-wm-hint-table input{box-sizing:border-box;min-width:64px;max-width:210px;background:#182334;color:#e6edf5;border:1px solid #31455f;border-radius:5px;padding:3px 5px}.mc-wm-chip-rejected{opacity:.72;border-style:dashed!important;cursor:not-allowed!important}.mc-wm-rejected-label{font-size:11px;font-weight:700;opacity:.75;color:#f5c96a;align-self:center}</style><section class="mc-wm-rules-card"><div style="display:flex;justify-content:space-between;gap:10px;"><div><div style="color:#9cc5ff;font-weight:700;font-size:13px;">Valve Hint / TypeDesc Ranking Rules</div><div style="margin-top:3px;color:#9aa8ba;font-size:12px;line-height:1.35;white-space:pre-line;">${esc(helpText(config))}</div></div></div><div class="mc-wm-rules-grid"><label><input type="checkbox" id="mc-wm-use-valve-hints" ${on ? 'checked' : ''}> Use NodeName valve hint</label><label>Length tolerance ± <input type="number" id="mc-wm-valve-tol" min="0" step="0.1" value="${attr(tolerance)}"> mm</label><label><input type="checkbox" id="mc-wm-use-extrapolation" ${config.weight.useWeightExtrapolation === false ? '' : 'checked'}> Use weight extrapolation</label></div><div class="mc-wm-hint-table-wrap"><table class="mc-wm-hint-table"><thead><tr><th>On</th><th>Priority</th><th>Code</th><th>Label</th><th>NodeName Regex</th><th>Master Regex</th></tr></thead><tbody>${hintRows(config)}</tbody></table></div></section>`;
}

function renderAcceptedChip(candidate, rowIndex, issue) {
  const value = selectedWeight(candidate);
  const label = desc(candidate);
  const title = [`Rating: ${issue.rating || '-'}`, `TypeDesc: ${label}`, `Selected weight: ${value} kg`, `Length delta: ${nfmt(candidate.lengthDelta)} mm`, candidate?.weightWarning || ''].filter(Boolean).join(' | ');
  const marker = candidate?.inferredWeight ? '≈ ' : (candidate.preferred ? '★ ' : '');
  const method = candidate?.weightMethod === 'length-interpolated' ? ' · Interpolated' : (candidate?.weightMethod === 'length-extrapolated' && candidate?.inferredWeight ? ' · Extrapolated' : (candidate?.zeroFallback ? ' · No match' : ` · Δ${esc(nfmt(candidate.lengthDelta))}`));
  return `<button type="button" class="mc-rigid-review-candidate${candidate.preferred ? ' best' : ''}" data-wm-candidate="${rowIndex}" data-wm-weight="${attr(value)}" title="${attr(title)}" style="font-size:11px;line-height:1.1;padding:3px 6px;border-radius:999px;white-space:nowrap;max-width:330px;overflow:hidden;text-overflow:ellipsis;${candidate?.zeroFallback ? 'background:#3a1010;border:1px solid #ef4444;color:#ffd6d6;' : (candidate?.inferredWeight ? 'background:#3a2a08;border:1px solid #d9a441;color:#ffe7a3;' : '')}">${marker}${esc(value)}kg${method}</button>`;
}

function renderRejectedChip(candidate) {
  return `<span class="mc-rigid-review-candidate mc-wm-chip-rejected" title="${attr(candidate.rejectedReason || '')}" style="font-size:11px;line-height:1.1;padding:3px 6px;border-radius:999px;white-space:nowrap;max-width:330px;overflow:hidden;text-overflow:ellipsis;">× ${esc(desc(candidate))} · Δ${esc(nfmt(candidate.lengthDelta))}mm</span>`;
}

export function xmlCiiRenderWeightMatchPhase() {
  const info = 'Length gate is mandatory. Rating is resolved before nearest-weight candidate ranking.';
  return `<div class="model-converters-workflow-detail-title">5 Weight Match <span title="${attr(info)}" style="cursor:help;color:#8bb7ff;border:1px solid #406089;border-radius:50%;padding:0 5px;font-size:11px;">i</span></div><div class="model-converters-workflow-detail-text">Approximate component weights from the valve weight master. Manual rating overrides are applied before candidate ranking.</div><div id="mc-wm-hint-panel"></div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0;"><button type="button" class="model-converters-download-btn" id="mc-wm-refresh">↻ Recompute matches</button><button type="button" class="model-converters-download-btn" id="mc-wm-fill-best">Use all ★ preferred</button><button type="button" class="model-converters-download-btn" id="mc-wm-length-toggle" title="Convert small master lengths (<100) from inch to mm. Default OFF.">⇄ in→mm: OFF</button><span id="mc-wm-status" class="mc-diag-run-status"></span></div><div id="mc-wm-content"><div class="model-converters-workflow-detail-note">Computing weight matches…</div></div>`;
}

export function bindXmlCiiWeightMatchPhase(detailEl, { xmlFile, stagedJsonText, config, enrichXmlForCii2019, onSaveConfig, ensureOverrides }) {
  if (!detailEl) return;
  const contentEl = detailEl.querySelector('#mc-wm-content');
  const statusEl = detailEl.querySelector('#mc-wm-status');
  const toggleEl = detailEl.querySelector('#mc-wm-length-toggle');
  const panelEl = detailEl.querySelector('#mc-wm-hint-panel');
  if (!contentEl) return;
  let localIssues = [];
  const status = (message, tone) => { if (statusEl) { statusEl.textContent = message || ''; statusEl.className = `mc-diag-run-status ${tone || ''}`.trim(); } };
  const activeConfig = () => mergeRuntimeOverrides(mergeRuntimeOverrides(mergeRuntimeOverrides(config, currentDomSupportConfig()), getXmlCiiPreviewRuntimeConfig()), currentDomSupportConfig());
  const syncToggle = () => { if (!toggleEl) return; const on = convOn(activeConfig()); toggleEl.textContent = `⇄ in→mm: ${on ? 'ON' : 'OFF'}`; toggleEl.style.borderColor = on ? '#2f9e63' : ''; toggleEl.style.color = on ? '#fff' : ''; toggleEl.style.background = on ? '#14532d' : ''; };
  const drawPanel = () => { if (panelEl) panelEl.innerHTML = hintPanel(activeConfig()); };
  const drawRows = (issues) => {
    if (!issues.length) { contentEl.innerHTML = '<div class="model-converters-workflow-detail-note">No actual RIGID / FLAN* / VALVE nodes with ElementLengthMm &gt; 6 mm were found.</div>'; return; }
    const rows = issues.map((issue, rowIndex) => {
      const best = issue.candidates?.[0];
      const initial = issue.weight && issue.weight > 0 ? issue.weight : (best ? selectedWeight(best) : '');
      const rowStyle = issue.mapped ? 'background:#0f2a1b;border-left:4px solid #2f9e63;' : (best?.zeroFallback ? 'background:#3a1010;border-left:4px solid #ef4444;' : (best?.inferredWeight ? 'background:#302607;border-left:4px solid #d9a441;' : 'background:#3a240f;border-left:4px solid #d08a22;'));
      const inputStyle = `width:86px;${best?.zeroFallback ? 'background:#3a1010;border:1px solid #ef4444;color:#ffd6d6;' : (best?.inferredWeight ? 'background:#352706;border:1px solid #d9a441;color:#fff1b8;' : '')}`;
      const accepted = (issue.candidates || []).map((candidate) => renderAcceptedChip(candidate, rowIndex, issue)).join('');
      const rejected = (issue.rejectedCandidates || []).map(renderRejectedChip).join('');
      const rejectedBlock = rejected ? `<span class="mc-wm-rejected-label">Rejected by length</span>${rejected}` : '';
      const chips = accepted || rejectedBlock || '<span class="model-converters-muted">No suggestion</span>';
      const statusText = issue.mapped ? `Mapped (${issue.weightSource || 'weight'})` : (best?.zeroFallback ? 'Zero fallback' : (best?.inferredWeight ? (best.weightMethod === 'length-interpolated' ? 'Interpolated' : 'Extrapolated') : (best?.preferred ? 'Suggested' : 'Unresolved')));
      return `<tr style="${rowStyle}"><td>${esc(statusText)}</td><td title="${attr(issue.branchName)}">${esc(issue.branchName)}</td><td>${esc(issue.lineKey || '')}</td><td>${esc(issue.componentType || '')}</td><td>${esc(issue.boreMm == null ? '' : `${Number(issue.boreMm).toFixed(0)} mm`)}</td><td>${esc(issue.rating || '')}</td><td>${esc(issue.nodeNumber)}</td><td title="${attr([issue.dtxrSource, issue.dtxrMatchedKey, issue.dtxrSuppressionReason].filter(Boolean).join(' · '))}">${esc(issue.dtxr || 'Not found')}</td><td>${esc(issue.valveHint || '—')}</td><td title="${attr(issue.elementLengthSource || '')}">${esc(issue.lengthMm == null ? '' : `${Number(issue.lengthMm).toFixed(1)} mm`)}</td><td><input type="number" min="0" step="0.001" class="mc-rigid-review-input" data-wm-key="${attr(issue.key)}" value="${attr(initial)}" placeholder="kg" style="${inputStyle}"></td><td style="max-width:540px;"><div style="display:flex;flex-wrap:wrap;gap:4px;max-height:72px;overflow:auto;align-items:flex-start;">${chips}</div></td></tr>`;
    }).join('');
    const cfg = activeConfig();
    contentEl.innerHTML = `<div class="model-converters-workflow-detail-note" style="margin-bottom:8px;">Exact candidate length gate is ±${nfmt(valveHintLengthToleranceMm(cfg))} mm. If no exact candidate exists, same Bore + Rating interpolation/extrapolation is used; if no same Bore/Rating rows exist, the box is red 0. Length conversion is ${convOn(cfg) ? 'ON' : 'OFF'}.</div><div class="mc-rigid-review-table-wrap" style="overflow:auto;max-height:48vh;"><table class="mc-rigid-review-table" style="border-collapse:collapse;font-size:12px;"><thead><tr><th>Status</th><th>Branch</th><th>Line Key</th><th>Type</th><th>Bore</th><th>Rating</th><th>Node</th><th>DTXR</th><th>Valve Hint</th><th>Length</th><th>Weight (kg)</th><th>Nearest Suggestions</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    contentEl.querySelectorAll('[data-wm-candidate]').forEach((button) => button.addEventListener('click', () => { const input = contentEl.querySelectorAll('.mc-rigid-review-input')[Number(button.dataset.wmCandidate)]; if (!input) return; input.value = button.dataset.wmWeight || ''; input.dispatchEvent(new Event('change', { bubbles: true })); }));
  };
  const compute = async () => {
    const liveConfig = activeConfig();
    syncToggle(); drawPanel();
    const file = currentXmlFile(xmlFile);
    if (!file) { localIssues = []; contentEl.innerHTML = '<div class="model-converters-workflow-detail-note">No XML source loaded. Import an XML file first.</div>'; status('No input', 'bad'); return; }
    status('Computing…');
    try {
      const xmlText = await file.text();
      const jsonText = await stagedText(stagedJsonText);
      const enriched = await enrichXmlForCii2019(xmlText, jsonText, { dryRun: true, skipAutoWeightMatch: true });
      const cfg = mergeRuntimeOverrides(mergeRuntimeOverrides(enriched.config || liveConfig, liveConfig), getXmlCiiPreviewRuntimeConfig());
      localIssues = collectXmlCiiWeightMatchRows(xmlText, jsonText, cfg).map(cleanRow).filter(Boolean).map((row) => rerankWithRating(row, cfg));
      const mapped = localIssues.filter((row) => row.mapped).length;
      const suggested = localIssues.filter((row) => row.candidates?.[0]?.preferred).length;
      const inferred = localIssues.filter((row) => row.candidates?.[0]?.inferredWeight && !row.candidates?.[0]?.zeroFallback).length;
      const zero = localIssues.filter((row) => row.candidates?.[0]?.zeroFallback).length;
      const unresolved = localIssues.length - mapped - suggested - inferred - zero;
      status(`${mapped} mapped · ${suggested} exact · ${inferred} inferred · ${zero} zero fallback · ${unresolved} unresolved · ${localIssues.length} shown`, (zero || unresolved) ? 'bad' : 'ok');
      drawRows(localIssues);
    } catch (error) {
      localIssues = [];
      contentEl.innerHTML = `<div class="model-converters-workflow-detail-note">Could not compute weight matches: ${esc(error?.message || error)}</div>`;
      status('Error', 'bad');
    }
  };
  detailEl.querySelector('#mc-wm-refresh')?.addEventListener('click', compute);
  toggleEl?.addEventListener('click', () => { const cfg = activeConfig(); cfg.weight = cfg.weight && typeof cfg.weight === 'object' ? cfg.weight : {}; cfg.weight.convertSmallLengthsInToMm = cfg.weight.convertSmallLengthsInToMm !== true; onSaveConfig(cfg); void compute(); });
  detailEl.querySelector('#mc-wm-fill-best')?.addEventListener('click', () => { contentEl.querySelectorAll('.mc-rigid-review-input').forEach((input, index) => { const best = localIssues[index]?.candidates?.[0]; if (!best || Number(selectedWeight(best)) <= 0) return; input.value = String(selectedWeight(best)); input.dispatchEvent(new Event('change', { bubbles: true })); }); });
  panelEl?.addEventListener('change', (event) => { const cfg = activeConfig(); ensureValveHintConfig(cfg); const use = event.target.closest?.('#mc-wm-use-valve-hints'); if (use) cfg.weight.useNodeNameValveHints = use.checked; const tolerance = event.target.closest?.('#mc-wm-valve-tol'); if (tolerance) cfg.weight.valveHintLengthToleranceMm = Math.max(0, Number(tolerance.value) || 0); const extrapolate = event.target.closest?.('#mc-wm-use-extrapolation'); if (extrapolate) cfg.weight.useWeightExtrapolation = extrapolate.checked; const input = event.target.closest?.('[data-hint-i]'); if (input) { const rows = valveHintMappingRows(cfg); const row = rows[Number(input.dataset.hintI)]; if (row) { const field = input.dataset.hintF; if (field === 'on') row.on = input.checked; else if (field === 'priority') row.priority = Number(input.value) || row.priority; else row[field] = input.value; cfg.weight.valveHintMapping = rows; } } onSaveConfig(cfg); void compute(); });
  contentEl.addEventListener('change', (event) => { const input = event.target.closest?.('.mc-rigid-review-input'); if (!input) return; const key = input.getAttribute('data-wm-key') || ''; const value = Number(input.value); if (!key || !Number.isFinite(value) || value <= 0) return; const cfg = activeConfig(); const overrides = ensureOverrides(cfg); overrides.rigidWeight = { ...(overrides.rigidWeight || {}), [key]: value }; onSaveConfig(cfg); });
  syncToggle(); drawPanel(); void compute();
}
