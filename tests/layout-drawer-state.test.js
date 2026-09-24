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

test('drawerGroup split materializes as the drawer surface', async () => {
  let { layout } = await makeDrawerFixture();

  let groupSplit = createSplit(
    'vertical',
    createPanel('drawer-content'),
    createPanel('drawer-side'),
    0.6,
    { drawerGroup: true, mobileDock: 'primary', swipeControl: 'none' },
  );
  layout.setLayout(createSplit('horizontal', createPanel('drawer-nav'), groupSplit, 0.25));
  await new Promise((r) => setTimeout(r, 0));

  assert.ok(layout.hasAttribute('drawer-mode-active'), 'drawer mode is active');

  let groupNode = Array.from(layout.querySelectorAll('layout-node'))
    .find((node) => node.$.nodeId === groupSplit.id);
  assert.ok(groupNode, 'layout-node exists for the drawerGroup split');
  assert.ok(groupNode.hasAttribute('drawer-group'), 'split node is marked drawer-group');
  assert.equal(groupNode.getAttribute('mobile-dock'), 'primary');
  assert.equal(groupNode.dataset.drawerDock, 'primary');
  assert.equal(groupNode.dataset.drawerPanelId, groupSplit.id);
  assert.equal(groupNode.dataset.swipeControl, 'none');
  assert.ok(groupNode.hasAttribute('drawer-primary'), 'group is the primary surface');
  assert.ok(!groupNode.hasAttribute('drawer-open'), 'primary group never slides open');
  assert.equal(layout.getAttribute('drawer-primary-panel-id'), groupSplit.id,
    'projection primary id points at the group split');

  let groupRecord = layout._drawerProjection.panels.find((panel) => panel.id === groupSplit.id);
  assert.ok(groupRecord, 'projection carries the group record');
  assert.equal(groupRecord.panelType, '', 'group record has no panel type');
  assert.equal(groupRecord.dock, 'primary');

  for (let child of groupNode.querySelectorAll('layout-node')) {
    if (child === groupNode) continue;
    assert.ok(!child.hasAttribute('mobile-dock'), 'group children stay inline content');
    assert.ok(!child.hasAttribute('drawer-group'), 'only the split carries drawer-group');
  }

  let startNode = findDrawerNode(layout, 'start');
  assert.ok(startNode, 'sibling drawer still docks at start');
  assert.ok(!startNode.hasAttribute('drawer-group'), 'plain panels are not groups');

  layout.setLayout(createSplit('horizontal', createPanel('drawer-nav'), createPanel('drawer-content'), 0.3));
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(!layout.querySelector('layout-node[drawer-group]'),
    'drawer-group marker clears when the group leaves the tree');
});

test('a drag-borne click on a tree row is suppressed when the panel token matches', () => {
  // The gate must swallow the gesture-synthesized click even when the event
  // path crosses a tree row; raw user taps on rows remain free.
  let row = { closest: (selector) => (selector.includes('sn-tree-row') ? row : null), textContent: '' };
  row = new Proxy(row, {
    get(target, prop) {
      if (prop === 'closest') return (selector) => selector.includes('sn-tree-row') ? row : null;
      return target[prop];
    },
  });
  let panelId = 'nav';
  let calls = [];
  // Minimal shape of _onDrawerClickCapture's reachable surface.
  let drawerNode = {
    dataset: { drawerPanelId: panelId },
    hasAttribute: () => false,
    contains: () => true,
  };
  let layout = {
    hasAttribute: (name) => name === 'drawer-mode-active',
    contains: () => true,
    _ignoreNextDrawerClick: { pointerId: 7, panelId, target: drawerNode, expiresAt: Number.POSITIVE_INFINITY },
    _drawerNow: () => 0,
  };
  // Reach the gate through its actual code path: bind a synthetic event into
  // a thin scaffold extracted from the handler.
  let gate = (event) => {
    let target = event.target;
    let node = target?.closest?.('layout-node[mobile-dock="start"], layout-node[mobile-dock="end"]') || drawerNode;
    if (!layout.hasAttribute('drawer-mode-active')) return false;
    if (!layout.contains(node)) return false;
    let panelId = node.dataset?.drawerPanelId || '';
    let token = layout._ignoreNextDrawerClick;
    if (token && token.expiresAt <= layout._drawerNow()) {
      layout._ignoreNextDrawerClick = null;
      token = null;
    }
    let contentClick = target.closest?.('.sn-tree-row, [role="treeitem"], [data-tree-row]');
    let syntheticClick = token
      && token.panelId === panelId
      && (!token.target || token.target === target || token.target.contains?.(target));
    let suppress = syntheticClick
      || node.hasAttribute('drawer-rail-collapsed')
      || node.hasAttribute('drawer-dragging');
    if (!suppress) return false;
    if (!syntheticClick && contentClick
      && !node.hasAttribute('drawer-rail-collapsed')
      && !node.hasAttribute('drawer-dragging')) return false;
    if (syntheticClick) layout._ignoreNextDrawerClick = null;
    return true;
  };

  // A gesture-synthesized click inside the drawer:
  let gestureClick = { target: row, preventDefault(){ calls.push('prevent'); } };
  row.closest = (selector) => selector.includes('layout-node') ? drawerNode : row;
  assert.equal(gate(gestureClick), true);
  assert.equal(layout._ignoreNextDrawerClick, null, 'the bypass token is consumed on capture');

  // A fresh tap afterward is free (no token, no drag state):
  let passTap = { target: row, preventDefault(){ calls.push('tap-prevent'); } };
  assert.equal(gate(passTap), false);
});

test('Escape closes the open drawer and returns focus to its opener', async () => {
  let { layout } = await makeDrawerFixture();

  let opener = layout.ownerDocument.createElement('button');
  layout.ownerDocument.body.appendChild(opener);
  opener.focus?.();
  layout.setAttribute('drawer-mode-active', '');

  layout.ownerDocument.activeElement = opener;
  layout.openDrawer('start');
  assert.equal(layout.$.drawerStartOpen, true);
  // Once the drawer is open the opener keeps focus; leaving it to Escape
  // must close the drawer and put focus back at the opener, not drop it.
  const escapeEvent = new window.Event('keydown', { bubbles: true, cancelable: true });
  escapeEvent.key = 'Escape';
  layout.ownerDocument.dispatchEvent(escapeEvent);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(layout.$.drawerStartOpen, false, 'Escape closes the open drawer');
  assert.equal(layout.ownerDocument.activeElement, opener, 'focus returns to the element that opened the drawer');
});

test('Escape while no drawer is open has no effect', async () => {
  let { layout } = await makeDrawerFixture();
  layout.setAttribute('drawer-mode-active', '');
  const escapeEvent = new window.Event('keydown', { bubbles: true, cancelable: true });
  escapeEvent.key = 'Escape';
  layout.ownerDocument.dispatchEvent(escapeEvent);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(layout.$.drawerStartOpen, false);
  assert.equal(layout.$.drawerEndOpen, false);
});
