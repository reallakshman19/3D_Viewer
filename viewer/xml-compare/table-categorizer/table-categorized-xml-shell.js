import { buildSourceSummary } from './table-categorized-xml-source-parser.js';

export const TABLE_CATEGORIZED_XML_SHELL_SCHEMA='table-categorized-xml-shell/v1';
export const TABLE_CATEGORIZED_XML_BUTTON_ATTR='data-xml-compare-table-categorized-open';
export const TABLE_CATEGORIZED_XML_POPUP_ATTR='data-xml-compare-table-categorized-popup';

export const TABLE_CATEGORIZED_XML_TABS=Object.freeze([
  ['source','Source Setup','Paste/import raw table only'],
  ['levels','Level Designer','Coming later'],
  ['graph','Graph Preview','Coming later'],
  ['validation','Validation','Coming later'],
  ['export','Export / Link','Disabled in this phase']
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

export function renderTableCategorizedXmlShellHtml({activeTab='source',sourceText='',sourceName='Pasted Source 1',source=null}={}){
  return `<div class="table-categorized-xml-backdrop" ${TABLE_CATEGORIZED_XML_POPUP_ATTR}>
    <section class="table-categorized-xml-dialog" role="dialog" aria-modal="true" aria-label="Table to Categorized XML">
      <header><div><h3>Table to Categorized XML</h3><p>Shadow-mode / preview-only universal table import. No graph or XML export is generated in Phase 0-2.</p></div><button type="button" data-table-categorized-close>Close</button></header>
      ${renderTabStrip(activeTab)}
      <main class="table-categorized-xml-body">${renderTabBody({activeTab,sourceText,sourceName,source})}</main>
      <footer><span>Phase 0-2: source setup shell and raw table preview only.</span><button type="button" data-table-categorized-close>Close</button></footer>
    </section>
  </div>`;
}

export function renderTabStrip(activeTab='source'){
  return `<nav class="table-categorized-xml-tabs" aria-label="Table categorizer workflow">${TABLE_CATEGORIZED_XML_TABS.map(([id,title,subtitle])=>`<button type="button" data-table-categorized-tab="${esc(id)}" class="${activeTab===id?'is-active':''}"><b>${esc(title)}</b><small>${esc(subtitle)}</small></button>`).join('')}</nav>`;
}

export function renderTabBody({activeTab='source',sourceText='',sourceName='Pasted Source 1',source=null}={}){
  if(activeTab==='source')return renderSourceSetup({sourceText,sourceName,source});
  if(activeTab==='export')return renderExportPlaceholder();
  return renderComingLaterPlaceholder(activeTab);
}

export function renderSourceSetup({sourceText='',sourceName='Pasted Source 1',source=null}={}){
  return `<section class="table-categorized-xml-card"><h4>Source Setup</h4><p>Paste a table and parse it into an ImportSource.v1-style raw source. Values stay raw; no resolver pipeline runs.</p>
    <label>Source Name<input data-table-categorized-source-name value="${esc(sourceName)}" placeholder="Table 2 - Model PS Data"></label>
    <label>Paste Table Text<textarea data-table-categorized-source-text placeholder="PS NO&#9;Bore&#9;Support Gap&#10;PS-01&#9;4&#9;5">${esc(sourceText)}</textarea></label>
    <div class="table-categorized-xml-actions"><label class="table-categorized-file">Import CSV/Table File<input type="file" accept=".csv,.txt,text/csv,text/plain" data-table-categorized-file></label><button type="button" data-table-categorized-action="parse">Parse Table</button><button type="button" data-table-categorized-action="clear">Clear</button></div>
    ${renderSourceList(source)}${renderRawPreview(source)}${renderDiagnostics(source)}
  </section>`;
}

export function renderSourceList(source){
  if(!source)return '<section class="table-categorized-xml-subcard"><h4>Parsed Sources</h4><p>No parsed source yet.</p></section>';
  const summary=buildSourceSummary(source);
  return `<section class="table-categorized-xml-subcard"><h4>Parsed Sources</h4><table><thead><tr><th>ID</th><th>Name</th><th>Rows</th><th>Columns</th><th>Status</th></tr></thead><tbody><tr><td>${esc(summary.sourceId)}</td><td>${esc(summary.sourceName)}</td><td>${summary.rows}</td><td>${summary.columns}</td><td>${esc(summary.status)}</td></tr></tbody></table></section>`;
}

export function renderRawPreview(source){
  if(!source?.headers?.length)return '<section class="table-categorized-xml-subcard"><h4>Raw Preview</h4><p>Parse a source to preview raw rows.</p></section>';
  const rows=(source.rows||[]).slice(0,50);
  const head=`<tr><th>Row</th>${source.headers.map((header)=>`<th>${esc(header)}</th>`).join('')}</tr>`;
  const body=rows.map((row)=>`<tr><td>${esc(row.rowId)}</td>${source.headers.map((_,index)=>`<td>${esc(row.rawCells[index]??'')}</td>`).join('')}</tr>`).join('');
  return `<section class="table-categorized-xml-subcard"><h4>Raw Preview</h4><div class="table-categorized-xml-scroll"><table><thead>${head}</thead><tbody>${body||'<tr><td>No rows parsed.</td></tr>'}</tbody></table></div></section>`;
}

export function renderDiagnostics(source){
  const diagnostics=source?.diagnostics||[];
  if(!diagnostics.length)return '<section class="table-categorized-xml-subcard"><h4>Diagnostics</h4><p>No diagnostics yet.</p></section>';
  const items=diagnostics.map((item)=>`<li class="is-${esc(item.severity).toLowerCase()}"><b>${esc(item.severity)}</b> ${esc(item.code)} — ${esc(item.message)}</li>`).join('');
  return `<section class="table-categorized-xml-subcard"><h4>Diagnostics</h4><ul>${items}</ul></section>`;
}

export function renderComingLaterPlaceholder(activeTab){
  return `<section class="table-categorized-xml-card"><h4>${esc(tabTitle(activeTab))}</h4><p>Coming in later phase — no graph generation yet.</p></section>`;
}

export function renderExportPlaceholder(){
  return `<section class="table-categorized-xml-card"><h4>Export / Link</h4><p>Disabled in Phase 0-2. XML export and canvas handoff will be implemented later.</p><div class="table-categorized-xml-actions"><button type="button" disabled>Send to SourceXML Canvas</button><button type="button" disabled>Send to TargetXML Canvas</button><button type="button" disabled>Download Categorized XML</button></div></section>`;
}

function tabTitle(activeTab){
  return TABLE_CATEGORIZED_XML_TABS.find(([id])=>id===activeTab)?.[1]||'Table to Categorized XML';
}

export const _test=Object.freeze({esc,tabTitle});
