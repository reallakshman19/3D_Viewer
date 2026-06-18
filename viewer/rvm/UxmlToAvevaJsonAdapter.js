const SUPPORT_TYPES = new Set(['SUPPORT', 'PIPE_SUPPORT', 'PIPESUPPORT', 'ATTA', 'ANCI']);
const BORE_FIELD_BY_ROLE = Object.freeze({
  START: 'ABORE',
  APOS: 'ABORE',
  HEAD: 'HBOR',
  HPOS: 'HBOR',
  END: 'LBORE',
  LPOS: 'LBORE',
  TAIL: 'TBOR',
  TPOS: 'TBOR',
  BRANCH: 'BBORE',
  BPOS: 'BBORE',
  CENTER: 'BORE',
  POS: 'BORE',
});

function clean(value) {
  return String(value ?? '').trim();
}

function upper(value) {
  return clean(value).toUpperCase();
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clonePoint(point) {
  if (!isObject(point)) return null;
  const x = finiteNumber(point.x ?? point.X);
  const y = finiteNumber(point.y ?? point.Y);
  const z = finiteNumber(point.z ?? point.Z);
  return x == null || y == null || z == null ? null : { x, y, z };
}

function midpoint(a, b) {
  if (!a || !b) return null;
  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
    z: (a.z + b.z) * 0.5,
  };
}

function safeName(value, fallback = 'UXML') {
  const text = clean(value) || fallback;
  return text.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim() || fallback;
}

function normalizeType(type) {
  const t = upper(type).replace(/_/g, '-');
  if (!t) return 'UNKNOWN';
  if (t === 'BEND') return 'ELBOW';
  if (t === 'ELBO') return 'ELBOW';
  if (t === 'VALV') return 'VALVE';
  if (t === 'FLAN') return 'FLANGE';
  if (t === 'GASKET') return 'GASK';
  if (t === 'REDU' || t.startsWith('REDUCER')) return 'REDUCER';
  if (t === 'WELDOLET' || t === 'SOCKOLET') return 'OLET';
  if (SUPPORT_TYPES.has(t)) return 'SUPPORT';
  return t;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }
  return '';
}

function toPointIndex(items = []) {
  const map = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (item?.id) map.set(String(item.id), item);
  }
  return map;
}

function pointFromAnchor(anchor) {
  return clonePoint(anchor?.point);
}

function pointFromPort(port, anchorById) {
  const direct = clonePoint(port?.point);
  if (direct) return direct;
  return pointFromAnchor(anchorById.get(String(port?.anchorId || '')));
}

function roleLooksLikeStart(role) {
  const r = upper(role);
  return r === 'START' || r === 'HEAD' || r === 'APOS' || r === 'EP1' || r === 'PIPE_END_1' || r.endsWith('_END_1');
}

function roleLooksLikeEnd(role) {
  const r = upper(role);
  return r === 'END' || r === 'TAIL' || r === 'LPOS' || r === 'TPOS' || r === 'EP2' || r === 'PIPE_END_2' || r.endsWith('_END_2');
}

function roleLooksLikeBranch(role) {
  const r = upper(role);
  return r === 'BRANCH' || r === 'BPOS' || r.includes('BRANCH') || r.includes('TEE_BRANCH') || r.includes('OLET_BRANCH');
}

function roleLooksLikeCenter(role) {
  const r = upper(role);
  return r === 'CENTER' || r === 'POS' || r === 'CP' || r === 'BBOX_CENTER' || r.includes('CENTER');
}

function collectComponentPorts(component, portById) {
  return (Array.isArray(component?.portIds) ? component.portIds : [])
    .map((id) => portById.get(String(id)))
    .filter(Boolean);
}

function collectComponentAnchors(component, anchorById) {
  return (Array.isArray(component?.anchorIds) ? component.anchorIds : [])
    .map((id) => anchorById.get(String(id)))
    .filter(Boolean);
}

function findPortPoint(component, portById, anchorById, predicate) {
  for (const port of collectComponentPorts(component, portById)) {
    if (!predicate(port.role)) continue;
    const point = pointFromPort(port, anchorById);
    if (point) return point;
  }
  for (const anchor of collectComponentAnchors(component, anchorById)) {
    if (!predicate(anchor.role || anchor.sourceField)) continue;
    const point = pointFromAnchor(anchor);
    if (point) return point;
  }
  return null;
}

