const VERSION = '20260626-rvm-viewport-first-spacing-2';
const PREVIOUS_VERSION = '20260626-rvm-viewport-first-spacing-1';
const INSTALL_FLAG = Symbol.for('pcf-glb-rvm-viewport-first-spacing-2');
const STYLE_ID = 'rvm-viewport-first-spacing-style';
const GLOBAL_KEY = '__PCF_GLB_RVM_VIEWPORT_FIRST_SPACING__';

export function installRvmViewportFirstSpacingBridge() {
  if (typeof document === 'undefined') return null;
  if (globalThis[INSTALL_FLAG]) return globalThis[INSTALL_FLAG];
  injectStyles();
  const state = {
    version: VERSION,
    previousVersion: PREVIOUS_VERSION,
    styleId: STYLE_ID,
    scopedRootSelector: '[data-rvm-viewer]',
    rootCause: 'viewer3d.css .geo-top-ribbon justify-content:space-between inherited by RVM tab',
    getDiagnostics: () => ({
      version: VERSION,
      previousVersion: PREVIOUS_VERSION,
      stylePresent: Boolean(document.getElementById(STYLE_ID)),
      scopedRootSelector: '[data-rvm-viewer]',
      toolbarPackedLeft: true,
      landingPageTouched: false,
      mainRibbonTouched: false,
    }),
  };
  globalThis[INSTALL_FLAG] = state;
  globalThis[GLOBAL_KEY] = state;
  return state;
}

function injectStyles() {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.dataset.rvmViewportFirstSpacing = VERSION;
  style.dataset.rvmViewportFirstPrevious = PREVIOUS_VERSION;
  style.textContent = `
    [data-rvm-viewer]{--rvm-chrome-gap:2px;--rvm-panel-pad-x:7px;--rvm-panel-pad-y:4px;}
    [data-rvm-viewer] .rvm-capability-banner{padding:2px 10px;font-size:10.5px;line-height:1.25;}
    [data-rvm-viewer] .geo-top-ribbon{display:flex;justify-content:flex-start!important;align-items:center;align-content:flex-start;gap:4px;padding:3px 6px;flex-wrap:wrap;}
    [data-rvm-viewer] .rvm-ribbon-section{gap:2px;min-height:0;flex:0 0 auto;}
    [data-rvm-viewer] .rvm-ribbon-load{order:1;}
    [data-rvm-viewer] .rvm-ribbon-navigate-view{order:2;}
    [data-rvm-viewer] .rvm-ribbon-review{order:3;}
    [data-rvm-viewer] .rvm-toolbar-more{order:4;margin-left:4px!important;flex:0 0 auto;}
    [data-rvm-viewer] .mode-chip{order:5;margin-left:8px;min-height:22px;padding:2px 7px;font-size:10px;line-height:1.2;flex:0 0 auto;}
    [data-rvm-viewer] .rvm-ribbon-label{font-size:9.5px;line-height:1.1;}
    [data-rvm-viewer] .rvm-ribbon-button-row{gap:3px;}
    [data-rvm-viewer] .rvm-btn,[data-rvm-viewer] .rvm-tool-btn{min-height:24px;padding:3px 6px;font-size:10.5px;line-height:1.1;border-radius:4px;}
    [data-rvm-viewer] .rvm-tool-btn.is-icon-only{width:27px;min-width:27px;height:24px;padding:2px 4px;}
    [data-rvm-viewer] .rvm-status-strip{display:flex;justify-content:flex-start;flex-wrap:wrap;gap:3px;padding:2px 6px;min-height:24px;align-items:center;border-bottom:1px solid rgba(148,163,184,.16);}
    [data-rvm-viewer] .rvm-status-chip{padding:2px 6px;font-size:10px;line-height:1.2;border-radius:999px;white-space:nowrap;}
    [data-rvm-viewer] .rvm-body{min-height:0;gap:0;}
    [data-rvm-viewer] .rvm-left-panel{width:208px;min-width:176px;max-width:292px;}
    [data-rvm-viewer] .rvm-right-panel{width:232px;min-width:190px;max-width:540px;}
    [data-rvm-viewer] .rvm-panel-header{padding:4px 8px;font-size:10px;line-height:1.2;}
    [data-rvm-viewer] .rvm-panel-filter-row{gap:4px;padding:4px 6px;}
    [data-rvm-viewer] .rvm-object-browser-quick-filters{display:grid;grid-template-columns:1fr 72px 78px;align-items:center;}
    [data-rvm-viewer] .rvm-panel-filter,[data-rvm-viewer] .rvm-tag-severity-filter{font-size:10px;padding:2px 5px;min-height:22px;}
    [data-rvm-viewer] .rvm-object-browser-summary{padding:2px 7px;font-size:10px;line-height:1.2;color:var(--geo-text-muted,#888);border-bottom:1px solid rgba(148,163,184,.12);}
    [data-rvm-viewer] .rvm-tree{padding:2px 0;font-size:11px;}
    [data-rvm-viewer] .rvm-tree li{padding:2px 8px;}
    [data-rvm-viewer] .rvm-tree-node{min-height:22px;}
    [data-rvm-viewer] .rvm-attributes-panel,[data-rvm-viewer] .rvm-tag-list{font-size:11px;padding:2px 0;}
    [data-rvm-viewer] .rvm-attr-row{padding:2px 8px;gap:6px;}
    [data-rvm-viewer] .rvm-attr-key{min-width:72px;}
    [data-rvm-viewer] .rvm-browser-diag-grid{gap:3px;padding:5px;}
    [data-rvm-viewer] .viewer-statusbar{min-height:24px;padding:2px 7px;gap:8px;font-size:10.5px;line-height:1.2;}
    [data-rvm-viewer] .rvm-statusbar-summary{display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden;white-space:nowrap;}
    [data-rvm-viewer] .rvm-statusbar-summary span{min-width:max-content;}
    @media (max-width:1100px){
      [data-rvm-viewer] .rvm-left-panel{width:190px;min-width:164px;}
      [data-rvm-viewer] .rvm-right-panel{width:210px;min-width:180px;}
      [data-rvm-viewer] .rvm-object-browser-quick-filters{grid-template-columns:1fr;}
      [data-rvm-viewer] .rvm-statusbar-summary{gap:4px;}
    }
  `;
}
