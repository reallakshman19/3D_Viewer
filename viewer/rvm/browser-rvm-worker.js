import { parseRvmArrayBuffer } from './BrowserRvmHierarchyTransformParser.js?v=20260620-rvm-prim-transform-1';
import { enrichBrowserRvmHierarchyWithAtt } from './BrowserRvmAttEnricher.js';
import { collectBrowserRvmRenderInstructions } from './BrowserRvmRenderContractAdapter.js';
import { filterBrowserRvmRenderInstructions } from './BrowserRvmInstructionFilter.js?v=20260620-rvm-oversize-filter-1';

// BrowserRvmTransformParser.js?v=20260620-rvm-prim-transform-1 is used by the hierarchy transform wrapper.
const DEFAULT_MANIFEST_NODE_LIMIT = 900;
const KEEP_ATTRIBUTE_NAMES = new Set([
  'TYPE', 'NAME', 'RVM_PRIMITIVE_KIND', 'RVM_BYTE_OFFSET', 'RVM_PRIMITIVE_CODE', 'RVM_RECORD_TAG',
  'RVM_OWNER_NAME', 'RVM_OWNER_PATH', 'BROWSER_PARSE_METHOD', 'BROWSER_PARSE_CONFIDENCE', 'RVM_PRIM_TRANSFORM_APPLIED',
  'RVM_PRIM_TRANSFORM_SCHEMA', 'RVM_LOCAL_AXIS', 'RVM_TRANSFORM_COLUMN_SCALES', 'RVM_BROWSER_RENDER_PRIMITIVE',
  'RVM_BROWSER_RENDER_SOURCE', 'RVM_BROWSER_GEOMETRY_CONTRACT_VERSION', 'RVM_BROWSER_ATT_ENRICHED',
  'RVM_BROWSER_ATT_ATTRIBUTE_COUNT', 'RVM_BROWSER_BBOX', 'RVM_BROWSER_LENGTH', 'RVM_BROWSER_RADIUS'
]);

self.onmessage = async (event) => {
  const { id, arrayBuffer, options = {} } = event.data || {};
  const timings = {};
  const mark = () => nowMs();
  const measure = (name, start) => {
    timings[name] = Number((nowMs() - start).toFixed(2));
    postProgress(id, { stage: name, message: `RVM worker ${name} complete`, timings });
  };
  try {
    postProgress(id, { stage: 'parse-start', message: `RVM worker parsing ${options.fileName || 'model.rvm'}…` });
    let t = mark();
    const parsed = await parseRvmArrayBuffer(arrayBuffer, options);
    measure('parse', t);

    t = mark();
    const attEnrichment = enrichBrowserRvmHierarchyWithAtt(parsed.hierarchy || [], options.attText || '');
    measure('attEnrichment', t);

    t = mark();
    const rawInstructionSet = collectBrowserRvmRenderInstructions(attEnrichment.hierarchy || []);
    const filteredInstructionSet = filterBrowserRvmRenderInstructions(rawInstructionSet, {
      enabled: options.hideOversizedNonPiping !== false,
      minAbsoluteDiagonal: 12,
      medianFactor: 40,
      p90Factor: 12,
    });
    const compactInstructionSet = compactInstructionSetForTransfer(filteredInstructionSet);
    measure('renderInstructionGeneration', t);

    t = mark();
    const manifestNodes = flattenHierarchyForManifest(attEnrichment.hierarchy || [], positiveInteger(options.manifestNodeLimit, DEFAULT_MANIFEST_NODE_LIMIT));
    measure('manifest', t);

    self.postMessage({
      id,
      ok: true,
      type: 'complete',
      result: {
        ok: true,
        schemaVersion: parsed.schemaVersion,
        sourceFormat: 'RVM_BINARY_BROWSER_WORKER',
        fileName: options.fileName || parsed.fileName || '',
        byteLength: arrayBuffer?.byteLength || parsed.byteLength || 0,
        upAxis: 'Z',
        instructionSet: compactInstructionSet,
        manifestNodes,
        attDiagnostics: attEnrichment.diagnostics,
        diagnostics: {
          ...(parsed.diagnostics || {}),
          browserRvmWorkerEnabled: true,
          browserRvmWorkerFirstPipeline: true,
          browserRvmCompactInstructionTransfer: true,
          browserRvmHierarchyReturnedToMainThread: false,
          browserRvmInstructionCount: compactInstructionSet.count,
          browserRvmOriginalInstructionCount: rawInstructionSet.count || rawInstructionSet.instructions?.length || 0,
          browserRvmOversizedNonPipingSkippedCount: compactInstructionSet.diagnostics?.oversizedNonPipingSkippedCount || 0,
          browserRvmOversizedNonPipingFilter: compactInstructionSet.diagnostics?.oversizedNonPipingFilter || null,
          browserRvmManifestNodeLimit: positiveInteger(options.manifestNodeLimit, DEFAULT_MANIFEST_NODE_LIMIT),
          browserRvmWorkerTimingsMs: timings,
          browserRvmAtt: attEnrichment.diagnostics,
          browserRvmRenderInstructions: compactInstructionSet.diagnostics
        }
      }
    });
  } catch (error) {
    self.postMessage({ id, ok: false, type: 'complete', error: { message: error?.message || String(error), stack: error?.stack || '' } });
  }
};

