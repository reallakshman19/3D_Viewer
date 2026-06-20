import { parseRvmArrayBuffer as parseLegacyRvmArrayBuffer } from './BrowserRvmParser.js';

export const BROWSER_RVM_TRANSFORM_PARSER_SCHEMA = 'browser-rvm-transform-parser/v1';

export async function parseRvmArrayBuffer(arrayBuffer, options = {}) {
  const parsed = await parseLegacyRvmArrayBuffer(arrayBuffer, options);
  const patch = patchHierarchyWithWorldTransforms(parsed.hierarchy || [], arrayBuffer);
  const diagnostics = {
    ...(parsed.diagnostics || {}),
    transformParserSchemaVersion: BROWSER_RVM_TRANSFORM_PARSER_SCHEMA,
    rvmPrimTransformAppliedCount: patch.applied,
    rvmPrimTransformSkippedCount: patch.skipped,
    rvmPrimWorldBounds: patch.worldBounds,
    rvmPrimLegacyBounds: patch.legacyBounds,
    parseFidelity: patch.applied > 0 ? 'PARTIAL_BINARY_PRIM_RECORDS_WORLD_TRANSFORMED' : parsed.diagnostics?.parseFidelity
  };
  return {
    ...parsed,
    schemaVersion: BROWSER_RVM_TRANSFORM_PARSER_SCHEMA,
    hierarchy: patch.hierarchy,
    diagnostics
  };
}

function patchHierarchyWithWorldTransforms(roots, arrayBuffer) {
  const view = arrayBuffer instanceof ArrayBuffer ? new DataView(arrayBuffer) : null;
  const world = makeBounds();
  const legacy = makeBounds();
  let applied = 0;
  let skipped = 0;

  const patchNode = (node) => {
    if (!node || typeof node !== 'object') return node;
    const attrs = node.attributes || {};
    const offset = Number.parseInt(String(attrs.RVM_BYTE_OFFSET ?? ''), 10);
    const code = Number.parseInt(String(attrs.RVM_PRIMITIVE_CODE ?? ''), 10);
    const isPrimLeaf = attrs.RVM_RECORD_TAG === 'PRIM' || Number.isFinite(code);
    let next = node;
    if (view && isPrimLeaf && Number.isFinite(offset) && offset >= 0) {
      const geom = decodePrimGeometry(view, offset, code);
      if (geom) {
        applied += 1;
        expandBounds(world, geom.bbox);
        expandBounds(legacy, geom.legacyBbox);
        next = {
          ...node,
          bbox: geom.bbox,
          attributes: {
            ...attrs,
            BROWSER_PARSE_METHOD: 'binary-rvm-record-world-transform',
            RVM_PRIM_TRANSFORM_APPLIED: 'true',
            RVM_PRIM_TRANSFORM_SCHEMA: BROWSER_RVM_TRANSFORM_PARSER_SCHEMA,
            RVM_LOCAL_BBOX: JSON.stringify(roundArray(geom.localBbox)),
            RVM_LEGACY_UNTRANSFORMED_BBOX: JSON.stringify(roundArray(geom.legacyBbox)),
            RVM_TRANSFORM_MATRIX: JSON.stringify(roundArray(geom.matrix)),
            RVM_TRANSFORM_ORIGIN: JSON.stringify(roundVec(geom.origin)),
            RVM_TRANSFORM_COLUMN_SCALES: JSON.stringify(roundArray(geom.columnScales)),
            RVM_LOCAL_AXIS: geom.localAxis,
            APOS: geom.apos,
            LPOS: geom.lpos,
            HBOR: String(roundNumber(geom.hbor))
          }
        };
      } else {
        skipped += 1;
      }
    }
    if (Array.isArray(next.children)) {
      next = { ...next, children: next.children.map(patchNode) };
    }
    return next;
  };

  const hierarchy = Array.isArray(roots) ? roots.map(patchNode) : [];
  if (hierarchy[0]?.attributes && applied > 0) {
    hierarchy[0].attributes = {
      ...hierarchy[0].attributes,
      PARSE_FIDELITY: 'PARTIAL_BINARY_PRIM_RECORDS_WORLD_TRANSFORMED',
      RVM_PRIM_TRANSFORM_APPLIED_COUNT: String(applied),
      RVM_PRIM_TRANSFORM_SKIPPED_COUNT: String(skipped),
      RVM_PRIM_WORLD_BOUNDS: JSON.stringify(boundsToBbox(world)),
      RVM_PRIM_LEGACY_BOUNDS: JSON.stringify(boundsToBbox(legacy))
    };
  }
  return { hierarchy, applied, skipped, worldBounds: boundsToBbox(world), legacyBounds: boundsToBbox(legacy) };
}

