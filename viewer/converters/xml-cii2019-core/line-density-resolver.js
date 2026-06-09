export function resolveLineListDensity(row) {
  return { value: String(row?.density || '').trim(), source: 'linelist-density' };
}
