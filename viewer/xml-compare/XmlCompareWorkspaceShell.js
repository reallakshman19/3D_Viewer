import { renderXmlCompareCanvasHostHtml } from './XmlCompareCanvasHost.js';
import { renderXmlCompareConnectorOverlayHtml } from './XmlCompareConnectorOverlay.js';
import { renderXmlCompareDetailsPanelHtml } from './XmlCompareDetailsPanel.js';
import { renderXmlCompareDiagnosticsPanelHtml } from './XmlCompareDiagnosticsPanel.js';
import { renderXmlCompareDebugPanelHtml } from './XmlCompareDebugPanel.js';
import { renderXmlCompareLogScreenHtml } from './XmlCompareLogScreen.js';
export const XML_COMPARE_WORKSPACE_SHELL_SCHEMA='xml-compare-workspace-shell/v2';
let loadDiagnosticsPromise=null;
function loadTabDiagnostics(){if(typeof document==='undefined')return;if(loadDiagnosticsPromise)return;loadDiagnosticsPromise=import('../tabs/xml-compare-load-diagnostics-runtime.js?v=20260628-xml-compare-load-diagnostics-3').catch(()=>null);}
const esc=(v)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
function sideCard(side,title,data={},navState=null){return `<section class="xml-compare-workspace-side is-${esc(side)}"><div class="xml-compare-side-title"><b>${esc(title)}</b><span>${esc(data.fileName||'No file')}</span></div>${renderXmlCompareCanvasHostHtml({side,title,data,navState})}</section>`;}
function lane(matchMap=null,manualConnectors=[],navStates={}){return `<section class="xml-compare-connector-lane"><header><b>Connectors</b><span>Source → Target</span></header>${renderXmlCompareConnectorOverlayHtml({matchMap,manualConnectors,navStates})}<small>Click one source node, then one target node. Manual connectors are locked immediately.</small></section>`;}
export function renderXmlCompareWorkspaceShellHtml({source=null,target=null,logs=[],diagnostics=[],navStates={},matchMap=null,manualConnectors=[]}={}){loadTabDiagnostics();return `<section class="xml-compare-workspace-shell is-rebuilt" data-xml-compare-workspace-shell><div class="xml-compare-workspace-grid is-two-canvas">${sideCard('source','Source',source||{},navStates.source)}${lane(matchMap,manualConnectors,navStates)}${sideCard('target','Target',target||{},navStates.target)}</div><div class="xml-compare-bottom-tabs">${renderXmlCompareDetailsPanelHtml({})}${renderXmlCompareLogScreenHtml(logs)}${renderXmlCompareDiagnosticsPanelHtml({diagnostics})}${renderXmlCompareDebugPanelHtml({source,target,logs,diagnostics,manualConnectors})}</div></section>`;}
export const _test=Object.freeze({esc});
