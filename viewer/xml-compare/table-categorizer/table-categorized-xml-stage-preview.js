import { graphChildren } from './table-categorized-xml-graph-builder.js';
import { createResolverContext, runResolver } from './table-categorized-xml-resolver-engine.js';

export const TABLE_CATEGORIZED_XML_STAGE_PREVIEW_SCHEMA='table-categorized-xml-stage-preview/v1';
export const TABLE_CATEGORIZED_XML_STAGE_TABS=Object.freeze([
  ['raw','Raw'],
  ['base','PS Base'],
  ['cluster','Cluster'],
  ['family','Family Key'],
  ['graph','Graph'],
  ['xml','XML']
]);

const esc=(value)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

export function renderTableCategorizedStagePreview(view={}){
  const stage=view.previewStage||previewStageForTab(view.activeTab);
  const model=buildStagePreviewModel(view,stage);
  return `<aside class="table-categorized-stage-preview" aria-label="Stage Preview"><header><h4>Stage Preview</h4><p>${esc(model.title)}</p></header>${renderStageTabs(stage)}${renderStageBody(model)}${renderStageDiagnostics(model)}</aside>`;
}

export function buildStagePreviewModel(view={},stage='raw'){
  const sources=normalizeSources(view);
  const active=activeSourceFromView(sources,view.activeSourceId);
  const rows=sampleRows(active,view.previewRowLimit||6);
  const profile=view.profile||{};
  const familyLevel=findLevel(profile,'supportFamily')||{};
  const occurrenceLevel=findLevel(profile,'supportOccurrence')||{};
  const featureLevel=findLevel(profile,'supportFeature')||{};
  const gapLevel=findLevel(profile,'gap')||{};
  const familyParts=familyKeyParts(familyLevel.keyResolver);
  const baseRows=resolverRows(rows,familyParts.baseResolver,profile,sources,'Base PS');
  const clusterRows=resolverRows(rows,familyParts.clusterResolver,profile,sources,'Cluster');
  const familyRows=resolverRows(rows,familyLevel.keyResolver,profile,sources,'SupportFamily');
  return Object.freeze({
    stage,
    title:stageTitle(stage),
    sources,
    source:active,
    rows,
    profile,
    graph:view.graph||null,
    exportResult:view.exportResult||null,
    familyLevel,
    occurrenceLevel,
    featureLevel,
    gapLevel,
    baseResolver:familyParts.baseResolver,
    clusterResolver:familyParts.clusterResolver,
    baseRows,
    clusterRows,
    familyRows,
    diagnostics:collectPreviewDiagnostics([baseRows,clusterRows,familyRows])
  });
}

function previewStageForTab(activeTab){
  if(activeTab==='source')return 'raw';
  if(activeTab==='levels')return 'family';
  if(activeTab==='graph')return 'graph';
  if(activeTab==='export')return 'xml';
  return 'family';
}

function stageTitle(stage){
  if(stage==='raw')return 'Raw imported source rows before resolver logic.';
  if(stage==='base')return 'Regex PS base extraction for grouping PS-XXX.1 / .2 / .5 together.';
  if(stage==='cluster')return 'Coordinate clustering preview using declared X/Y/Z unit and tolerance.';
  if(stage==='family')return 'Final SupportFamily grouping key preview.';
  if(stage==='graph')return 'Canonical graph nodes generated from the profile.';
  if(stage==='xml')return 'Read-only XML snippet generated from canonical graph export.';
  return 'Inspect one transformation stage at a time.';
}

function normalizeSources(view){
  if(Array.isArray(view.sources)&&view.sources.length)return view.sources;
  return [view.source].filter(Boolean);
}

function activeSourceFromView(sources,activeSourceId){
  return sources.find((source)=>source.sourceId===activeSourceId)||sources[0]||{};
}

function sampleRows(source,limit){
  return (source?.rows||[]).slice(0,Math.max(1,Number(limit)||6));
}

function renderStageTabs(activeStage){
  return `<nav class="table-categorized-stage-tabs" aria-label="Stage preview tabs">${TABLE_CATEGORIZED_XML_STAGE_TABS.map(([id,label])=>`<button type="button" data-table-categorized-preview-stage="${esc(id)}" class="${id===activeStage?'is-active':''}">${esc(label)}</button>`).join('')}</nav>`;
}

function renderStageBody(model){
  if(model.stage==='raw')return renderRawRows(model);
  if(model.stage==='base')return renderBaseRows(model);
  if(model.stage==='cluster')return renderClusterRows(model);
  if(model.stage==='family')return renderFamilyRows(model);
  if(model.stage==='graph')return renderGraphStage(model);
  if(model.stage==='xml')return renderXmlStage(model);
  return renderFamilyRows(model);
}

