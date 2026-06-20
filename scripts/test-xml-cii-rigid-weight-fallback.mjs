import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const hints = read('viewer/converters/xml-cii2019-core/weight-valve-hints.js');
const flangeFallback = read('viewer/converters/xml-cii2019-core/flange-weight-fallback.js');
const renderer = read('viewer/tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js');
const runner = read('viewer/tabs/model-converters/converters/xmltocii2019_runner.js');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`ok - ${message}`);
  }
}

assert(hints.includes('sameBoreRatingInterpolationFallback'), 'weight ranker has same bore/rating fallback');
assert(hints.includes("weightMethod: 'length-interpolated'") && hints.includes("weightMethod: 'length-extrapolated'"), 'fallback emits interpolation and extrapolation methods');
assert(hints.includes("weightMethod: 'no-same-bore-rating'") && hints.includes('selectedWeight: 0'), 'fallback emits explicit zero when no same bore/rating rows exist');
assert(hints.includes('inferredWeight: true') && hints.includes('zeroFallback: true'), 'fallback candidates are traceable');
assert(flangeFallback.includes('buildXmlCiiFlangeWeightFallback'), 'flange fallback helper exists');
assert(flangeFallback.includes("weightMethod: 'flange-length-extrapolated'"), 'flange fallback uses dedicated method');
assert(flangeFallback.includes('Flange WT scaled to ElementLength'), 'flange fallback labels proposed weight basis');
assert(renderer.includes('20260620-weight-fallback-1'), '4A weight-match renderer cache-busts fallback model');
assert(renderer.includes('20260620-flange-fallback-1'), '4A renderer cache-busts flange fallback helper');
assert(renderer.includes("mergeSection(out, live, 'weight', 'masterRows')"), '4A merge preserves weight master rows');
assert(renderer.includes('Flange extrapolated') && renderer.includes('flange fallback'), '4A renderer labels flange fallback source');
assert(runner.includes('20260620-weight-fallback-1'), 'final runner cache-busts fallback model');
assert(runner.includes('applyXmlCiiFlangeWeightFallbackToIssues'), 'final runner applies flange fallback before review popup');
