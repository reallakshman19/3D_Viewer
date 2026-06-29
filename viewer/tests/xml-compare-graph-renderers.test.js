import assert from 'node:assert/strict';

import { renderXmlCompareGraphCanvasHtml } from '../xml-compare/XmlCompareGraphCanvas.js';
import { renderXmlCompareGraphConnectorLaneHtml } from '../xml-compare/XmlCompareGraphConnectorLane.js';
import { createXmlCompareManualConnectorState, reduceXmlCompareManualConnectorState } from '../xml-compare/XmlCompareManualConnectorState.js';

const source={uid:'L-100::10',componentType:'NODE',nodeNumber:'10',nodeName:'Node 10',lineNo:'L-100',position:{x:0,y:0,z:0},points:[{x:0,y:0,z:0}]};
const target={uid:'L-100::10',componentType:'NODE',nodeNumber:'10',nodeName:'Node 10',lineNo:'L-100',position:{x:1000,y:500,z:0},points:[{x:1000,y:500,z:0}]};

let manualState=createXmlCompareManualConnectorState();
manualState=reduceXmlCompareManualConnectorState(manualState,{type:'PICK_SOURCE',record:source});
manualState=reduceXmlCompareManualConnectorState(manualState,{type:'PICK_TARGET',record:target});

const canvasHtml=renderXmlCompareGraphCanvasHtml({
  side:'source',
  title:'Source',
  data:{fileName:'A.xml',records:[source]},
  navState:{selectedUid:'L-100::10'},
  manualState
});

assert.match(canvasHtml,/data-xml-compare-graph-node/);
assert.match(canvasHtml,/L-100/);
assert.match(canvasHtml,/Node 10/);
assert.match(canvasHtml,/is-connected/);
assert.doesNotMatch(canvasHtml,/xml-compare-canvas-records/);

const laneHtml=renderXmlCompareGraphConnectorLaneHtml({manualState});
assert.match(laneHtml,/data-xml-compare-graph-connector-lane/);
assert.match(laneHtml,/MANUAL/);
assert.match(laneHtml,/Manual/);

console.log('xml-compare-graph-renderers: all assertions passed');
