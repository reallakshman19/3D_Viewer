#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const SCHEMA = 'bm-cii-restraint-source-audit/v1';
const DEFAULT_XML = 'Benchmarks/INPUT XML to CII 2019/BM_CII/BM_CII_INPUT.XML';
const DEFAULT_OUT_DIR = 'artifacts/bm-cii-restraint-audit';
const SENTINEL = -1.0101;
const EPS = 1e-9;

const CONTRACT = Object.freeze({
  GUIDE: 'guide-lateral-arrows-tip-at-od2',
  REST: 'rest-vertical-arrow-tip-at-od2',
  SHOE: 'rest-vertical-arrow-tip-at-od2',
  HOLDDOWN: 'rest-vertical-arrow-tip-at-od2',
  LINESTOP: 'linestop-axial-arrows-offset-od2',
  LIMIT: 'limit-axial-arrow-offset-od2',
  HANGER: 'hanger-spring-moderate-symbol',
  SPRING: 'hanger-spring-moderate-symbol',
  UNKNOWN: 'unknown-debug-default-off',
});

// Explicit BM_CII benchmark map. Unknown CAESAR numbers intentionally remain UNKNOWN.
const CAESAR_TYPE_MAP = Object.freeze({
  0: ['UNKNOWN', ''],
  1: ['REST', 'X'],
  2: ['REST', 'Y'],
  3: ['REST', 'Z'],
  11: ['LIMIT', 'X'],
  12: ['LIMIT', 'Y'],
  13: ['LIMIT', 'Z'],
  14: ['LINESTOP', 'X'],
  15: ['LINESTOP', 'Y'],
  16: ['LINESTOP', 'Z'],
  17: ['GUIDE', 'Y'],
  18: ['GUIDE', 'Z'],
  19: ['GUIDE', 'X'],
  20: ['SPRING', 'Y'],
});

const BM_CII_EXPECTED_INPUTXML = Object.freeze([
  ['10', 'UNKNOWN', ''], ['35', 'GUIDE', 'Y'], ['35', 'REST', 'X'], ['35', 'REST', 'Z'],
  ['130', 'LINESTOP', 'Z'], ['190', 'UNKNOWN', ''], ['205', 'LIMIT', 'X'], ['205', 'REST', 'Y'],
  ['205', 'SPRING', 'Y'], ['240', 'UNKNOWN', ''], ['255', 'GUIDE', 'Y'], ['255', 'LIMIT', 'X'],
].map(([node, kind, axis]) => ({ node, kind, axis })));

const BM_CII_EXPECTED_ISONOTE = Object.freeze([
  ['35', 'LINESTOP', ''], ['35', 'GUIDE', ''], ['35', 'REST', ''], ['130', 'UNKNOWN', ''],
  ['255', 'GUIDE', ''], ['255', 'REST', ''], ['205', 'LINESTOP', ''], ['205', 'HOLDDOWN', ''],
  ['205', 'GUIDE', ''], ['205', 'REST', ''], ['205', 'HANGER', ''],
].map(([node, kind, axis]) => ({ node, kind, axis })));

function usage() {
  return `Usage:\n  node scripts/bm-cii/support-source-audit.mjs [--xml ${DEFAULT_XML}] [--sidecar <sidecar.json>] [--out-dir ${DEFAULT_OUT_DIR}]\n\nThis creates source-truth support tables only. It does not generate GLB.\n`;
}

function parseArgs(argv) {
  const args = { xmlPath: DEFAULT_XML, outDir: DEFAULT_OUT_DIR };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--xml') args.xmlPath = argv[++i];
    else if (arg === '--sidecar') args.sidecarPath = argv[++i];
    else if (arg === '--out-dir') args.outDir = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function attrs(src) {
  const out = {};
  const re = /([A-Za-z0-9_:\-.]+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(src))) out[m[1]] = m[2];
  return out;
}

function n(value) {
  const out = Number(value);
  if (!Number.isFinite(out)) return null;
  if (Math.abs(out - SENTINEL) < 1e-4) return null;
  return out;
}

function nodeLabel(value) {
  const out = n(value);
  return out === null ? '' : String(Math.round(out));
}

