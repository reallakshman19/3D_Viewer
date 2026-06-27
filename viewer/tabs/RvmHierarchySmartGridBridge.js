const VERSION = '20260627-rvm-hierarchy-smart-grid-1';
const ROOT_SELECTOR = '[data-rvm-viewer]';
const TREE_SELECTOR = '#rvm-tree';
const INSTALL_KEY = '__PCF_GLB_RVM_HIERARCHY_SMART_GRID__';

export function installRvmHierarchySmartGridBridge() {
  if (typeof document === 'undefined') return null;
  const existing = globalThis[INSTALL_KEY];
  if (existing?.version === VERSION) return existing;
  injectStyles();
  const state = {
    version: VERSION,
    runCount: 0,
    rowCount: 0,
    labelFallbackCount: 0,
    lastReason: 'install',
    observer: null,
    refresh: (reason = 'api') => refreshAll(reason),
  };
  globalThis[INSTALL_KEY] = state;
  const refreshSoon = debounce((reason) => refreshAll(reason), 40);
  state.observer = new MutationObserver(() => refreshSoon('tree-mutation'));
  state.observer.observe(document.documentElement, { childList: true, subtree: true });
  for (const delay of [0, 80, 250, 750, 1500, 3000]) setTimeout(() => refreshAll(`install-${delay}`), delay);
  try { globalThis.addEventListener?.('rvm-model-loaded', () => refreshAll('model-loaded')); } catch (_) {}
  try { document.addEventListener?.('rvm-selection-synced-to-tree', () => refreshAll('selection-sync'), true); } catch (_) {}
  state.dispose = () => {
    state.observer?.disconnect?.();
    if (globalThis[INSTALL_KEY] === state) delete globalThis[INSTALL_KEY];
  };
  return state;
}

function refreshAll(reason = 'manual') {
  const state = globalThis[INSTALL_KEY];
  if (!state) return null;
  let total = 0;
  let fallback = 0;
  for (const root of document.querySelectorAll?.(ROOT_SELECTOR) || []) {
    const tree = root.querySelector?.(TREE_SELECTOR);
    if (!tree) continue;
    const result = normalizeTree(root, tree);
    total += result.rows;
    fallback += result.fallbacks;
    root.dataset.rvmHierarchySmartGrid = VERSION;
    root.dataset.rvmHierarchySmartGridRows = String(result.rows);
    root.dataset.rvmHierarchySmartGridFallbacks = String(result.fallbacks);
  }
  state.runCount += 1;
  state.rowCount = total;
  state.labelFallbackCount = fallback;
  state.lastReason = reason;
  return { version: VERSION, reason, rows: total, fallbacks: fallback };
}

function normalizeTree(root, tree) {
  let rows = 0;
  let fallbacks = 0;
  for (const row of tree.querySelectorAll('li[data-node-id]')) {
    rows += 1;
    row.dataset.rvmSmartHierarchyRow = VERSION;
    const depth = Number(row.dataset.rvmNavisDepth || row.dataset.depth || row.querySelector?.('.rvm-navis-row')?.style?.getPropertyValue?.('--rvm-navis-depth') || 0);
    row.style.setProperty('--rvm-smart-depth', String(Number.isFinite(depth) ? depth : 0));
    const navisRow = row.querySelector(':scope > .rvm-navis-row');
    if (navisRow) {
      navisRow.dataset.rvmSmartHierarchyGrid = VERSION;
      const select = navisRow.querySelector('.rvm-navis-select');
      if (select) select.dataset.rvmSmartSelect = 'true';
      const label = navisRow.querySelector('.rvm-navis-label');
      if (label) {
        const text = cleanText(label.textContent);
        if (!text) {
          label.textContent = fallbackLabel(row);
          fallbacks += 1;
        }
        label.setAttribute('title', label.textContent || row.dataset.nodeId || 'Hierarchy node');
      }
      const kind = navisRow.querySelector('.rvm-kind');
      if (kind) kind.setAttribute('title', kind.textContent || 'Kind');
      const count = navisRow.querySelector('.rvm-tree-count');
      if (count) count.setAttribute('title', `Objects: ${count.textContent || '0'}`);
      continue;
    }
    const legacy = row.querySelector(':scope > .rvm-tree-node');
    if (legacy) {
      legacy.dataset.rvmSmartHierarchyGrid = VERSION;
      let label = legacy.querySelector('[data-rvm-tree-label], .rvm-tree-label');
      if (!label) {
        const spans = [...legacy.querySelectorAll('span')].filter((span) => !span.classList.contains('rvm-kind') && !span.classList.contains('rvm-tree-count'));
        label = spans[0] || null;
      }
      if (label) {
        label.classList.add('rvm-tree-label');
        label.dataset.rvmTreeLabel = 'true';
        if (!cleanText(label.textContent)) {
          label.textContent = fallbackLabel(row);
          fallbacks += 1;
        }
        label.setAttribute('title', cleanText(label.textContent) || row.dataset.nodeId || 'Hierarchy node');
      }
    }
  }
  return { rows, fallbacks };
}

