#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

import { buildExportScene } from '../../viewer/js/pcf2glb/glb/buildExportScene.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_XML = 'Benchmarks/INPUT XML to CII 2019/BM_CII/BM_CII_INPUT.XML';
const DEFAULT_OUT_DIR = 'artifacts/bm-cii-visual-review';
const SENTINEL = -1.0101;
const EPS = 1e-9;
const DEFAULT_LONG_RADIUS_BEND_RATIO_D = 1.5;

function usage() {
  return `Usage:\n  node scripts/bm-cii/generate-bm-cii-visual-review-glb.mjs [--xml ${DEFAULT_XML}] [--out-dir ${DEFAULT_OUT_DIR}]\n\nGenerates a non-baseline BM_CII visual-review GLB from repo InputXML.\nThis is intentionally not a benchmark/QC acceptance gate and must not be frozen.\n`;
}

function parseArgs(argv) {
  const args = { xmlPath: DEFAULT_XML, outDir: DEFAULT_OUT_DIR };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--xml') args.xmlPath = argv[++i];
    else if (arg === '--out-dir') args.outDir = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function text(value) { return String(value ?? '').trim(); }
function num(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n - SENTINEL) < 1e-4) return null;
  return n;
}
function attrs(src = '') {
  const out = {};
  const re = /([A-Za-z0-9_:\-.]+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(src))) out[m[1]] = m[2];
  return out;
}
function nodeLabel(value) {
  const n = num(value);
  return n === null ? '' : String(Math.round(n));
}
function point(value, bore = undefined) {
  if (!value || typeof value !== 'object') return null;
  const x = Number(value.x ?? value[0]);
  const y = Number(value.y ?? value[1]);
  const z = Number(value.z ?? value[2]);
  if (![x, y, z].every(Number.isFinite)) return null;
  return bore ? { x, y, z, bore } : { x, y, z };
}
function v(x = 0, y = 0, z = 0) { return { x: Number(x) || 0, y: Number(y) || 0, z: Number(z) || 0 }; }
function add(a, b) { return v(a.x + b.x, a.y + b.y, a.z + b.z); }
function sub(a, b) { return v(a.x - b.x, a.y - b.y, a.z - b.z); }
function mul(a, s) { return v(a.x * s, a.y * s, a.z * s); }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function len(a) { return Math.sqrt(dot(a, a)); }
function norm(a) {
  const l = a ? len(a) : 0;
  return l > EPS ? mul(a, 1 / l) : null;
}
function midpoint(a, b) { return v((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); }
function defaultBendRadiusForBore(bore) {
  return Number.isFinite(Number(bore)) && Number(bore) > 0
    ? Number(bore) * DEFAULT_LONG_RADIUS_BEND_RATIO_D
    : null;
}

function classifyRigidType(rawType = '') {
  const raw = text(rawType).toUpperCase();
  if (/VALVE|\bVGT\b|\bVGL\b|\bVBA\b|\bVCH\b/.test(raw)) return 'VALVE';
  if (/FLANGE|\bFLG\b/.test(raw)) return 'FLANGE';
  if (/BEND|ELBOW|\bELB\b/.test(raw)) return 'BEND';
  if (/TEE|OLET|WELDOLET|SOCKOLET/.test(raw)) return 'TEE';
  if (/REDUC/.test(raw)) return 'REDUCER';
  if (/COUPLING|UNION/.test(raw)) return 'COUPLING';
  return 'COUPLING';
}

function parseElements(xml = '') {
  const elements = [];
  let inheritedDiameter = null;
  const elementRe = /<PIPINGELEMENT\b([^>]*)(?:\/>|>([\s\S]*?)<\/PIPINGELEMENT>)/g;
  let m;
  while ((m = elementRe.exec(xml))) {
    const head = attrs(m[1]);
    const block = m[2] || '';
    const from = nodeLabel(head.FROM_NODE);
    const to = nodeLabel(head.TO_NODE);
    if (!from || !to) continue;
    const diameter = num(head.DIAMETER);
    if (diameter && diameter > 0) inheritedDiameter = diameter;
    const rigids = [];
    const rigidRe = /<RIGID\b([^>]*)\/?\s*>/g;
    let r;
    while ((r = rigidRe.exec(block))) rigids.push(attrs(r[1]));
    const bends = [];
    const bendRe = /<BEND\b([^>]*)\/?\s*>/g;
    let b;
    while ((b = bendRe.exec(block))) bends.push(attrs(b[1]));
    elements.push({
      index: elements.length + 1,
      from,
      to,
      delta: v(num(head.DELTA_X) ?? 0, num(head.DELTA_Y) ?? 0, num(head.DELTA_Z) ?? 0),
      diameter: diameter ?? inheritedDiameter,
      head,
      rigids,
      bends,
    });
  }
  return elements;
}

function solveNodes(elements = []) {
  const nodes = new Map();
  let lastPoint = v(0, 0, 0);
  for (const e of elements) {
    let fromPoint = nodes.get(e.from);
    if (!fromPoint) {
      fromPoint = lastPoint;
      nodes.set(e.from, fromPoint);
    }
    let toPoint = nodes.get(e.to);
    if (!toPoint) {
      toPoint = add(fromPoint, e.delta);
      nodes.set(e.to, toPoint);
    }
    lastPoint = toPoint;
  }
  for (let guard = 0; guard < Math.max(elements.length * 4, 1); guard += 1) {
    let changed = false;
    for (const e of elements) {
      const a = nodes.get(e.from);
      const b = nodes.get(e.to);
      if (a && !b) { nodes.set(e.to, add(a, e.delta)); changed = true; }
      else if (!a && b) { nodes.set(e.from, sub(b, e.delta)); changed = true; }
    }
    if (!changed) break;
  }
  return Object.fromEntries([...nodes.entries()]);
}

function segmentsFromElements(elements = [], nodes = {}) {
  return elements.map((e) => {
    const p1 = nodes[e.from];
    const p2 = nodes[e.to];
    const d = p1 && p2 ? sub(p2, p1) : e.delta;
    return {
      elementIndex: e.index,
      from: e.from,
      to: e.to,
      p1,
      p2,
      tangent: norm(d),
      length: len(d),
      diameter: e.diameter,
      radius: e.diameter ? e.diameter / 2 : null,
    };
  });
}

function pipeComponentFromSegment(segment) {
  if (!segment.p1 || !segment.p2 || !segment.diameter) return null;
  const bore = Number(segment.diameter);
  return {
    id: `BM_CII_XML_PIPE_${String(segment.elementIndex).padStart(3, '0')}_${segment.from}_${segment.to}`,
    type: 'PIPE',
    source: 'inputxml',
    fromNode: String(segment.from),
    toNode: String(segment.to),
    bore,
    ep1: point(segment.p1, bore),
    ep2: point(segment.p2, bore),
    raw: { SOURCE: 'BM_CII_INPUT.XML', ELEMENT_INDEX: segment.elementIndex, FROM_NODE: segment.from, TO_NODE: segment.to, DIAMETER: bore },
    attributes: { SOURCE: 'BM_CII_INPUT.XML', COMPONENT_KIND: 'PIPE', ELEMENT_INDEX: String(segment.elementIndex) },
  };
}

function rigidComponentFromElement(element, rigid, segment, rigidIndex) {
  if (!segment?.p1 || !segment?.p2 || !segment?.diameter) return null;
  const rawType = rigid.TYPE || rigid.Type || rigid.DESCRIPTION || rigid.TYPE_DESC || '';
  const type = classifyRigidType(rawType);
  const bore = Number(segment.diameter);
  const suffix = `${String(element.index).padStart(3, '0')}_${element.from}_${element.to}_${String(rigidIndex + 1).padStart(2, '0')}`;
  return {
    id: `BM_CII_XML_RIGID_${suffix}_${type}`,
    type,
    source: 'inputxml',
    componentType: 'RIGID',
    typeDesc: rawType,
    fromNode: element.from,
    toNode: element.to,
    bore,
    ep1: point(segment.p1, bore),
    ep2: point(segment.p2, bore),
    raw: { ...rigid, SOURCE: 'BM_CII_INPUT.XML', ELEMENT_INDEX: element.index, FROM_NODE: element.from, TO_NODE: element.to, DIAMETER: bore, RIGID_TYPE: rawType },
    attributes: { SOURCE: 'BM_CII_INPUT.XML', COMPONENT_KIND: type, COMPONENT_TYPE: 'RIGID', TYPE: rawType, ELEMENT_INDEX: String(element.index) },
  };
}

function bendComponentFromElement(element, bend, segment, bendIndex) {
  if (!segment?.p1 || !segment?.p2 || !segment?.diameter) return null;
  const bore = Number(segment.diameter);
  const sourceRadius = num(bend.RADIUS ?? bend.BEND_RADIUS ?? bend.CURVE_RADIUS);
  const bendRadius = sourceRadius ?? defaultBendRadiusForBore(bore);
  const bendAngleDeg = num(bend.ANGLE ?? bend.BEND_ANGLE) ?? 90;
  return {
    id: `BM_CII_XML_BEND_${String(element.index).padStart(3, '0')}_${element.from}_${element.to}_${String(bendIndex + 1).padStart(2, '0')}`,
    type: 'BEND',
    source: 'inputxml',
    fromNode: element.from,
    toNode: element.to,
    bore,
    ep1: point(segment.p1, bore),
    ep2: point(segment.p2, bore),
    bendRadius,
    bendAngleDeg,
    bendRadiusRatioD: bendRadius && bore ? bendRadius / bore : null,
    bendMetadataSource: sourceRadius ? 'BM_CII_INPUT.XML/BEND' : 'BM_CII_INPUT.XML/BEND_DEFAULT_1_5D',
    bmCiiRequiresCurvedGeometry: true,
    raw: { ...bend, SOURCE: 'BM_CII_INPUT.XML', ELEMENT_INDEX: element.index, FROM_NODE: element.from, TO_NODE: element.to, DIAMETER: bore, BEND_RADIUS: bendRadius, BEND_RADIUS_RATIO_D: bendRadius && bore ? bendRadius / bore : null },
    attributes: {
      SOURCE: 'BM_CII_INPUT.XML',
      COMPONENT_KIND: 'BEND',
      COMPONENT_TYPE: 'BEND',
      ELEMENT_INDEX: String(element.index),
      BEND_METADATA_SOURCE: sourceRadius ? 'BM_CII_INPUT.XML/BEND' : 'BM_CII_INPUT.XML/BEND_DEFAULT_1_5D',
      BEND_MUST_RENDER_CURVED: 'true',
      BEND_RADIUS: String(bendRadius || ''),
      BEND_RADIUS_RATIO_D: bendRadius && bore ? String(bendRadius / bore) : '',
    },
  };
}

function outwardDirectionFromNode(segment, node) {
  const p1 = point(segment.p1); const p2 = point(segment.p2);
  if (!p1 || !p2) return null;
  if (String(segment.from) === String(node)) return norm(sub(p2, p1));
  if (String(segment.to) === String(node)) return norm(sub(p1, p2));
  return null;
}

function chooseTeeLegs(usable = []) {
  let best = null;
  for (let i = 0; i < usable.length; i += 1) {
    for (let j = i + 1; j < usable.length; j += 1) {
      const d = dot(usable[i].direction, usable[j].direction);
      if (!best || d < best.dot) best = { a: usable[i], b: usable[j], dot: d };
    }
  }
  if (!best) return null;
  const branch = usable
    .filter((entry) => entry !== best.a && entry !== best.b)
    .sort((a, b) => Number(b.segment.length || 0) - Number(a.segment.length || 0))[0];
  return branch ? { mainA: best.a, mainB: best.b, branch, mainOppositionDot: best.dot } : null;
}

function teeComponentsFromConnectivity(segments = []) {
  const byNode = new Map();
  for (const segment of segments) {
    if (!segment?.p1 || !segment?.p2 || !segment?.diameter) continue;
    for (const node of [segment.from, segment.to]) {
      const key = String(node);
      if (!byNode.has(key)) byNode.set(key, []);
      byNode.get(key).push(segment);
    }
  }
  const components = [];
  for (const [node, connected] of byNode.entries()) {
    const usable = connected.map((segment) => ({ segment, direction: outwardDirectionFromNode(segment, node) })).filter((entry) => entry.direction);
    if (usable.length < 3) continue;
    const chosen = chooseTeeLegs(usable);
    if (!chosen) continue;
    const center = String(chosen.mainA.segment.from) === node ? point(chosen.mainA.segment.p1) : point(chosen.mainA.segment.p2);
    const bore = Number(chosen.mainA.segment.diameter || chosen.mainB.segment.diameter || chosen.branch.segment.diameter);
    if (!center || !Number.isFinite(bore) || bore <= 0) continue;
    const radius = bore / 2;
    const reach = Math.max(radius * 5, Math.min(220, Math.max(...[chosen.mainA, chosen.mainB, chosen.branch].map((entry) => Number(entry.segment.length || 0))) * 0.22));
    components.push({
      id: `BM_CII_XML_TEE_NODE_${node}`,
      type: 'TEE',
      source: 'inputxml',
      node,
      bore,
      centrePoint: point(center, bore),
      ep1: point(add(center, mul(chosen.mainA.direction, reach)), bore),
      ep2: point(add(center, mul(chosen.mainB.direction, reach)), bore),
      branch1Point: point(add(center, mul(chosen.branch.direction, reach)), bore),
      bmCiiConnectivityDerived: true,
      raw: { SOURCE: 'BM_CII_INPUT.XML', NODE: node, COMPONENT_KIND: 'TEE', CONNECTED_ELEMENTS: usable.map((entry) => entry.segment.elementIndex).join(','), MAIN_OPPOSITION_DOT: chosen.mainOppositionDot },
      attributes: { SOURCE: 'BM_CII_INPUT.XML', COMPONENT_KIND: 'TEE', COMPONENT_TYPE: 'BRANCH_TEE', NODE: node, TEE_MAIN_OPPOSITION_DOT: String(chosen.mainOppositionDot) },
    });
  }
  return components;
}

function buildModelFromInputXml(xml = '') {
  const elements = parseElements(xml);
  const nodes = solveNodes(elements);
  const segments = segmentsFromElements(elements, nodes);
  const segmentByIndex = new Map(segments.map((segment) => [Number(segment.elementIndex), segment]));
  const bendElementIndexes = new Set(elements.filter((element) => element.bends.length).map((element) => Number(element.index)));
  const components = [];

  for (const segment of segments) {
    if (bendElementIndexes.has(Number(segment.elementIndex))) continue;
    const pipe = pipeComponentFromSegment(segment);
    if (pipe) components.push(pipe);
  }

  for (const element of elements) {
    const segment = segmentByIndex.get(Number(element.index));
    element.rigids.forEach((rigid, index) => {
      const component = rigidComponentFromElement(element, rigid, segment, index);
      if (component) components.push(component);
    });
    element.bends.forEach((bend, index) => {
      const component = bendComponentFromElement(element, bend, segment, index);
      if (component) components.push(component);
    });
  }

  components.push(...teeComponentsFromConnectivity(segments));
  const unique = [];
  const ids = new Set();
  for (const component of components) {
    if (!component?.id || ids.has(component.id)) continue;
    ids.add(component.id);
    unique.push(component);
  }

  return {
    schema: 'bm-cii-visual-review-model/v1',
    sourceXml: DEFAULT_XML,
    modelRole: 'clean-plant-geometry-only-review',
    nodeCoordinatesGlbBasisMm: nodes,
    nodes,
    components: unique,
    bmCiiVisualReview: true,
    bmCiiVisualReviewNote: 'Generated for user visual review only. Supports/annotations are intentionally not used as acceptance baseline in this GLB.',
  };
}

function ensureNodeFileReader() {
  if (typeof globalThis.FileReader !== 'undefined') return;
  if (typeof Blob === 'undefined') return;
  class NodeFileReader {
    constructor() { this.result = null; this.error = null; this.onload = null; this.onloadend = null; this.onerror = null; }
    addEventListener(type, listener) { if (type === 'load') this.onload = listener; else if (type === 'loadend') this.onloadend = listener; else if (type === 'error') this.onerror = listener; }
    removeEventListener(type, listener) { if (type === 'load' && this.onload === listener) this.onload = null; else if (type === 'loadend' && this.onloadend === listener) this.onloadend = null; else if (type === 'error' && this.onerror === listener) this.onerror = null; }
    async readAsArrayBuffer(blob) {
      try { this.result = await blob.arrayBuffer(); this.onload?.({ target: this }); this.onloadend?.({ target: this }); }
      catch (error) { this.error = error; this.onerror?.({ target: this }); this.onloadend?.({ target: this }); }
    }
    async readAsDataURL(blob) {
      try { const buffer = Buffer.from(await blob.arrayBuffer()); const mime = blob.type || 'application/octet-stream'; this.result = `data:${mime};base64,${buffer.toString('base64')}`; this.onload?.({ target: this }); this.onloadend?.({ target: this }); }
      catch (error) { this.error = error; this.onerror?.({ target: this }); this.onloadend?.({ target: this }); }
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

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function build(args) {
  const xmlPath = path.resolve(ROOT, args.xmlPath);
  const outDir = path.resolve(ROOT, args.outDir);
  const xml = await fs.readFile(xmlPath, 'utf8');
  const model = buildModelFromInputXml(xml);
  const scene = buildExportScene(model, null, {
    colorMode: 'engineering',
    supportRendering: { enabled: false, source: 'none', authoritative: false },
  });
  scene.name = 'BM_CII_visual_review_clean_inputxml';
  scene.userData = {
    ...(scene.userData || {}),
    bmCiiVisualReview: true,
    visualReviewOnly: true,
    notBaseline: true,
    sourceXml: args.xmlPath,
  };
  await fs.mkdir(outDir, { recursive: true });
  const glbName = 'BM_CII_visual_review_clean_inputxml.glb';
  const glbPath = path.join(outDir, glbName);
  await fs.writeFile(glbPath, await exportGlb(scene));
  const manifest = {
    schema: 'bm-cii-visual-review-manifest/v1',
    createdAtUtc: new Date().toISOString(),
    sourceXml: args.xmlPath,
    visualReviewOnly: true,
    notBenchmark: true,
    notBaseline: true,
    outputs: [{ fileName: glbName, filePath: glbPath, bytes: (await fs.stat(glbPath)).size }],
    componentCount: model.components.length,
    componentTypes: model.components.reduce((acc, component) => {
      const type = text(component.type || 'UNKNOWN').toUpperCase();
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {}),
  };
  await writeJson(path.join(outDir, 'BM_CII_visual_review_manifest.json'), manifest);
  await writeJson(path.join(outDir, 'BM_CII_visual_review_model.json'), model);
  return manifest;
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) { process.stdout.write(usage()); return; }
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

export { build, buildModelFromInputXml, parseArgs };
