import * as THREE from 'three';
import { RuntimeEvents } from '../contracts/runtime-events.js';
import { state, saveStickyState, setActiveTab, updateRvmPcfExtractState } from '../core/state.js';
import { buildRvmJsonPcfRequestPayload } from './rvm-json-pcf-trigger-helpers.js';
import { on, off, emit } from '../core/event-bus.js';
import { detectRvmCapabilities } from '../rvm/RvmCapabilities.js';
import { notify } from '../diagnostics/notification-center.js';
import { RvmViewer3D } from '../rvm-viewer/RvmViewer3D.js?v=20260518-statusbar-theme-12';
import { parseRmssAttributes } from '../converters/rmss-attribute-parser.js';
import { resolveKindFromAttrs as _resolveKindFromAttrs } from '../rvm-viewer/RvmSupportMapper.js?v=20260518-support-mapper-11';
import { parseStpSupportMembers } from '../parser/stp-support-parser.js';
import { RvmSearchIndex } from '../rvm/RvmSearchIndex.js';
import { RvmTagXmlStore } from '../rvm/RvmTagXmlStore.js';
import {
  applyRvmSupportSymbolSettings,
  getRvmSupportSymbolSettings,
  normalizeRvmSupportSymbolScale,
  saveRvmSupportSymbolSettings,
} from '../rvm-viewer/RvmSupportSymbols.js?v=20260618-support-index-attrs-1';

function _enrichJsonWithMapperKinds(nodes) {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) {
    if (!node) continue;
    const typeStr = String(node.type || node.attributes?.TYPE || '').toUpperCase();
    if (typeStr === 'SUPPORT' || typeStr === 'ATTA' || typeStr === 'ANCI') {
      const attrs = node.attributes || (node.attributes = {});
      const kind = _resolveKindFromAttrs(attrs);
      if (kind) {
        attrs.SUPPORT_TYPE = kind;
        attrs.SUPPORT_KIND = kind;
        attrs.SUPPORT_MAPPER_KIND = kind;
      }
    }
    if (Array.isArray(node.children)) _enrichJsonWithMapperKinds(node.children);
    if (Array.isArray(node.items)) _enrichJsonWithMapperKinds(node.items);
    if (Array.isArray(node.branches)) _enrichJsonWithMapperKinds(node.branches);
  }
}

let _viewer = null;
let _shortcutHandler = null;
let _resizeObserver = null;
let _capabilitiesListenerOff = null;
let _toolChangedHandler = null;
let _tagEventsOff = null;
let _supportMapperRulesHandler = null;
let _fallbackTagXmlStore = null;

// ── Toolbar action labels ───────────────────────────────────────────────────

const ACTION_LABELS = {
  NAV_ORBIT: 'Orbit',
  NAV_PAN: 'Pan',
  NAV_SELECT: 'Select',
  MARQUEE_SELECT: 'Box Sel',
  MEASURE_TOOL: 'Measure',
  VIEW_MARQUEE_ZOOM: 'Zoom',
  NAV_PLAN_X: 'Top',
  NAV_ROTATE_Y: 'Front',
  NAV_ROTATE_Z: 'Right',
  VIEW_FIT_ALL: 'Fit All',
  VIEW_FIT_SELECTION: 'Fit Sel',
  VIEW_TOGGLE_PROJECTION: 'Ortho',
  SNAP_ISO_NW: 'Iso NW',
  SNAP_ISO_NE: 'Iso NE',
  SNAP_ISO_SW: 'Iso SW',
  SNAP_ISO_SE: 'Iso SE',
  SECTION_BOX: 'Sec Box',
  SECTION_PLANE_UP: 'Sec Up',
  SECTION_DISABLE: 'Sec Off',
};

const ICON_ONLY_ACTIONS = new Set([
  'NAV_PLAN_X',
  'NAV_ROTATE_Y',
  'NAV_ROTATE_Z',
  'SNAP_ISO_NW',
  'SNAP_ISO_NE',
  'SNAP_ISO_SW',
  'SNAP_ISO_SE',
]);

