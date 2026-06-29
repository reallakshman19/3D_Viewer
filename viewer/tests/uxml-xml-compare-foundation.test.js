import assert from 'node:assert/strict';

import { createXmlCompareElementIndex } from '../xml-compare/XmlCompareElementIndex.js';
import { createXmlCompareMatchMap } from '../xml-compare/XmlCompareMatchMap.js';

assert.equal(createXmlCompareElementIndex([]).summary.elementCount, 0);
assert.equal(createXmlCompareMatchMap().summary.matchCount, 0);

console.log('uxml-xml-compare-foundation: all assertions passed');
