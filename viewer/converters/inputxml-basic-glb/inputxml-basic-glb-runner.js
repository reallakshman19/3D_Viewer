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
  const bytes = new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer ?? buffer);
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function run(ctx = {}) {
  const stdout = [], stderr = [];
  const file = (ctx.inputFiles || []).find((entry) => entry?.role === 'primary') || ctx.inputFiles?.[0];
  const sourceName = file?.name || 'input.xml';
  const options = { ...(ctx.options || {}) };
  try {
    if (!file) throw new Error('Select a primary Input XML file first.');
    ctx.setStatus?.('Reading InputXML for Basic GLB...', 'running');
    const xmlText = await readFileText(file);
    if (!xmlText.trim()) throw new Error('File is empty or could not be read.');
    const outputs = [];
    const stem = baseName(sourceName);
    ctx.setStatus?.('Building InputXML GLB scene...', 'running');
    try {
      const { convertInputXmlToGlb } = await import('./InputXmlBasicSceneBuilder.js');
      const result = await convertInputXmlToGlb(xmlText, options);
      const glbBuffer = result.glb instanceof ArrayBuffer ? result.glb : await result.glb?.arrayBuffer?.() ?? result.glb;
      outputs.push({ name: `${stem}-basic.glb`, base64: arrayBufferToBase64(glbBuffer), mime: 'model/gltf-binary' });
      stdout.push(`Converted: components=${result.audit.componentCount}, nodes=${result.audit.nodeCount}, supportSymbols=${result.audit.supportSymbols.length}, isonoteRecords=${result.audit.isonoteRecords}`);
      if (options.includeSidecarJson !== false) {
        outputs.push({ name: `${stem}-basic-glb-sidecar.json`, text: JSON.stringify({ schema: 'inputxml-basic-glb-sidecar/v1', source: sourceName, converter: 'InputXML→Basic GLB', ...result.audit }, null, 2), mime: 'application/json' });
      }
    } catch (glbError) {
      stdout.push(`Basic GLB skipped (three.js unavailable): ${glbError?.message || glbError}`);
    }
    ctx.setStatus?.(`Completed: ${outputs[0]?.name || stem}`, 'ok');
    return { ok: true, outputs, logs: { stdout, stderr } };
  } catch (error) {
    const message = error?.message || String(error);
    stderr.push(message);
    ctx.setStatus?.(`Failed: ${message}`, 'bad');
    return { ok: false, outputs: [], logs: { stdout, stderr }, diagnostics: [{ severity: 'ERROR', message }] };
  }
}
