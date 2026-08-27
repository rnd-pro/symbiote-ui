import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';

import { ConnectionRenderer } from '../canvas/ConnectionRenderer.js';
import {
  NODE_CANVAS_RENDER_SNAPSHOT_KIND,
  NODE_CANVAS_RENDER_SNAPSHOT_VERSION,
  NODE_CANVAS_ROUTE_FINGERPRINT_SCHEMA,
  createNodeCanvasRenderSnapshot,
  createNodeCanvasRenderSnapshotReceipt,
  isNodeCanvasRenderSnapshotReceipt,
  matchNodeCanvasRouteFingerprint,
  normalizeNodeCanvasRenderSnapshot,
  readNodeCanvasLogicalSize,
  validateNodeCanvasRenderSnapshot,
} from '../canvas/NodeCanvas/NodeCanvasRenderSnapshot.js';

function routeFingerprint(overrides = {}) {
  return {
    schema: NODE_CANVAS_ROUTE_FINGERPRINT_SCHEMA,
    provider: {
      package: 'symbiote-ui',
      packageVersion: '0.3.0-alpha.71',
      router: 'pcb',
      routerVersion: '1',
      ...overrides.provider,
    },
    canonicalGraph: 'sha256:graph',
    localeContent: 'sha256:locale-content',
    nodePositions: 'sha256:node-positions',
    nodeSizes: 'sha256:node-sizes',
    fontMetrics: 'sha256:font-metrics',
    ...overrides,
  };
}

function snapshotFixture() {
  return createNodeCanvasRenderSnapshot({
    routeFingerprint: routeFingerprint(),
    nodeRects: [
      { id: 'a', x: 0, y: 10, width: 180, height: 60 },
      { id: 'b', x: 360, y: 10, width: 180, height: 60 },
    ],
    routes: [{
      connectionId: 'a-b',
      signature: 'pcb:a:out:b:in:geometry',
      path: 'M 180 40 L 270 40 L 360 40',
      points: [{ x: 180, y: 40 }, { x: 270, y: 40 }, { x: 360, y: 40 }],
    }],
  });
}

test('NodeCanvas PCB route snapshot is strict, serializable, and deterministic', () => {
  let snapshot = snapshotFixture();
  let roundTrip = JSON.parse(JSON.stringify(snapshot));

  assert.equal(snapshot.kind, NODE_CANVAS_RENDER_SNAPSHOT_KIND);
  assert.equal(snapshot.version, NODE_CANVAS_RENDER_SNAPSHOT_VERSION);
  assert.deepEqual(normalizeNodeCanvasRenderSnapshot(roundTrip), snapshot);
  assert.equal(validateNodeCanvasRenderSnapshot(roundTrip).valid, true);
  assert.equal(matchNodeCanvasRouteFingerprint(snapshot.routeFingerprint, routeFingerprint()), true);
  assert.equal(matchNodeCanvasRouteFingerprint(
    snapshot.routeFingerprint,
    routeFingerprint({
      nodePositions: 'sha256:different-rounded-positions',
      nodeSizes: 'sha256:different-rounded-sizes',
    }),
  ), true);
  assert.equal(matchNodeCanvasRouteFingerprint(
    snapshot.routeFingerprint,
    routeFingerprint({ canonicalGraph: 'sha256:different-graph' }),
  ), false);
  assert.equal(matchNodeCanvasRouteFingerprint(
    snapshot.routeFingerprint,
    routeFingerprint({ fontMetrics: 'sha256:different-fonts' }),
  ), false);
});

test('NodeCanvas PCB route snapshot rejects malformed paths and geometry tampering', () => {
  let snapshot = snapshotFixture();
  let cases = [
    null,
    {},
    { ...snapshot, version: 99 },
    { ...snapshot, geometrySignature: 'forged' },
    { ...snapshot, routes: [{ ...snapshot.routes[0], path: 'url(https://example.test)' }] },
    { ...snapshot, routes: [...snapshot.routes, snapshot.routes[0]] },
    { ...snapshot, nodeRects: [{ ...snapshot.nodeRects[0], width: 0 }] },
  ];

  for (let value of cases) {
    assert.equal(normalizeNodeCanvasRenderSnapshot(value), null);
    assert.equal(validateNodeCanvasRenderSnapshot(value).valid, false);
  }
});

