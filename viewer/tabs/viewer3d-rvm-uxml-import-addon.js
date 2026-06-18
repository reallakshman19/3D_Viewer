import { emit } from '../core/event-bus.js';
import { RuntimeEvents } from '../contracts/runtime-events.js';
import { notify } from '../diagnostics/notification-center.js';
import { AvevaJsonLoader } from '../rvm/AvevaJsonLoader.js';
import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260518-statusbar-theme-12';
import {
  convertUxmlDocumentToAvevaHierarchy,
  isUxmlDocument,
} from '../rvm/UxmlToAvevaJsonAdapter.js';

const FLAG = '__RVM_UXML_IMPORT_ADDON_INSTALLED__';
const VIEWER_KEY = '__RVM_UXML_IMPORT_VIEWER__';

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

function currentThemePreset() {
  try {
    const select = document.querySelector('#rvm-theme-select');
    if (select?.value) return select.value;
  } catch {}
  return 'NavisDark';
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

function clearViewportForStandaloneViewer(viewport) {
  if (!viewport) return;
  try {
    window[VIEWER_KEY]?.dispose?.();
  } catch {}
  window[VIEWER_KEY] = null;
  viewport.innerHTML = '';
}

function renderSimpleHierarchy(hierarchy) {
  const tree = document.querySelector('#rvm-hierarchy-tree');
  if (!tree) return;
  const escape = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const rows = [];
  for (const branch of hierarchy) {
    const children = Array.isArray(branch.children) ? branch.children : [];
    rows.push(`
      <li class="rvm-tree-item rvm-uxml-tree-branch" role="treeitem">
        <span class="rvm-tree-label">${escape(branch.name || 'UXML Branch')}</span>
        <span class="rvm-tree-meta">${children.length} item(s)</span>
        <ul role="group">
          ${children.slice(0, 250).map((child) => `
            <li class="rvm-tree-item rvm-uxml-tree-child" role="treeitem">
              <span class="rvm-tree-label">${escape(child.name || child.type || 'UXML Component')}</span>
              <span class="rvm-tree-meta">${escape(child.type || child.attributes?.TYPE || '')}</span>
            </li>
          `).join('')}
          ${children.length > 250 ? `<li class="rvm-tree-item rvm-uxml-tree-child muted">+ ${children.length - 250} more</li>` : ''}
        </ul>
      </li>
    `);
  }
  tree.innerHTML = rows.join('');
}

function setStatusText(message) {
  const bottom = document.querySelector('#rvm-sb-msg');
  if (bottom) bottom.textContent = message;
  const objectChip = document.querySelector('[data-rvm-status-chip="objects"]');
  if (objectChip) objectChip.textContent = message;
}

async function renderUxmlHierarchyInRvmViewer(hierarchy, doc, fileName) {
  const viewport = document.querySelector('.rvm-tab-root #rvm-viewport') || document.querySelector('#rvm-viewport');
  if (!viewport) throw new Error('3D RVM viewport is not available. Open the 3D RVM Viewer tab first.');

  const loader = new AvevaJsonLoader();
  const payload = await loader.load(hierarchy, {}, makeSession());
  const scene = payload?.gltf?.scene;
  if (!scene) throw new Error('UXML conversion did not create a renderable RVM scene.');

  clearViewportForStandaloneViewer(viewport);
  const viewer = new RvmViewer3D(viewport, {
    identityMap: payload.identityMap,
    themePreset: currentThemePreset(),
  });
  window[VIEWER_KEY] = viewer;
  viewer.setModel(scene, payload.manifest?.runtime?.upAxis || 'Z');
  viewer.fitAll?.();

  renderSimpleHierarchy(hierarchy);
  const componentCount = Array.isArray(doc.components) ? doc.components.length : 0;
  setStatusText(`UXML loaded | Branches ${hierarchy.length.toLocaleString()} | Components ${componentCount.toLocaleString()}`);
  emit(RuntimeEvents.RVM_MODEL_LOADED, {
    ...payload,
    source: 'rvm-uxml-import-addon',
    sourceKind: 'uxml',
    uxml: doc,
    fileName,
  });
}

async function loadUxml(file) {
  const text = await file.text();
  const doc = JSON.parse(text);
  if (!isUxmlDocument(doc)) throw new Error(`${file.name} is not a UXML topology document.`);
  const hierarchy = convertUxmlDocumentToAvevaHierarchy(doc, { fileName: file.name });

  // Keep the legacy event for any future listeners, but do not rely on it for rendering.
  emit(RuntimeEvents.FILE_LOADED, {
    name: `${file.name}.aveva-json`,
    source: 'rvm-uxml-import-addon',
    payload: hierarchy,
    kind: 'aveva-json',
    sourceKind: 'uxml',
    uxml: doc,
  });

  await renderUxmlHierarchyInRvmViewer(hierarchy, doc, file.name);

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
