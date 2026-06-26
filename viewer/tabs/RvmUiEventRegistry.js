const VERSION = '20260626-rvm-ui-event-registry-1';
const API_KEY = '__PCF_GLB_RVM_UI_EVENT_REGISTRY__';
const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-ui-event-registry-1');

const registry = new Map();
const diagnostics = {
  version: VERSION,
  installed: false,
  registeredTypes: [],
  counts: {},
  traces: [],
};

export function installRvmUiEventRegistry() {
  if (globalThis[INSTALL_FLAG] && globalThis[API_KEY]) return globalThis[API_KEY];
  globalThis[INSTALL_FLAG] = true;
  diagnostics.installed = true;
  const api = {
    version: VERSION,
    register: registerRvmUiEvent,
    route: routeRvmUiEvent,
    getDiagnostics: getRvmUiEventRegistryDiagnostics,
  };
  globalThis[API_KEY] = api;
  return api;
}

export function registerRvmUiEvent(type, fn, options = {}) {
  const eventType = normalizeType(type);
  if (!eventType || typeof fn !== 'function') return false;
  const list = registry.get(eventType) || [];
  const id = String(options.id || fn.name || `${eventType}-${list.length + 1}`);
  const priority = Number.isFinite(options.priority) ? options.priority : 100;
  const next = [...list.filter((entry) => entry.id !== id), { id, priority, fn }].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  registry.set(eventType, next);
  refreshRegisteredTypes();
  trace('register', { eventType, id, priority });
  return true;
}

export function routeRvmUiEvent(root, type, detail = {}) {
  const eventType = normalizeType(type);
  if (!eventType) return { status: 'skipped', reason: 'missing-event-type' };
  count(eventType);
  const entries = registry.get(eventType) || [];
  if (!entries.length) {
    trace('unhandled', { eventType });
    return { status: 'unhandled', eventType };
  }
  const context = { root, eventType, detail, viewer: detail.viewer || globalThis.__3D_RVM_VIEWER__ || null };
  for (const entry of entries) {
    try {
      const result = entry.fn(context);
      if (result !== false) {
        trace('handled', { eventType, id: entry.id });
        return { status: 'handled', eventType, id: entry.id, result };
      }
    } catch (error) {
      trace('failed', { eventType, id: entry.id, message: String(error?.message || error) });
      return { status: 'failed', eventType, id: entry.id, error: String(error?.message || error) };
    }
  }
  trace('unhandled', { eventType, count: entries.length });
  return { status: 'unhandled', eventType, count: entries.length };
}

export function getRvmUiEventRegistryDiagnostics() {
  refreshRegisteredTypes();
  return {
    ...diagnostics,
    counts: { ...diagnostics.counts },
    traces: [...diagnostics.traces],
  };
}

function normalizeType(type) {
  return String(type || '').trim().toLowerCase();
}

function refreshRegisteredTypes() {
  diagnostics.registeredTypes = [...registry.entries()].map(([eventType, entries]) => ({ eventType, ids: entries.map((entry) => entry.id) }));
}

function count(eventType) {
  diagnostics.counts[eventType] = (Number(diagnostics.counts[eventType]) || 0) + 1;
}

function trace(event, detail = {}) {
  diagnostics.traces.push({ event, detail });
  if (diagnostics.traces.length > 40) diagnostics.traces.splice(0, diagnostics.traces.length - 40);
}
