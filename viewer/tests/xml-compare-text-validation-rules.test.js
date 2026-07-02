import assert from 'node:assert/strict';
import { normalizeTextMode } from '../xml-compare/XmlCompareTextValidationRules.js';
assert.equal(normalizeTextMode('unknown'),'exact-normalized');
console.log('xml-compare-text-validation-rules: all assertions passed');
