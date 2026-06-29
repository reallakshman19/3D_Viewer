import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerRoot = path.resolve(__dirname, '..');
function read(relativePath) {
  const file = path.join(viewerRoot, relativePath);
  assert.ok(fs.existsSync(file), `missing source file: ${relativePath}`);
  return fs.readFileSync(file, 'utf8');
}

const helper = read('tabs/RvmFormatNeutralHierarchy.js');

assert.ok(helper.includes("RVM_PROVIDER_TREE_RUNTIME_TELEMETRY_VERSION = '20260629-rvm-provider-runtime-telemetry-1'"), 'format-neutral helper must expose runtime telemetry version');
assert.ok(helper.includes('providerTreeReadPathOptedIn'), 'helper must distinguish opt-in from source-pilot eligibility');
assert.ok(helper.includes('rememberReadPathTelemetry'), 'helper must record provider-vs-legacy read path decisions');
assert.ok(helper.includes('__PCF_GLB_RVM_HIERARCHY_READ_PATH_TELEMETRY__'), 'helper must publish last read-path telemetry globally');
assert.ok(helper.includes("readPath: 'provider'") || helper.includes("'provider'"), 'helper must record provider read-path state');
assert.ok(helper.includes("'legacy'"), 'helper must record legacy read-path fallback state');
assert.ok(helper.includes('providerCandidateCount'), 'telemetry must include provider candidate count');
assert.ok(helper.includes('renderedNodeCount'), 'telemetry must include rendered node count');
assert.ok(helper.includes('sourceProviderPilotEligible'), 'telemetry must include source provider pilot eligibility');
assert.ok(helper.includes('provider-read-path-not-enabled'), 'telemetry must explain disabled provider read path');
assert.ok(helper.includes('not-source-preview-provider-pilot'), 'telemetry must explain non-source-preview fallback');
assert.ok(helper.includes('provider-nodes-empty'), 'telemetry must explain empty provider node fallback');
assert.ok(helper.includes('provider-nodes-selected'), 'telemetry must explain provider node selection');

console.log('Verified provider tree runtime telemetry instrumentation.');
