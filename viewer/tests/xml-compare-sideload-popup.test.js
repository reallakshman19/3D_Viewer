import assert from 'node:assert/strict';

import { renderXmlCompareSideloadPopupHtml } from '../xml-compare/XmlCompareSideloadPopup.js';

assert.equal(renderXmlCompareSideloadPopupHtml({open:false}),'');
const html=renderXmlCompareSideloadPopupHtml({open:true,side:'a',coordinateText:'10\t23227.580\t3257.150\t-19800.000',lastReport:{lineIdRows:1,lineIdsApplied:1,nodeNameRows:1,nodeNamesApplied:1,tagRows:1,tagsApplied:1,coordinateRows:1,coordinatesApplied:2,coordinateNodesResolved:3,coordinateDiagnostics:0}});

assert.match(html,/Sideload XML enrichment/);
assert.match(html,/lineIdText/);
assert.match(html,/nodeNameText/);
assert.match(html,/restraintTagText/);
assert.match(html,/coordinateText/);
assert.match(html,/Table 4 — Node Global Coordinates/);
assert.match(html,/Node    Global X    Global Y    Global Z/);
assert.match(html,/Global coordinates applied/);
assert.match(html,/Coordinate nodes resolved/);
assert.match(html,/Coordinate diagnostics/);
assert.match(html,/apply-sideload/);
assert.match(html,/export-sideload/);
assert.match(html,/Restraint tags applied/);

console.log('xml-compare-sideload-popup: all assertions passed');
