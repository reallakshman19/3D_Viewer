import {
  isRvmSourcePreviewKind,
  normalizeRvmSourceKind,
  sourceKindFromFileName,
} from '../RvmSourceKindPolicy.js';
import { RVM_HIERARCHY_PROVIDER_CONTRACT_VERSION, providerResultFromFormatNeutralState } from './RvmHierarchyProviderContract.js';

export const FORMAT_NEUTRAL_HIERARCHY_VERSION = '20260628-format-neutral-shared-kind-policy-1';
export const RVM_PROVIDER_TREE_READ_PATH_VERSION = '20260628-rvm-provider-tree-read-path-1';

function text(value) { return String(value ?? '').trim(); }
function lower(value) { return text(value).toLowerCase(); }
function upper(value) { return text(value).toUpperCase(); }
function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }

export function isSourcePreviewKind(value) {
  return isRvmSourcePreviewKind(value);
}

export function isUxmlLikeDocument(value) {
  return isObject(value) && (
    lower(value.schemaVersion).includes('uxml')
    || upper(value.profile).startsWith('UXML')
    || (Array.isArray(value.components) && Array.isArray(value.anchors) && Array.isArray(value.segments))
  );
}

export function isManagedStageDocument(value) {
  if (!isObject(value)) return false;
  const schema = lower(value.schema || value.schemaVersion || value.converterSchema);
  const profile = upper(value.profile);
  const converter = upper(value.converter || value.sourceConverter || value.converterSchema);
  return schema.includes('managed-stage')
    || schema.includes('stagedjson')
    || profile === 'AVEVA_JSON_FOR_3D_RVM_VIEWER'
    || converter.includes('STAGEDJSON')
    || (Array.isArray(value.hierarchy) && isObject(value.stats) && isObject(value.audit));
}

function isInputXmlSourceKind(value) {
  return normalizeRvmSourceKind(value) === 'inputxml';
}

export function detectJsonDocumentSourceKind(doc, fileName = '') {
  if (isManagedStageDocument(doc)) return 'stagedjson';
  if (isUxmlLikeDocument(doc) || isUxmlLikeDocument(doc?.uxml) || isUxmlLikeDocument(doc?.document)) return 'inputxml';
  const fileKind = sourceKindFromFileName(fileName);
  if (isRvmSourcePreviewKind(fileKind)) return normalizeRvmSourceKind(fileKind);
  return 'json';
}

export function normalizeRvmSourceDocument(doc, fileName = '', adapters = {}) {
  const sourceKind = detectJsonDocumentSourceKind(doc, fileName);
  const uxmlDoc = isUxmlLikeDocument(doc)
    ? doc
    : (isUxmlLikeDocument(doc?.uxml) ? doc.uxml : (isUxmlLikeDocument(doc?.document) ? doc.document : null));
  let hierarchy;
  if (isInputXmlSourceKind(sourceKind) && uxmlDoc && typeof adapters.convertUxmlDocumentToAvevaHierarchy === 'function') {
    hierarchy = adapters.convertUxmlDocumentToAvevaHierarchy(uxmlDoc, { fileName });
  } else if (Array.isArray(doc)) hierarchy = doc;
  else if (Array.isArray(doc?.hierarchy)) hierarchy = doc.hierarchy;
  else if (Array.isArray(doc?.nodes)) hierarchy = doc.nodes;
  else if (Array.isArray(doc?.items)) hierarchy = doc.items;
  else if (uxmlDoc && isInputXmlSourceKind(sourceKind)) hierarchy = uxmlDoc;
  else hierarchy = doc;
  const metadata = {
    version: FORMAT_NEUTRAL_HIERARCHY_VERSION,
    fileName: text(fileName),
    sourceKind,
    schema: text(doc?.schema || doc?.schemaVersion || doc?.converterSchema),
    profile: text(doc?.profile),
    converter: text(doc?.converter || doc?.sourceConverter),
    generatedAt: text(doc?.generatedAt),
    units: isObject(doc?.units) ? doc.units : null,
    stats: isObject(doc?.stats) ? doc.stats : null,
    audit: isObject(doc?.audit) ? doc.audit : null,
  };
  return {
    version: FORMAT_NEUTRAL_HIERARCHY_VERSION,
    sourceKind,
    fileName: text(fileName),
    sourceDocument: doc,
    uxmlDocument: uxmlDoc,
    hierarchy,
    metadata,
  };
}

function providerTreeReadPathEnabled(payload = {}, options = {}) {
  return options.useProviderTreeReadPath === true || payload?.useProviderTreeReadPath === true || globalThis?.__PCF_GLB_RVM_PROVIDER_TREE_READ_PATH__ === true;
}

function providerResultForPayload(payload = {}) {
  return payload?.providerResult
    || payload?.hierarchyProviderResult
    || payload?.rvmHierarchyProviderResult
    || payload?.rvmSourceDocument?.providerResult
    || payload?.rvmSourceDocument?.hierarchyProviderResult
    || payload?.manifest?.providerResult
    || null;
}

function normalizeProviderNode(node = {}) {
  const id = text(node.canonicalObjectId || node.id || node.nodeId);
  const parentId = text(node.parentCanonicalObjectId || node.parentId || node.parent);
  return {
    ...node,
    canonicalObjectId: id,
    parentCanonicalObjectId: parentId,
    name: text(node.name || node.label || node.displayName || id || 'Node'),
    kind: text(node.kind || node.type || node.attributes?.TYPE || 'NODE'),
    renderObjectIds: Array.isArray(node.renderObjectIds) ? node.renderObjectIds : [],
  };
}

export function providerTreeNodesForPayload(payload = {}) {
  const nodes = providerResultForPayload(payload)?.nodes || [];
  return Array.isArray(nodes) ? nodes.map(normalizeProviderNode).filter((node) => node.canonicalObjectId) : [];
}

export function hierarchyNodesForPayload(payload = {}, options = {}) {
  if (providerTreeReadPathEnabled(payload, options)) {
    const providerNodes = providerTreeNodesForPayload(payload);
    if (providerNodes.length) return providerNodes;
  }
  const nodes = payload?.indexJson?.nodes || payload?.manifest?.nodes || payload?.manifest?.items || payload?.manifest?.runtime?.nodes || [];
  return Array.isArray(nodes) ? nodes : [];
}

export function makeHierarchyControllerState({ sourceKind = '', fileName = '', metadata = null, nodes = [] } = {}) {
  const state = {
    version: FORMAT_NEUTRAL_HIERARCHY_VERSION,
    controller: 'format-neutral',
    sourceKind: normalizeRvmSourceKind(sourceKind) || 'unknown',
    fileName: text(fileName),
    nodeCount: Array.isArray(nodes) ? nodes.length : 0,
    metadata: metadata || null,
    nodes: Array.isArray(nodes) ? nodes : [],
  };
  const providerResult = providerResultFromFormatNeutralState(state);
  return { ...state, providerContractVersion: RVM_HIERARCHY_PROVIDER_CONTRACT_VERSION, providerResult, hierarchyProviderResult: providerResult };
}
