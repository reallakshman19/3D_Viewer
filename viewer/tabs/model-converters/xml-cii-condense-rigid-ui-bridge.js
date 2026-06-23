import { getXmlCiiPhaseBridge } from './legacy-adapter.js?v=20260620-master-session-1';

const INSTALL_FLAG = Symbol.for('pcf-glb-xml-cii-condense-rigid-ui-bridge-v1');
const VERSION = '20260623-xml-cii-condense-rigid-ui-1';
const OPTION_KEY = 'splitCondensedValveFlange';

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

function bridgeEnabled(bridge) {
  const cfg = bridgeConfig(bridge);
  return bool(cfg[OPTION_KEY]);
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

function syncConfig(bridge, enabled) {
  if (!bridge) return false;
  const cfg = bridgeConfig(bridge);
  cfg[OPTION_KEY] = !!enabled;
  return importConfig(bridge, cfg);
}

function mergeBoolIntoConfigText(text, bools = {}) {
  const cfg = parseConfigText(text);
  if (Object.prototype.hasOwnProperty.call(bools, OPTION_KEY)) cfg[OPTION_KEY] = !!bools[OPTION_KEY];
  return JSON.stringify(cfg, null, 2);
}

function hydrateSnapshot(snapshot, bridge) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  const enabled = bridgeEnabled(bridge) || bool(snapshot?.run?.options?.[OPTION_KEY]);
  snapshot.run = snapshot.run && typeof snapshot.run === 'object' ? snapshot.run : {};
  snapshot.run.options = snapshot.run.options && typeof snapshot.run.options === 'object' ? snapshot.run.options : {};
  snapshot.run.options[OPTION_KEY] = enabled;
  snapshot.config = snapshot.config && typeof snapshot.config === 'object' ? snapshot.config : {};
  snapshot.config[OPTION_KEY] = enabled;
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
      if (key === OPTION_KEY) syncConfig(bridge, !!value);
      return originalSetPopupRunOption(key, value, type);
    };
  }

  if (originalSavePopupConfigText) {
    bridge.savePopupConfigText = (editedText, bools) => {
      const nextText = Object.prototype.hasOwnProperty.call(bools || {}, OPTION_KEY)
        ? mergeBoolIntoConfigText(editedText, bools)
        : editedText;
      const savedText = originalSavePopupConfigText(nextText, bools);
      if (Object.prototype.hasOwnProperty.call(bools || {}, OPTION_KEY)) syncConfig(bridge, !!bools[OPTION_KEY]);
      return savedText;
    };
  }

  bridge.__xmlCiiCondenseRigidUiWrapped = VERSION;
  return bridge;
}

function optionLabel(enabled, source) {
  const label = document.createElement('label');
  label.className = 'xml-cii-native-check';
  label.dataset.xmlCiiCondenseRigidInjected = source;
  label.innerHTML = `<input type="checkbox" ${enabled ? 'checked' : ''}> Condense Rigid / split condensed valve-flange nodes`;
  const input = label.querySelector('input');
  if (source === 'run') input.dataset.nativeRunOption = OPTION_KEY;
  else input.dataset.nativeConfigBool = OPTION_KEY;
  input.addEventListener('change', () => setCondenseRigid(input.checked));
  return label;
}

function setCondenseRigid(enabled) {
  const bridge = wrapBridge();
  syncConfig(bridge, !!enabled);
  try { bridge?.setPopupRunOption?.(OPTION_KEY, !!enabled, 'checkbox'); } catch (error) { console.warn('[XML CII Condense Rigid] run option sync failed', error); }
  syncInputs(document, !!enabled);
}

function syncInputs(root, enabled) {
  root?.querySelectorAll?.(`[data-native-run-option="${OPTION_KEY}"], [data-native-config-bool="${OPTION_KEY}"]`).forEach((input) => {
    if (input.type === 'checkbox') input.checked = !!enabled;
  });
}

function injectRunOption(root, enabled) {
  const existing = root.querySelector?.(`[data-native-run-option="${OPTION_KEY}"]`);
  if (existing) {
    existing.checked = !!enabled;
    if (!existing.dataset.xmlCiiCondenseRigidBound) {
      existing.dataset.xmlCiiCondenseRigidBound = VERSION;
      existing.addEventListener('change', () => setCondenseRigid(existing.checked));
    }
    return;
  }
  const anchor = root.querySelector?.('[data-native-run-option="kgToNewton"]')?.closest?.('label');
  if (!anchor || anchor.parentElement?.querySelector?.('[data-xml-cii-condense-rigid-injected="run"]')) return;
  anchor.insertAdjacentElement('afterend', optionLabel(enabled, 'run'));
}

function injectConfigOption(root, enabled) {
  const existing = root.querySelector?.(`[data-native-config-bool="${OPTION_KEY}"]`);
  if (existing) {
    existing.checked = !!enabled;
    if (!existing.dataset.xmlCiiCondenseRigidBound) {
      existing.dataset.xmlCiiCondenseRigidBound = VERSION;
      existing.addEventListener('change', () => setCondenseRigid(existing.checked));
    }
    return;
  }
  const anchor = root.querySelector?.('[data-native-config-bool="disableCiiSupportTagPopulation"]')?.closest?.('label');
  if (!anchor || anchor.parentElement?.querySelector?.('[data-xml-cii-condense-rigid-injected="config"]')) return;
  anchor.insertAdjacentElement('afterend', optionLabel(enabled, 'config'));
}

function apply(root = document) {
  const bridge = wrapBridge();
  const enabled = bridgeEnabled(bridge);
  injectRunOption(root, enabled);
  injectConfigOption(root, enabled);
  syncInputs(root, enabled);
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
