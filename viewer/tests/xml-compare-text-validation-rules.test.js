import assert from 'node:assert/strict';
import { normalizeTextMode, normalizeTextValue } from '../xml-compare/XmlCompareTextValidationRules.js';
assert.equal(normalizeTextMode('unknown'),'exact-normalized');
assert.equal(normalizeTextValue(' Hello    World ',{}),'hello world');
console.log('xml-compare-text-validation-rules: all assertions passed');