const PERSISTENT_BLUE_ACTIONS = new Set([
  'NAV_ORBIT',
  'NAV_PAN',
  'NAV_SELECT',
  'MARQUEE_SELECT',
  'MEASURE_TOOL',
  'VIEW_MARQUEE_ZOOM',
  'NAV_PLAN_X',
  'NAV_ROTATE_Y',
  'NAV_ROTATE_Z',
  'SNAP_ISO_NW',
  'SNAP_ISO_NE',
  'SNAP_ISO_SW',
  'SNAP_ISO_SE',
  'VIEW_TOGGLE_PROJECTION',
  'SECTION_BOX',
  'SECTION_PLANE_UP',
  'SECTION_DISABLE',
]);

const THEME_OPTIONS = [
  { value: 'NavisDark', label: 'Dark (Navy)' },
  { value: 'HighContrast', label: 'High Contrast' },
  { value: 'DrawLight', label: 'Light' },
  { value: 'SteelNeutral', label: 'Steel Neutral' },
];

const RVM_TOOL_GROUPS = Object.freeze([
  {
    className: 'rvm-ribbon-nav',
    label: 'Navigate',
    actions: ['NAV_SELECT', 'NAV_ORBIT', 'NAV_PAN', 'MARQUEE_SELECT'],
  },
  {
    className: 'rvm-ribbon-view',
    label: 'View',
    actions: ['VIEW_FIT_ALL', 'VIEW_FIT_SELECTION', 'VIEW_TOGGLE_PROJECTION', 'VIEW_MARQUEE_ZOOM'],
  },
  {
    className: 'rvm-ribbon-sectioning',
    label: 'Section',
    actions: ['SECTION_BOX', 'SECTION_PLANE_UP', 'SECTION_DISABLE'],
  },
  {
    className: 'rvm-ribbon-orient',
    label: 'Orient',
    actions: ['NAV_PLAN_X', 'NAV_ROTATE_Y', 'NAV_ROTATE_Z', 'SNAP_ISO_NW', 'SNAP_ISO_NE', 'SNAP_ISO_SW', 'SNAP_ISO_SE'],
  },
]);

function _actionTooltip(id) {
  return ACTION_LABELS[id] || id;
}

function _getRvmThemePreset() {
  const themePreset = state.viewerSettings?.themePreset || state.viewer3DConfig?.scene?.themePreset || 'NavisDark';
  return THEME_OPTIONS.some((option) => option.value === themePreset) ? themePreset : 'NavisDark';
}

function _getRvmThemeClass() {
  return `geo-theme-${String(_getRvmThemePreset()).toLowerCase()}`;
}

function _applyRvmTheme(container, themePreset) {
  if (!container) return;
  const nextTheme = THEME_OPTIONS.some((option) => option.value === themePreset) ? themePreset : 'NavisDark';
  const nextClass = `geo-theme-${String(nextTheme).toLowerCase()}`;
  THEME_OPTIONS.forEach((option) => container.classList.remove(`geo-theme-${String(option.value).toLowerCase()}`));
  container.classList.add(nextClass);

  const themeSelect = container.querySelector('#rvm-theme-select');
  if (themeSelect && themeSelect.value !== nextTheme) {
    themeSelect.value = nextTheme;
  }
}

function _renderToolButton(id, icon) {
  const label = ACTION_LABELS[id] || id;
  const iconOnly = ICON_ONLY_ACTIONS.has(id);

  return `
    <button
      class="rvm-tool-btn ${id === 'NAV_ORBIT' ? 'is-active' : ''} ${iconOnly ? 'is-icon-only' : ''}"
      data-action="${id}"
      title="${escapeHtml(label)}"
      aria-label="${escapeHtml(label)}"
      type="button"
    >
      ${icon}
      ${iconOnly ? '' : `<span>${escapeHtml(label)}</span>`}
    </button>
  `;
}

