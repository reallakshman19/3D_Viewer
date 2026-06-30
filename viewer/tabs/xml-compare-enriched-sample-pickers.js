import { loadXmlCompareEnrichedSample } from './xml-compare-enriched-samples-data.js';

const STYLE_ID='xml-compare-enriched-sample-pickers-style';
const ROW_ATTR='data-xml-compare-enriched-sample-pickers';
const SAMPLES=Object.freeze({
  a:{label:'BM_CII_INPUT_SOURCE FILE_enriched XML',fileName:'BM_CII_INPUT_SOURCE_FILE_enriched.xml',title:'Load generated Source enriched XML'},
  b:{label:'BM_CII_LINEBASIS_INPUT_TARGET FILE_enriched XML',fileName:'BM_CII_LINEBASIS_INPUT_TARGET_FILE_enriched.xml',title:'Load generated Target enriched XML'}
});

function injectStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`.xml-compare-enriched-sample-pickers{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px 10px;border-top:1px solid rgba(96,165,250,.18);border-bottom:1px solid rgba(96,165,250,.18);background:rgba(2,6,23,.36)}.xml-compare-enriched-sample-pickers button{display:flex;align-items:center;justify-content:center;gap:7px;min-height:34px;border:1px solid rgba(34,197,94,.45);border-radius:10px;background:rgba(6,78,59,.38);color:#dcfce7;font-size:12px;font-weight:850;cursor:pointer}.xml-compare-enriched-sample-pickers button:hover{border-color:rgba(134,239,172,.88);background:rgba(6,95,70,.58)}.xml-compare-enriched-sample-pickers button[disabled]{opacity:.65;cursor:wait}.xml-compare-enriched-sample-pickers small{display:block;color:#a7f3d0;font-size:10px;font-weight:700;line-height:1.15}@media(max-width:900px){.xml-compare-enriched-sample-pickers{grid-template-columns:1fr}}`;
  document.head.append(style);
}

function pickerHtml(){
  return `<div class="xml-compare-enriched-sample-pickers" ${ROW_ATTR}>
    <button type="button" data-xml-compare-pick-enriched="a" title="${SAMPLES.a.title}">🧪 <span>${SAMPLES.a.label}<small>${SAMPLES.a.fileName}</small></span></button>
    <button type="button" data-xml-compare-pick-enriched="b" title="${SAMPLES.b.title}">🎯 <span>${SAMPLES.b.label}<small>${SAMPLES.b.fileName}</small></span></button>
  </div>`;
}

function injectPickers(){
  const tab=document.querySelector('.xml-compare-tab');
  const toolbar=tab?.querySelector('.xml-compare-toolbar');
  if(!tab||!toolbar||tab.querySelector(`[${ROW_ATTR}]`))return;
  injectStyle();
  toolbar.insertAdjacentHTML('afterend',pickerHtml());
}

function setInputFile(input,file){
  const transfer=new DataTransfer();
  transfer.items.add(file);
  input.files=transfer.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
}

async function loadSample(side,button){
  const input=document.querySelector(`input[data-xml-compare-load="${side}"]`);
  if(!input)return;
  button.disabled=true;
  const oldText=button.dataset.oldText||button.textContent;
  button.dataset.oldText=oldText;
  button.textContent='Loading enriched XML...';
  try{
    const sample=await loadXmlCompareEnrichedSample(side==='b'?'target':'source');
    const file=new File([sample.text],sample.fileName,{type:'application/xml'});
    setInputFile(input,file);
  }catch(error){
    console.error('[XML Compare Samples] Failed to load embedded enriched sample',error);
    input.click();
  }finally{
    button.disabled=false;
    button.innerHTML=side==='b'
      ? `🎯 <span>${SAMPLES.b.label}<small>${SAMPLES.b.fileName}</small></span>`
      : `🧪 <span>${SAMPLES.a.label}<small>${SAMPLES.a.fileName}</small></span>`;
  }
}

function clickHandler(event){
  const button=event.target.closest('[data-xml-compare-pick-enriched]');
  if(!button)return;
  event.preventDefault();
  event.stopPropagation();
  const side=button.dataset.xmlComparePickEnriched==='b'?'b':'a';
  loadSample(side,button);
}

function install(){
  if(typeof document==='undefined')return;
  document.addEventListener('click',clickHandler,{capture:true});
  injectPickers();
  const observer=new MutationObserver(()=>injectPickers());
  observer.observe(document.body,{childList:true,subtree:true});
}

install();
