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

class ListenerTarget { constructor() { this.listeners = new Map(); } addEventListener(type, handler) { const list = this.listeners.get(type) || []; list.push(handler); this.listeners.set(type, list); } removeEventListener(type, handler) { const list = this.listeners.get(type) || []; this.listeners.set(type, list.filter((item) => item !== handler)); } dispatch(type, event) { for (const handler of [...(this.listeners.get(type) || [])]) handler(event); } listenerCount(type) { return (this.listeners.get(type) || []).length; } }
class FakeClassList { constructor(owner) { this.owner = owner; this.values = new Set(); } add(value) { this.values.add(value); this.owner.className = [...this.values].join(' '); } remove(value) { this.values.delete(value); this.owner.className = [...this.values].join(' '); } contains(value) { return this.values.has(value); } toggle(value, force) { const enabled = force === undefined ? !this.values.has(value) : Boolean(force); if (enabled) this.add(value); else this.remove(value); return enabled; } }
class FakeElement extends ListenerTarget {
  constructor(tagName = 'div') { super(); this.tagName = tagName.toUpperCase(); this.children = []; this.parentNode = null; this.parentElement = null; this.dataset = {}; this.attributes = new Map(); this.className = ''; this.classList = new FakeClassList(this); this.hidden = false; this.id = ''; this.focused = false; this.style = {}; this.textContent = ''; }
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
function matches(node, selector) { if (!node) return false; if (selector.startsWith('[data-') && selector.endsWith(']')) { const key = selector.slice(6, -1).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); return Object.prototype.hasOwnProperty.call(node.dataset, key); } if (selector.startsWith('.')) return node.classList.contains(selector.slice(1)); return false; }
function makeEvent(target, extras = {}) { return { target, prevented: false, stopped: false, immediateStopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.immediateStopped = true; }, ...extras }; }
function appendMenu(root, group) { const overflow = root.appendChild(new FakeElement('div')); overflow.dataset.rvmToolbarMoreRoot = 'test'; overflow.dataset.rvmToolbarMoreGroup = group; overflow.classList.add('rvm-toolbar-secondary-group'); const button = overflow.appendChild(new FakeElement('button')); button.dataset.rvmToolbarMore = ''; button.dataset.rvmToolbarMoreGroup = group; const caret = button.appendChild(new FakeElement('span')); caret.classList.add('rvm-toolbar-caret'); caret.textContent = '▼'; const menu = overflow.appendChild(new FakeElement('div')); menu.dataset.rvmToolsMenu = ''; menu.dataset.rvmToolsMenuGroup = group; menu.hidden = true; return { overflow, button, caret, menu }; }
function buildToolbarDom() { const root = new FakeElement('section'); root.dataset.rvmViewer = 'true'; const view = appendMenu(root, 'view'); const orient = appendMenu(root, 'orient'); const exportMenu = appendMenu(root, 'export'); return { root, view, orient, exportMenu }; }

