export const SUPPORT_LOAD_MASTER_DATA_SCHEMA = 'support-load-master-data/v1';
export const SUPPORT_LOAD_MASTER_DATA_VERSION = '20260622-support-load-master-data-manager-1';

const STORAGE_KEY = 'pcf-glb-support-load-master-data-v1';

const DEFAULT_DEP_SPANS = [
  [0.5, 21.34, 900], [0.75, 26.67, 1400], [1, 33.4, 2200], [1.5, 48.26, 2800],
  [2, 60.325, 2800], [3, 88.9, 6400], [4, 114.3, 6400], [6, 168.275, 9400],
  [8, 219.075, 10750], [10, 273.05, 10750], [12, 323.85, 10750], [14, 355.6, 10750],
  [16, 406.4, 11000], [18, 457.2, 11000], [20, 508, 11500], [24, 609.6, 12000],
  [30, 762, 14000], [36, 914.4, 16000], [42, 1066.8, 18000], [48, 1219.2, 20000]
].map(([nps, pipeOdMm, depSpanMm]) => ({ nps, pipeOdMm, depSpanMm, source: 'DEFAULT_DEP_SPAN_TABLE' }));

const DEFAULT_MATERIAL_DENSITIES = [
  { key: 'LT', aliases: ['LT', 'LOW_TEMP', 'LOW_TEMPERATURE'], densityKgM3: 7850, source: 'DEFAULT_MATERIAL_DENSITY' },
  { key: 'CS', aliases: ['CS', 'CARBON_STEEL', 'A106', 'A53'], densityKgM3: 7850, source: 'DEFAULT_MATERIAL_DENSITY' },
  { key: 'SS', aliases: ['SS', 'STAINLESS', 'STAINLESS_STEEL'], densityKgM3: 8000, source: 'DEFAULT_MATERIAL_DENSITY' }
];

export const DEFAULT_SUPPORT_LOAD_MASTER_DATA = freezeDeep({
  schema: SUPPORT_LOAD_MASTER_DATA_SCHEMA,
  version: SUPPORT_LOAD_MASTER_DATA_VERSION,
  name: 'Access Temperature/Wall Support Load Master Data',
  depSpanRows: DEFAULT_DEP_SPANS,
  materialDensityRows: DEFAULT_MATERIAL_DENSITIES,
  pipeWeightRows: [],
  hydroProfiles: [
    { id: 'WATER_HYDROTEST', label: 'Water hydrotest', densityKgM3: 1000, source: 'DEFAULT_HYDRO_PROFILE' }
  ],
  activeHydroProfileId: 'WATER_HYDROTEST',
  temperatureFunction: { id: 'IDENTITY_TEMP_C', label: 'TempfnC(T)=T', mode: 'identity', points: [], source: 'DEFAULT_TEMP_FUNCTION' },
  formulaProfile: {
    profileId: 'ACCESS_TEMP_WALL_WEIGHTED_V1',
    gravityFactor: 10,
    verticalLoadFactor: 1.1,
    roundMajor: 100,
    roundStep: 50,
    roundMode: 'up',
    tempFunctionId: 'IDENTITY_TEMP_C'
  }
});

let cachedMasterData = null;

function text(value) { return String(value ?? '').trim(); }
function norm(value) { return text(value).toUpperCase().replace(/[^A-Z0-9.]+/g, ''); }
function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}
function freezeDeep(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freezeDeep));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freezeDeep(child)])));
}
function rows(input, fallback) { return Array.isArray(input) ? input : fallback; }
function mergeByKey(defaultRows, customRows, keyFn) {
  const map = new Map();
  for (const row of defaultRows || []) map.set(keyFn(row), row);
  for (const row of customRows || []) map.set(keyFn(row), row);
  return [...map.values()];
}
function normaliseAliases(value) {
  const src = Array.isArray(value) ? value : String(value ?? '').split(/[;,|]/);
  return [...new Set(src.map(norm).filter(Boolean))];
}
function spanRow(row) {
  const nps = num(row?.nps ?? row?.NPS);
  const pipeOdMm = num(row?.pipeOdMm ?? row?.PipeOD ?? row?.odMm);
  const depSpanMm = num(row?.depSpanMm ?? row?.DEP_SPAN ?? row?.supportSpanMm);
  return nps === null || pipeOdMm === null || depSpanMm === null ? null : { nps, pipeOdMm, depSpanMm, source: text(row?.source) || 'PROJECT_DEP_SPAN_TABLE' };
}
function materialRow(row) {
  const densityKgM3 = num(row?.densityKgM3 ?? row?.density ?? row?.materialDensityKgM3);
  const key = norm(row?.key || row?.materialCategory || row?.material || row?.materialCode);
  if (!key || densityKgM3 === null) return null;
  return { key, aliases: normaliseAliases([key, ...(row?.aliases || []), row?.materialCategory, row?.material, row?.materialCode]), densityKgM3, source: text(row?.source) || 'PROJECT_MATERIAL_DENSITY_TABLE' };
}
function pipeWeightRow(row) {
  const unitPipeWtKgPerM = num(row?.unitPipeWtKgPerM ?? row?.weightKgM ?? row?.pipeWtKgPerM);
  if (unitPipeWtKgPerM === null) return null;
  return {
    nps: num(row?.nps ?? row?.NPS),
    pipeOdMm: num(row?.pipeOdMm ?? row?.PipeOD ?? row?.odMm),
    wallThicknessMm: num(row?.wallThicknessMm ?? row?.wall ?? row?.WALL_THICK),
    schedule: norm(row?.schedule),
    material: norm(row?.material),
    materialCode: norm(row?.materialCode),
    materialCategory: norm(row?.materialCategory),
    unitPipeWtKgPerM,
    source: text(row?.source) || 'PROJECT_PIPE_WEIGHT_TABLE'
  };
}
function hydroProfile(row) {
  const densityKgM3 = num(row?.densityKgM3 ?? row?.density);
  const id = norm(row?.id || row?.key || row?.label);
  if (!id || densityKgM3 === null) return null;
  return { id, label: text(row?.label) || id, densityKgM3, source: text(row?.source) || 'PROJECT_HYDRO_PROFILE' };
}

