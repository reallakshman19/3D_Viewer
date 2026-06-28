import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RVM_RIGHT_PANEL_SECTIONS,
  getRvmRightPanelPolicy,
  getRvmRightPanelSections,
  hasRvmRightPanelSection,
} from '../tabs/RvmFormatPolicy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerRoot = path.resolve(__dirname, '..');
function read(relativePath) {
  const file = path.join(viewerRoot, relativePath);
  assert.ok(fs.existsSync(file), `missing source file: ${relativePath}`);
  return fs.readFileSync(file, 'utf8');
}

const S = RVM_RIGHT_PANEL_SECTIONS;

const matrix = [
  { kind: 'rvm', mode: 'rvm-native', yes: [S.SELECTED_ENTITY, S.NATIVE_DIAGNOSTICS, S.BROWSER_DIAGNOSTICS], no: [S.SOURCE_TOOLS, S.SUPPORT_DETAILS, S.NODE_MARKERS, S.STAGEDJSON_REVIEW] },
  { kind: 'rev', mode: 'rvm-native', yes: [S.SELECTED_ENTITY, S.NATIVE_DIAGNOSTICS, S.BROWSER_DIAGNOSTICS], no: [S.SOURCE_TOOLS, S.SUPPORT_DETAILS, S.NODE_MARKERS, S.STAGEDJSON_REVIEW] },
  { kind: 'glb', mode: 'glb-native', yes: [S.SELECTED_ENTITY, S.NATIVE_DIAGNOSTICS, S.BROWSER_DIAGNOSTICS], no: [S.SOURCE_TOOLS, S.SUPPORT_DETAILS, S.NODE_MARKERS, S.STAGEDJSON_REVIEW] },
  { kind: 'gltf', mode: 'glb-native', yes: [S.SELECTED_ENTITY, S.NATIVE_DIAGNOSTICS, S.BROWSER_DIAGNOSTICS], no: [S.SOURCE_TOOLS, S.SUPPORT_DETAILS, S.NODE_MARKERS, S.STAGEDJSON_REVIEW] },
  { kind: 'json', mode: 'source-preview', yes: [S.SELECTED_ENTITY, S.SOURCE_TOOLS, S.SUPPORT_DETAILS, S.NODE_MARKERS, S.BROWSER_DIAGNOSTICS], no: [S.STAGEDJSON_REVIEW, S.NATIVE_DIAGNOSTICS] },
  { kind: 'jscon', mode: 'source-preview', yes: [S.SELECTED_ENTITY, S.SOURCE_TOOLS, S.SUPPORT_DETAILS, S.NODE_MARKERS, S.BROWSER_DIAGNOSTICS], no: [S.STAGEDJSON_REVIEW, S.NATIVE_DIAGNOSTICS] },
  { kind: 'inputxml', mode: 'source-preview', yes: [S.SELECTED_ENTITY, S.SOURCE_TOOLS, S.SUPPORT_DETAILS, S.NODE_MARKERS, S.BROWSER_DIAGNOSTICS], no: [S.STAGEDJSON_REVIEW, S.NATIVE_DIAGNOSTICS] },
  { kind: 'txt', mode: 'source-preview', yes: [S.SELECTED_ENTITY, S.SOURCE_TOOLS, S.BROWSER_DIAGNOSTICS], no: [S.SUPPORT_DETAILS, S.NODE_MARKERS, S.STAGEDJSON_REVIEW, S.NATIVE_DIAGNOSTICS] },
  { kind: 'stagedjson', mode: 'source-preview', yes: [S.SELECTED_ENTITY, S.SOURCE_TOOLS, S.SUPPORT_DETAILS, S.NODE_MARKERS, S.STAGEDJSON_REVIEW, S.BROWSER_DIAGNOSTICS], no: [S.NATIVE_DIAGNOSTICS] },
];

for (const row of matrix) {
  const policy = getRvmRightPanelPolicy(row.kind, row.mode);
  const sections = getRvmRightPanelSections(policy);
  assert.ok(sections.length > 0, `${row.kind}/${row.mode} must have section policy`);
  for (const section of row.yes) {
    assert.equal(hasRvmRightPanelSection(policy, section), true, `${row.kind}/${row.mode} should show ${section}`);
  }
  for (const section of row.no) {
    assert.equal(hasRvmRightPanelSection(policy, section), false, `${row.kind}/${row.mode} should hide ${section}`);
  }
}

for (const kind of ['json', 'jscon', 'inputxml', 'txt', 'stagedjson']) {
  const policy = getRvmRightPanelPolicy(kind, 'rvm-native');
  assert.deepEqual(getRvmRightPanelSections(policy), [S.SELECTED_ENTITY, S.BROWSER_DIAGNOSTICS], `${kind} must not leak source-preview panels outside source-preview mode`);
}

const formatPolicy = read('tabs/RvmFormatPolicy.js');
const rightPanelBridge = read('tabs/RvmRightPanelFormatPolicyBridge.js');
const deferredLoader = read('tabs/RvmDeferredBridgeLoader.js');
const renderer = read('tabs/viewer3d-rvm-tab-renderer.js');

assert.match(formatPolicy, /RVM_RIGHT_PANEL_SECTIONS/, 'format policy must remain the canonical section registry');
assert.match(formatPolicy, /mode === 'source-preview'/, 'format policy must guard source-preview sections by primitive mode');
assert.match(rightPanelBridge, /applyRightPanelSectionPolicy/, 'right panel bridge must apply policy sections');
assert.match(rightPanelBridge, /orderRightPanelSections/, 'right panel bridge must own final right-panel ordering');
assert.match(rightPanelBridge, /hideEmptyRightPanelHeaders/, 'right panel bridge must own empty-header cleanup');
assert.match(deferredLoader, /RvmRightPanelFormatPolicyBridge\.js\?v=20260628-rvm-right-panel-layout-1/, 'deferred loader must load the final non-core right-panel bridge');
assert.match(renderer, /RvmDeferredBridgeLoader\.js\?v=20260628-rvm-deferred-right-panel-layout-1/, 'renderer must load the final non-core deferred loader');
assert.doesNotMatch(rightPanelBridge, /hideObsoleteSourcePreviewPanels/, 'old stale-panel cleanup hook must not return');
assert.doesNotMatch(deferredLoader, /SOURCE_PREVIEW_KIND_RE/, 'deferred loader must not reintroduce local source-preview regex policy');

console.log('right panel policy matrix and final non-core audit passed');
