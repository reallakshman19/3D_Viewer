import { parseRvmArrayBuffer as parseFlatRvmArrayBuffer } from './BrowserRvmParser.js';

export const BROWSER_RVM_HIERARCHY_SCHEMA = 'browser-rvm-hierarchy-wrapper/v2';

const RVM_PRIM_CODE_SEMANTICS = {
  2: { type: 'BOX', kind: 'BOX', primitiveClass: 'BOX' },
  3: { type: 'GASK', kind: 'TORUS', primitiveClass: 'TORUS' },
  4: { type: 'ELBOW', kind: 'ELBOW', primitiveClass: 'ELBOW' },
  5: { type: 'BOX', kind: 'AUXILIARY_SOLID', primitiveClass: 'AUXILIARY_SOLID' },
  7: { type: 'FLANGE', kind: 'FLANGE', primitiveClass: 'FLANGE' },
  8: { type: 'PIPE', kind: 'CYLINDER', primitiveClass: 'CYLINDER' },
  11: { type: 'INSTRUMENT', kind: 'INSTRUMENT', primitiveClass: 'INSTRUMENT' }
};

export async function parseRvmArrayBuffer(arrayBuffer, options = {}) {
  const parsed = await parseFlatRvmArrayBuffer(arrayBuffer, options);
  const hierarchy = groupRvmOwnerHierarchy(parsed.hierarchy || []);
  return {
    ...parsed,
    hierarchy,
    indexJson: flattenHierarchyToIndex(hierarchy),
    diagnostics: {
      ...(parsed.diagnostics || {}),
      hierarchySchemaVersion: BROWSER_RVM_HIERARCHY_SCHEMA,
      hierarchyGrouped: hierarchy[0]?.attributes?.BROWSER_RVM_HIERARCHY_GROUPED === 'true',
      hierarchyGroupCount: Number(hierarchy[0]?.attributes?.BROWSER_RVM_HIERARCHY_GROUP_COUNT || 0),
      primitiveSemantics: 'owner-name-and-rhbg-prim-code-map'
    }
  };
}

export function groupRvmOwnerHierarchy(roots = []) {
  return roots.map((root) => {
    const children = Array.isArray(root?.children) ? root.children : [];
    const ownerChildren = children.filter((child) => String(child?.attributes?.RVM_OWNER_NAME || '').trim());
    if (!ownerChildren.length) return root;

    const groupedRoot = {
      ...root,
      attributes: {
        ...(root.attributes || {}),
        BROWSER_RVM_HIERARCHY_GROUPED: 'true',
        BROWSER_RVM_HIERARCHY_SCHEMA: BROWSER_RVM_HIERARCHY_SCHEMA,
        BROWSER_RVM_PRIMITIVE_SEMANTICS: 'owner-name-and-rhbg-prim-code-map'
      },
      children: []
    };
    const rootState = { childByKey: new Map() };
    let groupCount = 0;

    for (const child of children) {
      const ownerName = String(child?.attributes?.RVM_OWNER_NAME || '').trim();
      if (!ownerName) {
        groupedRoot.children.push(child);
        continue;
      }
      const path = ownerPathFromName(ownerName);
      let parent = groupedRoot;
      let state = rootState;
      for (let depth = 0; depth < path.length; depth += 1) {
        const segment = path[depth];
        const key = canonicalSegmentKey(segment, depth);
        let branch = state.childByKey.get(key);
        if (!branch) {
          branch = makeBranchNode(segment, depth, path, ownerName);
          state.childByKey.set(key, branch);
          parent.children.push(branch);
          groupCount += 1;
        }
        parent = branch;
        if (!parent.__rvmGroupingState) parent.__rvmGroupingState = { childByKey: new Map() };
        state = parent.__rvmGroupingState;
      }
      const semanticChild = enrichRvmPrimitiveLeaf(child);
      parent.children.push({
        ...semanticChild,
        attributes: {
          ...(semanticChild.attributes || {}),
          RVM_OWNER_PATH: path.join(' / '),
          RVM_OWNER_DEPTH: String(path.length)
        }
      });
    }

    stripGroupingState(groupedRoot);
    groupedRoot.attributes.BROWSER_RVM_HIERARCHY_GROUP_COUNT = String(groupCount);
    return groupedRoot;
  });
}

function ownerPathFromName(ownerName) {
  const parts = String(ownerName || '')
    .split(/\s+of\s+/i)
    .map((part) => normalizeOwnerSegment(part))
    .filter(Boolean);
  if (!parts.length) return ['RVM Objects'];
  return parts.reverse();
}

function normalizeOwnerSegment(segment) {
  return String(segment || '')
    .replace(/\s+/g, ' ')
    .replace(/^ZONE\s+/i, 'ZONE ')
    .trim();
}

