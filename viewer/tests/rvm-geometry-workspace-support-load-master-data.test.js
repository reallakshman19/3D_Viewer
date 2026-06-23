import {
  buildSupportLoadMasterDataSummary,
  DEFAULT_SUPPORT_LOAD_MASTER_DATA,
  normalizeSupportLoadMasterData,
  resolveDepSpan,
  resolveHydroDensity,
  resolveMaterialDensity,
  resolveNpsFromOd,
  resolvePipeWeight,
  SUPPORT_LOAD_MASTER_DATA_SCHEMA
} from '../geometry-workspace/GeometrySupportLoadMasterData.js';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}
function near(actual, expected, tolerance, label) {
  const value = Number(actual);
  check(Number.isFinite(value) && Math.abs(value - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

const masterData = normalizeSupportLoadMasterData({
  name: 'Project support-load masters',
  depSpanRows: [
    { nps: 8, pipeOdMm: 219.075, depSpanMm: 10750, source: 'PROJECT_DEP_SPAN' }
  ],
  materialDensityRows: [
    { key: 'LT', aliases: ['LOW_TEMP'], densityKgM3: 7850, source: 'PROJECT_MATERIAL' }
  ],
  pipeWeightRows: [
    { nps: 8, pipeOdMm: 219.075, wallThicknessMm: 12.7, materialCategory: 'LT', unitPipeWtKgPerM: 67.25, source: 'PROJECT_PIPE_WEIGHT' }
  ],
  hydroProfiles: [
    { id: 'WATER_HYDROTEST', densityKgM3: 1000, source: 'PROJECT_HYDRO' }
  ],
  formulaProfile: {
    roundStep: 50,
    roundMajor: 100,
    roundMode: 'up',
    gravityFactor: 10,
    verticalLoadFactor: 1.1
  }
});

check(masterData.schema === SUPPORT_LOAD_MASTER_DATA_SCHEMA, 'master data normalises to schema');
check(masterData.depSpanRows.some(row => row.nps === 8 && row.depSpanMm === 10750), 'DEP span table retains NPS 8 benchmark row');
check(resolveNpsFromOd(masterData, 219.1) === 8, 'NPS resolves from near OD');
check(resolveDepSpan(masterData, { nps: 8 })?.depSpanMm === 10750, 'DEP span resolves by NPS');
near(resolveMaterialDensity(masterData, { materialCategory: 'LT' })?.densityKgM3, 7850, 0.001, 'material density resolves by material category');
near(resolvePipeWeight(masterData, { nps: 8, pipeOdMm: 219.075, wallThicknessMm: 12.7, materialCategory: 'LT' })?.unitPipeWtKgPerM, 67.25, 0.001, 'pipe weight resolves from controlled pipe-weight table');
near(resolveHydroDensity(masterData)?.densityKgM3, 1000, 0.001, 'active hydro profile resolves density');

const summary = buildSupportLoadMasterDataSummary(masterData);
check(summary.depSpanRowCount >= DEFAULT_SUPPORT_LOAD_MASTER_DATA.depSpanRows.length, 'summary includes default plus project DEP span rows');
check(summary.pipeWeightRowCount === 1, 'summary counts project pipe-weight rows');
check(summary.policy.includes('pipe.attributes.supportLoadInput'), 'summary states input-package ownership policy');

if (failed) {
  console.error(`FAILED ${failed} checks, passed ${passed}`);
  process.exit(1);
}
console.log(`All support load master data checks passed (${passed}).`);
