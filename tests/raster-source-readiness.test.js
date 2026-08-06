import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRasterSourceReadiness } from '../xr/raster-source-readiness.js';

function harness(overrides = {}) {
  let requests = [];
  let accepted = [];
  let released = [];
  let errors = [];
  let readiness = createRasterSourceReadiness({
    onCaptureNeeded: (request) => { requests.push(request); },
    onFrameAccepted: (generation, visualRevision, frame) => {
      accepted.push({ generation, visualRevision, frame });
    },
    onResourceRelease: (resource) => released.push(resource),
    onError: (error, details) => errors.push({ error, details }),
    ...overrides,
  });
  return { readiness, requests, accepted, released, errors };
}

test('same-generation event storms keep one active capture and one latest trailing request', () => {
  let state = harness();
  assert.equal(state.readiness.startCapture(0), true);
  assert.equal(state.readiness.markReady(0), true);
  assert.equal(state.requests.length, 1);
  let first = state.requests[0];
  assert.deepEqual(
    { generation: first.generation, visualRevision: first.visualRevision, attemptId: first.attemptId },
    { generation: 0, visualRevision: 0, attemptId: 1 },
  );

  for (let visualRevision = 1; visualRevision <= 100; visualRevision += 1) {
    assert.equal(state.readiness.markDirty(visualRevision), true);
    assert.equal(state.readiness.markReady(visualRevision), true);
  }
  assert.equal(state.requests.length, 1);
  assert.equal(first.signal.aborted, false);
  assert.equal(state.readiness.getState().pending, true);

  let firstFrame = {};
  assert.equal(first.complete(firstFrame).ok, true);
  assert.deepEqual(state.accepted, [{ generation: 0, visualRevision: 0, frame: firstFrame }]);
  assert.equal(state.requests.length, 2);
  let latest = state.requests[1];
  assert.equal(latest.visualRevision, 100);

  let latestFrame = {};
  assert.equal(latest.complete(latestFrame).ok, true);
  assert.equal(state.requests.length, 2, '100 updates must produce only leading and trailing requests');
  assert.deepEqual(state.accepted.map(({ visualRevision }) => visualRevision), [0, 100]);
  assert.deepEqual(state.released, [firstFrame]);
  assert.equal(state.readiness.getState().dirty, false);
  assert.equal(state.readiness.getState().ready, true);
});

test('a newer dirty revision waits for readiness while the active frame becomes usable', () => {
  let state = harness();
  state.readiness.startCapture(2);
  state.readiness.markReady(0);
  let active = state.requests[0];

  state.readiness.markDirty(5);
  let activeFrame = {};
  assert.equal(active.complete(activeFrame).ok, true);
  assert.equal(state.requests.length, 1);
  assert.equal(state.readiness.getState().currentFrame.resource, activeFrame);
  assert.equal(state.readiness.getState().capturing, false);
  assert.equal(state.readiness.getState().dirty, true);
  assert.equal(state.readiness.getState().ready, false);

  assert.equal(state.readiness.markReady(5), true);
  assert.equal(state.requests.length, 2);
  assert.equal(state.requests[1].visualRevision, 5);
  assert.equal(state.readiness.markReady(5), false);
  assert.equal(state.requests.length, 2);
});

test('perpetually changing ready content makes monotonic capture progress', () => {
  let state = harness();
  state.readiness.startCapture(3);
  state.readiness.markReady(0);

  for (let wave = 1; wave <= 4; wave += 1) {
    let active = state.requests.at(-1);
    let latest = wave * 10;
    for (let visualRevision = latest - 9; visualRevision <= latest; visualRevision += 1) {
      state.readiness.markDirty(visualRevision);
      state.readiness.markReady(visualRevision);
    }
    assert.equal(active.signal.aborted, false);
    assert.equal(active.complete({ visualRevision: active.visualRevision }).ok, true);
    assert.equal(state.requests.at(-1).visualRevision, latest);
  }

  let latest = state.requests.at(-1);
  assert.equal(latest.complete({ visualRevision: latest.visualRevision }).ok, true);
  assert.deepEqual(state.accepted.map(({ visualRevision }) => visualRevision), [0, 10, 20, 30, 40]);
});

test('an older completion cannot overwrite a newer accepted frame', () => {
  let state = harness();
  state.readiness.startCapture(1);
  state.readiness.markReady(0);
  let first = state.requests[0];
  state.readiness.markDirty(2);
  state.readiness.markReady(2);
  let firstFrame = { id: 'first' };
  first.complete(firstFrame);
  let latest = state.requests[1];
  let latestFrame = { id: 'latest' };
  latest.complete(latestFrame);

  let lateOlderFrame = { id: 'late-older' };
  assert.deepEqual(first.complete(lateOlderFrame), { ok: false, reason: 'stale-attempt' });
  assert.equal(state.readiness.getState().currentFrame.resource, latestFrame);
  assert.deepEqual(state.accepted.map(({ visualRevision }) => visualRevision), [0, 2]);
  assert.deepEqual(state.released, [firstFrame, lateOlderFrame]);
});

test('a new generation resets its revision namespace and releases the previous frame once', () => {
  let state = harness();
  state.readiness.startCapture(8);
  state.readiness.markReady(14);
  let firstFrame = {};
  state.requests[0].complete(firstFrame);

  assert.equal(state.readiness.startCapture(9), true);
  assert.equal(state.readiness.getState().visualRevision, -1);
  assert.deepEqual(state.released, [firstFrame]);
  assert.equal(state.readiness.markReady(0), true, 'revision zero is valid for the replacement generation');
  let nextFrame = {};
  state.requests[1].complete(nextFrame);
  state.readiness.dispose();
  state.readiness.dispose();
  assert.deepEqual(state.released, [firstFrame, nextFrame]);
});

