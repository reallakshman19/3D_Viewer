import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  clearSupportOverlayHighlights,
  createEmptySupportOverlayHighlightState,
  highlightSupportOverlayGlyph,
  SUPPORT_OVERLAY_HIGHLIGHT_SCHEMA,
} from '../overlays/support/SupportOverlayHighlight.js';

function fakeMaterial(colorHex = 0x60c864) {
  return {
    color: {
      value: colorHex,
      setHex(value) { this.value = value; },
      getHex() { return this.value; },
    },
    opacity: 0.95,
    transparent: true,
    depthTest: true,
    disposed: false,
    clone() {
      return fakeMaterial(this.color.value);
    },
    dispose() {
      this.disposed = true;
    },
  };
}

function object({ userData = {}, material = null, children = [] } = {}) {
  const node = { userData, material, children };
  node.traverse = (visit) => {
    visit(node);
    for (const child of children) child.traverse ? child.traverse(visit) : visit(child);
  };
  for (const child of children) child.parent = node;
  return node;
}

const originalA = fakeMaterial(0x60c864);
const originalB = fakeMaterial(0xffcc33);
const glyph = object({
  userData: {
    supportOverlayDetails: {
      supportId: 'PS-101',
      family: 'GUIDE',
      primitiveExcluded: true,
      rvmSearchIndexed: false,
      pickable: false,
      selectable: false,
    },
    supportTag: 'PS-101',
    supportKind: 'GUIDE',
    pickable: false,
    selectable: false,
  },
  children: [
    object({ userData: { supportGlyphPart: 'arrow' }, material: originalA }),
    object({ userData: { supportGlyphPart: 'warning-marker' }, material: originalB }),
  ],
});
const root = object({ userData: { nonPrimitiveSupportOverlay: true }, children: [glyph] });

const highlighted = highlightSupportOverlayGlyph(glyph, [root], { supportId: 'PS-101', family: 'GUIDE' });
assert.equal(highlighted.schema, SUPPORT_OVERLAY_HIGHLIGHT_SCHEMA);
assert.equal(highlighted.status, 'highlighted');
assert.equal(highlighted.supportId, 'PS-101');
assert.equal(highlighted.family, 'GUIDE');
assert.equal(highlighted.highlightedParts, 2);
assert.equal(highlighted.primitiveExcluded, true);
assert.equal(highlighted.rvmSearchIndexed, false);
assert.equal(highlighted.pickable, false);
assert.equal(highlighted.selectable, false);
assert.equal(glyph.userData.supportOverlayHighlighted, true);
assert.equal(glyph.children[0].material === originalA, false, 'highlight clones child material instead of mutating original');
assert.equal(glyph.children[1].material === originalB, false, 'highlight clones warning material instead of mutating original');
assert.equal(glyph.children[0].userData.pickable, false);
assert.equal(glyph.children[0].userData.selectable, false);

const cleared = clearSupportOverlayHighlights([root], 'user-clear');
assert.equal(cleared.schema, SUPPORT_OVERLAY_HIGHLIGHT_SCHEMA);
assert.equal(cleared.status, 'cleared');
assert.equal(cleared.clearedOwners, 1);
assert.equal(cleared.restoredParts, 2);
assert.equal(glyph.userData.supportOverlayHighlighted, false);
assert.equal(glyph.children[0].material, originalA, 'clear restores original material');
assert.equal(glyph.children[1].material, originalB, 'clear restores original warning material');

const empty = createEmptySupportOverlayHighlightState('primitive-or-no-source-hierarchy');
assert.equal(empty.status, 'empty');
assert.equal(empty.primitiveExcluded, true);
assert.equal(empty.rvmSearchIndexed, false);
assert.equal(empty.pickable, false);
assert.equal(empty.selectable, false);

const helper = await fs.readFile(new URL('../overlays/support/SupportOverlayHighlight.js', import.meta.url), 'utf8');
const bridge = await fs.readFile(new URL('../tabs/RvmNonPrimitiveSupportOverlayDetailsPanelBridge.js', import.meta.url), 'utf8');
const renderer = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const geometry = await fs.readFile(new URL('../overlays/support/SupportOverlayGlyphGeometry.js', import.meta.url), 'utf8');

assert.match(helper, /support-overlay-highlight\/v1/, 'highlight helper exposes schema');
assert.match(helper, /__supportOverlayOriginalMaterial/, 'highlight helper stores original material for restore');
assert.match(helper, /material\.clone/, 'highlight helper clones materials before highlighting');
assert.match(helper, /clearSupportOverlayHighlights/, 'highlight helper exposes clear function');
assert.match(bridge, /rvm-non-primitive-support-overlay-details-panel\/v3/, 'details panel bridge schema bumped for highlight behavior');
assert.match(bridge, /highlightSupportOverlayGlyph/, 'details panel highlights selected source support glyph');
assert.match(bridge, /clearSupportOverlayHighlights/, 'details panel clears scoped source support highlights');
assert.match(bridge, /nonPrimitiveSupportOverlayHighlightState/, 'highlight state is stored outside RVM primitive selection state');
assert.match(bridge, /__RVM_NON_PRIMITIVE_SUPPORT_OVERLAY__/, 'highlight is scoped to the non-primitive support overlay root');
assert.doesNotMatch(bridge, /selection\.select|selection\.pick|RvmSelectionAdapter|objectSearch|searchIndex/, 'highlight bridge does not call RVM primitive selection or search/index code');
assert.match(geometry, /pickable:\s*false[\s\S]*selectable:\s*false/, 'glyph geometry remains non-pickable and non-selectable');
assert.match(renderer, /RvmNonPrimitiveSupportOverlayDetailsPanelBridge\.js\?v=20260623-nonprimitive-support-details-panel-3/, 'renderer imports highlighted details panel bridge cache key');

console.log('non-primitive support overlay highlight tests passed');
