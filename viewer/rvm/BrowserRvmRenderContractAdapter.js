export const BROWSER_RVM_RENDER_INSTRUCTION_SCHEMA = 'rvm-browser-render-instructions/v1';

export function collectBrowserRvmRenderInstructions(roots = []) {
  const list = [];
  const walk = (node, path = '') => {
    if (!node || typeof node !== 'object') return;
    const name = String(node.name || node.id || 'RVM Node').trim() || 'RVM Node';
    const nodePath = path ? `${path}/${name}` : name;
    const attrs = node.attributes || {};
    const primitive = String(attrs.RVM_BROWSER_RENDER_PRIMITIVE || '').trim();
    if (primitive && primitive !== 'UNSUPPORTED') {
      list.push({
        schemaVersion: BROWSER_RVM_RENDER_INSTRUCTION_SCHEMA,
        sourcePath: nodePath,
        sourceName: name,
        type: String(attrs.TYPE || node.type || 'UNKNOWN'),
        kind: String(attrs.RVM_PRIMITIVE_KIND || attrs.RVM_BROWSER_PRIMITIVE_CLASS || attrs.TYPE || node.type || 'UNKNOWN'),
        renderPrimitive: primitive,
        renderSource: String(attrs.RVM_BROWSER_RENDER_SOURCE || 'unknown'),
        contractVersion: String(attrs.RVM_BROWSER_GEOMETRY_CONTRACT_VERSION || ''),
        center: parseVec3(attrs.RVM_BROWSER_CENTER),
        axisStart: parseVec3(attrs.RVM_BROWSER_AXIS_START),
        axisEnd: parseVec3(attrs.RVM_BROWSER_AXIS_END),
        length: finiteNumber(attrs.RVM_BROWSER_LENGTH),
        radius: finiteNumber(attrs.RVM_BROWSER_RADIUS),
        diameter: finiteNumber(attrs.RVM_BROWSER_DIAMETER)
      });
    }
    for (const child of Array.isArray(node.children) ? node.children : []) walk(child, nodePath);
  };
  for (const root of Array.isArray(roots) ? roots : [roots]) walk(root, '');
  return {
    schemaVersion: BROWSER_RVM_RENDER_INSTRUCTION_SCHEMA,
    count: list.length,
    instructions: list,
    diagnostics: summarize(list)
  };
}

function summarize(list) {
  const contractCounts = {};
  const kindCounts = {};
  const sourceCounts = {};
  for (const item of list) {
    bump(contractCounts, item.renderPrimitive);
    bump(kindCounts, item.kind);
    bump(sourceCounts, item.renderSource);
  }
  return {
    schemaVersion: BROWSER_RVM_RENDER_INSTRUCTION_SCHEMA,
    instructionCount: list.length,
    contractCounts,
    kindCounts,
    sourceCounts
  };
}

function bump(target, key) {
  const name = String(key || '').trim() || 'UNKNOWN';
  target[name] = (target[name] || 0) + 1;
}

function finiteNumber(value) {
  const n = Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(n) ? n : null;
}

function parseVec3(value) {
  const parts = String(value || '').split(/[\s,]+/g).map((entry) => Number(entry)).filter(Number.isFinite);
  if (parts.length < 3) return null;
  return { x: parts[0], y: parts[1], z: parts[2] };
}