test('NodeCanvas render snapshot receipts distinguish cached adoption from live PCB reroute', () => {
  let adopted = createNodeCanvasRenderSnapshotReceipt({
    adopted: true,
    reason: 'adopted',
    routeCount: 180,
  });
  let invalidated = createNodeCanvasRenderSnapshotReceipt({
    adopted: false,
    reason: 'geometry-mismatch',
    routeCount: 180,
    invalidatedConnectionIds: ['b', 'a', 'a'],
  });

  assert.equal(isNodeCanvasRenderSnapshotReceipt(adopted), true);
  assert.equal(adopted.resolution, 'cached-pcb');
  assert.equal(isNodeCanvasRenderSnapshotReceipt(invalidated), true);
  assert.equal(invalidated.resolution, 'pcb-live-reroute');
  assert.deepEqual(invalidated.invalidatedConnectionIds, ['a', 'b']);
});

function createNode(document, id, x, options = {}) {
  let element = document.createElement('graph-node');
  element.setAttribute('node-shape', 'rect');
  element._cachedW = options.logicalWidth ?? 180;
  element._cachedH = options.logicalHeight ?? 60;
  if (options.offsetWidth !== undefined) {
    defineLayoutMetric(element, 'offsetWidth', options.offsetWidth);
  }
  if (options.offsetHeight !== undefined) {
    defineLayoutMetric(element, 'offsetHeight', options.offsetHeight);
  }
  element._position = { x, y: 10 };
  element._nodeData = {
    inputs: { in: { socket: { name: 'data' } } },
    outputs: { out: { socket: { name: 'data' } } },
  };
  element.setAttribute('node-id', id);
  return element;
}

function createRenderer(document, pathStyle, options = {}) {
  let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  let dotLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  let nodeViews = new Map([
    ['a', createNode(document, 'a', 0, options.nodeMetrics)],
    ['b', createNode(document, 'b', 360, options.nodeMetrics)],
  ]);
  let nodes = new Map([...nodeViews].map(([id, element]) => [id, {
    id,
    shape: 'rect',
    inputs: element._nodeData.inputs,
    outputs: element._nodeData.outputs,
  }]));
  let connection = { id: 'a-b', from: 'a', out: 'out', to: 'b', in: 'in' };
  let renderer = new ConnectionRenderer({
    svgLayer: svg,
    dotLayer,
    nodeViews,
    editor: {
      getNode: (id) => nodes.get(id),
      getConnections: () => [connection],
    },
    onConnectionClick: () => {},
    getZoom: () => 1,
  });
  if (pathStyle === 'pcb' && options.suspend !== false) {
    renderer.suspendProgressiveRendering('snapshot-capture');
  }
  renderer.setPathStyle(pathStyle);
  renderer.addBatch([connection]);
  return { renderer, svg, nodeViews };
}

test('matching live full PCB survives suspended viewport refresh until geometry changes', () => {
  let previousDocument = globalThis.document;
  let { document } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.document = document;
  try {
    let live = createRenderer(document, 'pcb');
    let path = live.svg.querySelector('[data-conn-id="a-b"]');
    let identity = path;
    let originalSetAttribute = path.setAttribute.bind(path);
    let routeWrites = [];
    path.setAttribute = (name, value) => {
      if (['d', 'data-pcb-quality', 'data-pcb-signature'].includes(name)) {
        routeWrites.push({ name, value });
      }
      return originalSetAttribute(name, value);
    };
    let initialPath = path.getAttribute('d');
    let initialSignature = path.getAttribute('data-pcb-signature');

    live.renderer.refreshAll();

    assert.equal(live.svg.querySelector('[data-conn-id="a-b"]'), identity);
    assert.equal(path.getAttribute('data-pcb-quality'), 'full');
    assert.equal(path.getAttribute('data-pcb-signature'), initialSignature);
    assert.equal(path.getAttribute('d'), initialPath);
    assert.deepEqual(routeWrites, [], 'matching full PCB must remain a cache hit');

    live.nodeViews.get('b')._position.x += 20;
    live.renderer.refreshAll();

    assert.equal(live.svg.querySelector('[data-conn-id="a-b"]'), identity);
    assert.equal(path.getAttribute('data-pcb-quality'), 'full');
    assert.notEqual(path.getAttribute('data-pcb-signature'), initialSignature);
    assert.notEqual(path.getAttribute('d'), initialPath);
    assert.ok(routeWrites.some(({ name }) => name === 'd'));
  } finally {
    globalThis.document = previousDocument;
  }
});

