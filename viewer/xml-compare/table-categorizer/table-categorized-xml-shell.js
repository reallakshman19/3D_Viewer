import { buildSourceSummary } from './table-categorized-xml-source-parser.js';
import { graphChildren } from './table-categorized-xml-graph-builder.js';
import { CREATION_MODE_OPTIONS, LEVEL_TYPE_OPTIONS, previewResolver } from './table-categorized-xml-profile-designer.js';
import { PS_MAPPING_TABLE_2_SHADOW_PROFILE } from './table-categorized-xml-pilot-profiles.js';
import { hasBlockingValidation } from './table-categorized-xml-validation.js';

export const TABLE_CATEGORIZED_XML_SHELL_SCHEMA='table-categorized-xml-shell/v4';
export const TABLE_CATEGORIZED_XML_BUTTON_ATTR='data-xml-compare-table-categorized-open';
export const TABLE_CATEGORIZED_XML_POPUP_ATTR='data-xml-compare-table-categorized-popup';

export const TABLE_CATEGORIZED_XML_TABS=Object.freeze([
  ['source','Source Setup','Paste/import raw table only'],
  ['levels','Level Designer','Editable profile'],
  ['graph','Graph Preview','Canonical graph'],
  ['validation','Validation','Gate results'],
  ['export','Export / Link','XML, JSON, audit, canvas']
]);

const esc=(value)=>String(value??'')
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'",'&#039;');

export function renderTableCategorizedXmlButtonHtml(){
  return `<button type="button" class="xml-compare-table-categorized-btn" ${TABLE_CATEGORIZED_XML_BUTTON_ATTR}>Table to Categorized XML</button>`;
}

