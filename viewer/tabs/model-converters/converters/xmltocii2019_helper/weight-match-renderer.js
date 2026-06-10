import { collectXmlCiiWeightMatchRows } from '../../../../converters/xml-cii2019-core/weight-match-model.js';

function _toText(val) {
  if (val === null || val === undefined) return '';
  return String(val);
}

function _esc(value) {
  return _toText(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function _escAttr(value) {
  return _esc(value).replaceAll("'", '&#39;');
}

function _fmtNum(value, digits = 1) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(digits) : '';
}

function _typeDesc(candidate) {
  return _toText(candidate?.typeDesc || candidate?.valveType || candidate?.type || 'Unknown').trim() || 'Unknown';
}

function _conversionEnabled(config) {
  return config?.weight?.convertSmallLengthsInToMm === true;
}

async function _resolveStagedJsonText(stagedJsonText) {
  const direct = _toText(stagedJsonText).trim();
  if (direct) return direct;
  if (typeof document === 'undefined') return '';
  const fileInput = document.querySelector('#model-converters-secondary-input');
  const file = fileInput?.files?.[0];
  if (!file) return '';
  try {
    return await file.text();
  } catch {
    return '';
  }
}

function _mergeDtxrFromRawRows(enrichedRows, rawRows) {
  const byKey = new Map((rawRows || []).map((row) => [row.key, row]));
  return (enrichedRows || []).map((row) => {
    if (_toText(row.dtxr).trim() && row.dtxr !== 'Not found') return row;
    const raw = byKey.get(row.key);
    if (!_toText(raw?.dtxr).trim()) return row;
    return {
      ...row,
      dtxr: raw.dtxr,
      dtxrSource: raw.dtxrSource || row.dtxrSource,
      dtxrMatchedKey: raw.dtxrMatchedKey || row.dtxrMatchedKey,
    };
  });
}

export function xmlCiiRenderWeightMatchPhase() {
  const info = 'Shows all XML nodes where ComponentType/NodeName/DTXR indicates RIGID, FLAN*, or VALVE/VLV and ElementLengthMm > 6 mm. Green rows already have XML/override weight; amber rows still need a weight decision. Length conversion is OFF by default; use ⇄ in→mm only for masters that explicitly store small face-to-face lengths in inches.';
  return `
    <div class="model-converters-workflow-detail-title">5 Weight Match <span title="${_escAttr(info)}" style="cursor:help;color:#8bb7ff;border:1px solid #406089;border-radius:50%;padding:0 5px;font-size:11px;">i</span></div>
    <div class="model-converters-workflow-detail-text">
      Approximate component weights matched from the valve weight master by
      <strong>rating</strong> (×3), <strong>bore</strong> (×2), and <strong>length</strong> (×1).
      DTXR is resolved from XML <strong>DTXR_POS</strong> / <strong>DTXR_PS</strong> first, then staged JSON by OWNER/Branchname, ComponentRefNo, PS tag, node and coordinates.
      Review and adjust; final conversion is launched from <strong>6 Run</strong>.
    </div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0;">
      <button type="button" class="model-converters-download-btn" id="mc-wm-refresh">↻ Recompute matches</button>
      <button type="button" class="model-converters-download-btn" id="mc-wm-fill-best">Use all ★ preferred</button>
      <button type="button" class="model-converters-download-btn" id="mc-wm-length-toggle" title="Convert small master lengths (<100) from inch to mm. Default OFF. Use only when this weight master stores small lengths in inches.">⇄ in→mm: OFF</button>
      <span style="display:inline-flex;align-items:center;gap:4px;color:#fff;font-weight:600;"><span style="width:12px;height:12px;background:#123c25;border:1px solid #2f9e63;border-radius:3px;"></span>Mapped</span>
      <span style="display:inline-flex;align-items:center;gap:4px;color:#fff;font-weight:600;"><span style="width:12px;height:12px;background:#4a2d12;border:1px solid #d08a22;border-radius:3px;"></span>Unresolved</span>
      <span id="mc-wm-status" class="mc-diag-run-status"></span>
    </div>
    <div id="mc-wm-content"><div class="model-converters-workflow-detail-note">Computing weight matches…</div></div>`;
}

export function bindXmlCiiWeightMatchPhase(detailEl, { xmlFile, stagedJsonText, config, enrichXmlForCii2019, onSaveConfig, ensureOverrides }) {
  if (!detailEl) return;
  const contentEl = detailEl.querySelector('#mc-wm-content');
  const statusEl = detailEl.querySelector('#mc-wm-status');
  const lengthToggleEl = detailEl.querySelector('#mc-wm-length-toggle');
  const setStatus = (msg, tone) => {
    if (statusEl) {
      statusEl.textContent = msg || '';
      statusEl.className = `mc-diag-run-status ${tone || ''}`.trim();
    }
  };
  const syncLengthToggle = () => {
    if (!lengthToggleEl) return;
    const on = _conversionEnabled(config);
    lengthToggleEl.textContent = `⇄ in→mm: ${on ? 'ON' : 'OFF'}`;
    lengthToggleEl.style.borderColor = on ? '#2f9e63' : '';
    lengthToggleEl.style.color = on ? '#ffffff' : '';
    lengthToggleEl.style.background = on ? '#14532d' : '';
  };
  if (!contentEl) return;
  let localIssues = [];

  const renderIssues = (issues) => {
    if (!issues.length) {
      contentEl.innerHTML = '<div class="model-converters-workflow-detail-note">No RIGID / FLAN* / VALVE nodes with ElementLengthMm &gt; 6 mm were found. Use 6 Run to generate the CII.</div>';
      return;
    }
    const rowsHtml = issues.map((issue, index) => {
      const best = issue.candidates?.[0] || null;
      const initialWeight = issue.weight && issue.weight > 0 ? issue.weight : (best ? (best.suggestedWeight ?? best.weight) : '');
      const rowStyle = issue.mapped
        ? 'background:#0f2a1b;border-left:4px solid #2f9e63;'
        : 'background:#3a240f;border-left:4px solid #d08a22;';
      const statusText = issue.mapped ? `Mapped (${issue.weightSource || 'weight'})` : 'Unresolved';
      const candidates = (issue.candidates || []).map((candidate) => {
        const value = candidate.suggestedWeight ?? candidate.weight;
        const desc = _typeDesc(candidate);
        const title = [
          `Type: ${candidate.type || candidate.valveType || '-'}`,
          `TypeDesc: ${desc}`,
          candidate.preferred ? 'Preferred: exact bore/rating, length-scaled' : '',
          `Bore: ${candidate.rowBore}`,
          `Rating: ${candidate.rowRating || '-'}`,
          `Master length: ${_fmtNum(candidate.rowLength)}`,
          `Delta length: ${_fmtNum(candidate.lengthDelta)}`,
          `Score: ${Math.round(candidate.score * 100)}%`,
        ].filter(Boolean).join(' | ');
        return `
          <button type="button" class="mc-rigid-review-candidate${candidate.preferred ? ' best' : ''}"
            data-wm-candidate="${index}" data-wm-weight="${_escAttr(value)}"
            title="${_escAttr(title)}"
            style="font-size:11px;line-height:1.1;padding:3px 6px;border-radius:999px;white-space:nowrap;max-width:280px;overflow:hidden;text-overflow:ellipsis;">
            ${candidate.preferred ? '★ ' : ''}${_esc(desc)} · ${_esc(value)}kg · Δ${_esc(_fmtNum(candidate.lengthDelta))}
          </button>`;
      }).join('');
      const ratingTitle = `Piping Class ${issue.resolvedPipingClass || ''} (${issue.pipingClassMatchMethod || ''})`;
      const dtxrTitle = [issue.dtxrSource, issue.dtxrMatchedKey].filter(Boolean).join(' · ');
      return `
        <tr style="${rowStyle}">
          <td style="padding:4px 6px;line-height:1.2;">${_esc(statusText)}</td>
          <td class="mc-rigid-review-branch" style="padding:4px 6px;line-height:1.2;" title="${_escAttr(issue.branchName)}">${_esc(issue.branchName)}</td>
          <td style="padding:4px 6px;line-height:1.2;">${_esc(issue.componentType || '')}</td>
          <td style="padding:4px 6px;line-height:1.2;">${_esc(issue.boreMm == null ? '' : `${Number(issue.boreMm).toFixed(0)} mm`)}</td>
          <td style="padding:4px 6px;line-height:1.2;" title="${_escAttr(ratingTitle)}">${_esc(issue.rating || '')}</td>
          <td style="padding:4px 6px;line-height:1.2;">${_esc(issue.nodeNumber)}</td>
          <td class="mc-rigid-review-dtxr" style="padding:4px 6px;line-height:1.2;" title="${_escAttr(dtxrTitle)}">${_esc(issue.dtxr || 'Not found')}</td>
          <td style="padding:4px 6px;line-height:1.2;" title="${_escAttr(issue.elementLengthSource || '')}">${_esc(issue.lengthMm == null ? '' : `${Number(issue.lengthMm).toFixed(1)} mm`)}</td>
          <td style="padding:4px 6px;line-height:1.2;"><input type="number" min="0" step="0.001" class="mc-rigid-review-input" data-wm-key="${_escAttr(issue.key)}" value="${_escAttr(initialWeight)}" placeholder="kg" style="width:86px;"></td>
          <td class="mc-rigid-review-candidates" style="padding:4px 6px;line-height:1.2;max-width:430px;">
            <div style="display:flex;flex-wrap:wrap;gap:4px;max-height:46px;overflow:auto;align-items:flex-start;">${candidates || '<span class="model-converters-muted">No suggestion</span>'}</div>
          </td>
        </tr>`;
    }).join('');
    contentEl.innerHTML = `
      <div class="model-converters-workflow-detail-note" style="margin-bottom:8px;">
        Filter: ComponentType/NodeName/DTXR contains RIGID, FLAN*, or VALVE/VLV and ElementLengthMm &gt; 6 mm. Length conversion ⇄ in→mm is ${_conversionEnabled(config) ? 'ON' : 'OFF'}.
      </div>
      <div class="mc-rigid-review-table-wrap" style="overflow:auto;max-height:48vh;">
        <table class="mc-rigid-review-table" style="border-collapse:collapse;font-size:12px;">
          <thead><tr><th>Status</th><th>Branch</th><th>Type</th><th>Bore</th><th>Rating</th><th>Node</th><th>DTXR</th><th>Length</th><th>Weight (kg)</th><th>Nearest Suggestions (TypeDesc · Weight · ΔLength)</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
    contentEl.querySelectorAll('[data-wm-candidate]').forEach((button) => {
      button.addEventListener('click', () => {
        const rowIndex = Number(button.getAttribute('data-wm-candidate'));
        const input = contentEl.querySelectorAll('.mc-rigid-review-input')[rowIndex];
        if (input) input.value = button.getAttribute('data-wm-weight') || '';
      });
    });
  };

  const compute = async () => {
    syncLengthToggle();
    if (!xmlFile) {
      localIssues = [];
      contentEl.innerHTML = '<div class="model-converters-workflow-detail-note">No XML source loaded. Import an XML file first.</div>';
      setStatus('No input', 'bad');
      return;
    }
    setStatus('Computing…');
    try {
      const xmlText = await xmlFile.text();
      const resolvedStagedJsonText = await _resolveStagedJsonText(stagedJsonText);
      const enriched = await enrichXmlForCii2019(xmlText, resolvedStagedJsonText, { dryRun: true });
      const enrichedRows = collectXmlCiiWeightMatchRows(enriched.xmlText, resolvedStagedJsonText, enriched.config || config);
      const rawRows = collectXmlCiiWeightMatchRows(xmlText, resolvedStagedJsonText, enriched.config || config);
      localIssues = _mergeDtxrFromRawRows(enrichedRows, rawRows);
      const mapped = localIssues.filter((item) => item.mapped).length;
      const unresolved = localIssues.length - mapped;
      setStatus(`${mapped} mapped · ${unresolved} unresolved · ${localIssues.length} shown`, unresolved ? 'bad' : 'ok');
      renderIssues(localIssues);
    } catch (err) {
      localIssues = [];
      const message = _toText(err?.message || err);
      contentEl.innerHTML = `<div class="model-converters-workflow-detail-note">Could not compute weight matches: ${_esc(message)}</div>`;
      setStatus('Error', 'bad');
    }
  };

  detailEl.querySelector('#mc-wm-refresh')?.addEventListener('click', compute);
  detailEl.querySelector('#mc-wm-length-toggle')?.addEventListener('click', () => {
    if (!config.weight || typeof config.weight !== 'object') config.weight = {};
    config.weight.convertSmallLengthsInToMm = config.weight.convertSmallLengthsInToMm !== true;
    onSaveConfig(config);
    void compute();
  });
  detailEl.querySelector('#mc-wm-fill-best')?.addEventListener('click', () => {
    contentEl.querySelectorAll('.mc-rigid-review-input').forEach((input, index) => {
      const best = localIssues[index]?.candidates?.[0];
      if (best) input.value = best.suggestedWeight ?? best.weight;
    });
  });
  contentEl.addEventListener('change', (event) => {
    const input = event.target.closest?.('.mc-rigid-review-input');
    if (!input) return;
    const key = input.getAttribute('data-wm-key') || '';
    const numeric = Number(input.value);
    if (!key || !Number.isFinite(numeric) || numeric <= 0) return;
    const overrides = ensureOverrides(config);
    overrides.rigidWeight = { ...(overrides.rigidWeight || {}), [key]: numeric };
    onSaveConfig(config);
  });
  syncLengthToggle();
  void compute();
}
