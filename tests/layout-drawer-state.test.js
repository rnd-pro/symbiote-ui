import assert from 'node:assert/strict';
import test from 'node:test';

import { createPanel, createSplit } from '../layout/LayoutTree.js';

function findPanelById(node, panelId) {
  if (!node) return null;
  if (node.id === panelId) return node;
  return findPanelById(node.first, panelId) || findPanelById(node.second, panelId);
}

async function makeDrawerFixture({ viewportWidth = 390, viewportHeight = 844 } = {}) {
  let { parseHTML } = await import('linkedom');
  let { window } = parseHTML('<!doctype html><html><body></body></html>');
  let TestCSSStyleSheet = class {
    replaceSync(text) { this.cssText = text; }
  };
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    customElements: window.customElements,
    Node: window.Node,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    MutationObserver: window.MutationObserver,
    ShadowRoot: window.ShadowRoot || class ShadowRootStub {},
    CSSStyleSheet: TestCSSStyleSheet,
    getComputedStyle: window.getComputedStyle || (() => ({ transitionDuration: '0s', animationDuration: '0s' })),
  });
  window.document.adoptedStyleSheets = [];
  const div = window.document.createElement('div');
  const StyleProto = Object.getPrototypeOf(div.style);
  StyleProto.getPropertyPriority = StyleProto.getPropertyPriority || (() => '');

  const fresh = `?fresh=drawer-state-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await import(`../layout/LayoutNode/LayoutNode.js${fresh}`);
  await import(`../layout/Layout/Layout.js${fresh}`);

  const layout = document.createElement('panel-layout');
  document.body.append(layout);
  layout.getBoundingClientRect = () => ({
    width: viewportWidth, height: viewportHeight, top: 0, left: 0, bottom: viewportHeight, right: viewportWidth,
  });
  layout.setAttribute('responsive-mode', 'swipe');
  layout.registerPanelType('drawer-nav', {
    title: 'Nav', icon: 'folder',
    behavior: { mobileDock: 'start', swipeControl: 'rail' },
  });
  layout.registerPanelType('drawer-content', {
    title: 'Content', icon: 'article',
    behavior: { mobileDock: 'primary' },
  });
  layout.registerPanelType('drawer-side', {
    title: 'Side', icon: 'hub',
    behavior: { mobileDock: 'end', swipeControl: 'rail' },
  });
  layout.setLayout(createSplit(
    'horizontal',
    createPanel('drawer-nav'),
    createSplit('horizontal', createPanel('drawer-content'), createPanel('drawer-side'), 0.7),
    0.25,
  ));
  await new Promise((r) => setTimeout(r, 0));
  return { layout };
}

function pointerEvent(type, { x = 0, y = 0, pointerId = 7 } = {}) {
  let event = new Event(type, { bubbles: true, cancelable: true });
  event.pointerId = pointerId;
  event.pointerType = 'touch';
  event.clientX = x;
  event.clientY = y;
  event.button = 0;
  return event;
}

function drawerAttrs(layout) {
  return Array.from(layout.querySelectorAll('layout-node[mobile-dock]')).map((node) => ({
    panelId: node.dataset.drawerPanelId,
    dock: node.dataset.drawerDock,
    open: node.hasAttribute('drawer-open'),
    railCollapsed: node.hasAttribute('drawer-rail-collapsed'),
    dragging: node.hasAttribute('drawer-dragging'),
  }));
}

function findDrawerNode(layout, dock) {
  return layout.querySelector(`layout-node[data-drawer-dock="${dock}"]`);
}

test('drawer collapse button routes through drawer close, never desktop collapse', async () => {
  let { layout } = await makeDrawerFixture();
  assert.ok(layout.hasAttribute('drawer-mode-active'), 'fixture activates drawer mode');

  layout.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(layout.$.drawerStartOpen, true);

  let drawerNode = findDrawerNode(layout, 'start');
  assert.ok(drawerNode, 'start drawer node exists');
  let panelId = drawerNode.$.nodeId;
  assert.ok(drawerNode.hasAttribute('drawer-open'), 'drawer node is open');

  drawerNode.dispatchEvent(new CustomEvent('panel-collapse-toggle', {
    bubbles: true, composed: true,
    detail: { panelId, collapsed: true },
  }));
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(layout.$.drawerStartOpen, false,
    'collapse toggle closes the drawer in drawer mode');
  assert.ok(!drawerNode.hasAttribute('collapsed'),
    'collapse toggle must NOT set desktop [collapsed] on the node in drawer mode');
  let treePanel = findPanelById(layout.$.layoutTree, panelId);
  assert.equal(treePanel?.collapsed ?? false, false,
    'layout tree must NOT receive desktop collapsed:true in drawer mode');
});

test('closeDrawer funnels through the shared open state without leaking drag state', async () => {
  let { layout } = await makeDrawerFixture();

  let handle = findDrawerNode(layout, 'start');

  layout.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));

  layout.closeDrawer('start');
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(layout.$.drawerStartOpen, false);
  assert.ok(!handle.hasAttribute('drawer-dragging'), 'drag state cleared');
  let nodeAttrs = drawerAttrs(layout);
  let start = nodeAttrs.find((a) => a.dock === 'start');
  assert.equal(start.open, false, 'DOM drawer-open attr matches flags after closeDrawer');
});

test('only one drawer open at a time across all paths', async () => {
  let { layout } = await makeDrawerFixture();

  layout.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  layout.openDrawer('end');
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(layout.$.drawerStartOpen, false, 'opening end closes start');
  assert.equal(layout.$.drawerEndOpen, true);
  let open = drawerAttrs(layout).filter((a) => a.open);
  assert.equal(open.length, 1, 'exactly one drawer-open node in the DOM');
  assert.equal(open[0].dock, 'end');
});

test('rail tap gesture opens the drawer (tap without drag)', async () => {
  let { layout } = await makeDrawerFixture();

  let rail = findDrawerNode(layout, 'start');
  assert.ok(rail, 'start rail node exists');
  assert.ok(rail.hasAttribute('drawer-rail-collapsed'), 'rail starts collapsed');

  rail.dispatchEvent(pointerEvent('pointerdown', { x: 16, y: 400 }));
  layout.dispatchEvent(pointerEvent('pointerup', { x: 16, y: 400 }));
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(layout.$.drawerStartOpen, true, 'rail tap opens the drawer');
  let nodeAttrs = drawerAttrs(layout).find((a) => a.dock === 'start');
  assert.equal(nodeAttrs.open, true, 'DOM drawer-open attr matches the flag after tap');
});

test('content swipe below the commit threshold keeps the drawer open, past it closes', async () => {
  let { layout } = await makeDrawerFixture();
  layout._getFallbackDrawerWidth = () => 335;

  layout.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  let drawerNode = findDrawerNode(layout, 'start');

  // Sub-threshold drag: 100px of 335px → progress 0.7 → stays open.
  drawerNode.dispatchEvent(pointerEvent('pointerdown', { x: 150, y: 400 }));
  layout.dispatchEvent(pointerEvent('pointermove', { x: 50, y: 400 }));
  layout.dispatchEvent(pointerEvent('pointerup', { x: 50, y: 400 }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(layout.$.drawerStartOpen, true, 'sub-threshold drag keeps the drawer open');

  // Committed drag: 260px of 335px → progress ~0.22 → closes.
  drawerNode.dispatchEvent(pointerEvent('pointerdown', { x: 150, y: 400 }));
  layout.dispatchEvent(pointerEvent('pointermove', { x: -110, y: 400 }));
  layout.dispatchEvent(pointerEvent('pointerup', { x: -110, y: 400 }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(layout.$.drawerStartOpen, false, 'committed drag closes the drawer');
});

async function buildDrawerLayout(body, index) {
  const layout = document.createElement('panel-layout');
  body.append(layout);
  layout.getBoundingClientRect = () => ({ width: 390, height: 844, top: 0, left: index * 390, bottom: 844, right: index * 390 + 390 });
  layout.setAttribute('responsive-mode', 'swipe');
  layout.registerPanelType('drawer-nav', { title: 'Nav', icon: 'folder', behavior: { mobileDock: 'start', swipeControl: 'rail' } });
  layout.registerPanelType('drawer-content', { title: 'Content', icon: 'article', behavior: { mobileDock: 'primary' } });
  layout.registerPanelType('drawer-side', { title: 'Side', icon: 'hub', behavior: { mobileDock: 'end', swipeControl: 'rail' } });
  layout.setLayout(createSplit(
    'horizontal',
    createPanel('drawer-nav'),
    createSplit('horizontal', createPanel('drawer-content'), createPanel('drawer-side'), 0.7),
    0.25,
  ));
  await new Promise((r) => setTimeout(r, 0));
  return layout;
}

test('opening a drawer in one visible layout closes drawers in a peer layout', async () => {
  let { parseHTML } = await import('linkedom');
  let { window } = parseHTML('<!doctype html><html><body></body></html>');
  let TestCSSStyleSheet = class { replaceSync(text) { this.cssText = text; } };
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    customElements: window.customElements,
    Node: window.Node,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    MutationObserver: window.MutationObserver,
    ShadowRoot: window.ShadowRoot || class ShadowRootStub {},
    CSSStyleSheet: TestCSSStyleSheet,
    getComputedStyle: window.getComputedStyle || (() => ({ transitionDuration: '0s', animationDuration: '0s' })),
  });
  window.document.adoptedStyleSheets = [];
  const div = window.document.createElement('div');
  const StyleProto = Object.getPrototypeOf(div.style);
  StyleProto.getPropertyPriority = StyleProto.getPropertyPriority || (() => '');
  const fresh = `?fresh=drawer-peer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await import(`../layout/LayoutNode/LayoutNode.js${fresh}`);
  await import(`../layout/Layout/Layout.js${fresh}`);
  let first = { layout: await buildDrawerLayout(document.body, 0) };
  let second = { layout: await buildDrawerLayout(document.body, 1) };

  first.layout.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(first.layout.$.drawerStartOpen, true);

  second.layout.openDrawer('end');
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(second.layout.$.drawerEndOpen, true, 'peer drawer opens');
  assert.equal(first.layout.$.drawerStartOpen, false,
    'opening in one layout closes the open drawer in the other visible layout');
});

