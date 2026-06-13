import assert from 'node:assert/strict';
import { splitMatchedPreviewFacts, parseMatchedPreviewDiagnostics } from '../viewer/converters/xml-cii2019-core/sideload-matched-preview.js';

const sample = {
  matchedFacts: [
    { source: 'PREVIEW_JSON', itemType: 'RESTRAINT', basis: 'PS', key: 'PS-12248.5', resolvedNodeNumber: '430', value: 'LINESTOP', status: 'MATCHED' },
    { source: 'MANUAL_SIDELOAD', itemType: 'RESTRAINT', basis: 'POS', key: '430800.766 -1141125 1184.15', resolvedNodeNumber: '430', value: 'GUIDE', status: 'MATCHED' },
    { source: 'MANUAL_SIDELOAD', itemType: 'RESTRAINT', basis: 'PS', key: 'PS-Z-999', resolvedNodeNumber: '', value: 'REST', status: 'NOT_FOUND' },
    { source: 'MANUAL_SIDELOAD', itemType: '', basis: 'PS', key: 'PS-BAD', resolvedNodeNumber: '10', value: 'REST', status: 'MATCHED' },
  ],
  rejectedFacts: [
    { source: 'MANUAL_SIDELOAD', itemType: 'RESTRAINT', basis: 'NODE', key: '50', value: 'FooBar', status: 'INVALID_VALUE' },
  ],
};

const split = splitMatchedPreviewFacts(sample);
assert.equal(split.matchedFacts.length, 2, 'only resolved MATCHED facts with itemType enter Matched Preview');
assert.equal(split.rejectedFacts.length, 3, 'invalid/unresolved rows stay in diagnostics');
assert(split.matchedFacts.every((row) => row.status === 'MATCHED'));
assert(split.matchedFacts.every((row) => row.resolvedNodeNumber));

const parsed = parseMatchedPreviewDiagnostics(JSON.stringify(sample));
assert.equal(parsed.stats.matched, 2);
assert.equal(parsed.stats.rejected, 3);

console.log('PASS: XML CII matched preview filter keeps preview matched-only.');
