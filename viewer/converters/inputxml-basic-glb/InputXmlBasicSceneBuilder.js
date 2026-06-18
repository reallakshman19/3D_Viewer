import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { parseInputXml, parseIsonoteExpectedRecords } from './InputXmlBasicParser.js';
import {
  COLORS,
  mat,
  vectorFrom,
  cylinderBetween,
  coneArrow,
  arrowToward,
  createTextPlane,
  createNodeLabel,
  createWarningTriangle,
  createSpringCoil,
  orthogonal,
  dominantAxis,
  axisVector
} from './InputXmlBasicGeometry.js';

const SCALE = 0.01;
const pipeMat = mat(COLORS.pipe);
const rigidMat = mat(COLORS.rigid, { emissive: 0x00352f, emissiveIntensity: 0.05 });
const bendMat = mat(COLORS.bend);
const restMat = mat(COLORS.rest, { emissive: 0x3a2d00, emissiveIntensity: 0.08 });
const guideMat = mat(COLORS.guide, { emissive: 0x003322, emissiveIntensity: 0.08 });
const lineMat = mat(COLORS.lineStop, { emissive: 0x003332, emissiveIntensity: 0.08 });
const holdMat = mat(COLORS.holddown, { emissive: 0x330026, emissiveIntensity: 0.08 });
const springMat = mat(COLORS.spring, { emissive: 0x331021, emissiveIntensity: 0.16 });
const leaderMat = new THREE.MeshBasicMaterial({ color: COLORS.isonote, toneMapped: false });
const nodeLeaderMat = new THREE.MeshBasicMaterial({ color: COLORS.node, toneMapped: false });

const KEY_NODE_LABELS = Object.freeze(['10', '20', '30', '35', '70', '80', '83', '86', '90', '100', '110', '113', '116', '120', '130', '140', '150', '160', '170', '180', '190', '200', '205', '210', '220', '230', '233', '236', '240', '250', '255', '260', '270', '280', '290', '300', '310', '320', '330', '340']);
const ISONOTE_OFFSETS = Object.freeze({
  '35': [-1.55, 1.18, 0.78],
  '130': [1.35, -0.58, 0.72],
  '205': [-2.55, 1.95, -1.05],
  '255': [1.20, 1.18, 0.82]
});

