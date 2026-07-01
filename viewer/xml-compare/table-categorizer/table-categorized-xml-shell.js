import { graphChildren } from './table-categorized-xml-graph-builder.js';
import { CREATION_MODE_OPTIONS, LEVEL_TYPE_OPTIONS, previewResolver } from './table-categorized-xml-profile-designer.js';
import { PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from './table-categorized-xml-pilot-profiles.js';
import { activeSource, sourceSummaryRows } from './table-categorized-xml-source-manager.js';
import { renderTableCategorizedStagePreview } from './table-categorized-xml-stage-preview.js';
import { hasBlockingValidation } from './table-categorized-xml-validation.js';

export const TABLE_CATEGORIZED_XML_SHELL_SCHEMA='table-categorized-xml-shell/v6';
export const TABLE_CATEGORIZED_XML_BUTTON_ATTR='data-xml-compare-table-categorized-open';
export const TABLE_CATEGORIZED_XML_POPUP_ATTR='data-xml-compare-table-categorized-popup';
export const TABLE_CATEGORIZED_XML_TABS=Object.freeze([
  ['source','Source Setup','Multi-source import'],
  ['levels','Level Designer','Editable profile'],
  ['graph','Graph Preview','Canonical graph'],
  ['validation','Validation','Gate results'],
  ['export','Export / Link','XML, JSON, audit, canvas']
]);

const esc=(value)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

export function renderTableCategorizedXmlButtonHtml(){
  return `<button type="button" class="xml-compare-table-categorized-btn" ${TABLE_CATEGORIZED_XML_BUTTON_ATTR}>Table to Categorized XML</button>`;
}

export function renderTableCategorizedXmlShellHtml(state={}){
  const view={activeTab:'source',sources:[],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,exportStatus:'',...state};
  return `<div class="table-categorized-xml-backdrop" ${TABLE_CATEGORIZED_XML_POPUP_ATTR}><section class="table-categorized-xml-dialog" role="dialog" aria-modal="true" aria-label="Table to Categorized XML"><header><div><h3>Table to Categorized XML</h3><p>Canonical graph is the master model. XML is one export artifact only.</p></div><button type="button" data-table-categorized-close>Close</button></header>${renderTabStrip(view.activeTab)}<main class="table-categorized-xml-body table-categorized-xml-with-preview"><section class="table-categorized-xml-workflow-pane">${renderTabBody(view)}</section>${renderTableCategorizedStagePreview(view)}</main><footer><span>Phase 10: dedicated stage preview pane for raw rows, grouping, graph, and XML snippets.</span><button type="button" data-table-categorized-close>Close</button></footer></section></div>`;
}

export function renderTabStrip(activeTab='source'){
  return `<nav class="table-categorized-xml-tabs" aria-label="Table categorizer workflow">${TABLE_CATEGORIZED_XML_TABS.map(([id,title,subtitle])=>`<button type="button" data-table-categorized-tab="${esc(id)}" class="${activeTab===id?'is-active':''}"><b>${esc(title)}</b><small>${esc(subtitle)}</small></button>`).join('')}</nav>`;
}

export function renderTabBody(view={}){
  if(view.activeTab==='source')return renderSourceSetup(view);
  if(view.activeTab==='levels')return renderLevelDesigner(view);
  if(view.activeTab==='graph')return renderGraphPreview(view.graph,view.validationResults);
  if(view.activeTab==='validation')return renderValidation(view.validationResults,view.exportResult);
  if(view.activeTab==='export')return renderExportLink(view);
  return renderLevelDesigner(view);
}

export function renderSourceSetup(view={}){
  const sources=view.sources?.length?view.sources:[view.source].filter(Boolean);
  const active=activeSource({sources,activeSourceId:view.activeSourceId})||view.source||{};
  return `<section class="table-categorized-xml-card"><h4>Source Setup</h4><p>Manage multiple ImportSource[] objects. Switching active source does not delete other parsed sources.</p>${renderSourceTable(sources,view.activeSourceId)}<div class="table-categorized-xml-actions"><button type="button" data-table-categorized-action="add-source">Add Source</button><button type="button" data-table-categorized-action="remove-source">Remove Source</button><button type="button" data-table-categorized-action="rename-source">Rename Source</button><button type="button" data-table-categorized-action="parse">Parse Active Source</button><button type="button" data-table-categorized-action="clear">Clear Active Source</button><button type="button" data-table-categorized-action="load-sample">Load PS Mapping Table 2 Sample</button><button type="button" data-table-categorized-action="load-coordinate-sample">Load Coordinate Lookup Sample</button><button type="button" data-table-categorized-action="build-graph" ${(sources||[]).some((s)=>s.rows?.length)?'':'disabled'}>Run Graph Build</button></div><section class="table-categorized-xml-subcard"><h4>Active source editor</h4><label>Source ID<select data-table-categorized-active-source>${sources.map((s)=>`<option ${s.sourceId===active.sourceId?'selected':''}>${esc(s.sourceId)}</option>`).join('')}</select></label><label>Source Name<input data-table-categorized-source-name value="${esc(active.sourceName||'')}"></label><label>Paste text<textarea data-table-categorized-source-text>${esc(active.sourceText||'')}</textarea></label><div class="table-categorized-xml-actions"><label class="table-categorized-file">Import CSV/Table File<input type="file" accept=".csv,.txt,text/csv,text/plain" data-table-categorized-file></label><button type="button" data-table-categorized-action="parse">Parse Active Source</button></div></section>${renderRawPreview(active)}${renderDiagnostics(active)}</section>`;
}

function renderSourceTable(sources=[],activeId=''){
  const rows=sourceSummaryRows(sources).map((s)=>`<tr class="${s.sourceId===activeId?'is-active':''}"><td>${esc(s.sourceId)}</td><td>${esc(s.sourceName)}</td><td>${s.rows}</td><td>${s.columns}</td><td>${esc(s.sourceType)}</td><td>${esc(s.status)}</td></tr>`).join('');
  return `<section class="table-categorized-xml-subcard"><h4>Parsed Sources</h4><table><thead><tr><th>ID</th><th>Source Name</th><th>Rows</th><th>Columns</th><th>Type</th><th>Status</th></tr></thead><tbody>${rows||'<tr><td colspan="6">No sources yet.</td></tr>'}</tbody></table></section>`;
}

export function renderLevelDesigner({profile=PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources=[],activeSourceId='S1',profileValidation=[]}={}){
  const root=profile.levelDefinitions?.[0]||{};
  const partition=root.children?.[0]||{};
  const sample=(sources[0]?.rows||[])[0]||null;
  return `<section class="table-categorized-xml-card"><h4>Level Designer</h4><p>Editable Universal Profile / Level Designer v1. Parent / Child / GrandChild are UI labels only; saved output remains recursive LevelDefinition[]. Use the Stage Preview pane to inspect raw rows, PS base grouping, coordinate clustering, final SupportFamily keys, graph output, and XML snippets.</p>${renderProfileHeader(profile)}${renderRootPartitionEditor(profile,sources)}${renderRootEditor(root,partition)}${renderLevelTabs('Parent',partition.children||[],['x','y','z'])}${renderLevelTabs('Child',partition.children?.[0]?.children||[],['a','b','c'])}${renderLevelTabs('GrandChild',partition.children?.[0]?.children?.[0]?.children||[],['a','b','c'])}${renderRecursiveList(profile)}${renderJoinEditor(profile,sources)}${renderResolverEditor(profile,sources,activeSourceId,sample)}${renderProfileValidation(profileValidation)}<div class="table-categorized-xml-actions"><button type="button" data-table-categorized-action="apply-profile">Apply Profile Changes</button><button type="button" data-table-categorized-action="build-graph" ${sources.some((s)=>s.rows?.length)?'':'disabled'}>Run Graph Build</button></div></section>`;
}

function renderProfileHeader(profile){
  return `<section class="table-categorized-xml-subcard"><h4>Profile header</h4><label>Profile Name<input data-profile-field="displayName" value="${esc(profile.displayName)}"></label><label>Profile ID<input data-profile-field="profileId" value="${esc(profile.profileId)}"></label><label>Template<select data-profile-template><option>Blank Universal Profile</option><option ${profile.profileId==='ps-mapping-table-2-shadow-profile'?'selected':''}>PS Mapping Table 2 Shadow Profile</option><option ${profile.profileId==='ps-mapping-table-2-coordinate-lookup-profile'?'selected':''}>PS Mapping Table 2 + Coordinate Lookup Profile</option></select></label><div class="table-categorized-xml-actions"><button type="button" data-table-categorized-action="new-blank-profile">New Blank Profile</button><button type="button" data-table-categorized-action="load-ps-template">Load PS Mapping Table 2 Template</button><button type="button" data-table-categorized-action="load-two-source-template">Load Two-Source Coordinate Template</button><label class="table-categorized-file">Import Profile JSON<input type="file" accept=".json,application/json" data-table-categorized-profile-file></label><button type="button" data-table-categorized-download="profile">Download Profile JSON</button><button type="button" data-table-categorized-action="reset-profile">Reset</button></div></section>`;
}

function renderRootPartitionEditor(profile,sources){
  return `<section class="table-categorized-xml-subcard"><h4>RootPartition section</h4><label>Partition Mode<select data-root-partition-mode><option ${profile.rootPartitionMode==='static'?'selected':''}>static</option><option ${profile.rootPartitionMode==='perSource'?'selected':''}>perSource</option><option ${profile.rootPartitionMode==='perColumn'?'selected':''}>perColumn</option><option ${profile.rootPartitionMode==='perResolver'?'selected':''}>perResolver</option></select></label><label>Static Partition Key<input data-root-partition-key value="${esc(profile.rootPartitions?.[0]?.key||'MODEL_SIDE')}"></label><label>Source Scope<input data-root-partition-scope value="${esc((profile.rootPartitions?.[0]?.sourceScope||sources.map((s)=>s.sourceId)).join(' '))}"></label><label>Partition Resolver<input value="${esc(profile.rootPartitionResolver?.column||'')}"></label></section>`;
}

function renderRootEditor(root,partition){
  return `<section class="table-categorized-xml-subcard"><h4>Root Level editor</h4><label>Root Name<input data-root-field="displayName" value="${esc(root.displayName||'CategorizedTableGraph')}"></label><label>Root XML Tag<input data-root-field="xmlTag" value="${esc(root.xmlTag||root.levelId||'CategorizedTableGraph')}"></label>${selectHtml('Root Level Type','data-root-field="levelType"',root.levelType,LEVEL_TYPE_OPTIONS)}${selectHtml('Root Creation Mode','data-root-field="creationMode"',root.creationMode,CREATION_MODE_OPTIONS)}<label><input type="checkbox" data-root-document ${root.documentRoot?'checked':''}> Document Root</label><label>Root Key<input data-root-field="key" value="${esc(root.key||'CategorizedTableGraph')}"></label><label>Parent (x) Name<input data-parent-name="0" value="${esc(labelForLevel(partition.children?.[0])||'Parent (x)')}"></label><label>Parent (y) Name<input data-parent-name="1" value="${esc(labelForLevel(partition.children?.[1])||'Parent (y)')}"></label><label>Parent (z) Name<input data-parent-name="2" value="${esc(labelForLevel(partition.children?.[2])||'Parent (z)')}"></label></section>`;
}

function renderLevelTabs(label,levels=[],tabs=[]){
  return `<section class="table-categorized-xml-subcard"><h4>${label} level editor</h4><div class="table-categorized-xml-actions">${tabs.map((tab)=>`<button type="button">${label} (${tab})</button>`).join('')}</div>${tabs.map((tab,index)=>renderLevelCard(`${label} (${tab})`,levels[index],index,label)).join('')}</section>`;
}

function renderLevelCard(title,level={},index,label){
  return `<div class="table-categorized-xml-subcard"><h4>${esc(title)}</h4><label>Level Name<input data-${label.toLowerCase()}-name="${index}" value="${esc(labelForLevel(level)||title)}"></label><label>XML Tag<input value="${esc(level.xmlTag||level.levelId||'')}"></label>${selectHtml('levelType','',level.levelType,LEVEL_TYPE_OPTIONS)}${selectHtml('creationMode','',level.creationMode,CREATION_MODE_OPTIONS)}<small>relationship to parent: owns</small><label>displayNameResolver sourceId.column<input value="${esc(resolverSummary(level.displayNameResolver)||'S1.PS NO')}"></label><label>keyResolver sourceId.column<input value="${esc(resolverSummary(level.keyResolver)||'S1.PS NO')}"></label><small>fieldResolvers placeholder — advanced editor later.</small><label>Next-level names only<input value="${esc((level.children||[]).map(labelForLevel).join(', '))}"></label></div>`;
}

function renderRecursiveList(profile){
  const rows=[];
  walk(profile.levelDefinitions||[],[],(level,path)=>{
    if(path.length>=4)rows.push(`<tr><td>${path.join(' > ')}</td><td>${esc(labelForLevel(level))}</td><td>${esc(level.levelType)}</td><td>${esc(level.creationMode)}</td><td>${esc(resolverSummary(level.keyResolver))}</td><td>Edit / Delete / Add Child</td></tr>`);
  });
  return `<section class="table-categorized-xml-subcard"><h4>Recursive Next Level editor</h4><table><thead><tr><th>Path</th><th>Level Name</th><th>Level Type</th><th>Creation Mode</th><th>Key Resolver Summary</th><th>Actions</th></tr></thead><tbody>${rows.join('')||'<tr><td colspan="6">No recursive next levels yet.</td></tr>'}</tbody></table></section>`;
}

function renderJoinEditor(profile,sources){
  const joins=profile.joins||[];
  return `<section class="table-categorized-xml-subcard"><h4>Joins section</h4><table><thead><tr><th>Join ID</th><th>Left Source</th><th>Left Column / Resolver</th><th>Right Source</th><th>Right Column / Resolver</th><th>Join Type</th><th>Duplicate Policy</th><th>Missing Policy</th></tr></thead><tbody>${joins.map((j)=>`<tr><td>${esc(j.joinId)}</td><td>${esc(j.leftSourceId)}</td><td>${esc(j.leftKeyResolver?.column)}</td><td>${esc(j.rightSourceId)}</td><td>${esc(j.rightKeyResolver?.column)}</td><td>${esc(j.joinType)}</td><td>${esc(j.duplicatePolicy)}</td><td>${esc(j.missingPolicy)}</td></tr>`).join('')||'<tr><td colspan="8">No joins defined.</td></tr>'}</tbody></table><small>Available sources: ${esc(sources.map((s)=>s.sourceId).join(', '))}</small></section>`;
}

function renderResolverEditor(profile,sources,activeSourceId,sample){
  const active=sources.find((s)=>s.sourceId===activeSourceId)||sources[0]||{};
  const cols=active.headers||['PS NO','X','Y','Z'];
  const preview=previewResolver(profile.levelDefinitions?.[0]?.children?.[0]?.children?.[0]?.keyResolver,sample);
  return `<section class="table-categorized-xml-subcard"><h4>Basic Resolver Editor</h4><label>Resolver source: Source ID<select data-resolver-source>${sources.map((s)=>`<option ${s.sourceId===activeSourceId?'selected':''}>${esc(s.sourceId)}</option>`).join('')||'<option>S1</option>'}</select></label><label>Column<select data-resolver-column>${cols.map((c)=>`<option>${esc(c)}</option>`).join('')}</select></label><label>Resolver operation<select data-resolver-op><option>literal</option><option selected>trim</option><option>uppercase</option><option>lowercase</option><option>regexExtract</option><option>concat</option><option>numberParser</option><option>classifier</option><option>coordinateCluster</option><option>fallback</option></select></label><label>concat ordered parts<input value="Column: S1.PS NO | Literal: __ | coordinateCluster S2.X/S2.Y/S2.Z"></label><label>coordinateCluster sourceId / X / Y / Z / unit / tolerance / rounding<input value="S2,X,Y,Z,mm,2,3"></label><p>Final key preview: <b>${esc(preview||'—')}</b></p></section>`;
}

function renderProfileValidation(items=[]){
  return items.length?`<section class="table-categorized-xml-subcard"><h4>Profile validation</h4><ul>${items.map((d)=>`<li class="is-${esc(d.severity).toLowerCase()}">${esc(d.severity)} ${esc(d.gate)} — ${esc(d.message)}</li>`).join('')}</ul></section>`:'';
}

export function renderGraphPreview(graph=null,validationResults=[]){
  if(hasBlockingValidation(validationResults))return `<section class="table-categorized-xml-card"><h4>Graph Preview</h4><p>Graph preview blocked by BLOCKER validation gate. Open Validation for details.</p></section>`;
  if(!graph)return `<section class="table-categorized-xml-card"><h4>Graph Preview</h4><p>Run Graph Build to create the canonical categorized graph.</p></section>`;
  const roots=(graph.nodes||[]).filter((node)=>!node.parentId);
  return `<section class="table-categorized-xml-card"><h4>Graph Preview</h4><p>Canonical categorized graph is the master model. Use Stage Preview → Graph for row-by-row inspector context.</p><div class="table-categorized-xml-actions"><button type="button" data-table-categorized-tab="export">Go to Export / Link</button></div><div class="table-categorized-xml-subcard">${roots.map((node)=>renderNodeTree(graph,node)).join('')}</div></section>`;
}

export function renderValidation(results=[],exportResult=null){
  if(!results.length)return `<section class="table-categorized-xml-card"><h4>Validation</h4><p>No validation results yet. Parse a source and run graph build.</p></section>`;
  const rows=results.map((item)=>`<tr class="is-${esc(item.severity).toLowerCase()}"><td>${esc(item.gate)}</td><td>${esc(item.severity)}</td><td>${esc(item.status)}</td><td>${esc(item.message)}</td><td>${esc(item.ref)}</td></tr>`).join('');
  const status=exportResult?.ok?'Export allowed.':'Export blocked or not generated.';
  return `<section class="table-categorized-xml-card"><h4>Validation</h4><p>${esc(status)}</p><table><thead><tr><th>Gate</th><th>Severity</th><th>Status</th><th>Message</th><th>Source/Graph Ref</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

export function renderExportLink(view={}){
  if(!view.graph)return `<section class="table-categorized-xml-card"><h4>Export / Link</h4><p>Run Pilot Graph Build first.</p></section>`;
  if(hasBlockingValidation(view.validationResults))return `<section class="table-categorized-xml-card"><h4>Export / Link</h4><p>Export blocked by validation.</p>${renderValidation(view.validationResults,view.exportResult)}</section>`;
  const enabled=Boolean(view.exportResult?.ok);
  const xml=enabled?view.exportResult.xmlText:'Export artifact is not available.';
  return `<section class="table-categorized-xml-card"><h4>Export / Link</h4><p>XML preview and artifact downloads are generated from the canonical graph only. Canvas handoff requires explicit click.</p>${view.exportStatus?`<div class="table-categorized-xml-subcard"><b>Status:</b> ${esc(view.exportStatus)}</div>`:''}<div class="table-categorized-xml-actions"><button type="button" data-table-categorized-action="send-source" ${enabled?'':'disabled'}>Send to SourceXML Canvas</button><button type="button" data-table-categorized-action="send-target" ${enabled?'':'disabled'}>Send to TargetXML Canvas</button><button type="button" data-table-categorized-download="xml" ${enabled?'':'disabled'}>Download Categorized XML</button><button type="button" data-table-categorized-download="graph" ${enabled?'':'disabled'}>Download Graph JSON</button><button type="button" data-table-categorized-download="profile" ${enabled?'':'disabled'}>Download Profile JSON</button><button type="button" data-table-categorized-download="diagnostics" ${enabled?'':'disabled'}>Download Diagnostics JSON</button><button type="button" data-table-categorized-download="audit" ${enabled?'':'disabled'}>Download Audit JSON</button></div><h4>XML Preview</h4><pre class="table-categorized-xml-preview">${esc(xml)}</pre></section>`;
}

export function renderRawPreview(source){
  if(!source?.headers?.length)return '<section class="table-categorized-xml-subcard"><h4>Raw Preview</h4><p>Parse active source to preview raw rows.</p></section>';
  const head=`<tr><th>Row</th>${source.headers.map((header)=>`<th>${esc(header)}</th>`).join('')}</tr>`;
  const body=(source.rows||[]).slice(0,50).map((row)=>`<tr><td>${esc(row.rowId)}</td>${source.headers.map((_,index)=>`<td>${esc(row.rawCells[index]??'')}</td>`).join('')}</tr>`).join('');
  return `<section class="table-categorized-xml-subcard"><h4>Raw Preview</h4><div class="table-categorized-xml-scroll"><table><thead>${head}</thead><tbody>${body||'<tr><td>No rows parsed.</td></tr>'}</tbody></table></div></section>`;
}

export function renderDiagnostics(source){
  const diagnostics=source?.diagnostics||[];
  if(!diagnostics.length)return '<section class="table-categorized-xml-subcard"><h4>Diagnostics</h4><p>No diagnostics yet.</p></section>';
  return `<section class="table-categorized-xml-subcard"><h4>Diagnostics</h4><ul>${diagnostics.map((item)=>`<li class="is-${esc(item.severity).toLowerCase()}"><b>${esc(item.severity)}</b> ${esc(item.code)} — ${esc(item.message)}</li>`).join('')}</ul></section>`;
}

function selectHtml(label,attr,value,options){return `<label>${esc(label)}<select ${attr}>${options.map((o)=>`<option ${o===value?'selected':''}>${esc(o)}</option>`).join('')}</select></label>`;}
function labelForLevel(level){return level?.displayName||level?.key||level?.levelId||'';}
function resolverSummary(r){return r?.op?`${r.sourceId?`${r.sourceId}.`:''}${r.column||r.op}`:'—';}
function walk(items,path,fn){items.forEach((level,index)=>{const p=[...path,index];fn(level,p);walk(level.children||[],p,fn);});}
function renderNodeTree(graph,node,depth=0){const fields=Object.entries(node.fields||{}).filter(([key])=>key!=='documentRoot').map(([key,value])=>`${key}=${Array.isArray(value)?value.join(' '):value}`).join(', ');const line=`${'  '.repeat(depth)}- ${node.levelType} ${node.key} · ${node.displayName} · refs: ${(node.sourceRefs||[]).join(', ')}${fields?` · ${fields}`:''}`;const children=graphChildren(graph,node.id).map((child)=>renderNodeTree(graph,child,depth+1)).join('');return `<pre class="table-categorized-xml-tree">${esc(line)}</pre>${children}`;}

export const _test=Object.freeze({esc});
