import assert from 'node:assert/strict';
import { test } from 'node:test';

import { projectPresenterState, PRESENTER_FRAME_MS } from '../chat/presenter-cursor.js';

function focusLayer(extra = {}) {
  return {
    focus: {
      active: true,
      rect: { left: 0, top: 0, width: 400, height: 200 },
      duration: 1000,
      ...extra,
    },
  };
}

test('scheduled focus layers keep the shared 30 FPS projector floor', () => {
  let sameFrame = projectPresenterState(focusLayer(), PRESENTER_FRAME_MS - 1);
  let first = projectPresenterState(focusLayer(), 1);
  let nextFrame = projectPresenterState(focusLayer(), PRESENTER_FRAME_MS + 1);
  assert.deepEqual(sameFrame.focus, first.focus, 'sub-frame times share one projected state');
  assert.notDeepEqual(nextFrame.focus, first.focus, 'crossing a frame advances the state');
});

test('continuous focus layers interpolate within a frame so a time-stretched reveal stays smooth', () => {
  let layer = focusLayer({ continuous: true });
  let first = projectPresenterState(layer, 100);
  let a = projectPresenterState(layer, 110);
  let b = projectPresenterState(layer, 120);
  assert.notDeepEqual(a.focus, first.focus, 'continuous layers advance inside one 33ms frame');
  assert.notDeepEqual(b.focus, a.focus);
  assert.ok(
    first.focus.revealProgress < a.focus.revealProgress
      && a.focus.revealProgress < b.focus.revealProgress,
    'reveal progress grows monotonically between frames',
  );
  assert.ok(
    first.focus.width < a.focus.width && a.focus.width < b.focus.width,
    'drawn width grows monotonically between frames',
  );
});
