import assert from 'node:assert/strict';
import { test } from 'node:test';
import { routePcbTrace } from '../canvas/PcbRouter.js';

test('PCB router keeps adjacent node sockets as a direct line', () => {
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

  assert.equal(routed.strategy, 'compact-direct');
  assert.equal(routed.path, 'M 262 446 L 280 422');
});
