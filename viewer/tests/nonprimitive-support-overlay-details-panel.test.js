import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  buildSupportOverlayDetailsPanelState,
  emptySupportOverlayDetailsPanelState,
  renderSupportOverlayDetailsPanelHtml,
  SUPPORT_OVERLAY_DETAILS_PANEL_SCHEMA,
} from '../overlays/support/SupportOverlayDetailsPanel.js';

const details = {
  overlayKind: 'support',
  supportId: 'PS-101',
  supportNo: 'PS-101',
  family: 'GUIDE',
  rawType: 'GUIDE +/-Z',
  nodeId: '16990',
  sourceKind: 'json',
  sourceFile: 'managed-stage.json',
  sourceCoordinate: { x: 1000, y: 0, z: 50 },
  mappedCoordinate: { x: 1, y: 0, z: 0.05 },
  pipeAxis: { x: 1, y: 0, z: 0 },
  pipeAxisSource: 'nearest-segment',
  matchedPipeSegmentId: 'PIPE-A',
  gapMm: 10,
  gapVisualSeparationMm: 100,
  pipeOdMm: 114.3,
  warningCount: 2,
  warnings: ['axisFromNearestPipe'],
  coordinateWarnings: ['unitScaleApplied'],
  pipeAxisWarnings: ['nearestPipeAxisFallback'],
  attributes: {
    SUPPORT_NO: 'PS-101',
    SUPPORT_TYPE: 'GUIDE',
    COMPLEX: '[object]',
  },
  primitiveExcluded: true,
  rvmSearchIndexed: false,
  pickable: false,
  selectable: false,
};

const selected = buildSupportOverlayDetailsPanelState(details);
assert.equal(selected.schema, SUPPORT_OVERLAY_DETAILS_PANEL_SCHEMA);
assert.equal(selected.status, 'selected');
assert.equal(selected.supportId, 'PS-101');
assert.equal(selected.family, 'GUIDE');
assert.deepEqual(selected.sourceCoordinate, { x: 1000, y: 0, z: 50 });
assert.deepEqual(selected.mappedCoordinate, { x: 1, y: 0, z: 0.05 });
assert.deepEqual(selected.pipeAxis, { x: 1, y: 0, z: 0 });
assert.equal(selected.pipeAxisSource, 'nearest-segment');
assert.equal(selected.matchedPipeSegmentId, 'PIPE-A');
assert.equal(selected.gapMm, 10);
assert.equal(selected.gapVisualSeparationMm, 100);
assert.equal(selected.pipeOdMm, 114.3);
assert.equal(selected.primitiveExcluded, true);
assert.equal(selected.rvmSearchIndexed, false);
assert.equal(selected.pickable, false);
assert.equal(selected.selectable, false);
assert.ok(selected.warnings.includes('axisFromNearestPipe'));
assert.ok(selected.warnings.includes('unitScaleApplied'));
assert.ok(selected.warnings.includes('nearestPipeAxisFallback'));
assert.ok(selected.attributes.some((row) => row.key === 'SUPPORT_NO' && row.value === 'PS-101'));

const selectedHtml = renderSupportOverlayDetailsPanelHtml(selected);
assert.match(selectedHtml, /data-support-details-panel="selected"/);
assert.match(selectedHtml, /PS-101 GUIDE/);
assert.match(selectedHtml, /GUIDE \+\/-Z/);
assert.match(selectedHtml, /1, 0, 0/);
assert.match(selectedHtml, /10 mm · visual 100 mm/);
assert.match(selectedHtml, /data-support-details-action="copy-json"/);
assert.match(selectedHtml, /data-support-details-action="download-json"/);
assert.match(selectedHtml, /data-support-details-action="clear"/);

const empty = emptySupportOverlayDetailsPanelState('not-selected');
assert.equal(empty.status, 'empty');
assert.equal(empty.primitiveExcluded, true);
const emptyHtml = renderSupportOverlayDetailsPanelHtml(empty);
assert.match(emptyHtml, /data-support-details-panel="empty"/);
assert.match(emptyHtml, /Click a non-primitive support overlay glyph/);

const bridge = await fs.readFile(new URL('../tabs/RvmNonPrimitiveSupportOverlayDetailsPanelBridge.js', import.meta.url), 'utf8');
const renderer = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const sourceTools = await fs.readFile(new URL('../tabs/RvmNonPrimitiveSourceToolsUiBridge.js', import.meta.url), 'utf8');

assert.match(bridge, /rvm-non-primitive-support-overlay-details-panel\/v3/, 'details panel bridge exposes a versioned schema');
assert.match(bridge, /__RVM_NON_PRIMITIVE_SUPPORT_OVERLAY__/, 'details panel raycasts only the scoped non-primitive support overlay root');
assert.match(bridge, /raycaster\.intersectObjects/, 'details panel uses isolated raycasting instead of RVM primitive selection');
assert.match(bridge, /nonPrimitiveSupportOverlaySelectedDetails/, 'details panel stores selected details outside RVM primitive selection state');
assert.match(bridge, /supportOverlayDetails/, 'details panel reads source-backed glyph metadata');
assert.match(bridge, /highlightSupportOverlayGlyph/, 'details panel highlights the selected source support glyph');
assert.match(bridge, /nonPrimitiveSupportOverlayHighlightState/, 'details panel stores highlight state outside primitive selection state');
assert.match(bridge, /rvm-nonprimitive-support-details-selected/, 'details panel emits scoped selection event for UI refresh');
assert.match(bridge, /mode === 'source-preview' && isNonPrimitiveKind\(kind\)/, 'details panel is source-preview gated');
assert.match(bridge, /PRIMITIVE_KIND_RE[\s\S]*rvm\|glb\|gltf\|rev/, 'details panel excludes primitive formats');
assert.doesNotMatch(bridge, /RvmSupportSymbols|RvmSupportGeometryBridge|RvmRawSupportCylinderGuardBridge|Support Summary|SupportATT|SupportEngine/, 'details panel does not revive retired RVM support runtime or UI');
assert.doesNotMatch(bridge, /selection\.select|selection\.pick|RvmSelectionAdapter/, 'details panel does not call the RVM primitive selection adapter');

assert.match(renderer, /RvmNonPrimitiveSupportOverlayDetailsPanelBridge\.js\?v=20260623-nonprimitive-support-details-panel-3/, 'renderer imports details panel bridge with cache key');
assert.match(renderer, /installRvmNonPrimitiveSupportOverlayBridge\(\)[\s\S]*installRvmNonPrimitiveSupportOverlayDetailsPanelBridge\(\)[\s\S]*installRvmNonPrimitiveAutoBendBridge\(\)/, 'renderer installs details panel after support overlay and before auto-bend/source-tools');
assert.match(sourceTools, /rvm-nonprimitive-source-tools-panel/, 'source tools panel remains separate from support detail panel');

console.log('non-primitive support overlay details panel tests passed');
