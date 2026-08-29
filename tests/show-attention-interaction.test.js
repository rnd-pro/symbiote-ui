import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SHOW_ATTENTION_ADMISSION_VERSION,
  SHOW_ATTENTION_MILESTONE_VERSION,
  ShowAttentionController,
  createShowAttentionAdmission,
} from '../chat/show-attention.js';
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
  let now = 0;
  return {
    view: {
      performance: {
        timeOrigin: 1700000000000,
        now: () => now,
      },
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
      now = timestamp;
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

function focusPlan(elapsedMs = 0, durationMs = 300) {
  return {
    presented: true,
    planVersion: 'symbiote-presenter-kinematics-v1',
    durationMs,
    elapsedMs,
    revealProgress: elapsedMs / durationMs,
    normalizedPathHash: 'path-fault-injection',
    targetRect: { left: 1, top: 2, width: 100, height: 40 },
  };
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
  assert.equal((await attention.whenSettled()).status, 'completed');
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
  let replaced = await firstDone;
  assert.equal(replaced.status, 'cancelled');
  assert.equal(replaced.timing.terminalReason, 'replaced');
  scheduler.step(1000);
  attention.clearTransient();
  assert.equal(scheduler.pending, 0);
  let cleared = await attention.whenSettled();
  assert.equal(cleared.status, 'cancelled');
  assert.equal(cleared.timing.terminalReason, 'cleared');
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

  assert.equal(settled.status, 'completed');
  assert.equal(settled.version, 'show-attention-terminal-v2');
  assert.equal(settled.timing.startedAt.monotonicTimeMs, 1000);
  assert.equal(settled.timing.firstFrameAt.monotonicTimeMs, 1000);
  assert.equal(settled.observedAt.monotonicTimeMs, 1300);
  assert.equal(settled.timing.elapsedMs, 300);
  assert.equal(settled.providerReceipt.normalizedPathHash, 'path-17');
});

test('pure attention admission preserves exact nested provider evidence and rejects an exceeded hard budget', () => {
  let request = {
    mode: 'native-selection',
    gestureId: 'selection-42',
    targetId: 'article.portable-config',
    targetIdentity: 'target:article.portable-config',
    layoutIdentity: 'layout:revision-7',
    budgetMs: 650,
    plan: {
      planVersion: 'symbiote-presenter-kinematics-v1',
      durationMs: 640,
      normalizedPathHash: 'path-selection-42',
      distancePx: 640,
      startOffset: 18,
      endOffset: 96,
    },
  };
  let admitted = createShowAttentionAdmission(request);
  let rejected = createShowAttentionAdmission({
    ...request,
    budgetMs: 639,
  });

  assert.equal(SHOW_ATTENTION_ADMISSION_VERSION, 'show-attention-admission-v2');
  assert.equal(admitted.version, 'show-attention-admission-v2');
  assert.equal(admitted.status, 'admitted');
  assert.equal(admitted.reason.code, 'within-budget');
  assert.deepEqual(admitted.provider, {
    id: 'symbiote-ui/show-attention',
    version: 'show-attention-provider-v1',
  });
  assert.deepEqual(admitted.effect, {
    mode: 'native-selection',
    gestureId: 'selection-42',
  });
  assert.equal(admitted.budget.limitMs, 650);
  assert.equal(admitted.budget.plannedDurationMs, 640);
  assert.equal(admitted.plan.version, 'symbiote-presenter-kinematics-v1');
  assert.match(admitted.plan.identity, /^show-plan:[0-9a-f]{8}$/);
  assert.equal(admitted.plan.normalizedPathHash, 'path-selection-42');
  assert.equal(admitted.target.geometry.startOffset, 18);
  assert.equal(admitted.target.geometry.endOffset, 96);
  assert.equal(admitted.plan.evidence.durationMs, 640);
  assert.equal(admitted.target.identity, 'target:article.portable-config');
  assert.equal(admitted.target.layoutIdentity, 'layout:revision-7');
  assert.match(admitted.target.geometryIdentity, /^show-geometry:[0-9a-f]{8}$/);
  assert.equal(Object.isFrozen(admitted), true);
  assert.equal(Object.isFrozen(admitted.provider), true);
  assert.equal(Object.isFrozen(admitted.effect), true);
  assert.equal(Object.isFrozen(admitted.target), true);
  assert.equal(Object.isFrozen(admitted.plan), true);
  assert.equal(Object.isFrozen(admitted.target.geometry), true);
  assert.equal(Object.isFrozen(admitted.plan.evidence), true);

  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.reason.code, 'budget-exceeded');
  assert.equal(rejected.reason.provider, null);
  assert.equal(rejected.budget.plannedDurationMs, 640);
  assert.equal(rejected.budget.limitMs, 639);
  assert.equal(rejected.target.geometry.endOffset, 96);
});

