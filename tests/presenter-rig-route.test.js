import assert from 'node:assert/strict';
import test from 'node:test';

import { routeAround, segmentCutsBox } from '../chat/presenter-rig-route.js';

const options = { gap: 47, view: { width: 1069, height: 749 }, low: 40 };
const rect = { left: 171, top: 285, right: 660, bottom: 570 };
const box = { left: rect.left - 47, top: rect.top - 47, right: rect.right + 47, bottom: rect.bottom + 47 };
// The body rounds corners by a few pixels: what matters is that its centre stays
// clear of the frame itself, with a few pixels to spare (the body gap is 47).
const insideFrame = (p) => p.x > rect.left - 8 && p.x < rect.right + 8 && p.y > rect.top - 8 && p.y < rect.bottom + 8;

test('without a frame, or with a clear line, the flight is straight', () => {
  const to = { x: 800, y: 450 };
  assert.deepEqual(routeAround({ x: 85, y: 460 }, to, null, options), to);
  assert.deepEqual(routeAround({ x: 85, y: 100 }, { x: 800, y: 100 }, rect, options), { x: 800, y: 100 });
});

test('a line through the frame is detected only for the interior', () => {
  assert.equal(segmentCutsBox({ x: 85, y: 460 }, { x: 800, y: 460 }, box), true);
  assert.equal(segmentCutsBox({ x: box.left, y: 100 }, { x: box.left, y: 700 }, box), false);
});

test('a body standing on a corner it already reached moves on to another one', () => {
  const corner = { x: box.left, y: box.top };
  const next = routeAround(corner, { x: 707, y: 450 }, rect, options);
  assert.notDeepEqual(next, corner, 'the route must not wait on the reached corner');
});

test('flying step by step from the left to the right perch never enters the frame', () => {
  let pos = { x: 85, y: 460 };
  const perch = { x: 707, y: 450 };
  let steps = 0;
  while (Math.hypot(perch.x - pos.x, perch.y - pos.y) > 12 && steps++ < 400) {
    const aim = routeAround(pos, perch, rect, options);
    const d = Math.hypot(aim.x - pos.x, aim.y - pos.y) || 1;
    const move = Math.min(18, d);
    pos = { x: pos.x + (aim.x - pos.x) / d * move, y: pos.y + (aim.y - pos.y) / d * move };
    assert.equal(insideFrame(pos), false, `entered the frame at step ${steps}: ${JSON.stringify(pos)}`);
  }
  assert.ok(Math.hypot(perch.x - pos.x, perch.y - pos.y) <= 12, `did not arrive in ${steps} steps`);
});

test('a body already inside the frame heads straight out', () => {
  const to = { x: 707, y: 450 };
  assert.deepEqual(routeAround({ x: 400, y: 420 }, to, rect, options), to);
});
