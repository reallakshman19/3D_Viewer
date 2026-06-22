import { getXmlCiiPhaseBridge } from './legacy-adapter.js?v=20260620-master-session-1';

const FLAG = '__xmlCiiRegexTokenSelectPatch_v3';
const SUPPORT_CONFIG_SELECTOR = '[data-option-key="supportConfigJson"]';
const LEGACY_ATTR = 'data-xml-cii-regex-path';
const NATIVE_ATTR = 'data-native-regex-path';

const PATHS = Object.freeze({
  sample: 'linelist.sampleBranchName',
  delimiter: 'linelist.tokenDelimiter',
  lineKey: 'linelist.lineKeyTokenPositions',
  size: 'weight.boreTokenIndex',
  pipingClass: 'rating.pipingClassTokenIndex',
});

function browserReady() { return typeof window !== 'undefined' && typeof document !== 'undefined'; }
function text(value) { return value == null ? '' : String(value); }
function esc(value) { return text(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function attr(value) { return esc(value).replaceAll("'", '&#39;'); }
function clean(value) { return text(value).replace(/\s+/g, ' ').trim(); }
function normalizePositionValue(value) { const first = clean(value).split(/[,+]/)[0]?.trim() || ''; const numeric = Number(first); return Number.isFinite(numeric) && numeric > 0 ? String(Math.round(numeric)) : ''; }
function isAttrTarget(element, path) { return (element?.getAttribute?.(LEGACY_ATTR) || element?.getAttribute?.(NATIVE_ATTR) || '') === path; }
function pathAttr(element) { return element?.getAttribute?.(LEGACY_ATTR) ? LEGACY_ATTR : NATIVE_ATTR; }
function positionInputType(path) { return path === PATHS.size || path === PATHS.pipingClass ? 'number' : 'text'; }

function readSupportConfig() {
  const input = document.querySelector(SUPPORT_CONFIG_SELECTOR);
  try { const config = JSON.parse(input?.value || '{}'); return { input, config: config && typeof config === 'object' && !Array.isArray(config) ? config : {} }; }
  catch { return { input, config: {} }; }
}
function writeSupportConfig(config) { const input = document.querySelector(SUPPORT_CONFIG_SELECTOR); if (!input || !config || typeof config !== 'object') return false; const next = JSON.stringify(config, null, 2); if (input.value === next) return false; input.value = next; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); return true; }
function getPath(config, path, fallback = '') {
  if (path === PATHS.sample) return clean(config.linelist?.sampleBranchName || fallback);
  if (path === PATHS.delimiter) return clean(config.linelist?.tokenDelimiter || fallback);
  if (path === PATHS.lineKey) return clean(config.linelist?.lineKeyTokenPositions || fallback);
  if (path === PATHS.size) return clean(config.weight?.boreTokenIndex || fallback);
  if (path === PATHS.pipingClass) return clean(config.rating?.pipingClassTokenIndex || fallback);
  return fallback;
}
function setPath(config, path, value) {
  const pos = normalizePositionValue(value) || clean(value);
  if (path === PATHS.lineKey) { config.linelist = config.linelist && typeof config.linelist === 'object' ? config.linelist : {}; config.linelist.lineKeyTokenPositions = pos; }
  if (path === PATHS.size) { config.weight = config.weight && typeof config.weight === 'object' ? config.weight : {}; config.weight.boreTokenIndex = Number(pos) || pos; }
  if (path === PATHS.pipingClass) { config.rating = config.rating && typeof config.rating === 'object' ? config.rating : {}; config.rating.pipingClassTokenIndex = Number(pos) || pos; }
}

function queryRegexField(root, path) { return root?.querySelector?.(`[${LEGACY_ATTR}="${path}"], [${NATIVE_ATTR}="${path}"]`) || null; }
function fieldValue(root, path, fallback = '') { const { config } = readSupportConfig(); const cfg = getPath(config, path, ''); if (cfg) return cfg; const element = queryRegexField(root, path); if (element && 'value' in element && clean(element.value)) return clean(element.value); return fallback; }
function tokenizeBranchName(branchName, delimiter = '-') { const cleaned = text(branchName).trim().replace(/^\/+/, '').replace(/\/B\d+$/i, ''); const delim = text(delimiter) || '-'; return cleaned.split(delim).map((token) => token.trim()).filter(Boolean); }
function looksLikeNpsSizeToken(value) { return /^(?:\d+(?:\.\d+)?|\d+\s*\/\s*\d+)(?:\s*(?:in|inch|"))?$/i.test(clean(value)); }
function looksLikeLineKeyToken(value) { const token = clean(value); if (!token || looksLikeNpsSizeToken(token)) return false; return /^(?=.*[A-Za-z])(?=.*\d{4,})[A-Za-z][A-Za-z0-9_./]*$/i.test(token); }
function likelyShifted(tokens) { return tokens.length >= 6 && looksLikeNpsSizeToken(tokens[3]) && looksLikeLineKeyToken(tokens[5]); }
function correctedPosition(path, tokens, configured) {
  const current = normalizePositionValue(configured || '') || (path === PATHS.lineKey ? '4' : path === PATHS.size ? '3' : '5');
  if (!likelyShifted(tokens)) return current;
  if (path === PATHS.lineKey) {
    const token = tokens[Number(current) - 1] || '';
    if (current === '4' || looksLikeNpsSizeToken(token)) return '6';
  }
  if (path === PATHS.size) {
    const token = tokens[Number(current) - 1] || '';
    if (current === '3' || !looksLikeNpsSizeToken(token)) return '4';
  }
  return current;
}
function optionHtml(tokens, selected) { const safeSelected = normalizePositionValue(selected) || '1'; const values = new Set(tokens.map((_, index) => String(index + 1))); if (safeSelected && !values.has(safeSelected)) values.add(safeSelected); return Array.from(values).sort((a, b) => Number(a) - Number(b)).map((pos) => { const token = tokens[Number(pos) - 1] || '(not found)'; return `<option value="${attr(pos)}" ${pos === safeSelected ? 'selected' : ''}>${esc(pos)} — ${esc(token)}</option>`; }).join(''); }
function setSiblingPreview(select, tokens) { const position = Number(normalizePositionValue(select.value)); const token = Number.isFinite(position) ? (tokens[position - 1] || '') : ''; const row = select.closest('tr'); const strong = row?.querySelector?.('.mc-regex-preview-cell strong, td:last-child strong') || select.parentElement?.querySelector?.('strong'); if (strong) strong.textContent = token || '—'; }
function persistPosition(path, value) {
  const pos = normalizePositionValue(value) || clean(value);
  const bridge = getXmlCiiPhaseBridge?.();
  if (bridge && typeof bridge.setPopupConfigValue === 'function') {
    bridge.setPopupConfigValue(path, pos, positionInputType(path));
    return true;
  }
  const { config } = readSupportConfig();
  setPath(config, path, pos);
  return writeSupportConfig(config);
}

function shouldPatchElement(element) { if (!element || element.dataset.xmlCiiTokenSelectPatched === 'true') return false; const path = element.getAttribute?.(LEGACY_ATTR) || element.getAttribute?.(NATIVE_ATTR) || ''; return [PATHS.lineKey, PATHS.size, PATHS.pipingClass].includes(path); }
function patchOne(element) {
  if (!shouldPatchElement(element)) return false;
  const path = element.getAttribute(LEGACY_ATTR) || element.getAttribute(NATIVE_ATTR);
  const root = element.closest?.('.model-converters-workflow-popup-overlay, [data-xml-cii-workflow-root], body') || document;
  const sample = fieldValue(root, PATHS.sample, '/ASIM-1885-10"-S8810101-91261M7-HC/B1');
  const delimiter = fieldValue(root, PATHS.delimiter, '-');
  const tokens = tokenizeBranchName(sample, delimiter);
  if (!tokens.length) return false;

  const { config } = readSupportConfig();
  const configured = getPath(config, path, element.value || '') || element.value || '';
  const selected = correctedPosition(path, tokens, configured);
  const attrName = pathAttr(element);
  const select = document.createElement('select');
  select.className = element.className || 'mc-regex-pos-input';
  select.setAttribute(attrName, path);
  select.dataset.xmlCiiTokenSelectPatched = 'true';
  select.title = 'Select Branchname token position';
  select.innerHTML = optionHtml(tokens, selected);
  if (element.style?.cssText) select.style.cssText = element.style.cssText;
  select.style.minWidth = select.style.minWidth || '150px';
  select.addEventListener('change', () => { persistPosition(path, select.value); setSiblingPreview(select, tokens); try { select.dispatchEvent(new Event('input', { bubbles: true })); } catch {} });
  element.replaceWith(select);
  setSiblingPreview(select, tokens);

  if (normalizePositionValue(configured) !== selected) {
    setTimeout(() => { persistPosition(path, selected); try { select.dispatchEvent(new Event('change', { bubbles: true })); } catch {} }, 0);
  }
  return true;
}
function patchRoot(root = document) { const scope = root?.querySelectorAll ? root : document; let changed = false; scope.querySelectorAll?.(`[${LEGACY_ATTR}="${PATHS.lineKey}"], [${NATIVE_ATTR}="${PATHS.lineKey}"], [${LEGACY_ATTR}="${PATHS.size}"], [${NATIVE_ATTR}="${PATHS.size}"], [${LEGACY_ATTR}="${PATHS.pipingClass}"], [${NATIVE_ATTR}="${PATHS.pipingClass}"]`).forEach((element) => { if (patchOne(element)) changed = true; }); return changed; }
function bindRefreshEvents(container) { container.addEventListener('change', (event) => { const path = event.target?.getAttribute?.(LEGACY_ATTR) || event.target?.getAttribute?.(NATIVE_ATTR) || ''; if ([PATHS.sample, PATHS.delimiter, PATHS.lineKey, PATHS.size, PATHS.pipingClass].includes(path)) setTimeout(() => patchRoot(document), 0); }, true); }

export function installXmlCiiLineKeySelectPatch(container = document) {
  if (!browserReady()) return;
  const root = container && container.nodeType === 1 ? container : document;
  if (!window[FLAG]) window[FLAG] = { observer: null, bound: new WeakSet() };
  if (!window[FLAG].bound.has(root)) { bindRefreshEvents(root); window[FLAG].bound.add(root); }
  patchRoot(root); setTimeout(() => patchRoot(document), 0); setTimeout(() => patchRoot(document), 250); setTimeout(() => patchRoot(document), 750);
  if (!window[FLAG].observer) {
    let timer = null;
    window[FLAG].observer = new MutationObserver(() => { if (timer) return; timer = setTimeout(() => { timer = null; patchRoot(document); }, 50); });
    window[FLAG].observer.observe(document.body, { childList: true, subtree: true });
  }
}
