import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

import {
  SHOW_ALIGNED_SEQUENCE_VERSION,
  SHOW_AUDIO_ALIGNMENT_RESOLUTIONS,
  ShowAlignedMediaRuntime,
  ShowAttentionController,
  createShowAlignedCueSchedule,
  resolveShowAudioAnchor,
  validateShowAlignedSequence,
} from '../chat/show-runtime.js';

function alignedSequence() {
  return {
    contractVersion: SHOW_ALIGNED_SEQUENCE_VERSION,
    timelineHash: 'presentation-timeline-v3:fixture',
    media: { hash: 'sha256:recognized-audio', durationMs: 4000, locale: 'en' },
    turns: [
      {
        turnIndex: 0,
        startMs: 500,
        endMs: 2500,
        transcript: 'Alpha beta alpha closes',
        words: [
          { text: 'Alpha', startMs: 600, endMs: 800 },
          { text: 'beta', startMs: 900, endMs: 1100 },
          { text: 'alpha', startMs: 1400, endMs: 1600 },
          { text: 'closes', startMs: 1800, endMs: 2100 },
        ],
      },
    ],
    events: [],
    hash: 'workspace-aligned-sequence-v3:fixture',
  };
}

class FakeMedia extends EventTarget {
  constructor() {
    super();
    this.currentTime = 0;
    this.paused = true;
    this.readyState = 0;
    this.seekable = { length: 0, start: () => 0, end: () => 0 };
    this.src = '';
    this.preload = '';
    this.loadCount = 0;
    this.ended = false;
    this.error = null;
  }

  pause() {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }

  play() {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  }

  load() {
    this.loadCount += 1;
  }

  at(milliseconds, type = 'timeupdate') {
    this.currentTime = milliseconds / 1000;
    this.dispatchEvent(new Event(type));
  }
}

class FakePlaybackClock {
  constructor() {
    this.nextId = 1;
    this.callbacks = new Map();
  }

  get pending() {
    return this.callbacks.size;
  }

  request(callback) {
    let id = this.nextId;
    this.nextId += 1;
    this.callbacks.set(id, callback);
    return id;
  }

  cancel(id) {
    this.callbacks.delete(id);
  }

  step() {
    let pending = [...this.callbacks.values()];
    this.callbacks.clear();
    for (let callback of pending) callback();
  }
}

class FakeVisibilityDocument extends EventTarget {
  constructor() {
    super();
    this.visibilityState = 'visible';
  }

