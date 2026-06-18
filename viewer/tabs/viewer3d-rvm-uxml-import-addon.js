import { emit } from '../core/event-bus.js';
import { RuntimeEvents } from '../contracts/runtime-events.js';
import { notify } from '../diagnostics/notification-center.js';
import { AvevaJsonLoader } from '../rvm/AvevaJsonLoader.js';
import {
  convertUxmlDocumentToAvevaHierarchy,
  isUxmlDocument,
} from '../rvm/UxmlToAvevaJsonAdapter.js?v=20260618-uxml-port-bore-contract-1';

const FLAG = '__RVM_UXML_IMPORT_ADDON_INSTALLED__';

function lowerName(fileOrName = '') {
  return String(fileOrName?.name || fileOrName || '').toLowerCase();
}

function isUxmlName(name = '') {
  const lower = lowerName(name);
  return lower.endsWith('.uxml') || lower.endsWith('.uxml.json') || lower.includes('.uxml.');
}

function isJsonLikeName(name = '') {
  const lower = lowerName(name);
  return lower.endsWith('.json') || lower.endsWith('.uxml') || lower.includes('.uxml.');
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

function unwrapUxmlDocument(value) {
  if (isUxmlDocument(value)) return value;
  const candidates = [
    value?.uxml,
    value?.uxmlDocument,
    value?.document,
    value?.data,
    value?.payload,
  ];
  return candidates.find((candidate) => isUxmlDocument(candidate)) || null;
}

async function loadUxmlDocument(doc, fileName) {
  const hierarchy = convertUxmlDocumentToAvevaHierarchy(doc, { fileName });

  emit(RuntimeEvents.FILE_LOADED, {
    name: `${fileName}.aveva-json`,
    source: 'rvm-uxml-import-addon',
    payload: hierarchy,
    kind: 'aveva-json',
    sourceKind: 'uxml',
    uxml: doc,
  });

  // Use the same loader/event contract as managed_stage.json. AvevaJsonLoader.load()
  // emits RVM_MODEL_LOADED, and the active 3D RVM tab owns setModel/tree/search/status.
  const loader = new AvevaJsonLoader();
  await loader.load(hierarchy, { sourceKind: 'uxml', fileName }, makeSession());

  const componentCount = Array.isArray(doc.components) ? doc.components.length : 0;
  setStatusText(`UXML loaded | Branches ${hierarchy.length.toLocaleString()} | Components ${componentCount.toLocaleString()}`);
  notify({
    type: 'info',
    message: `Loaded UXML: ${hierarchy.length} branch(es), ${componentCount} component(s).`,
  });
}

async function loadUxml(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const doc = unwrapUxmlDocument(parsed);
  if (!doc) throw new Error(`${file.name} is not a UXML topology document.`);
  await loadUxmlDocument(doc, file.name);
}

function emitStandardJsonImport(fileName, json) {
  const isBundleManifest = Boolean(json) && typeof json === 'object' && json.schemaVersion === 'rvm-bundle/v1';
  emit(RuntimeEvents.FILE_LOADED, {
    name: fileName,
    source: 'rvm-tab',
    payload: json,
    kind: isBundleManifest ? 'bundle' : 'aveva-json',
  });
}

async function importJsonLikeFiles(files = []) {
  let uxmlCount = 0;
  let passthroughCount = 0;

  for (const file of files) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const doc = unwrapUxmlDocument(parsed);
    if (doc) {
      uxmlCount += 1;
      await loadUxmlDocument(doc, file.name);
    } else {
      passthroughCount += 1;
      emitStandardJsonImport(file.name, parsed);
    }
  }

  if (uxmlCount && passthroughCount) {
    notify({ type: 'warning', message: 'Imported UXML and passed through non-UXML JSON file(s).' });
  }
}

function installInputHook() {
  document.addEventListener('change', async (event) => {
    const input = event.target?.closest?.('#rvm-universal-file-input');
    if (!input) return;
    const files = Array.from(input.files || []);
    const jsonLikeFiles = files.filter((file) => isJsonLikeName(file.name) || isUxmlName(file.name));
    if (!jsonLikeFiles.length) return;

    // Capture JSON/UXML before the generic RVM tab handler. Without content sniffing,
    // a renamed UXML sidecar can fall through as generic JSON and render as Node-1.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    try {
      await importJsonLikeFiles(jsonLikeFiles);
      const skipped = files.length - jsonLikeFiles.length;
      if (skipped > 0) notify({ type: 'warning', message: 'Import UXML/JSON separately from RVM/GLB/STP files.' });
    } catch (err) {
      notify({ type: 'error', message: `UXML/JSON import failed: ${err.message || err}` });
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
