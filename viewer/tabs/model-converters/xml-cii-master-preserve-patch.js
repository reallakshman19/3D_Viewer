const FLAG = '__xmlCiiWorkflowSessionConfig_v1';
const CONFIG_SELECTOR = '[data-option-key="supportConfigJson"]';

export const XML_CII_MASTER_SECTIONS = Object.freeze([
  Object.freeze({ name: 'linelist', section: 'linelist', rows: 'masterRows', fieldMap: 'fieldMap' }),
  Object.freeze({ name: 'pipingClass', section: 'pipingClass', rows: 'masterRows', fieldMap: 'fieldMap' }),
  Object.freeze({ name: 'material', section: 'material', rows: 'mapRows', fieldMap: 'fieldMap' }),
  Object.freeze({ name: 'weight', section: 'weight', rows: 'masterRows', fieldMap: 'fieldMap' }),
]);

function ready() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  if (value === undefined) return undefined;
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch {}
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function parseJson(value) {
  if (isPlainObject(value)) return clone(value);
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function configInput(root = document) {
  return root?.querySelector?.(CONFIG_SELECTOR) || document?.querySelector?.(CONFIG_SELECTOR) || null;
}

function rowsOf(config, def) {
  const rows = config?.[def.section]?.[def.rows];
  return Array.isArray(rows) ? rows : [];
}

function rowCount(config, def) {
  return rowsOf(config, def).length;
}

function rowCounts(config) {
  const out = {};
  for (const def of XML_CII_MASTER_SECTIONS) out[def.name] = rowCount(config, def);
  return out;
}

function nonRowSectionMerge(baseSection, incomingSection, def) {
  const base = isPlainObject(baseSection) ? baseSection : {};
  const incoming = isPlainObject(incomingSection) ? incomingSection : {};
  const out = { ...base, ...incoming };
  if (isPlainObject(base[def.fieldMap]) && !isPlainObject(incoming[def.fieldMap])) out[def.fieldMap] = clone(base[def.fieldMap]);
  return out;
}

function normalizeAllowList(value) {
  if (value === true) return new Set(XML_CII_MASTER_SECTIONS.map((def) => def.name));
  if (Array.isArray(value)) return new Set(value.filter(Boolean));
  if (typeof value === 'string' && value) return new Set([value]);
  return new Set();
}

export function xmlCiiMergeWorkflowConfig(existingConfig, incomingConfig, options = {}) {
  const reason = options.reason || 'unspecified';
  const allowEmptyMasters = normalizeAllowList(options.allowEmptyMasters);
  const existing = parseJson(existingConfig);
  const incoming = parseJson(incomingConfig);
  const out = { ...existing, ...incoming };
  const diagnostics = [];

  for (const def of XML_CII_MASTER_SECTIONS) {
    const existingSection = isPlainObject(existing[def.section]) ? existing[def.section] : {};
    const incomingSection = isPlainObject(incoming[def.section]) ? incoming[def.section] : null;
    if (!incomingSection && !existingSection[def.rows]) continue;

    const existingRows = rowsOf(existing, def);
    const incomingRows = incomingSection && Array.isArray(incomingSection[def.rows]) ? incomingSection[def.rows] : null;
    const nextSection = nonRowSectionMerge(existingSection, incomingSection, def);

    if (Array.isArray(incomingRows) && incomingRows.length > 0) {
      nextSection[def.rows] = clone(incomingRows);
      diagnostics.push({ type: 'accepted-master-rows', reason, master: def.name, rows: incomingRows.length });
    } else if (Array.isArray(incomingRows) && incomingRows.length === 0 && allowEmptyMasters.has(def.name)) {
      nextSection[def.rows] = [];
      diagnostics.push({ type: 'explicit-empty-master-write', reason, master: def.name, rows: 0 });
    } else if (Array.isArray(incomingRows) && incomingRows.length === 0 && existingRows.length > 0) {
      nextSection[def.rows] = clone(existingRows);
      diagnostics.push({ type: 'blocked-empty-master-write', reason, master: def.name, preservedRows: existingRows.length });
    } else if (existingRows.length > 0) {
      nextSection[def.rows] = clone(existingRows);
      diagnostics.push({ type: 'preserved-missing-master-rows', reason, master: def.name, preservedRows: existingRows.length });
    }

    out[def.section] = nextSection;
  }

  return { config: out, diagnostics };
}

function state() {
  if (!ready()) return null;
  if (!window[FLAG] || !isPlainObject(window[FLAG])) {
    window[FLAG] = {
      config: {},
      installed: false,
      writing: false,
      lastAction: null,
      actionSeq: 0,
      diagnostics: [],
      updatedAt: '',
    };
  }
  return window[FLAG];
}

function note(diag) {
  const st = state();
  if (!st || !diag) return;
  const row = { at: new Date().toISOString(), ...diag };
  st.diagnostics.push(row);
  if (st.diagnostics.length > 80) st.diagnostics.splice(0, st.diagnostics.length - 80);
  const debugOn = /[?&]xmlCiiDebug=1\b/.test(window.location?.search || '') || /localhost|127\.0\.0\.1/.test(window.location?.hostname || '');
  if (debugOn && typeof console !== 'undefined') console.debug('[XML->CII master lifecycle]', row);
}

function rememberDiagnostics(list) {
  for (const diag of list || []) note(diag);
}

function stringify(config) {
  return JSON.stringify(config || {}, null, 2);
}

function sameJsonText(a, b) {
  try { return JSON.stringify(JSON.parse(a || '{}')) === JSON.stringify(JSON.parse(b || '{}')); } catch { return false; }
}

function currentInputConfig() {
  return parseJson(configInput()?.value || '{}');
}

function visibleMasterCountsFromDom() {
  if (!ready()) return {};
  const out = {};
  document.querySelectorAll('[data-native-master-tab], [data-xml-cii-master-tab]').forEach((button) => {
    const key = button.getAttribute('data-native-master-tab') || button.getAttribute('data-xml-cii-master-tab') || '';
    const text = button.textContent || '';
    const match = text.match(/([0-9][0-9,]*)\s+row/i);
    if (key && match) out[key] = Number(match[1].replace(/,/g, '')) || 0;
  });
  return out;
}

export function xmlCiiMasterLifecycleDebug() {
  const st = state();
  const inputConfig = ready() ? currentInputConfig() : {};
  return {
    activeSourceUsedBy4A: 'supportConfigJson projected from xmlCiiWorkflowSessionConfig',
    sessionCounts: rowCounts(st?.config || {}),
    supportConfigJsonCounts: rowCounts(inputConfig),
    localMasterStateCounts: visibleMasterCountsFromDom(),
    lastAction: st?.lastAction || null,
    diagnostics: (st?.diagnostics || []).slice(-20),
    updatedAt: st?.updatedAt || '',
  };
}

export function xmlCiiGetHydratedWorkflowConfig(reason = 'read', candidateConfig = null, options = {}) {
  const st = state();
  if (!st) return parseJson(candidateConfig || '{}');
  const source = candidateConfig == null ? currentInputConfig() : candidateConfig;
  const merged = xmlCiiMergeWorkflowConfig(st.config, source, { ...options, reason });
  st.config = merged.config;
  st.updatedAt = new Date().toISOString();
  rememberDiagnostics(merged.diagnostics);
  return clone(st.config);
}

export function xmlCiiSaveHydratedWorkflowConfig(config, reason = 'write', options = {}) {
  const st = state();
  const hydrated = xmlCiiGetHydratedWorkflowConfig(reason, config, options);
  if (!ready()) return hydrated;
  const input = configInput();
  if (!input) return hydrated;
  const next = stringify(hydrated);
  if (!sameJsonText(input.value || '{}', next)) {
    st.writing = true;
    try {
      input.value = next;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } finally {
      st.writing = false;
    }
  }
  return hydrated;
}

export function xmlCiiClearHydratedMaster(masterName, reason = 'explicit clear') {
  const def = XML_CII_MASTER_SECTIONS.find((entry) => entry.name === masterName || entry.section === masterName);
  if (!def) return xmlCiiGetHydratedWorkflowConfig(reason);
  const current = xmlCiiGetHydratedWorkflowConfig(reason);
  current[def.section] = { ...(isPlainObject(current[def.section]) ? current[def.section] : {}), [def.rows]: [] };
  return xmlCiiSaveHydratedWorkflowConfig(current, reason, { allowEmptyMasters: [def.name] });
}

function masterNameFromButton(button) {
  return button?.getAttribute?.('data-xml-cii-clear-master')
    || button?.getAttribute?.('data-native-clear-master')
    || button?.getAttribute?.('data-xml-cii-save-master')
    || button?.getAttribute?.('data-native-save-master')
    || button?.getAttribute?.('data-xml-cii-auto-map')
    || button?.getAttribute?.('data-native-auto-map')
    || button?.getAttribute?.('data-xml-cii-dynamic-map')
    || '';
}

function markAction(event) {
  const st = state();
  if (!st) return;
  const clearButton = event.target?.closest?.('[data-xml-cii-clear-master], [data-native-clear-master]');
  const processButton = event.target?.closest?.('[data-xml-cii-save-master], [data-native-save-master], [data-xml-cii-auto-map], [data-native-auto-map], [data-xml-cii-dynamic-map], [data-native-save-config], #mc-cfg-save, #model-converters-run');
  const button = clearButton || processButton;
  if (!button) return;
  st.lastAction = {
    id: ++st.actionSeq,
    type: clearButton ? 'clear' : 'write',
    master: masterNameFromButton(button),
    label: button.textContent?.trim?.() || button.id || button.getAttribute?.('data-native-save-config') || '',
  };
  note({ type: 'action', action: st.lastAction });
}

function allowEmptyForCurrentAction() {
  const action = state()?.lastAction;
  if (!action || action.type !== 'clear' || !action.master) return [];
  return [action.master];
}

function syncFromInput(event, reason) {
  const st = state();
  if (!st || st.writing) return;
  const input = event?.target?.matches?.(CONFIG_SELECTOR) ? event.target : configInput();
  if (!input) return;
  const beforeText = input.value || '{}';
  const next = xmlCiiGetHydratedWorkflowConfig(reason, beforeText, { allowEmptyMasters: allowEmptyForCurrentAction() });
  const nextText = stringify(next);
  if (!sameJsonText(beforeText, nextText)) {
    st.writing = true;
    try {
      input.value = nextText;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } finally {
      st.writing = false;
    }
  }
}

function exposeGlobals() {
  if (!ready()) return;
  window.xmlCiiGetHydratedWorkflowConfig = xmlCiiGetHydratedWorkflowConfig;
  window.xmlCiiSaveHydratedWorkflowConfig = xmlCiiSaveHydratedWorkflowConfig;
  window.xmlCiiClearHydratedMaster = xmlCiiClearHydratedMaster;
  window.xmlCiiMasterLifecycleDebug = xmlCiiMasterLifecycleDebug;
}

export function installXmlCiiMasterPreservePatch(container = document) {
  if (!ready()) return;
  const st = state();
  exposeGlobals();
  xmlCiiGetHydratedWorkflowConfig('install', configInput(container)?.value || '{}');
  if (st.installed) return;
  st.installed = true;

  document.addEventListener('click', markAction, true);
  document.addEventListener('input', (event) => {
    if (event.target?.matches?.(CONFIG_SELECTOR)) syncFromInput(event, 'supportConfigJson input');
  }, true);
  document.addEventListener('change', (event) => {
    if (event.target?.matches?.(CONFIG_SELECTOR)) syncFromInput(event, 'supportConfigJson change');
  }, true);

  note({ type: 'session-config-installed', counts: rowCounts(st.config) });
}
