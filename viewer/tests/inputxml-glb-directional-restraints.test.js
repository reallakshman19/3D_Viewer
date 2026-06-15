import assert from 'node:assert/strict';
import * as THREE from 'three';

import { applyGlbSupportSymbols } from '../js/pcf2glb/advanced/applyGlbSupportSymbols.js';
import { buildExportScene } from '../js/pcf2glb/glb/buildExportScene.js';

function support(id, kind, axis = '', extra = {}) {
  const node = extra.node || '35';
  const recordId = extra.recordId || `inputxml:${id}`;
  return {
    id,
    type: 'SUPPORT',
    bmCiiSupportRecord: true,
    bmCiiGlyphOnlySupport: true,
    supportRenderingMode: 'bm-cii-glyph-only',
    recordId,
    sourceRecordIndex: extra.sourceRecordIndex || 1,
    source: 'inputxml',
    supportSource: 'inputxml',
    node,
    supportKind: kind,
    kind,
    axis,
    restraintAxis: axis,
    bore: extra.bore ?? 20,
    outsideDiameter: extra.outsideDiameter ?? 20,
    pipeRadius: extra.pipeRadius ?? 10,
    pipePoint: extra.pipePoint || { x: 100, y: 0, z: 0 },
    displayPointGlb: extra.pipePoint || { x: 100, y: 0, z: 0 },
    pipeTangent: extra.pipeTangent || { x: 1, y: 0, z: 0 },
    pipeTangentGlb: extra.pipeTangent || { x: 1, y: 0, z: 0 },
    gap: extra.gap ?? null,
    bidirectional: Boolean(extra.bidirectional),
    attributes: {
      SUPPORT_SOURCE: 'inputxml',
      SUPPORT_KIND: kind,
      AXIS: axis,
      NODE: node,
    },
    raw: {},
  };
}

function buildSupportScene(component) {
  const scene = buildExportScene({ components: [component] }, null, {
    supportRendering: {
      source: 'inputxml',
      mode: 'bm-cii-glyph-only',
      authoritative: true,
    },
  });
  const root = scene.getObjectByName('PCF_EXPORT_ROOT');
  assert.ok(root, 'export root should exist');
  assert.equal(root.userData.bmCiiSupportGlyphsAuthoritative, true, 'BM_CII glyph-only GLB must be authoritative');
  return { scene, root };
}

function supportRoot(root, recordId) {
  let found = null;
  root.traverse((object) => {
    if (object.userData?.supportRecordId === recordId || object.userData?.bmCiiTrace?.recordId === recordId) {
      if (object.userData?.bmCiiTrace?.entity === 'support') found = object;
    }
  });
  assert.ok(found, `support root ${recordId} should exist`);
  return found;
}

function primitives(root, recordId) {
  const out = [];
  root.traverse((object) => {
    const primitive = object.userData?.bmCiiGlyphPrimitive;
    if (!primitive) return;
    if (object.userData?.bmCiiTrace?.recordId !== recordId) return;
    out.push({ object, primitive, role: primitive.role });
  });
  return out;
}

function roles(root, recordId) {
  return primitives(root, recordId).map((entry) => entry.role);
}

function assertOnlyRoles(root, recordId, allowedPrefixes) {
  const actualRoles = roles(root, recordId);
  assert.ok(actualRoles.length > 0, `${recordId} should have visible glyph primitives`);
  for (const role of actualRoles) {
    assert.ok(
      allowedPrefixes.some((prefix) => role.startsWith(prefix)),
      `${recordId} has unexpected primitive role ${role}; roles=${actualRoles.join(', ')}`,
    );
  }
}

function headPrimitive(root, recordId, prefix) {
  const found = primitives(root, recordId).find((entry) => entry.role.startsWith(prefix) && entry.role.endsWith(':head'));
  assert.ok(found, `${recordId} should contain ${prefix}:head`);
  return found.primitive;
}

