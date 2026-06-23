import { buildDefaultSupportLoadMasterData, normalizeSupportLoadMasterDataPackage } from '../geometry-workspace/GeometrySupportLoadMasterData.js';
import { buildGeometrySupportLoadInputModel } from '../geometry-workspace/GeometrySupportLoadInputModel.js';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}

const masterData = normalizeSupportLoadMasterDataPackage({
  ...buildDefaultSupportLoadMasterData({ generatedAt: '2026-06-23T02:00:00.000Z' }),
  pipeWeightRows: [{ nps: 8, pipeOdMm: 219.075, wallThicknessMm: 12.7, unitPipeWtKgPerM: 67.2, source: 'PROJECT_PIPE_WEIGHT_TABLE' }],
  hydroDensityProfiles: [{ profileId: 'HYD_TEST_998', fluidDensityHydKgM3: 998.2, source: 'PROJECT_HYDRO_TABLE' }],
  materialDensityRows: [{ materialCategory: 'LT', materialDensityKgM3: 7850, source: 'PROJECT_MATERIAL_TABLE' }],
  roundingProfiles: [{ profileId: 'ACCESS_ROUND_UP_50', roundMajor: 100, roundStep: 50, roundMode: 'up' }]
}, { generatedAt: '2026-06-23T02:00:00.000Z' });

const model = buildGeometrySupportLoadInputModel([
  {
    id: 'PIPE-8-P25168',
    family: 'PIPE',
    lineNo: 'NPS8-P25168-61502-01',
    displayName: 'PIPE NPS8-P25168-61502-01',
    rawFields: { NS: 8, PipeOD: 219.075, WALL_THICK: 12.7, TEMP_EXP_C1: 100, TEMP_EXP_C2: 59, Mat_Category: 'LT' },
    geometry: { center: { x: 0, y: 0, z: 0 } },
    process: { fluidDensityKgM3: 800, temperature1C: 100 }
  },
  {
    id: 'SUP-PS-001',
    family: 'SUPPORT',
    lineNo: 'NPS8-P25168-61502-01',
    displayName: 'GUIDE PS-001',
    geometry: { center: { x: 10, y: -80, z: 0 } },
    support: { supportType: 'GUIDE', supportTag: 'PS-001' },
    pipe: { odMm: 219.075 }
  }
], { supportLoadMasterData: masterData, evaluatedAt: '2026-06-23T02:05:00.000Z' });

const input = model.pipeInputs[0];
const auditSources = (input.audit || []).map(row => row.source);

check(model.masterDataSummary.depSpanRowCount >= 20, 'input model carries master-data summary');
check(input.identity.nps === 8, 'native NPS is preserved before master fallback');
check(input.spans.depSpanMm === 10750, 'DEP span hydrates from controlled master table');
check(input.pipePhysical.unitPipeWtKgPerM === 67.2, 'pipe weight hydrates from controlled pipe-weight table');
check(input.process.fluidDensityHydKgM3 === 998.2, 'hydro density hydrates from controlled hydro profile');
check(input.process.fluidWtHydKgPerM !== null, 'hydro fluid kg/m is deterministically derived after hydro density hydration');
check(input.formulaProfile.roundStep === 50, 'rounding profile hydrates into formula profile metadata');
check(auditSources.includes('PROJECT_MASTER_TABLE'), 'project master table usage is audited');
check(auditSources.includes('DERIVED_FLUID_WEIGHT'), 'derived fluid weight is audited');
check(!JSON.stringify(model).includes('calculatedFields'), 'hydrator does not emit calculated fields');
check(!JSON.stringify(model).includes('supportLoads'), 'hydrator does not emit support-load results');

if (failed) {
  console.error(`FAILED ${failed} checks, passed ${passed}`);
  process.exit(1);
}
console.log(`All support-load master hydration checks passed (${passed}).`);