test('admission allows an empty path hash only for a truthful non-path click', () => {
  let common = {
    gestureId: 'click-1',
    targetId: 'button.save',
    targetIdentity: 'target:button.save',
    layoutIdentity: 'layout:button.save:1',
    budgetMs: 300,
    plan: {
      planVersion: 'symbiote-presenter-kinematics-v1',
      durationMs: 220,
      normalizedPathHash: '',
      rect: { left: 10, top: 20, width: 80, height: 32 },
      hotspot: { x: 50, y: 36 },
    },
  };

  let click = createShowAttentionAdmission({ ...common, mode: 'click' });
  let frame = createShowAttentionAdmission({ ...common, mode: 'frame' });

  assert.equal(click.status, 'admitted');
  assert.equal(click.plan.normalizedPathHash, '');
  assert.equal(frame.status, 'rejected');
  assert.deepEqual(frame.reason.provider, {
    code: 'identity-unavailable',
    fields: ['plan.normalizedPathHash'],
  });
});

test('normal attention admits synchronously before first provider mutation and performance milestone', async () => {
  let scheduler = createFrameScheduler();
  let events = [];
  let target = animatedTarget(scheduler.view, 'focus');
  let cursor = {
    clear() {},
    presentFocusFrame(_target, frame) {
      let elapsedMs = Number(frame.elapsedMs) || 0;
      events.push(frame.planOnly ? 'plan' : `render:${elapsedMs}`);
      return {
        presented: true,
        planVersion: 'symbiote-presenter-kinematics-v1',
        durationMs: 400,
        elapsedMs,
        revealProgress: elapsedMs / 400,
        normalizedPathHash: 'path-focus-order',
        targetRect: { left: 10, top: 20, width: 240, height: 90 },
      };
    },
  };
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });
  let initial = attention.present({
    mode: 'frame',
    targetId: 'focus',
    targetIdentity: 'target:focus',
    layoutIdentity: 'layout:focus:1',
    gestureId: 'focus-order',
    budgetMs: 550,
    onAdmission(providerAdmission) {
      events.push('admission');
      assert.equal(providerAdmission.status, 'admitted');
    },
    onMilestone(providerReceipt) {
      events.push(providerReceipt.milestone);
    },
    onTerminal() { events.push('terminal'); },
  });

  assert.equal(initial.admission.status, 'admitted');
  assert.deepEqual(events, ['plan', 'admission']);
  assert.equal(scheduler.pending, 1);

  scheduler.step(1000);
  scheduler.step(1200);
  scheduler.step(1400);
  let terminal = await attention.whenSettled();

  assert.deepEqual(events, [
    'plan',
    'admission',
    'render:0',
    'first-frame',
    'render:200',
    'render:400',
    'settled',
    'terminal',
  ]);
  assert.deepEqual(terminal.observedAt, {
    domain: 'performance',
    timeOriginMs: 1700000000000,
    monotonicTimeMs: 1400,
  });
  assert.equal(terminal.providerReceipt.elapsedMs, 400);
  assert.equal(terminal.admission, initial.admission);
  assert.equal(Object.isFrozen(terminal), true);
  assert.equal(Object.isFrozen(terminal.observedAt), true);
  assert.equal(Object.isFrozen(terminal.providerReceipt), true);
});

test('semantic select admits before native selection and reports first-frame as exact provider evidence', async () => {
  let scheduler = createFrameScheduler();
  let events = [];
  let target = animatedTarget(scheduler.view, 'selection');
  let attention = new ShowAttentionController({
    cursor: { clear() {} },
    resolveTarget: () => target,
    selectText: () => ({
      receipt: {
        presented: true,
        planVersion: 'symbiote-presenter-kinematics-v1',
        durationMs: 300,
        progress: 0,
        normalizedPathHash: 'path-selection-order',
        startOffset: 4,
        endOffset: 18,
        distancePx: 280,
      },
      presentFrame(elapsedMs) {
        events.push(`selection:${elapsedMs}`);
        return {
          presented: true,
          planVersion: 'symbiote-presenter-kinematics-v1',
          durationMs: 300,
          elapsedMs,
          progress: elapsedMs / 300,
          normalizedPathHash: 'path-selection-order',
          startOffset: 4,
          endOffset: 18,
          distancePx: 280,
        };
      },
      clear() { events.push('selection:clear'); },
    }),
  });

  attention.present({
    mode: 'native-selection',
    targetId: 'selection',
    targetIdentity: 'target:selection',
    layoutIdentity: 'layout:selection:1',
    gestureId: 'selection-order',
    budgetMs: 400,
    onAdmission() { events.push('admission'); },
    onMilestone(receipt) { events.push(receipt.milestone); },
  });

  assert.deepEqual(events, ['admission']);
  scheduler.step(1000);
  assert.deepEqual(events, ['admission', 'selection:0', 'first-frame']);
  scheduler.step(1300);
  let terminal = await attention.whenSettled();
  assert.deepEqual(events, ['admission', 'selection:0', 'first-frame', 'selection:300', 'settled']);
  assert.equal(terminal.providerReceipt.status, undefined);
});

