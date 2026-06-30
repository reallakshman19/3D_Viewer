import { categorizedFileName, convertCategorizedInputXml } from '../xml-compare/CategorizedInputXmlConverter.js';

const STYLE_ID='xml-compare-categorized-converter-style';
const BUTTON_ATTR='data-xml-compare-categorized-open';
const POPUP_ATTR='data-xml-compare-categorized-popup';

let loadedFile=null;
let loadedText='';

function injectStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`.xml-compare-categorized-btn{border:1px solid rgba(168,85,247,.42);border-radius:8px;background:rgba(88,28,135,.34);color:#f3e8ff;font-weight:850}.xml-compare-categorized-backdrop{position:fixed;inset:0;z-index:70;background:rgba(2,6,23,.68);display:grid;place-items:center}.xml-compare-categorized-dialog{width:min(760px,calc(100vw - 28px));max-height:calc(100vh - 28px);overflow:auto;border:1px solid rgba(216,180,254,.42);border-radius:16px;background:#0f172a;color:#dbeafe;box-shadow:0 24px 80px rgba(0,0,0,.48)}.xml-compare-categorized-dialog header{display:flex;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(148,163,184,.18)}.xml-compare-categorized-dialog h3{margin:0;color:#f3e8ff}.xml-compare-categorized-dialog p{margin:4px 0 0;color:#94a3b8}.xml-compare-categorized-body{display:grid;gap:12px;padding:14px}.xml-compare-categorized-direction{display:grid;grid-template-columns:1fr 1fr;gap:10px}.xml-compare-categorized-direction label,.xml-compare-categorized-file{border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(2,6,23,.32);padding:10px}.xml-compare-categorized-file input{display:block;margin-top:8px}.xml-compare-categorized-status{border:1px solid rgba(34,197,94,.28);border-radius:10px;background:rgba(6,78,59,.20);padding:9px;color:#bbf7d0;font-size:12px}.xml-compare-categorized-actions{display:flex;gap:8px;justify-content:flex-end;padding:12px 14px;border-top:1px solid rgba(148,163,184,.18)}.xml-compare-categorized-actions button,.xml-compare-categorized-dialog header button{border:1px solid rgba(216,180,254,.35);border-radius:9px;background:rgba(30,41,59,.92);color:#f3e8ff;padding:7px 10px;font-weight:800}.xml-compare-categorized-actions button:disabled{opacity:.5}.xml-compare-categorized-note{font-size:12px;color:#cbd5e1;line-height:1.45}`;
  document.head.append(style);
}

function downloadText(name,text,type='application/xml;charset=utf-8'){
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download=name;document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);
}

function selectedDirection(){return document.querySelector('[name="xml-compare-categorized-direction"]:checked')?.value||'input-to-categorized';}
function popupHtml(){return `<div class="xml-compare-categorized-backdrop" ${POPUP_ATTR}>
  <section class="xml-compare-categorized-dialog" role="dialog" aria-modal="true" aria-label="InputXML CategorizedInputXML converter">
    <header><div><h3>InputXML ↔ CategorizedInputXML</h3><p>Dedicated two-way converter for Categorized Enriched XML. XML content may be in .xml or .txt files.</p></div><button type="button" data-xml-compare-categorized-close>Close</button></header>
    <div class="xml-compare-categorized-body">
      <div class="xml-compare-categorized-direction">
        <label><input type="radio" name="xml-compare-categorized-direction" value="input-to-categorized" checked> InputXML → CategorizedInputXML</label>
        <label><input type="radio" name="xml-compare-categorized-direction" value="categorized-to-input"> CategorizedInputXML → InputXML</label>
      </div>
      <label class="xml-compare-categorized-file">Import XML / TXT file
        <input type="file" accept=".xml,.XML,.txt,.TXT,text/xml,application/xml,text/plain" data-xml-compare-categorized-import>
      </label>
      <div class="xml-compare-categorized-status" data-xml-compare-categorized-status>No file imported.</div>
      <div class="xml-compare-categorized-note">Blocks created: Name, Route Geometry, Section Dimensions, Process, Material, Derived Coordinates, Bend, SIF, Rigid, Flange, Restraints, Displacements, Forces/Moments, Misc, and OriginalElement. Reverse conversion uses OriginalElement when present.</div>
    </div>
    <footer class="xml-compare-categorized-actions"><button type="button" data-xml-compare-categorized-export disabled>Export converted XML</button></footer>
  </section>
</div>`;}

function injectButton(){
  const tab=document.querySelector('.xml-compare-tab');
  const toolbar=tab?.querySelector('.xml-compare-toolbar');
  if(!toolbar||toolbar.querySelector(`[${BUTTON_ATTR}]`))return;
  injectStyle();
  const enrichment=toolbar.querySelector('[data-xml-compare-action="open-enrichment"]');
  const button=document.createElement('button');
  button.type='button';button.className='xml-compare-categorized-btn';button.setAttribute(BUTTON_ATTR,'');button.textContent='InputXML ↔ CategorizedInputXML';
  if(enrichment)enrichment.insertAdjacentElement('afterend',button);else toolbar.append(button);
}
function openPopup(){injectStyle();loadedFile=null;loadedText='';document.querySelector(`[${POPUP_ATTR}]`)?.remove();document.body.insertAdjacentHTML('beforeend',popupHtml());}
function closePopup(){document.querySelector(`[${POPUP_ATTR}]`)?.remove();}
function setStatus(message){const el=document.querySelector('[data-xml-compare-categorized-status]');if(el)el.textContent=message;}
function setExportEnabled(enabled){const btn=document.querySelector('[data-xml-compare-categorized-export]');if(btn)btn.disabled=!enabled;}
async function importFile(input){const file=input.files?.[0];if(!file)return;loadedFile=file;loadedText=await file.text();setStatus(`Imported ${file.name} (${loadedText.length.toLocaleString()} chars). Ready to export.`);setExportEnabled(Boolean(loadedText.trim()));}
function exportConverted(){if(!loadedText.trim())return;const direction=selectedDirection();const text=convertCategorizedInputXml(loadedText,direction,{sourceName:loadedFile?.name||'InputXML'});downloadText(categorizedFileName(loadedFile?.name||'input.xml',direction),text);setStatus(`Exported ${categorizedFileName(loadedFile?.name||'input.xml',direction)}.`);}
function clickHandler(event){
  if(event.target.closest(`[${BUTTON_ATTR}]`)){event.preventDefault();openPopup();return;}
  if(event.target.closest('[data-xml-compare-categorized-close]')){event.preventDefault();closePopup();return;}
  if(event.target.closest('[data-xml-compare-categorized-export]')){event.preventDefault();exportConverted();}
}
function changeHandler(event){const input=event.target.closest('[data-xml-compare-categorized-import]');if(input)importFile(input).catch((error)=>setStatus(`Import failed: ${error?.message||String(error)}`));}
function install(){if(typeof document==='undefined')return;document.addEventListener('click',clickHandler,{capture:true});document.addEventListener('change',changeHandler,{capture:true});injectButton();new MutationObserver(()=>injectButton()).observe(document.body,{childList:true,subtree:true});}
install();
