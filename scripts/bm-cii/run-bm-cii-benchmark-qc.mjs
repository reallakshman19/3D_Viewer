#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { componentsFromBmCiiXml } from './bm-cii-xml-components.mjs';

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_XML = 'Benchmarks/INPUT XML to CII 2019/BM_CII/BM_CII_INPUT.XML';
const DEFAULT_BENCHMARK_SIDECAR = 'benchmarks/bm-cii/BM_CII_benchmark_isonote.sidecar.json';
const DEFAULT_AUDIT_DIR = 'artifacts/bm-cii-restraint-audit';
const DEFAULT_OUT_DIR = 'artifacts/bm-cii-v11-robust';

const VARIANTS = Object.freeze([
  { name: 'engineering_inputxml', source: 'inputxml', count: 12, glb: 'BM_CII_Enriched_engineering_v11_robust_inputxml.glb', expected: 'support_expected_from_inputxml.json' },
  { name: 'engineering_isonote', source: 'isonote', count: 11, glb: 'BM_CII_Enriched_engineering_v11_robust_isonote.glb', expected: 'support_expected_from_isonote.json' },
  { name: 'temp1_inputxml', source: 'inputxml', count: 12, glb: 'BM_CII_Enriched_temp1_v11_robust_inputxml.glb', expected: 'support_expected_from_inputxml.json' },
  { name: 'temp1_isonote', source: 'isonote', count: 11, glb: 'BM_CII_Enriched_temp1_v11_robust_isonote.glb', expected: 'support_expected_from_isonote.json' },
]);

function usage() {
  return `Usage:\n  node scripts/bm-cii/run-bm-cii-benchmark-qc.mjs [--xml ${DEFAULT_XML}] [--benchmark-sidecar ${DEFAULT_BENCHMARK_SIDECAR}] [--audit-dir ${DEFAULT_AUDIT_DIR}] [--out-dir ${DEFAULT_OUT_DIR}]\n\nRuns the controlled repo-path BM_CII benchmark package generation and QC gates.\n`;
}

