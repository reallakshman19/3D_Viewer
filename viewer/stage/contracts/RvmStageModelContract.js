export const RVM_STAGE_SCHEMA = 'RvmStageModel.v1';
export const RVM_STAGE_DIAGNOSTICS_SCHEMA = 'RvmStageDiagnostics.v1';
export const RVM_STAGE_CONTRACT_VERSION = '20260630-rvm-stage-model-v1-core-1';

export const STAGE_RENDER_QUALITIES = Object.freeze(['full', 'medium', 'light', 'skeleton', 'hidden']);

export const STAGE_RENDER_KINDS = Object.freeze([
  'CYLINDER',
  'BOX',
  'SPHERE',
  'ELBOW',
  'TEE',
  'FLANGE',
  'VALVE_ASSEMBLY',
  'SUPPORT_ASSEMBLY',
  'FOUNDATION',
  'STRUCTURAL_MEMBER',
  'FACET_GROUP',
  'MESH_CHUNK',
  'UNKNOWN_DIAGNOSTIC',
]);

export const STAGE_SEMANTIC_TYPES = Object.freeze([
  'PIPE',
  'ELBOW',
  'TEE',
  'FLANGE',
  'VALVE',
  'SUPPORT',
  'FOUNDATION',
  'STRUCTURAL_MEMBER',
  'T_POST',
  'PLATE',
  'BRACKET',
  'UNKNOWN',
]);

export const STAGE_GEOMETRY_CONFIDENCE = Object.freeze(['native', 'derived', 'semantic-proxy', 'diagnostic']);
export const STAGE_SEMANTIC_CONFIDENCE = Object.freeze(['attribute', 'name-rule', 'geometry-rule', 'unknown']);
export const STAGE_DIAGNOSTIC_SEVERITIES = Object.freeze(['info', 'warning', 'error']);

export function createEmptyRvmStageModel(source = {}) {
  return {
    schema: RVM_STAGE_SCHEMA,
    generator: {
      name: '3D_Viewer browser stage worker',
      version: RVM_STAGE_CONTRACT_VERSION,
    },
    source: {
      fileName: source.fileName || '',
      fileSize: Number(source.fileSize) || 0,
      fileHash: source.fileHash || '',
      units: source.units || 'm',
      coordinateBasis: source.coordinateBasis || 'rvm-native',
    },
    hierarchy: {
      rootId: 'node-root',
      nodes: [],
    },
    materials: [],
    components: [],
    primitives: [],
    geometryChunks: [],
    diagnostics: createEmptyStageDiagnostics(),
  };
}

export function createEmptyStageDiagnostics() {
  return {
    schema: RVM_STAGE_DIAGNOSTICS_SCHEMA,
    severityCounts: { info: 0, warning: 0, error: 0 },
    nativeCodeCounts: {},
    renderKindCounts: {},
    semanticTypeCounts: {},
    fallbackCounts: {},
    messages: [],
  };
}

export function validateRvmStageModel(model) {
  const errors = [];
  if (!model || typeof model !== 'object') return { valid: false, errors: ['model must be an object'] };
  if (model.schema !== RVM_STAGE_SCHEMA) errors.push(`schema must be ${RVM_STAGE_SCHEMA}`);
  if (!model.source || typeof model.source !== 'object') errors.push('source object is required');
  if (!model.hierarchy || typeof model.hierarchy !== 'object') errors.push('hierarchy object is required');
  if (!Array.isArray(model.hierarchy?.nodes)) errors.push('hierarchy.nodes must be an array');
  for (const key of ['materials', 'components', 'primitives', 'geometryChunks']) {
    if (!Array.isArray(model[key])) errors.push(`${key} must be an array`);
  }
  if (!model.diagnostics || model.diagnostics.schema !== RVM_STAGE_DIAGNOSTICS_SCHEMA) errors.push(`diagnostics.schema must be ${RVM_STAGE_DIAGNOSTICS_SCHEMA}`);

  const ids = new Set(['node-root']);
  for (const node of model.hierarchy?.nodes || []) validateNode(node, ids, errors);
  const componentIds = new Set();
  for (const component of model.components || []) validateComponent(component, componentIds, errors);
  const primitiveIds = new Set();
  for (const primitive of model.primitives || []) validatePrimitive(primitive, primitiveIds, componentIds, errors);
  return { valid: errors.length === 0, errors };
}

export function validateNode(node, ids = new Set(), errors = []) {
  if (!node || typeof node !== 'object') { errors.push('hierarchy node must be an object'); return errors; }
  assertStageId(node.id, 'node.id', errors);
  if (node.id && ids.has(node.id)) errors.push(`duplicate node id: ${node.id}`);
  if (node.id) ids.add(node.id);
  if (node.parentId) assertStageId(node.parentId, 'node.parentId', errors);
  if (typeof node.name !== 'string') errors.push(`node ${node.id || '?'} name must be a string`);
  if (node.bboxWorld && !isBbox6(node.bboxWorld)) errors.push(`node ${node.id || '?'} bboxWorld must be [minX,minY,minZ,maxX,maxY,maxZ]`);
  return errors;
}

