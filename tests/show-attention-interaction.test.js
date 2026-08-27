import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ShowAttentionController } from '../chat/show-attention.js';
import {
  isMeaningfulShowInteraction,
  monitorMeaningfulShowInteractions,
} from '../chat/show-interaction.js';
import { ShowActionLifecycle } from '../chat/show-action-lifecycle.js';
import { waitForShowDomReadiness } from '../chat/show-readiness.js';

function createFrameScheduler() {
  let nextId = 0;
  let callbacks = new Map();
  let cancelled = [];
  return {
    view: {
      requestAnimationFrame(callback) {
        let id = ++nextId;
        callbacks.set(id, callback);
        return id;
      },
      cancelAnimationFrame(id) {
        cancelled.push(id);
        callbacks.delete(id);
      },
    },
    step(timestamp) {
      let frame = [...callbacks.values()];
      callbacks.clear();
      for (let callback of frame) callback(timestamp);
    },
    get pending() { return callbacks.size; },
    get cancelled() { return [...cancelled]; },
  };
}

function animatedTarget(view, id) {
  return { id, ownerDocument: { defaultView: view } };
}

test('attention controller serializes frame selection and click while markers accumulate', () => {
  let calls = [];
  let selectionClears = 0;
  let cursor = {
    clear: () => calls.push('clear-transient'),
    clearAccumulatedAnnotations: () => calls.push('clear-markers'),
    presentFocusFrame: (_target, frame) => ({ presented: true, mode: frame.mode }),
    presentClickFrame: () => ({ presented: true, mode: 'click' }),
    presentAnnotationFrame: (_target, annotation, frame) => ({ presented: true, name: annotation.marker, accumulate: frame.accumulate }),
  };
  let attention = new ShowAttentionController({
    cursor,
    resolveTarget: (id) => ({ id }),
    selectText: () => ({ receipt: { status: 'selected' }, clear: () => { selectionClears += 1; } }),
  });

  attention.present({ mode: 'marker', targetId: 'a', marker: 'underline' });
  attention.present({ mode: 'marker', targetId: 'b', marker: 'oval' });
  assert.equal(attention.snapshot.markerCount, 2);
  assert.equal(attention.snapshot.cursorOwner, 'marker');

  attention.present({ mode: 'native-selection', targetId: 'c', quote: 'phrase' });
  assert.equal(attention.snapshot.transientMode, 'native-selection');
  attention.present({ mode: 'click', targetId: 'd' });
  assert.equal(selectionClears, 1);
  assert.equal(attention.snapshot.transientMode, 'click');
  assert.equal(attention.snapshot.markerCount, 2);

  attention.clearMarkers();
  assert.equal(attention.snapshot.markerCount, 0);
  assert.ok(calls.includes('clear-markers'));
});

test('attention replacements preserve the arrow and terminal lifecycle clears it', () => {
  let clearOptions = [];
  let cursor = {
    clear: (options) => clearOptions.push(options),
    clearAccumulatedAnnotations() {},
    presentFocusFrame: () => ({ presented: true }),
  };
  let attention = new ShowAttentionController({
    cursor,
    resolveTarget: (id) => ({ id }),
  });

  attention.present({ mode: 'frame', targetId: 'a' });
  attention.present({ mode: 'frame', targetId: 'b' });
  assert.deepEqual(clearOptions.at(-1), { preserveInk: true, preserveCursor: true });

  attention.reset('terminal-reset');
  assert.deepEqual(clearOptions.at(-1), { preserveInk: false, preserveCursor: false });

  attention.dispose();
  assert.deepEqual(clearOptions.at(-1), { preserveInk: false, preserveCursor: false });
});

