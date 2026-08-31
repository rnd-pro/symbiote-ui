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

function rejectedThenable(error, onAssimilate) {
  return {
    then(_resolve, reject) {
      onAssimilate?.();
      queueMicrotask(() => reject(error));
    },
  };
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

test('audio arbiter paused release preserves resumable speech while relinquishing ownership', async () => {
  let paused = 0;
  let stopped = 0;
  let arbiter = new ShowAudioArbiter();
  let token = await arbiter.acquire({
    id: 'speech',
    kind: 'speech',
    pause: () => { paused += 1; },
    stop: () => { stopped += 1; },
  });

  assert.equal(await arbiter.release({ ...token, reason: 'paused' }), true);
  assert.deepEqual({ paused, stopped, snapshot: arbiter.snapshot }, {
    paused: 1,
    stopped: 0,
    snapshot: null,
  });
});

test('audio arbiter keeps the latest lease when two acquires overlap', async () => {
  let releaseInitial;
  let initialPaused = new Promise((resolve) => { releaseInitial = resolve; });
  let initialPauseCalls = 0;
  let changes = [];
  let arbiter = new ShowAudioArbiter({ onChange: (snapshot) => changes.push(snapshot) });
  await arbiter.acquire({
    id: 'initial',
    kind: 'speech',
    pause: () => {
      initialPauseCalls += 1;
      return initialPaused;
    },
  });

  let staleAcquire = arbiter.acquire({ id: 'stale-media', kind: 'media', pause() {} });
  let staleRejected = assert.rejects(staleAcquire, { name: 'AbortError' });
  let currentSettled = false;
  let currentAcquire = arbiter.acquire({ id: 'current-media', kind: 'media', pause() {} });
  currentAcquire.then(() => { currentSettled = true; }, () => { currentSettled = true; });
  await flushMicrotasks();
  let settledBeforePause = currentSettled;

  releaseInitial();
  let currentToken = await currentAcquire;
  await staleRejected;
  assert.equal(settledBeforePause, false);
  assert.equal(initialPauseCalls, 1);
  assert.deepEqual(arbiter.snapshot, { id: 'current-media', kind: 'media', tokenId: currentToken.id });
  assert.deepEqual(changes.at(-1), { id: 'current-media', kind: 'media', tokenId: currentToken.id });
  await arbiter.release(currentToken);
});

test('audio release still pauses the old source when null notification throws', async () => {
  let pauseCalls = 0;
  let arbiter = new ShowAudioArbiter({
    onChange(snapshot) {
      if (snapshot === null) throw new Error('notification failed');
    },
  });
  let token = await arbiter.acquire({
    id: 'source',
    kind: 'speech',
    pause() { pauseCalls += 1; },
  });

  await assert.rejects(
    arbiter.release({ ...token, reason: 'paused' }),
    (error) => error instanceof AggregateError
      && error.errors.some(({ message }) => message === 'notification failed'),
  );
  assert.equal(pauseCalls, 1);
  assert.equal(arbiter.snapshot, null);
});

test('audio acquire notification failure rolls back its exact lease and aggregates cleanup failures', async () => {
  let installError = new Error('install notification failed');
  let clearError = new Error('clear notification failed');
  let stopError = new Error('source stop failed');
  let calls = [];
  let arbiter = new ShowAudioArbiter({
    onChange(snapshot) {
      if (snapshot) return rejectedThenable(installError);
      calls.push('clear');
      return rejectedThenable(clearError);
    },
  });

  await assert.rejects(
    arbiter.acquire({
      id: 'unreachable',
      kind: 'media',
      stop() {
        calls.push('stop');
        throw stopError;
      },
    }),
    (error) => error instanceof AggregateError
      && error.errors.includes(installError)
      && error.errors.includes(clearError)
      && error.errors.includes(stopError),
  );
  assert.equal(arbiter.snapshot, null);
  assert.deepEqual(calls.sort(), ['clear', 'stop']);
});

test('late acquire notification rejection cannot roll back a newer lease', async () => {
  let rejectFirstNotification;
  let firstNotification = new Promise((_resolve, reject) => { rejectFirstNotification = reject; });
  void firstNotification.catch(() => {});
  let arbiter = new ShowAudioArbiter({
    onChange(snapshot) {
      if (snapshot?.id === 'first') return firstNotification;
      return undefined;
    },
  });

  let firstAcquire = arbiter.acquire({ id: 'first', kind: 'speech', pause() {} });
  await flushMicrotasks();
  let secondToken = await arbiter.acquire({ id: 'second', kind: 'media', pause() {} });
  rejectFirstNotification(new Error('late first notification failure'));

  await assert.rejects(firstAcquire, AggregateError);
  assert.deepEqual(arbiter.snapshot, { id: 'second', kind: 'media', tokenId: secondToken.id });
  await arbiter.release(secondToken);
});

test('exact-token stop upgrades a same-tick preemption without cancelling the successor', async () => {
  let calls = [];
  let arbiter = new ShowAudioArbiter();
  let initialToken = await arbiter.acquire({
    id: 'initial',
    kind: 'speech',
    pause: ({ reason }) => calls.push(['pause', reason]),
    stop: ({ reason }) => calls.push(['stop', reason]),
  });

  let successorAcquire = arbiter.acquire({ id: 'successor', kind: 'media', pause() {} });
  let release = arbiter.release({ ...initialToken, reason: 'stopped' });
  let [successorToken, released] = await Promise.all([successorAcquire, release]);

  assert.equal(released, true);
  assert.deepEqual(calls, [['stop', 'stopped']]);
  assert.deepEqual(arbiter.snapshot, { id: 'successor', kind: 'media', tokenId: successorToken.id });
  await arbiter.release(successorToken);
});

test('native media modes retain muted playback, audio leasing, skip, and exact state restoration', async () => {
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

  let continuous = await controller.play(media, {
    mediaId: 'continuous',
    mode: 'short-inline-continuous',
  });
  assert.deepEqual(continuous, {
    mode: 'short-inline-continuous',
    mediaId: 'continuous',
    muted: true,
    semantics: 'pointer-only',
    nativeControls: false,
    skippable: false,
  });
  assert.equal(controller.activeMode, 'short-inline-continuous');
  assert.equal(media.paused, false);
  assert.equal(media.controls, false);
  assert.equal(arbiter.snapshot, null);
  await controller.stop('continuous-complete');
  assert.equal(media.currentTime, 12);
  assert.equal(media.muted, false);

  let full = await controller.play(media, { mediaId: 'full', mode: 'full-with-media-audio' });
  assert.equal(full.skippable, true);
  assert.equal(full.semantics, 'detail');
  assert.equal(full.nativeControls, true);
  assert.equal(arbiter.snapshot.kind, 'media');
  assert.equal(await controller.skip(), true);
  assert.equal(arbiter.snapshot, null);
  assert.equal(media.controls, false);
});

test('custom media targets receive normalized policy and options and restore their captured state', async () => {
  let calls = [];
  let capturedState = Object.freeze({ page: 3, playing: false });
  let element = listenerTarget({ muted: false, controls: true });
  let operationSignal;
  let target = {
    element,
    captureShowMediaState() {
      calls.push(['capture']);
      return capturedState;
    },
    applyShowMediaPolicy(policy, options) {
      calls.push(['policy', policy, options]);
      element.muted = policy.muted;
      element.controls = policy.nativeControls;
    },
    playShowMedia(options, { signal }) {
      calls.push(['play', options]);
      operationSignal = signal;
      return Promise.resolve();
    },
    pauseShowMedia(reason) {
      calls.push(['pause', reason]);
    },
    restoreShowMediaState(state) {
      calls.push(['restore', state]);
    },
  };
  let arbiter = new ShowAudioArbiter();
  let controller = new ShowMediaController({ audioArbiter: arbiter });

  let result = await controller.play(target, {
    mediaId: 'custom-target',
    mode: 'short-inline-continuous',
    segments: ['0.2', 0.5, 0.8],
    segmentDurationMs: '90',
    keepPlayingDuringQuote: true,
    mutableConsumerField: { shouldNotCrossBoundary: true },
  });

  assert.deepEqual(result, {
    mode: 'short-inline-continuous',
    mediaId: 'custom-target',
    muted: true,
    semantics: 'pointer-only',
    nativeControls: false,
    skippable: false,
  });
  assert.deepEqual(calls[1][1], {
    mode: 'short-inline-continuous',
    muted: true,
    semantics: 'pointer-only',
    nativeControls: false,
    skippable: false,
  });
  assert.deepEqual(calls[2][1].segments, [0.2, 0.5, 0.8]);
  assert.equal(calls[2][1].segmentDurationMs, 90);
  assert.equal(calls[2][1].keepPlayingDuringQuote, true);
  assert.equal(Object.hasOwn(calls[1][2], 'mutableConsumerField'), false);
  assert.equal(Object.hasOwn(calls[2][1], 'mutableConsumerField'), false);
  assert.equal(Object.isFrozen(calls[1][2]), true);
  assert.equal(Object.isFrozen(calls[2][1]), true);
  assert.equal(operationSignal.aborted, false);
  assert.equal(controller.activeMode, 'short-inline-continuous');
  assert.equal(arbiter.snapshot, null);
  assert.equal(element.listenerCount('ended'), 1);

  assert.equal(await controller.stop('quote-complete'), true);
  assert.equal(operationSignal.aborted, true);
  assert.equal(element.listenerCount('ended'), 0);
  assert.deepEqual(calls.slice(-2), [
    ['pause', 'quote-complete'],
    ['restore', capturedState],
  ]);
  assert.equal(controller.activeMode, '');
});

test('media lifecycle awaits stop notifications and rolls back a rejected start notification', async () => {
  let startError = new Error('start receipt failed');
  let releaseStopReceipt;
  let stopReceipt = new Promise((resolve) => { releaseStopReceipt = resolve; });
  let calls = [];
  let rejectStart = true;
  let target = {
    captureShowMediaState() { return Object.freeze({ opaque: true }); },
    applyShowMediaPolicy() {},
    playShowMedia() {},
    pauseShowMedia(reason) { calls.push(['pause', reason]); },
    restoreShowMediaState(state) { calls.push(['restore', state]); },
  };
  let controller = new ShowMediaController({
    onEvent(event) {
      calls.push(['event', event.type]);
      if (event.type === 'show:media-start' && rejectStart) return rejectedThenable(startError);
      if (event.type === 'show:media-stop') return stopReceipt;
      return undefined;
    },
  });

  let rejectedStart = controller.play(target, {
    mediaId: 'receipt-failure',
    mode: 'short-inline-continuous',
  });
  await flushMicrotasks();
  let startSettled = false;
  rejectedStart.then(() => { startSettled = true; }, () => { startSettled = true; });
  await flushMicrotasks();
  assert.equal(startSettled, false, 'start rejection waits for cleanup and its stop receipt');
  releaseStopReceipt();
  await assert.rejects(
    rejectedStart,
    (error) => error instanceof AggregateError && error.errors.includes(startError),
  );
  assert.equal(controller.activeMode, '');
  assert.deepEqual(calls.slice(0, 4), [
    ['event', 'show:media-start'],
    ['pause', 'start-notification-failed'],
    ['restore', { opaque: true }],
    ['event', 'show:media-stop'],
  ]);

  rejectStart = false;
  stopReceipt = new Promise((resolve) => { releaseStopReceipt = resolve; });
  await controller.play(target, { mediaId: 'stop-receipt', mode: 'short-inline-continuous' });
  let stopSettled = false;
  let stopping = controller.stop('receipt-gate');
  stopping.then(() => { stopSettled = true; }, () => { stopSettled = true; });
  await flushMicrotasks();
  assert.equal(stopSettled, false, 'stop waits for its asynchronous terminal receipt');
  releaseStopReceipt();
  await stopping;
});

test('native wrapper pins one element for capture, playback, result, and restoration', async () => {
  let target;
  let firstPauseCalls = 0;
  let secondPauseCalls = 0;
  let first = listenerTarget({
    currentTime: 7,
    paused: true,
    muted: false,
    volume: 0.6,
    playbackRate: 1.2,
    controls: true,
    play() {
      this.paused = false;
      target.element = second;
    },
    pause() {
      firstPauseCalls += 1;
      this.paused = true;
    },
  });
  let second = listenerTarget({
    currentTime: 99,
    paused: true,
    muted: false,
    volume: 0.25,
    playbackRate: 0.5,
    controls: true,
    play() { this.paused = false; },
    pause() {
      secondPauseCalls += 1;
      this.paused = true;
    },
  });
  target = { element: first };
  let controller = new ShowMediaController();

  let result = await controller.play(target, {
    mediaId: 'pinned-native',
    mode: 'short-inline-continuous',
    startMs: 1000,
  });
  assert.equal(result.muted, true);
  await controller.stop('restore-pinned');

  assert.ok(firstPauseCalls >= 1);
  assert.equal(first.currentTime, 7);
  assert.equal(first.paused, true);
  assert.equal(first.muted, false);
  assert.equal(first.volume, 0.6);
  assert.equal(first.playbackRate, 1.2);
  assert.equal(first.controls, true);
  assert.equal(secondPauseCalls, 0);
  assert.deepEqual({
    currentTime: second.currentTime,
    paused: second.paused,
    muted: second.muted,
    volume: second.volume,
    playbackRate: second.playbackRate,
    controls: second.controls,
  }, {
    currentTime: 99,
    paused: true,
    muted: false,
    volume: 0.25,
    playbackRate: 0.5,
    controls: true,
  });
});

function boundedCustomMediaTarget(name) {
  let started;
  let startedPromise = new Promise((resolve) => { started = resolve; });
  let calls = [];
  let signal;
  return {
    name,
    calls,
    started: startedPromise,
    captureShowMediaState() {
      calls.push(['capture']);
      return Object.freeze({ name, frame: 1 });
    },
    applyShowMediaPolicy() {
      calls.push(['policy']);
    },
    playShowMedia(options, context) {
      calls.push(['play', options.mode]);
      signal = context.signal;
      started();
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    },
    pauseShowMedia(reason) {
      calls.push(['pause', reason]);
    },
    restoreShowMediaState(state) {
      calls.push(['restore', state]);
    },
    get signal() { return signal; },
  };
}

test('stopping aborts a pending bounded custom media choreography before restoration', async () => {
  let target = boundedCustomMediaTarget('stopped');
  let controller = new ShowMediaController();
  let pending = controller.play(target, {
    mediaId: 'bounded',
    mode: 'short-muted-montage',
    frames: [1, 4, 7],
    frameHoldMs: 40,
    finalFrame: 9,
  });
  await target.started;
  let rejected = assert.rejects(pending, { name: 'AbortError' });

  assert.equal(await controller.stop('stopped-by-owner'), true);
  await rejected;
  assert.equal(target.signal.aborted, true);
  assert.deepEqual(target.calls.slice(-2), [
    ['pause', 'stopped-by-owner'],
    ['restore', { name: 'stopped', frame: 1 }],
  ]);
});

test('replacement aborts the stale bounded target before starting the next target', async () => {
  let stale = boundedCustomMediaTarget('stale');
  let events = [];
  let controller = new ShowMediaController({ onEvent: (event) => events.push(event) });
  let stalePending = controller.play(stale, {
    mediaId: 'stale',
    mode: 'short-muted-montage',
    segments: [0.2, 0.5, 0.8],
    segmentDurationMs: 40,
  });
  await stale.started;
  let rejected = assert.rejects(stalePending, { name: 'AbortError' });

  let replacement = listenerTarget({
    currentTime: 0,
    paused: true,
    muted: false,
    volume: 1,
    playbackRate: 1,
    controls: true,
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
  });
  let result = await controller.play(replacement, {
    mediaId: 'replacement',
    mode: 'short-inline-continuous',
  });

  await rejected;
  assert.equal(stale.signal.aborted, true);
  assert.deepEqual(stale.calls.slice(-2), [
    ['pause', 'replaced'],
    ['restore', { name: 'stale', frame: 1 }],
  ]);
  assert.equal(result.mediaId, 'replacement');
  assert.equal(controller.activeMode, 'short-inline-continuous');
  assert.deepEqual(events.map(({ type, mediaId, reason }) => ({ type, mediaId, reason })), [
    { type: 'show:media-stop', mediaId: 'stale', reason: 'replaced' },
    { type: 'show:media-start', mediaId: 'replacement', reason: undefined },
  ]);
  await controller.stop();
});

test('stopping during an in-flight audio acquisition releases a late media lease', async () => {
  let releaseSpeech;
  let speechPaused = new Promise((resolve) => { releaseSpeech = resolve; });
  let arbiter = new ShowAudioArbiter();
  await arbiter.acquire({ id: 'speech', kind: 'speech', pause: () => speechPaused });
  let media = listenerTarget({
    currentTime: 0,
    paused: true,
    muted: false,
    volume: 1,
    playbackRate: 1,
    controls: false,
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
  });
  let controller = new ShowMediaController({ audioArbiter: arbiter });
  let pending = controller.play(media, { mediaId: 'late-lease', mode: 'full-with-media-audio' });
  await flushMicrotasks();
  let rejected = assert.rejects(pending, { name: 'AbortError' });

  let stopping = controller.stop('stopped-during-acquire');
  releaseSpeech();
  assert.equal(await stopping, true);
  await rejected;
  assert.equal(arbiter.snapshot, null);
  assert.equal(media.controls, false);
  assert.equal(media.muted, false);
});

test('a successor waits for an in-flight restore before applying its policy', async () => {
  let releaseRestore;
  let restoreGate = new Promise((resolve) => { releaseRestore = resolve; });
  let restoreStarted;
  let restoreStartedPromise = new Promise((resolve) => { restoreStarted = resolve; });
  let policies = [];
  let restoreContext;
  let policyContexts = [];
  let target = {
    captureShowMediaState(context) {
      return Object.freeze({ operationId: context?.operationId || null });
    },
    applyShowMediaPolicy(policy, options, context) {
      policies.push(options.mediaId);
      policyContexts.push(context);
    },
    playShowMedia() { return Promise.resolve(); },
    pauseShowMedia() {},
    restoreShowMediaState(state, context) {
      restoreContext = context;
      restoreStarted();
      return restoreGate;
    },
  };
  let controller = new ShowMediaController();
  await controller.play(target, { mediaId: 'first', mode: 'short-inline-continuous' });

  let stopping = controller.stop('slow-restore');
  await restoreStartedPromise;
  let successor = controller.play(target, { mediaId: 'second', mode: 'short-inline-continuous' });
  await flushMicrotasks();
  let policyRanDuringRestore = policies.includes('second');
  releaseRestore();
  await stopping;
  await successor;

  assert.equal(policyRanDuringRestore, false);
  assert.deepEqual(policies, ['first', 'second']);
  assert.equal(restoreContext.signal.aborted, true);
  assert.equal(policyContexts[1].signal.aborted, false);
  assert.notEqual(restoreContext.operationId, policyContexts[1].operationId);
  await controller.stop();
});

test('cleanup attempts pause, lease release, and opaque restore independently', async () => {
  let calls = [];
  let arbiter = {
    async acquire() {
      return Object.freeze({ id: 1, sourceId: 'cleanup-media', kind: 'media' });
    },
    async release() {
      calls.push('release');
      throw new Error('release failed');
    },
  };
  let target = {
    captureShowMediaState() { return Object.freeze({ opaque: 'captured' }); },
    applyShowMediaPolicy() {},
    playShowMedia() { return Promise.resolve(); },
    pauseShowMedia() {
      calls.push('pause');
      throw new Error('pause failed');
    },
    restoreShowMediaState(state) {
      calls.push(['restore', state]);
    },
  };
  let controller = new ShowMediaController({ audioArbiter: arbiter });
  await controller.play(target, { mediaId: 'cleanup-media', mode: 'full-with-media-audio' });

  await assert.rejects(
    controller.stop('cleanup-test'),
    (error) => error instanceof AggregateError
      && error.errors.some(({ message }) => message === 'pause failed')
      && error.errors.some(({ message }) => message === 'release failed'),
  );
  assert.deepEqual(calls, [
    'pause',
    'release',
    ['restore', { opaque: 'captured' }],
  ]);
  assert.equal(controller.activeMode, '');
});

test('ended cleanup failures surface as media error events without a dangling rejection', async () => {
  let events = [];
  let reporterAssimilated = false;
  let element = listenerTarget({ muted: false, controls: false });
  let target = {
    element,
    captureShowMediaState() { return Object.freeze({ opaque: true }); },
    applyShowMediaPolicy() {},
    playShowMedia() { return Promise.resolve(); },
    pauseShowMedia() {},
    restoreShowMediaState() { throw new Error('ended restore failed'); },
  };
  let controller = new ShowMediaController({
    onEvent(event) {
      events.push(event);
      if (event.type === 'show:media-error') {
        return rejectedThenable(new Error('error receipt rejected'), () => { reporterAssimilated = true; });
      }
      return undefined;
    },
  });
  await controller.play(target, { mediaId: 'ended-cleanup', mode: 'short-inline-continuous' });

  element.emit('ended');
  await flushMicrotasks(12);
  let errorEvent = events.find(({ type }) => type === 'show:media-error');
  assert.equal(errorEvent?.phase, 'cleanup');
  assert.equal(errorEvent?.mediaId, 'ended-cleanup');
  assert.equal(errorEvent?.reason, 'ended');
  assert.equal(errorEvent?.error instanceof AggregateError, true);
  assert.equal(reporterAssimilated, true);
});

test('native restoration resumes media that was playing before Show playback', async () => {
  let playCalls = 0;
  let pauseCalls = 0;
  let media = listenerTarget({
    currentTime: 7,
    paused: false,
    muted: false,
    volume: 0.8,
    playbackRate: 1.1,
    controls: true,
    play() {
      playCalls += 1;
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      pauseCalls += 1;
      this.paused = true;
    },
  });
  let controller = new ShowMediaController();
  await controller.play(media, { mediaId: 'already-playing', mode: 'short-inline-continuous' });
  await controller.stop('restore-playing');

  assert.equal(media.paused, false);
  assert.equal(playCalls, 2);
  assert.ok(pauseCalls >= 1);
  assert.equal(media.currentTime, 7);
  assert.equal(media.controls, true);
});

test('custom capture and restore hooks must be paired before replacing active media', async () => {
  let current = listenerTarget({
    currentTime: 0,
    paused: true,
    muted: false,
    volume: 1,
    playbackRate: 1,
    controls: true,
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
  });
  let halfElement = listenerTarget({ muted: false, controls: true });
  let policyCalls = 0;
  let halfTarget = {
    element: halfElement,
    captureShowMediaState() { return Object.freeze({ opaque: true }); },
    applyShowMediaPolicy() { policyCalls += 1; },
    playShowMedia() { return Promise.resolve(); },
  };
  let controller = new ShowMediaController();
  await controller.play(current, { mediaId: 'current', mode: 'short-inline-continuous' });

  let rejection = null;
  try {
    await controller.play(halfTarget, { mediaId: 'half-hook', mode: 'short-inline-continuous' });
  } catch (error) {
    rejection = error;
  }
  let activeAfterAttempt = controller.activeMode;
  let pinnedListeners = halfElement.listenerCount('ended');
  await controller.stop();

  assert.equal(rejection instanceof TypeError, true);
  assert.equal(activeAfterAttempt, 'short-inline-continuous');
  assert.equal(policyCalls, 0);
  assert.equal(pinnedListeners, 0);
});
