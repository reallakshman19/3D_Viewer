#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  runInputXmlPropertyTransferPreview,
} from '../viewer/tabs/inputxml-property-transfer/index.js';

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
  sourceLineFamilyRegex: '([A-Z]\\d{7})',
  targetLineFamilyRegex: '([A-Z]\\d{7})',
  componentTypeMode: 'ignore',
  copySourceSentinels: false,
  sentinelValues: ['-100000', '-100000.0'],
  selectedNodeProperties: [
    'WallThickness',
    'CorrosionAllowance',
    'InsulationThickness',
    'OutsideDiameter',
    'Weight',
    'MaterialCode',
  ],
  selectedBranchProperties: ['Temperature1', 'Temperature2', 'Pressure1', 'Pressure2'],
});

function readRequired(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing benchmark file: ${file}`);
  return fs.readFileSync(file, 'utf8');
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
  const sourceXmlText = readRequired(sourceXmlPath);
  const targetXmlText = readRequired(targetXmlPath);
  const expected = new Map(parseCsv(readRequired(expectedCsvPath)).map((row) => [row.targetNode, row]));

  const result = runInputXmlPropertyTransferPreview({ sourceXmlText, targetXmlText, options: CONFIG });
  const report = result.rows.map((row) => ({
    targetNode: row.targetNode,
    targetNodeNumber: row.targetNodeNumber,
    component: row.targetComponentType,
    decision: row.decision,
    sourceNode: row.sourceNode,
    sourceNodeNumber: row.sourceNodeNumber,
    lineFamily: row.targetLineFamily,
    candidateCount: row.candidateCount,
    propertyChanges: row.propertyChanges,
    changedProperties: row.changedProperties,
    retainedTargetValues: row.retainedTargetValues,
  }));

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

  const { summary } = result;
  console.log('InputXML property transfer coordinate benchmark');
  console.log(`  Source nodes: ${summary.sourceNodes}`);
  console.log(`  Target nodes/elements: ${summary.targetNodes}`);
  console.log(`  Coordinate tolerance: ${summary.coordinateToleranceMm} mm`);
  console.log(`  Diameter strict tolerance: ${summary.diameterToleranceMm} mm`);
  console.log(`  Line family mode: ${summary.lineFamilyMode}`);
  console.log(`  Transferred: ${summary.transferred}`);
  console.log(`  No coordinate match: ${summary.noCoordinateMatch}`);
  console.log(`  Diameter blocked: ${summary.diameterBlocked}`);
  console.log(`  Line family blocked: ${summary.lineFamilyBlocked}`);
  console.log(`  Ambiguous: ${summary.ambiguous}`);

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
