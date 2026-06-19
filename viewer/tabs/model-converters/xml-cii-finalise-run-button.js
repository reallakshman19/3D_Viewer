const FLAG = '__xmlCiiFinaliseRunButton_v1';
const DIRECT_RUN_FLAG = '__xmlCiiConversionWorkflowAllowDirectRun';
const BUTTON_TEXT = 'Finalise and Run';

function ready() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function text(node) {
  return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
}

function isWorkflowArea(node) {
  const areaText = text(node);
  return /XML\s*[→-]\s*CII|XML-&gt;CII|CII\s*\(2019\)|Output\s*\/\s*Run|\bRun\b/i.test(areaText);
}

function directRun(root = document) {
  const runButton = root.querySelector?.('#model-converters-run') || document.querySelector('#model-converters-run');
  if (!runButton) return false;

  window[DIRECT_RUN_FLAG] = true;
  try {
    runButton.click();
  } finally {
    setTimeout(() => {
      window[DIRECT_RUN_FLAG] = false;
    }, 0);
  }
  return true;
}

function makeFinaliseButton(root = document) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'model-converters-run-btn';
  button.dataset.directRunConversion = 'true';
  button.dataset.xmlCiiFinaliseRun = 'true';
  button.textContent = BUTTON_TEXT;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    directRun(root);
  });
  return button;
}

function normaliseExistingButtons(root = document) {
  root.querySelectorAll?.('[data-direct-run-conversion], [data-xml-cii-finalise-run]').forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    button.textContent = BUTTON_TEXT;
    button.classList.add('model-converters-run-btn');
    button.dataset.xmlCiiFinaliseRun = 'true';
  });
}

function findRunActionsHost(root = document) {
  const titles = Array.from(root.querySelectorAll?.('.model-converters-workflow-detail-title, .model-converters-workflow-section-title') || []);

  const runTitle = titles.find((node) => /Output\s*\/\s*Run|^Run$|Run\s*\/\s*refresh/i.test(text(node)));
  if (runTitle) {
    const card = runTitle.closest?.('.model-converters-workflow-master-card') || runTitle.parentElement;
    const buttonRow = card?.querySelector?.('div[style*="display:flex"], .model-converters-workflow-actions');
    if (buttonRow) return buttonRow;
    if (card) return card;
  }

  const body = root.querySelector?.('[data-model-subtab-body], [data-old-xml-cii-phase-body]');
  if (body && isWorkflowArea(body)) return body;

  return null;
}

function ensureFinaliseButton(root = document) {
  if (!ready()) return;
  const scope = root?.querySelector?.('[data-xml-cii-workflow-root], .workflow-modal, [data-model-subtab-body], [data-old-xml-cii-phase-body]') || root || document;
  normaliseExistingButtons(scope);

  const host = findRunActionsHost(scope);
  if (!host) return;
  if (host.querySelector?.('[data-xml-cii-finalise-run]')) return;

  const button = makeFinaliseButton(root);
  host.insertBefore(button, host.firstChild || null);
}

function install() {
  if (!ready()) return;
  if (window[FLAG]) return;
  window[FLAG] = true;

  const tick = () => ensureFinaliseButton(document);
  setTimeout(tick, 0);
  setTimeout(tick, 150);
  setTimeout(tick, 600);
  setInterval(tick, 1000);

  document.addEventListener('click', (event) => {
    const tab = event.target?.closest?.('[data-model-subtab], [data-old-xml-cii-phase]');
    if (!tab) return;
    setTimeout(tick, 0);
    setTimeout(tick, 100);
  }, true);

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-xml-cii-finalise-run]');
    if (!button) return;
    if (button.dataset.finaliseRunOwnHandler === 'true') return;
    event.preventDefault();
    event.stopPropagation();
    directRun(document);
  }, true);
}

install();

export { ensureFinaliseButton };
