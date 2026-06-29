import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createPresenterCursor,
  playCursorScenario,
} from '../chat/presenter-cursor.js';

/**
 * Fake cursor: records every `moveTo` element (and the opts it was given) plus
 * `clear` calls, so a test can assert what the scenario player drove without a
 * real DOM.
 */
function makeFakeCursor() {
  let cursor = {
    moves: [],
    clearCount: 0,
    moveTo(el, opts) {
      cursor.moves.push({ el, opts });
    },
    clear() {
      cursor.clearCount += 1;
    },
  };
  return cursor;
}

/**
 * Fake resolveTarget: maps an agent-authored string target to a stand-in
 * "element" object, recording the order targets were resolved. Unknown targets
 * resolve to null so the player skips the move.
 */
function makeFakeResolver(map = {}) {
  let resolver = {
    resolved: [],
    resolve(target) {
      resolver.resolved.push(target);
      return Object.prototype.hasOwnProperty.call(map, target) ? map[target] : null;
    },
  };
  return resolver;
}

test('playCursorScenario visits each step target in order', async () => {
  let cursor = makeFakeCursor();
  let elA = { id: 'a' };
  let elB = { id: 'b' };
  let elC = { id: 'c' };
  let resolver = makeFakeResolver({ a: elA, b: elB, c: elC });

  let scenario = {
    steps: [{ target: 'a' }, { target: 'b' }, { target: 'c' }],
  };

  await playCursorScenario(cursor, scenario, {
    resolveTarget: resolver.resolve,
    defaultHoldMs: 0,
  });

  assert.deepEqual(resolver.resolved, ['a', 'b', 'c']);
  assert.deepEqual(
    cursor.moves.map((m) => m.el),
    [elA, elB, elC],
  );
});

test('playCursorScenario fires onStep(step, index) once per step', async () => {
  let cursor = makeFakeCursor();
  let resolver = makeFakeResolver({ a: { id: 'a' }, b: { id: 'b' } });
  let seen = [];

  let scenario = {
    steps: [
      { target: 'a', label: 'first' },
      { target: 'b', label: 'second' },
    ],
  };

  await playCursorScenario(cursor, scenario, {
    resolveTarget: resolver.resolve,
    defaultHoldMs: 0,
    onStep: (step, index) => seen.push({ label: step.label, index }),
  });

  assert.deepEqual(seen, [
    { label: 'first', index: 0 },
    { label: 'second', index: 1 },
  ]);
});

test('playCursorScenario respects per-step holdMs', async () => {
  let cursor = makeFakeCursor();
  let resolver = makeFakeResolver({ a: { id: 'a' }, b: { id: 'b' } });
  let stamps = [];

  let scenario = {
    steps: [
      { target: 'a', holdMs: 40 },
      { target: 'b', holdMs: 0 },
    ],
  };

  let start = Date.now();
  await playCursorScenario(cursor, scenario, {
    resolveTarget: resolver.resolve,
    defaultHoldMs: 0,
    onStep: () => stamps.push(Date.now() - start),
  });

  // The first step holds ~40ms before its onStep; the second holds ~0ms after.
  assert.equal(stamps.length, 2);
  assert.ok(stamps[0] >= 35, `expected first onStep after the hold, got ${stamps[0]}ms`);
  assert.ok(stamps[1] - stamps[0] < 35, `expected second onStep promptly, got ${stamps[1] - stamps[0]}ms`);
});

test('playCursorScenario uses defaultHoldMs when a step omits holdMs', async () => {
  let cursor = makeFakeCursor();
  let resolver = makeFakeResolver({ a: { id: 'a' } });
  let elapsed = -1;

  let start = Date.now();
  await playCursorScenario(
    cursor,
    { steps: [{ target: 'a' }] },
    {
      resolveTarget: resolver.resolve,
      defaultHoldMs: 40,
      onStep: () => {
        elapsed = Date.now() - start;
      },
    },
  );

  assert.ok(elapsed >= 35, `expected the default hold to apply, got ${elapsed}ms`);
});

test('playCursorScenario skips moveTo for unresolved targets but still fires onStep', async () => {
  let cursor = makeFakeCursor();
  let elB = { id: 'b' };
  let resolver = makeFakeResolver({ b: elB }); // 'a' resolves to null
  let seen = [];

  let scenario = {
    steps: [{ target: 'a' }, { target: 'b' }],
  };

  await playCursorScenario(cursor, scenario, {
    resolveTarget: resolver.resolve,
    defaultHoldMs: 0,
    onStep: (step, index) => seen.push(index),
  });

  // Only the resolvable step drives the cursor.
  assert.deepEqual(
    cursor.moves.map((m) => m.el),
    [elB],
  );
  // Both steps report through onStep, in order.
  assert.deepEqual(seen, [0, 1]);
});

