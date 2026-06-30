export const CATEGORIZED_INPUTXML_CONVERTER_SCHEMA='categorized-inputxml-converter/v2';

const esc=(value)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const clean=(value)=>String(value??'').trim();
const normalizeNode=(value)=>{const raw=clean(value);const n=Number(raw);return Number.isFinite(n)&&Math.abs(n-Math.round(n))<1e-6?String(Math.round(n)):raw.replace(/\.0+$/,'');};
const SENTINEL=-1.0101;

const BLOCK_FIELDS=Object.freeze({
  NameBlock:['FROM_NAME','TO_NAME','LINE_ID','NAME'],
  RouteGeometryBlock:['DELTA_X','DELTA_Y','DELTA_Z'],
  SectionDimensionBlock:['DIAMETER','WALL_THICK','INSUL_THICK'],
  ProcessBlock:['TEMP_EXP_C1','TEMP_EXP_C2','TEMP_EXP_C3','TEMP_EXP_C4','TEMP_EXP_C5','TEMP_EXP_C6','TEMP_EXP_C7','TEMP_EXP_C8','TEMP_EXP_C9','PRESSURE1','PRESSURE2','PRESSURE3','PRESSURE4','PRESSURE5','PRESSURE6','PRESSURE7','PRESSURE8','PRESSURE9','HYDRO_PRESSURE','INSUL_DENSITY','FLUID_DENSITY','REFRACTORY_DENSITY','REFRACTORY_THK','CLADDING_DEN','CLADDING_THK','INSUL_CLAD_UNIT_WEIGHT','INSUL_CLAD_UNIT_WEIGH'],
  MaterialBlock:['MATERIAL_NUM','MATERIAL_NAME','CORR_ALLOW','MODULUS','HOT_MOD1','HOT_MOD2','HOT_MOD3','HOT_MOD4','HOT_MOD5','HOT_MOD6','HOT_MOD7','HOT_MOD8','HOT_MOD9','POISSONS','PIPE_DENSITY','MILL_TOL_PLUS','MILL_TOL_MINUS','SEAM_WELD'],
  DerivedCoordinateBlock:['FROM_GLOBAL_X','FROM_GLOBAL_Y','FROM_GLOBAL_Z','TO_GLOBAL_X','TO_GLOBAL_Y','TO_GLOBAL_Z','GLOBAL_COORD_BASIS_NODE','TO_GLOBAL_COORD_BASIS_NODE']
});
const CHILD_BLOCKS=Object.freeze({BEND:'BendBlock',SIF:'SifBlock',RIGID:'RigidBlock',FLANGES:'FlangeBlock'});
const NODE_BLOCKS=Object.freeze({RESTRAINT:'RestraintsBlock',DISPLACEMENTS:'DisplacementBlock',FORCESMOMENTS:'ForceMomentBlock'});
const BRANCH_BLOCKS=Object.freeze({ALLOWABLESTRESS:'AllowableStressBlock'});
const CONTROL_ATTRS=new Set(['NUM','NUMBER','SIF_NUM','DISP_NUM','FORCMNT_NUM','NODE','NODE_NUM','NODE1','NODE2','NODE3','CNODE']);

