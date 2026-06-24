/**
 * XML->CII(2019) Workflow bridge boundary.
 *
 * Workflow 1 and Workflow 2 UI modules import this boundary instead of importing
 * legacy-adapter.js directly. The legacy bridge remains the current shared state
 * provider until the workflow state owner is fully extracted, but the dependency
 * is contained here under neutral Workflow naming.
 */

import { getXmlCiiPhaseBridge } from './legacy-adapter.js?v=20260624-workflow1-workflow2-1';

const XML_CII_OBSOLETE_PIPING_CLASS_MASTER = 'Piping_class_master.json';
const XML_CII_WORKFLOW_SNAPSHOT_TTL_MS = 5000;

let cachedBridge = null;
let cachedSafeBridge = null;
let snapshotCache = { key: '', value: null, createdAt: 0 };
let snapshotGeneration = 0;

function nowMs() {
  return Date.now ? Date.now() : 0;
}

function phaseKey(root) {
  return root?.dataset?.selectedPhase || 'regex';
}

function snapshotKey(root) {
  // Master tabs only change the visible active master. The legacy snapshot already
  // contains all master metadata, so reusing the Import Masters snapshot across
  // active-master tab clicks avoids rebuilding all column maps on every click.
  const phase = phaseKey(root);
  return `${snapshotGeneration}|${phase}`;
}

function clearSnapshotCache() {
  snapshotGeneration += 1;
  snapshotCache = { key: '', value: null, createdAt: 0 };
}

function cachedSnapshot(base, root) {
  if (!base?.getPopupSnapshot) return null;
  const key = snapshotKey(root);
  const createdAt = nowMs();
  if (snapshotCache.key === key && snapshotCache.value && createdAt - snapshotCache.createdAt < XML_CII_WORKFLOW_SNAPSHOT_TTL_MS) {
    return snapshotCache.value;
  }
  const value = base.getPopupSnapshot(root);
  if (value) snapshotCache = { key, value, createdAt };
  return value;
}

function wrapInvalidatingAsync(base, methodName) {
  const original = base?.[methodName]?.bind(base);
  if (!original) return undefined;
  return async (...args) => {
    const result = await original(...args);
    clearSnapshotCache();
    return result;
  };
}

function wrapInvalidatingSync(base, methodName) {
  const original = base?.[methodName]?.bind(base);
  if (!original) return undefined;
  return (...args) => {
    const result = original(...args);
    clearSnapshotCache();
    return result;
  };
}

function xmlCiiWorkflowWrapBridge(base) {
  if (!base) return null;
  if (base === cachedBridge && cachedSafeBridge) return cachedSafeBridge;

  const safe = Object.create(base);
  Object.assign(safe, base);
  safe.__xmlCiiWorkflowSafeBridge = true;

  // The popup's old legacy preload path probes the removed aggregate
  // docs/Masters/Piping_class_master.json. Default Material/Weight autoload is
  // owned by xml-cii-master-autoload-patch.js, and specwise piping class rows are
  // resolved from docs/Masters/SpecwisePipingClass by line/spec context. Do not
  // call the stale aggregate preload from Workflow 1/2 popups.
  safe.ensureDefaultMastersLoaded = async () => null;

  const originalLoadDefault = base.loadPopupDefaultMaster?.bind(base);
  safe.loadPopupDefaultMaster = async (masterKey) => {
    if (masterKey === 'pipingClass') return null;
    const result = await originalLoadDefault?.(masterKey);
    clearSnapshotCache();
    return result ?? null;
  };

  safe.getPopupSnapshot = (root) => cachedSnapshot(base, root);
  safe.importPopupMasterFile = wrapInvalidatingAsync(base, 'importPopupMasterFile');
  safe.autoMapPopupMaster = wrapInvalidatingSync(base, 'autoMapPopupMaster');
  safe.setPopupMasterField = wrapInvalidatingSync(base, 'setPopupMasterField');
  safe.savePopupMaster = wrapInvalidatingSync(base, 'savePopupMaster');
  safe.clearPopupMaster = wrapInvalidatingSync(base, 'clearPopupMaster');
  safe.setPopupConfigValue = wrapInvalidatingSync(base, 'setPopupConfigValue');
  safe.setPopupRunOption = wrapInvalidatingSync(base, 'setPopupRunOption');
  safe.savePopupConfigText = wrapInvalidatingSync(base, 'savePopupConfigText');
  safe.importPopupConfigText = wrapInvalidatingSync(base, 'importPopupConfigText');
  safe.applyPopupPreferredWeights = wrapInvalidatingSync(base, 'applyPopupPreferredWeights');

  const originalNotify = base.notify?.bind(base);
  safe.notify = (message, options = {}) => {
    const text = `${message || ''} ${options?.message || ''} ${options?.url || ''}`;
    if (text.includes(XML_CII_OBSOLETE_PIPING_CLASS_MASTER)) return null;
    return originalNotify?.(message, options) ?? null;
  };

  cachedBridge = base;
  cachedSafeBridge = safe;
  clearSnapshotCache();
  return safe;
}

export function xmlCiiWorkflowGetBridge() {
  return xmlCiiWorkflowWrapBridge(getXmlCiiPhaseBridge?.() || null);
}

export function xmlCiiWorkflowGetSnapshot(root) {
  return xmlCiiWorkflowGetBridge()?.getPopupSnapshot?.(root) || null;
}

export function xmlCiiWorkflowSetConfigValue(path, value, valueType = 'text') {
  return xmlCiiWorkflowGetBridge()?.setPopupConfigValue?.(path, value, valueType);
}

export function xmlCiiWorkflowSetMasterField(masterKey, fieldKey, value) {
  return xmlCiiWorkflowGetBridge()?.setPopupMasterField?.(masterKey, fieldKey, value);
}

export function xmlCiiWorkflowInvalidateSnapshot() {
  clearSnapshotCache();
}

export function xmlCiiWorkflowClosePopup() {
  return xmlCiiWorkflowGetBridge()?.closePopup?.();
}
