/**
 * XML->CII(2019) Workflow bridge boundary.
 *
 * Workflow 1 and Workflow 2 UI modules import this boundary instead of importing
 * legacy-adapter.js directly. The legacy bridge remains the current shared state
 * provider until the workflow state owner is fully extracted, but the dependency
 * is contained here under neutral Workflow naming.
 */

import { getXmlCiiPhaseBridge } from './legacy-adapter.js?v=20260620-master-session-1';

export function xmlCiiWorkflowGetBridge() {
  return getXmlCiiPhaseBridge?.() || null;
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
