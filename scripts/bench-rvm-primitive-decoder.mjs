#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRvmWideRecords } from '../viewer/stage/parser/RvmWideRecordReader.js';
import { buildRvmNativeRecordLedger } from '../viewer/stage/parser/RvmNativeRecordLedgerBuilder.js';
import { buildRvmPrimitiveDecodeReport } from '../viewer/stage/parser/RvmPrimitiveDecodeReportBuilder.js';
import { summarizeFacetGroupsFromDecodeReport } from '../viewer/stage/parser/RvmFacetGroupPayloadDecoder.js';
import { summarizeRvmPrimitiveDecodeReport } from '../viewer/stage/contracts/RvmPrimitiveDecodeContract.js';

async function main(argv) {
  const args = parseArgs(argv);
  if (!args.input) return usage(1);
  const filePath = path.resolve(args.input);
  const buffer = await fs.readFile(filePath);
  const arrayBuffer = toArrayBuffer(buffer);
  const readerReport = readRvmWideRecords({ arrayBuffer, fileName: path.basename(filePath) });
  const ledger = buildRvmNativeRecordLedger(readerReport);
  const report = buildRvmPrimitiveDecodeReport({ arrayBuffer, readerReport, ledger });
  printSummary(report);
  if (args.out) await writeReport(args.out, { readerReport, ledger, report });
}

function parseArgs(argv) {
  const args = { input: '', out: '' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out') { args.out = argv[index + 1] || ''; index += 1; continue; }
    if (!args.input) args.input = argv[index];
  }
  return args;
}

function printSummary(report) {
  const summary = summarizeRvmPrimitiveDecodeReport(report);
  const facetGroup = summarizeFacetGroupsFromDecodeReport(report);
  console.log(JSON.stringify({
    primitiveRecordCount: summary.coverage.primitiveRecordCount,
    decodedCount: summary.coverage.decodedCount,
    unsupportedCount: summary.coverage.unsupportedCount,
    failedCount: summary.coverage.failedCount,
    decodedByCode: summary.coverage.decodedByCode,
    unsupportedByCode: summary.coverage.unsupportedByCode,
    failedByCode: summary.coverage.failedByCode,
    facetGroup,
    parserComplete: summary.parserComplete,
    visualParityClaimed: summary.visualParityClaimed,
    warnings: summary.warningCount,
    errors: summary.errorCount,
  }, null, 2));
}

async function writeReport(outPath, payload) {
  const target = path.resolve(outPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(payload, null, 2));
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function usage(code) {
  const script = path.relative(process.cwd(), fileURLToPath(import.meta.url));
  console.error(`Usage: node ${script} /path/to/file.rvm [--out report.json]`);
  process.exitCode = code;
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