export async function convertInputXmlToGlb(xmlText, options = {}) {
  const model = parseInputXml(xmlText, options);
  const scene = new THREE.Scene();
  scene.name = 'InputXML_GLTF_SCENE';
  scene.userData = {
    app: 'inputxml-glb-standalone',
    converterVersion: '1.2.0-recovered-geometry-annotations',
    sourceMode: options.supportMode || 'compare',
    lineNoMode: options.lineNoMode || 'sideload-first',
    annotationRenderer: 'transparent-texture-two-sided-readable',
    generatedAt: new Date().toISOString()
  };

  const root = new THREE.Group();
  root.name = 'INPUTXML_GLB_ROOT';
  scene.add(root);

  const nodesGroup = new THREE.Group(); nodesGroup.name = 'nodes';
  const pipesGroup = new THREE.Group(); pipesGroup.name = 'plant.geometry';
  const supportGroup = new THREE.Group(); supportGroup.name = 'supports.restraints';
  const annGroup = new THREE.Group(); annGroup.name = 'annotations';
  root.add(pipesGroup, supportGroup, annGroup, nodesGroup);

  const elementByNode = buildElementIndex(model);
  const audit = {
    componentCount: model.elements.length,
    nodeCount: model.nodes.size,
    inputXmlRestraints: model.restraints.length,
    isonoteRecords: 0,
    supportSymbols: [],
    nodeAnnotations: 0,
    isonoteAnnotations: 0,
    componentMetadataUpdated: model.elements.length,
    options: { ...options }
  };

  for (const element of model.elements) createElementGeometry(element, pipesGroup, options);

  if (options.nodeLabels !== false) {
    const labels = nodeLabelsToRender(model, options);
    for (const node of model.nodes.values()) {
      const p = vectorFrom(node, SCALE);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), mat(COLORS.guide));
      dot.name = `NODE_DOT_${node.id}`;
      dot.position.copy(p);
      dot.userData = { TYPE: 'NODE', type: 'NODE', node: node.id, source: 'InputXML' };
      nodesGroup.add(dot);
      if (labels.has(String(node.id))) {
        const labelPos = p.clone().add(nodeLabelOffset(elementByNode, node.id));
        const labelScale = String(node.id).length > 2 ? 0.24 : 0.28;
        const label = createNodeLabel(`N${node.id}`, labelPos, labelScale);
        label.name = `NODE_ANNOTATION_${node.id}`;
        label.userData = { TYPE: 'NODE_ANNOTATION', node: node.id, label: `N${node.id}`, source: 'InputXML node annotation', colorRole: 'node-yellow' };
        const leader = cylinderBetween(p, labelPos, 0.01, nodeLeaderMat, 8, `NODE_ANNOTATION_LEADER_${node.id}`);
        leader.userData = { TYPE: 'NODE_ANNOTATION_LEADER', node: node.id };
        nodesGroup.add(leader, label);
        audit.nodeAnnotations += 1;
      }
    }
  }

  if (options.isonoteBoards !== false) {
    audit.isonoteAnnotations = createIsonoteAnnotations(model, annGroup, elementByNode);
  }

  const mode = options.supportMode || 'compare';
  if (mode === 'inputxml-actual' || mode === 'compare') {
    for (const rec of normalizeInputXmlRestraints(model)) {
      const symbols = createSupportSymbols(model, rec, elementByNode, 'actual');
      symbols.forEach(s => { supportGroup.add(s); audit.supportSymbols.push(s.userData); });
    }
  }
  if (mode === 'isonote-expected' || mode === 'compare') {
    const isonoteRecords = parseIsonoteExpectedRecords(model, options);
    audit.isonoteRecords = isonoteRecords.length;
    for (const rec of isonoteRecords) {
      const symbols = createSupportSymbols(model, rec, elementByNode, 'expected');
      symbols.forEach(s => { supportGroup.add(s); audit.supportSymbols.push(s.userData); });
    }
  }

  frameScene(scene);
  const glb = await exportSceneToGlb(scene);
  return { scene, glb, audit, model };
}

