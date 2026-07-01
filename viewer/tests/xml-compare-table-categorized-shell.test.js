import assert from 'node:assert/strict';

import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { createBlankUniversalProfile } from '../xml-compare/table-categorizer/table-categorized-xml-profile-designer.js';
import { PS_MAPPING_TABLE_2_SAMPLE, PS_MAPPING_TABLE_2_SHADOW_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { TABLE_CATEGORIZED_XML_BUTTON_ATTR, renderTableCategorizedXmlButtonHtml, renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

const button=renderTableCategorizedXmlButtonHtml();
assert.ok(button.includes('Table to Categorized XML'));
assert.ok(button.includes(TABLE_CATEGORIZED_XML_BUTTON_ATTR));

const shell=renderTableCategorizedXmlShellHtml();
assert.ok(shell.includes('Table to Categorized XML'));
assert.ok(shell.includes('Canonical graph is the master model'));
assert.ok(shell.includes('Source Setup'));
assert.ok(shell.includes('Level Designer'));
assert.ok(shell.includes('Graph Preview'));
assert.ok(shell.includes('Validation'));
assert.ok(shell.includes('Export / Link'));

const beforeExportShell=renderTableCategorizedXmlShellHtml({activeTab:'export'});
assert.ok(beforeExportShell.includes('Run Pilot Graph Build first.'));
assert.ok(!beforeExportShell.includes('data-table-categorized-action="send-source"'));

const levelShell=renderTableCategorizedXmlShellHtml({activeTab:'levels'});
assert.ok(levelShell.includes('Editable Universal Profile / Level Designer v1'));
assert.ok(levelShell.includes('Root Level editor'));
assert.ok(levelShell.includes('Parent level editor'));
assert.ok(levelShell.includes('Child level editor'));
assert.ok(levelShell.includes('GrandChild level editor'));
assert.ok(levelShell.includes('Recursive Next Level editor'));
assert.ok(levelShell.includes('Basic Resolver Editor'));
assert.ok(levelShell.includes('Download Profile JSON'));
assert.ok(levelShell.includes('SupportFamily'));
assert.ok(levelShell.includes('SupportOccurrence'));
assert.ok(!levelShell.includes('parentTabs'));

const blankLevelShell=renderTableCategorizedXmlShellHtml({activeTab:'levels',profile:createBlankUniversalProfile()});
assert.ok(blankLevelShell.includes('Blank Universal Profile'));
assert.ok(blankLevelShell.includes('Parent (x)'));

const source=parseTableSource(PS_MAPPING_TABLE_2_SAMPLE,{sourceName:'Table 2 - Model PS Data'});
const graph=buildCategorizedGraph(PS_MAPPING_TABLE_2_SHADOW_PROFILE,[source]);
const validationResults=runCategorizerValidation({profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,sources:[source],graph});
const exportResult=exportCategorizedGraphArtifacts({graph,profile:PS_MAPPING_TABLE_2_SHADOW_PROFILE,validationResults,sources:[source]});

const graphShell=renderTableCategorizedXmlShellHtml({activeTab:'graph',source,graph,validationResults});
assert.ok(graphShell.includes('PS-XYZ__C001'));
assert.ok(graphShell.includes('PS-XYZ.10'));
assert.ok(graphShell.includes('featureType=GUIDE'));
assert.ok(graphShell.includes('Go to Export / Link'));

const validationShell=renderTableCategorizedXmlShellHtml({activeTab:'validation',validationResults,exportResult});
assert.ok(validationShell.includes('graph_has_single_document_root'));
assert.ok(validationShell.includes('required_columns_present'));
assert.ok(validationShell.includes('Export allowed.'));

const exportShell=renderTableCategorizedXmlShellHtml({activeTab:'export',graph,validationResults,exportResult});
assert.ok(exportShell.includes('XML Preview'));
assert.ok(exportShell.includes('&lt;CategorizedTableXml'));
assert.ok(exportShell.includes('Download Categorized XML'));
assert.ok(exportShell.includes('Download Graph JSON'));
assert.ok(exportShell.includes('Download Profile JSON'));
assert.ok(exportShell.includes('Send to SourceXML Canvas'));
assert.ok(exportShell.includes('Send to TargetXML Canvas'));
assert.ok(!exportShell.includes('CategorizedInputXML'));

const blockedResults=[{gate:'required_columns_present',severity:'BLOCKER',status:'FAIL',message:'blocked',ref:''}];
const blockedShell=renderTableCategorizedXmlShellHtml({activeTab:'export',graph,validationResults:blockedResults,exportResult:null});
assert.ok(blockedShell.includes('Export blocked by validation.'));
assert.ok(!blockedShell.includes('Download Graph JSON'));

console.log('xml-compare-table-categorized-shell: all assertions passed');
