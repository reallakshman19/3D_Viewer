import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const report = {
  schema: 'bm-cii-basic-viewer-runtime-qc/v1',
  generatedAt: new Date().toISOString(),
  checks: [],
  failures: [],
};

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function check(name, condition, detail) {
  report.checks.push({ name, ok: Boolean(condition), detail });
  if (!condition) report.failures.push(name + ': ' + detail);
}

const overlay = read('viewer/js/pcf2glb/advanced/applyGlbSupportSymbols.js');
const layers = read('viewer/js/pcf2glb/ui/GlbLayerRegistry.js');

check('runtime overlay has authoritative GLB detector', overlay.includes('sceneHasAuthoritativeBakedSupportGlyphs'), 'sceneHasAuthoritativeBakedSupportGlyphs');
check('runtime overlay skips authoritative GLBs', overlay.includes("reason: 'authoritative-baked-support-glyphs'"), 'authoritative skip result');
check('runtime scan skips baked authoritative glyph roots', overlay.includes('isAuthoritativeBakedSupportGlyph(object)'), 'baked glyph skip');
check('runtime overlay uses trace pipePoint before world position', overlay.includes('pipePointOf(data, object, worldPos)'), 'pipePointOf priority');
check('runtime support key is not old position-only signature', !overlay.includes('supportKey(kind, source, position, axisLabel)'), 'old signature forbidden');
check('layer registry has force-hidden object guard', layers.includes('objectForcedHidden(object)'), 'objectForcedHidden');
check('layer registry prevents hard-hidden resurrection', layers.includes('if (objectForcedHidden(object)) return false;'), 'force hidden guard');
check('layer registry includes node annotation layer', layers.includes("'annotation.node'"), 'annotation.node');
check('layer panel shows object counts', layers.includes('layerLabel(layer)'), 'layerLabel');
check('layer panel disables empty layers', layers.includes('Number(layer.count) === 0'), 'empty layer disabled');

report.ok = report.failures.length === 0;
const outArg = process.argv.indexOf('--out');
const outPath = outArg >= 0 ? process.argv[outArg + 1] : 'artifacts/bm-cii-restraint-audit/basic-viewer-runtime-qc.json';
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log((report.ok ? 'PASS ' : 'FAIL ') + outPath);
if (!report.ok) process.exit(1);
