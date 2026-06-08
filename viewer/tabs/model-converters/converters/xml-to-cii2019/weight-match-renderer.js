export function renderWeightMatch(container, weightIssues, callbacks) {
  if (!weightIssues || weightIssues.length === 0) {
    container.innerHTML = '<div class="weight-match-empty">No ambiguous weight matches found.</div>';
    return;
  }

  let html = '<div class="weight-match-issues">';
  for (const issue of weightIssues) {
    html += `
      <div class="weight-match-issue">
        <h4>Node ${issue.nodeNumber} (${issue.componentType})</h4>
        <p>Current XML Weight: ${issue.currentWeight}</p>
        <select class="weight-match-select" data-node="${issue.nodeNumber}">
          ${(issue.candidates || []).map(c => `<option value="${c.id}">${c.label}</option>`).join('')}
        </select>
      </div>
    `;
  }
  html += '</div>';

  container.innerHTML = html;

  // Attach safe bounded listeners
  container.querySelectorAll('.weight-match-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const nodeNum = e.target.getAttribute('data-node');
      const val = e.target.value;
      if (callbacks && callbacks.onCandidateSelected) {
        callbacks.onCandidateSelected(nodeNum, val);
      }
    });
  });
}
