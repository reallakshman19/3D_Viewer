#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CHECKS = [
  {
    file: 'viewer/js/pcf2glb/glb/buildExportScene.js',
    patterns: [
      ['imports glyph-only builder', /buildBmCiiGlyphOnlySupportObject/],
      ['checks glyph-only support mode', /isBmCiiGlyphOnlySupportMode/],
      ['bypasses generic support builder for glyph-only supports', /useGlyphOnlySupport[\s\S]*buildBmCiiGlyphOnlySupportObject/],
      ['does not enhance glyph-only support with legacy support proxy', /if \(obj && comp\.type === 'SUPPORT'\) obj = enhanceSupportDirectionProxy/],
      ['stamps authoritative scene metadata', /bmCiiSupportGlyphsAuthoritative/],
    ],
  },
  {
    file: 'viewer/js/pcf2glb/glb/buildBmCiiGlyphOnlySupportObject.js',
    patterns: [
      ['normalizes source support record', /normalizeSupportRecord/],
      ['builds shared final OD2 glyph group', /buildSupportGlyphGroup/],
      ['keeps UNKNOWN metadata-only by default', /UNKNOWN_METADATA_ONLY/],
      ['stamps render path', /renderPath: 'bm-cii-glyph-only'/],
      ['marks baked glyphs authoritative', /bmCiiSupportGlyphAuthoritative: true/],
    ],
  },
  {
    file: 'scripts/bm-cii/build-v11-robust.mjs',
    patterns: [
      ['derives support components from sidecar rows', /supportComponentsFromSidecar/],
      ['removes old generic sidecar support components', /filter\(\(component\) => component\.type !== 'SUPPORT'\)/],
      ['passes glyph-only support rendering mode', /mode: 'bm-cii-glyph-only'/],
      ['marks support glyphs authoritative', /authoritative: true/],
      ['reports support glyph count in manifest', /supportGlyphOnlyCount/],
    ],
  },
];

async function main() {
  const failures = [];
  const checks = [];
  for (const group of CHECKS) {
    const filePath = path.join(ROOT, group.file);
    const content = await fs.readFile(filePath, 'utf8');
    for (const [name, pattern] of group.patterns) {
      const pass = pattern.test(content);
      checks.push({ file: group.file, name, pass });
      if (!pass) failures.push(`${group.file}: ${name}`);
    }
  }

  const report = {
    schema: 'bm-cii-support-export-glyph-path-qc/v1',
    status: failures.length ? 'fail' : 'pass',
    checks,
    failures,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
}

await main();
