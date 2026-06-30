function addMessage(list, className, text) {
  const item = document.createElement('li');
  item.className = className;
  item.textContent = text;
  list.appendChild(item);
}

function severityText(diagnostics) {
  const counts = diagnostics?.severityCounts || {};
  return `info ${counts.info || 0} · warning ${counts.warning || 0} · error ${counts.error || 0}`;
}

export function renderDiagnostics(target, diagnostics, validationErrors = []) {
  target.replaceChildren();
  const title = document.createElement('h2');
  title.className = 'json-viewer-panel-title';
  title.textContent = 'Diagnostics';
  const summary = document.createElement('div');
  summary.className = 'json-viewer-diagnostics-summary';
  summary.textContent = validationErrors.length ? `${validationErrors.length} validation issue(s)` : severityText(diagnostics);

  const list = document.createElement('ul');
  list.className = 'json-viewer-diagnostics-list';
  for (const error of validationErrors) addMessage(list, 'is-error', error);

  const messages = Array.isArray(diagnostics?.messages) ? diagnostics.messages : [];
  for (const message of messages.slice(0, 40)) {
    const severity = message.severity || 'info';
    const text = message.message || message.text || String(message);
    addMessage(list, `is-${severity}`, text);
  }

  if (!validationErrors.length && !messages.length) {
    addMessage(list, 'is-info', diagnostics ? 'No diagnostics messages reported.' : 'Diagnostics summary placeholder');
  }
  target.append(title, summary, list);
}
