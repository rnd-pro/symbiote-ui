import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPATIAL_CAPTURE_COMPONENTS,
  SPATIAL_HEADER_CONTROLS,
  SPATIAL_ICON_SELECTOR,
  captureSpatialSnapshot,
  captureSpatialWindowSnapshot,
  createCanvasColorNormalizer,
  resolveHeaderControlSelector,
  resolveSpatialAdapter,
} from '../xr/dom-spatial-capture.js';

test('dom-spatial-capture evaluates safely in Node without a DOM', () => {
  assert.equal(typeof document, 'undefined');
  assert.deepEqual([...SPATIAL_CAPTURE_COMPONENTS].sort(), [
    'canvas-graph',
    'cell-bg',
    'chat-transcript',
    'layout-node',
    'node-canvas',
    'sn-badge',
    'sn-data-table',
    'sn-description-list',
    'sn-metric',
    'sn-scroll-area',
    'sn-tree-panel',
    'source-editor',
    'source-viewer',
  ]);
});

test('resolveSpatialAdapter returns adapters for registered components', () => {
  for (let component of SPATIAL_CAPTURE_COMPONENTS) {
    let adapter = resolveSpatialAdapter(component);
    assert.equal(typeof adapter.capture, 'function');
  }
});

test('resolveSpatialAdapter throws with supported options on unknown components', () => {
  assert.throws(
    () => resolveSpatialAdapter('marquee'),
    /Unknown spatial capture adapter "marquee"\. Supported: canvas-graph, cell-bg, chat-transcript, layout-node, node-canvas, sn-badge, sn-data-table, sn-description-list, sn-metric, sn-scroll-area, sn-tree-panel, source-editor, source-viewer\./,
  );
});

test('captureSpatialSnapshot requires an element root', () => {
  assert.throws(() => captureSpatialSnapshot(null), /root element/);
  assert.throws(() => captureSpatialSnapshot({}), /root element/);
});

test('captureSpatialSnapshot adapts CanvasGraph public nodes into positioned native cards', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let graph = fakeElement(doc, {
    tag: 'canvas-graph',
    rect: { left: 12, top: 44, width: 320, height: 180 },
    styles: { 'background-color': 'rgb(18, 22, 28)', color: 'rgb(230, 230, 230)', 'font-size': '13px' },
  });
  graph.nodes = [
    { id: 'agent', label: 'Dispatcher', icon: 'smart_toy' },
    { id: 'service', label: 'UNIAPI', icon: 'hub' },
  ];
  graph.edges = [{ from: 'agent', to: 'service', label: 'invoke' }];
  graph.nodePositions = new Map([
    ['agent', { x: 0, y: 0 }],
    ['service', { x: 100, y: 100 }],
  ]);
  let snapshot = captureSpatialSnapshot(createHeaderIconPanelLayout(doc, { contentChildren: [graph] }));
  let byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  let graphId = 'panel:project/canvas-graph:1';
  assert.deepEqual(byId.get(graphId).style, { 'background-color': 'rgb(18, 22, 28)' });
  assert.equal(byId.get(`${graphId}/summary`).text, '2 nodes · 1 link');
  assert.equal(byId.get(`${graphId}/summary`).style.color, 'rgb(230, 230, 230)');
  assert.equal(byId.get(`${graphId}/node:agent`).part, 'row');
  assert.deepEqual(byId.get(`${graphId}/node:agent`).style, { 'background-color': 'rgb(18, 22, 28)' });
  assert.equal(byId.get(`${graphId}/node:agent/label`).text, 'Dispatcher');
  assert.deepEqual(byId.get(`${graphId}/node:agent/icon:smart_toy`).icon, { name: 'smart_toy' });
  assert.ok(byId.get(`${graphId}/node:service`).rect.x > byId.get(`${graphId}/node:agent`).rect.x);
});

test('captureSpatialSnapshot adapts a cell background into bounded semantic dots', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let effect = fakeElement(doc, {
    tag: 'cell-bg',
    rect: { left: 12, top: 44, width: 320, height: 180 },
  });
  effect.getSpatialPresentation = () => ({
    width: 320,
    height: 180,
    background: 'rgb(18, 22, 28)',
    dots: [
      { x: 16, y: 20, radius: 3, color: 'rgba(120, 160, 220, 0.4)' },
      { x: 48, y: 60, radius: 4, color: 'rgba(180, 210, 255, 0.7)' },
    ],
  });
  let snapshot = captureSpatialSnapshot(createHeaderIconPanelLayout(doc, { contentChildren: [effect] }));
  let surface = snapshot.nodes.find((node) => node.component === 'cell-bg' && node.id.endsWith('/cell-bg:1'));
  let dots = snapshot.nodes.filter((node) => node.component === 'cell-bg' && node.id.includes('/dot:'));
  assert.deepEqual(surface.style, { 'background-color': 'rgb(18, 22, 28)' });
  assert.equal(dots.length, 2);
  assert.equal(dots[0].state.shape, 'circle');
  assert.deepEqual(snapshot.diagnostics.unsupported, []);
});

test('captureSpatialSnapshot adapts NodeCanvas graph nodes without traversing SVG internals', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let icon = fakeIconElement(doc, {
    rect: { left: 36, top: 74, width: 16, height: 16 },
    name: 'play_circle',
  });
  let node = fakeElement(doc, {
    tag: 'graph-node',
    rect: { left: 28, top: 66, width: 120, height: 62 },
    dataset: { nodeId: 'start' },
    text: 'play_circle Work order submitted',
    childNodes: [icon, fakeTextNode(' Work order submitted')],
    queriesAll: { [SPATIAL_ICON_SELECTOR]: [icon] },
    styles: { 'background-color': 'rgb(30, 38, 50)', color: 'rgb(240, 240, 240)', 'font-size': '13px' },
  });
  let graph = fakeElement(doc, {
    tag: 'node-canvas',
    rect: { left: 12, top: 44, width: 320, height: 180 },
    queriesAll: { 'graph-node': [node] },
    styles: { 'background-color': 'rgb(18, 22, 28)' },
  });
  let snapshot = captureSpatialSnapshot(createHeaderIconPanelLayout(doc, { contentChildren: [graph] }));
  let byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  let canvasId = 'panel:project/node-canvas:1';
  assert.deepEqual(byId.get(canvasId).style, { 'background-color': 'rgb(18, 22, 28)' });
  assert.deepEqual(byId.get(`${canvasId}/node:start`).style, { 'background-color': 'rgb(30, 38, 50)' });
  assert.equal(byId.get(`${canvasId}/node:start/label`).text, 'Work order submitted');
  assert.deepEqual(byId.get(`${canvasId}/node:start/icon:play_circle`).icon, { name: 'play_circle' });
  assert.equal(snapshot.diagnostics.unsupported.length, 0);
  assert.equal(snapshot.diagnostics.unknownVisible.length, 0);
});

function createFakeColorContext(conversions) {
  let fill = null;
  let drawn = [0, 0, 0, 0];
  return {
    get fillStyle() {
      return fill;
    },
    set fillStyle(value) {
      if (conversions.has(value)) fill = value;
    },
    clearRect() {
      drawn = [0, 0, 0, 0];
    },
    fillRect() {
      drawn = conversions.get(fill) || [0, 0, 0, 0];
    },
    getImageData() {
      return { data: [...drawn] };
    },
  };
}

function createFakeDocument(conversions) {
  return {
    defaultView: {
      getComputedStyle(element) {
        return { getPropertyValue: (key) => element.__styles?.[key] || '' };
      },
    },
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return {
        width: 0,
        height: 0,
        getContext(kind) {
          assert.equal(kind, '2d');
          return createFakeColorContext(conversions);
        },
      };
    },
  };
}

function fakeElement(doc, options) {
  let {
    tag,
    rect,
    attrs = {},
    queries = {},
    queriesAll = {},
    children = [],
    childNodes = [],
    styles = {},
    text = '',
    dataset = {},
    matches,
    hidden = false,
  } = options;
  return {
    tagName: tag.toUpperCase(),
    ownerDocument: doc,
    dataset,
    children,
    childNodes,
    hidden,
    nodeType: 1,
    textContent: text,
    __styles: styles,
    getBoundingClientRect: () => rect,
    getAttribute: (name) => (name in attrs ? attrs[name] : null),
    hasAttribute: (name) => name in attrs,
    querySelector: (selector) => queries[selector] || null,
    querySelectorAll: (selector) => queriesAll[selector] || [],
    matches: matches || (() => false),
  };
}

const SENTINEL_CONVERSIONS = Object.freeze([
  ['#010203', [1, 2, 3, 255]],
  ['#040506', [4, 5, 6, 255]],
]);

test('header controls assign distinct stable intents to the panel menu and type buttons', () => {
  let bySelector = new Map(SPATIAL_HEADER_CONTROLS.map((control) => [control.selector, control]));
  assert.deepEqual(bySelector.get('.panel-menu-toggle'), {
    selector: '.panel-menu-toggle',
    actionId: 'open-panel-menu',
    intent: 'panel-menu',
  });
  assert.deepEqual(bySelector.get('.type-btn'), {
    selector: '.type-btn',
    actionId: 'open-type-menu',
    intent: 'panel-type-menu',
  });
  let intents = SPATIAL_HEADER_CONTROLS.map((control) => control.intent);
  assert.equal(new Set(intents).size, intents.length, 'header control intents must be unique');
});

