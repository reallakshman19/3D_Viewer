/**
 * XML->CII(2019) Rich Workflow bridge boundary.
 *
 * Rich UI modules import this boundary instead of importing legacy-adapter.js
 * directly. The legacy bridge remains the current state provider until the rich
 * workflow state owner is fully extracted, but the dependency is contained here.
 */

import { getXmlCiiPhaseBridge } from './legacy-adapter.js?v=20260620-master-session-1';

export function xmlCiiRichWorkflowGetBridge() {
  return getXmlCiiPhaseBridge?.() || null;
}

export function xmlCiiRichWorkflowGetSnapshot(root) {
  return xmlCiiRichWorkflowGetBridge()?.getPopupSnapshot?.(root) || null;
}

export function xmlCiiRichWorkflowSetConfigValue(path, value, valueType = 'text') {
  return xmlCiiRichWorkflowGetBridge()?.setPopupConfigValue?.(path, value, valueType);
}

export function xmlCiiRichWorkflowSetMasterField(masterKey, fieldKey, value) {
  return xmlCiiRichWorkflowGetBridge()?.setPopupMasterField?.(masterKey, fieldKey, value);
}

export function xmlCiiRichWorkflowClosePopup() {
  return xmlCiiRichWorkflowGetBridge()?.closePopup?.();
}
