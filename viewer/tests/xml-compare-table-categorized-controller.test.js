import assert from 'node:assert/strict';

import { createTableCategorizedDownloadArtifact, nextTableCategorizedNavigationState } from '../xml-compare/table-categorizer/table-categorized-xml-controller.js';
import { renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';

const loaded=nextTableCategorizedNavigationState({}, {type:'source-action',action:'load-sample'});
assert.equal(loaded.activeTab,'source');
assert.equal(loaded.sources.length,1);
assert.equal(loaded.sources[0].rows.length,6);

const graphState=nextTableCategorizedNavigationState(loaded,{type:'source-action',action:'build-graph'});
assert.equal(graphState.activeTab,'graph');
assert.ok(graphState.graph?.nodes?.length>0);
assert.ok(graphState.exportResult?.ok);

const xmlArtifact=createTableCategorizedDownloadArtifact(graphState,'xml');
assert.equal(xmlArtifact.ok,true);
assert.ok(xmlArtifact.text.includes('<CategorizedTableXml'));
assert.equal(createTableCategorizedDownloadArtifact(graphState,'bad-kind').ok,false);

const rendered=renderTableCategorizedXmlShellHtml({...graphState,activeStep:'preview'});
assert.ok(rendered.includes('Graph built:'));
assert.ok(rendered.includes('data-table-categorized-step="preview"'));

console.log('xml-compare-table-categorized-controller: guided shell compatibility assertions passed');
