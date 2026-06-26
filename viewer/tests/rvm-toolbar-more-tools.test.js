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

function read(file) {
  assert.ok(fs.existsSync(file), `missing file: ${path.relative(viewerRoot, file)}`);
  return fs.readFileSync(file, 'utf8');
}

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
  }
  appendChild(child) { child.parentNode = this; child.parentElement = this; this.children.push(child); return child; }
  setAttribute(name, value) { if (name === 'id') this.id = String(value); this.attributes.set(name, String(value)); }
  getAttribute(name) { if (name === 'id') return this.id || null; return this.attributes.has(name) ? this.attributes.get(name) : null; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const selectors = String(selector).split(',').map((item) => item.trim()).filter(Boolean);
    const found = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (selectors.some((item) => matches(child, item))) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
  closest(selector) { let cursor = this; while (cursor) { if (matches(cursor, selector)) return cursor; cursor = cursor.parentElement; } return null; }
  contains(node) { let cursor = node; while (cursor) { if (cursor === this) return true; cursor = cursor.parentElement || cursor.parentNode; } return false; }
  focus() { this.focused = true; }
}

function matches(node, selector) {
  if (!node) return false;
  if (selector.startsWith('[data-') && selector.endsWith(']')) {
    const key = selector.slice(6, -1).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    return Object.prototype.hasOwnProperty.call(node.dataset, key);
  }
  if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
  return false;
}

function makeEvent(target, extras = {}) {
  return { target, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...extras };
}

function appendMenu(root, group) {
  const overflow = root.appendChild(new FakeElement('div'));
  overflow.dataset.rvmToolbarMoreRoot = 'test';
  overflow.dataset.rvmToolbarMoreGroup = group;
  overflow.classList.add('rvm-toolbar-secondary-group');
  const button = overflow.appendChild(new FakeElement('button'));
  button.dataset.rvmToolbarMore = '';
  button.dataset.rvmToolbarMoreGroup = group;
  const menu = overflow.appendChild(new FakeElement('div'));
  menu.dataset.rvmToolsMenu = '';
  menu.dataset.rvmToolsMenuGroup = group;
  menu.hidden = true;
  return { overflow, button, menu };
}

function buildToolbarDom() {
  const root = new FakeElement('section');
  root.dataset.rvmViewer = 'true';
  const view = appendMenu(root, 'view');
  const exportMenu = appendMenu(root, 'export');
  return { root, view, exportMenu };
}

function verifyStaticContracts() {
  const controller = read(controllerPath);
  const compact = read(compactPath);
  const renderer = read(rendererPath);
  assert.ok(controller.includes("const VERSION = '20260626-rvm-toolbar-overflow-controller-3'"), 'overflow controller must expose grouped-menu v3');
  assert.ok(controller.includes("const PREVIOUS_VERSION = '20260626-rvm-toolbar-overflow-controller-2'"), 'overflow controller must preserve previous version');
  assert.ok(controller.includes('installRvmToolbarOverflow'), 'overflow controller must expose install lifecycle');
  assert.ok(controller.includes('disposeRvmToolbarOverflow'), 'overflow controller must expose dispose lifecycle');
  assert.ok(controller.includes('syncRvmToolbarOverflow'), 'overflow controller must expose sync lifecycle');
  assert.ok(controller.includes('getMenuEntries') && controller.includes('openMenuId'), 'overflow controller must support multiple dropdown roots');
  assert.ok(controller.includes('[data-rvm-toolbar-more]'), 'overflow controller must bind grouped buttons by scoped data attribute');
  assert.ok(controller.includes('[data-rvm-tools-menu]'), 'overflow controller must bind grouped target menus by scoped data attribute');
  assert.ok(controller.includes("event?.key !== 'Escape'"), 'overflow controller must handle Escape close');
  assert.ok(controller.includes('outside-pointerdown'), 'overflow controller must close on outside pointerdown');
  assert.ok(!controller.includes('MutationObserver'), 'overflow open/close behavior must not rely on MutationObserver');
  assert.ok(compact.includes('RvmToolbarOverflowController.js?v=20260626-rvm-toolbar-overflow-controller-3'), 'compact toolbar must import grouped overflow owner');
  assert.ok(compact.includes("const VERSION = '20260626-rvm-toolbar-secondary-groups-1'"), 'compact toolbar must expose grouped secondary menu policy');
  assert.ok(compact.includes("const PREVIOUS_VERSION = '20260626-rvm-toolbar-compact-policy-3'"), 'compact toolbar must preserve previous compact policy');
  assert.ok(compact.includes("'Navigate / View'") && compact.includes("'Review'"), 'compact toolbar must keep primary and review groups top-level');
  for (const label of ['View', 'Visibility', 'Inspect', 'Export', 'Source', 'Diag']) assert.ok(compact.includes(`label: '${label}'`), `compact toolbar must define ${label} secondary menu`);
  for (const group of ['view', 'visibility', 'inspect', 'export', 'source', 'diag']) assert.ok(compact.includes(`id: '${group}'`), `compact toolbar must define ${group} grouped dropdown`);
  assert.ok(compact.includes('classifySecondaryMenu'), 'compact toolbar must classify advanced sections into named groups');
  assert.ok(compact.includes('secondary-grouped'), 'advanced sections must be marked as secondary-grouped');
  assert.ok(!compact.includes('More tools</span>'), 'generic More tools dumping-ground label must be removed');
  assert.ok(!compact.includes('<details'), 'compact toolbar must not rely on native details toggle for grouped menus');
  assert.ok(renderer.includes('RvmToolbarCompactBridge.js?v=20260626-rvm-toolbar-secondary-groups-1'), 'renderer must load grouped secondary toolbar policy');
}

