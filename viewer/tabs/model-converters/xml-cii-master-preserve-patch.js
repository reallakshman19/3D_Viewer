const FLAG = '__xmlCiiMasterPreservePatch_v1';
const CONFIG_SELECTOR = '[data-option-key="supportConfigJson"]';

const MASTER_PATHS = Object.freeze([
  Object.freeze({ name: 'linelist', section: 'linelist', rows: 'masterRows', fieldMap: 'fieldMap' }),
  Object.freeze({ name: 'pipingClass', section: 'pipingClass', rows: 'masterRows', fieldMap: 'fieldMap' }),
  Object.freeze({ name: 'material', section: 'material', rows: 'mapRows', fieldMap: 'fieldMap' }),
  Object.freeze({ name: 'weight', section: 'weight', rows: 'masterRows', fieldMap: 'fieldMap' }),
]);

function ready() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function parseJson(value) {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function configInput() {
  return document.querySelector(CONFIG_SELECTOR);
}

function rowCount(config, def) {
  const rows = config?.[def.section]?.[def.rows];
  return Array.isArray(rows) ? rows.length : 0;
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function writeInput(input, config) {
  const next = JSON.stringify(config, null, 2);
  if (!input || input.value === next) return false;
  input.value = next;
  window[FLAG].writing = true;
  try {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } finally {
    window[FLAG].writing = false;
  }
  return true;
}

function state() {
  return window[FLAG];
}

function remember(config) {
  if (!config) return;
  const st = state();
  for (const def of MASTER_PATHS) {
    const section = config[def.section];
    const rows = section?.[def.rows];
    if (!Array.isArray(rows) || !rows.length) continue;
    st.lastGood[def.name] = clone(section);
  }
}

function currentMasterNameFromButton(button) {
  return button?.getAttribute?.('data-xml-cii-clear-master')
    || button?.getAttribute?.('data-native-clear-master')
    || button?.getAttribute?.('data-xml-cii-save-master')
    || button?.getAttribute?.('data-native-save-master')
    || button?.getAttribute?.('data-xml-cii-auto-map')
    || button?.getAttribute?.('data-native-auto-map')
    || button?.getAttribute?.('data-xml-cii-dynamic-map')
    || '';
}

function markExplicitClear(masterName) {
  if (!masterName) return;
  const st = state();
  st.allowEmptyUntil[masterName] = Date.now() + 1500;
  delete st.lastGood[masterName];
}

function emptyIsAllowed(masterName) {
  return (state().allowEmptyUntil[masterName] || 0) > Date.now();
}

function restoreMissingMasters(reason = '') {
  const input = configInput();
  const config = parseJson(input?.value);
  if (!input || !config) return false;

  remember(config);

  let changed = false;
  for (const def of MASTER_PATHS) {
    if (rowCount(config, def) > 0 || emptyIsAllowed(def.name)) continue;
    const cached = state().lastGood[def.name];
    const cachedRows = cached?.[def.rows];
    if (!Array.isArray(cachedRows) || !cachedRows.length) continue;

    const current = isPlainObject(config[def.section]) ? config[def.section] : {};
    config[def.section] = { ...cached, ...current, [def.rows]: clone(cachedRows) };
    if (!isPlainObject(config[def.section][def.fieldMap]) && isPlainObject(cached[def.fieldMap])) {
      config[def.section][def.fieldMap] = clone(cached[def.fieldMap]);
    }
    config._masterPreservePatch = {
      ...(isPlainObject(config._masterPreservePatch) ? config._masterPreservePatch : {}),
      restoredAt: new Date().toISOString(),
      reason,
      section: def.name,
      rows: cachedRows.length,
    };
    changed = true;
  }

  if (changed) writeInput(input, config);
  return changed;
}

function scheduleRestore(reason) {
  const st = state();
  clearTimeout(st.timer);
  st.timer = setTimeout(() => restoreMissingMasters(reason), 0);
}

export function installXmlCiiMasterPreservePatch() {
  if (!ready()) return;
  if (window[FLAG]) return;
  window[FLAG] = { lastGood: {}, allowEmptyUntil: {}, timer: 0, writing: false };

  const initial = parseJson(configInput()?.value);
  remember(initial);

  document.addEventListener('click', (event) => {
    const clearButton = event.target?.closest?.('[data-xml-cii-clear-master], [data-native-clear-master]');
    if (clearButton) {
      markExplicitClear(currentMasterNameFromButton(clearButton));
      scheduleRestore('explicit clear');
      return;
    }

    const processButton = event.target?.closest?.('[data-xml-cii-save-master], [data-native-save-master], [data-xml-cii-auto-map], [data-native-auto-map], [data-xml-cii-dynamic-map]');
    if (!processButton) return;
    const before = parseJson(configInput()?.value);
    remember(before);
    scheduleRestore(`master process: ${currentMasterNameFromButton(processButton) || 'unknown'}`);
  }, true);

  document.addEventListener('input', (event) => {
    if (!event.target?.matches?.(CONFIG_SELECTOR) || state().writing) return;
    const config = parseJson(event.target.value);
    remember(config);
    scheduleRestore('supportConfigJson input');
  }, true);

  document.addEventListener('change', (event) => {
    if (!event.target?.matches?.(CONFIG_SELECTOR) || state().writing) return;
    const config = parseJson(event.target.value);
    remember(config);
    scheduleRestore('supportConfigJson change');
  }, true);
}