function numeric(value, fallback = 0) {
  const raw = typeof value === 'object' && value ? value.value : value;
  const n = Number(String(raw ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function resolvedBoreMm(element, fallback = 100) {
  const n = numeric(element.props.bore, element.props.boreMm || fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function createElementGeometry(element, group, options) {
  const a = vectorFrom(element.from, SCALE);
  const b = vectorFrom(element.to, SCALE);
  const od = resolvedBoreMm(element, 100) * SCALE;
  const radius = Math.max(0.05, od / 2);
  const userData = buildComponentUserData(element);
  const rawType = String(element.rawType || element.type || 'PIPE').toUpperCase();

  if (element.type.includes('BEND') || element.props.bendRadius) {
    const bend = createBendGeometry(a, b, radius, element, userData, options);
    group.add(bend);
    return;
  }

  if (rawType.includes('VALVE')) {
    group.add(createValveGeometry(a, b, radius, element, userData, rawType));
    return;
  }

  if (rawType.includes('FLANGE PAIR')) {
    group.add(createFlangePairGeometry(a, b, radius, element, userData));
    return;
  }

  if (rawType.includes('FLANGE')) {
    group.add(createFlangeGeometry(a, b, radius, element, userData));
    return;
  }

  if (rawType !== 'PIPE' && rawType !== 'BEND') {
    group.add(createRigidMarkerGeometry(a, b, radius, element, userData));
    return;
  }

  const cyl = cylinderBetween(a, b, radius, pipeMat, options.compactMode === false ? 28 : 20, element.id);
  cyl.userData = userData;
  group.add(cyl);
}

function createBendGeometry(a, b, radius, element, userData, options) {
  const group = new THREE.Group();
  group.name = element.id;
  group.userData = { ...userData, meshRole: 'BEND_GROUP' };
  const delta = b.clone().sub(a);
  const length = delta.length();
  if (length < 1e-6) return group;
  const dir = delta.clone().normalize();
  const lateral = orthogonal(dir);
  const declaredRadius = numeric(element.props.bendRadius, radius / SCALE) * SCALE;
  const bulge = Math.max(radius * 1.6, Math.min(length * 0.35, declaredRadius * 0.32));
  const control = a.clone().add(b).multiplyScalar(0.5).add(lateral.multiplyScalar(bulge));
  const curve = new THREE.QuadraticBezierCurve3(a, control, b);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, options.compactMode === false ? 48 : 32, radius, options.compactMode === false ? 18 : 14, false), bendMat);
  tube.name = `${element.id}_BEND_ARC`;
  tube.userData = { ...userData, meshRole: 'BEND_ARC', bendRadius: element.props.bendRadius, bendAngle: element.props.bendAngle };
  const marker = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.05, 18, 12), bendMat);
  marker.name = `${element.id}_BEND_NODE`;
  marker.position.copy(b);
  marker.userData = { ...userData, meshRole: 'BEND_MARKER' };
  group.add(tube, marker);
  return group;
}

function createValveGeometry(a, b, radius, element, userData, rawType) {
  const group = new THREE.Group();
  group.name = element.id;
  group.userData = { ...userData, meshRole: rawType.includes('FLANGED') ? 'VALVE_FLANGED_GROUP' : 'VALVE_GROUP' };
  const dir = b.clone().sub(a).normalize();
  const length = a.distanceTo(b);
  const center = a.clone().add(b).multiplyScalar(0.5);
  const core = cylinderBetween(a, b, radius * 0.86, rigidMat, 22, `${element.id}_pipe-core`);
  core.userData = { ...userData, meshRole: 'VALVE_PIPE_CORE' };
  const bodyHalf = Math.min(length * 0.28, Math.max(radius * 1.6, 0.32));
  const body = cylinderBetween(center.clone().sub(dir.clone().multiplyScalar(bodyHalf)), center.clone().add(dir.clone().multiplyScalar(bodyHalf)), radius * 1.42, rigidMat, 28, `${element.id}_body`);
  body.userData = { ...userData, meshRole: 'VALVE_BODY' };
  group.add(core, body);
  if (rawType.includes('FLANGED')) {
    const flangeOffset = Math.min(length * 0.42, bodyHalf + radius * 0.75);
    addFlangeDisc(group, center.clone().sub(dir.clone().multiplyScalar(flangeOffset)), dir, radius * 1.7, radius * 0.24, `${element.id}_flange-a`, userData);
    addFlangeDisc(group, center.clone().add(dir.clone().multiplyScalar(flangeOffset)), dir, radius * 1.7, radius * 0.24, `${element.id}_flange-b`, userData);
  }
  const up = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : orthogonal(dir);
  const stemStart = center.clone().add(up.clone().multiplyScalar(radius * 1.2));
  const stemEnd = center.clone().add(up.clone().multiplyScalar(radius * 2.7));
  const stem = cylinderBetween(stemStart, stemEnd, radius * 0.13, rigidMat, 12, `${element.id}_stem`);
  stem.userData = { ...userData, meshRole: 'VALVE_STEM' };
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.62, radius * 0.045, 8, 32), rigidMat);
  wheel.name = `${element.id}_handwheel`;
  wheel.position.copy(stemEnd);
  wheel.lookAt(stemEnd.clone().add(dir));
  wheel.userData = { ...userData, meshRole: 'VALVE_HANDWHEEL' };
  group.add(stem, wheel);
  return group;
}

function createFlangePairGeometry(a, b, radius, element, userData) {
  const group = new THREE.Group();
  group.name = element.id;
  group.userData = { ...userData, meshRole: 'FLANGE_PAIR_GROUP' };
  const dir = b.clone().sub(a).normalize();
  const length = a.distanceTo(b);
  const center = a.clone().add(b).multiplyScalar(0.5);
  const core = cylinderBetween(a, b, radius * 0.82, rigidMat, 20, `${element.id}_pipe-core`);
  core.userData = { ...userData, meshRole: 'FLANGE_PAIR_PIPE_CORE' };
  const offset = Math.max(radius * 0.55, Math.min(length * 0.28, radius * 1.2));
  addFlangeDisc(group, center.clone().sub(dir.clone().multiplyScalar(offset)), dir, radius * 1.55, radius * 0.23, `${element.id}_flange-a`, userData);
  addFlangeDisc(group, center.clone().add(dir.clone().multiplyScalar(offset)), dir, radius * 1.55, radius * 0.23, `${element.id}_flange-b`, userData);
  group.add(core);
  return group;
}