function fallbackLabel(row) {
  const id = row?.dataset?.nodeId || '';
  const parts = String(id).split('/').map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] || id || 'Hierarchy node';
}

function cleanText(value) {
  return String(value || '').replace(/\b(On|Off)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

function debounce(fn, wait) {
  let timer = 0;
  return (reason) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(reason), wait);
  };
}

function injectStyles() {
  let style = document.getElementById('rvm-hierarchy-smart-grid-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'rvm-hierarchy-smart-grid-style';
    document.head.appendChild(style);
  }
  style.dataset.rvmHierarchySmartGrid = VERSION;
  style.textContent = `
    [data-rvm-viewer] .rvm-left-panel{width:clamp(360px,30vw,560px);min-width:320px;max-width:min(620px,46vw);resize:horizontal;overflow:auto;scrollbar-gutter:stable;}
    [data-rvm-viewer] #rvm-tree{box-sizing:border-box;max-width:100%;overflow-x:hidden;overflow-y:auto;padding:4px 6px 10px;}
    [data-rvm-viewer] #rvm-tree, [data-rvm-viewer] #rvm-tree *{box-sizing:border-box;}
    [data-rvm-viewer] #rvm-tree li[data-node-id]{max-width:100%;min-width:0;overflow:visible;padding:1px 0;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-row{width:100%;min-width:0;display:grid;grid-template-columns:22px minmax(0,1fr) 34px 34px;gap:4px;align-items:center;padding-left:min(120px,calc(var(--rvm-navis-depth,0) * 12px));}
    [data-rvm-viewer] #rvm-tree .rvm-navis-expander{grid-column:1;width:20px;min-width:20px;height:20px;padding:0;display:grid;place-items:center;border-radius:4px;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-select{grid-column:2;min-width:0;width:100%;height:24px;display:grid;grid-template-columns:18px minmax(46px,max-content) minmax(0,1fr) minmax(24px,max-content);align-items:center;gap:5px;padding:2px 6px;border-radius:5px;text-align:left;overflow:hidden;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-icon{width:16px;min-width:16px;text-align:center;opacity:.9;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-select .rvm-kind{min-width:0;max-width:86px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;color:#93c5fd;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#dbeafe;}
    [data-rvm-viewer] #rvm-tree .rvm-tree-count{justify-self:end;min-width:18px;max-width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#bfdbfe;font-size:10px;text-align:right;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-branch-off,[data-rvm-viewer] #rvm-tree .rvm-navis-branch-on{width:32px;min-width:32px;height:22px;padding:0 3px;font-size:10px;border-radius:5px;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-branch-off{grid-column:3;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-branch-on{grid-column:4;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-children{width:100%;min-width:0;margin:2px 0 0 0;padding-left:0;border-left:0;}
    [data-rvm-viewer] #rvm-tree .rvm-tree-node{width:100%;min-width:0;display:grid;grid-template-columns:minmax(46px,max-content) minmax(0,1fr) minmax(24px,max-content);gap:5px;align-items:center;overflow:hidden;}
    [data-rvm-viewer] #rvm-tree .rvm-tree-label,[data-rvm-viewer] #rvm-tree [data-rvm-tree-label]{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    [data-rvm-viewer] #rvm-tree .rvm-navis-row.is-selected .rvm-navis-select,[data-rvm-viewer] #rvm-tree li.is-selected > .rvm-tree-node{outline:1px solid rgba(96,165,250,.95);border-color:rgba(96,165,250,.95);background:rgba(37,99,235,.30);box-shadow:inset 3px 0 0 rgba(96,165,250,.95);}
    @media (max-width:1100px){[data-rvm-viewer] .rvm-left-panel{width:clamp(320px,36vw,500px);}[data-rvm-viewer] #rvm-tree .rvm-navis-row{grid-template-columns:20px minmax(0,1fr) 30px 30px;gap:3px;}[data-rvm-viewer] #rvm-tree .rvm-navis-select{grid-template-columns:16px minmax(36px,max-content) minmax(0,1fr) minmax(18px,max-content);gap:4px;padding:2px 4px;}[data-rvm-viewer] #rvm-tree .rvm-navis-branch-off,[data-rvm-viewer] #rvm-tree .rvm-navis-branch-on{width:29px;min-width:29px;font-size:9px;}}
  `;
}
