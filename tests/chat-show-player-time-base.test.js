import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  resolveChatShowProgress,
  resolveChatShowTimelineGeometry,
  resolveChatShowTimelinePosition,
} from '../chat/chat-show-time-base.js';
import { CHAT_SHOW_PLAYER_CONTRACT } from '../chat/show-player-contract.js';

const playerStyles = new URL('../chat/ChatShowPlayer/ChatShowPlayer.css.js', import.meta.url);
const playerSource = new URL('../chat/ChatShowPlayer/ChatShowPlayer.js', import.meta.url);

// A duration-weighted timeline: turns tile one contiguous clock of 4 s.
const legacyTurns = [
  { id: 'one', durationMs: 1_000 },
  { id: 'two', durationMs: 2_000 },
  { id: 'three', durationMs: 1_000 },
];

// A host-absolute composition whose short mode plays only the scene turns. The
// detail branches (5–20 s and 24–30 s) are composition spans no turn covers, so
// the visible clock stays the master 40 s clock and the seeks stay honest.
const compositionTurns = [
  { id: 'scene-1', startMs: 0, durationMs: 5_000 },
  { id: 'scene-2', startMs: 20_000, durationMs: 4_000 },
  { id: 'scene-3', startMs: 30_000, durationMs: 10_000 },
];

function styleValue(style, name) {
  let match = style.match(new RegExp(`${name}:([^;]+)`));
  return match ? match[1] : null;
}

function readSegment(style) {
  return {
    weight: styleValue(style, '--chat-show-progress-weight'),
    fill: styleValue(style, '--chat-show-progress-fill'),
    gap: styleValue(style, '--chat-show-progress-gap'),
  };
}

