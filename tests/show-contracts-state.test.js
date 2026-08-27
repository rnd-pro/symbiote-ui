import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ShowContractError,
  SHOW_MARKER_SHAPES,
  createShowEvent,
  normalizeShowDirective,
  normalizeShowMarkerShape,
} from '../chat/show-contracts.js';
import { ShowSessionState } from '../chat/show-state.js';

test('show directives are typed and reject product-specific or unknown commands', () => {
  assert.deepEqual(normalizeShowDirective({
    type: 'attention',
    targetId: 'consumer-owned-target',
    mode: 'native-selection',
    quote: 'exact phrase',
    occurrence: 2,
  }), {
    version: 'symbiote-show-v1',
    type: 'attention',
    targetId: 'consumer-owned-target',
    mode: 'native-selection',
    quote: 'exact phrase',
    occurrence: 2,
  });
  assert.throws(
    () => normalizeShowDirective({ type: 'open-cv-article', targetId: 'article-1' }),
    (error) => error instanceof ShowContractError && error.code === 'unsupported-directive',
  );
});

test('show marker vocabulary maps the authored plural alias and rejects unknown shapes', () => {
  assert.deepEqual(normalizeShowMarkerShape('ovals'), { requested: 'ovals', canonical: 'multi-oval' });
  assert.deepEqual(normalizeShowDirective({ type: 'attention', mode: 'marker', targetId: 'target', marker: 'ovals' }), {
    version: 'symbiote-show-v1',
    type: 'attention',
    mode: 'marker',
    targetId: 'target',
    marker: 'multi-oval',
    requestedMarker: 'ovals',
  });
  assert.deepEqual(SHOW_MARKER_SHAPES, [
    'freehand', 'underline', 'oval', 'multi-oval', 'arrow', 'converging-arrows', 'route', 'bidirectional-route', 'parallel-route', 'label', 'number', 'box', 'bracket', 'slash',
  ]);
  assert.throws(
    () => normalizeShowMarkerShape('simulated-shape'),
    (error) => error instanceof ShowContractError && error.code === 'invalid-marker-shape',
  );
});

test('attention directives carry only presenter intent, target, style, seed, and cue identity', () => {
  assert.deepEqual(normalizeShowDirective({
    type: 'attention',
    mode: 'marker',
    targetId: 'consumer-target',
    intent: 'detail',
    seed: 'gesture-17',
    gestureId: 'recognized-word-42',
    cueTimeMs: 812,
    mediaTimeMs: 812,
    style: { baseWidthPx: 5, noiseAmplitudePx: 1.2 },
  }), {
    version: 'symbiote-show-v1',
    type: 'attention',
    mode: 'marker',
    targetId: 'consumer-target',
    intent: 'detail',
    seed: 'gesture-17',
    style: { baseWidthPx: 5, noiseAmplitudePx: 1.2 },
    gestureId: 'recognized-word-42',
    cueTimeMs: 812,
    mediaTimeMs: 812,
  });
  assert.throws(
    () => normalizeShowDirective({ type: 'attention', targetId: 'target', style: { durationMs: 40 } }),
    (error) => error instanceof ShowContractError && error.code === 'invalid-presenter-style',
  );
});

test('footnote, status, contextual actions, and media events have reusable envelopes', () => {
  let event = createShowEvent({
    type: 'actions',
    context: { subjectId: 'consumer-subject' },
    actions: [{ id: 'inspect', label: 'Inspect', payload: { branchId: 'details' } }],
  }, { sequence: 4, timestampMs: 1200 });
  assert.equal(event.type, 'show:actions');
  assert.equal(event.sequence, 4);
  assert.equal(event.directive.actions[0].id, 'inspect');

  assert.equal(normalizeShowDirective({ type: 'footnote', text: 'Reusable note' }).type, 'footnote');
  assert.equal(normalizeShowDirective({ type: 'status', status: 'running', text: 'Loading' }).status, 'running');
  assert.equal(normalizeShowDirective({ type: 'media', mediaId: 'clip', mode: 'full-with-media-audio' }).mode, 'full-with-media-audio');
  assert.throws(
    () => normalizeShowDirective({ type: 'media', mediaId: 'clip', mode: 'full-with-skip' }),
    (error) => error instanceof ShowContractError && error.code === 'invalid-media-mode',
  );
});

test('branch return restores the exact subject position but stays paused until explicit resume', () => {
  let events = [];
  let state = new ShowSessionState({ onEvent: (event) => events.push(event), clock: () => 42 });
  state.appendMessage({ role: 'assistant', text: 'Choose a detail.', parts: [] });
  state.setPlayback({
    episodeId: 'episode-a',
    positionMs: 8100,
    cueIndex: 3,
    playbackState: 'playing',
    subjectId: 'subject-a',
  });
  state.enterBranch('details');
  state.setPlayback({ episodeId: 'branch', positionMs: 2200, cueIndex: 1, playbackState: 'playing', subjectId: 'detail' });

  let returned = state.returnFromBranch('details');
  assert.deepEqual(returned.playback, {
    episodeId: 'episode-a',
    positionMs: 8100,
    cueIndex: 3,
    playbackState: 'paused',
    subjectId: 'subject-a',
  });
  assert.equal(returned.resumeRequired, true);
  assert.equal(returned.messages.length, 1);
  assert.equal(events.at(-1).directive.resume, 'explicit');

  state.resume();
  assert.equal(state.snapshot.playback.playbackState, 'playing');
  assert.equal(state.snapshot.resumeRequired, false);
});
