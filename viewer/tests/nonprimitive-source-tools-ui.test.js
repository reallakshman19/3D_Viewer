import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const uiBridgeSource = await fs.readFile(new URL('../tabs/RvmNonPrimitiveSourceToolsUiBridge.js', import.meta.url), 'utf8');
const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const autoBridgeSource = await fs.readFile(new URL('../tabs/RvmNonPrimitiveAutoBendBridge.js', import.meta.url), 'utf8');
const supportSettingsSource = await fs.readFile(new URL('../overlays/support/SupportOverlaySettings.js', import.meta.url), 'utf8');

assert.match(uiBridgeSource, /rvm-non-primitive-source-tools-ui\/v3/, 'source-tools UI exposes v3 schema marker');
assert.match(uiBridgeSource, /rvm-nonprimitive-source-tools-panel/, 'source-tools UI owns a compact panel id');
assert.match(uiBridgeSource, /rvmModelPrimitiveMode[\s\S]*source-preview/, 'source-tools UI is gated by source-preview mode');
assert.match(uiBridgeSource, /PRIMITIVE_KIND_RE[\s\S]*rvm\|glb\|gltf\|rev/, 'source-tools UI excludes primitive source kinds');
assert.match(uiBridgeSource, /Auto Bend/, 'source-tools UI renders Auto Bend control');
assert.match(uiBridgeSource, /Support Overlay/, 'source-tools UI renders Support Overlay control');
assert.match(uiBridgeSource, /data-source-tool="support-scale"/, 'source-tools UI renders support overlay scale control');
assert.match(uiBridgeSource, /data-source-tool="support-filter"/, 'source-tools UI renders support family filter chips');
assert.match(uiBridgeSource, /SUPPORT_FILTER_FAMILIES/, 'source-tools UI has explicit support family filter list');
assert.match(uiBridgeSource, /Warnings:[\s\S]*supportWarningCount/, 'source-tools UI shows support warning count');
assert.match(uiBridgeSource, /Top warnings|No support overlay warnings/, 'source-tools UI shows compact support warning details');
assert.match(uiBridgeSource, /Copy diagnostics JSON/, 'source-tools UI exposes diagnostics copy action');
assert.match(uiBridgeSource, /Download diagnostics JSON/, 'source-tools UI exposes diagnostics download action');
assert.match(uiBridgeSource, /buildSourceToolsDiagnosticsSnapshot/, 'source-tools UI builds diagnostics snapshots');
assert.match(uiBridgeSource, /copySourceToolsDiagnostics/, 'source-tools UI exposes diagnostics copy API');
assert.match(uiBridgeSource, /downloadSourceToolsDiagnostics/, 'source-tools UI exposes diagnostics download API');
assert.match(uiBridgeSource, /writeNonPrimitiveAutoBendSettings/, 'source-tools UI persists auto-bend settings');
assert.match(uiBridgeSource, /writeNonPrimitiveSupportOverlaySettings\(\{ scale/, 'source-tools UI persists support overlay scale');
assert.match(uiBridgeSource, /writeNonPrimitiveSupportOverlaySettings\(\{ filters: nextSupportFilters/, 'source-tools UI persists support overlay family filters');
assert.match(uiBridgeSource, /writeNonPrimitiveSupportOverlaySettings/, 'source-tools UI persists support overlay settings');
assert.doesNotMatch(uiBridgeSource, /Support Summary|SupportATT|SupportEngine|Raw\/Symbol\/Both|rvm_support_render_mode_v1|rvm_support_geometry_mode_v1/, 'source-tools UI does not revive retired RVM support UI or keys');

assert.match(rendererSource, /RvmNonPrimitiveSourceToolsUiBridge\.js\?v=20260623-nonprimitive-source-tools-ui-3/, 'renderer imports source-tools UI bridge with v3 cache key');
assert.match(rendererSource, /installRvmNonPrimitiveSourceToolsUiBridge\(\)/, 'renderer installs source-tools UI bridge');

assert.match(autoBridgeSource, /restoreVisualTrimmedSegments/, 'auto-bend bridge can restore visual trims for live UI toggles');
assert.match(autoBridgeSource, /nonPrimitiveAutoBendOriginalSegmentChild/, 'auto-bend bridge preserves original source-preview segment children');
assert.doesNotMatch(autoBridgeSource, /for \(const child of \[\.\.\.obj\.children\]\)[\s\S]{0,160}disposeObjectTree\(child\)/, 'auto-bend trim no longer disposes original segment children during apply');

assert.match(supportSettingsSource, /supportOverlay\.nonPrimitive\./, 'support settings use new non-primitive key namespace');
assert.match(supportSettingsSource, /labels/, 'support settings include labels key');
assert.match(supportSettingsSource, /scale/, 'support settings include scale key');
assert.match(supportSettingsSource, /filters/, 'support settings include filters key');
assert.doesNotMatch(supportSettingsSource, /rvm_support_render_mode_v1|rvm_support_geometry_mode_v1|rvm_support_assembly_markers_v1|rvm\.rawInputXmlSupportPrimitives/, 'support settings ignore retired RVM support keys');

console.log('nonprimitive-source-tools-ui passed');
