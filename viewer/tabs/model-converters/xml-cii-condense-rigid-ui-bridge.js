import { getXmlCiiPhaseBridge } from './legacy-adapter.js?v=20260620-master-session-1';

const INSTALL_FLAG = Symbol.for('pcf-glb-xml-cii-condense-rigid-ui-bridge-v4');
const VERSION = '20260623-xml-cii-condense-rigid-ui-4';
const DIRECT_RUN_FLAG = '__xmlCiiConversionWorkflowAllowDirectRun';

const XSD_KEY = 'condenseRigidXsd';
const XSD_SNAKE_KEY = 'condense_rigid_xsd';
const RESOLVED_KEY = 'splitCondensedValveFlange';
const RESOLVED_SNAKE_KEY = 'split_condensed_valve_flange';

const OPTIONS = Object.freeze([
  {
    key: XSD_KEY,
    runKeys: [XSD_KEY],
    configKeys: [XSD_KEY, XSD_SNAKE_KEY],
    label: 'Condense Rigid / split condensed valve-flange nodes (XSD)',
    hint: 'Source/XSD intent flag only. It is stored in supportConfigJson and does not force resolved conversion.',
  },
  {
    key: RESOLVED_KEY,
    runKeys: [RESOLVED_KEY, RESOLVED_SNAKE_KEY],
    configKeys: [RESOLVED_KEY, RESOLVED_SNAKE_KEY],
    label: 'Condense Rigid / split condensed valve-flange nodes (Resolved)',
    hint: 'Resolved conversion flag. ON writes split_condensed_valve_flange=True and forwards --split-condensed-valve-flange.',
  },
]);