test('attention rejects over-budget zero-progress plans before RAF and clears them synchronously', async () => {
  let scheduler = createFrameScheduler();
  let clears = [];
  let target = animatedTarget(scheduler.view, 'marker');
  let cursor = {
    clear: (options) => clears.push(options),
    presentAnnotationFrame() {
      return {
        presented: true,
        planVersion: 'symbiote-presenter-kinematics-v1',
        durationMs: 651,
        progress: 0,
        normalizedPathHash: 'path-over-budget',
        arcLengthPx: 640,
      };
    },
  };
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });
  let receipt = attention.present({
    mode: 'marker',
    targetId: 'marker',
    marker: 'underline',
    gestureId: 'marker-over-budget',
    budgetMs: 650,
    onAdmission() {},
  });

  assert.equal(receipt.presented, false);
  assert.equal(receipt.reason.code, 'budget-exceeded');
  assert.equal(receipt.admission.status, 'rejected');
  assert.equal(attention.lastAdmission, receipt.admission);
  assert.equal(attention.snapshot.animating, false);
  assert.equal(scheduler.pending, 0);
  assert.deepEqual(clears.at(-1), { preserveInk: true, preserveCursor: false });
  assert.equal((await attention.whenSettled()).status, 'rejected');
});

test('budgeted unresolved attention clears a prior generation without stale replay or milestones', async () => {
  let scheduler = createFrameScheduler();
  let milestones = [];
  let clears = [];
  let target = animatedTarget(scheduler.view, 'focus');
  let cursor = {
    clear: (options) => clears.push(options),
    presentFocusFrame(_target, frame) {
      let elapsedMs = Number(frame.elapsedMs) || 0;
      return {
        presented: true,
        planVersion: 'symbiote-presenter-kinematics-v1',
        durationMs: 400,
        elapsedMs,
        revealProgress: elapsedMs / 400,
        normalizedPathHash: 'path-prior',
        targetRect: { left: 1, top: 2, width: 100, height: 40 },
      };
    },
  };
  let attention = new ShowAttentionController({
    cursor,
    resolveTarget: (id) => (id === 'missing' ? null : target),
    onAdmission() {},
    onMilestone: (milestone) => milestones.push(milestone),
  });

  attention.present({
    mode: 'frame',
    targetId: 'focus',
    targetIdentity: 'target:focus',
    layoutIdentity: 'layout:focus:prior',
    gestureId: 'prior',
    budgetMs: 550,
  });
  let priorSettled = attention.whenSettled();
  assert.equal(scheduler.pending, 1);

  let rejected = attention.present({
    mode: 'frame',
    targetId: 'missing',
    gestureId: 'unresolved',
    budgetMs: 550,
  });
  scheduler.step(1000);

  assert.equal(rejected.admission.reason.provider.code, 'target-unresolved');
  let priorTerminal = await priorSettled;
  assert.equal(priorTerminal.status, 'cancelled');
  assert.equal(priorTerminal.timing.terminalReason, 'replaced');
  let rejectedTerminal = await attention.whenSettled();
  assert.equal(rejectedTerminal.status, 'rejected');
  assert.equal(rejectedTerminal.providerReceipt, null);
  assert.equal(rejectedTerminal.admission.reason.code, 'provider-rejected');
  assert.equal(rejectedTerminal.admission.reason.provider.code, 'target-unresolved');
  assert.equal(rejectedTerminal.admission.budget.plannedDurationMs, null);
  assert.equal(rejectedTerminal.admission.target.geometryIdentity, null);
  assert.equal(rejectedTerminal.admission.target.geometry, null);
  assert.deepEqual(rejectedTerminal.admission.plan, {
    version: null,
    identity: null,
    normalizedPathHash: null,
    motion: null,
    evidence: null,
  });
  assert.equal(scheduler.pending, 0);
  assert.equal(attention.snapshot.animating, false);
  assert.equal(attention.snapshot.cursorOwner, '');
  assert.equal(attention.captureState().request, null);
  assert.deepEqual(clears.at(-1), { preserveInk: true, preserveCursor: false });
  assert.deepEqual(milestones, []);
});

