import assert from 'node:assert/strict';
import { createXmlCompareMatchMap } from '../xml-compare/XmlCompareMatchMap.js';
import { createXmlCompareConnectorOverlayModel, renderXmlCompareConnectorOverlayHtml } from '../xml-compare/XmlCompareConnectorOverlay.js';
import { renderXmlCompareWorkspaceShellHtml } from '../xml-compare/XmlCompareWorkspaceShell.js';

const matchMap=createXmlCompareMatchMap({matches:[{sourceUid:'A-1',targetUid:'B-1',basis:['manual'],confidence:1,status:'manual',orientation:'same'}]});
const model=createXmlCompareConnectorOverlayModel({matchMap});
assert.equal(model.summary.matchCount,1);
assert.equal(model.links[0].sourceUid,'A-1');
assert.equal(model.links[0].targetUid,'B-1');
const html=renderXmlCompareConnectorOverlayHtml({matchMap});
assert.match(html,/data-xml-compare-connector-overlay/);
assert.match(html,/data-xml-compare-connector="A-1-&gt;B-1"/);
assert.match(html,/manual/);
const shell=renderXmlCompareWorkspaceShellHtml({source:{summary:{nodeCount:1}},target:{summary:{nodeCount:1}},matchMap});
assert.match(shell,/data-xml-compare-connector-overlay/);
console.log('xml-compare-connector-overlay: all assertions passed');
