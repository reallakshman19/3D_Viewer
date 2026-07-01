const QUALITY_LABELS = [
  ['full', 'Full'],
  ['medium', 'Medium'],
  ['light', 'Light'],
  ['skeleton', 'Skeleton'],
  ['hidden', 'Hidden'],
];

function el(tag, className, text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(className, text, action) {
  const node = el('button', className, text);
  node.type = 'button';
  if (action) node.dataset.action = action;
  return node;
}

function statusChip() {
  return el('span', 'json-viewer-status-chip');
}

export function createJsonViewerShell(root) {
  root.classList.add('json-viewer-tab-root');
  const shell = el('section', 'json-viewer-shell');
  shell.setAttribute('aria-label', '3D Json Viewer');

  const toolbar = el('header', 'json-viewer-toolbar');
  const openStageButton = button('json-viewer-button is-primary', 'Open Stage JSON', 'open-stage-json');
  const loadSampleButton = button('json-viewer-button', 'Load Sample', 'load-sample');
  const fileInput = el('input', 'json-viewer-file-input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.hidden = true;

  const openRvmButton = button('json-viewer-button', 'Open RVM', 'open-rvm');
  openRvmButton.title = 'Open RVM through staged parser handoff when available; diagnostics are shown for unsupported binaries';
  const rvmFileInput = el('input', 'json-viewer-file-input');
  rvmFileInput.type = 'file';
  rvmFileInput.accept = '.rvm';
  rvmFileInput.hidden = true;

  const qualityLabel = el('label', 'json-viewer-quality-label', 'Render Quality');
  const qualitySelect = el('select', 'json-viewer-quality-select');
  qualitySelect.dataset.action = 'render-quality';
  for (const [value, text] of QUALITY_LABELS) {
    const option = el('option', '', text);
    option.value = value;
    qualitySelect.appendChild(option);
  }
  qualityLabel.appendChild(qualitySelect);

  const fitButton = button('json-viewer-button', 'Fit', 'fit');
  const resetButton = button('json-viewer-button', 'Reset', 'reset');
  const diagnosticsButton = button('json-viewer-button', 'Diagnostics', 'show-diagnostics');
  toolbar.append(openStageButton, loadSampleButton, fileInput, openRvmButton, rvmFileInput, qualityLabel, fitButton, resetButton, diagnosticsButton);

  const body = el('div', 'json-viewer-body');
  const leftPanel = el('aside', 'json-viewer-left-panel');
  leftPanel.append(el('h2', 'json-viewer-panel-title', 'Hierarchy'));
  const hierarchyList = el('div', 'json-viewer-hierarchy-list');
  hierarchyList.setAttribute('role', 'tree');
  leftPanel.appendChild(hierarchyList);

  const centerPanel = el('main', 'json-viewer-center-panel');
  const canvasHost = el('div', 'json-viewer-canvas-host');
  canvasHost.setAttribute('aria-label', '3D canvas host placeholder');
  const canvasMessage = el('div', 'json-viewer-canvas-message');
  canvasHost.appendChild(canvasMessage);
  centerPanel.appendChild(canvasHost);

  const rightPanel = el('aside', 'json-viewer-right-panel');
  const tabs = el('div', 'json-viewer-right-tabs');
  const propertiesTab = button('json-viewer-right-tab is-active', 'Properties', 'right-properties');
  propertiesTab.dataset.panel = 'properties';
  const diagnosticsTab = button('json-viewer-right-tab', 'Diagnostics', 'right-diagnostics');
  diagnosticsTab.dataset.panel = 'diagnostics';
  tabs.append(propertiesTab, diagnosticsTab);
  const propertiesPanel = el('div', 'json-viewer-properties-panel');
  const diagnosticsPanel = el('div', 'json-viewer-diagnostics-panel');
  rightPanel.append(tabs, propertiesPanel, diagnosticsPanel);

  body.append(leftPanel, centerPanel, rightPanel);

  const status = el('footer', 'json-viewer-status-strip');
  const statusText = el('span', 'json-viewer-status-text', 'Ready');
  const schemaText = statusChip();
  const sourceText = statusChip();
  const nodeText = statusChip();
  const componentText = statusChip();
  const primitiveText = statusChip();
  const diagnosticsText = statusChip();
  const qualityText = statusChip();
  const planEntryText = statusChip();
  const planDiagnosticText = statusChip();
  status.append(statusText, schemaText, sourceText, nodeText, componentText, primitiveText, diagnosticsText, qualityText, planEntryText, planDiagnosticText);

  shell.append(toolbar, body, status);
  root.replaceChildren(shell);

  return {
    shell,
    toolbar,
    openStageButton,
    loadSampleButton,
    fileInput,
    openRvmButton,
    rvmFileInput,
    qualitySelect,
    fitButton,
    resetButton,
    diagnosticsButton,
    hierarchyList,
    canvasHost,
    canvasMessage,
    rightPanel,
    propertiesTab,
    diagnosticsTab,
    propertiesPanel,
    diagnosticsPanel,
    statusText,
    schemaText,
    sourceText,
    nodeText,
    primitiveText,
    componentText,
    diagnosticsText,
    qualityText,
    planEntryText,
    planDiagnosticText,
  };
}
