const STORAGE_KEY = 'xmlCii2019.matchedPreview.lastDiagnostics.v1';
const PREVIEW_EVENT = 'xml-cii-matched-preview:diagnostics';

function text(value) { return value == null ? '' : String(value); }
function esc(value) {
  return text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function clean(value) { return text(value).replace(/\s+/g, ' ').trim(); }
function safeJson(raw, fallback) { try { const v = JSON.parse(raw || ''); return v && typeof v === 'object' ? v : fallback; } catch { return fallback; } }
function asArray(value) { return Array.isArray(value) ? value : []; }
function readStored() { try { return safeJson(window.localStorage.getItem(STORAGE_KEY), null); } catch { return null; } }
function writeStored(payload) { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload || {}, null, 2)); } catch {} }
function fileName(root, selector) { return root?.querySelector?.(selector)?.files?.[0]?.name || 'No file selected'; }
function optionValue(root, key) { return root?.querySelector?.(`[data-option-key="${key}"]`)?.value || ''; }
function parseSupportConfig(root) { return safeJson(optionValue(root, 'supportConfigJson') || '{}', {}) || {}; }
function statsCards(items) {
  return `<div class="model-converters-workflow-preview-grid">${items.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>`;
}
function normalizePreviewPayload(payload, source = 'stored') {
  if (!payload || typeof payload !== 'object') return { matchedFacts: [], rejectedFacts: [], diagnostics: [], source: 'none' };
  return {
    ...payload,
    matchedFacts: asArray(payload.matchedFacts).filter((fact) => fact?.status === 'MATCHED'),
    rejectedFacts: asArray(payload.rejectedFacts),
    diagnostics: asArray(payload.diagnostics),
    source: payload.source || source,
  };
}
function factText(fact) { return typeof fact?.value === 'object' ? JSON.stringify(fact.value) : text(fact?.value); }
function factSearchText(fact) { return [fact?.source, fact?.itemType, fact?.basis, fact?.key, fact?.resolvedNodeNumber, factText(fact)].map(text).join(' ').toLowerCase(); }
function factRows(facts, emptyText = 'No rows loaded.') {
  const rows = asArray(facts).slice(0, 250);
  if (!rows.length) return `<div class="model-converters-muted">${esc(emptyText)}</div>`;
  return `<div class="mc-preview-wrap xml-cii-preview-table-wrap"><table class="mc-preview-node-table xml-cii-preview-table--fixed" style="min-width:100%;font-size:11px;"><thead><tr><th>Source</th><th>Item</th><th>Basis</th><th>Key</th><th>Node</th><th>Value</th><th>Status</th></tr></thead><tbody>${rows.map((fact) => `<tr><td>${esc(fact.source || '')}</td><td>${esc(fact.itemType || '')}</td><td>${esc(fact.basis || '')}</td><td title="${esc(fact.key || '')}">${esc(fact.key || '')}</td><td>${esc(fact.resolvedNodeNumber || '')}</td><td title="${esc(factText(fact))}">${esc(factText(fact))}</td><td>${esc(fact.status || '')}</td></tr>`).join('')}</tbody></table></div>`;
}

export function renderXmlCiiWorkflowModelDataPanel(target, dataRoot = document) {
  if (!target) return;
  const support = parseSupportConfig(dataRoot);
  const sideText = support.sideload?.restraintsText || '';
  const jsonConfig = support.sideloadJsonConfig || safeJson(localStorage.getItem('xmlCii2019.sideload.jsonConfig.v1'), {}) || {};
  target.innerHTML = `
    <div class="model-converters-workflow-detail-title">XML - Model Data</div>
    <div class="model-converters-workflow-detail-text">Direct popup content: model inputs, JSON config aliases, resolver audit, manual side-load rows, and diagnostics. No old DOM panels are moved into the popup.</div>
    <div class="model-converters-workflow-master-card">
      <div class="model-converters-workflow-section-title">Input XML / JSON Import</div>
      ${statsCards([
        ['Primary XML', fileName(dataRoot, '#model-converters-primary-input')],
        ['Staged / JSON', fileName(dataRoot, '#model-converters-secondary-input')],
        ['Manual rows saved', sideText ? sideText.split(/\r?\n/).filter((line) => clean(line) && !clean(line).startsWith('#')).length : 0],
      ])}
    </div>
    <div class="model-converters-workflow-master-card">
      <div class="model-converters-workflow-section-title">Resolver Index</div>
      <div class="model-converters-workflow-detail-text">Builds Node, PS No., and POS indexes from loaded XML. Use the existing XML input, then run the existing preview/conversion to populate diagnostics.</div>
      ${statsCards([['Nodes', 'from XML'], ['Node keys', 'from XML'], ['PS keys', 'from XML'], ['POS keys', 'from XML']])}
    </div>
    <div class="model-converters-workflow-master-card">
      <div class="model-converters-workflow-section-title">JSON Config</div>
      <div class="model-converters-workflow-regex-grid">
        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#9cc5ff;"><span>PS aliases</span><textarea readonly style="min-height:54px;background:#182334;color:#e6edf5;border:1px solid #31455f;border-radius:6px;padding:8px;font-family:Consolas,monospace;font-size:11px;">${esc(asArray(jsonConfig.basisResolvers?.PS?.fieldAliases).join(', '))}</textarea></label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#9cc5ff;"><span>POS object aliases</span><textarea readonly style="min-height:54px;background:#182334;color:#e6edf5;border:1px solid #31455f;border-radius:6px;padding:8px;font-family:Consolas,monospace;font-size:11px;">${esc(asArray(jsonConfig.basisResolvers?.POS?.objectFieldAliases).join(', '))}</textarea></label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:#9cc5ff;"><span>Restraint aliases</span><textarea readonly style="min-height:54px;background:#182334;color:#e6edf5;border:1px solid #31455f;border-radius:6px;padding:8px;font-family:Consolas,monospace;font-size:11px;">${esc(asArray(jsonConfig.itemExtractors?.RESTRAINT?.sourceFieldAliases).join(', '))}</textarea></label>
      </div>
    </div>
    <div class="model-converters-workflow-master-card">
      <div class="model-converters-workflow-section-title">JSON Resolved Data / PS → Node / POS → Node</div>
      ${factRows(normalizePreviewPayload(readStored()).matchedFacts, 'No matched facts stored yet. Run XML→CII preview/conversion or import diagnostics in Matched Audit.')}
    </div>
    <div class="model-converters-workflow-master-card">
      <div class="model-converters-workflow-section-title">Manual Restraints</div>
      <textarea readonly spellcheck="false" placeholder="Node|PSNo.|POS|Restraint" style="width:100%;min-height:120px;background:#182334;color:#e6edf5;border:1px solid #31455f;border-radius:6px;padding:8px;font-family:Consolas,monospace;font-size:12px;">${esc(sideText)}</textarea>
    </div>
    <div class="model-converters-workflow-master-card">
      <div class="model-converters-workflow-section-title">Diagnostics</div>
      ${factRows(normalizePreviewPayload(readStored()).rejectedFacts, 'No rejected facts stored yet.')}
    </div>`;
}

