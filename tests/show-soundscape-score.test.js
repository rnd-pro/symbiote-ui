import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BARS_PER_CYCLE, createRandom, createTrack, generateBar, layersForBar,
} from '../chat/show-soundscape-score.js';

test('the same seed gives the same random stream and track, another seed does not', () => {
  const a = createRandom('x');
  const b = createRandom('x');
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.notEqual(createRandom('x')(), createRandom('y')());
  assert.deepEqual(createTrack('seed-1'), createTrack('seed-1'));
  assert.equal(createTrack('seed-1').bpm >= 122 && createTrack('seed-1').bpm < 136, true);
});

test('a bar is deterministic per seed, cycle and bar, and varies between cycles', () => {
  const track = createTrack('seed-1');
  assert.deepEqual(generateBar(track, 0, 12), generateBar(track, 0, 12));
  const differs = Array.from({ length: BARS_PER_CYCLE }, (_, bar) => bar).some((bar) => (
    JSON.stringify(generateBar(track, 0, bar)) !== JSON.stringify(generateBar(track, 1, bar))
  ));
  assert.equal(differs, true);
});

test('the kick runs four on the floor, the breakdown has none, bass stays in the scale', () => {
  const track = createTrack('seed-2');
  const bar = generateBar(track, 0, 8);
  assert.deepEqual(bar.kick.flatMap((hit, step) => (hit ? [step] : [])), [0, 4, 8, 12]);
  assert.equal(layersForBar(17).kick, false);
  const pcs = new Set(track.scale.map((degree) => (track.root + degree) % 12));
  for (let b = 8; b < 16; b += 1) {
    for (const hit of generateBar(track, 0, b).bass) if (hit) assert.equal(pcs.has(hit.note % 12), true);
  }
});

test('sections keep tempo and swing while key and riffs change', () => {
  const first = createTrack('page:1', 'page');
  const second = createTrack('page:2', 'page');
  assert.equal(first.bpm, second.bpm);
  assert.equal(first.swing, second.swing);
  assert.equal(createTrack('page:1', 'page').bpm, createTrack('page', 'page').bpm);
  const keys = new Set(Array.from({ length: 12 }, (_, i) => `${createTrack(`page:${i}`, 'page').root}${createTrack(`page:${i}`, 'page').scaleName}`));
  assert.equal(keys.size > 1, true);
});