test('resolveHeaderControlSelector maps every header intent to its own DOM control', () => {
  assert.equal(resolveHeaderControlSelector('panel-collapse-toggle'), '.collapse-btn');
  assert.equal(resolveHeaderControlSelector('panel-fullscreen'), '.fullscreen-btn');
  assert.equal(resolveHeaderControlSelector('panel-menu'), '.panel-menu-toggle');
  assert.equal(resolveHeaderControlSelector('panel-type-menu'), '.type-btn');
  assert.throws(
    () => resolveHeaderControlSelector('sn-tree-select'),
    /Unknown header control intent "sn-tree-select"\. Supported: /,
  );
});

test('canvas color normalizer converts CSS Color 4 values to rgb()/rgba() preserving alpha', () => {
  let conversions = new Map([
    ...SENTINEL_CONVERSIONS,
    ['oklch(0.7 0.1 200)', [64, 138, 171, 255]],
    ['oklch(0.6 0.2 30 / 0.5)', [200, 100, 50, 128]],
    ['lab(50% 20 30)', [150, 90, 60, 255]],
    ['transparent', [0, 0, 0, 0]],
  ]);
  let normalize = createCanvasColorNormalizer(createFakeDocument(conversions));
  assert.equal(normalize('oklch(0.7 0.1 200)'), 'rgb(64, 138, 171)');
  assert.equal(normalize('oklch(0.6 0.2 30 / 0.5)'), 'rgba(200, 100, 50, 0.502)');
  assert.equal(normalize('lab(50% 20 30)'), 'rgb(150, 90, 60)');
  assert.equal(normalize('transparent'), 'rgba(0, 0, 0, 0)');
});

test('canvas color normalizer passes rgb()/hex through and reports unconvertible values as null', () => {
  let normalize = createCanvasColorNormalizer(createFakeDocument(new Map(SENTINEL_CONVERSIONS)));
  assert.equal(normalize('rgb(1, 2, 3)'), 'rgb(1, 2, 3)');
  assert.equal(normalize('rgba(1, 2, 3, 0.5)'), 'rgba(1, 2, 3, 0.5)');
  assert.equal(normalize('#AABBCC'), '#AABBCC');
  assert.equal(normalize('var(--sn-sys-accent)'), null);
  assert.equal(normalize(''), null);
  assert.equal(normalize(null), null);
});

test('canvas color normalizer without a document fast-paths rgb and nulls unconvertible colors', () => {
  let normalize = createCanvasColorNormalizer(null);
  assert.equal(normalize('rgb(1, 2, 3)'), 'rgb(1, 2, 3)');
  assert.equal(normalize('#aabbcc'), '#aabbcc');
  assert.equal(normalize('oklch(0.7 0.1 200)'), null);
});

function createFakePanelLayout(doc) {
  let collapseBtn = fakeElement(doc, {
    tag: 'button',
    rect: { left: 720, top: 4, width: 20, height: 20 },
    styles: { 'background-color': 'oklch(0.7 0.1 200)', 'color': 'rgb(255, 255, 255)' },
  });
  let fullscreenBtn = fakeElement(doc, {
    tag: 'button',
    rect: { left: 744, top: 4, width: 20, height: 20 },
    styles: { 'background-color': 'var(--unresolved-token)' },
  });
  let menuToggle = fakeElement(doc, {
    tag: 'button',
    rect: { left: 768, top: 4, width: 20, height: 20 },
  });
  let typeBtn = fakeElement(doc, {
    tag: 'button',
    rect: { left: 696, top: 4, width: 20, height: 20 },
  });
  let title = fakeElement(doc, {
    tag: 'span',
    rect: { left: 8, top: 4, width: 120, height: 20 },
    text: 'Project',
    childNodes: [{ nodeType: 3, textContent: 'Project' }],
    styles: { 'color': 'oklch(0.6 0.2 30 / 0.5)', 'font-size': '13px' },
  });
  let header = fakeElement(doc, {
    tag: 'div',
    rect: { left: 0, top: 0, width: 800, height: 28 },
    styles: { 'background-color': 'oklch(0.4 0.05 250)' },
    queries: {
      '.panel-title': title,
      '.collapse-btn': collapseBtn,
      '.fullscreen-btn': fullscreenBtn,
      '.panel-menu-toggle': menuToggle,
      '.type-btn': typeBtn,
    },
  });
  let panelComponent = { tagName: 'PROJECT-PANEL', dataset: { panelId: 'project' } };
  let content = fakeElement(doc, {
    tag: 'div',
    rect: { left: 0, top: 28, width: 800, height: 572 },
    children: [],
  });
  let layoutNode = fakeElement(doc, {
    tag: 'layout-node',
    rect: { left: 0, top: 0, width: 800, height: 600 },
    attrs: { 'node-type': 'panel' },
    styles: { 'background-color': 'rgb(32, 32, 32)' },
    queries: {
      ':scope > .panel-view > .panel-content > [data-panel-id]': panelComponent,
      ':scope > .panel-view > .panel-header': header,
      ':scope > .panel-view > .panel-content': content,
    },
  });
  return fakeElement(doc, {
    tag: 'panel-layout',
    rect: { left: 0, top: 0, width: 800, height: 600 },
    children: [layoutNode],
  });
}

test('captureSpatialWindowSnapshot captures exactly one leaf layout window', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let layout = createFakePanelLayout(doc);
  let snapshot = captureSpatialWindowSnapshot(layout.children[0], {
    route: 'multi-agent-dev/source-editor',
    themeScope: 'global',
  });

  assert.deepEqual(snapshot.capture.viewport, { width: 800, height: 600 });
  assert.equal(snapshot.capture.route, 'multi-agent-dev/source-editor');
  assert.equal(snapshot.capture.themeScope, 'global');
  assert.equal(snapshot.nodes.filter((node) => node.part === 'panel').length, 1);
  assert.equal(snapshot.nodes.find((node) => node.part === 'panel').id, 'panel:project');
  assert.throws(
    () => captureSpatialWindowSnapshot(layout),
    /leaf layout-node\[node-type="panel"\]/,
  );
});

test('captureSpatialSnapshot assigns distinct intents to panel menu and type button controls', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let snapshot = captureSpatialSnapshot(createFakePanelLayout(doc));
  let byId = new Map(snapshot.nodes.map((node) => [node.id, node]));

  let menuControl = byId.get('panel:project/control:open-panel-menu');
  assert.ok(menuControl, 'panel menu control is captured');
  assert.deepEqual(menuControl.actions, [{ id: 'open-panel-menu', targetId: 'panel:project', intent: 'panel-menu' }]);

  let typeControl = byId.get('panel:project/control:open-type-menu');
  assert.ok(typeControl, 'type menu control is captured');
  assert.deepEqual(typeControl.actions, [{ id: 'open-type-menu', targetId: 'panel:project', intent: 'panel-type-menu' }]);

  let collapseControl = byId.get('panel:project/control:toggle-collapse');
  assert.deepEqual(collapseControl.actions, [{ id: 'toggle-collapse', targetId: 'panel:project', intent: 'panel-collapse-toggle' }]);
  let fullscreenControl = byId.get('panel:project/control:toggle-fullscreen');
  assert.deepEqual(fullscreenControl.actions, [{ id: 'toggle-fullscreen', targetId: 'panel:project', intent: 'panel-fullscreen' }]);
});