function renderRawRows(model){
  const headers=preferredHeaders(model.source?.headers||[]);
  if(!model.rows.length)return `<section class="table-categorized-stage-card"><h5>Raw Table Rows</h5><p>Parse a source to preview raw rows.</p></section>`;
  return `<section class="table-categorized-stage-card"><h5>Raw Table Rows</h5>${table(['RowId',...headers],model.rows.map((row)=>[row.rowId,...headers.map((header)=>row.rawByHeader?.[header]??'')]))}</section>`;
}

function renderBaseRows(model){
  return `<section class="table-categorized-stage-card"><h5>PS Base Resolver</h5><p>Rule: <code>regexExtract(PS NO, "^(.+?)\\.\\d+$")</code>; fallback: full PS NO.</p>${table(['RowId','PS NO','Base PS','Status'],model.rows.map((row,index)=>[row.rowId,cell(row,'PS NO'),model.baseRows[index]?.value||'',statusText(model.baseRows[index])]))}</section>`;
}

function renderClusterRows(model){
  const contract=clusterContract(model);
  return `<section class="table-categorized-stage-card"><h5>Coordinate Cluster</h5><p>Unit: <b>${esc(contract.unit||'mm')}</b> · Tolerance: <b>${esc(contract.tolerance??'')}</b> · Method: <b>${esc(contract.clusterMethod||'max-axis-delta')}</b></p>${table(['RowId','PS NO','X/Y/Z','Cluster','Status'],model.rows.map((row,index)=>[row.rowId,cell(row,'PS NO'),coordinateText(row,contract.axisMapping),model.clusterRows[index]?.value||'',statusText(model.clusterRows[index])]))}</section>`;
}

function renderFamilyRows(model){
  return `<section class="table-categorized-stage-card"><h5>SupportFamily Grouping</h5><p>Mode: PS base + Coordinate Cluster. Each row remains an occurrence below the grouped family.</p>${table(['RowId','PS NO','Base PS','Cluster','SupportFamily','Status'],model.rows.map((row,index)=>[row.rowId,cell(row,'PS NO'),model.baseRows[index]?.value||'',model.clusterRows[index]?.value||'',model.familyRows[index]?.value||'',statusText(model.familyRows[index])]))}${renderFamilySummary(model)}</section>`;
}

function renderFamilySummary(model){
  const groups=new Map();
  model.familyRows.forEach((item,index)=>{
    const key=String(item?.value||'');
    if(!key)return;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(model.rows[index]);
  });
  if(!groups.size)return '<p>No SupportFamily grouping key resolved yet.</p>';
  const rows=[...groups.entries()].map(([key,items])=>[key,items.length,items.map((row)=>cell(row,'DTXR')).filter(Boolean).join(', '),items.map((row)=>row.rowId).join(' ')]);
  return `<h5>Grouping Result</h5>${table(['SupportFamily','Rows','Features','SourceRefs'],rows)}`;
}

function renderGraphStage(model){
  if(!model.graph)return `<section class="table-categorized-stage-card"><h5>Canonical Graph</h5><p>Run Graph Build to preview generated GraphNode[] / GraphEdge[] output.</p></section>`;
  const roots=(model.graph.nodes||[]).filter((node)=>!node.parentId);
  return `<section class="table-categorized-stage-card"><h5>Canonical Graph</h5><p>${(model.graph.nodes||[]).length} node(s), ${(model.graph.edges||[]).length} edge(s).</p><div class="table-categorized-stage-tree">${roots.map((node)=>renderGraphNode(model.graph,node)).join('')}</div></section>`;
}

function renderXmlStage(model){
  const xml=model.exportResult?.xmlText||'';
  if(!xml)return `<section class="table-categorized-stage-card"><h5>XML Snippet</h5><p>Run export after validation to preview categorized XML generated from the canonical graph.</p></section>`;
  return `<section class="table-categorized-stage-card"><h5>XML Snippet</h5><p>Preview only — generated from canonical graph.</p><pre class="table-categorized-xml-preview">${esc(snippet(xml))}</pre></section>`;
}

function renderGraphNode(graph,node,depth=0){
  const fields=Object.entries(node.fields||{}).filter(([key])=>key!=='documentRoot').map(([key,value])=>`${key}=${Array.isArray(value)?value.join(' '):value}`).join(', ');
  const line=`${'  '.repeat(depth)}- ${node.levelType} ${node.key}${fields?` · ${fields}`:''}`;
  const children=graphChildren(graph,node.id).map((child)=>renderGraphNode(graph,child,depth+1)).join('');
  return `<pre>${esc(line)}</pre>${children}`;
}

