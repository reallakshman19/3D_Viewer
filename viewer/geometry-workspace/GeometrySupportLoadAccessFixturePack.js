import { calculateSupportLoadsForPipeInput } from './GeometrySupportLoadFormulaEngine.js?v=20260623-support-load-advanced-profiles-1';

export const SUPPORT_LOAD_ACCESS_FIXTURE_SCHEMA = 'support-load-access-fixture-pack/v1';
export const SUPPORT_LOAD_ACCESS_FIXTURE_VERSION = '20260623-access-fixture-pack-1';

const ACCESS_PROFILE = Object.freeze({
  profileId: 'ACCESS_TEMP_WALL_WEIGHTED_V1',
  gravityFactor: 10,
  verticalLoadFactor: 1.1,
  roundMajor: 100,
  roundStep: 50,
  roundMode: 'up'
});

export const DEFAULT_SUPPORT_LOAD_ACCESS_FIXTURES = Object.freeze([
  Object.freeze({
    fixtureId: 'access-aml-25-sys-001-rev2-nps8',
    source: 'ACCESS_EXPORTED_REFERENCE_ROW',
    jobName: 'AML-25-SYS-001 REV2 _PS UPDATE',
    lineNoInCii: '8"-P25168-61502-01',
    properLineNo: '0-1-',
    input: Object.freeze({
      nps: 8,
      pipeOdMm: 219.075,
      wallThicknessMm: 12.7,
      tempExpC1: 100,
      tempExpC2: 59,
      insulationThicknessMm: 0,
      depSpanMm: 10750,
      autoSpanMm: 10750,
      verticalNSS: 13000,
      minVerticalLoadN: -2700,
      accessMinHoriLoadN: 650,
      accessMinHoriLSLoadN: 8800,
      materialCategory: 'LT',
      insulated: 'No',
      toBeCleaned: 'To be Cleaned',
      remarks: 'Spec Not available'
    }),
    expected: Object.freeze({
      opeVDep: 13000,
      opeVA: 13000,
      roundedGuideHDep: 650,
      roundedGuideHA: 650,
      finalGuideHDep: 3900,
      finalGuideHA: 3900,
      lineStopH: 8800,
      lineStopIdExpression: 'D_MINUS_WT',
      guideControlling: 'THIRTY_PERCENT_OPE_VERTICAL'
    })
  })
]);

function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function text(value) { return String(value ?? '').trim(); }

function round3(value) { return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null; }

function freezeDeep(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freezeDeep));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freezeDeep(child)])));
}

function totalKgPerMForVertical({ verticalNSS, spanMm, gravityFactor = 10, verticalLoadFactor = 1.1 }) {
  const v = number(verticalNSS);
  const span = number(spanMm);
  const gravity = number(gravityFactor);
  const factor = number(verticalLoadFactor);
  if (v === null || span === null || span <= 0 || gravity === null || gravity <= 0 || factor === null || factor <= 0) return null;
  return v * 1000 / (span * gravity * factor);
}

export function buildLockedPipeInputFromAccessFixture(fixture) {
  const input = fixture?.input || {};
  const nps = number(input.nps ?? input.NS);
  const pipeOdMm = number(input.pipeOdMm ?? input.PipeOD ?? input.Dia);
  const wallThicknessMm = number(input.wallThicknessMm ?? input.WALL_THICK);
  const depSpanMm = number(input.depSpanMm ?? input.DEP_SPAN ?? input.SUPPORTSPAN);
  const autoSpanMm = number(input.autoSpanMm ?? depSpanMm);
  const verticalNSS = number(input.verticalNSS ?? input.Vertical_N_SS);
  const totalKgPerM = totalKgPerMForVertical({ verticalNSS, spanMm: depSpanMm });
  const fallbackPipeWtKgPerM = totalKgPerM === null ? null : totalKgPerM * 0.6;
  const unitPipeWtKgPerM = number(input.unitPipeWtKgPerM ?? input.UnitPipewtKgM ?? input['UnitPipewtKg/m']) ?? fallbackPipeWtKgPerM;
  const fallbackFluidWtOpeKgPerM = totalKgPerM === null || unitPipeWtKgPerM === null ? null : totalKgPerM - unitPipeWtKgPerM;
  const fluidWtOpeKgPerM = number(input.fluidWtOpeKgPerM ?? input.FluidwtKgM ?? input['FluidwtKg/m']) ?? fallbackFluidWtOpeKgPerM;
  const fluidWtHydKgPerM = number(input.fluidWtHydKgPerM ?? input.FluidwtHydKgM ?? input['FluidwtHydKg/m']) ?? fluidWtOpeKgPerM;
  const insideDiameterMm = number(input.insideDiameterMm) ?? (pipeOdMm === null || wallThicknessMm === null ? null : round3(pipeOdMm - 2 * wallThicknessMm));
  return freezeDeep({
    schema: 'support-load-input/v1',
    version: SUPPORT_LOAD_ACCESS_FIXTURE_VERSION,
    sourceObjectId: `ACCESS-FIXTURE-${text(fixture?.fixtureId) || text(fixture?.lineNoInCii) || 'ROW'}`,
    identity: {
      lineNo: text(fixture?.lineNoInCii || input.lineNoInCii || input.LinenoinCII),
      branchKey: text(fixture?.properLineNo || input.properLineNo || input.ProperlineNo),
      branchName: '',
      nps,
      pipeOdMm
    },
    pipePhysical: {
      wallThicknessMm,
      insideDiameterMm,
      materialCategory: text(input.materialCategory || input.Mat_Category),
      unitPipeWtKgPerM
    },
    process: {
      tempExpC1: number(input.tempExpC1 ?? input.TEMP_EXP_C1),
      tempExpC2: number(input.tempExpC2 ?? input.TEMP_EXP_C2),
      fluidWtOpeKgPerM,
      fluidWtHydKgPerM
    },
    spans: {
      autoSpanMm,
      depSpanMm,
      autoSpanBySupport: {}
    },
    formulaProfile: { ...ACCESS_PROFILE },
    supportRefs: [],
    readiness: {
      readyForVertical: true,
      readyForOpeVertical: true,
      readyForHydVertical: true,
      readyForGuide: true,
      readyForLineStop: true,
      readyForCalculation: true,
      lockedForCalculation: true,
      calculationGateStatus: 'INPUT_LOCKED',
      missing: [],
      status: 'INPUT_READY'
    },
    audit: [{
      source: 'ACCESS_FIXTURE_PACK',
      field: 'weightSplit',
      value: totalKgPerM === null ? 'unresolved' : 'benchmark-vertical-backsolve-for-regression-only',
      note: 'Fixture conversion reproduces Access exported Vertical_N_SS without becoming runtime hydration or top-up data.'
    }]
  });
}

