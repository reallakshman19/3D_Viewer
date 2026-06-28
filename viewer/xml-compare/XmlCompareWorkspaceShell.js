import { renderXmlCompareCanvasHostHtml } from './XmlCompareCanvasHost.js';
import { renderXmlCompareDetailsPanelHtml } from './XmlCompareDetailsPanel.js';
import { renderXmlCompareDiagnosticsPanelHtml } from './XmlCompareDiagnosticsPanel.js';
import { renderXmlCompareDebugPanelHtml } from './XmlCompareDebugPanel.js';
import { renderXmlCompareLogScreenHtml } from './XmlCompareLogScreen.js';
export const XML_COMPARE_WORKSPACE_SHELL_SCHEMA='xml-compare-workspace-shell/v1';
const esc=(v)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
function summary(label,value){return `<div><b>${esc(label)}</b><span>${esc(value)}</span></div>`;}
function sideCard(title,data={},navState=null){const side=(title||'source').toLowerCase();return `<section class="xml-compare-workspace-side"><header>${esc(title)}</header><div class="xml-compare-side-stage"><span>Profile</span><b>${esc(data.profile||data.type||'not indexed')}</b></div><div class="xml-compare-side-metrics">${summary('File',data.fileName||'—')}${summary('Records',data.summary?.nodeCount??data.componentCount??0)}${summary('Diagnostics',data.summary?.diagnosticCount??0)}</div>${renderXmlCompareCanvasHostHtml({side,title,data,navState})}</section>`;}
function lane(){return `<section class="xml-compare-connector-lane"><header>Connectors</header><div>MatchMap connector overlay lane</div><small>Visual review only; MatchMap remains authority.</small></section>`;}
export function renderXmlCompareWorkspaceShellHtml({source=null,target=null,logs=[],diagnostics=[],navStates={}}={}){return `<section class="xml-compare-workspace-shell" data-xml-compare-workspace-shell><div class="xml-compare-workspace-grid">${sideCard('Source',source||{},navStates.source)}${lane()}${sideCard('Target',target||{},navStates.target)}</div><div class="xml-compare-bottom-tabs">${renderXmlCompareDetailsPanelHtml({})}${renderXmlCompareLogScreenHtml(logs)}${renderXmlCompareDiagnosticsPanelHtml({diagnostics})}${renderXmlCompareDebugPanelHtml({source,target,logs,diagnostics})}</div></section>`;}
export const _test=Object.freeze({esc});
