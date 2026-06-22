export const GEOMETRY_ENRICHED_STAGEDJSON_SCHEMA = 'geometry-enriched-stagedjson/v1';
export const GEOMETRY_ENRICHED_STAGEDJSON_VERSION = '20260622-geometry-enriched-stagedjson-1';

function text(value) {
  return String(value ?? '').trim();
}

function plain(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function objectKey(object) {
  return text(object?.sourceId || object?.id || object?.canonicalId || object?.displayName);
}

function pickRawRecord(object) {
  return object?.rawRecord && typeof object.rawRecord === 'object' ? object.rawRecord : object;
}

function normalizedElement(object, index) {
  const raw = pickRawRecord(object);
  const enrichment = object.geometryEnrichment || raw.geometryEnrichment || {};
  const enrichedFields = object.enrichedFields || raw.enrichedFields || {};
  const id = objectKey(object) || `GEOM-${index + 1}`;
  return {
    id,
    name: text(object.displayName || raw.displayName || id),
    type: text(object.family || object.objectType || raw.objectClass || raw.objectType || 'OBJECT'),
    sourcePath: text(object.sourcePath || raw.sourcePath),
    hierarchyPath: plain(object.hierarchyPath || raw.hierarchyPath || []),
    geometry: plain(object.geometry || raw.geometry || {}),
    rawFields: plain(raw.rawFields || object.rawFields || {}),
    mappedFields: {
      family: object.family || '',
      objectType: object.objectType || '',
      primitiveKind: object.primitiveKind || '',
      support: plain(object.support || {}),
      pipe: plain(object.pipe || {}),
      lineNo: object.lineNo || '',
      mappingStatus: object.mappingStatus || '',
      mappingConfidence: object.mappingConfidence ?? null,
    },
    enrichedFields: plain(enrichedFields),
    geometryEnrichment: plain(enrichment),
    enrichmentAudit: plain(enrichment.audit || object.enrichmentAudit || []),
    mappingAudit: plain(object.mappingAudit || []),
    review: plain(enrichment.review || {}),
  };
}

function sourceSummary(elements) {
  const byType = {};
  let enriched = 0;
  let review = 0;
  for (const element of elements) {
    const type = element.type || 'OBJECT';
    byType[type] = (byType[type] || 0) + 1;
    if (element.enrichedFields && Object.keys(element.enrichedFields).some((key) => element.enrichedFields[key] !== null && element.enrichedFields[key] !== undefined && element.enrichedFields[key] !== '')) enriched += 1;
    if (element.review?.needsReview) review += 1;
  }
  return { byType, enriched, review };
}

export function buildGeometryEnrichedStagedJson(objects = [], options = {}) {
  const records = Array.isArray(objects) ? objects : [];
  const elements = records.map(normalizedElement);
  const summary = sourceSummary(elements);
  return {
    schemaVersion: GEOMETRY_ENRICHED_STAGEDJSON_SCHEMA,
    version: GEOMETRY_ENRICHED_STAGEDJSON_VERSION,
    generatedAt: new Date().toISOString(),
    source: {
      sourceViewer: '3D_RVM_VIEWER',
      sourceMode: options.sourceMode || 'geometry-workspace-active-enriched-objects',
      objectCount: elements.length,
      enrichedCount: summary.enriched,
      reviewCount: summary.review,
      byType: summary.byType,
    },
    policies: {
      renderedGeometrySource: true,
      noFabricatedEngineeringData: true,
      enrichmentFromRichXmlCiiMasters: true,
      supportLoadFormulaApplied: false,
    },
    masters: plain(options.masterSummary || {}),
    elements,
  };
}

export function downloadGeometryEnrichedStagedJson(payload, fileName = 'geometry-enriched-stagedjson.json') {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
