import { calculateSupportLoadsForPipeInput } from '../geometry-workspace/GeometrySupportLoadFormulaEngine.js';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) { console.log(`PASS: ${label}`); passed += 1; }
  else { console.error(`FAIL: ${label}`); failed += 1; }
}
function near(actual, expected, tol, label) {
  check(Math.abs(Number(actual) - expected) <= tol, `${label}: expected ${expected}, got ${actual}`);
}

const totalKgPerM = 13000 * 1000 / (10750 * 10 * 1.1);
const result = calculateSupportLoadsForPipeInput(Object.freeze({
  schema: 'support-load-input/v1',
  version: 'access-nps8-benchmark',
  sourceObjectId: 'PIPE-8-P25168-BENCH',
  identity: Object.freeze({ lineNo: '8"-P25168-61502-01', branchKey: 'P25168-61502-01', branchName: '', nps: 8, pipeOdMm: 219.075 }),
  pipePhysical: Object.freeze({ wallThicknessMm: 12.7, insideDiameterMm: 193.675, unitPipeWtKgPerM: totalKgPerM * 0.6 }),
  process: Object.freeze({ tempExpC1: 100, tempExpC2: 59, fluidWtOpeKgPerM: totalKgPerM * 0.4, fluidWtHydKgPerM: totalKgPerM * 0.4 }),
  spans: Object.freeze({ autoSpanMm: 10750, depSpanMm: 10750, autoSpanBySupport: Object.freeze({}) }),
  formulaProfile: Object.freeze({ profileId: 'ACCESS_TEMP_WALL_WEIGHTED_V1', gravityFactor: 10, verticalLoadFactor: 1.1, roundMajor: 100, roundStep: 50, roundMode: 'up' }),
  supportRefs: Object.freeze([]),
  readiness: Object.freeze({ readyForVertical: true, readyForOpeVertical: true, readyForHydVertical: true, readyForGuide: true, readyForLineStop: true, readyForCalculation: true, lockedForCalculation: true, calculationGateStatus: 'INPUT_LOCKED', missing: Object.freeze([]), status: 'INPUT_READY' })
}));

check(result.status === 'CALCULATED', 'Access benchmark calculates from locked pipe input');
near(result.calculatedFields.vertical.opeVDep, 13000, 0.15, 'OPE_V_DEP benchmark is 13000 N');
check(result.calculatedFields.guide.roundedGuideHDep === 650, 'rounded Guide H benchmark is 650 N');
near(result.calculatedFields.guide.guideHDep, 3900, 0.0001, 'final Guide H uses max with 0.3 × OPE_V_DEP');
check(result.calculatedFields.lineStop.lineStopH === 8800, 'LineStop_H benchmark is 8800 N');
check(result.calculatedFields.lineStop.lineStop.formula.includes('D^4-(D-WT)^4'), 'LineStop expression preserves Dia - WALL_THICK');

if (failed) {
  console.error(`FAILED ${failed} checks, passed ${passed}`);
  process.exit(1);
}
console.log(`All Access support-load benchmark checks passed (${passed}).`);
