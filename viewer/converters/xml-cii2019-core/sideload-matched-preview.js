function text(value) {
  return value == null ? '' : String(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function factKey(fact) {
  return [
    fact?.source || '',
    fact?.itemType || '',
    fact?.basis || '',
    fact?.key || '',
    fact?.resolvedNodeNumber || '',
    typeof fact?.value === 'object' ? JSON.stringify(fact.value) : text(fact?.value),
  ].join('\u0001');
}

function normalizeFact(fact) {
  if (!fact || typeof fact !== 'object') return null;
  return {
    source: text(fact.source || fact.factSource || fact.type || '').trim(),
    itemType: text(fact.itemType || fact.item || fact.kind || '').trim(),
    basis: text(fact.basis || fact.resolvedFrom || fact.method || '').trim(),
    key: text(fact.key || fact.resolvedKey || fact.message || '').trim(),
    resolvedNodeNumber: text(fact.resolvedNodeNumber || fact.nodeNumber || fact.node || '').trim(),
    value: fact.value ?? fact.kind ?? fact.message ?? '',
    action: text(fact.action || '').trim(),
    status: text(fact.status || '').trim(),
    meta: fact.meta && typeof fact.meta === 'object' ? fact.meta : {},
    warnings: asArray(fact.warnings),
    errors: asArray(fact.errors),
  };
}

export function isMatchedPreviewFact(fact) {
  const normalized = normalizeFact(fact);
  if (!normalized) return false;
  const status = normalized.status || 'MATCHED';
  return status === 'MATCHED' && !!normalized.resolvedNodeNumber && !!normalized.itemType;
}

export function splitMatchedPreviewFacts(payload = {}) {
  const sourceMatched = asArray(payload?.matchedFacts).map(normalizeFact).filter(Boolean);
  const sourceRejected = asArray(payload?.rejectedFacts).map(normalizeFact).filter(Boolean);
  const matchedFacts = [];
  const rejectedFacts = [...sourceRejected];
  const seen = new Set();

  for (const fact of sourceMatched) {
    if (isMatchedPreviewFact(fact)) {
      const key = factKey(fact);
      if (!seen.has(key)) {
        seen.add(key);
        matchedFacts.push({ ...fact, status: fact.status || 'MATCHED' });
      }
    } else {
      rejectedFacts.push({ ...fact, status: fact.status || 'REJECTED' });
    }
  }

  return {
    matchedFacts,
    rejectedFacts,
    stats: {
      matched: matchedFacts.length,
      rejected: rejectedFacts.length,
      inputMatched: sourceMatched.length,
      inputRejected: sourceRejected.length,
    },
  };
}

export function parseMatchedPreviewDiagnostics(rawText) {
  let parsed;
  try {
    parsed = JSON.parse(text(rawText));
  } catch (error) {
    throw new Error(`Invalid diagnostics JSON: ${text(error?.message || error)}`);
  }
  return splitMatchedPreviewFacts(parsed);
}
