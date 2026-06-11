import { installPsMappingUtilityTile as installBasePsMappingUtilityTile } from './ps-mapping-utility-tab.js?v=20260611-psmap-support-audit-dominance-1';

const supportOptionState = {
  useBuiltInSupportKeywordLogic: true,
  treatAnchorAsLineStop: true,
};

function schedulePatch(patch) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      patch();
    });
  };
}

function patchSupportConfigControls() {
  const panel = document.querySelector('[data-psmap-panel="config"]');
  if (!panel) return;
  if (panel.querySelector('[data-psmap-support-config]')) return;

  const firstGrid = panel.querySelector('.psmap-grid-2');
  const host = document.createElement('div');
  host.className = 'psmap-grid-2';
  host.setAttribute('data-psmap-support-config', '1');
  host.innerHTML = `
    <label class="psmap-check">
      <input type="checkbox" data-psmap-setup="useBuiltInSupportKeywordLogic" ${supportOptionState.useBuiltInSupportKeywordLogic ? 'checked' : ''}>
      Use built-in support keyword logic
      <span class="psmap-help" title="Recognizes REST, GUIDE, LINE STOP, LINESTOP, STOP, PIPE STOP, ANCHOR and PIPE ANCHOR in both Table-1C ISONOTE and Table-2 DTXR.">i</span>
    </label>
    <label class="psmap-check">
      <input type="checkbox" data-psmap-setup="treatAnchorAsLineStop" ${supportOptionState.treatAnchorAsLineStop ? 'checked' : ''}>
      Treat Anchor as Line Stop
      <span class="psmap-help" title="When ON, DTXR values such as Anchor or Pipe Anchor are normalized to LINE_STOP / STOP for support matching and missing-support audit.">i</span>
    </label>`;

  if (firstGrid?.nextSibling) firstGrid.parentNode.insertBefore(host, firstGrid.nextSibling);
  else panel.querySelector('.psmap-card-body')?.appendChild(host);
}

function readValidatorDtxrMap() {
  const map = new Map();
  const table = document.querySelector('[data-psmap-panel="validator"] table.psmap-table');
  if (!table) return map;
  const labels = Array.from(table.querySelectorAll('thead tr.psmap-labels th')).map((th) => th.textContent.trim());
  const psIndex = labels.indexOf('PSNO_Model');
  const dtxrIndex = labels.indexOf('T2 DTXR');
  if (psIndex < 0 || dtxrIndex < 0) return map;
  for (const row of table.querySelectorAll('tbody tr')) {
    const cells = row.children;
    const psno = cells[psIndex]?.textContent?.trim();
    const dtxr = cells[dtxrIndex]?.textContent?.trim();
    if (psno && dtxr && !map.has(psno)) map.set(psno, dtxr);
  }
  return map;
}

function patchCandidateDtxrColumn() {
  const table = document.querySelector('[data-psmap-panel="candidates"] table.psmap-table');
  if (!table) return;
  const labelsRow = table.querySelector('thead tr.psmap-labels');
  if (!labelsRow) return;
  const labels = Array.from(labelsRow.children).map((th) => th.textContent.trim());
  if (labels.includes('T2 DTXR')) return;

  const psIndex = labels.indexOf('PSNO_Model');
  const insertAfter = labels.indexOf('T2 Line Family');
  if (psIndex < 0 || insertAfter < 0) return;

  const groupRow = table.querySelector('thead tr.psmap-group');
  const t2Group = Array.from(groupRow?.children || []).find((th) => th.textContent.trim() === 'Table-2 Source');
  if (t2Group) t2Group.colSpan = Number(t2Group.colSpan || 1) + 1;

  const th = document.createElement('th');
  th.textContent = 'T2 DTXR';
  labelsRow.children[insertAfter].after(th);

  const dtxrByPs = readValidatorDtxrMap();
  for (const row of table.querySelectorAll('tbody tr')) {
    const cells = row.children;
    const psno = cells[psIndex]?.textContent?.trim();
    const td = document.createElement('td');
    td.className = cells[insertAfter]?.className || 'group-source';
    td.textContent = dtxrByPs.get(psno) || '';
    cells[insertAfter]?.after(td);
  }
}

function installPsMappingSupportUiBridge() {
  const patch = () => {
    patchSupportConfigControls();
    patchCandidateDtxrColumn();
  };
  const runPatch = schedulePatch(patch);
  const observer = new MutationObserver(runPatch);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('change', onSupportOptionChange, true);
  runPatch();
  return () => {
    observer.disconnect();
    document.removeEventListener('change', onSupportOptionChange, true);
  };
}

function onSupportOptionChange(event) {
  const target = event.target;
  const key = target?.dataset?.psmapSetup;
  if (key === 'useBuiltInSupportKeywordLogic' || key === 'treatAnchorAsLineStop') {
    supportOptionState[key] = target.checked === true;
  }
}

export function installPsMappingUtilityTile(container, ctx = {}) {
  const destroyBase = installBasePsMappingUtilityTile(container, ctx);
  const destroyBridge = installPsMappingSupportUiBridge();
  return () => {
    try { destroyBridge?.(); } catch {}
    try { destroyBase?.(); } catch {}
  };
}
