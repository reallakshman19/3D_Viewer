import { RVM_STAGE_SCHEMA } from '../stage/contracts/RvmStageModelContract.js';
import { RuntimeEvents } from '../contracts/runtime-events.js';
import { on } from '../core/event-bus.js';
import { renderViewer3DJson } from './viewer3d-json-tab-renderer.js';

const TAB_ID = 'viewer3d-json';
const TAB_LABEL = '3D Json Viewer';
const OPEN_STAGE_JSON_LABEL = 'Open Stage JSON';
const OPEN_RVM_TITLE = 'Phase 3: browser stage worker';

function resolveDocument(root) {
  if (root?.nodeType === 9) return root;
  return root?.ownerDocument || document;
}

function icon(doc) {
  const span = doc.createElement('span');
  span.className = 'app-tab-icon app-tab-icon-json-stage';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h9l5 5v11H5z"/><path d="M14 4v5h5"/><path d="M8 13h8M8 17h5"/></g></svg>';
  return span;
}

function findViewerSection(doc) {
  const sections = [...doc.querySelectorAll('.app-nav-group')];
  return sections.find((section) => section.querySelector('.app-nav-group-label')?.textContent.trim() === 'Viewers') || sections[0] || doc.querySelector('.app-nav');
}

function createButton(doc, onClick) {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'app-tab app-tab-json-viewer';
  button.dataset.tab = TAB_ID;
  button.dataset.schema = RVM_STAGE_SCHEMA;
  button.title = `${OPEN_STAGE_JSON_LABEL}; Open RVM disabled: ${OPEN_RVM_TITLE}`;
  button.append(icon(doc));
  const label = doc.createElement('span');
  label.textContent = TAB_LABEL;
  button.appendChild(label);
  button.addEventListener('click', onClick);
  return button;
}

export function installViewer3dJsonTab(rootDocument = document) {
  const doc = resolveDocument(rootDocument);
  let cleanupRenderer = null;
  let installedButton = null;

  const activate = () => {
    const content = doc.querySelector('.app-content');
    if (!content) return;
    doc.querySelectorAll('.app-tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.tab === TAB_ID));
    content.dataset.activeTab = TAB_ID;
    cleanupRenderer?.();
    cleanupRenderer = null;
    cleanupRenderer = renderViewer3DJson(content);
  };

  const ensureButton = () => {
    const nav = doc.querySelector('.app-nav');
    if (!nav) return;
    const existing = nav.querySelector(`[data-tab="${TAB_ID}"]`);
    if (existing) {
      installedButton = existing;
      return;
    }
    const section = findViewerSection(doc);
    if (!section) return;
    installedButton = createButton(doc, activate);
    section.appendChild(installedButton);
  };

  ensureButton();
  const onReady = () => ensureButton();
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', onReady, { once: true });
  const offRendered = on(RuntimeEvents.TAB_RENDERED, () => {
    cleanupRenderer?.();
    cleanupRenderer = null;
    ensureButton();
  });

  return () => {
    offRendered?.();
    cleanupRenderer?.();
    cleanupRenderer = null;
    installedButton?.remove();
    if (doc.readyState === 'loading') doc.removeEventListener('DOMContentLoaded', onReady);
  };
}