export function renderTableCategorizedXmlShellHtml(state={}){
  const view={activeTab:'source',sourceText:'',sourceName:'Pasted Source 1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,exportStatus:'',...state};
  return `<div class="table-categorized-xml-backdrop" ${TABLE_CATEGORIZED_XML_POPUP_ATTR}>
    <section class="table-categorized-xml-dialog" role="dialog" aria-modal="true" aria-label="Table to Categorized XML">
      <header><div><h3>Table to Categorized XML</h3><p>Canonical graph is the master model. XML is one export artifact only.</p></div><button type="button" data-table-categorized-close>Close</button></header>
      ${renderTabStrip(view.activeTab)}
      <main class="table-categorized-xml-body">${renderTabBody(view)}</main>
      <footer><span>Phase 8: editable universal profile designer v1.</span><button type="button" data-table-categorized-close>Close</button></footer>
    </section>
  </div>`;
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

export function renderSourceSetup({sourceText='',sourceName='Pasted Source 1',source=null}={}){
  return `<section class="table-categorized-xml-card"><h4>Source Setup</h4><p>Paste a table and parse it into raw ImportSource evidence. Resolver pipelines run only when graph build is requested.</p>
    <label>Source Name<input data-table-categorized-source-name value="${esc(sourceName)}" placeholder="Table 2 - Model PS Data"></label>
    <label>Paste Table Text<textarea data-table-categorized-source-text placeholder="PS NO&#9;Bore&#9;Support Gap&#10;PS-01&#9;4&#9;5">${esc(sourceText)}</textarea></label>
    <div class="table-categorized-xml-actions"><label class="table-categorized-file">Import CSV/Table File<input type="file" accept=".csv,.txt,text/csv,text/plain" data-table-categorized-file></label><button type="button" data-table-categorized-action="load-sample">Load Pilot Sample</button><button type="button" data-table-categorized-action="parse">Parse Table</button><button type="button" data-table-categorized-action="build-graph" ${source?'':'disabled'}>Run Graph Build</button><button type="button" data-table-categorized-tab="validation">View Validation</button><button type="button" data-table-categorized-tab="graph">View Graph Preview</button><button type="button" data-table-categorized-action="clear">Clear</button></div>
    ${renderSourceList(source)}${renderRawPreview(source)}${renderDiagnostics(source)}
  </section>`;
}

export function renderLevelDesigner({profile=PS_MAPPING_TABLE_2_SHADOW_PROFILE,source=null,profileValidation=[]}={}){
  const root=profile.levelDefinitions?.[0]||{};
  const partition=root.children?.[0]||{};
  const sample=source?.rows?.[0]||null;
  return `<section class="table-categorized-xml-card"><h4>Level Designer</h4><p>Editable Universal Profile / Level Designer v1. Parent / Child / GrandChild are UI labels only; saved output remains recursive LevelDefinition[].</p>
    ${renderProfileHeader(profile)}
    ${renderRootEditor(root,partition)}
    ${renderLevelTabs('Parent',partition.children||[],['x','y','z'])}
    ${renderLevelTabs('Child',partition.children?.[0]?.children||[],['a','b','c'])}
    ${renderLevelTabs('GrandChild',partition.children?.[0]?.children?.[0]?.children||[],['a','b','c'])}
    ${renderRecursiveList(profile)}
    ${renderResolverEditor(profile,source,sample)}
    ${renderProfileValidation(profileValidation)}
    <div class="table-categorized-xml-actions"><button type="button" data-table-categorized-action="apply-profile">Apply Profile Changes</button><button type="button" data-table-categorized-action="build-graph" ${source?'':'disabled'}>Run Graph Build</button></div>
  </section>`;
}

function renderProfileHeader(profile){
  return `<section class="table-categorized-xml-subcard"><h4>Profile header</h4><label>Profile Name<input data-profile-field="displayName" value="${esc(profile.displayName)}"></label><label>Profile ID<input data-profile-field="profileId" value="${esc(profile.profileId)}"></label><label>Template<select data-profile-template><option>Blank Universal Profile</option><option ${profile.profileId==='ps-mapping-table-2-shadow-profile'?'selected':''}>PS Mapping Table 2 Shadow Profile</option></select></label><div class="table-categorized-xml-actions"><button type="button" data-table-categorized-action="new-blank-profile">New Blank Profile</button><button type="button" data-table-categorized-action="load-ps-template">Load PS Mapping Table 2 Template</button><label class="table-categorized-file">Import Profile JSON<input type="file" accept=".json,application/json" data-table-categorized-profile-file></label><button type="button" data-table-categorized-download="profile">Download Profile JSON</button><button type="button" data-table-categorized-action="reset-profile">Reset</button></div></section>`;
}

function renderRootEditor(root,partition){
  return `<section class="table-categorized-xml-subcard"><h4>Root Level editor</h4><label>Root Name<input data-root-field="displayName" value="${esc(root.displayName||'CategorizedTableGraph')}"></label><label>Root XML Tag<input data-root-field="xmlTag" value="${esc(root.xmlTag||root.levelId||'CategorizedTableGraph')}"></label>${selectHtml('Root Level Type','data-root-field="levelType"',root.levelType,LEVEL_TYPE_OPTIONS)}${selectHtml('Root Creation Mode','data-root-field="creationMode"',root.creationMode,CREATION_MODE_OPTIONS)}<label><input type="checkbox" data-root-document ${root.documentRoot?'checked':''}> Document Root</label><label>Root Key<input data-root-field="key" value="${esc(root.key||'CategorizedTableGraph')}"></label><label>Parent (x) Name<input data-parent-name="0" value="${esc(labelForLevel(partition.children?.[0])||'Parent (x)')}"></label><label>Parent (y) Name<input data-parent-name="1" value="${esc(labelForLevel(partition.children?.[1])||'Parent (y)')}"></label><label>Parent (z) Name<input data-parent-name="2" value="${esc(labelForLevel(partition.children?.[2])||'Parent (z)')}"></label></section>`;
}

function renderLevelTabs(label,levels=[],tabs=[]){
  return `<section class="table-categorized-xml-subcard"><h4>${label} level editor</h4><div class="table-categorized-xml-actions">${tabs.map((tab)=>`<button type="button">${label} (${tab})</button>`).join('')}</div>${tabs.map((tab,index)=>renderLevelCard(`${label} (${tab})`,levels[index],index,label)).join('')}</section>`;
}

function renderLevelCard(title,level={},index,label){
  return `<div class="table-categorized-xml-subcard"><h4>${esc(title)}</h4><label>Level Name<input data-${label.toLowerCase()}-name="${index}" value="${esc(labelForLevel(level)||title)}"></label><label>XML Tag<input value="${esc(level.xmlTag||level.levelId||'')}"></label>${selectHtml('levelType','',level.levelType,LEVEL_TYPE_OPTIONS)}${selectHtml('creationMode','',level.creationMode,CREATION_MODE_OPTIONS)}<small>relationship to parent: owns</small><label>displayNameResolver column<input value="${esc(level.displayNameResolver?.column||'PS NO')}"></label><label>keyResolver column<input value="${esc(level.keyResolver?.column||'PS NO')}"></label><small>fieldResolvers placeholder — advanced editor later.</small><label>Next-level names only<input value="${esc((level.children||[]).map(labelForLevel).join(', '))}"></label></div>`;
}

function renderRecursiveList(profile){
  const rows=[];
  walk(profile.levelDefinitions||[],[],(level,path)=>{if(path.length>=4)rows.push(`<tr><td>${path.join(' > ')}</td><td>${esc(labelForLevel(level))}</td><td>${esc(level.levelType)}</td><td>${esc(level.creationMode)}</td><td>${esc(resolverSummary(level.keyResolver))}</td><td>Edit / Delete / Add Child</td></tr>`);});
  return `<section class="table-categorized-xml-subcard"><h4>Recursive Next Level editor</h4><table><thead><tr><th>Path</th><th>Level Name</th><th>Level Type</th><th>Creation Mode</th><th>Key Resolver Summary</th><th>Actions</th></tr></thead><tbody>${rows.join('')||'<tr><td colspan="6">No recursive next levels yet. Add Child from GrandChild in later UI increments.</td></tr>'}</tbody></table></section>`;
}

function renderResolverEditor(profile,source,sample){
  const cols=source?.headers||['PS NO','X','Y','Z'];
  const preview=previewResolver(profile.levelDefinitions?.[0]?.children?.[0]?.children?.[0]?.keyResolver,sample);
  return `<section class="table-categorized-xml-subcard"><h4>Basic Resolver Editor</h4><label>Resolver source: Source ID<input value="${esc(source?.sourceId||'S1')}"></label><label>Column<select data-resolver-column>${cols.map((c)=>`<option>${esc(c)}</option>`).join('')}</select></label><label>Resolver operation<select data-resolver-op><option>literal</option><option selected>trim</option><option>uppercase</option><option>lowercase</option><option>regexExtract</option><option>concat</option><option>numberParser</option><option>classifier</option><option>coordinateCluster</option><option>fallback</option></select></label><label>literal value<input data-resolver-literal value="MODEL_SIDE"></label><label>regexExtract pattern<input data-resolver-pattern value="^(.+?)\.\d+$"></label><label>group number<input data-resolver-group value="1"></label><label>fallback behavior<select><option>blank</option><option>full value</option></select></label><label>concat ordered parts<input value="Column: PS NO | Literal: __ | coordinateCluster"></label><label>classifier dictionary<textarea>GUIDE=GUIDE&#10;LINE STOP=LINE_STOP</textarea></label><label>coordinateCluster X/Y/Z/unit/tolerance/rounding<input value="X,Y,Z,mm,2,3"></label><p>Final key preview: <b>${esc(preview||'—')}</b></p></section>`;
}

function renderProfileValidation(items=[]){
  return items.length?`<section class="table-categorized-xml-subcard"><h4>Profile validation</h4><ul>${items.map((d)=>`<li class="is-${esc(d.severity).toLowerCase()}">${esc(d.severity)} ${esc(d.gate)} — ${esc(d.message)}</li>`).join('')}</ul></section>`:'';
}

export function renderGraphPreview(graph=null,validationResults=[]){
  if(hasBlockingValidation(validationResults))return `<section class="table-categorized-xml-card"><h4>Graph Preview</h4><p>Graph preview blocked by BLOCKER validation gate. Open Validation for details.</p></section>`;
  if(!graph)return `<section class="table-categorized-xml-card"><h4>Graph Preview</h4><p>Run Graph Build to create the canonical categorized graph.</p></section>`;
  const roots=(graph.nodes||[]).filter((node)=>!node.parentId);
  return `<section class="table-categorized-xml-card"><h4>Graph Preview</h4><p>Canonical categorized graph is the master model.</p><div class="table-categorized-xml-actions"><button type="button" data-table-categorized-tab="export">Go to Export / Link</button></div><div class="table-categorized-xml-subcard">${roots.map((node)=>renderNodeTree(graph,node)).join('')}</div></section>`;
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
  return `<section class="table-categorized-xml-card"><h4>Export / Link</h4><p>XML preview and artifact downloads are generated from the canonical graph only. Canvas handoff requires explicit click.</p>${view.exportStatus?`<div class="table-categorized-xml-subcard"><b>Status:</b> ${esc(view.exportStatus)}</div>`:''}<div class="table-categorized-xml-actions"><button type="button" data-table-categorized-action="send-source" ${enabled?'':'disabled'}>Send to SourceXML Canvas</button><button type="button" data-table-categorized-action="send-target" ${enabled?'':'disabled'}>Send to TargetXML Canvas</button><button type="button" data-table-categorized-download="xml" ${enabled?'':'disabled'}>Download Categorized XML</button><button type="button" data-table-categorized-download="graph" ${enabled?'':'disabled'}>Download Graph JSON</button><button type="button" data-table-categorized-download="profile">Download Profile JSON</button><button type="button" data-table-categorized-download="diagnostics" ${enabled?'':'disabled'}>Download Diagnostics JSON</button><button type="button" data-table-categorized-download="audit" ${enabled?'':'disabled'}>Download Audit JSON</button></div><h4>XML Preview</h4><pre class="table-categorized-xml-preview">${esc(xml)}</pre></section>`;
}

export function renderSourceList(source){
  if(!source)return '<section class="table-categorized-xml-subcard"><h4>Parsed Sources</h4><p>No parsed source yet.</p></section>';
  const summary=buildSourceSummary(source);
  return `<section class="table-categorized-xml-subcard"><h4>Parsed Sources</h4><table><thead><tr><th>ID</th><th>Name</th><th>Rows</th><th>Columns</th><th>Status</th></tr></thead><tbody><tr><td>${esc(summary.sourceId)}</td><td>${esc(summary.sourceName)}</td><td>${summary.rows}</td><td>${summary.columns}</td><td>${esc(summary.status)}</td></tr></tbody></table></section>`;
}

export function renderRawPreview(source){
  if(!source?.headers?.length)return '<section class="table-categorized-xml-subcard"><h4>Raw Preview</h4><p>Parse a source to preview raw rows.</p></section>';
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
function labelForLevel(level){return level?.displayName||level?.levelId||'';}
function resolverSummary(r){return r?.op?`${r.op}${r.column?`:${r.column}`:''}`:'—';}
function walk(items,path,fn){items.forEach((level,index)=>{const p=[...path,index];fn(level,p);walk(level.children||[],p,fn);});}
function renderNodeTree(graph,node,depth=0){const fields=Object.entries(node.fields||{}).filter(([key])=>key!=='documentRoot').map(([key,value])=>`${key}=${value}`).join(', ');const line=`${'  '.repeat(depth)}- ${node.levelType} ${node.key} · ${node.displayName} · refs: ${(node.sourceRefs||[]).join(', ')}${fields?` · ${fields}`:''}`;const children=graphChildren(graph,node.id).map((child)=>renderNodeTree(graph,child,depth+1)).join('');return `<pre class="table-categorized-xml-tree">${esc(line)}</pre>${children}`;}

export const _test=Object.freeze({esc});
