import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import {
  DOM_RASTER_FRAME_VERSION,
  captureDomRasterFrame,
  normalizeDomRasterFrameSize,
  prepareDomRasterFrameCapture,
} from '../xr/dom-raster-frame.js';
import { DOM_RASTER_INACTIVE_ATTRIBUTE } from '../xr/dom-raster-source-deck.js';

function installDocument(markup) {
  let { document, window } = parseHTML(markup);
  let configure = (doc, win = doc.defaultView) => {
    doc.fonts = { ready: Promise.resolve() };
    win.requestAnimationFrame = (callback) => {
      queueMicrotask(() => callback(16));
      return 1;
    };
    win.getComputedStyle = (element) => {
      let names = [];
      for (let index = 0; index < element.style?.length; index += 1) names.push(element.style[index]);
      return {
        [Symbol.iterator]: () => names[Symbol.iterator](),
        getPropertyValue: (name) => element.style?.getPropertyValue(name) || '',
        backgroundColor: element.style?.backgroundColor || 'rgb(18, 24, 32)',
        backgroundImage: element.style?.backgroundImage || 'none',
        backgroundPosition: element.style?.backgroundPosition || '',
        backgroundSize: element.style?.backgroundSize || '',
        backgroundRepeat: element.style?.backgroundRepeat || '',
      };
    };
    for (let image of doc.querySelectorAll('img')) {
      Object.defineProperties(image, {
        complete: { configurable: true, value: true },
        naturalWidth: { configurable: true, value: 1 },
        naturalHeight: { configurable: true, value: 1 },
      });
      image.decode = () => Promise.resolve();
    }
    return doc;
  };
  configure(document, window);
  document.implementation = {
    createHTMLDocument() {
      let next = parseHTML('<!doctype html><html><head></head><body></body></html>');
      return configure(next.document, next.window);
    },
  };
  let createElement = document.createElement.bind(document);
  document.createElement = (name, options) => {
    let element = createElement(name, options);
    if (String(name).toLowerCase() === 'iframe') element.__rasterFrame = true;
    return element;
  };
  let append = document.body.append.bind(document.body);
  document.body.append = (...nodes) => {
    append(...nodes);
    for (let frame of nodes.filter((node) => node?.__rasterFrame)) {
      let parsed = parseHTML(frame.srcdoc);
      let contentDocument = configure(parsed.document, parsed.window);
      let width = Number.parseFloat(frame.style.width) || 1;
      let height = Number.parseFloat(frame.style.height) || 1;
      let root = contentDocument.querySelector('[data-dom-raster-root="true"]');
      if (root) root.getBoundingClientRect = () => ({ x: 0, y: 0, width, height, top: 0, left: 0, right: width, bottom: height });
      Object.defineProperty(frame, 'contentDocument', { configurable: true, value: contentDocument });
      queueMicrotask(() => frame.dispatchEvent(new window.Event('load')));
    }
  };
  return { document, window };
}

function sizedSource(document, selector, width = 320, height = 180) {
  let source = document.querySelector(selector);
  if (typeof source.style.getPropertyPriority !== 'function') {
    source.style.getPropertyPriority = () => '';
  }
  source.style.width = `${width}px`;
  source.style.height = `${height}px`;
  source.getBoundingClientRect = () => {
    let currentWidth = Number.parseFloat(source.style.getPropertyValue('width')) || width;
    let currentHeight = Number.parseFloat(source.style.getPropertyValue('height')) || height;
    return {
      x: 0, y: 0, width: currentWidth, height: currentHeight,
      top: 0, left: 0, right: currentWidth, bottom: currentHeight,
    };
  };
  return source;
}

test('DOM raster frame normalizes a finite CSS viewport', () => {
  assert.equal(DOM_RASTER_FRAME_VERSION, 'dom-raster-frame-v1');
  assert.deepEqual(normalizeDomRasterFrameSize([475.1254321, 922]), [475.125432, 922]);
  assert.throws(() => normalizeDomRasterFrameSize([475, 0]), /positive finite dimensions/);
  assert.throws(() => normalizeDomRasterFrameSize([475]), /\[width, height\]/);
});