test('attention reports actual first-frame and settled milestones exactly once', async () => {
  let scheduler = createFrameScheduler();
  let milestones = [];
  let target = animatedTarget(scheduler.view, 'focus');
  let cursor = {
    clear() {},
    presentFocusFrame(_target, frame) {
      let elapsedMs = Number(frame.elapsedMs) || 0;
      return {
        presented: true,
        planVersion: 'symbiote-presenter-kinematics-v1',
        durationMs: 400,
        elapsedMs,
        revealProgress: elapsedMs / 400,
        normalizedPathHash: 'path-focus-budget',
        targetRect: { left: 10, top: 20, width: 240, height: 90 },
      };
    },
  };
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });
  let receipt = attention.present({
    mode: 'frame',
    targetId: 'focus',
    gestureId: 'focus-budget',
    budgetMs: 550,
    onAdmission() {},
    onMilestone: (milestone) => milestones.push(milestone),
  });

  assert.equal(receipt.admission.status, 'admitted');
  scheduler.step(1000);
  assert.equal(attention.pause(), true);
  assert.equal(attention.resume(), true);
  scheduler.step(1200);
  attention.seek(400);
  attention.cancel();

  let settled = await attention.whenSettled();
  assert.deepEqual(milestones.map((item) => item.milestone), ['first-frame', 'settled']);
  assert.ok(milestones.every((item) => item.version === SHOW_ATTENTION_MILESTONE_VERSION));
  assert.ok(milestones.every((item) => item.admission.effect.gestureId === 'focus-budget'));
  assert.ok(milestones.every((item) => !Object.hasOwn(item, 'status')));
  assert.equal(milestones[0].observedAt.monotonicTimeMs, 1000);
  assert.equal(milestones[1].observedAt.monotonicTimeMs, settled.observedAt.monotonicTimeMs);
  assert.equal(milestones[1].admission, receipt.admission);

  attention.present({
    mode: 'frame',
    targetId: 'focus',
    gestureId: 'focus-cancelled',
    budgetMs: 550,
    onAdmission() {},
    onMilestone: (milestone) => milestones.push(milestone),
  });
  scheduler.step(2000);
  assert.equal(attention.cancel(), true);
  scheduler.step(3000);
  assert.equal((await attention.whenSettled()).status, 'cancelled');
  assert.deepEqual(
    milestones
      .filter((item) => item.admission.effect.gestureId === 'focus-cancelled')
      .map((item) => item.milestone),
    ['first-frame'],
  );
});

