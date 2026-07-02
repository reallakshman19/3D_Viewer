import { renderXmlCompareGraphCanvasHtml } from './XmlCompareGraphCanvas.js';
import { renderXmlCompareGraphConnectorLaneHtml } from './XmlCompareGraphConnectorLane.js';
import { renderXmlCompareAutoMapPopupHtml } from './XmlCompareAutoMapPopup.js?v=20260702-selected-item-compare-fields-1';
import { renderXmlCompareDetailsPanelHtml } from './XmlCompareDetailsPanel.js';
import { renderXmlCompareDiagnosticsPanelHtml } from './XmlCompareDiagnosticsPanel.js';
import { renderXmlCompareDebugPanelHtml } from './XmlCompareDebugPanel.js';
import { renderXmlCompareLogScreenHtml } from './XmlCompareLogScreen.js';
import { createXmlCompareTransferPreview } from './XmlCompareTransferPreview.js';
import { renderXmlCompareTransferPreviewPanelHtml } from './XmlCompareTransferPreviewPanel.js';
import { availableCompareFields, normalizeCompareFields } from './XmlCompareFieldCompareModel.js';

export const XML_COMPARE_WORKSPACE_SHELL_SCHEMA='xml-compare-workspace-shell/v19';

let loadDiagnosticsPromise=null;
let loadSamplePickersPromise=null;
let loadCategorizedConverterPromise=null;
let loadTableCategorizedPromise=null;
let loadToolbarGatePromise=null;
let loadTransferApplyPromise=null;
let loadCandidateReviewPromise=null;
let loadLinewiseInfoRulePromise=null;

function loadTabDiagnostics(){if(typeof document==='undefined')return;if(loadDiagnosticsPromise)return;loadDiagnosticsPromise=import('../tabs/xml-compare-load-diagnostics-runtime.js?v=20260628-xml-compare-load-diagnostics-3').catch(()=>null);}
function loadSamplePickers(){if(typeof document==='undefined')return;if(loadSamplePickersPromise)return;loadSamplePickersPromise=import('../tabs/xml-compare-enriched-sample-pickers.js?v=20260701-bm-cii-categorized-samples-1').catch(()=>null);}
function loadCategorizedConverter(){if(typeof document==='undefined')return;if(loadCategorizedConverterPromise)return;loadCategorizedConverterPromise=import('../tabs/xml-compare-categorized-converter-runtime.js?v=20260630-clean-workflow-ui-1').catch(()=>null);}
function loadTableCategorizedXml(){if(typeof document==='undefined')return;if(loadTableCategorizedPromise)return;loadTableCategorizedPromise=import('../tabs/xml-compare-table-categorized-runtime.js?v=20260702-table-categorized-compare-canvas-preview-1').catch(()=>null);}
function loadToolbarGate(){if(typeof document==='undefined')return;if(loadToolbarGatePromise)return;loadToolbarGatePromise=import('../tabs/xml-compare-linewise-toolbar-gate.js?v=20260701-table-categorized-source-setup-1').catch(()=>null);}
function loadTransferApplyRuntime(){if(typeof document==='undefined')return;if(loadTransferApplyPromise)return;loadTransferApplyPromise=import('../tabs/xml-compare-transfer-apply-runtime.js?v=20260701-transfer-selection-aware-1').catch(()=>null);}
function loadCandidateReviewRuntime(){if(typeof document==='undefined')return;if(loadCandidateReviewPromise)return;loadCandidateReviewPromise=import('../tabs/xml-compare-candidate-review-runtime.js?v=20260701-candidate-review-1').catch(()=>null);}
function loadLinewiseInfoRuleRuntime(){if(typeof document==='undefined')return;if(loadLinewiseInfoRulePromise)return;loadLinewiseInfoRulePromise=import('../tabs/xml-compare-linewise-info-rule-runtime.js?v=20260701-linewise-rule-info-1').catch(()=>null);}

