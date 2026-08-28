import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ShowAudioArbiter } from '../chat/show-audio.js';
import { ShowMediaController } from '../chat/show-media.js';
import {
  waitForShowDocumentReady,
  waitForShowDomReadiness,
  waitForShowElement,
  waitForShowMediaReady,
  waitForShowVisualSettlement,
} from '../chat/show-readiness.js';

function eventTarget(initial = {}) {
  let listeners = new Map();
  return {
    ...initial,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    emit(type) { listeners.get(type)?.({ type }); },
  };
}

function listenerTarget(initial = {}) {
  let listeners = new Map();
  return {
    ...initial,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    emit(type) {
      for (let fn of [...(listeners.get(type) || [])]) fn({ type, target: this });
    },
    listenerCount(type) { return listeners.get(type)?.size || 0; },
  };
}

function frameScheduler() {
  let nextId = 1;
  let pending = new Map();
  let cancelled = [];
  return {
    request(callback) {
      let id = nextId;
      nextId += 1;
      pending.set(id, callback);
      return id;
    },
    cancel(id) {
      cancelled.push(id);
      pending.delete(id);
    },
    step(timestamp) {
      let callbacks = [...pending.values()];
      pending.clear();
      for (let callback of callbacks) callback(timestamp);
    },
    get size() { return pending.size; },
    get cancelled() { return [...cancelled]; },
  };
}

async function flushMicrotasks(count = 6) {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
}

test('DOM readiness waits for document, font, target mutation, and media data', async () => {
  let doc = eventTarget({ readyState: 'loading', fonts: { ready: Promise.resolve() }, documentElement: {} });
  let documentReady = waitForShowDocumentReady(doc);
  doc.emit('DOMContentLoaded');
  await documentReady;

  let found = null;
  let observerCallback;
  class Observer {
    constructor(callback) { observerCallback = callback; }
    observe() {}
    disconnect() {}
  }
  let targetReady = waitForShowElement({ documentElement: {}, querySelector: () => found }, '#target', { MutationObserver: Observer });
  found = { id: 'target' };
  observerCallback();
  assert.equal((await targetReady).id, 'target');

  let media = eventTarget({ readyState: 0 });
  let mediaReady = waitForShowMediaReady(media);
  media.readyState = 2;
  media.emit('loadeddata');
  assert.equal(await mediaReady, media);
});

test('DOM readiness waits through moving frames and the latest scrollend before resolving', async () => {
  let scheduler = frameScheduler();
  let scrollOptions;
  let targetTop = 160;
  let scroller = listenerTarget({
    id: 'scroller',
    scrollTop: 0,
    scrollLeft: 0,
    onscrollend: null,
    parentElement: null,
  });
  let doc = listenerTarget({
    readyState: 'complete',
    fonts: { ready: Promise.resolve() },
    scrollingElement: scroller,
    defaultView: {
      requestAnimationFrame: (callback) => scheduler.request(callback),
      cancelAnimationFrame: (id) => scheduler.cancel(id),
    },
  });
  let target = listenerTarget({
    ownerDocument: doc,
    parentElement: scroller,
    getBoundingClientRect() {
      return { left: 20, top: targetTop, width: 80, height: 30, right: 100, bottom: targetTop + 30 };
    },
    scrollIntoView(options) { scrollOptions = options; },
  });

  let settled = false;
  let pending = waitForShowDomReadiness({ document: doc, target });
  pending.then(() => { settled = true; });
  await flushMicrotasks();
  assert.equal(scheduler.size, 1);

  for (let frame = 1; frame <= 5; frame += 1) {
    scroller.scrollTop = frame * 20;
    targetTop -= 20;
    scroller.emit('scroll');
    scheduler.step(frame * 16);
    await Promise.resolve();
    if (frame === 2) assert.equal(settled, false, 'two frames do not settle an active smooth scroll');
  }
  scheduler.step(96);
  await Promise.resolve();
  assert.equal(settled, false, 'stable geometry alone cannot precede native scrollend after actual scrolling');
  scroller.emit('scrollend');
  scheduler.step(112);
  await Promise.resolve();
  scroller.scrollTop = 105;
  targetTop -= 5;
  scroller.emit('scroll');
  scheduler.step(128);
  await Promise.resolve();
  scheduler.step(144);
  await Promise.resolve();
  assert.equal(settled, false, 'new movement invalidates an earlier scrollend');
  scroller.emit('scrollend');
  scheduler.step(160);
  await Promise.resolve();
  scheduler.step(176);
  let result = await pending;

  assert.equal(result.target, target);
  assert.deepEqual(scrollOptions, { block: 'center', inline: 'nearest', behavior: 'smooth' });
  assert.equal(result.visualSettlement.status, 'settled');
  assert.equal(result.visualSettlement.motion, 'scroll');
  assert.equal(result.visualSettlement.reason, 'scrollend-and-stable');
  assert.equal(result.visualSettlement.nativeScrollEndSupported, true);
  assert.equal(result.visualSettlement.scrollEndEvents, 2);
  assert.ok(result.visualSettlement.movingFrames >= 5);
  assert.equal(result.visualSettlement.targetRect.top, 55);
  assert.equal(result.visualSettlement.scrollOffsets[0].top, 105);
});

