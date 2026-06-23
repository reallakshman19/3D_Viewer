import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const uiBridgeSource = await fs.readFile(new URL('../tabs/RvmNonPrimitiveSourceToolsUiBridge.js', import.meta.url), 'utf8');
const workflowSource = await fs.readFile(new URL('../../.github/workflows/rvm-pcf-ci.yml', import.meta.url), 'utf8');

assert.match(uiBridgeSource, /snapshotKind:\s*'non-primitive-source-tools-diagnostics'/, 'diagnostics snapshot has a stable kind');
assert.match(uiBridgeSource, /primitiveExcluded:\s*true/, 'diagnostics snapshot explicitly records primitive exclusion');
assert.match(uiBridgeSource, /autoBend:\s*autoDiagnostics/, 'diagnostics snapshot includes auto-bend diagnostics');
assert.match(uiBridgeSource, /supportOverlay:\s*supportDiagnostics/, 'diagnostics snapshot includes support overlay diagnostics');
assert.match(uiBridgeSource, /supportPipeSegments/, 'diagnostics snapshot includes support pipe segment counts');
assert.match(uiBridgeSource, /supportOverlay:\s*supportDiagnostics/, 'support diagnostics snapshot preserves nested mapping and pipe-axis diagnostics when present');
assert.match(uiBridgeSource, /JSON\.stringify\(buildSourceToolsDiagnosticsSnapshot\(viewer, context\), null, 2\)/, 'copy action uses the canonical diagnostics snapshot JSON');
assert.match(uiBridgeSource, /navigator\?\.clipboard\?\.writeText/, 'copy action uses Clipboard API when available');
assert.match(uiBridgeSource, /document\.execCommand\?\.\('copy'\)/, 'copy action keeps a DOM fallback');
assert.match(uiBridgeSource, /new BlobCtor\(\[text\], \{ type: 'application\/json' \}\)/, 'download action exports JSON as a Blob');
assert.match(uiBridgeSource, /nonprimitive-source-tools-diagnostics-\$\{kind\}-\$\{stamp\}\.json/, 'download action uses a stable diagnostics filename');
assert.match(uiBridgeSource, /MAX_SNAPSHOT_DEPTH/, 'diagnostics snapshot has a depth guard');
assert.match(uiBridgeSource, /MAX_SNAPSHOT_ARRAY_LENGTH/, 'diagnostics snapshot has an array length guard');
assert.doesNotMatch(uiBridgeSource, /Support Summary|SupportATT|SupportEngine|rvm_support_render_mode_v1|rvm_support_geometry_mode_v1/, 'diagnostics export does not revive retired RVM support UI or settings');

assert.match(workflowSource, /nonprimitive-source-tools-diagnostics-export\.test\.js/, 'CI runs the diagnostics export contract');

console.log('nonprimitive-source-tools-diagnostics-export passed');