test('attention controller advances frame and marker receipts to one settled visible state', async () => {
  let scheduler = createFrameScheduler();
  let focusFrames = [];
  let markerFrames = [];
  let cursor = {
    clear() {},
    presentFocusFrame(_target, frame) {
      let elapsedMs = Number(frame.elapsedMs) || 0;
      focusFrames.push(elapsedMs);
      return {
        presented: true,
        durationMs: 600,
        revealProgress: Math.min(1, elapsedMs / 600),
        frameRect: { width: Math.max(1, elapsedMs / 3), height: Math.max(1, elapsedMs / 6) },
      };
    },
    presentAnnotationFrame(_target, _annotation, frame) {
      let elapsedMs = Number(frame.elapsedMs) || 0;
      let progress = Math.min(1, elapsedMs / 300);
      markerFrames.push(elapsedMs);
      return {
        presented: true,
        planVersion: 'symbiote-presenter-kinematics-v1',
        durationMs: 300,
        progress,
        pathPoints: Math.max(1, Math.round(progress * 24)),
        accumulatedCount: progress >= 1 ? 1 : 0,
      };
    },
  };
  let targets = {
    frame: animatedTarget(scheduler.view, 'frame'),
    marker: animatedTarget(scheduler.view, 'marker'),
  };
  let attention = new ShowAttentionController({ cursor, resolveTarget: (id) => targets[id] });

  attention.present({ mode: 'frame', targetId: 'frame' });
  assert.equal(scheduler.pending, 1);
  scheduler.step(1000);
  scheduler.step(1300);
  scheduler.step(1600);
  assert.deepEqual(focusFrames, [0, 0, 300, 600]);
  assert.equal(attention.snapshot.animating, false);

  attention.present({ mode: 'marker', targetId: 'marker', marker: 'oval' });
  scheduler.step(2000);
  scheduler.step(2150);
  scheduler.step(2300);
  assert.deepEqual(markerFrames, [0, 0, 150, 300]);
  assert.equal(attention.snapshot.markerCount, 1);
  assert.equal(attention.snapshot.animating, false);
  await attention.whenSettled();
});

test('attention controller owns native-selection animation and cancels it on replacement', async () => {
  let scheduler = createFrameScheduler();
  let frames = [];
  let clears = 0;
  let target = animatedTarget(scheduler.view, 'selection');
  let attention = new ShowAttentionController({
    cursor: { clear() {}, presentFocusFrame: () => ({ presented: true }) },
    resolveTarget: () => target,
    selectText: () => ({
      receipt: { presented: true, status: 'selecting', durationMs: 400, progress: 0 },
      presentFrame(elapsedMs) {
        frames.push(elapsedMs);
        return {
          presented: true,
          status: elapsedMs >= 400 ? 'selected' : 'selecting',
          durationMs: 400,
          elapsedMs,
          progress: Math.min(1, elapsedMs / 400),
        };
      },
      clear() { clears += 1; },
    }),
  });

  attention.present({ mode: 'native-selection', targetId: 'selection', quote: 'animated' });
  assert.equal(attention.snapshot.animating, true);
  scheduler.step(1000);
  scheduler.step(1200);
  assert.deepEqual(frames, [0, 200]);
  attention.present({ mode: 'frame', targetId: 'selection' });
  assert.equal(clears, 1);
  assert.ok(scheduler.cancelled.length >= 1);
  assert.equal((await attention.whenSettled()).mode, 'frame');
});

test('show DOM readiness requests smooth centered focus and awaits a platform scroll promise', async () => {
  let releaseScroll;
  let optionsSeen;
  let scrollPromise = new Promise((resolve) => { releaseScroll = resolve; });
  let target = {
    scrollIntoView(options) {
      optionsSeen = options;
      return scrollPromise;
    },
  };
  let doc = {
    readyState: 'complete',
    defaultView: { requestAnimationFrame: (callback) => callback(1) },
  };
  let pending = waitForShowDomReadiness({ document: doc, target });
  let settled = false;
  pending.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  releaseScroll();
  let receipt = await pending;
  assert.equal(receipt.target, target);
  assert.deepEqual(optionsSeen, { block: 'center', inline: 'nearest', behavior: 'smooth' });
});

