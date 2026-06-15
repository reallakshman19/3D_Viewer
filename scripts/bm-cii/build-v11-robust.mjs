#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

import { buildExportScene } from '../../viewer/js/pcf2glb/glb/buildExportScene.js';
import { applyAnnotationGeometryTrace } from '../../viewer/js/pcf2glb/glb/GeometryTraceMetadata.js';
import {
  buildCaesarAnnotationCoreObject,
  buildCaesarAnnotationSidecar,
  prepareCaesarAnnotationCoreModel,
} from '../../viewer/js/pcf2glb/glb/caesar/CaesarAnnotationCore.js';

const SCRIPT_SCHEMA = 'bm-cii-v11-robust-build-script/v1';
const DEFAULT_OUT_DIR = 'artifacts/bm-cii-v11-robust';
const BM_CII_ANNOTATION_NODES = Object.freeze(['35', '130', '205', '255']);
const BM_CII_ANNOTATION_CALLOUTS = Object.freeze([1, 2, 3, 4]);
const ANNOTATION_ATTR_KEYS = Object.freeze([
  'ISONOTE',
  'CAESAR_ISONOTE',
  'NOTE',
  'NOTES',
  'MESSAGE',
  'TEXT',
  'COMMENT',
  'LABEL',
  'LABEL_TEXT',
]);
const DEFAULT_VARIANTS = Object.freeze([
  { name: 'engineering_inputxml', colorMode: 'engineering', supportSource: 'inputxml' },
  { name: 'engineering_isonote', colorMode: 'engineering', supportSource: 'isonote' },
  { name: 'temp1_inputxml', colorMode: 'temp1', supportSource: 'inputxml' },
  { name: 'temp1_isonote', colorMode: 'temp1', supportSource: 'isonote' },
]);

function usage() {
  return `Usage:
  node scripts/bm-cii/build-v11-robust.mjs --model <model.json> [--out-dir <dir>]
  node scripts/bm-cii/build-v11-robust.mjs --sidecar <sidecar.json> [--out-dir <dir>] [--annotation-only]

Purpose:
  Build BM_CII v11 robust GLB variants using the robust-lowpoly-vector
  CAESAR annotation core. This script does not alter pipe/topology solving;
  it consumes an already-built render model JSON or a sidecar JSON.

Outputs:
  BM_CII_Enriched_engineering_v11_robust_inputxml.glb
  BM_CII_Enriched_engineering_v11_robust_isonote.glb
  BM_CII_Enriched_temp1_v11_robust_inputxml.glb
  BM_CII_Enriched_temp1_v11_robust_isonote.glb
  BM_CII_Enriched_benchmark_v11_robust.sidecar.json
  BM_CII_Enriched_benchmark_v11_robust.manifest.json
`;
}

function parseArgs(argv) {
  const args = {
    outDir: DEFAULT_OUT_DIR,
    annotationOnly: false,
    variants: [...DEFAULT_VARIANTS],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--model') args.modelPath = argv[++i];
    else if (arg === '--sidecar') args.sidecarPath = argv[++i];
    else if (arg === '--out-dir') args.outDir = argv[++i];
    else if (arg === '--annotation-only') args.annotationOnly = true;
    else if (arg === '--variant') {
      const raw = argv[++i] || '';
      const [name, colorMode = 'engineering', supportSource = 'inputxml'] = raw.split(':');
      if (name) args.variants.push({ name, colorMode, supportSource });
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.help) return args;
  if (args.modelPath && args.sidecarPath) throw new Error('Use either --model or --sidecar, not both.');
  if (!args.modelPath && !args.sidecarPath) throw new Error('Missing --model or --sidecar.');
  return args;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function ensureNodeFileReader() {
  if (typeof globalThis.FileReader !== 'undefined') return;
  if (typeof Blob === 'undefined') return;

  class NodeFileReader {
    constructor() {
      this.result = null;
      this.error = null;
      this.onload = null;
      this.onloadend = null;
      this.onerror = null;
    }

    addEventListener(type, listener) {
      if (type === 'load') this.onload = listener;
      else if (type === 'loadend') this.onloadend = listener;
      else if (type === 'error') this.onerror = listener;
    }

    removeEventListener(type, listener) {
      if (type === 'load' && this.onload === listener) this.onload = null;
      else if (type === 'loadend' && this.onloadend === listener) this.onloadend = null;
      else if (type === 'error' && this.onerror === listener) this.onerror = null;
    }

    async readAsArrayBuffer(blob) {
      try {
        this.result = await blob.arrayBuffer();
        this.onload?.({ target: this });
        this.onloadend?.({ target: this });
      } catch (error) {
        this.error = error;
        this.onerror?.({ target: this });
        this.onloadend?.({ target: this });
      }
    }

    async readAsDataURL(blob) {
      try {
        const buffer = Buffer.from(await blob.arrayBuffer());
        const mime = blob.type || 'application/octet-stream';
        this.result = `data:${mime};base64,${buffer.toString('base64')}`;
        this.onload?.({ target: this });
        this.onloadend?.({ target: this });
      } catch (error) {
        this.error = error;
        this.onerror?.({ target: this });
        this.onloadend?.({ target: this });
      }
    }
  }

  globalThis.FileReader = NodeFileReader;
}

async function exportGlb(scene) {
  ensureNodeFileReader();
  const exporter = new GLTFExporter();
  const result = await new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      resolve,
      reject,
      {
        binary: true,
        onlyVisible: true,
        trs: false,
      },
    );
  });
  return result instanceof ArrayBuffer ? Buffer.from(result) : Buffer.from(await result.arrayBuffer());
}

