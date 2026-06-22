import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');

const wrapperPath = path.join(repoRoot, 'viewer/tabs/model-converters/converters/inputxml-to-rvm.js');
const registryPath = path.join(repoRoot, 'viewer/tabs/model-converters/converter-registry.js');

const wrapperSrc = fs.readFileSync(wrapperPath, 'utf8');
const registrySrc = fs.readFileSync(registryPath, 'utf8');
const runnerPath = '../../../converters/inputxml-rvm/inputxml-to-rvm-runner.js';
const runnerPathWithCache = `${runnerPath}?v=20260622-inputxml-rvm-lazy-1`;

const beforeLazyHelper = wrapperSrc.slice(0, wrapperSrc.indexOf('async function runInputXmlToRvm'));
assert.equal(
  beforeLazyHelper.includes(runnerPath),
  false,
  'InputXML -> RVM runner must not be imported before the lazy helper is evaluated.',
);

assert.equal(
  wrapperSrc.includes(`import('${runnerPathWithCache}')`),
  true,
  'InputXML -> RVM runner should be lazy-loaded with a deploy cache key when the converter runs.',
);

assert.equal(
  wrapperSrc.includes('inputXmlToRvmRunnerPromise = null;'),
  true,
  'InputXML -> RVM wrapper should clear the cached promise after a load failure so a later run can retry.',
);

assert.equal(
  registrySrc.includes("from './converters/inputxml-to-rvm.js'"),
  true,
  'Converter registry should import only the lightweight InputXML -> RVM wrapper at startup.',
);

const selector = await import('../viewer/tabs/model-converters/ConverterSelector.js');
assert.ok(Array.isArray(selector.CONVERTERS), 'ConverterSelector should import without loading the vendored RVM runner at startup.');
assert.ok(selector.getConverterById('inputxml_to_rvm'), 'InputXML -> RVM converter should remain registered.');

console.log('✅ InputXML -> RVM runner is lazy-loaded and cannot block Model Converters startup.');