export function normalizeSupportLoadMasterData(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const customSpans = rows(src.depSpanRows || src.depSpans, []).map(spanRow).filter(Boolean);
  const customMaterials = rows(src.materialDensityRows || src.materialDensities, []).map(materialRow).filter(Boolean);
  const customPipeWeights = rows(src.pipeWeightRows || src.pipeWeights, []).map(pipeWeightRow).filter(Boolean);
  const customHydro = rows(src.hydroProfiles, []).map(hydroProfile).filter(Boolean);
  const depSpanRows = mergeByKey(DEFAULT_SUPPORT_LOAD_MASTER_DATA.depSpanRows, customSpans, r => `${r.nps}:${r.pipeOdMm}`);
  const materialDensityRows = mergeByKey(DEFAULT_SUPPORT_LOAD_MASTER_DATA.materialDensityRows, customMaterials, r => r.key);
  const hydroProfiles = mergeByKey(DEFAULT_SUPPORT_LOAD_MASTER_DATA.hydroProfiles, customHydro, r => r.id);
  const formulaSrc = src.formulaProfile || {};
  return freezeDeep({
    schema: SUPPORT_LOAD_MASTER_DATA_SCHEMA,
    version: SUPPORT_LOAD_MASTER_DATA_VERSION,
    name: text(src.name) || DEFAULT_SUPPORT_LOAD_MASTER_DATA.name,
    depSpanRows,
    materialDensityRows,
    pipeWeightRows: customPipeWeights,
    hydroProfiles,
    activeHydroProfileId: norm(src.activeHydroProfileId) || DEFAULT_SUPPORT_LOAD_MASTER_DATA.activeHydroProfileId,
    temperatureFunction: { ...DEFAULT_SUPPORT_LOAD_MASTER_DATA.temperatureFunction, ...(src.temperatureFunction || {}) },
    formulaProfile: {
      ...DEFAULT_SUPPORT_LOAD_MASTER_DATA.formulaProfile,
      ...formulaSrc,
      gravityFactor: num(formulaSrc.gravityFactor) ?? DEFAULT_SUPPORT_LOAD_MASTER_DATA.formulaProfile.gravityFactor,
      verticalLoadFactor: num(formulaSrc.verticalLoadFactor) ?? DEFAULT_SUPPORT_LOAD_MASTER_DATA.formulaProfile.verticalLoadFactor,
      roundMajor: num(formulaSrc.roundMajor) ?? DEFAULT_SUPPORT_LOAD_MASTER_DATA.formulaProfile.roundMajor,
      roundStep: num(formulaSrc.roundStep) ?? DEFAULT_SUPPORT_LOAD_MASTER_DATA.formulaProfile.roundStep,
      roundMode: text(formulaSrc.roundMode || DEFAULT_SUPPORT_LOAD_MASTER_DATA.formulaProfile.roundMode)
    }
  });
}