test('visual settlement covers no-motion and transform-only motion without inventing scroll activity', async () => {
  let scheduler = frameScheduler();
  let top = 40;
  let doc = listenerTarget({
    readyState: 'complete',
    defaultView: {
      requestAnimationFrame: (callback) => scheduler.request(callback),
      cancelAnimationFrame: (id) => scheduler.cancel(id),
    },
  });
  let target = listenerTarget({
    ownerDocument: doc,
    parentElement: null,
    getBoundingClientRect() {
      return { left: 10, top, width: 30, height: 20, right: 40, bottom: top + 20 };
    },
  });

  let noMotion = waitForShowVisualSettlement(target, { document: doc });
  await flushMicrotasks();
  scheduler.step(16);
  await Promise.resolve();
  scheduler.step(32);
  let noMotionReceipt = await noMotion;
  assert.equal(noMotionReceipt.motion, 'none');
  assert.equal(noMotionReceipt.reason, 'stable');

  let transformed = waitForShowVisualSettlement(target, { document: doc });
  await flushMicrotasks();
  for (let frame = 1; frame <= 3; frame += 1) {
    top += 5;
    scheduler.step(32 + frame * 16);
    await Promise.resolve();
  }
  scheduler.step(96);
  await Promise.resolve();
  scheduler.step(112);
  let transformReceipt = await transformed;
  assert.equal(transformReceipt.motion, 'transform');
  assert.equal(transformReceipt.reason, 'stable');
  assert.equal(transformReceipt.scrollEvents, 0);
  assert.equal(transformReceipt.scrollEndEvents, 0);
  assert.equal(transformReceipt.targetRect.top, 55);
});

test('visual settlement aborts one owned frame and removes scroll listeners', async () => {
  let scheduler = frameScheduler();
  let controller = new AbortController();
  let scroller = listenerTarget({ scrollTop: 0, scrollLeft: 0, onscrollend: null, parentElement: null });
  let doc = listenerTarget({
    readyState: 'complete',
    scrollingElement: scroller,
    defaultView: {
      requestAnimationFrame: (callback) => scheduler.request(callback),
      cancelAnimationFrame: (id) => scheduler.cancel(id),
    },
  });
  let target = listenerTarget({
    ownerDocument: doc,
    parentElement: scroller,
    getBoundingClientRect() { return { left: 0, top: 0, width: 10, height: 10, right: 10, bottom: 10 }; },
  });

  let pending = waitForShowVisualSettlement(target, { document: doc, signal: controller.signal });
  await Promise.resolve();
  assert.equal(scroller.listenerCount('scroll'), 1);
  assert.equal(scroller.listenerCount('scrollend'), 1);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(scroller.listenerCount('scroll'), 0);
  assert.equal(scroller.listenerCount('scrollend'), 0);
  assert.equal(scheduler.size, 0);
  assert.equal(scheduler.cancelled.length, 1);
});

test('visual settlement reports unsupported native scroll completion without a timer fallback', async () => {
  let scheduler = frameScheduler();
  let scroller = listenerTarget({ scrollTop: 0, scrollLeft: 0, parentElement: null });
  let doc = listenerTarget({
    readyState: 'complete',
    scrollingElement: scroller,
    defaultView: {
      requestAnimationFrame: (callback) => scheduler.request(callback),
      cancelAnimationFrame: (id) => scheduler.cancel(id),
    },
  });
  let target = listenerTarget({
    ownerDocument: doc,
    parentElement: scroller,
    getBoundingClientRect() { return { left: 0, top: 20, width: 10, height: 10, right: 10, bottom: 30 }; },
  });

  let pending = waitForShowVisualSettlement(target, { document: doc });
  await flushMicrotasks();
  scroller.scrollTop = 10;
  scheduler.step(16);
  await assert.rejects(pending, { code: 'scrollend-unavailable' });
  assert.equal(scheduler.size, 0);
});

test('audio arbiter preempts speech before granting audible media', async () => {
  let paused = [];
  let arbiter = new ShowAudioArbiter();
  await arbiter.acquire({ id: 'speech', kind: 'speech', pause: () => paused.push('speech') });
  let mediaToken = await arbiter.acquire({ id: 'media', kind: 'media', pause: () => paused.push('media') });
  assert.deepEqual(paused, ['speech']);
  assert.deepEqual(arbiter.snapshot, { id: 'media', kind: 'media', tokenId: mediaToken.id });
});

test('media modes enforce muted montage, skippable full playback, and exact state restoration', async () => {
  let arbiter = new ShowAudioArbiter();
  let media = eventTarget({
    currentTime: 12,
    paused: true,
    muted: false,
    volume: 0.7,
    playbackRate: 1.25,
    controls: false,
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
  });
  let controller = new ShowMediaController({ audioArbiter: arbiter });
  let montage = await controller.play(media, { mediaId: 'montage', mode: 'short-muted-montage', startMs: 1000 });
  assert.equal(montage.muted, true);
  assert.equal(montage.skippable, false);
  assert.equal(montage.semantics, 'pointer-only');
  assert.equal(montage.nativeControls, false);
  await controller.stop();
  assert.equal(media.currentTime, 12);
  assert.equal(media.muted, false);
  assert.equal(media.volume, 0.7);
  assert.equal(media.playbackRate, 1.25);

  let full = await controller.play(media, { mediaId: 'full', mode: 'full-with-media-audio' });
  assert.equal(full.skippable, true);
  assert.equal(full.semantics, 'detail');
  assert.equal(full.nativeControls, true);
  assert.equal(arbiter.snapshot.kind, 'media');
  assert.equal(await controller.skip(), true);
  assert.equal(arbiter.snapshot, null);
  assert.equal(media.controls, false);
});
