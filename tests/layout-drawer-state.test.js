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

test('a drag-borne click on a tree row is suppressed even when the gesture started on another surface', async () => {
  // Regression: the trailing click is dispatched at the RELEASE point — the
  // drawer that just slid open/closed under the finger — while token.target
  // is the surface where the gesture STARTED. Suppression must key off the
  // panel identity for gesture tokens, not geometric target containment.
  let { layout } = await makeDrawerFixture();
  layout.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  let drawerNode = findDrawerNode(layout, 'start');
  assert.ok(drawerNode);
  let primaryNode = layout.querySelector('layout-node[mobile-dock="primary"]');
  assert.ok(primaryNode);

  let row = document.createElement('div');
  row.setAttribute('class', 'sn-tree-row');
  drawerNode.append(row);

  // Token exactly as _onDrawerPointerUp records it: target = gesture origin
  // surface (the primary content node), panelId = the drawer's panel.
  layout._ignoreNextDrawerClick = {
    pointerId: 7,
    panelId: drawerNode.dataset.drawerPanelId,
    target: primaryNode,
    gesture: true,
    expiresAt: layout._drawerNow() + 700,
  };
  let gestureClick = new window.Event('click', { bubbles: true, cancelable: true });
  row.dispatchEvent(gestureClick);
  assert.equal(gestureClick.defaultPrevented, true,
    'trailing gesture click on a tree row is swallowed despite a different gesture-origin target');
  assert.equal(layout._ignoreNextDrawerClick, null, 'the token is consumed');

  // A fresh independent tap afterwards is free (no token, no drag state).
  let freshTap = new window.Event('click', { bubbles: true, cancelable: true });
  row.dispatchEvent(freshTap);
  assert.equal(freshTap.defaultPrevented, false, 'independent row tap remains usable');
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










// --- Escape owner election: real DOM dispatch regression tests -------------
// These tests always go through document-level dispatch of a real bubbling,
// composed keydown event. They never call _consumeDrawerEscape/closeDrawer
// directly: direct sequential method calls cannot prove anything about DOM
// event ordering.

async function makeEscapeEnv(tag) {
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
  const fresh = `?fresh=${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await import(`../layout/LayoutNode/LayoutNode.js${fresh}`);
  await import(`../layout/Layout/Layout.js${fresh}`);
  return { window };
}

function escapeKeydown() {
  const e = new window.Event('keydown', { bubbles: true, cancelable: true, composed: true });
  e.key = 'Escape';
  return e;
}

function nestInto(innerIntoOuterHost, outer) {
  let host = outer.querySelector('layout-node').shadowRoot?.querySelector('.panel-view')
    || outer.querySelector('layout-node .panel-view')
    || outer.querySelector('layout-node');
  host.append(innerIntoOuterHost);
  return host;
}

function hideFromPeers(layout) {
  layout.getBoundingClientRect = () => ({ width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 });
}

test('Escape owner follows the event path: outer layout registered before inner', async () => {
  await makeEscapeEnv('escape-nested-out-first');
  let outer = await buildDrawerLayout(document.body, 0);
  let inner = await buildDrawerLayout(document.body, 1); // registered second
  nestInto(inner, outer);
  inner.style.width = '100%';
  inner.style.height = '100%';

  outer.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  // Keep both drawers' state open: the peer rule is about *visible* surfaces,
  // so while outer is hidden the inner opening does not close it.
  hideFromPeers(outer);
  inner.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(outer._isDrawerOpen('start'), 'outer drawer still open');
  assert.ok(inner._isDrawerOpen('start'), 'inner drawer open');

  // Real dispatched keydown from inside the inner layout: the inner layout
  // owns the escape even though the outer listener was registered first.
  let target = findDrawerNode(inner, 'start') || inner;
  target.dispatchEvent(escapeKeydown());
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(inner.$.drawerStartOpen, false, 'one Escape closes the inner (event-path) drawer');
  assert.equal(outer.$.drawerStartOpen, true, 'outer drawer survives: exactly one layer per keypress');

  // A keypress whose path covers only the outer layout closes the outer one.
  outer.dispatchEvent(escapeKeydown());
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(outer.$.drawerStartOpen, false, 'second Escape closes the outer layer');
});

test('Escape owner is independent of the registration order (inner registered first)', async () => {
  await makeEscapeEnv('escape-nested-in-first');
  let inner = await buildDrawerLayout(document.body, 0); // registered first
  let outer = await buildDrawerLayout(document.body, 1);
  nestInto(inner, outer); // DOM nesting reversed vs registration order

  outer.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  hideFromPeers(outer);
  inner.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(outer._isDrawerOpen('start'));
  assert.ok(inner._isDrawerOpen('start'));

  let target = findDrawerNode(inner, 'start') || inner;
  target.dispatchEvent(escapeKeydown());
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(inner.$.drawerStartOpen, false, 'deepest layout on the event path owns Escape');
  assert.equal(outer.$.drawerStartOpen, true, 'outer (registered later, open) is untouched');
});

test('two sibling layouts: Escape closes only the layout on the event path', async () => {
  await makeEscapeEnv('escape-siblings');
  let first = await buildDrawerLayout(document.body, 0);
  let second = await buildDrawerLayout(document.body, 1);

  second.openDrawer('end');
  await new Promise((r) => setTimeout(r, 0));
  // The one-drawer rule skips invisible peers, so with the second layout
  // hidden the first can open its own drawer alongside.
  hideFromPeers(second);
  first.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(first._isDrawerOpen('start'));
  assert.ok(second._isDrawerOpen('end'));

  (findDrawerNode(second, 'end') || second).dispatchEvent(escapeKeydown());
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(second.$.drawerEndOpen, false, 'targeted sibling closes');
  assert.equal(first.$.drawerStartOpen, true, 'adjacent sibling stays open');

  (findDrawerNode(first, 'start') || first).dispatchEvent(escapeKeydown());
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(first.$.drawerStartOpen, false, 'the other sibling closes on its own Escape');
});

test('a nested dialog above the drawer consumes Escape first; the drawer closes on the next one', async () => {
  await makeEscapeEnv('escape-dialog');
  let layout = await buildDrawerLayout(document.body, 0);
  layout.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(layout._isDrawerOpen('start'));

  // A top-layer dialog outside the layout that handles its own Escape
  // (menu/dialog contract: preventDefault on the handled keydown).
  let dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  document.body.append(dialog);
  let dialogContent = document.createElement('button');
  dialog.append(dialogContent);
  let dialogOpen = true;
  let onDialogKeydown = (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault(); // accepted Escape handling by the dialog
    dialogOpen = false;
    dialog.removeEventListener('keydown', onDialogKeydown);
  };
  dialog.addEventListener('keydown', onDialogKeydown);

  dialogContent.dispatchEvent(escapeKeydown());
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(dialogOpen, false, 'dialog consumed the first Escape');
  assert.equal(layout.$.drawerStartOpen, true, 'drawer stays open under the handled dialog Escape');

  // Dialog gone: the next Escape is owned by the drawer layer.
  document.body.dispatchEvent(escapeKeydown());
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(layout.$.drawerStartOpen, false, 'drawer closes on the following Escape');
});

test('focus returns on button- and swipe-driven closes, reopens with a fresh opener, drops removed openers', async () => {
  await makeEscapeEnv('escape-focus-matrix');
  let layout = await buildDrawerLayout(document.body, 0);
  layout._getFallbackDrawerWidth = () => 335;

  let host = document.createElement('div');
  document.body.append(host);
  let shadow = host.attachShadow({ mode: 'open' });
  let shadowOpener = document.createElement('button');
  shadow.append(shadowOpener);
  let focusCalls = new Map();
  let trackFocus = (el) => { focusCalls.set(el, 0); let orig = el.focus?.bind(el); el.focus = () => { focusCalls.set(el, focusCalls.get(el) + 1); orig?.(); }; };
  trackFocus(shadowOpener);

  let drawerInnards = () => findDrawerNode(layout, 'start');

  // (a) Shadow-DOM opener, close via the public "button" path (closeDrawer).
  layout.ownerDocument.activeElement = shadowOpener;
  layout.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(layout._drawerFocusReturnTarget, shadowOpener, 'shadow opener recorded');
  layout.ownerDocument.activeElement = drawerInnards();
  layout.closeDrawer('start'); // e.g. header close button / backdrop
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(focusCalls.get(shadowOpener), 1, 'focus returned to the shadow opener on close');
  assert.equal(layout._drawerFocusReturnTarget, null, 'return target cleared after close');

  // (b) Independent reopening with a different opener — no stale target.
  let opener2 = document.createElement('button');
  document.body.append(opener2);
  trackFocus(opener2);
  layout.ownerDocument.activeElement = opener2;
  layout.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(layout._drawerFocusReturnTarget, opener2, 'second opening records its own opener');
  layout.ownerDocument.activeElement = drawerInnards();
  // Swipe close: committed drag past the threshold.
  drawerInnards().dispatchEvent(pointerEvent('pointerdown', { x: 150, y: 400 }));
  layout.dispatchEvent(pointerEvent('pointermove', { x: -110, y: 400 }));
  layout.dispatchEvent(pointerEvent('pointerup', { x: -110, y: 400 }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(layout.$.drawerStartOpen, false, 'swipe closes the drawer');
  assert.equal(focusCalls.get(opener2), 1, 'focus returned to the second opener after swipe close');
  assert.equal(focusCalls.get(shadowOpener), 1, 'first opener not refocused');
  assert.equal(layout._drawerFocusReturnTarget, null);

  // (c) Reopening from inside the drawer does not overwrite the opener.
  layout.ownerDocument.activeElement = opener2;
  layout.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  layout.ownerDocument.activeElement = drawerInnards();
  layout.openDrawer('start'); // re-open driven from inside (e.g. another panel id)
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(layout._drawerFocusReturnTarget, opener2, 'inner reopening keeps the original opener');
  layout.closeDrawer('start');
  await new Promise((r) => setTimeout(r, 0));

  // (d) Opener removed from the document: no crash, no stale record, next
  // opening works normally.
  let doomed = document.createElement('button');
  document.body.append(doomed);
  trackFocus(doomed);
  layout.ownerDocument.activeElement = doomed;
  layout.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  layout.ownerDocument.activeElement = drawerInnards();
  doomed.remove();
  layout.closeDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(focusCalls.get(doomed), 0, 'removed opener is never focused');
  assert.equal(layout._drawerFocusReturnTarget, null, 'stale opener dropped');

  layout.ownerDocument.activeElement = opener2;
  layout.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(layout._drawerFocusReturnTarget, opener2, 'fresh opening after removal works');

  // (e) Focus that already left the layout is not hijacked on close.
  let outside = document.createElement('button');
  document.body.append(outside);
  let opener2FocusBefore = focusCalls.get(opener2);
  layout.ownerDocument.activeElement = outside;
  layout.closeDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(focusCalls.get(opener2), opener2FocusBefore,
    'close with outside focus does not steal it back');
});

// Focus-division election proof: neither layout is on the event path, so the
// owner must come from the focus chain — and it must be the DEEPEST (inner)
// layout, not the outer one, regardless of listener registration order.
async function runFocusBranchElection(registrationOrder) {
  await makeEscapeEnv(`escape-focus-branch-${registrationOrder}`);
  let first = registrationOrder === 'outer-first'
    ? await buildDrawerLayout(document.body, 0)
    : null;
  let inner;
  let outer;
  if (first) {
    outer = first;
    inner = await buildDrawerLayout(document.body, 1);
    nestInto(inner, outer);
  } else {
    inner = await buildDrawerLayout(document.body, 1);
    outer = await buildDrawerLayout(document.body, 0);
    nestInto(inner, outer);
  }

  outer.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  hideFromPeers(outer);
  inner.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(outer._isDrawerOpen('start'));
  assert.ok(inner._isDrawerOpen('start'));

  // Focus sits inside the INNER layout's open drawer. The keydown target is
  // an unrelated element next to both layouts — the composed path contains
  // no layout at all, so only the focus chain can elect the owner.
  let innerFocus = findDrawerNode(inner, 'start') || inner;
  document.activeElement = innerFocus;
  let neutral = document.createElement('div');
  document.body.append(neutral);

  neutral.dispatchEvent(escapeKeydown());
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(inner.$.drawerStartOpen, false,
    `focus branch elects the deepest focused layout (${registrationOrder})`);
  assert.equal(outer.$.drawerStartOpen, true,
    `outer layout survives a focus-owned Escape (${registrationOrder})`);
}

test('Escape owner by focus when the event path is empty: outer registered first', async () => {
  await runFocusBranchElection('outer-first');
});

test('Escape owner by focus when the event path is empty: inner registered first', async () => {
  await runFocusBranchElection('inner-first');
});

test('modal drawer marks itself role=dialog/aria-modal and inerts background; closing reverts', async () => {
  await makeEscapeEnv('drawer-modal-contract');
  let layout = await buildDrawerLayout(document.body, 0);

  layout.openDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  let drawerNode = findDrawerNode(layout, 'start');
  assert.equal(drawerNode.getAttribute('role'), 'dialog', 'open drawer is a dialog');
  assert.equal(drawerNode.getAttribute('aria-modal'), 'true', 'modal semantics on');
  assert.equal(drawerNode.getAttribute('tabindex'), '-1', 'drawer surface is focusable');

  // Drawer lives inside the layout-node tree: its ancestors must stay
  // non-inert (inert would swallow the dialog itself), every other sibling
  // subtree becomes inert.
  let nodes = Array.from(layout.querySelectorAll('layout-node'));
  let ancestorOfDrawer = (n) => n === drawerNode || n.contains?.(drawerNode);
  let siblings = nodes.filter((n) => !ancestorOfDrawer(n) && !drawerNode.contains?.(n));
  assert.ok(siblings.length > 0, 'background sibling nodes exist');
  assert.ok(siblings.every((n) => n.hasAttribute('inert')), 'background nodes are inert while open');
  assert.ok(nodes.filter(ancestorOfDrawer).every((n) => !n.hasAttribute('inert')),
    'drawer ancestors are never inert');

  layout.closeDrawer('start');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(drawerNode.hasAttribute('role'), false, 'role removed on close');
  assert.equal(drawerNode.hasAttribute('aria-modal'), false);
  assert.equal(drawerNode.hasAttribute('tabindex'), false);
  assert.ok(siblings.every((n) => !n.hasAttribute('inert')), 'inert removed on close');
});

test('modal drawer traps Tab inside itself and cycles with Shift+Tab', async () => {
  await makeEscapeEnv('drawer-modal-tab-trap');
  let layout = await buildDrawerLayout(document.body, 0);

  layout.openDrawer('end');
  await new Promise((r) => setTimeout(r, 0));
  let drawerNode = findDrawerNode(layout, 'end');
  assert.ok(drawerNode);

  // The trap cycles over exactly the focusables visible to the collector.
  // linkedom has no layout/display model, so the contract is asserted against
  // the collector result itself; the browser smoke proof covers real focus.
  let focusables = layout._collectDrawerFocusables(drawerNode);
  assert.ok(focusables.length >= 2, 'drawer surface exposes focusable controls');
  let focused = [];
  for (let el of focusables) el.focus = () => focused.push(el);

  let tab = (shift = false) => {
    const e = new window.Event('keydown', { bubbles: true, cancelable: true });
    e.key = 'Tab';
    e.shiftKey = shift;
    drawerNode.dispatchEvent(e);
    return e;
  };

  // Focus sits on the drawer surface (as after modal open).
  document.activeElement = drawerNode;
  let first = tab();
  assert.equal(first.defaultPrevented, true, 'Tab on the surface starts the cycle');
  assert.equal(focused.at(-1), focusables[0], 'first Tab enters the first focusable');

  document.activeElement = focusables[0];
  tab();
  assert.equal(focused.at(-1), focusables[1], 'Tab moves forward inside the drawer');

  document.activeElement = focusables.at(-1);
  tab();
  assert.equal(focused.at(-1), focusables[0], 'Tab on the last wraps to the first');

  document.activeElement = focusables[0];
  tab(true);
  assert.equal(focused.at(-1), focusables.at(-1), 'Shift+Tab on the first wraps to the last');

  // Focus outside the drawer: Tab is left to the browser (background is inert).
  let outside = document.createElement('button');
  document.body.append(outside);
  document.activeElement = outside;
  let untouched = tab();
  assert.equal(untouched.defaultPrevented, false, 'outside focus is not trapped');

  // Closing releases the trap entirely.
  layout.closeDrawer('end');
  await new Promise((r) => setTimeout(r, 0));
  document.activeElement = drawerNode;
  let afterClose = tab();
  assert.equal(afterClose.defaultPrevented, false, 'no trap after close');
});
