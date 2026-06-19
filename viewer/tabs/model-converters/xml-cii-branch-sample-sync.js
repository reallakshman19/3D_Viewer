const FLAG = '__xmlCiiBranchSampleSync_v1';
const BRANCH_SAMPLE_KEY = 'xmlCii2019.regex.branchNameSampleFromXml.v1';
const FILE_KEY = 'xmlCii2019.regex.branchNameSampleFileKey.v1';
const ROOT_ATTR = 'data-xml-cii-workflow-root';

function browserReady() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function text(value) {
  return value == null ? '' : String(value);
}

function clean(value) {
  return text(value).replace(/\s+/g, ' ').trim();
}

function readStored(key, fallback = '') {
  try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function writeStored(key, value) {
  try { window.localStorage.setItem(key, value); } catch {}
}

function normalizeBranchName(value) {
  const candidate = clean(value)
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .replace(/^['"]|['"]$/g, '')
    .trim();
  if (!candidate) return '';
  if (candidate.length < 2 || candidate.length > 220) return '';
  if (/[<>]/.test(candidate)) return '';
  if (/^(branch|branches|branchname|name)$/i.test(candidate)) return '';
  return candidate;
}

function localName(node) {
  return clean(node?.localName || node?.nodeName).replace(/^.*:/, '');
}

function attrValue(element, names) {
  if (!element?.attributes) return '';
  for (const name of names) {
    const direct = element.getAttribute?.(name);
    const normalized = normalizeBranchName(direct);
    if (normalized) return normalized;
  }
  for (const attr of Array.from(element.attributes || [])) {
    if (names.some((name) => name.toLowerCase() === attr.name.toLowerCase())) {
      const normalized = normalizeBranchName(attr.value);
      if (normalized) return normalized;
    }
  }
  return '';
}

function extractBranchNameFromDom(xmlText) {
  if (typeof DOMParser === 'undefined') return '';
  try {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.querySelector?.('parsererror')) return '';
    const attrNames = ['Branchname', 'BranchName', 'BRANCHNAME', 'branchname', 'NAME', 'Name', 'name', 'REF', 'Ref', 'ref'];

    for (const element of Array.from(doc.getElementsByTagName('*'))) {
      const name = localName(element).toLowerCase();
      if (name === 'branchname' || name === 'branch-name') {
        const normalized = normalizeBranchName(element.textContent);
        if (normalized) return normalized;
      }
    }

    for (const element of Array.from(doc.getElementsByTagName('*'))) {
      const name = localName(element).toLowerCase();
      if (name === 'branch' || name.endsWith('branch') || name.includes('branch')) {
        const fromAttr = attrValue(element, attrNames);
        if (fromAttr) return fromAttr;
        if (element.children?.length === 0) {
          const fromText = normalizeBranchName(element.textContent);
          if (fromText) return fromText;
        }
      }
    }
  } catch {}
  return '';
}

function extractBranchNameByRegex(xmlText) {
  const raw = text(xmlText);
  const patterns = [
    /<\s*[^>]*BranchName[^>]*>\s*([^<]{2,220})\s*<\s*\/\s*[^>]*BranchName\s*>/i,
    /<\s*[^>]*Branchname[^>]*>\s*([^<]{2,220})\s*<\s*\/\s*[^>]*Branchname\s*>/i,
    /<\s*[^>]*\bBranch\b[^>]*(?:Branchname|BranchName|BRANCHNAME|NAME|Name|name|REF|Ref|ref)\s*=\s*['"]([^'"]{2,220})['"][^>]*>/i,
    /\b(?:Branchname|BranchName|BRANCHNAME)\s*=\s*['"]([^'"]{2,220})['"]/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    const normalized = normalizeBranchName(match?.[1]);
    if (normalized) return normalized;
  }
  return '';
}

export function extractXmlCiiBranchSample(xmlText) {
  return extractBranchNameFromDom(xmlText) || extractBranchNameByRegex(xmlText);
}

function primaryXmlInput(root) {
  return root?.querySelector?.('#model-converters-primary-input') || document.querySelector('#model-converters-primary-input');
}

function currentFileKey(file) {
  return file ? `${file.name}|${file.size}|${file.lastModified}` : '';
}

function setElementValue(element, value) {
  if (!element || !value) return false;
  if ('value' in element) element.value = value;
  else element.textContent = value;
  try {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } catch {}
  return true;
}

function findLabelBoundControl(label) {
  const labelText = clean(label?.textContent).toLowerCase();
  if (!labelText.includes('sample') || !labelText.includes('branch')) return null;
  const forId = label.getAttribute?.('for');
  if (forId) {
    const byFor = document.getElementById(forId);
    if (byFor) return byFor;
  }
  return label.querySelector?.('input,textarea,[contenteditable="true"]') || null;
}

function isInsideWorkflowPopup(node) {
  return Boolean(node?.closest?.('.model-converters-workflow-popup-overlay'));
}

function branchSampleTargets(root) {
  const scope = root?.querySelectorAll ? root : document;
  const targets = new Set();
  scope.querySelectorAll?.('[data-option-key="branchNameSample"], [name="branchNameSample"], #branchNameSample, #xml-cii-branchname-sample, #xml-cii-branch-name-sample')
    .forEach((node) => { if (!isInsideWorkflowPopup(node)) targets.add(node); });
  scope.querySelectorAll?.('label').forEach((label) => {
    if (isInsideWorkflowPopup(label)) return;
    const control = findLabelBoundControl(label);
    if (control) targets.add(control);
  });
  return Array.from(targets);
}

function writeSupportConfigBranchSample(root, value) {
  const input = root?.querySelector?.('[data-option-key="supportConfigJson"]') || document.querySelector('[data-option-key="supportConfigJson"]');
  if (!input || !value) return false;
  try {
    const cfg = JSON.parse(input.value || '{}') || {};
    cfg.regex = cfg.regex && typeof cfg.regex === 'object' ? cfg.regex : {};
    cfg.regex.branchNameSample = value;
    input.value = JSON.stringify(cfg, null, 2);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch {
    return false;
  }
}

function applyBranchSample(root = document, value = readStored(BRANCH_SAMPLE_KEY, '')) {
  const sample = normalizeBranchName(value);
  if (!sample) return 0;
  writeStored(BRANCH_SAMPLE_KEY, sample);
  const scope = root?.querySelectorAll ? root : document;
  if (scope !== document) scope.setAttribute?.(ROOT_ATTR, 'true');
  let updated = 0;
  for (const target of branchSampleTargets(scope)) {
    if (setElementValue(target, sample)) updated += 1;
  }
  writeSupportConfigBranchSample(scope, sample);
  return updated;
}

async function syncLoadedXmlBranchSample(root = document, force = false) {
  const input = primaryXmlInput(root);
  const file = input?.files?.[0];
  if (!file) {
    applyBranchSample(root);
    return '';
  }
  const key = currentFileKey(file);
  if (!force && key && readStored(FILE_KEY, '') === key && readStored(BRANCH_SAMPLE_KEY, '')) {
    applyBranchSample(root);
    return readStored(BRANCH_SAMPLE_KEY, '');
  }
  const xmlText = await file.text();
  const sample = extractXmlCiiBranchSample(xmlText);
  if (sample) {
    writeStored(FILE_KEY, key);
    applyBranchSample(root, sample);
  }
  return sample;
}

function bindPrimaryInput(root, state) {
  const input = primaryXmlInput(root);
  if (!input || state.primaryInput === input) return;
  state.primaryInput?.removeEventListener?.('change', state.onPrimaryChange);
  state.primaryInput = input;
  state.onPrimaryChange = () => syncLoadedXmlBranchSample(root, true);
  input.addEventListener('change', state.onPrimaryChange);
}

export function installXmlCiiBranchSampleSync(container = document) {
  if (!browserReady()) return;
  const root = container && container.nodeType === 1 ? container : document;
  if (!window[FLAG]) window[FLAG] = { observer: null, stateByRoot: new WeakMap() };
  let state = window[FLAG].stateByRoot.get(root);
  if (!state) {
    state = { primaryInput: null, onPrimaryChange: null };
    window[FLAG].stateByRoot.set(root, state);
  }

  bindPrimaryInput(root, state);
  applyBranchSample(root);
  syncLoadedXmlBranchSample(root).catch(() => {});

  if (!window[FLAG].observer) {
    let _observerDebounceTimer = null;
    window[FLAG].observer = new MutationObserver(() => {
      if (_observerDebounceTimer) return;
      _observerDebounceTimer = setTimeout(() => {
        _observerDebounceTimer = null;
        document.querySelectorAll?.(`[${ROOT_ATTR}]`).forEach((markedRoot) => applyBranchSample(markedRoot));
        applyBranchSample(document);
      }, 200);
    });
    window[FLAG].observer.observe(document.body, { childList: true, subtree: true });
  }

  setTimeout(() => { bindPrimaryInput(root, state); applyBranchSample(root); }, 0);
  setTimeout(() => { bindPrimaryInput(root, state); syncLoadedXmlBranchSample(root).catch(() => {}); }, 150);
}