function assertClose(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(Number(actual) - expected) < tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test('the time base is opt-in: legacy turns stay duration-weighted', () => {
  let geometry = resolveChatShowTimelineGeometry({ turns: legacyTurns });

  assert.equal(geometry.mode, 'weighted');
  assert.equal(geometry.totalMs, 4_000, 'the legacy total is the sum of the turn durations');
  assert.equal(geometry.seekable, true);
  assert.deepEqual(geometry.turns.map(({ durationMs }) => durationMs), [1_000, 2_000, 1_000]);
});

test('the time base is opt-in: one missing startMs keeps the legacy projection', () => {
  // Any turn without a finite non-negative startMs means the host did not opt
  // in, so the whole timeline stays duration-weighted.
  let mixed = [
    { startMs: 0, durationMs: 5_000 },
    { durationMs: 4_000 },
  ];
  assert.equal(resolveChatShowTimelineGeometry({ turns: mixed }).mode, 'weighted');
  assert.equal(
    resolveChatShowTimelineGeometry({ turns: [{ startMs: -1, durationMs: 1_000 }] }).mode,
    'weighted',
  );
  assert.equal(
    resolveChatShowTimelineGeometry({ turns: [{ startMs: null, durationMs: 1_000 }] }).mode,
    'weighted',
    'a nullish startMs must not read as the composition origin',
  );
  assert.equal(
    resolveChatShowTimelineGeometry({ turns: [{ startMs: 0, durationMs: 0 }] }).seekable,
    false,
    'a zero duration is never seekable',
  );
});

test('absolute turns resolve the composition total from the latest turn end', () => {
  let geometry = resolveChatShowTimelineGeometry({ turns: compositionTurns });

  assert.equal(geometry.mode, 'absolute');
  assert.equal(geometry.totalMs, 40_000, 'the total is the last turn end, gaps included');
  assert.equal(geometry.seekable, true);
  assert.deepEqual(geometry.turns, [
    { startMs: 0, durationMs: 5_000 },
    { startMs: 20_000, durationMs: 4_000 },
    { startMs: 30_000, durationMs: 10_000 },
  ]);
});

test('a declared timeline total overrides the computed maximum turn end', () => {
  let geometry = resolveChatShowTimelineGeometry({ turns: compositionTurns, totalMs: 50_000 });

  assert.equal(geometry.mode, 'absolute');
  assert.equal(geometry.totalMs, 50_000, 'the host owns the tail its turns never reach');
  // A zero or absent declaration is not an override: it would collapse the clock.
  assert.equal(resolveChatShowTimelineGeometry({ turns: compositionTurns, totalMs: 0 }).totalMs, 40_000);
});

test('absolute progress reads the composition clock for the first, middle and last turn', () => {
  let timeline = { turns: compositionTurns };

  let first = resolveChatShowProgress(timeline, 0, { progress: { positionMs: 0 } }, {});
  assert.equal(first.elapsedMs, 0);
  assert.equal(first.totalMs, 40_000);
  assert.equal(first.now, 0);
  assert.equal(first.value, 0);
  assert.equal(first.max, 40);
  assert.equal(first.text, '1 / 3 · 0:00 / 0:40');
  assert.equal(first.seekable, true);
  assert.deepEqual(first.segments.map(({ style }) => readSegment(style)), [
    { weight: '5000', fill: '0', gap: '0' },
    { weight: '4000', fill: '0', gap: '37.5' },
    { weight: '10000', fill: '0', gap: '15' },
  ]);

  // Scene 2 starts 20 s into the composition, so half a second into it the
  // clock reads 20.5 s of 40 s, while the segment fill stays turn-local.
  let middle = resolveChatShowProgress(timeline, 1, { progress: { positionMs: 500 } }, {});
  assert.equal(middle.elapsedMs, 20_500);
  assert.equal(middle.totalMs, 40_000);
  assert.equal(middle.now, 51, 'Math.round(20500 / 40000 * 100)');
  assert.equal(middle.value, 21);
  assert.equal(middle.max, 40);
  assert.equal(middle.elapsedLabel, '0:20');
  assert.equal(middle.totalLabel, '0:40');
  assert.deepEqual(middle.segments.map(({ style }) => readSegment(style)), [
    { weight: '5000', fill: '1', gap: '0' },
    { weight: '4000', fill: '0.125', gap: '37.5' },
    { weight: '10000', fill: '0', gap: '15' },
  ]);

  let last = resolveChatShowProgress(timeline, 2, { progress: { positionMs: 2_500 } }, {});
  assert.equal(last.elapsedMs, 32_500);
  assert.equal(last.totalMs, 40_000);
  assert.equal(last.now, 81, 'Math.round(32500 / 40000 * 100)');
  assert.equal(last.text, '3 / 3 · 0:32 / 0:40');
  assert.deepEqual(last.segments.map(({ style }) => readSegment(style)).map(({ fill }) => fill), ['1', '1', '0.25']);
});

test('absolute progress reports a declared total past the last turn', () => {
  let geometry = resolveChatShowTimelineGeometry({ turns: compositionTurns, totalMs: 50_000 });
  let progress = resolveChatShowProgress(geometry, 2, { progress: { positionMs: 0 } }, {});

  assert.equal(progress.elapsedMs, 30_000);
  assert.equal(progress.totalMs, 50_000);
  assert.equal(progress.now, 60);
  assert.equal(progress.max, 50);
});

test('absolute progress clamps a position to the turn it belongs to', () => {
  let timeline = { turns: compositionTurns };

  // The controller can report a position past the end of the current turn; the
  // fill still reaches 1 and the clock stops at the turn end.
  let clamped = resolveChatShowProgress(timeline, 1, { progress: { positionMs: 99_000 } }, {});
  assert.equal(clamped.elapsedMs, 24_000);
  assert.equal(clamped.now, 60);
  assert.deepEqual(clamped.segments.map(({ style }) => readSegment(style)).map(({ fill }) => fill), ['1', '1', '0']);
});

test('seeking inside a turn maps to that turn and offset', () => {
  let geometry = resolveChatShowTimelineGeometry({ turns: compositionTurns });

  assert.deepEqual(resolveChatShowTimelinePosition(geometry, 1_000), {
    index: 0,
    positionMs: 1_000,
    absoluteMs: 1_000,
    totalMs: 40_000,
    snapped: false,
    gapMs: 0,
  });
  // A turn start belongs to that turn: the ranges are half-open.
  assert.equal(resolveChatShowTimelinePosition(geometry, 20_000).index, 1);
  assert.equal(resolveChatShowTimelinePosition(geometry, 20_000).positionMs, 0);
  assert.equal(resolveChatShowTimelinePosition(geometry, 39_999).positionMs, 9_999);
});

test('seeking a composition gap snaps forward to the next turn', () => {
  let geometry = resolveChatShowTimelineGeometry({ turns: compositionTurns });

  for (let requestedMs of [5_000, 12_000, 19_999]) {
    let position = resolveChatShowTimelinePosition(geometry, requestedMs);
    assert.equal(position.index, 1, `${requestedMs} resumes at the next turn`);
    assert.equal(position.positionMs, 0);
    assert.equal(position.absoluteMs, requestedMs, 'the requested time is reported unaltered');
    assert.equal(position.totalMs, 40_000);
    assert.equal(position.snapped, true);
    assert.equal(position.gapMs, 15_000, 'the skipped branch spanned 5 s to 20 s');
  }

  // The second branch (24–30 s) reports its own size.
  let second = resolveChatShowTimelinePosition(geometry, 27_000);
  assert.equal(second.index, 2);
  assert.equal(second.positionMs, 0);
  assert.equal(second.gapMs, 6_000);
  assert.equal(second.snapped, true);
});

test('seeking past the last turn snaps backward to its end', () => {
  let geometry = resolveChatShowTimelineGeometry({ turns: compositionTurns, totalMs: 50_000 });

  let overshoot = resolveChatShowTimelinePosition(geometry, 45_000);
  assert.equal(overshoot.index, 2);
  assert.equal(overshoot.positionMs, 10_000, 'the last turn runs to its own end');
  assert.equal(overshoot.absoluteMs, 45_000);
  assert.equal(overshoot.snapped, true);
  assert.equal(overshoot.gapMs, 5_000, 'the declared tail the request overshot by');

  // The exact end of the composition is where playback already stands, so it is
  // not reported as a snap.
  let atEnd = resolveChatShowTimelinePosition(geometry, 40_000);
  assert.equal(atEnd.index, 2);
  assert.equal(atEnd.positionMs, 10_000);
  assert.equal(atEnd.snapped, false);
  assert.equal(atEnd.gapMs, 0);
});

test('seeking clamps below zero and above the composition total', () => {
  let geometry = resolveChatShowTimelineGeometry({ turns: compositionTurns });

  let below = resolveChatShowTimelinePosition(geometry, -5_000);
  assert.deepEqual(
    { index: below.index, positionMs: below.positionMs, absoluteMs: below.absoluteMs },
    { index: 0, positionMs: 0, absoluteMs: 0 },
  );

  let above = resolveChatShowTimelinePosition(geometry, 999_999);
  assert.deepEqual(
    { index: above.index, positionMs: above.positionMs, absoluteMs: above.absoluteMs, totalMs: above.totalMs },
    { index: 2, positionMs: 10_000, absoluteMs: 40_000, totalMs: 40_000 },
  );
});

test('a gapless absolute composition projects the same clock as the legacy timeline', () => {
  // A host that annotates startMs but plays every segment (the full mode of a
  // short/full pair) must see no behavioural change at all, so the same clock
  // falls out of both bases.
  let annotated = {
    turns: [
      { startMs: 0, durationMs: 1_000 },
      { startMs: 1_000, durationMs: 2_000 },
      { startMs: 3_000, durationMs: 1_000 },
    ],
  };
  let legacy = { turns: legacyTurns };

  for (let index of [0, 1, 2]) {
    for (let positionMs of [0, 250, 1_000]) {
      let absoluteProgress = resolveChatShowProgress(annotated, index, { progress: { positionMs } }, {});
      let legacyProgress = resolveChatShowProgress(legacy, index, { progress: { positionMs } }, {});
      for (let key of ['now', 'value', 'max', 'text', 'elapsedMs', 'totalMs', 'seekable']) {
        assert.equal(absoluteProgress[key], legacyProgress[key], `turn ${index} at ${positionMs} ms, ${key}`);
      }
    }
  }
  assert.deepEqual(
    resolveChatShowTimelinePosition(annotated, 1_500),
    { ...resolveChatShowTimelinePosition(legacy, 1_500), snapped: false, gapMs: 0 },
  );
});

test('regression: a duration-weighted timeline projects exactly the legacy clock', () => {
  // Hand-computed from the pre-change algorithm: durations [1000, 2000, 1000]
  // weight the three segments, so at index 1 with positionMs 1000 the fraction
  // is 1000/2000 = 0.5, the completed weight is 1000, the overall share is
  // (1000 + 2000 * 0.5) / 4000 = 0.5, and the elapsed clock is 1000 + 2000 *
  // 0.5 = 2000 ms of a 4000 ms total.
  let progress = resolveChatShowProgress({ turns: legacyTurns }, 1, { progress: { positionMs: 1_000 } }, {});

  assert.equal(progress.now, 50);
  assert.equal(progress.value, 2);
  assert.equal(progress.max, 4);
  assert.equal(progress.text, '2 / 3 · 0:02 / 0:04');
  assert.equal(progress.elapsedLabel, '0:02');
  assert.equal(progress.totalLabel, '0:04');
  assert.equal(progress.elapsedMs, 2_000);
  assert.equal(progress.totalMs, 4_000);
  assert.equal(progress.seekable, true);
  // The whole segment style string, so an added custom property would fail here.
  assert.deepEqual(progress.segments.map(({ style }) => style), [
    '--chat-show-progress-weight:1000;--chat-show-progress-fill:1',
    '--chat-show-progress-weight:2000;--chat-show-progress-fill:0.5',
    '--chat-show-progress-weight:1000;--chat-show-progress-fill:0',
  ]);
  assert.doesNotMatch(progress.segments[1].style, /--chat-show-progress-gap/);

  // Legacy seek: 3000 ms of 4000 ms is the start of the third segment, and the
  // result carries no snap receipt.
  assert.deepEqual(resolveChatShowTimelinePosition({ turns: legacyTurns }, 3_000), {
    index: 2,
    positionMs: 0,
    absoluteMs: 3_000,
    totalMs: 4_000,
  });
});

test('regression: a duration-weighted timeline with an unusable duration degrades as before', () => {
  // The old projection falls back to unit weights, reports the bar as complete
  // for the caption word, and reports a clock of zero because it is not seekable.
  let progress = resolveChatShowProgress(
    { turns: [{ durationMs: 1_000 }, { durationMs: 0 }] },
    1,
    {},
    { words: [{ text: 'one' }, { text: 'two' }, { text: 'three' }, { text: 'four' }], activeWordIndex: 1 },
  );

  assert.equal(progress.now, 75, '(1 completed weight + 1 * 2/4 word fraction) / 2');
  assert.equal(progress.seekable, false);
  assert.equal(progress.elapsedMs, 0);
  assert.equal(progress.totalMs, 0);
  assert.equal(progress.text, '2 / 2 · 0:00 / 0:00');
  assert.deepEqual(progress.segments.map(({ style }) => style), [
    '--chat-show-progress-weight:1;--chat-show-progress-fill:1',
    '--chat-show-progress-weight:1;--chat-show-progress-fill:0.5',
  ]);
  assert.equal(resolveChatShowTimelinePosition({ turns: [{ durationMs: 0 }] }, 0), null);
});

test('the player consumes and re-exports the shared time base', async () => {
  let source = await readFile(playerSource, 'utf8');

  // The player keeps no private copy of the projection: the browser module and
  // the headless tests must agree on one time base.
  assert.doesNotMatch(source, /function resolveProgress\(/);
  assert.doesNotMatch(source, /function resolveTimelinePosition\(/);
  assert.match(source, /from '\.\.\/chat-show-time-base\.js'/);
  for (let helper of [
    'resolveChatShowTimelineGeometry',
    'resolveChatShowProgress',
    'resolveChatShowTimelinePosition',
  ]) {
    assert.match(source, new RegExp(`export \\{[^}]*\\b${helper}\\b`));
  }
  // Only an absolute seek carries the snap receipt, so a weighted host keeps the
  // exact event detail shape it always received.
  assert.match(source, /position\.snapped === undefined/);
});

test('the segment rule honours the composition gap without touching the container gap', async () => {
  let styles = await readFile(playerStyles, 'utf8');

  let segment = styles.match(/\.chat-show-progress-segment\s*\{[\s\S]*?\n {2}\}/);
  assert.ok(segment, 'the segment rule must exist');
  assert.match(segment[0], /margin-inline-start:\s*calc\(var\(--chat-show-progress-gap, 0\) \* 1%\)/);
  assert.doesNotMatch(segment[0], /(^|[^-\w])gap:/, 'the flex gap stays on the container');

  let container = styles.match(/\.chat-show-progress-segments\s*\{[\s\S]*?\n {2}\}/);
  assert.ok(container, 'the segments container must exist');
  assert.match(container[0], /display:\s*flex/);
  assert.match(container[0], /gap:\s*var\(--sn-step-1\)/);
  assert.doesNotMatch(container[0], /chat-show-progress-gap/);
});

test('the player contract documents the opt-in time base and the gap snap', () => {
  assert.equal(CHAT_SHOW_PLAYER_CONTRACT.progress.timeBase, 'duration-weighted | host-absolute-composition');
  assert.match(CHAT_SHOW_PLAYER_CONTRACT.progress.absoluteGapSeek, /snaps-forward-to-the-next-turn/);
  // Existing keys stay: a consumer asserts on this contract.
  assert.equal(CHAT_SHOW_PLAYER_CONTRACT.progress.projection, 'duration-weighted-segmented-overall-timeline');
  assert.equal(CHAT_SHOW_PLAYER_CONTRACT.progress.seek, 'turn-index-and-position-ms');
  assert.deepEqual([...CHAT_SHOW_PLAYER_CONTRACT.progress.input], ['pointer', 'keyboard']);
});