function normalizePoint(value) {
  if (!value || typeof value !== 'object') return null;
  const x = Number(value.x ?? value[0]);
  const y = Number(value.y ?? value[1]);
  const z = Number(value.z ?? value[2]);
  return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value) {
  return String(value ?? '').trim();
}

function normalizeKind(value) {
  const raw = text(value).toUpperCase();
  if (raw.includes('HOLD')) return 'HOLDDOWN';
  if (raw.includes('HANG')) return 'HANGER';
  if (raw.includes('SPRING')) return 'SPRING';
  if (raw.includes('LINE') || raw.includes('STOP')) return 'LINESTOP';
  if (raw.includes('GUIDE')) return 'GUIDE';
  if (raw.includes('LIMIT')) return 'LIMIT';
  if (raw.includes('REST') || raw.includes('SHOE')) return 'REST';
  if (raw.includes('TYPE0') || raw.includes('UNKNOWN') || raw === '0') return 'UNKNOWN';
  return raw || 'UNKNOWN';
}

function normalizeAxis(value) {
  const raw = text(value).toUpperCase();
  if (raw.includes('X')) return 'X';
  if (raw.includes('Y')) return 'Y';
  if (raw.includes('Z')) return 'Z';
  return '';
}

function sanitizeAnnotationText(value) {
  const raw = text(value);
  const match = raw.match(/ISONOTE\s*'([^']+)'/i);
  return match ? match[1].trim() : raw;
}

function strippedAnnotationAttrs(attrs = {}) {
  if (!attrs || typeof attrs !== 'object') return attrs;
  const clone = { ...attrs };
  for (const key of ANNOTATION_ATTR_KEYS) {
    delete clone[key];
    delete clone[key.toLowerCase()];
    delete clone[key.charAt(0) + key.slice(1).toLowerCase()];
  }
  return clone;
}

function stripComponentAnnotationFallbacks(component = {}) {
  if (!component || typeof component !== 'object') return component;
  const clone = { ...component };
  for (const key of ['isonote', 'note', 'notes', 'message', 'text', 'comment', 'labelText']) delete clone[key];
  if (clone.attributes) clone.attributes = strippedAnnotationAttrs(clone.attributes);
  if (clone.raw) clone.raw = strippedAnnotationAttrs(clone.raw);
  return clone;
}

function sanitizeCaesarAnnotationCallouts(sidecar = {}) {
  const nodes = new Set(BM_CII_ANNOTATION_NODES);
  const numbers = new Set(BM_CII_ANNOTATION_CALLOUTS);
  const rawCallouts = sidecar.caesarAnnotationCallouts || sidecar.callouts || [];
  return rawCallouts
    .map((callout, index) => {
      const no = Number(callout.no || callout.calloutNo || index + 1);
      const node = text(callout.node || callout.NODE || callout.nodeNumber);
      const textValue = sanitizeAnnotationText(callout.text || callout.caesarCalloutText || callout.note || callout.ISONOTE);
      return {
        no,
        node,
        text: textValue,
        caesarCalloutText: textValue,
        supportTokens: Array.isArray(callout.supportTokens) ? callout.supportTokens : [],
        source: 'sidecar.caesarAnnotationCallouts',
      };
    })
    .filter((callout) => numbers.has(callout.no) && nodes.has(callout.node) && callout.text)
    .sort((a, b) => a.no - b.no);
}

function firstArray(...values) {
  return values.find((value) => Array.isArray(value) && value.length) || [];
}

