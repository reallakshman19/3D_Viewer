import { DEFAULT_COORDINATE_CLUSTER_CONTRACT } from './table-categorized-xml-coordinate-cluster.js';
import { PS_MAPPING_TABLE_2_SHADOW_PROFILE } from './table-categorized-xml-pilot-profiles.js';

export const TABLE_CATEGORIZED_XML_PROFILE_DESIGNER_SCHEMA='table-categorized-xml-profile-designer/v1';

export const LEVEL_TYPE_OPTIONS=Object.freeze(['container','partition','group','occurrence','feature','measure','attribute','evidence','diagnostic']);
export const CREATION_MODE_OPTIONS=Object.freeze(['static','zero-or-one','one-per-key','one-per-row','many-per-row','conditional','lookup-joined','coordinate-clustered']);

export function createBlankUniversalProfile(){
  return freezeProfile({
    schema:'UniversalCategorizerProfile.v1',profileId:'blank-universal-profile',displayName:'Blank Universal Profile',
    requiredColumns:[],optionalColumns:[],duplicateKeyPolicy:'merge-sourceRefs',multiValuePolicy:'single-value',coordinateCluster:{...DEFAULT_COORDINATE_CLUSTER_CONTRACT},
    levelDefinitions:[level({levelId:'categorizedTableGraph',displayName:'CategorizedTableGraph',levelType:'container',creationMode:'static',key:'CategorizedTableGraph',documentRoot:true,children:[
      level({levelId:'rootPartition',displayName:'RootPartition',levelType:'partition',creationMode:'static',key:'MODEL_SIDE'})
    ]})]
  });
}

export function createPsMappingTable2TemplateProfile(){return freezeProfile(clone(PS_MAPPING_TABLE_2_SHADOW_PROFILE));}
export function cloneProfile(profile){return freezeProfile(clone(profile||createBlankUniversalProfile()));}

export function createLevel({levelId,displayName='',levelType='group',creationMode='one-per-key',key='',keyResolver=null,displayNameResolver=null,fieldResolvers={},documentRoot=false,children=[]}={}){
  return level({levelId,displayName,levelType,creationMode,key,keyResolver,displayNameResolver,fieldResolvers,documentRoot,children});
}

export function updateProfileHeader(profile,patch={}){
  return freezeProfile({...clone(profile),...pick(patch,['profileId','displayName','requiredColumns','optionalColumns','duplicateKeyPolicy','multiValuePolicy','coordinateCluster'])});
}

export function updateLevelAtPath(profile,path=[],patch={}){
  const copy=clone(profile);
  copy.levelDefinitions=replaceAt(copy.levelDefinitions,path,(item)=>normalizeLevel({...item,...patch}));
  return freezeProfile(copy);
}

export function setChildrenNames(profile,path=[],names=[],options={}){
  const copy=clone(profile);
  copy.levelDefinitions=replaceAt(copy.levelDefinitions,path,(item)=>{
    const existing=Array.isArray(item.children)?item.children:[];
    const children=names.map((name,index)=>namedChildFromExisting(existing[index],name,index,options)).filter(Boolean);
    return normalizeLevel({...item,children});
  });
  return freezeProfile(copy);
}

export function addChildLevel(profile,path=[],child={}){
  const copy=clone(profile);
  copy.levelDefinitions=replaceAt(copy.levelDefinitions,path,(item)=>normalizeLevel({...item,children:[...(item.children||[]),normalizeLevel(child)]}));
  return freezeProfile(copy);
}

export function deleteLevelAtPath(profile,path=[]){
  if(path.length===0)return profile;
  const copy=clone(profile);
  const parentPath=path.slice(0,-1),index=path[path.length-1];
  copy.levelDefinitions=replaceAt(copy.levelDefinitions,parentPath,(item)=>normalizeLevel({...item,children:(item.children||[]).filter((_,i)=>i!==index)}));
  return freezeProfile(copy);
}

export function serializeProfile(profile){return JSON.stringify(freezeProfile(profile),null,2);}
export function parseProfileJson(text){return freezeProfile(JSON.parse(String(text||'{}')));}

