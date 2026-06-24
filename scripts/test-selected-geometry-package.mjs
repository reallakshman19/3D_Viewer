import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scopeUrl = pathToFileURL(path.join(__dirname, '../viewer/enrichment/selected-geometry-scope.js')).href;
const enrichmentUrl = pathToFileURL(path.join(__dirname, '../viewer/enrichment/selected-geometry-enrichment.js')).href;
const packageUrl = pathToFileURL(path.join(__dirname, '../viewer/enrichment/selected-geometry-package.js')).href;
const { buildSelectedGeometryScope } = await import(scopeUrl);
const { enrichSelectedGeometryScope } = await import(enrichmentUrl);
const {
  RVM_SELECTED_GEOMETRY_WORKSPACE_PACKAGE_SCHEMA,
  PENDING_WORKSPACE_PACKAGE_STORAGE_KEY,
  buildSelectedGeometryWorkspacePackage,
  selectedGeometryWorkspacePackageFileName,
  serializeSelectedGeometryWorkspacePackage,
  writePendingWorkspacePackageToStorage,
} = await import(packageUrl);

const pipe = {
  id: 'PIPE-100-A',
  type: 'PIPE',
  attributes: {
    TYPE: 'PIPE',
    OWNER: '/AREA/8-L100-STEAM',
    LINE_NO: '8-L100-STEAM',
    PIPING_CLASS: '66620M0',
    NPS: '8',
    DIAMETER: '219.075',
    WALL_THICK: '12.7',
    APOS: { x: 0, y: 0, z: 0 },
    LPOS: { x: 10750, y: 0, z: 0 },
  },
};
const support = {
  id: 'SUP-100-A',
  type: 'ATTA',
  attributes: {
    TYPE: 'ATTA',
    OWNER: '/AREA/8-L100-STEAM/SUPPORT',
    APOS: { x: 5000, y: -100, z: 0 },
  },
};
const scope = buildSelectedGeometryScope({
  hierarchy: [pipe, support],
  selectedIds: ['PIPE-100-A', 'SUP-100-A'],
  visibleIds: [],
  hierarchyNodeId: '',
  scopeMode: 'selected',
  axisTransform: { verticalAxis: 'Z', northAxis: 'Y', handedness: 'right' },
});
const masters = {
  lineListVersion: 'LL-v1',
  pipingClassVersion: 'PC-v1',
  materialMapVersion: 'MAT-v1',
  weightMasterVersion: 'WT-v1',
  lineList: [{ lineNo: '8-L100-STEAM', pipingClass: '66620M0', fluid: 'Steam' }],
  pipingClass: [{ pipingClass: '66620M0', componentType: 'PIPE', nps: 8, wallThicknessMm: 12.7, materialCode: '106' }],
  materialMap: [{ materialCode: '106', materialCategory: 'CS', materialDensityKgM3: 7850 }],
  weightMaster: [{ nps: 8, componentType: 'PIPE', unitPipeWeightKgPerM: 64.6 }],
};
const enrichedScope = enrichSelectedGeometryScope(scope, masters, {});
const packageJson = buildSelectedGeometryWorkspacePackage({
  scope: enrichedScope,
  masters,
  source: {
    sourceModelName: 'BM_CII',
    sourceFileName: 'BM_CII.rvm',
    scopeMode: 'selected',
    capturedAt: '2026-06-23T00:00:00.000Z',
  },
});

assert.strictEqual(packageJson.schema, RVM_SELECTED_GEOMETRY_WORKSPACE_PACKAGE_SCHEMA);
assert.strictEqual(packageJson.source.app, '3D_Viewer');
assert.strictEqual(packageJson.source.scopeMode, 'selected');
assert.strictEqual(packageJson.axisTransform.verticalAxis, 'Z');
assert.strictEqual(packageJson.geometry.objects.length, 2);
assert.strictEqual(packageJson.geometry.supports.length, 1);
assert.strictEqual(packageJson.geometry.branches.length, 1);
assert.strictEqual(packageJson.enrichment.masters.lineListVersion, 'LL-v1');
assert.strictEqual(packageJson.enrichment.stats.objects, 2);
assert.strictEqual(packageJson.geometry.objects[0].sourceAttributes.WALL_THICK, '12.7');
assert.strictEqual(pipe.attributes.enrichment, undefined);

const fileName = selectedGeometryWorkspacePackageFileName({
  sourceFileName: 'BM_CII.rvm',
  scopeMode: 'selected',
});
assert.strictEqual(fileName, 'BM_CII_selected_rvm_enriched_workspace_package.json');

const textPayload = serializeSelectedGeometryWorkspacePackage(packageJson);
assert.ok(textPayload.includes(RVM_SELECTED_GEOMETRY_WORKSPACE_PACKAGE_SCHEMA));

const storage = {
  value: '',
  key: '',
  setItem(key, value) {
    this.key = key;
    this.value = value;
  },
};
const writeResult = writePendingWorkspacePackageToStorage(packageJson, storage);
assert.strictEqual(writeResult.status, 'written');
assert.strictEqual(storage.key, PENDING_WORKSPACE_PACKAGE_STORAGE_KEY);
assert.ok(storage.value.includes('BM_CII'));

console.log('selected geometry package tests passed');
