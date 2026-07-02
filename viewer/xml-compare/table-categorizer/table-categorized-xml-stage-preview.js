import { graphChildren } from './table-categorized-xml-graph-builder.js';
import { createResolverContext, runResolver } from './table-categorized-xml-resolver-engine.js';

export const TABLE_CATEGORIZED_XML_STAGE_PREVIEW_SCHEMA='table-categorized-xml-stage-preview/v5-readable-compact';
export const TABLE_CATEGORIZED_XML_STAGE_PREVIEW_STYLE_ID='table-categorized-stage-preview-style';
export const TABLE_CATEGORIZED_XML_STAGE_TABS=Object.freeze([
  ['raw','Rows'],
  ['base','Base Key'],
  ['cluster','Coordinate Group'],
  ['family','Final Group'],
  ['graph','Graph View'],
  ['xml','XML View']
]);

const esc=(value)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

injectStagePreviewStyle();

export function previewStageForSetupTab(activeSetupTab){
  if(activeSetupTab==='source')return 'raw';
  if(activeSetupTab==='fields')return 'base';
  if(activeSetupTab==='relationships')return 'family';
  if(activeSetupTab==='structure')return 'graph';
  if(activeSetupTab==='rules')return 'cluster';
  if(activeSetupTab==='quality')return 'graph';
  if(activeSetupTab==='output')return 'xml';
  if(activeSetupTab==='recipe')return 'base';
  return 'raw';
}

export function previewContextForSetupTab(activeSetupTab){
  if(activeSetupTab==='source')return 'Showing raw rows for the selected source.';
  if(activeSetupTab==='fields')return 'Column mapping proof: selected fields become graph keys and values.';
  if(activeSetupTab==='relationships')return 'Relationship proof: item key + coordinate group become the final group.';
  if(activeSetupTab==='structure')return 'Graph proof: document root, model split, groups, items, and details.';
  if(activeSetupTab==='rules')return 'Rule proof: coordinate and classifier rules before graph build.';
  if(activeSetupTab==='quality')return 'Check proof: graph and validation context.';
  if(activeSetupTab==='output')return 'Output proof: XML generated only from the categorized graph.';
  if(activeSetupTab==='recipe')return 'Recipe proof: profile settings used by the mapping.';
  return 'Showing raw rows for the selected source.';
}

export function renderTableCategorizedStagePreview(view={}){
  const stage=view.activePreviewStage||view.previewStage||defaultPreviewStage(view);
  const model=buildStagePreviewModel(view,stage);
  return `<aside class="table-categorized-stage-preview" aria-label="Live Preview - ${esc(model.title)} ${esc(model.context)}"><header class="table-categorized-stage-header"><div class="table-categorized-stage-heading"><b>Live Preview</b><span>${esc(model.title)}</span></div>${renderStageTabs(stage)}</header>${renderStageBody(model)}${renderStageDiagnostics(model)}</aside>`;
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
  const baseRows=resolverRows(rows,familyParts.baseResolver,profile,sources,'Common group key');
  const clusterRows=resolverRows(rows,familyParts.clusterResolver,profile,sources,'Coordinate group');
  const familyRows=resolverRows(rows,familyLevel.keyResolver,profile,sources,'Final group');
  return Object.freeze({stage,title:stageTitle(stage),context:previewContextForSetupTab(view.activeSetupTab),sources,source:active,rows,profile,graph:view.graph||null,exportResult:view.exportResult||null,familyLevel,occurrenceLevel,featureLevel,gapLevel,baseResolver:familyParts.baseResolver,clusterResolver:familyParts.clusterResolver,baseRows,clusterRows,familyRows,diagnostics:collectPreviewDiagnostics([baseRows,clusterRows,familyRows])});
}