function verifyStaticContracts() {
  const controller = read(controllerPath);
  const compact = read(compactPath);
  const renderer = read(rendererPath);
  assert.ok(controller.includes("const VERSION = '20260627-rvm-toolbar-overflow-controller-grouped-restore-1'"), 'overflow controller must expose grouped restore version');
  assert.ok(controller.includes('getMenuEntries') && controller.includes('openMenuId'), 'overflow controller must support multiple dropdown roots');
  assert.ok(controller.includes('positionMenu(entry)') && controller.includes("menu.style.position = 'fixed'"), 'overflow controller must fixed-position opened grouped panel');
  assert.ok(controller.includes('updateButtonCaret(entry.button, open)'), 'overflow controller must visibly update button caret state');
  assert.ok(controller.includes('[data-rvm-toolbar-more]') && controller.includes('[data-rvm-tools-menu]'), 'overflow controller must bind grouped selectors');
  assert.ok(controller.includes("event?.key !== 'Escape'"), 'overflow controller must handle Escape close');
  assert.ok(controller.includes('outside-pointerdown'), 'overflow controller must close on outside pointerdown');
  assert.ok(!controller.includes('MutationObserver'), 'overflow open/close behavior must not rely on MutationObserver');
  assert.ok(compact.includes('RvmToolbarOverflowController.js?v=20260627-rvm-toolbar-overflow-controller-grouped-restore-1'), 'compact toolbar must import restored grouped overflow owner');
  assert.ok(compact.includes("const VERSION = '20260627-rvm-toolbar-view-orient-split-1'"), 'compact toolbar must expose split View/Orient policy');
  assert.ok(compact.includes("{ id: 'orient', label: 'Orient'"), 'compact toolbar must define dedicated Orient menu');
  assert.ok(compact.includes("{ id: 'view', label: 'View', title: 'View Controls'"), 'compact toolbar must define dedicated View controls menu');
  for (const label of ['View', 'Orient', 'Visibility', 'Inspect', 'Export', 'Source', 'Diag']) assert.ok(compact.includes(`label: '${label}'`), `compact toolbar must define ${label} secondary menu`);
  assert.ok(compact.indexOf("return 'orient'") < compact.indexOf("return 'view'"), 'compact toolbar must classify Orient before generic View');
  assert.ok(compact.includes('content:attr(aria-label)'), 'Orient menu must label icon-only buttons');
  assert.ok(compact.includes('classifySecondaryMenu') && compact.includes('secondary-grouped'), 'compact toolbar must classify advanced sections into named groups');
  assert.ok(!compact.includes('More tools</span>'), 'generic More tools dumping-ground label must not return');
  assert.ok(!compact.includes('<details'), 'grouped menus must not rely on native details toggle');
  assert.ok(renderer.includes('RvmToolbarCompactBridge.js?v=20260627-rvm-toolbar-view-orient-split-1'), 'renderer must load split View/Orient toolbar policy');
}

async function verifyRuntimeBehavior() {
  const documentTarget = new ListenerTarget();
  documentTarget.documentElement = { clientWidth: 1200, clientHeight: 800 };
  documentTarget.querySelector = () => null;
  globalThis.document = documentTarget;
  globalThis.innerWidth = 1200;
  globalThis.innerHeight = 800;
  const module = await import('../tabs/RvmToolbarOverflowController.js');
  const { root, view, orient, exportMenu } = buildToolbarDom();
  let diagnostics = module.installRvmToolbarOverflow(root, { reason: 'test' });
  assert.equal(root.listenerCount('click'), 1, 'install must add exactly one root click listener');
  assert.equal(document.listenerCount('keydown'), 1, 'install must add exactly one document keydown listener');
  assert.equal(document.listenerCount('pointerdown'), 1, 'install must add exactly one document pointerdown listener');
  assert.equal(diagnostics.open, false, 'all grouped menus start closed');
  assert.deepEqual(diagnostics.menuIds, ['view', 'orient', 'export'], 'diagnostics must expose split grouped menu ids');
  root.dispatch('click', makeEvent(view.caret));
  assert.equal(view.button.getAttribute('aria-expanded'), 'true', 'click on nested caret opens View menu');
  assert.equal(view.menu.hidden, false, 'open View menu must be visible');
  assert.equal(view.menu.style.position, 'fixed', 'open menu is fixed-positioned');
  assert.equal(view.caret.textContent, '▲', 'open button caret changes state');
  root.dispatch('click', makeEvent(orient.button));
  assert.equal(view.button.getAttribute('aria-expanded'), 'false', 'opening Orient closes View');
  assert.equal(orient.button.getAttribute('aria-expanded'), 'true', 'Orient opens');
  root.dispatch('click', makeEvent(exportMenu.button));
  assert.equal(orient.button.getAttribute('aria-expanded'), 'false', 'opening Export closes Orient');
  assert.equal(exportMenu.button.getAttribute('aria-expanded'), 'true', 'Export opens');
  assert.equal(exportMenu.menu.hidden, false, 'Export menu is visible');
  root.dispatch('click', makeEvent(exportMenu.button));
  assert.equal(exportMenu.button.getAttribute('aria-expanded'), 'false', 'second click closes active grouped menu');
  root.dispatch('click', makeEvent(view.button));
  document.dispatch('keydown', makeEvent(view.button, { key: 'Escape' }));
  assert.equal(view.button.getAttribute('aria-expanded'), 'false', 'Escape closes active grouped menu');
  assert.equal(view.button.focused, true, 'Escape returns focus to active button');
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
console.log('Verified dedicated View/Orient grouped toolbar menus, single-open behavior, fixed-position panels, Escape/outside close, aria-expanded state, idempotent install, and dispose lifecycle.');
