export const BROWSER_RVM_INSTRUCTION_FILTER_SCHEMA = 'browser-rvm-instruction-filter/v5-code11-facet-safe';

const DEFAULT_OPTIONS = Object.freeze({
  enabled: true,
  maxAbsoluteDiagonal: 5000,
  protectPipeRackLikeOwners: true,
  hideOversizedPrimitiveBoxes: false,
  maxPrimitiveBoxSide: 50000,
  maxPrimitiveBoxSideUnit: 'model-units-mm-safe',
});

const PROTECTED_OWNER_RE = /\b(PIPE|BRANCH|VALVE|FLANGE|ELBOW|TEE|GASKET|REDUCER|NOZZLE|INSTRUMENT|SUPPORT|STRAINER|CAP|STRUCTURE|FRAME|STEEL|PLATFORM|RACK)\b/i;
const SUPPORT_OWNER_RE = /\b(SUPPORT|SUPP|GUIDE|ANCHOR|LINE\s*STOP|LINESTOP|STOPPER|REST|SHOE|HANGER|SPRING|CLAMP)\b/i;
const CIVIL_OWNER_RE = /\b(ROAD|TRANCHE|CIVIL|FOUNDATION|GRADE|TERRAIN)\b/i;
const EQUIPMENT_OWNER_RE = /\b(EQUIPMENT|SUBEQUIPMENT)\b/i;
const BOXISH_RE = /\b(BOX|BOX_SOLID|BOX_BBOX|STRUCTURE|STRUCTURE_SOLID|AUXILIARY_SOLID|GENERIC|UNKNOWN|RVM_PRIM_CODE_[12569]|RVM_PRIM_CODE_1|RVM_PRIM_CODE_2|RVM_PRIM_CODE_5|RVM_PRIM_CODE_6|RVM_PRIM_CODE_9)\b/i;

export function filterBrowserRvmRenderInstructions(instructionSet = {}, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...(options || {}) };
  const source = Array.isArray(instructionSet.instructions) ? instructionSet.instructions : [];
  if (opts.enabled === false || !source.length) {
    return withDiagnostics(instructionSet, source, [], makeDiagnostics(source.length, 0, 'disabled'));
  }

  const skipped = [];
  const kept = [];
  const diagonalThreshold = positiveNumber(opts.maxAbsoluteDiagonal, DEFAULT_OPTIONS.maxAbsoluteDiagonal);
  const boxSideThreshold = positiveNumber(opts.maxPrimitiveBoxSide, DEFAULT_OPTIONS.maxPrimitiveBoxSide);
  let code11FacetGuardedCount = 0;
  let code11FacetDecodedCount = 0;
  let code11FacetWireframeFallbackCount = 0;

  for (const rawInstruction of source) {
    const instruction = normalizeCode11FacetInstruction(rawInstruction);
    if (instruction !== rawInstruction) {
      code11FacetGuardedCount += 1;
      if (instruction.attributes?.RVM_BROWSER_CODE11_NATIVE_FACET_DECODED === 'true') code11FacetDecodedCount += 1;
      else code11FacetWireframeFallbackCount += 1;
    }
    const item = classifyInstruction(instruction);
    const oversizedPrimitiveBox = opts.hideOversizedPrimitiveBoxes === true
      && item.boxish
      && !item.supportLike
      && !item.protectedOwner
      && item.hideCandidate
      && item.maxSide > boxSideThreshold;
    const oversizedNonPiping = item.diagonal > diagonalThreshold && item.hideCandidate;
    const hide = oversizedPrimitiveBox || oversizedNonPiping;
    if (hide) {
      skipped.push({
        instruction,
        reason: oversizedPrimitiveBox ? 'oversized-primitive-box-side' : item.reason,
        diagonal: item.diagonal,
        maxSide: item.maxSide,
        threshold: oversizedPrimitiveBox ? boxSideThreshold : diagonalThreshold,
      });
    } else {
      kept.push(instruction);
    }
  }

  return withDiagnostics(instructionSet, kept, skipped, {
    schemaVersion: BROWSER_RVM_INSTRUCTION_FILTER_SCHEMA,
    enabled: true,
    originalCount: source.length,
    keptCount: kept.length,
    skippedCount: skipped.length,
    threshold: round(diagonalThreshold),
    maxPrimitiveBoxSide: round(boxSideThreshold),
    maxPrimitiveBoxSideUnit: opts.maxPrimitiveBoxSideUnit || DEFAULT_OPTIONS.maxPrimitiveBoxSideUnit,
    hideOversizedPrimitiveBoxes: opts.hideOversizedPrimitiveBoxes === true,
    skippedReasons: summarizeSkipped(skipped),
    oversizedNonPipingHidden: skipped.length,
    code11FacetGuardedCount,
    code11FacetDecodedCount,
    code11FacetWireframeFallbackCount,
    policy: 'keep-valid-plant-primitives-visible-hide-only-absurd-unprotected-non-piping-boxes-code11-facet-safe',
  });
}

