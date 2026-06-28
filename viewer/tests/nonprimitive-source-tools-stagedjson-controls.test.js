import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settings = readFileSync('viewer/overlays/support/SupportOverlaySettings.js', 'utf8');
const autoBendGate = readFileSync('viewer/overlays/autobend/NonPrimitiveAutoBendGate.js', 'utf8');
const sourceKindPolicy = readFileSync('viewer/RvmSourceKindPolicy.js', 'utf8');
const formatPolicy = readFileSync('viewer/tabs/RvmFormatPolicy.js', 'utf8');
const supportBridge = readFileSync('viewer/tabs/RvmNonPrimitiveSupportOverlayBridge.js', 'utf8');
const supportDetailsBridge = readFileSync('viewer/tabs/RvmNonPrimitiveSupportOverlayDetailsPanelBridge.js', 'utf8');
const supportHoverBridge = readFileSync('viewer/tabs/RvmNonPrimitiveSupportOverlayHoverBridge.js', 'utf8');
const supportHardDisableBridge = readFileSync('viewer/tabs/RvmNonPrimitiveSupportOverlayHardDisableBridge.js', 'utf8');
const sourceToolsBridge = readFileSync('viewer/tabs/RvmNonPrimitiveSourceToolsUiBridge.js', 'utf8');
const sourceToolsGateBridge = readFileSync('viewer/tabs/RvmSourceToolsStagedJsonKindGateBridge.js', 'utf8');
const supportRuntimeGateBridge = readFileSync('viewer/tabs/RvmStagedJsonSupportRuntimeGateBridge.js', 'utf8');
const stagedJsonValidationBridge = readFileSync('viewer/tabs/RvmStagedJsonValidationBridge.js', 'utf8');
const inputXmlBridge = readFileSync('viewer/rvm-viewer/RvmInputXmlSupportGraphicsUiBridge.js', 'utf8');
const inputXmlSetModelBridge = readFileSync('viewer/rvm-viewer/RvmInputXmlSupportGraphicsSetModelBridge.js', 'utf8');
const leftBridge = readFileSync('viewer/tabs/RvmLeftPanelResizeCollapseBridge.js', 'utf8');
const axisTransform = readFileSync('viewer/overlays/source-tools/SourceAxisTransform.js', 'utf8');

assert.match(sourceKindPolicy, /RVM_SOURCE_KIND_POLICY_VERSION/, 'shared RVM source-kind policy must exist');
assert.match(sourceKindPolicy, /sourceKindFromFileName/, 'shared RVM source-kind policy must expose filename detection');
assert.match(autoBendGate, /RvmSourceKindPolicy\.js/, 'Auto Bend gate must use shared source-kind policy');
assert.match(formatPolicy, /RvmSourceKindPolicy\.js/, 'right-panel format policy must use shared source-kind policy');
assert.match(supportRuntimeGateBridge, /RvmSourceKindPolicy\.js/, 'stagedJSON support runtime gate must use shared source-kind policy');
assert.match(sourceToolsBridge, /RvmSourceKindPolicy\.js/, 'Source Tools UI bridge must use shared source-kind policy');

assert.match(settings, /labelsUserSet/, 'support overlay settings must distinguish stale label storage from explicit user label setting');
assert.match(settings, /labels:\s*labelsUserSet \? readBool\(storage, SUPPORT_OVERLAY_STORAGE_KEYS\.labels, false\) : false/, 'support labels must be false unless explicitly user-set');
assert.match(settings, /resetNonPrimitiveSupportOverlayLabels/, 'settings must expose a hard label-off helper');

assert.match(axisTransform, /source-axis-transform\/v1/, 'source axis transform schema must exist');
assert.match(axisTransform, /verticalAxis/, 'axis transform must expose vertical axis');
assert.match(axisTransform, /northAxis/, 'axis transform must expose north axis');
assert.match(axisTransform, /transformSourcePipeSegments/, 'axis transform must support pipe segment/resolver transformation');

