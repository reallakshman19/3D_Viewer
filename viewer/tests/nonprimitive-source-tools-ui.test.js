import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const uiBridgeSource = await fs.readFile(new URL('../tabs/RvmNonPrimitiveSourceToolsUiBridge.js', import.meta.url), 'utf8');
const rendererSource = await fs.readFile(new URL('../tabs/viewer3d-rvm-tab-renderer.js', import.meta.url), 'utf8');
const autoBridgeSource = await fs.readFile(new URL('../tabs/RvmNonPrimitiveAutoBendBridge.js', import.meta.url), 'utf8');
const supportSettingsSource = await fs.readFile(new URL('../overlays/support/SupportOverlaySettings.js', import.meta.url), 'utf8');

assert.match(uiBridgeSource, /rvm-non-primitive-source-tools-ui\/v6/, 'source-tools UI exposes v6 schema marker');
assert.match(uiBridgeSource, /rvm-nonprimitive-source-tools-panel/, 'source-tools UI owns a compact panel id');
assert.match(uiBridgeSource, /installSourceToolsStyles/, 'source-tools UI installs compact layout styles');
assert.match(uiBridgeSource, /data\.rvmNonPrimitiveSourceToolsStyle = 'v6'/, 'source-tools UI style injection is versioned');
assert.match(uiBridgeSource, /data-source-tools-layout="compact-v1"/, 'source-tools UI renders compact layout marker');
assert.match(uiBridgeSource, /data-source-tools-group="auto-bend"/, 'source-tools UI groups auto-bend controls');
assert.match(uiBridgeSource, /data-source-tools-group="support-overlay"/, 'source-tools UI groups support overlay controls');
assert.match(uiBridgeSource, /rvm-source-tools-badge/, 'source-tools UI renders compact status/warning badges');
assert.match(uiBridgeSource, /@media \(max-width: 1150px\)/, 'source-tools UI includes narrow-panel responsive styling');
assert.match(uiBridgeSource, /rvmModelPrimitiveMode[\s\S]*source-preview/, 'source-tools UI is gated by source-preview mode');
assert.match(uiBridgeSource, /PRIMITIVE_KIND_RE[\s\S]*rvm\|glb\|gltf\|rev/, 'source-tools UI excludes primitive source kinds');
assert.match(uiBridgeSource, /clearSourceToolsUi/, 'source-tools UI exposes explicit primitive-mode cleanup');
assert.match(uiBridgeSource, /clearNonPrimitiveRuntime/, 'source-tools UI clears non-primitive overlay runtimes when leaving source-preview mode');
assert.match(uiBridgeSource, /panel\.innerHTML = ''/, 'source-tools UI clears stale panel content for primitive or unsupported modes');
assert.match(uiBridgeSource, /sourceToolsCleared/, 'source-tools UI marks cleared panel state for diagnostics/debugging');
assert.match(uiBridgeSource, /nonPrimitiveSourceToolsDiagnostics[\s\S]*status: 'cleared'/, 'source-tools UI publishes cleared diagnostics on primitive mode');
assert.match(uiBridgeSource, /primitiveExcluded: true/, 'source-tools UI cleared diagnostics preserves primitive exclusion marker');
assert.match(uiBridgeSource, /Auto Bend/, 'source-tools UI renders Auto Bend control');
assert.match(uiBridgeSource, /Support Overlay/, 'source-tools UI renders Support Overlay control');
assert.match(uiBridgeSource, /data-source-tool="support-scale"/, 'source-tools UI renders support overlay scale control');
assert.match(uiBridgeSource, /data-source-tool="support-filter"/, 'source-tools UI renders support family filter chips');
assert.match(uiBridgeSource, /SUPPORT_FILTER_FAMILIES/, 'source-tools UI has explicit support family filter list');
assert.match(uiBridgeSource, /Filtered:[\s\S]*supportDiag\.filteredOut/, 'source-tools UI shows filtered support count');
assert.match(uiBridgeSource, /renderSupportFilterSummary/, 'source-tools UI renders compact support filter summary');
assert.match(uiBridgeSource, /disabledFamilies/, 'source-tools UI surfaces disabled support families');
assert.match(uiBridgeSource, /skippedDuplicates|skippedGlyphs/, 'source-tools UI surfaces support skip counts');
assert.match(uiBridgeSource, /supportWarningCount/, 'source-tools UI computes support warning count');
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

assert.match(rendererSource, /RvmNonPrimitiveSourceToolsUiBridge\.js\?v=20260623-nonprimitive-source-tools-ui-6/, 'renderer imports source-tools UI bridge with v6 cache key');
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
