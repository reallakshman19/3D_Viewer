import assert from 'node:assert/strict';

import { renderXmlCompareGraphCanvasHtml } from '../xml-compare/XmlCompareGraphCanvas.js';
import { renderXmlCompareGraphConnectorLaneHtml } from '../xml-compare/XmlCompareGraphConnectorLane.js';
import { createXmlCompareManualConnectorState, reduceXmlCompareManualConnectorState } from '../xml-compare/XmlCompareManualConnectorState.js';

const source={uid:'A-1',componentType:'PIPE',nodeName:'Source Pipe'};
const target={uid:'B-1',componentType:'PIPE',nodeName:'Target Pipe'};

let manualState=createXmlCompareManualConnectorState();
manualState=reduceXmlCompareManualConnectorState(manualState,{type:'PICK_SOURCE',record:source});
manualState=reduceXmlCompareManualConnectorState(manualState,{type:'PICK_TARGET',record:target});

const canvasHtml=renderXmlCompareGraphCanvasHtml({
  side:'source',
  title:'Source',
  data:{fileName:'A.xml',records:[source]},
  navState:{selectedUid:'A-1'},
  manualState
});

assert.match(canvasHtml,/data-xml-compare-graph-node/);
assert.match(canvasHtml,/Source Pipe/);
assert.match(canvasHtml,/is-connected/);
assert.doesNotMatch(canvasHtml,/xml-compare-canvas-records/);

const laneHtml=renderXmlCompareGraphConnectorLaneHtml({manualState});
assert.match(laneHtml,/data-xml-compare-graph-connector-lane/);
assert.match(laneHtml,/MANUAL/);
assert.match(laneHtml,/Manual/);

console.log('xml-compare-graph-renderers: all assertions passed');
