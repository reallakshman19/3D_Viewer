import { collectXmlCiiWeightMatchRows, xmlCiiRigidWeightOverrideKey } from '../../../../converters/xml-cii2019-core/weight-match-model.js';

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

export function xmlCiiRenderWeightMatchPhase() {
  const info = 'Shows all XML nodes where ComponentType/NodeName/DTXR indicates RIGID, FLAN*, or VALVE/VLV and ElementLengthMm > 6 mm. Green rows already have XML/override weight; amber rows still need a weight decision.';
  return `
    <div class="model-converters-workflow-detail-title">4A Weight Match <span title="${_escAttr(info)}" style="cursor:help;color:#8bb7ff;border:1px solid #406089;border-radius:50%;padding:0 5px;font-size:11px;">i</span></div>
    <div class="model-converters-workflow-detail-text">
      Approximate component weights matched from the valve weight master by
      <strong>rating</strong> (×3), <strong>bore</strong> (×2), and <strong>length</strong> (×1).
      DTXR is resolved from XML <strong>DTXR_POS</strong> / <strong>DTXR_PS</strong> first, then staged JSON by OWNER/Branchname, ComponentRefNo, PS tag, node and coordinates.
      Review and adjust, then <strong>Finalize and Run</strong>.
    </div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0;">
      <button type="button" class="model-converters-download-btn" id="mc-wm-refresh">↻ Recompute matches</button>
      <button type="button" class="model-converters-download-btn" id="mc-wm-fill-best">Use all ★ preferred</button>
      <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;background:#123c25;border:1px solid #2f9e63;border-radius:3px;"></span>Mapped</span>
      <span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;background:#4a2d12;border:1px solid #d08a22;border-radius:3px;"></span>Unresolved</span>
      <span id="mc-wm-status" class="mc-diag-run-status"></span>
    </div>
    <div id="mc-wm-content"><div class="model-converters-workflow-detail-note">Computing weight matches…</div></div>
    <div style="margin-top:14px;">
      <button type="button" class="model-converters-run-btn" id="mc-wm-finalize" style="width:100%;padding:12px;">✓ Finalize and Run</button>
    </div>`;
}

export function bindXmlCiiWeightMatchPhase(detailEl, { xmlFile, stagedJsonText, config, enrichXmlForCii2019, onSaveConfig, ensureOverrides, onFinalize }) {
  if (!detailEl) return;
  const contentEl = detailEl.querySelector('#mc-wm-content');
  const statusEl = detailEl.querySelector('#mc-wm-status');
  const setStatus = (msg, tone) => {
    if (statusEl) {
      statusEl.textContent = msg || '';
      statusEl.className = `mc-diag-run-status ${tone || ''}`.trim();
    }
  };
  if (!contentEl) return;
  let localIssues = [];

  const renderIssues = (issues) => {
    if (!issues.length) {
      contentEl.innerHTML = '<div class="model-converters-workflow-detail-note">No RIGID / FLAN* / VALVE nodes with ElementLengthMm &gt; 6 mm were found. You can Finalize and Run.</div>';
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
        const valveType = candidate.valveType || 'Unknown';
        const title = [
          `Valve type: ${valveType}`,
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
            title="${_escAttr(title)}">
            ${candidate.preferred ? '★ ' : ''}${_esc(candidate.valveType || 'Unknown')} · ${_esc(value)} kg · Δ${_esc(_fmtNum(candidate.lengthDelta))} mm
          </button>`;
      }).join('');
      const ratingTitle = `Piping Class ${issue.resolvedPipingClass || ''} (${issue.pipingClassMatchMethod || ''})`;
      const dtxrTitle = [issue.dtxrSource, issue.dtxrMatchedKey].filter(Boolean).join(' · ');
      return `
        <tr style="${rowStyle}">
          <td>${_esc(statusText)}</td>
          <td class="mc-rigid-review-branch" title="${_escAttr(issue.branchName)}">${_esc(issue.branchName)}</td>
          <td>${_esc(issue.componentType || '')}</td>
          <td>${_esc(issue.boreMm == null ? '' : `${Number(issue.boreMm).toFixed(0)} mm`)}</td>
          <td title="${_escAttr(ratingTitle)}">${_esc(issue.rating || '')}</td>
          <td>${_esc(issue.nodeNumber)}</td>
          <td class="mc-rigid-review-dtxr" title="${_escAttr(dtxrTitle)}">${_esc(issue.dtxr || 'Not found')}</td>
          <td title="${_escAttr(issue.elementLengthSource || '')}">${_esc(issue.lengthMm == null ? '' : `${Number(issue.lengthMm).toFixed(1)} mm`)}</td>
          <td><input type="number" min="0" step="0.001" class="mc-rigid-review-input" data-wm-key="${_escAttr(issue.key)}" value="${_escAttr(initialWeight)}" placeholder="kg"></td>
          <td class="mc-rigid-review-candidates">${candidates || '<span class="model-converters-muted">No suggestion</span>'}</td>
        </tr>`;
    }).join('');
    contentEl.innerHTML = `
      <div class="model-converters-workflow-detail-note" style="margin-bottom:8px;">
        Filter: ComponentType/NodeName/DTXR contains RIGID, FLAN*, or VALVE/VLV and ElementLengthMm &gt; 6 mm.
      </div>
      <div class="mc-rigid-review-table-wrap" style="overflow:auto;max-height:48vh;">
        <table class="mc-rigid-review-table">
          <thead><tr><th>Status</th><th>Branch</th><th>Type</th><th>Bore</th><th>Rating</th><th>Node</th><th>DTXR</th><th>Length</th><th>Weight (kg)</th><th>Nearest Suggestions</th></tr></thead>
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
    if (!xmlFile) {
      localIssues = [];
      contentEl.innerHTML = '<div class="model-converters-workflow-detail-note">No XML source loaded. Import an XML file first.</div>';
      setStatus('No input', 'bad');
      return;
    }
    setStatus('Computing…');
    try {
      const xmlText = await xmlFile.text();
      const enriched = await enrichXmlForCii2019(xmlText, stagedJsonText, { dryRun: true });
      localIssues = collectXmlCiiWeightMatchRows(enriched.xmlText, stagedJsonText, enriched.config || config);
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
  detailEl.querySelector('#mc-wm-fill-best')?.addEventListener('click', () => {
    contentEl.querySelectorAll('.mc-rigid-review-input').forEach((input, index) => {
      const best = localIssues[index]?.candidates?.[0];
      if (best) input.value = best.suggestedWeight ?? best.weight;
    });
  });
  detailEl.querySelector('#mc-wm-finalize')?.addEventListener('click', () => {
    const weightsByKey = {};
    contentEl.querySelectorAll('.mc-rigid-review-input').forEach((input) => {
      const key = input.getAttribute('data-wm-key') || '';
      const numeric = Number(input.value);
      if (key && Number.isFinite(numeric) && numeric > 0) weightsByKey[key] = numeric;
    });
    if (Object.keys(weightsByKey).length) {
      const overrides = ensureOverrides(config);
      overrides.rigidWeight = { ...(overrides.rigidWeight || {}), ...weightsByKey };
      onSaveConfig(config);
    }
    onFinalize();
  });
  void compute();
}
