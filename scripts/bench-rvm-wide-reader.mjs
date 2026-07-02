#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRvmWideRecords, summarizeRvmWideRecordReaderReport } from '../viewer/stage/parser/RvmWideRecordReader.js';
import { buildRvmNativeRecordLedger } from '../viewer/stage/parser/RvmNativeRecordLedgerBuilder.js';
import { summarizeRvmNativeRecordLedger } from '../viewer/stage/contracts/RvmNativeRecordLedgerContract.js';

async function main(argv) {
  const args = parseArgs(argv);
  if (!args.input) return usage(1);
  const filePath = path.resolve(args.input);
  const buffer = await fs.readFile(filePath);
  const report = readRvmWideRecords({ arrayBuffer: toArrayBuffer(buffer), fileName: path.basename(filePath) });
  const ledger = buildRvmNativeRecordLedger(report);
  printSummary(report, ledger);
  if (args.out) await writeReport(args.out, report, ledger);
}

function parseArgs(argv) {
  const args = { input: '', out: '' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out') { args.out = argv[index + 1] || ''; index += 1; continue; }
    if (!args.input) args.input = argv[index];
  }
  return args;
}

function printSummary(report, ledger) {
  const reader = summarizeRvmWideRecordReaderReport(report);
  const nativeLedger = summarizeRvmNativeRecordLedger(ledger);
  console.log(JSON.stringify({
    records: reader.records.byTag,
    primitiveCodes: reader.primitiveCodes,
    hierarchy: reader.hierarchy,
    ledger: { nodeCount: nativeLedger.nodeCount, primitiveRecordCount: nativeLedger.primitiveRecordCount },
    parserComplete: reader.parserComplete,
    visualParityClaimed: reader.visualParityClaimed,
    warnings: reader.warningCount,
    errors: reader.errorCount,
  }, null, 2));
}

async function writeReport(outPath, report, ledger) {
  const target = path.resolve(outPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify({ report, ledger }, null, 2));
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
