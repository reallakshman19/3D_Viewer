import assert from 'node:assert/strict';
import { createXmlCompareNavigationState } from '../xml-compare/XmlCompareCanvasNavigation.js';
import { hoverXmlCompareCanvasRecord, selectXmlCompareCanvasRecord } from '../xml-compare/XmlCompareCanvasRecordInteraction.js';

const records=[{uid:'A-1',componentType:'PIPE',position:{x:0,y:0,z:0}},{uid:'A-2',componentType:'BEND',position:{x:1,y:0,z:0}}];
const nav=createXmlCompareNavigationState({side:'source'});
const hover=hoverXmlCompareCanvasRecord(nav,records,'A-2');
assert.equal(hover.navState.hoveredUid,'A-2');
assert.equal(hover.record.componentType,'BEND');
assert.equal(hover.log.code,'XML-COMPARE-CANVAS-HOVER');
const selected=selectXmlCompareCanvasRecord(nav,records,'A-1');
assert.equal(selected.navState.selectedUid,'A-1');
assert.equal(selected.record.componentType,'PIPE');
assert.equal(selected.log.code,'XML-COMPARE-CANVAS-SELECT');
console.log('xml-compare-canvas-record-interaction: all assertions passed');
