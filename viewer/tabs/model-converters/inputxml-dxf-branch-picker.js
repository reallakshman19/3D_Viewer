import { extractInputXmlBranches } from '../../converters/inputxml-dxf/InputXmlBranchExtractor.js';

function text(value) {
  return String(value ?? '').trim();
}

function esc(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function findSelectedBranchesInput(root) {
  return root?.querySelector?.('[data-option-key="selectedBranches"]') || null;
}

function findPrimaryXmlFile(root) {
  const inputs = [...(root?.querySelectorAll?.('input[type="file"]') || [])];
  const preferred = inputs.find((input) => {
    const accept = text(input.getAttribute('accept')).toLowerCase();
    const fileName = text(input.files?.[0]?.name).toLowerCase();
    return input.files?.[0] && (accept.includes('.xml') || fileName.endsWith('.xml'));
  });
  return preferred?.files?.[0] || null;
}

async function fileText(file) {
  if (!file) throw new Error('Select the Input XML file first.');
  if (typeof file.text === 'function') return file.text();
  throw new Error('This browser cannot read the selected XML file.');
}

function branchAliases(branch) {
  return [...new Set([branch?.id, branch?.pipelineRef, branch?.lineKey, branch?.lineNo, ...(branch?.aliases || [])]
    .map(text)
    .filter(Boolean))];
}

function setSelectedBranches(input, ids) {
  input.value = ids.join(', ');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function renderBranchRows(branches, selectedValue) {
  const selected = new Set(text(selectedValue).split(',').map((item) => item.trim()).filter(Boolean));
  return branches.map((branch) => {
    const aliases = branchAliases(branch);
    const checked = !selected.size || aliases.some((alias) => selected.has(alias));
    return `
      <label style="display:grid;grid-template-columns:22px 1fr;gap:8px;padding:6px 0;border-bottom:1px solid rgba(120,140,170,.18);">
        <input type="checkbox" data-inputxml-dxf-branch-id="${esc(branch.id)}" ${checked ? 'checked' : ''}>
        <span>
          <strong style="color:#d7e6ff;">${esc(branch.label || branch.id)}</strong>
          <span style="color:#9aa8ba;"> · id=${esc(branch.id)} · components=${Number(branch.componentCount || 0)}</span>
          ${aliases.length ? `<br><small style="color:#7f91aa;">aliases: ${esc(aliases.join(' | '))}</small>` : ''}
        </span>
      </label>
    `;
  }).join('');
}

function mountPicker(root, input) {
  if (!input || input.dataset.inputxmlDxfBranchPicker === 'mounted') return;
  input.dataset.inputxmlDxfBranchPicker = 'mounted';

  const panel = document.createElement('div');
  panel.dataset.inputxmlDxfBranchPickerPanel = 'true';
  panel.style.cssText = 'margin-top:8px;padding:10px;border:1px solid #31455f;border-radius:8px;background:#111b29;display:flex;flex-direction:column;gap:8px;';
  panel.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <button type="button" class="model-converters-download-btn" data-inputxml-dxf-list-branches>List XML branches</button>
      <button type="button" class="model-converters-download-btn" data-inputxml-dxf-use-checked disabled>Use checked branches</button>
      <button type="button" class="model-converters-download-btn" data-inputxml-dxf-use-all disabled>Use all branches</button>
    </div>
    <small style="color:#9aa8ba;">Lists branches from the selected Input XML and writes comma-separated ids into the existing selectedBranches option.</small>
    <div data-inputxml-dxf-branch-status style="color:#9aa8ba;font-size:12px;"></div>
    <div data-inputxml-dxf-branch-list style="max-height:260px;overflow:auto;"></div>
  `;

  const host = input.closest('label, .model-converters-label') || input.parentElement;
  host?.insertAdjacentElement?.('afterend', panel);

  const status = panel.querySelector('[data-inputxml-dxf-branch-status]');
  const list = panel.querySelector('[data-inputxml-dxf-branch-list]');
  const useChecked = panel.querySelector('[data-inputxml-dxf-use-checked]');
  const useAll = panel.querySelector('[data-inputxml-dxf-use-all]');
  let branches = [];

  panel.querySelector('[data-inputxml-dxf-list-branches]')?.addEventListener('click', async () => {
    try {
      status.textContent = 'Reading selected Input XML…';
      list.innerHTML = '';
      const xmlText = await fileText(findPrimaryXmlFile(root));
      const extraction = extractInputXmlBranches(xmlText, { sourceId: 'inputxml-dxf-picker' });
      branches = Array.isArray(extraction.branches) ? extraction.branches : [];
      if (!extraction.ok || !branches.length) {
        status.textContent = 'No branches found in selected Input XML.';
        useChecked.disabled = true;
        useAll.disabled = true;
        return;
      }
      list.innerHTML = renderBranchRows(branches, input.value);
      status.textContent = `Found ${branches.length} branch(es). Check branches and click “Use checked branches”.`;
      useChecked.disabled = false;
      useAll.disabled = false;
    } catch (error) {
      status.textContent = error?.message || String(error);
      useChecked.disabled = true;
      useAll.disabled = true;
    }
  });

  useChecked?.addEventListener('click', () => {
    const ids = [...panel.querySelectorAll('[data-inputxml-dxf-branch-id]:checked')]
      .map((checkbox) => text(checkbox.getAttribute('data-inputxml-dxf-branch-id')))
      .filter(Boolean);
    setSelectedBranches(input, ids);
    status.textContent = ids.length ? `Selected ${ids.length} branch id(s).` : 'No branches checked; selectedBranches cleared to export all.';
  });

  useAll?.addEventListener('click', () => {
    setSelectedBranches(input, []);
    for (const checkbox of panel.querySelectorAll('[data-inputxml-dxf-branch-id]')) checkbox.checked = true;
    status.textContent = 'selectedBranches cleared; converter will export all branches.';
  });
}

function refresh(root) {
  const input = findSelectedBranchesInput(root);
  if (!input) return;
  mountPicker(root, input);
}

export function installInputXmlDxfBranchPicker(root = globalThis.document) {
  if (!root?.querySelector || !globalThis.document) return () => {};
  refresh(root);
  if (typeof MutationObserver !== 'function') return () => {};
  const observer = new MutationObserver(() => refresh(root));
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
