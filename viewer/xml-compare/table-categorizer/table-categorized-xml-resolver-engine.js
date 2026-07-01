import { assignCoordinateCluster, createCoordinateClusterState } from './table-categorized-xml-coordinate-cluster.js';
import { DEFAULT_SUPPORT_CLASSIFIER, resolverFailed, resolverOk } from './table-categorized-xml-resolver-contracts.js';

export const TABLE_CATEGORIZED_XML_RESOLVER_ENGINE_SCHEMA='table-categorized-xml-resolver-engine/v1';

export function createResolverContext(options={}){
  return {clusterState:createCoordinateClusterState(options.coordinateCluster||{}),diagnostics:[]};
}

export function runResolverPipeline(rows,resolvers={},options={}){
  const context=createResolverContext(options);
  const outputs=rows.map((row)=>resolveRow(row,resolvers,context));
  return Object.freeze({outputs:Object.freeze(outputs),diagnostics:Object.freeze(context.diagnostics)});
}

export function resolveRow(row,resolvers={},context=createResolverContext()){
  const result={sourceRef:row?.rowId||'',displayName:null,group:null,key:null,lookup:null,fields:{},conditions:{},diagnostics:[]};
  result.displayName=runResolver(resolvers.displayNameResolver,row,context);
  result.group=runResolver(resolvers.groupResolver,row,context);
  result.key=runResolver(resolvers.keyResolver,row,context);
  result.lookup=runResolver(resolvers.lookupResolver,row,context);
  result.fields=resolveNamedResolvers(resolvers.fieldResolvers,row,context);
  result.conditions=resolveNamedResolvers(resolvers.conditionResolvers,row,context);
  result.diagnostics=collectResultDiagnostics(result);
  context.diagnostics.push(...result.diagnostics);
  return Object.freeze(result);
}

export function runResolver(spec,row,context=createResolverContext()){
  if(!spec)return resolverOk('',{sourceRefs:[row?.rowId||''].filter(Boolean)});
  try{return executeResolver(spec,row,context);}catch(error){
    return resolverFailed('resolver_failed',error?.message||String(error),{sourceRef:row?.rowId||''});
  }
}

function resolveNamedResolvers(map,row,context){
  return Object.freeze(Object.fromEntries(Object.entries(map||{}).map(([name,spec])=>[name,runResolver(spec,row,context)])));
}

function collectResultDiagnostics(result){
  const entries=[result.displayName,result.group,result.key,result.lookup,...Object.values(result.fields),...Object.values(result.conditions)];
  return entries.flatMap((entry)=>entry?.diagnostics||[]);
}

function executeResolver(spec,row,context){
  const op=String(spec.op||'literal');
  if(op==='literal')return resolverOk(spec.value??'',{sourceRefs:sourceRefs(row)});
  if(op==='trim')return mapString(spec,row,context,(v)=>v.trim());
  if(op==='uppercase')return mapString(spec,row,context,(v)=>v.toUpperCase());
  if(op==='lowercase')return mapString(spec,row,context,(v)=>v.toLowerCase());
  if(op==='regexExtract')return regexExtract(spec,row,context);
  if(op==='regexReplace')return regexReplace(spec,row,context);
  if(op==='tokenSplit')return tokenSplit(spec,row,context);
  if(op==='takeToken')return takeToken(spec,row,context);
  if(op==='concat')return concat(spec,row,context);
  if(op==='numberParser')return numberParser(spec,row,context);
  if(op==='unitNormalizer')return unitNormalizer(spec,row,context);
  if(op==='booleanParser')return booleanParser(spec,row,context);
  if(op==='classifier')return classifier(spec,row,context);
  if(op==='coordinateKey')return coordinateKey(spec,row);
  if(op==='coordinateCluster')return assignCoordinateCluster(context.clusterState,row,spec.contract||{});
  if(op==='fallback')return fallback(spec,row,context);
  return resolverFailed('resolver_unknown_op',`Unknown resolver op: ${op}`,{sourceRef:row?.rowId||''});
}

function inputValue(spec,row,context){
  if(spec.column)return resolverOk(row?.rawByHeader?.[spec.column]??'',{sourceRefs:sourceRefs(row)});
  if(spec.input)return runResolver(spec.input,row,context);
  if('value' in spec)return resolverOk(spec.value,{sourceRefs:sourceRefs(row)});
  return resolverOk('',{sourceRefs:sourceRefs(row)});
}

function mapString(spec,row,context,mapper){
  const input=inputValue(spec,row,context);
  if(!input.ok)return input;
  return resolverOk(mapper(String(input.value??'')),{rawValue:input.value,sourceRefs:input.sourceRefs,diagnostics:input.diagnostics});
}

