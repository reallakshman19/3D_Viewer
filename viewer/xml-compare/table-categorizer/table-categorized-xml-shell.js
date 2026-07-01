import { buildSourceSummary } from './table-categorized-xml-source-parser.js';
import { graphChildren } from './table-categorized-xml-graph-builder.js';
import { PS_MAPPING_TABLE_2_SHADOW_PROFILE } from './table-categorized-xml-pilot-profiles.js';
import { hasBlockingValidation } from './table-categorized-xml-validation.js';

export const TABLE_CATEGORIZED_XML_SHELL_SCHEMA='table-categorized-xml-shell/v2';
export const TABLE_CATEGORIZED_XML_BUTTON_ATTR='data-xml-compare-table-categorized-open';
export const TABLE_CATEGORIZED_XML_POPUP_ATTR='data-xml-compare-table-categorized-popup';

export const TABLE_CATEGORIZED_XML_TABS=Object.freeze([
  ['source','Source Setup','Paste/import raw table only'],
  ['levels','Level Designer','Read-only pilot profile'],
  ['graph','Graph Preview','Canonical graph'],
  ['validation','Validation','Gate results'],
  ['export','Export / Link','Disabled in this phase']
]);

const esc=(value)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

export function renderTableCategorizedXmlButtonHtml(){
  return `<button type="button" class="xml-compare-table-categorized-btn" ${TABLE_CATEGORIZED_XML_BUTTON_ATTR}>Table to Categorized XML</button>`;
}