test('show DOM readiness aborts while a platform smooth scroll is still pending', async () => {
  let controller = new AbortController();
  let scrollStarted;
  let started = new Promise((resolve) => { scrollStarted = resolve; });
  let target = {
    scrollIntoView() {
      scrollStarted();
      return new Promise(() => {});
    },
  };
  let doc = {
    readyState: 'complete',
    defaultView: {},
  };
  let pending = waitForShowDomReadiness({ document: doc, target, signal: controller.signal });
  await started;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('attention animation replacement and reset cancel one owned frame without duplicates', async () => {
  let scheduler = createFrameScheduler();
  let calls = [];
  let cursor = {
    clear: () => calls.push('clear'),
    clearAccumulatedAnnotations: () => calls.push('clear-markers'),
    presentFocusFrame(_target, frame) {
      let elapsedMs = Number(frame.elapsedMs) || 0;
      calls.push(`frame:${elapsedMs}`);
      return { presented: true, durationMs: 600, revealProgress: elapsedMs / 600 };
    },
    presentAnnotationFrame(_target, _annotation, frame) {
      let elapsedMs = Number(frame.elapsedMs) || 0;
      calls.push(`marker:${elapsedMs}`);
      return { presented: true, durationMs: 300, progress: elapsedMs / 300 };
    },
  };
  let targets = {
    frame: animatedTarget(scheduler.view, 'frame'),
    marker: animatedTarget(scheduler.view, 'marker'),
  };
  let attention = new ShowAttentionController({ cursor, resolveTarget: (id) => targets[id] });

  attention.present({ mode: 'frame', targetId: 'frame' });
  let firstDone = attention.whenSettled();
  assert.equal(scheduler.pending, 1);
  attention.present({ mode: 'marker', targetId: 'marker', marker: 'oval' });
  assert.equal(scheduler.pending, 1);
  assert.equal((await firstDone).status, 'replaced');
  scheduler.step(1000);
  attention.clearTransient();
  assert.equal(scheduler.pending, 0);
  assert.equal((await attention.whenSettled()).status, 'cleared');
  assert.ok(scheduler.cancelled.length >= 2);
  assert.equal(calls.filter((call) => call === 'frame:0').length, 1);
});

test('attention settlement publishes exact cue identity and actual settled frame time', async () => {
  let scheduler = createFrameScheduler();
  let target = animatedTarget(scheduler.view, 'marker');
  let cursor = {
    clear() {},
    presentAnnotationFrame(_target, _annotation, frame) {
      let elapsedMs = Number(frame.elapsedMs) || 0;
      return {
        presented: true,
        durationMs: 300,
        elapsedMs,
        progress: elapsedMs / 300,
        normalizedPathHash: 'path-17',
      };
    },
  };
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });

  attention.present({
    mode: 'marker',
    targetId: 'marker',
    marker: 'underline',
    gestureId: 'recognized-word-42',
    cueTimeMs: 812,
    mediaTimeMs: 812,
    seed: 17,
  });
  scheduler.step(1000);
  scheduler.step(1150);
  scheduler.step(1300);
  let settled = await attention.whenSettled();

  assert.equal(settled.status, 'settled');
  assert.equal(settled.gestureId, 'recognized-word-42');
  assert.equal(settled.cueTimeMs, 812);
  assert.equal(settled.mediaTimeMs, 812);
  assert.equal(settled.planVersion, 'symbiote-presenter-kinematics-v1');
  assert.equal(settled.startedAtMs, 1000);
  assert.equal(settled.firstFrameAtMs, 1000);
  assert.equal(settled.settledAtMs, 1300);
  assert.equal(settled.elapsedMs, 300);
  assert.equal(settled.normalizedPathHash, 'path-17');
});

