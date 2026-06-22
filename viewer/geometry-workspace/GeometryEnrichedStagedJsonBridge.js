import { buildGeometryEnrichedStagedJson, downloadGeometryEnrichedStagedJson, GEOMETRY_ENRICHED_STAGEDJSON_SCHEMA, GEOMETRY_ENRICHED_STAGEDJSON_VERSION } from './GeometryEnrichedStagedJsonExporter.js?v=20260622-geometry-enriched-stagedjson-1';

const INSTALL_FLAG = Symbol.for('pcf-glb-geometry-enriched-stagedjson-bridge-v1');
let lastPayload = null;

function workspaceApi() {
  return globalThis.__PCF_GLB_GEOMETRY_EXPORT_WORKSPACE__ || null;
}

function workspaceState() {
  return workspaceApi()?.state?.() || {};
}

function activeIds(state) {
  return state.activeObjectIds instanceof Set ? state.activeObjectIds : new Set(state.activeObjectIds || []);
}

function candidateObjects() {
  const state = workspaceState();
  const active = activeIds(state);
  const enriched = Array.isArray(state.geometryEnrichedObjects) && state.geometryEnrichedObjects.length
    ? state.geometryEnrichedObjects
    : (Array.isArray(state.calculationResolvedObjects) ? state.calculationResolvedObjects : []);
  const mapped = Array.isArray(state.mapping?.mappedObjects) ? state.mapping.mappedObjects : [];
  const source = enriched.length ? enriched : mapped;
  return active.size ? source.filter((object) => active.has(object.sourceId || object.id)) : source;
}

function buildPayload() {
  const state = workspaceState();
  const objects = candidateObjects();
  lastPayload = buildGeometryEnrichedStagedJson(objects, {
    sourceMode: 'geometry-workspace-active-enriched-objects',
    masterSummary: state.enrichment?.resolution?.masterSummary || {},
  });
  if (state && typeof state === 'object') {
    state.enrichedStagedJson = lastPayload;
  }
  return lastPayload;
}

function exportPayload() {
  const payload = buildPayload();
  downloadGeometryEnrichedStagedJson(payload, 'geometry-enriched-stagedjson.json');
  return payload;
}

function injectToolbar(root) {
  const section = root?.querySelector?.('.geometry-export-workspace-tool-group');
  if (!section || section.querySelector('[data-geometry-enriched-stagedjson-export]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rvm-tool-btn';
  button.dataset.geometryEnrichedStagedjsonExport = 'true';
  button.title = 'Export active Geometry Workspace records as enriched stagedJSON with enrichment audit fields';
  button.innerHTML = '<span aria-hidden="true">EXPORT</span><span>StagedJSON</span>';
  section.querySelector('.rvm-ribbon-button-row')?.appendChild(button);
}

function attach() {
  const root = document.querySelector('[data-rvm-viewer]');
  if (!root) return false;
  injectToolbar(root);
  return true;
}

function onDocumentClick(event) {
  if (!event.target?.closest?.('[data-geometry-enriched-stagedjson-export]')) return;
  event.preventDefault();
  event.stopPropagation();
  const payload = exportPayload();
  const status = document.querySelector('[data-rvm-viewer] #rvm-sb-msg');
  if (status) status.textContent = `Enriched stagedJSON exported: ${payload.source.objectCount} object(s), ${payload.source.enrichedCount} enriched.`;
}

export function installGeometryEnrichedStagedJsonBridge() {
  if (typeof document === 'undefined') return;
  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;
  document.addEventListener('click', onDocumentClick, true);
  let attempts = 0;
  const waitAttach = () => { attempts += 1; if (!attach() && attempts < 180) setTimeout(waitAttach, 300); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitAttach, { once: true });
  else waitAttach();
  globalThis.addEventListener?.('rvm-model-loaded', () => setTimeout(waitAttach, 320));
  globalThis.__PCF_GLB_GEOMETRY_ENRICHED_STAGEDJSON__ = {
    version: GEOMETRY_ENRICHED_STAGEDJSON_VERSION,
    schema: GEOMETRY_ENRICHED_STAGEDJSON_SCHEMA,
    build: buildPayload,
    export: exportPayload,
    lastPayload: () => lastPayload,
  };
}