function browserStorageRead() {
  try { return typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') : null; } catch { return null; }
}
function browserStorageWrite(value) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch {}
}
export function getSupportLoadMasterData(fallback = null) {
  if (cachedMasterData) return cachedMasterData;
  cachedMasterData = normalizeSupportLoadMasterData(fallback || browserStorageRead() || DEFAULT_SUPPORT_LOAD_MASTER_DATA);
  return cachedMasterData;
}
export function setSupportLoadMasterData(nextData, options = {}) {
  cachedMasterData = normalizeSupportLoadMasterData(nextData || DEFAULT_SUPPORT_LOAD_MASTER_DATA);
  if (options.persist !== false) browserStorageWrite(cachedMasterData);
  return cachedMasterData;
}
export function resetSupportLoadMasterData(options = {}) {
  return setSupportLoadMasterData(DEFAULT_SUPPORT_LOAD_MASTER_DATA, options);
}

export function resolveNpsFromOd(masterDataInput, pipeOdMm, toleranceMm = 1.5) {
  const od = num(pipeOdMm);
  if (od === null) return null;
  const masterData = normalizeSupportLoadMasterData(masterDataInput || getSupportLoadMasterData());
  let best = null;
  for (const row of masterData.depSpanRows) {
    const delta = Math.abs(row.pipeOdMm - od);
    if (delta <= toleranceMm && (!best || delta < best.delta)) best = { ...row, delta };
  }
  return best?.nps ?? null;
}
export function resolveDepSpan(masterDataInput, { nps, pipeOdMm } = {}) {
  const masterData = normalizeSupportLoadMasterData(masterDataInput || getSupportLoadMasterData());
  const npsValue = num(nps), od = num(pipeOdMm);
  let row = npsValue !== null ? masterData.depSpanRows.find(item => Math.abs(item.nps - npsValue) < 0.0001) : null;
  if (!row && od !== null) row = masterData.depSpanRows.find(item => Math.abs(item.pipeOdMm - od) <= 1.5) || null;
  return row ? freezeDeep({ ...row, source: row.source || 'SUPPORT_LOAD_MASTER_DATA' }) : null;
}
export function resolveMaterialDensity(masterDataInput, query = {}) {
  const masterData = normalizeSupportLoadMasterData(masterDataInput || getSupportLoadMasterData());
  const keys = [query.materialCategory, query.materialCode, query.material].map(norm).filter(Boolean);
  if (!keys.length) return null;
  for (const row of masterData.materialDensityRows) {
    if (keys.includes(row.key) || row.aliases.some(alias => keys.includes(alias))) return freezeDeep({ ...row, source: row.source || 'SUPPORT_LOAD_MASTER_DATA' });
  }
  return null;
}
export function resolvePipeWeight(masterDataInput, query = {}) {
  const masterData = normalizeSupportLoadMasterData(masterDataInput || getSupportLoadMasterData());
  const nps = num(query.nps), od = num(query.pipeOdMm), wall = num(query.wallThicknessMm);
  let best = null;
  for (const row of masterData.pipeWeightRows) {
    let score = 0;
    if (row.nps !== null && nps !== null && Math.abs(row.nps - nps) < 0.0001) score += 5;
    if (row.pipeOdMm !== null && od !== null && Math.abs(row.pipeOdMm - od) <= 1.5) score += 4;
    if (row.wallThicknessMm !== null && wall !== null && Math.abs(row.wallThicknessMm - wall) <= 0.25) score += 3;
    for (const key of ['schedule', 'material', 'materialCode', 'materialCategory']) if (row[key] && norm(query[key]) === row[key]) score += 1;
    if (score && (!best || score > best.score)) best = { row, score };
  }
  return best ? freezeDeep({ ...best.row, matchScore: best.score }) : null;
}
export function resolveHydroDensity(masterDataInput) {
  const masterData = normalizeSupportLoadMasterData(masterDataInput || getSupportLoadMasterData());
  const active = norm(masterData.activeHydroProfileId);
  const row = masterData.hydroProfiles.find(item => item.id === active) || null;
  return row ? freezeDeep({ ...row, source: row.source || 'SUPPORT_LOAD_MASTER_DATA' }) : null;
}
export function buildSupportLoadMasterDataSummary(masterDataInput = null) {
  const masterData = normalizeSupportLoadMasterData(masterDataInput || getSupportLoadMasterData());
  return freezeDeep({
    schema: SUPPORT_LOAD_MASTER_DATA_SCHEMA,
    version: SUPPORT_LOAD_MASTER_DATA_VERSION,
    name: masterData.name,
    depSpanRowCount: masterData.depSpanRows.length,
    materialDensityRowCount: masterData.materialDensityRows.length,
    pipeWeightRowCount: masterData.pipeWeightRows.length,
    hydroProfileCount: masterData.hydroProfiles.length,
    activeHydroProfileId: masterData.activeHydroProfileId,
    temperatureFunctionId: masterData.temperatureFunction?.id || '',
    formulaProfileId: masterData.formulaProfile?.profileId || '',
    policy: 'Master data hydrates input packages only; formula engine still reads locked pipe.attributes.supportLoadInput only.'
  });
}
