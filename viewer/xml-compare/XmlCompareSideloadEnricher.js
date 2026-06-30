export const XML_COMPARE_SIDELOAD_ENRICHER_SCHEMA='xml-compare-sideload-enricher/v2';

const clean=(value)=>String(value??'').trim();
const upper=(value)=>clean(value).toUpperCase();
const xmlEscape=(value)=>clean(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const normalKey=(value)=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'');
const CAESAR_UNSET=-1.0101;

const HEADER_ALIASES=Object.freeze({
  from:['from','fromnode','from_node','fromnodeno'],
  to:['to','tonode','to_node','tonodeno'],
  lineId:['lineid','line_id','branch','branchname'],
  fromName:['fromname','from_name'],
  toName:['toname','to_name'],
  node:['node','nodenumber','node_no','basednode','base_node'],
  x:['x','globalx','global_x','xcoord','xcoordinate','coordinatex'],
  y:['y','globaly','global_y','ycoord','ycoordinate','coordinatey'],
  z:['z','globalz','global_z','zcoord','zcoordinate','coordinatez'],
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
function numberValue(value){const match=clean(value).replace(/,/g,'').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);const n=match?Number(match[0]):NaN;return Number.isFinite(n)?n:null;}
function deltaValue(value){const n=numberValue(value);return n==null||Math.abs(n-CAESAR_UNSET)<1e-4?0:n;}
function fmt(value){return Number(value).toFixed(3);}
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
function point(row){const x=numberValue(row.x),y=numberValue(row.y),z=numberValue(row.z);return x==null||y==null||z==null?null:{x,y,z};}
function clonePoint(p){return{x:Number(p.x),y:Number(p.y),z:Number(p.z)};}
function addPoint(p,dx,dy,dz){return{x:Number(p.x)+dx,y:Number(p.y)+dy,z:Number(p.z)+dz};}
function applyGlobalAttrs(openTag,fromPoint,toPoint,basisNode){let next=openTag;next=setAttr(next,'FROM_GLOBAL_X',fmt(fromPoint.x));next=setAttr(next,'FROM_GLOBAL_Y',fmt(fromPoint.y));next=setAttr(next,'FROM_GLOBAL_Z',fmt(fromPoint.z));next=setAttr(next,'TO_GLOBAL_X',fmt(toPoint.x));next=setAttr(next,'TO_GLOBAL_Y',fmt(toPoint.y));next=setAttr(next,'TO_GLOBAL_Z',fmt(toPoint.z));next=setAttr(next,'GLOBAL_COORD_BASIS_NODE',basisNode);return next;}
function popupFieldValue(name){try{if(typeof document==='undefined')return '';return document.querySelector(`[data-xml-compare-sideload-field="${name}"]`)?.value||'';}catch{return '';}}
function normalizeTables(tables={}){return{...tables,coordinateText:clean(tables.coordinateText)||popupFieldValue('coordinateText')};}
export function buildXmlCompareSideloadIndex({lineIdText='',nodeNameText='',restraintTagText='',coordinateText=''}={}){
  const lineIdRows=tableRows(lineIdText,['from','to','lineId']);
  const nodeNameRows=tableRows(nodeNameText,['from','to','fromName','toName']);
  const tagRows=tableRows(restraintTagText,['from','to','node','type','stiffness','gap','mu','cnode','tag'],{joinTail:true});
  const coordinateRows=tableRows(coordinateText,['node','x','y','z']);
  const lineIds=new Map(),nodeNames=new Map(),tagExact=new Map(),tagNodeType=new Map(),nodeCandidates=new Map(),nodeCoordinates=new Map();
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
  for(const row of coordinateRows){const node=normalizeNode(row.node),p=point(row);if(node&&p)nodeCoordinates.set(node,p);}
  const tagNode=new Map();
  for(const [node,tags] of nodeCandidates.entries()){
    const unique=[...new Set(tags)];
    if(unique.length===1)tagNode.set(node,unique[0]);
  }
  return{schema:XML_COMPARE_SIDELOAD_ENRICHER_SCHEMA,lineIds,nodeNames,tagExact,tagNodeType,tagNode,nodeCoordinates,stats:{lineIdRows:lineIdRows.length,nodeNameRows:nodeNameRows.length,tagRows:tagRows.length,coordinateRows:coordinateRows.length}};
}
function tagForRestraint(openTag,index){
  const row={node:attrValue(openTag,'NODE'),type:attrValue(openTag,'TYPE'),stiffness:attrValue(openTag,'STIFFNESS'),gap:attrValue(openTag,'GAP'),mu:attrValue(openTag,'MU'),cnode:attrValue(openTag,'CNODE')};
  const keys=tagKeys(row);
  return index.tagExact.get(keys.exact)||index.tagNodeType.get(keys.nodeType)||index.tagNode.get(keys.node)||'';
}
export function applyXmlCompareSideload(xmlText='',tables={}){
  const index=buildXmlCompareSideloadIndex(normalizeTables(tables));
  const report={schema:XML_COMPARE_SIDELOAD_ENRICHER_SCHEMA,lineIdsApplied:0,nodeNamesApplied:0,tagsApplied:0,coordinatesApplied:0,coordinateNodesResolved:index.nodeCoordinates.size,...index.stats};
  const nodeCoordinates=new Map([...index.nodeCoordinates.entries()].map(([node,p])=>[node,clonePoint(p)]));
  let basisNode=[...index.nodeCoordinates.keys()][0]||'';
  let output=String(xmlText??'');
  output=output.replace(/<PIPINGELEMENT\b[^>]*>/gi,(openTag)=>{
    const fromNode=normalizeNode(attrValue(openTag,'FROM_NODE'));
    const toNode=normalizeNode(attrValue(openTag,'TO_NODE'));
    const key=pairKey(fromNode,toNode);
    let next=openTag;
    const lineId=index.lineIds.get(key);
    const names=index.nodeNames.get(key);
    if(lineId){next=setAttr(next,'LINE_ID',lineId);report.lineIdsApplied+=1;}
    if(names){next=setAttr(setAttr(next,'FROM_NAME',names.fromName),'TO_NAME',names.toName);report.nodeNamesApplied+=1;}
    const fromPoint=nodeCoordinates.get(fromNode);
    if(fromPoint){
      const toPoint=addPoint(fromPoint,deltaValue(attrValue(openTag,'DELTA_X')),deltaValue(attrValue(openTag,'DELTA_Y')),deltaValue(attrValue(openTag,'DELTA_Z')));
      nodeCoordinates.set(toNode,toPoint);
      next=applyGlobalAttrs(next,fromPoint,toPoint,basisNode||fromNode);
      report.coordinatesApplied+=1;
      report.coordinateNodesResolved=nodeCoordinates.size;
    }
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
export const _test=Object.freeze({clean,normalizeNode,normalizeScalar,numberValue,deltaValue,pairKey,splitLine,tableRows,attrValue,setAttr,tagKeys,tagForRestraint,point,applyGlobalAttrs,normalizeTables});