test('capture settlement survives a present but suspended window animation frame', async () => {
  let { document, window } = installDocument(
    '<!doctype html><html><head></head><body><div id="layout">Quest panel</div></body></html>',
  );
  let source = sizedSource(document, '#layout');
  let cancelledFrames = [];
  window.requestAnimationFrame = () => 41;
  window.cancelAnimationFrame = (frameId) => cancelledFrames.push(frameId);

  let result = await Promise.race([
    prepareDomRasterFrameCapture(source).then((host) => ({ host })),
    new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 500)),
  ]);

  assert.equal(result.timeout, undefined, 'capture must not wait forever for window rAF in immersive XR');
  assert.equal(result.host.panel.textContent, 'Quest panel');
  assert.deepEqual(cancelledFrames, [41, 41, 1, 1]);
  result.host.dispose();
});

test('aborted settlement cancels suspended animation-frame and timer work', async () => {
  let { document, window } = installDocument(
    '<!doctype html><html><head></head><body><div id="layout">Quest panel</div></body></html>',
  );
  let source = sizedSource(document, '#layout');
  let cancelledFrames = [];
  window.requestAnimationFrame = () => 73;
  window.cancelAnimationFrame = (frameId) => cancelledFrames.push(frameId);
  let controller = new AbortController();
  let pending = prepareDomRasterFrameCapture(source, { signal: controller.signal });
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort(new Error('XR session ended'));

  await assert.rejects(() => pending, /XR session ended/);
  assert.deepEqual(cancelledFrames, [73]);
});

