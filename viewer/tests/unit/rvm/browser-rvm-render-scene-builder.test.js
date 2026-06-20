import assert from 'node:assert/strict';
import {
  BROWSER_RVM_RENDER_SCENE_SCHEMA,
  buildBrowserRvmRenderSceneFromInstructions
} from '../../../rvm/BrowserRvmRenderSceneBuilder.js';

const instructions = [
  {
    schemaVersion: 'rvm-browser-render-instructions/v2',
    sourcePath: 'ROOT/PIPE 1/PRIM 1',
    sourceName: 'PRIM 1',
    displayName: 'PIPE-10-A',
    type: 'PIPE',
    kind: 'CYLINDER',
    renderPrimitive: 'CYLINDER_BBOX',
    renderSource: 'bbox-derived-browser-contract',
    contractVersion: 'rvm-browser-geometry-contract/v1',
    center: { x: 50, y: 0, z: 0 },
    axisStart: { x: 0, y: 0, z: 0 },
    axisEnd: { x: 100, y: 0, z: 0 },
    length: 100,
    radius: 10,
    diameter: 20,
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
    schemaVersion: 'rvm-browser-render-instructions/v2',
    sourcePath: 'ROOT/RTORUS 1/PRIM 2',
    sourceName: 'PRIM 2',
    type: 'GASK',
    kind: 'TORUS',
    renderPrimitive: 'TORUS_BBOX_PLACEHOLDER',
    renderSource: 'bbox-derived-browser-contract',
    contractVersion: 'rvm-browser-geometry-contract/v1',
    center: { x: 200, y: 0, z: 0 },
    axisStart: { x: 150, y: 0, z: 0 },
    axisEnd: { x: 250, y: 0, z: 0 },
    length: 100,
    radius: 10,
    diameter: 20
  },
  {
    schemaVersion: 'rvm-browser-render-instructions/v2',
    sourcePath: 'ROOT/REDUCER 1/PRIM 3',
    sourceName: 'PRIM 3',
    type: 'REDUCER',
    kind: 'CONE',
    renderPrimitive: 'CONE_BBOX_PLACEHOLDER',
    renderSource: 'bbox-derived-browser-contract',
    contractVersion: 'rvm-browser-geometry-contract/v1',
    center: { x: 350, y: 0, z: 0 },
    axisStart: { x: 300, y: 0, z: 0 },
    axisEnd: { x: 400, y: 0, z: 0 },
    length: 100,
    radius: 10,
    diameter: 20
  },
  {
    schemaVersion: 'rvm-browser-render-instructions/v2',
    sourcePath: 'ROOT/STRUCTURE 1/PRIM 4',
    sourceName: 'PRIM 4',
    type: 'STRUCTURE',
    kind: 'STRUCTURE',
    renderPrimitive: 'BOX_BBOX',
    renderSource: 'bbox-derived-browser-contract',
    contractVersion: 'rvm-browser-geometry-contract/v1',
    center: { x: 500, y: 0, z: 0 },
    axisStart: { x: 450, y: 0, z: 0 },
    axisEnd: { x: 550, y: 0, z: 0 },
    length: 100,
    radius: 10,
    diameter: 20,
    bbox: '450,-10,-10,550,10,10'
  },
  {
    schemaVersion: 'rvm-browser-render-instructions/v2',
    sourcePath: 'ROOT/BAD 1/PRIM 5',
    sourceName: 'PRIM 5',
    type: 'UNKNOWN',
    kind: 'UNKNOWN',
    renderPrimitive: 'UNKNOWN_BBOX_PLACEHOLDER',
    renderSource: 'bbox-derived-browser-contract',
    contractVersion: 'rvm-browser-geometry-contract/v1',
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
assert.equal(result.diagnostics.instructionCount, 5);
assert.equal(result.diagnostics.renderableCount, 4);
assert.equal(result.diagnostics.skippedCount, 1);
assert.equal(result.diagnostics.primitiveCounts.CYLINDER_BBOX, 1);
assert.equal(result.diagnostics.primitiveCounts.TORUS_BBOX_PLACEHOLDER, 1);
assert.equal(result.diagnostics.primitiveCounts.CONE_BBOX_PLACEHOLDER, 1);
assert.equal(result.diagnostics.primitiveCounts.BOX_BBOX, 1);
assert.equal(result.diagnostics.skippedReasons['missing-position'], 1);
assert.equal(result.diagnostics.attCounts.enriched, 1);
assert.equal(result.diagnostics.attCounts.plain, 3);
assert.equal(result.scene.children.length, 4);

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

console.log('Browser RVM render scene builder test passed');