test('replacement and Stop cancellation publish one terminal receipt and suppress late milestones', async () => {
  let scheduler = createFrameScheduler();
  let milestones = [];
  let terminals = [];
  let target = animatedTarget(scheduler.view, 'focus');
  let cursor = {
    clear() {},
    presentFocusFrame(_target, frame) {
      let elapsedMs = Number(frame.elapsedMs) || 0;
      return {
        presented: true,
        planVersion: 'symbiote-presenter-kinematics-v1',
        durationMs: 400,
        elapsedMs,
        revealProgress: elapsedMs / 400,
        normalizedPathHash: 'path-terminal-once',
        targetRect: { left: 10, top: 20, width: 240, height: 90 },
      };
    },
  };
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });
  let request = (gestureId) => ({
    mode: 'frame',
    targetId: 'focus',
    targetIdentity: 'target:focus',
    layoutIdentity: 'layout:focus:terminal',
    gestureId,
    budgetMs: 550,
    onAdmission() {},
    onMilestone: (receipt) => milestones.push(receipt),
    onTerminal: (receipt) => terminals.push(receipt),
  });

  attention.present(request('replaced'));
  scheduler.step(1000);
  attention.present(request('stopped'));
  scheduler.step(1200);
  assert.equal(attention.cancel('stop'), true);
  scheduler.step(1600);

  assert.deepEqual(terminals.map((receipt) => receipt.status), ['cancelled', 'cancelled']);
  assert.deepEqual(terminals.map((receipt) => receipt.timing.terminalReason), ['replaced', 'stop']);
  assert.ok(terminals.every((receipt) => receipt.version === 'show-attention-terminal-v2'));
  assert.ok(terminals.every((receipt) => receipt.observedAt.domain === 'performance'));
  assert.deepEqual(
    milestones.map((receipt) => [receipt.admission.effect.gestureId, receipt.milestone]),
    [['replaced', 'first-frame'], ['stopped', 'first-frame']],
  );
  assert.equal(scheduler.pending, 0);
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
  assert.equal(settled.status, 'completed');
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
  let resetTerminal = await oldSettled;
  assert.equal(resetTerminal.status, 'cancelled');
  assert.equal(resetTerminal.timing.terminalReason, 'branch-reset');
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
  let milestones = [];
  let events = [];
  let target = animatedTarget(scheduler.view, 'marker');
  let cursor = {
    clear() {},
    presentAnnotationFrame(_target, _annotation, frame) {
      let elapsedMs = Number(frame.elapsedMs) || 0;
      frames.push(elapsedMs);
      events.push(frame.planOnly ? 'plan' : `render:${elapsedMs}`);
      return {
        presented: true,
        planVersion: 'symbiote-presenter-kinematics-v1',
        durationMs: 300,
        elapsedMs,
        progress: elapsedMs / 300,
        normalizedPathHash: 'path-reduced-marker',
        rect: { left: 1, top: 2, width: 100, height: 40 },
      };
    },
  };
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => target });

  attention.present({
    mode: 'marker',
    targetId: 'marker',
    targetIdentity: 'target:marker',
    layoutIdentity: 'layout:marker:reduced',
    marker: 'oval',
    gestureId: 'reduced-marker',
    budgetMs: 500,
    onAdmission() { events.push('admission'); },
    onMilestone(milestone) {
      milestones.push(milestone);
      events.push(milestone.milestone);
    },
    onTerminal() { events.push('terminal'); },
  });
  let settled = await attention.whenSettled();
  assert.equal(settled.status, 'completed');
  assert.equal(settled.providerReceipt.progress, 1);
  assert.deepEqual(frames, [0, 300]);
  assert.equal(scheduler.pending, 0);
  assert.equal(attention.snapshot.markerCount, 1);
  assert.deepEqual(milestones.map((item) => item.milestone), ['first-frame', 'settled']);
  assert.equal(milestones[0].observedAt.monotonicTimeMs, milestones[1].observedAt.monotonicTimeMs);
  assert.deepEqual(events, [
    'plan',
    'admission',
    'render:300',
    'first-frame',
    'settled',
    'terminal',
  ]);
});

test('hostless immediate presentation reports its synchronous render before settlement', async () => {
  let frames = [];
  let milestones = [];
  let events = [];
  let cursor = {
    clear() {},
    presentFocusFrame(_target, frame) {
      let elapsedMs = Number(frame.elapsedMs) || 0;
      frames.push(elapsedMs);
      events.push(frame.planOnly ? 'plan' : `render:${elapsedMs}`);
      return {
        presented: true,
        planVersion: 'symbiote-presenter-kinematics-v1',
        durationMs: 300,
        elapsedMs,
        revealProgress: elapsedMs / 300,
        normalizedPathHash: 'path-immediate-focus',
        targetRect: { left: 1, top: 2, width: 100, height: 40 },
      };
    },
  };
  let attention = new ShowAttentionController({ cursor, resolveTarget: () => ({ id: 'focus' }) });

  attention.present({
    mode: 'frame',
    targetId: 'focus',
    targetIdentity: 'target:focus',
    layoutIdentity: 'layout:focus:immediate',
    gestureId: 'immediate-focus',
    budgetMs: 550,
    onAdmission() { events.push('admission'); },
    onMilestone(milestone) {
      milestones.push(milestone);
      events.push(milestone.milestone);
    },
    onTerminal() { events.push('terminal'); },
  });
  let settled = await attention.whenSettled();

  assert.equal(settled.status, 'completed');
  assert.deepEqual(frames, [0, 300]);
  assert.deepEqual(milestones.map((item) => item.milestone), ['first-frame', 'settled']);
  assert.equal(milestones[0].observedAt.monotonicTimeMs, milestones[1].observedAt.monotonicTimeMs);
  assert.deepEqual(events, [
    'plan',
    'admission',
    'render:300',
    'first-frame',
    'settled',
    'terminal',
  ]);
});

