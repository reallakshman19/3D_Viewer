import { getXmlCiiPhaseBridge } from './legacy-adapter.js?v=20260620-master-session-1';

const INSTALL_FLAG = Symbol.for('pcf-glb-xml-cii-condense-rigid-ui-bridge-v3');
const VERSION = '20260623-xml-cii-condense-rigid-ui-3';

const XSD_KEY = 'condenseRigidXsd';
const RESOLVED_KEY = 'splitCondensedValveFlange';
const RESOLVED_SNAKE_KEY = 'split_condensed_valve_flange';

const OPTIONS = Object.freeze([
  {
    key: XSD_KEY,
    label: 'Condense Rigid / split condensed valve-flange nodes (XSD)',
    hint: 'Records the source/XSD condense-rigid intent in supportConfigJson. It does not force the resolver.',
    aliases: [XSD_KEY, 'condense_rigid_xsd'],
  },
  {
    key: RESOLVED_KEY,
    label: 'Condense Rigid / split condensed valve-flange nodes (Resolved)',
    hint: 'Forces the resolved conversion path: supportConfigJson.split_condensed_valve_flange=True and Python --split-condensed-valve-flange.',
    aliases: [RESOLVED_KEY, RESOLVED_SNAKE_KEY],
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

function bridgeConfig(bridge) {
  return parseConfigText(bridge?.exportPopupConfigText?.() || '{}');
}

function optionEnabled(option, bridge) {
  const cfg = bridgeConfig(bridge);
  return option.aliases.some((key) => bool(cfg[key]));
}

function importConfig(bridge, config) {
  try {
    bridge?.importPopupConfigText?.(JSON.stringify(config || {}, null, 2));
    return true;
  } catch (error) {
    console.warn('[XML CII Condense Rigid] config sync failed', error);
    return false;
  }
}

function setConfigValue(config, key, enabled) {
  if (key === RESOLVED_KEY || key === RESOLVED_SNAKE_KEY) {
    config[RESOLVED_KEY] = !!enabled;
    config[RESOLVED_SNAKE_KEY] = !!enabled;
    return;
  }
  if (key === XSD_KEY || key === 'condense_rigid_xsd') {
    config[XSD_KEY] = !!enabled;
    return;
  }
  config[key] = !!enabled;
}

function syncConfig(bridge, key, enabled) {
  if (!bridge) return false;
  const cfg = bridgeConfig(bridge);
  setConfigValue(cfg, key, enabled);
  return importConfig(bridge, cfg);
}

function mergeBoolsIntoConfigText(text, bools = {}) {
  const cfg = parseConfigText(text);
  for (const option of OPTIONS) {
    if (Object.prototype.hasOwnProperty.call(bools, option.key)) setConfigValue(cfg, option.key, bools[option.key]);
    if (option.key === RESOLVED_KEY && Object.prototype.hasOwnProperty.call(bools, RESOLVED_SNAKE_KEY)) {
      setConfigValue(cfg, RESOLVED_KEY, bools[RESOLVED_SNAKE_KEY]);
    }
  }
  return JSON.stringify(cfg, null, 2);
}

function hydrateSnapshot(snapshot, bridge) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  snapshot.run = snapshot.run && typeof snapshot.run === 'object' ? snapshot.run : {};
  snapshot.run.options = snapshot.run.options && typeof snapshot.run.options === 'object' ? snapshot.run.options : {};
  snapshot.config = snapshot.config && typeof snapshot.config === 'object' ? snapshot.config : {};

  for (const option of OPTIONS) {
    const enabled = optionEnabled(option, bridge) || bool(snapshot.run.options[option.key]);
    snapshot.run.options[option.key] = enabled;
    snapshot.config[option.key] = enabled;
    if (option.key === RESOLVED_KEY) {
      snapshot.run.options[RESOLVED_SNAKE_KEY] = enabled;
      snapshot.config[RESOLVED_SNAKE_KEY] = enabled;
    }
  }
  return snapshot;
}

function wrapBridge(bridge = getXmlCiiPhaseBridge()) {
  if (!bridge || bridge.__xmlCiiCondenseRigidUiWrapped === VERSION) return bridge || null;
  const originalGetPopupSnapshot = typeof bridge.getPopupSnapshot === 'function' ? bridge.getPopupSnapshot.bind(bridge) : null;
  const originalSetPopupRunOption = typeof bridge.setPopupRunOption === 'function' ? bridge.setPopupRunOption.bind(bridge) : null;
  const originalSavePopupConfigText = typeof bridge.savePopupConfigText === 'function' ? bridge.savePopupConfigText.bind(bridge) : null;

  if (originalGetPopupSnapshot) {
    bridge.getPopupSnapshot = (target) => hydrateSnapshot(originalGetPopupSnapshot(target), bridge);
  }

  if (originalSetPopupRunOption) {
    bridge.setPopupRunOption = (key, value, type) => {
      if ([XSD_KEY, RESOLVED_KEY, RESOLVED_SNAKE_KEY].includes(key)) syncConfig(bridge, key, !!value);
      return originalSetPopupRunOption(key, value, type);
    };
  }

  if (originalSavePopupConfigText) {
    bridge.savePopupConfigText = (editedText, bools) => {
      const nextText = mergeBoolsIntoConfigText(editedText, bools || {});
      const savedText = originalSavePopupConfigText(nextText, bools);
      for (const option of OPTIONS) {
        if (Object.prototype.hasOwnProperty.call(bools || {}, option.key)) syncConfig(bridge, option.key, !!bools[option.key]);
      }
      return savedText;
    };
  }

  bridge.__xmlCiiCondenseRigidUiWrapped = VERSION;
  return bridge;
}

function optionInputSelector(option) {
  return [
    `[data-native-run-option="${option.key}"]`,
    `[data-native-config-bool="${option.key}"]`,
    `[data-xml-cii-run-option="${option.key}"]`,
    `[data-xml-cii-config-bool="${option.key}"]`,
  ].join(', ');
}

function optionLabel(option, enabled, source) {
  const label = document.createElement('label');
  const legacy = source.startsWith('legacy');
  label.className = legacy ? 'model-converters-workflow-map-field' : 'xml-cii-native-check';
  label.dataset.xmlCiiCondenseRigidInjected = `${source}:${option.key}`;
  if (legacy) label.style.cssText = 'flex-direction:row;align-items:center;gap:8px;';
  label.innerHTML = `<input type="checkbox" ${enabled ? 'checked' : ''}> <span>${option.label}</span>`;
  const input = label.querySelector('input');
  if (source.includes('run')) input.dataset[legacy ? 'xmlCiiRunOption' : 'nativeRunOption'] = option.key;
  else input.dataset[legacy ? 'xmlCiiConfigBool' : 'nativeConfigBool'] = option.key;
  input.title = option.hint;
  input.addEventListener('change', () => setCondenseRigid(option.key, input.checked));
  return label;
}

function setCondenseRigid(key, enabled) {
  const bridge = wrapBridge();
  syncConfig(bridge, key, !!enabled);
  try { bridge?.setPopupRunOption?.(key, !!enabled, 'checkbox'); } catch (error) { console.warn('[XML CII Condense Rigid] run option sync failed', error); }
  syncInputs(document);
}

function syncInputs(root = document) {
  const bridge = wrapBridge();
  for (const option of OPTIONS) {
    const enabled = optionEnabled(option, bridge);
    root?.querySelectorAll?.(optionInputSelector(option)).forEach((input) => {
      if (input.type === 'checkbox') input.checked = !!enabled;
    });
  }
}

function bindExisting(root = document) {
  for (const option of OPTIONS) {
    root?.querySelectorAll?.(optionInputSelector(option)).forEach((input) => {
      if (input.dataset.xmlCiiCondenseRigidBound === VERSION) return;
      input.dataset.xmlCiiCondenseRigidBound = VERSION;
      input.addEventListener('change', () => setCondenseRigid(option.key, input.checked));
    });
  }
}

function injectOne(root, option, enabled, source, anchorSelector) {
  if (root.querySelector?.(optionInputSelector(option))) return;
  const anchor = root.querySelector?.(anchorSelector)?.closest?.('label');
  const parent = anchor?.parentElement;
  if (!anchor || !parent || parent.querySelector?.(`[data-xml-cii-condense-rigid-injected$=":${option.key}"]`)) return;
  anchor.insertAdjacentElement('afterend', optionLabel(option, enabled, source));
}

function injectRunOptions(root, bridge) {
  for (const option of OPTIONS) {
    const enabled = optionEnabled(option, bridge);
    injectOne(root, option, enabled, 'native-run', '[data-native-run-option="kgToNewton"]');
    injectOne(root, option, enabled, 'legacy-run', '[data-xml-cii-run-option="kgToNewton"]');
  }
}

function injectConfigOptions(root, bridge) {
  for (const option of OPTIONS) {
    const enabled = optionEnabled(option, bridge);
    injectOne(root, option, enabled, 'native-config', '[data-native-config-bool="disableCiiSupportTagPopulation"]');
    injectOne(root, option, enabled, 'legacy-config', '[data-xml-cii-config-bool="disableCiiSupportTagPopulation"]');
  }
}

function apply(root = document) {
  const bridge = wrapBridge();
  injectRunOptions(root, bridge);
  injectConfigOptions(root, bridge);
  bindExisting(root);
  syncInputs(root);
}

export function installXmlCiiCondenseRigidUiBridge(root = document) {
  if (!browserReady()) return null;
  if (window[INSTALL_FLAG]) return window[INSTALL_FLAG];
  const state = { version: VERSION, apply };
  window[INSTALL_FLAG] = state;

  const tick = () => apply(root || document);
  for (const delay of [0, 80, 250, 750, 1500]) setTimeout(tick, delay);

  const observer = new MutationObserver(() => tick());
  observer.observe(document.body, { childList: true, subtree: true });
  state.disconnect = () => observer.disconnect();
  return state;
}