test('pause freezes, seek reprojects, and resume continues the same gesture without stale frames', async () => {
  let scheduler = createFrameScheduler();
  let frames = [];
  let target = animatedTarget(scheduler.view, 'frame');
  let cursor = {
    clear() {},
    presentFocusFrame(_target, frame) {
      let elapsedMs = Number(frame.elapsedMs) || 0;
      frames.push(elapsedMs);
      return { presented: true, durationMs: 400, elapsedMs, revealProgress: elapsedMs / 400 };
    },
  };
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });

  attention.present({ mode: 'frame', targetId: 'frame', gestureId: 'frame-1' });
  scheduler.step(1000);
  scheduler.step(1200);
  assert.equal(attention.pause(), true);
  assert.equal(attention.snapshot.paused, true);
  assert.equal(scheduler.pending, 0);
  assert.equal(attention.seek(100).elapsedMs, 100);
  assert.equal(attention.snapshot.animationProgress, 0.25);
  assert.equal(attention.resume(), true);
  scheduler.step(2000);
  scheduler.step(2300);

  let settled = await attention.whenSettled();
  assert.equal(settled.status, 'settled');
  assert.deepEqual(frames, [0, 0, 200, 100, 100, 400]);
  assert.equal(scheduler.pending, 0);
});

test('branch reset cancels the old generation and restores a captured paused frame', async () => {
  let scheduler = createFrameScheduler();
  let frames = [];
  let target = animatedTarget(scheduler.view, 'frame');
  let cursor = {
    clear() {},
    clearAccumulatedAnnotations() {},
    presentFocusFrame(_target, frame) {
      let elapsedMs = Number(frame.elapsedMs) || 0;
      frames.push(elapsedMs);
      return { presented: true, durationMs: 500, elapsedMs, revealProgress: elapsedMs / 500 };
    },
  };
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });

  attention.present({ mode: 'frame', targetId: 'frame', gestureId: 'branch-frame', seed: 8 });
  scheduler.step(1000);
  scheduler.step(1200);
  attention.pause();
  let captured = attention.captureState();
  let oldSettled = attention.whenSettled();
  attention.reset('branch-reset');
  assert.equal((await oldSettled).status, 'branch-reset');
  assert.equal(attention.restoreState(captured).presented, true);
  assert.equal(attention.snapshot.paused, true);
  assert.equal(attention.snapshot.animationElapsedMs, 200);
  assert.equal(scheduler.pending, 0);
  assert.equal(frames.at(-1), 200);
});

test('prefers-reduced-motion renders the final semantic state without scheduling frames', async () => {
  let scheduler = createFrameScheduler();
  scheduler.view.matchMedia = () => ({ matches: true });
  let frames = [];
  let target = animatedTarget(scheduler.view, 'marker');
  let cursor = {
    clear() {},
    presentAnnotationFrame(_target, _annotation, frame) {
      let elapsedMs = Number(frame.elapsedMs) || 0;
      frames.push(elapsedMs);
      return { presented: true, durationMs: 300, elapsedMs, progress: elapsedMs / 300 };
    },
  };
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });

  attention.present({ mode: 'marker', targetId: 'marker', marker: 'oval' });
  let settled = await attention.whenSettled();
  assert.equal(settled.status, 'reduced-motion');
  assert.equal(settled.receipt.progress, 1);
  assert.deepEqual(frames, [0, 300]);
  assert.equal(scheduler.pending, 0);
  assert.equal(attention.snapshot.markerCount, 1);
});

test('meaningful interaction requires trusted activation and excludes hover and modifier-only keys', () => {
  assert.equal(isMeaningfulShowInteraction({ type: 'pointermove', isTrusted: true }), false);
  assert.equal(isMeaningfulShowInteraction({ type: 'click', isTrusted: false, button: 0 }), false);
  assert.equal(isMeaningfulShowInteraction({ type: 'click', isTrusted: true, button: 0 }), true);
  assert.equal(isMeaningfulShowInteraction({ type: 'keydown', isTrusted: true, key: 'Shift' }), false);
  assert.equal(isMeaningfulShowInteraction({ type: 'keydown', isTrusted: true, key: 'Enter' }), true);
});

