import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

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
});