test('captureSpatialSnapshot bounds scroll-area content to the visible viewport and captures native chrome', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let visibleLabel = fakeElement(doc, {
    tag: 'span',
    rect: { left: 16, top: 48, width: 120, height: 20 },
    text: 'Visible record',
    childNodes: [fakeTextNode('Visible record')],
    matches: (selector) => selector === '.scroll-label',
  });
  let hiddenLabel = fakeElement(doc, {
    tag: 'span',
    rect: { left: 16, top: 212, width: 120, height: 20 },
    text: 'Offscreen record',
    childNodes: [fakeTextNode('Offscreen record')],
    matches: (selector) => selector === '.scroll-label',
  });
  let thumb = fakeElement(doc, {
    tag: 'div',
    rect: { left: 262, top: 66, width: 6, height: 28 },
    styles: { 'background-color': 'rgb(120, 140, 160)' },
  });
  let verticalTrack = fakeElement(doc, {
    tag: 'div',
    rect: { left: 260, top: 40, width: 10, height: 96 },
    styles: { 'background-color': 'rgb(40, 48, 56)' },
    queries: { '.sn-scrollbar-thumb': thumb },
  });
  let viewport = fakeElement(doc, {
    tag: 'div',
    rect: { left: 8, top: 40, width: 252, height: 96 },
    children: [visibleLabel, hiddenLabel],
  });
  viewport.clientHeight = 96;
  viewport.clientWidth = 252;
  viewport.scrollHeight = 320;
  viewport.scrollWidth = 252;
  viewport.scrollTop = 72;
  let scrollArea = fakeElement(doc, {
    tag: 'sn-scroll-area',
    rect: { left: 8, top: 40, width: 262, height: 96 },
    styles: { 'background-color': 'rgb(28, 32, 38)' },
    queries: {
      '.sn-scroll-viewport': viewport,
      '.sn-scrollbar-vertical': verticalTrack,
    },
  });
  let snapshot = captureSpatialSnapshot(
    createHeaderIconPanelLayout(doc, { contentChildren: [scrollArea] }),
    { textSelectors: ['.scroll-label'] },
  );
  let byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  let scroll = [...snapshot.nodes].find((node) => node.component === 'sn-scroll-area' && node.id.endsWith('/scroll-area:1'));
  assert.ok(scroll, 'scroll host is captured as a native surface');
  assert.deepEqual(scroll.state, { overflowX: false, overflowY: true, scrollLeft: 0, scrollTop: 72 });
  assert.ok([...snapshot.nodes].some((node) => node.text === 'Visible record'), 'visible content remains in the snapshot');
  assert.ok(!snapshot.nodes.some((node) => node.text === 'Offscreen record'), 'offscreen content is clipped out of the native snapshot');
  assert.deepEqual(byId.get(`${scroll.id}/viewport`).actions, [{
    id: 'scroll-area', targetId: scroll.id, intent: 'scroll-area',
  }], 'wheel and hand scroll keep a stable native hit target');
  assert.ok(byId.get(`${scroll.id}/vertical-track`), 'vertical track stays visible natively');
  assert.ok(byId.get(`${scroll.id}/vertical-thumb`), 'thumb position stays visible natively');
  assert.deepEqual(snapshot.diagnostics.unsupported, [], 'native scroll chrome no longer produces a scrollbar fidelity gap');
});

test('captureSpatialSnapshot bounds chat transcript messages to their native scroll viewport', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let visibleMessage = fakeElement(doc, {
    tag: 'p',
    rect: { left: 24, top: 52, width: 200, height: 20 },
    text: 'Visible chat message',
    childNodes: [fakeTextNode('Visible chat message')],
    matches: (selector) => selector === '.chat-copy',
  });
  let hiddenMessage = fakeElement(doc, {
    tag: 'p',
    rect: { left: 24, top: 238, width: 200, height: 20 },
    text: 'Offscreen chat message',
    childNodes: [fakeTextNode('Offscreen chat message')],
    matches: (selector) => selector === '.chat-copy',
  });
  let messages = fakeElement(doc, {
    tag: 'div',
    rect: { left: 16, top: 40, width: 240, height: 120 },
    children: [visibleMessage, hiddenMessage],
  });
  messages.clientHeight = 120;
  messages.clientWidth = 240;
  messages.scrollHeight = 420;
  messages.scrollWidth = 240;
  messages.scrollTop = 96;
  let transcript = fakeElement(doc, {
    tag: 'chat-transcript',
    rect: { left: 16, top: 40, width: 240, height: 120 },
    styles: { 'background-color': 'rgb(28, 32, 38)' },
    queries: { '.chat-messages': messages },
  });
  let snapshot = captureSpatialSnapshot(
    createHeaderIconPanelLayout(doc, { contentChildren: [transcript] }),
    { textSelectors: ['.chat-copy'] },
  );
  let transcriptNode = snapshot.nodes.find((node) => (
    node.component === 'chat-transcript' && node.id.endsWith('/chat-transcript:1')
  ));
  assert.ok(transcriptNode, 'chat transcript is captured as a bounded native surface');
  assert.deepEqual(transcriptNode.state, { overflowX: false, overflowY: true, scrollLeft: 0, scrollTop: 96 });
  assert.ok(snapshot.nodes.some((node) => node.text === 'Visible chat message'));
  assert.ok(!snapshot.nodes.some((node) => node.text === 'Offscreen chat message'));
  let viewport = snapshot.nodes.find((node) => node.id === `${transcriptNode.id}/viewport`);
  assert.deepEqual(viewport.actions, [{
    id: 'scroll-area', targetId: transcriptNode.id, intent: 'scroll-area',
  }]);
});

test('captureSpatialSnapshot reaches visible chat content through a zero-size message component host', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let message = fakeElement(doc, {
    tag: 'div',
    rect: { left: 24, top: 52, width: 200, height: 48 },
    text: 'Dispatcher message',
    childNodes: [fakeTextNode('Dispatcher message')],
    styles: { 'background-color': 'rgb(32, 44, 58)' },
    matches: (selector) => selector === '.message',
  });
  let messageItem = fakeElement(doc, {
    tag: 'chat-message-item',
    rect: { left: 0, top: 0, width: 0, height: 0 },
    children: [message],
  });
  let messages = fakeElement(doc, {
    tag: 'div',
    rect: { left: 16, top: 40, width: 240, height: 120 },
    children: [messageItem],
  });
  messages.clientHeight = 120;
  messages.clientWidth = 240;
  messages.scrollHeight = 120;
  messages.scrollWidth = 240;
  let transcript = fakeElement(doc, {
    tag: 'chat-transcript',
    rect: { left: 16, top: 40, width: 240, height: 120 },
    styles: { 'background-color': 'rgb(28, 32, 38)' },
    queries: { '.chat-messages': messages },
  });
  let snapshot = captureSpatialSnapshot(
    createHeaderIconPanelLayout(doc, { contentChildren: [transcript] }),
    { surfaceSelectors: ['.message'] },
  );
  assert.ok(snapshot.nodes.some((node) => node.text === 'Dispatcher message'));
  assert.equal(snapshot.diagnostics.unknownVisible.length, 0);
});

test('captureSpatialSnapshot ignores explicitly declared internal render buffers', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let renderBuffer = fakeElement(doc, {
    tag: 'canvas',
    rect: { left: 16, top: 48, width: 240, height: 120 },
    attrs: { 'data-spatial-internal': '' },
  });
  let snapshot = captureSpatialSnapshot(createHeaderIconPanelLayout(doc, {
    contentChildren: [renderBuffer],
  }));

  assert.deepEqual(snapshot.diagnostics.unsupported, []);
});

test('captureSpatialSnapshot automatically captures arbitrary cascade-styled DOM and open Shadow DOM', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let label = fakeElement(doc, {
    tag: 'span',
    rect: { left: 32, top: 66, width: 152, height: 20 },
    text: 'Dynamically assembled layout',
    childNodes: [fakeTextNode('Dynamically assembled layout')],
    styles: { color: 'rgb(230, 230, 230)', 'font-size': '14px', 'line-height': 'normal' },
  });
  let action = fakeElement(doc, {
    tag: 'button',
    rect: { left: 32, top: 98, width: 96, height: 28 },
    attrs: { 'aria-label': 'Open order' },
    text: 'Open',
    childNodes: [fakeTextNode('Open')],
    styles: { 'background-color': 'rgb(42, 72, 108)', color: 'rgb(255, 255, 255)' },
  });
  let composer = fakeElement(doc, {
    tag: 'textarea',
    rect: { left: 32, top: 132, width: 176, height: 28 },
    styles: { 'background-color': 'rgb(20, 24, 30)', color: 'rgb(153, 153, 153)', 'font-size': '13px' },
  });
  composer.placeholder = 'Describe a task…';
  let host = fakeElement(doc, {
    tag: 'agent-composed-card',
    rect: { left: 20, top: 52, width: 220, height: 100 },
    styles: { 'background-color': 'rgb(24, 30, 38)', 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': 'rgb(80, 100, 120)', 'border-right-width': '1px', 'border-right-style': 'solid', 'border-right-color': 'rgb(80, 100, 120)', 'border-bottom-width': '1px', 'border-bottom-style': 'solid', 'border-bottom-color': 'rgb(80, 100, 120)', 'border-left-width': '1px', 'border-left-style': 'solid', 'border-left-color': 'rgb(80, 100, 120)' },
  });
  host.shadowRoot = { children: [label, action, composer] };
  let snapshot = captureSpatialSnapshot(createHeaderIconPanelLayout(doc, { contentChildren: [host] }));
  assert.ok(snapshot.nodes.some((node) => node.component === 'surface' && node.rect.width === 220));
  assert.ok(snapshot.nodes.some((node) => node.text === 'Dynamically assembled layout'));
  let control = snapshot.nodes.find((node) => node.component === 'dom-control');
  assert.deepEqual(control.actions, [{ id: 'dom-activate', targetId: 'Open-order', intent: 'dom-activate' }]);
  assert.ok(snapshot.nodes.some((node) => node.text === 'Open'));
  assert.ok(snapshot.nodes.some((node) => node.text === 'Describe a task…' && node.state?.placeholder),
    'empty editable controls expose their measured placeholder text');
});