function decodePrimGeometry(view, offset, code) {
  if (offset + 32 > view.byteLength || readWideTag(view, offset) !== 'PRIM') return null;
  const nextOffset = view.getUint32(offset + 16, false);
  const end = Math.min(nextOffset, view.byteLength);
  if (!Number.isFinite(end) || end <= offset + 32) return null;
  const floats = [];
  for (let p = offset + 32; p + 4 <= end; p += 4) {
    const value = view.getFloat32(p, false);
    floats.push(Number.isFinite(value) ? value : 0);
  }
  if (floats.length < 18) return null;
  const matrix = floats.slice(0, 9);
  const origin = { x: floats[9] || 0, y: floats[10] || 0, z: floats[11] || 0 };
  const localBbox = normalizeBbox(floats.slice(12, 18));
  if (!isReasonableBbox(localBbox)) return null;
  const legacyBbox = [
    localBbox[0] + origin.x, localBbox[1] + origin.y, localBbox[2] + origin.z,
    localBbox[3] + origin.x, localBbox[4] + origin.y, localBbox[5] + origin.z
  ];
  const columnScales = [
    Math.hypot(matrix[0], matrix[3], matrix[6]),
    Math.hypot(matrix[1], matrix[4], matrix[7]),
    Math.hypot(matrix[2], matrix[5], matrix[8])
  ];
  const det = determinant3(matrix);
  if (!matrix.every((v) => Number.isFinite(v) && Math.abs(v) < 1e6) || !Number.isFinite(det) || Math.abs(det) <= 1e-18) return null;
  const corners = bboxCorners(localBbox).map((point) => transformPoint(matrix, origin, point));
  const bbox = normalizeBboxFromPoints(corners);
  if (!isReasonableBbox(bbox)) return null;
  const localAxis = localAxisForCode(code, dimsFromBbox(localBbox));
  const axis = transformedAxis(matrix, origin, localBbox, localAxis);
  const hbor = transformedRadius(localBbox, columnScales, localAxis);
  return { bbox, apos: axis.apos, lpos: axis.lpos, hbor, matrix, origin, columnScales, localAxis, localBbox, legacyBbox };
}

function transformPoint(m, o, p) {
  return {
    x: o.x + m[0] * p.x + m[1] * p.y + m[2] * p.z,
    y: o.y + m[3] * p.x + m[4] * p.y + m[5] * p.z,
    z: o.z + m[6] * p.x + m[7] * p.y + m[8] * p.z
  };
}

function transformedAxis(matrix, origin, bbox, axis) {
  const [minX, minY, minZ, maxX, maxY, maxZ] = bbox;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  let start;
  let end;
  if (axis === 'X') {
    start = { x: minX, y: cy, z: cz };
    end = { x: maxX, y: cy, z: cz };
  } else if (axis === 'Y') {
    start = { x: cx, y: minY, z: cz };
    end = { x: cx, y: maxY, z: cz };
  } else {
    start = { x: cx, y: cy, z: minZ };
    end = { x: cx, y: cy, z: maxZ };
  }
  return { apos: transformPoint(matrix, origin, start), lpos: transformPoint(matrix, origin, end) };
}

