export const XML_COMPARE_SIDELOAD_ENRICHER_SCHEMA='xml-compare-sideload-enricher/v1';

const clean=(value)=>String(value??'').trim();
const upper=(value)=>clean(value).toUpperCase();
const xmlEscape=(value)=>clean(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const normalKey=(value)=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'');

const HEADER_ALIASES=Object.freeze({
  from:['from','fromnode','from_node','fromnodeno'],
  to:['to','tonode','to_node','tonodeno'],
  lineId:['lineid','line_id','branch','branchname'],
  fromName:['fromname','from_name'],
  toName:['toname','to_name'],
  node:['node','nodenumber','node_no'],
  type:['type','restrainttype','supporttype'],
  stiffness:['stiffness','stiff'],
  gap:['gap','gapmm'],
  mu:['mu','friction','frictionmu'],
  cnode:['cnode','cnodeno'],
  tag:['tag','sourcetag','supporttag','dtxrps']
});

function normalizeNode(value){
  const raw=clean(value).replace(/^[\'"]|[\'"]$/g,'');
  const n=Number(raw);
  if(Number.isFinite(n)&&Math.abs(n-Math.round(n))<1e-6)return String(Math.round(n));
  return raw.replace(/\.0+$/,'');
}
function normalizeScalar(value){
  const raw=clean(value).replace(/^[\'"]|[\'"]$/g,'');
  const n=Number(raw);
  if(Number.isFinite(n))return String(Number(n.toFixed(6)));
  return upper(raw);
}
function pairKey(from,to){return `${normalizeNode(from)}->${normalizeNode(to)}`;}
function splitLine(line){
  const raw=clean(line);
  if(!raw||raw.startsWith('#'))return [];
  if(raw.includes('\t'))return raw.split('\t').map(clean);
  if(raw.includes('|'))return raw.split('|').map(clean);
  if(raw.includes(','))return raw.split(',').map(clean);
  return raw.split(/\s+/).map(clean);
}
function aliasIndex(headers,column){
  const aliases=(HEADER_ALIASES[column]||[column]).map(normalKey);
  return headers.findIndex((header)=>aliases.includes(normalKey(header)));
}
function isHeader(cells,columns){
  return columns.some((column)=>aliasIndex(cells,column)>=0);
}
function tableRows(input,columns,{joinTail=false}={}){
  const rows=[];
  let headers=null;
  for(const sourceLine of clean(input).split(/\r?\n/)){
    let cells=splitLine(sourceLine);
    if(!cells.length)continue;
    if(!headers&&isHeader(cells,columns)){headers=cells;continue;}
    if(joinTail&&cells.length>columns.length)cells=[...cells.slice(0,columns.length-1),cells.slice(columns.length-1).join(' ')];
    const row={};
    for(const [position,column] of columns.entries()){
      const headerPosition=headers?aliasIndex(headers,column):-1;
      row[column]=clean(cells[headerPosition>=0?headerPosition:position]);
    }
    if(Object.values(row).some(Boolean))rows.push(row);
  }
  return rows;
}
function attrValue(openTag,name){
  const match=String(openTag).match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,'i'));
  return match?clean(match[1]??match[2]??''):'';
}
function setAttr(openTag,name,value){
  const text=clean(value);
  if(!text)return openTag;
  const encoded=xmlEscape(text);
  const re=new RegExp(`\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*')`,'i');
  if(re.test(openTag))return openTag.replace(re,` ${name}="${encoded}"`);
  return openTag.replace(/\s*\/?>$/,`${openTag.endsWith('/>')?'':' '} ${name}="${encoded}"${openTag.endsWith('/>')?'/>':'>'}`).replace(/\s{2,}/g,' ');
}
function addMap(map,key,value){if(key&&clean(value))map.set(key,clean(value));}
function tagKeys(row){
  const node=normalizeNode(row.node),type=normalizeScalar(row.type),stiffness=normalizeScalar(row.stiffness),gap=normalizeScalar(row.gap),mu=normalizeScalar(row.mu),cnode=normalizeScalar(row.cnode);
  return{exact:`${node}|${type}|${stiffness}|${gap}|${mu}|${cnode}`,nodeType:`${node}|${type}`,node};
}
export function buildXmlCompareSideloadIndex({lineIdText='',nodeNameText='',restraintTagText=''}={}){
  const lineIdRows=tableRows(lineIdText,['from','to','lineId']);
  const nodeNameRows=tableRows(nodeNameText,['from','to','fromName','toName']);
  const tagRows=tableRows(restraintTagText,['from','to','node','type','stiffness','gap','mu','cnode','tag'],{joinTail:true});
  const lineIds=new Map(),nodeNames=new Map(),tagExact=new Map(),tagNodeType=new Map(),nodeCandidates=new Map();
  for(const row of lineIdRows)addMap(lineIds,pairKey(row.from,row.to),row.lineId);
  for(const row of nodeNameRows){
    const key=pairKey(row.from,row.to);
    if(clean(row.fromName)||clean(row.toName))nodeNames.set(key,{fromName:clean(row.fromName),toName:clean(row.toName)});
  }
  for(const row of tagRows){
    const tag=clean(row.tag);
    if(!tag)continue;
    const keys=tagKeys(row);
    addMap(tagExact,keys.exact,tag);
    addMap(tagNodeType,keys.nodeType,tag);
    const list=nodeCandidates.get(keys.node)||[];
    list.push(tag);
    nodeCandidates.set(keys.node,list);
  }
  const tagNode=new Map();
  for(const [node,tags] of nodeCandidates.entries()){
    const unique=[...new Set(tags)];
    if(unique.length===1)tagNode.set(node,unique[0]);
  }
  return{schema:XML_COMPARE_SIDELOAD_ENRICHER_SCHEMA,lineIds,nodeNames,tagExact,tagNodeType,tagNode,stats:{lineIdRows:lineIdRows.length,nodeNameRows:nodeNameRows.length,tagRows:tagRows.length}};
}
function tagForRestraint(openTag,index){
  const row={node:attrValue(openTag,'NODE'),type:attrValue(openTag,'TYPE'),stiffness:attrValue(openTag,'STIFFNESS'),gap:attrValue(openTag,'GAP'),mu:attrValue(openTag,'MU'),cnode:attrValue(openTag,'CNODE')};
  const keys=tagKeys(row);
  return index.tagExact.get(keys.exact)||index.tagNodeType.get(keys.nodeType)||index.tagNode.get(keys.node)||'';
}
export function applyXmlCompareSideload(xmlText='',tables={}){
  const index=buildXmlCompareSideloadIndex(tables);
  const report={schema:XML_COMPARE_SIDELOAD_ENRICHER_SCHEMA,lineIdsApplied:0,nodeNamesApplied:0,tagsApplied:0,...index.stats};
  let output=String(xmlText??'');
  output=output.replace(/<PIPINGELEMENT\b[^>]*>/gi,(openTag)=>{
    const key=pairKey(attrValue(openTag,'FROM_NODE'),attrValue(openTag,'TO_NODE'));
    let next=openTag;
    const lineId=index.lineIds.get(key);
    const names=index.nodeNames.get(key);
    if(lineId){next=setAttr(next,'LINE_ID',lineId);report.lineIdsApplied+=1;}
    if(names){next=setAttr(setAttr(next,'FROM_NAME',names.fromName),'TO_NAME',names.toName);report.nodeNamesApplied+=1;}
    return next;
  });
  output=output.replace(/<RESTRAINT\b[^>]*>/gi,(openTag)=>{
    const tag=tagForRestraint(openTag,index);
    if(!tag)return openTag;
    report.tagsApplied+=1;
    return setAttr(openTag,'TAG',tag);
  });
  return{schema:XML_COMPARE_SIDELOAD_ENRICHER_SCHEMA,xmlText:output,report};
}
export function buildXmlCompareSideloadFileName(fileName='sideload.xml'){
  const base=clean(fileName)||'sideload.xml';
  return base.replace(/(\.txt|\.xml)?$/i,'_sideloaded.xml');
}
export const _test=Object.freeze({clean,normalizeNode,normalizeScalar,pairKey,splitLine,tableRows,attrValue,setAttr,tagKeys,tagForRestraint});