function renderStageDiagnostics(model){
  const rows=[];
  if(model.rows.length)rows.push(['INFO','raw_rows_available',`${model.rows.length} preview row(s).`]);
  if(model.baseRows.some((row)=>String(row?.value||'')))rows.push(['INFO','ps_base_resolved','PS base resolver produced values.']);
  if(model.clusterRows.some((row)=>String(row?.value||'')))rows.push(['INFO','coordinate_cluster_resolved','Coordinate cluster resolver produced values.']);
  if(model.familyRows.some((row)=>String(row?.value||'')))rows.push(['INFO','support_family_key_resolved','SupportFamily grouping key preview is available.']);
  rows.push(...model.diagnostics.map((d)=>[d.severity||'WARNING',d.code||'preview_diagnostic',d.message||'Resolver preview diagnostic.']));
  return `<section class="table-categorized-stage-diagnostics"><h5>Diagnostics</h5>${rows.length?`<ul>${rows.map(([severity,code,message])=>`<li class="is-${esc(String(severity).toLowerCase())}"><b>${esc(severity)}</b> ${esc(code)} — ${esc(message)}</li>`).join('')}</ul>`:'<p>No preview diagnostics.</p>'}</section>`;
}

function resolverRows(rows,resolver,profile,sources,label){
  if(!resolver)return rows.map((row)=>Object.freeze({ok:false,value:'',diagnostics:Object.freeze([{severity:'INFO',code:'preview_resolver_missing',message:`${label} resolver is not configured.`,sourceRef:row.rowId}]),sourceRefs:Object.freeze([row.rowId])}));
  const context=createResolverContext({coordinateCluster:profile?.coordinateCluster||{},sources});
  return rows.map((row)=>runResolver(resolver,row,context));
}

function familyKeyParts(resolver){
  const concat=findResolver(resolver,'concat');
  const parts=concat?.parts||[];
  return Object.freeze({
    baseResolver:parts.find((part)=>typeof part==='object'&&part.op!=='coordinateCluster')||findResolver(resolver,'regexExtract')||null,
    clusterResolver:parts.find((part)=>typeof part==='object'&&part.op==='coordinateCluster')||findResolver(resolver,'coordinateCluster')||null
  });
}

function findResolver(resolver,op){
  if(!resolver||typeof resolver!=='object')return null;
  if(resolver.op===op)return resolver;
  if(resolver.input){const found=findResolver(resolver.input,op);if(found)return found;}
  for(const item of resolver.resolvers||[]){const found=findResolver(item,op);if(found)return found;}
  if(resolver.defaultResolver){const found=findResolver(resolver.defaultResolver,op);if(found)return found;}
  for(const part of resolver.parts||[])if(typeof part==='object'){const found=findResolver(part,op);if(found)return found;}
  return null;
}

function findLevel(profile,levelId){
  let found=null;
  const walk=(levels=[])=>{
    for(const level of levels){
      if(level.levelId===levelId){found=level;return;}
      walk(level.children||[]);
      if(found)return;
    }
  };
  walk(profile?.levelDefinitions||[]);
  return found;
}

function collectPreviewDiagnostics(groups){
  return groups.flatMap((items)=>items.flatMap((item)=>item?.diagnostics||[]));
}

function preferredHeaders(headers){
  const preferred=['PS NO','Bore','pipe','DTXR','Support Gap','Mandatory','X','Y','Z'];
  const set=new Set(headers);
  return [...preferred.filter((header)=>set.has(header)),...headers.filter((header)=>!preferred.includes(header))].slice(0,9);
}

function clusterContract(model){
  return model.clusterResolver?.contract||model.profile?.coordinateCluster||{};
}

function coordinateText(row,axisMapping={x:'X',y:'Y',z:'Z'}){
  return [axisMapping.x||'X',axisMapping.y||'Y',axisMapping.z||'Z'].map((header)=>cell(row,header)).join('/');
}

function cell(row,header){return row?.rawByHeader?.[header]??'';}
function statusText(result){return result?.ok===false?'⚠ check':'✓ ok';}
function snippet(text){return String(text||'').split(/\r?\n/).slice(0,20).join('\n');}

function table(headers,rows){
  return `<div class="table-categorized-xml-scroll"><table><thead><tr>${headers.map((header)=>`<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map((row)=>`<tr>${row.map((value)=>`<td>${esc(value)}</td>`).join('')}</tr>`).join(''):'<tr><td colspan="99">No rows.</td></tr>'}</tbody></table></div>`;
}

export const _test=Object.freeze({buildStagePreviewModel,familyKeyParts,preferredHeaders});