test('provider-v2 presentation requires a callable admission reporter before planning or frames', () => {
  let scheduler = createFrameScheduler();
  let plannerCalls = 0;
  let terminals = [];
  let attention = new ShowAttentionController({
    cursor: {
      presentFocusFrame() {
        plannerCalls += 1;
        return focusPlan();
      },
    },
    resolveTarget: () => animatedTarget(scheduler.view, 'focus'),
  });
  let settledBefore = attention.whenSettled();

  assert.throws(() => attention.present({
    mode: 'frame',
    targetId: 'focus',
    targetIdentity: 'target:focus',
    layoutIdentity: 'layout:focus:missing-admission',
    budgetMs: 500,
    onTerminal: (terminal) => terminals.push(terminal),
  }), (error) => error instanceof TypeError
    && error.code === 'SHOW_ATTENTION_ADMISSION_REPORTER_REQUIRED');

  assert.equal(plannerCalls, 0);
  assert.equal(scheduler.pending, 0);
  assert.equal(attention.snapshot.animating, false);
  assert.equal(attention.snapshot.generation, 0);
  assert.equal(attention.whenSettled(), settledBefore);
  assert.deepEqual(terminals, []);
});

test('provider evidence preserves a JSON own __proto__ key and recursively freezes it', () => {
  let plan = JSON.parse(`{
    "presented": true,
    "planVersion": "symbiote-presenter-kinematics-v1",
    "durationMs": 300,
    "normalizedPathHash": "path-own-proto",
    "targetRect": { "left": 1, "top": 2, "width": 100, "height": 40 },
    "__proto__": { "providerMarker": "retained" }
  }`);
  let admission = createShowAttentionAdmission({
    mode: 'frame',
    gestureId: 'own-proto',
    targetId: 'focus',
    targetIdentity: 'target:focus',
    layoutIdentity: 'layout:focus:own-proto',
    budgetMs: 500,
    plan,
  });

  assert.equal(admission.status, 'admitted');
  assert.equal(Object.hasOwn(admission.plan.evidence, '__proto__'), true);
  assert.deepEqual(admission.plan.evidence.__proto__, { providerMarker: 'retained' });
  assert.equal(Object.isFrozen(admission.plan.evidence.__proto__), true);
});

test('returned and typed planning rejections retain exact reasons with unavailable plan values null', async () => {
  let scheduler = createFrameScheduler();
  let hiddenReceipt = JSON.parse(`{
    "presented": false,
    "reason": { "code": "hidden-target", "visibility": "collapsed" },
    "planVersion": "must-not-leak",
    "durationMs": 300,
    "normalizedPathHash": "must-not-leak",
    "targetRect": { "left": 1, "top": 2, "width": 100, "height": 40 },
    "__proto__": { "providerMarker": "retained" }
  }`);
  let returnedAdmission;
  let returned = new ShowAttentionController({
    cursor: { clear() {}, presentFocusFrame: () => hiddenReceipt },
    resolveTarget: () => animatedTarget(scheduler.view, 'hidden'),
  }).present({
    mode: 'frame',
    targetId: 'hidden',
    targetIdentity: 'target:hidden',
    layoutIdentity: 'layout:hidden:1',
    budgetMs: 500,
    onAdmission: (admission) => { returnedAdmission = admission; },
  });

  assert.equal(returned.presented, false);
  assert.equal(returnedAdmission.reason.provider.code, 'hidden-target');
  assert.equal(returnedAdmission.reason.provider.visibility, 'collapsed');
  assert.equal(
    returnedAdmission.reason.provider.evidence.__proto__.providerMarker,
    'retained',
  );
  assert.equal(Object.isFrozen(returnedAdmission.reason.provider.evidence.__proto__), true);
  assert.equal(returnedAdmission.budget.plannedDurationMs, null);
  assert.equal(returnedAdmission.target.geometryIdentity, null);
  assert.equal(returnedAdmission.target.geometry, null);
  assert.deepEqual(returnedAdmission.plan, {
    version: null,
    identity: null,
    normalizedPathHash: null,
    motion: null,
    evidence: null,
  });

  let expected = new Error('target is hidden');
  expected.code = 'hidden-target';
  expected.details = JSON.parse('{"visibility":"display-none","__proto__":{"retained":true}}');
  let admissions = [];
  let terminals = [];
  let attention = new ShowAttentionController({
    cursor: { clear() {}, presentFocusFrame() { throw expected; } },
    resolveTarget: () => animatedTarget(scheduler.view, 'hidden'),
  });
  let rejected = attention.present({
    mode: 'frame',
    targetId: 'hidden',
    targetIdentity: 'target:hidden',
    layoutIdentity: 'layout:hidden:2',
    budgetMs: 500,
    onAdmission: (admission) => admissions.push(admission),
    onTerminal: (terminal) => terminals.push(terminal),
  });

  assert.equal(rejected.presented, false);
  assert.equal(admissions.length, 1);
  assert.equal(admissions[0].reason.provider.code, 'hidden-target');
  assert.equal(admissions[0].reason.provider.details.visibility, 'display-none');
  assert.equal(Object.hasOwn(admissions[0].reason.provider.details, '__proto__'), true);
  assert.deepEqual(admissions[0].plan, returnedAdmission.plan);
  assert.equal(scheduler.pending, 0);
  assert.equal(terminals.length, 1);
  assert.equal((await attention.whenSettled()).status, 'rejected');
});

