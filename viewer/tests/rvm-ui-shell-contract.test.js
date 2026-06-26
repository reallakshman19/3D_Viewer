import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerRoot = path.resolve(__dirname, '..');
const shellPath = path.join(viewerRoot, 'tabs/RvmViewerUiShell.js');
const rendererPath = path.join(viewerRoot, 'tabs/viewer3d-rvm-tab-renderer.js');
const drawerPath = path.join(viewerRoot, 'tabs/RvmBottomDiagnosticsDrawerBridge.js');
const reportPath = path.join(viewerRoot, 'tabs/RvmReportExportBridge.js');
const deferredPath = path.join(viewerRoot, 'tabs/RvmDeferredBridgeLoader.js');

function read(file) {
  assert.ok(fs.existsSync(file), `missing file: ${path.relative(viewerRoot, file)}`);
  return fs.readFileSync(file, 'utf8');
}

const shell = read(shellPath);
const renderer = read(rendererPath);
const drawer = read(drawerPath);
const report = read(reportPath);
const deferred = read(deferredPath);

function assertContains(source, pattern, message) {
  assert.ok(source.includes(pattern), message);
}

assertContains(shell, "const VERSION = '20260626-rvm-ui-shell-slots-2'", 'shell must expose current auditable version');
assertContains(shell, "const PREVIOUS_VERSION = '20260626-rvm-ui-shell-slots-1'", 'shell must retain previous cache evidence');
assertContains(shell, 'RVM_UI_SHELL_SLOTS', 'shell must define canonical slot IDs');
assertContains(shell, "selection: 'selection'", 'shell must include selection slot');
assertContains(shell, "sourceTools: 'source-tools'", 'shell must include source tools slot');
assertContains(shell, "nodeMarkers: 'node-markers'", 'shell must include node marker slot');
assertContains(shell, "supports: 'supports'", 'shell must include supports slot');
assertContains(shell, "diagnostics: 'diagnostics'", 'shell must include diagnostics slot');
assertContains(shell, "exports: 'exports'", 'shell must include exports slot');
assertContains(shell, "{ id: RVM_UI_SHELL_SLOTS.exports, label: 'Exports' }", 'shell must expose Exports right-panel tab');
assertContains(shell, 'installRvmViewerUiShell', 'shell must expose install lifecycle');
assertContains(shell, 'disposeRvmViewerUiShell', 'shell must expose dispose lifecycle');
assertContains(shell, 'syncRvmViewerUiShell', 'shell must expose sync lifecycle');
assertContains(shell, 'registerRvmToolPanel', 'shell must expose feature-panel registration');
assertContains(shell, 'setRvmRightPanelTab', 'shell must own right-panel tab state');
assertContains(shell, 'auditRvmViewerUiShell', 'shell must expose an audit function');
assertContains(shell, 'getRvmViewerUiShellDiagnostics', 'shell must expose diagnostics');
assertContains(shell, 'scheduleShellBootstrap', 'shell must handle renderer install before tab root exists');
assertContains(shell, 'data-rvm-panel-slot', 'shell must stamp stable panel slots');
assertContains(shell, 'data-rvm-right-panel-tabs', 'shell must own right-panel tab container');
assertContains(shell, 'data-rvm-right-panel-tab', 'shell must own right-panel tab buttons');
assertContains(shell, 'rvmUiShellAudit', 'shell must stamp root audit status');
assertContains(shell, 'registeredPanels', 'shell diagnostics must include registered panels');
assertContains(shell, 'auditBefore', 'shell diagnostics must preserve pre-sync audit evidence');
assertContains(shell, 'trace:', 'shell diagnostics must expose trace evidence');
assertContains(shell, 'moveKnownRightPanelContent', 'shell must preserve existing Properties/Diagnostics content');
assertContains(shell, '#rvm-attributes-panel', 'shell must preserve the current attributes panel');
assertContains(shell, '#rvm-browser-parse-diagnostics', 'shell must preserve browser diagnostics panel');
assertContains(shell, "slots.hierarchy !== 1", 'audit must enforce a single hierarchy slot');
assertContains(shell, "slots.selection !== 1", 'audit must enforce a single selection slot');
assertContains(shell, "slots.diagnostics !== 1", 'audit must enforce a single diagnostics slot');
assertContains(shell, "slots.exports !== 1", 'audit must enforce a single exports slot');
assertContains(shell, 'injectStyles', 'shell must include compact visual styling');
assertContains(shell, '.rvm-right-panel-tabs', 'shell styling must cover tab row');
assertContains(shell, '.rvm-panel-slot[hidden]', 'shell styling must hide inactive panel slots');
assertContains(renderer, 'RvmViewerUiShell.js?v=20260626-rvm-ui-shell-slots-2', 'renderer must import current shell cache key');
assertContains(renderer, 'RvmBottomDiagnosticsDrawerBridge.js?v=20260626-rvm-diagnostics-shell-slot-1', 'renderer must import shell-slot diagnostics drawer cache key');
assertContains(renderer, 'installRvmViewerUiShell()', 'renderer must install the shell owner');
assertContains(drawer, "DIAGNOSTICS_SLOT_SELECTOR = '[data-rvm-panel-slot=\"diagnostics\"]'", 'diagnostics drawer must target diagnostics shell slot');
assertContains(drawer, 'registerDiagnosticsPanel', 'diagnostics drawer must register with shell panel registry');
assertContains(drawer, "slot: 'diagnostics'", 'diagnostics drawer must register in diagnostics slot');
assertContains(drawer, 'root.insertBefore(drawer, statusbar)', 'diagnostics drawer must retain legacy statusbar fallback');
assertContains(report, "EXPORTS_SLOT_SELECTOR = '[data-rvm-panel-slot=\"exports\"]'", 'report export must target exports shell slot');
assertContains(report, 'registerExportsPanel', 'report export must register with shell panel registry');
assertContains(report, "slot: 'exports'", 'report export must register in exports slot');
assertContains(report, "setRightPanelTab?.(root, 'exports'", 'report export must activate Exports tab when opened');
assertContains(report, 'PREVIOUS_BRIDGE_VERSION', 'report export must retain previous bridge evidence');
assertContains(deferred, 'RvmReportExportBridge.js?v=20260626-rvm-report-export-shell-slot-1', 'deferred loader must import shell-slot report export bridge');
assert.ok(!shell.includes('convertXmlToCii'), 'shell must not include XML->CII conversion logic');
assert.ok(!shell.includes('xml-cii2019'), 'shell must not import XML CII worker logic');
assert.ok(!renderer.includes('installRvmViewerUiShell(RvmViewer3D'), 'shell install must not patch RvmViewer3D prototype');

console.log('Verified RVM UI shell source contract: slots, exports tab, lifecycle, diagnostics/export shell ownership, registration, renderer wiring, and XML-CII isolation.');