function canonicalSegmentKey(segment, depth) {
  return `${depth}:${String(segment || '').toUpperCase()}`;
}

function makeBranchNode(segment, depth, path, ownerName) {
  const kind = classifyBranchSegment(segment, depth);
  return {
    name: segment,
    type: 'BRANCH',
    attributes: {
      TYPE: 'BRANCH',
      NAME: segment,
      SOURCE_FORMAT: 'RVM_BINARY_BROWSER_FALLBACK',
      RVM_BROWSER_BRANCH_KIND: kind,
      RVM_BROWSER_BRANCH_DEPTH: String(depth),
      RVM_BROWSER_BRANCH_PATH: path.slice(0, depth + 1).join(' / '),
      RVM_BROWSER_OWNER_EXAMPLE: ownerName
    },
    children: []
  };
}

function classifyBranchSegment(segment, depth) {
  const upper = String(segment || '').toUpperCase();
  if (/^ZONE\b|^\//.test(upper)) return 'ZONE';
  if (/^PIPE\b/.test(upper)) return 'PIPE_GROUP';
  if (/^BRANCH\b/.test(upper)) return 'BRANCH_GROUP';
  if (/^EQUIPMENT\b|^SUBEQUIPMENT\b/.test(upper)) return 'EQUIPMENT_GROUP';
  if (/^GASKET\b|^FLANGE\b|^VALVE\b|^ELBOW\b|^TEE\b|^RTORUS\b|^TORUS\b|^INSTRUMENT\b/.test(upper)) return 'COMPONENT_GROUP';
  return depth === 0 ? 'MODEL_GROUP' : 'RVM_GROUP';
}

function enrichRvmPrimitiveLeaf(child) {
  const attrs = child?.attributes || {};
  const ownerName = String(attrs.RVM_OWNER_NAME || '');
  const primitiveCode = Number(attrs.RVM_PRIMITIVE_CODE);
  const ownerSemantic = semanticFromOwnerName(ownerName);
  const codeSemantic = RVM_PRIM_CODE_SEMANTICS[primitiveCode];
  const semantic = ownerSemantic || codeSemantic;
  if (!semantic) return child;

  const type = semantic.type || child.type;
  const kind = semantic.kind || attrs.RVM_PRIMITIVE_KIND || '';
  return {
    ...child,
    type,
    attributes: {
      ...attrs,
      TYPE: type,
      RVM_PRIMITIVE_KIND: kind,
      RVM_BROWSER_PRIMITIVE_CLASS: semantic.primitiveClass || kind || type,
      RVM_BROWSER_PRIMITIVE_SEMANTIC_SOURCE: ownerSemantic ? 'owner-name' : 'prim-code-map'
    }
  };
}

function semanticFromOwnerName(ownerName) {
  const upper = String(ownerName || '').toUpperCase();
  if (/\bRTORUS\b|\bTORUS\b/.test(upper)) return { type: 'GASK', kind: 'TORUS', primitiveClass: 'TORUS' };
  if (/\bGASKET\b|\bGASK\b/.test(upper)) return { type: 'GASK', kind: 'GASKET', primitiveClass: 'GASKET' };
  if (/\bFLANGE\b|\bFLAN\b/.test(upper)) return { type: 'FLANGE', kind: 'FLANGE', primitiveClass: 'FLANGE' };
  if (/\bVALVE\b|\bVALV\b/.test(upper)) return { type: 'VALVE', kind: 'VALVE', primitiveClass: 'VALVE' };
  if (/\bELBOW\b|\bBEND\b/.test(upper)) return { type: 'ELBOW', kind: 'ELBOW', primitiveClass: 'ELBOW' };
  if (/\bTEE\b/.test(upper)) return { type: 'TEE', kind: 'TEE', primitiveClass: 'TEE' };
  if (/\bINSTRUMENT\b|\bINST\b/.test(upper)) return { type: 'INSTRUMENT', kind: 'INSTRUMENT', primitiveClass: 'INSTRUMENT' };
  if (/\bPIPE\b|\bCYLI\b|\bTUBE\b/.test(upper)) return { type: 'PIPE', kind: 'CYLINDER', primitiveClass: 'CYLINDER' };
  if (/\bBOX\b|\bEQUIPMENT\b|\bSUBEQUIPMENT\b|\bOBST\b/.test(upper)) return { type: 'BOX', kind: 'BOX', primitiveClass: 'BOX' };
  return null;
}

function stripGroupingState(node) {
  if (!node || typeof node !== 'object') return;
  delete node.__rvmGroupingState;
  for (const child of Array.isArray(node.children) ? node.children : []) stripGroupingState(child);
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