function regexExtract(spec,row,context){
  const input=inputValue(spec,row,context);
  if(!input.ok)return input;
  const match=new RegExp(spec.pattern||'(.*)',spec.flags||'').exec(String(input.value??''));
  if(!match)return resolverFailed('resolver_regex_no_match','Regex did not match.',{severity:spec.severity||'WARNING',sourceRef:row?.rowId||'',rawValue:input.value});
  return resolverOk(match[Number(spec.group)||0]??'',{rawValue:input.value,sourceRefs:input.sourceRefs});
}

function regexReplace(spec,row,context){
  const input=inputValue(spec,row,context);
  if(!input.ok)return input;
  const value=String(input.value??'').replace(new RegExp(spec.pattern||'',spec.flags||'g'),spec.replacement??'');
  return resolverOk(value,{rawValue:input.value,sourceRefs:input.sourceRefs});
}

function tokenSplit(spec,row,context){
  const input=inputValue(spec,row,context);
  if(!input.ok)return input;
  return resolverOk(String(input.value??'').split(spec.delimiter??'.'),{rawValue:input.value,sourceRefs:input.sourceRefs});
}

function takeToken(spec,row,context){
  const input=inputValue(spec,row,context);
  if(!input.ok)return input;
  const tokens=Array.isArray(input.value)?input.value:String(input.value??'').split(spec.delimiter??'.');
  const value=tokens[Number(spec.index)||0]??'';
  return resolverOk(value,{rawValue:input.value,sourceRefs:input.sourceRefs});
}

function concat(spec,row,context){
  const parts=(spec.parts||[]).map((part)=>typeof part==='string'?resolverOk(part):runResolver(part,row,context));
  const failed=parts.find((part)=>!part.ok);
  if(failed)return failed;
  return resolverOk(parts.map((part)=>part.value).join(spec.separator??''),{sourceRefs:sourceRefs(row)});
}

function numberParser(spec,row,context){
  const input=inputValue(spec,row,context);
  if(!input.ok)return input;
  const match=String(input.value??'').match(/[-+]?\d*\.?\d+/);
  if(!match)return resolverFailed('resolver_number_parse_failed','Number could not be parsed.',{severity:spec.severity||'WARNING',sourceRef:row?.rowId||'',rawValue:input.value});
  return resolverOk(Number(match[0]),{rawValue:input.value,sourceRefs:input.sourceRefs});
}

function unitNormalizer(spec,row,context){
  const input=numberParser(spec,row,context);
  if(!input.ok)return input;
  const factor=Number(spec.factor??1);
  return resolverOk(input.value*factor,{rawValue:input.rawValue,sourceRefs:input.sourceRefs});
}

function booleanParser(spec,row,context){
  const input=inputValue(spec,row,context);
  if(!input.ok)return input;
  const value=String(input.value??'').trim().toUpperCase();
  return resolverOk(['YES','Y','TRUE','1','MANDATORY'].includes(value),{rawValue:input.value,sourceRefs:input.sourceRefs});
}

function classifier(spec,row,context){
  const input=inputValue(spec,row,context);
  if(!input.ok)return input;
  const dict={...DEFAULT_SUPPORT_CLASSIFIER,...(spec.dictionary||{})};
  const value=dict[String(input.value??'').trim().toUpperCase()]||spec.defaultValue||'';
  if(!value)return resolverFailed('resolver_classifier_unmatched','Classifier did not match.',{severity:spec.severity||'WARNING',sourceRef:row?.rowId||'',rawValue:input.value});
  return resolverOk(value,{rawValue:input.value,sourceRefs:input.sourceRefs});
}

function coordinateKey(spec,row){
  const cols=spec.axisMapping||{x:'X',y:'Y',z:'Z'};
  const raw=[cols.x,cols.y,cols.z].map((col)=>row?.rawByHeader?.[col]??'');
  return resolverOk(raw.join('|'),{rawValue:raw,sourceRefs:sourceRefs(row)});
}

function fallback(spec,row,context){
  const diagnostics=[];
  for(const candidate of spec.resolvers||[]){
    const result=runResolver(candidate,row,context);
    diagnostics.push(...(result.diagnostics||[]));
    if(result.ok&&String(result.value??'')!=='')return withDiagnostics(result,diagnostics);
  }
  const fallbackResult=runResolver(spec.defaultResolver||{op:'literal',value:spec.defaultValue??''},row,context);
  return withDiagnostics(fallbackResult,diagnostics.concat(fallbackResult.diagnostics||[]));
}

function withDiagnostics(result,diagnostics){
  return Object.freeze({...result,diagnostics:Object.freeze(diagnostics)});
}

function sourceRefs(row){return row?.rowId?[row.rowId]:[];}
