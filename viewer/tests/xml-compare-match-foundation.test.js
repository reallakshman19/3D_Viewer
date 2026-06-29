import assert from 'node:assert/strict';

import { createXmlCompareElementIndex } from '../xml-compare/XmlCompareElementIndex.js';
import { createXmlCompareMatchMap } from '../xml-compare/XmlCompareMatchMap.js';

const index = createXmlCompareElementIndex([
  { id: 'A', type: 'PIPE', points: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] },
]);
const map = createXmlCompareMatchMap();

assert.equal(index.summary.elementCount, 1);
assert.equal(map.summary.matchCount, 0);

console.log('xml-compare-match-foundation: all assertions passed');
