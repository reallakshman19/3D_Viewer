// Workspace package exporter: creates the versioned JSON handoff contract used
// by Simplified Analysis without depending on either app's runtime internals.

import { isPipeLikeType, isSupportLikeType, summarizeEnrichmentObjects } from './selected-geometry-diagnostics.js';
import { cloneSafe, freezeDeep, normalizeKey, stableHash, text } from './selected-geometry-shared.js';
import { normalizeAxisTransform } from './selected-geometry-scope.js';
import { normalizeMasters } from './selected-geometry-enrichment.js';

export const RVM_SELECTED_GEOMETRY_WORKSPACE_PACKAGE_SCHEMA = 'rvm-selected-geometry-workspace-package/v1';
export const PENDING_WORKSPACE_PACKAGE_STORAGE_KEY = 'rvmSelectedGeometryWorkspacePackage.pending';

export function buildSelectedGeometryWorkspacePackage(input) {
  const options = input && typeof input === 'object' ? input : {};
  const scope = options.scope && typeof options.scope === 'object' ? options.scope : {};
  const objects = Array.isArray(options.objects)
    ? options.objects
    : Array.isArray(scope.objects)
      ? scope.objects
      : [];
  const masters = normalizeMasters(options.masters);
  const enrichmentSummary = summarizeEnrichmentObjects(objects);
  const source = options.source && typeof options.source === 'object' ? options.source : {};
  const capturedAt = text(source.capturedAt || scope.capturedAt) || new Date().toISOString();
  return freezeDeep({
    schema: RVM_SELECTED_GEOMETRY_WORKSPACE_PACKAGE_SCHEMA,
    source: {
      app: '3D_Viewer',
      sourceModelName: text(source.sourceModelName || source.modelName),
      sourceFileName: text(source.sourceFileName || source.fileName),
      scopeMode: text(source.scopeMode || scope.scopeMode || 'selected'),
      capturedAt,
    },
    axisTransform: normalizeAxisTransform(options.axisTransform || scope.axisTransform),
    geometry: {
      objects: cloneSafe(objects),
      supports: cloneSafe(objects.filter((object) => isSupportLikeType(object?.type))),
      branches: cloneSafe(collectBranches(objects)),
    },
    enrichment: {
      masters: {
        lineListVersion: masters.versions.lineListVersion,
        pipingClassVersion: masters.versions.pipingClassVersion,
        materialMapVersion: masters.versions.materialMapVersion,
        weightMasterVersion: masters.versions.weightMasterVersion,
      },
      stats: {
        objects: enrichmentSummary.objects,
        resolved: enrichmentSummary.resolved,
        conflicts: enrichmentSummary.conflicts,
        missing: enrichmentSummary.missing,
        approximate: enrichmentSummary.approximate,
      },
      diagnostics: enrichmentSummary.diagnostics,
    },
    packageHash: stableHash(JSON.stringify({
      schema: RVM_SELECTED_GEOMETRY_WORKSPACE_PACKAGE_SCHEMA,
      capturedAt,
      objectIds: objects.map((object) => object?.id),
    })),
  });
}

export function selectedGeometryWorkspacePackageFileName(input) {
  const source = input && typeof input === 'object' ? input : {};
  const name = safeFilePart(source.sourceFileName || source.sourceModelName || source.source || 'rvm');
  const scope = safeFilePart(source.scopeMode || 'selected');
  return `${name}_${scope}_rvm_enriched_workspace_package.json`;
}

export function serializeSelectedGeometryWorkspacePackage(packageJson) {
  return JSON.stringify(packageJson || {}, null, 2);
}

export function writePendingWorkspacePackageToStorage(packageJson, storage) {
  const target = storage || globalThis.sessionStorage || globalThis.localStorage || null;
  if (!target?.setItem) {
    return freezeDeep({ status: 'unavailable', key: PENDING_WORKSPACE_PACKAGE_STORAGE_KEY });
  }
  const textPayload = serializeSelectedGeometryWorkspacePackage(packageJson);
  target.setItem(PENDING_WORKSPACE_PACKAGE_STORAGE_KEY, textPayload);
  return freezeDeep({ status: 'written', key: PENDING_WORKSPACE_PACKAGE_STORAGE_KEY, bytes: textPayload.length });
}

function collectBranches(objects) {
  const map = new Map();
  for (const object of objects) {
    if (!isPipeLikeType(object?.type)) continue;
    const enrichment = object?.attributes?.enrichment || {};
    const lineNo = text(enrichment.lineList?.lineNo || object?.sourceAttributes?.LINE_NO || object?.sourcePath);
    const key = normalizeKey(lineNo || object?.sourcePath || object?.id);
    if (!key) continue;
    const current = map.get(key) || {
      id: `branch:${stableHash(key)}`,
      lineNo,
      objectIds: [],
      pipeCount: 0,
      supportCount: 0,
    };
    current.objectIds.push(object.id);
    current.pipeCount += 1;
    map.set(key, current);
  }
  return Array.from(map.values()).map((branch) => freezeDeep(branch));
}

function safeFilePart(value) {
  const cleaned = text(value).replace(/\.[A-Za-z0-9]+$/, '').replace(/[^A-Za-z0-9_.-]+/g, '_');
  return cleaned || 'rvm';
}
