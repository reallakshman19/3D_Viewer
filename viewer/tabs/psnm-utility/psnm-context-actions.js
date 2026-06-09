// Contextual action visibility for the native PSNM v6 workbench.
// No observers and no DOM rewriting: this only scopes the always-visible statusbar buttons by active tab.

const STYLE_ID = 'psnm-context-actions-style';

function installContextActionStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
/* Default: bottom statusbar action buttons are hidden until their active tab context allows them. */
.psnm-modal .psnm-statusbar [data-psnm-action="resolveMasters"],
.psnm-modal .psnm-statusbar [data-psnm-action="runMatch"]{
  display:none!important;
}

/* Source tab: resolving/rebuilding source-to-master tables is relevant. */
.psnm-modal:has([data-psnm-tab="source"].active) .psnm-statusbar [data-psnm-action="resolveMasters"]{
  display:inline-flex!important;
}

/* Master tab: rebuilding masters is relevant; matching is not. */
.psnm-modal:has([data-psnm-tab="master"].active) .psnm-statusbar [data-psnm-action="resolveMasters"]{
  display:inline-flex!important;
}

/* Setup tab: matching is relevant after anchor/setup review. */
.psnm-modal:has([data-psnm-tab="setup"].active) .psnm-statusbar [data-psnm-action="runMatch"]{
  display:inline-flex!important;
}
`;
  document.head.appendChild(style);
}

installContextActionStyle();

export function PSNM_contextActionsInstalled() {
  return true;
}
