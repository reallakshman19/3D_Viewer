export const XML_COMPARE_CATEGORIZED_TRANSFER_APPLIER_SCHEMA='xml-compare-categorized-transfer-applier/v1';

const clean=(value)=>String(value??'').trim();
const NODE_REF_ATTRS=Object.freeze(['NODE','NODE_NUM','nodeNumber','nodeRef']);
const OPEN_TAG='(?:[^"\'>]|"[^"]*"|\'[^\']*\')*';

function tagRe(tag=''){return new RegExp(`<${tag}\\b${OPEN_TAG}(?:\\/>|>[\\s\\S]*?<\\/${tag}>)`,'i');}
function tagReGlobal(tag=''){return new RegExp(`<${tag}\\b${OPEN_TAG}(?:\\/>|>[\\s\\S]*?<\\/${tag}>)`,'gi');}
function attrsOf(tag=''){
  const out={};
  String(tag).replace(/([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g,(_,key,_q,dq,sq)=>{out[key]=dq??sq??'';return _;});
  return out;
}
function lineIdFromOpen(open=''){const attrs=attrsOf(open);return clean(attrs.id||attrs.lineId||attrs.LINE_ID||'');}
function elementAttrs(open=''){return attrsOf(open);}
function elementKey(attrs={}){return clean(attrs.elementKey)||`${clean(attrs.fromNode||attrs.FROM_NODE)}->${clean(attrs.toNode||attrs.TO_NODE)}`;}
function splitLines(xml=''){
  const text=String(xml??''),rows=[];
  const re=new RegExp(`<Line\\b${OPEN_TAG}>[\\s\\S]*?<\\/Line>`,'gi');
  let match;while((match=re.exec(text)))rows.push({start:match.index,end:match.index+match[0].length,xml:match[0],open:match[0].match(new RegExp(`^<Line\\b${OPEN_TAG}>`,'i'))?.[0]||''});
  return rows;
}
function splitElements(lineXml=''){
  const rows=[];
  const re=new RegExp(`<Element\\b${OPEN_TAG}>[\\s\\S]*?<\\/Element>`,'gi');
  let match;while((match=re.exec(String(lineXml))))rows.push({start:match.index,end:match.index+match[0].length,xml:match[0],open:match[0].match(new RegExp(`^<Element\\b${OPEN_TAG}>`,'i'))?.[0]||''});
  return rows;
}
function findLine(xml='',lineId=''){
  const wanted=clean(lineId);
  return splitLines(xml).find((line)=>lineIdFromOpen(line.open)===wanted)||null;
}
function findElement(xml='',elementKeyValue=''){
  const wanted=clean(elementKeyValue);
  for(const line of splitLines(xml)){
    for(const element of splitElements(line.xml))if(elementKey(elementAttrs(element.open))===wanted)return {...element,start:line.start+element.start,end:line.start+element.end,line};
  }
  return null;
}
function findBlock(container='',blockName=''){return String(container).match(tagRe(blockName))?.[0]||'';}
function findBlocks(container='',blockNames=[]){return blockNames.map((name)=>findBlock(container,name)).filter(Boolean);}
function removeBlocks(container='',blockNames=[]){let out=String(container);for(const name of blockNames)out=out.replace(tagReGlobal(name),'');return out;}
function replaceRange(text='',start=0,end=0,replacement=''){return `${text.slice(0,start)}${replacement}${text.slice(end)}`;}
function insertBeforeClosing(container='',closeTag='',content=''){
  const index=container.lastIndexOf(closeTag);
  if(index<0)return `${container}\n${content}`;
  return `${container.slice(0,index)}${content}\n${container.slice(index)}`;
}
function escapeRegExp(value=''){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function rewriteNodeReferences(block='',sourceNode='',targetNode=''){
  const from=clean(sourceNode),to=clean(targetNode);
  if(!from||!to)return block;
  let out=String(block);
  for(const attr of NODE_REF_ATTRS){
    out=out.replace(new RegExp(`(${attr}\\s*=\\s*["'])${escapeRegExp(from)}(?:\\.0+)?(["'])`,'gi'),`$1${to}$2`);
  }
  return out;
}
function mergePolicyTarget(target='',incoming='',blockNames=[],policy='replace'){
  const cleanIncoming=clean(incoming);
  if(!cleanIncoming)return target;
  if(policy==='append')return insertBeforeClosing(target,'</Element>',`\n${cleanIncoming}`);
  if(policy==='skip-existing'&&blockNames.some((block)=>findBlock(target,block)))return target;
  return insertBeforeClosing(removeBlocks(target,blockNames),'</Element>',`\n${cleanIncoming}`);
}
function updateElement(xml='',elementKeyValue='',updater=(element)=>element){
  const found=findElement(xml,elementKeyValue);
  if(!found)return {xml,updated:false,reason:'target-element-not-found'};
  const next=updater(found.xml);
  return {xml:replaceRange(xml,found.start,found.end,next),updated:next!==found.xml};
}
function updateLine(xml='',lineId='',updater=(line)=>line){
  const found=findLine(xml,lineId);
  if(!found)return {xml,updated:false,reason:'target-line-not-found'};
  const next=updater(found.xml);
  return {xml:replaceRange(xml,found.start,found.end,next),updated:next!==found.xml};
}
function ensureLineBlocks(lineXml=''){
  if(/<LineBlocks\b/i.test(lineXml))return lineXml;
  return lineXml.replace(new RegExp(`(<Line\\b${OPEN_TAG}>)`,'i'),'$1\n  <LineBlocks>\n  </LineBlocks>');
}
function updateLineBlocks(lineXml='',blocks=[],policy='replace'){
  let out=ensureLineBlocks(lineXml);
  const match=out.match(/<LineBlocks\b[^>]*>[\s\S]*?<\/LineBlocks>/i);
  if(!match)return out;
  const blockNames=blocks.map((block)=>clean(block.match(/^<([A-Za-z_][\w:.-]*)/)?.[1]||'')).filter(Boolean);
  let body=match[0];
  if(policy!=='append')for(const name of blockNames)body=body.replace(tagReGlobal(name),'');
  body=body.replace(/<\/LineBlocks>\s*$/i,`${blocks.map((block)=>`\n    ${clean(block)}`).join('')}\n  </LineBlocks>`);
  return out.replace(match[0],body);
}
function sourceBlocksByElement(sourceXml='',elementKeyValue='',blockNames=[]){const found=findElement(sourceXml,elementKeyValue);return found?findBlocks(found.xml,blockNames):[];}
function sourceBlocksByLine(sourceXml='',lineId='',blockNames=[]){const found=findLine(sourceXml,lineId);return found?findBlocks(found.xml,blockNames):[];}
function sourceNodeBlocks(sourceXml='',sourceNode='',blockNames=[]){
  const blocks=[];
  for(const line of splitLines(sourceXml))for(const element of splitElements(line.xml))for(const blockName of blockNames){
    const block=findBlock(element.xml,blockName);
    if(block&&new RegExp(`\\b(?:NODE|NODE_NUM|nodeNumber|nodeRef)\\s*=\\s*["']${escapeRegExp(clean(sourceNode))}(?:\\.0+)?["']`,'i').test(block))blocks.push(block);
  }
  return blocks;
}
export function applyNodeBlockTransfer(targetXml='',sourceXml='',plan={},options={}){
  const blockNames=Array.isArray(plan.selectedBlocks)?plan.selectedBlocks:[];
  let xml=String(targetXml??'');
  const audit=[];
  for(const pair of plan.pairs||[]){
    const sourceNode=clean(pair.sourceNode),targetNode=clean(pair.targetNode);
    const blocks=sourceNodeBlocks(sourceXml,sourceNode,blockNames).map((block)=>rewriteNodeReferences(block,sourceNode,targetNode));
    const targetElementKey=clean(pair.targetElement)||'';
    if(!blocks.length){audit.push({scope:'node',sourceNode,targetNode,status:'skipped',reason:'no-source-node-blocks'});continue;}
    if(!targetElementKey){audit.push({scope:'node',sourceNode,targetNode,status:'skipped',reason:'target-element-required'});continue;}
    const result=updateElement(xml,targetElementKey,(element)=>mergePolicyTarget(element,blocks.join('\n'),blockNames,options.policy||'replace'));
    xml=result.xml;
    audit.push({scope:'node',sourceNode,targetNode,targetElement:targetElementKey,status:result.updated?'updated':'unchanged',blocks:blockNames});
  }
  return {xml,audit};
}
export function applyElementBlockTransfer(targetXml='',sourceXml='',plan={},options={}){
  const blockNames=Array.isArray(plan.selectedBlocks)?plan.selectedBlocks:[];
  let xml=String(targetXml??'');
  const audit=[];
  for(const pair of plan.pairs||[]){
    const sourceElement=clean(pair.sourceElement),targetElement=clean(pair.targetElement);
    const blocks=sourceBlocksByElement(sourceXml,sourceElement,blockNames);
    if(!blocks.length){audit.push({scope:'element',sourceElement,targetElement,status:'skipped',reason:'no-source-element-blocks'});continue;}
    const result=updateElement(xml,targetElement,(element)=>mergePolicyTarget(element,blocks.join('\n'),blockNames,options.policy||'replace'));
    xml=result.xml;
    audit.push({scope:'element',sourceElement,targetElement,status:result.updated?'updated':'unchanged',blocks:blockNames});
  }
  return {xml,audit};
}
export function applyLineBlockTransfer(targetXml='',sourceXml='',plan={},options={}){
  const blockNames=Array.isArray(plan.selectedBlocks)?plan.selectedBlocks:[];
  let xml=String(targetXml??'');
  const audit=[];
  for(const pair of plan.pairs||[]){
    const sourceLine=clean(pair.sourceLine),targetLine=clean(pair.targetLine);
    const blocks=sourceBlocksByLine(sourceXml,sourceLine,blockNames);
    if(!blocks.length){audit.push({scope:'line',sourceLine,targetLine,status:'skipped',reason:'no-source-line-blocks'});continue;}
    const result=updateLine(xml,targetLine,(line)=>updateLineBlocks(line,blocks,options.policy||'replace'));
    xml=result.xml;
    audit.push({scope:'line',sourceLine,targetLine,status:result.updated?'updated':'unchanged',blocks:blockNames});
  }
  return {xml,audit};
}
export function applyCategorizedTransferPlan(targetXml='',sourceXml='',plan={},options={}){
  const scope=clean(plan.transferScope||plan.scope);
  if(scope==='node')return applyNodeBlockTransfer(targetXml,sourceXml,plan,options);
  if(scope==='element')return applyElementBlockTransfer(targetXml,sourceXml,plan,options);
  if(scope==='line')return applyLineBlockTransfer(targetXml,sourceXml,plan,options);
  return {xml:String(targetXml??''),audit:[{scope,status:'skipped',reason:'unsupported-transfer-scope'}]};
}
export const _test=Object.freeze({attrsOf,lineIdFromOpen,elementKey,splitLines,splitElements,findLine,findElement,findBlock,findBlocks,rewriteNodeReferences,sourceNodeBlocks,sourceBlocksByElement,sourceBlocksByLine,applyCategorizedTransferPlan});
