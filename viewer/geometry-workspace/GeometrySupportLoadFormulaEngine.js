export const SUPPORT_LOAD_FORMULA_SCHEMA = 'support-load-formula-results/v1';
export const SUPPORT_LOAD_FORMULA_VERSION = '20260622-access-support-load-formula-1';
export const SUPPORT_LOAD_FORMULA_PROFILE_ID = 'ACCESS_TEMP_WALL_WEIGHTED_V1';

export const SUPPORT_LOAD_FORMULA_INFO_TEXT = `Support Load Formula — Access Temperature / Wall Weighted Profile

Vertical Loads

OPE_V_A =
Round(((FluidWt_OPE kg/m + UnitPipeWt kg/m) × AutoSpan mm × 10 × 1.1 ÷ 1000), 1)

HYD_V_A =
Round(((FluidWt_HYD kg/m + UnitPipeWt kg/m) × AutoSpan mm × 10 × 1.1 ÷ 1000), 1)

OPE_V_DEP =
Round(((FluidWt_OPE kg/m + UnitPipeWt kg/m) × DEPSpan mm × 10 × 1.1 ÷ 1000), 1)

HYD_V_DEP =
Round(((FluidWt_HYD kg/m + UnitPipeWt kg/m) × DEPSpan mm × 10 × 1.1 ÷ 1000), 1)

Guide Horizontal Loads

Rounded_Guide_H_A =
GetRoundedNum(0.1 × 0.3 × OPE_V_A × (WallThickness mm ÷ 6.3) × (TempfnC(TEMP_EXP_C1) ÷ 100) ÷ 1.23, 100, 50, "up")

Guide_H_A = Max(Rounded_Guide_H_A, 0.3 × OPE_V_A)

Rounded_Guide_H_DEP =
GetRoundedNum(0.1 × 0.3 × OPE_V_DEP × (WallThickness mm ÷ 6.3) × (TempfnC(TEMP_EXP_C1) ÷ 100) ÷ 1.23, 100, 50, "up")

Guide_H_DEP = Max(Rounded_Guide_H_DEP, 0.3 × OPE_V_DEP)

Line Stop Horizontal Load

LineStop_H =
GetRoundedNum(1000 × 0.0209 × (3.14 ÷ 32 × (Dia_mm^4 - (Dia_mm - WallThickness_mm)^4) ÷ Dia_mm)^0.5079 × (TempfnC(TEMP_EXP_C1) ÷ 100) ÷ 1.23, 100, 50, "up")

Notes:
- Calculation reads only locked pipe.attributes.supportLoadInput packages.
- No master lookup, enrichment, association, or missing-value fabrication is performed inside this formula engine.
- TempfnC(T) defaults to identity T for this profile until a project-specific temperature function table is supplied.`;

