import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');

const retiredAutoloadPath = path.join(repoRoot, 'viewer/tabs/xml-cii-master-autoload-patch.js');
const liteAutoloadPath = path.join(repoRoot, 'viewer/tabs/xml-cii-master-autoload-lite.js');
const masterContextPath = path.join(repoRoot, 'viewer/converters/xml-cii2019-core/master-context.js');
const tabPath = path.join(repoRoot, 'viewer/tabs/model-converters/ModelConvertersTab.js');
const workflowBridgePath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-workflow-bridge.js');

const retiredAutoloadSource = fs.readFileSync(retiredAutoloadPath, 'utf8');
const liteAutoloadSource = fs.readFileSync(liteAutoloadPath, 'utf8');
const masterContextSource = fs.readFileSync(masterContextPath, 'utf8');
const tabSource = fs.readFileSync(tabPath, 'utf8');
const workflowBridgeSource = fs.readFileSync(workflowBridgePath, 'utf8');

// The historical broad autoload patch file may remain for reference/rollback, but
// it must not be active from ModelConvertersTab. The active path now uses the
// one-shot lite autoloader and bridge-level default-master blocking.
assert.match(retiredAutoloadSource, /__xmlCiiDefaultMasterAutoloadSession_v3/);
assert.match(retiredAutoloadSource, /lastSuccessNotifyKey/);
assert.match(retiredAutoloadSource, /lastErrorNotifyKey/);
assert.match(retiredAutoloadSource, /function notifyOnce\(/);
assert.ok(!retiredAutoloadSource.includes('new MutationObserver'), 'retired master autoload must not reschedule from broad DOM mutation observer');
assert.doesNotMatch(retiredAutoloadSource, /legacyPipingMasterPath\s*:/, 'autoload defaults must not preserve the removed aggregate piping master path');
assert.match(retiredAutoloadSource, /const REPO_NAME = '3D_Viewer'/);
assert.match(retiredAutoloadSource, /\/github\.io\$\/i\.test\(location\.hostname\)/);
assert.match(retiredAutoloadSource, /moduleRelativeUrl\(masterPath\)/);
assert.match(retiredAutoloadSource, /new URL\(`\.\.\/\.\.\/\$\{normalizeMasterPath\(masterPath\)\}`/);
assert.ok(!retiredAutoloadSource.includes('Piping_class_master.json'), 'retired autoload source must not fetch removed Piping_class_master.json');

assert.match(liteAutoloadSource, /DEFAULT_MASTER_PATHS/);
assert.ok(!liteAutoloadSource.includes('Piping_class_master.json'), 'lite autoload source must not fetch removed Piping_class_master.json');
assert.ok(!/document\.addEventListener\(['"]click['"]/.test(liteAutoloadSource), 'lite autoload must not run from popup/master tab clicks');
assert.ok(!/document\.addEventListener\(['"]input['"]/.test(liteAutoloadSource), 'lite autoload must not run from hidden config input churn');
assert.ok(!/document\.addEventListener\(['"]change['"]/.test(liteAutoloadSource), 'lite autoload must not run from every config/master change');

assert.ok(!masterContextSource.includes('Piping_class_master.json'), 'core master context must not probe removed Piping_class_master.json');
assert.match(masterContextSource, /SpecwisePipingClass\/index\.json/);
assert.match(tabSource, /xml-cii-master-autoload-lite\.js\?v=20260624-startup-autoload-noise-1/);
assert.doesNotMatch(tabSource, /xml-cii-master-autoload-patch\.js/, 'ModelConvertersTab must not activate the broad master autoload patch');
assert.match(workflowBridgeSource, /ensureDefaultMastersLoaded = async \(\) => null/, 'workflow bridge must not call legacy default-master preload');
assert.match(workflowBridgeSource, /masterKey === 'pipingClass'/, 'workflow bridge must block obsolete aggregate piping-class default load');

console.log('XML CII master autoload consolidation guard passed');
