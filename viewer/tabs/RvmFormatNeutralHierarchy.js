export const FORMAT_NEUTRAL_HIERARCHY_VERSION = '20260627-format-neutral-hierarchy-1';

const SOURCE_PREVIEW_KINDS = new Set(['json', 'jscon', 'inputxml', 'uxml', 'txt', 'source-preview', 'stagedjson']);

function text(value) {
  return String(value ?? '').trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function upper(value) {
  return text(value).toUpperCase();
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isSourcePreviewKind(value) {
  return SOURCE_PREVIEW_KINDS.has(lower(value));
}

export function isUxmlLikeDocument(value) {
  return isObject(value)
    && (
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

export function detectJsonDocumentSourceKind(doc, fileName = '') {
  const name = lower(fileName);
  if (isManagedStageDocument(doc)) return 'stagedjson';
  if (isUxmlLikeDocument(doc) || isUxmlLikeDocument(doc?.uxml) || isUxmlLikeDocument(doc?.document)) return 'uxml';
  if (/\.jscon$/i.test(name)) return 'jscon';
  if (/\.txt$/i.test(name)) return 'txt';
  if (/\.uxml(?:\.json)?$/i.test(name)) return 'uxml';
  if (/\.stagedjson$/i.test(name) || /managed[_-]stage\.json$/i.test(name)) return 'stagedjson';
  return 'json';
}

export function normalizeRvmSourceDocument(doc, fileName = '', adapters = {}) {
  const sourceKind = detectJsonDocumentSourceKind(doc, fileName);
  const uxmlDoc = isUxmlLikeDocument(doc) ? doc : (isUxmlLikeDocument(doc?.uxml) ? doc.uxml : (isUxmlLikeDocument(doc?.document) ? doc.document : null));
  let hierarchy;

  if (sourceKind === 'uxml' && uxmlDoc && typeof adapters.convertUxmlDocumentToAvevaHierarchy === 'function') {
    hierarchy = adapters.convertUxmlDocumentToAvevaHierarchy(uxmlDoc, { fileName });
  } else if (Array.isArray(doc)) {
    hierarchy = doc;
  } else if (Array.isArray(doc?.hierarchy)) {
    hierarchy = doc.hierarchy;
  } else if (Array.isArray(doc?.nodes)) {
    hierarchy = doc.nodes;
  } else if (Array.isArray(doc?.items)) {
    hierarchy = doc.items;
  } else if (uxmlDoc && sourceKind === 'uxml') {
    hierarchy = uxmlDoc;
  } else {
    hierarchy = doc;
  }

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

export function hierarchyNodesForPayload(payload = {}) {
  const nodes = payload?.indexJson?.nodes
    || payload?.manifest?.nodes
    || payload?.manifest?.items
    || payload?.manifest?.runtime?.nodes
    || [];
  return Array.isArray(nodes) ? nodes : [];
}

export function makeHierarchyControllerState({ sourceKind = '', fileName = '', metadata = null, nodes = [] } = {}) {
  return {
    version: FORMAT_NEUTRAL_HIERARCHY_VERSION,
    controller: 'format-neutral',
    sourceKind: lower(sourceKind) || 'unknown',
    fileName: text(fileName),
    nodeCount: Array.isArray(nodes) ? nodes.length : 0,
    metadata: metadata || null,
  };
}
