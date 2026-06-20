import { parseRvmArrayBuffer as parseTransformRvmArrayBuffer } from './BrowserRvmTransformParser.js';
import {
  BROWSER_RVM_GEOMETRY_CONTRACT_VERSION,
  BROWSER_RVM_GEOMETRY_QUALITY_VERSION,
  BROWSER_RVM_HIERARCHY_SCHEMA,
  BROWSER_RVM_PRIMITIVE_SEMANTICS_VERSION,
  groupRvmOwnerHierarchy
} from './BrowserRvmHierarchyParser.js';

export const BROWSER_RVM_HIERARCHY_TRANSFORM_SCHEMA = 'browser-rvm-hierarchy-transform-wrapper/v1';
export {
  BROWSER_RVM_GEOMETRY_CONTRACT_VERSION,
  BROWSER_RVM_GEOMETRY_QUALITY_VERSION,
  BROWSER_RVM_HIERARCHY_SCHEMA,
  BROWSER_RVM_PRIMITIVE_SEMANTICS_VERSION,
  groupRvmOwnerHierarchy
};

export async function parseRvmArrayBuffer(arrayBuffer, options = {}) {
  const parsed = await parseTransformRvmArrayBuffer(arrayBuffer, options);
  const hierarchy = groupRvmOwnerHierarchy(parsed.hierarchy || []);
  return {
    ...parsed,
    schemaVersion: BROWSER_RVM_HIERARCHY_TRANSFORM_SCHEMA,
    hierarchy,
    indexJson: flattenHierarchyToIndex(hierarchy),
    diagnostics: {
      ...(parsed.diagnostics || {}),
      hierarchyTransformSchemaVersion: BROWSER_RVM_HIERARCHY_TRANSFORM_SCHEMA,
      hierarchySchemaVersion: BROWSER_RVM_HIERARCHY_SCHEMA,
      hierarchyGrouped: hierarchy[0]?.attributes?.BROWSER_RVM_HIERARCHY_GROUPED === 'true',
      hierarchyGroupCount: Number(hierarchy[0]?.attributes?.BROWSER_RVM_HIERARCHY_GROUP_COUNT || 0),
      primitiveSemantics: 'owner-name-and-rhbg-prim-code-map',
      primitiveSemanticsVersion: BROWSER_RVM_PRIMITIVE_SEMANTICS_VERSION,
      geometryQualityVersion: BROWSER_RVM_GEOMETRY_QUALITY_VERSION,
      geometryContractVersion: BROWSER_RVM_GEOMETRY_CONTRACT_VERSION,
      browserRvmTransformAwareHierarchy: true
    }
  };
}

function flattenHierarchyToIndex(roots) {
  const nodes = [];
  let counter = 1;
  const walk = (node, parentCanonicalObjectId = null, path = '') => {
    const name = String(node?.name || `Node-${counter}`);
    const canonicalObjectId = path ? `${path}/${name}` : name;
    nodes.push({
      id: `BROWSER-RVM-${counter++}`,
      sourceObjectId: canonicalObjectId,
      canonicalObjectId,
      renderObjectIds: [canonicalObjectId],
      name,
      kind: String(node?.type || node?.attributes?.TYPE || 'UNKNOWN').toUpperCase(),
      parentCanonicalObjectId,
      attributes: stringifyAttributes(node?.attributes || {})
    });
    for (const child of Array.isArray(node?.children) ? node.children : []) walk(child, canonicalObjectId, canonicalObjectId);
  };
  for (const root of roots || []) walk(root, null, '');
  return { bundleId: 'Browser-RVM-Import', nodes };
}

function stringifyAttributes(attrs) {
  const out = {};
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null) continue;
    out[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
  return out;
}
