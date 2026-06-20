#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

const sessionPath = 'viewer/tabs/model-converters/xml-cii-master-preserve-patch.js';
const autoloadPath = 'viewer/tabs/xml-cii-master-autoload-patch.js';
const tabPath = 'viewer/tabs/model-converters/ModelConvertersTab.js';
const legacyPath = 'viewer/tabs/model-converters/legacy-adapter.js';
const weightRendererPath = 'viewer/tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js';

const sessionSource = read(sessionPath);
const autoloadSource = read(autoloadPath);
const tabSource = read(tabPath);
const legacySource = read(legacyPath);
const weightRendererSource = read(weightRendererPath);

assert(sessionSource.includes('xmlCiiMergeWorkflowConfig'), 'session broker must expose pure merge helper');
assert(sessionSource.includes('xmlCiiGetHydratedWorkflowConfig'), 'session broker must expose hydrated workflow config getter');
assert(sessionSource.includes('blocked-empty-master-write'), 'session broker must diagnose blocked empty master writes');
assert(sessionSource.includes('activeSourceUsedBy4A'), 'debug snapshot must show the source used by 4A');
assert(!sessionSource.includes('setTimeout'), 'session broker must not use timer-based restoration');
assert(!sessionSource.includes('Date.now() +'), 'explicit clear must not depend on an expiry timer');

assert(!autoloadSource.includes('setTimeout'), 'retired autoload module must not schedule timer retries');
assert(!autoloadSource.includes('MutationObserver'), 'retired autoload module must not observe and rewrite DOM later');
assert(autoloadSource.includes('ensureDefaultMastersLoaded()'), 'autoload retirement comment must point to bridge-owned default loading');

assert(tabSource.includes("['xml-cii-session-config', installXmlCiiMasterPreservePatch]"), 'session broker must install before workflow action modules');
assert(tabSource.indexOf('xml-cii-session-config') < tabSource.indexOf('xml-cii-conversion-workflow-popup'), 'session broker must be installed before popup actions can write config');
assert(tabSource.includes('xml-cii-master-preserve-patch.js?v=20260620-master-session-1'), 'session broker import must use the bumped cache key');
assert(tabSource.includes('xml-cii-master-autoload-patch.js?v=20260620-master-session-1'), 'retired autoload import must use the bumped cache key');

assert(legacySource.includes("const config = xmlCiiConfigWithLoadedMasterRows('XML->CII preview');"), 'Preview must continue to use the hydrated legacy config path');
assert(legacySource.includes("const config = xmlCiiConfigWithLoadedMasterRows('XML->CII diagnostics');"), 'Diagnostics must continue to use the hydrated legacy config path');
assert(legacySource.includes("const config = xmlCiiConfigWithLoadedMasterRows('XML->CII weight match');"), 'Popup 4A must use the hydrated legacy config path');
assert(weightRendererSource.includes('currentDomSupportConfig()'), 'inline 4A must read the session-projected supportConfigJson DOM path');
assert(!weightRendererSource.includes('setTimeout'), '4A weight renderer must not wait on timer retries for master readiness');

const moduleUrl = pathToFileURL(path.join(root, sessionPath)).href;
const { xmlCiiMergeWorkflowConfig } = await import(moduleUrl);

const existing = {
  rating: { defaultRating: '900' },
  weight: {
    masterRows: [{ bore: '250', rating: '900', length: '191', weight: '139', valveType: 'FLANGE' }],
    fieldMap: { bore: 'bore', rating: 'rating', length: 'length', weight: 'weight' },
  },
};

const accidentalEmpty = {
  rating: { defaultRating: '900' },
  weight: { masterRows: [], fieldMap: { bore: 'Bore' } },
};

const preserved = xmlCiiMergeWorkflowConfig(existing, accidentalEmpty, { reason: 'save/process test' });
assert(preserved.config.weight.masterRows.length === 1, 'save/process must not replace non-empty weight.masterRows with []');
assert(preserved.config.weight.masterRows[0].weight === '139', 'preserved weight master row must remain intact');
assert(preserved.config.weight.fieldMap.bore === 'Bore', 'non-row field map edits may still merge while rows are preserved');
assert(preserved.diagnostics.some((row) => row.type === 'blocked-empty-master-write' && row.master === 'weight'), 'blocked empty write must be diagnosed');

const explicitClear = xmlCiiMergeWorkflowConfig(existing, accidentalEmpty, { reason: 'clear test', allowEmptyMasters: ['weight'] });
assert(Array.isArray(explicitClear.config.weight.masterRows), 'explicit clear must keep the master row array shape');
assert(explicitClear.config.weight.masterRows.length === 0, 'explicit Clear must be allowed to empty weight.masterRows');
assert(explicitClear.diagnostics.some((row) => row.type === 'explicit-empty-master-write' && row.master === 'weight'), 'explicit clear must be diagnosed separately from accidental empty writes');

console.log('✅ XML CII master lifecycle session regression test passed', {
  preservedRows: preserved.config.weight.masterRows.length,
  explicitClearRows: explicitClear.config.weight.masterRows.length,
});
