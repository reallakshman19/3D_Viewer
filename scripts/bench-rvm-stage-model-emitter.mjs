#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRvmWideRecords, summarizeRvmWideRecordReaderReport } from '../viewer/stage/parser/RvmWideRecordReader.js';
import { buildRvmNativeRecordLedger } from '../viewer/stage/parser/RvmNativeRecordLedgerBuilder.js';
import { buildRvmPrimitiveDecodeReport } from '../viewer/stage/parser/RvmPrimitiveDecodeReportBuilder.js';
import { summarizeFacetGroupsFromDecodeReport } from '../viewer/stage/parser/RvmFacetGroupPayloadDecoder.js';
import { buildRvmStageModelFromEvidence, summarizeRvmStageModelEmission } from '../viewer/stage/parser/RvmStageModelEmitter.js';
import { validateRvmStageModelFromEvidence } from '../viewer/stage/contracts/RvmStageModelEvidenceContract.js';

async function main(argv) {
  const args = parseArgs(argv);
  if (!args.input) return usage(1);
  const filePath = path.resolve(args.input);
  const buffer = await fs.readFile(filePath);
  const arrayBuffer = toArrayBuffer(buffer);
  const readerReport = readRvmWideRecords({ arrayBuffer, fileName: path.basename(filePath) });
  const ledger = buildRvmNativeRecordLedger(readerReport);
  const primitiveDecodeReport = buildRvmPrimitiveDecodeReport({ arrayBuffer, readerReport, ledger });
  const stageModel = buildRvmStageModelFromEvidence({ readerReport, ledger, primitiveDecodeReport });
  const validation = validateRvmStageModelFromEvidence(stageModel);
  printSummary(readerReport, ledger, primitiveDecodeReport, stageModel, validation);
  if (args.out) await writeReport(args.out, { readerReport, ledger, primitiveDecodeReport, stageModel, validation });
}

function parseArgs(argv) {
  const args = { input: '', out: '' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out') { args.out = argv[index + 1] || ''; index += 1; continue; }
    if (!args.input) args.input = argv[index];
  }
  return args;
}

function printSummary(readerReport, ledger, primitiveDecodeReport, stageModel, validation) {
  const reader = summarizeRvmWideRecordReaderReport(readerReport);
  const stage = summarizeRvmStageModelEmission(stageModel);
  console.log(JSON.stringify({
    readerRecords: reader.records.byTag,
    ledgerNodeCount: Array.isArray(ledger.nodes) ? ledger.nodes.length : 0,
    primitiveRecordCount: primitiveDecodeReport.coverage?.primitiveRecordCount || 0,
    stageNodeCount: stage.stageNodeCount,
    stagePrimitiveCount: stage.stagePrimitiveCount,
    decodedPrimitiveCount: stage.decodedPrimitiveCount,
    unsupportedPrimitiveCount: stage.unsupportedPrimitiveCount,
    failedPrimitiveCount: stage.failedPrimitiveCount,
    decodedByCode: stage.decodedByCode,
    unsupportedByCode: stage.unsupportedByCode,
    failedByCode: stage.failedByCode,
    facetGroup: summarizeFacetGroupsFromDecodeReport(primitiveDecodeReport),
    diagnostics: stage.diagnosticCount,
    validationErrorCount: validation.errors.length,
    valid: validation.valid,
    parserComplete: stage.parserComplete,
    visualParityClaimed: stage.visualParityClaimed,
    attAvailable: stage.attAvailable,
  }, null, 2));
}

async function writeReport(outPath, payload) {
  const target = path.resolve(outPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(payload, null, 2));
}

function toArrayBuffer(buffer) { return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength); }
function usage(code) { const script = path.relative(process.cwd(), fileURLToPath(import.meta.url)); console.error(`Usage: node ${script} /path/to/file.rvm [--out report.json]`); process.exitCode = code; }
main(process.argv.slice(2)).catch((error) => { console.error(error?.stack || error?.message || String(error)); process.exitCode = 1; });