test('a nested layout collapse toggle never bubbles into the outer layout desktop path', async () => {
  let { parseHTML } = await import('linkedom');
  let { window } = parseHTML('<!doctype html><html><body></body></html>');
  let TestCSSStyleSheet = class { replaceSync(text) { this.cssText = text; } };
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    customElements: window.customElements,
    Node: window.Node,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    MutationObserver: window.MutationObserver,
    ShadowRoot: window.ShadowRoot || class ShadowRootStub {},
    CSSStyleSheet: TestCSSStyleSheet,
    getComputedStyle: window.getComputedStyle || (() => ({ transitionDuration: '0s', animationDuration: '0s' })),
  });
  window.document.adoptedStyleSheets = [];
  const div = window.document.createElement('div');
  const StyleProto = Object.getPrototypeOf(div.style);
  StyleProto.getPropertyPriority = StyleProto.getPropertyPriority || (() => '');
  const fresh = `?fresh=nested-collapse-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await import(`../layout/LayoutNode/LayoutNode.js${fresh}`);
  await import(`../layout/Layout/Layout.js${fresh}`);

  let outer = await buildDrawerLayout(document.body, 0);
  let innerHost = outer.querySelector('layout-node').shadowRoot?.querySelector('.panel-view')
    || outer.querySelector('layout-node .panel-view')
    || outer.querySelector('layout-node');
  let inner = await buildDrawerLayout(innerHost, 1);
  inner.style.width = '100%';
  inner.style.height = '100%';

  inner.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  let innerNode = findDrawerNode(inner, 'start');
  assert.ok(innerNode, 'inner drawer node exists');
  let innerPanelId = innerNode.$.nodeId;

  const outerTreePanels = [];
  (function collect(node) {
    if (!node) return;
    if (node.type === 'panel') outerTreePanels.push({ id: node.id, collapsed: !!node.collapsed });
    collect(node.first); collect(node.second);
  })(outer.$.layoutTree);
  const outerPanelsBefore = outerTreePanels.map((p) => p.collapsed).join(',');

  innerNode.dispatchEvent(new CustomEvent('panel-collapse-toggle', {
    bubbles: true, composed: true,
    detail: { panelId: innerPanelId, collapsed: true },
  }));
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(inner.$.drawerStartOpen, false, 'inner drawer closed via the drawer route');
  assert.ok(!innerNode.hasAttribute('collapsed'), 'inner node has no collapsed attr');
  const outerPanelsAfter = [];
  (function collect(node) {
    if (!node) return;
    if (node.type === 'panel') outerPanelsAfter.push(!!node.collapsed);
    collect(node.first); collect(node.second);
  })(outer.$.layoutTree);
  assert.equal(outerPanelsAfter.join(','), outerPanelsBefore,
    'outer layout tree must not absorb a collapse event from a nested layout panel');
});
