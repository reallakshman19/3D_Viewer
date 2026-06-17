import { normalizeLineNoValue } from '../../../utils/line-no-metadata.js';

const BM_CII_LINE_NO_SIDELOAD_URL = 'benchmarks/bm-cii/BM_CII_LINE_NO_sideload.json';

const state = {
  loaded: false,
  loading: null,
  error: null,
  byNode: new Map(),
  topologyRoot: null,
  componentLineByKey: new Map(),
};

function text(value) {
  return String(value ?? '').trim();
}

function normalizeNodeId(value) {
  const raw = text(value);
  if (!raw) return '';
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? String(Math.trunc(numeric)) : raw;
}

function first(source, keys, fallback = '') {
  for (const key of keys) {
    const value = text(source?.[key]);
    if (value) return value;
  }
  return text(fallback);
}

function nodePairFromMeta(meta = {}) {
  return {
    from: normalizeNodeId(first(meta, ['fromNode', 'FROM_NODE', 'From Node'])),
    to: normalizeNodeId(first(meta, ['toNode', 'TO_NODE', 'To Node'])),
  };
}

function rootOf(object3D) {
  let current = object3D || null;
  while (current?.parent) current = current.parent;
  return current;
}

function objectMeta(object3D) {
  const raw = object3D?.userData && typeof object3D.userData === 'object' ? object3D.userData : {};
  const trace = raw.bmCiiTrace && typeof raw.bmCiiTrace === 'object' ? raw.bmCiiTrace : {};
  return { ...trace, ...raw };
}

function componentKey(meta = {}, object3D = null) {
  return first(meta, ['pcfId', 'id', 'refNo', 'REF_NO', 'name'], object3D?.name || object3D?.uuid || '');
}

function looksLikeSupport(meta = {}, type = '') {
  const trace = meta.bmCiiTrace && typeof meta.bmCiiTrace === 'object' ? meta.bmCiiTrace : {};
  return trace.entity === 'support'
    || trace.semanticCategory === 'support'
    || Boolean(meta.supportRecordId || meta.supportKind || meta.supportSource)
    || String(type || '').toUpperCase().includes('SUPPORT');
}

function resolveRuntimeUrl(url) {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (typeof window !== 'undefined' && window.location) {
    return new URL(url.replace(/^\/+/, ''), `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`).toString();
  }
  return url;
}

function applyRecords(records) {
  state.byNode = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const node = normalizeNodeId(record?.node ?? record?.NODE ?? record?.Node);
    const lineNo = normalizeLineNoValue(record?.lineNo ?? record?.LINE_NO ?? record?.['Line No'] ?? record?.lineNumber);
    if (!node || !lineNo) continue;
    state.byNode.set(node, {
      lineNo,
      anchorNode: node,
      source: record?.source || 'BM_CII line-no sideload',
      scope: record?.scope || 'topology-carry-forward',
    });
  }
  state.topologyRoot = null;
  state.componentLineByKey = new Map();
}

export function ensureBmCiiLineNoSideloadLoaded() {
  if (state.loaded || state.loading) return state.loading;
  if (typeof fetch !== 'function') {
    state.loaded = true;
    return null;
  }
  state.loading = fetch(resolveRuntimeUrl(BM_CII_LINE_NO_SIDELOAD_URL), { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status}`);
      return response.json();
    })
    .then((payload) => {
      applyRecords(payload?.records || payload?.lineNoRecords || []);
      state.loaded = true;
      state.error = null;
    })
    .catch((err) => {
      state.loaded = true;
      state.error = err?.message || String(err);
      applyRecords([]);
    });
  return state.loading;
}

function buildTopology(root) {
  state.topologyRoot = root || null;
  state.componentLineByKey = new Map();
  if (!root || typeof root.traverse !== 'function' || state.byNode.size === 0) return;

  const adjacency = new Map();
  root.traverse((object3D) => {
    const meta = objectMeta(object3D);
    const pair = nodePairFromMeta(meta);
    const key = componentKey(meta, object3D);
    if (!pair.from || !pair.to || !key) return;
    const type = first(meta, ['pcfType', 'type'], object3D?.type || object3D?.name || '');
    if (looksLikeSupport(meta, type)) return;
    const edge = { from: pair.from, to: pair.to, key };
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
    adjacency.get(edge.from).push(edge);
    adjacency.get(edge.to).push(edge);
  });

  const nodeLine = new Map();
  const queue = [];
  for (const [node, detail] of state.byNode.entries()) {
    nodeLine.set(node, detail);
    queue.push(node);
  }

  for (let i = 0; i < queue.length; i += 1) {
    const node = queue[i];
    const detail = nodeLine.get(node);
    for (const edge of adjacency.get(node) || []) {
      if (!state.componentLineByKey.has(edge.key)) {
        state.componentLineByKey.set(edge.key, {
          ...detail,
          source: `${detail.source}; propagated through component topology`,
        });
      }
      const other = edge.from === node ? edge.to : edge.from;
      if (!nodeLine.has(other)) {
        nodeLine.set(other, detail);
        queue.push(other);
      }
    }
  }
}

export function bmCiiLineNoFromSideload(item, meta, supportLike = false) {
  if (supportLike) return { value: '', pending: false };
  if (!state.loaded) return { value: '', pending: true };
  if (state.byNode.size === 0) return { value: '', pending: false };

  const pair = nodePairFromMeta(meta);
  for (const node of [pair.from, pair.to]) {
    const direct = state.byNode.get(node);
    if (direct) return { value: direct.lineNo, source: direct.source, anchorNode: direct.anchorNode, scope: 'node-wise sideload direct', pending: false };
  }

  const root = rootOf(item?.object3D);
  if (state.topologyRoot !== root) buildTopology(root);
  const propagated = state.componentLineByKey.get(componentKey(meta, item?.object3D));
  if (!propagated) return { value: '', pending: false };
  return {
    value: propagated.lineNo,
    source: propagated.source,
    anchorNode: propagated.anchorNode,
    scope: 'node-wise sideload topology carry-forward',
    pending: false,
  };
}