test('meaningful interaction monitor auto-pauses once per accepted event and disposes listeners', () => {
  let listeners = new Map();
  let target = {
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
  };
  let pauses = [];
  let monitor = monitorMeaningfulShowInteractions(target, {
    pause: (detail) => pauses.push(detail.eventType),
  });
  listeners.get('click')({ type: 'click', isTrusted: true, button: 0 });
  listeners.get('input')({ type: 'input', isTrusted: false });
  assert.deepEqual(pauses, ['click']);
  monitor.dispose();
  assert.equal(listeners.size, 0);
});

test('show action lifecycle reveals a hidden target, waits in order, acts, and restores only its own change', async () => {
  let calls = [];
  let lifecycle = new ShowActionLifecycle({
    inspect: async ({ action }) => {
      calls.push(`inspect:${action.id}`);
      return { panel: 'collapsed', revision: 4 };
    },
    reveal: async ({ inspected }) => {
      calls.push(`reveal:${inspected.panel}`);
      return { changed: true, restoreKey: 'show-opened-panel' };
    },
    awaitTransition: async () => calls.push('transition'),
    awaitTarget: async () => {
      calls.push('target');
      return { target: { id: 'consumer-owned-target' } };
    },
    act: async ({ target }) => {
      calls.push(`act:${target.id}`);
      return { presented: true };
    },
    restore: async ({ reveal }) => calls.push(`restore:${reveal.restoreKey}`),
  });

  let receipt = await lifecycle.run({ id: 'focus-hidden' });
  assert.deepEqual(calls, [
    'inspect:focus-hidden',
    'reveal:collapsed',
    'transition',
    'target',
    'act:consumer-owned-target',
    'restore:show-opened-panel',
  ]);
  assert.equal(receipt.status, 'completed');
  assert.deepEqual(receipt.phases.map(({ phase, status }) => `${phase}:${status}`), [
    'inspect:completed',
    'reveal:completed',
    'transition:completed',
    'target:completed',
    'act:completed',
    'restore:completed',
  ]);
});

test('show action lifecycle cancels stale target work and suppresses restore after manual override', async () => {
  let releaseTarget;
  let calls = [];
  let lifecycle = new ShowActionLifecycle({
    inspect: async () => ({ panel: 'closed' }),
    reveal: async () => ({ changed: true, restoreKey: 'owned' }),
    awaitTransition: async () => {},
    awaitTarget: ({ signal }) => new Promise((resolve, reject) => {
      releaseTarget = resolve;
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }),
    act: async () => calls.push('act'),
    restore: async () => calls.push('restore'),
  });

  let pending = lifecycle.run({ id: 'hidden-mobile-target' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await lifecycle.meaningfulInteraction();
  releaseTarget?.({ target: { id: 'late' } });
  let receipt = await pending;
  assert.equal(receipt.status, 'cancelled');
  assert.equal(receipt.reason, 'meaningful-interaction');
  assert.deepEqual(calls, []);
  assert.equal(receipt.phases.some(({ phase }) => phase === 'act'), false);
  assert.equal(receipt.phases.some(({ phase }) => phase === 'restore'), false);
});

test('show action lifecycle cancellation restores show-owned reveal on pause, seek, stop, and branch reset', async () => {
  for (let reason of ['pause', 'seek', 'stop', 'branch-change', 'branch-return']) {
    let restored = [];
    let lifecycle = new ShowActionLifecycle({
      inspect: async () => ({ panel: 'collapsed' }),
      reveal: async () => ({ changed: true, restoreKey: reason }),
      awaitTransition: async ({ signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }),
      restore: async ({ reveal }) => restored.push(reveal.restoreKey),
    });
    let pending = lifecycle.run({ id: reason });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await lifecycle.cancel(reason);
    let receipt = await pending;
    assert.equal(receipt.status, 'cancelled');
    assert.deepEqual(restored, [reason]);
  }
});
