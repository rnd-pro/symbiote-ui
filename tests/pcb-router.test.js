import assert from 'node:assert/strict';
import { test } from 'node:test';
import { routePcbTrace } from '../canvas/PcbRouter.js';

function assertSegmentFollowsDirection(from, to, dir, minLength = 0) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dir.dx !== 0) {
    assert.ok(Math.abs(dy) < 0.5, `expected horizontal segment, got dy=${dy}`);
    assert.equal(Math.sign(dx), dir.dx);
    assert.ok(Math.abs(dx) + 0.5 >= minLength, `expected segment length >= ${minLength}, got ${Math.abs(dx)}`);
    return;
  }
  assert.ok(Math.abs(dx) < 0.5, `expected vertical segment, got dx=${dx}`);
  assert.equal(Math.sign(dy), dir.dy);
  assert.ok(Math.abs(dy) + 0.5 >= minLength, `expected segment length >= ${minLength}, got ${Math.abs(dy)}`);
}

test('PCB router keeps facing adjacent node sockets as a direct line', () => {
  const routed = routePcbTrace({
    start: { x: 264, y: 416 },
    end: { x: 280, y: 416 },
    fromRect: { id: 'near-source', x: 80, y: 360, w: 184, h: 113 },
    toRect: { id: 'near-target', x: 280, y: 360, w: 184, h: 113 },
    fromAngle: 0,
    toAngle: 180,
    rects: [
      { id: 'near-source', x: 80, y: 360, w: 184, h: 113 },
      { id: 'near-target', x: 280, y: 360, w: 184, h: 113 },
    ],
    connections: [{ id: 'conn-facing', from: 'near-source', to: 'near-target' }],
    conn: { id: 'conn-facing', from: 'near-source', to: 'near-target' },
    grid: 10,
    stub: 28,
    clearance: 28,
    chamfer: 8,
  });

  assert.equal(routed.strategy, 'compact-direct');
  assert.equal(routed.path, 'M 264 416 H 280');
});

test('PCB router rejects direct routes that do not leave endpoints perpendicularly', () => {
  const routed = routePcbTrace({
    start: { x: 262, y: 446 },
    end: { x: 280, y: 422 },
    fromRect: { id: 'near-source', x: 80, y: 360, w: 184, h: 113 },
    toRect: { id: 'near-target', x: 280, y: 360, w: 184, h: 113 },
    fromAngle: 0,
    toAngle: 180,
    rects: [
      { id: 'near-source', x: 80, y: 360, w: 184, h: 113 },
      { id: 'near-target', x: 280, y: 360, w: 184, h: 113 },
    ],
    connections: [{ id: 'conn-near', from: 'near-source', to: 'near-target' }],
    conn: { id: 'conn-near', from: 'near-source', to: 'near-target' },
    grid: 10,
    stub: 28,
    clearance: 28,
    chamfer: 8,
  });

  assert.notEqual(routed.strategy, 'compact-direct');
  assertSegmentFollowsDirection(routed.points[0], routed.points[1], { dx: 1, dy: 0 }, 16);
  assertSegmentFollowsDirection(routed.points.at(-1), routed.points.at(-2), { dx: -1, dy: 0 }, 16);
});