function vec(value) {
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function distancePointToLine(point, linePoint, lineDir) {
  const p = vec(point);
  const lp = vec(linePoint);
  const dir = vec(lineDir).normalize();
  return new THREE.Vector3().subVectors(p, lp).cross(dir).length();
}

const guideRecord = 'inputxml:GUIDE-Y';
const guideComponent = support('GUIDE-Y', 'GUIDE', 'Y', { recordId: guideRecord, pipeTangent: { x: 1, y: 0, z: 0 } });
const { scene: guideScene, root: guideExportRoot } = buildSupportScene(guideComponent);
const guide = supportRoot(guideExportRoot, guideRecord);
assert.equal(guide.userData.bmCiiTrace.supportKind, 'GUIDE');
assert.equal(guide.userData.bmCiiTrace.supportSymbolContract, 'guide-lateral-arrows-tip-at-od2');
assertOnlyRoles(guideExportRoot, guideRecord, ['guide-lateral-arrow-positive', 'guide-lateral-arrow-negative']);
assert.ok(!roles(guideExportRoot, guideRecord).some((role) => /vertical|axis|plate|block|rest|linestop|limit/i.test(role)), 'GUIDE must be lateral arrows only');
const guideHead = headPrimitive(guideExportRoot, guideRecord, 'guide-lateral-arrow-positive');
assert.ok(Math.abs(vec(guideHead.tip).distanceTo(vec(guide.userData.bmCiiTrace.pipePoint)) - guide.userData.bmCiiTrace.pipeRadius) < 1e-6, 'GUIDE tip must touch OD/2');

const restRecord = 'inputxml:REST-Y';
const { root: restRoot } = buildSupportScene(support('REST-Y', 'REST', 'Y', { recordId: restRecord, pipeTangent: { x: 1, y: 0, z: 0 } }));
const rest = supportRoot(restRoot, restRecord);
assert.equal(rest.userData.bmCiiTrace.supportSymbolContract, 'rest-vertical-arrow-tip-at-od2');
assertOnlyRoles(restRoot, restRecord, ['rest-vertical-arrow']);
const restHead = headPrimitive(restRoot, restRecord, 'rest-vertical-arrow');
assert.ok(Math.abs(Math.abs(vec(restHead.direction).dot(new THREE.Vector3(0, 1, 0))) - 1) < 1e-6, 'REST arrow must be vertical');
assert.ok(Math.abs(distancePointToLine(restHead.tip, rest.userData.bmCiiTrace.pipePoint, rest.userData.bmCiiTrace.pipeTangent) - rest.userData.bmCiiTrace.pipeRadius) < 1e-6, 'REST tip must touch OD surface');

const lineStopRecord = 'inputxml:LINESTOP-Z';
const { root: lineStopRoot } = buildSupportScene(support('LS-Z', 'LINESTOP', 'Z', { recordId: lineStopRecord, pipeTangent: { x: 1, y: 0, z: 0 } }));
const lineStop = supportRoot(lineStopRoot, lineStopRecord);
assert.equal(lineStop.userData.bmCiiTrace.supportSymbolContract, 'linestop-axial-arrows-offset-od2');
assertOnlyRoles(lineStopRoot, lineStopRecord, ['linestop-axial-arrow-positive', 'linestop-axial-arrow-negative']);
const lineStopHead = headPrimitive(lineStopRoot, lineStopRecord, 'linestop-axial-arrow-positive');
assert.ok(Math.abs(Math.abs(vec(lineStopHead.direction).dot(vec(lineStop.userData.bmCiiTrace.pipeTangent))) - 1) < 1e-6, 'LINESTOP arrow must be axial');
assert.ok(Math.abs(distancePointToLine(lineStopHead.tip, lineStop.userData.bmCiiTrace.pipePoint, lineStop.userData.bmCiiTrace.pipeTangent) - lineStop.userData.bmCiiTrace.pipeRadius) < 1e-6, 'LINESTOP arrow line must be offset OD/2');

const limitRecord = 'inputxml:LIMIT-X';
const { root: limitRoot } = buildSupportScene(support('LIMIT-X', 'LIMIT', 'X', { recordId: limitRecord, pipeTangent: { x: 1, y: 0, z: 0 }, gap: 10 }));
const limit = supportRoot(limitRoot, limitRecord);
assert.equal(limit.userData.bmCiiTrace.supportSymbolContract, 'limit-axial-arrow-offset-od2');
assertOnlyRoles(limitRoot, limitRecord, ['limit-axial-arrow-positive', 'limit-gap-tick']);
assert.equal(roles(limitRoot, limitRecord).filter((role) => role.startsWith('limit-axial-arrow') && role.endsWith(':head')).length, 1, 'LIMIT is one-way unless bidirectional');

const unknownRecord = 'inputxml:UNKNOWN';
const { root: unknownRoot } = buildSupportScene(support('UNKNOWN', 'UNKNOWN', '', { recordId: unknownRecord }));
const unknown = supportRoot(unknownRoot, unknownRecord);
assert.equal(unknown.userData.bmCiiTrace.supportSymbolContract, 'unknown-debug-default-off');
assert.equal(unknown.userData.bmCiiTrace.visibleDefault, false);
assert.equal(primitives(unknownRoot, unknownRecord).length, 0, 'UNKNOWN/TYPE0 must have no visible real support primitives');

const runtimeStats = applyGlbSupportSymbols(guideExportRoot, guideScene, { scaleMultiplier: 1 });
assert.equal(runtimeStats.created, 0);
assert.equal(runtimeStats.skipped, true, 'runtime overlay must skip authoritative baked BM_CII glyphs');
assert.equal(runtimeStats.reason, 'authoritative-baked-support-glyphs');

console.log('inputxml-glb-directional-restraints.test.js passed');