async function verifyRuntimeBehavior() {
  const documentTarget = new ListenerTarget();
  documentTarget.querySelector = () => null;
  globalThis.document = documentTarget;
  const module = await import('../tabs/RvmToolbarOverflowController.js');
  const { root, view, exportMenu } = buildToolbarDom();

  let diagnostics = module.installRvmToolbarOverflow(root, { reason: 'test' });
  assert.equal(root.listenerCount('click'), 1, 'install must add exactly one root click listener');
  assert.equal(document.listenerCount('keydown'), 1, 'install must add exactly one document keydown listener');
  assert.equal(document.listenerCount('pointerdown'), 1, 'install must add exactly one document pointerdown listener');
  assert.equal(diagnostics.open, false, 'all grouped menus start closed');
  assert.deepEqual(diagnostics.menuIds, ['view', 'export'], 'diagnostics must expose grouped menu ids');
  assert.equal(view.button.getAttribute('aria-expanded'), 'false', 'closed View button aria-expanded must be false');
  assert.equal(exportMenu.button.getAttribute('aria-expanded'), 'false', 'closed Export button aria-expanded must be false');
  assert.equal(view.menu.hidden, true, 'closed View menu must be hidden');
  assert.equal(exportMenu.menu.hidden, true, 'closed Export menu must be hidden');

  root.dispatch('click', makeEvent(view.button));
  assert.equal(view.button.getAttribute('aria-expanded'), 'true', 'click opens the View menu');
  assert.equal(view.menu.hidden, false, 'open View menu must be visible');
  assert.equal(exportMenu.button.getAttribute('aria-expanded'), 'false', 'opening View keeps Export closed');
  assert.equal(exportMenu.menu.hidden, true, 'opening View keeps Export menu hidden');

  root.dispatch('click', makeEvent(exportMenu.button));
  assert.equal(view.button.getAttribute('aria-expanded'), 'false', 'opening Export closes View');
  assert.equal(view.menu.hidden, true, 'opening Export hides View menu');
  assert.equal(exportMenu.button.getAttribute('aria-expanded'), 'true', 'Export opens');
  assert.equal(exportMenu.menu.hidden, false, 'Export menu is visible');

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
  assert.equal(document.listenerCount('keydown'), 0, 'dispose must remove keydown listener');
  assert.equal(document.listenerCount('pointerdown'), 0, 'dispose must remove pointerdown listener');
}

verifyStaticContracts();
await verifyRuntimeBehavior();
console.log('Verified RVM grouped secondary toolbar menus, single-open behavior, Escape/outside close, aria-expanded state, idempotent install, and dispose lifecycle.');
