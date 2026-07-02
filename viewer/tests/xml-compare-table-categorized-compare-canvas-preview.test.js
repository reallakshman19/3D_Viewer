import assert from 'node:assert/strict';

import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { buildCompareCanvasGraphConnectors, createCompareCanvasSourceModel, createCompareCanvasTargetModel, createEmptyCompareCanvasState, importCompareCanvasTargetGraphFromText, previewConnectorRows, runCompareCanvasGraphCompare, summarizeCompareCanvasPreview, validateImportedTargetGraph } from '../tabs/xml-compare-table-categorized-runtime.js';

const requiredShellText=['PS Mapping Graph Compare Canvas Preview','Shadow preview','Use Current Graph as Source Canvas','Import Target Graph JSON','Use Imported Graph as Target Canvas','Run Graph Compare','Build Graph Connectors','Download Connector JSON','Clear Compare Canvas Preview','Source records','Target records','Mapped connectors','Mismatch connectors','Missing markers','Extra markers','Diagnostics'];
const exportShell=renderTableCategorizedXmlShellHtml({activeTab:'export',activeSetupTab:'output'});
for(const text of requiredShellText)assert.ok(exportShell.includes(text),`missing shell text: ${text}`);
const targetText=`PS NO\tBore\tpipe\tDTXR\tSupport Gap\tMandatory\tX\tY\tZ
PS-XYZ.1\tDN80\tLINE-A\tGUIDE\t25\tYES\t1000\t2000\t3000
PS-XYZ.2\tDN80\tLINE-A\tLINE STOP\t0\tYES\t1001\t2000\t3000
PS-XYZ.10\tDN80\tLINE-A\tGUIDE\t10\tYES\t1000.2\t2000\t3000
PS-XYZ.3\tDN80\tLINE-A\tGUIDE\t10\tYES\t1500\t2000\t3000
PS-ABC.1\tDN80\tLINE-A\tGUIDE\t10\tNO\t1000\t2000\t3000
PS-NEW.1\tDN80\tLINE-A\tGUIDE\t10\tYES\t3000\t2000\t3000`;
const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceId:'S1',sourceName:'Model Table 2'});
const target=parseTableSource(targetText,{sourceId:'S1',sourceName:'Reference Table 2'});
const sourceGraph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const targetGraph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[target]);
let compareCanvas=createEmptyCompareCanvasState();
compareCanvas=createCompareCanvasSourceModel(compareCanvas,sourceGraph);
assert.equal(compareCanvas.status,'Source canvas model created.');
assert.ok(compareCanvas.sourceCanvasModel.records.length>0);
const invalid=importCompareCanvasTargetGraphFromText(compareCanvas,'{"bad":true}','bad.json');
assert.equal(invalid.status,'Target graph import failed.');
assert.ok(invalid.diagnostics.some((diagnostic)=>diagnostic.code==='compare_canvas_target_json_invalid'));
const parseFailed=importCompareCanvasTargetGraphFromText(compareCanvas,'not-json','bad.json');
assert.equal(parseFailed.status,'Target graph import failed.');
assert.ok(parseFailed.diagnostics.some((diagnostic)=>diagnostic.code==='compare_canvas_target_json_parse_failed'));
compareCanvas=importCompareCanvasTargetGraphFromText(compareCanvas,JSON.stringify(targetGraph),'targetGraph.json');
assert.equal(compareCanvas.status,'Target graph imported.');
assert.equal(compareCanvas.importedTargetGraphName,'targetGraph.json');
assert.ok(validateImportedTargetGraph(compareCanvas.targetGraph));
compareCanvas=createCompareCanvasTargetModel(compareCanvas);
assert.equal(compareCanvas.status,'Target canvas model created.');
assert.ok(compareCanvas.targetCanvasModel.records.length>0);
compareCanvas=runCompareCanvasGraphCompare(compareCanvas);
assert.equal(compareCanvas.status,'Graph compare completed.');
assert.ok(compareCanvas.graphCompareResult.summary.mapped>0);
assert.ok(compareCanvas.graphCompareResult.mismatches.some((item)=>item.level==='Gap'&&item.path.includes('PS-XYZ.1_GUIDE/Gap')));
compareCanvas=buildCompareCanvasGraphConnectors(compareCanvas);
assert.equal(compareCanvas.status,'Graph connectors built.');
const rows=previewConnectorRows(compareCanvas);
assert.ok(rows.some((row)=>row.matchType==='MATCHED'));
assert.ok(rows.some((row)=>row.matchType==='MISMATCH'));
assert.ok(rows.some((row)=>row.matchType==='MISSING_IN_TARGET'));
assert.ok(rows.some((row)=>row.matchType==='EXTRA_IN_TARGET'));
assert.ok(rows.some((row)=>row.matchType==='MISMATCH'&&row.compareLevel==='Gap'&&row.sourceKey==='PS-XYZ.1_GUIDE_Gap'&&row.targetKey==='PS-XYZ.1_GUIDE_Gap'));
const summary=summarizeCompareCanvasPreview(compareCanvas);
assert.equal(summary.sourceRecords,compareCanvas.sourceCanvasModel.records.length);
assert.equal(summary.targetRecords,compareCanvas.targetCanvasModel.records.length);
assert.ok(summary.mappedConnectors>0);
assert.ok(summary.mismatchConnectors>0);
assert.ok(summary.missingMarkers>0);
assert.ok(summary.extraMarkers>0);
assert.ok(summary.diagnostics>0);
console.log('xml-compare-table-categorized-compare-canvas-preview: all assertions passed');
