import { applyCategorizedTransferPlan } from '../xml-compare/XmlCompareCategorizedTransferApplier.js';

export const XML_COMPARE_TRANSFER_APPLY_RUNTIME_SCHEMA='xml-compare-transfer-apply-runtime/v1';

const STYLE_ID='xml-compare-transfer-apply-runtime-style';
const CACHE=globalThis.__xmlCompareTransferApplyCache ||= {a:null,b:null};

const clean=(value)=>String(value??'').trim();
const isCategorized=(text='')=>/<CategorizedInputXML\b/i.test(String(text));

function injectStyle(){
  if(typeof document==='undefined')return;
  let style=document.getElementById(STYLE_ID);
  if(!style){style=document.createElement('style');style.id=STYLE_ID;document.head.append(style);}
  style.textContent='.xml-compare-transfer-apply-actions{display:flex;gap:8px;flex-wrap:wrap;padding:8px 10px;border-top:1px solid rgba(148,163,184,.12);border-bottom:1px solid rgba(148,163,184,.12)}.xml-compare-transfer-apply-actions button{border:1px solid rgba(52,211,153,.42)!important;background:rgba(6,78,59,.58)!important;color:#d1fae5!important}.xml-compare-transfer-apply-note{font-size:11px;color:#a7f3d0;padding:0 10px 8px}.xml-compare-transfer-apply-error{font-size:11px;color:#fecaca;padding:8px 10px;background:rgba(127,29,29,.28);border-top:1px solid rgba(248,113,113,.24)}';
}

function fileNameFor(side='b'){
  const input=document.querySelector(`input[data-xml-compare-load="${side}"]`);
  return input?.files?.[0]?.name||`${side==='a'?'source':'target'}-categorized.xml`;
}

function transferredFileName(name='target-categorized.xml'){
  const base=clean(name||'target-categorized.xml').replace(/\.(xml|txt)$/i,'');
  return `${base}_transferred_categorized.xml`;
}

async function textFromSide(side='a'){
  if(CACHE[side]?.text)return CACHE[side].text;
  const input=document.querySelector(`input[data-xml-compare-load="${side}"]`);
  const file=input?.files?.[0];
  if(file){
    const text=await file.text();
    CACHE[side]={fileName:file.name,text};
    return text;
  }
  return '';
}

async function rememberInputFile(input){
  const side=input?.dataset?.xmlCompareLoad==='b'?'b':'a';
  const file=input?.files?.[0];
  if(!file)return;
  try{CACHE[side]={fileName:file.name,text:await file.text()};}catch{}
}

function parsePreviewPlan(pane){
  const pre=pane?.querySelector?.('details[open] pre')||pane?.querySelector?.('pre');
  if(!pre)return null;
  try{return JSON.parse(pre.textContent||'');}catch{return null;}
}

function activeScopePane(popup,scope='node'){
  return popup?.querySelector?.(`.xml-compare-scope-body.is-${scope}-scope`)||null;
}

function setRuntimeMessage(popup,message,kind='note'){
  const card=popup?.querySelector?.('.xml-compare-automap-card')||popup;
  if(!card)return;
  card.querySelectorAll('[data-xml-compare-transfer-runtime-message]').forEach((item)=>item.remove());
  const node=document.createElement('div');
  node.dataset.xmlCompareTransferRuntimeMessage='true';
  node.className=kind==='error'?'xml-compare-transfer-apply-error':'xml-compare-transfer-apply-note';
  node.textContent=message;
  card.append(node);
}

function selectedScopeFromButton(button){
  return clean(button?.dataset?.xmlCompareTransferScope)||'node';
}

