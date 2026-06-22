export const GEOMETRY_SUPPORT_LOAD_INPUT_SCHEMA = 'geometry-support-load-input-model/v1';
export const PIPE_SUPPORT_LOAD_INPUT_SCHEMA = 'support-load-input/v1';
export const SUPPORT_LOAD_INPUT_REF_SCHEMA = 'support-load-input-ref/v1';
export const GEOMETRY_SUPPORT_LOAD_INPUT_VERSION = '20260622-pipe-support-load-input-hydrator-2';
export const SUPPORT_LOAD_INPUT_MODULE_ID = 'support-load-input-model/v1';
export const SUPPORT_LOAD_INPUT_REQUIRED_FIELDS = Object.freeze([
  'pipe.attributes.supportLoadInput.identity.nps',
  'pipe.attributes.supportLoadInput.identity.pipeOdMm',
  'pipe.attributes.supportLoadInput.pipePhysical.wallThicknessMm',
  'pipe.attributes.supportLoadInput.pipePhysical.unitPipeWtKgPerM',
  'pipe.attributes.supportLoadInput.process.tempExpC1',
  'pipe.attributes.supportLoadInput.process.fluidWtOpeKgPerM',
  'pipe.attributes.supportLoadInput.process.fluidWtHydKgPerM',
  'pipe.attributes.supportLoadInput.spans.autoSpanMm or pipe.attributes.supportLoadInput.spans.depSpanMm'
]);

const MAX_OBJECTS = 20000;
const DEP_SPANS = Object.freeze([
  [0.5, 21.34, 900], [0.75, 26.67, 1400], [1, 33.4, 2200], [1.5, 48.26, 2800],
  [2, 60.325, 2800], [3, 88.9, 6400], [4, 114.3, 6400], [6, 168.275, 9400],
  [8, 219.075, 10750], [10, 273.05, 10750], [12, 323.85, 10750], [14, 355.6, 10750],
  [16, 406.4, 11000], [18, 457.2, 11000], [20, 508, 11500], [24, 609.6, 12000],
  [30, 762, 14000], [36, 914.4, 16000], [42, 1066.8, 18000], [48, 1219.2, 20000]
].map(([nps, pipeOdMm, depSpanMm]) => Object.freeze({ nps, pipeOdMm, depSpanMm })));

