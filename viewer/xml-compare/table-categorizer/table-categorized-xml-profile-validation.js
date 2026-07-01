import { CREATION_MODE_OPTIONS, LEVEL_TYPE_OPTIONS } from './table-categorized-xml-profile-designer.js';

export const TABLE_CATEGORIZED_XML_PROFILE_VALIDATION_SCHEMA='table-categorized-xml-profile-validation/v1';

export function validateEditableProfile(profile,{source=null}={}){
  const diagnostics=[];
  if(!String(profile?.profileId||'').trim())diagnostics.push(diag('BLOCKER','profile_id_missing','profileId is required.'));
  const levels=flattenLevels(profile?.levelDefinitions||[]);
  const documentRoots=levels.filter((item)=>item.level.documentRoot);
  if(documentRoots.length===0)diagnostics.push(diag('BLOCKER','document_root_missing','Exactly one document root level is required.'));
  if(documentRoots.length>1)diagnostics.push(diag('BLOCKER','document_root_multiple','Only one document root level is allowed.'));
  diagnostics.push(...duplicateLevelIds(levels));
  diagnostics.push(...levels.flatMap((item)=>validateLevel(item,source)));
  if(!diagnostics.length)diagnostics.push(diag('INFO','profile_structure_valid','Editable profile structure is valid.'));
  return Object.freeze(diagnostics);
}

export function hasProfileBlockers(results=[]){return results.some((item)=>item.severity==='BLOCKER');}

function validateLevel({level,path,parentPath},source){
  const out=[];
  if(!LEVEL_TYPE_OPTIONS.includes(level.levelType))out.push(diag('BLOCKER','invalid_level_type',`Invalid levelType: ${level.levelType}.`,pathText(path)));
  if(!CREATION_MODE_OPTIONS.includes(level.creationMode))out.push(diag('BLOCKER','invalid_creation_mode',`Invalid creationMode: ${level.creationMode}.`,pathText(path)));
  if(!validXmlTag(level.xmlTag||level.levelId))out.push(diag('BLOCKER','xml_tag_invalid',`Level cannot map to an XML tag: ${level.xmlTag||level.levelId}.`,pathText(path)));
  if(parentPath&&parentPath.length&&!Array.isArray(path))out.push(diag('BLOCKER','parent_link_invalid','Nested child level has invalid parent path.',pathText(path)));
  out.push(...validateCreationMode(level,path));
  out.push(...validateResolverColumns(level.keyResolver,source,path,'keyResolver'));
  out.push(...validateResolverColumns(level.displayNameResolver,source,path,'displayNameResolver'));
  for(const [name,resolver] of Object.entries(level.fieldResolvers||{}))out.push(...validateResolverColumns(resolver,source,path,`fieldResolvers.${name}`));
  return out;
}

function validateCreationMode(level,path){
  const out=[];
  if(level.creationMode==='static'&&!level.key&&!level.keyResolver)out.push(diag('BLOCKER','static_key_missing','Static level requires key or keyResolver.',pathText(path)));
  if(level.creationMode==='one-per-key'&&!level.keyResolver)out.push(diag('BLOCKER','one_per_key_resolver_missing','one-per-key level requires keyResolver.',pathText(path)));
  if(level.creationMode==='one-per-row'&&!level.keyResolver)out.push(diag('WARNING','one_per_row_uses_row_key','one-per-row has no keyResolver; row key fallback will be used.',pathText(path)));
  return out;
}

function validateResolverColumns(resolver,source,path,context){
  if(!resolver)return [];
  const out=[];
  if(resolver.op==='coordinateCluster')out.push(...validateCoordinateCluster(resolver,path));
  const headers=new Set(source?.headers||[]);
  const required=source&&headers.size;
  for(const col of resolverColumns(resolver))if(required&&!headers.has(col))out.push(diag('BLOCKER','resolver_source_column_missing',`${context} references missing source column: ${col}.`,pathText(path)));
  return out;
}

function validateCoordinateCluster(resolver,path){
  const c=resolver.contract||{};
  const out=[];
  if(!c.unit)out.push(diag('BLOCKER','coordinate_unit_missing','coordinateCluster resolver requires unit.',pathText(path)));
  if(!Number.isFinite(Number(c.tolerance)))out.push(diag('BLOCKER','coordinate_tolerance_missing','coordinateCluster resolver requires tolerance.',pathText(path)));
  return out;
}

function resolverColumns(resolver){
  const cols=[];
  visitResolver(resolver,(item)=>{if(item.column)cols.push(item.column);const a=item.contract?.axisMapping;if(a)cols.push(a.x,a.y,a.z);});
  return cols.filter(Boolean);
}

function visitResolver(resolver,visitor){
  if(!resolver||typeof resolver!=='object')return;
  visitor(resolver);
  if(resolver.input)visitResolver(resolver.input,visitor);
  for(const item of resolver.resolvers||[])visitResolver(item,visitor);
  if(resolver.defaultResolver)visitResolver(resolver.defaultResolver,visitor);
  for(const part of resolver.parts||[])if(typeof part==='object')visitResolver(part,visitor);
}

function duplicateLevelIds(levels){
  const seen=new Map(),out=[];
  for(const item of levels){
    const id=item.level.levelId;
    if(seen.has(id))out.push(diag('BLOCKER','duplicate_level_id',`Duplicate levelId: ${id}.`,pathText(item.path)));
    seen.set(id,item.path);
  }
  return out;
}

export function flattenLevels(levelDefinitions=[]){
  const out=[];
  const walk=(items,path=[],parentPath=null)=>items.forEach((level,index)=>{const p=[...path,index];out.push({level,path:p,parentPath});walk(level.children||[],p,p);});
  walk(levelDefinitions);
  return out;
}

function validXmlTag(value){return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(String(value||''));}
function pathText(path=[]){return path.join('.')||'root';}
function diag(severity,code,message,ref=''){return Object.freeze({gate:code,severity,status:severity==='BLOCKER'?'FAIL':'PASS',message,ref});}
