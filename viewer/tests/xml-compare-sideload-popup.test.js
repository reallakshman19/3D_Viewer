import assert from 'node:assert/strict';

import { renderXmlCompareSideloadPopupHtml } from '../xml-compare/XmlCompareSideloadPopup.js';

assert.equal(renderXmlCompareSideloadPopupHtml({open:false}),'');
const html=renderXmlCompareSideloadPopupHtml({open:true,side:'a',lastReport:{lineIdRows:1,lineIdsApplied:1,nodeNameRows:1,nodeNamesApplied:1,tagRows:1,tagsApplied:1}});

assert.match(html,/Sideload XML enrichment/);
assert.match(html,/lineIdText/);
assert.match(html,/nodeNameText/);
assert.match(html,/restraintTagText/);
assert.match(html,/apply-sideload/);
assert.match(html,/export-sideload/);
assert.match(html,/Restraint tags applied/);

console.log('xml-compare-sideload-popup: all assertions passed');