function createFlangeGeometry(a, b, radius, element, userData) {
  const group = new THREE.Group();
  group.name = element.id;
  group.userData = { ...userData, meshRole: 'FLANGE_GROUP' };
  const dir = b.clone().sub(a).normalize();
  const center = a.clone().add(b).multiplyScalar(0.5);
  const core = cylinderBetween(a, b, radius * 0.82, rigidMat, 20, `${element.id}_pipe-core`);
  core.userData = { ...userData, meshRole: 'FLANGE_PIPE_CORE' };
  addFlangeDisc(group, center, dir, radius * 1.62, radius * 0.28, `${element.id}_flange`, userData);
  group.add(core);
  return group;
}

function createRigidMarkerGeometry(a, b, radius, element, userData) {
  const group = new THREE.Group();
  group.name = element.id;
  group.userData = { ...userData, meshRole: 'RIGID_GROUP' };
  const dir = b.clone().sub(a).normalize();
  const center = a.clone().add(b).multiplyScalar(0.5);
  const core = cylinderBetween(a, b, radius * 0.86, rigidMat, 20, `${element.id}_pipe-core`);
  core.userData = { ...userData, meshRole: 'RIGID_PIPE_CORE' };
  const markerHalf = Math.min(a.distanceTo(b) * 0.22, Math.max(radius * 1.1, 0.22));
  const marker = cylinderBetween(center.clone().sub(dir.clone().multiplyScalar(markerHalf)), center.clone().add(dir.clone().multiplyScalar(markerHalf)), radius * 1.28, rigidMat, 22, `${element.id}_rigid-marker`);
  marker.userData = { ...userData, meshRole: 'RIGID_MARKER' };
  group.add(core, marker);
  return group;
}

function addFlangeDisc(group, center, dir, discRadius, thickness, name, userData) {
  const start = center.clone().sub(dir.clone().multiplyScalar(thickness / 2));
  const end = center.clone().add(dir.clone().multiplyScalar(thickness / 2));
  const disc = cylinderBetween(start, end, discRadius, rigidMat, 32, name);
  disc.userData = { ...userData, meshRole: 'FLANGE_DISC' };
  group.add(disc);
}

function buildComponentUserData(element) {
  const p = element.props;
  const resolved = (x) => typeof x === 'object' && x ? x.value : x;
  const source = (x) => typeof x === 'object' && x ? x.source : 'explicit';
  return {
    TYPE: 'COMPONENT',
    ID: p.id,
    id: p.id,
    refNo: p.refNo,
    engineeringType: p.type,
    meshRole: p.meshRole,
    lineNo: p.lineNo,
    lineNoSource: p.lineNoSource,
    fromNode: p.fromNode,
    toNode: p.toNode,
    bore: resolved(p.bore),
    boreSource: source(p.bore),
    boreMm: p.boreMm,
    wallThickness: resolved(p.wallThickness),
    wallThicknessSource: source(p.wallThickness),
    materialThickness: resolved(p.materialThickness),
    materialThicknessSource: source(p.materialThickness),
    material: resolved(p.material),
    materialSource: source(p.material),
    pressure: resolved(p.pressure),
    pressureSource: source(p.pressure),
    hydroPressure: resolved(p.hydroPressure),
    hydroPressureSource: source(p.hydroPressure),
    temp1: resolved(p.temp1),
    temp1Source: source(p.temp1),
    temp2: resolved(p.temp2),
    temp2Source: source(p.temp2),
    temp3: resolved(p.temp3),
    temp3Source: source(p.temp3),
    rigidType: p.rigidType,
    rigidWeight: p.rigidWeight,
    bendRadius: p.bendRadius,
    bendAngle: p.bendAngle,
    source: p.source
  };
}

function buildElementIndex(model) {
  const index = new Map();
  for (const el of model.elements) {
    for (const n of [el.fromNode, el.toNode]) {
      if (!index.has(n)) index.set(n, []);
      index.get(n).push(el);
    }
  }
  return index;
}

function nodeLabelsToRender(model, options = {}) {
  if (options.nodeLabelMode === 'all') return new Set(Array.from(model.nodes.keys()));
  if (Array.isArray(options.nodeLabelsList) && options.nodeLabelsList.length) return new Set(options.nodeLabelsList.map(String));
  const out = new Set(KEY_NODE_LABELS.filter((node) => model.nodes.has(node)));
  for (const node of model.isonoteMap.keys()) if (model.nodes.has(node)) out.add(node);
  return out;
}

