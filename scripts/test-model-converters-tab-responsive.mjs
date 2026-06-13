#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const tabPath = path.join(repoRoot, 'viewer/tabs/model-converters-tab.js');
const polishPath = path.join(repoRoot, 'viewer/tabs/model-converters/xml-cii-conversion-workflow-polish.js');

const tabSource = fs.readFileSync(tabPath, 'utf8');
const polishSource = fs.readFileSync(polishPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

assert(/renderLegacyModelConvertersTab\(container, ctx\)/.test(tabSource), 'legacy model converter tab must render first');
assert(/scheduleInstaller\(/.test(tabSource), 'optional installers must be scheduled/deferred');
assert(/installSafely\(/.test(tabSource), 'optional installers must be guarded');
assert(/catch \(error\)/.test(tabSource), 'installer failures must be caught and logged');
assert(/Optional installer failed/.test(tabSource), 'installer failure log must identify optional installer errors');
assert(!/installXmlCiiConversionWorkflowPolish\(container\);/.test(tabSource), 'workflow polish must not run as an unguarded synchronous call');
assert(/requestIdleCallback/.test(tabSource) || /setTimeout\(run, 0\)/.test(tabSource), 'deferred installer scheduler must use idle callback or timeout');

assert(/if \(!document\.querySelector\('\.model-converters-workflow-popup'\)\) return;/.test(polishSource), 'workflow polish must be inactive when popup is closed');
assert(/let scheduled = false/.test(polishSource), 'workflow polish observer must be throttled');
assert(/new MutationObserver\(schedule\)/.test(polishSource), 'workflow polish observer must use the throttled scheduler');
assert(!/characterData:\s*true/.test(polishSource), 'workflow polish observer must not watch characterData on the full app tree');

console.log('✅ model converters tab responsiveness static test passed');