export function injectStagePreviewStyle(){
  if(typeof document==='undefined')return;
  let style=document.getElementById(TABLE_CATEGORIZED_XML_STAGE_PREVIEW_STYLE_ID);
  if(!style){style=document.createElement('style');style.id=TABLE_CATEGORIZED_XML_STAGE_PREVIEW_STYLE_ID;document.head.append(style);}
  style.textContent=`
.table-categorized-xml-dialog{width:min(1680px,calc(100vw - 24px));max-width:none}
.table-categorized-xml-body.table-categorized-xml-with-preview{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(440px,34vw);gap:14px;align-items:start;overflow:auto}
.table-categorized-xml-workflow-pane{min-width:0;overflow:auto}.table-categorized-option-index{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px}.table-categorized-option-chip{text-align:left;border:1px solid rgba(116,185,255,.28);border-radius:12px;background:rgba(12,28,48,.68);color:#dcecff;padding:8px}.table-categorized-option-chip b{display:block}.table-categorized-option-chip small{display:block;color:#aebbd0;margin-top:3px}
.table-categorized-stage-preview{position:sticky;top:0;align-self:start;max-height:calc(100vh - 190px);overflow:auto;border:1px solid rgba(116,185,255,.42);border-radius:14px;background:linear-gradient(180deg,rgba(9,25,43,.98),rgba(8,18,33,.98));box-shadow:0 16px 40px rgba(0,0,0,.26);padding:10px;min-width:0}
.table-categorized-stage-preview header.table-categorized-stage-header{display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(116,185,255,.18);padding-bottom:8px;margin-bottom:8px;flex-wrap:wrap}.table-categorized-stage-heading{display:flex;align-items:center;gap:8px;min-width:220px;flex:1}.table-categorized-stage-heading b{font-size:14px;color:#fff;white-space:nowrap}.table-categorized-stage-heading span{font-size:12px;color:#d8e8f7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.table-categorized-stage-pill{display:none}
.table-categorized-stage-tabs{display:flex;flex-wrap:wrap;gap:5px;margin:0}.table-categorized-stage-tabs button{border:1px solid rgba(116,185,255,.45);border-radius:999px;background:rgba(28,47,70,.78);color:#dcecff;padding:4px 8px;font-weight:700;font-size:11px}.table-categorized-stage-tabs button.is-active{background:#0f5a73;border-color:#87d8ff;color:#fff}
.table-categorized-stage-card,.table-categorized-stage-diagnostics{border:1px solid rgba(116,185,255,.20);border-radius:12px;background:rgba(5,13,28,.44);padding:10px;margin-top:10px}.table-categorized-stage-card h5,.table-categorized-stage-diagnostics h5{margin:0 0 7px}.table-categorized-stage-card p{margin:0 0 8px;color:#b9c5d6}.table-categorized-stage-preview table{font-size:12px}.table-categorized-stage-preview th{color:#9bd3ff}.table-categorized-stage-preview td,.table-categorized-stage-preview th{padding:6px 7px}.table-categorized-proof-note{border:1px solid rgba(116,185,255,.18);border-radius:10px;padding:8px;background:rgba(14,34,56,.55);margin:0 0 8px}.table-categorized-proof-note b{color:#fff}.table-categorized-proof-note small{display:block;color:#9fb5ca;margin-top:3px}
.table-categorized-stage-graphic{border:1px solid rgba(116,185,255,.25);border-radius:14px;background:radial-gradient(circle at 20% 0%,rgba(31,114,146,.24),transparent 36%),rgba(4,10,22,.60);padding:8px;margin-bottom:10px;overflow:hidden}.table-categorized-stage-graphic svg{display:block;width:100%;height:auto;min-height:220px}.table-categorized-stage-graphic text{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}.table-categorized-stage-graphic .box{fill:#10233d;stroke:#78cfff;stroke-width:1.4}.table-categorized-stage-graphic .box-strong{fill:#0d5269;stroke:#9be1ff;stroke-width:1.8}.table-categorized-stage-graphic .box-warn{fill:#45391a;stroke:#ffd36e;stroke-width:1.4}.table-categorized-stage-graphic .line{stroke:#88d8ff;stroke-width:2;fill:none}.table-categorized-stage-graphic .line-soft{stroke:#6f87aa;stroke-width:1.4;fill:none;stroke-dasharray:5 5}.table-categorized-stage-graphic .label{fill:#e6f2ff;font-size:13px;font-weight:700}.table-categorized-stage-graphic .small{fill:#b9cce2;font-size:11px}.table-categorized-stage-graphic .tiny{fill:#8fb4d2;font-size:10px}.table-categorized-stage-tree pre{margin:2px 0;color:#dcecff}
@media (max-width:1180px){.table-categorized-xml-body.table-categorized-xml-with-preview{grid-template-columns:1fr}.table-categorized-stage-preview{position:relative;max-height:none}.table-categorized-stage-heading span{white-space:normal}}
`;
}

