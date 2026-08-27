import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ShowAudioArbiter } from '../chat/show-audio.js';
import { ShowMediaController } from '../chat/show-media.js';
import {
  waitForShowDocumentReady,
  waitForShowDomReadiness,
  waitForShowElement,
  waitForShowMediaReady,
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

test('DOM readiness scrolls a resolved target and settles two animation frames', async () => {
  let frames = [];
  let scrollOptions = null;
  let target = {
    scrollIntoView(options) { scrollOptions = options; },
  };
  let doc = eventTarget({
    readyState: 'complete',
    fonts: { ready: Promise.resolve() },
    defaultView: {
      requestAnimationFrame(callback) {
        frames.push(callback);
        queueMicrotask(callback);
      },
    },
  });

  let result = await waitForShowDomReadiness({ document: doc, target });

  assert.equal(result.target, target);
  assert.deepEqual(scrollOptions, { block: 'center', inline: 'nearest', behavior: 'smooth' });
  assert.equal(frames.length, 2);
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
