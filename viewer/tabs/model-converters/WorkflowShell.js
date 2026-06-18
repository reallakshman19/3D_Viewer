/**
 * WorkflowShell — canonical XML→CII(2019) workflow phase registry.
 *
 * This is the single source of truth for phase IDs, labels, and order.
 * Legacy-adapter.js and future phase renderers import from here rather than
 * defining their own phase arrays.
 *
 * Phase extraction note: after Phase 4 (preview/weight-match split), each
 * phase will supply a `render(context)` and `bind(container, context)` pair
 * exported alongside these definitions.
 */

/**
 * Ordered XML→CII workflow phases.
 *
 * Invariants enforced here:
 *   - "4A Weight Match" (id: weight-match) MUST appear before "5 Run" (id: run).
 *   - No duplicate phase IDs.
 *   - No "9 CII Support Mapping" phase (removed — support mapping is only in
 *     "6 Support Types").
 *
 * @type {ReadonlyArray<{id: string, label: string, summary: string, state: string}>}
 */
export const XML_CII_WORKFLOW_PHASES = Object.freeze([
  {
    id: 'regex',
    label: '1 Regex',
    summary: 'Derive line key, piping class, and size from XML Branchname tokens or regex.',
    state: 'Current',
  },
  {
    id: 'import-masters',
    label: '2 Import Masters',
    summary: 'Load line list, piping class, material map, and valve weight sources.',
    state: 'Current',
  },
  {
    id: 'preview',
    label: '3 Preview',
    summary: 'Dry-run enrichment preview per branch \u2014 inspect and override approximate matches.',
    state: 'Current',
  },
  {
    id: 'diagnostics',
    label: '4 Diagnostics',
    summary: 'Run Dry Run to inspect enrichment data before committing to the full run.',
    state: 'Current',
  },
  {
    id: 'weight-match',
    label: '4A Weight Match',
    summary: 'Review approximate component weights matched by bore, rating, and length, then Finalize and Run.',
    state: 'Current',
  },
  {
    id: 'run',
    label: '5 Run',
    summary: 'Run the conversion \u2014 generates enriched XML and final CII output.',
    state: 'Current',
  },
  {
    id: 'support-mapper',
    label: '6 Support Types',
    summary: 'Map ATT/RVM fields to CII support kinds for enrichment and 3D symbol rendering.',
    state: 'Current',
  },
  {
    id: 'config',
    label: '7 Config',
    summary: 'Edit all enrichment configuration fields and export/import the JSON config.',
    state: 'Current',
  },
]);

/**
 * Validate and normalise a phase ID against the canonical list.
 * Returns the given ID if valid, or the first phase ID as fallback.
 *
 * @param {string} phaseId
 * @returns {string}
 */
export function normalizeWorkflowPhaseId(phaseId) {
  const id = String(phaseId || '').trim();
  if (XML_CII_WORKFLOW_PHASES.some((p) => p.id === id)) return id;
  return XML_CII_WORKFLOW_PHASES[0]?.id || 'regex';
}

/**
 * Look up a phase definition by ID.
 *
 * @param {string} id
 * @returns {{id: string, label: string, summary: string, state: string}|undefined}
 */
export function getWorkflowPhase(id) {
  return XML_CII_WORKFLOW_PHASES.find((p) => p.id === id);
}

/**
 * Assert phase ordering invariants at import time so any regression is caught
 * during module load rather than at runtime.
 */
(function _assertPhaseOrder() {
  const ids = XML_CII_WORKFLOW_PHASES.map((p) => p.id);
  const weightMatchIdx = ids.indexOf('weight-match');
  const runIdx = ids.indexOf('run');
  if (weightMatchIdx === -1 || runIdx === -1 || weightMatchIdx >= runIdx) {
    throw new Error(
      '[WorkflowShell] Phase ordering violation: "4A Weight Match" must appear before "5 Run".',
    );
  }
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`[WorkflowShell] Duplicate workflow phase ID: "${id}".`);
    seen.add(id);
  }
})();
