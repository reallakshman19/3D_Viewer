import { parseMatchedPreviewDiagnostics, splitMatchedPreviewFacts } from '../../converters/xml-cii2019-core/sideload-matched-preview.js';

const FLAG = '__xmlCiiMatchedPreviewUi_v1';
const ACTIVE_KEY = 'xmlCii2019.matchedPreview.active.v1';
const DIAGNOSTICS_KEY = 'xmlCii2019.matchedPreview.lastDiagnostics.v1';
const TOOLTIP = 'Matched Preview shows only resolved items that will be applied to enriched XML/CII. Load Node/PS/POS side-load data in Sideload → Restraints. Unmatched, duplicate, or invalid side-load rows are shown in Sideload → Diagnostics.';

function browserReady() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function text(value) {
  return value == null ? '' : String(value);
}

function esc(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readStored(key, fallback = '') {
  try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function writeStored(key, value) {
  try { window.localStorage.setItem(key, value); } catch {}
}

function renderFactRows(facts, maxRows = 250) {
  const rows = (facts || []).slice(0, maxRows);
  if (!rows.length) return '<div class="model-converters-muted">No matched rows loaded. Load the latest enrichment diagnostics JSON after running XML→CII.</div>';
  return `
    <table class="mc-preview-node-table" style="min-width:100%;font-size:11px;">
      <thead>
        <tr><th>Source</th><th>Item</th><th>Basis</th><th>Key</th><th>Node</th><th>Value</th><th>Action</th><th>Status</th></tr>
      </thead>
      <tbody>${rows.map((fact) => `
        <tr>
          <td>${esc(fact.source || '')}</td>
          <td>${esc(fact.itemType || '')}</td>
          <td>${esc(fact.basis || '')}</td>
          <td title="${esc(fact.key || '')}">${esc(fact.key || '')}</td>
          <td>${esc(fact.resolvedNodeNumber || '')}</td>
          <td>${esc(typeof fact.value === 'object' ? JSON.stringify(fact.value) : fact.value)}</td>
          <td>${esc(fact.action || '')}</td>
          <td>${esc(fact.status || '')}</td>
        </tr>`).join('')}</tbody>
    </table>
    ${(facts || []).length > maxRows ? `<div style="color:#9aa8ba;font-size:11px;margin-top:6px;">Showing first ${maxRows} of ${facts.length} rows.</div>` : ''}`;
}

function summaryGrid(split) {
  const byItem = new Map();
  for (const fact of split.matchedFacts || []) {
    const item = fact.itemType || '(none)';
    byItem.set(item, (byItem.get(item) || 0) + 1);
  }
  const itemText = Array.from(byItem.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${esc(key)}: <strong>${esc(value)}</strong>`)
    .join(' · ');
  return `
    <div class="model-converters-workflow-preview-grid">
      <div><span>Matched</span><strong>${esc(split.stats?.matched || 0)}</strong></div>
      <div><span>Rejected / hidden</span><strong>${esc(split.stats?.rejected || 0)}</strong></div>
      <div><span>Input matched facts</span><strong>${esc(split.stats?.inputMatched || 0)}</strong></div>
      <div><span>Input rejected facts</span><strong>${esc(split.stats?.inputRejected || 0)}</strong></div>
    </div>
    <div style="margin-top:8px;color:#d7e6ff;font-size:12px;">${itemText || 'No matched item groups loaded.'}</div>`;
}

function panelHtml() {
  const stored = readStored(DIAGNOSTICS_KEY, '');
  return `
    <details id="model-converters-xml-cii-matched-preview" class="model-converters-workflow" ${readStored(ACTIVE_KEY, 'open') === 'closed' ? '' : 'open'}>
      <summary>XML→CII Matched Preview <span title="${esc(TOOLTIP)}" style="cursor:help;color:#9cc5ff;">ⓘ</span></summary>
      <div class="model-converters-workflow-detail-text" style="margin:8px 0 10px;">${esc(TOOLTIP)}</div>
      <div class="model-converters-workflow-master-card">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
          <input id="mc-matched-preview-file" type="file" accept=".json,.JSON,application/json" style="color:#d7e6ff;font-size:12px;">
          <button type="button" class="model-converters-run-btn" id="mc-matched-preview-load-file">Load Diagnostics JSON</button>
          <button type="button" class="model-converters-download-btn" id="mc-matched-preview-load-text">Load Pasted JSON</button>
          <button type="button" class="model-converters-download-btn" id="mc-matched-preview-clear">Clear</button>
        </div>
        <textarea id="mc-matched-preview-json" spellcheck="false" placeholder="Paste *_enrichment_diagnostics.json here. Matched Preview reads matchedFacts only." style="width:100%;min-height:98px;background:#182334;color:#e6edf5;border:1px solid #31455f;border-radius:6px;padding:8px;font-family:Consolas,monospace;font-size:12px;">${esc(stored)}</textarea>
        <div id="mc-matched-preview-status" style="margin-top:8px;color:#9aa8ba;font-size:12px;"></div>
      </div>
      <div id="mc-matched-preview-output" class="model-converters-workflow-master-card" style="margin-top:10px;"></div>
      <div id="mc-matched-preview-hidden" class="model-converters-workflow-master-card" style="margin-top:10px;display:none;"></div>
    </details>`;
}

function setOutput(root, rawText) {
  const output = root.querySelector('#mc-matched-preview-output');
  const hidden = root.querySelector('#mc-matched-preview-hidden');
  const status = root.querySelector('#mc-matched-preview-status');
  if (!output || !hidden) return;
  try {
    const split = parseMatchedPreviewDiagnostics(rawText);
    output.innerHTML = `
      <div class="model-converters-workflow-section-title">Matched / applicable rows only</div>
      ${summaryGrid(split)}
      <div style="margin-top:10px;">${renderFactRows(split.matchedFacts)}</div>`;
    if (split.rejectedFacts.length) {
      hidden.style.display = 'block';
      hidden.innerHTML = `
        <div class="model-converters-workflow-section-title">Hidden diagnostics rows</div>
        <div class="model-converters-workflow-detail-text">These rows are intentionally excluded from Matched Preview.</div>
        ${renderFactRows(split.rejectedFacts)}`;
    } else {
      hidden.style.display = 'none';
      hidden.innerHTML = '';
    }
    if (status) { status.textContent = `Loaded matched preview: ${split.matchedFacts.length} matched; ${split.rejectedFacts.length} hidden.`; status.style.color = '#5df0a0'; }
    writeStored(DIAGNOSTICS_KEY, rawText || '');
  } catch (error) {
    output.innerHTML = `<div style="color:#ff8888;">${esc(error?.message || error)}</div>`;
    hidden.style.display = 'none';
    if (status) { status.textContent = 'Diagnostics JSON could not be parsed.'; status.style.color = '#ffb4b4'; }
  }
}

function addPreviewTooltip(root) {
  const buttons = Array.from(root.querySelectorAll('.model-converters-workflow-phase'));
  for (const button of buttons) {
    if (button.dataset.matchedPreviewTooltipInstalled) continue;
    const label = text(button.textContent);
    if (!/\bPreview\b/i.test(label)) continue;
    button.dataset.matchedPreviewTooltipInstalled = '1';
    button.setAttribute('title', TOOLTIP);
    const span = button.querySelector('span') || button;
    span.insertAdjacentHTML('beforeend', ` <span title="${esc(TOOLTIP)}" style="cursor:help;color:#9cc5ff;">ⓘ</span>`);
  }
}

export function installXmlCiiMatchedPreviewUi(container = document) {
  if (!browserReady() || window[FLAG]) return;
  window[FLAG] = true;

  const root = container || document;
  const ensurePanel = () => {
    addPreviewTooltip(root);
    const sideload = root.querySelector('#model-converters-xml-cii-sideload');
    const workflow = root.querySelector('#model-converters-xml-cii-workflow');
    if ((!sideload && !workflow) || root.querySelector('#model-converters-xml-cii-matched-preview')) return;
    (sideload || workflow).insertAdjacentHTML('afterend', panelHtml());
    const panel = root.querySelector('#model-converters-xml-cii-matched-preview');
    panel?.addEventListener('toggle', () => writeStored(ACTIVE_KEY, panel.open ? 'open' : 'closed'));
    bindPanel(root);
    const stored = readStored(DIAGNOSTICS_KEY, '');
    if (stored.trim()) setOutput(root, stored);
    else {
      const emptySplit = splitMatchedPreviewFacts({ matchedFacts: [], rejectedFacts: [] });
      const output = root.querySelector('#mc-matched-preview-output');
      if (output) output.innerHTML = `<div class="model-converters-workflow-section-title">Matched / applicable rows only</div>${summaryGrid(emptySplit)}<div style="margin-top:10px;">${renderFactRows([])}</div>`;
    }
  };

  ensurePanel();
  const observer = new MutationObserver(() => ensurePanel());
  observer.observe(root === document ? document.body : root, { childList: true, subtree: true });
}

function bindPanel(root) {
  root.querySelector('#mc-matched-preview-load-text')?.addEventListener('click', () => {
    setOutput(root, root.querySelector('#mc-matched-preview-json')?.value || '');
  });
  root.querySelector('#mc-matched-preview-load-file')?.addEventListener('click', async () => {
    const file = root.querySelector('#mc-matched-preview-file')?.files?.[0];
    const status = root.querySelector('#mc-matched-preview-status');
    if (!file) {
      if (status) { status.textContent = 'Select *_enrichment_diagnostics.json first.'; status.style.color = '#ffb4b4'; }
      return;
    }
    const raw = await file.text();
    const textarea = root.querySelector('#mc-matched-preview-json');
    if (textarea) textarea.value = raw;
    setOutput(root, raw);
  });
  root.querySelector('#mc-matched-preview-clear')?.addEventListener('click', () => {
    writeStored(DIAGNOSTICS_KEY, '');
    const textarea = root.querySelector('#mc-matched-preview-json');
    if (textarea) textarea.value = '';
    const output = root.querySelector('#mc-matched-preview-output');
    const hidden = root.querySelector('#mc-matched-preview-hidden');
    const emptySplit = splitMatchedPreviewFacts({ matchedFacts: [], rejectedFacts: [] });
    if (output) output.innerHTML = `<div class="model-converters-workflow-section-title">Matched / applicable rows only</div>${summaryGrid(emptySplit)}<div style="margin-top:10px;">${renderFactRows([])}</div>`;
    if (hidden) { hidden.style.display = 'none'; hidden.innerHTML = ''; }
  });
}