test('prepare snapshots live controls, readable canvas and open shadow DOM into an inert frame', async () => {
  let { document } = installDocument(`<!doctype html><html><head>
    <base href="https://user:password@example.test/app/?token=secret#private">
    <style>.shell .layout { color: rgb(240, 240, 240); }</style>
  </head><body class="cascade-dark" data-theme="night" style="--cascade-accent:#55ccff"><section class="shell"><div id="layout" class="layout">
    <input value="stale"><textarea>stale</textarea><canvas></canvas><div id="shadow-host"></div>
  </div></section></body></html>`);
  let source = sizedSource(document, '#layout');
  source.style.setProperty('--sn-accent', '#55ccff');
  let input = source.querySelector('input');
  input.value = 'live input';
  input.checked = true;
  source.querySelector('textarea').value = 'live textarea';
  source.querySelector('canvas').toDataURL = () => 'data:image/png;base64,AAAA';
  let shadow = source.querySelector('#shadow-host').attachShadow({ mode: 'open' });
  shadow.innerHTML = '<style>:host{display:block}</style><span>shadow value</span>';

  let host = await prepareDomRasterFrameCapture(source);
  assert.equal(host.sourceCssSize[0], 320);
  assert.equal(host.sourceCssSize[1], 180);
  assert.equal(host.canvases.copied, 1);
  assert.match(host.html, /value="live input"/);
  assert.match(host.html, /live textarea/);
  assert.match(host.html, /data-dom-raster-canvas="true"/);
  assert.match(host.html, /shadowrootmode="open"/);
  assert.match(host.html, /class="cascade-dark"/);
  assert.match(host.html, /data-theme="night"/);
  assert.match(host.html, /--cascade-accent:\s*#55ccff/);
  assert.match(host.html, /<base href="https:\/\/example\.test\/app\/">/);
  assert.doesNotMatch(host.html, /password|token=secret|#private/);
  assert.equal(host.dispose(), true);
  assert.equal(host.dispose(), false);
});

test('static clone omits empty image sources without weakening required image resources', async () => {
  let { document } = installDocument(`<!doctype html><html><head></head><body>
    <div id="layout">
      <img id="empty-image" src="">
      <img id="whitespace-image" src="   ">
      <img id="required-image" src="./graph-node.png">
      <canvas id="canvas-image"></canvas>
    </div>
  </body></html>`);
  let source = sizedSource(document, '#layout');
  source.querySelector('#canvas-image').toDataURL = () => 'data:image/png;base64,AAAA';

  let host = await prepareDomRasterFrameCapture(source);
  let emptyImage = host.panel.querySelector('#empty-image');
  let whitespaceImage = host.panel.querySelector('#whitespace-image');
  let requiredImage = host.panel.querySelector('#required-image');
  let canvasImage = host.panel.querySelector('[data-dom-raster-canvas="true"]');
  assert.equal(emptyImage.tagName.toLowerCase(), 'img');
  assert.equal(whitespaceImage.tagName.toLowerCase(), 'img');
  assert.equal(emptyImage.hasAttribute('src'), false);
  assert.equal(whitespaceImage.hasAttribute('src'), false);
  assert.equal(requiredImage.getAttribute('src'), './graph-node.png');
  assert.equal(canvasImage.getAttribute('src'), 'data:image/png;base64,AAAA');
  assert.equal(host.canvases.copied, 1);
  host.dispose();
});

test('source readiness skips absent, empty and whitespace-only image sources', async () => {
  let { document } = installDocument(`<!doctype html><html><head></head><body>
    <div id="layout">
      <img id="absent-source">
      <img id="empty-source" src="">
      <img id="whitespace-source" src="   ">
      <img id="required-source" src="required.png">
    </div>
  </body></html>`);
  let source = sizedSource(document, '#layout');
  let inertDecodes = 0;
  for (let id of ['absent-source', 'empty-source', 'whitespace-source']) {
    source.querySelector(`#${id}`).decode = async () => {
      inertDecodes += 1;
      throw new Error(`Inert image source decoded: ${id}.`);
    };
  }
  let requiredDecodes = 0;
  source.querySelector('#required-source').decode = async () => {
    requiredDecodes += 1;
  };

  let host = await prepareDomRasterFrameCapture(source);
  assert.equal(inertDecodes, 0);
  assert.equal(requiredDecodes, 1);
  host.dispose();
});

test('readiness is source-scoped and rejects decoded images without pixels', async () => {
  let { document } = installDocument(`<!doctype html><html><head></head><body>
    <img id="unrelated" src="outside.png">
    <div id="layout"><img id="inside" src="inside.png"></div>
  </body></html>`);
  let source = sizedSource(document, '#layout');
  document.querySelector('#unrelated').decode = () => Promise.reject(new Error('unrelated page image failed'));
  let insideDecodes = 0;
  document.querySelector('#inside').decode = async () => { insideDecodes += 1; };
  let host = await prepareDomRasterFrameCapture(source);
  assert.equal(insideDecodes, 1);
  host.dispose();

  Object.defineProperties(document.querySelector('#inside'), {
    naturalWidth: { configurable: true, value: 0 },
    naturalHeight: { configurable: true, value: 0 },
  });
  await assert.rejects(() => prepareDomRasterFrameCapture(source), /has no decoded pixels/);
});

test('explicit sourceCssSize captures a connected hidden source without mutating it', async () => {
  let { document } = installDocument(`<!doctype html><html><head>
    <style>[hidden] { display: none !important; }</style>
  </head><body><div id="layout" hidden><span>authoritative hidden content</span></div></body></html>`);
  let source = sizedSource(document, '#layout');
  let sourceParent = source.parentElement;
  source.style.display = 'none';
  source.getBoundingClientRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 });

  let host = await prepareDomRasterFrameCapture(source, { sourceCssSize: [320, 180] });
  assert.deepEqual(host.sourceCssSize, [320, 180]);
  assert.equal(source.hasAttribute('hidden'), true);
  assert.equal(source.style.display, 'none');
  assert.equal(source.getBoundingClientRect().width, 0);
  assert.equal(source.getBoundingClientRect().height, 0);
  assert.equal(host.frame.style.width, '320px');
  assert.equal(host.frame.style.height, '180px');
  assert.equal(host.panel.getAttribute('data-dom-raster-root'), 'true');
  assert.equal(host.panel.hasAttribute('hidden'), false);
  assert.equal(host.panel.getBoundingClientRect().width, 320);
  assert.equal(host.panel.getBoundingClientRect().height, 180);
  assert.match(host.html, /authoritative hidden content/);
  assert.match(host.html, /display:\s*block\s*!important/i);
  let frame = await captureDomRasterFrame(host, [640, 360], {
    awaitReady({ source: liveSource }) {
      assert.equal(liveSource.parentElement, sourceParent);
      assert.equal(liveSource.hasAttribute('hidden'), true);
      assert.equal(liveSource.style.display, 'none');
      assert.equal(liveSource.getBoundingClientRect().width, 0);
      assert.equal(liveSource.getBoundingClientRect().height, 0);
    },
  });
  assert.deepEqual(frame.cssSize, [640, 360]);
  assert.match(frame.html, /data-dom-raster-root="true"/);
  assert.match(frame.html, /authoritative hidden content/);
  assert.match(frame.html, /display:\s*block\s*!important/i);
  assert.equal(source.parentElement, sourceParent);
  assert.equal(source.hasAttribute('hidden'), true);
  assert.equal(source.style.display, 'none');
  assert.equal(source.style.width, '320px');
  assert.equal(source.style.height, '180px');
  assert.equal(source.getBoundingClientRect().width, 0);
  assert.equal(source.getBoundingClientRect().height, 0);
  host.dispose();
});

