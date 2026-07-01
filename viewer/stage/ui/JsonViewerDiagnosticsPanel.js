function addMessage(list, className, text) {
  const item = document.createElement('li');
  item.className = className;
  item.textContent = text;
  list.appendChild(item);
}

function mapSummary(title, value) {
  const box = document.createElement('div');
  box.className = 'json-viewer-diagnostics-counts';
  const heading = document.createElement('b');
  heading.textContent = title;
  const rows = Object.entries(value || {});
  const text = document.createElement('span');
  text.textContent = rows.length ? rows.map(([key, count]) => `${key}: ${count}`).join(' · ') : 'none';
  box.append(heading, text);
  return box;
}

function messageText(message) {
  if (!message || typeof message !== 'object') return String(message);
  const code = message.code ? `${message.code}: ` : '';
  return `${code}${message.message || message.text || 'Diagnostic message'}`;
}

export function renderDiagnostics(target, diagnostics, validationErrors = [], renderPlanDiagnostics = [], workerDiagnostics = []) {
  target.replaceChildren();
  const title = document.createElement('h2');
  title.className = 'json-viewer-panel-title';
  title.textContent = 'Diagnostics';

  const summary = document.createElement('div');
  summary.className = 'json-viewer-diagnostics-summary';
  summary.append(
    mapSummary('severityCounts', diagnostics?.severityCounts),
    mapSummary('fallbackCounts', diagnostics?.fallbackCounts),
    mapSummary('renderKindCounts', diagnostics?.renderKindCounts),
  );

  const list = document.createElement('ul');
  list.className = 'json-viewer-diagnostics-list';
  for (const error of validationErrors) addMessage(list, 'is-error', `validation: ${error}`);
  for (const item of workerDiagnostics) addMessage(list, `is-${item.severity || 'info'}`, `worker: ${messageText(item)}`);
  for (const item of renderPlanDiagnostics) addMessage(list, `is-${item.severity || 'warning'}`, `render-plan: ${messageText(item)}`);

  const messages = Array.isArray(diagnostics?.messages) ? diagnostics.messages : [];
  for (const message of messages.slice(0, 40)) {
    const severity = message.severity || 'info';
    addMessage(list, `is-${severity}`, messageText(message));
  }

  if (!validationErrors.length && !workerDiagnostics.length && !renderPlanDiagnostics.length && !messages.length) {
    addMessage(list, 'is-info', diagnostics ? 'No diagnostics messages reported.' : 'Diagnostics summary placeholder');
  }
  target.append(title, summary, list);
}
