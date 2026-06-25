import { resolveNodeMarkersFromSource } from './NodeMarkerResolver.js';
import {
  buildNodeMarkerBranchRows,
  buildNodeMarkerCoordinateRows,
  buildNodeMarkerCsvForXmlCii,
  buildNodeMarkerDtxrRows,
  buildNodeMarkerRestraintRows,
  buildNodeMarkerWeightRows,
  buildNodeMarkerXmlCiiTables,
} from './NodeMarkerXmlCiiTableMapper.js';
import { stableHash } from './NodeMarkerDiagnostics.js';

export const NODE_MARKER_API_SCHEMA = 'non-primitive-node-marker-api/v1';
const GLOBAL_KEY = 'rvmNodeMarkers';
let lastBuild = null;

export function buildNodeMarkersFromSource(source, options = {}) {
  lastBuild = resolveNodeMarkersFromSource(source, options);
  lastBuild.tables = buildNodeMarkerXmlCiiTables(lastBuild.markers, { ...options, ...lastBuild.diagnostics });
  lastBuild.exportStatus = lastBuild.markers.some((marker) => marker.status === 'stale') ? 'stale' : 'fresh';
  return lastBuild;
}

export function buildNodeMarkerXmlCiiTablesFromSource(source, options = {}) {
  return buildNodeMarkersFromSource(source, options).tables;
}

export function buildNodeMarkerXmlCiiTablesFromMarkers(markers, options = {}) {
  return buildNodeMarkerXmlCiiTables(markers, options);
}

export function buildNodeMarkerJson(markersOrTables, options = {}) {
  const payload = Array.isArray(markersOrTables)
    ? { schema: 'non-primitive-node-marker-json/v1', markers: markersOrTables, tables: buildNodeMarkerXmlCiiTables(markersOrTables, options) }
    : { schema: 'non-primitive-node-marker-json/v1', tables: markersOrTables };
  payload.generatedAt = options.generatedAt || new Date(0).toISOString();
  payload.payloadHash = stableHash(payload);
  return payload;
}

export function getDiagnostics() { return lastBuild?.diagnostics || null; }
export function getLastBuild() { return lastBuild; }

export function installNodeMarkerApi(target = globalThis) {
  if (!target) return null;
  if (target[GLOBAL_KEY]?.schema === NODE_MARKER_API_SCHEMA) return target[GLOBAL_KEY];
  const api = {
    schema: NODE_MARKER_API_SCHEMA,
    buildNodeMarkersFromSource,
    buildNodeMarkerXmlCiiTablesFromSource,
    buildNodeMarkerXmlCiiTablesFromMarkers,
    buildNodeMarkerBranchRows,
    buildNodeMarkerCoordinateRows,
    buildNodeMarkerWeightRows,
    buildNodeMarkerRestraintRows,
    buildNodeMarkerDtxrRows,
    buildNodeMarkerCsvForXmlCii,
    buildNodeMarkerJson,
    getDiagnostics,
    getLastBuild,
    installNodeMarkerApi,
  };
  target[GLOBAL_KEY] = api;
  return api;
}

installNodeMarkerApi(typeof window !== 'undefined' ? window : globalThis);

export { buildNodeMarkerCsvForXmlCii };
