export const BROWSER_RVM_INSTRUCTION_FILTER_SCHEMA = 'browser-rvm-instruction-filter/v2';

const DEFAULT_OPTIONS = Object.freeze({
  enabled: true,
  maxAbsoluteDiagonal: 5000,
  protectPipeRackLikeOwners: true,
});

const PROTECTED_OWNER_RE = /\b(PIPE|BRANCH|VALVE|FLANGE|ELBOW|TEE|GASKET|REDUCER|NOZZLE|INSTRUMENT|SUPPORT|STRAINER|CAP|STRUCTURE|FRAME|STEEL|PLATFORM|RACK)\b/i;
const CIVIL_OWNER_RE = /\b(ROAD|TRANCHE|CIVIL|FOUNDATION|GRADE|TERRAIN)\b/i;
const EQUIPMENT_OWNER_RE = /\b(EQUIPMENT|SUBEQUIPMENT)\b/i;
const BOXISH_RE = /\b(BOX|STRUCTURE|AUXILIARY_SOLID|GENERIC|UNKNOWN)\b/i;

export function filterBrowserRvmRenderInstructions(instructionSet = {}, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...(options || {}) };
  const source = Array.isArray(instructionSet.instructions) ? instructionSet.instructions : [];
  if (opts.enabled === false || !source.length) {
    return withDiagnostics(instructionSet, source, [], makeDiagnostics(source.length, 0, 'disabled'));
  }

  const skipped = [];
  const kept = [];
  const threshold = positiveNumber(opts.maxAbsoluteDiagonal, DEFAULT_OPTIONS.maxAbsoluteDiagonal);
  for (const instruction of source) {
    const item = classifyInstruction(instruction);
    const hide = item.diagonal > threshold && item.hideCandidate;
    if (hide) skipped.push({ instruction, reason: item.reason, diagonal: item.diagonal, threshold });
    else kept.push(instruction);
  }

  return withDiagnostics(instructionSet, kept, skipped, {
    schemaVersion: BROWSER_RVM_INSTRUCTION_FILTER_SCHEMA,
    enabled: true,
    originalCount: source.length,
    keptCount: kept.length,
    skippedCount: skipped.length,
    threshold: round(threshold),
    skippedReasons: summarizeSkipped(skipped),
    oversizedNonPipingHidden: skipped.length,
    policy: 'hide-only-absurd-civil-or-unprotected-boxes-after-transform',
  });
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
  ].map((value) => String(value || '')).join(' ');
  const diagonal = instructionDiagonal(instruction, attrs);
  const protectedOwner = PROTECTED_OWNER_RE.test(text);
  const civilOwner = CIVIL_OWNER_RE.test(text);
  const equipmentOwner = EQUIPMENT_OWNER_RE.test(text) && !protectedOwner;
  const boxish = BOXISH_RE.test(`${instruction.type || ''} ${instruction.kind || ''} ${instruction.renderPrimitive || ''}`);
  const hideCandidate = civilOwner || equipmentOwner || (boxish && !protectedOwner);
  return {
    diagonal,
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
    skippedReasons: {},
    oversizedNonPipingHidden: skippedCount,
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
    : String(value || '').replace(/[\[\]]/g, ' ').split(/[\s,]+/g).map(Number).filter(Number.isFinite);
  return nums.length >= 6 && nums.slice(0, 6).every(Number.isFinite) ? nums.slice(0, 6) : null;
}

function summarizeSkipped(skipped) {
  const out = {};
  for (const item of skipped) out[item.reason] = (out[item.reason] || 0) + 1;
  return out;
}
function positiveNumber(value, fallback) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : fallback; }
function round(value) { const n = Number(value); return Number.isFinite(n) ? Number(n.toFixed(6)) : 0; }
