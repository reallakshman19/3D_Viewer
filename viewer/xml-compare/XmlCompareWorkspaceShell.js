import { renderXmlCompareGraphCanvasHtml } from './XmlCompareGraphCanvas.js';
import { renderXmlCompareGraphConnectorLaneHtml } from './XmlCompareGraphConnectorLane.js';
import { renderXmlCompareDetailsPanelHtml } from './XmlCompareDetailsPanel.js';
import { renderXmlCompareDiagnosticsPanelHtml } from './XmlCompareDiagnosticsPanel.js';
import { renderXmlCompareDebugPanelHtml } from './XmlCompareDebugPanel.js';
import { renderXmlCompareLogScreenHtml } from './XmlCompareLogScreen.js';

export const XML_COMPARE_WORKSPACE_SHELL_SCHEMA='xml-compare-workspace-shell/v3';

let loadDiagnosticsPromise=null;

function loadTabDiagnostics(){
  if(typeof document==='undefined')return;
  if(loadDiagnosticsPromise)return;
  loadDiagnosticsPromise=import('../tabs/xml-compare-load-diagnostics-runtime.js?v=20260628-xml-compare-load-diagnostics-3').catch(()=>null);
}

const esc=(v)=>String(v??'')
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'",'&#039;');

function createManualState(manualConnectors=[],navStates={}){
  const connectors=Array.isArray(manualConnectors)?manualConnectors:[];
  const pendingSourceUid=connectors.length?'':String(navStates?.source?.selectedUid||'');
  return Object.freeze({
    pendingSourceUid,
    connectors:Object.freeze(connectors)
  });
}

function sideCard(side,title,data={},navState=null,manualState=null){
  return `<section class="xml-compare-workspace-side is-${esc(side)}">${renderXmlCompareGraphCanvasHtml({
    side,
    title,
    data,
    navState,
    manualState
  })}</section>`;
}

function connectorLane(matchMap=null,manualState=null){
  return renderXmlCompareGraphConnectorLaneHtml({matchMap,manualState});
}

export function renderXmlCompareWorkspaceShellHtml({
  source=null,
  target=null,
  logs=[],
  diagnostics=[],
  navStates={},
  matchMap=null,
  manualConnectors=[]
}={}){
  loadTabDiagnostics();
  const manualState=createManualState(manualConnectors,navStates);
  return `<section class="xml-compare-workspace-shell is-rebuilt" data-xml-compare-workspace-shell>
    <div class="xml-compare-workspace-grid is-two-canvas">
      ${sideCard('source','Source',source||{},navStates.source,manualState)}
      ${connectorLane(matchMap,manualState)}
      ${sideCard('target','Target',target||{},navStates.target,manualState)}
    </div>
    <div class="xml-compare-bottom-tabs">
      ${renderXmlCompareDetailsPanelHtml({})}
      ${renderXmlCompareLogScreenHtml(logs)}
      ${renderXmlCompareDiagnosticsPanelHtml({diagnostics})}
      ${renderXmlCompareDebugPanelHtml({source,target,logs,diagnostics,manualConnectors})}
    </div>
  </section>`;
}

export const _test=Object.freeze({esc,createManualState});
