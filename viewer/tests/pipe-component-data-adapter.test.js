import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPipeDataWeightRows,
  pipeDataDimensionCandidates,
} from '../converters/xml-cii2019-core/pipe-component-data-adapter.js';
import { rankXmlCiiWeightCandidates } from '../converters/xml-cii2019-core/weight-valve-hints.js';

test('buildPipeDataWeightRows yields wtValveweights-shaped gate valve row', () => {
  const rows = buildPipeDataWeightRows();
  assert.ok(rows.length >= 1, 'expected at least one weight row');

  const gate = rows.find((row) => row.DN === 200 && Number(row.Rating) === 150);
  assert.ok(gate, 'expected DN 200 / Rating 150 gate valve row');
  assert.equal(gate['RF-F/F'], 292);
  assert.equal(gate['RF/RTJ KG'], 144);
  assert.equal(gate['RTJ F/F'], 305);
  assert.equal(gate['BW-F/F'], 419);
  assert.equal(gate.Type, 'GATE');
  assert.match(gate.TypeDesc, /GATE/);
  assert.equal(gate.__source, 'pipe-component-data');
  assert.ok(gate.__provenance && gate.__provenance.standard, 'provenance attached');
  assert.ok(gate.__provenance.datasetVersion, 'provenance datasetVersion attached');
});

test('rankXmlCiiWeightCandidates selects pipe-component-data gate valve weight', () => {
  const rows = buildPipeDataWeightRows();
  const config = { weight: { masterRows: rows } };
  const result = rankXmlCiiWeightCandidates(
    { boreMm: 203, rating: '150', lengthMm: 292, nodeName: 'VGT-1' },
    config
  );

  assert.ok(result.best, 'expected a best candidate');
  assert.ok(Math.abs(Number(result.best.selectedWeight) - 144) <= 1,
    `selectedWeight ${result.best.selectedWeight} not ≈ 144`);
  assert.equal(result.best.rowData.__source, 'pipe-component-data');
  assert.ok(result.best.semanticTier > 0, 'expected semantic valve-hint match');
});

test('pipeDataDimensionCandidates resolves 4in Sch40 pipe dimensions', () => {
  const hit = pipeDataDimensionCandidates({ nps: '4', schedule: '40' });
  assert.equal(hit.ok, true);
  assert.equal(hit.row.odMm, 114.3);
  assert.equal(hit.row.wallMm, 6.02);
  assert.ok(hit.provenance && hit.provenance.standard);
});

test('pipeDataDimensionCandidates flange lookup maps rating/facing aliases', () => {
  const hit = pipeDataDimensionCandidates({
    type: 'FLANGE',
    subtype: 'WN',
    nps: 4,
    rating: '300#',
    facing: 'RAISED',
  });
  assert.equal(hit.ok, true);
  assert.equal(hit.row.flangeOdMm, 255);
  assert.equal(hit.row.flangeThicknessMm, 30.2);
});

test('pipeDataDimensionCandidates misses cleanly without throwing', () => {
  const missing = pipeDataDimensionCandidates({ nps: '14', schedule: '40' });
  assert.equal(missing.ok, false);
  assert.ok(missing.code, 'expected a miss code');

  const empty = pipeDataDimensionCandidates({});
  assert.equal(empty.ok, false);
});
