import assert from 'node:assert/strict';
import { createXmlCompareTransferPreview } from '../xml-compare/XmlCompareTransferPreview.js';
import { renderXmlCompareTransferPreviewPanelHtml } from '../xml-compare/XmlCompareTransferPreviewPanel.js';
import { renderXmlCompareWorkspaceShellHtml } from '../xml-compare/XmlCompareWorkspaceShell.js';

const source={records:[{uid:'S1',nodeNumber:'10',dtxrPs:'PS-10',componentType:'ATTA'}]};
const target={records:[{uid:'T1',nodeNumber:'10',dtxrPs:'',componentType:'ATTA'}]};
const links=[{id:'L1',sourceUid:'S1',targetUid:'T1'}];
const preview=createXmlCompareTransferPreview({source,target,manualConnectors:links});
assert.equal(preview.schema,'xml-compare-transfer-preview/v1');
assert.equal(preview.summary.connectorCount,1);
assert.equal(preview.summary.previewCount,1);
assert.equal(preview.rows[0].field,'dtxrPs');
assert.equal(preview.rows[0].sourceValue,'PS-10');
assert.equal(preview.rows[0].status,'missing-target-value');

const panelHtml=renderXmlCompareTransferPreviewPanelHtml(preview);
assert.match(panelHtml,/Transfer Preview/);
assert.match(panelHtml,/PS-10/);
assert.match(panelHtml,/preview only/);

const shellHtml=renderXmlCompareWorkspaceShellHtml({source,target,manualConnectors:links});
assert.match(shellHtml,/data-xml-compare-transfer-preview/);
assert.match(shellHtml,/PS-10/);

console.log('xml-compare-transfer-preview: all assertions passed');
