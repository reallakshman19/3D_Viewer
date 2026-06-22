export const GEOMETRY_CALCULATION_CANVAS_SCHEMA = 'geometry-calculation-canvas/v1';
export const GEOMETRY_CALCULATION_CANVAS_VERSION = '20260622-geometry-calc-canvas-1';

const SUPPORT_LOAD_MODULE_ID = 'support-load-readiness/v1';
const MAX_CALC_OBJECTS = 80000;

const SUPPORT_LOAD_REQUIRED_FIELDS = Object.freeze([
  'family',
  'support.supportType',
  'geometry.center',
  'pipe.odMm',
  'pipe.wallThicknessMm',
  'pipe.material',
  'process.fluidDensityKgM3'
]);

const SUPPORT_LOAD_OPTIONAL_FIELDS = Object.freeze([
  'support.supportTag',
  'support.gapMm',
  'geometry.lengthMm',
  'geometry.axis',
  'lineNo',
  'pipe.schedule',
  'process.pressureBar',
  'process.temperatureC',
  'pipe.insulationThicknessMm',
  'pipe.insulationDensityKgM3'
]);

export const GEOMETRY_CALCULATION_MODULES = Object.freeze([
  Object.freeze({
    moduleId: SUPPORT_LOAD_MODULE_ID,
    displayName: 'Support Load Readiness',
    schemaVersion: GEOMETRY_CALCULATION_CANVAS_SCHEMA,
    requiredFields: SUPPORT_LOAD_REQUIRED_FIELDS,
    optionalFields: SUPPORT_LOAD_OPTIONAL_FIELDS,
    description: 'Validates confirmed mapped support objects before support-load formulas are allowed to run.'
  })
]);

export function valueAtPath(input, path) {
  if (!input || !path) return undefined;
  const parts = String(path).split('.');
  let current = input;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

function hasValue(input, path) {
  const value = valueAtPath(input, path);
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function normalizeMappedObjects(mappedObjects) {
  return (Array.isArray(mappedObjects) ? mappedObjects : [])
    .slice(0, MAX_CALC_OBJECTS)
    .filter(Boolean);
}

function isRejected(object) {
  return String(object?.mappingStatus || '').toUpperCase() === 'REJECTED';
}

function supportRows(mappedObjects) {
  return normalizeMappedObjects(mappedObjects).filter((object) => object.family === 'SUPPORT' && !isRejected(object));
}

function readinessForObject(object, module = GEOMETRY_CALCULATION_MODULES[0]) {
  const missingFields = [];
  const presentFields = [];
  for (const field of module.requiredFields || []) {
    if (field === 'family') {
      if (object.family === 'SUPPORT') presentFields.push(field);
      else missingFields.push(field);
      continue;
    }
    if (hasValue(object, field)) presentFields.push(field);
    else missingFields.push(field);
  }
  const optionalPresent = (module.optionalFields || []).filter((field) => hasValue(object, field));
  const status = missingFields.length ? 'BLOCKED' : 'READY';
  return Object.freeze({
    objectId: object.sourceId || object.id,
    displayName: object.displayName || object.id,
    family: object.family || 'UNKNOWN',
    supportType: object.support?.supportType || '',
    supportTag: object.support?.supportTag || '',
    mappingStatus: object.mappingStatus || 'UNKNOWN',
    mappingConfidence: object.mappingConfidence || 0,
    status,
    presentFields,
    missingFields,
    optionalPresent,
    warnings: missingFields.length
      ? [`Missing required calculation field(s): ${missingFields.join(', ')}`]
      : []
  });
}

export function evaluateSupportLoadReadiness(mappedObjects, options = {}) {
  const module = GEOMETRY_CALCULATION_MODULES.find((item) => item.moduleId === SUPPORT_LOAD_MODULE_ID);
  const rows = supportRows(mappedObjects).map((object) => readinessForObject(object, module));
  const readyCount = rows.filter((row) => row.status === 'READY').length;
  const blockedCount = rows.length - readyCount;
  const rejectedCount = normalizeMappedObjects(mappedObjects).filter(isRejected).length;
  const result = Object.freeze({
    schemaVersion: GEOMETRY_CALCULATION_CANVAS_SCHEMA,
    version: GEOMETRY_CALCULATION_CANVAS_VERSION,
    moduleId: SUPPORT_LOAD_MODULE_ID,
    displayName: module.displayName,
    evaluatedAt: options.evaluatedAt || new Date().toISOString(),
    objectCount: rows.length,
    readyCount,
    blockedCount,
    rejectedCount,
    status: rows.length === 0 ? 'EMPTY' : blockedCount ? 'BLOCKED' : 'READY',
    requiredFields: module.requiredFields,
    optionalFields: module.optionalFields,
    rows,
    assumptions: Object.freeze([
      'This phase validates calculation readiness only; it does not calculate support loads.',
      'Rendered geometry values remain review geometry and must be confirmed before calculation use.',
      'Missing schedule, material, process, or weight data blocks the support-load module.'
    ])
  });
  return result;
}

export function evaluateGeometryCalculationModules(mappedObjects, options = {}) {
  const supportLoad = evaluateSupportLoadReadiness(mappedObjects, options);
  return Object.freeze({
    schemaVersion: GEOMETRY_CALCULATION_CANVAS_SCHEMA,
    version: GEOMETRY_CALCULATION_CANVAS_VERSION,
    evaluatedAt: supportLoad.evaluatedAt,
    moduleCount: GEOMETRY_CALCULATION_MODULES.length,
    modules: GEOMETRY_CALCULATION_MODULES,
    results: Object.freeze([supportLoad]),
    summary: Object.freeze({
      readyModules: supportLoad.status === 'READY' ? 1 : 0,
      blockedModules: supportLoad.status === 'BLOCKED' ? 1 : 0,
      emptyModules: supportLoad.status === 'EMPTY' ? 1 : 0,
      supportCandidates: supportLoad.objectCount,
      supportReady: supportLoad.readyCount,
      supportBlocked: supportLoad.blockedCount
    })
  });
}

export function findGeometryCalculationModule(moduleId) {
  return GEOMETRY_CALCULATION_MODULES.find((module) => module.moduleId === moduleId) || null;
}
