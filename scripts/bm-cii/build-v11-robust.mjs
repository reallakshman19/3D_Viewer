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
import {
  supportComponentsFromSidecar,
  supportRecordMappingTable,
} from './sidecar-support-records.mjs';

const SCRIPT_SCHEMA = 'bm-cii-v11-robust-build-script/v2-record-supports';
const DEFAULT_OUT_DIR = 'artifacts/bm-cii-v11-robust';
const DEFAULT_VARIANTS = Object.freeze([
  { name: 'engineering_inputxml', colorMode: 'engineering', supportSource: 'inputxml' },
  { name: 'engineering_isonote', colorMode: 'engineering', supportSource: 'isonote' },
  { name: 'temp1_inputxml', colorMode: 'temp1', supportSource: 'inputxml' },
  { name: 'temp1_isonote', colorMode: 'temp1', supportSource: 'isonote' },
]);
const ALLOWED_CALLOUT_NODES = new Set(['35', '130', '205', '255']);

function usage() {
  return `Usage:
  node scripts/bm-cii/build-v11-robust.mjs --model <model.json> [--out-dir <dir>]
  node scripts/bm-cii/build-v11-robust.mjs --sidecar <sidecar.json> [--out-dir <dir>] [--annotation-only]

Purpose:
  Build BM_CII v11 robust GLB variants from the repo export path.
  Supports/restraints are converted as record-level objects; they are not merged by node.

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
    exporter.parse(scene, resolve, reject, { binary: true, onlyVisible: true, trs: false });
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

function calloutNo(value, index) {
  const n = Number(value?.no ?? value?.calloutNo ?? value?.label ?? index + 1);
  return Number.isFinite(n) ? n : index + 1;
}

function sanitizeCallouts(callouts = []) {
  return (Array.isArray(callouts) ? callouts : [])
    .map((callout, index) => ({
      no: calloutNo(callout, index),
      node: String(callout.node || callout.nodeNumber || callout.NODE || ''),
      text: callout.text || callout.caesarCalloutText || '',
      caesarCalloutText: callout.caesarCalloutText || callout.text || '',
      supportTokens: Array.isArray(callout.supportTokens) ? callout.supportTokens : [],
      sourceNotes: Array.isArray(callout.sourceNotes) ? callout.sourceNotes : [],
    }))
    .filter((callout) => callout.no >= 1 && callout.no <= 4)
    .filter((callout) => ALLOWED_CALLOUT_NODES.has(String(callout.node)))
    .filter((callout) => callout.text);
}

function stripComponentAnnotations(component = {}) {
  const raw = { ...(component.raw || {}) };
  const attributes = { ...(component.attributes || {}) };
  for (const key of ['ISONOTE', 'CAESAR_ISONOTE', 'NOTE', 'MESSAGE', 'Message']) {
    delete raw[key];
    delete attributes[key];
  }
  const clean = { ...component, raw, attributes };
  delete clean.isonote;
  delete clean.note;
  return clean;
}

function sanitizeModelForAnnotations(model = {}) {
  const callouts = sanitizeCallouts(model.caesarAnnotationCallouts || model.callouts || []);
  return {
    ...model,
    caesarAnnotationCallouts: callouts,
    callouts,
    isonotes: [],
    isonoteRows: [],
    components: (model.components || []).map(stripComponentAnnotations),
    elements: (model.elements || []).map(stripComponentAnnotations),
  };
}

function componentSupportSource(component = {}) {
  const raw = String(component.supportSource || component.source || component.attributes?.SUPPORT_SOURCE || component.raw?.SUPPORT_SOURCE || '').toLowerCase();
  return raw.includes('isonote') ? 'isonote' : 'inputxml';
}

function deriveModelFromSidecar(sidecar = {}) {
  const nodes = sidecar.nodeCoordinatesGlbBasisMm || sidecar.nodes || sidecar.nodeCoordinates || {};
  const normalizedNodes = Object.fromEntries(
    Object.entries(nodes)
      .map(([node, point]) => [String(node), normalizePoint(point)])
      .filter(([, point]) => point),
  );

  const caesarAnnotationCallouts = sanitizeCallouts(sidecar.caesarAnnotationCallouts || sidecar.callouts || []);
  const supportComponents = supportComponentsFromSidecar(sidecar, normalizedNodes);
  const replacementSources = new Set(supportComponents.map((component) => component.supportSource));
  const baseComponents = Array.isArray(sidecar.components) ? sidecar.components : [];
  const retainedComponents = baseComponents.filter((component) => (
    component.type !== 'SUPPORT' || !replacementSources.has(componentSupportSource(component))
  ));

  return {
    schema: 'bm-cii-v11-derived-model/from-sidecar-record-supports/v2',
    sourceSchema: sidecar.schema || '',
    components: [...retainedComponents, ...supportComponents],
    elements: sidecar.elements || [],
    nodes: normalizedNodes,
    nodeCoordinatesGlbBasisMm: normalizedNodes,
    caesarAnnotationCallouts,
    supportsInputXml: sidecar.supportsInputXml || [],
    supportsIsonote: sidecar.supportsIsonote || [],
    supportRecordMapping: supportRecordMappingTable(sidecar),
    sidecarSource: true,
  };
}

function filterSupportsForVariant(model, supportSource) {
  if (!Array.isArray(model.components)) return model;
  const selectedSource = supportSource === 'isonote' ? 'isonote' : 'inputxml';
  const components = model.components.filter((component) => {
    if (component.type !== 'SUPPORT') return true;
    return componentSupportSource(component) === selectedSource;
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
    caesarAnnotationNodeCalloutMap: annotationObject.userData.caesarAnnotationNodeCalloutMap,
    caesarAnnotationGeometrySummary: annotationObject.userData.caesarAnnotationGeometrySummary,
    bmCiiAnnotationTrace: annotationObject.userData.bmCiiTrace,
  };

  return annotationObject;
}

function buildVariantScene(model, variant, options) {
  const variantModel = filterSupportsForVariant(model, variant.supportSource);
  const annotationModel = prepareCaesarAnnotationCoreModel(sanitizeModelForAnnotations(variantModel), options.caesarAnnotation);

  const scene = options.annotationOnly
    ? new THREE.Scene()
    : buildExportScene(variantModel, null, {
        colorMode: variant.colorMode,
        supportRendering: { source: variant.supportSource },
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

  const annotationObject = addRobustAnnotationToScene(scene, annotationModel, options.caesarAnnotation);
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
  const loaded = args.modelPath ? await readJson(args.modelPath) : deriveModelFromSidecar(await readJson(args.sidecarPath));
  const outDir = path.resolve(args.outDir || DEFAULT_OUT_DIR);
  await fs.mkdir(outDir, { recursive: true });

  const caesarAnnotation = {
    mode: 'robust-lowpoly-vector',
    nodeLabelMode: 'off',
    mergeMarkers: true,
    maxIsonoteCallouts: 4,
    maxNodeLabels: 0,
    discSegments: 16,
    leaderSegments: 6,
    digitHeightRatio: 0.42,
    exportFullTextInGlb: false,
    preferredKeyNodes: [...ALLOWED_CALLOUT_NODES],
  };

  const outputs = [];
  const sidecars = [];

  for (const variant of args.variants) {
    const scene = buildVariantScene(loaded, variant, { annotationOnly: args.annotationOnly, caesarAnnotation });
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
      annotationSummary: root.userData.caesarAnnotationGeometrySummary || null,
    });
    sidecars.push(root.userData.caesarAnnotationSidecar || buildCaesarAnnotationSidecar([], caesarAnnotation));
  }

  const mergedSidecar = {
    schema: 'bm-cii-v11-robust-sidecar/v2-record-supports',
    scriptSchema: SCRIPT_SCHEMA,
    source: args.modelPath || args.sidecarPath,
    caesarAnnotationMode: caesarAnnotation.mode,
    nodeLabelMode: caesarAnnotation.nodeLabelMode,
    variants: outputs,
    callouts: sidecars[0]?.callouts || [],
    nodeCalloutMap: sidecars[0]?.nodeCalloutMap || {},
    supportRecordMapping: loaded.supportRecordMapping || [],
    sidecars,
  };

  const manifest = {
    schema: 'bm-cii-v11-robust-manifest/v2-record-supports',
    scriptSchema: SCRIPT_SCHEMA,
    createdAtUtc: new Date().toISOString(),
    source: args.modelPath || args.sidecarPath,
    annotationOnly: args.annotationOnly,
    outputs,
    sidecar: 'BM_CII_Enriched_benchmark_v11_robust.sidecar.json',
    supportRecordMapping: 'BM_CII_Enriched_benchmark_v11_robust.support-record-map.json',
  };

  await writeJson(path.join(outDir, 'BM_CII_Enriched_benchmark_v11_robust.sidecar.json'), mergedSidecar);
  await writeJson(path.join(outDir, 'BM_CII_Enriched_benchmark_v11_robust.support-record-map.json'), loaded.supportRecordMapping || []);
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
  DEFAULT_VARIANTS,
  SCRIPT_SCHEMA,
  build,
  deriveModelFromSidecar,
  parseArgs,
  sanitizeModelForAnnotations,
};
