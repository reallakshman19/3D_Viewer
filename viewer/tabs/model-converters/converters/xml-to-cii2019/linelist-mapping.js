export function detectLineListFieldMap(rows, existingMap = {}) {
  const map = { ...existingMap };
  if (!rows || rows.length === 0) return map;

  const headers = Object.keys(rows[0]).filter(k => !k.startsWith('_'));

  const rules = [
    { key: 'lineKey1', terms: [['service', 'line key', 'key 1', 'key1', 'area']] },
    { key: 'lineKey2', terms: [['line number', 'line no', 'line no.', 'seq', 'sequence', 'lineno']] },
    { key: 'pipingClass', terms: [['piping', 'pipe'], ['class', 'spec']], reject: ['construction class'] },
    { key: 't1', terms: [['temp max', 'max temp']] },
    { key: 't2', terms: [['temp.', 'temperature', 'oper', 'operating']] },
    { key: 't3', terms: [['temp min', 'min temp']] },
    { key: 'p1', terms: [['pressure', 'pr'], ['max', 'design']], reject: ['hydro', 'test'] },
    { key: 'hydroPressure', terms: [['pressure', 'pr'], ['hydro', 'hydo', 'test']], reject: ['max', 'design'] },
    { key: 'insThk', terms: [['insulation', 'ins'], ['thickness', 'thk']], reject: ['type'] },
    { key: 'densityMixed', terms: [['mixed', 'mix'], ['density', 'den', 'kg/m']] },
    { key: 'densityGas', terms: [['gas'], ['density', 'den', 'kg/m']], reject: ['mixed', 'liquid'] },
    { key: 'densityLiquid', terms: [['liquid', 'liq'], ['density', 'den', 'kg/m']], reject: ['gas', 'mixed'] },
    { key: 'phase', terms: [['fluid', 'phase']] }
  ];

  for (const h of headers) {
    const hl = h.toLowerCase();
    for (const rule of rules) {
      if (map[rule.key]) continue;

      const isReject = rule.reject && rule.reject.some(r => hl.includes(r));
      if (isReject) continue;

      const isMatch = rule.terms.every(group => group.some(term => hl.includes(term)));

      if (isMatch) {
        map[rule.key] = h;
      }
    }
  }

  // Specific fallbacks
  if (!map.t1 && headers.includes('Temp Max ºC')) map.t1 = 'Temp Max ºC';
  if (!map.t2 && headers.includes('Temp. ºC')) map.t2 = 'Temp. ºC';
  if (!map.t3 && headers.includes('Temp Min ºC')) map.t3 = 'Temp Min ºC';

  return map;
}

export function normalizeLineListRows(rows, fieldMap) {
  return rows;
}

export function getProcessDataForLineKey(lineKey, rows, fieldMap) {
  return rows.find(r => r[fieldMap.lineKey1] === lineKey || r[fieldMap.lineKey2] === lineKey);
}

export function computeLineNoKey(row, fieldMap) {
  return row[fieldMap.lineKey2] || row[fieldMap.lineKey1];
}