function browserReady() {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
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

function bridge() {
  return getXmlCiiPhaseBridge?.() || null;
}

function bridgeConfig(activeBridge = bridge()) {
  return parseConfigText(activeBridge?.exportPopupConfigText?.() || '{}');
}

function optionEnabled(option, activeBridge = bridge()) {
  const cfg = bridgeConfig(activeBridge);
  return option.configKeys.some((key) => bool(cfg[key]));
}

function importConfig(activeBridge, config) {
  try {
    activeBridge?.importPopupConfigText?.(JSON.stringify(config || {}, null, 2));
    return true;
  } catch (error) {
    console.warn('[XML CII Condense Rigid] config sync failed', error);
    return false;
  }
}

function setConfigValue(config, option, enabled) {
  for (const key of option.configKeys) config[key] = !!enabled;
}

function syncOption(option, enabled) {
  const activeBridge = bridge();
  if (!activeBridge) return;
  const cfg = bridgeConfig(activeBridge);
  setConfigValue(cfg, option, enabled);
  importConfig(activeBridge, cfg);
  for (const key of option.runKeys) {
    try { activeBridge.setPopupRunOption?.(key, !!enabled, 'checkbox'); } catch {}
  }
}

function ensureSimpleRunVisible() {
  if (!browserReady()) return;
  // Keep normal/simple Run Conversion as a direct button. Older cached popup
  // installers used a capture listener on #model-converters-run; this flag keeps
  // that listener bypassed without touching the Rich Workflow button.
  window[DIRECT_RUN_FLAG] = true;
  const runButton = document.querySelector('#model-converters-run');
  if (!runButton) return;
  runButton.hidden = false;
  runButton.style.display = '';
  runButton.disabled = false;
  if (!String(runButton.textContent || '').trim()) runButton.textContent = 'Run Conversion';
}

function inputSelectors(option) {
  const selectors = [];
  for (const key of option.runKeys) {
    selectors.push(`[data-native-run-option="${key}"]`);
    selectors.push(`[data-xml-cii-run-option="${key}"]`);
  }
  for (const key of option.configKeys) {
    selectors.push(`[data-native-config-bool="${key}"]`);
    selectors.push(`[data-xml-cii-config-bool="${key}"]`);
  }
  return selectors.join(', ');
}

function findOptionFromInput(input) {
  const key = input?.dataset?.nativeRunOption
    || input?.dataset?.xmlCiiRunOption
    || input?.dataset?.nativeConfigBool
    || input?.dataset?.xmlCiiConfigBool
    || '';
  return OPTIONS.find((option) => option.runKeys.includes(key) || option.configKeys.includes(key)) || null;
}

function labelFor(option, source, enabled) {
  const legacy = source.startsWith('legacy');
  const label = document.createElement('label');
  label.className = legacy ? 'model-converters-workflow-map-field' : 'xml-cii-native-check';
  label.dataset.xmlCiiCondenseRigidInjected = `${source}:${option.key}`;
  if (legacy) label.style.cssText = 'flex-direction:row;align-items:center;gap:8px;';
  label.innerHTML = `<input type="checkbox" ${enabled ? 'checked' : ''}> <span>${option.label}</span>`;
  const input = label.querySelector('input');
  if (source.includes('run')) {
    if (legacy) input.dataset.xmlCiiRunOption = option.key;
    else input.dataset.nativeRunOption = option.key;
  } else {
    if (legacy) input.dataset.xmlCiiConfigBool = option.key;
    else input.dataset.nativeConfigBool = option.key;
  }
  input.title = option.hint;
  return label;
}

function injectOne(root, option, source, anchorSelector) {
  if (!root?.querySelector) return;
  if (root.querySelector(inputSelectors(option))) return;
  const anchor = root.querySelector(anchorSelector)?.closest?.('label');
  const parent = anchor?.parentElement;
  if (!anchor || !parent) return;
  if (parent.querySelector(`[data-xml-cii-condense-rigid-injected$=":${option.key}"]`)) return;
  anchor.insertAdjacentElement('afterend', labelFor(option, source, optionEnabled(option)));
}

function injectAll(root = document) {
  ensureSimpleRunVisible();
  for (const option of OPTIONS) {
    injectOne(root, option, 'legacy-run', '[data-xml-cii-run-option="kgToNewton"]');
    injectOne(root, option, 'native-run', '[data-native-run-option="kgToNewton"]');
    injectOne(root, option, 'legacy-config', '[data-xml-cii-config-bool="disableCiiSupportTagPopulation"]');
    injectOne(root, option, 'native-config', '[data-native-config-bool="disableCiiSupportTagPopulation"]');
  }
  syncInputStates(root);
}

function syncInputStates(root = document) {
  for (const option of OPTIONS) {
    const enabled = optionEnabled(option);
    root?.querySelectorAll?.(inputSelectors(option)).forEach((input) => {
      if (input.type === 'checkbox') input.checked = enabled;
      if (!input.dataset.xmlCiiCondenseRigidBound) {
        input.dataset.xmlCiiCondenseRigidBound = VERSION;
        input.addEventListener('change', () => {
          const changedOption = findOptionFromInput(input);
          if (!changedOption) return;
          syncOption(changedOption, input.checked);
          syncInputStates(document);
        });
      }
    });
  }
}

function onDomAction() {
  ensureSimpleRunVisible();
  setTimeout(() => injectAll(document), 0);
  setTimeout(() => injectAll(document), 60);
  setTimeout(() => injectAll(document), 200);
}

export function installXmlCiiCondenseRigidUiBridge(root = document) {
  if (!browserReady()) return null;
  if (window[INSTALL_FLAG]) return window[INSTALL_FLAG];
  const state = { version: VERSION, injectAll };
  window[INSTALL_FLAG] = state;

  ensureSimpleRunVisible();
  document.addEventListener('click', onDomAction, true);
  document.addEventListener('change', onDomAction, true);
  for (const delay of [0, 80, 250, 750, 1500, 3000]) setTimeout(() => injectAll(root || document), delay);
  const interval = setInterval(() => injectAll(root || document), 500);
  setTimeout(() => clearInterval(interval), 8000);
  state.disconnect = () => clearInterval(interval);
  return state;
}