test('explicit sourceCssSize remains authoritative when a measurable source becomes hidden', async () => {
  let { document } = installDocument(`<!doctype html><html><head>
    <style>[hidden] { display: none !important; }</style>
  </head><body><div id="layout"><span>active content</span></div></body></html>`);
  let source = sizedSource(document, '#layout', 320, 180);
  let sourceParent = source.parentElement;
  let host = await prepareDomRasterFrameCapture(source, { sourceCssSize: [320, 180] });
  source.setAttribute('hidden', '');
  source.style.display = 'none';
  source.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  });

  let frame = await captureDomRasterFrame(host, [640, 360], {
    awaitReady({ source: liveSource }) {
      assert.equal(liveSource.parentElement, sourceParent);
      assert.equal(liveSource.hasAttribute('hidden'), true);
      assert.equal(liveSource.style.display, 'none');
      assert.equal(liveSource.getBoundingClientRect().width, 0);
      assert.equal(liveSource.getBoundingClientRect().height, 0);
    },
  });
  assert.deepEqual(frame.cssSize, [640, 360]);
  assert.match(frame.html, /active content/);
  assert.match(frame.html, /display:\s*block\s*!important/i);
  assert.equal(source.parentElement, sourceParent);
  assert.equal(source.hasAttribute('hidden'), true);
  assert.equal(source.style.display, 'none');
  assert.equal(source.style.width, '320px');
  assert.equal(source.style.height, '180px');
  assert.equal(source.getBoundingClientRect().width, 0);
  assert.equal(source.getBoundingClientRect().height, 0);
  host.dispose();
});

test('a hidden or zero-sized live source without sourceCssSize fails closed', async () => {
  let { document } = installDocument('<!doctype html><html><head></head><body><div id="layout"></div></body></html>');
  let source = sizedSource(document, '#layout');
  source.style.display = 'none';
  source.getBoundingClientRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 });
  await assert.rejects(
    () => prepareDomRasterFrameCapture(source, { sourceCssSize: [0, 180] }),
    /positive finite dimensions/,
  );
  await assert.rejects(
    () => prepareDomRasterFrameCapture(source),
    /display:none and zero-sized layouts cannot be captured/,
  );
});

test('capture resizes the live layout before readiness, snapshots the settled state and restores source geometry', async () => {
  let { document } = installDocument('<!doctype html><html><head></head><body><div id="layout"><span id="value">before</span></div></body></html>');
  let source = sizedSource(document, '#layout', 320, 180);
  let host = await prepareDomRasterFrameCapture(source);
  let readyCalls = 0;
  let frame = await captureDomRasterFrame(host, [640, 360], {
    layoutId: 'layout:graph',
    revision: 7,
    awaitReady({ source: liveSource, cssSize, revision }) {
      readyCalls += 1;
      assert.deepEqual(cssSize, [640, 360]);
      assert.equal(revision, 7);
      assert.equal(liveSource.getBoundingClientRect().width, 640);
      liveSource.querySelector('#value').textContent = 'after-fit';
    },
  });
  assert.equal(readyCalls, 1);
  assert.deepEqual(frame.cssSize, [640, 360]);
  assert.equal(frame.layoutId, 'layout:graph');
  assert.equal(frame.revision, 7);
  assert.match(frame.html, /after-fit/);
  assert.equal(source.style.width, '320px');
  assert.equal(source.style.height, '180px');
  assert.equal(host.captureActive, false);
  host.dispose();
});