function firstAnyPoint(component, portById, anchorById) {
  for (const port of collectComponentPorts(component, portById)) {
    const point = pointFromPort(port, anchorById);
    if (point) return point;
  }
  for (const anchor of collectComponentAnchors(component, anchorById)) {
    const point = pointFromAnchor(anchor);
    if (point) return point;
  }
  return null;
}

function resolveSegmentPoints(component, segmentById, anchorById) {
  const segmentIds = Array.isArray(component?.segmentIds) ? component.segmentIds : [];
  for (const id of segmentIds) {
    const segment = segmentById.get(String(id));
    if (!segment) continue;
    const a = pointFromAnchor(anchorById.get(String(segment.startAnchorId || '')));
    const b = pointFromAnchor(anchorById.get(String(segment.endAnchorId || '')));
    if (a && b) return { apos: a, lpos: b, segment };
  }
  return { apos: null, lpos: null, segment: null };
}

function resolveComponentGeometry(component, indexes) {
  const { portById, anchorById, segmentById } = indexes;
  const fromSegment = resolveSegmentPoints(component, segmentById, anchorById);
  const apos = fromSegment.apos || findPortPoint(component, portById, anchorById, roleLooksLikeStart);
  const lpos = fromSegment.lpos || findPortPoint(component, portById, anchorById, roleLooksLikeEnd);
  const bpos = findPortPoint(component, portById, anchorById, roleLooksLikeBranch);
  const cpos = findPortPoint(component, portById, anchorById, roleLooksLikeCenter);
  const pos = cpos || bpos || midpoint(apos, lpos) || firstAnyPoint(component, portById, anchorById);
  return { apos, lpos, bpos, cpos, pos, segment: fromSegment.segment };
}

function mapSupportKind(component = {}, uxml = {}) {
  const support = uxml.supportByComponentId?.get?.(String(component.id || '')) || null;
  const text = [
    support?.type,
    support?.skey,
    component?.rawAttributes?.CMPSUPTYPE,
    component?.rawAttributes?.DTXR,
    component?.rawAttributes?.SKEY,
    component?.name,
  ].map((value) => clean(value).toUpperCase()).join(' ');
  if (/GUIDE/.test(text)) return 'GUIDE';
  if (/LINE\s*STOP|LINESTOP|LIMIT|STOPPER|\bSTOP\b/.test(text)) return 'LINE_STOP';
  if (/ANCHOR|FIXED/.test(text)) return 'ANCHOR';
  if (/REST|SHOE|BASE\s*PLATE|\bBP\b/.test(text)) return 'REST';
  return clean(support?.type || component?.type || 'SUPPORT');
}

function sourceTypeForComponent(component, normType, rawAttrs = {}) {
  // managed_stage.json consumers are sensitive to AVEVA short type names
  // (ELBO/FLAN/REDU/VALV). Preserve the staged source type and carry the
  // canonical UXML type separately instead of replacing the existing contract.
  return firstNonEmpty(rawAttrs.TYPE, rawAttrs.RAW_TYPE, component.type, normType) || normType;
}

function formatBore(value) {
  const n = finiteNumber(value);
  if (n == null || n <= 0) return '';
  return `${Number.isInteger(n) ? n : Number(n.toFixed(3))}mm`;
}

function boreFieldForRole(role, fallback = '') {
  const normalized = upper(role);
  return BORE_FIELD_BY_ROLE[normalized] || fallback || '';
}

function setBoreIfMissing(attrs, field, value) {
  if (!field || attrs[field] != null && clean(attrs[field]) !== '') return;
  const text = formatBore(value);
  if (text) attrs[field] = text;
}

function applyDerivedEndpointBores(attrs, component) {
  const endpointBores = component?.derived?.endpointBores;
  if (!isObject(endpointBores)) return;
  for (const [portKey, info] of Object.entries(endpointBores)) {
    const field = clean(info?.field) || BORE_FIELD_BY_ROLE[upper(portKey)] || '';
    setBoreIfMissing(attrs, field, info?.value);
  }
}

function applyPortBores(attrs, component, indexes) {
  const ports = collectComponentPorts(component, indexes.portById);
  for (const port of ports) {
    const role = upper(port.role);
    const field = clean(port.boreField) || boreFieldForRole(role);
    setBoreIfMissing(attrs, field, port.bore);
    if (roleLooksLikeBranch(role)) {
      setBoreIfMissing(attrs, clean(port.branchBoreField) || 'BBORE', port.branchBore ?? port.bore);
    }
  }
}