test('captureSpatialSnapshot captures a source viewer header, icons, and only its visible code slice', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let saveIcon = fakeIconElement(doc, {
    rect: { left: 228, top: 38, width: 16, height: 16 },
    name: 'save',
  });
  let saveAction = fakeElement(doc, {
    tag: 'button',
    rect: { left: 220, top: 32, width: 32, height: 28 },
    styles: { 'background-color': 'rgb(40, 50, 60)', color: 'rgb(230, 230, 230)' },
    queriesAll: { [SPATIAL_ICON_SELECTOR]: [saveIcon] },
  });
  saveAction.className = 'sv-action sv-save-action';
  let saveLabel = fakeElement(doc, {
    tag: 'span',
    rect: { left: 244, top: 38, width: 24, height: 16 },
    attrs: { 'data-label': 'Save' },
    styles: { color: 'rgb(230, 230, 230)', 'font-size': '10px' },
  });
  saveAction.querySelector = (selector) => (selector === '.sv-action-label' ? saveLabel : null);
  let filename = fakeElement(doc, {
    tag: 'span',
    rect: { left: 16, top: 34, width: 180, height: 20 },
    attrs: { 'data-source-text': 'maintenance-plan.js' },
    styles: { color: 'rgb(220, 220, 220)', 'font-family': 'monospace', 'font-size': '12px' },
  });
  let header = fakeElement(doc, {
    tag: 'div',
    rect: { left: 8, top: 28, width: 280, height: 36 },
    styles: { 'background-color': 'rgb(28, 32, 38)' },
    queries: {
      '.sv-filename': filename,
      '.sv-stats': fakeElement(doc, {
        tag: 'span',
        rect: { left: 188, top: 38, width: 28, height: 16 },
        attrs: { 'data-source-text': '12 lines' },
        styles: { color: 'rgb(100, 210, 170)', 'font-size': '10px' },
      }),
    },
    queriesAll: { '.sv-action:not([hidden])': [saveAction] },
  });
  let code = fakeElement(doc, {
    tag: 'code',
    rect: { left: 48, top: 70, width: 220, height: 100 },
    text: 'line-1\nline-2\nline-3\nline-4\nline-5',
    styles: {
      'background-color': 'rgb(20, 24, 30)', color: 'rgb(210, 230, 255)',
      'font-family': 'monospace', 'font-size': '10px', 'line-height': '10px',
    },
    queriesAll: {
      '*': [
        fakeElement(doc, {
          tag: 'span',
          rect: { left: 48, top: 70, width: 30, height: 10 },
          childNodes: [{ nodeType: 3, textContent: 'const' }],
          styles: { color: 'rgb(255, 120, 160)', 'font-family': 'monospace', 'font-size': '10px', 'line-height': '10px' },
        }),
        fakeElement(doc, {
          tag: 'span',
          rect: { left: 84, top: 80, width: 18, height: 10 },
          childNodes: [{ nodeType: 3, textContent: '42' }],
          styles: { color: 'rgb(100, 210, 170)', 'font-family': 'monospace', 'font-size': '10px', 'line-height': '10px' },
        }),
      ],
    },
  });
  let viewport = fakeElement(doc, {
    tag: 'div',
    rect: { left: 8, top: 64, width: 280, height: 40 },
    styles: { 'background-color': 'rgb(20, 24, 30)' },
    queries: {
      '.cb-pre code': code,
      code,
      '.cb-gutter': fakeElement(doc, {
        tag: 'pre',
        rect: { left: 16, top: 70, width: 24, height: 100 },
        text: '1\n2\n3\n4\n5',
        styles: {
          'background-color': 'rgb(18, 22, 28)', color: 'rgb(130, 145, 160)',
          'font-family': 'monospace', 'font-size': '10px', 'line-height': '10px',
        },
      }),
    },
  });
  viewport.clientHeight = 24;
  viewport.clientWidth = 280;
  viewport.scrollHeight = 100;
  viewport.scrollWidth = 280;
  viewport.scrollTop = 20;
  let viewer = fakeElement(doc, {
    tag: 'source-viewer',
    rect: { left: 8, top: 28, width: 280, height: 160 },
    attrs: { 'data-language': 'javascript' },
    styles: { 'background-color': 'rgb(18, 22, 28)' },
    queries: { '.sv-header': header, '.cb-scroll': viewport },
  });
  let snapshot = captureSpatialSnapshot(createHeaderIconPanelLayout(doc, { contentChildren: [viewer] }));
  let byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  let viewerId = 'panel:project/source-viewer:1';
  assert.equal(byId.get(`${viewerId}/title`).text, 'maintenance-plan.js');
  assert.equal(byId.get(`${viewerId}/stats`).text, '12 lines');
  assert.equal(byId.get(`${viewerId}/control:save`).style['background-color'], 'rgb(40, 50, 60)');
  assert.deepEqual(byId.get(`${viewerId}/control:save/icon:save`).icon, { name: 'save' });
  assert.equal(byId.get(`${viewerId}/control:save/label`).text, 'Save');
  assert.deepEqual(byId.get(`${viewerId}/scroll`).state, {
    overflowX: false, overflowY: true, scrollLeft: 0, scrollTop: 20,
  });
  assert.equal(byId.get(`${viewerId}/scroll/editor`).text, 'line-3\nline-4\nline-5');
  assert.equal(byId.get(`${viewerId}/scroll/gutter`).text, '3\n4\n5');
  assert.deepEqual(byId.get(`${viewerId}/scroll/editor`).state, {
    language: 'javascript', readOnly: true,
  });
  let tokenNodes = snapshot.nodes.filter((node) => node.parentId === `${viewerId}/scroll/editor` && node.part === 'token');
  assert.deepEqual(tokenNodes.map((node) => ({ text: node.text, color: node.style.color })), [
    { text: 'const', color: 'rgb(255, 120, 160)' },
    { text: '42', color: 'rgb(100, 210, 170)' },
  ]);
  assert.equal(snapshot.diagnostics.unsupported.some((entry) => entry.feature === 'syntax-highlighting'), false);
});

test('captureSpatialSnapshot preserves source editor styles and exposes its scroll limitation', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let textarea = fakeElement(doc, {
    tag: 'textarea',
    rect: { left: 16, top: 40, width: 256, height: 120 },
    styles: {
      'background-color': 'rgb(20, 24, 30)', color: 'rgb(210, 230, 255)',
      'font-family': 'monospace', 'font-size': '12px', 'line-height': '16px',
      ...UNIFORM_BORDER_STYLES,
    },
  });
  textarea.value = 'line-1\nline-2\nline-3';
  textarea.readOnly = true;
  textarea.clientHeight = 120;
  textarea.clientWidth = 256;
  textarea.scrollHeight = 240;
  textarea.scrollWidth = 256;
  let editor = fakeElement(doc, {
    tag: 'source-editor',
    rect: { left: 8, top: 28, width: 280, height: 148 },
    attrs: { 'data-language': 'javascript' },
    queries: { textarea },
  });
  let snapshot = captureSpatialSnapshot(createHeaderIconPanelLayout(doc, { contentChildren: [editor] }));
  let captured = snapshot.nodes.find((node) => node.component === 'source-editor');

  assert.equal(captured.part, 'editor');
  assert.equal(captured.text, 'line-1\nline-2\nline-3');
  assert.equal(captured.style['background-color'], 'rgb(20, 24, 30)');
  assert.equal(captured.style.color, 'rgb(210, 230, 255)');
  assert.equal(captured.style['border-color'], 'rgb(60, 60, 60)');
  assert.deepEqual(captured.state, { language: 'javascript', readOnly: true });
  assert.ok(snapshot.diagnostics.unsupported.some((entry) => entry.feature === 'ime-editing'));
  assert.ok(snapshot.diagnostics.unsupported.some((entry) => entry.feature === 'native-scrollbars'));
});

test('captureSpatialSnapshot captures description-list labels and values despite display-contents item hosts', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  function item(labelText, valueText, top) {
    let label = fakeElement(doc, {
      tag: 'dt',
      rect: { left: 16, top, width: 88, height: 18 },
      text: labelText,
      childNodes: [fakeTextNode(labelText)],
      styles: { color: 'rgb(156, 166, 180)', 'font-size': '12px', 'font-weight': '500' },
    });
    let value = fakeElement(doc, {
      tag: 'dd',
      rect: { left: 120, top, width: 148, height: 18 },
      text: valueText,
      childNodes: [fakeTextNode(valueText)],
      styles: { color: 'rgb(240, 240, 240)', 'font-size': '12px' },
    });
    return fakeElement(doc, {
      tag: 'sn-description-item',
      rect: { left: 0, top, width: 0, height: 0 },
      queries: { '.sn-description-label': label, '.sn-description-value': value },
    });
  }
  let list = fakeElement(doc, {
    tag: 'sn-description-list',
    rect: { left: 8, top: 40, width: 280, height: 56 },
    styles: { 'background-color': 'rgb(28, 32, 38)' },
    queriesAll: { 'sn-description-item': [item('Asset', 'FEEDER-12', 48), item('Running', 'DOWN', 72)] },
  });
  let snapshot = captureSpatialSnapshot(createHeaderIconPanelLayout(doc, { contentChildren: [list] }));
  let byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  let listId = 'panel:project/description-list:1';

  assert.equal(byId.get(listId).style['background-color'], 'rgb(28, 32, 38)');
  assert.equal(byId.get(`${listId}/item:0/label`).text, 'Asset');
  assert.equal(byId.get(`${listId}/item:0/value`).text, 'FEEDER-12');
  assert.equal(byId.get(`${listId}/item:1/label`).style.color, 'rgb(156, 166, 180)');
  assert.equal(byId.get(`${listId}/item:1/value`).style.color, 'rgb(240, 240, 240)');
  assert.deepEqual(snapshot.diagnostics, { unsupported: [], unknownVisible: [] });
});

