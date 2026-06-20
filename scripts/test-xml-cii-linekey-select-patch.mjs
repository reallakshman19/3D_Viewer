#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const shimPath = 'viewer/tabs/model-converters-tab.js';
const indexPath = 'viewer/tabs/model-converters/index.js';
const tabPath = 'viewer/tabs/model-converters/ModelConvertersTab.js';
const popupPath = 'viewer/tabs/model-converters/xml-cii-conversion-workflow-popup.js';
const patchPath = 'viewer/tabs/model-converters/xml-cii-linekey-select-patch.js';
const autoloadPath = 'viewer/tabs/xml-cii-master-autoload-patch.js';
const weightRendererPath = 'viewer/tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js';

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(condition, message) { if (!condition) { console.error(`❌ ${message}`); process.exit(1); } }

const shim = read(shimPath);
const index = read(indexPath);
const tab = read(tabPath);
const popup = read(popupPath);
const patch = read(patchPath);
const autoload = read(autoloadPath);
const weightRenderer = read(weightRendererPath);

assert(shim.includes('rich-state-refresh-1'), 'legacy model-converters shim must bump rich-state-refresh cache key');
assert(index.includes('rich-state-refresh-1'), 'model-converters index must bump ModelConvertersTab cache key');
assert(tab.includes('installXmlCiiLineKeySelectPatch'), 'ModelConvertersTab must install the token selector patch');
assert(tab.includes('xml-cii-master-autoload-patch.js?v=20260620-rich-state-refresh-1'), 'ModelConvertersTab must cache-bust master autoload patch');
assert(popup.includes('legacy-adapter.js?v=20260620-rich-state-refresh-1'), 'workflow popup and tab must use the same rich bridge cache key');

assert(patch.includes("lineKey: 'linelist.lineKeyTokenPositions'"), 'patch must target linelist.lineKeyTokenPositions');
assert(patch.includes("size: 'weight.boreTokenIndex'"), 'patch must target weight.boreTokenIndex');
assert(patch.includes("pipingClass: 'rating.pipingClassTokenIndex'"), 'patch must target rating.pipingClassTokenIndex');
assert(patch.includes("document.createElement('select')"), 'patch must replace token position text inputs with selects/list-boxes');
assert(patch.includes('likelyShifted(tokens)'), 'patch must detect shifted Branchname token layout');
assert(patch.includes("return '6'"), 'patch must auto-correct shifted Line Key to token 6');
assert(patch.includes("return '4'"), 'patch must auto-correct shifted Size to token 4');
assert(patch.includes('data-native-regex-path'), 'patch must support native popup Regex fields');
assert(patch.includes('data-xml-cii-regex-path'), 'patch must support legacy Regex fields');

assert(autoload.includes('phaseTitle(/Import Masters/i)'), 'autoload panel must attach to any Import Masters title, including 2 Import Masters');
assert(autoload.includes('Default masters load raw-first'), 'autoload panel must keep editable path fields visible');
assert(autoload.includes('new MutationObserver'), 'autoload patch must reattach after workflow re-render');

assert(weightRenderer.includes('ratingFromConfig(row, config)'), 'Weight Match renderer must re-read manual rating overrides');
assert(weightRenderer.includes('Rating is read from line list / manual override / processData'), 'Weight Match help text must explain rating source');
assert(weightRenderer.includes('weight-match-model.js?v=20260620-rich-state-refresh-1'), 'Weight Match renderer must cache-bust weight-match model import');

console.log('✅ XML CII rich workflow state-refresh static test passed');
