import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PRESENTER_KINEMATIC_LIMITS,
  createPresenterKinematicPlan,
  normalizePresenterSeed,
  samplePresenterKinematicPlan,
} from '../chat/presenter-kinematics.js';

function line(length) {
  return (progress) => ({ x: progress * length, y: 0 });
}

function distance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

test('kinematic duration follows smoothed arc length without exceeding the hard speed ceiling', () => {
  let short = createPresenterKinematicPlan({ kind: 'underline', seed: 41, pointAt: line(240) });
  let long = createPresenterKinematicPlan({ kind: 'underline', seed: 41, pointAt: line(960) });

  assert.ok(long.arcLengthPx > short.arcLengthPx * 3.9);
  assert.ok(long.durationMs > short.durationMs * 3.7);

  for (let plan of [short, long]) {
    let peak = 0;
    for (let index = 0; index <= 240; index += 1) {
      let frame = samplePresenterKinematicPlan(plan, plan.durationMs * index / 240);
      peak = Math.max(peak, frame.speedPxPerMs);
    }
    assert.ok(peak <= PRESENTER_KINEMATIC_LIMITS.maxSpeedPxPerMs + 0.001);
    assert.ok(peak >= PRESENTER_KINEMATIC_LIMITS.minMovingSpeedPxPerMs);
  }
});

test('arc-length sampling removes source parameter bias and keeps minimum-jerk endpoints', () => {
  let plan = createPresenterKinematicPlan({
    kind: 'underline',
    seed: 3,
    noiseAmplitudePx: 0,
    pointAt: (progress) => ({ x: progress * progress * 800, y: 0 }),
  });
  let quarter = samplePresenterKinematicPlan(plan, plan.durationMs * 0.25);
  let middle = samplePresenterKinematicPlan(plan, plan.durationMs * 0.5);
  let threeQuarter = samplePresenterKinematicPlan(plan, plan.durationMs * 0.75);

  assert.ok(Math.abs(middle.point.x - 400) < 4);
  assert.ok(quarter.speedPxPerMs < middle.speedPxPerMs);
  assert.ok(threeQuarter.speedPxPerMs < middle.speedPxPerMs);
  assert.equal(samplePresenterKinematicPlan(plan, 0).speedPxPerMs, 0);
  assert.equal(samplePresenterKinematicPlan(plan, plan.durationMs).speedPxPerMs, 0);
});

test('seeded spatial variation is replay-stable and bounded away from semantic geometry', () => {
  let request = {
    kind: 'underline',
    pointAt: (progress) => ({ x: progress * 600, y: Math.sin(progress * Math.PI) * 12 }),
  };
  let first = createPresenterKinematicPlan({ ...request, seed: 'gesture-17' });
  let replay = createPresenterKinematicPlan({ ...request, seed: 'gesture-17' });
  let variation = createPresenterKinematicPlan({ ...request, seed: 'gesture-18' });

  assert.equal(first.pathHash, replay.pathHash);
  assert.notEqual(first.pathHash, variation.pathHash);
  assert.equal(first.durationMs, variation.durationMs);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.samples), true);

  let largestDelta = 0;
  for (let index = 0; index < first.samples.length; index += 1) {
    largestDelta = Math.max(largestDelta, distance(first.samples[index], variation.samples[index]));
  }
  assert.ok(largestDelta > 0.1);
  assert.ok(largestDelta <= first.noiseAmplitudePx * 2.5);
});

test('public string seeds normalize without numeric coercion and keep distinct deterministic paths', () => {
  let request = {
    kind: 'underline',
    pointAt: (progress) => ({ x: progress * 640, y: Math.sin(progress * Math.PI) * 18 }),
  };
  let alpha = createPresenterKinematicPlan({ ...request, seed: 'gesture-alpha' });
  let replay = createPresenterKinematicPlan({ ...request, seed: 'gesture-alpha' });
  let beta = createPresenterKinematicPlan({ ...request, seed: 'gesture-beta' });

  assert.equal(alpha.seed, normalizePresenterSeed('gesture-alpha'));
  assert.notEqual(alpha.seed, 0);
  assert.notEqual(alpha.seed, normalizePresenterSeed('gesture-beta'));
  assert.equal(alpha.normalizedPathHash, replay.normalizedPathHash);
  assert.notEqual(alpha.normalizedPathHash, beta.normalizedPathHash);
});