export function renderXmlCiiWorkflowMatchedAuditPanel(target) {
  if (!target) return;
  target.innerHTML = `
    <div class="model-converters-workflow-detail-title">Matched Audit</div>
    <div class="model-converters-workflow-detail-text">Direct popup content: matched-only table. Rejected, invalid, duplicate, and unresolved rows are counted but hidden from Matched Preview.</div>
    <div class="model-converters-workflow-master-card">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input data-direct-diagnostics-file type="file" accept=".json,application/json">
        <input data-direct-preview-filter type="search" placeholder="Filter source/item/node/key/value" style="min-width:260px;background:#182334;color:#e6edf5;border:1px solid #31455f;border-radius:6px;padding:8px;">
        <button type="button" class="model-converters-run-btn" data-direct-load-diagnostics>Load Diagnostics</button>
        <button type="button" class="model-converters-download-btn" data-direct-refresh-latest>Refresh Latest Run</button>
        <button type="button" class="model-converters-download-btn" data-direct-clear-preview>Clear</button>
      </div>
      <div data-direct-preview-status style="font-size:12px;color:#9aa8ba;margin-top:8px;"></div>
    </div>
    <div data-direct-preview-summary class="model-converters-workflow-master-card"></div>
    <div data-direct-preview-table class="model-converters-workflow-master-card"></div>`;
  const render = (payload) => {
    const normalized = normalizePreviewPayload(payload, payload?.source || 'stored');
    const filter = clean(target.querySelector('[data-direct-preview-filter]')?.value || '').toLowerCase();
    const matched = filter ? normalized.matchedFacts.filter((fact) => factSearchText(fact).includes(filter)) : normalized.matchedFacts;
    target.querySelector('[data-direct-preview-summary]').innerHTML = statsCards([
      ['Matched rows', matched.length], ['Rejected hidden', normalized.rejectedFacts.length], ['Diagnostics rows', normalized.diagnostics.length], ['Source', normalized.source || 'none'],
    ]);
    target.querySelector('[data-direct-preview-table]').innerHTML = factRows(matched, 'No matched rows loaded. Run XML→CII or import diagnostics JSON.');
    target.querySelector('[data-direct-preview-status]').textContent = `${matched.length} matched rows loaded.`;
  };
  const renderLatest = () => render(readStored());
  target.querySelector('[data-direct-refresh-latest]')?.addEventListener('click', renderLatest);
  target.querySelector('[data-direct-preview-filter]')?.addEventListener('input', renderLatest);
  target.querySelector('[data-direct-clear-preview]')?.addEventListener('click', () => { try { localStorage.removeItem(STORAGE_KEY); } catch {} render(null); });
  target.querySelector('[data-direct-load-diagnostics]')?.addEventListener('click', async () => {
    const status = target.querySelector('[data-direct-preview-status]');
    try {
      const file = target.querySelector('[data-direct-diagnostics-file]')?.files?.[0];
      if (!file) throw new Error('Select diagnostics JSON first.');
      const payload = normalizePreviewPayload(safeJson(await file.text(), null), 'diagnostics-json');
      writeStored(payload);
      render(payload);
    } catch (error) {
      status.textContent = clean(error?.message || error);
      status.style.color = '#ff8888';
    }
  });
  if (target.__xmlCiiWorkflowPreviewListener) window.removeEventListener(PREVIEW_EVENT, target.__xmlCiiWorkflowPreviewListener);
  target.__xmlCiiWorkflowPreviewListener = (event) => { const payload = normalizePreviewPayload(event?.detail, 'latest-run'); writeStored(payload); render(payload); };
  window.addEventListener(PREVIEW_EVENT, target.__xmlCiiWorkflowPreviewListener);
  renderLatest();
}