assert.match(supportBridge, /SourceAxisTransform\.js/, 'support overlay must import source axis transform helper');
assert.match(supportBridge, /axisBasis:\s*sourceAxisBasis3\(axisTransform\)/, 'support coordinate mapper must use selected source axis transform');
assert.match(supportBridge, /transformSourcePipeSegments\(sourcePipeSegments, axisTransform\)/, 'support resolver pipe segments must use selected source axis transform');
assert.match(supportBridge, /labelsVisible:\s*Boolean\(settings\.labels\)/, 'support overlay diagnostics must expose final label visibility');
assert.match(supportBridge, /STAGED_JSON_SOURCE_RE = \/\\\.staged\\\.json\$\/i/, 'support overlay source policy must detect .staged.json before generic JSON');
assert.match(supportBridge, /kind === 'stagedjson'/, 'support overlay source policy must accept stagedJSON sourceKind directly');
assert.match(supportBridge, /normalizeSupportSourceKind/, 'support overlay source policy must normalize source kinds before gate checks');
for (const bridge of [supportDetailsBridge, supportHoverBridge, supportHardDisableBridge]) {
  assert.match(bridge, /SOURCE_KIND_RE = \/\^\(json\|jscon\|inputxml\|txt\|source-preview\|stagedjson\)\$\/i/, 'support UI bridge source-kind gate must accept stagedJSON');
  assert.match(bridge, /kind === 'staged\.json'\) return 'stagedjson'/, 'support UI bridge must normalize staged.json source kind');
}

assert.match(inputXmlBridge, /window\.__3D_RVM_VIEWER__/, 'InputXML source-tools bridge must fall back to current global RVM viewer');
assert.match(inputXmlBridge, /document\.addEventListener\('change', handleLegacyControlEvent, true\)/, 'InputXML source-tools bridge must handle change events, not input only');
assert.match(inputXmlBridge, /refreshInputXmlAutoBendOnly/, 'InputXML source-tools bridge exposes Auto Bend only refresh path');
assert.match(inputXmlBridge, /refreshInputXmlSupportOverlayOnly/, 'InputXML source-tools bridge exposes Support Overlay only refresh path');
assert.match(inputXmlBridge, /__PCF_GLB_RVM_INPUTXML_SOURCE_TOOLS__/, 'InputXML source-tools bridge publishes compatibility API for right-panel controls');
assert.doesNotMatch(inputXmlBridge, /ribbon\.insertBefore|geo-top-ribbon|rvm-ribbon-section rvm-inputxml-controls/, 'InputXML controls must not be injected into the top ribbon');
assert.doesNotMatch(inputXmlBridge, /ensureResizeHandles|persistPanelWidths|panel\.style\.setProperty/, 'InputXML bridge must not own parent panel resizing');

assert.match(inputXmlSetModelBridge, /__PCF_GLB_RVM_INPUTXML_SOURCE_TOOLS__/, 'setModel bridge reads InputXML options from source-tools API when available');
assert.match(sourceToolsBridge, /rvm-non-primitive-source-tools-ui\/v8/, 'Source Tools UI schema must advance for shared source-kind policy');
assert.match(sourceToolsBridge, /isRvmNonPrimitiveSourceKind\(normalizeSourceKind\(value\)\)/, 'Source Tools UI gate must use shared non-primitive policy');
assert.match(sourceToolsBridge, /data-source-tools-group="inputxml-family"/, 'right Source Tools panel must contain InputXML family group');
assert.match(sourceToolsBridge, /data-source-tools-group="support-overlay"/, 'right Source Tools panel must contain Support Overlay group');
assert.match(sourceToolsBridge, /rvm-inputxml-apply-transform/, 'axis transform must have an explicit Apply action in right panel');
assert.match(sourceToolsBridge, /AUTO_TOOLS[\s\S]*reapplyAutoBendFromControls/, 'Auto Bend controls must route to Auto Bend only');
assert.match(sourceToolsBridge, /SUPPORT_TOOLS[\s\S]*reapplySupportOverlayFromControls/, 'Support Symbol/Label controls must route to support overlay only');
assert.match(sourceToolsBridge, /apply-axis[\s\S]*reapplyFromControls/, 'axis Apply must reapply both systems');

