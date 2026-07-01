import { graphChildren } from './table-categorized-xml-graph-builder.js';
import { CREATION_MODE_OPTIONS, LEVEL_TYPE_OPTIONS, previewResolver } from './table-categorized-xml-profile-designer.js';
import { PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from './table-categorized-xml-pilot-profiles.js';
import { activeSource, sourceSummaryRows } from './table-categorized-xml-source-manager.js';
import { renderTableCategorizedStagePreview } from './table-categorized-xml-stage-preview.js';
import { hasBlockingValidation } from './table-categorized-xml-validation.js';

export const TABLE_CATEGORIZED_XML_SHELL_SCHEMA='table-categorized-xml-shell/v10';
export const TABLE_CATEGORIZED_XML_BUTTON_ATTR='data-xml-compare-table-categorized-open';
export const TABLE_CATEGORIZED_XML_POPUP_ATTR='data-xml-compare-table-categorized-popup';
export const TABLE_CATEGORIZED_XML_TABS=Object.freeze([
  ['source','1 Import Table','Tables'],
  ['levels','2 Map Fields & Rules','Rules'],
  ['graph','3 Build Structure','Graph'],
  ['validation','4 Check','Quality'],
  ['export','5 Export','Files / Canvas']
]);
export const TABLE_CATEGORIZED_SETUP_TABS=Object.freeze([
  ['source','🟦 Source','Import settings and raw table rows'],
  ['fields','🟪 Fields','Column mapping and data types'],
  ['relationships','🟧 Relationships','Keys, joins, and parent-child links'],
  ['structure','🟨 Structure','Graph levels and hierarchy'],
  ['rules','🟫 Rules','Transform, filter, fallback, and grouping rules'],
  ['quality','🟨 Quality','Checks, warnings, and audit proof'],
  ['output','🟩 Output','XML, downloads, and canvas link'],
  ['recipe','⚙ Recipe','Save, load, version, and reuse mappings']
]);
const OPTION_GROUPS=Object.freeze([
  ['source','🟦','Source','Raw tables and starting recipe',[['✓','Source Table','headers, rows, source id'],['✓','Recipe / Preset','Table 2, two-source, blank']]],
  ['mapping','🟪','Mapping','How rows become graph data',[['●','Grouping Strategy','base key, coordinate group, both'],['✓','Column Mapping','primary key, type, value, coordinates'],['⚙','Rule Builder','trim, regex, concat, classifier, parser'],['⚙','Join Another Table','lookup / coordinate enrichment']]],
  ['structure','🟧','Structure','Shape of the categorized graph',[['⚙','Model Split','one model, per source, per column'],['⚙','Graph Structure','family, item, feature, value levels'],['⚙','More Nested Levels','parent → many children → many details']]],
  ['quality','🟨','Quality','Warnings, blockers, and audit proof',[['⚙','Checks','blockers, warnings, audit trail']]],
  ['output','🟩','Output','XML, graph JSON, profile JSON, audit',[['⚙','XML Names','tags, attributes, text values'],['⚙','Export','XML, graph JSON, profile JSON, audit']]]
]);

const esc=(value)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

export function setupTabForWorkflowTab(activeTab){
  if(activeTab==='source')return 'source';
  if(activeTab==='levels')return 'fields';
  if(activeTab==='graph')return 'structure';
  if(activeTab==='validation')return 'quality';
  if(activeTab==='export')return 'output';
  return 'fields';
}

export function renderTableCategorizedXmlButtonHtml(){
  return `<button type="button" class="xml-compare-table-categorized-btn" ${TABLE_CATEGORIZED_XML_BUTTON_ATTR}>Table to Categorized XML</button>`;
}

export function renderTableCategorizedXmlShellHtml(state={}){
  const view={activeTab:'source',sources:[],activeSourceId:'S1',profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,exportStatus:'',...state};
  view.activeSetupTab=state.activeSetupTab||setupTabForWorkflowTab(view.activeTab);
  return `<div class="table-categorized-xml-backdrop" ${TABLE_CATEGORIZED_XML_POPUP_ATTR}><section class="table-categorized-xml-dialog" role="dialog" aria-modal="true" aria-label="Table to Categorized XML"><header><div><h3>Table to Categorized XML</h3><p>Build a categorized graph from any table. XML is only one export from that graph.</p></div><button type="button" data-table-categorized-close>Close</button></header>${renderTabStrip(view.activeTab)}${renderSetupTabStrip(view.activeSetupTab)}<main class="table-categorized-xml-body table-categorized-xml-with-preview"><section class="table-categorized-xml-workflow-pane">${renderSetupTabBody(view)}</section>${renderTableCategorizedStagePreview(view)}</main><footer><span>Tabs guide the major workflow; collapsible panels keep each step simple.</span><button type="button" data-table-categorized-close>Close</button></footer></section></div>`;
}

export function renderTabStrip(activeTab='source'){
  return `<nav class="table-categorized-xml-tabs" aria-label="Table categorizer workflow">${TABLE_CATEGORIZED_XML_TABS.map(([id,title,subtitle])=>`<button type="button" data-table-categorized-tab="${esc(id)}" class="${activeTab===id?'is-active':''}"><b>${esc(title)}</b><small>${esc(subtitle)}</small></button>`).join('')}</nav>`;
}

export function renderSetupTabStrip(activeSetupTab='source'){
  const ids=new Set(TABLE_CATEGORIZED_SETUP_TABS.map(([id])=>id));
  const activeId=ids.has(activeSetupTab)?activeSetupTab:'source';
  return `<nav class="table-categorized-setup-tabs" aria-label="Table categorizer setup categories" role="tablist">${TABLE_CATEGORIZED_SETUP_TABS.map(([id,label,subtitle])=>`<button type="button" data-table-categorized-setup-tab="${esc(id)}" class="${activeId===id?'is-active':''}" aria-selected="${activeId===id?'true':'false'}" role="tab"><b>${esc(label)}</b><small>${esc(subtitle)}</small></button>`).join('')}</nav>`;
}

export function renderSetupTabBody(view={}){
  const setupTab=view.activeSetupTab||setupTabForWorkflowTab(view.activeTab);
  if(setupTab==='source')return renderSourceSetupPanels(view);
  if(setupTab==='fields')return renderFieldsSetupPanels(view);
  if(setupTab==='relationships')return renderRelationshipsSetupPanels(view);
  if(setupTab==='structure')return renderStructureSetupPanels(view);
  if(setupTab==='rules')return renderRulesSetupPanels(view);
  if(setupTab==='quality')return renderQualitySetupPanels(view);
  if(setupTab==='output')return renderOutputSetupPanels(view);
  if(setupTab==='recipe')return renderRecipeSetupPanels(view);
  return renderFieldsSetupPanels(view);
}

export function renderTabBody(view={}){
  return renderSetupTabBody({...view,activeSetupTab:view.activeSetupTab||setupTabForWorkflowTab(view.activeTab)});
}

export function renderSourceSetup(view={}){
  return renderSourceSetupPanels(view);
}

function renderSourceSetupPanels(view={}){
  const sources=view.sources?.length?view.sources:[view.source].filter(Boolean);
  const active=activeSource({sources,activeSourceId:view.activeSourceId})||view.source||{};
  const actions=`<div class="table-categorized-xml-actions"><button type="button" data-table-categorized-action="add-source">Add Table</button><button type="button" data-table-categorized-action="remove-source">Remove Table</button><button type="button" data-table-categorized-action="rename-source">Rename Table</button><button type="button" data-table-categorized-action="parse">Read Active Table</button><button type="button" data-table-categorized-action="clear">Clear Active Table</button><button type="button" data-table-categorized-action="load-sample">Load PS Mapping Table 2 Sample</button><button type="button" data-table-categorized-action="load-coordinate-sample">Load Coordinate Lookup Sample</button><button type="button" data-table-categorized-action="build-graph" ${(sources||[]).some((s)=>s.rows?.length)?'':'disabled'}>Build Preview Graph</button></div>`;
  const activeEditor=`<section class="table-categorized-xml-subcard"><h4>Active table</h4><label>Table ID<select data-table-categorized-active-source>${sources.map((s)=>`<option ${s.sourceId===active.sourceId?'selected':''}>${esc(s.sourceId)}</option>`).join('')}</select></label><label>Table Name<input data-table-categorized-source-name value="${esc(active.sourceName||'')}"></label><label>Paste table text<textarea data-table-categorized-source-text>${esc(active.sourceText||'')}</textarea></label><div class="table-categorized-xml-actions"><label class="table-categorized-file">Import CSV / TXT<input type="file" accept=".csv,.txt,text/csv,text/plain" data-table-categorized-file></label><button type="button" data-table-categorized-action="parse">Read Active Table</button></div></section>`;
  return setupBody('source','Import Table','Add one or more table sources. Parsed rows stay as evidence; graph nodes are created later.',panel('source','Source Tables','Add, select, paste, and read table data.',renderSourceTable(sources,view.activeSourceId)+actions+activeEditor,true)+panel('source','Parsed Rows','Raw table preview exactly as imported.',renderRawPreview(active),true)+panel('source','Source Messages','Parse warnings and input messages.',renderDiagnostics(active),false));
}

function renderFieldsSetupPanels({sources=[],activeSourceId='S1'}={}){
  return setupBody('fields','Fields','Map table columns to generic categorized graph roles. Full data typing is reserved for a later phase.',panel('fields','Column Mapping','Map table columns to generic graph roles.',renderColumnMappingSummary(sources,activeSourceId),true)+placeholderPanel('fields','Data Types / Units','Configure text, number, coordinate, and unit handling in a later phase.')+placeholderPanel('fields','Defaults / Blank Handling','Configure blank values, invalid values, and default fallbacks in a later phase.')+placeholderPanel('fields','Calculated Fields','Define derived columns and formulas in a later phase.'));
}

function renderRelationshipsSetupPanels({profile=PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources=[]}={}){
  return setupBody('relationships','Relationships','Define keys, joins, and parent-child links without changing graph generation logic in this phase.',placeholderPanel('relationships','Primary / Composite Keys','Configure primary, item, detail, and composite keys in a later phase.',true)+placeholderPanel('relationships','Parent / Child Links','Configure parent key, child key, foreign key, and cardinality in a later phase.')+panel('relationships','Join Another Table','Use another source table for coordinate or metadata lookup.',renderJoinEditor(profile,sources),false)+placeholderPanel('relationships','Duplicate / Missing Match Rules','Configure duplicate match, missing parent, and orphan row policies in a later phase.'));
}

function renderStructureSetupPanels({profile=PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources=[],graph=null,validationResults=[]}={}){
  const root=profile.levelDefinitions?.[0]||{};
  const partition=root.children?.[0]||{};
  const previewPanel=graph?panel('structure','Preview Graph','Document → model split → groups → items → details.',renderGraphPreviewBody(graph,validationResults),true):'';
  return setupBody('structure','Structure','Review the graph levels and hierarchy below the single document root.',previewPanel+panel('structure','Graph Structure','Edit the hierarchy without exposing every internal field at once.',renderRootEditor(root,partition)+renderLevelTabs('Parent',partition.children||[],['x','y','z'])+renderLevelTabs('Child',partition.children?.[0]?.children||[],['a','b','c'])+renderLevelTabs('GrandChild',partition.children?.[0]?.children?.[0]?.children||[],['a','b','c']),true)+panel('structure','Model Split','Choose how rows are divided below one document root.',renderRootPartitionEditor(profile,sources),false)+panel('structure','More Nested Levels','Supports parent → many children → many grandchildren structures.',renderRecursiveList(profile),false)+placeholderPanel('structure','Sort Order','Configure group, item, detail, numeric, natural, and custom sort ordering in a later phase.'));
}

function renderRulesSetupPanels({profile=PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources=[],activeSourceId='S1'}={}){
  const sample=(sources[0]?.rows||[])[0]||null;
  return setupBody('rules','Rules','Transform, group, filter, and classify values before they become graph data.',panel('rules','Rule Builder','Readable wrapper over resolver rules such as trim, regex, concat, classifier, and parser.',renderResolverEditor(profile,sources,activeSourceId,sample),true)+panel('rules','Grouping Strategy / Coordinate Grouping','Choose how rows become final groups.',renderGroupingSummary(profile),true)+placeholderPanel('rules','Filters / Conditions','Configure include rows, exclude rows, and create-node-only-when rules in a later phase.')+placeholderPanel('rules','Fallbacks','Configure if blank, if no match, and fallback value behavior in a later phase.')+placeholderPanel('rules','Classifiers','Configure dictionary mapping and type grouping in a later phase.'));
}

function renderQualitySetupPanels({validationResults=[],exportResult=null,profileValidation=[]}={}){
  return setupBody('quality','Check','Review required checks, warnings, validation settings, and audit proof.',renderValidationPanels(validationResults,exportResult)+placeholderPanel('quality','Validation Settings','Configure blocker, warning, and info severity mapping in a later phase.',false)+panel('quality','Setup Checks','Profile and mapping setup messages.',renderProfileValidation(profileValidation)||'<p>No setup messages.</p>',false));
}

function renderOutputSetupPanels(view={}){
  const output=renderOutputPanels(view);
  return setupBody('output','Export','Review XML names, output shape, downloads, and explicit canvas links.',output);
}

function renderRecipeSetupPanels({profile=PS_MAPPING_TABLE_2_SHADOW_PROFILE}={}){
  return setupBody('recipe','Recipe','Save, load, version, and reuse mappings without changing profile persistence in this phase.',panel('recipe','Recipe / Preset','Choose a starting recipe. This stays generic; PS Mapping Table 2 is only one preset.',renderProfileHeader(profile),true)+placeholderPanel('recipe','Save / Load Recipe','Save, load, duplicate, and reset reusable recipes in a later phase.')+placeholderPanel('recipe','Recipe Version / Notes','Track recipe version, description, and author notes in a later phase.')+placeholderPanel('recipe','Import / Export Recipe JSON','Import and export recipe JSON through the existing profile controls.'));
}

export function renderLevelDesigner(view={}){
  return renderFieldsSetupPanels(view);
}

function renderMappingOptionIndex(){
  return `<div class="table-categorized-option-groups">${OPTION_GROUPS.map(([group,icon,title,summary,items])=>`<section class="table-categorized-option-group is-${esc(group)}"><h5>${esc(icon)} ${esc(title)}</h5><p>${esc(summary)}</p>${items.map(([status,itemTitle,itemSummary])=>`<button type="button" class="table-categorized-option-chip"><b>${esc(status)} ${esc(itemTitle)}</b><small>${esc(itemSummary)}</small></button>`).join('')}</section>`).join('')}</div>`;
}

function renderProfileHeader(profile){
  return `<section class="table-categorized-xml-subcard"><h4>Recipe / Preset</h4><label>Recipe Name<input data-profile-field="displayName" value="${esc(profile.displayName)}"></label><label>Recipe ID <small>(advanced)</small><input data-profile-field="profileId" value="${esc(profile.profileId)}"></label><label>Start From<select data-profile-template><option>Blank Universal Profile</option><option ${profile.profileId==='ps-mapping-table-2-shadow-profile'?'selected':''}>PS Mapping Table 2 Shadow Profile</option><option ${profile.profileId==='ps-mapping-table-2-coordinate-lookup-profile'?'selected':''}>PS Mapping Table 2 + Coordinate Lookup Profile</option></select></label><div class="table-categorized-xml-actions"><button type="button" data-table-categorized-action="new-blank-profile">New Blank Recipe</button><button type="button" data-table-categorized-action="load-ps-template">Load PS Table 2 Recipe</button><button type="button" data-table-categorized-action="load-two-source-template">Load Two-Table Coordinate Recipe</button><label class="table-categorized-file">Import Recipe JSON<input type="file" accept=".json,application/json" data-table-categorized-profile-file></label><button type="button" data-table-categorized-download="profile">Download Recipe JSON</button><button type="button" data-table-categorized-action="reset-profile">Reset</button></div></section>`;
}

function renderGroupingSummary(profile){
  const tolerance=profile.coordinateCluster?.tolerance??2;
  return `<section class="table-categorized-xml-subcard"><h4>Grouping Strategy</h4><p>Group rows by base key, coordinate group, or both. The PS preset uses base key + coordinate group; custom recipes can use different columns and names.</p><label><input type="radio" name="table-categorized-grouping"> Base key only</label><label><input type="radio" name="table-categorized-grouping"> Coordinate group only</label><label><input type="radio" name="table-categorized-grouping" checked> Base key + coordinate group</label><label>Coordinate tolerance<input value="${esc(tolerance)}"></label></section>`;
}

function renderColumnMappingSummary(sources=[],activeSourceId='S1'){
  const active=sources.find((s)=>s.sourceId===activeSourceId)||sources[0]||{};
  const cols=active.headers||['PS NO','DTXR','Support Gap','X','Y','Z'];
  const pick=(label,preferred)=>`<label>${esc(label)}<select>${cols.map((c)=>`<option ${c===preferred?'selected':''}>${esc(c)}</option>`).join('')}</select></label>`;
  return `<section class="table-categorized-xml-subcard"><h4>Column Mapping</h4><p>Use generic roles so this works beyond PS tagging.</p>${pick('Primary item key','PS NO')}${pick('Type / feature','DTXR')}${pick('Value / measure','Support Gap')}${pick('X coordinate','X')}${pick('Y coordinate','Y')}${pick('Z coordinate','Z')}</section>`;
}

function renderRootPartitionEditor(profile,sources){
  return `<section class="table-categorized-xml-subcard"><h4>Model Split <small>(RootPartition)</small></h4><p>Choose how rows are divided below the single document root.</p><label>Split Method<select data-root-partition-mode><option ${profile.rootPartitionMode==='static'?'selected':''}>static</option><option ${profile.rootPartitionMode==='perSource'?'selected':''}>perSource</option><option ${profile.rootPartitionMode==='perColumn'?'selected':''}>perColumn</option><option ${profile.rootPartitionMode==='perResolver'?'selected':''}>perResolver</option></select></label><label>Single Bucket Key<input data-root-partition-key value="${esc(profile.rootPartitions?.[0]?.key||'MODEL_SIDE')}"></label><label>Tables Included<input data-root-partition-scope value="${esc((profile.rootPartitions?.[0]?.sourceScope||sources.map((s)=>s.sourceId)).join(' '))}"></label><label>Split By Column / Rule <small>(advanced)</small><input value="${esc(profile.rootPartitionResolver?.column||'')}"></label></section>`;
}

function renderRootEditor(root,partition){
  return `<section class="table-categorized-xml-subcard"><h4>Document Setup</h4><label>Document Name<input data-root-field="displayName" value="${esc(root.displayName||'CategorizedTableGraph')}"></label><label>Document XML Tag <small>(advanced)</small><input data-root-field="xmlTag" value="${esc(root.xmlTag||root.levelId||'CategorizedTableGraph')}"></label>${selectHtml('Node Kind <small>(advanced)</small>','data-root-field="levelType"',root.levelType,LEVEL_TYPE_OPTIONS)}${selectHtml('Create Node When <small>(advanced)</small>','data-root-field="creationMode"',root.creationMode,CREATION_MODE_OPTIONS)}<label><input type="checkbox" data-root-document ${root.documentRoot?'checked':''}> Single Document Root</label><label>Document Key<input data-root-field="key" value="${esc(root.key||'CategorizedTableGraph')}"></label><label>First Group Name (slot x)<input data-parent-name="0" value="${esc(labelForLevel(partition.children?.[0])||'Parent (x)')}"></label><label>First Group Name (slot y)<input data-parent-name="1" value="${esc(labelForLevel(partition.children?.[1])||'Parent (y)')}"></label><label>First Group Name (slot z)<input data-parent-name="2" value="${esc(labelForLevel(partition.children?.[2])||'Parent (z)')}"></label></section>`;
}

function renderLevelTabs(label,levels=[],tabs=[]){
  const friendly=levelGroupLabel(label);
  return `<section class="table-categorized-xml-subcard"><h4>${esc(friendly)} <small>(${esc(label)} level editor)</small></h4><div class="table-categorized-xml-actions">${tabs.map((tab)=>`<button type="button">${esc(friendly)} (${esc(tab)})</button>`).join('')}</div>${tabs.map((tab,index)=>renderLevelCard(`${friendly} (${tab})`,levels[index],index,label)).join('')}</section>`;
}

function renderLevelCard(title,level={},index,label){
  return `<div class="table-categorized-xml-subcard"><h4>${esc(title)}</h4><label>Group / Item Name<input data-${label.toLowerCase()}-name="${index}" value="${esc(labelForLevel(level)||title)}"></label><label>XML Tag <small>(advanced)</small><input value="${esc(level.xmlTag||level.levelId||'')}"></label>${selectHtml('What This Level Represents','',level.levelType,LEVEL_TYPE_OPTIONS)}${selectHtml('Create One Node For','',level.creationMode,CREATION_MODE_OPTIONS)}<small>Relationship: parent owns this level.</small><label>Display Text From Column / Rule<input value="${esc(resolverSummary(level.displayNameResolver)||'S1.PS NO')}"></label><label>Unique Key From Column / Rule<input value="${esc(resolverSummary(level.keyResolver)||'S1.PS NO')}"></label><small>Extra fields and values will be edited in the Rule Builder.</small><label>Child Level Names<input value="${esc((level.children||[]).map(labelForLevel).join(', '))}"></label></div>`;
}

function renderRecursiveList(profile){
  const rows=[];
  walk(profile.levelDefinitions||[],[],(level,path)=>{if(path.length>=4)rows.push(`<tr><td>${path.join(' > ')}</td><td>${esc(labelForLevel(level))}</td><td>${esc(level.levelType)}</td><td>${esc(level.creationMode)}</td><td>${esc(resolverSummary(level.keyResolver))}</td><td>Edit / Delete / Add Child</td></tr>`);});
  return `<section class="table-categorized-xml-subcard"><h4>More Nested Levels</h4><p>Use this for parent → many children → many grandchildren structures.</p><table><thead><tr><th>Path</th><th>Name</th><th>Kind</th><th>Create One For</th><th>Key Rule</th><th>Actions</th></tr></thead><tbody>${rows.join('')||'<tr><td colspan="6">No extra nested levels yet.</td></tr>'}</tbody></table></section>`;
}

function renderJoinEditor(profile,sources){
  const joins=profile.joins||[];
  return `<section class="table-categorized-xml-subcard"><h4>Join Another Table</h4><p>Use joins when coordinates or extra metadata are in another source table.</p><table><thead><tr><th>Join ID</th><th>Left Table</th><th>Left Key</th><th>Right Table</th><th>Right Key</th><th>Join Type</th><th>Duplicate Rule</th><th>Missing Rule</th></tr></thead><tbody>${joins.map((j)=>`<tr><td>${esc(j.joinId)}</td><td>${esc(j.leftSourceId)}</td><td>${esc(j.leftKeyResolver?.column)}</td><td>${esc(j.rightSourceId)}</td><td>${esc(j.rightKeyResolver?.column)}</td><td>${esc(j.joinType)}</td><td>${esc(j.duplicatePolicy)}</td><td>${esc(j.missingPolicy)}</td></tr>`).join('')||'<tr><td colspan="8">No table joins defined.</td></tr>'}</tbody></table><small>Available tables: ${esc(sources.map((s)=>s.sourceId).join(', '))}</small></section>`;
}

function renderResolverEditor(profile,sources,activeSourceId,sample){
  const active=sources.find((s)=>s.sourceId===activeSourceId)||sources[0]||{};
  const cols=active.headers||['PS NO','X','Y','Z'];
  const preview=previewResolver(profile.levelDefinitions?.[0]?.children?.[0]?.children?.[0]?.keyResolver,sample);
  return `<section class="table-categorized-xml-subcard"><h4>Rule Builder <small>(Resolver Rules)</small></h4><label>Rule Source Table<select data-resolver-source>${sources.map((s)=>`<option ${s.sourceId===activeSourceId?'selected':''}>${esc(s.sourceId)}</option>`).join('')||'<option>S1</option>'}</select></label><label>Column<select data-resolver-column>${cols.map((c)=>`<option>${esc(c)}</option>`).join('')}</select></label><label>Rule Type<select data-resolver-op><option>literal</option><option selected>trim</option><option>uppercase</option><option>lowercase</option><option>regexExtract</option><option>concat</option><option>numberParser</option><option>classifier</option><option>coordinateCluster</option><option>fallback</option></select></label><label>Combine Values In This Order<input value="Column: S1.PS NO | Literal: __ | coordinateCluster S2.X/S2.Y/S2.Z"></label><label>Coordinate Grouping Setup<input value="S2,X,Y,Z,mm,2,3"></label><p>Final key preview: <b>${esc(preview||'—')}</b></p></section>`;
}

function renderProfileValidation(items=[]){return items.length?`<section class="table-categorized-xml-subcard"><h4>Setup Checks</h4><ul>${items.map((d)=>`<li class="is-${esc(d.severity).toLowerCase()}">${esc(d.severity)} ${esc(d.gate)} — ${esc(d.message)}</li>`).join('')}</ul></section>`:'';}

export function renderGraphPreview(graph=null,validationResults=[]){
  if(hasBlockingValidation(validationResults))return `<section class="table-categorized-xml-card"><h4>Structure</h4><p>Graph preview is blocked by a failed rule. Open Check Rules for details.</p></section>`;
  const body=graph?renderGraphPreviewBody(graph,validationResults):'<p>Build Preview Graph to create the categorized graph.</p>';
  return setupBody('structure','Structure','This is the categorized graph that exports to XML.',panel('structure','Preview Graph','Document → model split → groups → items → details.',body,true)+panel('structure','Model Split','Advanced split settings are edited in Mapping Studio.',renderRootPartitionEditor(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[]),false));
}

function renderGraphPreviewBody(graph,validationResults=[]){
  if(hasBlockingValidation(validationResults))return '<p>Graph preview is blocked by a failed rule. Open Check Rules for details.</p>';
  const roots=(graph.nodes||[]).filter((node)=>!node.parentId);
  return `<p>This is the categorized graph that exports to XML. Use the live preview panel for row-by-row proof.</p><div class="table-categorized-xml-actions"><button type="button" data-table-categorized-tab="export">Go to Export / Link</button></div><div class="table-categorized-xml-subcard">${roots.map((node)=>renderNodeTree(graph,node)).join('')}</div>`;
}

export function renderValidation(results=[],exportResult=null){
  return setupBody('quality','Check','Review required checks, warnings, and audit proof.',renderValidationPanels(results,exportResult));
}

function renderValidationPanels(results=[],exportResult=null){
  if(!results.length)return `${panel('quality','Required Checks','No check results yet. Read a source table and build the preview graph.','<p>No check results yet.</p>',true)}${panel('quality','Warnings','Optional data and fallback messages appear here.','<p>No warnings yet.</p>',false)}${panel('quality','Audit Trail','Proof of how rows became graph nodes.','<p>Audit is generated with export.</p>',false)}`;
  const rows=results.map((item)=>`<tr class="is-${esc(item.severity).toLowerCase()}"><td>${esc(item.gate)}</td><td>${esc(item.severity)}</td><td>${esc(item.status)}</td><td>${esc(item.message)}</td><td>${esc(item.ref)}</td></tr>`).join('');
  const status=exportResult?.ok?'Export allowed.':'Export blocked or not generated.';
  return `${panel('quality','Required Checks',status,`<table><thead><tr><th>Rule / Gate</th><th>Severity</th><th>Status</th><th>Message</th><th>Source / Graph Ref</th></tr></thead><tbody>${rows}</tbody></table>`,true)}${panel('quality','Warnings','Review warning-level messages before export.','<p>Warnings are shown in the table above when present.</p>',false)}${panel('quality','Audit Trail','Download the audit JSON from Export.','<p>Audit package is produced with export artifacts.</p>',false)}`;
}

export function renderExportLink(view={}){
  return renderOutputSetupPanels(view);
}

function renderOutputPanels(view={}){
  if(!view.graph)return `${panel('output','XML Names','Tags, attributes, and text values are generated from the active recipe.','<p>Open XML preview to verify names before download.</p>',false)}${placeholderPanel('output','XML Shape','Configure attribute vs element, empty value policy, order, namespace, and schema version in a later phase.')}${panel('output','Download Files','Build Preview Graph first.','<p>Build Preview Graph first.</p>',true)}${panel('output','Canvas Link','Canvas handoff is disabled until export is ready.','<p>Not ready.</p>',false)}`;
  if(hasBlockingValidation(view.validationResults))return `${panel('quality','Blocked','Export is blocked by validation.',renderValidation(view.validationResults,view.exportResult),true)}`;
  const enabled=Boolean(view.exportResult?.ok);
  const xml=enabled?view.exportResult.xmlText:'Export artifact is not available.';
  const downloads=`<p>Exports are generated from the categorized graph only.</p>${view.exportStatus?`<div class="table-categorized-xml-subcard"><b>Status:</b> ${esc(view.exportStatus)}</div>`:''}<div class="table-categorized-xml-actions"><button type="button" data-table-categorized-download="xml" ${enabled?'':'disabled'}>Download Categorized XML</button><button type="button" data-table-categorized-download="graph" ${enabled?'':'disabled'}>Download Graph JSON</button><button type="button" data-table-categorized-download="profile" ${enabled?'':'disabled'}>Download Recipe JSON</button><button type="button" data-table-categorized-download="diagnostics" ${enabled?'':'disabled'}>Download Diagnostics JSON</button><button type="button" data-table-categorized-download="audit" ${enabled?'':'disabled'}>Download Audit JSON</button></div><h4>XML Preview</h4><pre class="table-categorized-xml-preview">${esc(xml)}</pre>`;
  const canvas=`<p>Canvas handoff requires an explicit click.</p><div class="table-categorized-xml-actions"><button type="button" data-table-categorized-action="send-source" ${enabled?'':'disabled'}>Send to SourceXML Canvas</button><button type="button" data-table-categorized-action="send-target" ${enabled?'':'disabled'}>Send to TargetXML Canvas</button></div>`;
  return `${panel('output','XML Names','Tags, attributes, and text values are generated from the active recipe.','<p>Open XML preview to verify names before download.</p>',false)}${placeholderPanel('output','XML Shape','Configure attribute vs element, empty value policy, order, namespace, and schema version in a later phase.')}${panel('output','Download Files','XML, graph JSON, recipe JSON, diagnostics, and audit.',downloads,true)}${panel('output','Canvas Link','Send generated XML to SourceXML or TargetXML canvas.',canvas,false)}`;
}

export function renderRawPreview(source){
  if(!source?.headers?.length)return '<section class="table-categorized-xml-subcard"><h4>Raw Table Preview</h4><p>Read the active table to preview raw rows.</p></section>';
  const head=`<tr><th>Row</th>${source.headers.map((header)=>`<th>${esc(header)}</th>`).join('')}</tr>`;
  const body=(source.rows||[]).slice(0,50).map((row)=>`<tr><td>${esc(row.rowId)}</td>${source.headers.map((_,index)=>`<td>${esc(row.rawCells[index]??'')}</td>`).join('')}</tr>`).join('');
  return `<section class="table-categorized-xml-subcard"><h4>Raw Table Preview</h4><div class="table-categorized-xml-scroll"><table><thead>${head}</thead><tbody>${body||'<tr><td>No rows parsed.</td></tr>'}</tbody></table></div></section>`;
}

export function renderDiagnostics(source){
  const diagnostics=source?.diagnostics||[];
  if(!diagnostics.length)return '<section class="table-categorized-xml-subcard"><h4>Messages</h4><p>No messages yet.</p></section>';
  return `<section class="table-categorized-xml-subcard"><h4>Messages</h4><ul>${diagnostics.map((item)=>`<li class="is-${esc(item.severity).toLowerCase()}"><b>${esc(item.severity)}</b> ${esc(item.code)} — ${esc(item.message)}</li>`).join('')}</ul></section>`;
}

function setupBody(group,title,summary,body){return `<section class="table-categorized-xml-card" data-setup-body="${esc(group)}"><h4>${esc(title)}</h4><p>${esc(summary)}</p>${body}</section>`;}
function placeholderPanel(group,title,summary,open=false){return panel(group,title,summary,`<p>${esc(summary)}</p>`,open);}
function panel(group,title,summary,body,open=false){return `<details class="table-categorized-panel is-${esc(group)}" data-panel-group="${esc(group)}" ${open?'open':''}><summary><b>${esc(title)}</b><small>${esc(summary)}</small></summary><div class="table-categorized-panel-body">${body}</div></details>`;}
function selectHtml(label,attr,value,options){return `<label>${label}<select ${attr}>${options.map((o)=>`<option ${o===value?'selected':''}>${esc(o)}</option>`).join('')}</select></label>`;}
function labelForLevel(level){return level?.displayName||level?.key||level?.levelId||'';}
function levelGroupLabel(label){if(label==='Parent')return 'First-Level Groups';if(label==='Child')return 'Child Items';if(label==='GrandChild')return 'Details / Values';return label;}
function resolverSummary(r){return r?.op?`${r.sourceId?`${r.sourceId}.`:''}${r.column||r.op}`:'—';}
function walk(items,path,fn){items.forEach((level,index)=>{const p=[...path,index];fn(level,p);walk(level.children||[],p,fn);});}
function renderNodeTree(graph,node,depth=0){const fields=Object.entries(node.fields||{}).filter(([key])=>key!=='documentRoot').map(([key,value])=>`${key}=${Array.isArray(value)?value.join(' '):value}`).join(', ');const line=`${'  '.repeat(depth)}- ${node.levelType} ${node.key} · ${node.displayName} · refs: ${(node.sourceRefs||[]).join(', ')}${fields?` · ${fields}`:''}`;const children=graphChildren(graph,node.id).map((child)=>renderNodeTree(graph,child,depth+1)).join('');return `<pre class="table-categorized-xml-tree">${esc(line)}</pre>${children}`;}

export const _test=Object.freeze({esc,levelGroupLabel,panel,setupBody});
