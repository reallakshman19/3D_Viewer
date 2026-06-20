import { getXmlCiiPhaseBridge } from './legacy-adapter.js?v=20260620-rating-runtime-1';

const FLAG = '__xmlCiiMasterLifecycleGuard_v1';
const CONFIG_SELECTOR = '[data-option-key="supportConfigJson"]';

const MASTER_PATHS = Object.freeze([
  Object.freeze({ name: 'linelist', label: 'Line List', section: 'linelist', rows: 'masterRows', fieldMap: 'fieldMap' }),
  Object.freeze({ name: 'pipingClass', label: 'Piping Class', section: 'pipingClass', rows: 'masterRows', fieldMap: 'fieldMap' }),
  Object.freeze({ name: 'material', label: 'Material Map', section: 'material', rows: 'mapRows', fieldMap: 'fieldMap' }),
  Object.freeze({ name: 'weight', label: 'Valve Weights', section: 'weight', rows: 'masterRows', fieldMap: 'fieldMap' }),
]);

function ready() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseJson(value) {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function configInput() {
  return document.querySelector(CONFIG_SELECTOR);
}

function rowCount(config, def) {
  const rows = config?.[def.section]?.[def.rows];
  return Array.isArray(rows) ? rows.length : 0;
}

function sectionClone(config, def) {
  const section = config?.[def.section];
  return isPlainObject(section) ? clone(section) : null;
}

function state() {
  return window[FLAG];
}

function readBridgeConfig() {
  const exporter = state().original?.exportPopupConfigText;
  if (typeof exporter === 'function') {
    const exported = parseJson(exporter());
    if (exported) return exported;
  }
  return parseJson(configInput()?.value) || {};
}

function rememberNonEmpty(config, source = 'unknown') {
  if (!config) return;
  const st = state();
  for (const def of MASTER_PATHS) {
    const rows = config?.[def.section]?.[def.rows];
    if (!Array.isArray(rows) || rows.length <= 0) continue;
    const section = sectionClone(config, def);
    if (!section) continue;
    st.sessionMasters[def.name] = section;
    st.lastSource[def.name] = source;
  }
}

function removeRememberedMaster(masterName) {
  const st = state();
  delete st.sessionMasters[masterName];
  delete st.lastSource[masterName];
}

function applyPreservedMasters(config, reason, explicitEmptyMaster = '') {
  const st = state();
  const next = isPlainObject(config) ? clone(config) : {};
  let changed = false;
  const restored = [];

  for (const def of MASTER_PATHS) {
    if (explicitEmptyMaster === def.name) continue;
    if (rowCount(next, def) > 0) continue;

    const remembered = st.sessionMasters[def.name];
    const rememberedRows = remembered?.[def.rows];
    if (!Array.isArray(rememberedRows) || rememberedRows.length <= 0) continue;

    const current = isPlainObject(next[def.section]) ? next[def.section] : {};
    next[def.section] = {
      ...clone(remembered),
      ...current,
      [def.rows]: clone(rememberedRows),
    };
    if (!isPlainObject(next[def.section][def.fieldMap]) && isPlainObject(remembered[def.fieldMap])) {
      next[def.section][def.fieldMap] = clone(remembered[def.fieldMap]);
    }
    restored.push({ master: def.name, rows: rememberedRows.length, source: st.lastSource[def.name] || 'session' });
    changed = true;
  }

  if (changed) {
    next._xmlCiiMasterLifecycle = {
      ...(isPlainObject(next._xmlCiiMasterLifecycle) ? next._xmlCiiMasterLifecycle : {}),
      lastGuardReason: reason,
      lastGuardAt: new Date().toISOString(),
      restored,
    };
  }
  return { config: next, changed, restored };
}

function writeThroughBridge(config) {
  const text = JSON.stringify(config, null, 2);
  const importer = state().original?.importPopupConfigText;
  if (typeof importer === 'function') {
    importer(text);
    return true;
  }

  const input = configInput();
  if (!input || input.value === text) return false;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function snapshotFromOriginal() {
  const getter = state().original?.getPopupSnapshot;
  if (typeof getter !== 'function') return null;
  try {
    return getter(configInput());
  } catch {
    return null;
  }
}

function debugSnapshot(activeSource = 'unknown') {
  const cfg = readBridgeConfig();
  const snap = snapshotFromOriginal();
  const st = state();
  const counts = {};
  for (const def of MASTER_PATHS) {
    const snapMaster = (snap?.masters || []).find((entry) => entry.key === def.name) || {};
    counts[def.name] = {
      activeSession: rowCount({ [def.section]: st.sessionMasters[def.name] || {} }, def),
      supportConfigJson: rowCount(cfg, def),
      localMasterState: Number(snapMaster.rawRows || 0),
      importMastersCount: Number(snapMaster.rows || 0),
      source: st.lastSource[def.name] || '',
    };
  }
  return { activeSource, counts };
}

function shouldLogDebug() {
  try {
    return window.location.hostname === 'localhost'
      || window.location.hostname === '127.0.0.1'
      || new URLSearchParams(window.location.search).has('xmlCiiMasterDebug');
  } catch {
    return false;
  }
}

function logDebug(activeSource, detail = {}) {
  const snap = debugSnapshot(activeSource);
  state().lastDebug = { ...snap, detail, at: new Date().toISOString() };
  if (shouldLogDebug()) {
    console.debug('[XML→CII master lifecycle]', state().lastDebug);
  }
}

function commitHydratedConfig(reason, explicitEmptyMaster = '') {
  if (state().committing) return readBridgeConfig();
  state().committing = true;
  try {
    const current = readBridgeConfig();
    rememberNonEmpty(current, 'supportConfigJson');
    const result = applyPreservedMasters(current, reason, explicitEmptyMaster);
    if (result.changed) {
      writeThroughBridge(result.config);
      rememberNonEmpty(result.config, `guard:${reason}`);
    }
    logDebug(reason, { restored: result.restored, wroteEmptyMaster: !!explicitEmptyMaster });
    return result.config;
  } finally {
    state().committing = false;
  }
}

function masterSnapshot(masterName) {
  const snap = snapshotFromOriginal();
  return (snap?.masters || []).find((entry) => entry.key === masterName) || null;
}

function canSkipEmptySave(masterName) {
  const snap = masterSnapshot(masterName);
  if (!snap) return false;
  const savedRows = Number(snap.rows || 0);
  const rawRows = Number(snap.rawRows || 0);
  return savedRows > 0 && rawRows <= 0;
}

function wrapBridge(bridge) {
  const st = state();
  if (!bridge) return bridge;
  if (st.wrappedBridge === bridge) return bridge;
  st.wrappedBridge = bridge;

  const original = {
    getPopupSnapshot: bridge.getPopupSnapshot?.bind(bridge),
    savePopupMaster: bridge.savePopupMaster?.bind(bridge),
    clearPopupMaster: bridge.clearPopupMaster?.bind(bridge),
    autoMapPopupMaster: bridge.autoMapPopupMaster?.bind(bridge),
    setPopupMasterField: bridge.setPopupMasterField?.bind(bridge),
    importPopupMasterFile: bridge.importPopupMasterFile?.bind(bridge),
    loadPopupDefaultMaster: bridge.loadPopupDefaultMaster?.bind(bridge),
    buildPopupPreviewRows: bridge.buildPopupPreviewRows?.bind(bridge),
    runPopupDiagnostics: bridge.runPopupDiagnostics?.bind(bridge),
    computePopupWeightRows: bridge.computePopupWeightRows?.bind(bridge),
    savePopupConfigText: bridge.savePopupConfigText?.bind(bridge),
    importPopupConfigText: bridge.importPopupConfigText?.bind(bridge),
    exportPopupConfigText: bridge.exportPopupConfigText?.bind(bridge),
  };
  st.original = original;

  const after = (reason, explicitEmptyMaster = '') => {
    const hydrated = commitHydratedConfig(reason, explicitEmptyMaster);
    rememberNonEmpty(hydrated, reason);
    return hydrated;
  };

  if (original.getPopupSnapshot) {
    bridge.getPopupSnapshot = (target) => {
      after('snapshot');
      const snapshot = original.getPopupSnapshot(target);
      snapshot.masterLifecycleDebug = debugSnapshot('snapshot');
      return snapshot;
    };
  }

  if (original.savePopupMaster) {
    bridge.savePopupMaster = (masterName = 'linelist') => {
      after(`before-save:${masterName}`);
      if (canSkipEmptySave(masterName)) {
        logDebug(`blocked-empty-save:${masterName}`, { wroteEmptyMaster: true });
        return false;
      }
      const result = original.savePopupMaster(masterName);
      after(`save:${masterName}`);
      return result;
    };
  }

  if (original.clearPopupMaster) {
    bridge.clearPopupMaster = (masterName = 'linelist') => {
      removeRememberedMaster(masterName);
      const result = original.clearPopupMaster(masterName);
      after(`clear:${masterName}`, masterName);
      return result;
    };
  }

  for (const [methodName, reason] of [
    ['autoMapPopupMaster', 'auto-map'],
    ['setPopupMasterField', 'field-map'],
    ['savePopupConfigText', 'save-config-text'],
    ['importPopupConfigText', 'import-config-text'],
  ]) {
    if (!original[methodName]) continue;
    bridge[methodName] = (...args) => {
      after(`before-${reason}:${args[0] || ''}`);
      const result = original[methodName](...args);
      after(`${reason}:${args[0] || ''}`);
      return result;
    };
  }

  for (const [methodName, reason] of [
    ['importPopupMasterFile', 'import-master'],
    ['loadPopupDefaultMaster', 'load-default-master'],
    ['buildPopupPreviewRows', 'preview'],
    ['runPopupDiagnostics', 'diagnostics'],
    ['computePopupWeightRows', 'weight-match'],
  ]) {
    if (!original[methodName]) continue;
    bridge[methodName] = async (...args) => {
      after(`before-${reason}:${args[0] || ''}`);
      const result = await original[methodName](...args);
      after(`${reason}:${args[0] || ''}`);
      return result;
    };
  }

  after('install');
  return bridge;
}

function installConfigInputObserver() {
  if (state().inputObserverInstalled) return;
  state().inputObserverInstalled = true;

  const onConfigChange = (event) => {
    if (!event.target?.matches?.(CONFIG_SELECTOR) || state().committing) return;
    const cfg = parseJson(event.target.value);
    rememberNonEmpty(cfg, 'supportConfigJson-dom');
    const bridge = wrapBridge(getXmlCiiPhaseBridge());
    if (bridge) commitHydratedConfig('supportConfigJson-dom');
  };

  document.addEventListener('input', onConfigChange, true);
  document.addEventListener('change', onConfigChange, true);
}

export function installXmlCiiMasterPreservePatch() {
  if (!ready()) return;
  if (!window[FLAG]) {
    window[FLAG] = {
      sessionMasters: {},
      lastSource: {},
      lastDebug: null,
      wrappedBridge: null,
      original: {},
      committing: false,
      inputObserverInstalled: false,
    };
  }

  installConfigInputObserver();
  const bridge = wrapBridge(getXmlCiiPhaseBridge());
  if (bridge) commitHydratedConfig('install');

  window.__xmlCiiMasterLifecycleDebug = () => debugSnapshot('manual');
}
