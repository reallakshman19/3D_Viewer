import { parseInputXmlBasic } from './InputXmlBasicParser.js';

function text(value) { return String(value ?? '').trim(); }
async function readFileText(file) {
  if (typeof file?.text === 'string') return file.text;
  if (file?.bytes instanceof Uint8Array) return new TextDecoder('utf-8').decode(file.bytes);
  if (file?.bytes instanceof ArrayBuffer) return new TextDecoder('utf-8').decode(new Uint8Array(file.bytes));
  if (typeof file?.file?.text === 'function') return file.file.text();
  if (typeof file?.text === 'function') return file.text();
  return '';
}
function baseName(name) { const normalized = text(name) || 'inputxml-basic-model'; return normalized.replace(/\.[^.]+$/, '') || 'inputxml-basic-model'; }
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
async function blobLikeToArrayBuffer(value) {
  if (value instanceof ArrayBuffer) return value;
  if (value?.buffer instanceof ArrayBuffer && value?.byteLength !== undefined) return value.buffer.slice(value.byteOffset || 0, (value.byteOffset || 0) + value.byteLength);
  if (typeof value?.arrayBuffer === 'function') return value.arrayBuffer();
  throw new Error('Basic GLB exporter did not return Blob or ArrayBuffer output.');
}
function parseBoolean(value, fallback = true) { if (value === undefined || value === null || value === '') return fallback; if (typeof value === 'boolean') return value; return !/^(false|0|no|off)$/i.test(String(value)); }
function normalizeOptions(options = {}) { return { includeSupports: parseBoolean(options.includeSupports, true), includeNodeMarkers: parseBoolean(options.includeNodeMarkers, true), includeSidecarJson: parseBoolean(options.includeSidecarJson, true) }; }

export async function run(ctx = {}) {
  const stdout = [], stderr = [];
  const file = (ctx.inputFiles || []).find((entry) => entry?.role === 'primary') || ctx.inputFiles?.[0];
  const sourceName = file?.name || 'input.xml';
  const options = normalizeOptions(ctx.options || {});
  try {
    if (!file) throw new Error('Select a primary Input XML file first.');
    ctx.setStatus?.('Reading InputXML for Basic GLB...', 'running');
    const xmlText = await readFileText(file);
    const model = parseInputXmlBasic(xmlText, { sourceName });
    const errors = (model.diagnostics || []).filter((item) => item.severity === 'ERROR');
    if (errors.length) throw new Error(errors.map((item) => item.message).join('\n'));
    if (!model.elements.length) throw new Error('No drawable PIPINGELEMENT records were found.');
    stdout.push(`InputXML Basic GLB elements: ${model.stats.elementCount}`);
    stdout.push(`InputXML Basic GLB nodes: ${model.stats.nodeCount}`);
    stdout.push(`InputXML Basic GLB supports: ${model.stats.supportCount}`);
    stdout.push(`InputXML Basic GLB component types: ${JSON.stringify(model.stats.typeCounts)}`);
    if (model.stats.supportCount) stdout.push(`InputXML Basic GLB support kinds: ${JSON.stringify(model.stats.supportKindCounts)}`);
    const outputs = [];
    const stem = baseName(sourceName);
    ctx.setStatus?.('Building independent Basic GLB scene...', 'running');
    try {
      const [{ buildInputXmlBasicScene }, { exportInputXmlBasicSceneToGlb }] = await Promise.all([
        import('./InputXmlBasicSceneBuilder.js'),
        import('./InputXmlBasicGlbExporter.js'),
      ]);
      const scene = buildInputXmlBasicScene(model, options);
      ctx.setStatus?.('Exporting Basic GLB...', 'running');
      const arrayBuffer = await blobLikeToArrayBuffer(await exportInputXmlBasicSceneToGlb(scene));
      outputs.push({ name: `${stem}-basic.glb`, base64: arrayBufferToBase64(arrayBuffer), mime: 'model/gltf-binary' });
    } catch (glbError) {
      stdout.push(`Basic GLB skipped (three.js unavailable): ${glbError?.message || glbError}`);
    }
    if (options.includeSidecarJson !== false) outputs.push({ name: `${stem}-basic-glb-sidecar.json`, text: JSON.stringify({ schema: 'inputxml-basic-glb-sidecar/v1', source: sourceName, converter: 'Model converter > InputXML -> Basic GLB', independentPath: true, options, stats: model.stats, diagnostics: model.diagnostics, nodes: model.nodes, elements: model.elements.map((e) => ({ id: e.id, index: e.index, fromNode: e.fromNode, toNode: e.toNode, type: e.type, diameter: e.diameter, start: e.start, end: e.end })), supports: model.supports }, null, 2), mime: 'application/json' });
    ctx.setStatus?.(`Completed: ${outputs[0]?.name || stem}`, 'ok');
    return { ok: true, outputs, logs: { stdout, stderr }, diagnostics: model.diagnostics };
  } catch (error) {
    const message = error?.message || String(error);
    stderr.push(message);
    ctx.setStatus?.(`Failed: ${message}`, 'bad');
    return { ok: false, outputs: [], logs: { stdout, stderr }, diagnostics: [{ type: 'inputxml-basic-glb-runner-error', severity: 'ERROR', message }] };
  }
}