test('DPR-rounded offsets do not replace canonical logical geometry during snapshot adoption', () => {
  let computedStyle = {
    width: '180.25px',
    height: '143px',
    boxSizing: 'content-box',
    paddingLeft: '0px',
    paddingRight: '0px',
    paddingTop: '0px',
    paddingBottom: '0px',
    borderLeftWidth: '2px',
    borderRightWidth: '2px',
    borderTopWidth: '2px',
    borderBottomWidth: '2px',
  };
  assert.deepEqual(readNodeCanvasLogicalSize({
    _cachedW: 184,
    _cachedH: 148,
    offsetWidth: 184,
    offsetHeight: 148,
    ownerDocument: { defaultView: { getComputedStyle: () => computedStyle } },
  }), { width: 184, height: 148 });

  let previousDocument = globalThis.document;
  let { document } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.document = document;
  try {
    let logicalMetrics = { logicalWidth: 180.25, logicalHeight: 60.25 };
    let build = createRenderer(document, 'pcb', {
      nodeMetrics: { ...logicalMetrics, offsetWidth: 180, offsetHeight: 60 },
    });
    let buildFingerprint = routeFingerprint({
      nodePositions: 'sha256:dpr1-rounded-positions',
      nodeSizes: 'sha256:dpr1-rounded-sizes',
    });
    let snapshot = build.renderer.capturePcbRouteSnapshot(buildFingerprint);

    let live = createRenderer(document, 'pcb', {
      suspend: false,
      nodeMetrics: { ...logicalMetrics, offsetWidth: 180, offsetHeight: 61 },
    });
    let liveFingerprint = routeFingerprint({
      nodePositions: 'sha256:dpr2-rounded-positions',
      nodeSizes: 'sha256:dpr2-rounded-sizes',
    });
    let receipt = live.renderer.adoptPcbRouteSnapshot(snapshot, {
      routeFingerprint: liveFingerprint,
    });

    assert.equal(receipt.adopted, true);
    assert.equal(receipt.reason, 'adopted');
    assert.equal(receipt.routeCount, 1);

    live.nodeViews.get('b')._cachedH = 60.5;
    live.renderer.refreshAll();
    assert.equal(live.renderer.renderSnapshotReceipt.adopted, false);
    assert.equal(live.renderer.renderSnapshotReceipt.reason, 'geometry-mismatch');
  } finally {
    globalThis.document = previousDocument;
  }
});

test('equivalent same-Chrome intrinsic sizes share one logical representation', () => {
  let readSize = (width, height) => readNodeCanvasLogicalSize({
    ownerDocument: {
      defaultView: {
        getComputedStyle: () => ({
          width: `${width}px`,
          height: `${height}px`,
          boxSizing: 'border-box',
        }),
      },
    },
  });
  let cases = [
    [[242.406, 410.484], [242.492, 410.586], { width: 242, height: 410 }],
    [[270.969, 286.391], [271.07, 286.516], { width: 272, height: 286 }],
  ];

  for (let [headless, headed, expected] of cases) {
    assert.deepEqual(readSize(...headless), expected);
    assert.deepEqual(readSize(...headed), expected);
  }
  assert.notDeepEqual(readSize(242.492, 412.586), readSize(242.406, 410.484));
});

