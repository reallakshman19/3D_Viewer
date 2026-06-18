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

const KEY_NODE_LABELS = Object.freeze(['10', '35', '130', '205', '240', '255', '270']);
const ISONOTE_OFFSETS = Object.freeze({
  '35': [1.35, 1.08, -1.00],
  '130': [1.20, -0.55, 0.65],
  '205': [-2.20, 1.75, -0.90],
  '255': [1.05, 1.10, 0.75]
});

export async function convertInputXmlToGlb(xmlText, options = {}) {
  const model = parseInputXml(xmlText, options);
  const scene = new THREE.Scene();
  scene.name = 'InputXML_GLTF_SCENE';
  scene.userData = {
    app: 'inputxml-glb-standalone',
    converterVersion: '1.1.0-recovered',
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
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), mat(COLORS.guide));
      sphere.name = `NODE_DOT_${node.id}`;
      sphere.position.copy(p);
      sphere.userData = { TYPE: 'NODE', type: 'NODE', node: node.id, source: 'InputXML' };
      nodesGroup.add(sphere);
      if (labels.has(String(node.id))) {
        const labelPos = p.clone().add(nodeLabelOffset(elementByNode, node.id));
        const label = createNodeLabel(`N${node.id}`, labelPos, 0.36);
        label.name = `NODE_ANNOTATION_${node.id}`;
        label.userData = { TYPE: 'NODE_ANNOTATION', node: node.id, label: `N${node.id}`, source: 'InputXML node annotation', colorRole: 'node-yellow' };
        const leader = cylinderBetween(p, labelPos, 0.012, nodeLeaderMat, 8, `NODE_ANNOTATION_LEADER_${node.id}`);
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

function createElementGeometry(element, group, options) {
  const a = vectorFrom(element.from, SCALE);
  const b = vectorFrom(element.to, SCALE);
  const od = numeric(element.props.bore, element.props.boreMm || 100) * SCALE;
  const radius = Math.max(0.05, od / 2);
  const isRigid = element.rawType && element.rawType !== 'PIPE' && element.rawType !== 'BEND';
  const material = isRigid ? rigidMat : element.type === 'BEND' ? bendMat : pipeMat;
  const cyl = cylinderBetween(a, b, radius, material, options.compactMode === false ? 24 : 18, element.id);
  cyl.userData = buildComponentUserData(element);
  group.add(cyl);

  if (isRigid) {
    const dir = b.clone().sub(a).normalize();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const collarA = cylinderBetween(mid.clone().sub(dir.clone().multiplyScalar(0.22)), mid.clone().add(dir.clone().multiplyScalar(0.22)), radius * 1.35, rigidMat, 18, `${element.id}_RIGID_MARKER`);
    collarA.userData = { ...cyl.userData, meshRole: 'RIGID_MARKER' };
    group.add(collarA);
  }

  if (element.type.includes('BEND') || element.props.bendRadius) {
    const bendNode = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.08, 16, 10), bendMat);
    bendNode.name = `${element.id}_BEND_NODE`;
    bendNode.position.copy(b);
    bendNode.userData = { ...cyl.userData, meshRole: 'BEND_MARKER' };
    group.add(bendNode);
  }
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
  return lateral.multiplyScalar(0.42).add(new THREE.Vector3(0, 0.30, 0.22));
}

function createIsonoteAnnotations(model, group, elementByNode) {
  let count = 0;
  for (const [node, note] of model.isonoteMap.entries()) {
    const pos = nodePosition(model, node);
    if (!pos) continue;
    const p = vectorFrom(pos, SCALE);
    const offset = ISONOTE_OFFSETS[node]
      ? new THREE.Vector3(...ISONOTE_OFFSETS[node])
      : autoIsonoteOffset(elementByNode, node);
    const labelPos = p.clone().add(offset);
    const summary = summarizeIsonote(note);
    const label = createTextPlane(summary, {
      width: node === '205' ? 760 : 560,
      height: node === '205' ? 250 : 180,
      fontSize: node === '205' ? 40 : 34,
      scale: node === '205' ? 0.44 : 0.36,
      fg: '#e36af2',
      bg: 'rgba(0,0,0,0)',
      border: 'rgba(0,0,0,0)',
      align: 'left',
      name: `ISONOTE_ANNOTATION_NODE_${node}`,
      maxLineLength: node === '205' ? 30 : 26
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
    const leaderEnd = labelPos.clone().add(new THREE.Vector3(-0.12, -0.08, 0));
    const leader = cylinderBetween(p, leaderEnd, 0.018, leaderMat, 8, `ISONOTE_ANNOTATION_LEADER_NODE_${node}`);
    leader.userData = { TYPE: 'ISONOTE_LEADER', node, sourceNoteName: note, colorRole: 'isonote-magenta' };
    group.add(leader, label);
    count += 1;
  }
  return count;
}

function autoIsonoteOffset(elementByNode, nodeId) {
  const tangent = localTangent(elementByNode, nodeId);
  const lateral = orthogonal(tangent);
  return lateral.multiplyScalar(1.25).add(new THREE.Vector3(0, 1.0, 0.55));
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
  const ls = upper.match(/LINE\s*STOP\s*\((\d+(?:\.\d+)?)\s*KN\)/i);
  if (ls) lines.push(`LS ${ls[1]}kN`);
  else if (/LINE\s*STOP/.test(upper)) lines.push('LINE STOP');
  if (/HOLD\s*DOWN|HOLDDOWN/.test(upper)) lines.push('HOLD');
  const single = upper.match(/SINGLE\s+AXIS\s+([XYZ])/);
  if (single) lines.push(`SINGLE AXIS ${single[1]}`);
  if (/CAN\s+SPRING|SPRING\s+CAN/.test(upper)) lines.push('SPRING WARN');
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
  if (v.lengthSq() < 1e-8) {
    const a = vectorFrom(e.from, 1);
    const b = vectorFrom(e.to, 1);
    const fallback = b.sub(a);
    if (fallback.lengthSq() > 1e-8) return fallback.normalize();
    return new THREE.Vector3(1, 0, 0);
  }
  return v.normalize();
}

function localOd(elementByNode, nodeId) {
  const els = elementByNode.get(String(Number(nodeId))) || [];
  if (!els.length) return 100;
  return numeric(els[0].props.bore, els[0].props.boreMm || 100);
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
