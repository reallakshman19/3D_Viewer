#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const QC_SCHEMA = 'bm-cii-restraint-frame-qc/v1';
const DEFAULT_AUDIT_DIR = 'artifacts/bm-cii-restraint-audit';
const EPS = 1e-9;

function usage() {
  return `Usage:\n  node scripts/bm-cii/support-frame-qc.mjs [--audit-dir ${DEFAULT_AUDIT_DIR}] [--out <report.json>]\n\nValidates BM_CII support source rows have resolved P/T/R frames before any GLB generation.\n`;
}

function parseArgs(argv) {
  const args = { auditDir: DEFAULT_AUDIT_DIR };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--audit-dir') args.auditDir = argv[++i];
    else if (arg === '--out') args.outPath = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function vec(value) {
  if (!value || typeof value !== 'object') return null;
  const x = Number(value.x ?? value[0]);
  const y = Number(value.y ?? value[1]);
  const z = Number(value.z ?? value[2]);
  return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
}

function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function length(v) { return Math.sqrt(dot(v, v)); }
function normalized(v) { const len = length(v); return len > EPS ? { x: v.x / len, y: v.y / len, z: v.z / len } : null; }
function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function finitePositive(value) { const n = Number(value); return Number.isFinite(n) && n > 0; }

function validateRecord(record) {
  const failures = [];
  const P = vec(record.pipePoint);
  const T = normalized(vec(record.pipeTangent));
  const R = Number(record.pipeRadius);
  if (!P) failures.push('missing/invalid pipe point P');
  if (!T) failures.push('missing/invalid pipe tangent T');
  if (!finitePositive(R)) failures.push('missing/invalid pipe radius R');
  if (record.frameStatus !== 'resolved') failures.push(`frameStatus is ${record.frameStatus || 'missing'}, expected resolved`);
  if (T) {
    const tangentLength = length(T);
    if (Math.abs(tangentLength - 1) > 1e-6) failures.push(`pipe tangent not normalized: ${tangentLength}`);
    const lateral = normalized(cross({ x: 0, y: 1, z: 0 }, T)) || { x: 1, y: 0, z: 0 };
    const tangentDot = Math.abs(dot(lateral, T));
    if (tangentDot > 1e-6) failures.push(`computed lateral is not perpendicular to tangent: dot=${tangentDot}`);
  }
  if (!record.expectedSymbolContract) failures.push('missing expected symbol contract');
  if (!Array.isArray(record.layerIds) || !record.layerIds.includes('plant.restraints')) failures.push('layerIds missing plant.restraints');
  if (!record.layerIds?.includes?.(`restraints.${record.source}`)) failures.push(`layerIds missing source layer restraints.${record.source}`);
  if (!record.layerIds?.includes?.(`restraints.${String(record.kind || '').toLowerCase()}`)) failures.push(`layerIds missing kind layer restraints.${String(record.kind || '').toLowerCase()}`);
  if (record.axis && !record.layerIds?.includes?.(`axis.${String(record.axis).toLowerCase()}`)) failures.push(`axis ${record.axis} missing axis layer`);
  if (record.kind === 'UNKNOWN' && record.visibleDefault !== false) failures.push('UNKNOWN must be visibleDefault=false');
  return failures;
}

async function readJson(filePath) { return JSON.parse(await fs.readFile(filePath, 'utf8')); }

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(usage()); return; }
  const auditDir = path.resolve(args.auditDir);
  const inputxml = await readJson(path.join(auditDir, 'support_expected_from_inputxml.json'));
  const isonote = await readJson(path.join(auditDir, 'support_expected_from_isonote.json'));
  const records = [...(inputxml.records || []), ...(isonote.records || [])];
  const rows = records.map((record) => {
    const failures = validateRecord(record);
    return { recordId: record.recordId, source: record.source, node: record.node, kind: record.kind, axis: record.axis || '', status: failures.length ? 'fail' : 'pass', failures };
  });
  const failed = rows.filter((row) => row.status === 'fail');
  const report = { schema: QC_SCHEMA, status: failed.length ? 'fail' : 'pass', generatedGlb: false, visualQcApplied: false, recordCount: records.length, failedCount: failed.length, rows };
  const outPath = path.resolve(args.outPath || path.join(auditDir, 'support_frame_qc_report.json'));
  await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => { process.stderr.write(`${error?.stack || error?.message || String(error)}\n\n${usage()}`); process.exitCode = 1; });

export { QC_SCHEMA, validateRecord };
