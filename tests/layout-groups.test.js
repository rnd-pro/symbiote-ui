import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  createLayoutGroupModel,
  createLayoutGroupSections,
  createLayoutGroupTabs,
  getActiveLayoutGroup,
  getHomeLayoutGroup,
  normalizeLayoutGroups,
} from '../layout/LayoutShellMenu/layout-groups.js';

const sidebarSectionSource = new URL('../layout/LayoutSidebar/SidebarSection.js', import.meta.url);

function installMinimalDom() {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, init = {}) {
      super(type, init);
      this.detail = init.detail;
    }
  };
  globalThis.CSSStyleSheet = class CSSStyleSheet {
    replaceSync() {}
  };
  globalThis.HTMLElement = class HTMLElement extends EventTarget {
    constructor() {
      super();
      this._attrs = new Map();
      this.style = { setProperty() {}, removeProperty() {} };
      this.ref = {};
      this.templateProcessors = { add() {} };
    }

    getAttribute(name) {
      return this._attrs.has(name) ? this._attrs.get(name) : null;
    }

    setAttribute(name, value) {
      this._attrs.set(name, String(value));
    }

    removeAttribute(name) {
      this._attrs.delete(name);
    }

    toggleAttribute(name, value) {
      if (value) this.setAttribute(name, '');
      else this.removeAttribute(name);
    }

    hasAttribute(name) {
      return this._attrs.has(name);
    }

    querySelector() {
      return null;
    }
  };
  globalThis.customElements = {
    define() {},
    get() {},
    whenDefined() {
      return Promise.resolve();
    },
  };
  globalThis.window = { customElements: globalThis.customElements };
  globalThis.document = {
    head: { append() {}, querySelector() { return null; } },
    createElement() {
      return {
        setAttribute() {},
        append() {},
        sheet: { insertRule() {} },
      };
    },
    querySelector() {
      return null;
    },
  };
}

test('layout groups normalize tabs, sidebar sections, and host metadata', () => {
  let groups = normalizeLayoutGroups([
    {
      id: 'overview',
      name: 'Overview',
      icon: 'view_quilt',
      sidebarLabel: 'Agent Chat',
      sidebarIcon: 'smart_toy',
      tabsVisible: false,
      closeable: false,
      behavior: { responsiveMode: 'stack' },
      host: { panelType: 'overview' },
      createLayout: () => null,
    },
    {
      id: 'graph',
      name: 'Graph',
      icon: 'hub',
      color: 'var(--accent)',
      closeable: true,
      metadata: { panelType: 'graph' },
    },
    {
      id: 'disabled',
      name: 'Disabled',
      icon: 'block',
      disabled: true,
      tabsVisible: false,
    },
  ]);

  assert.equal(groups.length, 3);
  assert.equal(groups[0].sidebarLabel, 'Agent Chat');
  assert.equal(groups[0].sidebarIcon, 'smart_toy');
  assert.equal(groups[0].tabsVisible, false);
  assert.equal(groups[0].closeable, false);
  assert.deepEqual(groups[0].behavior, { responsiveMode: 'stack' });
  assert.deepEqual(groups[0].host, { panelType: 'overview' });
  assert.equal('createLayout' in groups[0], false);
  assert.equal(groups[1].closeable, true);
  assert.deepEqual(groups[1].host, { panelType: 'graph' });
  assert.equal(groups[2].disabled, true);
});

test('layout group model derives home, active tab, and sidebar state together', () => {
  let model = createLayoutGroupModel([
    { id: 'overview', name: 'Overview', icon: 'home', tabsVisible: false },
    { id: 'graph', name: 'Graph', icon: 'hub', sidebarVisible: false },
    { id: 'chat', name: 'Chat', icon: 'forum', disabled: true },
    { id: 'theme', name: 'Theme', icon: 'palette', closeable: true },
  ], 'graph');

  assert.equal(model.homeGroupId, 'overview');
  assert.equal(model.activeId, 'graph');
  assert.equal(model.activeGroup.id, 'graph');
  assert.deepEqual(model.tabs.map((tab) => [tab.id, tab.isActive, tab.closeable, tab.disabled]), [
    ['graph', true, false, false],
    ['chat', false, false, true],
    ['theme', false, true, false],
  ]);
  assert.deepEqual(model.sidebarSections.map((section) => [section.id, section.label, section.disabled]), [
    ['overview', 'Overview', false],
    ['chat', 'Chat', true],
    ['theme', 'Theme', false],
  ]);
});

test('layout groups fall back from disabled active id to the home group', () => {
  let groups = normalizeLayoutGroups([
    { id: 'overview', name: 'Overview', tabsVisible: false },
    { id: 'chat', name: 'Chat', disabled: true },
  ]);

  assert.equal(getHomeLayoutGroup(groups).id, 'overview');
  assert.equal(getActiveLayoutGroup(groups, 'chat').id, 'overview');
  assert.deepEqual(createLayoutGroupTabs(groups, 'chat').map((tab) => [tab.id, tab.isActive, tab.disabled]), [
    ['chat', false, true],
  ]);
  assert.deepEqual(createLayoutGroupSections(groups).map((section) => [section.id, section.disabled]), [
    ['overview', false],
    ['chat', true],
  ]);
});

test('sidebar sections expose cancelable selection before router navigation', async () => {
  let source = await readFile(sidebarSectionSource, 'utf8');

  assert.match(source, /sidebar-section-select/);
  assert.match(source, /cancelable:\s*true/);
  assert.match(source, /sidebar\?\.routerSync === false/);
  assert.match(source, /navigate\(this\.\$\.sectionId\)/);
});

test('layout shell menu emits normalized group intents without host executable state', async () => {
  installMinimalDom();
  let { LayoutShellMenu } = await import('../layout/LayoutShellMenu/LayoutShellMenu.js');
  let shell = new LayoutShellMenu();
  shell.initCallback();

  let changes = [];
  let closes = [];
  shell.addEventListener('layout-group-change', (event) => changes.push(event.detail));
  shell.addEventListener('layout-group-close', (event) => closes.push(event.detail));

  shell.setGroups([
    { id: 'overview', name: 'Overview', tabsVisible: false },
    {
      id: 'graph',
      name: 'Graph',
      icon: 'hub',
      closeable: true,
      host: { panelType: 'graph' },
      createLayout: () => null,
    },
    { id: 'disabled', name: 'Disabled', disabled: true },
  ], 'overview');

  assert.equal(shell.selectGroup('graph', 'api'), true);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].id, 'graph');
  assert.equal(changes[0].source, 'api');
  assert.equal(changes[0].group.id, 'graph');
  assert.deepEqual(changes[0].group.host, { panelType: 'graph' });
  assert.equal('createLayout' in changes[0].group, false);

  assert.equal(shell.selectGroup('disabled', 'api'), false);
  assert.equal(changes.length, 1);

  shell.dispatchEvent(new CustomEvent('project-tabs-close', {
    bubbles: true,
    composed: true,
    detail: { id: 'graph' },
  }));
  assert.equal(closes.length, 1);
  assert.equal(closes[0].id, 'graph');
  assert.equal(closes[0].source, 'tabs-close');
});