test('capture prepares capable components shadow-inclusively once before static serialization', async () => {
  let { document } = installDocument('<!doctype html><html><head></head><body><main data-sn-raster-inactive><div id="layout" data-sn-raster-inactive><div id="shadow-host"></div></div></main></body></html>');
  let source = sizedSource(document, '#layout', 320, 180);
  let shadow = source.querySelector('#shadow-host').attachShadow({ mode: 'open' });
  let nested = document.createElement('section');
  nested.setAttribute(DOM_RASTER_INACTIVE_ATTRIBUTE, '');
  shadow.append(nested);
  let calls = [];
  let prepare = (name, viewportCssSize) => async (request) => {
    calls.push({ name, ...request });
    return {
      ready: true,
      attemptId: request.attemptId,
      cssSize: [...request.cssSize],
      viewportCssSize,
      visualRevision: name === 'root' ? 4 : 9,
    };
  };
  source.prepareRasterCapture = prepare('root', [640, 360]);
  nested.prepareRasterCapture = prepare('shadow', [512, 320]);

  let host = await prepareDomRasterFrameCapture(source);
  let frame = await captureDomRasterFrame(host, [640, 360], {
    revision: 12,
    reason: 'late-layout-sync',
  });

  assert.deepEqual(calls.map((entry) => entry.name), ['root', 'shadow']);
  assert.equal(new Set(calls.map((entry) => entry.attemptId)).size, 1);
  assert.deepEqual(calls.map((entry) => entry.cssSize), [[640, 360], [640, 360]]);
  assert.deepEqual(calls.map((entry) => entry.revision), [12, 12]);
  assert.deepEqual(calls.map((entry) => entry.reason), ['late-layout-sync', 'late-layout-sync']);
  assert.ok(calls.every((entry) => entry.signal instanceof AbortSignal));
  assert.doesNotMatch(frame.html, new RegExp(DOM_RASTER_INACTIVE_ATTRIBUTE));
  assert.equal(source.hasAttribute(DOM_RASTER_INACTIVE_ATTRIBUTE), true);
  assert.equal(source.parentElement.hasAttribute(DOM_RASTER_INACTIVE_ATTRIBUTE), true);
  host.dispose();
});

test('capture rejects mismatched or zero-sized component readiness receipts and restores live size', async () => {
  let { document } = installDocument('<!doctype html><html><head></head><body><div id="layout"></div></body></html>');
  let source = sizedSource(document, '#layout', 320, 180);
  let host = await prepareDomRasterFrameCapture(source);
  let validReceipt = (request) => ({
    ready: true,
    attemptId: request.attemptId,
    cssSize: [...request.cssSize],
    viewportCssSize: [300, 160],
    visualRevision: 1,
  });

  source.prepareRasterCapture = async (request) => ({ ...validReceipt(request), attemptId: 'stale-attempt' });
  await assert.rejects(() => captureDomRasterFrame(host, [640, 360]), /attemptId does not match/);
  assert.equal(source.style.width, '320px');
  assert.equal(host.captureActive, false);

  source.prepareRasterCapture = async (request) => ({ ...validReceipt(request), cssSize: [639, 360] });
  await assert.rejects(() => captureDomRasterFrame(host, [640, 360]), /does not match requested/);
  assert.equal(source.style.width, '320px');
  assert.equal(host.captureActive, false);

  source.prepareRasterCapture = async (request) => ({ ...validReceipt(request), viewportCssSize: [0, 160] });
  await assert.rejects(() => captureDomRasterFrame(host, [640, 360]), /positive cssSize and viewportCssSize/);
  assert.equal(source.style.width, '320px');
  assert.equal(host.captureActive, false);
  host.dispose();
});