export function evaluateAccessSupportLoadFixture(fixture) {
  const pipeInput = buildLockedPipeInputFromAccessFixture(fixture);
  const formulaResult = calculateSupportLoadsForPipeInput(pipeInput);
  const calc = formulaResult?.calculatedFields || {};
  const vertical = calc.vertical || {};
  const guide = calc.guide || {};
  const lineStop = calc.lineStop || {};
  const expected = fixture?.expected || {};
  const checks = [];
  const addNear = (field, actual, expectedValue, tolerance = 0.15) => {
    const ok = Number.isFinite(number(actual)) && Number.isFinite(number(expectedValue)) && Math.abs(number(actual) - number(expectedValue)) <= tolerance;
    checks.push({ field, actual, expected: expectedValue, tolerance, status: ok ? 'PASS' : 'FAIL' });
  };
  const addEqual = (field, actual, expectedValue) => {
    const ok = actual === expectedValue;
    checks.push({ field, actual, expected: expectedValue, status: ok ? 'PASS' : 'FAIL' });
  };
  addNear('vertical.opeVDep', vertical.opeVDep, expected.opeVDep);
  addNear('vertical.opeVA', vertical.opeVA, expected.opeVA);
  addEqual('guide.roundedGuideHDep', guide.roundedGuideHDep, expected.roundedGuideHDep);
  addEqual('guide.roundedGuideHA', guide.roundedGuideHA, expected.roundedGuideHA);
  addNear('guide.guideHDep', guide.guideHDep, expected.finalGuideHDep, 0.001);
  addNear('guide.guideHA', guide.guideHA, expected.finalGuideHA, 0.001);
  addEqual('guide.guideDep.controlling', guide.guideDep?.controlling, expected.guideControlling);
  addEqual('lineStop.lineStopH', lineStop.lineStopH, expected.lineStopH);
  addEqual('lineStop.lineStop.idExpression', lineStop.lineStop?.idExpression, expected.lineStopIdExpression);
  const failed = checks.filter(check => check.status !== 'PASS');
  return freezeDeep({
    schema: SUPPORT_LOAD_ACCESS_FIXTURE_SCHEMA,
    version: SUPPORT_LOAD_ACCESS_FIXTURE_VERSION,
    fixtureId: fixture?.fixtureId || null,
    status: failed.length ? 'FAIL' : 'PASS',
    pipeInput,
    formulaResult,
    checks,
    audit: [{
      source: 'ACCESS_FIXTURE_PACK',
      field: 'runtimeMutation',
      value: 'none',
      note: 'Fixture pack validates locked pipe inputs only; it does not mutate workspace inputs or calculated results.'
    }]
  });
}

export function evaluateDefaultAccessSupportLoadFixtures() {
  const results = DEFAULT_SUPPORT_LOAD_ACCESS_FIXTURES.map(evaluateAccessSupportLoadFixture);
  return freezeDeep({
    schema: SUPPORT_LOAD_ACCESS_FIXTURE_SCHEMA,
    version: SUPPORT_LOAD_ACCESS_FIXTURE_VERSION,
    total: results.length,
    passed: results.filter(result => result.status === 'PASS').length,
    failed: results.filter(result => result.status !== 'PASS').length,
    results
  });
}
