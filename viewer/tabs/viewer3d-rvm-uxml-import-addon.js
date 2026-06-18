import { emit } from '../core/event-bus.js';
import { RuntimeEvents } from '../contracts/runtime-events.js';
import { notify } from '../diagnostics/notification-center.js';
import {
  convertUxmlDocumentToAvevaHierarchy,
  isUxmlDocument,
} from '../rvm/UxmlToAvevaJsonAdapter.js';

const FLAG = '__RVM_UXML_IMPORT_ADDON_INSTALLED__';

function isUxmlName(name = '') {
  const lower = String(name || '').toLowerCase();
  return lower.endsWith('.uxml') || lower.endsWith('.uxml.json') || lower.includes('.uxml.');
}

function patchFileInput() {
  const input = document.querySelector('#rvm-universal-file-input');
  if (!input) return;
  const accept = String(input.getAttribute('accept') || '');
  if (!accept.includes('.uxml')) input.setAttribute('accept', `${accept},.uxml,.uxml.json`);
  const label = input.closest('label');
  if (label) label.title = 'Load dataset (RVM, REV, JSON Bundle, ATT TXT, GLB, UXML)';
}

async function loadUxml(file) {
  const text = await file.text();
  const doc = JSON.parse(text);
  if (!isUxmlDocument(doc)) throw new Error(`${file.name} is not a UXML topology document.`);
  const hierarchy = convertUxmlDocumentToAvevaHierarchy(doc, { fileName: file.name });
  emit(RuntimeEvents.FILE_LOADED, {
    name: `${file.name}.aveva-json`,
    source: 'rvm-uxml-import-addon',
    payload: hierarchy,
    kind: 'aveva-json',
    sourceKind: 'uxml',
    uxml: doc,
  });
  notify({
    type: 'info',
    message: `Loaded UXML: ${hierarchy.length} branch(es), ${doc.components?.length || 0} component(s).`,
  });
}

function installInputHook() {
  document.addEventListener('change', async (event) => {
    const input = event.target?.closest?.('#rvm-universal-file-input');
    if (!input) return;
    const files = Array.from(input.files || []);
    const uxmlFiles = files.filter((file) => isUxmlName(file.name));
    if (!uxmlFiles.length) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    try {
      for (const file of uxmlFiles) await loadUxml(file);
      const skipped = files.length - uxmlFiles.length;
      if (skipped > 0) notify({ type: 'warning', message: 'Import UXML separately from non-UXML files.' });
    } catch (err) {
      notify({ type: 'error', message: `UXML import failed: ${err.message || err}` });
    } finally {
      input.value = '';
    }
  }, true);
}

export function installRvmUxmlImportAddon() {
  if (window[FLAG]) return;
  window[FLAG] = true;
  patchFileInput();
  window.addEventListener('rvm-tab-ready', patchFileInput);
  new MutationObserver(patchFileInput).observe(document.body, { childList: true, subtree: true });
  installInputHook();
}

installRvmUxmlImportAddon();