test('capture aborts an in-flight component preparation and restores live size', async () => {
  let { document } = installDocument('<!doctype html><html><head></head><body><div id="layout"></div></body></html>');
  let source = sizedSource(document, '#layout', 320, 180);
  let host = await prepareDomRasterFrameCapture(source);
  let observedSignal = null;
  source.prepareRasterCapture = ({ signal }) => {
    observedSignal = signal;
    return new Promise(() => {});
  };
  let controller = new AbortController();
  let pending = captureDomRasterFrame(host, [640, 360], { signal: controller.signal });
  await Promise.resolve();
  controller.abort(new Error('component preparation superseded'));

  await assert.rejects(() => pending, /component preparation superseded/);
  assert.equal(observedSignal.aborted, true);
  assert.equal(source.style.width, '320px');
  assert.equal(source.style.height, '180px');
  assert.equal(host.captureActive, false);
  host.dispose();
});

test('capture fails closed if an initially measurable source becomes zero-sized', async () => {
  let { document } = installDocument('<!doctype html><html><head></head><body><div id="layout"></div></body></html>');
  let source = sizedSource(document, '#layout', 320, 180);
  let host = await prepareDomRasterFrameCapture(source);
  await assert.rejects(
    () => captureDomRasterFrame(host, [640, 360], {
      awaitReady({ source: liveSource }) {
        liveSource.getBoundingClientRect = () => ({
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        });
      },
    }),
    /became unmeasurable during capture/,
  );
  assert.equal(source.style.width, '320px');
  assert.equal(source.style.height, '180px');
  assert.equal(host.captureActive, false);
  host.dispose();
});

test('capture abort and required unreadable canvas fail closed without leaving a live host mutation', async () => {
  let { document } = installDocument('<!doctype html><html><head></head><body><div id="layout"><canvas></canvas></div></body></html>');
  let source = sizedSource(document, '#layout', 300, 200);
  source.querySelector('canvas').toDataURL = () => { throw new Error('tainted'); };
  await assert.rejects(() => prepareDomRasterFrameCapture(source), /could not read required canvas pixels: tainted/);

  source.querySelector('canvas').toDataURL = () => 'data:image/png;base64,AAAA';
  let host = await prepareDomRasterFrameCapture(source);
  let controller = new AbortController();
  controller.abort(new Error('capture superseded'));
  await assert.rejects(
    () => captureDomRasterFrame(host, [500, 300], { signal: controller.signal }),
    /capture superseded/,
  );
  assert.equal(source.style.width, '300px');
  assert.equal(source.style.height, '200px');
  assert.equal(host.captureActive, false);
  host.dispose();
});

