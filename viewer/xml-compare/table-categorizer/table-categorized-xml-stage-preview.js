import { graphChildren } from './table-categorized-xml-graph-builder.js';
import { createResolverContext, runResolver } from './table-categorized-xml-resolver-engine.js';

export const TABLE_CATEGORIZED_XML_STAGE_PREVIEW_SCHEMA='table-categorized-xml-stage-preview/v2';
export const TABLE_CATEGORIZED_XML_STAGE_PREVIEW_STYLE_ID='table-categorized-stage-preview-style';
export const TABLE_CATEGORIZED_XML_STAGE_TABS=Object.freeze([
  ['raw','Raw'],
  ['base','PS Base'],
  ['cluster','Cluster'],
  ['family','Family Key'],
  ['graph','Graph'],
  ['xml','XML']
]);

const esc=(value)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

injectStagePreviewStyle();

export function renderTableCategorizedStagePreview(view={}){
  const stage=view.previewStage||previewStageForTab(view.activeTab);
  const model=buildStagePreviewModel(view,stage);
  return `<aside class="table-categorized-stage-preview" aria-label="Stage Preview"><header><div><h4>Stage Preview</h4><p>${esc(model.title)}</p></div><b class="table-categorized-stage-pill">right inspector</b></header>${renderStageTabs(stage)}${renderStageBody(model)}${renderStageDiagnostics(model)}</aside>`;
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

export function injectStagePreviewStyle(){
  if(typeof document==='undefined')return;
  let style=document.getElementById(TABLE_CATEGORIZED_XML_STAGE_PREVIEW_STYLE_ID);
  if(!style){
    style=document.createElement('style');
    style.id=TABLE_CATEGORIZED_XML_STAGE_PREVIEW_STYLE_ID;
    document.head.append(style);
  }
  style.textContent=`
.table-categorized-xml-dialog{width:min(1680px,calc(100vw - 24px));max-width:none}
.table-categorized-xml-body.table-categorized-xml-with-preview{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(420px,34vw);gap:14px;align-items:start;overflow:auto}
.table-categorized-xml-workflow-pane{min-width:0;overflow:auto}
.table-categorized-stage-preview{position:sticky;top:0;align-self:start;max-height:calc(100vh - 190px);overflow:auto;border:1px solid rgba(116,185,255,.42);border-radius:14px;background:linear-gradient(180deg,rgba(9,25,43,.98),rgba(8,18,33,.98));box-shadow:0 16px 40px rgba(0,0,0,.26);padding:12px;min-width:0}
.table-categorized-stage-preview header{display:flex;justify-content:space-between;gap:10px;align-items:start;border-bottom:1px solid rgba(116,185,255,.18);padding-bottom:8px;margin-bottom:8px}
.table-categorized-stage-preview header h4{margin:0 0 3px}.table-categorized-stage-preview header p{margin:0;color:#aebbd0}.table-categorized-stage-pill{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9bd3ff;border:1px solid rgba(155,211,255,.38);border-radius:999px;padding:4px 8px;white-space:nowrap}
.table-categorized-stage-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 10px}.table-categorized-stage-tabs button{border:1px solid rgba(116,185,255,.45);border-radius:10px;background:rgba(28,47,70,.78);color:#dcecff;padding:6px 9px;font-weight:700}.table-categorized-stage-tabs button.is-active{background:#0f5a73;border-color:#87d8ff;color:#fff}
.table-categorized-stage-card,.table-categorized-stage-diagnostics{border:1px solid rgba(116,185,255,.20);border-radius:12px;background:rgba(5,13,28,.44);padding:10px;margin-top:10px}.table-categorized-stage-card h5,.table-categorized-stage-diagnostics h5{margin:0 0 7px}.table-categorized-stage-card p{margin:0 0 8px;color:#b9c5d6}.table-categorized-stage-preview table{font-size:12px}.table-categorized-stage-preview th{color:#9bd3ff}.table-categorized-stage-preview td,.table-categorized-stage-preview th{padding:6px 7px}
.table-categorized-stage-graphic{border:1px solid rgba(116,185,255,.25);border-radius:14px;background:radial-gradient(circle at 20% 0%,rgba(31,114,146,.24),transparent 36%),rgba(4,10,22,.60);padding:8px;margin-bottom:10px;overflow:hidden}.table-categorized-stage-graphic svg{display:block;width:100%;height:auto;min-height:260px}.table-categorized-stage-graphic text{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}.table-categorized-stage-graphic .box{fill:#10233d;stroke:#78cfff;stroke-width:1.4}.table-categorized-stage-graphic .box-strong{fill:#0d5269;stroke:#9be1ff;stroke-width:1.8}.table-categorized-stage-graphic .box-warn{fill:#45391a;stroke:#ffd36e;stroke-width:1.4}.table-categorized-stage-graphic .line{stroke:#88d8ff;stroke-width:2;fill:none}.table-categorized-stage-graphic .line-soft{stroke:#6f87aa;stroke-width:1.4;fill:none;stroke-dasharray:5 5}.table-categorized-stage-graphic .label{fill:#e6f2ff;font-size:13px;font-weight:700}.table-categorized-stage-graphic .small{fill:#b9cce2;font-size:11px}.table-categorized-stage-graphic .tiny{fill:#8fb4d2;font-size:10px}.table-categorized-stage-tree pre{margin:2px 0;color:#dcecff}
@media (max-width:1180px){.table-categorized-xml-body.table-categorized-xml-with-preview{grid-template-columns:1fr}.table-categorized-stage-preview{position:relative;max-height:none}.table-categorized-stage-pill{display:none}}
`;
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
  return `<section class="table-categorized-stage-card"><h5>Raw Table Rows</h5>${renderRawFlowSvg(model)}${table(['RowId',...headers],model.rows.map((row)=>[row.rowId,...headers.map((header)=>row.rawByHeader?.[header]??'')]))}</section>`;
}

function renderBaseRows(model){
  return `<section class="table-categorized-stage-card"><h5>PS Base Resolver</h5>${renderMappingFlowSvg(model)}<p>Rule: <code>regexExtract(PS NO, "^(.+?)\\.\\d+$")</code>; fallback: full PS NO.</p>${table(['RowId','PS NO','Base PS','Status'],model.rows.map((row,index)=>[row.rowId,cell(row,'PS NO'),model.baseRows[index]?.value||'',statusText(model.baseRows[index])]))}</section>`;
}

function renderClusterRows(model){
  const contract=clusterContract(model);
  return `<section class="table-categorized-stage-card"><h5>Coordinate Cluster</h5>${renderMappingFlowSvg(model)}<p>Unit: <b>${esc(contract.unit||'mm')}</b> · Tolerance: <b>${esc(contract.tolerance??'')}</b> · Method: <b>${esc(contract.clusterMethod||'max-axis-delta')}</b></p>${table(['RowId','PS NO','X/Y/Z','Cluster','Status'],model.rows.map((row,index)=>[row.rowId,cell(row,'PS NO'),coordinateText(row,contract.axisMapping),model.clusterRows[index]?.value||'',statusText(model.clusterRows[index])]))}</section>`;
}

function renderFamilyRows(model){
  return `<section class="table-categorized-stage-card"><h5>SupportFamily Grouping</h5>${renderMappingFlowSvg(model)}<p>Mode: PS base + Coordinate Cluster. Each row remains an occurrence below the grouped family.</p>${table(['RowId','PS NO','Base PS','Cluster','SupportFamily','Status'],model.rows.map((row,index)=>[row.rowId,cell(row,'PS NO'),model.baseRows[index]?.value||'',model.clusterRows[index]?.value||'',model.familyRows[index]?.value||'',statusText(model.familyRows[index])]))}${renderFamilySummary(model)}</section>`;
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
  if(!model.graph)return `<section class="table-categorized-stage-card"><h5>Canonical Graph</h5>${renderGraphPlaceholderSvg()}<p>Run Graph Build to preview generated GraphNode[] / GraphEdge[] output.</p></section>`;
  const roots=(model.graph.nodes||[]).filter((node)=>!node.parentId);
  return `<section class="table-categorized-stage-card"><h5>Canonical Graph</h5>${renderGraphFlowSvg(model)}<p>${(model.graph.nodes||[]).length} node(s), ${(model.graph.edges||[]).length} edge(s).</p><div class="table-categorized-stage-tree">${roots.map((node)=>renderGraphNode(model.graph,node)).join('')}</div></section>`;
}

function renderXmlStage(model){
  const xml=model.exportResult?.xmlText||'';
  if(!xml)return `<section class="table-categorized-stage-card"><h5>XML Snippet</h5>${renderGraphPlaceholderSvg()}<p>Run export after validation to preview categorized XML generated from the canonical graph.</p></section>`;
  return `<section class="table-categorized-stage-card"><h5>XML Snippet</h5>${renderGraphFlowSvg(model)}<p>Preview only — generated from canonical graph.</p><pre class="table-categorized-xml-preview">${esc(snippet(xml))}</pre></section>`;
}

function renderRawFlowSvg(model){
  const row=model.rows[0]||{};
  return `<div class="table-categorized-stage-graphic"><svg viewBox="0 0 760 250" role="img" aria-label="Raw source evidence"><rect class="box-strong" x="24" y="34" width="210" height="72" rx="12"/><text class="label" x="42" y="64">ImportSource S1</text><text class="small" x="42" y="86">raw row evidence</text><rect class="box" x="292" y="34" width="190" height="72" rx="12"/><text class="label" x="312" y="64">Raw Cells</text><text class="small" x="312" y="86">${esc(cell(row,'PS NO')||'PS NO')} / ${esc(cell(row,'DTXR')||'DTXR')}</text><path class="line" d="M234 70 L292 70"/><rect class="box" x="536" y="34" width="190" height="72" rx="12"/><text class="label" x="556" y="64">Not Graph Yet</text><text class="small" x="556" y="86">evidence only</text><path class="line-soft" d="M482 70 L536 70"/><text class="tiny" x="302" y="145">Raw rows must remain source evidence; graph nodes are built later.</text></svg></div>`;
}

function renderMappingFlowSvg(model){
  const first=model.rows[0]||{};
  const ps=cell(first,'PS NO')||'PS-XXX.1';
  const base=model.baseRows[0]?.value||'PS-XXX';
  const cluster=model.clusterRows[0]?.value||'C001';
  const family=model.familyRows[0]?.value||`${base}__${cluster}`;
  const feature=cell(first,'DTXR')||'GUIDE';
  return `<div class="table-categorized-stage-graphic"><svg class="mapping-flow" viewBox="0 0 780 360" role="img" aria-label="Table columns connected to resolvers and graph nodes"><defs><marker id="tableCatArrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 Z" fill="#88d8ff"/></marker></defs><text class="tiny" x="42" y="24">TABLE COLUMNS</text><text class="tiny" x="318" y="24">RESOLVERS</text><text class="tiny" x="590" y="24">CANONICAL GRAPH</text><rect class="box" x="28" y="44" width="185" height="58" rx="12"/><text class="label" x="46" y="69">PS NO</text><text class="small" x="46" y="89">${esc(ps)}</text><rect class="box" x="28" y="128" width="185" height="58" rx="12"/><text class="label" x="46" y="153">X / Y / Z</text><text class="small" x="46" y="173">${esc(coordinateText(first))}</text><rect class="box" x="28" y="212" width="185" height="58" rx="12"/><text class="label" x="46" y="237">DTXR</text><text class="small" x="46" y="257">${esc(feature)}</text><rect class="box" x="28" y="296" width="185" height="42" rx="12"/><text class="label" x="46" y="322">Support Gap</text><rect class="box-strong" x="300" y="44" width="190" height="58" rx="12"/><text class="label" x="318" y="69">regexExtract</text><text class="small" x="318" y="89">Base PS = ${esc(base)}</text><rect class="box-strong" x="300" y="128" width="190" height="58" rx="12"/><text class="label" x="318" y="153">coordinateCluster</text><text class="small" x="318" y="173">Cluster = ${esc(cluster)}</text><rect class="box-strong" x="300" y="212" width="190" height="58" rx="12"/><text class="label" x="318" y="237">classifier</text><text class="small" x="318" y="257">featureType = ${esc(feature)}</text><rect class="box-strong" x="300" y="296" width="190" height="42" rx="12"/><text class="label" x="318" y="322">numberParser</text><rect class="box-strong" x="560" y="74" width="190" height="70" rx="14"/><text class="label" x="578" y="101">SupportFamily</text><text class="small" x="578" y="123">${esc(family)}</text><rect class="box" x="560" y="170" width="190" height="58" rx="12"/><text class="label" x="578" y="195">Occurrence</text><text class="small" x="578" y="215">${esc(ps)}</text><rect class="box" x="560" y="254" width="190" height="58" rx="12"/><text class="label" x="578" y="279">Feature / Gap</text><text class="small" x="578" y="299">${esc(feature)} + gap</text><path class="line" marker-end="url(#tableCatArrow)" d="M213 73 L300 73"/><path class="line" marker-end="url(#tableCatArrow)" d="M213 157 L300 157"/><path class="line" marker-end="url(#tableCatArrow)" d="M490 73 C525 73 525 98 560 98"/><path class="line" marker-end="url(#tableCatArrow)" d="M490 157 C525 157 525 120 560 120"/><path class="line" marker-end="url(#tableCatArrow)" d="M213 73 C260 73 500 188 560 198"/><path class="line" marker-end="url(#tableCatArrow)" d="M213 241 L300 241"/><path class="line" marker-end="url(#tableCatArrow)" d="M490 241 C525 241 525 272 560 282"/><path class="line" marker-end="url(#tableCatArrow)" d="M213 317 L300 317"/><path class="line-soft" d="M655 144 L655 170"/><path class="line-soft" d="M655 228 L655 254"/></svg></div>`;
}

function renderGraphFlowSvg(model){
  const familyNode=(model.graph?.nodes||[]).find((node)=>node.levelId==='supportFamily')||{};
  const occurrenceNode=(model.graph?.nodes||[]).find((node)=>node.levelId==='supportOccurrence')||{};
  const featureNode=(model.graph?.nodes||[]).find((node)=>node.levelId==='supportFeature')||{};
  return `<div class="table-categorized-stage-graphic"><svg class="graph-flow" viewBox="0 0 520 390" role="img" aria-label="Canonical graph hierarchy"><rect class="box-strong" x="150" y="20" width="220" height="54" rx="14"/><text class="label" x="174" y="51">DocumentRoot</text><rect class="box" x="150" y="96" width="220" height="54" rx="14"/><text class="label" x="174" y="127">RootPartition</text><text class="small" x="174" y="143">MODEL_SIDE</text><rect class="box-strong" x="150" y="172" width="220" height="62" rx="14"/><text class="label" x="174" y="202">SupportFamily</text><text class="small" x="174" y="220">${esc(familyNode.key||model.familyRows[0]?.value||'PS-XYZ__C001')}</text><rect class="box" x="150" y="256" width="220" height="54" rx="14"/><text class="label" x="174" y="287">Occurrence</text><text class="small" x="174" y="303">${esc(occurrenceNode.key||cell(model.rows[0],'PS NO')||'PS-XYZ.1')}</text><rect class="box" x="150" y="332" width="220" height="44" rx="14"/><text class="label" x="174" y="360">Feature / Gap</text><path class="line" d="M260 74 L260 96"/><path class="line" d="M260 150 L260 172"/><path class="line" d="M260 234 L260 256"/><path class="line" d="M260 310 L260 332"/><text class="tiny" x="380" y="206">${esc(featureNode.fields?.featureType||'GUIDE')}</text></svg></div>`;
}

function renderGraphPlaceholderSvg(){
  return `<div class="table-categorized-stage-graphic"><svg viewBox="0 0 520 220" role="img" aria-label="Graph build placeholder"><rect class="box-warn" x="120" y="42" width="280" height="64" rx="14"/><text class="label" x="150" y="75">Graph not built yet</text><text class="small" x="150" y="96">Run Graph Build to inspect nodes</text><path class="line-soft" d="M260 106 L260 166"/><rect class="box" x="150" y="166" width="220" height="36" rx="10"/><text class="small" x="178" y="189">XML export waits for graph</text></svg></div>`;
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

export const _test=Object.freeze({buildStagePreviewModel,familyKeyParts,preferredHeaders,renderMappingFlowSvg});
