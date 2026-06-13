import { extractInputXmlBranches } from '../inputxml-dxf/InputXmlBranchExtractor.js';
import { buildExportScene } from '../../js/pcf2glb/glb/buildExportScene.js';
import { exportSceneToGLB } from '../../js/pcf2glb/glb/exportSceneToGLB.js';
import { applyInputXmlBendMetadata } from './InputXmlBendMetadata.js';
import { applyInputXmlCaesarSupportMetadata } from './InputXmlCaesarSupportMetadata.js';
import { adaptUxmlToGlbModel } from './UxmlToGlbModelAdapter.js';

function text(value) {
  return String(value ?? '').trim();
}

async function readFileText(file) {
  if (typeof file?.text === 'string') return file.text;
  if (file?.bytes instanceof Uint8Array) return new TextDecoder('utf-8').decode(file.bytes);
  if (file?.bytes instanceof ArrayBuffer) return new TextDecoder('utf-8').decode(new Uint8Array(file.bytes));
  if (typeof file?.file?.text === 'function') return file.file.text();
  if (typeof file?.text === 'function') return file.text();
  return '';
}

function baseName(name) {
  const normalized = text(name) || 'inputxml-model';
  return normalized.replace(/\.[^.]+$/, '') || 'inputxml-model';
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function blobLikeToArrayBuffer(value) {
  if (value instanceof ArrayBuffer) return value;
  if (value?.buffer instanceof ArrayBuffer && value?.byteLength !== undefined) {
    return value.buffer.slice(value.byteOffset || 0, (value.byteOffset || 0) + value.byteLength);
  }
  if (typeof value?.arrayBuffer === 'function') return value.arrayBuffer();
  throw new Error('GLB exporter did not return Blob or ArrayBuffer output.');
}

function createSceneLog(stdout, stderr) {
  return {
    warn(code, payload = {}) {
      stdout.push(`WARN ${code}: ${JSON.stringify(payload)}`);
    },
    error(code, payload = {}) {
      stderr.push(`ERROR ${code}: ${JSON.stringify(payload)}`);
    },
  };
}

export async function run(ctx = {}) {
  const stdout = [];
  const stderr = [];
  const file = (ctx.inputFiles || []).find((entry) => entry?.role === 'primary') || ctx.inputFiles?.[0];
  const sourceName = file?.name || 'input.xml';

  try {
    if (!file) throw new Error('Select a primary Input XML file first.');
    ctx.setStatus?.('Reading Input XML...', 'running');
    const xmlText = await readFileText(file);
    const extracted = extractInputXmlBranches(xmlText, {
      sourceId: 'inputxml-glb',
      fileName: sourceName,
    });
    if (!extracted.ok) throw new Error('Input XML could not be mapped to UXML geometry.');

    const bendMetadata = applyInputXmlBendMetadata(xmlText, extracted.doc);
    if (bendMetadata.bendTagCount) {
      stdout.push(`InputXML bend tags: ${bendMetadata.bendTagCount}; radius values: ${bendMetadata.radiusCount}; angle values: ${bendMetadata.angleCount}`);
    }

    const caesarSupportMetadata = applyInputXmlCaesarSupportMetadata(xmlText, extracted.doc, {
      sourceId: 'inputxml-glb',
    });
    if (caesarSupportMetadata.supportTagCount) {
      stdout.push(`InputXML CAESAR support/restraint tags: ${caesarSupportMetadata.supportTagCount}; expanded: ${caesarSupportMetadata.expandedSupportCount}`);
      stdout.push(`InputXML CAESAR support kinds: ${JSON.stringify(caesarSupportMetadata.kindCounts)}`);
    }

    const { model, stats, diagnostics } = adaptUxmlToGlbModel(extracted.doc, ctx.options || {});
    if (!model.components.length) throw new Error('No drawable Input XML components were found for GLB export.');

    stdout.push(`InputXML→GLB components: ${stats.componentCount}`);
    stdout.push(`Component types: ${JSON.stringify(stats.typeCounts)}`);
    if (stats.bendRadiusCount) {
      stdout.push(`Bend radius metadata applied: ${stats.bendRadiusCount}`);
    }
    if (stats.suppressedFullBendCurveCount) {
      stdout.push(`Suppressed oversized CAESAR bend curves: ${stats.suppressedFullBendCurveCount}`);
    }
    if (Object.keys(stats.supportKindCounts || {}).length) {
      stdout.push(`Support kinds: ${JSON.stringify(stats.supportKindCounts)}`);
    }

    ctx.setStatus?.('Building 3D GLB scene...', 'running');
    const scene = buildExportScene(model, createSceneLog(stdout, stderr));
    const glbBlob = await exportSceneToGLB(scene);
    const arrayBuffer = await blobLikeToArrayBuffer(glbBlob);
    const stem = baseName(sourceName);

    const outputs = [{
      name: `${stem}.glb`,
      base64: arrayBufferToBase64(arrayBuffer),
      mime: 'model/gltf-binary',
    }];

    if ((ctx.options || {}).includeSidecarJson !== false) {
      outputs.push({
        name: `${stem}-glb-sidecar.json`,
        text: JSON.stringify({
          schema: 'inputxml-glb-sidecar/v1',
          source: sourceName,
          branches: extracted.branches,
          stats: {
            ...stats,
            bendMetadata,
            caesarSupportMetadata,
          },
          diagnostics: [...(extracted.diagnostics || []), ...(diagnostics || [])],
        }, null, 2),
        mime: 'application/json',
      });
    }

    ctx.setStatus?.(`Completed: ${outputs[0].name}`, 'ok');
    return {
      ok: true,
      outputs,
      logs: { stdout, stderr },
      diagnostics: [...(extracted.diagnostics || []), ...(diagnostics || [])],
    };
  } catch (error) {
    const message = error?.message || String(error);
    stderr.push(message);
    ctx.setStatus?.(`Failed: ${message}`, 'bad');
    return {
      ok: false,
      outputs: [],
      logs: { stdout, stderr },
      diagnostics: [{ type: 'inputxml-glb-runner-error', severity: 'ERROR', message }],
    };
  }
}
