import assert from 'node:assert/strict';

import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { TABLE_CATEGORIZED_XML_BUTTON_ATTR, renderTableCategorizedXmlButtonHtml, renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';

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
assert.ok(!shell.includes('<CategorizedInputXML'));

const source=parseTableSource('PS NO\tBore\tGap\nPS-01\t4\t5',{sourceName:'Table 2 - Model PS Data'});
const parsedShell=renderTableCategorizedXmlShellHtml({source,sourceName:'Table 2 - Model PS Data'});
assert.ok(parsedShell.includes('S1:1'));
assert.ok(parsedShell.includes('PS NO'));
assert.ok(parsedShell.includes('PS-01'));
assert.ok(parsedShell.includes('delimiter=tab'));

const exportShell=renderTableCategorizedXmlShellHtml({activeTab:'export'});
assert.ok(exportShell.includes('Disabled in Phase 0-2'));
assert.ok(exportShell.includes('Download Categorized XML'));
assert.ok(exportShell.includes('disabled'));

console.log('xml-compare-table-categorized-shell: all assertions passed');
