import { createResolverContext, runResolver } from './table-categorized-xml-resolver-engine.js';
import { CATEGORIZED_GRAPH_SCHEMA, createGraphEdge, createGraphNode } from './table-categorized-xml-graph-contracts.js';

export const TABLE_CATEGORIZED_XML_GRAPH_BUILDER_SCHEMA='table-categorized-xml-graph-builder/v1';

export function buildCategorizedGraph(profile,sources=[],options={}){
  const source=sources[0]||null;
  const state={profile,source,context:options.resolverContext||createResolverContext(profile?.coordinateCluster||{}),nodes:[],edges:[],diagnostics:[],nodeIndex:0,edgeIndex:0};
  const rows=source?.rows||[];
  for(const level of profile.levelDefinitions||[])buildLevel(state,level,null,rows);
  return Object.freeze({
    schema:CATEGORIZED_GRAPH_SCHEMA,
    profileId:profile.profileId,
    sourceIds:Object.freeze(sources.map((item)=>item.sourceId)),
    nodes:Object.freeze(state.nodes),
    edges:Object.freeze(state.edges),
    diagnostics:Object.freeze(state.diagnostics),
    documentRootNodeIds:Object.freeze(state.nodes.filter((node)=>node.fields.documentRoot).map((node)=>node.id))
  });
}

export function graphChildren(graph,parentId){
  const childIds=new Set((graph?.edges||[]).filter((edge)=>edge.fromNodeId===parentId).map((edge)=>edge.toNodeId));
  return (graph?.nodes||[]).filter((node)=>childIds.has(node.id));
}

function buildLevel(state,level,parent,rows){
  const buckets=bucketRows(state,level,rows);
  for(const bucket of buckets){
    const node=appendNode(state,level,parent,bucket.resolved,bucket.rows);
    for(const child of level.children||[])buildLevel(state,child,node,bucket.rows);
  }
}

function bucketRows(state,level,rows){
  if(level.creationMode==='static')return [staticBucket(level,rows)];
  if(level.creationMode==='one-per-row')return rows.map((row)=>rowBucket(state,level,row));
  if(level.creationMode==='zero-or-one')return rows.length?[rowBucket(state,level,rows[0])]:[];
  return groupedBuckets(state,level,rows);
}

function staticBucket(level,rows){
  return {rows,resolved:{key:level.key,displayName:level.displayName||level.key,fields:{documentRoot:Boolean(level.documentRoot)}}};
}

function rowBucket(state,level,row){
  const resolved=resolveLevelForRow(state,level,row);
  return {rows:[row],resolved};
}

function groupedBuckets(state,level,rows){
  const byKey=new Map();
  for(const row of rows){
    const resolved=resolveLevelForRow(state,level,row);
    const key=String(resolved.key||'');
    if(!byKey.has(key))byKey.set(key,{rows:[],resolved});
    byKey.get(key).rows.push(row);
  }
  return [...byKey.values()].map((bucket)=>mergeBucket(bucket));
}

function mergeBucket(bucket){
  const refs=bucket.rows.map((row)=>row.rowId).filter(Boolean);
  return {rows:bucket.rows,resolved:{...bucket.resolved,sourceRefs:refs}};
}

function resolveLevelForRow(state,level,row){
  const key=runResolver(level.keyResolver||{op:'literal',value:level.key||''},row,state.context);
  const display=level.displayNameResolver?runResolver(level.displayNameResolver,row,state.context):null;
  const fields=resolveFields(level,row,state.context);
  const diagnostics=[...(key.diagnostics||[]),...(display?.diagnostics||[]),...fieldDiagnostics(fields)];
  state.diagnostics.push(...diagnostics);
  return {
    key:key.value,
    displayName:level.displayName||display?.value||key.value,
    fields:fieldValues(fields),
    evidence:[{sourceRef:row.rowId,rawByHeader:row.rawByHeader}],
    diagnostics,
    sourceRefs:[row.rowId]
  };
}

function resolveFields(level,row,context){
  return Object.freeze(Object.fromEntries(Object.entries(level.fieldResolvers||{}).map(([name,spec])=>[name,runResolver(spec,row,context)])));
}

function fieldValues(fields){
  return Object.freeze(Object.fromEntries(Object.entries(fields).map(([name,result])=>[name,result.value])));
}

function fieldDiagnostics(fields){
  return Object.values(fields).flatMap((result)=>result.diagnostics||[]);
}

function appendNode(state,level,parent,resolved,rows){
  const sourceRefs=resolved.sourceRefs||rows.map((row)=>row.rowId).filter(Boolean);
  const fields={...(resolved.fields||{})};
  if(level.documentRoot)fields.documentRoot=true;
  const node=createGraphNode(++state.nodeIndex,level,parent?.id||null,{...resolved,fields},sourceRefs);
  state.nodes.push(node);
  if(parent)state.edges.push(createGraphEdge(++state.edgeIndex,parent.id,node.id));
  return node;
}
