// Registry entry for the "InputXML -> RVM (+ GLB)" converter.
//
// The RVM/parsing core lives under viewer/converters/inputxml-rvm/ as vendored,
// Rvmx-prefixed copies that import NO shared module (see that folder's README).
// This wrapper adds an OPTIONAL GLB companion so the same conversion is usable
// in two places:
//   - .rvm  -> Navisworks / AVEVA Review (desktop)
//   - .glb  -> the repo's in-browser viewer on GitHub Pages (static hosting)
//
// Keep the heavy/vendored RVM runner out of the Model Converters startup graph.
// GitHub Pages can transiently return 503 for one static module; if the runner is
// imported at top level, that single optional converter prevents the whole tab
// from rendering.  Load it only when the user runs InputXML -> RVM.
//
// The GLB is the only part that reaches for shared code (the three.js-based
// exporter under viewer/js/pcf2glb/glb/). It is loaded with a dynamic import
// inside try/catch so:
//   * the self-contained RVM path is never affected by it, and
//   * environments without three.js (e.g. Node tests) simply skip the GLB and
//     still get a valid RVM.
// The exporter performs no network fetches, so it is safe on static pages.

let inputXmlToRvmRunnerPromise = null;

async function runInputXmlToRvm(ctx) {
  try {
    if (!inputXmlToRvmRunnerPromise) {
      inputXmlToRvmRunnerPromise = import('../../../converters/inputxml-rvm/inputxml-to-rvm-runner.js?v=20260622-inputxml-rvm-lazy-1');
    }
    const module = await inputXmlToRvmRunnerPromise;
    if (typeof module?.run !== 'function') throw new Error('InputXML -> RVM runner did not export run().');
    return module.run(ctx);
  } catch (error) {
    // Allow a later click to retry after a transient GitHub Pages/module fetch
    // failure instead of pinning the rejected import promise for the session.
    inputXmlToRvmRunnerPromise = null;
    const message = error instanceof Error ? error.message : String(error);
    ctx?.setStatus?.(`Failed: ${message}`, 'error');
    return {
      ok: false,
      outputs: [],
      logs: {
        stdout: [],
        stderr: [`InputXML -> RVM runner could not be loaded: ${message}`],
      },
    };
  }
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
    warn(code, payload = {}) { stdout.push(`WARN ${code}: ${JSON.stringify(payload)}`); },
    error(code, payload = {}) { stderr.push(`ERROR ${code}: ${JSON.stringify(payload)}`); },
  };
}

export async function run(ctx = {}) {
  const result = await runInputXmlToRvm(ctx);
  const options = ctx.options || {};

  // Append a GLB companion for the in-browser viewer unless explicitly disabled.
  if (result.ok && options.includeGlb !== false && result.model && result.model.components?.length) {
    const stdout = result.logs?.stdout || (result.logs = { ...(result.logs || {}), stdout: [] }).stdout;
    const stderr = result.logs?.stderr || (result.logs.stderr = []);
    try {
      ctx.setStatus?.('Building GLB companion for the web viewer...', 'running');
      const [{ buildExportScene }, { exportSceneToGLB }] = await Promise.all([
        import('../../../js/pcf2glb/glb/buildExportScene.js'),
        import('../../../js/pcf2glb/glb/exportSceneToGLB.js'),
      ]);
      const scene = buildExportScene(result.model, createSceneLog(stdout, stderr), {
        glbVisualProfile: 'basic-only',
      });
      const glbBlob = await exportSceneToGLB(scene);
      const arrayBuffer = await blobLikeToArrayBuffer(glbBlob);
      result.outputs.push({
        name: `${result.stem}.glb`,
        base64: arrayBufferToBase64(arrayBuffer),
        mime: 'model/gltf-binary',
      });
      stdout.push(`GLB companion written: ${result.stem}.glb (${arrayBuffer.byteLength} bytes)`);
      ctx.setStatus?.(`Completed: ${result.outputs[0].name} (+ GLB)`, 'ok');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stdout.push(`GLB companion skipped: ${message} (three.js exporter unavailable in this context; the RVM output is unaffected).`);
    }
  }

  return result;
}
