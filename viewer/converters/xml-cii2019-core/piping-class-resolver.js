import { toText, toFiniteNumber } from './config.js';

export function normalizePipingClass(val) {
  return String(val ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

function normalizeComponentType(val) {
  return String(val ?? '').trim().toUpperCase();
}

function normalizeRating(val) {
  return String(val ?? '').trim().toUpperCase().replace(/#/g, '');
}

function normalizeSchedule(val) {
  return String(val ?? '').trim().toUpperCase();
}

export function buildPipingClassIndex(rows) {
  const map = new Map();
  const safeRows = Array.isArray(rows) ? rows : [];
  for (const row of safeRows) {
    const cls = normalizePipingClass(row.pipingClass ?? row['Piping Class'] ?? row.Class ?? row.SPEC);
    if (!cls) continue;
    if (!map.has(cls)) map.set(cls, []);
    map.get(cls).push(row);
  }
  return map;
}

export function scorePipingClassRow({
  row,
  pipingClass,
  boreMm,
  componentType,
  rating,
  schedule,
  config = {}
}) {
  const cfg = {
    boreToleranceMm: 1.0,
    classExactWeight: 1000,
    boreExactWeight: 300,
    boreNearWeight: 220,
    componentExactWeight: 180,
    pipeRigidWeight: 120,
    ratingExactWeight: 80,
    scheduleExactWeight: 60,
    ...config.pipingClassMatch
  };

  let score = 0;
  const reasons = [];

  const rowClass = normalizePipingClass(row.pipingClass ?? row['Piping Class'] ?? row.Class ?? row.SPEC);
  const requestedClass = normalizePipingClass(pipingClass);
  if (rowClass === requestedClass) {
    score += cfg.classExactWeight;
    reasons.push('class-exact');
  } else {
    return { score: -Infinity, reasons: ['class-mismatch'] };
  }

  const rowBore = toFiniteNumber(
    row.convertedBore ??
    row['Converted Bore'] ??
    row.boreMm ??
    row.sizeMm ??
    row.Size ??
    row.size
  );
  const requestedBore = toFiniteNumber(boreMm);

  if (requestedBore != null && rowBore != null) {
    const diff = Math.abs(rowBore - requestedBore);
    if (diff <= 0.001) {
      score += cfg.boreExactWeight;
      reasons.push('bore-exact');
    } else if (diff <= cfg.boreToleranceMm) {
      score += cfg.boreNearWeight;
      reasons.push(`bore-near:${diff.toFixed(3)}mm`);
    } else {
      score -= 300;
      reasons.push(`bore-mismatch:${diff.toFixed(3)}mm`);
    }
  } else {
    reasons.push('bore-missing');
  }

  const rowComp = normalizeComponentType(
    row.componentType ??
    row['Component Type'] ??
    row.type ??
    row.itemType
  );
  const reqComp = normalizeComponentType(componentType);
  if (rowComp && reqComp && rowComp === reqComp) {
    score += cfg.componentExactWeight;
    reasons.push('component-exact');
  } else if (rowComp === 'PIPE' && (reqComp === 'RIGID' || reqComp === 'PIPE')) {
    score += cfg.pipeRigidWeight;
    reasons.push('pipe-rigid-compatible');
  }

  const rowRating = normalizeRating(row.rating ?? row.Rating ?? row.class);
  const reqRating = normalizeRating(rating);
  if (rowRating && reqRating && rowRating === reqRating) {
    score += cfg.ratingExactWeight;
    reasons.push('rating-exact');
  }

  const rowSchedule = normalizeSchedule(row.schedule ?? row.Schedule ?? row.SCH);
  const reqSchedule = normalizeSchedule(schedule);
  if (rowSchedule && reqSchedule && rowSchedule === reqSchedule) {
    score += cfg.scheduleExactWeight;
    reasons.push('schedule-exact');
  }

  return { score, reasons };
}

export function findBestPipingClassRow({
  pipingClass,
  boreMm,
  componentType,
  rating,
  schedule,
  pipingClassIndex,
  config = {}
}) {
  const cfg = {
    ambiguousScoreDelta: 50,
    minAcceptScore: 1000,
    ...config.pipingClassMatch
  };

  const cls = normalizePipingClass(pipingClass);
  const rows = (pipingClassIndex instanceof Map ? pipingClassIndex.get(cls) : null) || [];

  const scored = rows
    .map((row) => ({
      row,
      ...scorePipingClassRow({
        row,
        pipingClass: cls,
        boreMm,
        componentType,
        rating,
        schedule,
        config
      })
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score);

  const best = scored[0] || null;
  const second = scored[1] || null;

  if (!best || best.score < cfg.minAcceptScore) {
    return {
      row: null,
      method: 'none',
      confidence: 0,
      needsReview: true,
      score: best?.score ?? 0,
      reasons: best?.reasons || [],
      candidates: scored.slice(0, 5)
    };
  }

  const ambiguous = second && Math.abs(best.score - second.score) <= cfg.ambiguousScoreDelta;
  const needsReview = ambiguous || best.reasons.includes('bore-missing');

  return {
    row: best.row,
    method: ambiguous ? 'ambiguous-best-score' : 'best-score',
    confidence: Math.min(1, best.score / (cfg.classExactWeight + cfg.boreExactWeight + cfg.componentExactWeight + cfg.ratingExactWeight)),
    needsReview,
    score: best.score,
    reasons: best.reasons,
    candidates: scored.slice(0, 5)
  };
}