function normalizeCode11FacetInstruction(instruction = {}) {
  const attrs = instruction.attributes || {};
  if (!isCode11FacetInstruction(instruction, attrs)) return instruction;
  const decoded = hasDecodedCode11FacetParams(attrs);
  return {
    ...instruction,
    type: decoded ? 'FACET_GROUP' : 'FACET_GROUP_UNDECODED',
    kind: 'FACET_GROUP',
    renderPrimitive: 'FACET_GROUP_BBOX_PLACEHOLDER',
    attributes: {
      ...attrs,
      TYPE: attrs.TYPE || instruction.type || '',
      RVM_BROWSER_RENDER_PRIMITIVE: 'FACET_GROUP_BBOX_PLACEHOLDER',
      RVM_BROWSER_CODE11_SEMANTIC_RENDER_GUARD: 'true',
      RVM_BROWSER_CODE11_NATIVE_FACET_DECODED: String(decoded),
      RVM_BROWSER_CODE11_RENDER_POLICY: decoded
        ? 'native-facetgroup-only-no-semantic-placeholder-promotion'
        : 'wireframe-bbox-diagnostic-no-synthetic-support-stand',
    },
  };
}

function isCode11FacetInstruction(instruction = {}, attrs = {}) {
  const code = Number(attrs.RVM_PRIMITIVE_CODE || attrs.RVM_CODE || instruction.primitiveCode || 0);
  const primitive = String(instruction.renderPrimitive || attrs.RVM_BROWSER_RENDER_PRIMITIVE || '').toUpperCase();
  const kind = String(attrs.RVM_PRIMITIVE_KIND_NAME || '').toUpperCase();
  return code === 11 || primitive === 'FACET_GROUP_BBOX_PLACEHOLDER' || kind === 'FACETGROUP';
}

function hasDecodedCode11FacetParams(attrs = {}) {
  const params = parseJson(attrs.RVM_NATIVE_PRIMITIVE_PARAMS);
  return Number(params?.kind || attrs.RVM_PRIMITIVE_CODE || 0) === 11
    && params?.decoded === true
    && params?.facetGroup === true
    && Array.isArray(params?.polygons)
    && params.polygons.length > 0;
}

function parseJson(value) {
  if (!value) return null;
  try { return JSON.parse(String(value)); } catch (_) { return null; }
}

function classifyInstruction(instruction = {}) {
  const attrs = instruction.attributes || {};
  const text = [
    instruction.sourcePath,
    instruction.sourceName,
    instruction.displayName,
    instruction.type,
    instruction.kind,
    instruction.renderPrimitive,
    attrs.RVM_OWNER_NAME,
    attrs.RVM_OWNER_PATH,
    attrs.NAME,
    attrs.TYPE,
    attrs.RVM_PRIMITIVE_KIND,
    attrs.RVM_PRIMITIVE_KIND_NAME,
    attrs.RVM_PRIMITIVE_CODE,
  ].map((value) => String(value || '')).join(' ');
  const bbox = parseBbox(instruction.bbox || attrs.RVM_BROWSER_BBOX);
  const dims = bbox ? bboxDims(bbox) : fallbackDims(instruction);
  const diagonal = dims ? Math.hypot(dims.x, dims.y, dims.z) : instructionDiagonal(instruction, attrs);
  const maxSide = dims ? Math.max(dims.x, dims.y, dims.z) : 0;
  const protectedOwner = PROTECTED_OWNER_RE.test(text);
  const supportLike = SUPPORT_OWNER_RE.test(text);
  const civilOwner = CIVIL_OWNER_RE.test(text);
  const equipmentOwner = EQUIPMENT_OWNER_RE.test(text) && !protectedOwner;
  const boxish = BOXISH_RE.test(`${instruction.type || ''} ${instruction.kind || ''} ${instruction.renderPrimitive || ''} ${attrs.RVM_PRIMITIVE_KIND || ''} ${attrs.RVM_PRIMITIVE_CODE || ''}`);
  const hideCandidate = civilOwner || equipmentOwner || (boxish && !protectedOwner);
  return {
    diagonal,
    maxSide,
    boxish,
    protectedOwner,
    supportLike,
    hideCandidate,
    reason: civilOwner ? 'absurd-civil-owner' : equipmentOwner ? 'absurd-equipment-owner' : 'absurd-unprotected-box',
  };
}