function nodeLabelOffset(elementByNode, nodeId) {
  const tangent = localTangent(elementByNode, nodeId);
  const lateral = orthogonal(tangent);
  const lift = ['205', '255'].includes(String(nodeId)) ? 0.44 : 0.30;
  return lateral.multiplyScalar(0.48).add(new THREE.Vector3(0, lift, 0.24));
}

function createIsonoteAnnotations(model, group, elementByNode) {
  let count = 0;
  const seen = new Set();
  for (const [node, note] of model.isonoteMap.entries()) {
    if (seen.has(String(node))) continue;
    seen.add(String(node));
    const pos = nodePosition(model, node);
    if (!pos) continue;
    const p = vectorFrom(pos, SCALE);
    const offset = ISONOTE_OFFSETS[node]
      ? new THREE.Vector3(...ISONOTE_OFFSETS[node])
      : autoIsonoteOffset(elementByNode, node);
    const labelPos = p.clone().add(offset);
    const summary = summarizeIsonote(note);
    const long = node === '205';
    const label = createTextPlane(summary, {
      width: long ? 920 : 700,
      height: long ? 300 : 220,
      fontSize: long ? 54 : 48,
      scale: long ? 0.66 : 0.58,
      fg: '#e36af2',
      bg: 'rgba(0,0,0,0)',
      border: 'rgba(0,0,0,0)',
      align: 'left',
      name: `ISONOTE_ANNOTATION_NODE_${node}`,
      maxLineLength: long ? 30 : 28
    });
    label.position.copy(labelPos);
    label.userData = {
      TYPE: 'ISONOTE_ANNOTATION',
      node,
      source: 'ISONOTE SIDELOAD',
      sideloaded: true,
      sourceNoteName: note,
      summary,
      colorRole: 'isonote-magenta',
      annotationRenderer: 'transparent-texture-two-sided-readable'
    };
    const leaderEnd = labelPos.clone().add(new THREE.Vector3(-0.16, -0.12, 0));
    const leader = cylinderBetween(p, leaderEnd, 0.016, leaderMat, 8, `ISONOTE_ANNOTATION_LEADER_NODE_${node}`);
    leader.userData = { TYPE: 'ISONOTE_LEADER', node, sourceNoteName: note, colorRole: 'isonote-magenta' };
    group.add(leader, label);
    count += 1;
  }
  return count;
}

function autoIsonoteOffset(elementByNode, nodeId) {
  const tangent = localTangent(elementByNode, nodeId);
  const lateral = orthogonal(tangent);
  return lateral.multiplyScalar(1.55).add(new THREE.Vector3(0, 1.18, 0.68));
}

function summarizeIsonote(note) {
  const upper = String(note || '').toUpperCase();
  const lines = [];
  const ps = String(note || '').match(/PS-?\d+/i)?.[0]?.toUpperCase();
  if (ps) lines.push(ps.replace('PS', 'PS-').replace('--', '-'));
  else lines.push('ISONOTE');
  if (/REST\s+NOT\s+DEFINED|NO\s+REST/.test(upper)) lines.push('REST NOT DEFINED');
  const rest = upper.match(/REST\s*\((\d+(?:\.\d+)?)\s*KN\)/i);
  if (rest) lines.push(`REST ${rest[1]}kN`);
  const guide = upper.match(/GUIDE\s*\((\d+(?:\.\d+)?)\s*KN\)/i);
  if (guide) lines.push(`GUIDE ${guide[1]}kN`);
  if (/NO\s+GUIDE|WITHOUT\s+GUIDE/.test(upper)) lines.push('NO GUIDE');
  const lineStop = upper.match(/LINE\s*STOP\s*\((\d+(?:\.\d+)?)\s*KN\)/i);
  if (lineStop) lines.push(`LS ${lineStop[1]}kN`);
  if (/HOLD\s*DOWN|HOLDDOWN/.test(upper)) lines.push('HOLD');
  if (/SPRING|CAN\s+SPRING/.test(upper)) lines.push('SPRING WARN');
  const singleAxis = upper.match(/SINGLE\s+AXIS\s+([XYZ])/);
  if (singleAxis) lines.push(`SINGLE AXIS ${singleAxis[1]}`);
  return lines.join('\n');
}