function transformedRadius(localBbox, columnScales, axis) {
  const d = dimsFromBbox(localBbox);
  const scaled = { dx: d.dx * columnScales[0], dy: d.dy * columnScales[1], dz: d.dz * columnScales[2] };
  const minors = axis === 'X' ? [scaled.dy, scaled.dz] : axis === 'Y' ? [scaled.dx, scaled.dz] : [scaled.dx, scaled.dy];
  return Math.max(Math.min(minors[0], minors[1]) * 0.5, 0.001);
}

function localAxisForCode(code, dims) {
  if (code === 8 || code === 7 || code === 3 || code === 11) return 'Z';
  if (dims.dx >= dims.dy && dims.dx >= dims.dz) return 'X';
  if (dims.dy >= dims.dx && dims.dy >= dims.dz) return 'Y';
  return 'Z';
}

function readWideTag(view, offset) {
  if (!view || offset < 0 || offset + 16 > view.byteLength) return null;
  let out = '';
  for (let i = 0; i < 4; i += 1) {
    const value = view.getUint32(offset + i * 4, false);
    if (value < 32 || value > 126) return null;
    out += String.fromCharCode(value);
  }
  return out;
}

function bboxCorners(bbox) {
  const [minX, minY, minZ, maxX, maxY, maxZ] = bbox;
  const out = [];
  for (const x of [minX, maxX]) for (const y of [minY, maxY]) for (const z of [minZ, maxZ]) out.push({ x, y, z });
  return out;
}

function normalizeBboxFromPoints(points) {
  return [
    Math.min(...points.map((p) => p.x)), Math.min(...points.map((p) => p.y)), Math.min(...points.map((p) => p.z)),
    Math.max(...points.map((p) => p.x)), Math.max(...points.map((p) => p.y)), Math.max(...points.map((p) => p.z))
  ];
}

function normalizeBbox(values) {
  if (!Array.isArray(values) || values.length < 6) return null;
  const [x1, y1, z1, x2, y2, z2] = values.slice(0, 6).map(Number);
  return [Math.min(x1, x2), Math.min(y1, y2), Math.min(z1, z2), Math.max(x1, x2), Math.max(y1, y2), Math.max(z1, z2)];
}

function isReasonableBbox(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 6) return false;
  if (!bbox.every((v) => Number.isFinite(v) && Math.abs(v) < 1e9)) return false;
  const d = dimsFromBbox(bbox);
  return d.dx > 0 || d.dy > 0 || d.dz > 0;
}

function dimsFromBbox(bbox) {
  return { dx: Math.abs(bbox[3] - bbox[0]), dy: Math.abs(bbox[4] - bbox[1]), dz: Math.abs(bbox[5] - bbox[2]) };
}

function determinant3(m) {
  return m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
}

function makeBounds() {
  return { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
}

function expandBounds(bounds, bbox) {
  if (!isReasonableBbox(bbox)) return;
  bounds.minX = Math.min(bounds.minX, bbox[0]);
  bounds.minY = Math.min(bounds.minY, bbox[1]);
  bounds.minZ = Math.min(bounds.minZ, bbox[2]);
  bounds.maxX = Math.max(bounds.maxX, bbox[3]);
  bounds.maxY = Math.max(bounds.maxY, bbox[4]);
  bounds.maxZ = Math.max(bounds.maxZ, bbox[5]);
}

function boundsToBbox(bounds) {
  const values = [bounds.minX, bounds.minY, bounds.minZ, bounds.maxX, bounds.maxY, bounds.maxZ];
  if (!values.every(Number.isFinite)) return null;
  return values.map(roundNumber);
}

function roundNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(6)) : 0;
}

function roundArray(values) {
  return (Array.isArray(values) ? values : []).map(roundNumber);
}

function roundVec(vec) {
  return { x: roundNumber(vec.x), y: roundNumber(vec.y), z: roundNumber(vec.z) };
}