function applySegmentBores(attrs, component, indexes) {
  const segmentIds = Array.isArray(component?.segmentIds) ? component.segmentIds : [];
  for (const id of segmentIds) {
    const segment = indexes.segmentById.get(String(id));
    if (!segment) continue;
    setBoreIfMissing(attrs, clean(segment.startBoreField) || 'ABORE', segment.startBore);
    setBoreIfMissing(attrs, clean(segment.endBoreField) || 'LBORE', segment.endBore);
    if (segment.type === 'BRANCH') setBoreIfMissing(attrs, 'BBORE', segment.branchBore ?? segment.endBore);
  }
}

function applyUxmlBoreContract(attrs, component, indexes) {
  // Preserve raw AVEVA fields first. Only restore fields that UXML explicitly
  // carries on ports/segments/derived endpoint metadata. Never expand a single
  // component.bore into HBOR/TBOR/ABORE/LBORE, because OLET/TEE/reducer branch
  // components use different run and branch/end bores.
  applyDerivedEndpointBores(attrs, component);
  applyPortBores(attrs, component, indexes);
  applySegmentBores(attrs, component, indexes);

  const scalarBore = finiteNumber(component.bore);
  if (scalarBore != null && scalarBore > 0 && !attrs.BORE) attrs.BORE = scalarBore;
  const branchBore = finiteNumber(component.branchBore);
  if (branchBore != null && branchBore > 0) setBoreIfMissing(attrs, 'BBORE', branchBore);
}

function buildComponentNode(component, branchName, indexes, uxml) {
  const normType = normalizeType(component.normalizedType || component.type);
  const geom = resolveComponentGeometry(component, indexes);
  const name = safeName(component.name || component.refNo || component.id, `${normType} ${component.id || ''}`);
  const rawAttrs = isObject(component.rawAttributes) ? { ...component.rawAttributes } : {};
  const sourceType = sourceTypeForComponent(component, normType, rawAttrs);
  const attrs = {
    ...rawAttrs,
    TYPE: sourceType,
    NAME: firstNonEmpty(rawAttrs.NAME, component.refNo, name),
    REF: firstNonEmpty(rawAttrs.REF, component.refNo, component.seqNo, component.id, name),
    OWNER: branchName,
    SOURCE_FORMAT: 'UXML',
    UXML_COMPONENT_ID: clean(component.id),
    UXML_PIPELINE_REF: clean(component.pipelineRef),
    UXML_LINE_KEY: clean(component.lineKey),
    UXML_NORMALIZED_TYPE: normType,
  };

  if (geom.apos) attrs.APOS = geom.apos;
  if (geom.lpos) attrs.LPOS = geom.lpos;
  if (geom.bpos) attrs.BPOS = geom.bpos;
  if (geom.cpos) attrs.CPOS = geom.cpos;
  if (geom.pos) attrs.POS = geom.pos;

  applyUxmlBoreContract(attrs, component, indexes);

  if (normType === 'SUPPORT') {
    attrs.CMPSUPTYPE = attrs.CMPSUPTYPE || mapSupportKind(component, uxml);
    attrs.SUPPORT_KIND = attrs.SUPPORT_KIND || attrs.CMPSUPTYPE;
    attrs.SUPPORT_MAPPER_KIND = attrs.SUPPORT_MAPPER_KIND || attrs.CMPSUPTYPE;
  }

  return {
    name,
    type: sourceType,
    attributes: attrs,
  };
}

function pipelineName(pipeline, fallback) {
  return safeName(
    pipeline?.pipelineRef || pipeline?.lineNo || pipeline?.lineKey || pipeline?.id,
    fallback,
  );
}

function parseTrailingOrderToken(value) {
  const text = clean(value);
  if (!text) return null;
  const match = text.match(/(?:^|:)(\d{1,9})$/);
  return match ? finiteNumber(match[1]) : null;
}