function normalizeInputXmlRestraints(model) {
  return model.restraints.map((r) => {
    const family = classifyByTypeCode(r.typeCode);
    return {
      ...r,
      family,
      sourceMode: 'ACTUAL_INPUTXML',
      source: 'InputXML',
      axis: axisFromCosines(r) || 'PIPE_AXIAL_±',
      sourceNoteName: ''
    };
  });
}

function classifyByTypeCode(typeCode) {
  const t = String(typeCode || '').trim().toUpperCase();
  if (t === '7' || t.includes('GUIDE')) return 'GUIDE';
  if (t === '1' || t.includes('ANCHOR')) return 'ANCHOR';
  if (t.includes('HANGER') || t.includes('SPRING')) return 'SPRING';
  if (t.includes('LIM') || t.includes('LIMIT')) return 'LIMIT';
  if (t.includes('STOP') || t === '3') return 'LINE_STOP';
  return 'AXIS_RESTRAINT';
}

function axisFromCosines(r) {
  const axes = [ ['X', Math.abs(r.xCos || 0)], ['Y', Math.abs(r.yCos || 0)], ['Z', Math.abs(r.zCos || 0)] ];
  axes.sort((a, b) => b[1] - a[1]);
  if (axes[0][1] > 0.2) return `${(r[`${axes[0][0].toLowerCase()}Cos`] || 1) >= 0 ? '+' : '-'}${axes[0][0]}`;
  return null;
}

