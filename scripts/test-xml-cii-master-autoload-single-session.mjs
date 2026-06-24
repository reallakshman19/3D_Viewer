import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');

const autoloadPath = path.join(repoRoot, 'viewer/tabs/xml-cii-master-autoload-patch.js');
const masterContextPath = path.join(repoRoot, 'viewer/converters/xml-cii2019-core/master-context.js');
const tabPath = path.join(repoRoot, 'viewer/tabs/model-converters/ModelConvertersTab.js');
const workflowBridgePath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-workflow-bridge.js');

const autoloadSource = fs.readFileSync(autoloadPath, 'utf8');
const masterContextSource = fs.readFileSync(masterContextPath, 'utf8');
const tabSource = fs.readFileSync(tabPath, 'utf8');
const workflowBridgeSource = fs.readFileSync(workflowBridgePath, 'utf8');

assert.match(autoloadSource, /__xmlCiiDefaultMasterAutoloadSession_v3/);
assert.match(autoloadSource, /lastSuccessNotifyKey/);
assert.match(autoloadSource, /lastErrorNotifyKey/);
assert.match(autoloadSource, /function notifyOnce\(/);
assert.ok(!autoloadSource.includes('new MutationObserver'), 'master autoload must not reschedule from broad DOM mutation observer');
assert.doesNotMatch(autoloadSource, /legacyPipingMasterPath\s*:/, 'autoload defaults must not preserve the removed aggregate piping master path');
assert.match(autoloadSource, /const REPO_NAME = '3D_Viewer'/);
assert.match(autoloadSource, /\/github\\.io\$\/i\.test\(location\.hostname\)/);
assert.match(autoloadSource, /moduleRelativeUrl\(masterPath\)/);
assert.match(autoloadSource, /new URL\(`\.\.\/\.\.\/\$\{normalizeMasterPath\(masterPath\)\}`/);
assert.ok(!autoloadSource.includes('Piping_class_master.json'), 'autoload source must not fetch removed Piping_class_master.json');

assert.ok(!masterContextSource.includes('Piping_class_master.json'), 'core master context must not probe removed Piping_class_master.json');
assert.match(masterContextSource, /SpecwisePipingClass\/index\.json/);
assert.match(tabSource, /xml-cii-master-autoload-patch\.js\?v=20260624-workflow1-workflow2-1/);
assert.match(workflowBridgeSource, /ensureDefaultMastersLoaded = async \(\) => null/, 'workflow bridge must not call legacy default-master preload');
assert.match(workflowBridgeSource, /masterKey === 'pipingClass'/, 'workflow bridge must block obsolete aggregate piping-class default load');

console.log('XML CII master autoload single-session guard passed');