test('captureSpatialSnapshot captures native badge chrome, text, and icons', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let icon = fakeIconElement(doc, {
    rect: { left: 24, top: 46, width: 14, height: 14 },
    name: 'warning',
  });
  let badge = fakeElement(doc, {
    tag: 'sn-badge',
    rect: { left: 16, top: 42, width: 76, height: 22 },
    text: 'WAPPR',
    childNodes: [fakeTextNode('WAPPR')],
    styles: {
      'background-color': 'rgb(82, 56, 20)', color: 'rgb(255, 202, 92)',
      'font-size': '12px', 'font-weight': '500', ...UNIFORM_BORDER_STYLES,
    },
    queriesAll: { [SPATIAL_ICON_SELECTOR]: [icon] },
  });
  let snapshot = captureSpatialSnapshot(createHeaderIconPanelLayout(doc, { contentChildren: [badge] }));
  let byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  let badgeId = 'panel:project/badge:1';

  assert.equal(byId.get(badgeId).part, 'badge');
  assert.equal(byId.get(badgeId).text, 'WAPPR');
  assert.equal(byId.get(badgeId).style['background-color'], 'rgb(82, 56, 20)');
  assert.equal(byId.get(badgeId).style['border-color'], 'rgb(60, 60, 60)');
  assert.deepEqual(byId.get(`${badgeId}/icon:warning`).icon, { name: 'warning' });
});

test('captureSpatialSnapshot keeps metric labels and values distinct with their computed styles', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let label = fakeElement(doc, {
    tag: 'span',
    rect: { left: 16, top: 44, width: 120, height: 18 },
    text: 'Available crews',
    childNodes: [fakeTextNode('Available crews')],
    styles: { color: 'rgb(156, 166, 180)', 'font-size': '12px' },
  });
  let value = fakeElement(doc, {
    tag: 'span',
    rect: { left: 226, top: 44, width: 42, height: 18 },
    text: '6',
    childNodes: [fakeTextNode('6')],
    styles: { color: 'rgb(96, 220, 156)', 'font-family': 'monospace', 'font-size': '13px', 'font-weight': '600' },
  });
  let metric = fakeElement(doc, {
    tag: 'sn-metric',
    rect: { left: 16, top: 40, width: 252, height: 26 },
    styles: { 'background-color': 'rgb(28, 32, 38)', ...UNIFORM_BORDER_STYLES },
    queries: { '.sn-metric-label': label, '.sn-metric-value': value },
  });
  let snapshot = captureSpatialSnapshot(createHeaderIconPanelLayout(doc, { contentChildren: [metric] }));
  let byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  let metricId = 'panel:project/metric:1';

  assert.equal(byId.get(metricId).style['border-color'], 'rgb(60, 60, 60)');
  assert.equal(byId.get(`${metricId}/label`).text, 'Available crews');
  assert.equal(byId.get(`${metricId}/label`).style.color, 'rgb(156, 166, 180)');
  assert.equal(byId.get(`${metricId}/value`).text, '6');
  assert.equal(byId.get(`${metricId}/value`).style.color, 'rgb(96, 220, 156)');
  assert.equal(byId.get(`${metricId}/value`).style['font-family'], 'monospace');
});

test('captureSpatialSnapshot normalizes CSS Color 4 styles to rgb()/rgba() and diagnoses unconvertible colors', () => {
  let conversions = new Map([
    ...SENTINEL_CONVERSIONS,
    ['oklch(0.7 0.1 200)', [64, 138, 171, 255]],
    ['oklch(0.6 0.2 30 / 0.5)', [200, 100, 50, 128]],
    ['oklch(0.4 0.05 250)', [70, 72, 80, 255]],
  ]);
  let doc = createFakeDocument(conversions);
  let snapshot = captureSpatialSnapshot(createFakePanelLayout(doc));
  for (let node of snapshot.nodes) {
    for (let value of Object.values(node.style || {})) {
      assert.ok(!value.includes('oklch('), `no oklch() style survives capture on "${node.id}"`);
      assert.ok(!value.includes('var('), `no unresolved var() style survives capture on "${node.id}"`);
    }
  }

  let byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  assert.equal(byId.get('panel:project/header').style['background-color'], 'rgb(70, 72, 80)');
  assert.equal(byId.get('panel:project/title').style.color, 'rgba(200, 100, 50, 0.502)');
  assert.equal(byId.get('panel:project/control:toggle-collapse').style['background-color'], 'rgb(64, 138, 171)');
  assert.equal(
    byId.get('panel:project/control:toggle-fullscreen').style?.['background-color'],
    undefined,
    'unconvertible color is dropped instead of forwarded to the renderer',
  );

  let colorDiagnostics = snapshot.diagnostics.unsupported.filter((entry) => entry.feature === 'unconvertible-color');
  assert.equal(colorDiagnostics.length, 1);
  assert.match(colorDiagnostics[0].detail, /background-color/);
  assert.match(colorDiagnostics[0].detail, /var\(--unresolved-token\)/);
});

function fakeTextNode(text) {
  return { nodeType: 3, textContent: text };
}

test('captureSpatialSnapshot preserves browser-measured line boxes for direct text', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let text = fakeTextNode('First line Second line');
  text.lineRects = [...text.textContent].map((_, index) => (
    index < 10
      ? { left: 24 + index * 6, top: 56, width: 6, height: 18 }
      : { left: 24 + (index - 10) * 6, top: 76, width: 6, height: 18 }
  ));
  doc.createRange = () => ({
    start: 0,
    setStart(_node, offset) { this.start = offset; },
    setEnd() {},
    getBoundingClientRect() { return text.lineRects[this.start]; },
  });
  let paragraph = fakeElement(doc, {
    tag: 'p',
    rect: { left: 24, top: 56, width: 120, height: 38 },
    text: text.textContent,
    childNodes: [text],
    styles: { color: 'rgb(240, 240, 240)', 'font-size': '13px', 'line-height': '20px' },
  });
  let card = fakeElement(doc, {
    tag: 'article',
    rect: { left: 16, top: 48, width: 140, height: 64 },
    children: [paragraph],
    childNodes: [paragraph],
    styles: { 'background-color': 'rgb(34, 34, 34)' },
  });
  let snapshot = captureSpatialSnapshot(createHeaderIconPanelLayout(doc, { contentChildren: [card] }));
  let lines = snapshot.nodes.filter((node) => (
    node.part === 'text' && (node.text.startsWith('First') || node.text.startsWith('Second'))
  ));
  assert.deepEqual(lines.map((node) => ({ text: node.text, rect: node.rect, exactTextBounds: node.exactTextBounds })), [
    { text: 'First line', rect: { x: 24, y: 56, width: 60, height: 18 }, exactTextBounds: true },
    { text: 'Second line', rect: { x: 30, y: 76, width: 66, height: 18 }, exactTextBounds: true },
  ]);
});

function fakeIconElement(doc, options) {
  let { rect, name, styles = {}, tag = 'span' } = options;
  return fakeElement(doc, {
    tag,
    rect,
    text: name,
    styles: {
      color: 'rgb(180, 180, 180)',
      'font-family': "'Material Symbols Outlined'",
      'font-size': '16px',
      'font-weight': '400',
      ...styles,
    },
    childNodes: [fakeTextNode(name)],
    matches: (selector) => selector === SPATIAL_ICON_SELECTOR,
  });
}

function createHeaderIconPanelLayout(doc, options = {}) {
  let collapseIcon = fakeIconElement(doc, {
    rect: { left: 722, top: 6, width: 16, height: 16 },
    name: 'unfold_less',
  });
  let collapseBtn = fakeElement(doc, {
    tag: 'button',
    rect: { left: 720, top: 4, width: 20, height: 20 },
    queriesAll: { [SPATIAL_ICON_SELECTOR]: [collapseIcon] },
  });
  let panelIcon = fakeIconElement(doc, {
    rect: { left: 698, top: 6, width: 16, height: 16 },
    name: 'folder',
  });
  let dropdownIcon = fakeIconElement(doc, {
    rect: { left: 758, top: 6, width: 14, height: 16 },
    name: 'arrow_drop_down',
  });
  let title = fakeElement(doc, {
    tag: 'span',
    rect: { left: 716, top: 4, width: 40, height: 20 },
    text: 'Project',
    childNodes: [fakeTextNode('Project')],
    styles: options.titleStyles || { color: 'rgb(240, 240, 240)', 'font-size': '13px' },
  });
  let typeBtn = fakeElement(doc, {
    tag: 'button',
    rect: { left: 696, top: 4, width: 80, height: 20 },
    queries: { '.panel-title': title },
    queriesAll: { [SPATIAL_ICON_SELECTOR]: [panelIcon, dropdownIcon] },
  });
  let header = fakeElement(doc, {
    tag: 'div',
    rect: { left: 0, top: 0, width: 800, height: 28 },
    queries: {
      '.panel-title': title,
      '.collapse-btn': collapseBtn,
      '.type-btn': typeBtn,
    },
  });
  let panelComponent = { tagName: 'PROJECT-PANEL', dataset: { panelId: 'project' } };
  let content = fakeElement(doc, {
    tag: 'div',
    rect: { left: 0, top: 28, width: 800, height: 572 },
    children: options.contentChildren || [],
  });
  let layoutNode = fakeElement(doc, {
    tag: 'layout-node',
    rect: { left: 0, top: 0, width: 800, height: 600 },
    attrs: { 'node-type': 'panel' },
    queries: {
      ':scope > .panel-view > .panel-content > [data-panel-id]': panelComponent,
      ':scope > .panel-view > .panel-header': header,
      ':scope > .panel-view > .panel-content': content,
    },
  });
  return fakeElement(doc, {
    tag: 'panel-layout',
    rect: { left: 0, top: 0, width: 800, height: 600 },
    children: [layoutNode],
  });
}