function text(value) { return String(value ?? '').trim(); }
function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}
function round1(value) { return Number.isFinite(value) ? Math.round(value * 10) / 10 : null; }
function round3(value) { return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null; }
function freezeDeep(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freezeDeep));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freezeDeep(child)])));
}
function objectId(object) { return text(object?.sourceId || object?.id || object?.canonicalId || object?.displayName); }
function inputKey(input) {
  const identity = input?.identity || {};
  return text(input?.sourceObjectId) || text(identity.lineNo) || text(identity.branchKey) || text(identity.branchName) || 'pipe-input';
}
function getRoundStep(input) { return number(input?.formulaProfile?.roundStep) || 50; }
function getRoundMajor(input) { return number(input?.formulaProfile?.roundMajor) || 100; }
function getRoundMode(input) { return text(input?.formulaProfile?.roundMode || 'up').toLowerCase(); }
export function getRoundedNum(value, major = 100, step = 50, mode = 'up') {
  const numeric = number(value);
  const roundStep = number(step) || 50;
  if (numeric === null) return null;
  if (String(mode || 'up').toLowerCase() !== 'up') return Math.round(numeric / roundStep) * roundStep;
  return Math.ceil(numeric / roundStep) * roundStep;
}
export function tempFnC(value) {
  return number(value);
}
function verticalLoad(pipeWt, fluidWt, spanMm, profile) {
  const p = number(pipeWt), f = number(fluidWt), span = number(spanMm);
  if (p === null || f === null || span === null) return null;
  const gravity = number(profile?.gravityFactor) || 10;
  const factor = number(profile?.verticalLoadFactor) || 1.1;
  return round1((p + f) * span * gravity * factor / 1000);
}
function guideLoad(opeVerticalN, input) {
  const v = number(opeVerticalN);
  const wall = number(input?.pipePhysical?.wallThicknessMm);
  const temp = tempFnC(input?.process?.tempExpC1);
  if (v === null || wall === null || temp === null) return null;
  const raw = 0.1 * 0.3 * v * (wall / 6.3) * (temp / 100) / 1.23;
  const rounded = getRoundedNum(raw, getRoundMajor(input), getRoundStep(input), getRoundMode(input));
  const thirtyPercent = round3(0.3 * v);
  const finalN = round3(Math.max(number(rounded) ?? -Infinity, thirtyPercent));
  return freezeDeep({
    rawN: round3(raw),
    roundedN: rounded,
    thirtyPercentOpeVN: thirtyPercent,
    finalN,
    controlling: finalN === rounded ? 'ROUNDED_TEMPERATURE_WALL_GUIDE' : 'THIRTY_PERCENT_OPE_VERTICAL',
    formula: 'Max(GetRoundedNum(0.1*0.3*OPE_V*(WT/6.3)*(TempfnC(T1)/100)/1.23,100,50,"up"),0.3*OPE_V)'
  });
}
function lineStopLoad(input) {
  const dia = number(input?.identity?.pipeOdMm);
  const wall = number(input?.pipePhysical?.wallThicknessMm);
  const temp = tempFnC(input?.process?.tempExpC1);
  if (dia === null || wall === null || temp === null) return null;
  const sectionTerm = 3.14 / 32 * (dia ** 4 - (dia - wall) ** 4) / dia;
  const raw = 1000 * 0.0209 * (sectionTerm ** 0.5079) * (temp / 100) / 1.23;
  const rounded = getRoundedNum(raw, getRoundMajor(input), getRoundStep(input), getRoundMode(input));
  return freezeDeep({
    sectionTerm: round3(sectionTerm),
    rawN: round3(raw),
    finalN: rounded,
    formula: 'GetRoundedNum(1000*0.0209*(3.14/32*(D^4-(D-WT)^4)/D)^0.5079*(TempfnC(T1)/100)/1.23,100,50,"up")'
  });
}
function supportAppliesGuide(ref) {
  const t = text(ref?.supportType).toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  return t.includes('GUIDE');
}
function supportAppliesLineStop(ref) {
  const t = text(ref?.supportType).toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  return t.includes('LINE_STOP') || t.includes('LINESTOP') || t.includes('LIMIT') || t.includes('STOP') || t.includes('ANCHOR');
}
function blockedResult(input, reason) {
  const missing = Array.isArray(input?.readiness?.missing) ? input.readiness.missing : [];
  return freezeDeep({
    schema: SUPPORT_LOAD_FORMULA_SCHEMA,
    version: SUPPORT_LOAD_FORMULA_VERSION,
    profileId: SUPPORT_LOAD_FORMULA_PROFILE_ID,
    sourceObjectId: text(input?.sourceObjectId),
    inputKey: inputKey(input),
    status: 'BLOCKED',
    reason,
    missing,
    calculatedFields: null,
    audit: [{ source: 'SUPPORT_LOAD_FORMULA_ENGINE', field: 'calculationGate', value: reason }]
  });
}
export function calculateSupportLoadsForPipeInput(input) {
  if (!input || typeof input !== 'object') return blockedResult(input, 'missing-pipe-support-load-input');
  if (input?.readiness?.readyForCalculation !== true) return blockedResult(input, 'pipe-input-not-locked-for-calculation');
  const pipe = input.pipePhysical || {};
  const process = input.process || {};
  const spans = input.spans || {};
  const profile = input.formulaProfile || {};
  const vertical = freezeDeep({
    opeVA: verticalLoad(pipe.unitPipeWtKgPerM, process.fluidWtOpeKgPerM, spans.autoSpanMm, profile),
    hydVA: verticalLoad(pipe.unitPipeWtKgPerM, process.fluidWtHydKgPerM, spans.autoSpanMm, profile),
    opeVDep: verticalLoad(pipe.unitPipeWtKgPerM, process.fluidWtOpeKgPerM, spans.depSpanMm, profile),
    hydVDep: verticalLoad(pipe.unitPipeWtKgPerM, process.fluidWtHydKgPerM, spans.depSpanMm, profile)
  });
  const guideA = guideLoad(vertical.opeVA, input);
  const guideDep = guideLoad(vertical.opeVDep, input);
  const lineStop = lineStopLoad(input);
  const calculatedFields = freezeDeep({
    schema: SUPPORT_LOAD_FORMULA_SCHEMA,
    version: SUPPORT_LOAD_FORMULA_VERSION,
    profileId: SUPPORT_LOAD_FORMULA_PROFILE_ID,
    vertical,
    guide: {
      roundedGuideHA: guideA?.roundedN ?? null,
      guideHA: guideA?.finalN ?? null,
      guideA,
      roundedGuideHDep: guideDep?.roundedN ?? null,
      guideHDep: guideDep?.finalN ?? null,
      guideDep
    },
    lineStop: {
      lineStopH: lineStop?.finalN ?? null,
      lineStop
    },
    formulaInfo: SUPPORT_LOAD_FORMULA_INFO_TEXT
  });
  return freezeDeep({
    schema: SUPPORT_LOAD_FORMULA_SCHEMA,
    version: SUPPORT_LOAD_FORMULA_VERSION,
    profileId: SUPPORT_LOAD_FORMULA_PROFILE_ID,
    sourceObjectId: text(input.sourceObjectId),
    inputKey: inputKey(input),
    lineNo: text(input.identity?.lineNo),
    status: 'CALCULATED',
    calculatedFields,
    audit: [
      { source: 'SUPPORT_LOAD_FORMULA_ENGINE', field: 'inputSource', value: 'pipe.attributes.supportLoadInput' },
      { source: 'SUPPORT_LOAD_FORMULA_ENGINE', field: 'calculationGate', value: input.readiness?.calculationGateStatus || 'INPUT_LOCKED' },
      { source: 'SUPPORT_LOAD_FORMULA_ENGINE', field: 'TempfnC', value: 'identity' },
      { source: 'SUPPORT_LOAD_FORMULA_ENGINE', field: 'GetRoundedNum', value: `major=${getRoundMajor(input)}, step=${getRoundStep(input)}, mode=${getRoundMode(input)}` }
    ]
  });
}
function pipeSupportRows(pipeResult, input) {
  const refs = Array.isArray(input?.supportRefs) ? input.supportRefs : [];
  return refs.map(ref => freezeDeep({
    schema: 'support-load-formula-support-row/v1',
    supportId: text(ref.supportId),
    supportTag: text(ref.supportTag),
    supportType: text(ref.supportType),
    associatedPipeId: pipeResult.sourceObjectId,
    lineNo: pipeResult.lineNo,
    status: pipeResult.status,
    vertical: pipeResult.calculatedFields?.vertical || null,
    guide: supportAppliesGuide(ref) ? pipeResult.calculatedFields?.guide || null : null,
    lineStop: supportAppliesLineStop(ref) ? pipeResult.calculatedFields?.lineStop || null : null,
    applies: { vertical: true, guide: supportAppliesGuide(ref), lineStop: supportAppliesLineStop(ref) }
  }));
}
function writeResultsToObjects(objects, pipeResults, supportRows) {
  const byPipe = new Map(pipeResults.map(result => [result.sourceObjectId, result]));
  const bySupport = new Map(supportRows.map(row => [row.supportId, row]));
  return freezeDeep((Array.isArray(objects) ? objects : []).map(object => {
    const id = objectId(object);
    const pipeResult = byPipe.get(id);
    if (pipeResult?.status === 'CALCULATED') {
      return { ...object, calculatedFields: { ...(object.calculatedFields || {}), supportLoads: pipeResult.calculatedFields } };
    }
    const supportResult = bySupport.get(id);
    if (supportResult?.status === 'CALCULATED') {
      return { ...object, calculatedFields: { ...(object.calculatedFields || {}), supportLoadReference: supportResult } };
    }
    return object;
  }));
}
export function calculateSupportLoadResultsFromInputModel(model, options = {}) {
  const pipeInputs = Array.isArray(model?.pipeInputs) ? model.pipeInputs : [];
  const pipeResults = pipeInputs.map(input => calculateSupportLoadsForPipeInput(input));
  const byKey = new Map(pipeInputs.map(input => [inputKey(input), input]));
  const supportRows = pipeResults.flatMap(result => pipeSupportRows(result, byKey.get(result.inputKey)));
  const calculatedObjects = writeResultsToObjects(model?.hydratedObjects || [], pipeResults, supportRows);
  const calculatedCount = pipeResults.filter(result => result.status === 'CALCULATED').length;
  const blockedCount = pipeResults.length - calculatedCount;
  return freezeDeep({
    schema: SUPPORT_LOAD_FORMULA_SCHEMA,
    version: SUPPORT_LOAD_FORMULA_VERSION,
    profileId: SUPPORT_LOAD_FORMULA_PROFILE_ID,
    evaluatedAt: options.evaluatedAt || new Date().toISOString(),
    status: pipeResults.length === 0 ? 'EMPTY' : blockedCount ? 'BLOCKED' : 'CALCULATED',
    pipeInputCount: pipeResults.length,
    calculatedPipeCount: calculatedCount,
    blockedPipeCount: blockedCount,
    supportResultCount: supportRows.length,
    pipeResults,
    supportRows,
    calculatedObjects,
    formulaInfo: SUPPORT_LOAD_FORMULA_INFO_TEXT,
    assumptions: [
      'Formula engine reads only locked pipe.attributes.supportLoadInput packages.',
      'TempfnC(TEMP_EXP_C1) defaults to identity until a project-specific function table is supplied.',
      'Line Stop formula intentionally preserves the legacy Access Dia - WALL_THICK expression.'
    ]
  });
}