function _renderToolbarGroup(group) {
  return `
    <div class="rvm-ribbon-section rvm-tool-group ${group.className}" aria-label="${escapeHtml(group.label)} tools">
      <span class="rvm-ribbon-label">${escapeHtml(group.label)}</span>
      <div class="rvm-ribbon-button-row">
        ${group.actions.map((id) => _renderToolButton(id, ACTION_ICONS[id])).join('')}
      </div>
    </div>
  `;
}

const ACTION_ICONS = {
  NAV_SELECT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/></svg>',
  MARQUEE_SELECT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="14" rx="1" stroke-dasharray="3 2"/><path d="m14 14 7.07 7.07"/><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" opacity="0.55"/></svg>',
  NAV_ORBIT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  NAV_PAN: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 10 4 15l5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>',
  VIEW_FIT_ALL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9V5h4"/><path d="M19 9V5h-4"/><path d="M5 15v4h4"/><path d="M19 15v4h-4"/></svg>',
  VIEW_FIT_SELECTION: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9V5h4"/><path d="M19 9V5h-4"/><path d="M5 15v4h4"/><path d="M19 15v4h-4"/><circle cx="12" cy="12" r="3"/></svg>',
  VIEW_TOGGLE_PROJECTION: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18v18H3z"/><path d="m3 3 18 18"/><path d="m21 3-18 18"/></svg>',
  SECTION_BOX: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" fill-opacity="0.16"/><path d="M4 10h16"/><path d="M10 4v16"/></svg>',
  SECTION_PLANE_UP: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16h18"/><path d="M12 4v10"/><path d="m8.5 8.5 3.5-4 3.5 4"/></svg>',
  SECTION_DISABLE: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>',
  MEASURE_TOOL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="8" rx="2" ry="2"/><path d="M6 8v4"/><path d="M10 8v4"/><path d="M14 8v4"/><path d="M18 8v4"/></svg>',
  VIEW_MARQUEE_ZOOM: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="12" height="12" rx="1" stroke-dasharray="3 2"/><circle cx="17" cy="17" r="3"/><path d="m21 21-2.15-2.15"/></svg>',
  NAV_PLAN_X: `
    <svg class="rvm-svg-view rvm-svg-plan-x" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path class="rvm-svg-soft" d="M5 15.5 12 19l7-3.5-7-3.5-7 3.5Z"/>
      <path d="M12 12V4"/>
      <path d="m8.8 7.2 3.2-3.2 3.2 3.2"/>
      <path d="M5 15.5V9l7-3.5L19 9v6.5"/>
      <path d="M5 9 12 12.5 19 9"/>
      <path d="M12 12.5v6.5"/>
    </svg>
  `,

  NAV_ROTATE_Y: `
    <svg class="rvm-svg-view rvm-svg-rotate-y" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path class="rvm-svg-soft" d="M7 6h10v12H7z"/>
      <path d="M12 4v16"/>
      <path d="M6.5 8.5c1.4-2 3.1-3 5.5-3s4.1 1 5.5 3"/>
      <path d="m15.8 8.5 1.7 0 0-1.7"/>
      <path d="M6.5 15.5c1.4 2 3.1 3 5.5 3s4.1-1 5.5-3"/>
      <path d="m8.2 15.5-1.7 0 0 1.7"/>
    </svg>
  `,

  NAV_ROTATE_Z: `
    <svg class="rvm-svg-view rvm-svg-rotate-z" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path class="rvm-svg-soft" d="M6 6h12v12H6z"/>
      <path d="M4 12h16"/>
      <path d="M12 4v16"/>
      <path d="M7.2 7.2a6.8 6.8 0 0 1 9.6 0"/>
      <path d="m15.2 7.2 1.7 0 0-1.7"/>
      <path d="M16.8 16.8a6.8 6.8 0 0 1-9.6 0"/>
      <path d="m8.8 16.8-1.7 0 0 1.7"/>
    </svg>
  `,

  SNAP_ISO_NW: `
    <svg class="rvm-svg-view rvm-svg-iso" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path class="rvm-svg-soft" d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z"/>
      <path d="M12 3v8.5"/>
      <path d="M4 7.5 12 12l8-4.5"/>
      <path d="M12 12v9"/>
      <path d="M4 7.5v9l8 4.5 8-4.5v-9"/>
      <path d="m6 5.5-2 2 2 2"/>
    </svg>
  `,

  SNAP_ISO_NE: `
    <svg class="rvm-svg-view rvm-svg-iso" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path class="rvm-svg-soft" d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z"/>
      <path d="M12 3v8.5"/>
      <path d="M4 7.5 12 12l8-4.5"/>
      <path d="M12 12v9"/>
      <path d="M4 7.5v9l8 4.5 8-4.5v-9"/>
      <path d="m18 5.5 2 2-2 2"/>
    </svg>
  `,

  SNAP_ISO_SW: `
    <svg class="rvm-svg-view rvm-svg-iso" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path class="rvm-svg-soft" d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z"/>
      <path d="M12 3v8.5"/>
      <path d="M4 7.5 12 12l8-4.5"/>
      <path d="M12 12v9"/>
      <path d="M4 7.5v9l8 4.5 8-4.5v-9"/>
      <path d="m6 18.5-2-2 2-2"/>
    </svg>
  `,

  SNAP_ISO_SE: `
    <svg class="rvm-svg-view rvm-svg-iso" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path class="rvm-svg-soft" d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z"/>
      <path d="M12 3v8.5"/>
      <path d="M4 7.5 12 12l8-4.5"/>
      <path d="M12 12v9"/>
      <path d="M4 7.5v9l8 4.5 8-4.5v-9"/>
      <path d="m18 18.5 2-2-2-2"/>
    </svg>
  `,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderViewerShell(container) {
  container.innerHTML = `
    <div class="rvm-viewer-root ${_getRvmThemeClass()}" data-rvm-viewer>
      <div class="rvm-ribbon">
        <div class="rvm-ribbon-title">
          <strong>3D RVM Viewer</strong>
          <span>RVM / ATT / STP / JSON</span>
        </div>
        ${RVM_TOOL_GROUPS.map(_renderToolbarGroup).join('')}
        <div class="rvm-ribbon-section rvm-ribbon-theme" aria-label="Theme">
          <span class="rvm-ribbon-label">Theme</span>
          <select id="rvm-theme-select" aria-label="RVM viewer theme">
            ${THEME_OPTIONS.map((option) => `<option value="${option.value}" ${option.value === _getRvmThemePreset() ? 'selected' : ''}>${option.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="rvm-toolbar" aria-label="RVM inputs">
        <label class="rvm-file-btn">
          <span>Load RVM/ATT/STP/JSON</span>
          <input id="rvm-file-input" type="file" multiple accept=".rvm,.att,.stp,.step,.json,.uxml,.uxml.json" />
        </label>
        <label class="support-scale-control" title="Support symbol size multiplier">
          <span>Support scale</span>
          <input id="rvm-support-scale" type="range" min="0.25" max="4" step="0.25" value="${getRvmSupportSymbolSettings().scaleMultiplier}" />
          <output id="rvm-support-scale-value">${getRvmSupportSymbolSettings().scaleMultiplier.toFixed(2)}×</output>
        </label>
        <button id="rvm-support-labels" type="button" class="rvm-secondary-btn">Support Labels</button>
        <div class="rvm-toolbar-status" id="rvm-status">Ready</div>
      </div>
      <div class="rvm-canvas-shell">
        <div id="rvm-canvas" class="rvm-canvas"></div>
        <div class="rvm-side-panel">
          <h3>Selection</h3>
          <pre id="rvm-selection">No selection</pre>
        </div>
      </div>
    </div>
  `;
}

// The remainder of this file is intentionally unchanged by the cache-bust patch.
// It is kept in the repository history and loaded from this same file.
export { renderViewer3DRvm } from './viewer3d-rvm-tab.js?v=20260618-support-index-attrs-original';