test('a replacement generation aborts an active capture and rejects its late frame', () => {
  let state = harness();
  state.readiness.startCapture(8);
  state.readiness.markReady(14);
  let replaced = state.requests[0];

  assert.equal(state.readiness.startCapture(9), true);
  assert.equal(replaced.signal.aborted, true);
  state.readiness.markReady(0);
  assert.equal(state.requests.length, 2);
  let lateFrame = {};
  assert.deepEqual(replaced.complete(lateFrame), { ok: false, reason: 'stale-attempt' });
  assert.deepEqual(state.released, [lateFrame]);
});

test('capture rejection has one explicit retry with a fresh attempt id', () => {
  let state = harness();
  state.readiness.startCapture(1);
  state.readiness.markReady(2);
  let first = state.requests[0];
  assert.equal(first.reject(new Error('renderer unavailable')).ok, true);
  assert.equal(state.readiness.getState().dirty, true);
  assert.equal(state.readiness.getState().lastError.phase, 'capture-rejected');
  assert.equal(state.readiness.retry(), true);
  let retry = state.requests[1];
  assert.equal(retry.generation, first.generation);
  assert.equal(retry.visualRevision, first.visualRevision);
  assert.notEqual(retry.attemptId, first.attemptId);
  retry.complete({ id: 'retry-frame' });
  assert.equal(state.accepted.length, 1);
});

test('an obsolete rejection advances once to the newest ready revision', () => {
  let state = harness();
  state.readiness.startCapture(1);
  state.readiness.markReady(0);
  let obsolete = state.requests[0];
  state.readiness.markDirty(4);
  state.readiness.markReady(4);

  assert.equal(obsolete.reject(new Error('obsolete frame failed')).ok, true);
  assert.equal(state.requests.length, 2);
  let latest = state.requests[1];
  assert.equal(latest.visualRevision, 4);
  assert.equal(latest.reject(new Error('latest frame failed')).ok, true);
  assert.equal(state.requests.length, 2, 'latest rejection must not auto-loop');
  assert.equal(state.readiness.getState().lastError.visualRevision, 4);
  assert.equal(state.readiness.getState().dirty, true);

  assert.equal(state.readiness.retry(), true);
  assert.equal(state.requests.length, 3);
  assert.equal(state.requests[2].visualRevision, 4);
});

test('promise producers cannot publish late or resolve without a frame resource', async () => {
  let resolvers = [];
  let state = harness({
    onCaptureNeeded: () => new Promise((resolve) => resolvers.push(resolve)),
  });
  state.readiness.startCapture(1);
  state.readiness.markReady(0);
  state.readiness.markDirty(1);
  state.readiness.markReady(1);
  let firstFrame = {};
  resolvers[0](firstFrame);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(state.accepted.map(({ frame }) => frame), [firstFrame]);
  let currentFrame = {};
  resolvers[1](currentFrame);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(state.released, [firstFrame]);
  assert.deepEqual(state.accepted.map(({ frame }) => frame), [firstFrame, currentFrame]);

  state.readiness.markDirty(2);
  state.readiness.markReady(2);
  resolvers[2](undefined);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(state.readiness.getState().lastError.phase, 'capture-rejected');
  assert.equal(state.readiness.getState().capturing, false);
});

test('acceptance failures release the candidate and remain retryable', () => {
  let releases = [];
  let attempts = 0;
  let readiness = createRasterSourceReadiness({
    onCaptureNeeded: (request) => {
      attempts += 1;
      request.complete({ attempt: attempts });
    },
    onFrameAccepted: () => { throw new Error('texture upload failed'); },
    onResourceRelease: (resource) => releases.push(resource),
  });
  readiness.startCapture(1);
  readiness.markReady(0);
  assert.deepEqual(releases, [{ attempt: 1 }]);
  assert.equal(readiness.getState().lastError.phase, 'frame-accepted');
  assert.equal(readiness.retry(), true);
  assert.deepEqual(releases, [{ attempt: 1 }, { attempt: 2 }]);
});

test('frame acceptance cannot overwrite a generation changed reentrantly by the consumer', () => {
  let requests = [];
  let released = [];
  let readiness;
  readiness = createRasterSourceReadiness({
    onCaptureNeeded: (request) => { requests.push(request); },
    onFrameAccepted: () => {
      readiness.startCapture(2);
      readiness.markReady(0);
    },
    onResourceRelease: (resource) => released.push(resource),
  });
  readiness.startCapture(1);
  readiness.markReady(0);
  let staleFrame = { id: 'generation-1' };
  assert.deepEqual(requests[0].complete(staleFrame), {
    ok: false,
    reason: 'state-changed-during-frame-accepted',
  });
  assert.deepEqual(released, [staleFrame]);
  assert.equal(readiness.getState().generation, 2);
  assert.equal(requests[1].generation, 2);
  assert.equal(requests[1].visualRevision, 0);
});

test('dispose aborts a producer and releases each late resource exactly once', () => {
  let state = harness();
  state.readiness.startCapture(1);
  state.readiness.markReady(0);
  let request = state.requests[0];
  assert.equal(state.readiness.dispose(), true);
  assert.equal(request.signal.aborted, true);
  let late = {};
  request.complete(late);
  request.complete(late);
  assert.deepEqual(state.released, [late]);
  assert.equal(state.accepted.length, 0);
  assert.equal(state.readiness.markReady(1), false);
});

test('dispose retains primitive release tombstones for late completions', () => {
  let state = harness();
  state.readiness.startCapture(1);
  state.readiness.markReady(0);
  let request = state.requests[0];
  request.complete('blob:https://example.test/frame');
  state.readiness.dispose();
  request.complete('blob:https://example.test/frame');
  assert.deepEqual(state.released, ['blob:https://example.test/frame']);
});
