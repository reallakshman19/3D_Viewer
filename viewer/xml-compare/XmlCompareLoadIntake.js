export const XML_COMPARE_LOAD_INTAKE_SCHEMA='xml-compare-load-intake/v1';

const clean=(v)=>String(v??'').trim();
const toNum=(v)=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const attr=(tag,name)=>clean(String(tag||'').match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,'i'))?.slice(1).find((v)=>v!=null)||'');
const child=(body,name)=>clean(String(body||'').match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'))?.[1]||'');
const countMatches=(text,re)=>[...String(text||'').matchAll(re)].length;
const pos=(text)=>{const value=clean(text);if(!value)return null;const parts=value.split(/[\s,]+/).map(toNum);return parts.length>=3&&parts.slice(0,3).every((n)=>n!=null)?{x:parts[0],y:parts[1],z:parts[2]}:null;};
const pointFromDelta=(tag)=>{const x=toNum(attr(tag,'DELTA_X')),y=toNum(attr(tag,'DELTA_Y')),z=toNum(attr(tag,'DELTA_Z'));return[x,y,z].every((n)=>n!=null)?{x:x||0,y:y||0,z:z||0}:null;};
function xmlElementRecords(text){
  const records=[];let index=0;
  for(const match of String(text||'').matchAll(/<PIPINGELEMENT\b([^>]*)>([\s\S]*?)<\/PIPINGELEMENT>|<PIPINGELEMENT\b([^>]*?)\/>/gi)){
    index+=1;const tag=match[1]||match[3]||'',body=match[2]||'';
    const from=attr(tag,'FROM_NODE'),to=attr(tag,'TO_NODE'),line=attr(tag,'LINE_ID')||child(body,'LineNo')||child(body,'Branchname');
    const fromName=attr(tag,'FROM_NAME'),toName=attr(tag,'TO_NAME');
    const dtxrPs=child(body,'DTXR_PS'),dtxrPos=child(body,'DTXR_POS');
    const componentType=child(body,'ComponentType')||clean(body.match(/<(BEND|RIGID|VALVE|FLANGE|TEE|SIF)\b/i)?.[1]||'PIPINGELEMENT');
    const p=pos(child(body,'Position'))||pointFromDelta(tag);
    records.push(Object.freeze({uid:`xml:${from||index}->${to||index}`,nodeNumber:from&&to?`${from}->${to}`:String(index),nodeName:fromName||toName?`${fromName||from}->${toName||to}`:`${from||'?'}->${to||'?'}`,componentType,componentRefNo:dtxrPs||dtxrPos||`${from}->${to}`,branchName:line,lineNo:line,position:p,points:p?[p]:[],raw:{from,to,line,fromName,toName,dtxrPs,dtxrPos}}));
  }
  return Object.freeze(records);
}
function jsonChildren(root){
  const out=[];const walk=(node)=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(walk);return;}if(node.type||node.attributes)out.push(node);if(Array.isArray(node.children))node.children.forEach(walk);};
  walk(root?.hierarchy||root?.children||root?.components||root);return out;
}
function jsonRecords(text){
  try{
    const root=JSON.parse(String(text||''));
    return Object.freeze(jsonChildren(root).map((node,index)=>{const a=node.attributes||node;const line=clean(a.LINE_ID||a.LineNo||a.BRANCHNAME||a['PIPELINE-REFERENCE']||a.pipelineRef);const p=pos(a.Position||a.POSITION||a.CPOS||a.APOS);return Object.freeze({uid:clean(node.id||a.id||a.COMPONENT_ID)||`json:${index+1}`,nodeNumber:clean(a.NODE||a.NodeNumber||a.FROM_NODE)||String(index+1),nodeName:clean(a.NodeName||a.FROM_NAME||a.TO_NAME||node.name||node.label),componentType:clean(node.type||a.ComponentType||a.COMPONENT_TYPE),componentRefNo:clean(a.ComponentRefNo||a.DTXR_PS||a.SOURCE_TAG||a.TAG),branchName:line,lineNo:line,position:p,points:p?[p]:[],raw:node});}));
  }catch{return Object.freeze([]);}
}
function fieldStats(text){
  const raw=String(text||'');
  const restraintTags=[...raw.matchAll(/<RESTRAINT\b[^>]*\sTAG\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi)].map((m)=>clean(m[1]||m[2]||''));
  const lines=[...raw.matchAll(/\sLINE_ID\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map((m)=>clean(m[1]||m[2]||''));
  return Object.freeze({lineIdCount:lines.filter(Boolean).length,fromNameCount:countMatches(raw,/\sFROM_NAME\s*=/gi),toNameCount:countMatches(raw,/\sTO_NAME\s*=/gi),restraintTagCount:restraintTags.filter(Boolean).length,blankRestraintTagCount:restraintTags.filter((v)=>!v).length,dtxrPsCount:countMatches(raw,/<DTXR_PS\b/i),dtxrPosCount:countMatches(raw,/<DTXR_POS\b/i)});
}
export function createXmlCompareLoadIntake({name='',text='',profile='unknown'}={}){
  const source=String(text||'');const isJson=/^\s*[\[{]/.test(source);const records=isJson?jsonRecords(source):xmlElementRecords(source);const fields=fieldStats(source);
  const branchNames=new Set(records.map((r)=>r.branchName).filter(Boolean));
  const summary=Object.freeze({charCount:source.length,recordCount:records.length,pipingElementCount:countMatches(source,/<PIPINGELEMENT\b/gi),restraintCount:countMatches(source,/<RESTRAINT\b/gi),branchCount:branchNames.size,...fields});
  return Object.freeze({schema:XML_COMPARE_LOAD_INTAKE_SCHEMA,sourceName:clean(name),profile:clean(profile),summary,records});
}
export const _test=Object.freeze({attr,child,pos,xmlElementRecords,jsonRecords,fieldStats});