const esc=(v)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
function createManualState(manualConnectors=[],navStates={}){const connectors=Array.isArray(manualConnectors)?manualConnectors:[];const pendingSourceUid=connectors.length?'':String(navStates?.source?.selectedUid||'');return Object.freeze({pendingSourceUid,connectors:Object.freeze(connectors)});}
function sideCard(side,title,data={},navState=null,manualState=null){return `<section class="xml-compare-workspace-side is-${esc(side)}">${renderXmlCompareGraphCanvasHtml({side,title,data,navState,manualState})}</section>`;}
function compareFieldOptions(source=null,target=null,compareFields=[]){const selected=new Set(normalizeCompareFields(compareFields));const fields=availableCompareFields([...(source?.levelView?.fields||[]),...(target?.levelView?.fields||[])]);return fields.map((field)=>`<option value="${esc(field)}" ${selected.has(field)?'disabled':''}>${esc(field)}</option>`).join('');}
function compareFieldControls(source=null,target=null,compareFields=[]){const selected=normalizeCompareFields(compareFields);return `<div class="xml-compare-compare-field-controls" data-xml-compare-compare-fields><label>Compare fields<select data-xml-compare-compare-field-picker>${compareFieldOptions(source,target,selected)}</select></label><button type="button" data-xml-compare-add-compare-field>Add Field</button><div class="xml-compare-compare-field-list">${selected.map((field)=>`<span class="xml-compare-compare-field-pill" data-xml-compare-compare-field="${esc(field)}">${esc(field)} <button type="button" data-xml-compare-remove-compare-field="${esc(field)}" aria-label="Remove ${esc(field)}">×</button></span>`).join('')||'<small>No compare fields selected.</small>'}</div></div>`;}
function patchConnectorLaneActions(html='',source=null,target=null,compareFields=[]){return String(html).replace(/<div class="xml-compare-auto-map-actions">([\s\S]*?)<\/div>/,(panel,body)=>`<div class="xml-compare-auto-map-actions">${body.replace('Auto Map Selected Node','Auto Map Selected').replace(/<button type="button" data-xml-compare-action="auto-map-line">[\s\S]*?<\/button>/,'')}${compareFieldControls(source,target,compareFields)}</div>`);}
function connectorLane(matchMap=null,manualState=null,connectorCandidates=null,source=null,target=null,compareFields=[]){return patchConnectorLaneActions(renderXmlCompareGraphConnectorLaneHtml({matchMap,manualState,connectorCandidates}),source,target,compareFields);}
export function renderXmlCompareWorkspaceShellHtml({source=null,target=null,logs=[],diagnostics=[],navStates={},matchMap=null,manualConnectors=[],connectorCandidates=null,compareFields=[]}={}){loadTabDiagnostics();loadSamplePickers();loadCategorizedConverter();loadTableCategorizedXml();loadToolbarGate();loadTransferApplyRuntime();loadCandidateReviewRuntime();loadLinewiseInfoRuleRuntime();const manualState=createManualState(manualConnectors,navStates);const transferPreview=createXmlCompareTransferPreview({source,target,manualConnectors});return `<section class="xml-compare-workspace-shell is-rebuilt" data-xml-compare-workspace-shell data-xml-compare-workspace-shell-schema="${XML_COMPARE_WORKSPACE_SHELL_SCHEMA}"><div class="xml-compare-workspace-grid is-two-canvas">${sideCard('source','Source',source||{},navStates.source,manualState)}${connectorLane(matchMap,manualState,connectorCandidates,source,target,compareFields)}${sideCard('target','Target',target||{},navStates.target,manualState)}</div><div class="xml-compare-bottom-tabs">${renderXmlCompareDetailsPanelHtml({})}${renderXmlCompareTransferPreviewPanelHtml(transferPreview)}${renderXmlCompareLogScreenHtml(logs)}${renderXmlCompareDiagnosticsPanelHtml({diagnostics})}${renderXmlCompareDebugPanelHtml({source,target,logs,diagnostics,manualConnectors})}</div>${renderXmlCompareAutoMapPopupHtml({matchMap,source,target,compareFields})}</section>`;}
export const _test=Object.freeze({esc,createManualState,compareFieldOptions,compareFieldControls,patchConnectorLaneActions});
