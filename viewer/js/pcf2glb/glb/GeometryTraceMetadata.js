export const BM_CII_GEOMETRY_TRACE_SCHEMA = 'bm-cii-geometry-trace/v1';

function text(value) {
  return String(value ?? '').trim();
}

function upper(value) {
  return text(value).toUpperCase();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const out = text(value);
    if (out) return out;
  }
  return '';
}

function attrsOf(component = {}) {
  return { ...(component.raw || {}), ...(component.attributes || {}) };
}

function nodeValue(component = {}, attrs = {}) {
  return firstNonEmpty(
    component.node,
    component.nodeNumber,
    component.fromNode,
    component.toNode,
    attrs.NODE,
    attrs.Node,
    attrs.NODE_NO,
    attrs.NodeNumber,
    attrs.FROM_NODE,
    attrs.TO_NODE,
  );
}

function fromNodeValue(component = {}, attrs = {}) {
  return firstNonEmpty(component.fromNode, component.from, component.node1, attrs.FROM_NODE, attrs.FromNode, attrs.NODE1);
}

function toNodeValue(component = {}, attrs = {}) {
  return firstNonEmpty(component.toNode, component.to, component.node2, attrs.TO_NODE, attrs.ToNode, attrs.NODE2, component.node);
}

export function semanticCategoryFromComponent(component = {}, extra = {}) {
  const attrs = attrsOf(component);
  const raw = upper([
    component.type,
    component.elementType,
    component.componentType,
    component.typeDesc,
    component.description,
    component.name,
    component.id,
    extra.glbShape,
    extra.supportKind,
    attrs.TYPE,
    attrs.Type,
    attrs.COMPONENT_TYPE,
    attrs.ComponentType,
    attrs.SKEY,
    attrs.SUPPORT_TAG,
  ].join(' '));

  if (raw.includes('SUPPORT') || raw.includes('RESTRAINT') || raw.includes('GUIDE') || raw.includes('LINESTOP') || raw.includes('LINE STOP') || raw.includes('HANGER') || raw.includes('SPRING') || raw.includes('ANCHOR') || raw.includes('SHOE') || raw.includes('REST')) return 'support';
  if (/VALVE|\bVGT\b|\bVGL\b|\bVBA\b|\bVCH\b/.test(raw)) return 'valve';
  if (/FLANGE|\bFLG\b/.test(raw)) return 'flange';
  if (/TEE|OLET|WELDOLET|SOCKOLET/.test(raw)) return 'teeOlet';
  if (/BEND|ELBOW|ELB/.test(raw)) return 'bend';
  if (/PIPE|RIGID|TRIM/.test(raw)) return 'pipe';
  return 'other';
}

export function componentTraceKey(component = {}, extra = {}) {
  const attrs = attrsOf(component);
  const id = firstNonEmpty(component.id, component.refNo, attrs.COMPONENT_IDENTIFIER, attrs['COMPONENT-IDENTIFIER'], attrs['COMPONENT-ATTRIBUTE97']);
  const category = semanticCategoryFromComponent(component, extra);
  const fromNode = fromNodeValue(component, attrs);
  const toNode = toNodeValue(component, attrs);
  const node = nodeValue(component, attrs);
  return [
    'component',
    category,
    id || 'NO_ID',
    fromNode || node || '',
    toNode || node || '',
  ].join('|');
}

export function supportTraceKey(record = {}, supportSource = '') {
  const node = firstNonEmpty(record.node, record.nodeNumber, record.psNode, record.supportNode, record.NODE, record.Node);
  const kind = upper(firstNonEmpty(record.kind, record.type, record.restraintType, record.rawType, record.supportKind, 'UNKNOWN'));
  const source = upper(supportSource || record.source || record.supportSource || record.SOURCE || '');
  const id = firstNonEmpty(record.id, record.supportId, record.refNo, record.name, record.tag, record.SUPPORT_TAG);
  return ['support', source || 'UNKNOWN_SOURCE', kind || 'UNKNOWN', node || 'NO_NODE', id || 'NO_ID'].join('|');
}

export function calloutTraceKey(callout = {}) {
  const no = firstNonEmpty(callout.no, callout.calloutNo, callout.label);
  const node = firstNonEmpty(callout.node, callout.nodeNumber, callout.NODE);
  return ['annotation', 'ISONOTE_CALLOUT', no || 'NO_NO', node || 'NO_NODE'].join('|');
}

