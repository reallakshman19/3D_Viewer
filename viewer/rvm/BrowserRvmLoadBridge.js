import { AvevaJsonLoader } from './AvevaJsonLoader.js';
import { parseRvmArrayBuffer } from './BrowserRvmHierarchyParser.js';
import { buildBrowserRvmRenderSceneFromHierarchy } from './BrowserRvmRenderSceneBuilder.js';

const RVM_BROWSER_PARSE_DIAGNOSTICS = Symbol.for('pcf-glb-rvm-browser-parse-diagnostics-v1');

export async function loadRvmFileInBrowser(file, viewer, options = {}) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('RVM File object is required');
  const statusEl = options.statusEl || null;
  const update = (text) => { if (statusEl) statusEl.textContent = text; };
  update(`Scanning ${file.name} in browser`);

  const arrayBuffer = await file.arrayBuffer();
  const attText = options.attText || '';
  const parsed = await parseWithWorkerIfAvailable(arrayBuffer, {
    fileName: file.name,
    attText,
    maxStringScanBytes: options.maxStringScanBytes
  });

  update(`Building partial RVM scene for ${file.name}`);
  const loader = new AvevaJsonLoader();
  const payload = await loader.load(parsed.hierarchy, {}, options.asyncSession || makeAsyncSession(statusEl));
  if (!payload?.gltf?.scene) throw new Error('Browser RVM fallback produced no scene.');

  const renderResult = buildBrowserRvmRenderSceneFromHierarchy(parsed.hierarchy, {
    name: `BrowserRvmRenderScene:${file.name || 'model.rvm'}`
  });
  const shouldUseRenderScene = Boolean(renderResult?.scene && renderResult.diagnostics?.renderableCount > 0);
  const hierarchyScene = payload.gltf.scene;
  const activeScene = shouldUseRenderScene ? renderResult.scene : hierarchyScene;
  const diagnostics = publishBrowserRvmLoadDiagnostics({
    ...(parsed.diagnostics || {}),
    browserRvmRenderSceneEnabled: shouldUseRenderScene,
    browserRvmRenderSchemaVersion: renderResult?.schemaVersion || '',
    browserRvmRenderableCount: renderResult?.diagnostics?.renderableCount || 0,
    browserRvmSkippedCount: renderResult?.diagnostics?.skippedCount || 0,
    browserRvmRenderPrimitiveCounts: renderResult?.diagnostics?.primitiveCounts || {},
    browserRvmRenderSkippedReasons: renderResult?.diagnostics?.skippedReasons || {},
  }, file.name);

  payload.browserRvmParser = diagnostics;
  payload.browserRvmRender = renderResult?.diagnostics || null;
  payload.browserRvmRenderInstructions = renderResult?.instructionSet || null;
  payload.browserRvmHierarchyScene = hierarchyScene;
  payload.gltf.scene = activeScene;
  payload.manifest = {
    ...(payload.manifest || {}),
    source: {
      ...((payload.manifest || {}).source || {}),
      format: 'RVM_BINARY_BROWSER_FALLBACK',
      files: [file.name]
    },
    browserRvmParser: diagnostics,
    browserRvmRender: renderResult?.diagnostics || null,
    browserRvmRenderScene: {
      enabled: shouldUseRenderScene,
      schemaVersion: renderResult?.schemaVersion || '',
      renderableCount: renderResult?.diagnostics?.renderableCount || 0,
      skippedCount: renderResult?.diagnostics?.skippedCount || 0
    }
  };

  activeScene.userData = {
    ...(activeScene.userData || {}),
    browserRvmLiveRenderScene: shouldUseRenderScene,
    browserRvmParser: diagnostics,
    browserRvmRender: renderResult?.diagnostics || null
  };

  if (viewer) {
    viewer.ctx.identityMap = payload.identityMap;
    viewer.setModel(activeScene, payload.manifest?.runtime?.upAxis || 'Z');
  }
  return payload;
}

export function publishBrowserRvmLoadDiagnostics(diagnostics = {}, fileName = '') {
  const payload = {
    ...(diagnostics && typeof diagnostics === 'object' ? diagnostics : {}),
    fileName: fileName || diagnostics.fileName || '',
    capturedAt: new Date().toISOString(),
  };
  globalThis[RVM_BROWSER_PARSE_DIAGNOSTICS] = payload;
  globalThis.__PCF_GLB_RVM_BROWSER_PARSE_DIAGNOSTICS__ = payload;
  try {
    globalThis.dispatchEvent?.(new CustomEvent('rvm-browser-parse-diagnostics', { detail: payload }));
  } catch (_) {}
  return payload;
}

async function parseWithWorkerIfAvailable(arrayBuffer, options) {
  if (typeof Worker !== 'function' || typeof URL !== 'function') {
    return parseRvmArrayBuffer(arrayBuffer, options);
  }
  try {
    const workerUrl = new URL('./browser-rvm-worker.js', import.meta.url);
    const worker = new Worker(workerUrl, { type: 'module' });
    const id = `rvm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error('Browser RVM worker timed out'));
      }, 45_000);
      worker.onmessage = (event) => {
        const msg = event.data || {};
        if (msg.id !== id) return;
        clearTimeout(timer);
        worker.terminate();
        if (msg.ok) resolve(msg.result);
        else reject(new Error(msg.error?.message || 'Browser RVM worker failed'));
      };
      worker.onerror = (error) => {
        clearTimeout(timer);
        worker.terminate();
        reject(new Error(error?.message || 'Browser RVM worker error'));
      };
      worker.postMessage({ id, arrayBuffer, options }, [arrayBuffer]);
    });
  } catch {
    return parseRvmArrayBuffer(arrayBuffer, options);
  }
}

function makeAsyncSession(statusEl) {
  let stale = false;
  return {
    update(stage, percent) { if (statusEl) statusEl.textContent = `${stage} ${Number.isFinite(percent) ? `${percent}%` : ''}`.trim(); },
    complete() { if (statusEl) statusEl.textContent = 'Loaded browser RVM fallback'; },
    cancel() { stale = true; },
    isStale() { return stale; },
    isCancelled() { return stale; }
  };
}
