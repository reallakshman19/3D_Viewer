import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const loader = await fs.readFile(new URL('../tabs/RvmDeferredBridgeLoader.js', import.meta.url), 'utf8');
const renderer = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const bridge = await fs.readFile(new URL('../tabs/RvmNonPrimitiveNodeMarkerBridge.js', import.meta.url), 'utf8');

assert.match(loader, /id: 'nonprimitive-node-markers'/, 'sourcePreview group includes node marker bridge');
assert.match(loader, /NODE_MARKER_BRIDGE_PREVIOUS_CACHE_KEY/, 'deferred loader records previous node marker cache key for audit');
assert.match(loader, /NODE_MARKER_BRIDGE_CACHE_KEY/, 'deferred loader records active node marker shell-slot cache key');
assert.match(loader, /20260626-node-marker-shell-slot-1/, 'deferred loader uses node marker shell-slot cache key');
assert.match(loader, /installRvmNonPrimitiveNodeMarkerBridge/, 'deferred loader installs node marker bridge');
assert.match(loader, /applyFromSource/, 'loader refresh path applies node markers');
assert.match(loader, /clear/, 'loader clear path clears node marker runtime');
assert.doesNotMatch(renderer, /RvmNonPrimitiveNodeMarkerBridge\.js\?v=/, 'renderer must not eagerly import node marker bridge');
assert.doesNotMatch(renderer, /installRvmNonPrimitiveNodeMarkerBridge\(\)/, 'renderer must not eagerly install node marker bridge');
assert.match(bridge, /rvm-non-primitive-node-marker-bridge\/v4|rvm-non-primitive-node-marker-bridge\/v5/, 'bridge exposes override-persistence-aware schema');
assert.match(bridge, /attachNodeMarkerGlyphs|ensureNodeMarkerHover|ensureNodeMarkerDetailsPanel/, 'bridge attaches glyphs, hover, and details through deferred runtime');
assert.match(bridge, /saveOverride|clearOverride|persistOverrides|getOverrides/, 'bridge exposes override persistence actions');
assert.match(bridge, /non-primitive-node-marker-api\/v3|evaluateNodeMarkerStaleness/, 'bridge uses override-aware stale-aware node marker API');
assert.doesNotMatch(bridge, /RvmSelectionAdapter|objectSearch|selectObject|pickObject/, 'bridge does not use primitive RVM selection or search');

console.log('nonprimitive-node-marker-deferred-bridge passed');
