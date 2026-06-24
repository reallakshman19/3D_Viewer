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

function xmlCiiWorkflowWrapBridge(base) {
  if (!base) return null;
  if (base.__xmlCiiWorkflowSafeBridge) return base;
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
    return originalLoadDefault?.(masterKey) ?? null;
  };

  const originalNotify = base.notify?.bind(base);
  safe.notify = (message, options = {}) => {
    const text = `${message || ''} ${options?.message || ''} ${options?.url || ''}`;
    if (text.includes(XML_CII_OBSOLETE_PIPING_CLASS_MASTER)) return null;
    return originalNotify?.(message, options) ?? null;
  };
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

export function xmlCiiWorkflowClosePopup() {
  return xmlCiiWorkflowGetBridge()?.closePopup?.();
}
