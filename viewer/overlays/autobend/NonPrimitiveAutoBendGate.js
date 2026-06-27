const NON_PRIMITIVE_SOURCE_KINDS = new Set(['json', 'jscon', 'inputxml', 'uxml', 'txt', 'stagedjson']);
const PRIMITIVE_SOURCE_KINDS = new Set(['rvm', 'glb', 'gltf']);

export function normalizeSourceKind(value) {
  const text = String(value || '').trim().toLowerCase().replace(/^\./, '');
  if (text === 'xml' || text === 'uxml') return 'inputxml';
  if (text === 'staged.json') return 'stagedjson';
  return text;
}

export function sourceKindFromFileName(fileName = '') {
  const name = String(fileName || '').trim().toLowerCase();
  if (!name) return '';
  if (/\.stagedjson$/i.test(name) || /\.staged\.json$/i.test(name)) return 'stagedjson';
  if (/\.uxml(\.json)?$/i.test(name) || /\.inputxml$/i.test(name)) return 'inputxml';
  if (/\.jscon$/i.test(name)) return 'jscon';
  if (/\.txt$/i.test(name)) return 'txt';
  if (/\.json$/i.test(name)) return 'json';
  if (/\.rvm$/i.test(name) || /\.rev$/i.test(name)) return 'rvm';
  if (/\.glb$/i.test(name)) return 'glb';
  if (/\.gltf$/i.test(name)) return 'gltf';
  return '';
}

export function sourceKindFromContext(context = {}) {
  return normalizeSourceKind(
    context.sourceKind
      || context.loadedSourceKind
      || context.fileExtension
      || sourceKindFromFileName(context.fileName)
  );
}

export function canUseAutoBend(context = {}) {
  const sourceKind = sourceKindFromContext(context);
  if (!NON_PRIMITIVE_SOURCE_KINDS.has(sourceKind)) return false;
  if (PRIMITIVE_SOURCE_KINDS.has(sourceKind)) return false;
  if (context.modelPrimitiveMode === 'rvm-native') return false;
  if (context.modelPrimitiveMode === 'glb-native') return false;
  if (context.viewerMode === 'rvm') return false;
  if (context.viewerMode === 'glb') return false;
  return true;
}

export const NON_PRIMITIVE_AUTO_BEND_SOURCE_KINDS = Object.freeze({
  nonPrimitive: [...NON_PRIMITIVE_SOURCE_KINDS],
  primitive: [...PRIMITIVE_SOURCE_KINDS],
});
