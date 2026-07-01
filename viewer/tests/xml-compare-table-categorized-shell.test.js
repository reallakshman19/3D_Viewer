import assert from 'node:assert/strict';

import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { TABLE_CATEGORIZED_XML_BUTTON_ATTR, renderTableCategorizedXmlButtonHtml, renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

const button=renderTableCategorizedXmlButtonHtml();
assert.ok(button.includes('Table to Categorized XML'));
assert.ok(button.includes(TABLE_CATEGORIZED_XML_BUTTON_ATTR));

const shell=renderTableCategorizedXmlShellHtml();
assert.ok(shell.includes('Table to Categorized XML'));
assert.ok(shell.includes('Shadow-mode / preview-only'));
assert.ok(shell.includes('Source Setup'));
assert.ok(shell.includes('Level Designer'));
assert.ok(shell.includes('Graph Preview'));
assert.ok(shell.includes('Validation'));
assert.ok(shell.includes('Export / Link'));

const levelShell=renderTableCategorizedXmlShellHtml({activeTab:'levels'});
assert.ok(levelShell.includes('PS Mapping Table 2 Shadow Profile'));
assert.ok(levelShell.includes('SupportFamily'));
assert.ok(levelShell.includes('SupportOccurrence'));

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceName:'Table 2 - Model PS Data'});
const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const validationResults=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph});

const graphShell=renderTableCategorizedXmlShellHtml({activeTab:'graph',source,graph,validationResults});
assert.ok(graphShell.includes('PS-XYZ__C001'));
assert.ok(graphShell.includes('PS-XYZ.10'));
assert.ok(graphShell.includes('featureType=GUIDE'));
assert.ok(!graphShell.includes('CategorizedInputXML'));

const validationShell=renderTableCategorizedXmlShellHtml({activeTab:'validation',validationResults});
assert.ok(validationShell.includes('graph_has_single_document_root'));
assert.ok(validationShell.includes('required_columns_present'));

const exportShell=renderTableCategorizedXmlShellHtml({activeTab:'export'});
assert.ok(exportShell.includes('Disabled in Phase 3-5'));
assert.ok(exportShell.includes('Download XML'));
assert.ok(exportShell.includes('disabled'));
assert.ok(!exportShell.includes('CategorizedInputXML'));

console.log('xml-compare-table-categorized-shell: all assertions passed');
