import { coordinateClusterContractReady } from './table-categorized-xml-coordinate-cluster.js';

export const TABLE_CATEGORIZED_XML_VALIDATION_SCHEMA='table-categorized-xml-validation/v1';

const FUTURE_GATES=Object.freeze(['xml_tag_valid','xml_attribute_valid','export_xml_well_formed']);

export const VALIDATION_GATE_NAMES=Object.freeze([
  'source_parse_ok','required_columns_present','resolver_outputs_non_empty',
  'key_parts_non_empty','key_uniqueness_per_parent','display_name_resolved',
  'parent_link_resolved','coordinate_units_declared','coordinate_tolerance_declared',
  'multi_value_policy_declared','duplicate_key_policy_declared','xml_tag_valid',
  'xml_attribute_valid','graph_has_single_document_root','export_xml_well_formed'
]);

export function runCategorizerValidation({profile=null,sources=[],graph=null}={}){
  const source=sources[0]||null;
  return Object.freeze(VALIDATION_GATE_NAMES.map((gate)=>runGate(gate,profile,source,graph)));
}

export function hasBlockingValidation(results=[]){
  return results.some((item)=>item.severity==='BLOCKER'&&item.status==='FAIL');
}

function runGate(gate,profile,source,graph){
  if(FUTURE_GATES.includes(gate))return result(gate,'INFO','FUTURE_PHASE','XML export is not implemented in Phase 3-5.');
  if(gate==='source_parse_ok')return sourceParseOk(gate,source);
  if(gate==='required_columns_present')return requiredColumns(gate,profile,source);
  if(gate==='resolver_outputs_non_empty')return resolverOutputs(gate,graph);
  if(gate==='key_parts_non_empty')return nonEmptyKeys(gate,graph);
  if(gate==='key_uniqueness_per_parent')return uniqueKeys(gate,graph);
  if(gate==='display_name_resolved')return displayNames(gate,graph);
  if(gate==='parent_link_resolved')return parentLinks(gate,graph);
  if(gate==='coordinate_units_declared')return coordinateContract(gate,profile,'unit');
  if(gate==='coordinate_tolerance_declared')return coordinateContract(gate,profile,'tolerance');
  if(gate==='multi_value_policy_declared')return policy(gate,profile,'multiValuePolicy');
  if(gate==='duplicate_key_policy_declared')return policy(gate,profile,'duplicateKeyPolicy');
  if(gate==='graph_has_single_document_root')return singleRoot(gate,graph);
  return result(gate,'INFO','NOT_RUN','Gate is not implemented yet.');
}

function sourceParseOk(gate,source){
  if(!source)return result(gate,'BLOCKER','FAIL','No parsed source is available.');
  const hasError=(source.diagnostics||[]).some((item)=>item.severity==='ERROR');
  if(hasError)return result(gate,'BLOCKER','FAIL','Source parser reported errors.');
  return result(gate,'INFO','PASS','Source parser completed without errors.');
}

function requiredColumns(gate,profile,source){
  const headers=new Set(source?.headers||[]);
  const missing=(profile?.requiredColumns||[]).filter((name)=>!headers.has(name));
  if(missing.length)return result(gate,'BLOCKER','FAIL',`Missing required column(s): ${missing.join(', ')}.`);
  return result(gate,'INFO','PASS','All required columns are present.');
}

function resolverOutputs(gate,graph){
  if(!graph)return result(gate,'INFO','NOT_RUN','Graph has not been built yet.');
  const blockers=(graph.diagnostics||[]).filter((item)=>item.severity==='BLOCKER');
  if(blockers.length)return result(gate,'BLOCKER','FAIL','Resolver produced blocker diagnostics.',blockers[0].sourceRef);
  const warnings=(graph.diagnostics||[]).filter((item)=>item.severity==='WARNING');
  if(warnings.length)return result(gate,'WARNING','PASS','Resolver completed with warnings.',warnings[0].sourceRef);
  return result(gate,'INFO','PASS','Resolver outputs are available.');
}

function nonEmptyKeys(gate,graph){
  if(!graph)return result(gate,'INFO','NOT_RUN','Graph has not been built yet.');
  const empty=(graph.nodes||[]).find((node)=>!String(node.key||''));
  return empty?result(gate,'BLOCKER','FAIL','Graph node key is empty.',empty.id):result(gate,'INFO','PASS','All graph node keys are non-empty.');
}

function uniqueKeys(gate,graph){
  if(!graph)return result(gate,'INFO','NOT_RUN','Graph has not been built yet.');
  const duplicate=findDuplicateChildKey(graph);
  return duplicate?result(gate,'BLOCKER','FAIL',`Duplicate key ${duplicate.key} under parent ${duplicate.parentId}.`,duplicate.nodeId):result(gate,'INFO','PASS','Child keys are unique per parent.');
}

function displayNames(gate,graph){
  if(!graph)return result(gate,'INFO','NOT_RUN','Graph has not been built yet.');
  const missing=(graph.nodes||[]).find((node)=>!String(node.displayName||''));
  return missing?result(gate,'BLOCKER','FAIL','Display name is missing.',missing.id):result(gate,'INFO','PASS','Display names are resolved.');
}

function parentLinks(gate,graph){
  if(!graph)return result(gate,'INFO','NOT_RUN','Graph has not been built yet.');
  const ids=new Set(graph.nodes.map((node)=>node.id));
  const missing=graph.nodes.find((node)=>node.parentId&&!ids.has(node.parentId));
  return missing?result(gate,'BLOCKER','FAIL','Parent link is missing.',missing.id):result(gate,'INFO','PASS','Parent links are resolved.');
}

function coordinateContract(gate,profile,field){
  const contract=profile?.coordinateCluster||{};
  const ok=field==='unit'?Boolean(contract.unit):Number.isFinite(Number(contract.tolerance));
  const msg=field==='unit'?'Coordinate unit is declared.':'Coordinate tolerance is declared.';
  return ok?result(gate,'INFO','PASS',msg):result(gate,'BLOCKER','FAIL',`${field} is required for coordinate grouping.`);
}

function policy(gate,profile,field){
  return profile?.[field]?result(gate,'INFO','PASS',`${field} is declared.`):result(gate,'BLOCKER','FAIL',`${field} is not declared.`);
}

function singleRoot(gate,graph){
  if(!graph)return result(gate,'INFO','NOT_RUN','Graph has not been built yet.');
  const roots=graph.documentRootNodeIds||[];
  if(roots.length!==1)return result(gate,'BLOCKER','FAIL',`Expected one document root; found ${roots.length}.`);
  return result(gate,'INFO','PASS','Graph has exactly one document root.',roots[0]);
}

function findDuplicateChildKey(graph){
  const seen=new Map();
  for(const node of graph.nodes||[]){
    const parentId=node.parentId||'__root__';
    const id=`${parentId}\u0000${node.key}`;
    if(seen.has(id))return {parentId,key:node.key,nodeId:node.id};
    seen.set(id,node.id);
  }
  return null;
}

function result(gate,severity,status,message,ref=''){
  return Object.freeze({gate,severity,status,message,ref});
}

export const _test=Object.freeze({coordinateClusterContractReady});