function attrsOf(tag=''){
  const out={};
  String(tag).replace(/([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g,(_,key,_q,dq,sq)=>{out[key]=dq??sq??'';return _;});
  return out;
}
function openName(tag=''){return clean(tag).match(/^<\/?\s*([A-Za-z_][\w:.-]*)/)?.[1]||'';}
function num(value){const n=Number(clean(value));return Number.isFinite(n)?n:null;}
function isUnset(value,{zeroUnset=false}={}){const text=clean(value);if(!text)return true;const n=num(text);if(n==null)return false;if(Math.abs(n-SENTINEL)<1e-4)return true;if(zeroUnset&&Math.abs(n)<1e-9)return true;return false;}
function hasMeaningfulAttrs(xml='',{zeroUnset=false,ignoreControls=true}={}){for(const [key,value] of Object.entries(attrsOf(xml))){if(ignoreControls&&CONTROL_ATTRS.has(key))continue;if(!isUnset(value,{zeroUnset}))return true;}return false;}
function hasMeaningfulDescendantAttrs(xml='',options={}){if(hasMeaningfulAttrs(xml,options))return true;const tagRe=/<[A-Za-z_][\w:.-]*\b[^>]*>/g;let match;while((match=tagRe.exec(String(xml))))if(hasMeaningfulAttrs(match[0],options))return true;return false;}
function activeChildBlock(xml=''){const tag=openName(xml);if(tag==='SIF'&&isUnset(attrsOf(xml).NODE))return false;return hasMeaningfulDescendantAttrs(xml);}
function activeNodeBlock(xml=''){const tag=openName(xml),attrs=attrsOf(xml),node=tag==='RESTRAINT'?attrs.NODE:attrs.NODE_NUM;if(isUnset(node))return false;return hasMeaningfulDescendantAttrs(xml);}
function activeBranchBlock(xml=''){return hasMeaningfulDescendantAttrs(xml,{zeroUnset:true});}
function elementKey(attrs={}){return `${normalizeNode(attrs.FROM_NODE)}->${normalizeNode(attrs.TO_NODE)}`;}
function lineId(attrs={}){return clean(attrs.LINE_ID||attrs['PIPELINE-REFERENCE']||'UNSPECIFIED_LINE');}
function splitPipingElements(xml=''){
  const matches=[];
  const re=/<PIPINGELEMENT\b[^>]*(?:\/>|>[\s\S]*?<\/PIPINGELEMENT>)/gi;
  let match;while((match=re.exec(String(xml))))matches.push(match[0]);
  return matches;
}
function splitLooseBlocks(xml='',tagName=''){
  const matches=[];
  const re=new RegExp(`<${tagName}\\b[^>]*(?:\\/>|>[\\s\\S]*?<\\/${tagName}>)`,'gi');
  let match;while((match=re.exec(String(xml))))matches.push(match[0]);
  return matches;
}
function childrenOfElement(elementXml=''){
  const body=elementXml.includes('</PIPINGELEMENT>')?elementXml.replace(/^<PIPINGELEMENT\b[^>]*>/i,'').replace(/<\/PIPINGELEMENT>\s*$/i,''):'';
  const children=[];
  for(const tagName of Object.keys(CHILD_BLOCKS))children.push(...splitLooseBlocks(body,tagName).filter(activeChildBlock));
  return children;
}
function nodeBlockKey(xml='',tag=''){
  const attrs=attrsOf(xml);
  if(tag==='RESTRAINT')return normalizeNode(attrs.NODE);
  return normalizeNode(attrs.NODE_NUM);
}
function nodeBlocks(xml=''){
  const map=new Map();
  for(const tagName of Object.keys(NODE_BLOCKS)){
    for(const block of splitLooseBlocks(xml,tagName).filter(activeNodeBlock)){
      const key=nodeBlockKey(block,tagName);if(!key||isUnset(key))continue;
      if(!map.has(key))map.set(key,[]);
      map.get(key).push(block);
    }
  }
  return map;
}
function branchBlocks(xml=''){
  const groups={};
  for(const [tag,blockName] of Object.entries(BRANCH_BLOCKS)){
    const blocks=splitLooseBlocks(xml,tag).filter(activeBranchBlock);
    if(blocks.length)groups[blockName]=blocks;
  }
  return groups;
}
function blockXml(blockName='',attrs={},used=new Set()){
  const keys=BLOCK_FIELDS[blockName]||[];
  const rows=[];
  for(const key of keys){if(attrs[key]!=null&&clean(attrs[key])!==''){rows.push(`      <${key}>${esc(attrs[key])}</${key}>`);used.add(key);}}
  return rows.length?`    <${blockName}>\n${rows.join('\n')}\n    </${blockName}>`:'';
}
function childBlockXml(blockName='',children=[]){const active=children.filter((child)=>clean(child));return active.length?`    <${blockName}>\n${active.map((child)=>`      ${clean(child)}`).join('\n')}\n    </${blockName}>`:'';}
function miscXml(attrs={},used=new Set()){
  const rows=[];
  for(const [key,value] of Object.entries(attrs)){if(key==='FROM_NODE'||key==='TO_NODE'||used.has(key))continue;rows.push(`      <UnmappedAttribute name="${esc(key)}">${esc(value)}</UnmappedAttribute>`);}
  return rows.length?`    <MiscBlock>\n${rows.join('\n')}\n    </MiscBlock>`:'    <MiscBlock />';
}
function cdata(text=''){return String(text).replaceAll(']]>',']]]]><![CDATA[>');}
function decdata(text=''){return String(text).replaceAll(']]]]><![CDATA[>',']]>');}
function categorizedElementXml(elementXml='',nodeBlockMap=new Map()){
  const open=elementXml.match(/^<PIPINGELEMENT\b[^>]*>/i)?.[0]||elementXml.match(/^<PIPINGELEMENT\b[^>]*\/>/i)?.[0]||'';
  const attrs=attrsOf(open);
  const key=elementKey(attrs),from=normalizeNode(attrs.FROM_NODE),to=normalizeNode(attrs.TO_NODE),line=lineId(attrs),used=new Set();
  const children=childrenOfElement(elementXml);
  const childGroups={};for(const child of children){const group=CHILD_BLOCKS[openName(child)];if(group){childGroups[group] ||= [];childGroups[group].push(child);}}
  const attached=[...(nodeBlockMap.get(from)||[]),...(nodeBlockMap.get(to)||[])];
  const nodeGroups={};for(const block of attached){const group=NODE_BLOCKS[openName(block)];if(group){nodeGroups[group] ||= [];nodeGroups[group].push(block);}}
  const blocks=[];
  blocks.push(blockXml('NameBlock',{...attrs,NAME:attrs.NAME||key},used));
  blocks.push(blockXml('RouteGeometryBlock',attrs,used));
  blocks.push(blockXml('SectionDimensionBlock',attrs,used));
  blocks.push(blockXml('ProcessBlock',attrs,used));
  blocks.push(blockXml('MaterialBlock',attrs,used));
  blocks.push(blockXml('DerivedCoordinateBlock',attrs,used));
  for(const name of ['BendBlock','SifBlock','RigidBlock','FlangeBlock'])blocks.push(childBlockXml(name,childGroups[name]||[]));
  for(const name of ['RestraintsBlock','DisplacementBlock','ForceMomentBlock'])blocks.push(childBlockXml(name,nodeGroups[name]||[]));
  blocks.push(miscXml(attrs,used));
  blocks.push(`    <OriginalElement><![CDATA[${cdata(elementXml)}]]></OriginalElement>`);
  return {line,xml:`  <Element fromNode="${esc(from)}" toNode="${esc(to)}" elementKey="${esc(key)}">\n${blocks.filter(Boolean).join('\n')}\n  </Element>`};
}
function categorizedExternalBlocks(categorizedText=''){
  const unique=new Map();
  for(const tagName of Object.keys(NODE_BLOCKS))for(const block of splitLooseBlocks(categorizedText,tagName).filter(activeNodeBlock))unique.set(clean(block),clean(block));
  return [...unique.values()];
}
function originalDocument(categorizedText=''){const match=String(categorizedText).match(/<OriginalDocument>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/OriginalDocument>/i);return match?decdata(match[1]):'';}
export function inputXmlToCategorizedInputXml(xmlText='',{sourceName='InputXML'}={}){
  const nodeBlockMap=nodeBlocks(xmlText),branchGroups=branchBlocks(xmlText);
  const byLine=new Map();
  for(const element of splitPipingElements(xmlText)){const entry=categorizedElementXml(element,nodeBlockMap);if(!byLine.has(entry.line))byLine.set(entry.line,[]);byLine.get(entry.line).push(entry.xml);}
  const branchXml=Object.entries(branchGroups).map(([name,blocks])=>` <${name}>\n${blocks.map((block)=>`  ${clean(block)}`).join('\n')}\n </${name}>`).join('\n');
  const lines=[...byLine.entries()].map(([line,elements])=>` <Line id="${esc(line)}">\n${elements.join('\n')}\n </Line>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<CategorizedInputXML schema="categorized-inputxml/v1" sourceName="${esc(sourceName)}">\n${branchXml?`${branchXml}\n`:''}${lines}\n <OriginalDocument><![CDATA[${cdata(xmlText)}]]></OriginalDocument>\n</CategorizedInputXML>\n`;
}
export function categorizedInputXmlToInputXml(categorizedText=''){
  const original=originalDocument(categorizedText);
  if(original)return original;
  const originals=[];
  const re=/<OriginalElement>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/OriginalElement>/gi;
  let match;while((match=re.exec(String(categorizedText))))originals.push(decdata(match[1]));
  const external=categorizedExternalBlocks(categorizedText);
  if(originals.length)return `<?xml version="1.0" encoding="UTF-8"?>\n<CAESARII XML_TYPE="Input">\n<PIPINGMODEL>\n${[...originals,...external].join('\n')}\n</PIPINGMODEL>\n</CAESARII>\n`;
  return String(categorizedText).replace(/<CategorizedInputXML[\s\S]*?>|<\/CategorizedInputXML>/gi,'');
}
export function convertCategorizedInputXml(text='',direction='input-to-categorized',options={}){
  return direction==='categorized-to-input'?categorizedInputXmlToInputXml(text):inputXmlToCategorizedInputXml(text,options);
}
export function categorizedFileName(name='',direction='input-to-categorized'){
  const base=clean(name||'input.xml').replace(/\.(xml|txt)$/i,'');
  return direction==='categorized-to-input'?`${base}_inputxml.xml`:`${base}_categorized_enriched.xml`;
}
export const _test=Object.freeze({attrsOf,isUnset,activeChildBlock,activeNodeBlock,activeBranchBlock,splitPipingElements,splitLooseBlocks,nodeBlocks,branchBlocks,categorizedExternalBlocks,originalDocument,inputXmlToCategorizedInputXml,categorizedInputXmlToInputXml,categorizedFileName});
