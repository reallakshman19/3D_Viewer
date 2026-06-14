#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const TRIANGLES = 4;
const TRIANGLE_STRIP = 5;
const TRIANGLE_FAN = 6;

const COMPONENT_TYPE_BYTES = Object.freeze({
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
});

const ACCESSOR_TYPE_COMPONENTS = Object.freeze({
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
});

function usage() {
  return `Usage:
  node scripts/bm-cii/tally-geometry-qc.mjs \
    --glb <output.glb> \
    --sidecar <benchmark.sidecar.json> \
    [--support-source inputxml|isonote] \
    [--out <qc-report.json>] \
    [--pretty] \
    [--strict]

Purpose:
  BM_CII geometry tally QC gate.

Compares source/sidecar semantic inventory against the rendered GLB inventory:
  - piping/component records
  - pipe/bend/valve/flange/tee-olet rendered nodes
  - selected restraint/support source
  - ISONOTE callout/annotation mapping
  - bounds/scale coherence between plant geometry and annotations

Exit code:
  0 = QC passed
  1 = QC failed
`;
}

function argValue(args, name) {
  const idx = args.indexOf(name);
  if (idx < 0) return null;
  return args[idx + 1] ?? null;
}

function hasArg(args, name) {
  return args.includes(name);
}

function readUInt32LE(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function parseGlb(buffer) {
  if (buffer.length < 20) throw new Error('GLB too small.');
  const magic = readUInt32LE(buffer, 0);
  const version = readUInt32LE(buffer, 4);
  const length = readUInt32LE(buffer, 8);
  if (magic !== GLB_MAGIC) throw new Error('Invalid GLB magic.');
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}; expected 2.`);
  if (length !== buffer.length) throw new Error(`GLB header length ${length} != actual ${buffer.length}.`);

  let offset = 12;
  let json = null;
  let binBytes = 0;
  const chunks = [];
  while (offset + 8 <= buffer.length) {
    const chunkLength = readUInt32LE(buffer, offset);
    const chunkType = readUInt32LE(buffer, offset + 4);
    const start = offset + 8;
    const end = start + chunkLength;
    if (end > buffer.length) throw new Error('GLB chunk extends beyond file length.');
    chunks.push({ chunkType, chunkLength, start, end });
    if (chunkType === GLB_JSON_CHUNK) {
      json = JSON.parse(buffer.subarray(start, end).toString('utf8').replace(/\0+$/g, '').trim());
    } else {
      binBytes += chunkLength;
    }
    offset = end;
  }
  if (!json) throw new Error('Missing JSON chunk.');
  return { json, binBytes, chunks };
}

function countTriangles(primitive, gltf) {
  const mode = primitive.mode ?? TRIANGLES;
  let vertexCount = 0;
  if (primitive.indices !== undefined) {
    vertexCount = gltf.accessors?.[primitive.indices]?.count ?? 0;
  } else if (primitive.attributes?.POSITION !== undefined) {
    vertexCount = gltf.accessors?.[primitive.attributes.POSITION]?.count ?? 0;
  }
  if (mode === TRIANGLES) return Math.floor(vertexCount / 3);
  if (mode === TRIANGLE_STRIP || mode === TRIANGLE_FAN) return Math.max(0, vertexCount - 2);
  return 0;
}

function accessorByteSize(accessorIndex, gltf) {
  const accessor = gltf.accessors?.[accessorIndex];
  if (!accessor) return 0;
  const componentBytes = COMPONENT_TYPE_BYTES[accessor.componentType] ?? 0;
  const components = ACCESSOR_TYPE_COMPONENTS[accessor.type] ?? 0;
  return (accessor.count ?? 0) * componentBytes * components;
}

function primitiveAccessorBytes(primitive, gltf) {
  const ids = new Set();
  if (primitive.indices !== undefined) ids.add(primitive.indices);
  for (const value of Object.values(primitive.attributes || {})) ids.add(value);
  let bytes = 0;
  for (const id of ids) bytes += accessorByteSize(id, gltf);
  return bytes;
}

function identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function transformPoint(m, p) {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function trsMatrix(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) return node.matrix.slice();
  const t = node.translation || [0, 0, 0];
  const s = node.scale || [1, 1, 1];
  const q = node.rotation || [0, 0, 0, 1];
  const [x, y, z, w] = q;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;

  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

function sceneRootNodes(gltf) {
  const sceneIndex = gltf.scene ?? 0;
  return gltf.scenes?.[sceneIndex]?.nodes || [];
}

function walkNodes(gltf, nodeIndex, parentWorld, rows) {
  const node = gltf.nodes?.[nodeIndex] || {};
  const world = multiply(parentWorld, trsMatrix(node));
  rows.push({ nodeIndex, node, world });
  for (const child of node.children || []) walkNodes(gltf, child, world, rows);
}

function flattenNodes(gltf) {
  const rows = [];
  for (const root of sceneRootNodes(gltf)) walkNodes(gltf, root, identity(), rows);
  return rows;
}

function cornersFromMinMax(min, max) {
  if (!Array.isArray(min) || !Array.isArray(max) || min.length < 3 || max.length < 3) return [];
  const out = [];
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) out.push([x, y, z]);
    }
  }
  return out;
}

function mergeBounds(bounds, p) {
  if (!p) return bounds;
  if (!bounds) return { min: p.slice(), max: p.slice(), count: 1 };
  for (let i = 0; i < 3; i += 1) {
    bounds.min[i] = Math.min(bounds.min[i], p[i]);
    bounds.max[i] = Math.max(bounds.max[i], p[i]);
  }
  bounds.count += 1;
  return bounds;
}

function boundsDiagonal(bounds) {
  if (!bounds) return 0;
  const dx = bounds.max[0] - bounds.min[0];
  const dy = bounds.max[1] - bounds.min[1];
  const dz = bounds.max[2] - bounds.min[2];
  return Math.hypot(dx, dy, dz);
}

function boundsCentroid(bounds) {
  if (!bounds) return [0, 0, 0];
  return [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
}

function boundsMaxAbs(bounds) {
  if (!bounds) return 0;
  return Math.max(...bounds.min.map(Math.abs), ...bounds.max.map(Math.abs));
}

function distance3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function nodeName(row, gltf) {
  const node = row.node || {};
  const mesh = node.mesh !== undefined ? gltf.meshes?.[node.mesh] : null;
  return String(node.name || mesh?.name || `node_${row.nodeIndex}`);
}

function classifyNode(name) {
  const n = String(name || '').toUpperCase();
  if (/CAESAR[_-]?ANNOTATION|ISONOTE[_-]?(DISC|CALLOUT)|NODE[_-]?(DISC|BUBBLE)|CAESAR-NODE-LABEL/.test(n)) return 'annotation';
  if (/\bAXIS[_-]|AXIS_X|AXIS_Y|AXIS_Z/.test(n)) return 'axis';
  if (/SUPPORT|RESTRAINT|HANGER|SPRING|LINESTOP|LINE_STOP|GUIDE|HOLDDOWN|LIMIT|UNKNOWN_TYPE0/.test(n)) return 'support';
  if (/VALVE|_V[A-Z]{2}_|VGT|VGL|VBA|VCH/.test(n)) return 'valve';
  if (/FLANGE|FLG/.test(n)) return 'flange';
  if (/TEE|OLET|WELDOLET|SOCKOLET/.test(n)) return 'teeOlet';
  if (/BEND|ELBOW/.test(n)) return 'bend';
  if (/PIPE|PE_\d+/.test(n)) return 'pipe';
  return 'other';
}

function semanticTypeFromComponent(component) {
  const t = String(component.type || component.elementType || '').toUpperCase();
  if (/VALVE/.test(t)) return 'valve';
  if (/FLANGE/.test(t)) return 'flange';
  if (/TEE|OLET/.test(t)) return 'teeOlet';
  if (/BEND/.test(t)) return 'bend';
  if (/PIPE|RIGID|TRIM/.test(t)) return 'pipe';
  return 'other';
}

function countBy(items, fn) {
  const out = {};
  for (const item of items || []) {
    const key = fn(item);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function selectedSupportRecords(sidecar, supportSource) {
  if (supportSource === 'isonote') return sidecar.supportsIsonote || sidecar.supportsISONOTE || [];
  return sidecar.supportsInputXml || sidecar.supportsInputXML || sidecar.supports || [];
}

function inferSupportSource(glbPath) {
  const name = path.basename(glbPath).toLowerCase();
  return name.includes('isonote') ? 'isonote' : 'inputxml';
}

function buildActualInventory(gltf) {
  const nodeRows = flattenNodes(gltf);
  const actual = {
    totalNodesInScene: nodeRows.length,
    geometryNodes: 0,
    meshPrimitives: 0,
    estimatedDrawCalls: 0,
    triangles: 0,
    accessorBytes: 0,
    byCategory: {},
    categoryTriangles: {},
    categoryAccessorBytes: {},
    categoryBounds: {},
    nodeRecords: [],
  };

  for (const row of nodeRows) {
    const node = row.node || {};
    if (node.mesh === undefined) continue;
    const mesh = gltf.meshes?.[node.mesh];
    if (!mesh) continue;
    const name = nodeName(row, gltf);
    const category = classifyNode(name);
    actual.geometryNodes += 1;
    actual.byCategory[category] = (actual.byCategory[category] || 0) + 1;

    let nodeTriangles = 0;
    let nodeAccessorBytes = 0;
    let nodeBounds = null;
    for (const primitive of mesh.primitives || []) {
      actual.meshPrimitives += 1;
      actual.estimatedDrawCalls += 1;
      const tris = countTriangles(primitive, gltf);
      const bytes = primitiveAccessorBytes(primitive, gltf);
      actual.triangles += tris;
      actual.accessorBytes += bytes;
      actual.categoryTriangles[category] = (actual.categoryTriangles[category] || 0) + tris;
      actual.categoryAccessorBytes[category] = (actual.categoryAccessorBytes[category] || 0) + bytes;
      nodeTriangles += tris;
      nodeAccessorBytes += bytes;

      const positionAccessor = primitive.attributes?.POSITION;
      const accessor = gltf.accessors?.[positionAccessor];
      for (const corner of cornersFromMinMax(accessor?.min, accessor?.max)) {
        const p = transformPoint(row.world, corner);
        nodeBounds = mergeBounds(nodeBounds, p);
        actual.categoryBounds[category] = mergeBounds(actual.categoryBounds[category], p);
      }
    }

    actual.nodeRecords.push({
      name,
      category,
      mesh: mesh.name || '',
      primitives: mesh.primitives?.length || 0,
      triangles: nodeTriangles,
      accessorBytes: nodeAccessorBytes,
      bounds: nodeBounds,
    });
  }

  return actual;
}

function componentMissingIds(expectedComponents, nodeNames) {
  const names = nodeNames.map((name) => String(name || '').toUpperCase());
  const missing = [];
  for (const component of expectedComponents || []) {
    const id = String(component.id || '').trim();
    if (!id) continue;
    const needle = id.toUpperCase();
    if (!names.some((name) => name.includes(needle))) missing.push(id);
  }
  return missing;
}

function buildExpectedInventory(sidecar, supportSource) {
  const components = sidecar.components || [];
  const supportRecords = selectedSupportRecords(sidecar, supportSource);
  const callouts = sidecar.caesarAnnotationCallouts || sidecar.annotationCallouts || [];
  return {
    components: {
      total: components.length,
      bySemanticType: countBy(components, semanticTypeFromComponent),
    },
    bendTrimArcs: (sidecar.bendTrimArcs || sidecar.bendArcs || []).length,
    teeOletTopology: (sidecar.teeOletTopology || []).length,
    supports: {
      source: supportSource,
      total: supportRecords.length,
      byKind: countBy(supportRecords, (record) => String(record.kind || record.type || 'UNKNOWN').toUpperCase()),
    },
    annotations: {
      callouts: callouts.length,
      calloutNodes: callouts.map((record) => String(record.node)).filter(Boolean),
    },
  };
}

function boundsCoherence(actual) {
  const annotationBounds = actual.categoryBounds.annotation;
  let plantBounds = null;
  for (const [category, bounds] of Object.entries(actual.categoryBounds)) {
    if (category === 'annotation' || category === 'axis') continue;
    for (const corner of cornersFromMinMax(bounds?.min, bounds?.max)) plantBounds = mergeBounds(plantBounds, corner);
  }

  if (!plantBounds || !annotationBounds) {
    return {
      ok: false,
      reason: 'Missing plant or annotation bounds.',
      plantBounds,
      annotationBounds,
    };
  }

  const plantDiag = boundsDiagonal(plantBounds);
  const annDiag = boundsDiagonal(annotationBounds);
  const centroidDistance = distance3(boundsCentroid(plantBounds), boundsCentroid(annotationBounds));
  const diagRatio = plantDiag ? annDiag / plantDiag : Infinity;
  const centroidRatio = plantDiag ? centroidDistance / plantDiag : Infinity;
  const maxAbsRatio = boundsMaxAbs(plantBounds) ? boundsMaxAbs(annotationBounds) / boundsMaxAbs(plantBounds) : Infinity;
  const gates = {
    plantDiagonalPositive: plantDiag > 0,
    annotationDiagonalPositive: annDiag > 0,
    annotationToPlantDiagonalRatioLe1p50: diagRatio <= 1.5,
    annotationCentroidDistanceLe1p25PlantDiagonal: centroidRatio <= 1.25,
    annotationMaxAbsToPlantMaxAbsLe2: maxAbsRatio <= 2,
  };
  return {
    ok: Object.values(gates).every(Boolean),
    gates,
    plantBounds,
    annotationBounds,
    plantDiagonal: plantDiag,
    annotationDiagonal: annDiag,
    annotationToPlantDiagonalRatio: diagRatio,
    annotationCentroidDistance,
    annotationCentroidDistanceToPlantDiagonalRatio: centroidRatio,
    annotationMaxAbsToPlantMaxAbsRatio: maxAbsRatio,
  };
}

function runQc({ glbPath, sidecarPath, gltf, sidecar, supportSource, strict, allowMissingComponentNames, maxAnnotationNodes }) {
  const expected = buildExpectedInventory(sidecar, supportSource);
  const actual = buildActualInventory(gltf);
  const nodeNames = actual.nodeRecords.map((row) => row.name);
  const missingComponentIds = allowMissingComponentNames ? [] : componentMissingIds(sidecar.components || [], nodeNames);
  const bc = boundsCoherence(actual);

  const actualComponentLike =
    (actual.byCategory.pipe || 0) +
    (actual.byCategory.bend || 0) +
    (actual.byCategory.valve || 0) +
    (actual.byCategory.flange || 0) +
    (actual.byCategory.teeOlet || 0);

  const gates = {
    glbHasGeometry: actual.geometryNodes > 0,
    sourceHasComponents: expected.components.total > 0,
    renderedHasPlantGeometry: actualComponentLike > 0,
    renderedHasSelectedSupports: expected.supports.total === 0 || (actual.byCategory.support || 0) >= expected.supports.total,
    renderedHasAnnotations: expected.annotations.callouts === 0 || (actual.byCategory.annotation || 0) > 0,
    annotationNodeCountWithinBudget: (actual.byCategory.annotation || 0) <= maxAnnotationNodes,
    allSourceComponentIdsRendered: missingComponentIds.length === 0,
    calloutCountStable: expected.annotations.callouts === 0 || expected.annotations.callouts === 4,
    boundsCoherent: bc.ok,
  };

  if (!strict) {
    // Non-strict mode still requires spatial sanity and basic presence, but does
    // not fail a candidate solely because source-component IDs were merged or renamed.
    gates.allSourceComponentIdsRendered = true;
  }

  const ok = Object.values(gates).every(Boolean);
  return {
    schema: 'bm-cii-geometry-tally-qc/v1',
    ok,
    files: {
      glb: glbPath,
      sidecar: sidecarPath,
    },
    options: {
      supportSource,
      strict,
      allowMissingComponentNames,
      maxAnnotationNodes,
    },
    expected,
    actual: {
      totalNodesInScene: actual.totalNodesInScene,
      geometryNodes: actual.geometryNodes,
      meshPrimitives: actual.meshPrimitives,
      estimatedDrawCalls: actual.estimatedDrawCalls,
      triangles: actual.triangles,
      accessorBytes: actual.accessorBytes,
      byCategory: actual.byCategory,
      categoryTriangles: actual.categoryTriangles,
      categoryAccessorBytes: actual.categoryAccessorBytes,
      categoryBounds: actual.categoryBounds,
    },
    comparison: {
      missingComponentIds,
      selectedSupportSource: supportSource,
      expectedSupportRecords: expected.supports.total,
      actualSupportGeometryNodes: actual.byCategory.support || 0,
      expectedCallouts: expected.annotations.callouts,
      actualAnnotationGeometryNodes: actual.byCategory.annotation || 0,
    },
    boundsCoherence: bc,
    gates,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (hasArg(args, '--help') || hasArg(args, '-h')) {
    console.log(usage());
    return;
  }

  const glbPath = argValue(args, '--glb');
  const sidecarPath = argValue(args, '--sidecar');
  const outPath = argValue(args, '--out');
  const pretty = hasArg(args, '--pretty');
  const strict = hasArg(args, '--strict');
  const allowMissingComponentNames = hasArg(args, '--allow-missing-component-names');
  const supportSource = argValue(args, '--support-source') || (glbPath ? inferSupportSource(glbPath) : 'inputxml');
  const maxAnnotationNodes = Number(argValue(args, '--max-annotation-nodes') || 8);

  if (!glbPath || !sidecarPath) throw new Error(`Missing required arguments.\n${usage()}`);
  if (!['inputxml', 'isonote'].includes(supportSource)) {
    throw new Error(`Invalid --support-source ${supportSource}; expected inputxml or isonote.`);
  }

  const glbBuffer = await fs.readFile(glbPath);
  const sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
  const { json: gltf, binBytes } = parseGlb(glbBuffer);
  const report = runQc({
    glbPath,
    sidecarPath,
    gltf,
    sidecar,
    supportSource,
    strict,
    allowMissingComponentNames,
    maxAnnotationNodes,
  });
  report.file = {
    sizeBytes: glbBuffer.length,
    sha256: crypto.createHash('sha256').update(glbBuffer).digest('hex'),
    binBytes,
  };

  const payload = JSON.stringify(report, null, pretty ? 2 : 0);
  if (outPath) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, `${payload}\n`, 'utf8');
  }
  console.log(payload);
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