assert.match(sourceToolsGateBridge, /rvm-source-tools-stagedjson-kind-gate\/v2/, 'stagedJSON source tools gate bridge must expose native-kind schema');
assert.match(sourceToolsGateBridge, /RvmSourceKindPolicy\.js/, 'stagedJSON source tools gate must use shared source-kind policy');
assert.match(sourceToolsGateBridge, /new Set\(\['stagedjson', 'staged\.json'\]\)/, 'stagedJSON source tools gate must target stagedJSON source kinds');
assert.match(sourceToolsGateBridge, /root\.dataset\.rvmLoadedSourceKind = kind/, 'stagedJSON source tools gate must preserve stagedJSON kind for Source Tools');
assert.doesNotMatch(sourceToolsGateBridge, /root\.dataset\.rvmLoadedSourceKind = 'json'/, 'stagedJSON source tools gate must not coerce Source Tools kind to JSON');
assert.match(sourceToolsGateBridge, /root\.dataset\.rvmSourceToolsOriginalKind = kind/, 'stagedJSON source tools gate must preserve the original source kind on the root');
assert.match(sourceToolsGateBridge, /api\.render[\s\S]*api\.sync[\s\S]*api\.reapplyAutoBendOnly[\s\S]*api\.reapplySupportOverlayOnly/, 'stagedJSON source tools gate must wrap render, sync, and reapply paths');

assert.match(supportRuntimeGateBridge, /rvm-stagedjson-support-runtime-gate\/v2/, 'stagedJSON support runtime gate bridge must expose native-kind schema');
assert.match(supportRuntimeGateBridge, /SUPPORT_OVERLAY_KEY = '__PCF_GLB_RVM_NON_PRIMITIVE_SUPPORT_OVERLAY__'/, 'stagedJSON support runtime gate must target support overlay API');
assert.match(supportRuntimeGateBridge, /SUPPORT_DETAILS_KEY = '__PCF_GLB_RVM_NON_PRIMITIVE_SUPPORT_DETAILS_PANEL__'/, 'stagedJSON support runtime gate must target support details API');
assert.match(supportRuntimeGateBridge, /normalizeApplyArgs[\s\S]*sourceKind: normalizeKind\(args\.sourceKind\)/, 'stagedJSON support runtime gate must preserve native stagedJSON sourceKind');
assert.doesNotMatch(supportRuntimeGateBridge, /sourceKind: 'json'/, 'stagedJSON support runtime gate must not coerce support apply sourceKind to JSON');
assert.match(supportRuntimeGateBridge, /root\.dataset\.rvmLoadedSourceKind = context\.sourceKind/, 'stagedJSON support runtime gate must preserve stagedJSON root kind for details');
assert.match(supportRuntimeGateBridge, /api\.applyFromSource = \(args = \{\}\) => applyFromSource\(normalizeApplyArgs\(args\)\)/, 'stagedJSON support runtime gate must wrap support overlay applyFromSource without JSON coercion');
assert.match(supportRuntimeGateBridge, /api\.render[\s\S]*api\.sync/, 'stagedJSON support runtime gate must wrap support details render and sync');
assert.match(supportRuntimeGateBridge, /setModelWithStagedJsonSupportRuntimeGate/, 'stagedJSON support runtime gate must patch future setModel calls for support overlay reapply');
assert.match(stagedJsonValidationBridge, /RvmSourceToolsStagedJsonKindGateBridge\.js\?v=20260628-rvm-source-tools-stagedjson-native-kind-1/, 'stagedJSON validation bridge must import the native-kind Source Tools gate');
assert.match(stagedJsonValidationBridge, /RvmStagedJsonSupportRuntimeGateBridge\.js\?v=20260628-rvm-stagedjson-support-runtime-native-kind-1/, 'stagedJSON validation bridge must import the native-kind support runtime gate');
assert.match(stagedJsonValidationBridge, /installRvmSourceToolsStagedJsonKindGateBridge\(\)/, 'stagedJSON validation bridge must install the Source Tools kind gate');
assert.match(stagedJsonValidationBridge, /installRvmStagedJsonSupportRuntimeGateBridge\(\)/, 'stagedJSON validation bridge must install the support runtime gate');

assert.match(leftBridge, /data-rvm-hierarchy-width-controls/, 'hierarchy panel must expose width controls');
assert.match(leftBridge, /resize:both/, 'hierarchy tree must be horizontally and vertically resizable');
assert.match(leftBridge, /setPanelWidth[\s\S]*root\?\.style\?\.setProperty\(variable, value\)[\s\S]*body\?\.style\?\.setProperty\(variable, value\)/, 'parent panel resize must write width variables to root and .rvm-body');
assert.match(leftBridge, /--rvm-tree-kind-w/, 'hierarchy kind column width must be adjustable');
assert.match(leftBridge, /--rvm-tree-count-w/, 'hierarchy count column width must be adjustable');

console.log('nonprimitive source tools stagedJSON control regression passed');