function createScopedRenderer(document, options = {}) {
  let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  let dotLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  let positions = new Map([
    ['source', [0, 180]],
    ['target-a', [420, 20]],
    ['target-b', [420, 180]],
    ['target-c', [420, 340]],
    ['unrelated-a', [760, 100]],
    ['unrelated-b', [1080, 100]],
  ]);
  let nodeViews = new Map([...positions].map(([id, [x, y]]) => {
    let element = createNode(document, id, x);
    element._position.y = y;
    return [id, element];
  }));
  let nodes = new Map([...nodeViews].map(([id, element]) => [id, {
    id,
    shape: 'rect',
    inputs: element._nodeData.inputs,
    outputs: element._nodeData.outputs,
  }]));
  let connections = [
    { id: 'source-a', from: 'source', out: 'out', to: 'target-a', in: 'in' },
    { id: 'source-b', from: 'source', out: 'out', to: 'target-b', in: 'in' },
    { id: 'source-c', from: 'source', out: 'out', to: 'target-c', in: 'in' },
    { id: 'unrelated', from: 'unrelated-a', out: 'out', to: 'unrelated-b', in: 'in' },
  ].map((connection) => connection.id === options.markerConnectionId
    ? {
        ...connection,
        direction: 'forward',
        design: { marker: { role: 'flow' } },
      }
    : connection);
  let renderer = new ConnectionRenderer({
    svgLayer: svg,
    dotLayer,
    nodeViews,
    editor: {
      getNode: (id) => nodes.get(id),
      getConnections: () => connections,
    },
    onConnectionClick: () => {},
    getZoom: () => 1,
  });
  let pathStyle = options.pathStyle || 'pcb';
  if (pathStyle === 'pcb' && options.suspend !== false) {
    renderer.suspendProgressiveRendering('snapshot-capture');
  }
  renderer.setPathStyle(pathStyle);
  renderer.addBatch(connections);
  return { renderer, svg, nodeViews, connections };
}

function createPortfolioScaleRenderer(document, options = {}) {
  let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  let dotLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  let nodeViews = new Map();
  for (let index = 0; index < 119; index += 1) {
    let id = `node-${index}`;
    let element = createNode(document, id, (index % 17) * 240);
    element._position.y = Math.floor(index / 17) * 130;
    nodeViews.set(id, element);
  }
  let nodes = new Map([...nodeViews].map(([id, element]) => [id, {
    id,
    shape: 'rect',
    inputs: element._nodeData.inputs,
    outputs: element._nodeData.outputs,
  }]));
  let connections = [1, 2, 3].map((target, index) => ({
    id: `drag-${index}`,
    from: 'node-0',
    out: 'out',
    to: `node-${target}`,
    in: 'in',
  }));
  for (let index = 0; index < 177; index += 1) {
    let from = 4 + (index % 115);
    let to = 4 + ((index * 37 + 11) % 115);
    if (to === from) to = 4 + ((to - 3) % 115);
    connections.push({
      id: `stable-${index}`,
      from: `node-${from}`,
      out: 'out',
      to: `node-${to}`,
      in: 'in',
    });
  }
  let renderer = new ConnectionRenderer({
    svgLayer: svg,
    dotLayer,
    nodeViews,
    editor: {
      getNode: (id) => nodes.get(id),
      getConnections: () => connections,
    },
    onConnectionClick: () => {},
    getZoom: () => 0.8,
  });
  if (options.suspend !== false) renderer.suspendProgressiveRendering('snapshot-capture');
  renderer.setPathStyle('pcb');
  renderer.addBatch(connections);
  return { renderer, svg, nodeViews, connections };
}

function defineLayoutMetric(element, name, value) {
  Object.defineProperty(element, name, {
    configurable: true,
    get: () => value,
  });
}

