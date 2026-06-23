import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const uiBridgeSource = await fs.readFile(new URL('../tabs/RvmNonPrimitiveSourceToolsUiBridge.js', import.meta.url), 'utf8');
const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const autoBridgeSource = await fs.readFile(new URL('../tabs/RvmNonPrimitiveAutoBendBridge.js', import.meta.url), 'utf8');
const supportSettingsSource = await fs.readFile(new URL('../overlays/support/SupportOverlaySettings.js', import.meta.url), 'utf8');

assert.match(uiBridgeSource, /rvm-non-primitive-source-tools-ui\/v1/, 'source-tools UI exposes schema marker');
assert.match(uiBridgeSource, /rvm-nonprimitive-source-tools-panel/, 'source-tools UI owns a compact panel id');
assert.match(uiBridgeSource, /rvmModelPrimitiveMode[\s\S]*source-preview/, 'source-tools UI is gated by source-preview mode');
assert.match(uiBridgeSource, /PRIMITIVE_KIND_RE[\s\S]*rvm\|glb\|gltf\|rev/, 'source-tools UI excludes primitive source kinds');
assert.match(uiBridgeSource, /Auto Bend/, 'source-tools UI renders Auto Bend control');
assert.match(uiBridgeSource, /Support Overlay/, 'source-tools UI renders Support Overlay control');
assert.match(uiBridgeSource, /writeNonPrimitiveAutoBendSettings/, 'source-tools UI persists auto-bend settings');
assert.match(uiBridgeSource, /writeNonPrimitiveSupportOverlaySettings/, 'source-tools UI persists support overlay settings');
assert.doesNotMatch(uiBridgeSource, /Support Summary|SupportATT|SupportEngine|Raw\/Symbol\/Both|rvm_support_render_mode_v1|rvm_support_geometry_mode_v1/, 'source-tools UI does not revive retired RVM support UI or keys');

assert.match(rendererSource, /RvmNonPrimitiveSourceToolsUiBridge\.js\?v=20260623-nonprimitive-source-tools-ui-1/, 'renderer imports source-tools UI bridge with cache key');
assert.match(rendererSource, /installRvmNonPrimitiveSourceToolsUiBridge\(\)/, 'renderer installs source-tools UI bridge');

assert.match(autoBridgeSource, /restoreVisualTrimmedSegments/, 'auto-bend bridge can restore visual trims for live UI toggles');
assert.match(autoBridgeSource, /nonPrimitiveAutoBendOriginalSegmentChild/, 'auto-bend bridge preserves original source-preview segment children');
assert.doesNotMatch(autoBridgeSource, /for \(const child of \[\.\.\.obj\.children\]\)[\s\S]{0,160}disposeObjectTree\(child\)/, 'auto-bend trim no longer disposes original segment children during apply');

assert.match(supportSettingsSource, /supportOverlay\.nonPrimitive\./, 'support settings use new non-primitive key namespace');
assert.match(supportSettingsSource, /labels/, 'support settings include labels key');
assert.doesNotMatch(supportSettingsSource, /rvm_support_render_mode_v1|rvm_support_geometry_mode_v1|rvm_support_assembly_markers_v1|rvm\.rawInputXmlSupportPrimitives/, 'support settings ignore retired RVM support keys');

console.log('nonprimitive-source-tools-ui passed');