const UNIFORM_BORDER_STYLES = Object.freeze({
  'border-top-width': '1px',
  'border-right-width': '1px',
  'border-bottom-width': '1px',
  'border-left-width': '1px',
  'border-top-style': 'solid',
  'border-right-style': 'solid',
  'border-bottom-style': 'solid',
  'border-left-style': 'solid',
  'border-top-color': 'rgb(60, 60, 60)',
  'border-right-color': 'rgb(60, 60, 60)',
  'border-bottom-color': 'rgb(60, 60, 60)',
  'border-left-color': 'rgb(60, 60, 60)',
});

const BOTTOM_BORDER_STYLES = Object.freeze({
  'border-bottom-width': '1px',
  'border-bottom-style': 'solid',
  'border-bottom-color': 'rgb(60, 60, 60)',
});

function fakeBadgeElement(doc, options) {
  let { rect, text } = options;
  return fakeElement(doc, {
    tag: 'span',
    rect,
    text,
    childNodes: [fakeTextNode(text)],
    styles: {
      'background-color': 'rgb(40, 60, 90)',
      'color': 'rgb(153, 153, 153)',
      'font-size': '11px',
    },
  });
}

function createTreePanelLayout(doc, options = {}) {
  let titleIcon = fakeIconElement(doc, {
    rect: { left: 8, top: 38, width: 18, height: 18 },
    name: 'folder',
  });
  let titleRow = fakeElement(doc, {
    tag: 'div',
    rect: { left: 8, top: 36, width: 200, height: 24 },
    text: 'folder Project tree',
    childNodes: [titleIcon, fakeTextNode(' Project tree')],
    styles: { ...BOTTOM_BORDER_STYLES },
    queriesAll: { [SPATIAL_ICON_SELECTOR]: [titleIcon] },
  });
  let toolbarIcon = fakeIconElement(doc, {
    rect: { left: 270, top: 66, width: 18, height: 18 },
    name: 'unfold_less',
  });
  let toolbarIcons = [toolbarIcon, ...(options.extraToolbarIcons || [])];
  let collapseButton = fakeElement(doc, {
    tag: 'sn-button',
    rect: { left: 266, top: 64, width: 26, height: 24 },
    styles: { 'background-color': 'rgb(20, 20, 20)', ...UNIFORM_BORDER_STYLES },
    queriesAll: { [SPATIAL_ICON_SELECTOR]: [toolbarIcon] },
  });
  let toolbar = fakeElement(doc, {
    tag: 'div',
    rect: { left: 0, top: 64, width: 300, height: 28 },
    styles: { ...BOTTOM_BORDER_STYLES },
    queries: { '.sn-tree-panel-collapse': collapseButton },
    queriesAll: { [SPATIAL_ICON_SELECTOR]: toolbarIcons },
  });
  let filter = fakeElement(doc, {
    tag: 'input',
    rect: { left: 4, top: 64, width: 220, height: 24 },
    styles: {
      'background-color': 'rgb(20, 20, 20)',
      'color': 'rgb(153, 153, 153)',
      'font-size': '12px',
      ...UNIFORM_BORDER_STYLES,
    },
  });
  filter.value = options.filterValue ?? '';
  filter.placeholder = 'Filter project files';
  let toggle = fakeIconElement(doc, {
    tag: 'button',
    rect: { left: 4, top: 100, width: 20, height: 20 },
    name: 'expand_more',
  });
  let rowIcon = fakeIconElement(doc, {
    rect: { left: 28, top: 100, width: 20, height: 20 },
    name: 'folder_open',
  });
  let label = fakeElement(doc, {
    tag: 'span',
    rect: { left: 52, top: 100, width: 100, height: 20 },
    text: 'src',
    childNodes: [fakeTextNode('src')],
    styles: { color: 'rgb(240, 240, 240)', 'font-size': '12px' },
  });
  let badges = options.badges === undefined
    ? [
      fakeBadgeElement(doc, { rect: { left: 156, top: 102, width: 40, height: 16 }, text: 'graph' }),
      fakeBadgeElement(doc, { rect: { left: 200, top: 102, width: 36, height: 16 }, text: 'voice' }),
    ]
    : options.badges;
  let row = fakeElement(doc, {
    tag: 'div',
    rect: { left: 0, top: 96, width: 300, height: 28 },
    dataset: { treeId: 'src' },
    attrs: { 'aria-selected': 'true', 'aria-expanded': 'true' },
    queries: {
      '.sn-tree-toggle:not([hidden])': toggle,
      '.sn-tree-icon': rowIcon,
      '.sn-tree-label': label,
    },
    queriesAll: { '.sn-tree-badge': badges },
  });
  let tree = fakeElement(doc, {
    tag: 'sn-tree-panel',
    rect: { left: 0, top: 28, width: 300, height: 500 },
    styles: { 'background-color': 'rgb(24, 24, 24)', ...UNIFORM_BORDER_STYLES },
    queries: {
      '.sn-tree-panel-title': titleRow,
      '.sn-tree-panel-toolbar': toolbar,
      '.sn-tree-panel-filter': filter,
    },
    queriesAll: { '.sn-tree-row': [row] },
  });
  return createHeaderIconPanelLayout(doc, { contentChildren: [tree] });
}

function fakeTableCell(doc, { left, top, width, height, text, queries = {} }) {
  return fakeElement(doc, {
    tag: 'td',
    rect: { left, top, width, height },
    text,
    childNodes: [fakeTextNode(text)],
    queries,
    styles: { color: 'rgb(230, 230, 230)', 'font-size': '13px' },
  });
}

function createDataTableLayout(doc) {
  let sortIcon = fakeIconElement(doc, {
    rect: { left: 113, top: 43, width: 16, height: 16 },
    name: 'arrow_downward',
  });
  let sort = fakeElement(doc, {
    tag: 'button',
    rect: { left: 112, top: 42, width: 18, height: 18 },
    styles: { 'background-color': 'rgb(40, 40, 40)', color: 'rgb(230, 230, 230)' },
    queriesAll: { [SPATIAL_ICON_SELECTOR]: [sortIcon] },
  });
  let statusHeader = fakeElement(doc, {
    tag: 'th',
    rect: { left: 8, top: 36, width: 130, height: 28 },
    text: 'Status',
    childNodes: [fakeTextNode('Status')],
    queries: { '.sn-data-table-sort-btn': sort },
    styles: { 'background-color': 'rgb(48, 48, 48)', color: 'rgb(190, 190, 190)' },
  });
  let ownerHeader = fakeElement(doc, {
    tag: 'th',
    rect: { left: 138, top: 36, width: 150, height: 28 },
    text: 'Owner',
    childNodes: [fakeTextNode('Owner')],
    styles: { 'background-color': 'rgb(48, 48, 48)', color: 'rgb(190, 190, 190)' },
  });
  let firstRow = fakeElement(doc, {
    tag: 'tr',
    rect: { left: 8, top: 64, width: 280, height: 30 },
    dataset: { rowId: 'WO-1010' },
    attrs: { 'aria-selected': 'true' },
    queriesAll: {
      td: [
        fakeTableCell(doc, { left: 8, top: 64, width: 130, height: 30, text: 'APPR' }),
        fakeTableCell(doc, { left: 138, top: 64, width: 150, height: 30, text: 'M. Singh' }),
      ],
    },
    styles: { 'background-color': 'rgb(42, 52, 68)' },
  });
  let secondRow = fakeElement(doc, {
    tag: 'tr',
    rect: { left: 8, top: 94, width: 280, height: 30 },
    dataset: { rowId: 'WO-1011' },
    queriesAll: {
      td: [
        fakeTableCell(doc, { left: 8, top: 94, width: 130, height: 30, text: 'INPRG' }),
        fakeTableCell(doc, { left: 138, top: 94, width: 150, height: 30, text: 'A. Chen' }),
      ],
    },
    styles: { 'background-color': 'rgb(32, 32, 32)' },
  });
  let table = fakeElement(doc, {
    tag: 'table',
    rect: { left: 8, top: 36, width: 280, height: 88 },
    queriesAll: {
      'thead th': [statusHeader, ownerHeader],
      'tbody tr:not(.sn-data-table-details-row)': [firstRow, secondRow],
    },
  });
  let dataTable = fakeElement(doc, {
    tag: 'sn-data-table',
    rect: { left: 0, top: 28, width: 300, height: 116 },
    queries: { table },
    styles: { 'background-color': 'rgb(32, 32, 32)' },
  });
  return createHeaderIconPanelLayout(doc, { contentChildren: [dataTable] });
}