function v(x = 0, y = 0, z = 0) { return { x: Number(x) || 0, y: Number(y) || 0, z: Number(z) || 0 }; }
function add(a, b) { return v(a.x + b.x, a.y + b.y, a.z + b.z); }
function sub(a, b) { return v(a.x - b.x, a.y - b.y, a.z - b.z); }
function mul(a, s) { return v(a.x * s, a.y * s, a.z * s); }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function len(a) { return Math.sqrt(dot(a, a)); }
function norm(a) { const l = len(a); return l > EPS ? mul(a, 1 / l) : null; }

function parseXml(xml) {
  const elements = [];
  let inheritedDiameter = null;
  const elementRe = /<PIPINGELEMENT\b([\s\S]*?)(?:<\/PIPINGELEMENT>|\/>)/g;
  let m;
  while ((m = elementRe.exec(xml))) {
    const block = m[0];
    const head = attrs(m[1]);
    const from = nodeLabel(head.FROM_NODE);
    const to = nodeLabel(head.TO_NODE);
    if (!from || !to) continue;
    const diameter = n(head.DIAMETER);
    if (diameter && diameter > 0) inheritedDiameter = diameter;
    const restraints = [];
    const rRe = /<RESTRAINT\b([^>]*)\/>/g;
    let r;
    while ((r = rRe.exec(block))) {
      const raw = attrs(r[1]);
      const node = nodeLabel(raw.NODE);
      const type = n(raw.TYPE);
      if (!node || type === null) continue;
      restraints.push({ node, type: Math.round(type), gap: n(raw.GAP), raw });
    }
    elements.push({
      index: elements.length + 1,
      from,
      to,
      delta: v(n(head.DELTA_X) ?? 0, n(head.DELTA_Y) ?? 0, n(head.DELTA_Z) ?? 0),
      diameter: diameter ?? inheritedDiameter,
      restraints,
      raw: head,
    });
  }
  return { elements };
}

function solveNodes(elements) {
  const nodes = new Map();
  if (elements[0]) nodes.set(elements[0].from, v(0, 0, 0));
  for (let guard = 0; guard < elements.length * 4; guard += 1) {
    let changed = false;
    for (const e of elements) {
      const a = nodes.get(e.from);
      const b = nodes.get(e.to);
      if (a && !b) { nodes.set(e.to, add(a, e.delta)); changed = true; }
      else if (!a && b) { nodes.set(e.from, sub(b, e.delta)); changed = true; }
    }
    if (!changed) break;
  }
  return Object.fromEntries([...nodes.entries()]);
}

function segments(elements, nodes) {
  return elements.map((e) => {
    const p1 = nodes[e.from];
    const p2 = nodes[e.to];
    const d = p1 && p2 ? sub(p2, p1) : e.delta;
    return { elementIndex: e.index, from: e.from, to: e.to, p1, p2, tangent: norm(d), length: len(d), diameter: e.diameter, radius: e.diameter ? e.diameter / 2 : null };
  });
}

function frameFor(node, segs) {
  const connected = segs.filter((s) => s.from === node || s.to === node);
  const usable = connected.filter((s) => s.tangent && s.radius).sort((a, b) => b.length - a.length);
  const chosen = usable[0] || connected.find((s) => s.tangent) || null;
  return {
    status: chosen?.tangent && chosen?.radius ? 'resolved' : 'unresolved-frame',
    pointSource: 'xml-node-delta-chain',
    tangentSource: chosen ? `element:${chosen.elementIndex}:${chosen.from}->${chosen.to}` : '',
    radiusSource: chosen?.diameter ? `element:${chosen.elementIndex}:DIAMETER` : '',
    tangent: chosen?.tangent || null,
    pipeRadius: chosen?.radius || null,
    connectedSegments: connected.map((s) => ({ elementIndex: s.elementIndex, from: s.from, to: s.to, length: s.length, diameter: s.diameter || null })),
  };
}

function normalizeKind(value) {
  const raw = String(value || '').toUpperCase();
  if (raw.includes('HOLD')) return 'HOLDDOWN';
  if (raw.includes('HANG')) return 'HANGER';
  if (raw.includes('SPRING')) return 'SPRING';
  if (raw.includes('LINE') || raw.includes('STOP')) return 'LINESTOP';
  if (raw.includes('GUIDE')) return 'GUIDE';
  if (raw.includes('LIMIT')) return 'LIMIT';
  if (raw.includes('REST') || raw.includes('SHOE')) return 'REST';
  if (raw.includes('TYPE0') || raw.includes('UNKNOWN')) return 'UNKNOWN';
  return raw || 'UNKNOWN';
}