function createPortNode(document, id, x, options = {}) {
  let element = document.createElement('graph-node');
  let zoom = options.zoom || 1;
  let socketY = options.socketY ?? 20;
  let rasterDrift = options.rasterDrift || 0;
  element._cachedW = 180;
  element._cachedH = 60;
  element._position = { x, y: 10 };
  element._nodeData = {
    inputs: { in: { socket: { name: 'data' } } },
    outputs: { out: { socket: { name: 'data' } } },
  };
  element.setAttribute('node-id', id);
  defineLayoutMetric(element, 'offsetWidth', 180);
  defineLayoutMetric(element, 'offsetHeight', 60);
  defineLayoutMetric(element, 'clientLeft', 1);
  defineLayoutMetric(element, 'clientTop', 1);
  element.getBoundingClientRect = () => ({
    left: x * zoom,
    top: 10 * zoom,
    width: 180 * zoom,
    height: 60 * zoom,
  });

  for (let side of ['input', 'output']) {
    let container = document.createElement('div');
    container.className = side === 'input' ? 'inputs' : 'outputs';
    let item = document.createElement('port-item');
    item.$ = { key: side === 'input' ? 'in' : 'out' };
    let socket = document.createElement('div');
    socket.className = 'sn-socket';
    let socketX = side === 'input' ? -11 : 169;
    defineLayoutMetric(socket, 'offsetLeft', socketX);
    defineLayoutMetric(socket, 'offsetTop', socketY);
    defineLayoutMetric(socket, 'offsetWidth', 20);
    defineLayoutMetric(socket, 'offsetHeight', 20);
    defineLayoutMetric(socket, 'offsetParent', element);
    socket.getBoundingClientRect = () => ({
      left: (x + socketX + 1) * zoom,
      top: (10 + socketY + 1) * zoom + rasterDrift,
      width: 20 * zoom,
      height: 20 * zoom,
    });
    item.append(socket);
    container.append(item);
    element.append(container);
  }
  return element;
}

function createPortRenderer(document, options = {}) {
  let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  let dotLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  let nodeViews = new Map([
    ['a', createPortNode(document, 'a', 0, options)],
    ['b', createPortNode(document, 'b', 360, options)],
  ]);
  let nodes = new Map([...nodeViews].map(([id, element]) => [id, {
    id,
    inputs: element._nodeData.inputs,
    outputs: element._nodeData.outputs,
  }]));
  let connection = { id: 'a-b', from: 'a', out: 'out', to: 'b', in: 'in' };
  let renderer = new ConnectionRenderer({
    svgLayer: svg,
    dotLayer,
    nodeViews,
    editor: {
      getNode: (id) => nodes.get(id),
      getConnections: () => [connection],
    },
    onConnectionClick: () => {},
    getZoom: () => options.zoom || 1,
  });
  renderer.suspendProgressiveRendering('snapshot-capture');
  renderer.setPathStyle('pcb');
  renderer.addBatch([connection]);
  return { renderer, svg, nodeViews };
}

test('socket signatures use logical layout coordinates across zoom and raster drift', () => {
  let previousDocument = globalThis.document;
  let { document } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.document = document;
  try {
    let build = createPortRenderer(document, { zoom: 1 });
    let snapshot = build.renderer.capturePcbRouteSnapshot(routeFingerprint());
    let live = createPortRenderer(document, { zoom: 0.8, rasterDrift: 0.08 });

    let receipt = live.renderer.adoptPcbRouteSnapshot(snapshot, {
      routeFingerprint: routeFingerprint(),
    });

    assert.equal(receipt.adopted, true);
    assert.equal(receipt.routeCount, 1);
    assert.equal(live.svg.querySelector('[data-conn-id="a-b"]').getAttribute('data-pcb-quality'), 'full');

    let targetSocket = live.nodeViews.get('b').querySelector('.inputs .sn-socket');
    defineLayoutMetric(targetSocket, 'offsetTop', 20.1);
    live.renderer.refreshAll();
    assert.equal(live.renderer.renderSnapshotReceipt.reason, 'geometry-mismatch');
    assert.equal(live.renderer.pathStyle, 'pcb');
  } finally {
    globalThis.document = previousDocument;
  }
});

