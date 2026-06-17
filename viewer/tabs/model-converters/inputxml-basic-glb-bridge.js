import { run as runInputXmlToBasicGlb } from './converters/inputxml-to-basic-glb.js';
import { downloadOutput } from './core/output-utils.js';

const CONVERTER_ID = 'inputxml_to_basic_glb';
const CONVERTER_LABEL = 'InputXML→Basic GLB';

const DEFAULT_ISONOTE = `NODE,ISONOTE
35,:/PS-123 :ISONOTE 'REST(28kN), GUIDE(6kN),LINE STOP(15kN)'
130,:ISONOTE 'REST NOT DEFINED, SINGLE AXIS Z'
255,:ISONOTE 'REST(3kN), GUIDE(1kN)'
205,:/PS-456 :ISONOTE 'REST(10kN), HOLDDOWN,LINE STOP(6kN), Holddown without Guide Can Spring'`;

const DEFAULT_LINE_NO = `NODE,LINE_NO
10,LINE XYZ`;

function text(value) { return String(value ?? '').trim(); }
function esc(value) { return text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function appendConverterOption(root) {
  const select = root?.querySelector?.('#model-converters-select');
  if (!select || select.querySelector(`option[value="${CONVERTER_ID}"]`)) return select;
  const option = document.createElement('option'); option.value = CONVERTER_ID; option.textContent = CONVERTER_LABEL;
  const richGlb = select.querySelector('option[value="inputxml_to_glb"]');
  if (richGlb?.nextSibling) select.insertBefore(option, richGlb.nextSibling);
  else if (richGlb) richGlb.insertAdjacentElement('afterend', option);
  else select.appendChild(option);
  return select;
}
function setStatus(root, message, tone = '') { const status = root.querySelector('#model-converters-status'); if (!status) return; status.textContent = message; status.className = `model-converters-status ${tone}`.trim(); }
function setLogs(root, lines) { const logs = root.querySelector('#model-converters-logs'); if (!logs) return; const normalized = Array.isArray(lines) ? lines.map(text).filter(Boolean) : []; logs.textContent = normalized.length ? normalized.join('\n') : '(no logs)'; }
function resetOutput(root) { const output = root.querySelector('#model-converters-output'); if (output) output.innerHTML = '<span class="model-converters-muted">No output generated yet.</span>'; const diag = root.querySelector('#model-converters-diagnostics-table'); if (diag) { diag.style.display = 'none'; diag.innerHTML = ''; } const previewMeta = root.querySelector('#model-converters-preview-meta'); if (previewMeta) previewMeta.textContent = 'Basic GLB output is download-only here; open it in the GLB viewer tab.'; setLogs(root, []); }
function renderOutputs(root, outputs) {
  const output = root.querySelector('#model-converters-output'); if (!output) return;
  const normalized = Array.isArray(outputs) ? outputs.filter((entry) => entry?.name) : [];
  if (!normalized.length) { output.innerHTML = '<span class="model-converters-muted">No output generated.</span>'; return; }
  output.innerHTML = normalized.map((entry, index) => `<div class="model-converters-output-row"><strong>${esc(entry.name)}</strong><button type="button" class="model-converters-download-btn" data-inputxml-basic-glb-output="${index}">Download</button></div>`).join('');
  for (const button of output.querySelectorAll('[data-inputxml-basic-glb-output]')) button.addEventListener('click', () => { const selected = normalized[Number(button.getAttribute('data-inputxml-basic-glb-output'))]; if (selected) downloadOutput(selected); });
}
function renderAdvancedFields(root) {
  const fields = root.querySelector('#model-converters-advanced-fields'); if (!fields) return;
  const sel = (key, opts, label) => `<label style="display:flex;flex-direction:column;gap:3px;color:#d7e6ff;font-size:12px;">${label}<select data-option-key="${key}" style="background:#1a2535;color:#d7e6ff;border:1px solid #2e4057;border-radius:4px;padding:3px 6px;font-size:12px;">${opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>`;
  const chk = (key, label, checked = true) => `<label style="display:flex;align-items:center;gap:8px;color:#d7e6ff;font-size:12px;"><input type="checkbox" data-option-key="${key}"${checked ? ' checked' : ''}><span>${label}</span></label>`;
  const ta = (key, label, val, rows = 3) => `<label style="display:flex;flex-direction:column;gap:3px;color:#d7e6ff;font-size:12px;">${label}<textarea data-option-key="${key}" rows="${rows}" style="background:#1a2535;color:#d7e6ff;border:1px solid #2e4057;border-radius:4px;padding:4px 6px;font-size:11px;font-family:monospace;resize:vertical;">${esc(val)}</textarea></label>`;
  fields.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">
${sel('supportMode', [['compare','Compare (InputXML + ISONOTE)'],['inputxml-actual','InputXML actual only'],['isonote-expected','ISONOTE expected only']], 'Support Mode')}
${sel('singleAxisDecision', [['warning','Warning triangle'],['+',' Force + (positive)'],['−','Force − (negative)']], 'Ambiguous Single-Axis Sign')}
${chk('nodeLabels', 'Node labels', true)}
${chk('isonoteBoards', 'ISONOTE annotation boards', true)}
${chk('includeSidecarJson', 'Export sidecar JSON (audit)', true)}
${ta('isonoteText', 'ISONOTE Sideload (CSV: NODE,ISONOTE)', DEFAULT_ISONOTE, 5)}
${ta('lineNoText', 'LINE_NO Sideload (CSV: NODE,LINE_NO)', DEFAULT_LINE_NO, 2)}
</div>`;
}
function renderInputXmlBasicGlbMode(root) {
  const primaryLabel = root.querySelector('#model-converters-primary-label');
  const primaryInput = root.querySelector('#model-converters-primary-input');
  const primaryName = root.querySelector('#model-converters-primary-name');
  const secondaryWrap = root.querySelector('#model-converters-secondary-wrap');
  const xmlWorkflow = root.querySelector('#model-converters-xml-cii-workflow');
  const supportMapper = root.querySelector('#model-converters-support-mapper');
  if (primaryLabel) primaryLabel.textContent = 'Input XML (CAESAR II) (.xml,.XML)';
  if (primaryInput) primaryInput.setAttribute('accept', '.xml,.XML');
  if (primaryName && !primaryInput?.files?.[0]) primaryName.textContent = 'No file selected.';
  if (secondaryWrap) secondaryWrap.style.display = 'none';
  if (xmlWorkflow) { xmlWorkflow.hidden = true; xmlWorkflow.open = false; }
  if (supportMapper) { supportMapper.hidden = true; supportMapper.open = false; }
  renderAdvancedFields(root);
  setStatus(root, 'Build a rich independent GLB from CAESAR II Input XML with ISONOTE annotations and support symbols.', '');
  resetOutput(root);
}
function readOptions(root) { const options = {}; for (const input of root.querySelectorAll('[data-option-key]')) { const key = input.getAttribute('data-option-key'); if (!key) continue; options[key] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value; } return options; }
function selectedPrimaryFile(root) { return root.querySelector('#model-converters-primary-input')?.files?.[0] || null; }
async function runInputXmlBasicGlb(root) {
  const file = selectedPrimaryFile(root);
  if (!file) { const msg = 'Select a primary Input XML file first.'; setStatus(root, `Failed: ${msg}`, 'bad'); setLogs(root, [msg]); renderOutputs(root, []); return; }
  const runButton = root.querySelector('#model-converters-run');
  try {
    if (runButton) runButton.disabled = true;
    setStatus(root, 'Running InputXML→Basic GLB converter...', 'running'); setLogs(root, []); renderOutputs(root, []);
    const response = await runInputXmlToBasicGlb({ converterId: CONVERTER_ID, inputFiles: [{ role: 'primary', name: file.name, file }], options: readOptions(root), setStatus: (msg, tone) => setStatus(root, msg, tone) });
    const logs = [].concat(response?.logs?.stdout || []).concat(response?.logs?.stderr || []);
    setLogs(root, logs); renderOutputs(root, response?.outputs || []);
    if (!response?.ok) throw new Error(logs.join('\n') || 'InputXML→Basic GLB conversion failed.');
    setStatus(root, `Completed: ${response.outputs?.[0]?.name || 'Basic GLB output'}`, 'ok');
  } catch (error) { const message = error?.message || String(error); setStatus(root, `Failed: ${message}`, 'bad'); setLogs(root, [message]); }
  finally { if (runButton) runButton.disabled = false; }
}
export function installInputXmlBasicGlbBridge(root = globalThis.document) {
  if (!root?.querySelector || !globalThis.document) return () => {};
  const select = appendConverterOption(root); const runButton = root.querySelector('#model-converters-run');
  if (!select || !runButton || root.dataset?.inputxmlBasicGlbBridge === 'mounted') return () => {};
  if (root.dataset) root.dataset.inputxmlBasicGlbBridge = 'mounted';
  const onSelectChange = (event) => { if (select.value !== CONVERTER_ID) return; event.preventDefault(); event.stopImmediatePropagation(); renderInputXmlBasicGlbMode(root); };
  const onRun = (event) => { if (select.value !== CONVERTER_ID) return; event.preventDefault(); event.stopImmediatePropagation(); void runInputXmlBasicGlb(root); };
  select.addEventListener('change', onSelectChange, true); runButton.addEventListener('click', onRun, true);
  if (select.value === CONVERTER_ID) renderInputXmlBasicGlbMode(root);
  return () => { select.removeEventListener('change', onSelectChange, true); runButton.removeEventListener('click', onRun, true); };
}
