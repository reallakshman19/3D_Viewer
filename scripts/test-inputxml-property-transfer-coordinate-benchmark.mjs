#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const benchmarkDir = path.join(root, 'Benchmarks', 'InputXML Property Transfer', 'coordinate-tolerance');
const sourceXmlPath = path.join(benchmarkDir, 'source_property_master.xml');
const targetXmlPath = path.join(benchmarkDir, 'target_geometry.xml');
const expectedCsvPath = path.join(benchmarkDir, 'expected_transfer_report.csv');

const CONFIG = Object.freeze({
  coordinateToleranceMm: 1.0,
  coordinateDecimals: 3,
  diameterMode: 'strict',
  diameterToleranceMm: 0.5,
  lineFamilyMode: 'strict',
  lineFamilyRegex: /([A-Z]\d{7})/i,
  copySourceSentinels: false,
  sourceSentinels: new Set(['-100000', '-100000.0']),
});

const NODE_PROPS = Object.freeze([
  'WallThickness',
  'CorrosionAllowance',
  'InsulationThickness',
  'OutsideDiameter',
  'Weight',
  'MaterialCode',
]);

const BRANCH_PROPS = Object.freeze(['Temperature1', 'Temperature2', 'Pressure1', 'Pressure2']);

function readRequired(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing benchmark file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function textBetween(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function numberOrNull(value) {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) ? n : null;
}

function parsePosition(value) {
  const text = String(value ?? '');
  const e = text.match(/\bE\s*([-+]?\d+(?:\.\d+)?)\s*mm?/i);
  const s = text.match(/\bS\s*([-+]?\d+(?:\.\d+)?)\s*mm?/i);
  const u = text.match(/\bU\s*([-+]?\d+(?:\.\d+)?)\s*mm?/i);
  if (!e || !s || !u) throw new Error(`Invalid Position format: ${value}`);
  return { e: Number(e[1]), s: Number(s[1]), u: Number(u[1]) };
}

function lineFamily(branchName) {
  const match = String(branchName ?? '').match(CONFIG.lineFamilyRegex);
  return match ? match[1].toUpperCase() : '';
}

function parseXml(xml, label) {
  const branches = [];
  const branchRe = /<Branch>([\s\S]*?)<\/Branch>/gi;
  let branchMatch;
  while ((branchMatch = branchRe.exec(xml))) {
    const branchXml = branchMatch[1];
    const branchName = textBetween(branchXml, 'BranchName');
    const branch = {
      source: label,
      branchName,
      lineFamily: lineFamily(branchName),
      props: Object.fromEntries(BRANCH_PROPS.map((tag) => [tag, textBetween(branchXml, tag)])),
      nodes: [],
    };
    const nodeRe = /<Node>([\s\S]*?)<\/Node>/gi;
    let nodeMatch;
    while ((nodeMatch = nodeRe.exec(branchXml))) {
      const nodeXml = nodeMatch[1];
      const position = parsePosition(textBetween(nodeXml, 'Position'));
      branch.nodes.push({
        source: label,
        branch,
        nodeNumber: textBetween(nodeXml, 'NodeNumber'),
        nodeName: textBetween(nodeXml, 'NodeName'),
        componentType: textBetween(nodeXml, 'ComponentType'),
        position,
        coordinateKey: `${position.e.toFixed(CONFIG.coordinateDecimals)}|${position.s.toFixed(CONFIG.coordinateDecimals)}|${position.u.toFixed(CONFIG.coordinateDecimals)}`,
        outsideDiameter: numberOrNull(textBetween(nodeXml, 'OutsideDiameter')),
        props: Object.fromEntries(NODE_PROPS.map((tag) => [tag, textBetween(nodeXml, tag)])),
      });
    }
    branches.push(branch);
  }
  return { branches, nodes: branches.flatMap((branch) => branch.nodes) };
}

function delta(source, target) {
  const dE = target.position.e - source.position.e;
  const dS = target.position.s - source.position.s;
  const dU = target.position.u - source.position.u;
  return {
    dE,
    dS,
    dU,
    max: Math.max(Math.abs(dE), Math.abs(dS), Math.abs(dU)),
    distance3d: Math.sqrt(dE * dE + dS * dS + dU * dU),
  };
}

function withinCoordinateTolerance(source, target) {
  return delta(source, target).max <= CONFIG.coordinateToleranceMm + 1e-9;
}

function diameterMatches(source, target) {
  if (source.outsideDiameter == null || target.outsideDiameter == null) return false;
  return Math.abs(source.outsideDiameter - target.outsideDiameter) <= CONFIG.diameterToleranceMm + 1e-9;
}

function isSentinel(value) {
  return CONFIG.sourceSentinels.has(String(value ?? '').trim());
}

function transferProps(source, target) {
  const changes = [];
  for (const prop of NODE_PROPS) {
    const sourceValue = source.props[prop];
    if (sourceValue === '') continue;
    if (isSentinel(sourceValue) && !CONFIG.copySourceSentinels) continue;
    changes.push({ scope: 'node', prop, before: target.props[prop], after: sourceValue });
  }
  for (const prop of BRANCH_PROPS) {
    const sourceValue = source.branch.props[prop];
    if (sourceValue === '') continue;
    if (isSentinel(sourceValue) && !CONFIG.copySourceSentinels) continue;
    changes.push({ scope: 'branch', prop, before: target.branch.props[prop], after: sourceValue });
  }
  return changes;
}

function decide(sourceModel, target) {
  const coordinateCandidates = sourceModel.nodes
    .filter((source) => withinCoordinateTolerance(source, target))
    .map((source) => ({ source, delta: delta(source, target) }))
    .sort((a, b) => a.delta.max - b.delta.max || a.delta.distance3d - b.delta.distance3d);

  if (!coordinateCandidates.length) {
    return { decision: 'NO_COORDINATE_MATCH', source: null, candidates: [], changes: [] };
  }

  let candidates = coordinateCandidates;
  if (CONFIG.diameterMode === 'strict') {
    candidates = candidates.filter(({ source }) => diameterMatches(source, target));
    if (!candidates.length) {
      return { decision: 'DIAMETER_MISMATCH_BLOCKED', source: null, candidates: coordinateCandidates, changes: [] };
    }
  }

  if (CONFIG.lineFamilyMode === 'strict') {
    const targetFamily = target.branch.lineFamily;
    candidates = candidates.filter(({ source }) => source.branch.lineFamily === targetFamily);
    if (!candidates.length) {
      return { decision: 'LINE_FAMILY_MISMATCH_BLOCKED', source: null, candidates: coordinateCandidates, changes: [] };
    }
  }

  if (candidates.length > 1) {
    return { decision: 'AMBIGUOUS_COORDINATE_MATCH', source: null, candidates, changes: [] };
  }

  const selected = candidates[0].source;
  return {
    decision: 'TRANSFERRED',
    source: selected,
    candidates,
    changes: transferProps(selected, target),
  };
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  return lines.map((line) => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function main() {
  const sourceModel = parseXml(readRequired(sourceXmlPath), 'source');
  const targetModel = parseXml(readRequired(targetXmlPath), 'target');
  const expected = new Map(parseCsv(readRequired(expectedCsvPath)).map((row) => [row.targetNode, row]));

  const report = targetModel.nodes.map((target) => {
    const result = decide(sourceModel, target);
    const source = result.source;
    return {
      targetNode: target.nodeName,
      targetNodeNumber: target.nodeNumber,
      component: target.componentType,
      decision: result.decision,
      sourceNode: source?.nodeName ?? '',
      sourceNodeNumber: source?.nodeNumber ?? '',
      lineFamily: target.branch.lineFamily,
      candidateCount: result.candidates.length,
      propertyChanges: result.changes.length,
      changedProperties: result.changes.map((change) => `${change.scope}:${change.prop}`).join(';'),
      retainedTargetValues: result.decision === 'TRANSFERRED' ? '' : 'YES',
    };
  });

  const failures = [];
  for (const row of report) {
    const exp = expected.get(row.targetNode);
    if (!exp) {
      failures.push(`${row.targetNode}: missing expected row`);
      continue;
    }
    if (row.decision !== exp.expectedDecision) {
      failures.push(`${row.targetNode}: decision ${row.decision}, expected ${exp.expectedDecision}`);
    }
    if (row.sourceNode !== exp.expectedSourceNode) {
      failures.push(`${row.targetNode}: source ${row.sourceNode || '(none)'}, expected ${exp.expectedSourceNode || '(none)'}`);
    }
    if (row.decision !== 'TRANSFERRED' && row.propertyChanges !== 0) {
      failures.push(`${row.targetNode}: blocked/unmatched row has property changes`);
    }
  }

  const transferred = report.filter((row) => row.decision === 'TRANSFERRED').length;
  const noCoord = report.filter((row) => row.decision === 'NO_COORDINATE_MATCH').length;
  const diaBlocked = report.filter((row) => row.decision === 'DIAMETER_MISMATCH_BLOCKED').length;
  const lineBlocked = report.filter((row) => row.decision === 'LINE_FAMILY_MISMATCH_BLOCKED').length;
  const ambiguous = report.filter((row) => row.decision === 'AMBIGUOUS_COORDINATE_MATCH').length;

  console.log('InputXML property transfer coordinate benchmark');
  console.log(`  Source nodes: ${sourceModel.nodes.length}`);
  console.log(`  Target nodes/elements: ${targetModel.nodes.length}`);
  console.log(`  Coordinate tolerance: ${CONFIG.coordinateToleranceMm} mm`);
  console.log(`  Diameter strict tolerance: ${CONFIG.diameterToleranceMm} mm`);
  console.log(`  Line family mode: ${CONFIG.lineFamilyMode}`);
  console.log(`  Transferred: ${transferred}`);
  console.log(`  No coordinate match: ${noCoord}`);
  console.log(`  Diameter blocked: ${diaBlocked}`);
  console.log(`  Line family blocked: ${lineBlocked}`);
  console.log(`  Ambiguous: ${ambiguous}`);

  const sampleRows = report.filter((row) => ['TGT-PIPE-01', 'TGT-PIPE-04', 'TGT-FLANGE-10', 'TGT-VALVE-17', 'TGT-VALVE-24'].includes(row.targetNode));
  console.log('\nSample decisions:');
  for (const row of sampleRows) {
    console.log(`  ${row.targetNode}: ${row.decision}${row.sourceNode ? ` from ${row.sourceNode}` : ''}; changes=${row.propertyChanges}; retained=${row.retainedTargetValues || 'NO'}`);
  }

  if (failures.length) {
    console.error('\n❌ Benchmark failed:');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log('\n✅ InputXML property transfer coordinate benchmark passed.');
}

main();