export function renderTableCategorizedXmlShellHtml(state={}){
  const view={activeTab:'source',sourceText:'',sourceName:'Pasted Source 1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,...state};
  return `<div class="table-categorized-xml-backdrop" ${TABLE_CATEGORIZED_XML_POPUP_ATTR}>
    <section class="table-categorized-xml-dialog" role="dialog" aria-modal="true" aria-label="Table to Categorized XML">
      <header><div><h3>Table to Categorized XML</h3><p>Shadow-mode / preview-only universal table import. No XML export or canvas handoff is generated in Phase 3-5.</p></div><button type="button" data-table-categorized-close>Close</button></header>
      ${renderTabStrip(view.activeTab)}
      <main class="table-categorized-xml-body">${renderTabBody(view)}</main>
      <footer><span>Phase 3-5: resolver engine, canonical graph preview, and validation gates only.</span><button type="button" data-table-categorized-close>Close</button></footer>
    </section>
  </div>`;
}

export function renderTabStrip(activeTab='source'){
  return `<nav class="table-categorized-xml-tabs" aria-label="Table categorizer workflow">${TABLE_CATEGORIZED_XML_TABS.map(([id,title,subtitle])=>`<button type="button" data-table-categorized-tab="${esc(id)}" class="${activeTab===id?'is-active':''}"><b>${esc(title)}</b><small>${esc(subtitle)}</small></button>`).join('')}</nav>`;
}

export function renderTabBody(view={}){
  if(view.activeTab==='source')return renderSourceSetup(view);
  if(view.activeTab==='levels')return renderLevelDesigner(view.profile);
  if(view.activeTab==='graph')return renderGraphPreview(view.graph,view.validationResults);
  if(view.activeTab==='validation')return renderValidation(view.validationResults);
  if(view.activeTab==='export')return renderExportPlaceholder();
  return renderLevelDesigner(view.profile);
}

export function renderSourceSetup({sourceText='',sourceName='Pasted Source 1',source=null}={}){
  return `<section class="table-categorized-xml-card"><h4>Source Setup</h4><p>Paste a table and parse it into raw ImportSource evidence. Resolver pipelines run only when the pilot graph build is requested.</p>
    <label>Source Name<input data-table-categorized-source-name value="${esc(sourceName)}" placeholder="Table 2 - Model PS Data"></label>
    <label>Paste Table Text<textarea data-table-categorized-source-text placeholder="PS NO&#9;Bore&#9;Support Gap&#10;PS-01&#9;4&#9;5">${esc(sourceText)}</textarea></label>
    <div class="table-categorized-xml-actions"><label class="table-categorized-file">Import CSV/Table File<input type="file" accept=".csv,.txt,text/csv,text/plain" data-table-categorized-file></label><button type="button" data-table-categorized-action="load-sample">Load Pilot Sample</button><button type="button" data-table-categorized-action="parse">Parse Table</button><button type="button" data-table-categorized-action="build-graph" ${source?'':'disabled'}>Run Pilot Graph Build</button><button type="button" data-table-categorized-tab="validation">View Validation</button><button type="button" data-table-categorized-tab="graph">View Graph Preview</button><button type="button" data-table-categorized-action="clear">Clear</button></div>
    ${renderSourceList(source)}${renderRawPreview(source)}${renderDiagnostics(source)}
  </section>`;
}

export function renderLevelDesigner(profile=PS_MAPPING_TABLE_2_SHADOW_PROFILE){
  return `<section class="table-categorized-xml-card"><h4>Level Designer</h4><p>Read-only built-in pilot profile. Full visual designer is a later phase.</p><div class="table-categorized-xml-subcard"><h4>${esc(profile.displayName)}</h4><pre class="table-categorized-xml-tree">CategorizedTableGraph
  RootPartition MODEL_SIDE
    SupportFamily
      SupportOccurrence
        SupportFeature
          Gap</pre></div></section>`;
}

export function renderGraphPreview(graph=null,validationResults=[]){
  if(hasBlockingValidation(validationResults))return `<section class="table-categorized-xml-card"><h4>Graph Preview</h4><p>Graph preview blocked by BLOCKER validation gate. Open Validation for details.</p></section>`;
  if(!graph)return `<section class="table-categorized-xml-card"><h4>Graph Preview</h4><p>Run Pilot Graph Build to create the canonical categorized graph. No XML is generated.</p></section>`;
  const roots=(graph.nodes||[]).filter((node)=>!node.parentId);
  return `<section class="table-categorized-xml-card"><h4>Graph Preview</h4><p>Canonical categorized graph is the master model. XML remains disabled.</p><div class="table-categorized-xml-subcard">${roots.map((node)=>renderNodeTree(graph,node)).join('')}</div></section>`;
}

export function renderValidation(results=[]){
  if(!results.length)return `<section class="table-categorized-xml-card"><h4>Validation</h4><p>No validation results yet. Parse a source and run the pilot graph build.</p></section>`;
  const rows=results.map((item)=>`<tr class="is-${esc(item.severity).toLowerCase()}"><td>${esc(item.gate)}</td><td>${esc(item.severity)}</td><td>${esc(item.status)}</td><td>${esc(item.message)}</td><td>${esc(item.ref)}</td></tr>`).join('');
  return `<section class="table-categorized-xml-card"><h4>Validation</h4><table><thead><tr><th>Gate</th><th>Severity</th><th>Status</th><th>Message</th><th>Source/Graph Ref</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

export function renderExportPlaceholder(){
  return `<section class="table-categorized-xml-card"><h4>Export / Link</h4><p>Disabled in Phase 3-5. XML export and canvas handoff are later phases.</p><div class="table-categorized-xml-actions"><button type="button" disabled>Send to SourceXML Canvas</button><button type="button" disabled>Send to TargetXML Canvas</button><button type="button" disabled>Download XML</button><button type="button" disabled>Download Categorized XML</button></div></section>`;
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

function renderNodeTree(graph,node,depth=0){
  const fields=Object.entries(node.fields||{}).filter(([key])=>key!=='documentRoot').map(([key,value])=>`${key}=${value}`).join(', ');
  const line=`${'  '.repeat(depth)}- ${node.levelType} ${node.key} · ${node.displayName} · refs: ${(node.sourceRefs||[]).join(', ')}${fields?` · ${fields}`:''}`;
  const children=graphChildren(graph,node.id).map((child)=>renderNodeTree(graph,child,depth+1)).join('');
  return `<pre class="table-categorized-xml-tree">${esc(line)}</pre>${children}`;
}

export const _test=Object.freeze({esc});