test('unexpected planning failure publishes a current failed terminal before rethrow', async () => {
  let scheduler = createFrameScheduler();
  let failure = new Error('planner invariant failed');
  let admissions = [];
  let terminals = [];
  let attention = new ShowAttentionController({
    cursor: { clear() {}, presentFocusFrame() { throw failure; } },
    resolveTarget: () => animatedTarget(scheduler.view, 'focus'),
  });

  assert.throws(() => attention.present({
    mode: 'frame',
    targetId: 'focus',
    targetIdentity: 'target:focus',
    layoutIdentity: 'layout:focus:unexpected',
    budgetMs: 500,
    onAdmission: (admission) => admissions.push(admission),
    onTerminal: (terminal) => terminals.push(terminal),
  }), (error) => error === failure);

  assert.equal(admissions.length, 1);
  assert.equal(admissions[0].status, 'rejected');
  assert.equal(admissions[0].reason.provider.code, 'provider-planning-failed');
  assert.equal(admissions[0].reason.provider.message, failure.message);
  assert.equal(scheduler.pending, 0);
  assert.equal(attention.snapshot.animating, false);
  let terminal = await attention.whenSettled();
  assert.equal(terminal.status, 'failed');
  assert.equal(terminal.admission, admissions[0]);
  assert.equal(terminal.timing.terminalReason.code, 'provider-planning-failed');
  assert.deepEqual(terminals, [terminal]);
});

test('target resolver failures use the same exact rejected admission and current terminal transition', async () => {
  for (let expected of [true, false]) {
    let scheduler = createFrameScheduler();
    let failure = new Error(expected ? 'target resolver rejected' : 'target resolver crashed');
    if (expected) {
      failure.code = 'target-resolver-failed';
      failure.details = { selector: '#missing', phase: 'resolve' };
    }
    let events = [];
    let pixelCalls = 0;
    let admission;
    let terminal;
    let attention = new ShowAttentionController({
      cursor: {
        clear() {},
        presentFocusFrame() {
          pixelCalls += 1;
          return focusPlan();
        },
      },
      resolveTarget() {
        throw failure;
      },
    });
    let settledBefore = attention.whenSettled();
    let request = {
      mode: 'frame',
      targetId: 'missing',
      targetIdentity: 'target:missing',
      layoutIdentity: 'layout:missing:resolver',
      budgetMs: 500,
      onAdmission(value) {
        admission = value;
        events.push(`admission:${value.reason.provider.code}`);
      },
      onTerminal(value) {
        terminal = value;
        events.push(`terminal:${value.status}`);
      },
    };

    if (expected) {
      let rejected = attention.present(request);
      assert.equal(rejected.presented, false);
      assert.equal(rejected.admission, admission);
    } else {
      assert.throws(() => attention.present(request), (error) => error === failure);
    }

    assert.equal(pixelCalls, 0);
    assert.equal(scheduler.pending, 0);
    assert.notEqual(attention.whenSettled(), settledBefore);
    assert.equal(admission.status, 'rejected');
    assert.equal(
      admission.reason.provider.code,
      expected ? 'target-resolver-failed' : 'provider-planning-failed',
    );
    if (expected) {
      assert.deepEqual(admission.reason.provider.details, {
        selector: '#missing',
        phase: 'resolve',
      });
    }
    assert.deepEqual(admission.plan, {
      version: null,
      identity: null,
      normalizedPathHash: null,
      motion: null,
      evidence: null,
    });
    assert.equal(terminal, await attention.whenSettled());
    assert.equal(terminal.status, expected ? 'rejected' : 'failed');
    assert.deepEqual(events, [
      `admission:${expected ? 'target-resolver-failed' : 'provider-planning-failed'}`,
      `terminal:${expected ? 'rejected' : 'failed'}`,
    ]);
  }
});

