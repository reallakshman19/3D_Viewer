import { AvevaJsonLoader } from './AvevaJsonLoader.js';
import { parseRvmArrayBuffer } from './BrowserRvmHierarchyParser.js';
import { enrichBrowserRvmHierarchyWithAtt } from './BrowserRvmAttEnricher.js';
import { buildResponsiveBrowserRvmRenderSceneFromHierarchy } from './BrowserRvmResponsiveRenderSceneBuilder.js';

const RVM_BROWSER_PARSE_DIAGNOSTICS = Symbol.for('pcf-glb-rvm-browser-parse-diagnostics-v1');
const MANIFEST_NODE_LIMIT = 900;
const DEFAULT_RENDER_BUDGET = Object.freeze({
  maxRenderableObjects: 2400,
  batchSize: 48,
  timeSliceMs: 10
});

export async function loadRvmFileInBrowser(file, viewer, options = {}) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('RVM File object is required');
  const statusEl = options.statusEl || null;
  const update = (text) => { if (statusEl) statusEl.textContent = text; };
  update(`Scanning ${file.name} in browser`);

  await yieldToBrowser();
  const arrayBuffer = await file.arrayBuffer();
  const attText = options.attText || '';
  const parsed = await parseWithWorkerIfAvailable(arrayBuffer, {
    fileName: file.name,
    attText,
    maxStringScanBytes: options.maxStringScanBytes
  });

  await yieldToBrowser();
  const attEnrichment = enrichBrowserRvmHierarchyWithAtt(parsed.hierarchy || [], attText);
  parsed.hierarchy = attEnrichment.hierarchy;
  parsed.diagnostics = {
    ...(parsed.diagnostics || {}),
    browserRvmAtt: attEnrichment.diagnostics
  };

  const renderBudget = normalizeRenderBudget(options);
  update(`Building responsive RVM render scene for ${file.name}`);
  await yieldToBrowser();
  const renderResult = await buildResponsiveBrowserRvmRenderSceneFromHierarchy(parsed.hierarchy, {
    name: `BrowserRvmRenderScene:${file.name || 'model.rvm'}`,
    ...(options.renderOptions || {}),
    ...renderBudget,
    onProgress: ({ processed, total, renderableCount }) => {
      update(`Building RVM scene ${processed}/${total}${Number.isFinite(renderableCount) ? ` (${renderableCount} drawn)` : ''}`);
    }
  });
  const shouldUseRenderScene = Boolean(renderResult?.scene && renderResult.diagnostics?.renderableCount > 0);

  let payload = null;
  let hierarchyScene = null;
  let activeScene = renderResult?.scene || null;
  let usedDeferredHierarchyFallback = false;

  if (shouldUseRenderScene && options.buildHierarchyFallback !== true) {
    usedDeferredHierarchyFallback = true;
    payload = makeRenderScenePayload(file, parsed.hierarchy, renderResult, attEnrichment.diagnostics);
  } else {
    update(`Building hierarchy fallback scene for ${file.name}`);
    await yieldToBrowser();
    const loader = new AvevaJsonLoader();
    payload = await loader.load(parsed.hierarchy, {}, options.asyncSession || makeAsyncSession(statusEl));
    if (!payload?.gltf?.scene) throw new Error('Browser RVM fallback produced no scene.');
    hierarchyScene = payload.gltf.scene;
    activeScene = shouldUseRenderScene ? renderResult.scene : hierarchyScene;
  }

  const diagnostics = publishBrowserRvmLoadDiagnostics({
    ...(parsed.diagnostics || {}),
    browserRvmRenderSceneEnabled: shouldUseRenderScene,
    browserRvmRenderSchemaVersion: renderResult?.schemaVersion || '',
    browserRvmRenderableCount: renderResult?.diagnostics?.renderableCount || 0,
    browserRvmSkippedCount: renderResult?.diagnostics?.skippedCount || 0,
    browserRvmRenderPrimitiveCounts: renderResult?.diagnostics?.primitiveCounts || {},
    browserRvmRenderSkippedReasons: renderResult?.diagnostics?.skippedReasons || {},
    browserRvmHierarchyFallbackDeferred: usedDeferredHierarchyFallback,
    browserRvmResponsiveLoadPath: shouldUseRenderScene ? 'responsive-render-scene-first' : 'hierarchy-fallback',
    browserRvmResponsiveSceneBuilder: true,
    browserRvmRenderBudgeted: Boolean(renderResult?.diagnostics?.budgeted),
    browserRvmMaxRenderableObjects: renderBudget.maxRenderableObjects,
    browserRvmRenderBudgetSkipped: renderResult?.diagnostics?.skippedReasons?.['render-budget-limit'] || 0,
    browserRvmManifestNodeLimit: MANIFEST_NODE_LIMIT
  }, file.name);

  payload.browserRvmParser = diagnostics;
  payload.browserRvmAtt = attEnrichment.diagnostics;
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
    browserRvmAtt: attEnrichment.diagnostics,
    browserRvmRender: renderResult?.diagnostics || null,
    browserRvmRenderScene: {
      enabled: shouldUseRenderScene,
      schemaVersion: renderResult?.schemaVersion || '',
      renderableCount: renderResult?.diagnostics?.renderableCount || 0,
      skippedCount: renderResult?.diagnostics?.skippedCount || 0,
      hierarchyFallbackDeferred: usedDeferredHierarchyFallback,
      responsiveBuilder: true,
      budgeted: Boolean(renderResult?.diagnostics?.budgeted),
      renderBudgetSkipped: renderResult?.diagnostics?.skippedReasons?.['render-budget-limit'] || 0,
      maxRenderableObjects: renderBudget.maxRenderableObjects
    }
  };

  activeScene.userData = {
    ...(activeScene.userData || {}),
    browserRvmLiveRenderScene: shouldUseRenderScene,
    browserRvmParser: diagnostics,
    browserRvmAtt: attEnrichment.diagnostics,
    browserRvmRender: renderResult?.diagnostics || null,
    browserRvmResponsiveSceneBuilder: true
  };

  if (viewer) {
    update(`Committing RVM scene ${file.name}`);
    await yieldToBrowser();
    viewer.ctx.identityMap = payload.identityMap || new Map();
    viewer.setModel(activeScene, payload.manifest?.runtime?.upAxis || 'Z');
    await yieldToBrowser();
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

function makeRenderScenePayload(file, hierarchy, renderResult, attDiagnostics) {
  const nodes = flattenHierarchyForManifest(hierarchy);
  return {
    gltf: { scene: renderResult.scene },
    identityMap: new Map(),
    manifest: {
      runtime: { upAxis: 'Z' },
      source: {
        format: 'RVM_BINARY_BROWSER_FALLBACK',
        files: [file.name]
      },
      nodes,
      browserRvmAtt: attDiagnostics,
      browserRvmRender: renderResult?.diagnostics || null,
      browserRvmResponsiveLoadPath: 'responsive-render-scene-first',
      browserRvmManifestNodeLimit: MANIFEST_NODE_LIMIT
    }
  };
}

function flattenHierarchyForManifest(roots = []) {
  const nodes = [];
  const visit = (node, parentCanonicalObjectId = '', depth = 0) => {
    if (!node || typeof node !== 'object' || nodes.length >= MANIFEST_NODE_LIMIT) return;
    const canonicalObjectId = String(node.canonicalObjectId || node.id || node.name || `browser-rvm-${nodes.length}`);
    nodes.push({
      canonicalObjectId,
      parentCanonicalObjectId,
      sourceObjectId: node.sourceObjectId || node.id || canonicalObjectId,
      name: node.name || canonicalObjectId,
      kind: node.kind || node.type || node.attributes?.TYPE || 'NODE',
      type: node.type || node.kind || node.attributes?.TYPE || 'NODE',
      depth,
      attributes: node.attributes && typeof node.attributes === 'object' ? node.attributes : {}
    });
    for (const child of Array.isArray(node.children) ? node.children : []) {
      visit(child, canonicalObjectId, depth + 1);
      if (nodes.length >= MANIFEST_NODE_LIMIT) break;
    }
  };
  for (const root of Array.isArray(roots) ? roots : []) {
    visit(root, '', 0);
    if (nodes.length >= MANIFEST_NODE_LIMIT) break;
  }
  return nodes;
}

function normalizeRenderBudget(options = {}) {
  const renderOptions = options.renderOptions || {};
  return {
    maxRenderableObjects: positiveInteger(options.maxRenderableObjects ?? renderOptions.maxRenderableObjects, DEFAULT_RENDER_BUDGET.maxRenderableObjects),
    batchSize: positiveInteger(options.batchSize ?? renderOptions.batchSize, DEFAULT_RENDER_BUDGET.batchSize),
    timeSliceMs: positiveNumber(options.timeSliceMs ?? renderOptions.timeSliceMs, DEFAULT_RENDER_BUDGET.timeSliceMs)
  };
}

function positiveInteger(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function positiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function yieldToBrowser() {
  if (typeof requestIdleCallback === 'function') {
    return new Promise((resolve) => requestIdleCallback(() => resolve(), { timeout: 120 }));
  }
  if (typeof requestAnimationFrame === 'function') {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
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
