import {
  DEFAULT_SUPPORT_LOAD_ACCESS_FIXTURES,
  evaluateAccessSupportLoadFixture,
  evaluateDefaultAccessSupportLoadFixtures
} from '../geometry-workspace/GeometrySupportLoadAccessFixturePack.js';

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) {
    console.log(`PASS: ${label}`);
    passed += 1;
  } else {
    console.error(`FAIL: ${label}`);
    failed += 1;
  }
}
function near(actual, expected, tolerance, label) {
  const value = Number(actual);
  check(Number.isFinite(value) && Math.abs(value - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

const summary = evaluateDefaultAccessSupportLoadFixtures();
check(summary.total >= 1, 'default Access fixture pack contains at least one exported reference row');
check(summary.failed === 0, 'default Access fixture pack has no failed rows');
check(summary.passed === summary.total, 'all default Access fixture rows pass');

const fixture = DEFAULT_SUPPORT_LOAD_ACCESS_FIXTURES[0];
const result = evaluateAccessSupportLoadFixture(fixture);
const input = result.pipeInput;
const calc = result.formulaResult.calculatedFields;

check(result.status === 'PASS', 'AML NPS 8 Access fixture evaluates successfully');
check(input.identity.lineNo === '8"-P25168-61502-01', 'Access fixture preserves CII line number');
check(input.identity.nps === 8, 'Access fixture preserves NPS 8');
near(input.identity.pipeOdMm, 219.075, 0.001, 'Access fixture preserves 8 inch OD');
near(input.pipePhysical.wallThicknessMm, 12.7, 0.001, 'Access fixture preserves wall thickness');
near(input.process.tempExpC1, 100, 0.001, 'Access fixture preserves TEMP_EXP_C1');
near(input.spans.depSpanMm, 10750, 0.001, 'Access fixture preserves DEP span');
near(calc.vertical.opeVDep, 13000, 0.15, 'Access fixture reproduces OPE_V_DEP from exported Vertical_N_SS');
check(calc.guide.roundedGuideHDep === 650, 'Access fixture preserves exported rounded guide component 650 N');
near(calc.guide.guideHDep, 3900, 0.001, 'Access fixture applies final guide Max rule');
check(calc.lineStop.lineStopH === 8800, 'Access fixture preserves exported line-stop 8800 N');
check(calc.lineStop.lineStop.idExpression === 'D_MINUS_WT', 'Access fixture preserves Access Dia - WALL_THICK line-stop expression');
check(result.audit.some(item => item.field === 'runtimeMutation' && item.value === 'none'), 'Access fixture validation does not mutate runtime workspace data');
check(input.audit.some(item => item.field === 'weightSplit' && String(item.value).includes('benchmark-vertical-backsolve')), 'Access fixture marks Vertical_N_SS weight split as regression-only');

if (failed) {
  console.error(`FAILED ${failed} checks, passed ${passed}`);
  process.exit(1);
}
console.log(`All support-load Access fixture pack checks passed (${passed}).`);
