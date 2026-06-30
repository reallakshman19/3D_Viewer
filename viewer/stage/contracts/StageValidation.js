import {
  RVM_STAGE_DIAGNOSTICS_SCHEMA,
  RVM_STAGE_SCHEMA,
  STAGE_GEOMETRY_CONFIDENCE,
  STAGE_RENDER_KINDS,
  STAGE_RENDER_QUALITIES,
  STAGE_SEMANTIC_CONFIDENCE,
  STAGE_SEMANTIC_TYPES,
} from './StageConstants.js';

export function validateRvmStageModel(model) {
  const errors = [];
  if (!model || typeof model !== 'object') return invalid('model must be an object');
  validateStageModelShape(model, errors);

  const nodeIds = new Set([model.hierarchy?.rootId || 'node-root']);
  for (const node of model.hierarchy?.nodes || []) validateStageNode(node, nodeIds, errors);

  const componentIds = new Set();
  for (const component of model.components || []) validateStageComponent(component, componentIds, errors);

  const primitiveIds = new Set();
  for (const primitive of model.primitives || []) validateStagePrimitive(primitive, primitiveIds, componentIds, errors);

  validateReferences(model, nodeIds, componentIds, primitiveIds, errors);
  return { valid: errors.length === 0, errors };
}

export function validateStageNode(node, ids = new Set(), errors = []) {
  if (!node || typeof node !== 'object') return push(errors, 'hierarchy node must be an object');
  assertStageId(node.id, 'node.id', errors);
  if (node.id && ids.has(node.id)) errors.push(`STAGE_MISSING_ID duplicate node id: ${node.id}`);
  if (node.id) ids.add(node.id);
  if (node.parentId) assertStageId(node.parentId, 'node.parentId', errors);
  if (typeof node.name !== 'string') errors.push(`node ${node.id || '?'} name must be a string`);
  validateOptionalIdArray(node.componentIds, `node ${node.id || '?'} componentIds`, errors);
  validateOptionalIdArray(node.primitiveIds, `node ${node.id || '?'} primitiveIds`, errors);
  validateOptionalBbox(node.bboxWorld, `node ${node.id || '?'} bboxWorld`, errors);
  return errors;
}

export function validateStageComponent(component, componentIds = new Set(), errors = []) {
  if (!component || typeof component !== 'object') return push(errors, 'component must be an object');
  assertStageId(component.id, 'component.id', errors);
  if (component.id && componentIds.has(component.id)) errors.push(`STAGE_MISSING_ID duplicate component id: ${component.id}`);
  if (component.id) componentIds.add(component.id);
  assertStageId(component.nodeId, `component ${component.id || '?'} nodeId`, errors);
  if (!STAGE_SEMANTIC_TYPES.includes(component.semanticType)) errors.push(`component ${component.id || '?'} semanticType is invalid: ${component.semanticType}`);
  if (!Array.isArray(component.primitiveIds)) errors.push(`component ${component.id || '?'} primitiveIds must be an array`);
  validateOptionalBbox(component.bboxWorld, `component ${component.id || '?'} bboxWorld`, errors);
  validateConfidence(component.confidence, `component ${component.id || '?'}`, errors);
  validateRenderPolicy(component.renderPolicy, `component ${component.id || '?'}`, errors);
  return errors;
}

export function validateStagePrimitive(primitive, primitiveIds = new Set(), componentIds = new Set(), errors = []) {
  if (!primitive || typeof primitive !== 'object') return push(errors, 'primitive must be an object');
  assertStageId(primitive.id, 'primitive.id', errors);
  if (primitive.id && primitiveIds.has(primitive.id)) errors.push(`STAGE_MISSING_ID duplicate primitive id: ${primitive.id}`);
  if (primitive.id) primitiveIds.add(primitive.id);
  assertStageId(primitive.nodeId, `primitive ${primitive.id || '?'} nodeId`, errors);
  validatePrimitiveComponentRef(primitive, componentIds, errors);
  validatePrimitiveNative(primitive, errors);
  validatePrimitiveTransform(primitive, errors);
  validateConfidence(primitive.confidence, `primitive ${primitive.id || '?'}`, errors);
  validateRenderKind(primitive, errors);
  validateSemanticOnlyFallback(primitive, errors);
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
  if (typeof value !== 'string' || !value.trim()) errors.push(`STAGE_MISSING_ID ${label} must be a non-empty string`);
  return errors;
}

export const validateNode = validateStageNode;
export const validateComponent = validateStageComponent;
export const validatePrimitive = validateStagePrimitive;

function validateStageModelShape(model, errors) {
  if (model.schema !== RVM_STAGE_SCHEMA) errors.push(`schema must be ${RVM_STAGE_SCHEMA}`);
  if (!model.source || typeof model.source !== 'object') errors.push('source object is required');
  if (!model.hierarchy || typeof model.hierarchy !== 'object') errors.push('hierarchy object is required');
  if (!Array.isArray(model.hierarchy?.nodes)) errors.push('hierarchy.nodes must be an array');
  for (const key of ['materials', 'components', 'primitives', 'geometryChunks']) {
    if (!Array.isArray(model[key])) errors.push(`${key} must be an array`);
  }
  if (model.diagnostics?.schema !== RVM_STAGE_DIAGNOSTICS_SCHEMA) errors.push(`diagnostics.schema must be ${RVM_STAGE_DIAGNOSTICS_SCHEMA}`);
}