test('snapshot adoption reprojects flow markers from transient bezier geometry onto cached PCB routes', () => {
  let previousDocument = globalThis.document;
  let { document } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.document = document;
  try {
    let markerConnectionId = 'source-a';
    let build = createScopedRenderer(document, { markerConnectionId });
    let snapshot = build.renderer.capturePcbRouteSnapshot(routeFingerprint());
    let expectedTransform = build.svg
      .querySelector(`[data-conn-marker="${markerConnectionId}"]`)
      .getAttribute('transform');

    let live = createScopedRenderer(document, { markerConnectionId, suspend: false });
    let marker = live.svg.querySelector(`[data-conn-marker="${markerConnectionId}"]`);
    let transientTransform = 'translate(-3,492) rotate(-137)';
    marker.setAttribute('transform', transientTransform);
    assert.notEqual(marker.getAttribute('transform'), expectedTransform);

    let receipt = live.renderer.adoptPcbRouteSnapshot(snapshot, {
      routeFingerprint: routeFingerprint(),
    });

    assert.equal(receipt.adopted, true);
    assert.equal(marker.getAttribute('transform'), expectedTransform);
    assert.equal(
      live.svg.querySelector(`[data-conn-id="${markerConnectionId}"]`).getAttribute('d'),
      snapshot.routes.find((route) => route.connectionId === markerConnectionId).path,
    );
  } finally {
    globalThis.document = previousDocument;
  }
});

