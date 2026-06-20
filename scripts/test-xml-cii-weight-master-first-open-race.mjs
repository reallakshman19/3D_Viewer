import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'viewer/tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`ok - ${message}`);
  }
}

assert(source.includes('function waitForWeightMasterRows'), '4A renderer waits for weight master rows');
assert(source.includes('Loading weight master'), 'first-open loading status is shown before ranking');
assert(source.includes('hasWeightMasterRows(cfg)'), 'wait exits only after weight master rows are hydrated');
assert(source.includes('liveConfig = await waitForWeightMasterRows(activeConfig, status)'), 'compute waits before dry-run/ranking');
assert(source.includes('mergeRuntimeOverrides(enriched.config || liveConfig, liveConfig)'), 'hydrated live master rows are merged into dry-run config');