function parseArgs(argv) {
  const args = {
    xmlPath: DEFAULT_XML,
    benchmarkSidecarPath: DEFAULT_BENCHMARK_SIDECAR,
    auditDir: DEFAULT_AUDIT_DIR,
    outDir: DEFAULT_OUT_DIR,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--xml') args.xmlPath = argv[++i];
    else if (arg === '--benchmark-sidecar') args.benchmarkSidecarPath = argv[++i];
    else if (arg === '--audit-dir') args.auditDir = argv[++i];
    else if (arg === '--out-dir') args.outDir = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replaceAll('\\', '/');
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function runNode(script, args, options = {}) {
  const command = ['node', script, ...args];
  const startedAt = new Date().toISOString();
  try {
    const { stdout, stderr } = await execFileAsync('node', [script, ...args], {
      cwd: ROOT,
      maxBuffer: 1024 * 1024 * 20,
    });
    return {
      name: options.name || script,
      status: 'pass',
      command: command.join(' '),
      startedAt,
      finishedAt: new Date().toISOString(),
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error) {
    return {
      name: options.name || script,
      status: 'fail',
      command: command.join(' '),
      startedAt,
      finishedAt: new Date().toISOString(),
      exitCode: error?.code ?? 1,
      stdout: String(error?.stdout || '').trim(),
      stderr: String(error?.stderr || error?.message || error).trim(),
    };
  }
}

function compactSupportRecord(record) {
  return {
    recordId: record.recordId,
    sourceRecordIndex: record.sourceRecordIndex,
    source: record.source,
    node: record.node,
    kind: record.kind,
    supportKind: record.kind,
    normalizedKind: record.kind,
    sourceKind: record.sourceKind,
    axis: record.axis || '',
    restraintAxis: record.axis || '',
    gap: record.gap ?? null,
    pipePoint: record.pipePoint,
    displayPointGlb: record.pipePoint,
    pipeTangent: record.pipeTangent,
    pipeTangentGlb: record.pipeTangent,
    pipeRadius: record.pipeRadius,
    pipeRadiusGlb: record.pipeRadius,
    outsideDiameter: record.pipeRadius ? record.pipeRadius * 2 : null,
    expectedSymbolContract: record.expectedSymbolContract,
    visibleDefault: record.visibleDefault,
    layerIds: record.layerIds,
    frameStatus: record.frameStatus,
  };
}

async function composeRepoBenchmarkInputs({ xmlPath, auditDir, benchmarkSidecarPath, outDir, qcDir }) {
  const inputxml = await readJson(path.join(auditDir, 'support_expected_from_inputxml.json'));
  const isonote = await readJson(path.join(auditDir, 'support_expected_from_isonote.json'));
  const frameIndex = await readJson(path.join(auditDir, 'support_frame_index.json'));
  const benchmarkSidecar = await readJson(benchmarkSidecarPath);
  const xml = await fs.readFile(xmlPath, 'utf8');
  const componentResult = componentsFromBmCiiXml(xml, frameIndex);

  const fullModel = {
    schema: 'bm-cii-repo-generated-full-render-model/v1',
    sourceXml: rel(xmlPath),
    generatedBy: 'scripts/bm-cii/run-bm-cii-benchmark-qc.mjs',
    modelRole: 'authoritative-plant-geometry',
    nodeCoordinatesGlbBasisMm: frameIndex.nodes || {},
    nodes: frameIndex.nodes || {},
    components: componentResult.components,
    bmCiiComponentSummary: componentResult.summary,
    bmCiiXmlComponentSourceStats: componentResult.sourceStats,
    bmCiiModelSource: 'xml-derived-full-render-model',
  };

  const sidecar = {
    schema: 'bm-cii-repo-generated-benchmark-sidecar/v3',
    sourceXml: rel(xmlPath),
    sourceBenchmarkSidecar: rel(benchmarkSidecarPath),
    generatedBy: 'scripts/bm-cii/run-bm-cii-benchmark-qc.mjs',
    sidecarRole: 'supports-and-annotations-only',
    nodeCoordinatesGlbBasisMm: frameIndex.nodes || {},
    supportsInputXml: (inputxml.records || []).map(compactSupportRecord),
    supportsIsonote: (isonote.records || []).map(compactSupportRecord),
    caesarAnnotationCallouts: benchmarkSidecar.caesarAnnotationCallouts || [],
    bmCiiComponentSummary: componentResult.summary,
    bmCiiXmlComponentSourceStats: componentResult.sourceStats,
    bmCiiAnnotationWhitelist: {
      source: 'benchmarks/bm-cii/BM_CII_benchmark_isonote.sidecar.json',
      callouts: [1, 2, 3, 4],
      nodes: ['35', '130', '205', '255'],
    },
  };

  const modelPath = path.join(outDir, 'BM_CII_repo_generated_full_render.model.json');
  const sidecarPath = path.join(outDir, 'BM_CII_repo_generated_benchmark.sidecar.json');
  await writeJson(modelPath, fullModel);
  await writeJson(sidecarPath, sidecar);
  await writeJson(path.join(qcDir, 'component_expected_summary.json'), componentResult.summary);
  await writeJson(path.join(qcDir, 'component_source_stats.json'), componentResult.sourceStats);
  await writeJson(path.join(qcDir, 'component_expected_model.json'), fullModel);
  return { modelPath, sidecarPath };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }

  const xmlPath = path.resolve(ROOT, args.xmlPath);
  const benchmarkSidecarPath = path.resolve(ROOT, args.benchmarkSidecarPath);
  const auditDir = path.resolve(ROOT, args.auditDir);
  const outDir = path.resolve(ROOT, args.outDir);
  const qcDir = path.join(outDir, 'qc');
  await fs.mkdir(qcDir, { recursive: true });

  const steps = [];
  const pushStep = async (promise) => {
    const step = await promise;
    steps.push(step);
    if (step.status !== 'pass') {
      await writeSummary({ status: 'fail', steps, outDir, auditDir });
      throw new Error(`${step.name} failed. See command output in summary.`);
    }
    return step;
  };

  await pushStep(runNode('scripts/bm-cii/support-source-audit.mjs', [
    '--xml', rel(xmlPath),
    '--sidecar', rel(benchmarkSidecarPath),
    '--out-dir', rel(auditDir),
  ], { name: 'source audit' }));

  await pushStep(runNode('scripts/bm-cii/support-frame-qc.mjs', [
    '--audit-dir', rel(auditDir),
    '--out', rel(path.join(qcDir, 'support_frame_qc_report.json')),
  ], { name: 'support frame QC' }));

  const { modelPath, sidecarPath } = await composeRepoBenchmarkInputs({ xmlPath, auditDir, benchmarkSidecarPath, outDir, qcDir });

  await pushStep(runNode('scripts/bm-cii/support-export-glyph-path-qc.mjs', [], { name: 'support export path QC' }));

  await pushStep(runNode('scripts/bm-cii/build-v11-robust.mjs', [
    '--model', rel(modelPath),
    '--sidecar', rel(sidecarPath),
    '--out-dir', rel(outDir),
  ], { name: 'repo-path GLB generation' }));

  await pushStep(runNode('scripts/bm-cii/annotation-fidelity-qc.mjs', [
    '--sidecar', rel(path.join(outDir, 'BM_CII_Enriched_benchmark_v11_robust.sidecar.json')),
    '--out', rel(path.join(qcDir, 'annotation_fidelity_qc_report.json')),
  ], { name: 'annotation fidelity QC' }));

  for (const variant of VARIANTS) {
    await pushStep(runNode('scripts/bm-cii/glb-visible-scene-qc.mjs', [
      '--glb', rel(path.join(outDir, variant.glb)),
      '--expected-support', rel(path.join(auditDir, variant.expected)),
      '--expected-source', variant.source,
      '--expected-support-count', String(variant.count),
      '--expected-callout-count', '4',
      '--expected-node-label-count', '4',
      '--expected-component-summary', rel(path.join(qcDir, 'component_expected_summary.json')),
      '--out', rel(path.join(qcDir, `glb_visible_scene_qc_${variant.name}.json`)),
    ], { name: `visible scene QC ${variant.name}` }));
  }

  await writeSummary({ status: 'pass', steps, outDir, auditDir });
}

async function writeSummary({ status, steps, outDir, auditDir }) {
  const glbs = VARIANTS.map((variant) => path.join(outDir, variant.glb));
  const summary = {
    schema: 'bm-cii-repo-path-benchmark-run/v3',
    status,
    generatedByRepoCode: true,
    generatedGlb: status === 'pass',
    visualQcApplied: false,
    auditDir: rel(auditDir),
    outDir: rel(outDir),
    glbs: glbs.map(rel),
    qcDir: rel(path.join(outDir, 'qc')),
    steps,
    note: 'Visual QC in Basic GLB-PCF Viewer is still required before baseline freeze.',
  };
  await writeJson(path.join(outDir, 'BM_CII_repo_path_benchmark_summary.json'), summary);
  const md = [
    '# BM_CII repo-path benchmark generation',
    '',
    `Status: **${status.toUpperCase()}**`,
    '',
    '| Item | Value |',
    '|---|---|',
    `| Generated by repo code | yes |`,
    `| Generated GLB | ${status === 'pass' ? 'yes' : 'no'} |`,
    `| Automated support QC | ${steps.every((step) => step.status === 'pass') ? 'pass' : 'fail'} |`,
    `| Component completeness QC | ${steps.some((step) => step.name.includes('visible scene QC')) && steps.every((step) => step.status === 'pass') ? 'pass' : 'fail'} |`,
    `| Visual QC | not applied |`,
    '',
    '## Steps',
    '',
    '| Step | Status | Command |',
    '|---|---|---|',
    ...steps.map((step) => `| ${step.name} | ${step.status} | \`${step.command}\` |`),
    '',
    '## GLBs',
    '',
    ...glbs.map((file) => `- ${rel(file)}`),
    '',
  ].join('\n');
  await fs.writeFile(path.join(outDir, 'summary.md'), md, 'utf8');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
