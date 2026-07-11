import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

test('CanvasGraph exposes clamped absolute viewport projection', async () => {
  let { window } = parseHTML('<html><body></body></html>');
  let globalKeys = ['window', 'document', 'HTMLElement', 'customElements', 'CustomEvent', 'Event', 'EventTarget', 'Node', 'CSSStyleSheet'];
  let descriptors = new Map(globalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (let key of globalKeys.slice(0, -1)) {
    Object.defineProperty(globalThis, key, { configurable: true, value: window[key] || window });
  }
  Object.defineProperty(globalThis, 'CSSStyleSheet', {
    configurable: true,
    value: class CSSStyleSheet { replaceSync() {} },
  });
  try {
    let { CanvasGraph } = await import('../canvas/CanvasGraph/CanvasGraph.js');
    let graph = Object.create(CanvasGraph.prototype);
    let wakeCount = 0;
    graph.canvas = { getBoundingClientRect: () => ({ width: 800, height: 600 }) };
    graph.zoom = 0.5;
    graph.panX = 10;
    graph.panY = 20;
    graph._targetZoom = 0.5;
    graph._targetPanX = null;
    graph._targetPanY = null;
    graph._clampZoom = (zoom) => Math.max(0.25, Math.min(2, zoom));
    graph._wakeLoop = () => { wakeCount += 1; };

    assert.deepEqual(graph.getViewport(), { zoom: 0.5, panX: 10, panY: 20 });
    assert.deepEqual(graph.setViewport({ zoom: 4, panX: 100, panY: 120 }), {
      zoom: 2,
      panX: 100,
      panY: 120,
    });
    assert.equal(graph._targetPanX, null);
    assert.equal(graph._targetPanY, null);
    assert.equal(wakeCount, 1);

    assert.deepEqual(graph.setViewport({ zoom: 1.25, panX: 40, panY: 60, animate: true }), {
      zoom: 2,
      panX: 100,
      panY: 120,
    });
    assert.equal(graph._targetZoom, 1.25);
    assert.equal(graph._targetPanX, 40);
    assert.equal(graph._targetPanY, 60);
    assert.equal(wakeCount, 2);
    assert.throws(() => graph.setViewport({ zoom: Number.NaN, panX: 0, panY: 0 }), /finite zoom/);
  } finally {
    for (let key of globalKeys) {
      let descriptor = descriptors.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
