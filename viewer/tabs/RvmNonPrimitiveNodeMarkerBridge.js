import {
  buildNodeMarkerCsvForXmlCii,
  buildNodeMarkerJson,
  buildNodeMarkersFromSource,
  evaluateNodeMarkerStaleness,
} from '../overlays/nodes/NodeMarkerApi.js';
import { attachNodeMarkerGlyphs, clearNodeMarkerGlyphRoot } from '../overlays/nodes/NodeMarkerGlyphGeometry.js';
import * as NodeMarkerSourceTools from './RvmNonPrimitiveNodeMarkerSourceToolsBridge.js';
import { ensureNodeMarkerHover, installRvmNonPrimitiveNodeMarkerHoverBridge } from './RvmNonPrimitiveNodeMarkerHoverBridge.js';

export const RVM_NON_PRIMITIVE_NODE_MARKER_BRIDGE_SCHEMA = 'rvm-non-primitive-node-marker-bridge/v2';

const GLOBAL_KEY = '__PCF_GLB_RVM_NON_PRIMITIVE_NODE_MARKERS__';
const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-non-primitive-node-marker-bridge-v2');

export function installRvmNonPrimitiveNodeMarkerBridge() {
  if (globalThis[INSTALL_FLAG] && globalThis[GLOBAL_KEY]) return globalThis[GLOBAL_KEY];
  globalThis[INSTALL_FLAG] = true;
  NodeMarkerSourceTools.installRvmNonPrimitiveNodeMarkerSourceToolsBridge();
  installRvmNonPrimitiveNodeMarkerHoverBridge();
  const api = {
    schema: RVM_NON_PRIMITIVE_NODE_MARKER_BRIDGE_SCHEMA,
    applyFromSource,
    rebuild,
    clear,
    getMarkers,
    getXmlCiiTables,
    getCsv,
    getJson,
    getDiagnostics,
    getStaleStatus,
  };
  globalThis[GLOBAL_KEY] = api;
  return api;
}

export function applyFromSource({ viewer = globalThis.__3D_RVM_VIEWER__, source, sourceKind = 'json', fileName = '', options = {} } = {}) {
  if (!viewer || !source) return clear(viewer, 'missing-viewer-or-source');
  const build = buildNodeMarkersFromSource(source, { sourceKind, sourceFile: fileName, ...options });
  viewer.nonPrimitiveNodeMarkerBuild = build;
  viewer.nonPrimitiveNodeMarkers = build.markers || [];
  viewer.nonPrimitiveNodeMarkerTables = build.tables || null;
  viewer.nonPrimitiveNodeMarkerDiagnostics = build.diagnostics || null;
  viewer.nonPrimitiveNodeMarkerExportStatus = build.exportStatus || 'fresh';
  attachNodeMarkerGlyphs(viewer, build.markers || [], { sourceKind, sourceFile: fileName, radius: options.glyphRadius });
  ensureNodeMarkerHover(viewer);
  scheduleSourceToolsSync(viewer);
  return build;
}

export function rebuild(viewer = globalThis.__3D_RVM_VIEWER__, reason = 'manual-rebuild') {
  const model = viewer?.modelGroup || viewer?.scene || null;
  const userData = model?.userData || {};
  const source = userData.__rvmNonPrimitiveSourceHierarchy || userData.__rvmNonPrimitiveAutoBendSourceHierarchy || null;
  const sourceKind = userData.__rvmNonPrimitiveSourceKind || userData.__rvmNonPrimitiveAutoBendSourceKind || viewer?.sourceKind || 'json';
  return applyFromSource({ viewer, source, sourceKind, fileName: userData.fileName || '', options: { reason } });
}

export function clear(viewer = globalThis.__3D_RVM_VIEWER__, reason = 'clear-node-marker-runtime') {
  if (viewer) {
    viewer.nonPrimitiveNodeMarkerBuild = null;
    viewer.nonPrimitiveNodeMarkers = [];
    viewer.nonPrimitiveNodeMarkerTables = null;
    viewer.nonPrimitiveNodeMarkerDiagnostics = { schema: 'non-primitive-node-marker-clear/v1', status: 'cleared', reason };
    viewer.nonPrimitiveNodeMarkerExportStatus = 'blocked';
  }
  clearNodeMarkerGlyphRoot(viewer, reason);
  globalThis.__PCF_GLB_RVM_NON_PRIMITIVE_NODE_MARKER_HOVER__?.clear?.(viewer, reason);
  NodeMarkerSourceTools.clear(viewer, reason);
  return { schema: 'non-primitive-node-marker-clear/v1', status: 'cleared', reason };
}

export function getMarkers(viewer = globalThis.__3D_RVM_VIEWER__) {
  return viewer?.nonPrimitiveNodeMarkers || [];
}

export function getXmlCiiTables(viewer = globalThis.__3D_RVM_VIEWER__) {
  return viewer?.nonPrimitiveNodeMarkerTables || null;
}

export function getCsv(viewer = globalThis.__3D_RVM_VIEWER__) {
  const tables = getXmlCiiTables(viewer);
  return tables ? buildNodeMarkerCsvForXmlCii(tables) : '';
}

export function getJson(viewer = globalThis.__3D_RVM_VIEWER__) {
  return buildNodeMarkerJson(viewer?.nonPrimitiveNodeMarkers || [], { generatedAt: new Date(0).toISOString() });
}

export function getDiagnostics(viewer = globalThis.__3D_RVM_VIEWER__) {
  return viewer?.nonPrimitiveNodeMarkerDiagnostics || null;
}

export function getStaleStatus(viewer = globalThis.__3D_RVM_VIEWER__) {
  const model = viewer?.modelGroup || viewer?.scene || null;
  const userData = model?.userData || {};
  const source = userData.__rvmNonPrimitiveSourceHierarchy || userData.__rvmNonPrimitiveAutoBendSourceHierarchy || null;
  if (!source) return { schema: 'non-primitive-node-marker-stale/v1', status: 'blocked', staleReason: 'missing-source' };
  return evaluateNodeMarkerStaleness(source, {
    sourceKind: userData.__rvmNonPrimitiveSourceKind || userData.__rvmNonPrimitiveAutoBendSourceKind || viewer?.sourceKind || 'json',
    sourceFile: userData.fileName || '',
  }, viewer?.nonPrimitiveNodeMarkerBuild || null);
}

function scheduleSourceToolsSync(viewer) {
  const run = () => NodeMarkerSourceTools.sync(viewer);
  try {
    if (typeof globalThis.queueMicrotask === 'function') globalThis.queueMicrotask(run);
    else setTimeout(run, 0);
  } catch (_) {}
}