function defaultPreviewStage(view={}){return view.activeSetupTab?previewStageForSetupTab(view.activeSetupTab):previewStageForTab(view.activeTab);}
function previewStageForTab(activeTab){if(activeTab==='source')return 'raw';if(activeTab==='levels')return 'family';if(activeTab==='graph')return 'graph';if(activeTab==='export')return 'xml';return 'family';}
function stageTitle(stage){if(stage==='raw')return 'Rows exactly as read from the table.';if(stage==='base')return 'Column mapping proof: PS NO becomes a common group key.';if(stage==='cluster')return 'Coordinate proof: nearby X/Y/Z rows share a group.';if(stage==='family')return 'Final group proof before graph nodes are created.';if(stage==='graph')return 'Graph proof: hierarchy that will be exported.';if(stage==='xml')return 'XML proof generated from the graph.';return 'Inspect one step at a time.';}
function normalizeSources(view){if(Array.isArray(view.sources)&&view.sources.length)return view.sources;return [view.source].filter(Boolean);}
function activeSourceFromView(sources,activeSourceId){return sources.find((source)=>source.sourceId===activeSourceId)||sources[0]||{};}
function sampleRows(source,limit){return (source?.rows||[]).slice(0,Math.max(1,Number(limit)||6));}
function renderStageTabs(activeStage){return `<nav class="table-categorized-stage-tabs" aria-label="Live preview tabs">${TABLE_CATEGORIZED_XML_STAGE_TABS.map(([id,label])=>`<button type="button" data-table-categorized-preview-stage="${esc(id)}" class="${id===activeStage?'is-active':''}">${esc(label)}</button>`).join('')}</nav>`;}
function renderStageBody(model){if(model.stage==='raw')return renderRawRows(model);if(model.stage==='base')return renderBaseRows(model);if(model.stage==='cluster')return renderClusterRows(model);if(model.stage==='family')return renderFamilyRows(model);if(model.stage==='graph')return renderGraphStage(model);if(model.stage==='xml')return renderXmlStage(model);return renderFamilyRows(model);}
function renderRawRows(model){const headers=preferredHeaders(model.source?.headers||[]);if(!model.rows.length)return `<section class="table-categorized-stage-card"><h5>Rows / Imported Rows</h5><p>Load a sample or read a pasted table to preview raw rows.</p></section>`;return `<section class="table-categorized-stage-card"><h5>Rows / Imported Rows</h5><div class="table-categorized-proof-note"><b>Source evidence only.</b><small>These are the rows exactly as read. No graph node has been created yet.</small></div>${table(['RowId',...headers],model.rows.map((row)=>[row.rowId,...headers.map((header)=>row.rawByHeader?.[header]??'')]))}</section>`;}
function renderBaseRows(model){if(!model.rows.length)return `<section class="table-categorized-stage-card"><h5>Column Mapping Proof</h5><p>Load or paste a table first.</p></section>`;return `<section class="table-categorized-stage-card"><h5>Column Mapping Proof</h5><div class="table-categorized-proof-note"><b>Selected field:</b> PS NO → Common Group Key<small>Example: PS-XYZ.1, PS-XYZ.2, and PS-XYZ.10 become the common group PS-XYZ. Advanced rule is hidden from the main view.</small></div>${table(['RowId','Source column','Table value','Common group key','Meaning'],model.rows.map((row,index)=>[row.rowId,'PS NO',cell(row,'PS NO'),model.baseRows[index]?.value||'',baseMeaning(cell(row,'PS NO'),model.baseRows[index]?.value)]))}</section>`;}
function renderClusterRows(model){const contract=clusterContract(model);if(!model.rows.length)return `<section class="table-categorized-stage-card"><h5>Coordinate Group Proof</h5><p>Load or paste a table first.</p></section>`;return `<section class="table-categorized-stage-card"><h5>Coordinate Group Proof</h5><div class="table-categorized-proof-note"><b>Selected fields:</b> X + Y + Z → Coordinate Group<small>Rows with nearby coordinates share one coordinate bucket. Unit ${esc(contract.unit||'mm')}, tolerance ${esc(contract.tolerance??'')}.</small></div>${table(['RowId','Item Key','X/Y/Z','Coordinate group','Status'],model.rows.map((row,index)=>[row.rowId,cell(row,'PS NO'),coordinateText(row,contract.axisMapping),model.clusterRows[index]?.value||'',statusText(model.clusterRows[index])]))}</section>`;}
function renderFamilyRows(model){if(!model.rows.length)return `<section class="table-categorized-stage-card"><h5>Final Group Proof</h5><p>Load or paste a table first.</p></section>`;return `<section class="table-categorized-stage-card"><h5>Final Group Proof</h5><div class="table-categorized-proof-note"><b>Final group = Common Group Key + Coordinate Group.</b><small>This is the parent group that will contain child items and details.</small></div>${table(['RowId','Item Key','Common group key','Coordinate group','Final group','Status'],model.rows.map((row,index)=>[row.rowId,cell(row,'PS NO'),model.baseRows[index]?.value||'',model.clusterRows[index]?.value||'',model.familyRows[index]?.value||'',statusText(model.familyRows[index])]))}${renderFamilySummary(model)}</section>`;}
function renderFamilySummary(model){const groups=new Map();model.familyRows.forEach((item,index)=>{const key=String(item?.value||'');if(!key)return;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(model.rows[index]);});if(!groups.size)return '<p>No final group key resolved yet.</p>';const rows=[...groups.entries()].map(([key,items])=>[key,items.length,items.map((row)=>cell(row,'DTXR')).filter(Boolean).join(', '),items.map((row)=>row.rowId).join(' ')]);return `<h5>Grouping Result</h5>${table(['Final Group','Rows','Types / Features','Source Rows'],rows)}`;}
function renderGraphStage(model){if(!model.graph)return `<section class="table-categorized-stage-card"><h5>Graph View</h5>${renderGraphPlaceholderSvg()}<p>Build the preview graph to see generated nodes and links.</p></section>`;const roots=(model.graph.nodes||[]).filter((node)=>!node.parentId);return `<section class="table-categorized-stage-card"><h5>Graph View</h5>${renderGraphFlowSvg(model)}<p>${(model.graph.nodes||[]).length} node(s), ${(model.graph.edges||[]).length} link(s).</p><div class="table-categorized-stage-tree">${roots.map((node)=>renderGraphNode(model.graph,node)).join('')}</div></section>`;}
function renderXmlStage(model){const xml=model.exportResult?.xmlText||'';if(!xml)return `<section class="table-categorized-stage-card"><h5>XML View</h5>${renderGraphPlaceholderSvg()}<p>Export after validation to preview XML generated from the graph.</p></section>`;return `<section class="table-categorized-stage-card"><h5>XML View</h5>${renderGraphFlowSvg(model)}<p>Preview only — generated from the graph.</p><pre class="table-categorized-xml-preview">${esc(snippet(xml))}</pre></section>`;}
function renderGraphFlowSvg(model){const familyNode=(model.graph?.nodes||[]).find((node)=>node.levelId==='supportFamily')||{};const occurrenceNode=(model.graph?.nodes||[]).find((node)=>node.levelId==='supportOccurrence')||{};const featureNode=(model.graph?.nodes||[]).find((node)=>node.levelId==='supportFeature')||{};return `<div class="table-categorized-stage-graphic"><svg class="graph-flow" viewBox="0 0 520 390" role="img" aria-label="Categorized graph hierarchy"><rect class="box-strong" x="150" y="20" width="220" height="54" rx="14"/><text class="label" x="174" y="51">Document</text><rect class="box" x="150" y="96" width="220" height="54" rx="14"/><text class="label" x="174" y="127">Model Split</text><text class="small" x="174" y="143">MODEL_SIDE</text><rect class="box-strong" x="150" y="172" width="220" height="62" rx="14"/><text class="label" x="174" y="202">Final Group</text><text class="small" x="174" y="220">${esc(familyNode.key||model.familyRows[0]?.value||'Group__C001')}</text><rect class="box" x="150" y="256" width="220" height="54" rx="14"/><text class="label" x="174" y="287">Child Item</text><text class="small" x="174" y="303">${esc(occurrenceNode.key||cell(model.rows[0],'PS NO')||'Item-001.1')}</text><rect class="box" x="150" y="332" width="220" height="44" rx="14"/><text class="label" x="174" y="360">Detail / Value</text><path class="line" d="M260 74 L260 96"/><path class="line" d="M260 150 L260 172"/><path class="line" d="M260 234 L260 256"/><path class="line" d="M260 310 L260 332"/><text class="tiny" x="380" y="206">${esc(featureNode.fields?.featureType||'type')}</text></svg></div>`;}
function renderGraphPlaceholderSvg(){return `<div class="table-categorized-stage-graphic"><svg viewBox="0 0 520 220" role="img" aria-label="Graph build placeholder"><rect class="box-warn" x="120" y="42" width="280" height="64" rx="14"/><text class="label" x="150" y="75">Graph not built yet</text><text class="small" x="150" y="96">Build Preview Graph to inspect nodes</text><path class="line-soft" d="M260 106 L260 166"/><rect class="box" x="150" y="166" width="220" height="36" rx="10"/><text class="small" x="178" y="189">XML export waits for graph</text></svg></div>`;}
function renderGraphNode(graph,node,depth=0){const fields=Object.entries(node.fields||{}).filter(([key])=>key!=='documentRoot').map(([key,value])=>`${key}=${Array.isArray(value)?value.join(' '):value}`).join(', ');const line=`${'  '.repeat(depth)}- ${node.levelType} ${node.key}${fields?` · ${fields}`:''}`;const children=graphChildren(graph,node.id).map((child)=>renderGraphNode(graph,child,depth+1)).join('');return `<pre>${esc(line)}</pre>${children}`;}
function renderStageDiagnostics(model){const rows=[];if(model.rows.length)rows.push(['INFO','rows_available',`${model.rows.length} preview row(s).`]);if(model.baseRows.some((row)=>String(row?.value||'')))rows.push(['INFO','common_group_key_found','Common group key produced values.']);if(model.clusterRows.some((row)=>String(row?.value||'')))rows.push(['INFO','coordinate_group_found','Coordinate group rule produced values.']);if(model.familyRows.some((row)=>String(row?.value||'')))rows.push(['INFO','final_group_found','Final group key preview is available.']);rows.push(...model.diagnostics.map((d)=>[d.severity||'WARNING',d.code||'preview_diagnostic',d.message||'Preview diagnostic.']));return `<section class="table-categorized-stage-diagnostics"><h5>Messages</h5>${rows.length?`<ul>${rows.map(([severity,code,message])=>`<li class="is-${esc(String(severity).toLowerCase())}"><b>${esc(severity)}</b> ${esc(code)} — ${esc(message)}</li>`).join('')}</ul>`:'<p>No preview messages.</p>'}</section>`;}
function resolverRows(rows,resolver,profile,sources,label){if(!resolver)return rows.map((row)=>Object.freeze({ok:false,value:'',diagnostics:Object.freeze([{severity:'INFO',code:'preview_rule_missing',message:`${label} rule is not configured.`,sourceRef:row.rowId}]),sourceRefs:Object.freeze([row.rowId])}));const context=createResolverContext({coordinateCluster:profile?.coordinateCluster||{},sources});return rows.map((row)=>runResolver(resolver,row,context));}
function familyKeyParts(resolver){const concat=findResolver(resolver,'concat');const parts=concat?.parts||[];return Object.freeze({baseResolver:parts.find((part)=>typeof part==='object'&&part.op!=='coordinateCluster')||findResolver(resolver,'regexExtract')||null,clusterResolver:parts.find((part)=>typeof part==='object'&&part.op==='coordinateCluster')||findResolver(resolver,'coordinateCluster')||null});}
function findResolver(resolver,op){if(!resolver||typeof resolver!=='object')return null;if(resolver.op===op)return resolver;if(resolver.input){const found=findResolver(resolver.input,op);if(found)return found;}for(const item of resolver.resolvers||[]){const found=findResolver(item,op);if(found)return found;}if(resolver.defaultResolver){const found=findResolver(resolver.defaultResolver,op);if(found)return found;}for(const part of resolver.parts||[])if(typeof part==='object'){const found=findResolver(part,op);if(found)return found;}return null;}
function findLevel(profile,levelId){let found=null;const walk=(levels=[])=>{for(const level of levels){if(level.levelId===levelId){found=level;return;}walk(level.children||[]);if(found)return;}};walk(profile?.levelDefinitions||[]);return found;}
function collectPreviewDiagnostics(groups){return groups.flatMap((items)=>items.flatMap((item)=>item?.diagnostics||[]));}
function preferredHeaders(headers){const preferred=['PS NO','Bore','pipe','DTXR','Support Gap','Mandatory','X','Y','Z'];const set=new Set(headers);return [...preferred.filter((header)=>set.has(header)),...headers.filter((header)=>!preferred.includes(header))].slice(0,9);}
function clusterContract(model){return model.clusterResolver?.contract||model.profile?.coordinateCluster||{};}
function coordinateText(row,axisMapping={x:'X',y:'Y',z:'Z'}){return [axisMapping.x||'X',axisMapping.y||'Y',axisMapping.z||'Z'].map((header)=>cell(row,header)).join('/');}
function cell(row,header){return row?.rawByHeader?.[header]??'';}
function statusText(result){return result?.ok===false?'⚠ check':'✓ ok';}
function baseMeaning(sourceValue,baseValue){if(!sourceValue&&!baseValue)return 'No value yet';if(sourceValue===baseValue)return 'Already a group key';return `${sourceValue} belongs under ${baseValue}`;}
function snippet(text){return String(text||'').split(/\r?\n/).slice(0,20).join('\n');}
function table(headers,rows){return `<div class="table-categorized-xml-scroll"><table><thead><tr>${headers.map((header)=>`<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map((row)=>`<tr>${row.map((value)=>`<td>${esc(value)}</td>`).join('')}</tr>`).join(''):'<tr><td colspan="99">No rows.</td></tr>'}</tbody></table></div>`;}
export const _test=Object.freeze({buildStagePreviewModel,familyKeyParts,preferredHeaders,previewStageForSetupTab,previewContextForSetupTab});
