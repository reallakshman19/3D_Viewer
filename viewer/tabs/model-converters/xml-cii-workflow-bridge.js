/**
 * XML->CII(2019) Workflow bridge boundary.
 *
 * Workflow 1 and Workflow 2 UI modules import this boundary instead of importing
 * legacy-adapter.js directly. The legacy bridge remains the current shared state
 * provider until the workflow state owner is fully extracted, but the dependency
 * is contained here under neutral Workflow naming.
 */

import { getXmlCiiPhaseBridge } from './legacy-adapter.js?v=20260624-startup-autoload-noise-1';

const XML_CII_OBSOLETE_PIPING_CLASS_MASTER = 'Piping_class_master.json';
const XML_CII_WORKFLOW_SNAPSHOT_TTL_MS = 5000;
const XSD_KEY = 'condenseRigidXsd';
const XSD_SNAKE_KEY = 'condense_rigid_xsd';
const RESOLVED_KEY = 'splitCondensedValveFlange';
const RESOLVED_SNAKE_KEY = 'split_condensed_valve_flange';

let cachedBridge = null;
let cachedSafeBridge = null;
let snapshotCache = { key: '', value: null, createdAt: 0 };
let snapshotGeneration = 0;

function nowMs() {
  return Date.now ? Date.now() : 0;
}

function bool(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === 'number') return value !== 0;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function parseConfigText(text) {
  try {
    const parsed = JSON.parse(String(text || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
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

function normaliseCondenseConfig(config) {
  const cfg = config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  const xsd = bool(cfg[XSD_KEY]) || bool(cfg[XSD_SNAKE_KEY]);
  const resolved = bool(cfg[RESOLVED_KEY]) || bool(cfg[RESOLVED_SNAKE_KEY]);
  cfg[XSD_KEY] = xsd;
  cfg[XSD_SNAKE_KEY] = xsd;
  cfg[RESOLVED_KEY] = resolved;
  cfg[RESOLVED_SNAKE_KEY] = resolved;
  return cfg;
}

function bridgeConfig(base) {
  return normaliseCondenseConfig(parseConfigText(base?.exportPopupConfigText?.() || '{}'));
}

function writeBridgeConfig(base, config) {
  base?.importPopupConfigText?.(JSON.stringify(normaliseCondenseConfig(config || {}), null, 2));
  clearSnapshotCache();
}

function mergeCondenseBoolKeys(editedText, bools = {}) {
  const cfg = normaliseCondenseConfig(parseConfigText(editedText));
  if (Object.prototype.hasOwnProperty.call(bools, XSD_KEY) || Object.prototype.hasOwnProperty.call(bools, XSD_SNAKE_KEY)) {
    const enabled = bool(bools[XSD_KEY]) || bool(bools[XSD_SNAKE_KEY]);
    cfg[XSD_KEY] = enabled;
    cfg[XSD_SNAKE_KEY] = enabled;
  }
  if (Object.prototype.hasOwnProperty.call(bools, RESOLVED_KEY) || Object.prototype.hasOwnProperty.call(bools, RESOLVED_SNAKE_KEY)) {
    const enabled = bool(bools[RESOLVED_KEY]) || bool(bools[RESOLVED_SNAKE_KEY]);
    cfg[RESOLVED_KEY] = enabled;
    cfg[RESOLVED_SNAKE_KEY] = enabled;
  }
  return JSON.stringify(cfg, null, 2);
}

function hydrateCondenseSnapshot(snapshot, base) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  const cfg = bridgeConfig(base);
  snapshot.run = snapshot.run && typeof snapshot.run === 'object' ? snapshot.run : {};
  snapshot.run.options = snapshot.run.options && typeof snapshot.run.options === 'object' ? snapshot.run.options : {};
  snapshot.run.options[XSD_KEY] = bool(snapshot.run.options[XSD_KEY]) || cfg[XSD_KEY];
  snapshot.run.options[RESOLVED_KEY] = bool(snapshot.run.options[RESOLVED_KEY]) || bool(snapshot.run.options[RESOLVED_SNAKE_KEY]) || cfg[RESOLVED_KEY];
  snapshot.config = snapshot.config && typeof snapshot.config === 'object' ? snapshot.config : {};
  snapshot.config[XSD_KEY] = cfg[XSD_KEY];
  snapshot.config[RESOLVED_KEY] = cfg[RESOLVED_KEY];
  return snapshot;
}

function writeCondenseRunOption(base, key, enabled) {
  const cfg = bridgeConfig(base);
  if (key === XSD_KEY || key === XSD_SNAKE_KEY) {
    cfg[XSD_KEY] = !!enabled;
    cfg[XSD_SNAKE_KEY] = !!enabled;
  }
  if (key === RESOLVED_KEY || key === RESOLVED_SNAKE_KEY) {
    cfg[RESOLVED_KEY] = !!enabled;
    cfg[RESOLVED_SNAKE_KEY] = !!enabled;
  }
  writeBridgeConfig(base, cfg);
}

function sanitizeSnapshot(value) {
  if (!value || typeof value !== 'object') return value;
  const masters = Array.isArray(value.masterDefs) ? value.masterDefs : [];
  for (const master of masters) {
    if (master?.key === 'pipingClass' && typeof master.defaultUrl === 'string' && master.defaultUrl.includes(XML_CII_OBSOLETE_PIPING_CLASS_MASTER)) {
      master.defaultUrl = '';
    }
  }
  return value;
}

function cachedSnapshot(base, root) {
  if (!base?.getPopupSnapshot) return null;
  const key = snapshotKey(root);
  const createdAt = nowMs();
  if (snapshotCache.key === key && snapshotCache.value && createdAt - snapshotCache.createdAt < XML_CII_WORKFLOW_SNAPSHOT_TTL_MS) {
    return snapshotCache.value;
  }
  const value = hydrateCondenseSnapshot(sanitizeSnapshot(base.getPopupSnapshot(root)), base);
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
  // owned by xml-cii-master-autoload-lite.js, and specwise piping class rows are
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

  const originalSetRunOption = base.setPopupRunOption?.bind(base);
  safe.setPopupRunOption = (key, value, type) => {
    if (key === XSD_KEY || key === XSD_SNAKE_KEY || key === RESOLVED_KEY || key === RESOLVED_SNAKE_KEY) {
      writeCondenseRunOption(base, key, !!value);
    }
    const result = originalSetRunOption?.(key, value, type);
    clearSnapshotCache();
    return result;
  };

  const originalSaveConfigText = base.savePopupConfigText?.bind(base);
  safe.savePopupConfigText = (editedText, bools) => {
    const nextText = mergeCondenseBoolKeys(editedText, bools || {});
    const result = originalSaveConfigText?.(nextText, bools);
    clearSnapshotCache();
    return result;
  };

  safe.getPopupSnapshot = (root) => cachedSnapshot(base, root);
  safe.importPopupMasterFile = wrapInvalidatingAsync(base, 'importPopupMasterFile');
  safe.autoMapPopupMaster = wrapInvalidatingSync(base, 'autoMapPopupMaster');
  safe.setPopupMasterField = wrapInvalidatingSync(base, 'setPopupMasterField');
  safe.savePopupMaster = wrapInvalidatingSync(base, 'savePopupMaster');
  safe.clearPopupMaster = wrapInvalidatingSync(base, 'clearPopupMaster');
  safe.setPopupConfigValue = wrapInvalidatingSync(base, 'setPopupConfigValue');
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