function compactInstructionSetForTransfer(instructionSet = {}) {
  const instructions = Array.isArray(instructionSet.instructions) ? instructionSet.instructions.map(compactInstruction) : [];
  return { schemaVersion: instructionSet.schemaVersion || '', count: instructions.length, instructions, diagnostics: instructionSet.diagnostics || summarizeInstructions(instructions) };
}

function compactInstruction(instruction = {}) {
  return {
    schemaVersion: instruction.schemaVersion,
    sourcePath: instruction.sourcePath || '',
    sourceName: instruction.sourceName || '',
    displayName: instruction.displayName || instruction.sourceName || '',
    type: instruction.type || 'UNKNOWN',
    kind: instruction.kind || 'UNKNOWN',
    renderPrimitive: instruction.renderPrimitive || 'GENERIC_BBOX_PLACEHOLDER',
    renderSource: instruction.renderSource || '',
    contractVersion: instruction.contractVersion || '',
    center: plainVec(instruction.center),
    axisStart: plainVec(instruction.axisStart),
    axisEnd: plainVec(instruction.axisEnd),
    length: finiteNumber(instruction.length),
    radius: finiteNumber(instruction.radius),
    diameter: finiteNumber(instruction.diameter),
    bbox: instruction.bbox || '',
    attributes: compactAttributes(instruction.attributes),
    att: instruction.att ? { enriched: Boolean(instruction.att.enriched), schemaVersion: instruction.att.schemaVersion || '', ownerQuery: instruction.att.ownerQuery || '', attributeCount: finiteNumber(instruction.att.attributeCount) || 0 } : { enriched: false, schemaVersion: '', ownerQuery: '', attributeCount: 0 },
    attAttributes: compactAttAttributes(instruction.attAttributes)
  };
}

function compactAttributes(attrs = {}) {
  const out = {};
  let copied = 0;
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === '') continue;
    if (!KEEP_ATTRIBUTE_NAMES.has(key) && copied >= 28) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = String(value);
      copied += 1;
    }
  }
  return out;
}

function compactAttAttributes(attrs = {}) {
  const out = {};
  let copied = 0;
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === '' || copied >= 24) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = String(value);
      copied += 1;
    }
  }
  return out;
}

function summarizeInstructions(instructions = []) {
  const contractCounts = {}, kindCounts = {}, sourceCounts = {}, attCounts = { enriched: 0, plain: 0 };
  for (const item of instructions) {
    bump(contractCounts, item.renderPrimitive);
    bump(kindCounts, item.kind);
    bump(sourceCounts, item.renderSource);
    if (item.att?.enriched) attCounts.enriched += 1;
    else attCounts.plain += 1;
  }
  return { instructionCount: instructions.length, contractCounts, kindCounts, sourceCounts, attCounts };
}

function flattenHierarchyForManifest(roots = [], limit = DEFAULT_MANIFEST_NODE_LIMIT) {
  const nodes = [];
  const visit = (node, parentCanonicalObjectId = '', depth = 0) => {
    if (!node || typeof node !== 'object' || nodes.length >= limit) return;
    const canonicalObjectId = String(node.canonicalObjectId || node.id || node.name || `browser-rvm-${nodes.length}`);
    nodes.push({ canonicalObjectId, parentCanonicalObjectId, sourceObjectId: node.sourceObjectId || node.id || canonicalObjectId, name: node.name || canonicalObjectId, kind: node.kind || node.type || node.attributes?.TYPE || 'NODE', type: node.type || node.kind || node.attributes?.TYPE || 'NODE', depth, attributes: compactAttributes(node.attributes) });
    for (const child of Array.isArray(node.children) ? node.children : []) {
      visit(child, canonicalObjectId, depth + 1);
      if (nodes.length >= limit) break;
    }
  };
  for (const root of Array.isArray(roots) ? roots : []) {
    visit(root, '', 0);
    if (nodes.length >= limit) break;
  }
  return nodes;
}

function plainVec(value) {
  if (!value) return null;
  const x = Number(value.x), y = Number(value.y), z = Number(value.z);
  return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
}
function finiteNumber(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function positiveInteger(value, fallback) { const n = Number.parseInt(String(value ?? ''), 10); return Number.isFinite(n) && n > 0 ? n : fallback; }
function bump(target, key) { const name = String(key || '').trim() || 'UNKNOWN'; target[name] = (target[name] || 0) + 1; }
function postProgress(id, progress) { try { self.postMessage({ id, type: 'progress', progress }); } catch (_) {} }
function nowMs() { return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now(); }
