import { emit } from '../core/event-bus.js';
import { RuntimeEvents } from '../contracts/runtime-events.js';
import { notify } from '../diagnostics/notification-center.js';
import { AvevaJsonLoader } from '../rvm/AvevaJsonLoader.js';
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

function makeSession() {
  return {
    update() {},
    complete() {},
    fail() {},
    isStale() { return false; },
    isCancelled() { return false; },
  };
}

function setStatusText(message) {
  const bottom = document.querySelector('#rvm-sb-msg');
  if (bottom) bottom.textContent = message;
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

  // Use the same loader/event contract as managed_stage.json. AvevaJsonLoader.load()
  // emits RVM_MODEL_LOADED, and the active 3D RVM tab owns setModel/tree/search/status.
  const loader = new AvevaJsonLoader();
  await loader.load(hierarchy, { sourceKind: 'uxml', fileName: file.name }, makeSession());

  const componentCount = Array.isArray(doc.components) ? doc.components.length : 0;
  setStatusText(`UXML loaded | Branches ${hierarchy.length.toLocaleString()} | Components ${componentCount.toLocaleString()}`);
  notify({
    type: 'info',
    message: `Loaded UXML: ${hierarchy.length} branch(es), ${componentCount} component(s).`,
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