function withDiagnostics(instructionSet, instructions, skipped, diagnostics) {
  return {
    ...instructionSet,
    instructions,
    count: instructions.length,
    diagnostics: {
      ...(instructionSet?.diagnostics || {}),
      oversizedNonPipingFilter: diagnostics,
      originalInstructionCount: diagnostics.originalCount,
      filteredInstructionCount: diagnostics.keptCount,
      oversizedNonPipingSkippedCount: diagnostics.skippedCount,
      code11FacetGuardedCount: diagnostics.code11FacetGuardedCount || 0,
      code11FacetDecodedCount: diagnostics.code11FacetDecodedCount || 0,
      code11FacetWireframeFallbackCount: diagnostics.code11FacetWireframeFallbackCount || 0,
    },
    skippedInstructions: skipped,
  };
}

function makeDiagnostics(count, skippedCount, reason) {
  return {
    schemaVersion: BROWSER_RVM_INSTRUCTION_FILTER_SCHEMA,
    enabled: false,
    reason,
    originalCount: count,
    keptCount: count,
    skippedCount,
    threshold: 0,
    maxPrimitiveBoxSide: DEFAULT_OPTIONS.maxPrimitiveBoxSide,
    hideOversizedPrimitiveBoxes: DEFAULT_OPTIONS.hideOversizedPrimitiveBoxes,
    skippedReasons: {},
    oversizedNonPipingHidden: skippedCount,
    code11FacetGuardedCount: 0,
    code11FacetDecodedCount: 0,
    code11FacetWireframeFallbackCount: 0,
  };
}

function instructionDiagonal(instruction = {}, attrs = {}) {
  const bbox = parseBbox(instruction.bbox || attrs.RVM_BROWSER_BBOX);
  if (bbox) return Math.hypot(Math.abs(bbox[3] - bbox[0]), Math.abs(bbox[4] - bbox[1]), Math.abs(bbox[5] - bbox[2]));
  const len = Number(instruction.length);
  const rad = Number(instruction.radius);
  return Number.isFinite(len) && len > 0 ? Math.hypot(len, Math.max(rad || 0, 0) * 2, Math.max(rad || 0, 0) * 2) : 0;
}

function parseBbox(value) {
  const nums = Array.isArray(value)
    ? value.slice(0, 6).map(Number)
    : String(value || '').replace(/[\[\]]/g, ' ').split(/[\s,]+/g).filter((entry) => entry.trim() !== '').map(Number).filter(Number.isFinite);
  return nums.length >= 6 && nums.slice(0, 6).every(Number.isFinite) ? nums.slice(0, 6) : null;
}

function bboxDims(bbox) {
  if (!bbox) return null;
  return {
    x: Math.abs(bbox[3] - bbox[0]),
    y: Math.abs(bbox[4] - bbox[1]),
    z: Math.abs(bbox[5] - bbox[2]),
  };
}

function fallbackDims(instruction = {}) {
  const len = Number(instruction.length);
  const rad = Number(instruction.radius);
  if (!Number.isFinite(len) || len <= 0) return null;
  const diameter = Number.isFinite(rad) && rad > 0 ? rad * 2 : 0;
  return { x: len, y: diameter, z: diameter };
}

function summarizeSkipped(skipped) {
  const out = {};
  for (const item of skipped) out[item.reason] = (out[item.reason] || 0) + 1;
  return out;
}
function positiveNumber(value, fallback) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : fallback; }
function round(value) { const n = Number(value); return Number.isFinite(n) ? Number(n.toFixed(6)) : 0; }
