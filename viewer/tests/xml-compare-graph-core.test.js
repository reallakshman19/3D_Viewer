import assert from 'node:assert/strict';

import {
  createXmlCompareManualConnector,
  createXmlCompareManualConnectorState,
  reduceXmlCompareManualConnectorState
} from '../xml-compare/XmlCompareManualConnectorState.js';

import {
  createXmlCompareGraphNodeLayout
} from '../xml-compare/XmlCompareGraphLayout.js';

const source={uid:'A-1',componentType:'PIPE',nodeName:'Source Pipe'};
const target={uid:'B-1',componentType:'PIPE',nodeName:'Target Pipe'};

const connector=createXmlCompareManualConnector({sourceRecord:source,targetRecord:target});
assert.equal(connector.sourceUid,'A-1');
assert.equal(connector.targetUid,'B-1');
assert.equal(connector.locked,true);
assert.equal(connector.status,'manual-locked');
assert.equal(connector.confidence,1);

let state=createXmlCompareManualConnectorState();
state=reduceXmlCompareManualConnectorState(state,{type:'PICK_SOURCE',record:source});
assert.equal(state.pendingSourceUid,'A-1');
assert.equal(state.connectors.length,0);

state=reduceXmlCompareManualConnectorState(state,{type:'PICK_TARGET',record:target});
assert.equal(state.pendingSourceUid,'');
assert.equal(state.connectors.length,1);
assert.equal(state.selectedConnectorId,'manual:A-1=>B-1');

const duplicate=reduceXmlCompareManualConnectorState(state,{type:'PICK_TARGET',record:target});
assert.equal(duplicate.connectors.length,1);

const layout=createXmlCompareGraphNodeLayout({records:[source,target],side:'source'});
assert.equal(layout.length,2);
assert.equal(layout[0].uid,'A-1');
assert.ok(layout[0].x>=0&&layout[0].x<=100);
assert.ok(layout[0].y>=0&&layout[0].y<=100);

console.log('xml-compare-graph-core: all assertions passed');