export function validateComponent(component, componentIds = new Set(), errors = []) {
  if (!component || typeof component !== 'object') { errors.push('component must be an object'); return errors; }
  assertStageId(component.id, 'component.id', errors);
  if (component.id && componentIds.has(component.id)) errors.push(`duplicate component id: ${component.id}`);
  if (component.id) componentIds.add(component.id);
  assertStageId(component.nodeId, `component ${component.id || '?'} nodeId`, errors);
  if (!STAGE_SEMANTIC_TYPES.includes(component.semanticType)) errors.push(`component ${component.id || '?'} semanticType is invalid: ${component.semanticType}`);
  if (!Array.isArray(component.primitiveIds)) errors.push(`component ${component.id || '?'} primitiveIds must be an array`);
  if (component.bboxWorld && !isBbox6(component.bboxWorld)) errors.push(`component ${component.id || '?'} bboxWorld must be [minX,minY,minZ,maxX,maxY,maxZ]`);
  validateConfidence(component.confidence, `component ${component.id || '?'}`, errors);
  validateRenderPolicy(component.renderPolicy, `component ${component.id || '?'}`, errors);
  return errors;
}

export function validatePrimitive(primitive, primitiveIds = new Set(), componentIds = new Set(), errors = []) {
  if (!primitive || typeof primitive !== 'object') { errors.push('primitive must be an object'); return errors; }
  assertStageId(primitive.id, 'primitive.id', errors);
  if (primitive.id && primitiveIds.has(primitive.id)) errors.push(`duplicate primitive id: ${primitive.id}`);
  if (primitive.id) primitiveIds.add(primitive.id);
  assertStageId(primitive.nodeId, `primitive ${primitive.id || '?'} nodeId`, errors);
  if (primitive.componentId && !componentIds.has(primitive.componentId)) errors.push(`primitive ${primitive.id || '?'} componentId does not reference a known component: ${primitive.componentId}`);
  if (!STAGE_RENDER_KINDS.includes(primitive.renderKind)) errors.push(`primitive ${primitive.id || '?'} renderKind is invalid: ${primitive.renderKind}`);
  if (!primitive.native || typeof primitive.native !== 'object') errors.push(`primitive ${primitive.id || '?'} native object is required`);
  if (primitive.native && typeof primitive.native.code !== 'number') errors.push(`primitive ${primitive.id || '?'} native.code must be a number`);
  if (primitive.transform?.bboxLocal && !isBbox6(primitive.transform.bboxLocal)) errors.push(`primitive ${primitive.id || '?'} transform.bboxLocal must be bbox6`);
  if (primitive.transform?.bboxWorld && !isBbox6(primitive.transform.bboxWorld)) errors.push(`primitive ${primitive.id || '?'} transform.bboxWorld must be bbox6`);
  if (primitive.transform?.matrix3x4 && !isMatrix3x4(primitive.transform.matrix3x4)) errors.push(`primitive ${primitive.id || '?'} transform.matrix3x4 must have 12 finite numbers`);
  return errors;
}

export function normalizeRenderQuality(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === '100' || text === '250') return 'full';
  if (text === '75') return 'medium';
  if (text === '50') return 'light';
  if (text === '25') return 'skeleton';
  if (text === '0' || text === 'off' || text === 'hide') return 'hidden';
  return STAGE_RENDER_QUALITIES.includes(text) ? text : 'full';
}

export function isBbox6(value) {
  return Array.isArray(value) && value.length === 6 && value.every(Number.isFinite) && value[0] <= value[3] && value[1] <= value[4] && value[2] <= value[5];
}

export function isMatrix3x4(value) {
  return Array.isArray(value) && value.length === 12 && value.every(Number.isFinite);
}

export function assertStageId(value, label, errors = []) {
  if (typeof value !== 'string' || !value.trim()) errors.push(`${label} must be a non-empty string`);
  return errors;
}

function validateConfidence(confidence, label, errors) {
  if (!confidence || typeof confidence !== 'object') { errors.push(`${label} confidence is required`); return; }
  if (!STAGE_GEOMETRY_CONFIDENCE.includes(confidence.geometry)) errors.push(`${label} confidence.geometry is invalid: ${confidence.geometry}`);
  if (!STAGE_SEMANTIC_CONFIDENCE.includes(confidence.semantic)) errors.push(`${label} confidence.semantic is invalid: ${confidence.semantic}`);
}

function validateRenderPolicy(policy, label, errors) {
  if (!policy || typeof policy !== 'object') { errors.push(`${label} renderPolicy is required`); return; }
  for (const quality of STAGE_RENDER_QUALITIES) {
    if (typeof policy[quality] !== 'string' || !policy[quality]) errors.push(`${label} renderPolicy.${quality} is required`);
  }
}