export function componentGeometryTrace(component = {}, extra = {}, context = {}) {
  const attrs = attrsOf(component);
  const category = semanticCategoryFromComponent(component, extra);
  const supportSource = firstNonEmpty(
    context.supportSource,
    component.supportSource,
    component.source,
    attrs.SUPPORT_SOURCE,
    attrs['SUPPORT-SOURCE'],
  );
  const supportKind = firstNonEmpty(extra.supportKind, component.supportKind, attrs.SUPPORT_KIND, attrs.SKEY, attrs.SUPPORT_TAG);
  const sourceComponentId = firstNonEmpty(component.id, attrs.COMPONENT_IDENTIFIER, attrs['COMPONENT-IDENTIFIER'], attrs['COMPONENT-ATTRIBUTE97'], component.refNo);

  return {
    schema: BM_CII_GEOMETRY_TRACE_SCHEMA,
    entity: 'component',
    traceKey: componentTraceKey(component, extra),
    sourceComponentId,
    sourceRefNo: firstNonEmpty(component.refNo, attrs['COMPONENT-ATTRIBUTE97'], attrs.REF_NO, attrs.RefNo),
    semanticCategory: category,
    componentType: firstNonEmpty(component.type, component.componentType, attrs.COMPONENT_TYPE, attrs.ComponentType),
    glbShape: firstNonEmpty(extra.glbShape),
    fromNode: fromNodeValue(component, attrs),
    toNode: toNodeValue(component, attrs),
    node: nodeValue(component, attrs),
    lineNo: firstNonEmpty(context.lineNo, extra.lineNo, component.lineNo, attrs.LINE_NO, attrs.LineNo, attrs.Pipeline, component.pipelineRef),
    supportSource,
    supportKind: supportKind ? upper(supportKind) : '',
  };
}

export function annotationGeometryTrace({ callouts = [], nodeCalloutMap = {}, markerCount = 0, source = 'ISONOTE' } = {}) {
  const normalizedCallouts = (callouts || []).map((callout) => ({
    traceKey: calloutTraceKey(callout),
    no: Number(callout.no || callout.calloutNo || 0) || null,
    node: firstNonEmpty(callout.node, callout.nodeNumber, callout.NODE),
    source,
    text: firstNonEmpty(callout.text, callout.caesarCalloutText),
  }));

  return {
    schema: BM_CII_GEOMETRY_TRACE_SCHEMA,
    entity: 'annotation',
    traceKey: 'annotation|CAESAR_ANNOTATION|MERGED',
    semanticCategory: 'annotation',
    annotationKind: 'CAESAR_ANNOTATION_MERGED_CALLOUTS',
    source,
    markerCount: Number(markerCount) || normalizedCallouts.length,
    calloutCount: normalizedCallouts.length,
    calloutNodes: normalizedCallouts.map((callout) => callout.node).filter(Boolean),
    callouts: normalizedCallouts,
    nodeCalloutMap,
  };
}

export function withGeometryTrace(userData = {}, trace = {}) {
  if (!trace || typeof trace !== 'object') return { ...(userData || {}) };
  return {
    ...(userData || {}),
    bmCiiTraceSchema: BM_CII_GEOMETRY_TRACE_SCHEMA,
    bmCiiTrace: trace,
    bmCiiTraceKey: trace.traceKey || '',
    bmCiiTraceEntity: trace.entity || '',
    bmCiiTraceCategory: trace.semanticCategory || '',
    sourceComponentId: trace.sourceComponentId || userData.sourceComponentId || '',
    sourceNode: trace.node || userData.sourceNode || '',
    sourceFromNode: trace.fromNode || userData.sourceFromNode || '',
    sourceToNode: trace.toNode || userData.sourceToNode || '',
    supportSource: trace.supportSource || userData.supportSource || '',
    supportKind: trace.supportKind || userData.supportKind || '',
  };
}

export function applyGeometryTrace(object, trace, { includeChildren = true } = {}) {
  if (!object) return object;
  const apply = (target) => {
    target.userData = withGeometryTrace(target.userData || {}, trace);
  };
  apply(object);
  if (includeChildren && object.traverse) object.traverse((child) => apply(child));
  return object;
}

export function applyComponentGeometryTrace(object, component, context = {}) {
  const trace = componentGeometryTrace(component, object?.userData || {}, context);
  return applyGeometryTrace(object, trace, { includeChildren: true });
}

export function applyAnnotationGeometryTrace(object, annotation = {}) {
  const trace = annotationGeometryTrace(annotation);
  return applyGeometryTrace(object, trace, { includeChildren: true });
}