function createSupportSymbols(model, rec, elementByNode, sourceClass) {
  const pos = nodePosition(model, rec.node);
  if (!pos) return [];
  const p = vectorFrom(pos, SCALE);
  const tangent = localTangent(elementByNode, rec.node).normalize();
  const od = localOd(elementByNode, rec.node) * SCALE;
  const contactRadius = od / 2;
  const visualLane = od * 2 / 3;
  const gap = Number.isFinite(rec.gapMm) ? rec.gapMm * SCALE * 10 : 0;
  const family = rec.family;
  const prefix = `${sourceClass.toUpperCase()}_${rec.node}_${family}`;
  const out = [];
  const addMeta = (obj, extra = {}) => {
    obj.userData = {
      TYPE: 'SUPPORT_RESTRAINT',
      sourceClass,
      source: rec.source,
      sourceMode: rec.sourceMode,
      node: rec.node,
      family,
      axis: rec.axis,
      sign: rec.sign,
      loadText: rec.loadText,
      gapMm: rec.gapMm,
      sourceNoteName: rec.sourceNoteName,
      mappingContract: 'common-support-mapper-standalone',
      ...extra
    };
    return obj;
  };

  if (family === 'REST') {
    const start = p.clone().add(new THREE.Vector3(0, -contactRadius - gap - 0.55, 0));
    out.push(addMeta(coneArrow(start, new THREE.Vector3(0, 1, 0), 0.8, 0.16, restMat, `${prefix}_REST_PLUS_Y`), { engineeringContact: 'OD/2', visualResolverApplied: false }));
  } else if (family === 'HOLDDOWN') {
    const upTip = p.clone().add(new THREE.Vector3(0, contactRadius + gap, 0));
    const downTip = p.clone().add(new THREE.Vector3(0, -contactRadius - gap, 0));
    const g = new THREE.Group(); g.name = `${prefix}_HOLDDOWN_PM_Y`;
    g.add(arrowToward(upTip, new THREE.Vector3(0, -1, 0), 0.6, 0.14, holdMat, 'holddown_down'));
    g.add(arrowToward(downTip, new THREE.Vector3(0, 1, 0), 0.6, 0.14, holdMat, 'holddown_up'));
    out.push(addMeta(g, { engineeringContact: 'OD/2', visualResolverApplied: false }));
  } else if (family === 'GUIDE') {
    const guideAxes = guideAxesForTangent(tangent);
    const g = new THREE.Group(); g.name = `${prefix}_GUIDE`;
    for (const ax of guideAxes) {
      const d = axisVector(`+${ax}`);
      const tipPlus = p.clone().add(d.clone().multiplyScalar(contactRadius + gap));
      const tipMinus = p.clone().add(d.clone().multiplyScalar(-contactRadius - gap));
      g.add(arrowToward(tipPlus, d.clone().multiplyScalar(-1), 0.62, 0.13, guideMat, `guide_plus_${ax}`));
      g.add(arrowToward(tipMinus, d, 0.62, 0.13, guideMat, `guide_minus_${ax}`));
    }
    out.push(addMeta(g, { engineeringContact: 'OD/2', guideAxes, visualResolverApplied: false }));
  } else if (family === 'LINE_STOP' || family === 'LIMIT') {
    const lane = orthogonal(tangent).multiplyScalar(visualLane);
    const center = p.clone().add(lane);
    const separation = gap > 0 ? gap : 0.0;
    const tipA = center.clone().add(tangent.clone().multiplyScalar(separation / 2));
    const tipB = center.clone().add(tangent.clone().multiplyScalar(-separation / 2));
    const g = new THREE.Group(); g.name = `${prefix}_${family}_AXIAL_PM`;
    g.add(arrowToward(tipA, tangent.clone().multiplyScalar(-1), 0.72, 0.13, lineMat, `${family}_a`));
    g.add(arrowToward(tipB, tangent, 0.72, 0.13, lineMat, `${family}_b`));
    out.push(addMeta(g, { engineeringContact: 'axial-corner-touch', visualResolverApplied: true, visualResolver: 'OD*2/3', axialGapVisual: gap }));
  } else if (family === 'AXIS_RESTRAINT_UNRESOLVED') {
    const marker = createWarningTriangle('!', 0.35);
    marker.name = `${prefix}_UNRESOLVED_WARNING`;
    marker.position.copy(p.clone().add(new THREE.Vector3(0.0, Math.max(0.85, od), 0.65)));
    out.push(addMeta(marker, { popupRequired: true, warningText: rec.warningText || 'Axis sign required' }));
  } else if (family === 'AXIS_RESTRAINT') {
    const d = axisVector(rec.axis || '+X');
    const lane = Math.abs(d.dot(tangent)) > 0.85 ? orthogonal(tangent).multiplyScalar(visualLane) : new THREE.Vector3();
    const start = p.clone().add(lane).sub(d.clone().multiplyScalar(0.1));
    out.push(addMeta(coneArrow(start, d, 0.75, 0.13, lineMat, `${prefix}_AXIS_${rec.axis}`), { visualResolverApplied: lane.length() > 0 }));
  } else if (family === 'SPRING_WARNING' || family === 'SPRING') {
    const below = p.clone().add(new THREE.Vector3(0, -contactRadius - 0.85 - gap, 0));
    out.push(addMeta(createSpringCoil(below, tangent, 0.16, 0.9, springMat, `${prefix}_SPRING_COIL_BELOW_PIPE`), { warningText: rec.warningText || 'Spring / hanger', engineeringContact: 'below-pipe-clearance' }));
  }

  if (sourceClass === 'expected' && out.length) {
    out.forEach(o => o.traverse?.(child => { if (child.material?.color) child.material.opacity = 0.96; }));
  }
  return out;
}

function guideAxesForTangent(tangent) {
  const dom = dominantAxis(tangent);
  if (dom === 'X') return ['Z'];
  if (dom === 'Z') return ['X'];
  return ['X', 'Z'];
}

function nodePosition(model, nodeId) {
  return model.nodes.get(String(Number(nodeId))) || null;
}

function localTangent(elementByNode, nodeId) {
  const els = elementByNode.get(String(Number(nodeId))) || [];
  if (!els.length) return new THREE.Vector3(1, 0, 0);
  const e = els[0];
  const v = new THREE.Vector3(e.dx, e.dy, e.dz);
  if (v.lengthSq() < 1e-8) return new THREE.Vector3(1, 0, 0);
  return v.normalize();
}

function localOd(elementByNode, nodeId) {
  const els = elementByNode.get(String(Number(nodeId))) || [];
  if (!els.length) return 100;
  return resolvedBoreMm(els[0], 100);
}

function frameScene(scene) {
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  scene.position.sub(center);
}

export function exportSceneToGlb(scene) {
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else resolve(new TextEncoder().encode(JSON.stringify(result)).buffer);
      },
      (err) => reject(err),
      { binary: true, includeCustomExtensions: false, trs: false, onlyVisible: true }
    );
  });
}
