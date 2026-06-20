import assert from 'node:assert/strict';
import {
  BROWSER_RVM_RENDER_SCENE_SCHEMA,
  buildBrowserRvmRenderSceneFromInstructions
} from '../../../rvm/BrowserRvmRenderSceneBuilder.js';

const baseInstruction = {
  schemaVersion: 'rvm-browser-render-instructions/v2',
  renderSource: 'bbox-derived-browser-contract',
  contractVersion: 'rvm-browser-geometry-contract/v1',
  axisStart: { x: 0, y: 0, z: 0 },
  axisEnd: { x: 100, y: 0, z: 0 },
  length: 100,
  radius: 10,
  diameter: 20
};

const instructions = [
  {
    ...baseInstruction,
    sourcePath: 'ROOT/PIPE 1/PRIM 1',
    sourceName: 'PRIM 1',
    displayName: 'PIPE-10-A',
    type: 'PIPE',
    kind: 'CYLINDER',
    renderPrimitive: 'CYLINDER_BBOX',
    center: { x: 50, y: 0, z: 0 },
    attributes: {
      TYPE: 'PIPE',
      RVM_BROWSER_ATT_ENRICHED: 'true',
      RVM_BROWSER_ATT_OWNER_QUERY: 'PIPE 1',
      LINE: 'PIPE-10-A',
      SERVICE: 'STEAM'
    },
    att: {
      enriched: true,
      schemaVersion: 'browser-rvm-att-enricher/v1',
      ownerQuery: 'PIPE 1',
      attributeCount: 2
    },
    attAttributes: {
      LINE: 'PIPE-10-A',
      SERVICE: 'STEAM'
    }
  },
  {
    ...baseInstruction,
    sourcePath: 'ROOT/RTORUS 1/PRIM 2',
    sourceName: 'PRIM 2',
    type: 'GASK',
    kind: 'TORUS',
    renderPrimitive: 'TORUS_BBOX_PLACEHOLDER',
    center: { x: 200, y: 0, z: 0 }
  },
  {
    ...baseInstruction,
    sourcePath: 'ROOT/REDUCER 1/PRIM 3',
    sourceName: 'PRIM 3',
    type: 'REDUCER',
    kind: 'CONE',
    renderPrimitive: 'CONE_BBOX_PLACEHOLDER',
    center: { x: 350, y: 0, z: 0 }
  },
  {
    ...baseInstruction,
    sourcePath: 'ROOT/STRUCTURE 1/PRIM 4',
    sourceName: 'PRIM 4',
    type: 'STRUCTURE',
    kind: 'STRUCTURE',
    renderPrimitive: 'BOX_BBOX',
    center: { x: 500, y: 0, z: 0 },
    axisStart: { x: 450, y: 0, z: 0 },
    axisEnd: { x: 550, y: 0, z: 0 },
    bbox: '450,-10,-10,550,10,10'
  },
  {
    ...baseInstruction,
    sourcePath: 'ROOT/ELBOW 1/PRIM 5',
    sourceName: 'PRIM 5',
    type: 'ELBOW',
    kind: 'ELBOW',
    renderPrimitive: 'ELBOW_BBOX_PLACEHOLDER',
    center: { x: 650, y: 0, z: 0 }
  },
  {
    ...baseInstruction,
    sourcePath: 'ROOT/TEE 1/PRIM 6',
    sourceName: 'PRIM 6',
    type: 'TEE',
    kind: 'TEE',
    renderPrimitive: 'TEE_BBOX_PLACEHOLDER',
    center: { x: 800, y: 0, z: 0 }
  },
  {
    ...baseInstruction,
    sourcePath: 'ROOT/FLANGE 1/PRIM 7',
    sourceName: 'PRIM 7',
    type: 'FLANGE',
    kind: 'FLANGE',
    renderPrimitive: 'FLANGE_BBOX_PLACEHOLDER',
    center: { x: 950, y: 0, z: 0 }
  },
  {
    ...baseInstruction,
    sourcePath: 'ROOT/SUPPORT 1/PRIM 8',
    sourceName: 'PRIM 8',
    type: 'SUPPORT',
    kind: 'SUPPORT',
    renderPrimitive: 'SUPPORT_BBOX_PLACEHOLDER',
    center: { x: 1100, y: 0, z: 0 }
  },
  {
    ...baseInstruction,
    sourcePath: 'ROOT/BAD 1/PRIM 9',
    sourceName: 'PRIM 9',
    type: 'UNKNOWN',
    kind: 'UNKNOWN',
    renderPrimitive: 'UNKNOWN_BBOX_PLACEHOLDER',
    center: null,
    axisStart: null,
    axisEnd: null,
    length: null,
    radius: null,
    diameter: null
  }
];

