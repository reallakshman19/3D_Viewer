import {
  DEFAULT_SUPPORT_LOAD_ACCESS_FIXTURES,
  evaluateAccessSupportLoadFixture,
  evaluateDefaultAccessSupportLoadFixtures,
  parseAccessSupportLoadFixtureText
} from '../geometry-workspace/GeometrySupportLoadAccessFixturePack.js';
import {
  evaluateAccessSupportLoadFixtureText
} from '../geometry-workspace/GeometrySupportLoadAccessFixtureBatchValidator.js';

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
const calc = result.formulaResult?.calculatedFields || {};

if (result.status !== 'PASS') {
  console.error(`Access fixture mismatch diagnostics: ${JSON.stringify(result.checks, null, 2)}`);
}

check(result.status === 'PASS', 'AML NPS 8 Access fixture evaluates successfully');
check(input.identity.lineNo === '8"-P25168-61502-01', 'Access fixture preserves CII line number');
check(input.identity.nps === 8, 'Access fixture preserves NPS 8');
near(input.identity.pipeOdMm, 219.075, 0.001, 'Access fixture preserves 8 inch OD');
near(input.pipePhysical.wallThicknessMm, 12.7, 0.001, 'Access fixture preserves wall thickness');
near(input.process.tempExpC1, 100, 0.001, 'Access fixture preserves TEMP_EXP_C1');
near(input.spans.depSpanMm, 10750, 0.001, 'Access fixture preserves DEP span');
near(calc.vertical?.opeVDep, 13000, 0.15, 'Access fixture reproduces OPE_V_DEP from exported Vertical_N_SS');
check(calc.guide?.roundedGuideHDep === 650, 'Access fixture preserves exported rounded guide component 650 N');
near(calc.guide?.guideHDep, 3900, 0.001, 'Access fixture applies final guide Max rule');
check(calc.lineStop?.lineStopH === 8800, 'Access fixture preserves exported line-stop 8800 N');
check(calc.lineStop?.lineStop?.idExpression === 'D_MINUS_WT', 'Access fixture preserves Access Dia - WALL_THICK line-stop expression');
check((result.audit || []).some(item => item.field === 'runtimeMutation' && item.value === 'none'), 'Access fixture validation does not mutate runtime workspace data');
check((input.audit || []).some(item => item.field === 'weightSplit' && String(item.value).includes('benchmark-vertical-backsolve')), 'Access fixture marks Vertical_N_SS weight split as regression-only');

const pastedAccessRows = `JOBNAME\tLinenoinCII\tProperlineNo\tINSUL_THICK\tNS\tPipeOD\tDEP_SPAN\tVertical_N_SS\tWALL_THICK\tTEMP_EXP_C1\tTEMP_EXP_C2\tMinVerLoad\tMinHoriLoad\tMinHoriLSLoad\tTobeCleaned\tRemarks\tInsulated\tMat_Category
AML-25-SYS-001 REV2 _PS UPDATE\t"8""-P25168-61502-01"\t0-1-\t0\t8\t219.075\t10750\t13000\t12.7\t100\t59\t-2700\t650\t8800\tTo be Cleaned\tSpec Not available\tNo\tLT`;

const imported = parseAccessSupportLoadFixtureText(pastedAccessRows);
check(imported.status === 'IMPORTED', 'Access fixture text importer accepts tab-delimited Access rows');
check(imported.fixtureCount === 1, 'Access fixture text importer returns one fixture row');
check(imported.warnings.length === 0, 'Access fixture text importer has no warnings for complete row');
const importedResult = evaluateAccessSupportLoadFixture(imported.fixtures[0]);
check(importedResult.status === 'PASS', 'imported Access row passes fixture evaluation');
near(importedResult.formulaResult.calculatedFields.vertical.opeVDep, 13000, 0.15, 'imported Access row reproduces OPE_V_DEP');
check(importedResult.formulaResult.calculatedFields.guide.roundedGuideHDep === 650, 'imported Access row reproduces rounded guide component');
check(importedResult.formulaResult.calculatedFields.lineStop.lineStopH === 8800, 'imported Access row reproduces line-stop result');
check(imported.fixtures[0].importAudit.some(item => item.source === 'ACCESS_FIXTURE_IMPORT'), 'imported Access row stores import audit');

const batchAccessRows = `JOBNAME\tLinenoinCII\tProperlineNo\tINSUL_THICK\tNS\tPipeOD\tDEP_SPAN\tVertical_N_SS\tWALL_THICK\tTEMP_EXP_C1\tTEMP_EXP_C2\tMinVerLoad\tMinHoriLoad\tMinHoriLSLoad\tTobeCleaned\tRemarks\tInsulated\tMat_Category
AML-25-SYS-001 REV2 _PS UPDATE\t"8""-P25168-61502-01"\t0-1-\t0\t8\t219.075\t10750\t13000\t12.7\t100\t59\t-2700\t650\t8800\tTo be Cleaned\tSpec Not available\tNo\tLT
UNIT-TEST-NPS4\t"4""-UNIT-TEST-0001"\t0-2-\t0\t4\t114.3\t6400\t7700\t6.02\t100\t59\t-1165\t200\t3150\tTo be Cleaned\tRegression row\tNo\tLT`;

const batch = evaluateAccessSupportLoadFixtureText(batchAccessRows);
check(batch.status === 'PASS', 'batch Access fixture validator passes complete pasted rows');
check(batch.total === 2, 'batch Access fixture validator evaluates two rows');
check(batch.failed === 0, 'batch Access fixture validator has no failed rows');
check(batch.results.every(row => row.status === 'PASS'), 'batch Access fixture validator returns row-level pass status');
check(batch.results[1].formulaResult.calculatedFields.guide.roundedGuideHDep === 200, 'batch Access validator preserves NPS4 rounded guide component');
near(batch.results[1].formulaResult.calculatedFields.guide.guideHDep, 2310, 0.001, 'batch Access validator applies NPS4 guide Max rule');
check(batch.results[1].formulaResult.calculatedFields.lineStop.lineStopH === 3150, 'batch Access validator preserves NPS4 line-stop reference');
check((batch.audit || []).some(item => item.value === 'regression-fixture-only'), 'batch Access validator is marked regression-only, not runtime top-up');

if (failed) {
  console.error(`FAILED ${failed} checks, passed ${passed}`);
  process.exit(1);
}
console.log(`All support-load Access fixture pack checks passed (${passed}).`);