function supportRowsForSource(sidecar = {}, source = 'inputxml') {
  if (source === 'isonote') {
    return firstArray(
      sidecar.supportsIsonote,
      sidecar.supportRecordsIsonote,
      sidecar.isonoteSupportRecords,
      sidecar.records?.isonote,
      sidecar.supports?.filter?.((row) => text(row.source || row.supportSource).toLowerCase().includes('isonote')),
    );
  }
  return firstArray(
    sidecar.supportsInputXml,
    sidecar.supportsInputXML,
    sidecar.supportRecordsInputXml,
    sidecar.inputxmlSupportRecords,
    sidecar.records?.inputxml,
    sidecar.supports?.filter?.((row) => !text(row.source || row.supportSource).toLowerCase().includes('isonote')),
  );
}

function supportComponentFromRow(raw = {}, source = 'inputxml', index = 0, nodes = {}) {
  const node = text(raw.node || raw.NODE || raw.Node || raw.nodeNumber || raw.nodeId).replace(/\.0+$/, '');
  const kind = normalizeKind(raw.kind || raw.supportKind || raw.normalizedKind || raw.sourceKind || raw.type || raw.supportType || raw.text || raw.labelText);
  const axis = normalizeAxis(raw.axis || raw.restraintAxis || raw.direction || raw.SUPPORT_DIRECTION || raw.AXIS || raw.Axis);
  const point = normalizePoint(raw.pipePoint || raw.point || raw.displayPointGlb || raw.displayPointGlbMm || raw.coOrds || raw.coord || raw.coordinate) || nodes[node] || null;
  const tangent = normalizePoint(raw.pipeTangent || raw.pipeTangentGlb || raw.tangent || raw.pipeAxis || raw.axisVector) || null;
  const explicitRadius = numberOrNull(raw.pipeRadius ?? raw.pipeRadiusGlb ?? raw.pipeRadiusMm ?? raw.radius);
  const outsideDiameter = numberOrNull(raw.outsideDiameter ?? raw.OutsideDiameter ?? raw.DIAMETER ?? raw.diameter ?? raw.bore ?? raw.BORE);
  const pipeRadius = explicitRadius ?? (outsideDiameter ? outsideDiameter / 2 : null);
  const sourceRecordIndex = Number(raw.sourceRecordIndex ?? raw.recordIndex ?? raw.index ?? index + 1) || index + 1;
  const recordId = text(raw.recordId || raw.id || `${source}:${String(sourceRecordIndex).padStart(2, '0')}`);

  return {
    id: `bm-cii-support:${recordId}`,
    type: 'SUPPORT',
    bmCiiSupportRecord: true,
    bmCiiGlyphOnlySupport: true,
    supportRenderingMode: 'bm-cii-glyph-only',
    recordId,
    sourceRecordIndex,
    source,
    supportSource: source,
    node,
    supportKind: kind,
    kind,
    axis,
    restraintAxis: axis,
    gap: raw.gap ?? raw.gapMm ?? raw.GAP ?? null,
    bidirectional: Boolean(raw.bidirectional || raw.twoWay || raw.isBidirectional),
    pipePoint: point,
    displayPointGlb: point,
    pipeTangent: tangent,
    pipeTangentGlb: tangent,
    pipeRadius,
    outsideDiameter,
    raw,
    attributes: {
      SUPPORT_SOURCE: source,
      SUPPORT_KIND: kind,
      AXIS: axis,
      NODE: node,
    },
  };
}

function supportComponentsFromSidecar(sidecar = {}, nodes = {}) {
  return ['inputxml', 'isonote'].flatMap((source) => supportRowsForSource(sidecar, source)
    .map((row, index) => supportComponentFromRow(row, source, index, nodes))
    .filter((component) => component.node && component.supportKind && component.pipePoint));
}

function deriveModelFromSidecar(sidecar = {}) {
  const nodes = sidecar.nodeCoordinatesGlbBasisMm || sidecar.nodes || sidecar.nodeCoordinates || {};
  const normalizedNodes = Object.fromEntries(
    Object.entries(nodes)
      .map(([node, point]) => [String(node), normalizePoint(point)])
      .filter(([, point]) => point),
  );

  const caesarAnnotationCallouts = sanitizeCaesarAnnotationCallouts(sidecar);
  const baseComponents = (sidecar.components || [])
    .map(stripComponentAnnotationFallbacks)
    .filter((component) => component.type !== 'SUPPORT');
  const supportComponents = supportComponentsFromSidecar(sidecar, normalizedNodes);

  return {
    schema: 'bm-cii-v11-derived-model/from-sidecar/v1',
    sourceSchema: sidecar.schema || '',
    components: [...baseComponents, ...supportComponents],
    elements: (sidecar.elements || []).map(stripComponentAnnotationFallbacks),
    nodes: normalizedNodes,
    nodeCoordinatesGlbBasisMm: normalizedNodes,
    caesarAnnotationCallouts,
    isonotes: [],
    isonoteRows: [],
    supportsInputXml: sidecar.supportsInputXml || [],
    supportsIsonote: sidecar.supportsIsonote || [],
    bmCiiAnnotationWhitelist: {
      source: 'sidecar.caesarAnnotationCallouts',
      callouts: [...BM_CII_ANNOTATION_CALLOUTS],
      nodes: [...BM_CII_ANNOTATION_NODES],
    },
    bmCiiSupportGlyphOnly: supportComponents.length > 0,
    bmCiiSupportRows: {
      inputxml: supportRowsForSource(sidecar, 'inputxml').length,
      isonote: supportRowsForSource(sidecar, 'isonote').length,
    },
    sidecarSource: true,
  };
}

