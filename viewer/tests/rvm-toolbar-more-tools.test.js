import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerRoot = path.resolve(__dirname, '..');
const controllerPath = path.join(viewerRoot, 'tabs/RvmToolbarOverflowController.js');
const compactPath = path.join(viewerRoot, 'tabs/RvmToolbarCompactBridge.js');
const rendererPath = path.join(viewerRoot, 'tabs/viewer3d-rvm-tab-renderer.js');

function read(file) { assert.ok(fs.existsSync(file), `missing file: ${path.relative(viewerRoot, file)}`); return fs.readFileSync(file, 'utf8'); }

class ListenerTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) { const list = this.listeners.get(type) || []; list.push(handler); this.listeners.set(type, list); }
  removeEventListener(type, handler) { const list = this.listeners.get(type) || []; this.listeners.set(type, list.filter((item) => item !== handler)); }
  dispatch(type, event) { for (const handler of [...(this.listeners.get(type) || [])]) handler(event); }
  listenerCount(type) { return (this.listeners.get(type) || []).length; }
}

class FakeClassList {
  constructor(owner) { this.owner = owner; this.values = new Set(); }
  add(value) { this.values.add(value); this.owner.className = [...this.values].join(' '); }
  remove(value) { this.values.delete(value); this.owner.className = [...this.values].join(' '); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) { const enabled = force === undefined ? !this.values.has(value) : Boolean(force); if (enabled) this.add(value); else this.remove(value); return enabled; }
}

class FakeElement extends ListenerTarget {
  constructor(tagName = 'div') {
    super();
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.parentElement = null;
    this.dataset = {};
    this.attributes = new Map();
    this.className = '';
    this.classList = new FakeClassList(this);
    this.hidden = false;
    this.id = '';
    this.focused = false;
    this.style = {};
    this.textContent = '';
  }
  appendChild(child) { child.parentNode = this; child.parentElement = this; this.children.push(child); return child; }
  setAttribute(name, value) { if (name === 'id') this.id = String(value); this.attributes.set(name, String(value)); }
  getAttribute(name) { if (name === 'id') return this.id || null; return this.attributes.has(name) ? this.attributes.get(name) : null; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) { const selectors = String(selector).split(',').map((item) => item.trim()).filter(Boolean); const found = []; const walk = (node) => { for (const child of node.children) { if (selectors.some((item) => matches(child, item))) found.push(child); walk(child); } }; walk(this); return found; }
  closest(selector) { let cursor = this; while (cursor) { if (matches(cursor, selector)) return cursor; cursor = cursor.parentElement; } return null; }
  contains(node) { let cursor = node; while (cursor) { if (cursor === this) return true; cursor = cursor.parentElement || cursor.parentNode; } return false; }
  focus() { this.focused = true; }
  getBoundingClientRect() { return { left: 64, top: 30, right: 128, bottom: 56, width: 64, height: 26 }; }
}

function matches(node, selector) {
  if (!node) return false;
  if (selector.startsWith('[data-') && selector.endsWith(']')) { const key = selector.slice(6, -1).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); return Object.prototype.hasOwnProperty.call(node.dataset, key); }
  if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
  return false;
}

function makeEvent(target, extras = {}) { return { target, prevented: false, stopped: false, immediateStopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.immediateStopped = true; }, ...extras }; }

function appendMenu(root, group) {
  const overflow = root.appendChild(new FakeElement('div'));
  overflow.dataset.rvmToolbarMoreRoot = 'test';
  overflow.dataset.rvmToolbarMoreGroup = group;
  overflow.classList.add('rvm-toolbar-secondary-group');
  const button = overflow.appendChild(new FakeElement('button'));
  button.dataset.rvmToolbarMore = '';
  button.dataset.rvmToolbarMoreGroup = group;
  const caret = button.appendChild(new FakeElement('span'));
  caret.classList.add('rvm-toolbar-caret');
  caret.textContent = '▼';
  const menu = overflow.appendChild(new FakeElement('div'));
  menu.dataset.rvmToolsMenu = '';
  menu.dataset.rvmToolsMenuGroup = group;
  menu.hidden = true;
  return { overflow, button, caret, menu };
}

function buildToolbarDom() { const root = new FakeElement('section'); root.dataset.rvmViewer = 'true'; const view = appendMenu(root, 'view'); const exportMenu = appendMenu(root, 'export'); return { root, view, exportMenu }; }

