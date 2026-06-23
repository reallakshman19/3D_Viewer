import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settings = readFileSync('viewer/overlays/support/SupportOverlaySettings.js', 'utf8');
const supportBridge = readFileSync('viewer/tabs/RvmNonPrimitiveSupportOverlayBridge.js', 'utf8');
const uiBridge = readFileSync('viewer/rvm-viewer/RvmInputXmlSupportGraphicsUiBridge.js', 'utf8');
const leftBridge = readFileSync('viewer/tabs/RvmLeftPanelResizeCollapseBridge.js', 'utf8');
const axisTransform = readFileSync('viewer/overlays/source-tools/SourceAxisTransform.js', 'utf8');

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

assert.match(uiBridge, /window\.__3D_RVM_VIEWER__/, 'ribbon controls must fall back to current global RVM viewer');
assert.match(uiBridge, /document\.addEventListener\('change', handleControlEvent, true\)/, 'ribbon controls must handle change events, not input only');
assert.match(uiBridge, /rvm-inputxml-apply-transform/, 'axis transform must have an explicit Apply action');
assert.match(uiBridge, /writeSourceAxisTransformSettings/, 'vertical and north axis controls must write shared source-axis transform settings');

assert.match(leftBridge, /data-rvm-hierarchy-width-controls/, 'hierarchy panel must expose width controls');
assert.match(leftBridge, /resize:both/, 'hierarchy tree must be horizontally and vertically resizable');
assert.match(leftBridge, /--rvm-tree-kind-w/, 'hierarchy kind column width must be adjustable');
assert.match(leftBridge, /--rvm-tree-count-w/, 'hierarchy count column width must be adjustable');

console.log('nonprimitive source tools stagedJSON control regression passed');