function contract(kind) { return CONTRACT[kind] || CONTRACT.UNKNOWN; }
function layers(source, kind, axis) { return ['plant.restraints', `restraints.${source}`, `restraints.${kind.toLowerCase()}`, axis ? `axis.${axis.toLowerCase()}` : null].filter(Boolean); }
function recordId(source, i) { return `${source}:${String(i + 1).padStart(2, '0')}`; }

function inputXmlRecords(model, nodes, segs) {
  const records = [];
  for (const e of model.elements) for (const r of e.restraints) {
    const [kind, axis] = CAESAR_TYPE_MAP[r.type] || ['UNKNOWN', ''];
    const frame = frameFor(r.node, segs);
    records.push({
      recordId: recordId('inputxml', records.length), source: 'inputxml', sourceRecordIndex: records.length + 1,
      sourceElementIndex: e.index, node: r.node, rawType: r.type, sourceKind: r.type === 0 ? 'UNKNOWN_TYPE0' : `CAESAR_TYPE_${r.type}`,
      kind, axis, gap: r.gap, pipePoint: nodes[r.node] || null, pipeTangent: frame.tangent, pipeRadius: frame.pipeRadius,
      frameStatus: frame.status, frame, expectedSymbolContract: contract(kind), visibleDefault: kind !== 'UNKNOWN', layerIds: layers('inputxml', kind, axis),
    });
  }
  return records;
}

function tokensFromCallout(c) {
  if (Array.isArray(c.supportTokens)) return c.supportTokens;
  const t = String(c.text || c.caesarCalloutText || c.label || '');
  return ['LINESTOP', 'GUIDE', 'REST', 'HOLDDOWN', 'HANGER', 'SPRING', 'LIMIT', 'UNKNOWN'].filter((k) => new RegExp(`\\b${k}\\b`, 'i').test(t));
}

function isonoteRecords(sidecar, nodes, segs) {
  const explicit = Array.isArray(sidecar?.supportsIsonote) ? sidecar.supportsIsonote : [];
  const rows = explicit.length ? explicit.map((raw) => ({ node: String(raw.node ?? raw.NODE ?? '').replace(/\.0+$/, ''), kind: normalizeKind(raw.kind || raw.supportKind || raw.sourceKind || raw.type || raw.text), axis: String(raw.axis || raw.restraintAxis || '').toUpperCase().replace(/[^XYZ]/g, ''), gap: raw.gap ?? raw.gapMm ?? null })) : [];
  if (!rows.length && sidecar) {
    const callouts = sidecar.caesarAnnotationCallouts || sidecar.callouts || [];
    for (const c of callouts) for (const token of tokensFromCallout(c)) rows.push({ node: String(c.node || '').replace(/\.0+$/, ''), kind: normalizeKind(token), axis: '', gap: null, calloutNo: c.no || c.calloutNo || null });
  }
  const finalRows = rows.length ? rows : BM_CII_EXPECTED_ISONOTE.map((r) => ({ ...r, benchmarkFallback: 'used because no sidecar was supplied' }));
  return finalRows.map((r, i) => {
    const frame = frameFor(r.node, segs);
    return { recordId: recordId('isonote', i), source: 'isonote', sourceRecordIndex: i + 1, node: r.node, sourceKind: r.kind, kind: r.kind, axis: r.axis || '', gap: r.gap ?? null, calloutNo: r.calloutNo ?? null, pipePoint: nodes[r.node] || null, pipeTangent: frame.tangent, pipeRadius: frame.pipeRadius, frameStatus: frame.status, frame, expectedSymbolContract: contract(r.kind), visibleDefault: r.kind !== 'UNKNOWN', layerIds: layers('isonote', r.kind, r.axis || ''), benchmarkFallback: r.benchmarkFallback || undefined };
  });
}

