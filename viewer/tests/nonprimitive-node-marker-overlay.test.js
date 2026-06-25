import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs/promises';

import {
  NODE_MARKER_ROOT_NAME,
  attachNodeMarkerGlyphs,
  clearNodeMarkerGlyphRoot,
  collectNodeMarkerRoots,
  createNodeMarkerGlyph,
} from '../overlays/nodes/NodeMarkerGlyphGeometry.js';

const markerBridge = await fs.readFile(new URL('../tabs/RvmNonPrimitiveNodeMarkerBridge.js', import.meta.url), 'utf8');
const renderer = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');

assert.match(markerBridge, /attachNodeMarkerGlyphs/, 'node marker bridge attaches glyphs after data build');
assert.match(markerBridge, /clearNodeMarkerGlyphRoot/, 'node marker bridge clears glyph root');
assert.match(markerBridge, /ensureNodeMarkerHover/, 'node marker bridge installs hover runtime');
assert.doesNotMatch(renderer, /NodeMarkerGlyphGeometry|RvmNonPrimitiveNodeMarkerHoverBridge/, 'renderer must not eagerly import node marker glyph/hover code');

const marker = {
  markerId: 'NODE-00001',
  markerKind: 'PIPE_TO_FLANGE',
  branchName: '/BR-GLYPH/B1',
  nodeNumber: 900,
  position: { x: 10, y: 20, z: 30 },
  sourcePath: '/BR-GLYPH/B1/PIPE-A',
  status: 'exact',
};

const glyph = createNodeMarkerGlyph(marker, { radius: 12 });
assert.ok(glyph, 'glyph is created for finite position');
assert.equal(glyph.name, 'NODE_MARKER_900');
assert.equal(glyph.userData.rvmNodeMarker, true);
assert.equal(glyph.userData.markerSelectable, true);
assert.equal(glyph.userData.pickable, false);
assert.equal(glyph.userData.primitiveExcluded, true);
assert.equal(glyph.userData.rvmSearchIndexed, false);
assert.equal(glyph.userData.rvmSelectionUsed, false);
assert.equal(glyph.userData.excludeFromRvmSearch, true);
assert.equal(Number(glyph.position.x), 10);
assert.equal(Number(glyph.position.y), 20);
assert.equal(Number(glyph.position.z), 30);

const scene = new THREE.Group();
const viewer = { scene };
const attached = attachNodeMarkerGlyphs(viewer, [marker], { sourceKind: 'json', sourceFile: 'glyph.json', radius: 12 });
assert.equal(attached.status, 'attached');
assert.equal(attached.glyphCount, 1);
const roots = collectNodeMarkerRoots(viewer);
assert.equal(roots.length, 1);
assert.equal(roots[0].name, NODE_MARKER_ROOT_NAME);
assert.equal(roots[0].userData.primitiveExcluded, true);
assert.equal(roots[0].userData.rvmSearchIndexed, false);
assert.equal(roots[0].children.length, 1);
assert.equal(roots[0].children[0].userData.rvmNodeMarkerDetails.markerId, 'NODE-00001');

const cleared = clearNodeMarkerGlyphRoot(viewer, 'test-clear');
assert.equal(cleared.status, 'cleared');
assert.equal(collectNodeMarkerRoots(viewer).length, 0);

console.log('nonprimitive-node-marker-overlay passed');
