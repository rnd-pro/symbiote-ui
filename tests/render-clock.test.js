import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

import { installRenderClock, renderNow } from '../core/render-clock.js';

test('render clock uses the live performance clock when no clock is installed', () => {
  let originalPerformance = globalThis.performance;
  Object.defineProperty(globalThis, 'performance', {
    configurable: true,
    value: { now: () => 123.5 },
  });
  try {
    assert.equal(renderNow(), 123.5);
  } finally {
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      value: originalPerformance,
    });
  }
});

test('render clock uses the installed clock until its disposer runs', () => {
  let dispose = installRenderClock({ now: () => 2400 });
  assert.equal(renderNow(), 2400);
  dispose();
  assert.notEqual(renderNow(), 2400);
});

test('render clock rejects invalid contracts and non-finite installed values', () => {
  assert.throws(() => installRenderClock({}), /now/);
  let dispose = installRenderClock({ now: () => Number.NaN });
  try {
    assert.throws(() => renderNow(), /finite/);
  } finally {
    dispose();
  }
});

test('render clock is public from Node-safe entrypoints', async () => {
  let core = await import('../core/index.js');
  let root = await import('../index.js');
  assert.equal(core.installRenderClock, installRenderClock);
  assert.equal(core.renderNow, renderNow);
  assert.equal(root.installRenderClock, installRenderClock);
  assert.equal(root.renderNow, renderNow);
});

