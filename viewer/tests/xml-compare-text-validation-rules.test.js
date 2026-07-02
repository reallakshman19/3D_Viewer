import assert from 'node:assert/strict';
import { createDefaultTextRule, normalizeTextMode, normalizeTextValue } from '../xml-compare/XmlCompareTextValidationRules.js';
const rule=createDefaultTextRule('Name');
assert.equal(rule.mode,'exact-normalized');
assert.equal(normalizeTextMode('unknown'),'exact-normalized');
assert.equal(normalizeTextValue(' Hello    World ',{}),'hello world');
console.log('xml-compare-text-validation-rules: all assertions passed');
