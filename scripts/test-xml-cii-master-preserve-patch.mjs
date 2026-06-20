import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const patch = readFileSync('viewer/tabs/model-converters/xml-cii-master-preserve-patch.js', 'utf8');
const tab = readFileSync('viewer/tabs/model-converters/ModelConvertersTab.js', 'utf8');
const popup = readFileSync('viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js', 'utf8');
const legacyAdapter = readFileSync('viewer/tabs/model-converters/legacy-adapter.js', 'utf8');

for (const token of [
  'installXmlCiiMasterPreservePatch',
  'xmlCiiGetHydratedWorkflowConfig',
  'sessionConfig',
  'lastGood',
  'preserveMasterRows',
  'preventedEmptyMasterWrites',
  '__xmlCiiMasterLifecycleDebug',
  'data-native-compute-weights',
  'data-native-build-preview',
  'data-native-dry-run',
  'data-xml-cii-save-master',
  'data-native-save-master',
  'data-xml-cii-clear-master',
  'data-native-clear-master',
  'markExplicitClear',
  'supportConfigJson',
]) {
  assert.ok(patch.includes(token), `missing patch token: ${token}`);
}

for (const token of ['set' + 'Timeout(', 'set' + 'Interval(', 'delay(', 'restoreMissingMasters']) {
  assert.ok(!patch.includes(token), `unexpected async restore token: ${token}`);
}

assert.ok(tab.includes('installXmlCiiMasterPreservePatch'));
assert.ok(tab.includes('xml-cii-master-preserve-patch.js?v=20260620-master-session-1'));
assert.ok(tab.includes('legacy-adapter.js?v=20260620-master-session-1'));
assert.ok(tab.includes('master-session-1'));
assert.ok(popup.includes('legacy-adapter.js?v=20260620-master-session-1'));

for (const token of [
  'function xmlCiiConfigWithLoadedMasterRows',
  "const config = xmlCiiConfigWithLoadedMasterRows('XML->CII preview');",
  "const config = xmlCiiConfigWithLoadedMasterRows('XML->CII diagnostics');",
  "const config = xmlCiiConfigWithLoadedMasterRows('XML->CII weight match');",
]) {
  assert.ok(legacyAdapter.includes(token), `missing legacy adapter token: ${token}`);
}

console.log('XML CII master session lifecycle regression passed');