test('throwing admission reporters clean resolved and unresolved provisional state before rethrow', async () => {
  for (let resolved of [true, false]) {
    let scheduler = createFrameScheduler();
    let failure = new Error(`admission failed:${resolved}`);
    let clears = 0;
    let terminals = [];
    let attention = new ShowAttentionController({
      cursor: {
        clear() { clears += 1; },
        presentFocusFrame: () => focusPlan(),
      },
      resolveTarget: () => (resolved ? animatedTarget(scheduler.view, 'focus') : null),
    });

    assert.throws(() => attention.present({
      mode: 'frame',
      targetId: resolved ? 'focus' : 'missing',
      targetIdentity: resolved ? 'target:focus' : undefined,
      layoutIdentity: resolved ? 'layout:focus:admission-failure' : undefined,
      budgetMs: 500,
      onAdmission() { throw failure; },
      onTerminal: (terminal) => terminals.push(terminal),
    }), (error) => error === failure);

    assert.equal(scheduler.pending, 0);
    assert.equal(attention.snapshot.animating, false);
    assert.equal(attention.snapshot.cursorOwner, '');
    assert.equal(attention.captureState().request, null);
    assert.equal(clears, 1);
    let terminal = await attention.whenSettled();
    assert.equal(terminal.status, 'failed');
    assert.equal(terminal.timing.terminalReason.code, 'admission-callback-failed');
    assert.deepEqual(terminals, [terminal]);
  }
});

test('RAF milestone failures release ownership and settle exactly failed', async () => {
  for (let failingMilestone of ['first-frame', 'settled']) {
    let scheduler = createFrameScheduler();
    let terminals = [];
    let attention = new ShowAttentionController({
      cursor: {
        clear() {},
        presentFocusFrame(_target, frame) {
          return focusPlan(Number(frame.elapsedMs) || 0);
        },
      },
      resolveTarget: () => animatedTarget(scheduler.view, 'focus'),
    });
    attention.present({
      mode: 'frame',
      targetId: 'focus',
      targetIdentity: 'target:focus',
      layoutIdentity: `layout:focus:${failingMilestone}`,
      budgetMs: 500,
      onAdmission() {},
      onMilestone(milestone) {
        if (milestone.milestone === failingMilestone) {
          throw new Error(`report ${failingMilestone} failed`);
        }
      },
      onTerminal: (terminal) => terminals.push(terminal),
    });

    assert.doesNotThrow(() => scheduler.step(1000));
    if (failingMilestone === 'settled') {
      assert.doesNotThrow(() => scheduler.step(1300));
    }
    assert.equal(scheduler.pending, 0);
    assert.equal(attention.snapshot.animating, false);
    let terminal = await attention.whenSettled();
    assert.equal(terminal.status, 'failed');
    assert.equal(
      terminal.timing.terminalReason.code,
      failingMilestone === 'first-frame'
        ? 'provider-milestone-failed'
        : 'provider-settlement-failed',
    );
    assert.deepEqual(terminals, [terminal]);
  }
});

test('seek render and settled-reporting failures release frames and settle before rethrow', async () => {
  for (let failureKind of ['render', 'settled']) {
    let scheduler = createFrameScheduler();
    let failure = new Error(`seek ${failureKind} failed`);
    let terminals = [];
    let attention = new ShowAttentionController({
      cursor: {
        clear() {},
        presentFocusFrame(_target, frame) {
          let elapsedMs = Number(frame.elapsedMs) || 0;
          if (failureKind === 'render' && elapsedMs === 150) throw failure;
          return focusPlan(elapsedMs);
        },
      },
      resolveTarget: () => animatedTarget(scheduler.view, 'focus'),
    });
    attention.present({
      mode: 'frame',
      targetId: 'focus',
      targetIdentity: 'target:focus',
      layoutIdentity: `layout:focus:seek-${failureKind}`,
      budgetMs: 500,
      onAdmission() {},
      onMilestone(milestone) {
        if (failureKind === 'settled' && milestone.milestone === 'settled') throw failure;
      },
      onTerminal: (terminal) => terminals.push(terminal),
    });
    scheduler.step(1000);

    assert.throws(
      () => attention.seek(failureKind === 'render' ? 150 : 300),
      (error) => error === failure,
    );
    assert.equal(scheduler.pending, 0);
    assert.equal(attention.snapshot.animating, false);
    let terminal = await attention.whenSettled();
    assert.equal(terminal.status, 'failed');
    assert.equal(
      terminal.timing.terminalReason.code,
      failureKind === 'render' ? 'provider-render-failed' : 'provider-settlement-failed',
    );
    assert.deepEqual(terminals, [terminal]);
  }
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