function verifyStaticContracts() {
  const controller = read(controllerPath);
  const compact = read(compactPath);
  const renderer = read(rendererPath);
  assert.ok(controller.includes("const VERSION = '20260626-rvm-toolbar-overflow-controller-4'"), 'overflow controller must expose click/display fix v4');
  assert.ok(controller.includes("const PREVIOUS_VERSION = '20260626-rvm-toolbar-overflow-controller-3'"), 'overflow controller must preserve previous grouped version');
  assert.ok(controller.includes('positionMenu(entry)'), 'overflow controller must position the opened grouped panel');
  assert.ok(controller.includes("menu.style.position = 'fixed'"), 'opened grouped panel must use fixed positioning to avoid toolbar clipping');
  assert.ok(controller.includes('updateButtonCaret(entry.button, open)'), 'overflow controller must visibly update button caret state');
  assert.ok(controller.includes('stopImmediatePropagation'), 'overflow click handler must not be swallowed by later root click owners');
  assert.ok(controller.includes('getMenuEntries') && controller.includes('openMenuId'), 'overflow controller must support multiple dropdown roots');
  assert.ok(!controller.includes('MutationObserver'), 'overflow open/close behavior must not rely on MutationObserver');
  assert.ok(compact.includes('RvmToolbarOverflowController.js?v=20260626-rvm-toolbar-overflow-controller-4'), 'compact toolbar must import click-fix overflow owner');
  assert.ok(compact.includes("const VERSION = '20260626-rvm-toolbar-secondary-groups-2'"), 'compact toolbar must expose grouped secondary menu click-fix policy');
  assert.ok(compact.includes("const PREVIOUS_VERSION = '20260626-rvm-toolbar-secondary-groups-1'"), 'compact toolbar must preserve previous grouped policy');
  assert.ok(compact.includes('position:fixed'), 'compact toolbar panel CSS must avoid clipping by toolbar containers');
  for (const label of ['View', 'Visibility', 'Inspect', 'Export', 'Source', 'Diag']) assert.ok(compact.includes(`label: '${label}'`), `compact toolbar must define ${label} secondary menu`);
  assert.ok(!compact.includes('More tools</span>'), 'generic More tools dumping-ground label must be removed');
  assert.ok(renderer.includes('RvmToolbarCompactBridge.js?v=20260626-rvm-toolbar-secondary-groups-2'), 'renderer must load grouped toolbar click-fix policy');
}

async function verifyRuntimeBehavior() {
  const documentTarget = new ListenerTarget();
  documentTarget.documentElement = { clientWidth: 1200, clientHeight: 800 };
  documentTarget.querySelector = () => null;
  globalThis.document = documentTarget;
  globalThis.innerWidth = 1200;
  globalThis.innerHeight = 800;
  const module = await import('../tabs/RvmToolbarOverflowController.js');
  const { root, view, exportMenu } = buildToolbarDom();

  let diagnostics = module.installRvmToolbarOverflow(root, { reason: 'test' });
  assert.equal(root.listenerCount('click'), 1, 'install must add exactly one root click listener');
  assert.equal(document.listenerCount('keydown'), 1, 'install must add exactly one document keydown listener');
  assert.equal(document.listenerCount('pointerdown'), 1, 'install must add exactly one document pointerdown listener');
  assert.equal(diagnostics.open, false, 'all grouped menus start closed');
  assert.deepEqual(diagnostics.menuIds, ['view', 'export'], 'diagnostics must expose grouped menu ids');

  root.dispatch('click', makeEvent(view.caret));
  assert.equal(view.button.getAttribute('aria-expanded'), 'true', 'click on nested caret opens the View menu');
  assert.equal(view.menu.hidden, false, 'open View menu must be visible');
  assert.equal(view.overflow.classList.contains('is-open'), true, 'open View root receives is-open class');
  assert.equal(view.menu.style.position, 'fixed', 'open menu is fixed-positioned to avoid clipping');
  assert.equal(view.menu.dataset.rvmToolbarMenuPositioned, 'fixed', 'open menu records fixed positioning');
  assert.equal(view.caret.textContent, '▲', 'open button caret changes to up state');

  root.dispatch('click', makeEvent(exportMenu.button));
  assert.equal(view.button.getAttribute('aria-expanded'), 'false', 'opening Export closes View');
  assert.equal(view.menu.hidden, true, 'opening Export hides View menu');
  assert.equal(view.menu.style.position, '', 'closed View menu resets fixed positioning');
  assert.equal(exportMenu.button.getAttribute('aria-expanded'), 'true', 'Export opens');
  assert.equal(exportMenu.menu.hidden, false, 'Export menu is visible');
  assert.equal(exportMenu.menu.style.position, 'fixed', 'Export menu is fixed-positioned');

  root.dispatch('click', makeEvent(exportMenu.button));
  assert.equal(exportMenu.button.getAttribute('aria-expanded'), 'false', 'second click closes active grouped menu');
  assert.equal(exportMenu.menu.hidden, true, 'closed active grouped menu must be hidden');

  root.dispatch('click', makeEvent(view.button));
  document.dispatch('keydown', makeEvent(view.button, { key: 'Escape' }));
  assert.equal(view.button.getAttribute('aria-expanded'), 'false', 'Escape closes active grouped menu');
  assert.equal(view.button.focused, true, 'Escape returns focus to active grouped button');

  root.dispatch('click', makeEvent(view.button));
  document.dispatch('pointerdown', makeEvent(new FakeElement('main')));
  assert.equal(view.button.getAttribute('aria-expanded'), 'false', 'outside pointerdown closes grouped menu');

  diagnostics = module.installRvmToolbarOverflow(root, { reason: 'repeat' });
  assert.equal(root.listenerCount('click'), 1, 'repeat install must not duplicate root click listener');
  assert.equal(document.listenerCount('keydown'), 1, 'repeat install must not duplicate keydown listener');
  assert.equal(document.listenerCount('pointerdown'), 1, 'repeat install must not duplicate pointerdown listener');
  assert.equal(diagnostics.installCount, 2, 'repeat install must be recorded without duplicate listeners');

  assert.equal(module.disposeRvmToolbarOverflow(root), true, 'dispose must remove installed lifecycle');
  assert.equal(root.listenerCount('click'), 0, 'dispose must remove root click listener');
}

verifyStaticContracts();
await verifyRuntimeBehavior();
console.log('Verified RVM grouped toolbar click/display fix, fixed-position panels, caret state, single-open behavior, Escape/outside close, and idempotent install.');
