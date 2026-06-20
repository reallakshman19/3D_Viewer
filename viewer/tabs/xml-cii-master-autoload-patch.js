import { isXmlCiiRigidNode } from '../converters/xml-cii2019-core/weight-match-model.js';

const AUTOLOAD_FLAG = '__xmlCiiDefaultMasterAutoload_retired_session_config_v1';
const RECOVERY_FLAG = '__xmlCiiRecovery_session_config_v1';

function ready() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function debug(message) {
  if (!ready()) return;
  const debugOn = /[?&]xmlCiiDebug=1\b/.test(window.location?.search || '') || /localhost|127\.0\.0\.1/.test(window.location?.hostname || '');
  if (debugOn && typeof console !== 'undefined') console.debug('[XML->CII masters]', message);
}

/**
 * PR #197/#203 used a DOM/timer based autoload/recovery loop that could race the
 * popup-native bridge and rewrite supportConfigJson after save/process actions.
 * Default master loading now happens through the workflow bridge's
 * ensureDefaultMastersLoaded() call and every supportConfigJson write is guarded
 * by the session config broker in xml-cii-master-preserve-patch.js.
 */
export function installXmlCiiDefaultMasterAutoload() {
  if (!ready()) return;
  if (window[AUTOLOAD_FLAG]) return;
  window[AUTOLOAD_FLAG] = true;
  debug('Retired timer autoload installed as a no-op; bridge/session config owns master hydration.');
}

export function installXmlCiiRecoveryPatch() {
  if (!ready()) return;
  if (window[RECOVERY_FLAG]) return;
  window[RECOVERY_FLAG] = true;
  if (typeof globalThis !== 'undefined' && !globalThis.isXmlCiiRigidNode) {
    Object.defineProperty(globalThis, 'isXmlCiiRigidNode', { value: isXmlCiiRigidNode, configurable: true });
  }
  debug('Recovery patch now only exposes the rigid-node helper; no timers or master row rewrites.');
}
