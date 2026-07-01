import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { TABLE_CATEGORIZED_XML_BUTTON_ATTR, TABLE_CATEGORIZED_XML_POPUP_ATTR, renderTableCategorizedXmlButtonHtml, renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';

export const XML_COMPARE_TABLE_CATEGORIZED_RUNTIME_SCHEMA='xml-compare-table-categorized-runtime/v1';

const STYLE_ID='xml-compare-table-categorized-style';
const BUTTON_SELECTOR=`[${TABLE_CATEGORIZED_XML_BUTTON_ATTR}]`;
const POPUP_SELECTOR=`[${TABLE_CATEGORIZED_XML_POPUP_ATTR}]`;

const state={activeTab:'source',sourceName:'Pasted Source 1',sourceText:'',source:null};

function injectStyle(){
  let style=document.getElementById(STYLE_ID);
  if(!style){style=document.createElement('style');style.id=STYLE_ID;document.head.append(style);}
  style.textContent=`.xml-compare-table-categorized-btn{border:1px solid rgba(14,165,233,.45);border-radius:8px;background:rgba(8,47,73,.42);color:#e0f2fe;font-weight:850}.table-categorized-xml-backdrop{position:fixed;inset:0;z-index:72;background:rgba(2,6,23,.72);display:grid;place-items:center}.table-categorized-xml-dialog{width:min(1220px,calc(100vw - 28px));height:min(840px,calc(100vh - 28px));display:grid;grid-template-rows:auto auto 1fr auto;border:1px solid rgba(125,211,252,.42);border-radius:18px;background:#0f172a;color:#dbeafe;box-shadow:0 24px 80px rgba(0,0,0,.54);overflow:hidden}.table-categorized-xml-dialog header,.table-categorized-xml-dialog footer{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px 14px;border-bottom:1px solid rgba(148,163,184,.18);background:linear-gradient(90deg,rgba(8,47,73,.36),rgba(15,23,42,.55))}.table-categorized-xml-dialog footer{border-top:1px solid rgba(148,163,184,.18);border-bottom:0}.table-categorized-xml-dialog h3,.table-categorized-xml-dialog h4{margin:0;color:#e0f2fe}.table-categorized-xml-dialog p{margin:6px 0;color:#94a3b8}.table-categorized-xml-dialog button,.table-categorized-file{border:1px solid rgba(125,211,252,.35);border-radius:10px;background:rgba(30,41,59,.92);color:#e0f2fe;padding:7px 10px;font-weight:800}.table-categorized-xml-dialog button:disabled{opacity:.5}.table-categorized-xml-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:10px 12px;border-bottom:1px solid rgba(148,163,184,.16);background:rgba(2,6,23,.34)}.table-categorized-xml-tabs button{text-align:left}.table-categorized-xml-tabs b,.table-categorized-xml-tabs small{display:block}.table-categorized-xml-tabs small{color:#94a3b8}.table-categorized-xml-tabs .is-active{background:rgba(14,116,144,.62)}.table-categorized-xml-body{min-height:0;overflow:auto;padding:12px}.table-categorized-xml-card,.table-categorized-xml-subcard{border:1px solid rgba(148,163,184,.18);border-radius:14px;background:rgba(2,6,23,.34);padding:12px;margin-bottom:12px}.table-categorized-xml-card label{display:grid;gap:6px;margin-top:10px;color:#bfdbfe;font-weight:800;font-size:12px}.table-categorized-xml-card input,.table-categorized-xml-card textarea{border:1px solid rgba(96,165,250,.25);border-radius:10px;background:#020617;color:#dbeafe;padding:8px;font-family:ui-monospace,Menlo,Consolas,monospace}.table-categorized-xml-card textarea{min-height:170px;resize:vertical}.table-categorized-file{display:inline-grid!important;margin-top:0!important}.table-categorized-file input{display:none}.table-categorized-xml-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.table-categorized-xml-scroll{overflow:auto;max-height:320px}.table-categorized-xml-dialog table{width:100%;border-collapse:collapse;font-size:12px}.table-categorized-xml-dialog th,.table-categorized-xml-dialog td{border-bottom:1px solid rgba(148,163,184,.13);padding:7px;text-align:left;vertical-align:top}.table-categorized-xml-dialog th{color:#93c5fd}.table-categorized-xml-dialog li{margin:5px 0;color:#cbd5e1}.table-categorized-xml-dialog li.is-warning{color:#fde68a}.table-categorized-xml-dialog li.is-error{color:#fecaca}@media(max-width:760px){.table-categorized-xml-tabs{grid-template-columns:1fr}.table-categorized-xml-dialog header,.table-categorized-xml-dialog footer{align-items:flex-start;flex-direction:column}}`;
}

function renderShell(){
  const popup=document.querySelector(POPUP_SELECTOR);
  if(popup)popup.outerHTML=renderTableCategorizedXmlShellHtml(state);
}

function openShell(){
  injectStyle();
  document.querySelector(POPUP_SELECTOR)?.remove();
  document.body.insertAdjacentHTML('beforeend',renderTableCategorizedXmlShellHtml(state));
}

function closeShell(){
  document.querySelector(POPUP_SELECTOR)?.remove();
}

function injectButton(){
  const toolbar=document.querySelector('.xml-compare-tab .xml-compare-toolbar');
  if(!toolbar||toolbar.querySelector(BUTTON_SELECTOR))return;
  injectStyle();
  const linewise=toolbar.querySelector('[data-xml-compare-categorized-open]');
  if(linewise)linewise.insertAdjacentHTML('afterend',renderTableCategorizedXmlButtonHtml());
  else toolbar.insertAdjacentHTML('beforeend',renderTableCategorizedXmlButtonHtml());
}

function parseCurrentSource(sourceType='pasteText'){
  state.source=parseTableSource(state.sourceText,{sourceId:'S1',sourceName:state.sourceName,sourceType});
  state.activeTab='source';
  renderShell();
}

function clearSource(){
  state.sourceText='';
  state.source=null;
  state.activeTab='source';
  renderShell();
}

async function importFile(input){
  const file=input.files?.[0];
  if(!file)return;
  state.sourceName=file.name||state.sourceName;
  state.sourceText=await file.text();
  parseCurrentSource('file');
}

function clickHandler(event){
  if(event.target.closest(BUTTON_SELECTOR)){event.preventDefault();openShell();return;}
  if(event.target.closest('[data-table-categorized-close]')){event.preventDefault();closeShell();return;}
  const tab=event.target.closest('[data-table-categorized-tab]')?.dataset.tableCategorizedTab;
  if(tab){event.preventDefault();state.activeTab=tab;renderShell();return;}
  const action=event.target.closest('[data-table-categorized-action]')?.dataset.tableCategorizedAction;
  if(action==='parse'){event.preventDefault();parseCurrentSource();return;}
  if(action==='clear'){event.preventDefault();clearSource();}
}

function inputHandler(event){
  const name=event.target.closest('[data-table-categorized-source-name]');
  if(name){state.sourceName=name.value;return;}
  const text=event.target.closest('[data-table-categorized-source-text]');
  if(text){state.sourceText=text.value;}
}

function changeHandler(event){
  const input=event.target.closest('[data-table-categorized-file]');
  if(input)importFile(input).catch((error)=>console.error('[Table Categorized XML] file import failed',error));
}

function install(){
  if(typeof document==='undefined')return;
  document.addEventListener('click',clickHandler,{capture:true});
  document.addEventListener('input',inputHandler,{capture:true});
  document.addEventListener('change',changeHandler,{capture:true});
  injectButton();
  new MutationObserver(()=>injectButton()).observe(document.body,{childList:true,subtree:true});
}

install();