function compareRows(records, expected, source) {
  const issues = [];
  if (records.length !== expected.length) issues.push(`${source}: expected ${expected.length} records, got ${records.length}`);
  for (let i = 0; i < Math.min(records.length, expected.length); i += 1) {
    for (const key of ['node', 'kind', 'axis']) if ((records[i][key] || '') !== (expected[i][key] || '')) issues.push(`${source}:${String(i + 1).padStart(2, '0')}: ${key} expected ${expected[i][key] || 'NA'}, got ${records[i][key] || 'NA'}`);
  }
  return issues;
}

function md(summary, inputxml, isonote) {
  const lines = ['# BM_CII restraint source audit', '', `Status: **${summary.status.toUpperCase()}**`, '', '| Item | Value |', '|---|---:|', `| InputXML records | ${summary.counts.inputxml} |`, `| ISONOTE records | ${summary.counts.isonote} |`, `| Unresolved frames | ${summary.counts.unresolvedFrames} |`, `| Issues | ${summary.counts.issues} |`, '', 'Generated GLB: **no**', 'Visual QC: **not applied**', ''];
  for (const [title, rows] of [['InputXML', inputxml], ['ISONOTE', isonote]]) {
    lines.push(`## ${title} records`, '', '| recordId | node | kind | axis | frame | contract |', '|---|---:|---|---|---|---|');
    for (const r of rows) lines.push(`| ${r.recordId} | ${r.node} | ${r.kind} | ${r.axis || 'NA'} | ${r.frameStatus} | ${r.expectedSymbolContract} |`);
    lines.push('');
  }
  if (summary.issues.length) lines.push('## Issues', '', ...summary.issues.map((x) => `- ${x}`), '');
  return `${lines.join('\n')}\n`;
}

async function writeJson(file, data) { await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8'); }

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(usage()); return; }
  const model = parseXml(await fs.readFile(args.xmlPath, 'utf8'));
  const nodes = solveNodes(model.elements);
  const segs = segments(model.elements, nodes);
  const sidecar = args.sidecarPath ? JSON.parse(await fs.readFile(args.sidecarPath, 'utf8')) : null;
  const inputxml = inputXmlRecords(model, nodes, segs);
  const isonote = isonoteRecords(sidecar, nodes, segs);
  const issues = [...compareRows(inputxml, BM_CII_EXPECTED_INPUTXML, 'inputxml'), ...compareRows(isonote, BM_CII_EXPECTED_ISONOTE, 'isonote')];
  if (!args.sidecarPath) issues.push('isonote: sidecar not supplied; explicit BM_CII fallback table used for investigation only');
  const unresolved = [...inputxml, ...isonote].filter((r) => r.frameStatus !== 'resolved');
  const summary = { schema: `${SCHEMA}/summary`, status: issues.length || unresolved.length ? 'fail' : 'pass', generatedGlb: false, visualQcApplied: false, sidecarProvided: Boolean(args.sidecarPath), counts: { inputxml: inputxml.length, isonote: isonote.length, unresolvedFrames: unresolved.length, issues: issues.length }, issues, unresolvedFrames: unresolved.map((r) => ({ recordId: r.recordId, source: r.source, node: r.node, kind: r.kind, frameStatus: r.frameStatus })) };
  const outDir = path.resolve(args.outDir);
  await fs.mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, 'support_expected_from_inputxml.json'), { schema: `${SCHEMA}/inputxml`, records: inputxml });
  await writeJson(path.join(outDir, 'support_expected_from_isonote.json'), { schema: `${SCHEMA}/isonote`, records: isonote });
  await writeJson(path.join(outDir, 'support_frame_index.json'), { schema: `${SCHEMA}/frames`, nodes, segments: segs });
  await writeJson(path.join(outDir, 'source_audit.summary.json'), summary);
  await fs.writeFile(path.join(outDir, 'source_audit.md'), md(summary, inputxml, isonote), 'utf8');
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => { process.stderr.write(`${error?.stack || error?.message || String(error)}\n\n${usage()}`); process.exitCode = 1; });

export { SCHEMA, BM_CII_EXPECTED_INPUTXML, BM_CII_EXPECTED_ISONOTE, CAESAR_TYPE_MAP, parseXml, solveNodes, segments, inputXmlRecords, isonoteRecords, frameFor };