test('scoped PCB drag invalidation preserves full markers on unaffected adopted routes', () => {
  let previousDocument = globalThis.document;
  let previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  let previousCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let { document } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.document = document;
  let frameId = 0;
  let frames = new Map();
  globalThis.requestAnimationFrame = (callback) => {
    frameId += 1;
    frames.set(frameId, callback);
    return frameId;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  let flushFrames = () => {
    for (let pass = 0; pass < 20 && frames.size; pass += 1) {
      let callbacks = [...frames.values()];
      frames.clear();
      for (let callback of callbacks) callback(pass * 16);
    }
  };

  try {
    let build = createScopedRenderer(document);
    let snapshot = build.renderer.capturePcbRouteSnapshot(routeFingerprint());
    let live = createScopedRenderer(document, { suspend: false });
    assert.equal(live.renderer.adoptPcbRouteSnapshot(snapshot, {
      routeFingerprint: routeFingerprint(),
    }).adopted, true);

    let paths = new Map([...live.svg.querySelectorAll('[data-conn-id]')].map((path) => [
      path.getAttribute('data-conn-id'),
      path,
    ]));
    let initialPaths = new Map([...paths].map(([id, path]) => [id, path.getAttribute('d')]));
    let initialSignatures = new Map([...paths].map(([id, path]) => [
      id,
      path.getAttribute('data-pcb-signature'),
    ]));
    let affectedIds = ['source-a', 'source-b', 'source-c'];

    live.renderer.setTransientPathStyle('pcb-drag-proxy', {
      source: 'node-drag',
      connectionIds: affectedIds,
      draggedNodeId: 'source',
      suspendProgressivePcb: true,
    });
    assert.equal(live.svg.querySelectorAll('[data-conn-proxy-id]').length, 3);
    assert.equal([...paths.values()].filter((path) =>
      path.getAttribute('data-pcb-quality') === 'full'
    ).length, 4);
    assert.deepEqual(
      new Map([...paths].map(([id, path]) => [id, path.getAttribute('d')])),
      initialPaths,
    );

    live.nodeViews.get('source')._position.x += 40;
    live.renderer.setTransientPathStyle('', { source: 'node-drag' });
    assert.equal(live.svg.querySelectorAll('[data-conn-proxy-id]').length, 0);
    assert.equal(paths.get('unrelated').getAttribute('data-pcb-quality'), 'full');
    assert.equal(paths.get('unrelated').getAttribute('data-pcb-signature'), initialSignatures.get('unrelated'));
    assert.equal(paths.get('unrelated').getAttribute('d'), initialPaths.get('unrelated'));
    assert.equal(affectedIds.filter((id) => paths.get(id).getAttribute('data-pcb-quality') === 'draft').length, 3);

    flushFrames();
    assert.equal([...paths.values()].filter((path) =>
      path.getAttribute('data-pcb-quality') === 'full'
    ).length, 4);
    assert.equal(affectedIds.filter((id) => paths.get(id).getAttribute('d') !== initialPaths.get(id)).length, 3);
    assert.equal(paths.get('unrelated').getAttribute('d'), initialPaths.get('unrelated'));
  } finally {
    globalThis.document = previousDocument;
    globalThis.requestAnimationFrame = previousRequestAnimationFrame;
    globalThis.cancelAnimationFrame = previousCancelAnimationFrame;
  }
});

test('119-node 180-route adopted PCB keeps 177 full paths through a scoped three-route drag', () => {
  let previousDocument = globalThis.document;
  let previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  let previousCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let { document } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.document = document;
  let frameId = 0;
  let frames = new Map();
  globalThis.requestAnimationFrame = (callback) => {
    frameId += 1;
    frames.set(frameId, callback);
    return frameId;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  let flushFrames = () => {
    for (let pass = 0; pass < 60 && frames.size; pass += 1) {
      let callbacks = [...frames.values()];
      frames.clear();
      for (let callback of callbacks) callback(pass * 16);
    }
  };

  try {
    let build = createPortfolioScaleRenderer(document);
    let snapshot = build.renderer.capturePcbRouteSnapshot(routeFingerprint());
    assert.equal(snapshot.routes.length, 180);
    let live = createPortfolioScaleRenderer(document, { suspend: false });
    assert.equal(live.renderer.adoptPcbRouteSnapshot(snapshot, {
      routeFingerprint: routeFingerprint(),
    }).adopted, true);

    let paths = new Map([...live.svg.querySelectorAll('[data-conn-id]')].map((path) => [
      path.getAttribute('data-conn-id'),
      path,
    ]));
    let before = new Map([...paths].map(([id, path]) => [id, path.getAttribute('d')]));
    let affected = ['drag-0', 'drag-1', 'drag-2'];
    assert.equal([...paths.values()].filter((path) => path.dataset.pcbQuality === 'full').length, 180);

    live.renderer.setTransientPathStyle('pcb-drag-proxy', {
      source: 'node-drag',
      connectionIds: affected,
      draggedNodeId: 'node-0',
      suspendProgressivePcb: true,
    });
    assert.equal(live.svg.querySelectorAll('[data-conn-proxy-id]').length, 3);
    assert.equal([...paths.values()].filter((path) => path.dataset.pcbQuality === 'full').length, 180);

    live.nodeViews.get('node-0')._position.x += 40;
    live.renderer.setTransientPathStyle('', { source: 'node-drag' });
    assert.equal(live.svg.querySelectorAll('[data-conn-proxy-id]').length, 0);
    assert.equal([...paths].filter(([id, path]) => !affected.includes(id) && path.dataset.pcbQuality === 'full').length, 177);
    flushFrames();

    assert.equal([...paths.values()].filter((path) => path.dataset.pcbQuality === 'full').length, 180);
    assert.equal([...paths.values()].filter((path) => !path.hasAttribute('data-pcb-quality')).length, 0);
    assert.equal(affected.filter((id) => paths.get(id).getAttribute('d') !== before.get(id)).length, 3);
    assert.equal([...paths].filter(([id, path]) => !affected.includes(id) && path.getAttribute('d') !== before.get(id)).length, 0);
  } finally {
    globalThis.document = previousDocument;
    globalThis.requestAnimationFrame = previousRequestAnimationFrame;
    globalThis.cancelAnimationFrame = previousCancelAnimationFrame;
  }
});

test('live SVG snapshot invalidation preserves PCB routing, drag proxy, and full reroute', () => {
  let previousDocument = globalThis.document;
  let previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  let previousCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let { document } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.document = document;
  let frameId = 0;
  let frames = new Map();
  globalThis.requestAnimationFrame = (callback) => {
    frameId += 1;
    frames.set(frameId, callback);
    return frameId;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  let flushFrames = () => {
    for (let pass = 0; pass < 20 && frames.size; pass += 1) {
      let callbacks = [...frames.values()];
      frames.clear();
      for (let callback of callbacks) callback(pass * 16);
    }
  };

  try {
    let build = createRenderer(document, 'pcb');
    let snapshot = build.renderer.capturePcbRouteSnapshot(routeFingerprint());
    let customPath = 'M 180 40 L 240 12 L 300 68 L 360 40';
    snapshot = createNodeCanvasRenderSnapshot({
      routeFingerprint: snapshot.routeFingerprint,
      nodeRects: snapshot.nodeRects,
      routes: snapshot.routes.map((route) => ({
        ...route,
        path: customPath,
        points: [
          { x: 180, y: 40 },
          { x: 240, y: 12 },
          { x: 300, y: 68 },
          { x: 360, y: 40 },
        ],
      })),
    });

    let live = createRenderer(document, 'pcb', { suspend: false });
    let path = live.svg.querySelector('[data-conn-id="a-b"]');
    let identity = path;
    let receipt = live.renderer.adoptPcbRouteSnapshot(snapshot, {
      routeFingerprint: routeFingerprint(),
    });

    assert.equal(receipt.adopted, true);
    assert.equal(live.svg.querySelector('[data-conn-id="a-b"]'), identity);
    assert.equal(path.getAttribute('d'), customPath);
    assert.equal(path.getAttribute('data-pcb-quality'), 'full');

    live.renderer.refreshAll();
    assert.equal(path.getAttribute('d'), customPath, 'refresh reuses the adopted path without routing');

    live.renderer.setTransientPathStyle('pcb-drag-proxy', {
      source: 'node-drag',
      connectionIds: ['a-b'],
      draggedNodeId: 'a',
    });
    assert.equal(path.getAttribute('d'), customPath, 'drag proxy preserves the adopted full PCB path');
    assert.equal(live.svg.querySelectorAll('[data-conn-proxy-id="a-b"]').length, 1);
    live.renderer.setTransientPathStyle('', { source: 'node-drag' });
    assert.equal(live.svg.querySelectorAll('[data-conn-proxy-id="a-b"]').length, 0);

    live.nodeViews.get('b')._position.x += 20;
    live.renderer.refreshAll();
    let invalidated = live.renderer.renderSnapshotReceipt;
    assert.equal(invalidated.adopted, false);
    assert.equal(invalidated.reason, 'geometry-mismatch');
    assert.equal(live.renderer.pathStyle, 'pcb');
    assert.equal(live.svg.querySelector('[data-conn-id="a-b"]'), identity);
    assert.notEqual(path.getAttribute('d'), customPath);
    assert.equal(path.getAttribute('data-pcb-quality'), 'draft');
    flushFrames();
    assert.equal(path.getAttribute('data-pcb-quality'), 'full');
    assert.ok(path.getAttribute('data-pcb-signature'));

    let replacement = live.renderer.capturePcbRouteSnapshot(routeFingerprint());
    let replacementPath = 'M 180 40 L 270 90 L 380 40';
    replacement = createNodeCanvasRenderSnapshot({
      routeFingerprint: replacement.routeFingerprint,
      nodeRects: replacement.nodeRects,
      routes: replacement.routes.map((route) => ({
        ...route,
        path: replacementPath,
        points: [{ x: 180, y: 40 }, { x: 270, y: 90 }, { x: 380, y: 40 }],
      })),
    });
    assert.equal(live.renderer.adoptPcbRouteSnapshot(replacement, {
      routeFingerprint: routeFingerprint(),
    }).adopted, true);
    assert.equal(path.getAttribute('d'), replacementPath);

    let explicitlyInvalidated = live.renderer.invalidatePcbRouteSnapshot('host-graph-change');
    assert.equal(explicitlyInvalidated.reason, 'host-graph-change');
    assert.equal(live.renderer.pathStyle, 'pcb');
    assert.notEqual(path.getAttribute('d'), replacementPath);
    assert.equal(path.getAttribute('data-pcb-quality'), 'draft');
    flushFrames();
    assert.equal(path.getAttribute('data-pcb-quality'), 'full');

    let readopted = live.renderer.adoptPcbRouteSnapshot(replacement, {
      routeFingerprint: routeFingerprint(),
    });
    assert.equal(readopted.adopted, true);
    live.renderer.setPathStyle('straight');
    let styleChanged = live.renderer.renderSnapshotReceipt;
    assert.equal(styleChanged.reason, 'path-style-change');
    assert.equal(styleChanged.routeCount, 1);
    assert.deepEqual(styleChanged.invalidatedConnectionIds, ['a-b']);
  } finally {
    globalThis.document = previousDocument;
    globalThis.requestAnimationFrame = previousRequestAnimationFrame;
    globalThis.cancelAnimationFrame = previousCancelAnimationFrame;
  }
});