test('captureSpatialSnapshot captures bounded header glyphs as icon nodes under their owning controls', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let snapshot = captureSpatialSnapshot(createHeaderIconPanelLayout(doc));
  let byId = new Map(snapshot.nodes.map((node) => [node.id, node]));

  let collapseIcon = byId.get('panel:project/control:toggle-collapse/icon:unfold_less');
  assert.ok(collapseIcon, 'collapse glyph is captured as an icon node');
  assert.equal(collapseIcon.part, 'icon');
  assert.equal(collapseIcon.parentId, 'panel:project/control:toggle-collapse');
  assert.equal(collapseIcon.component, 'layout-node');
  assert.deepEqual(collapseIcon.icon, { name: 'unfold_less' });
  assert.deepEqual(collapseIcon.rect, { x: 722, y: 6, width: 16, height: 16 });
  assert.equal(collapseIcon.style.color, 'rgb(180, 180, 180)');
  assert.equal(collapseIcon.style['font-family'], "'Material Symbols Outlined'");
  assert.equal(collapseIcon.text, undefined, 'icon nodes never carry text');

  let typeIcons = snapshot.nodes.filter(
    (node) => node.part === 'icon' && node.parentId === 'panel:project/control:open-type-menu',
  );
  assert.deepEqual(
    typeIcons.map((node) => node.icon.name).sort(),
    ['arrow_drop_down', 'folder'],
    'both type button glyphs become icon nodes',
  );

  for (let node of snapshot.nodes) {
    assert.ok(
      !node.text || !/unfold_less|arrow_drop_down/.test(node.text),
      `no literal ligature word leaks into text on "${node.id}"`,
    );
  }
});

test('captureSpatialSnapshot captures tree glyphs as icons and keeps titles/labels free of ligature words', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let snapshot = captureSpatialSnapshot(createTreePanelLayout(doc));
  let byId = new Map(snapshot.nodes.map((node) => [node.id, node]));

  let title = byId.get('panel:project/tree-title');
  assert.equal(title.text, 'Project tree', 'tree title excludes the icon descendant ligature');

  let titleIcon = byId.get('panel:project/tree-title/icon:folder');
  assert.ok(titleIcon, 'tree title glyph becomes an icon node under the title');
  assert.equal(titleIcon.part, 'icon');
  assert.equal(titleIcon.component, 'sn-tree-panel');
  assert.deepEqual(titleIcon.icon, { name: 'folder' });

  let toolbarIcon = byId.get('panel:project/control:collapse-all/icon:unfold_less');
  assert.ok(toolbarIcon, 'tree toolbar glyph becomes an icon node under the collapse control');
  assert.equal(toolbarIcon.parentId, 'panel:project/control:collapse-all');

  let toggleIcon = byId.get('panel:project/row:src/control:toggle-row/icon:expand_more');
  assert.ok(toggleIcon, 'row toggle glyph becomes an icon node under its owning control');
  assert.equal(toggleIcon.parentId, 'panel:project/row:src/control:toggle-row');
  assert.deepEqual(toggleIcon.icon, { name: 'expand_more' });

  let rowIcon = byId.get('panel:project/row:src/icon:folder_open');
  assert.ok(rowIcon, 'row glyph becomes an icon node under the row');
  assert.equal(rowIcon.parentId, 'panel:project/row:src');

  assert.equal(byId.get('panel:project/row:src/label').text, 'src');
  for (let node of snapshot.nodes) {
    assert.ok(
      !node.text || !/expand_more|folder_open|unfold_less/.test(node.text),
      `no literal ligature word leaks into text on "${node.id}"`,
    );
  }
});

test('captureSpatialSnapshot captures a native data-table header, rows, cells, and sort affordance', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let snapshot = captureSpatialSnapshot(createDataTableLayout(doc));
  let byId = new Map(snapshot.nodes.map((node) => [node.id, node]));

  let table = byId.get('panel:project/data-table:1');
  assert.equal(table.part, 'surface');
  assert.equal(table.component, 'sn-data-table');
  assert.equal(byId.get('panel:project/data-table:1/header:0').part, 'header');
  assert.equal(byId.get('panel:project/data-table:1/header:0/label').text, 'Status');
  assert.equal(byId.get('panel:project/data-table:1/header:0/control:sort').part, 'control');
  assert.deepEqual(
    byId.get('panel:project/data-table:1/header:0/control:sort/icon:arrow_downward').icon,
    { name: 'arrow_downward' },
  );
  assert.equal(byId.get('panel:project/data-table:1/row:WO-1010').state.selected, true);
  assert.equal(byId.get('panel:project/data-table:1/row:WO-1010/cell:0').text, 'APPR');
  assert.equal(byId.get('panel:project/data-table:1/row:WO-1011/cell:1').text, 'A. Chen');
  assert.deepEqual(snapshot.diagnostics, { unsupported: [], unknownVisible: [] });
});

test('captureSpatialSnapshot reports invalid icon glyphs as diagnostics instead of nodes', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let invalid = fakeIconElement(doc, {
    rect: { left: 292, top: 66, width: 18, height: 18 },
    name: 'Not A Glyph',
  });
  let snapshot = captureSpatialSnapshot(createTreePanelLayout(doc, { extraToolbarIcons: [invalid] }));
  assert.ok(
    !snapshot.nodes.some((node) => node.icon?.name === 'Not A Glyph'),
    'invalid ligature names never become icon nodes',
  );
  let glyphDiagnostics = snapshot.diagnostics.unsupported.filter((entry) => entry.feature === 'icon-glyph');
  assert.equal(glyphDiagnostics.length, 1);
  assert.match(glyphDiagnostics[0].detail, /Not A Glyph/);
});

test('captureSpatialSnapshot captures the exact renderer-consumed text metrics', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let titleStyles = {
    color: 'rgb(240, 240, 240)',
    'font-family': 'Inter, sans-serif',
    'font-size': '13px',
    'font-weight': '600',
    'font-style': 'italic',
    'line-height': '18px',
    'letter-spacing': '0.02em',
    'text-align': 'center',
    direction: 'ltr',
    'white-space': 'nowrap',
    overflow: 'hidden',
    'text-overflow': 'ellipsis',
  };
  let snapshot = captureSpatialSnapshot(createHeaderIconPanelLayout(doc, { titleStyles }));
  let title = snapshot.nodes.find((node) => node.id === 'panel:project/title');
  assert.deepEqual(title.style, titleStyles);
});

test('captureSpatialSnapshot captures walked content glyphs as icons and excludes them from structural text', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let inlineIcon = fakeIconElement(doc, {
    rect: { left: 46, top: 40, width: 16, height: 16 },
    name: 'info',
  });
  let intro = fakeElement(doc, {
    tag: 'p',
    rect: { left: 8, top: 36, width: 300, height: 24 },
    text: 'Hello info world',
    childNodes: [fakeTextNode('Hello '), inlineIcon, fakeTextNode(' world')],
    matches: (selector) => selector === '.intro',
    queriesAll: { [SPATIAL_ICON_SELECTOR]: [inlineIcon] },
  });
  let snapshot = captureSpatialSnapshot(
    createHeaderIconPanelLayout(doc, { contentChildren: [intro] }),
    { textSelectors: ['.intro'] },
  );

  let text = snapshot.nodes.find((node) => node.part === 'text');
  assert.equal(text.text, 'Hello world', 'structural text excludes icon descendant ligatures');

  let icon = snapshot.nodes.find((node) => node.part === 'icon' && node.icon?.name === 'info');
  assert.ok(icon, 'walked content glyph becomes an icon node');
  assert.equal(icon.parentId, text.id, 'inline glyph is owned by its structural text node');
  assert.deepEqual(icon.icon, { name: 'info' });
});

test('captureSpatialSnapshot ignores motion declarations on zero-size templates', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let template = fakeElement(doc, {
    tag: 'div',
    rect: { left: 8, top: 36, width: 0, height: 0 },
    styles: { 'animation-name': 'spin' },
  });
  let snapshot = captureSpatialSnapshot(createHeaderIconPanelLayout(doc, { contentChildren: [template] }));
  assert.deepEqual(snapshot.diagnostics.unsupported, [], 'hidden template animation has no visible native counterpart');
});

