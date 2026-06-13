import assert from 'node:assert/strict';

import {
  DEFAULT_GLB_LABEL_VISIBILITY,
  shouldShowGlbLabelKind,
} from '../js/pcf2glb/advanced/glbLabelOverlay.js';

assert.equal(shouldShowGlbLabelKind('node', DEFAULT_GLB_LABEL_VISIBILITY), true);
assert.equal(shouldShowGlbLabelKind('support', DEFAULT_GLB_LABEL_VISIBILITY), true);
assert.equal(shouldShowGlbLabelKind('component', DEFAULT_GLB_LABEL_VISIBILITY), true);

const noNodes = { ...DEFAULT_GLB_LABEL_VISIBILITY, node: false };
assert.equal(shouldShowGlbLabelKind('node', noNodes), false);
assert.equal(shouldShowGlbLabelKind('support', noNodes), true);

const onlyNodes = Object.fromEntries(Object.keys(DEFAULT_GLB_LABEL_VISIBILITY).map((key) => [key, false]));
onlyNodes.node = true;
assert.equal(shouldShowGlbLabelKind('node', onlyNodes), true);
assert.equal(shouldShowGlbLabelKind('support', onlyNodes), false);
assert.equal(shouldShowGlbLabelKind('valve', onlyNodes), false);
assert.equal(shouldShowGlbLabelKind('unknown-kind', onlyNodes), false);

console.log('glb-label-overlay-toggle.test.js passed');