test('CanvasGraph and NodeCanvas emit one monotonic dirty-ready pair per settled visual revision', async () => {
  let dom = parseHTML('<!doctype html><html><body></body></html>');
  let prior = Object.fromEntries([
    'window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent',
    'MutationObserver', 'customElements', 'getComputedStyle', 'requestAnimationFrame',
    'cancelAnimationFrame', 'CSSStyleSheet',
  ].map((name) => [name, globalThis[name]]));
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.document,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    MutationObserver: dom.window.MutationObserver,
    customElements: dom.window.customElements,
    getComputedStyle: () => ({}),
    requestAnimationFrame: (callback) => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: clearTimeout,
    CSSStyleSheet: class { replaceSync(text) { this.cssText = text; } },
  });
  dom.document.adoptedStyleSheets = [];
  try {
    let [{ CanvasGraph }, { NodeCanvas }] = await Promise.all([
      import('../canvas/CanvasGraph/CanvasGraph.js'),
      import('../canvas/NodeCanvas/NodeCanvas.js'),
    ]);
    for (let Prototype of [CanvasGraph.prototype, NodeCanvas.prototype]) {
      let events = [];
      let surface = Object.assign(Object.create(Prototype), {
        _rasterRevision: 0,
        _rasterDirty: false,
        _rasterReadyFired: false,
        onRasterDirty: (revision) => events.push(['dirty', revision]),
        onRasterReady: (revision) => events.push(['ready', revision]),
      });
      assert.equal(surface._markRasterDirty(), 1);
      assert.equal(surface._markRasterDirty(), 1);
      assert.equal(surface._markRasterReady(), 1);
      assert.equal(surface._markRasterReady(), 1);
      assert.equal(surface._markRasterDirty(), 2);
      assert.equal(surface._markRasterReady(), 2);
      assert.deepEqual(events, [['dirty', 1], ['ready', 1], ['dirty', 2], ['ready', 2]]);
    }

    let fitOptions = null;
    let refreshes = 0;
    let nodeRasterEvents = [];
    let nodeCanvas = Object.assign(Object.create(NodeCanvas.prototype), {
      ref: {
        canvasContainer: {
          getBoundingClientRect: () => ({ width: 896, height: 733 }),
        },
      },
      _viewport: {
        fitView(options) {
          fitOptions = options;
          return true;
        },
      },
      _connRenderer: {
        refreshViewportTransform() {},
        refreshAll() { refreshes += 1; },
      },
      _connectionSettlePasses: 0,
      _connectionSettleFrame: 0,
      _rasterRevision: 0,
      _rasterDirty: false,
      _rasterReadyFired: false,
      _rasterDirtyMetadata: null,
      _rasterReadyWaiters: new Set(),
      onRasterDirty: (revision, metadata) => nodeRasterEvents.push(['dirty', revision, metadata]),
      onRasterReady: (revision, metadata) => nodeRasterEvents.push(['ready', revision, metadata]),
    });
    Object.defineProperty(nodeCanvas, 'isConnected', { configurable: true, value: true });
    let nodeReceipt = await nodeCanvas.prepareRasterCapture({
      attemptId: 'node-attempt',
      cssSize: [932, 766],
      revision: 5,
      reason: 'test',
      signal: new AbortController().signal,
    });
    assert.deepEqual(fitOptions, { animate: false, transition: false });
    assert.equal(refreshes, 3);
    assert.deepEqual(nodeReceipt, {
      ready: true,
      attemptId: 'node-attempt',
      cssSize: [932, 766],
      viewportCssSize: [896, 733],
      visualRevision: 1,
    });
    assert.deepEqual(nodeRasterEvents, [
      ['dirty', 1, { origin: 'raster-capture', attemptId: 'node-attempt' }],
      ['ready', 1, { origin: 'raster-capture', attemptId: 'node-attempt' }],
    ]);

    nodeCanvas._markRasterDirty({ origin: 'raster-capture', attemptId: 'concurrent-capture' });
    nodeCanvas._markRasterDirty();
    nodeCanvas._markRasterReady(nodeCanvas._rasterDirtyMetadata);
    assert.deepEqual(nodeRasterEvents.slice(-3), [
      ['dirty', 2, { origin: 'raster-capture', attemptId: 'concurrent-capture' }],
      ['dirty', 3, null],
      ['ready', 3, null],
    ]);

    let graphCalls = [];
    let graphRasterEvents = [];
    let canvasGraph = Object.assign(Object.create(CanvasGraph.prototype), {
      canvas: {
        width: 0,
        height: 0,
        getBoundingClientRect: () => ({ width: 720, height: 480 }),
      },
      resizeCanvas() {
        graphCalls.push('resize');
        this.canvas.width = 1440;
        this.canvas.height = 960;
      },
      fitView(padding, animate) {
        graphCalls.push(`fit:${padding}:${animate}`);
        return true;
      },
      presentFrame() {
        graphCalls.push('present');
        return true;
      },
      _rasterRevision: 0,
      _rasterDirty: false,
      _rasterReadyFired: false,
      _rasterDirtyMetadata: null,
      onRasterDirty: (revision, metadata) => graphRasterEvents.push(['dirty', revision, metadata]),
      onRasterReady: (revision, metadata) => graphRasterEvents.push(['ready', revision, metadata]),
    });
    let graphReceipt = await canvasGraph.prepareRasterCapture({
      attemptId: 'graph-attempt',
      cssSize: [720, 480],
      revision: 8,
      reason: 'test',
      signal: new AbortController().signal,
    });
    assert.deepEqual(graphCalls, ['resize', 'fit:60:false', 'present']);
    assert.deepEqual(graphReceipt, {
      ready: true,
      attemptId: 'graph-attempt',
      cssSize: [720, 480],
      viewportCssSize: [720, 480],
      visualRevision: 1,
    });
    assert.deepEqual(graphRasterEvents, [
      ['dirty', 1, { origin: 'raster-capture', attemptId: 'graph-attempt' }],
      ['ready', 1, { origin: 'raster-capture', attemptId: 'graph-attempt' }],
    ]);
  } finally {
    for (let [name, value] of Object.entries(prior)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  }
});
