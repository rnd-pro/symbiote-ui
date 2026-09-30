import assert from 'node:assert/strict';
import test from 'node:test';

import { SHOW_MARKER_SHAPES } from '../chat/show-contracts.js';
import {
  PRESENTER_MARKER_CATALOG,
  PRESENTER_MARKER_GEOMETRY_CONSTANTS,
  PRESENTER_MARKER_GEOMETRY_VERSION,
  createPresenterMarkerGeometry,
} from '../chat/presenter-marker-geometry.js';

const TARGETS = Object.freeze([
  { id: 'short', left: 40, top: 42, width: 48, height: 20 },
  { id: 'wide', left: 40, top: 42, width: 320, height: 36 },
  { id: 'multiline', left: 40, top: 42, width: 220, height: 96 },
]);

const SEEDS = Object.freeze(['reference-alpha', 'reference-beta', 3931985963]);

function geometry(marker, targetRect, seed) {
  return createPresenterMarkerGeometry({
    marker,
    targetRect,
    seed,
    viewport: { width: 440, height: 190 },
  });
}

test('production marker geometry catalog stays aligned with the public Show contract', () => {
  assert.equal(PRESENTER_MARKER_GEOMETRY_VERSION, 'symbiote-presenter-marker-geometry-v1');
  assert.deepEqual(PRESENTER_MARKER_CATALOG.map(({ name }) => name), SHOW_MARKER_SHAPES);
  assert.ok(PRESENTER_MARKER_CATALOG.every(({ semantics, safetyPolicy, contractTier }) => (
    semantics && safetyPolicy && ['core', 'extended'].includes(contractTier)
  )));
});

test('Node-safe package entrypoint exposes production marker geometry without browser globals', async () => {
  let entrypoint = await import('symbiote-ui/chat/presenter-marker-geometry.js');
  assert.equal(entrypoint.PRESENTER_MARKER_GEOMETRY_VERSION, PRESENTER_MARKER_GEOMETRY_VERSION);
  assert.equal(typeof entrypoint.createPresenterMarkerGeometry, 'function');
});

test('oval families keep the complete variable-width ribbon outside protected content for every reference seed', () => {
  for (let marker of ['oval', 'multi-oval']) {
    for (let targetRect of TARGETS) {
      for (let seed of SEEDS) {
        let result = geometry(marker, targetRect, seed);
        assert.equal(result.safeArea.clear, true, `${marker}/${targetRect.id}/${seed}`);
        assert.ok(
          result.safeArea.minimumClearancePx >= result.safeArea.requiredClearancePx - 0.05,
          `${marker}/${targetRect.id}/${seed}: ${JSON.stringify(result.safeArea)}`,
        );
        assert.equal(result.render.linecap, 'round');
        assert.equal(result.render.linejoin, 'round');
        assert.match(result.render.ribbonPath, /C/);
      }
    }
  }
});

test('oval tails overlap longitudinally while keeping rounded endpoints visibly separated', () => {
  for (let marker of ['oval', 'multi-oval']) {
    for (let seed of SEEDS) {
      let result = geometry(marker, TARGETS[1], seed);
      assert.equal(result.tail.mode, 'displaced-overlap');
      assert.ok(result.tail.longitudinalOverlapPx > result.kinematics.baseWidthPx);
      assert.equal(result.tail.separated, true, `${marker}/${seed}: ${JSON.stringify(result.tail)}`);
      assert.ok(result.tail.endpointGapPx >= result.tail.requiredEndpointGapPx);
    }
  }
});

test('same seed is byte-deterministic while distinct seeds retain visible geometry variation', () => {
  for (let marker of SHOW_MARKER_SHAPES) {
    let first = geometry(marker, TARGETS[1], 'stable-seed');
    let replay = geometry(marker, TARGETS[1], 'stable-seed');
    assert.equal(first.render.ribbonPath, replay.render.ribbonPath, marker);
    assert.equal(first.kinematics.normalizedPathHash, replay.kinematics.normalizedPathHash, marker);

    let variants = SEEDS.map((seed) => geometry(marker, TARGETS[1], seed));
    assert.ok(new Set(variants.map(({ render }) => render.ribbonPath)).size > 1, marker);
  }
});

test('drawing duration follows arc length without speeding long gestures past the hand profile', () => {
  for (let marker of SHOW_MARKER_SHAPES) {
    let compact = geometry(marker, TARGETS[0], 'speed-reference');
    let wide = geometry(marker, TARGETS[1], 'speed-reference');
    for (let result of [compact, wide]) {
      assert.equal(result.kinematics.motionProfile, 'constant-speed', marker);
      assert.ok(
        Math.abs(
          result.timing.averageSpeedPxPerMs
            - PRESENTER_MARKER_GEOMETRY_CONSTANTS.drawSpeedPxPerMs,
        ) < 0.000001,
        marker,
      );
      assert.ok(result.timing.durationMs > 0, marker);
    }
    if (wide.kinematics.arcLengthPx > compact.kinematics.arcLengthPx * 1.15) {
      assert.ok(wide.timing.durationMs > compact.timing.durationMs, marker);
    }
  }
});
