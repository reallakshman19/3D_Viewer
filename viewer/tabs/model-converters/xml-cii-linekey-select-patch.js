const FLAG = '__xmlCiiLineKeySelectPatch_v1';
const SUPPORT_CONFIG_SELECTOR = '[data-option-key="supportConfigJson"]';
const LINE_KEY_PATH = 'linelist.lineKeyTokenPositions';
const SAMPLE_PATH = 'linelist.sampleBranchName';
const DELIMITER_PATH = 'linelist.tokenDelimiter';
const LEGACY_ATTR = 'data-xml-cii-regex-path';
const NATIVE_ATTR = 'data-native-regex-path';

function browserReady() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function text(value) {
  return value == null ? '' : String(value);
}

function esc(value) {
  return text(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function attr(value) {
  return esc(value).replaceAll("'", '&#39;');
}

function normalizePositionValue(value) {
  const first = text(value).trim().split(/[,+]/)[0]?.trim() || '';
  const numeric = Number(first);
  return Number.isFinite(numeric) && numeric > 0 ? String(Math.round(numeric)) : '';
}

function tokenizeBranchName(branchName, delimiter = '-') {
  const cleaned = text(branchName).trim().replace(/^\/+/, '').replace(/\/B\d+$/i, '');
  const delim = text(delimiter) || '-';
  return cleaned.split(delim).map((token) => token.trim()).filter(Boolean);
}

function looksLikeNpsSizeToken(value) {
  return /^(?:\d+(?:\.\d+)?|\d+\s*\/\s*\d+)(?:\s*(?:in|inch|"))?$/i.test(text(value).trim());
}

function looksLikeLineKeyToken(value) {
  const token = text(value).trim();
  if (!token || looksLikeNpsSizeToken(token)) return false;
  return /^(?=.*[A-Za-z])(?=.*\d{4,})[A-Za-z][A-Za-z0-9_./]*$/i.test(token);
}

function shiftedLineKeyPosition(tokens, configured) {
  if (!Array.isArray(tokens) || tokens.length < 6) return '';
  const current = normalizePositionValue(configured || '4') || '4';
  const currentToken = tokens[Number(current) - 1] || '';
  if (current !== '4' || !looksLikeNpsSizeToken(currentToken)) return '';
  for (let index = 4; index < tokens.length; index += 1) {
    if (looksLikeLineKeyToken(tokens[index])) return String(index + 1);
  }
  return '';
}

function readSupportConfig() {
  const input = document.querySelector(SUPPORT_CONFIG_SELECTOR);
  try {
    const config = JSON.parse(input?.value || '{}');
    return config && typeof config === 'object' && !Array.isArray(config) ? { input, config } : { input, config: {} };
  } catch {
    return { input, config: {} };
  }
}

function writeSupportConfig(config) {
  const input = document.querySelector(SUPPORT_CONFIG_SELECTOR);
  if (!input || !config || typeof config !== 'object') return false;
  try {
    input.value = JSON.stringify(config, null, 2);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch {
    return false;
  }
}

function pathAttr(element) {
  return element?.getAttribute?.(LEGACY_ATTR) ? LEGACY_ATTR : NATIVE_ATTR;
}

function queryRegexField(root, path) {
  return root?.querySelector?.(`[${LEGACY_ATTR}="${path}"], [${NATIVE_ATTR}="${path}"]`) || null;
}

function fieldValue(root, path, fallback = '') {
  const element = queryRegexField(root, path);
  if (element && 'value' in element && text(element.value).trim()) return text(element.value).trim();
  const { config } = readSupportConfig();
  if (path === SAMPLE_PATH) return text(config.linelist?.sampleBranchName || fallback).trim();
  if (path === DELIMITER_PATH) return text(config.linelist?.tokenDelimiter || fallback).trim();
  if (path === LINE_KEY_PATH) return text(config.linelist?.lineKeyTokenPositions || fallback).trim();
  return fallback;
}

function optionHtml(tokens, selected) {
  const safeSelected = normalizePositionValue(selected) || '4';
  const values = new Set(tokens.map((_, index) => String(index + 1)));
  if (safeSelected && !values.has(safeSelected)) values.add(safeSelected);
  return Array.from(values).sort((a, b) => Number(a) - Number(b)).map((pos) => {
    const token = tokens[Number(pos) - 1] || '(not found)';
    return `<option value="${attr(pos)}" ${pos === safeSelected ? 'selected' : ''}>${esc(pos)} — ${esc(token)}</option>`;
  }).join('');
}

function setSiblingPreview(select, tokens) {
  const position = Number(normalizePositionValue(select.value));
  const token = Number.isFinite(position) ? (tokens[position - 1] || '') : '';
  const row = select.closest('tr');
  const strong = row?.querySelector?.('.mc-regex-preview-cell strong, td:last-child strong') || select.parentElement?.querySelector?.('strong');
  if (strong && token) strong.textContent = token;
}

function persistLineKeyPosition(value) {
  const { config } = readSupportConfig();
  config.linelist = config.linelist && typeof config.linelist === 'object' ? config.linelist : {};
  config.linelist.lineKeyTokenPositions = normalizePositionValue(value) || text(value).trim();
  writeSupportConfig(config);
}

function shouldPatchElement(element) {
  if (!element || element.dataset.xmlCiiLineKeySelectPatched === 'true') return false;
  const path = element.getAttribute?.(LEGACY_ATTR) || element.getAttribute?.(NATIVE_ATTR) || '';
  return path === LINE_KEY_PATH;
}

function patchOne(element) {
  if (!shouldPatchElement(element)) return false;
  const root = element.closest?.('.model-converters-workflow-popup-overlay, [data-xml-cii-workflow-root], body') || document;
  const sample = fieldValue(root, SAMPLE_PATH, '/ASIM-1885-10"-S8810101-91261M7-HC/B1');
  const delimiter = fieldValue(root, DELIMITER_PATH, '-');
  const tokens = tokenizeBranchName(sample, delimiter);
  if (!tokens.length) return false;

  const configured = element.value || fieldValue(root, LINE_KEY_PATH, '4') || '4';
  const shifted = shiftedLineKeyPosition(tokens, configured);
  const selected = shifted || configured;
  const attrName = pathAttr(element);

  const select = document.createElement('select');
  select.className = element.className || 'mc-regex-pos-input';
  select.setAttribute(attrName, LINE_KEY_PATH);
  select.dataset.xmlCiiLineKeySelectPatched = 'true';
  select.title = 'Select Branchname token position for Line Key';
  select.innerHTML = optionHtml(tokens, selected);
  if (element.style?.cssText) select.style.cssText = element.style.cssText;
  select.style.minWidth = select.style.minWidth || '140px';

  select.addEventListener('change', () => {
    persistLineKeyPosition(select.value);
    setSiblingPreview(select, tokens);
    // Legacy Regex phase uses delegated listeners and will re-render from this.
    try { select.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
  });

  element.replaceWith(select);
  setSiblingPreview(select, tokens);

  if (shifted && normalizePositionValue(configured) !== shifted) {
    // Defer so legacy delegated Regex handlers are attached before the synthetic change.
    setTimeout(() => {
      persistLineKeyPosition(shifted);
      try { select.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
    }, 0);
  }
  return true;
}

function patchRoot(root = document) {
  const scope = root?.querySelectorAll ? root : document;
  let changed = false;
  scope.querySelectorAll?.(`[${LEGACY_ATTR}="${LINE_KEY_PATH}"], [${NATIVE_ATTR}="${LINE_KEY_PATH}"]`).forEach((element) => {
    if (patchOne(element)) changed = true;
  });
  return changed;
}

function bindRefreshEvents(container) {
  container.addEventListener('change', (event) => {
    const path = event.target?.getAttribute?.(LEGACY_ATTR) || event.target?.getAttribute?.(NATIVE_ATTR) || '';
    if ([SAMPLE_PATH, DELIMITER_PATH].includes(path)) setTimeout(() => patchRoot(container), 0);
  }, true);
}

export function installXmlCiiLineKeySelectPatch(container = document) {
  if (!browserReady()) return;
  const root = container && container.nodeType === 1 ? container : document;
  if (!window[FLAG]) window[FLAG] = { observer: null, bound: new WeakSet() };
  if (!window[FLAG].bound.has(root)) {
    bindRefreshEvents(root);
    window[FLAG].bound.add(root);
  }
  patchRoot(root);
  setTimeout(() => patchRoot(root), 0);
  setTimeout(() => patchRoot(root), 250);

  if (!window[FLAG].observer) {
    let timer = null;
    window[FLAG].observer = new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        patchRoot(document);
      }, 80);
    });
    window[FLAG].observer.observe(document.body, { childList: true, subtree: true });
  }
}
