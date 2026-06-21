import { RuntimeEvents } from '../contracts/runtime-events.js';
import { emit } from '../core/event-bus.js';
import { setActiveTab, state, updateRvmPcfExtractState } from '../core/state.js';
import {
  buildRvmJsonPcfRequestPayload,
  normalizeRvmJsonPcfRequestPayload,
} from './rvm-json-pcf-trigger-helpers.js';

const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-json-pcf-trigger-bridge-v1');
const ROOT_BOUND_ATTR = 'data-rvm-json-pcf-trigger-bound';
const SECTION_ATTR = 'data-rvm-json-pcf-trigger-section';

function selectedCanonicalIdsFromViewer() {
  const viewer = globalThis.__3D_RVM_VIEWER__;
  const ids = viewer?.selection?.getSelectedCanonicalIds?.();
  if (Array.isArray(ids) && ids.length) return ids.filter(Boolean).map(String);

  const stateIds = state?.rvm?.selection?.canonicalObjectIds;
  if (Array.isArray(stateIds) && stateIds.length) return stateIds.filter(Boolean).map(String);

  const single = state?.rvm?.selection?.canonicalObjectId;
  return single ? [String(single)] : [];
}

function hasRvmPcfSourceIndex() {
  return Array.isArray(state?.rvm?.index?.nodes) && state.rvm.index.nodes.length > 0;
}

function setStatus(root, message, isWarning = false) {
  const status = root?.querySelector?.('#rvm-sb-msg');
  if (!status) return;
  status.textContent = message;
  status.style.color = isWarning ? '#ffcf70' : '';
}

function buildSection() {
  const section = document.createElement('div');
  section.className = 'rvm-ribbon-section rvm-json-pcf-trigger-section';
  section.setAttribute(SECTION_ATTR, 'true');
  section.innerHTML = `
    <span class="rvm-ribbon-label">PCF</span>
    <div class="rvm-ribbon-button-row">
      <button class="rvm-btn rvm-json-pcf-trigger-btn" type="button" data-rvm-json-pcf-scope="selected" title="Convert selected RVM geometry to PCF">Sel → PCF</button>
      <button class="rvm-btn rvm-json-pcf-trigger-btn" type="button" data-rvm-json-pcf-scope="full" title="Convert full RVM model to PCF">Full → PCF</button>
    </div>
  `;
  return section;
}

function installSection(root) {
  if (!root || root.getAttribute(ROOT_BOUND_ATTR) === 'true') return;
  const ribbon = root.querySelector?.('.geo-top-ribbon');
  if (!ribbon) return;

  root.setAttribute(ROOT_BOUND_ATTR, 'true');
  if (!ribbon.querySelector(`[${SECTION_ATTR}]`)) {
    const section = buildSection();
    const search = ribbon.querySelector('.rvm-ribbon-search');
    if (search) ribbon.insertBefore(section, search);
    else ribbon.appendChild(section);
  }

  ribbon.querySelectorAll('[data-rvm-json-pcf-scope]').forEach((button) => {
    if (button.dataset.rvmJsonPcfBound === 'true') return;
    button.dataset.rvmJsonPcfBound = 'true';
    button.addEventListener('click', () => triggerJsonRvmPcf(root, button.dataset.rvmJsonPcfScope || 'full'));
  });
}

function triggerJsonRvmPcf(root, requestedScope) {
  const selectedCanonicalIds = requestedScope === 'selected' ? selectedCanonicalIdsFromViewer() : [];
  if (requestedScope === 'selected' && selectedCanonicalIds.length === 0) {
    setStatus(root, 'JSON/RVM → PCF: select geometry first, or use Full → PCF.', true);
    return;
  }

  const payload = buildRvmJsonPcfRequestPayload({
    appState: state,
    overrides: {
      scope: requestedScope === 'selected' ? 'selected' : 'full',
      selectedCanonicalIds,
      openWorkflow: true,
      requestedPanel: 'workflow',
      requestedPhase: 'preview',
    },
  });
  const normalized = normalizeRvmJsonPcfRequestPayload({ payload, appState: state });

  if (!state.rvm.selection) state.rvm.selection = { canonicalObjectId: null, canonicalObjectIds: [], renderObjectIds: [] };
  state.rvm.selection.canonicalObjectIds = [...selectedCanonicalIds];
  state.rvm.selection.canonicalObjectId = selectedCanonicalIds[0] || null;

  updateRvmPcfExtractState({
    workflowMode: normalized.workflowMode,
    workflowAdapterId: normalized.workflowAdapterId,
    sourceKind: normalized.sourceKind,
    sourceStatus: hasRvmPcfSourceIndex() ? 'ready' : 'missing-index',
    sourceLabel: hasRvmPcfSourceIndex()
      ? `Current RVM viewer model (${state.rvm.index.nodes.length} node(s))`
      : 'Current RVM viewer model (index not available)',
    scope: normalized.scope,
    selectedCanonicalIds: normalized.selectedCanonicalIds,
    activeWorkflowPhase: normalized.activeWorkflowPhase,
    requestedPanel: normalized.requestedPanel,
    lastRequestedAt: new Date().toISOString(),
  }, 'rvm-viewer-json-pcf-trigger');

  setStatus(root, hasRvmPcfSourceIndex()
    ? `JSON/RVM → PCF requested for ${normalized.scope === 'selected' ? `${selectedCanonicalIds.length} selected node(s)` : 'full model'}.`
    : 'JSON/RVM → PCF opened, but no RVM index is available for conversion yet.', !hasRvmPcfSourceIndex());

  setActiveTab('rvm-json-pcf');
  setTimeout(() => emit(RuntimeEvents.RVM_EXTRACT_PCF_REQUESTED, payload), 75);
  setTimeout(() => emit(RuntimeEvents.RVM_EXTRACT_PCF_REQUESTED, payload), 250);
}

function scan() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll?.('[data-rvm-viewer]').forEach(installSection);
}

export function installRvmJsonPcfTriggerBridge() {
  if (typeof document === 'undefined') return;
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  scan();
  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(scan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  globalThis.__PCF_GLB_RVM_JSON_PCF_TRIGGER_BRIDGE__ = {
    version: '20260621-rvm-json-pcf-trigger-1',
    scan,
    trigger(scope = 'full') {
      const root = document.querySelector('[data-rvm-viewer]');
      if (root) triggerJsonRvmPcf(root, scope);
    },
  };
}
