import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const workflow = read('viewer/tabs/model-converters/WorkflowShell.js');
const mirror = read('viewer/tabs/model-converters/converters/xmltocii2019_helper/override-tab-preview-mirror.js');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`ok - ${message}`);
  }
}

assert(workflow.includes('override-tab-preview-mirror.js?v=20260629-clear-native-overrides-1'), 'WorkflowShell installs override-tab mirror with native override clear cache bust');
assert(mirror.includes('getXmlCiiPreviewRuntimeConfig'), 'mirror reads runtime Preview override cache');
assert(mirror.includes('mergeOverrideConfig'), 'mirror merges runtime overrides with supportConfigJson');
for (const bucket of ['pipingClass', 'material', 'rating', 'materialCode', 'wallThickness', 'corrosion', 'rigidWeight']) {
  assert(mirror.includes(`flatEntries(config, '${bucket}')`), `mirror renders ${bucket} overrides`);
}
assert(mirror.includes('Derived Class Overrides'), 'mirror renders Derived Class Overrides section');
assert(mirror.includes('Material Name Overrides'), 'mirror renders Material Name Overrides section');
assert(mirror.includes('data-clear-xml-cii-override-entry-bucket'), 'mirror renders per-entry clear buttons');
assert(mirror.includes('clearOverrideEntry'), 'mirror handles per-entry clear actions');
assert(mirror.includes('RUNTIME_OVERRIDE_STORAGE_KEY'), 'mirror clears persisted runtime entries');
assert(mirror.includes('processEntries(config)'), 'mirror renders processData overrides');
assert(mirror.includes('previewOverrideFingerprint'), 'mirror avoids MutationObserver rerender loops');
assert(mirror.includes('Manual Override'), 'mirror targets Manual Override tab only');