function filterSupportsForVariant(model, supportSource) {
  if (!Array.isArray(model.components)) return model;
  const components = model.components.filter((component) => {
    if (component.type !== 'SUPPORT') return true;
    const rawSource = String(component.supportSource || component.source || component.attributes?.SUPPORT_SOURCE || '').toLowerCase();
    if (!rawSource) return true;
    return rawSource === supportSource;
  });
  return { ...model, components };
}

function sceneRoot(scene) {
  return scene.getObjectByName('PCF_EXPORT_ROOT') || scene;
}

function addRobustAnnotationToScene(scene, model, options) {
  const root = sceneRoot(scene);
  const annotationObject = buildCaesarAnnotationCoreObject(model, options);
  annotationObject.name = 'CAESAR_ANNOTATION_V11_ROBUST_LOW_POLY_VECTOR';
  applyAnnotationGeometryTrace(annotationObject, {
    source: 'ISONOTE',
    callouts: annotationObject.userData.caesarAnnotationCallouts || [],
    nodeLabels: annotationObject.userData.caesarAnnotationSidecar?.nodeLabels || [],
    nodeCalloutMap: annotationObject.userData.caesarAnnotationNodeCalloutMap || {},
    markerCount: annotationObject.userData.caesarAnnotationStats?.markerCount || 0,
  });
  root.add(annotationObject);

  root.userData = {
    ...(root.userData || {}),
    caesarAnnotationCoreSchema: annotationObject.userData.caesarAnnotationCoreSchema,
    caesarAnnotationCoreMode: annotationObject.userData.caesarAnnotationCoreMode,
    caesarAnnotationSidecarSchema: annotationObject.userData.caesarAnnotationSidecarSchema,
    caesarAnnotationSidecar: annotationObject.userData.caesarAnnotationSidecar,
    caesarAnnotationCallouts: annotationObject.userData.caesarAnnotationCallouts,
    caesarAnnotationNodeLabels: annotationObject.userData.caesarAnnotationSidecar?.nodeLabels || [],
    caesarAnnotationNodeCalloutMap: annotationObject.userData.caesarAnnotationNodeCalloutMap,
    caesarAnnotationGeometrySummary: annotationObject.userData.caesarAnnotationGeometrySummary,
    bmCiiAnnotationTrace: annotationObject.userData.bmCiiTrace,
  };

  return annotationObject;
}

function buildVariantScene(model, variant, options) {
  const variantModel = filterSupportsForVariant(model, variant.supportSource);
  const preparedModel = prepareCaesarAnnotationCoreModel(variantModel, options.caesarAnnotation);

  const scene = options.annotationOnly
    ? new THREE.Scene()
    : buildExportScene(variantModel, null, {
        colorMode: variant.colorMode,
        supportRendering: {
          source: variant.supportSource,
          mode: 'bm-cii-glyph-only',
          authoritative: true,
        },
      });

  if (options.annotationOnly) {
    const root = new THREE.Group();
    root.name = 'PCF_EXPORT_ROOT';
    root.userData = {
      annotationOnly: true,
      colorMode: variant.colorMode,
      supportSource: variant.supportSource,
    };
    scene.add(root);
  }

  const annotationObject = addRobustAnnotationToScene(scene, preparedModel, options.caesarAnnotation);
  scene.name = `BM_CII_v11_robust_${variant.name}`;
  scene.userData = {
    ...(scene.userData || {}),
    schema: SCRIPT_SCHEMA,
    variant: variant.name,
    colorMode: variant.colorMode,
    supportSource: variant.supportSource,
    caesarAnnotationGeometrySummary: annotationObject.userData.caesarAnnotationGeometrySummary,
    bmCiiAnnotationTrace: annotationObject.userData.bmCiiTrace,
  };
  return scene;
}