test('captureSpatialSnapshot captures tree host chrome as surface nodes with border evidence', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let snapshot = captureSpatialSnapshot(createTreePanelLayout(doc));
  let byId = new Map(snapshot.nodes.map((node) => [node.id, node]));

  let host = byId.get('panel:project/tree-host');
  assert.ok(host, 'tree host chrome is captured');
  assert.equal(host.part, 'surface');
  assert.equal(host.component, 'sn-tree-panel');
  assert.equal(host.style['background-color'], 'rgb(24, 24, 24)');
  assert.equal(host.style['border-width'], '1px');
  assert.equal(host.style['border-style'], 'solid');
  assert.equal(host.style['border-color'], 'rgb(60, 60, 60)');

  let titleRow = byId.get('panel:project/tree-title-row');
  assert.ok(titleRow, 'tree title row chrome is captured');
  assert.equal(titleRow.part, 'surface');
  assert.deepEqual(titleRow.style, {
    'border-bottom-width': '1px',
    'border-bottom-style': 'solid',
    'border-bottom-color': 'rgb(60, 60, 60)',
  }, 'a solid divider remains native border evidence');

  let toolbar = byId.get('panel:project/tree-toolbar');
  assert.ok(toolbar, 'tree toolbar chrome is captured');
  assert.equal(toolbar.part, 'surface');

  let partialBorders = snapshot.diagnostics.unsupported.filter((entry) => entry.feature === 'partial-border');
  assert.ok(!partialBorders.some((entry) => (
    entry.nodeId === 'panel:project/tree-title-row' || entry.nodeId === 'panel:project/tree-toolbar'
  )), 'solid one-side dividers are reproduced natively');

  let collapse = byId.get('panel:project/control:collapse-all');
  assert.ok(collapse, 'tree collapse button is captured as a control');
  assert.equal(collapse.part, 'control');
  assert.deepEqual(collapse.actions, [
    { id: 'collapse-all', targetId: 'panel:project', intent: 'sn-tree-panel-collapse' },
  ]);
  assert.equal(collapse.style['background-color'], 'rgb(20, 20, 20)');
  assert.equal(collapse.style['border-color'], 'rgb(60, 60, 60)');
});

test('captureSpatialSnapshot captures tree badges as provider-generic badge nodes', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let snapshot = captureSpatialSnapshot(createTreePanelLayout(doc));
  let byId = new Map(snapshot.nodes.map((node) => [node.id, node]));

  let badge = byId.get('panel:project/row:src/badge:graph');
  assert.ok(badge, 'row badge is captured');
  assert.equal(badge.part, 'badge');
  assert.equal(badge.component, 'sn-tree-panel');
  assert.equal(badge.parentId, 'panel:project/row:src');
  assert.equal(badge.text, 'graph');
  assert.equal(badge.style['background-color'], 'rgb(40, 60, 90)');
  assert.equal(badge.style.color, 'rgb(153, 153, 153)');
  assert.ok(byId.get('panel:project/row:src/badge:voice'), 'second badge keeps a distinct node');
});

test('captureSpatialSnapshot captures the tree filter as a field proxy and keeps text-input unsupported', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let snapshot = captureSpatialSnapshot(createTreePanelLayout(doc));
  let byId = new Map(snapshot.nodes.map((node) => [node.id, node]));

  let field = byId.get('panel:project/field:filter');
  assert.ok(field, 'filter input is captured as a field proxy');
  assert.equal(field.part, 'field');
  assert.equal(field.text, 'Filter project files', 'empty input proxies its placeholder text');
  assert.equal(field.style['background-color'], 'rgb(20, 20, 20)');
  assert.equal(field.style['border-width'], '1px');
  assert.equal(field.style['border-color'], 'rgb(60, 60, 60)');
  assert.equal(field.actions, undefined, 'field proxy is not interactive');

  let textInput = snapshot.diagnostics.unsupported.filter((entry) => entry.feature === 'text-input');
  assert.equal(textInput.length, 1, 'text-input stays an unsupported interaction');
  assert.equal(textInput[0].nodeId, 'panel:project/filter');

  let filled = captureSpatialSnapshot(createTreePanelLayout(doc, { filterValue: 'graph' }));
  assert.equal(
    filled.nodes.find((node) => node.id === 'panel:project/field:filter').text,
    'graph',
    'a non-empty filter proxies its current value',
  );
});

test('captureSpatialSnapshot excludes borders above the named width threshold', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let wide = Object.fromEntries(
    Object.entries(UNIFORM_BORDER_STYLES).map(([key, value]) => [key, key.endsWith('-width') ? '4px' : value]),
  );
  let panel = fakeElement(doc, {
    tag: 'section',
    rect: { left: 8, top: 40, width: 280, height: 120 },
    styles: { 'background-color': 'rgb(34, 34, 34)', ...wide },
    matches: (selector) => selector === '.wide-panel',
    children: [],
    childNodes: [],
  });
  let snapshot = captureSpatialSnapshot(
    createHeaderIconPanelLayout(doc, { contentChildren: [panel] }),
    { surfaceSelectors: ['.wide-panel'] },
  );
  let surface = snapshot.nodes.find((node) => node.part === 'surface');
  assert.ok(surface, 'opted-in surface is captured');
  assert.equal(surface.style['background-color'], 'rgb(34, 34, 34)');
  assert.equal(surface.style['border-width'], undefined, 'over-threshold borders are excluded');
  let borderDiagnostics = snapshot.diagnostics.unsupported.filter((entry) => entry.feature === 'partial-border');
  assert.equal(borderDiagnostics.length, 1);
  assert.match(borderDiagnostics[0].detail, /not reproduced/);
});

test('captureSpatialSnapshot captures opted-in structural surfaces without dropping child text or icons', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let introIcon = fakeIconElement(doc, {
    rect: { left: 16, top: 48, width: 20, height: 20 },
    name: 'code',
  });
  let strong = fakeElement(doc, {
    tag: 'strong',
    rect: { left: 44, top: 46, width: 120, height: 16 },
    text: 'Source editor',
    childNodes: [fakeTextNode('Source editor')],
    styles: { color: 'rgb(240, 240, 240)', 'font-size': '13px' },
  });
  let span = fakeElement(doc, {
    tag: 'span',
    rect: { left: 44, top: 64, width: 180, height: 14 },
    text: 'One focused panel',
    childNodes: [fakeTextNode('One focused panel')],
    styles: { color: 'rgb(153, 153, 153)', 'font-size': '12px' },
  });
  let textWrap = fakeElement(doc, {
    tag: 'div',
    rect: { left: 44, top: 44, width: 200, height: 40 },
    children: [strong, span],
    childNodes: [strong, span],
  });
  let intro = fakeElement(doc, {
    tag: 'header',
    rect: { left: 8, top: 40, width: 280, height: 56 },
    styles: { 'background-color': 'rgb(39, 39, 39)', ...UNIFORM_BORDER_STYLES },
    matches: (selector) => selector === '.project-panel-intro',
    children: [introIcon, textWrap],
    childNodes: [introIcon, textWrap],
  });
  let filesPanel = fakeElement(doc, {
    tag: 'section',
    rect: { left: 0, top: 28, width: 300, height: 500 },
    styles: { 'background-color': 'rgb(34, 34, 34)' },
    matches: (selector) => selector === '.project-files-panel',
    children: [intro],
    childNodes: [intro],
  });
  let snapshot = captureSpatialSnapshot(
    createHeaderIconPanelLayout(doc, { contentChildren: [filesPanel] }),
    { surfaceSelectors: ['.project-files-panel', '.project-panel-intro'] },
  );
  let byId = new Map(snapshot.nodes.map((node) => [node.id, node]));

  let outer = byId.get('panel:project/surface:1');
  assert.ok(outer, 'outer structural surface is captured');
  assert.equal(outer.part, 'surface');
  assert.equal(outer.style['background-color'], 'rgb(34, 34, 34)');

  let nested = byId.get('panel:project/surface:1/surface:1');
  assert.ok(nested, 'nested structural surface is captured');
  assert.equal(nested.parentId, outer.id);
  assert.equal(nested.style['border-color'], 'rgb(60, 60, 60)');

  let icon = byId.get(`${nested.id}/icon:code`);
  assert.ok(icon, 'surface child icon is captured');
  assert.equal(icon.part, 'icon');

  let texts = snapshot.nodes.filter((node) => node.part === 'text' && node.parentId === nested.id);
  assert.deepEqual(
    texts.map((node) => node.text).sort(),
    ['One focused panel', 'Source editor'],
    'surface child text is captured as text nodes',
  );
  assert.deepEqual(snapshot.diagnostics.unknownVisible, [], 'opted-in surfaces leave no unknown visible boxes');
});

test('captureSpatialSnapshot automatically captures visible cascade-styled elements without a selector profile', () => {
  let doc = createFakeDocument(new Map(SENTINEL_CONVERSIONS));
  let promo = fakeElement(doc, {
    tag: 'div',
    rect: { left: 8, top: 40, width: 280, height: 40 },
    styles: { 'background-color': 'rgb(90, 20, 20)' },
    children: [],
    childNodes: [],
  });
  let snapshot = captureSpatialSnapshot(
    createHeaderIconPanelLayout(doc, { contentChildren: [promo] }),
    { surfaceSelectors: ['.project-files-panel'] },
  );
  assert.equal(snapshot.diagnostics.unknownVisible.length, 0);
  assert.ok(snapshot.nodes.some((node) => node.component === 'surface' && node.rect.width === 280));
});