export function columnResolver(column,op='trim'){return {op,column};}
export function literalResolver(value){return {op:'literal',value};}
export function regexResolver(column,pattern='(.*)',group=1,fallback='blank'){
  const base={op:'trim',column};
  const rex={op:'regexExtract',input:base,pattern,group:Number(group)||1,severity:fallback==='blank'?'WARNING':'INFO'};
  return fallback==='full value'?{op:'fallback',resolvers:[rex],defaultResolver:base}:rex;
}
export function concatResolver(parts=[]){return {op:'concat',parts};}
export function classifierResolver(column,dictionaryText=''){
  return {op:'classifier',column,dictionary:parseDictionary(dictionaryText)};
}
export function coordinateClusterResolver({x='X',y='Y',z='Z',unit='mm',tolerance=2,roundingPrecision=3}={}){
  return {op:'coordinateCluster',contract:{...DEFAULT_COORDINATE_CLUSTER_CONTRACT,unit,tolerance:Number(tolerance),roundingPrecision:Number(roundingPrecision),axisMapping:{x,y,z}}};
}

export function previewResolver(spec,row){
  if(!spec)return '';
  if(spec.op==='literal')return spec.value??'';
  if(spec.column)return row?.rawByHeader?.[spec.column]??'';
  if(spec.input)return previewResolver(spec.input,row);
  if(spec.op==='concat')return (spec.parts||[]).map((part)=>typeof part==='string'?part:previewResolver(part,row)).join(spec.separator??'');
  return '';
}

function namedChildFromExisting(existing,name,index,options){
  const value=String(name||'').trim();
  const placeholder=isUiPlaceholder(value);
  if(existing&&placeholder)return normalizeLevel(existing);
  if(existing)return normalizeLevel({...existing,displayName:value||existing.displayName||existing.levelId});
  if(!value||placeholder)return null;
  return createNamedChild(value,index,options);
}

function isUiPlaceholder(value){
  return /^(Parent|Child|GrandChild) \([xyzabc]\)$/i.test(String(value||''));
}

function createNamedChild(name,index,options){
  const idBase=String(name).trim().replace(/[^A-Za-z0-9]+/g,' ').trim().replace(/\s+(.)/g,(_,c)=>c.toUpperCase()).replace(/^./,(c)=>c.toLowerCase())||`${options.idPrefix||'level'}${index+1}`;
  return normalizeLevel({levelId:idBase,displayName:name,levelType:options.levelType||'group',creationMode:options.creationMode||'one-per-key',keyResolver:{op:'trim',column:options.keyColumn||'PS NO'},displayNameResolver:{op:'trim',column:options.displayColumn||options.keyColumn||'PS NO'},children:[]});
}

function level(input){return normalizeLevel(input);}
function normalizeLevel(input={}){
  const out={levelId:String(input.levelId||'level'),levelType:String(input.levelType||'group'),creationMode:String(input.creationMode||'one-per-key')};
  if(input.key!=null)out.key=String(input.key);
  if(input.displayName!=null)out.displayName=String(input.displayName);
  if(input.xmlTag!=null)out.xmlTag=String(input.xmlTag);
  if(input.documentRoot)out.documentRoot=true;
  if(input.keyResolver)out.keyResolver=clone(input.keyResolver);
  if(input.displayNameResolver)out.displayNameResolver=clone(input.displayNameResolver);
  if(input.fieldResolvers)out.fieldResolvers=clone(input.fieldResolvers);
  out.children=(input.children||[]).map(normalizeLevel);
  return out;
}

function freezeProfile(profile){return deepFreeze({...profile,levelDefinitions:(profile.levelDefinitions||[]).map(normalizeLevel)});}
function replaceAt(items,path,mapper){
  if(path.length===0)return items.map((item,index)=>index===0?mapper(item):item);
  const [head,...rest]=path;
  return items.map((item,index)=>index!==head?item:normalizeLevel({...item,children:replaceAt(item.children||[],rest,mapper)}));
}
function parseDictionary(text){return Object.fromEntries(String(text||'').split(/\r?\n/).map((line)=>line.split('=')).filter((p)=>p[0]).map(([k,v])=>[k.trim().toUpperCase(),String(v??'').trim()]));}
function pick(obj,keys){return Object.fromEntries(keys.filter((key)=>key in obj).map((key)=>[key,obj[key]]));}
function clone(value){return JSON.parse(JSON.stringify(value));}
function deepFreeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(deepFreeze);}return value;}