function text(value) { return String(value ?? '').trim(); }
function norm(value) { return text(value).toUpperCase().replace(/[^A-Z0-9.]+/g, ''); }
function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const match = text(value).replace(/,/g, '').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}
function round3(value) { return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null; }
function rawFields(object) { return { ...(object?.rawRecord?.rawFields || {}), ...(object?.rawFields || {}) }; }
function rawValue(raw, keys) {
  const entries = Object.entries(raw || {});
  for (const key of keys) {
    if (text(raw[key])) return raw[key];
    const match = entries.find(([name, value]) => norm(name) === norm(key) && text(value));
    if (match) return match[1];
  }
  return undefined;
}
function firstNumber(...values) { for (const value of values) { const n = num(value); if (n !== null) return n; } return null; }
function point(value) {
  const x = num(value?.x), y = num(value?.y), z = num(value?.z);
  return x === null || y === null || z === null ? null : Object.freeze({ x, y, z });
}
function centerOf(object) { return point(object?.geometry?.center) || point(object?.geometryEnrichment?.geometry?.center) || point(object?.rawRecord?.geometry?.center); }
function distance(a, b) { return a && b ? Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) : Infinity; }
function objectId(object) { return text(object?.sourceId || object?.id || object?.canonicalId || object?.displayName); }
function family(object) { return text(object?.family || object?.objectType || object?.rawRecord?.objectClass || object?.rawRecord?.objectType).toUpperCase(); }
function isRejected(object) { return text(object?.mappingStatus).toUpperCase() === 'REJECTED'; }
function isPipe(object) {
  const raw = rawFields(object);
  return family(object) === 'PIPE' || norm(raw.TYPE).includes('PIPE') || norm(object?.primitiveKind).includes('PIPE');
}
function isSupport(object) {
  const raw = rawFields(object);
  return family(object) === 'SUPPORT' || family(object) === 'ATTA' || norm(raw.TYPE).includes('ATTA') || norm(object?.displayName).includes('SUPPORT');
}
function lineKey(object) { return text(object?.geometryEnrichment?.branch?.lineKey || object?.enrichedFields?.lineKey || object?.lineNo || rawFields(object).LINE_NO); }
function branchName(object) { return text(object?.geometryEnrichment?.branch?.branchName || object?.enrichedFields?.branchName || object?.rawRecord?.sourcePath || object?.sourcePath); }
function npsFromLine(value) { const match = text(value).match(/(^|[^0-9.])(\d+(?:\.\d+)?)\s*["]/); return match ? num(match[2]) : null; }
function npsFromOd(od) {
  if (od === null) return null;
  let best = null;
  for (const row of DEP_SPANS) {
    const delta = Math.abs(row.pipeOdMm - od);
    if (delta <= 1.5 && (!best || delta < best.delta)) best = { ...row, delta };
  }
  return best?.nps ?? null;
}
function depFor(nps, od) {
  let row = nps !== null ? DEP_SPANS.find(item => Math.abs(item.nps - nps) < 0.0001) : null;
  if (!row && od !== null) row = DEP_SPANS.find(item => Math.abs(item.pipeOdMm - od) <= 1.5) || null;
  return row;
}
function audit(source, field, value, extra = {}) { return Object.freeze({ source, field, value, ...extra }); }

function resolvePipeSource(object) {
  const raw = rawFields(object);
  const enrichment = object?.geometryEnrichment || {};
  const od = firstNumber(object?.pipe?.odMm, enrichment.branch?.boreMm, rawValue(raw, ['PipeOD', 'PIPE_OD', 'OD_MM', 'OD', 'DIA', 'DIAMETER', 'BORE']));
  const nps = firstNumber(object?.pipe?.nps, object?.nps, rawValue(raw, ['NS', 'NPS', 'NOMINAL_SIZE', 'PIPE_SIZE']), npsFromLine(lineKey(object) || branchName(object)), npsFromOd(od));
  const wall = firstNumber(enrichment.piping?.wallThicknessMm, object?.pipe?.wallThicknessMm, rawValue(raw, ['WALL_THICK', 'WALL_THICKNESS_MM', 'WT_MM', 'THK_MM']));
  const insideDiameter = od !== null && wall !== null ? round3(od - 2 * wall) : null;
  const materialDensity = firstNumber(object?.pipe?.materialDensityKgM3, rawValue(raw, ['MATERIAL_DENSITY_KG_M3']));
  const auditRows = [];
  let pipeWeight = firstNumber(object?.pipe?.unitPipeWtKgPerM, object?.pipe?.weightKgM, rawValue(raw, ['UnitPipewtKg/m', 'UNIT_PIPE_WT_KG_M', 'PIPE_WT_KG_M', 'WEIGHT_KG_M']));
  if (pipeWeight === null && od !== null && insideDiameter !== null && materialDensity !== null) {
    pipeWeight = round3(Math.PI / 4 * (od ** 2 - insideDiameter ** 2) * 1e-6 * materialDensity);
    auditRows.push(audit('DERIVED_PIPE_WEIGHT', 'pipePhysical.unitPipeWtKgPerM', pipeWeight, { expression: 'PI/4*(OD^2-ID^2)*1e-6*materialDensityKgM3' }));
  }
  const temp1 = firstNumber(enrichment.process?.temperature1C, object?.process?.temperature1C, object?.process?.temperatureC, rawValue(raw, ['TEMP_EXP_C1', 'TEMP_C1', 'DESIGN_TEMP_C']));
  const temp2 = firstNumber(enrichment.process?.temperature2C, object?.process?.temperature2C, rawValue(raw, ['TEMP_EXP_C2', 'TEMP_C2']));
  const densityOpe = firstNumber(enrichment.process?.fluidDensityKgM3, object?.process?.fluidDensityOpeKgM3, object?.process?.fluidDensityKgM3, rawValue(raw, ['FLUID_DENSITY_OPE_KG_M3', 'DENSITY_MIXED', 'DENSITY']));
  const densityHyd = firstNumber(object?.process?.fluidDensityHydKgM3, object?.process?.hydroFluidDensityKgM3, rawValue(raw, ['FLUID_DENSITY_HYD_KG_M3', 'HYD_DENSITY_KG_M3', 'HYDRO_DENSITY']));
  let fluidOpe = firstNumber(object?.process?.fluidWtOpeKgPerM, rawValue(raw, ['FluidwtKg/m', 'FLUID_WT_OPE_KG_M', 'FLUIDWT_KG_M']));
  let fluidHyd = firstNumber(object?.process?.fluidWtHydKgPerM, rawValue(raw, ['FLUID_WT_HYD_KG_M', 'HYD_FLUIDWT_KG_M']));
  if (fluidOpe === null && insideDiameter !== null && densityOpe !== null) {
    fluidOpe = round3(Math.PI / 4 * insideDiameter ** 2 * 1e-6 * densityOpe);
    auditRows.push(audit('DERIVED_FLUID_WEIGHT', 'process.fluidWtOpeKgPerM', fluidOpe, { expression: 'PI/4*ID^2*1e-6*fluidDensityOpeKgM3' }));
  }
  if (fluidHyd === null && insideDiameter !== null && densityHyd !== null) {
    fluidHyd = round3(Math.PI / 4 * insideDiameter ** 2 * 1e-6 * densityHyd);
    auditRows.push(audit('DERIVED_FLUID_WEIGHT', 'process.fluidWtHydKgPerM', fluidHyd, { expression: 'PI/4*ID^2*1e-6*fluidDensityHydKgM3' }));
  }
  const depRaw = firstNumber(object?.spans?.depSpanMm, rawValue(raw, ['DEP SPAN', 'DEP_SPAN', 'DEPSPAN', 'DEPSPAN_MM']));
  const depLookup = depRaw === null ? depFor(nps, od) : null;
  return {
    raw,
    enrichment,
    nps,
    od,
    wall,
    insideDiameter,
    materialDensity,
    pipeWeight,
    temp1,
    temp2,
    densityOpe,
    densityHyd,
    fluidOpe,
    fluidHyd,
    autoSpan: firstNumber(object?.spans?.autoSpanMm, rawValue(raw, ['AutoSpan', 'AUTOSPAN_MM', 'AUTO_SPAN_MM'])),
    depSpan: depRaw ?? depLookup?.depSpanMm ?? null,
    depLookup,
    auditRows
  };
}

function readiness(input) {
  const identity = input.identity;
  const pipe = input.pipePhysical;
  const process = input.process;
  const spans = input.spans;
  const hasSpan = spans.autoSpanMm !== null || spans.depSpanMm !== null;
  const ope = pipe.unitPipeWtKgPerM !== null && process.fluidWtOpeKgPerM !== null && hasSpan;
  const hyd = pipe.unitPipeWtKgPerM !== null && process.fluidWtHydKgPerM !== null && hasSpan;
  const lineStop = identity.pipeOdMm !== null && pipe.wallThicknessMm !== null && process.tempExpC1 !== null;
  const guide = ope && pipe.wallThicknessMm !== null && process.tempExpC1 !== null;
  const missing = [];
  for (const [field, ok] of [
    ['identity.nps', identity.nps !== null],
    ['identity.pipeOdMm', identity.pipeOdMm !== null],
    ['pipePhysical.wallThicknessMm', pipe.wallThicknessMm !== null],
    ['pipePhysical.unitPipeWtKgPerM', pipe.unitPipeWtKgPerM !== null],
    ['process.tempExpC1', process.tempExpC1 !== null],
    ['process.fluidWtOpeKgPerM', process.fluidWtOpeKgPerM !== null],
    ['process.fluidWtHydKgPerM', process.fluidWtHydKgPerM !== null],
    ['spans.autoSpanMm or spans.depSpanMm', hasSpan]
  ]) if (!ok) missing.push(field);
  return Object.freeze({
    readyForVertical: ope && hyd,
    readyForOpeVertical: ope,
    readyForHydVertical: hyd,
    readyForGuide: guide,
    readyForLineStop: lineStop,
    missing: Object.freeze(missing),
    status: !missing.length ? 'INPUT_READY' : lineStop ? 'PARTIAL_INPUT' : 'BLOCKED'
  });
}

export function buildPipeSupportLoadInput(object) {
  const source = resolvePipeSource(object);
  const line = lineKey(object) || text(object?.lineNo);
  const input = {
    schema: PIPE_SUPPORT_LOAD_INPUT_SCHEMA,
    version: GEOMETRY_SUPPORT_LOAD_INPUT_VERSION,
    sourceObjectId: objectId(object),
    identity: Object.freeze({ lineNo: line, branchKey: lineKey(object), branchName: branchName(object), nps: source.nps, pipeOdMm: source.od }),
    pipePhysical: Object.freeze({
      wallThicknessMm: source.wall,
      insideDiameterMm: source.insideDiameter,
      schedule: text(source.enrichment.piping?.schedule || object?.pipe?.schedule || rawValue(source.raw, ['SCHEDULE', 'SCH'])),
      material: text(source.enrichment.piping?.materialName || object?.pipe?.material || rawValue(source.raw, ['MATERIAL', 'MAT'])),
      materialCode: text(source.enrichment.piping?.materialCode || object?.pipe?.materialCode || rawValue(source.raw, ['MATERIAL_CODE', 'MATID'])),
      materialCategory: text(object?.pipe?.materialCategory || rawValue(source.raw, ['Mat_Category', 'MAT_CATEGORY'])),
      materialDensityKgM3: source.materialDensity,
      insulationThicknessMm: firstNumber(source.enrichment.process?.insulationThicknessMm, object?.pipe?.insulationThicknessMm, rawValue(source.raw, ['INSUL_THICK', 'INSULATION_THICKNESS_MM'])),
      unitPipeWtKgPerM: source.pipeWeight
    }),
    process: Object.freeze({
      tempExpC1: source.temp1,
      tempExpC2: source.temp2,
      fluidDensityOpeKgM3: source.densityOpe,
      fluidDensityHydKgM3: source.densityHyd,
      fluidWtOpeKgPerM: source.fluidOpe,
      fluidWtHydKgPerM: source.fluidHyd
    }),
    spans: Object.freeze({ autoSpanMm: source.autoSpan, depSpanMm: source.depSpan, autoSpanBySupport: Object.freeze({}) }),
    formulaProfile: Object.freeze({ profileId: 'ACCESS_TEMP_WALL_WEIGHTED_V1', gravityFactor: 10, verticalLoadFactor: 1.1, roundMajor: 100, roundStep: 50, roundMode: 'up', noLoadFormula: true }),
    supportRefs: Object.freeze([]),
    audit: Object.freeze([
      audit('PIPE_SUPPORT_LOAD_INPUT_HYDRATOR', 'pipe.attributes.supportLoadInput', objectId(object)),
      ...(source.depLookup ? [audit('DEP_SPAN_TABLE', 'spans.depSpanMm', source.depLookup.depSpanMm, { nps: source.depLookup.nps, pipeOdMm: source.depLookup.pipeOdMm })] : []),
      ...source.auditRows
    ])
  };
  return Object.freeze({ ...input, readiness: readiness(input) });
}

function withPipeInput(pipe, input, refs = []) {
  const autoSpanBySupport = {};
  for (const ref of refs) if (ref.autoSpanMm !== null) autoSpanBySupport[ref.supportTag || ref.supportId] = ref.autoSpanMm;
  const next = Object.freeze({ ...input, supportRefs: Object.freeze(refs), spans: Object.freeze({ ...input.spans, autoSpanBySupport: Object.freeze(autoSpanBySupport) }) });
  return Object.freeze({ ...pipe, attributes: Object.freeze({ ...(pipe.attributes || {}), supportLoadInput: next }), supportLoadInput: next });
}
function supportDetails(support) {
  const raw = rawFields(support);
  return {
    supportType: text(support?.support?.supportType || raw.SUPPORT_KIND || raw.SUPPORT_TYPE || 'GENERIC_SUPPORT'),
    supportTag: text(support?.support?.supportTag || raw.REF || raw.PS || raw.SUPPORT_TAG),
    attachedPipeOdMm: firstNumber(support?.pipe?.odMm, raw.ATTACHED_PIPE_OD),
    autoSpanMm: firstNumber(support?.spans?.autoSpanMm, rawValue(raw, ['AutoSpan', 'AUTOSPAN_MM', 'AUTO_SPAN_MM']))
  };
}
function bestPipeForSupport(support, pipes) {
  let best = null;
  for (const pipe of pipes) {
    const details = supportDetails(support);
    const input = pipe.attributes?.supportLoadInput || buildPipeSupportLoadInput(pipe);
    let score = 0;
    const reasons = [];
    if (norm(lineKey(support)) && norm(lineKey(support)) === norm(input.identity.branchKey || input.identity.lineNo)) { score += 8; reasons.push('line-key'); }
    if (details.attachedPipeOdMm !== null && input.identity.pipeOdMm !== null && Math.abs(details.attachedPipeOdMm - input.identity.pipeOdMm) <= 1) { score += 3; reasons.push('attached-od'); }
    const d = distance(centerOf(support), centerOf(pipe));
    if (Number.isFinite(d) && d <= Math.max(300, (input.identity.pipeOdMm || 100) * 4)) { score += 2; reasons.push('nearest-center'); }
    if (score && (!best || score > best.score || (score === best.score && (d ?? Infinity) < (best.distanceMm ?? Infinity)))) best = { pipe, score, distanceMm: Number.isFinite(d) ? round3(d) : null, reasons };
  }
  return best;
}
function supportRef(support, match) {
  const details = supportDetails(support);
  const input = match?.pipe?.attributes?.supportLoadInput || null;
  return Object.freeze({
    schema: SUPPORT_LOAD_INPUT_REF_SCHEMA,
    supportId: objectId(support),
    supportTag: details.supportTag,
    supportType: details.supportType,
    associatedPipeId: match?.pipe ? objectId(match.pipe) : '',
    associatedLineNo: input?.identity?.lineNo || '',
    matchMethod: match?.reasons?.join('+') || 'none',
    matchScore: match?.score || 0,
    distanceMm: match?.distanceMm ?? null,
    autoSpanMm: details.autoSpanMm,
    review: Object.freeze({ associationStatus: match ? 'AUTO_MATCHED' : 'NO_PIPE_MATCH', reviewerLocked: false })
  });
}

export function hydratePipeSupportLoadInputs(mappedObjects = []) {
  const objects = (Array.isArray(mappedObjects) ? mappedObjects : []).slice(0, MAX_OBJECTS).filter(object => object && !isRejected(object));
  const pipes = objects.filter(isPipe).map(pipe => withPipeInput(pipe, buildPipeSupportLoadInput(pipe)));
  const refs = new Map();
  const matches = new Map();
  for (const support of objects.filter(isSupport)) {
    const match = bestPipeForSupport(support, pipes);
    matches.set(objectId(support), match);
    if (match?.pipe) {
      const pipeId = objectId(match.pipe);
      if (!refs.has(pipeId)) refs.set(pipeId, []);
      refs.get(pipeId).push(supportRef(support, match));
    }
  }
  const finalPipes = pipes.map(pipe => withPipeInput(pipe, pipe.attributes.supportLoadInput, refs.get(objectId(pipe)) || []));
  const byId = new Map(finalPipes.map(pipe => [objectId(pipe), pipe]));
  const finalObjects = objects.map(object => isPipe(object) ? byId.get(objectId(object)) || object : isSupport(object) ? Object.freeze({ ...object, attributes: Object.freeze({ ...(object.attributes || {}), supportLoadInputRef: supportRef(object, matches.get(objectId(object))) }) }) : object);
  return Object.freeze({ objects: Object.freeze(finalObjects), pipes: Object.freeze(finalPipes), supports: Object.freeze(finalObjects.filter(isSupport)) });
}
function rowForSupport(support, pipe) {
  const ref = support.attributes?.supportLoadInputRef || supportRef(support, null);
  const input = pipe?.attributes?.supportLoadInput || null;
  const missing = input ? (input.readiness.missing || []).map(field => `pipe.attributes.supportLoadInput.${field}`) : ['pipe.attributes.supportLoadInput'];
  const warnings = [];
  if (!pipe) warnings.push('no-associated-pipe-candidate');
  if (missing.length) warnings.push(`missing-required-fields:${missing.join('|')}`);
  return Object.freeze({
    schemaVersion: 'support-load-input-row/v1',
    objectId: objectId(support),
    displayName: text(support.displayName || support.id),
    family: 'SUPPORT',
    supportType: ref.supportType,
    supportTag: ref.supportTag,
    status: input?.readiness?.status || 'BLOCKED',
    missingFields: Object.freeze(missing),
    optionalPresent: Object.freeze([]),
    warnings: Object.freeze(warnings),
    input: Object.freeze({ supportRef: ref, pipeSupportLoadInput: input }),
    audit: Object.freeze([{ source: 'SUPPORT_LOAD_INPUT_MODEL', field: 'pipe.attributes.supportLoadInput', objectId: ref.associatedPipeId, status: input?.readiness?.status || 'missing' }, { source: 'SUPPORT_LOAD_INPUT_MODEL', field: 'noLoadFormula', value: true }])
  });
}
export function buildGeometrySupportLoadInputModel(mappedObjects = [], options = {}) {
  const hydrated = hydratePipeSupportLoadInputs(mappedObjects);
  const rows = hydrated.supports.map(support => {
    const pipeId = support.attributes?.supportLoadInputRef?.associatedPipeId;
    return rowForSupport(support, hydrated.pipes.find(pipe => objectId(pipe) === pipeId));
  });
  const pipeReady = hydrated.pipes.filter(pipe => pipe.attributes.supportLoadInput.readiness.status === 'INPUT_READY').length;
  const pipePartial = hydrated.pipes.filter(pipe => pipe.attributes.supportLoadInput.readiness.status === 'PARTIAL_INPUT').length;
  const pipeBlocked = hydrated.pipes.length - pipeReady - pipePartial;
  const ready = rows.filter(row => row.status === 'INPUT_READY').length;
  const blocked = rows.filter(row => row.status === 'BLOCKED').length;
  return Object.freeze({
    schemaVersion: GEOMETRY_SUPPORT_LOAD_INPUT_SCHEMA,
    pipeInputSchema: PIPE_SUPPORT_LOAD_INPUT_SCHEMA,
    version: GEOMETRY_SUPPORT_LOAD_INPUT_VERSION,
    moduleId: SUPPORT_LOAD_INPUT_MODULE_ID,
    displayName: 'Pipe-Level Support Load Input Hydrator',
    evaluatedAt: options.evaluatedAt || new Date().toISOString(),
    objectCount: rows.length,
    pipeCandidateCount: hydrated.pipes.length,
    pipeInputReadyCount: pipeReady,
    pipeInputPartialCount: pipePartial,
    pipeInputBlockedCount: pipeBlocked,
    readyCount: ready,
    partialCount: rows.length - ready - blocked,
    blockedCount: blocked,
    status: blocked || pipeBlocked ? 'BLOCKED' : rows.length || hydrated.pipes.length ? 'INPUT_READY' : 'EMPTY',
    requiredFields: SUPPORT_LOAD_INPUT_REQUIRED_FIELDS,
    hydratedObjects: hydrated.objects,
    pipeInputs: Object.freeze(hydrated.pipes.map(pipe => pipe.attributes.supportLoadInput)),
    rows: Object.freeze(rows),
    noLoadFormula: true,
    assumptions: Object.freeze([
      'This model writes resolved support-load inputs onto pipe.attributes.supportLoadInput before any formula engine can run.',
      'Support rows are references only; support-load formulas must later read pipe.attributes.supportLoadInput.',
      'This phase does not calculate support loads and writes no OPE/HYD/Guide/LineStop result fields.'
    ])
  });
}
export function exampleSupportLoadInputObjects() {
  return [
    { id: 'PIPE-8-P25168', family: 'PIPE', lineNo: '8"-P25168-61502-01', displayName: 'PIPE 8"-P25168-61502-01', rawFields: { NS: 8, PipeOD: 219.075, WALL_THICK: 12.7, TEMP_EXP_C1: 100, TEMP_EXP_C2: 59, DEPSPAN: 10750 }, geometry: { center: { x: 0, y: 0, z: 0 } }, pipe: { odMm: 219.075, wallThicknessMm: 12.7, material: 'LT', weightKgM: 67 }, process: { fluidDensityKgM3: 800, fluidDensityHydKgM3: 1000, temperature1C: 100 } },
    { id: 'SUP-PS-001', family: 'SUPPORT', lineNo: '8"-P25168-61502-01', displayName: 'GUIDE PS-001', geometry: { center: { x: 10, y: -80, z: 0 } }, support: { supportType: 'GUIDE', supportTag: 'PS-001' }, pipe: { odMm: 219.075 } }
  ];
}