test('CanvasGraph visual effect timestamps use the shared render clock', async () => {
  let source = await readFile(new URL('../canvas/CanvasGraph/CanvasGraph.js', import.meta.url), 'utf8');
  assert.match(source, /import \{ renderNow \} from '..\/..\/core\/render-clock\.js';/);
  assert.match(source, /pulseNode\([\s\S]*?let now = renderNow\(\);/);
  assert.match(source, /_queuePulseNow\([\s\S]*?startTime = renderNow\(\)/);
  assert.match(source, /_drawTransitionMarkers\([\s\S]*?let now = renderNow\(\);/);
  assert.match(source, /const now = renderNow\(\);[\s\S]*?this\._pulses = this\._pulses\.filter/);
  assert.match(source, /ip\.startTime = renderNow\(\);/);
  assert.match(source, /const elapsed = renderNow\(\) - ip\.startTime;/);
  assert.match(source, /let now = Number\.isFinite\(options\.startTime\) \? options\.startTime : renderNow\(\);/);
  assert.match(source, /clearPulses\(\) \{/);
  assert.match(source, /marker\.pendingPulse = null;/);
});

test('CanvasGraph pulse APIs honor explicit seek time and clear queued effects', async () => {
  let { window } = parseHTML('<html><body></body></html>');
  let globalKeys = ['window', 'document', 'HTMLElement', 'customElements', 'CustomEvent', 'Event', 'EventTarget', 'Node', 'CSSStyleSheet'];
  let descriptors = new Map(globalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (let key of globalKeys.slice(0, -1)) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: window[key] || window,
    });
  }
  Object.defineProperty(globalThis, 'CSSStyleSheet', {
    configurable: true,
    value: class CSSStyleSheet { replaceSync() {} },
  });
  let disposeClock = installRenderClock({ now: () => 700 });
  try {
    let { CanvasGraph } = await import('../canvas/CanvasGraph/CanvasGraph.js');
    let graph = Object.create(CanvasGraph.prototype);
    let wakes = 0;
    graph._pulses = [];
    graph._transitionMarkers = [{
      toId: 'deferred',
      startTime: 500,
      duration: 400,
      pendingPulse: { duration: 600, waves: 1 },
    }];
    graph._wakeLoop = () => { wakes += 1; };

    graph.pulseNode('explicit', 900, { startTime: 100, deferUntilTransition: false });
    graph.pulseNode('clock', 1200, { deferUntilTransition: false });

    assert.deepEqual(graph._pulses.map(({ id, startTime, duration }) => ({ id, startTime, duration })), [
      { id: 'explicit', startTime: 100, duration: 900 },
      { id: 'clock', startTime: 700, duration: 1200 },
    ]);
    assert.equal(graph.clearPulses(), 3);
    assert.deepEqual(graph._pulses, []);
    assert.equal(graph._transitionMarkers[0].pendingPulse, null);
    assert.equal(wakes, 3);
  } finally {
    disposeClock();
    for (let key of globalKeys) {
      let descriptor = descriptors.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('CanvasGraph presents externally driven frames without leaving a stale loop', async () => {
  let { window } = parseHTML('<html><body></body></html>');
  let globalKeys = ['window', 'document', 'HTMLElement', 'customElements', 'CustomEvent', 'Event', 'EventTarget', 'Node', 'CSSStyleSheet', 'requestAnimationFrame', 'cancelAnimationFrame'];
  let descriptors = new Map(globalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (let key of globalKeys.slice(0, -3)) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: window[key] || window,
    });
  }
  Object.defineProperty(globalThis, 'CSSStyleSheet', {
    configurable: true,
    value: class CSSStyleSheet { replaceSync() {} },
  });
  let canceled = [];
  let nextFrameId = 100;
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: () => ++nextFrameId,
  });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    configurable: true,
    value: (id) => canceled.push(id),
  });
  try {
    let { CanvasGraph } = await import('../canvas/CanvasGraph/CanvasGraph.js');
    let graph = Object.create(CanvasGraph.prototype);
    let draws = 0;
    graph.canvas = { width: 640, height: 360 };
    graph._animationFrame = 42;
    graph._loopRunning = true;
    graph._idleFrames = 8;
    graph._inDraw = false;
    graph._externalFrameDrive = false;
    graph.draw = () => { draws += 1; return true; };

    assert.equal(graph.presentFrame(), true);
    assert.deepEqual(canceled, [42]);
    assert.equal(draws, 1);
    assert.equal(graph._animationFrame, 101);
    assert.equal(graph._loopRunning, true);
    assert.equal(graph._externalFrameDrive, false);

    assert.equal(graph.setFrameDriver('external'), 'external');
    assert.deepEqual(canceled, [42, 101]);
    assert.equal(graph.presentFrame(), true);
    assert.equal(draws, 2);
    assert.equal(graph._externalFrameDrive, true);
    assert.equal(graph._loopRunning, false);
    assert.throws(() => graph.setFrameDriver('timer'), /frame driver/);

    graph._inDraw = true;
    assert.equal(graph.presentFrame(), false);
    assert.equal(draws, 2);
    graph._inDraw = false;
    graph.canvas = { width: 0, height: 0 };
    assert.equal(graph.presentFrame(), false);

    graph._nodeAppearances = new Map([
      ['node', { startTime: 0, duration: 900 }],
      ['future', { startTime: 500, duration: 900 }],
    ]);
    assert.equal(graph._hasActiveNodeAppearances(100), true);
    assert.equal(graph._hasActiveNodeAppearances(2000), false);
    assert.deepEqual(graph._resolveNodeAppearance('node', 12000), { alpha: 1, scale: 1 });
    let rewound = graph._resolveNodeAppearance('node', 100);
    assert.ok(rewound.alpha > 0 && rewound.alpha < 1);
    assert.ok(rewound.scale > 0 && rewound.scale < 1);
    assert.equal(graph._nodeAppearances.has('node'), true);
  } finally {
    for (let key of globalKeys) {
      let descriptor = descriptors.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('CanvasGraph node appearance remains seekable after a later frame', async () => {
  let source = await readFile(new URL('../canvas/CanvasGraph/CanvasGraph.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /_nodeAppearances\.delete\(nodeId\)/);
  assert.match(source, /if \(elapsed >= marker\.duration\) \{\s+return \{ alpha: 1, scale: 1 \};/);
});