function validateReferences(model, nodeIds, componentIds, primitiveIds, errors) {
  for (const component of model.components || []) {
    if (!nodeIds.has(component.nodeId)) errors.push(`component ${component.id || '?'} nodeId is unknown: ${component.nodeId}`);
    for (const id of component.primitiveIds || []) if (!primitiveIds.has(id)) errors.push(`component ${component.id || '?'} primitiveId is unknown: ${id}`);
  }
  for (const primitive of model.primitives || []) {
    if (!nodeIds.has(primitive.nodeId)) errors.push(`primitive ${primitive.id || '?'} nodeId is unknown: ${primitive.nodeId}`);
  }
}

function validatePrimitiveComponentRef(primitive, componentIds, errors) {
  if (primitive.componentId) assertStageId(primitive.componentId, `primitive ${primitive.id || '?'} componentId`, errors);
  if (primitive.componentId && !componentIds.has(primitive.componentId)) errors.push(`primitive ${primitive.id || '?'} componentId does not reference a known component: ${primitive.componentId}`);
}

function validatePrimitiveNative(primitive, errors) {
  if (!primitive.native || typeof primitive.native !== 'object') return errors.push(`primitive ${primitive.id || '?'} native object is required`);
  if (typeof primitive.native.code !== 'number') errors.push(`primitive ${primitive.id || '?'} native.code must be a number`);
  if (primitive.native.decoded === false && primitive.renderKind !== 'UNKNOWN_DIAGNOSTIC') errors.push(`STAGE_UNDECODED_NATIVE_PRIMITIVE primitive ${primitive.id || '?'} must render as UNKNOWN_DIAGNOSTIC until decoded`);
}

function validatePrimitiveTransform(primitive, errors) {
  const transform = primitive.transform || {};
  validateOptionalBbox(transform.bboxLocal, `primitive ${primitive.id || '?'} transform.bboxLocal`, errors);
  validateOptionalBbox(transform.bboxWorld, `primitive ${primitive.id || '?'} transform.bboxWorld`, errors);
  if (transform.matrix3x4 && !isMatrix3x4(transform.matrix3x4)) errors.push(`primitive ${primitive.id || '?'} transform.matrix3x4 must have 12 finite numbers`);
}

function validateRenderKind(primitive, errors) {
  if (!STAGE_RENDER_KINDS.includes(primitive.renderKind)) errors.push(`STAGE_INVALID_RENDER_KIND primitive ${primitive.id || '?'} renderKind is invalid: ${primitive.renderKind}`);
  if (primitive.renderKind === 'UNKNOWN_DIAGNOSTIC' && !hasFallbackDiagnostic(primitive)) errors.push(`primitive ${primitive.id || '?'} UNKNOWN_DIAGNOSTIC requires a fallback diagnostic`);
}

function validateSemanticOnlyFallback(primitive, errors) {
  if (primitive.confidence?.geometry !== 'semantic-proxy') return;
  if (primitive.renderKind === 'UNKNOWN_DIAGNOSTIC' && hasFallbackDiagnostic(primitive)) return;
  errors.push(`STAGE_FALLBACK_SEMANTIC_ONLY_GEOMETRY primitive ${primitive.id || '?'} semantic-only geometry must not choose visible geometry`);
}

function hasFallbackDiagnostic(primitive) {
  return (primitive.diagnostics || []).some((item) => item?.code?.startsWith('STAGE_FALLBACK_') && item?.fallback);
}

function validateConfidence(confidence, label, errors) {
  if (!confidence || typeof confidence !== 'object') return errors.push(`${label} confidence is required`);
  if (!STAGE_GEOMETRY_CONFIDENCE.includes(confidence.geometry)) errors.push(`${label} confidence.geometry is invalid: ${confidence.geometry}`);
  if (!STAGE_SEMANTIC_CONFIDENCE.includes(confidence.semantic)) errors.push(`${label} confidence.semantic is invalid: ${confidence.semantic}`);
}

function validateRenderPolicy(policy, label, errors) {
  if (!policy || typeof policy !== 'object') return errors.push(`STAGE_MISSING_RENDER_POLICY ${label} renderPolicy is required`);
  for (const quality of STAGE_RENDER_QUALITIES) {
    if (typeof policy[quality] !== 'string' || !policy[quality]) errors.push(`STAGE_MISSING_RENDER_POLICY ${label} renderPolicy.${quality} is required`);
  }
}

function validateOptionalBbox(value, label, errors) {
  if (value && !isBbox6(value)) errors.push(`STAGE_INVALID_BBOX ${label} must be [minX,minY,minZ,maxX,maxY,maxZ]`);
}

function validateOptionalIdArray(value, label, errors) {
  if (value !== undefined && !Array.isArray(value)) errors.push(`${label} must be an array`);
}

function push(errors, message) {
  errors.push(message);
  return errors;
}

function invalid(message) {
  return { valid: false, errors: [message] };
}