test('playCursorScenario passes gesture and label through to the cursor opts', async () => {
  let cursor = makeFakeCursor();
  let resolver = makeFakeResolver({ a: { id: 'a' } });

  await playCursorScenario(
    cursor,
    { steps: [{ target: 'a', gesture: 'circle', label: 'intro' }] },
    { resolveTarget: resolver.resolve, defaultHoldMs: 0 },
  );

  assert.equal(cursor.moves.length, 1);
  assert.equal(cursor.moves[0].opts.gesture, 'circle');
  assert.equal(cursor.moves[0].opts.label, 'intro');
});

test('playCursorScenario does nothing when already aborted', async () => {
  let cursor = makeFakeCursor();
  let resolver = makeFakeResolver({ a: { id: 'a' } });
  let controller = new AbortController();
  controller.abort();

  await playCursorScenario(
    cursor,
    { steps: [{ target: 'a' }] },
    { resolveTarget: resolver.resolve, signal: controller.signal, defaultHoldMs: 0 },
  );

  assert.equal(cursor.moves.length, 0);
  assert.equal(resolver.resolved.length, 0);
  assert.equal(cursor.clearCount, 1);
});

test('AbortSignal stops further steps and ends the in-progress hold promptly', async () => {
  let cursor = makeFakeCursor();
  let resolver = makeFakeResolver({ a: { id: 'a' }, b: { id: 'b' }, c: { id: 'c' } });
  let controller = new AbortController();
  let stepped = [];

  let scenario = {
    steps: [
      { target: 'a', holdMs: 5000 },
      { target: 'b', holdMs: 5000 },
      { target: 'c', holdMs: 5000 },
    ],
  };

  let start = Date.now();
  // Abort during the first step's long hold.
  let timer = setTimeout(() => controller.abort(), 20);

  await playCursorScenario(cursor, scenario, {
    resolveTarget: resolver.resolve,
    signal: controller.signal,
    onStep: (step, index) => stepped.push(index),
  });
  clearTimeout(timer);

  let took = Date.now() - start;
  // The 5s hold did not run to completion — the abort ended it promptly.
  assert.ok(took < 1000, `expected a prompt abort, took ${took}ms`);
  // Only the first step started; the run stopped before step two.
  assert.deepEqual(
    cursor.moves.map((m) => m.el.id),
    ['a'],
  );
  // Aborting during the hold means onStep for the interrupted step did not fire.
  assert.deepEqual(stepped, []);
  assert.ok(cursor.clearCount >= 1);
});

test('playCursorScenario tolerates an empty or missing scenario', async () => {
  let cursor = makeFakeCursor();
  let resolver = makeFakeResolver();

  await playCursorScenario(cursor, { steps: [] }, { resolveTarget: resolver.resolve });
  await playCursorScenario(cursor, {}, { resolveTarget: resolver.resolve });
  await playCursorScenario(cursor, undefined, { resolveTarget: resolver.resolve });

  assert.equal(cursor.moves.length, 0);
});

test('playCursorScenario is a clean no-op against a non-cursor', async () => {
  // No cursor / wrong shape: resolves without throwing.
  await assert.doesNotReject(
    playCursorScenario(null, { steps: [{ target: 'a' }] }, { resolveTarget: () => ({}) }),
  );
  await assert.doesNotReject(playCursorScenario({}, { steps: [{ target: 'a' }] }, {}));
});

test('createPresenterCursor returns inert no-ops with no document (Node import)', () => {
  let cursor = createPresenterCursor();
  assert.equal(cursor.isSupported(), false);
  // Every handle is a safe no-op in a non-browser env.
  assert.doesNotThrow(() => cursor.moveTo({ getBoundingClientRect: () => ({}) }));
  assert.doesNotThrow(() => cursor.clear());
  assert.doesNotThrow(() => cursor.dispose());
});

test('createPresenterCursor drives a scenario end to end through the real player', async () => {
  // The inert cursor still satisfies the player contract, so the scenario layer
  // is exercised against the real createPresenterCursor in Node.
  let cursor = createPresenterCursor();
  let elements = { a: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10 }) } };
  let seen = [];

  await playCursorScenario(
    cursor,
    { steps: [{ target: 'a' }] },
    {
      resolveTarget: (target) => elements[target] || null,
      defaultHoldMs: 0,
      onStep: (_step, index) => seen.push(index),
    },
  );

  assert.deepEqual(seen, [0]);
});