  setVisibility(value) {
    this.visibilityState = value;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

function createFrameScheduler() {
  let nextId = 0;
  let callbacks = new Map();
  return {
    get pending() {
      return callbacks.size;
    },
    requestAnimationFrame(callback) {
      let id = nextId;
      nextId += 1;
      callbacks.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      callbacks.delete(id);
    },
    step(timestamp) {
      let pending = [...callbacks.values()];
      callbacks.clear();
      for (let callback of pending) callback(timestamp);
    },
  };
}

test('workspace aligned v3 anchors preserve exact and occurrence word timing', () => {
  let sequence = alignedSequence();
  assert.equal(validateShowAlignedSequence(sequence), sequence);
  assert.deepEqual(SHOW_AUDIO_ALIGNMENT_RESOLUTIONS, ['exact', 'occurrence', 'segment']);
  let exact = resolveShowAudioAnchor(sequence, {
    turnIndex: 0,
    anchor: 'speech',
    quote: 'beta',
    occurrence: 1,
    edge: 'start',
    offsetMs: 0,
  });
  let occurrence = resolveShowAudioAnchor(sequence, {
    turnIndex: 0,
    anchor: 'speech',
    quote: 'alpha',
    occurrence: 2,
    edge: 'end',
    offsetMs: 0,
  });

  assert.equal(exact.timeMs, 900);
  assert.equal(exact.resolution, 'exact');
  assert.equal(exact.confidence, 'high');
  assert.equal(exact.provenance.source, 'recognized-word');
  assert.deepEqual(exact.provenance.wordIndexes, [1]);
  assert.equal(occurrence.timeMs, 1600);
  assert.equal(occurrence.resolution, 'occurrence');
  assert.deepEqual(occurrence.provenance.wordIndexes, [2]);
});

test('provider accepts the v3 artifact unchanged but never consumes its legacy interpolated event time', () => {
  let sequence = alignedSequence();
  sequence.events = [{
    cueId: '0.0',
    turnIndex: 0,
    kind: 'focus',
    startMs: 1733,
    endMs: 1733,
    resolution: 'interpolated',
    confidence: 'low',
  }];
  let schedule = createShowAlignedCueSchedule(sequence, [{
    cueId: '0.0',
    turnIndex: 0,
    at: { anchor: 'speech', quote: 'missing phrase', occurrence: 1, edge: 'start', offsetMs: 0 },
    directive: { type: 'attention', mode: 'cursor', targetId: 'target' },
  }]);

  assert.equal(validateShowAlignedSequence(sequence), sequence);
  assert.equal(sequence.events[0].startMs, 1733);
  assert.equal(schedule[0].timeMs, 500);
  assert.equal(schedule[0].alignment.resolution, 'segment');
});

test('missing or rejected word evidence falls back to a real segment boundary without interpolation', () => {
  let sequence = alignedSequence();
  let missingStart = resolveShowAudioAnchor(sequence, {
    turnIndex: 0,
    anchor: 'speech',
    quote: 'not recognized',
    occurrence: 1,
    edge: 'start',
    offsetMs: 0,
  });
  let rejectedEnd = resolveShowAudioAnchor(sequence, {
    turnIndex: 0,
    anchor: 'speech',
    quote: 'beta',
    occurrence: 1,
    edge: 'end',
    offsetMs: 0,
  }, { isWordReliable: () => false });

  assert.deepEqual(
    { timeMs: missingStart.timeMs, resolution: missingStart.resolution, confidence: missingStart.confidence },
    { timeMs: 500, resolution: 'segment', confidence: 'low' },
  );
  assert.equal(missingStart.provenance.source, 'recognized-segment');
  assert.deepEqual(missingStart.provenance.segment, { startMs: 500, endMs: 2500 });
  assert.equal(missingStart.provenance.fallbackReason, 'word-anchor-missing');
  assert.equal(rejectedEnd.timeMs, 2500);
  assert.equal(rejectedEnd.provenance.fallbackReason, 'word-evidence-unreliable');
  assert.equal('interpolatedTimeMs' in rejectedEnd.provenance, false);
});

test('crossed or zero-duration recognized words remain valid v3 input but are treated as unreliable evidence', () => {
  let sequence = alignedSequence();
  sequence.turns[0].words = [
    { text: 'alpha', startMs: 1400, endMs: 1600 },
    { text: 'beta', startMs: 900, endMs: 900 },
  ];
  let resolved = resolveShowAudioAnchor(sequence, {
    turnIndex: 0,
    anchor: 'speech',
    quote: 'alpha',
    occurrence: 1,
    edge: 'start',
    offsetMs: 0,
  }, { segmentConfidence: 'medium' });

  assert.equal(resolved.timeMs, 500);
  assert.equal(resolved.resolution, 'segment');
  assert.equal(resolved.confidence, 'medium');
  assert.equal(resolved.provenance.fallbackReason, 'word-evidence-unreliable');
});

test('browser seam fires attention from recognized media time and restores across pause, seek, and branch return', async () => {
  let { window } = parseHTML('<!doctype html><html><body><div id="marker"></div><div id="focus"></div></body></html>');
  let presented = [];
  let resets = [];
  let attention = new ShowAttentionController({
    resolveTarget: (id) => window.document.getElementById(id),
    cursor: {
      clear: () => {},
      clearAccumulatedAnnotations: () => {},
      presentAnnotationFrame: (_target, annotation) => {
        presented.push(`marker:${annotation.marker}`);
        return { presented: true, name: annotation.marker };
      },
      presentFocusFrame: (target) => {
        presented.push(`focus:${target.id}`);
        return { presented: true, mode: 'cursor' };
      },
    },
  });
  let schedule = createShowAlignedCueSchedule(alignedSequence(), [
    {
      cueId: 'marker-cue',
      turnIndex: 0,
      at: { anchor: 'speech', quote: 'beta', occurrence: 1, edge: 'start', offsetMs: 0 },
      directive: { type: 'attention', mode: 'marker', targetId: 'marker', marker: 'oval' },
    },
    {
      cueId: 'focus-cue',
      turnIndex: 0,
      at: { anchor: 'speech', quote: 'unrecognized phrase', occurrence: 1, edge: 'end', offsetMs: 0 },
      directive: { type: 'attention', mode: 'cursor', targetId: 'focus' },
    },
  ]);
  let media = new FakeMedia();
  let runtime = new ShowAlignedMediaRuntime({
    media,
    schedule,
    onReset: (receipt) => {
      resets.push(receipt.reason);
      attention.clearTransient();
      attention.clearMarkers();
    },
    onCue: ({ cue }) => attention.present(cue.directive),
  });

  media.at(899);
  assert.deepEqual(presented, []);
  media.at(900);
  assert.deepEqual(presented, ['marker:oval']);

  media.pause();
  await media.play();
  media.at(1200);
  assert.deepEqual(presented, ['marker:oval']);

  media.at(400, 'seeked');
  assert.equal(resets.at(-1), 'seeked');
  media.at(900);
  assert.deepEqual(presented, ['marker:oval', 'marker:oval']);

  media.pause();
  runtime.restorePlayback({ positionMs: 2500 }, { reason: 'branch-return' });
  assert.equal(media.currentTime, 2.5);
  assert.equal(resets.at(-1), 'branch-return');
  assert.deepEqual(presented, ['marker:oval', 'marker:oval']);
  assert.equal(schedule[1].alignment.resolution, 'segment');
  runtime.dispose();
});

test('owned native seek retains a nonzero branch checkpoint through initial zero and unavailable seekable evidence', () => {
  let schedule = createShowAlignedCueSchedule(alignedSequence(), [{
    cueId: 'checkpoint-cue',
    turnIndex: 0,
    at: { anchor: 'speech', quote: 'beta', occurrence: 1, edge: 'start', offsetMs: 0 },
    directive: { type: 'attention', mode: 'cursor', targetId: 'focus' },
  }]);
  let media = new FakeMedia();
  let resets = [];
  let cues = [];
  let runtime = new ShowAlignedMediaRuntime({
    media,
    schedule,
    onReset: (receipt) => resets.push(receipt),
    onCue: (receipt) => cues.push(receipt),
  });

  runtime.restorePlayback({ positionMs: 214 }, { reason: 'branch-return' });
  media.at(0, 'seeking');
  media.at(0, 'timeupdate');
  media.at(0, 'seeked');
  assert.equal(media.currentTime, 0);

  media.readyState = 4;
  media.seekable = { length: 1, start: () => 0, end: () => 4 };
  media.dispatchEvent(new Event('progress'));
  assert.equal(media.currentTime, 0.214);
  media.at(215, 'seeking');
  media.at(215, 'seeked');

  assert.equal(media.paused, true);
  assert.deepEqual(resets.at(-1), { reason: 'branch-return', mediaTimeMs: 214 });
  assert.deepEqual(cues, []);

  media.at(400, 'seeking');
  media.at(400, 'seeked');
  assert.deepEqual(resets.at(-1), { reason: 'seeked', mediaTimeMs: 400 });
  runtime.dispose();
});

test('Project transport seek owns native seek events without resetting presentation state', () => {
  let media = new FakeMedia();
  let clock = new FakePlaybackClock();
  let resets = [];
  let cues = [];
  let runtime = new ShowAlignedMediaRuntime({
    media,
    schedule: [
      { cueId: 'past', timeMs: 1000, alignment: { provenance: { mediaDurationMs: 4000 } } },
      { cueId: 'future', timeMs: 3000, alignment: { provenance: { mediaDurationMs: 4000 } } },
    ],
    onReset: (receipt) => resets.push(receipt),
    onCue: (receipt) => cues.push(receipt),
    playbackClock: {
      request: (callback) => clock.request(callback),
      cancel: (id) => clock.cancel(id),
    },
  });

  media.currentTime = 1.25;
  runtime.restore(1250, { reason: 'fixture' });
  resets.length = 0;
  cues.length = 0;
  media.paused = false;
  media.dispatchEvent(new Event('play'));
  assert.equal(clock.pending, 1);

  runtime.seekTransport(750, { reason: 'project-audio-clip' });
  runtime.seekTransport(250, { reason: 'project-audio-clip' });
  assert.equal(media.currentTime, 0.25);
  assert.equal(clock.pending, 0);
  media.dispatchEvent(new Event('seeking'));
  media.dispatchEvent(new Event('seeked'));
  assert.deepEqual(resets, []);
  assert.equal(clock.pending, 1);
  media.at(1500, 'timeupdate');
  assert.deepEqual(cues, [], 'transport seek keeps previously fired presentation cues owned');

  runtime.seek(500, { reason: 'user-seek' });
  assert.deepEqual(resets, [{ reason: 'user-seek', mediaTimeMs: 500 }]);
  assert.equal(clock.pending, 0);
  media.dispatchEvent(new Event('seeking'));
  media.dispatchEvent(new Event('seeked'));
  assert.deepEqual(resets, [{ reason: 'user-seek', mediaTimeMs: 500 }]);
  assert.equal(clock.pending, 1);

  runtime.dispose();
  assert.equal(clock.pending, 0);
});

test('atomic aligned playback owns source load generation before restoring a paused checkpoint', async () => {
  let media = new FakeMedia();
  let resets = [];
  let cues = [];
  let failures = [];
  let runtime = new ShowAlignedMediaRuntime({
    media,
    schedule: [],
    onReset: (receipt) => resets.push(receipt),
    onCue: (receipt) => cues.push(receipt),
    onSeekFailure: (receipt) => failures.push(receipt),
  });

  let terminal = runtime.loadAndRestorePlayback({
    source: 'recognized.wav',
    positionMs: 238,
    paused: true,
    preload: 'auto',
  }, { reason: 'branch-return' });

  assert.equal(media.src, 'recognized.wav');
  assert.equal(media.preload, 'auto');
  assert.equal(media.loadCount, 1);
  assert.equal(media.currentTime, 0, 'checkpoint is not assigned before generation metadata');
  assert.deepEqual(resets, [{ reason: 'branch-return', mediaTimeMs: 238 }]);
  assert.deepEqual(cues, []);

  media.dispatchEvent(new Event('abort'));
  media.dispatchEvent(new Event('emptied'));
  media.dispatchEvent(new Event('loadstart'));
  media.readyState = 1;
  media.dispatchEvent(new Event('loadedmetadata'));
  assert.equal(media.currentTime, 0.238);

  media.at(238, 'seeking');
  media.at(238, 'seeked');
  media.at(0, 'timeupdate');
  assert.equal(await Promise.race([terminal.then(() => 'settled'), Promise.resolve('pending')]), 'pending');

  media.readyState = 4;
  media.seekable = { length: 1, start: () => 0, end: () => 4 };
  media.dispatchEvent(new Event('loadeddata'));
  assert.equal(media.currentTime, 0.238, 'current-data readiness reasserts after a same-generation transient reset');
  media.at(238, 'seeking');
  media.at(238, 'seeked');

  assert.deepEqual(await terminal, {
    status: 'completed',
    reason: 'branch-return',
    terminalReason: 'completed',
    operationId: 1,
    requestedMs: 238,
    observedMs: 238,
    phase: 'completed',
    source: 'recognized.wav',
    generation: 1,
  });
  assert.deepEqual(failures, []);
  assert.equal(media.paused, true);

  media.at(400, 'seeking');
  media.at(400, 'seeked');
  assert.deepEqual(resets.at(-1), { reason: 'seeked', mediaTimeMs: 400 });
  runtime.dispose();
});

test('runtime-owned playback clock delivers sparse crossed cues once and cleans every lifecycle edge', async () => {
  let media = new FakeMedia();
  let clock = new FakePlaybackClock();
  let document = new FakeVisibilityDocument();
  let cues = [];
  let resets = [];
  let runtime = new ShowAlignedMediaRuntime({
    media,
    schedule: [
      { cueId: 'first', timeMs: 2320, alignment: { provenance: { mediaDurationMs: 5000 } } },
      { cueId: 'second', timeMs: 2800, alignment: { provenance: { mediaDurationMs: 5000 } } },
      { cueId: 'third', timeMs: 3500, alignment: { provenance: { mediaDurationMs: 5000 } } },
    ],
    onCue: (receipt) => cues.push(receipt),
    onReset: (receipt) => resets.push(receipt),
    playbackClock: {
      request: (callback) => clock.request(callback),
      cancel: (id) => clock.cancel(id),
      document,
    },
  });

  let terminal = runtime.loadAndRestorePlayback({
    source: 'recognized.wav',
    positionMs: 297,
    paused: true,
  }, { reason: 'branch-return' });
  media.dispatchEvent(new Event('emptied'));
  media.dispatchEvent(new Event('loadstart'));
  media.readyState = 1;
  media.dispatchEvent(new Event('loadedmetadata'));
  media.readyState = 4;
  media.at(297, 'seeking');
  media.at(297, 'seeked');
  assert.equal((await terminal).status, 'completed');
  assert.equal(clock.pending, 0);

  await runtime.resume();
  assert.equal(clock.pending, 1);
  media.currentTime = 2.5;
  clock.step();
  assert.deepEqual(cues.map(({ cue, reason }) => [cue.cueId, reason]), [['first', 'playback-clock']]);
  assert.equal(clock.pending, 1);

  media.currentTime = 3.7;
  clock.step();
  assert.deepEqual(cues.map(({ cue }) => cue.cueId), ['first', 'second', 'third']);
  assert.equal(clock.pending, 0, 'clock stops once no future cue remains');

  media.pause();
  await runtime.resume();
  assert.equal(clock.pending, 0, 'resume at the same time does not restart an exhausted clock');
  assert.deepEqual(cues.map(({ cue }) => cue.cueId), ['first', 'second', 'third']);

  runtime.seek(500, { reason: 'seek' });
  media.dispatchEvent(new Event('seeking'));
  media.dispatchEvent(new Event('seeked'));
  assert.deepEqual(resets.at(-1), { reason: 'seek', mediaTimeMs: 500 });
  assert.equal(clock.pending, 1);
  media.currentTime = 2.5;
  clock.step();
  assert.deepEqual(cues.map(({ cue }) => cue.cueId), ['first', 'second', 'third', 'first']);

  document.setVisibility('hidden');
  assert.equal(clock.pending, 0);
  media.currentTime = 3.7;
  document.setVisibility('visible');
  assert.deepEqual(cues.map(({ cue }) => cue.cueId), ['first', 'second', 'third', 'first', 'second', 'third']);
  assert.equal(clock.pending, 0);

  media.currentTime = 0.5;
  media.dispatchEvent(new Event('seeking'));
  media.dispatchEvent(new Event('seeked'));
  assert.equal(clock.pending, 1);
  media.ended = true;
  media.dispatchEvent(new Event('ended'));
  assert.equal(clock.pending, 0);
  media.ended = false;
  await runtime.resume();
  assert.equal(clock.pending, 1);
  media.error = { code: 3 };
  media.dispatchEvent(new Event('error'));
  assert.equal(clock.pending, 0);
  media.error = null;
  await runtime.resume();
  assert.equal(clock.pending, 1);
  runtime.dispose();
  assert.equal(clock.pending, 0);
  assert.equal(runtime.playbackClockState.active, false);
});

test('direct native play starts the same runtime-owned cue clock', () => {
  let media = new FakeMedia();
  let clock = new FakePlaybackClock();
  let cues = [];
  let runtime = new ShowAlignedMediaRuntime({
    media,
    schedule: [{ cueId: 'native', timeMs: 1000, alignment: { provenance: { mediaDurationMs: 2000 } } }],
    onCue: (receipt) => cues.push(receipt),
    playbackClock: {
      request: (callback) => clock.request(callback),
      cancel: (id) => clock.cancel(id),
    },
  });
  runtime.restore(0, { reason: 'fixture' });

  media.play();
  assert.equal(clock.pending, 1);
  media.currentTime = 1.5;
  clock.step();
  assert.deepEqual(cues.map(({ cue, reason }) => [cue.cueId, reason]), [['native', 'playback-clock']]);
  assert.equal(clock.pending, 0);
  runtime.dispose();
});

test('playback clock request and cleanup preserve default and injected receivers', async () => {
  let originalSetTimeout = globalThis.setTimeout;
  let originalClearTimeout = globalThis.clearTimeout;
  let defaultHandles = new Set();
  let defaultRequestCount = 0;
  let defaultCancelCount = 0;
  let nextHandle = 0;
  globalThis.setTimeout = function receiverSensitiveSetTimeout() {
    assert.equal(this, globalThis, 'default request must retain the global receiver');
    let handle = ++nextHandle;
    defaultHandles.add(handle);
    defaultRequestCount += 1;
    return handle;
  };
  globalThis.clearTimeout = function receiverSensitiveClearTimeout(handle) {
    assert.equal(this, globalThis, 'default cancel must retain the global receiver');
    defaultHandles.delete(handle);
    defaultCancelCount += 1;
  };

  try {
    let media = new FakeMedia();
    let document = new FakeVisibilityDocument();
    let runtime = new ShowAlignedMediaRuntime({
      media,
      schedule: [{ cueId: 'future', timeMs: 1000, alignment: { provenance: { mediaDurationMs: 2000 } } }],
      playbackClock: { document },
    });
    runtime.restore(0, { reason: 'fixture' });

    media.play();
    assert.equal(runtime.playbackClockState.active, true);
    assert.doesNotThrow(() => media.pause());
    assert.equal(runtime.playbackClockState.active, false);

    await runtime.resume();
    assert.doesNotThrow(() => document.setVisibility('hidden'));
    assert.equal(runtime.playbackClockState.active, false);
    document.setVisibility('visible');
    assert.equal(runtime.playbackClockState.active, true);
    assert.doesNotThrow(() => media.dispatchEvent(new Event('seeking')));
    assert.equal(runtime.playbackClockState.active, false);

    media.dispatchEvent(new Event('seeked'));
    assert.equal(runtime.playbackClockState.active, true);
    media.ended = true;
    assert.doesNotThrow(() => media.dispatchEvent(new Event('ended')));
    assert.equal(runtime.playbackClockState.active, false);
    media.ended = false;

    await runtime.resume();
    media.error = { code: 3 };
    assert.doesNotThrow(() => media.dispatchEvent(new Event('error')));
    assert.equal(runtime.playbackClockState.active, false);
    media.error = null;

    await runtime.resume();
    assert.doesNotThrow(() => runtime.pause(), 'Stop/pause cleanup must preserve the cancel receiver');
    await runtime.resume();
    assert.doesNotThrow(() => runtime.dispose());
    assert.equal(runtime.playbackClockState.active, false);
    assert.equal(defaultHandles.size, 0);
    assert.ok(defaultRequestCount >= 7);
    assert.equal(defaultCancelCount, defaultRequestCount);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }

  let injectedClock = {
    handles: new Set(),
    nextHandle: 0,
    request(callback) {
      assert.equal(this, injectedClock, 'injected request must retain its clock receiver');
      let handle = ++this.nextHandle;
      this.handles.add(handle);
      return handle;
    },
    cancel(handle) {
      assert.equal(this, injectedClock, 'injected cancel must retain its clock receiver');
      this.handles.delete(handle);
    },
  };
  let media = new FakeMedia();
  let runtime = new ShowAlignedMediaRuntime({
    media,
    schedule: [{ cueId: 'future', timeMs: 1000, alignment: { provenance: { mediaDurationMs: 2000 } } }],
    playbackClock: injectedClock,
  });
  runtime.restore(0, { reason: 'fixture' });
  assert.doesNotThrow(() => media.play());
  assert.equal(runtime.playbackClockState.active, true);
  assert.doesNotThrow(() => runtime.dispose());
  assert.equal(injectedClock.handles.size, 0);
});

test('legacy preattach load and preseek cannot own a later same-source reset', () => {
  let media = new FakeMedia();
  media.src = 'recognized.wav';
  media.load();
  media.currentTime = 0.238;
  let resets = [];
  let runtime = new ShowAlignedMediaRuntime({
    media,
    schedule: [],
    onReset: (receipt) => resets.push(receipt),
  });

  runtime.restorePlayback({ positionMs: 238 }, { reason: 'branch-return' });
  media.readyState = 4;
  media.at(238, 'seeked');
  media.at(0, 'seeked');

  assert.deepEqual(resets, [
    { reason: 'branch-return', mediaTimeMs: 238 },
    { reason: 'seeked', mediaTimeMs: 0 },
  ]);
  runtime.dispose();
});

test('atomic aligned playback returns immutable terminal receipts for replacement, source drift, error, timeout, and dispose', async () => {
  let originalTimeout = AbortSignal.timeout;
  let timeoutControllers = [];
  AbortSignal.timeout = () => {
    let controller = new AbortController();
    timeoutControllers.push(controller);
    return controller.signal;
  };
  try {
    let media = new FakeMedia();
    let failures = [];
    let runtime = new ShowAlignedMediaRuntime({
      media,
      schedule: [],
      onSeekFailure: (receipt) => failures.push(receipt),
    });

    let replaced = runtime.loadAndRestorePlayback({ source: 'one.wav', positionMs: 238 });
    let replacement = runtime.loadAndRestorePlayback({ source: 'two.wav', positionMs: 344 });
    assert.equal((await replaced).status, 'cancelled');
    assert.equal((await replaced).terminalReason, 'replaced');

    media.src = 'external.wav';
    media.dispatchEvent(new Event('loadedmetadata'));
    assert.equal((await replacement).terminalReason, 'source-replaced');

    let errored = runtime.loadAndRestorePlayback({ source: 'error.wav', positionMs: 238 });
    media.dispatchEvent(new Event('error'));
    assert.equal((await errored).status, 'failed');
    assert.equal((await errored).terminalReason, 'media-error');

    let timedOut = runtime.loadAndRestorePlayback({ source: 'timeout.wav', positionMs: 238 });
    timeoutControllers.at(-1).abort();
    assert.equal((await timedOut).terminalReason, 'timeout');

    let disposed = runtime.loadAndRestorePlayback({ source: 'dispose.wav', positionMs: 238 });
    runtime.dispose();
    assert.equal((await disposed).status, 'cancelled');
    assert.equal((await disposed).terminalReason, 'disposed');
    assert.equal(Object.isFrozen(await disposed), true);
    assert.deepEqual(
      failures.map(({ status, terminalReason }) => ({ status, terminalReason })),
      [
        { status: 'cancelled', terminalReason: 'replaced' },
        { status: 'cancelled', terminalReason: 'source-replaced' },
        { status: 'failed', terminalReason: 'media-error' },
        { status: 'failed', terminalReason: 'timeout' },
        { status: 'cancelled', terminalReason: 'disposed' },
      ],
    );
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});

test('owned seek replacement, pause, timeout, error, and dispose never leak stale suppression', () => {
  let originalTimeout = AbortSignal.timeout;
  let timeoutControllers = [];
  AbortSignal.timeout = () => {
    let controller = new AbortController();
    timeoutControllers.push(controller);
    return controller.signal;
  };
  try {
    let media = new FakeMedia();
    let resets = [];
    let failures = [];
    let runtime = new ShowAlignedMediaRuntime({
      media,
      schedule: [],
      onReset: (receipt) => resets.push(receipt),
      onSeekFailure: (receipt) => failures.push(receipt),
    });

    runtime.restorePlayback({ positionMs: 900 }, { reason: 'seek' });
    runtime.restorePlayback({ positionMs: 2500 }, { reason: 'branch-return' });
    media.at(0, 'seeking');
    runtime.pause();
    media.at(0, 'seeked');
    assert.deepEqual(resets.at(-1), { reason: 'branch-return', mediaTimeMs: 2500 });

    runtime.restorePlayback({ positionMs: 1800 }, { reason: 'branch-return' });
    media.currentTime = 0;
    timeoutControllers.at(-1).abort();
    assert.deepEqual(
      failures.map(({ status, reason, requestedMs, observedMs }) => ({ status, reason, requestedMs, observedMs })),
      [{ status: 'failed', reason: 'timeout', requestedMs: 1800, observedMs: 0 }],
    );
    media.at(300, 'seeked');
    assert.deepEqual(resets.at(-1), { reason: 'seeked', mediaTimeMs: 300 });

    media.src = 'recognized.wav';
    runtime.restorePlayback({ positionMs: 1600 }, { reason: 'branch-return' });
    media.dispatchEvent(new Event('emptied'));
    media.at(0, 'seeked');
    assert.deepEqual(resets.at(-1), { reason: 'branch-return', mediaTimeMs: 1600 });

    runtime.restorePlayback({ positionMs: 1400 }, { reason: 'branch-return' });
    media.src = 'replacement.wav';
    media.dispatchEvent(new Event('emptied'));
    media.at(250, 'seeked');
    assert.deepEqual(resets.at(-1), { reason: 'seeked', mediaTimeMs: 250 });

    runtime.restorePlayback({ positionMs: 1400 }, { reason: 'branch-return' });
    media.dispatchEvent(new Event('error'));
    assert.deepEqual(
      failures.map(({ status, reason, requestedMs }) => ({ status, reason, requestedMs })),
      [
        { status: 'failed', reason: 'timeout', requestedMs: 1800 },
        { status: 'failed', reason: 'media-error', requestedMs: 1400 },
      ],
    );
    media.at(200, 'seeked');
    assert.deepEqual(resets.at(-1), { reason: 'seeked', mediaTimeMs: 200 });

    runtime.restorePlayback({ positionMs: 1200 }, { reason: 'branch-return' });
    let resetCount = resets.length;
    runtime.dispose();
    media.at(100, 'seeked');
    assert.equal(resets.length, resetCount);
    assert.equal(failures.length, 2);
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});

test('paused branch restoration clears presenter attention and resume presents only the next cue once', async () => {
  let { window } = parseHTML('<!doctype html><html><body><div id="focus"></div></body></html>');
  let scheduler = createFrameScheduler();
  window.requestAnimationFrame = scheduler.requestAnimationFrame;
  window.cancelAnimationFrame = scheduler.cancelAnimationFrame;
  let frameCalls = [];
  let attention = new ShowAttentionController({
    resolveTarget: (id) => window.document.getElementById(id),
    cursor: {
      clear: () => {},
      presentFocusFrame: (_target, frame = {}) => {
        let elapsedMs = Number(frame.elapsedMs) || 0;
        frameCalls.push(elapsedMs);
        return {
          presented: true,
          durationMs: 200,
          elapsedMs,
          revealProgress: Math.min(1, elapsedMs / 200),
        };
      },
    },
  });
  let schedule = createShowAlignedCueSchedule(alignedSequence(), [{
    cueId: 'focus-cue',
    turnIndex: 0,
    at: { anchor: 'speech', quote: 'beta', occurrence: 1, edge: 'start', offsetMs: 0 },
    directive: { type: 'attention', mode: 'frame', targetId: 'focus' },
  }]);
  let media = new FakeMedia();
  let runtime = new ShowAlignedMediaRuntime({
    media,
    schedule,
    onReset: () => attention.clearTransient(),
    onCue: ({ cue }) => attention.present(cue.directive),
  });

  media.at(900);
  let firstAnimation = attention.whenSettled();
  assert.equal(scheduler.pending, 1);

  runtime.restorePlayback({ positionMs: 400 }, { reason: 'seek' });
  assert.equal((await firstAnimation).status, 'cleared');
  assert.equal(scheduler.pending, 0);
  media.at(400, 'seeked');

  media.at(900);
  let replayBeforeBranch = attention.whenSettled();
  assert.equal(scheduler.pending, 1);
  runtime.restorePlayback({ positionMs: 899 }, { reason: 'branch-return' });
  assert.equal((await replayBeforeBranch).status, 'cleared');
  assert.equal(scheduler.pending, 0);
  media.at(899, 'seeked');

  await runtime.resume();
  media.at(900);
  assert.equal(scheduler.pending, 1);

  let callsBeforeSettling = frameCalls.length;
  scheduler.step(1000);
  scheduler.step(1100);
  scheduler.step(1200);
  assert.equal((await attention.whenSettled()).status, 'settled');
  assert.deepEqual(frameCalls.slice(callsBeforeSettling), [0, 100, 200]);
  assert.equal(scheduler.pending, 0);
  media.at(901);
  assert.equal(frameCalls.length, callsBeforeSettling + 3);
  runtime.dispose();
});
