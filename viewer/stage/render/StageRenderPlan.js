import {
  RVM_STAGE_SCHEMA,
  isBbox6,
  normalizeRenderQuality,
} from '../contracts/RvmStageModelContract.js';
import { getStageRenderRecipeForPrimitive } from '../contracts/StageRenderRecipes.js';

export const STAGE_RENDER_PLAN_SCHEMA = 'StageRenderPlan.v1';
const FALLBACK_RECIPE_ID = 'render-plan-diagnostic-missing-recipe';

export function buildStageRenderPlan(model, quality = 'full') {
  const normalizedQuality = normalizeRenderQuality(quality);
  const diagnostics = [];
  const componentById = new Map((model?.components || []).map((component) => [component.id, component]));
  const entries = (model?.primitives || []).map((primitive, index) => {
    const component = componentById.get(primitive.componentId);
    return buildPrimitiveEntry(primitive, component, normalizedQuality, index, diagnostics);
  });
  const plan = {
    schema: STAGE_RENDER_PLAN_SCHEMA,
    source: {
      schema: model?.schema || RVM_STAGE_SCHEMA,
      fileName: model?.source?.fileName || '',
      fileHash: model?.source?.fileHash || '',
      quality: normalizedQuality,
    },
    entries,
    summary: summarizeEntries(entries),
    diagnostics,
  };
  plan.summary = summarizeStageRenderPlan(plan);
  return plan;
}

export function summarizeStageRenderPlan(plan) {
  const entries = Array.isArray(plan?.entries) ? plan.entries : [];
  return summarizeEntries(entries);
}

export function validateStageRenderPlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') return { valid: false, errors: ['plan must be an object'] };
  if (plan.schema !== STAGE_RENDER_PLAN_SCHEMA) errors.push(`schema must be ${STAGE_RENDER_PLAN_SCHEMA}`);
  if (!plan.source || plan.source.schema !== RVM_STAGE_SCHEMA) errors.push(`source.schema must be ${RVM_STAGE_SCHEMA}`);
  if (!Array.isArray(plan.entries)) errors.push('entries must be an array');
  for (const entry of plan.entries || []) validateEntry(entry, errors);
  if (!plan.summary || typeof plan.summary !== 'object') errors.push('summary object is required');
  if (!Array.isArray(plan.diagnostics)) errors.push('diagnostics must be an array');
  return { valid: errors.length === 0, errors };
}

function buildPrimitiveEntry(primitive, component, quality, index, diagnostics) {
  const recipe = safeRecipe(primitive, quality, diagnostics);
  const bboxWorld = pickBbox(primitive, component);
  const output = recipe?.output || 'bbox';
  return {
    id: renderId(index + 1),
    nodeId: primitive?.nodeId || '',
    componentId: primitive?.componentId || '',
    primitiveId: primitive?.id || '',
    recipeId: recipe?.id || FALLBACK_RECIPE_ID,
    renderKind: primitive?.renderKind || 'UNKNOWN_DIAGNOSTIC',
    semanticType: component?.semanticType || 'UNKNOWN',
    output,
    diagnosticOnly: Boolean(recipe?.diagnosticOnly || !recipe),
    bboxWorld,
  };
}

function safeRecipe(primitive, quality, diagnostics) {
  try {
    const recipe = getStageRenderRecipeForPrimitive(primitive, quality);
    if (recipe) return recipe;
    diagnostics.push(renderDiagnostic(primitive, `No render recipe for ${primitive?.renderKind || 'unknown'} at ${quality}`));
  } catch (error) {
    diagnostics.push(renderDiagnostic(primitive, error?.message || String(error)));
  }
  return null;
}

function renderDiagnostic(primitive, message) {
  return {
    severity: 'warning',
    code: 'STAGE_RENDER_PLAN_RECIPE_MISSING',
    message,
    ref: { primitiveId: primitive?.id || '', renderKind: primitive?.renderKind || '' },
  };
}

function summarizeEntries(entries) {
  const summary = { totalEntries: entries.length, byRecipe: {}, byOutput: {}, diagnosticOnly: 0, hidden: 0 };
  for (const entry of entries) {
    increment(summary.byRecipe, entry.recipeId || 'unknown');
    increment(summary.byOutput, entry.output || 'unknown');
    if (entry.diagnosticOnly) summary.diagnosticOnly += 1;
    if (entry.output === 'hidden') summary.hidden += 1;
  }
  return summary;
}

function validateEntry(entry, errors) {
  if (!entry || typeof entry !== 'object') return errors.push('entry must be an object');
  if (typeof entry.id !== 'string' || !entry.id) errors.push('entry.id is required');
  if (typeof entry.recipeId !== 'string' || !entry.recipeId) errors.push(`entry ${entry.id || '?'} recipeId is required`);
  if (typeof entry.output !== 'string' || !entry.output) errors.push(`entry ${entry.id || '?'} output is required`);
  if (typeof entry.nodeId !== 'string' || !entry.nodeId) errors.push(`entry ${entry.id || '?'} nodeId is required`);
  if (entry.primitiveId !== undefined && (typeof entry.primitiveId !== 'string' || !entry.primitiveId)) errors.push(`entry ${entry.id || '?'} primitiveId is required`);
  if (entry.bboxWorld && !isBbox6(entry.bboxWorld)) errors.push(`entry ${entry.id || '?'} bboxWorld must be bbox6`);
}

function pickBbox(primitive, component) {
  return primitive?.transform?.bboxWorld || primitive?.bboxWorld || component?.bboxWorld || null;
}

function increment(target, key) {
  target[key] = (target[key] || 0) + 1;
}

function renderId(value) {
  return `render-${String(value).padStart(6, '0')}`;
}