function addApplyActionsToPane(pane,scope){
  if(!pane||pane.querySelector('[data-xml-compare-transfer-apply-actions]'))return;
  const actions=document.createElement('div');
  actions.className='xml-compare-transfer-apply-actions';
  actions.dataset.xmlCompareTransferApplyActions='true';
  actions.innerHTML=`<button type="button" data-xml-compare-action="apply-scoped-transfer" data-xml-compare-transfer-scope="${scope}">Apply ${scope} transfer to Target B</button><button type="button" data-xml-compare-action="export-scoped-transfer" data-xml-compare-transfer-scope="${scope}">Download transferred Target XML</button>`;
  const details=pane.querySelector('details');
  if(details)details.after(actions);else pane.append(actions);
}

function augmentApplyButtons(){
  if(typeof document==='undefined')return;
  injectStyle();
  for(const scope of ['node','element','line'])document.querySelectorAll(`.xml-compare-scope-body.is-${scope}-scope`).forEach((pane)=>addApplyActionsToPane(pane,scope));
}

function loadTargetXml(text,name){
  const input=document.querySelector('input[data-xml-compare-load="b"]');
  if(!input)throw new Error('Target B loader not found');
  const file=new File([text],name,{type:'application/xml'});
  const transfer=new DataTransfer();
  transfer.items.add(file);
  input.files=transfer.files;
  CACHE.b={fileName:name,text};
  input.dispatchEvent(new Event('change',{bubbles:true}));
}

function downloadText(name,text){
  const blob=new Blob([text],{type:'application/xml;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function applyTransferPreviewToTarget({sourceText='',targetText='',previewPlan={},policy='replace'}={}){
  if(!isCategorized(sourceText))throw new Error('Source A must be CategorizedInputXML before transfer apply.');
  if(!isCategorized(targetText))throw new Error('Target B must be CategorizedInputXML before transfer apply.');
  if(!previewPlan||typeof previewPlan!=='object')throw new Error('Transfer preview plan is missing.');
  return applyCategorizedTransferPlan(targetText,sourceText,previewPlan,{policy});
}

async function handleTransferAction(event,button){
  const popup=button.closest('[data-xml-compare-automap-popup]');
  const scope=selectedScopeFromButton(button);
  const pane=activeScopePane(popup,scope);
  const plan=parsePreviewPlan(pane);
  if(!plan){setRuntimeMessage(popup,`No ${scope} transfer preview plan found.`, 'error');return;}
  const sourceText=await textFromSide('a');
  const targetText=await textFromSide('b');
  const result=applyTransferPreviewToTarget({sourceText,targetText,previewPlan:plan,policy:'replace'});
  const updated=result.audit?.filter((row)=>row.status==='updated').length||0;
  const skipped=result.audit?.filter((row)=>row.status==='skipped').length||0;
  const name=transferredFileName(fileNameFor('b'));
  if(button.dataset.xmlCompareAction==='export-scoped-transfer'){
    downloadText(name,result.xml);
    setRuntimeMessage(popup,`Downloaded ${name}. Updated ${updated}, skipped ${skipped}.`);
    return;
  }
  loadTargetXml(result.xml,name);
  setTimeout(()=>setRuntimeMessage(document.querySelector('[data-xml-compare-automap-popup]')||popup,`Applied ${scope} transfer to Target B. Updated ${updated}, skipped ${skipped}.`),50);
}

function install(){
  if(typeof document==='undefined')return;
  injectStyle();
  document.addEventListener('change',(event)=>{const input=event.target?.closest?.('input[data-xml-compare-load]');if(input)rememberInputFile(input);},{capture:true});
  document.addEventListener('click',(event)=>{
    const button=event.target?.closest?.('[data-xml-compare-action="apply-scoped-transfer"],[data-xml-compare-action="export-scoped-transfer"]');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handleTransferAction(event,button).catch((error)=>setRuntimeMessage(button.closest('[data-xml-compare-automap-popup]'),error?.message||String(error),'error'));
  },{capture:true});
  new MutationObserver(()=>augmentApplyButtons()).observe(document.body,{childList:true,subtree:true});
  augmentApplyButtons();
}

install();

export const _test=Object.freeze({isCategorized,transferredFileName,parsePreviewPlan,applyTransferPreviewToTarget});