const result = buildBrowserRvmRenderSceneFromInstructions(instructions);
assert.equal(result.schemaVersion, BROWSER_RVM_RENDER_SCENE_SCHEMA);
assert.equal(result.scene.userData.schemaVersion, BROWSER_RVM_RENDER_SCENE_SCHEMA);
assert.equal(result.scene.userData.instructionSchemaVersion, '');
assert.equal(result.diagnostics.instructionCount, 9);
assert.equal(result.diagnostics.renderableCount, 8);
assert.equal(result.diagnostics.skippedCount, 1);
assert.equal(result.diagnostics.primitiveCounts.CYLINDER_BBOX, 1);
assert.equal(result.diagnostics.primitiveCounts.TORUS_BBOX_PLACEHOLDER, 1);
assert.equal(result.diagnostics.primitiveCounts.CONE_BBOX_PLACEHOLDER, 1);
assert.equal(result.diagnostics.primitiveCounts.BOX_BBOX, 1);
assert.equal(result.diagnostics.primitiveCounts.ELBOW_BBOX_PLACEHOLDER, 1);
assert.equal(result.diagnostics.primitiveCounts.TEE_BBOX_PLACEHOLDER, 1);
assert.equal(result.diagnostics.primitiveCounts.FLANGE_BBOX_PLACEHOLDER, 1);
assert.equal(result.diagnostics.primitiveCounts.SUPPORT_BBOX_PLACEHOLDER, 1);
assert.equal(result.diagnostics.skippedReasons['missing-position'], 1);
assert.equal(result.diagnostics.attCounts.enriched, 1);
assert.equal(result.diagnostics.attCounts.plain, 7);
assert.equal(result.scene.children.length, 8);
assert.equal(result.bounds.hasBounds, true);
assert.equal(result.scene.userData.bounds.hasBounds, true);
assert.equal(result.diagnostics.bounds.hasBounds, true);
assert.ok(Number.isFinite(result.bounds.min.x), 'bounds min should be finite');
assert.ok(Number.isFinite(result.bounds.max.x), 'bounds max should be finite');
assert.ok(result.bounds.max.x > result.bounds.min.x, 'bounds should have positive X size');
assert.ok(result.bounds.size.x > 0, 'bounds size.x should be positive');
assert.ok(result.bounds.radius > 0, 'bounds radius should be positive');

const pipe = result.scene.children.find((child) => child.userData.renderPrimitive === 'CYLINDER_BBOX');
assert.ok(pipe, 'cylinder render instruction should create a mesh');
assert.equal(pipe.name, 'PIPE-10-A');
assert.equal(pipe.userData.type, 'PIPE');
assert.equal(pipe.userData.kind, 'CYLINDER');
assert.equal(pipe.userData.sourcePath, 'ROOT/PIPE 1/PRIM 1');
assert.equal(pipe.userData.displayName, 'PIPE-10-A');
assert.equal(pipe.userData.browserRvmAttEnriched, true);
assert.equal(pipe.userData.browserRvmAtt.ownerQuery, 'PIPE 1');
assert.equal(pipe.userData.browserRvmAtt.attributeCount, 2);
assert.equal(pipe.userData.browserRvmAttAttributes.LINE, 'PIPE-10-A');
assert.equal(pipe.userData.browserRvmAttAttributes.SERVICE, 'STEAM');
assert.equal(pipe.userData.browserRvmAttributes.RVM_BROWSER_ATT_ENRICHED, 'true');
assert.ok(pipe.geometry?.type?.includes('Cylinder'), 'pipe should use CylinderGeometry');

const torus = result.scene.children.find((child) => child.userData.renderPrimitive === 'TORUS_BBOX_PLACEHOLDER');
assert.ok(torus, 'torus placeholder should be renderable');
assert.ok(torus.geometry?.type?.includes('Torus'), 'torus placeholder should use TorusGeometry');
assert.equal(torus.userData.kind, 'TORUS');
assert.equal(torus.userData.browserRvmAttEnriched, false);

const cone = result.scene.children.find((child) => child.userData.renderPrimitive === 'CONE_BBOX_PLACEHOLDER');
assert.ok(cone.geometry?.type?.includes('Cone'), 'cone placeholder should use ConeGeometry');

const box = result.scene.children.find((child) => child.userData.renderPrimitive === 'BOX_BBOX');
assert.ok(box.geometry?.type?.includes('Box'), 'box primitive should use BoxGeometry');
assert.equal(box.userData.type, 'STRUCTURE');

const elbow = result.scene.children.find((child) => child.userData.renderPrimitive === 'ELBOW_BBOX_PLACEHOLDER');
assert.ok(elbow?.isGroup, 'elbow placeholder should use a group');
assert.ok(elbow.children.some((child) => child.geometry?.type?.includes('Torus')), 'elbow should include arc geometry');

const tee = result.scene.children.find((child) => child.userData.renderPrimitive === 'TEE_BBOX_PLACEHOLDER');
assert.ok(tee?.isGroup, 'tee placeholder should use a group');
assert.ok(tee.children.filter((child) => child.geometry?.type?.includes('Cylinder')).length >= 2, 'tee should include main and branch cylinders');

const flange = result.scene.children.find((child) => child.userData.renderPrimitive === 'FLANGE_BBOX_PLACEHOLDER');
assert.ok(flange.geometry?.type?.includes('Cylinder'), 'flange should use a short cylinder/disc placeholder');

const support = result.scene.children.find((child) => child.userData.renderPrimitive === 'SUPPORT_BBOX_PLACEHOLDER');
assert.ok(support?.isGroup, 'support placeholder should use a group');
assert.ok(support.children.some((child) => child.geometry?.type?.includes('Box')), 'support should include a base box');

const emptyResult = buildBrowserRvmRenderSceneFromInstructions([
  {
    renderPrimitive: 'UNKNOWN_BBOX_PLACEHOLDER',
    center: null,
    axisStart: null,
    axisEnd: null
  }
]);
assert.equal(emptyResult.diagnostics.renderableCount, 0);
assert.equal(emptyResult.bounds.hasBounds, false);
assert.equal(emptyResult.diagnostics.bounds.hasBounds, false);
assert.equal(emptyResult.scene.userData.bounds.hasBounds, false);

console.log('Browser RVM render scene builder test passed');