function outputNameForVariant(variant) {
  const support = variant.supportSource === 'isonote' ? 'isonote' : 'inputxml';
  const color = variant.colorMode === 'temp1' ? 'temp1' : 'engineering';
  return `BM_CII_Enriched_${color}_v11_robust_${support}.glb`;
}

async function build(args) {
  const loaded = args.modelPath
    ? await readJson(args.modelPath)
    : deriveModelFromSidecar(await readJson(args.sidecarPath));

  const outDir = path.resolve(args.outDir || DEFAULT_OUT_DIR);
  await fs.mkdir(outDir, { recursive: true });

  const caesarAnnotation = {
    mode: 'robust-lowpoly-vector',
    nodeLabelMode: 'isonote-nodes-only',
    mergeMarkers: false,
    maxIsonoteCallouts: 4,
    maxNodeLabels: 4,
    preferredKeyNodes: [...BM_CII_ANNOTATION_NODES],
    discSegments: 16,
    leaderSegments: 6,
    digitHeightRatio: 0.42,
    exportFullTextInGlb: false,
  };

  const outputs = [];
  const sidecars = [];

  for (const variant of args.variants) {
    const scene = buildVariantScene(loaded, variant, {
      annotationOnly: args.annotationOnly,
      caesarAnnotation,
    });
    const fileName = outputNameForVariant(variant);
    const filePath = path.join(outDir, fileName);
    await fs.writeFile(filePath, await exportGlb(scene));

    const root = sceneRoot(scene);
    outputs.push({
      variant: variant.name,
      colorMode: variant.colorMode,
      supportSource: variant.supportSource,
      fileName,
      filePath,
      bytes: (await fs.stat(filePath)).size,
      supportGlyphOnly: Boolean(root.userData.bmCiiSupportGlyphOnly),
      supportGlyphsAuthoritative: Boolean(root.userData.bmCiiSupportGlyphsAuthoritative),
      supportGlyphOnlyCount: root.userData.bmCiiGlyphOnlySupportCount || 0,
      annotationSummary: root.userData.caesarAnnotationGeometrySummary || null,
      calloutCount: root.userData.caesarAnnotationCallouts?.length || 0,
      nodeLabelCount: root.userData.caesarAnnotationNodeLabels?.length || 0,
    });
    sidecars.push(root.userData.caesarAnnotationSidecar || buildCaesarAnnotationSidecar([], caesarAnnotation));
  }

  const mergedSidecar = {
    schema: 'bm-cii-v11-robust-sidecar/v1',
    scriptSchema: SCRIPT_SCHEMA,
    source: args.modelPath || args.sidecarPath,
    caesarAnnotationMode: caesarAnnotation.mode,
    nodeLabelMode: caesarAnnotation.nodeLabelMode,
    mergeMarkers: caesarAnnotation.mergeMarkers,
    annotationSource: 'sidecar.caesarAnnotationCallouts',
    allowedCallouts: [...BM_CII_ANNOTATION_CALLOUTS],
    allowedNodes: [...BM_CII_ANNOTATION_NODES],
    variants: outputs,
    callouts: sidecars[0]?.callouts || [],
    nodeLabels: sidecars[0]?.nodeLabels || [],
    nodeCalloutMap: sidecars[0]?.nodeCalloutMap || {},
    sidecars,
  };

  const manifest = {
    schema: 'bm-cii-v11-robust-manifest/v1',
    scriptSchema: SCRIPT_SCHEMA,
    createdAtUtc: new Date().toISOString(),
    source: args.modelPath || args.sidecarPath,
    annotationOnly: args.annotationOnly,
    outputs,
    sidecar: 'BM_CII_Enriched_benchmark_v11_robust.sidecar.json',
  };

  await writeJson(path.join(outDir, 'BM_CII_Enriched_benchmark_v11_robust.sidecar.json'), mergedSidecar);
  await writeJson(path.join(outDir, 'BM_CII_Enriched_benchmark_v11_robust.manifest.json'), manifest);
  return manifest;
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(usage());
      return;
    }
    const manifest = await build(args);
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error?.stack || error?.message || String(error)}\n\n${usage()}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = fileURLToPath(import.meta.url);
if (invokedPath === modulePath) await main();

export {
  BM_CII_ANNOTATION_CALLOUTS,
  BM_CII_ANNOTATION_NODES,
  DEFAULT_VARIANTS,
  SCRIPT_SCHEMA,
  build,
  deriveModelFromSidecar,
  parseArgs,
  sanitizeCaesarAnnotationCallouts,
  supportComponentsFromSidecar,
};