function sourceOrder(component) {
  return finiteNumber(component?.seqNo)
    ?? finiteNumber(component?.rawAttributes?.SEQ)
    ?? finiteNumber(component?.rawAttributes?.SEQUENCE)
    ?? finiteNumber(component?.rawAttributes?.SOURCE_INDEX)
    ?? finiteNumber(component?.rawAttributes?.UXML_SOURCE_INDEX)
    ?? parseTrailingOrderToken(component?.id)
    ?? parseTrailingOrderToken(component?.sourceRefs?.[0]?.id)
    ?? null;
}

function compareBySourceOrder(a, b) {
  const aSeq = sourceOrder(a);
  const bSeq = sourceOrder(b);
  if (aSeq != null && bSeq != null && aSeq !== bSeq) return aSeq - bSeq;
  if (aSeq != null && bSeq == null) return -1;
  if (aSeq == null && bSeq != null) return 1;
  return 0;
}

export function isUxmlDocument(value) {
  return isObject(value)
    && (
      String(value.schemaVersion || '').toLowerCase().includes('uxml')
      || String(value.profile || '').toUpperCase().startsWith('UXML')
      || (Array.isArray(value.components) && Array.isArray(value.anchors) && Array.isArray(value.segments))
    );
}

export function convertUxmlDocumentToAvevaHierarchy(doc, options = {}) {
  if (!isUxmlDocument(doc)) {
    throw new Error('Unsupported UXML document. Expected schemaVersion/profile/components/anchors/segments.');
  }

  const anchorById = toPointIndex(doc.anchors);
  const portById = toPointIndex(doc.ports);
  const segmentById = toPointIndex(doc.segments);
  const pipelineById = toPointIndex(doc.pipelines);
  const supportByComponentId = new Map();
  for (const support of Array.isArray(doc.supports) ? doc.supports : []) {
    if (support?.componentId) supportByComponentId.set(String(support.componentId), support);
  }

  const indexes = { anchorById, portById, segmentById };
  const uxmlContext = { supportByComponentId };
  const components = Array.isArray(doc.components) ? doc.components.filter(isObject) : [];
  const grouped = new Map();
  const fallbackPipeline = 'uxml:default-pipeline';

  for (const component of components) {
    const key = clean(component.pipelineRef || component.lineKey || fallbackPipeline) || fallbackPipeline;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(component);
  }

  const hierarchy = [];
  let branchIndex = 0;
  for (const [pipelineRef, groupComponents] of grouped.entries()) {
    branchIndex += 1;
    const pipeline = pipelineById.get(pipelineRef) || null;
    const branchName = pipelineName(pipeline, `UXML_BRANCH_${String(branchIndex).padStart(3, '0')}`);
    const sorted = [...groupComponents].sort(compareBySourceOrder);
    const children = sorted.map((component) => buildComponentNode(component, branchName, indexes, uxmlContext));

    const rawPipelineAttrs = isObject(pipeline?.rawAttributes) ? { ...pipeline.rawAttributes } : {};
    const branchAttrs = {
      ...rawPipelineAttrs,
      TYPE: firstNonEmpty(rawPipelineAttrs.TYPE, 'BRAN'),
      NAME: firstNonEmpty(rawPipelineAttrs.NAME, branchName),
      OWNER: firstNonEmpty(rawPipelineAttrs.OWNER, pipeline?.system, pipeline?.area, doc.header?.modelId, options.fileName, 'UXML'),
      SOURCE_FORMAT: 'UXML',
      UXML_PIPELINE_ID: clean(pipeline?.id || pipelineRef),
      UXML_LINE_KEY: clean(pipeline?.lineKey || pipelineRef),
      SOURCE_FILE: clean(options.fileName || ''),
    };

    const first = children.find((child) => child?.attributes?.APOS || child?.attributes?.POS);
    const last = [...children].reverse().find((child) => child?.attributes?.LPOS || child?.attributes?.POS);
    if (!branchAttrs.HPOS && (first?.attributes?.APOS || first?.attributes?.POS)) branchAttrs.HPOS = first.attributes.APOS || first.attributes.POS;
    if (!branchAttrs.TPOS && (last?.attributes?.LPOS || last?.attributes?.POS)) branchAttrs.TPOS = last.attributes.LPOS || last.attributes.POS;

    hierarchy.push({
      name: branchName,
      type: 'BRANCH',
      attributes: branchAttrs,
      children,
    });
  }

  if (!hierarchy.length) {
    throw new Error('UXML import produced no branch hierarchy. Check components/pipelines in the UXML sidecar.');
  }

  return hierarchy;
}