test('adaptive arc subdivision makes spatial variation invariant to source parameterization', () => {
  let geometry = (progress) => ({
    x: progress * 720,
    y: Math.sin(progress * Math.PI * 1.5) * 56 + progress * progress * 24,
  });
  let linear = createPresenterKinematicPlan({
    kind: 'flourish',
    seed: 'parameterization-proof',
    pointAt: geometry,
  });
  let squared = createPresenterKinematicPlan({
    kind: 'flourish',
    seed: 'parameterization-proof',
    pointAt: (progress) => geometry(progress * progress),
  });

  assert.equal(linear.normalizedPathHash, squared.normalizedPathHash);
  assert.equal(linear.normalizedPath.length, squared.normalizedPath.length);
  for (let index = 0; index < linear.normalizedPath.length; index += 1) {
    assert.ok(distance(linear.normalizedPath[index], squared.normalizedPath[index]) <= 0.45);
  }
});

test('enclosing gestures declare natural underdraw or controlled overlap instead of perfect closure', () => {
  let square = (progress) => {
    let side = Math.min(3, Math.floor(progress * 4));
    let local = progress * 4 - side;
    let points = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 0 },
    ];
    return {
      x: points[side].x + (points[side + 1].x - points[side].x) * local,
      y: points[side].y + (points[side + 1].y - points[side].y) * local,
    };
  };
  let box = createPresenterKinematicPlan({ kind: 'box', seed: 7, pointAt: square });
  let oval = createPresenterKinematicPlan({
    kind: 'oval',
    seed: 8,
    pointAt: (progress) => ({
      x: Math.cos(progress * Math.PI * 2) * 100,
      y: Math.sin(progress * Math.PI * 2) * 50,
    }),
  });

  assert.equal(box.tailPolicy.mode, 'underdraw');
  assert.ok(distance(box.samples[0], box.samples.at(-1)) > box.maxWidthPx);
  assert.equal(oval.tailPolicy.mode, 'displaced-overlap');
  assert.ok(oval.tailPolicy.amount > 0);
  assert.ok(oval.tailPolicy.lateralOffsetPx >= oval.baseWidthPx);
  assert.ok(distance(oval.samples[0], oval.samples.at(-1)) > oval.maxWidthPx * 1.5);
});

test('default presenter motion keeps a human floor without exceeding the existing hard ceiling', () => {
  assert.ok(PRESENTER_KINEMATIC_LIMITS.minMovingSpeedPxPerMs >= 0.14);
  assert.ok(PRESENTER_KINEMATIC_LIMITS.targetSpeedPxPerMs >= 0.28);
  assert.equal(PRESENTER_KINEMATIC_LIMITS.maxSpeedPxPerMs, 0.454);
});

test('centripetal smoothing bounds corner jumps while retaining source coverage', () => {
  let corner = createPresenterKinematicPlan({
    kind: 'route',
    seed: 19,
    noiseAmplitudePx: 0,
    pointAt(progress) {
      if (progress < 0.5) return { x: progress * 400, y: 0 };
      return { x: 200, y: (progress - 0.5) * 400 };
    },
  });
  let largestTurn = 0;
  for (let index = 2; index < corner.samples.length; index += 1) {
    let a = corner.samples[index - 2];
    let b = corner.samples[index - 1];
    let c = corner.samples[index];
    let first = Math.atan2(b.y - a.y, b.x - a.x);
    let second = Math.atan2(c.y - b.y, c.x - b.x);
    let turn = Math.abs(Math.atan2(Math.sin(second - first), Math.cos(second - first)));
    largestTurn = Math.max(largestTurn, turn);
  }
  assert.ok(largestTurn < Math.PI / 3);
  assert.ok(corner.bounds.right >= 198);
  assert.ok(corner.bounds.bottom >= 198);
});

test('width responds smoothly to speed and curvature without frame-time jitter', () => {
  let plan = createPresenterKinematicPlan({
    kind: 'flourish',
    seed: 29,
    pointAt: (progress) => ({
      x: progress * 700,
      y: Math.sin(progress * Math.PI * 3) * 45,
    }),
  });
  let widths = plan.samples.map((sample) => sample.widthPx);
  assert.ok(Math.max(...widths) - Math.min(...widths) > 0.2);
  assert.ok(Math.min(...widths) >= plan.baseWidthPx * 0.7);
  assert.ok(Math.max(...widths) <= plan.baseWidthPx * 1.3);
  for (let index = 1; index < widths.length; index += 1) {
    assert.ok(Math.abs(widths[index] - widths[index - 1]) < plan.baseWidthPx * 0.16);
  }

  let time = plan.durationMs * 0.57;
  assert.deepEqual(
    samplePresenterKinematicPlan(plan, time),
    samplePresenterKinematicPlan(plan, time),
  );
});
