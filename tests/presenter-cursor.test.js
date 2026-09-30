import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import {
  createPresenterCursor,
  createPresenterTravelPlan,
  normalizePresenterAnnotation,
  normalizePresenterMarker,
  normalizePresenterSymbol,
  PRESENTER_ANNOTATION_SUPPORT_TABLE,
  PRESENTER_FRAME_MS,
  PRESENTER_INK_DRAW_SPEED_PX_PER_MS,
  playCursorScenario,
  resolvePresenterHighlightRect,
  resolvePresenterRectangleTiming,
  resolvePresenterTravelDuration,
  resolvePresenterVisibleRect,
} from '../chat/presenter-cursor.js';
import { PRESENTER_KINEMATIC_LIMITS, PRESENTER_KINEMATICS_VERSION } from '../chat/presenter-kinematics.js';

/**
 * Fake cursor: records every `moveTo` element (and the opts it was given) plus
 * `clear` calls, so a test can assert what the scenario player drove without a
 * real DOM. It also honors the gesture-settled contract: when a move carries a
 * gesture it records the gesture name and (by default) reports settlement
 * synchronously, standing in for a real flourish so the player can advance. Pass
 * `{ settleGesture: false }` to leave a gesture pending (e.g. to exercise the
 * watchdog or abort paths).
 */
function makeFakeCursor({ settleGesture = true } = {}) {
  let cursor = {
    moves: [],
    clicks: [],
    gestures: [],
    markers: [],
    clearCount: 0,
    moveTo(el, opts) {
      cursor.moves.push({ el, opts });
      if (opts && typeof opts.gesture === 'string') {
        cursor.gestures.push(opts.gesture);
      }
      if (opts && typeof opts.marker === 'string') {
        cursor.markers.push(opts.marker);
      }
      if (settleGesture && opts && typeof opts.onGestureSettled === 'function') {
        opts.onGestureSettled();
      }
    },
    clear() {
      cursor.clearCount += 1;
    },
    annotateElement(el, opts) {
      cursor.moves.push({ el, opts, annotation: true });
      if (opts && typeof opts.gesture === 'string') {
        cursor.gestures.push(opts.gesture);
      }
      if (opts && typeof opts.marker === 'string') {
        cursor.markers.push(opts.marker);
      }
      if (settleGesture && opts && typeof opts.onGestureSettled === 'function') {
        opts.onGestureSettled();
      }
    },
    clickElement(el, opts) {
      cursor.clicks.push({ el, opts });
      if (settleGesture && opts && typeof opts.onGestureSettled === 'function') {
        opts.onGestureSettled();
      }
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

function makePresenterDom(frameStepMs = 1000) {
  let { window } = parseHTML('<!doctype html><html><body></body></html>');
  let now = 0;
  Object.defineProperty(window, 'performance', {
    configurable: true,
    value: { now: () => now },
  });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
  window.requestAnimationFrame = (cb) => {
    now += frameStepMs;
    return setTimeout(() => cb(now), 0);
  };
  window.cancelAnimationFrame = (id) => clearTimeout(id);
  window.getComputedStyle = (el) => ({
    overflow: el.style?.overflow || 'visible',
    overflowX: el.style?.overflowX || el.style?.overflow || 'visible',
    overflowY: el.style?.overflowY || el.style?.overflow || 'visible',
    clipPath: el.style?.clipPath || 'none',
    contain: el.style?.contain || '',
  });
  return window;
}

function boxElement(document, rect) {
  let el = document.createElement('button');
  el.getBoundingClientRect = () => ({
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    ...rect,
  });
  document.body.appendChild(el);
  return el;
}

function completedMarkerPlan(cursor, target, marker, seed, style = {}) {
  return cursor.presentAnnotationFrame(target, { marker }, {
    seed,
    progress: 1,
    planOnly: true,
    style,
  });
}

function pathGeometry(points) {
  let xs = points.map((point) => point.x);
  let ys = points.map((point) => point.y);
  let left = Math.min(...xs);
  let right = Math.max(...xs);
  let top = Math.min(...ys);
  let bottom = Math.max(...ys);
  let centerX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  let centerY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (let point of points) {
    let dx = point.x - centerX;
    let dy = point.y - centerY;
    xx += dx * dx;
    yy += dy * dy;
    xy += dx * dy;
  }
  let signedArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    let current = points[index];
    let next = points[(index + 1) % points.length];
    signedArea += current.x * next.y - next.x * current.y;
  }
  let width = right - left;
  let height = bottom - top;
  return {
    width,
    height,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    aspect: width / height,
    tilt: 0.5 * Math.atan2(2 * xy, xx - yy),
    roundness: Math.abs(signedArea / 2) / (width * height),
    endpointGap: Math.hypot(
      points.at(-1).x - points[0].x,
      points.at(-1).y - points[0].y,
    ),
  };
}

function valueRange(values) {
  return Math.max(...values) - Math.min(...values);
}

function interquartileRange(values) {
  let sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length * 0.75)] - sorted[Math.floor(sorted.length * 0.25)];
}

function segmentsIntersect(a, b, c, d) {
  let orientation = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  let abC = orientation(a, b, c);
  let abD = orientation(a, b, d);
  let cdA = orientation(c, d, a);
  let cdB = orientation(c, d, b);
  return abC * abD <= 0 && cdA * cdB <= 0;
}

function polylinesIntersect(left, right) {
  for (let leftIndex = 1; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex < right.length; rightIndex += 1) {
      if (segmentsIntersect(
        left[leftIndex - 1],
        left[leftIndex],
        right[rightIndex - 1],
        right[rightIndex],
      )) return true;
    }
  }
  return false;
}

function minimumPointDistance(left, right) {
  return Math.min(...left.flatMap((a) => right.map((b) => Math.hypot(a.x - b.x, a.y - b.y))));
}

function projectedOverlap(left, right) {
  let dx = left.at(-1).x - left[0].x;
  let dy = left.at(-1).y - left[0].y;
  let magnitude = Math.hypot(dx, dy) || 1;
  let project = (point) => (point.x * dx + point.y * dy) / magnitude;
  let leftProjection = left.map(project);
  let rightProjection = right.map(project);
  return Math.min(Math.max(...leftProjection), Math.max(...rightProjection))
    - Math.max(Math.min(...leftProjection), Math.min(...rightProjection));
}

function splitMultiOvalPasses(points) {
  let searchStart = Math.floor(points.length * 0.35);
  let searchEnd = Math.ceil(points.length * 0.65);
  let transition = searchStart;
  for (let index = searchStart + 1; index < searchEnd; index += 1) {
    if (points[index].x > points[transition].x) transition = index;
  }
  return [points.slice(0, transition), points.slice(transition + 1)];
}

function radialProfile(points, center, binCount = 24) {
  let bins = Array.from({ length: binCount }, () => []);
  for (let point of points) {
    let angle = Math.atan2(point.y - center.y, point.x - center.x);
    if (angle < 0) angle += Math.PI * 2;
    let bin = Math.min(binCount - 1, Math.floor(angle / (Math.PI * 2) * binCount));
    bins[bin].push(Math.hypot(point.x - center.x, point.y - center.y));
  }
  return bins.map((samples) => {
    if (!samples.length) return null;
    samples.sort((left, right) => left - right);
    return samples[Math.floor(samples.length / 2)];
  });
}

function nextFrame() {
  return new Promise((resolve) => setTimeout(resolve, 5));
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

test('normalizePresenterMarker accepts marker aliases and rejects unknown values', () => {
  assert.equal(normalizePresenterMarker('circle'), 'oval');
  assert.equal(normalizePresenterMarker('marker'), 'oval');
  assert.equal(normalizePresenterMarker('highlight'), '');
  assert.equal(normalizePresenterMarker('brackets'), '');
  assert.equal(normalizePresenterMarker('diagonal'), '');
  assert.equal(normalizePresenterMarker('missing'), '');
  assert.equal(normalizePresenterMarker('missing', 'underline'), 'underline');
});

test('normalizePresenterAnnotation separates semantic marks from cursor focus', () => {
  assert.equal(normalizePresenterSymbol('?'), 'question');
  assert.equal(normalizePresenterSymbol('x'), 'cross');
  assert.deepEqual(normalizePresenterAnnotation({ intent: 'detail' }), {
    kind: 'marker',
    intent: 'detail',
    marker: 'underline',
    placement: 'over',
  });
  assert.deepEqual(normalizePresenterAnnotation({ intent: 'question' }), {
    kind: 'symbol',
    intent: 'question',
    symbol: 'question',
    placement: 'after',
  });
  assert.deepEqual(normalizePresenterAnnotation({ symbol: 'heart' }), {
    kind: 'symbol',
    intent: '',
    symbol: 'heart',
    placement: 'after',
  });
  assert.throws(
    () => normalizePresenterAnnotation({ kind: 'symbol', symbol: 'not-a-symbol' }),
    (error) => error.code === 'PRESENTER_ANNOTATION_UNSUPPORTED'
      && error.field === 'symbol'
      && error.version === 'presenter-annotation-v1',
  );
});

test('presenter annotation support table is the canonical vocabulary', () => {
  assert.deepEqual(PRESENTER_ANNOTATION_SUPPORT_TABLE, {
    markers: [
      'freehand', 'underline', 'oval', 'multi-oval', 'arrow', 'converging-arrows', 'route',
      'bidirectional-route', 'parallel-route', 'label', 'number', 'box', 'bracket', 'slash',
    ],
    symbols: ['question', 'cross', 'check', 'heart', 'flourish'],
    intents: ['emphasize', 'detail', 'group', 'pointer', 'risk', 'question', 'success', 'affinity', 'flourish'],
    placements: ['over', 'after', 'before', 'corner', 'below', 'above'],
  });
});

test('oval marker geometry varies meaningfully and deterministically by authored seed', () => {
  let window = makePresenterDom();
  let target = boxElement(window.document, { left: 210, top: 190, width: 280, height: 104 });
  let cursor = createPresenterCursor(window.document);
  let seeds = ['oval-alpha', 'oval-bravo', 'oval-charlie', 'oval-delta', 'oval-echo', 'oval-foxtrot'];
  let plans = seeds.map((seed) => completedMarkerPlan(
    cursor,
    target,
    'oval',
    seed,
    { noiseAmplitudePx: 0 },
  ));
  let geometries = plans.map((plan) => pathGeometry(plan.pathSamples));
  let repeat = completedMarkerPlan(
    cursor,
    target,
    'oval',
    seeds[0],
    { noiseAmplitudePx: 0 },
  );

  assert.deepEqual(repeat.pathSamples, plans[0].pathSamples);
  assert.ok(valueRange(geometries.map((geometry) => geometry.aspect)) > 0.08, 'aspect must vary');
  assert.ok(valueRange(geometries.map((geometry) => geometry.tilt)) > 0.04, 'tilt must vary');
  assert.ok(valueRange(geometries.map((geometry) => geometry.roundness)) > 0.015, 'roundness must vary');
  assert.ok(
    Math.max(
      valueRange(geometries.map((geometry) => geometry.centerX)),
      valueRange(geometries.map((geometry) => geometry.centerY)),
    ) > 1.5,
    'center must vary',
  );
  assert.ok(valueRange(geometries.map((geometry) => geometry.endpointGap)) > 1.5, 'tail gap must vary');
  cursor.dispose();
});

test('oval terminal tails overlap longitudinally while marker ribbons stay separated', () => {
  let window = makePresenterDom();
  let target = boxElement(window.document, { left: 210, top: 190, width: 280, height: 104 });
  let cursor = createPresenterCursor(window.document);

  for (let seed of ['tail-alpha', 'tail-bravo', 'tail-charlie', 'tail-delta']) {
    let plan = completedMarkerPlan(cursor, target, 'oval', seed);
    let tailLength = Math.max(8, Math.floor(plan.pathSamples.length * 0.03));
    let openingTail = plan.pathSamples.slice(0, tailLength);
    let closingTail = plan.pathSamples.slice(-tailLength);
    let centerlineGap = minimumPointDistance(openingTail, closingTail);
    let overlap = projectedOverlap(openingTail, closingTail);

    assert.ok(overlap > 4, `${seed}: tails must overlap along their stroke direction (${overlap}px)`);
    assert.equal(polylinesIntersect(openingTail, closingTail), false, `${seed}: tail centerlines must not cross`);
    assert.ok(
      centerlineGap > plan.maxWidthPx + 0.75,
      `${seed}: visible ribbons need a positive gap (centerline ${centerlineGap}, width ${plan.maxWidthPx})`,
    );
  }
  cursor.dispose();
});

test('wide CV ovals retain one hundred milliseconds of runtime headroom', () => {
  let window = makePresenterDom();
  let target = boxElement(window.document, {
    left: 170,
    top: 210,
    width: 451.27,
    height: 75.7,
  });
  let cursor = createPresenterCursor(window.document);
  let hardCellMs = 2500;
  let requiredHeadroomMs = 100;
  let maxArcLengthPx = (hardCellMs - requiredHeadroomMs) * PRESENTER_INK_DRAW_SPEED_PX_PER_MS;

  for (let seed of [
    'agent-portal.human-decision',
    'cv-show:cue:agent-portal.human-decision',
    'cv-show:cue:positioning.tenure-marker',
    'cv-show:cue:mobile-smm.agent-update',
    'wide-oval-alpha',
    'wide-oval-bravo',
    'wide-oval-charlie',
    'wide-oval-delta',
  ]) {
    let plan = cursor.presentAnnotationFrame(target, { marker: 'oval', intent: 'emphasize' }, {
      seed,
      progress: 1,
      planOnly: true,
    });
    let headroomMs = hardCellMs - plan.durationMs;
    assert.ok(
      plan.arcLengthPx <= maxArcLengthPx,
      `${seed}: arc ${plan.arcLengthPx}px leaves only ${headroomMs}ms headroom`,
    );
    assert.ok(headroomMs >= requiredHeadroomMs, `${seed}: runtime headroom must be at least 100ms`);
  }
  cursor.dispose();
});

test('multi-oval produces deterministic related passes that are not scaled copies', () => {
  let window = makePresenterDom();
  let target = boxElement(window.document, { left: 210, top: 190, width: 280, height: 104 });
  let cursor = createPresenterCursor(window.document);
  let plan = completedMarkerPlan(
    cursor,
    target,
    'multi-oval',
    'multi-related',
    { noiseAmplitudePx: 0 },
  );
  let repeat = completedMarkerPlan(
    cursor,
    target,
    'multi-oval',
    'multi-related',
    { noiseAmplitudePx: 0 },
  );
  let center = { x: 350, y: 242 };
  let [firstPass, secondPass] = splitMultiOvalPasses(plan.pathSamples);
  let firstProfile = radialProfile(firstPass, center);
  let secondProfile = radialProfile(secondPass, center);
  let radialScales = firstProfile.flatMap((radius, index) => (
    index >= 6 && radius && secondProfile[index] ? [secondProfile[index] / radius] : []
  ));

  assert.deepEqual(repeat.pathSamples, plan.pathSamples);
  assert.ok(radialScales.length >= 18, 'both related passes must cover the oval contour');
  assert.ok(
    interquartileRange(radialScales) > 0.04,
    `the second pass must vary in shape, not only scale (${interquartileRange(radialScales)})`,
  );
  cursor.dispose();
});

test('representative travel and focus plans satisfy Show hard budgets', () => {
  let travel = createPresenterTravelPlan(
    { x: 0, y: 0 },
    { x: 800, y: 0 },
    'travel-budget',
  );
  let focus = resolvePresenterRectangleTiming({ width: 280, height: 120 });

  assert.ok(travel.durationMs <= 800);
  assert.ok(travel.maxObservedSpeedPxPerMs <= 3);
  assert.ok(focus.dragMs <= 400);
  assert.ok(focus.maxSpeedPxPerMs <= 3);
});

test('presenter ink overlay is hidden from the accessibility tree', () => {
  let window = makePresenterDom();
  let cursor = createPresenterCursor(window.document);
  assert.equal(
    window.document.querySelector('.symbiote-presenter-cursor')?.getAttribute('aria-hidden'),
    'true',
  );
  cursor.dispose();
});

test('focus, marker, and click plans expose zero-progress evidence without overlay mutation', () => {
  let window = makePresenterDom();
  let target = boxElement(window.document, { left: 180, top: 140, width: 220, height: 90 });
  let cursor = createPresenterCursor(window.document);
  let before = window.document.body.innerHTML;

  let focus = cursor.presentFocusFrame(target, {
    mode: 'frame',
    seed: 'focus-plan',
    planOnly: true,
  });
  let marker = cursor.presentAnnotationFrame(target, { marker: 'underline' }, {
    seed: 'marker-plan',
    planOnly: true,
  });
  let click = cursor.presentClickFrame(target, {
    seed: 'click-plan',
    planOnly: true,
  });

  assert.equal(window.document.body.innerHTML, before);
  assert.equal(focus.presented, true);
  assert.match(focus.normalizedPathHash, /^[0-9a-f]{8}$/);
  assert.equal(marker.presented, true);
  assert.match(marker.normalizedPathHash, /^[0-9a-f]{8}$/);
  assert.equal(click.presented, true);
  assert.equal(click.normalizedPathHash, '');

  cursor.presentFocusFrame(target, { mode: 'frame', seed: 'focus-plan', elapsedMs: 0 });
  assert.notEqual(window.document.body.innerHTML, before);
  cursor.dispose();
});

test('frame cursor keeps the reported authored corner at the visible classic-arrow tip', () => {
  let window = makePresenterDom();
  let target = boxElement(window.document, { left: 180, top: 140, width: 220, height: 90 });
  let cursor = createPresenterCursor(window.document);
  let firstFrame = cursor.presentFocusFrame(target, {
    mode: 'frame',
    seed: 'frame-arrow-hotspot',
    elapsedMs: 0,
  });
  let frame = cursor.presentFocusFrame(target, {
    mode: 'frame',
    seed: 'frame-arrow-hotspot',
    elapsedMs: firstFrame.durationMs,
  });
  let arrow = window.document.querySelector('.pc-cursor');
  let arrowSvg = arrow.querySelector('svg');
  let arrowPath = arrowSvg.querySelector('path');
  let transform = arrow.style.transform.match(
    /^translate\((-?[\d.]+)px, (-?[\d.]+)px\)$/,
  );
  let pathTip = arrowPath.getAttribute('d').trim().match(
    /^M\s*(-?[\d.]+)(?:\s+|,)\s*(-?[\d.]+)/i,
  );
  let viewBox = arrowSvg.getAttribute('viewBox').trim().split(/\s+/).map(Number);
  let [, , viewBoxWidth, viewBoxHeight] = viewBox;
  let arrowWidth = Number(arrowSvg.getAttribute('width'));
  let arrowHeight = Number(arrowSvg.getAttribute('height'));
  let authoredCorner = {
    x: frame.frameRect.right,
    y: frame.frameRect.bottom,
  };
  let reportedHotspot = {
    x: frame.cursor.x,
    y: frame.cursor.y,
  };
  let visibleArrowTip = {
    x: Number(transform[1]) + Number(pathTip[1]) * arrowWidth / viewBoxWidth,
    y: Number(transform[2]) + Number(pathTip[2]) * arrowHeight / viewBoxHeight,
  };
  let authoredSvgTip = {
    x: Number(pathTip[1]),
    y: Number(pathTip[2]),
  };

  assert.equal(arrow.style.opacity, '1');
  assert.deepEqual({ authoredCorner, reportedHotspot, visibleArrowTip, authoredSvgTip }, {
    authoredCorner,
    reportedHotspot: { ...authoredCorner },
    visibleArrowTip: { ...authoredCorner },
    authoredSvgTip: { x: 0, y: 0 },
  });
  cursor.dispose();
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
    { steps: [{ target: 'a', gesture: 'oval', label: 'intro' }] },
    { resolveTarget: resolver.resolve, defaultHoldMs: 0 },
  );

  assert.equal(cursor.moves.length, 1);
  assert.equal(cursor.moves[0].opts.gesture, 'oval');
  assert.equal(cursor.moves[0].opts.label, 'intro');
});

test('playCursorScenario passes marker through to the cursor opts', async () => {
  let cursor = makeFakeCursor();
  let resolver = makeFakeResolver({ a: { id: 'a' } });

  await playCursorScenario(
    cursor,
    { steps: [{ target: 'a', marker: 'freehand', label: 'intro' }] },
    { resolveTarget: resolver.resolve, defaultHoldMs: 0 },
  );

  assert.equal(cursor.moves.length, 1);
  assert.equal(cursor.moves[0].opts.marker, 'freehand');
  assert.equal(cursor.moves[0].opts.gesture, 'freehand');
  assert.equal(cursor.moves[0].opts.label, 'intro');
  assert.deepEqual(cursor.markers, ['freehand']);
});

test('playCursorScenario routes marker-only steps through semantic annotation when available', async () => {
  let annotated = [];
  let cursor = {
    moves: [],
    annotateElement(el, opts) {
      annotated.push({ el, opts });
      opts?.onGestureSettled?.();
    },
    moveTo(el, opts) {
      cursor.moves.push({ el, opts });
    },
  };
  let elA = { id: 'a' };
  let resolver = makeFakeResolver({ a: elA });

  await playCursorScenario(
    cursor,
    { steps: [{ target: 'a', gesture: 'underline', label: 'detail' }] },
    { resolveTarget: resolver.resolve, defaultHoldMs: 0 },
  );

  assert.deepEqual(cursor.moves, []);
  assert.equal(annotated.length, 1);
  assert.equal(annotated[0].el, elA);
  assert.equal(annotated[0].opts.kind, 'marker');
  assert.equal(annotated[0].opts.marker, 'underline');
  assert.equal(annotated[0].opts.label, 'detail');
});

test('playCursorScenario drives click steps through clickElement', async () => {
  let cursor = makeFakeCursor();
  let elA = { id: 'a' };
  let elB = { id: 'b' };
  let resolver = makeFakeResolver({ a: elA, b: elB });

  await playCursorScenario(
    cursor,
    { steps: [{ target: 'a', action: 'click', label: 'open' }, { target: 'b', click: true }] },
    { resolveTarget: resolver.resolve, defaultHoldMs: 0 },
  );

  assert.deepEqual(cursor.moves, []);
  assert.deepEqual(cursor.clicks.map((entry) => entry.el), [elA, elB]);
  assert.equal(cursor.clicks[0].opts.label, 'open');
});

test('playCursorScenario preserves click action IDs across replay', async () => {
  let actions = new Map();
  let invocations = [];
  let fired = 0;
  let cursor = {
    moveTo() {},
    clickElement(el, opts) {
      invocations.push({ el, actionId: opts.actionId });
      if (actions.has(opts.actionId)) return actions.get(opts.actionId);
      fired += 1;
      opts.onGestureSettled();
      let action = Promise.resolve({ actionId: opts.actionId, fired: true });
      actions.set(opts.actionId, action);
      return action;
    },
  };
  let el = { id: 'open' };
  let scenario = {
    steps: [{ target: 'open', action: 'click', actionId: 'open-workspace', holdMs: 0 }],
  };
  let options = { resolveTarget: () => el, defaultHoldMs: 0 };

  await playCursorScenario(cursor, scenario, options);
  await playCursorScenario(cursor, scenario, options);

  assert.deepEqual(invocations.map((entry) => entry.actionId), [
    'open-workspace',
    'open-workspace',
  ]);
  assert.equal(fired, 1);
});

test('playCursorScenario runs a step gesture and keeps step order', async () => {
  let cursor = makeFakeCursor();
  let resolver = makeFakeResolver({ a: { id: 'a' }, b: { id: 'b' }, c: { id: 'c' } });
  let seen = [];

  let scenario = {
    steps: [
      { target: 'a', gesture: 'oval', label: 'one' },
      { target: 'b', label: 'two' }, // no gesture
      { target: 'c', gesture: 'underline', label: 'three' },
    ],
  };

  await playCursorScenario(cursor, scenario, {
    resolveTarget: resolver.resolve,
    defaultHoldMs: 0,
    onStep: (step, index) => seen.push({ index, gesture: step.gesture || null }),
  });

  // Every gesture fired through the cursor's gesture path, in order.
  assert.deepEqual(cursor.gestures, ['oval', 'underline']);
  // The cursor still visited each target in order.
  assert.deepEqual(
    cursor.moves.map((m) => m.el.id),
    ['a', 'b', 'c'],
  );
  // The scenario completed in order, gesture steps included.
  assert.deepEqual(seen, [
    { index: 0, gesture: 'oval' },
    { index: 1, gesture: null },
    { index: 2, gesture: 'underline' },
  ]);
});

test('playCursorScenario waits for a slow gesture before advancing', async () => {
  // A cursor whose gesture settles asynchronously: the player must hold the step
  // open until settlement, so the next step does not start mid-flourish.
  let order = [];
  let cursor = {
    moves: [],
    moveTo(el, opts) {
      cursor.moves.push(el);
      order.push(`move:${el.id}`);
      if (opts && typeof opts.gesture === 'string' && typeof opts.onGestureSettled === 'function') {
        // Settle a tick later, after the (zero) hold would otherwise advance.
        setTimeout(() => {
          order.push(`gesture-done:${el.id}`);
          opts.onGestureSettled();
        }, 30);
      }
    },
    clear() {},
  };
  let resolver = makeFakeResolver({ a: { id: 'a' }, b: { id: 'b' } });

  await playCursorScenario(
    cursor,
    { steps: [{ target: 'a', gesture: 'circle', holdMs: 0 }, { target: 'b', holdMs: 0 }] },
    {
      resolveTarget: resolver.resolve,
      defaultHoldMs: 0,
      onStep: (_step, index) => order.push(`step:${index}`),
    },
  );

  // The gesture on 'a' completed before the cursor moved to 'b'.
  assert.deepEqual(order, ['move:a', 'gesture-done:a', 'step:0', 'move:b', 'step:1']);
});

test('playCursorScenario does not stall when a gesture never settles', async () => {
  // A cursor that ignores onGestureSettled must not hang the run: the watchdog
  // cap lets the step advance. (Kept well under the cap via abort.)
  let cursor = makeFakeCursor({ settleGesture: false });
  let resolver = makeFakeResolver({ a: { id: 'a' }, b: { id: 'b' } });
  let controller = new AbortController();
  let seen = [];

  // Abort shortly after the run starts so the never-settling gesture wait ends
  // via the abort branch rather than the multi-second watchdog.
  let timer = setTimeout(() => controller.abort(), 20);

  await playCursorScenario(
    cursor,
    { steps: [{ target: 'a', gesture: 'oval', holdMs: 0 }, { target: 'b' }] },
    { resolveTarget: resolver.resolve, signal: controller.signal, defaultHoldMs: 0 },
  );
  clearTimeout(timer);

  // The gesture name was still recorded, and the run stopped at the aborted step.
  assert.deepEqual(cursor.gestures, ['oval']);
  assert.deepEqual(
    cursor.moves.map((m) => m.el.id),
    ['a'],
  );
  assert.deepEqual(seen, []);
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
  assert.doesNotThrow(() => cursor.annotateElement({ getBoundingClientRect: () => ({}) }, { intent: 'detail' }));
  assert.doesNotThrow(() => cursor.clear());
  assert.doesNotThrow(() => cursor.dispose());
});

test('annotateElement clears the focus marquee before drawing marker ink', async () => {
  let window = makePresenterDom();
  let cursor = createPresenterCursor(window.document);
  let el = boxElement(window.document, { left: 120, top: 80, width: 160, height: 64 });

  await cursor.moveTo(el, { animate: false });

  let overlay = window.document.querySelector('.symbiote-presenter-cursor');
  let marquee = window.document.querySelector('.pc-marquee');
  assert.ok(overlay.classList.contains('is-visible'));
  assert.equal(marquee.style.width, '180px');
  assert.equal(marquee.style.height, '84px');

  cursor.annotateElement(el, { marker: 'underline' });
  await nextFrame();

  assert.ok(overlay.classList.contains('is-visible'));
  assert.equal(marquee.style.width, '0px');
  assert.equal(marquee.style.height, '0px');
  assert.ok(marquee.classList.contains('pc-marquee-faded'));

  cursor.dispose();
});

test('annotateElement flips bottom-edge underlines and returns live safety evidence', async () => {
  let window = makePresenterDom();
  let cursor = createPresenterCursor(window.document);
  let el = boxElement(window.document, { left: 120, top: 562, width: 160, height: 28 });
  let obstacle = {
    id: 'captions',
    kind: 'caption',
    rect: { left: 100, top: 526, width: 200, height: 28 },
  };

  let receipt = await cursor.annotateElement(el, {
    marker: 'underline',
    obstacles: [obstacle],
  });

  assert.equal(receipt.status, 'settled');
  assert.equal(receipt.placement, 'above');
  assert.equal(receipt.safety.viewportCollision, false);
  assert.equal(receipt.safety.safe, false);
  assert.deepEqual(receipt.safety.collisions.map((collision) => collision.id), ['captions']);
  cursor.dispose();
});

test('clickElement fires one semantic click for duplicate action IDs', async () => {
  let window = makePresenterDom();
  let cursor = createPresenterCursor(window.document);
  let el = boxElement(window.document, { left: 120, top: 80, width: 160, height: 64 });
  let clickCount = 0;
  el.click = () => { clickCount += 1; };

  let first = cursor.clickElement(el, { actionId: 'open-workspace' });
  let duplicate = cursor.clickElement(el, { actionId: 'open-workspace' });
  assert.ok(window.document.querySelector('.symbiote-presenter-cursor').classList.contains('is-visible'));
  assert.equal(duplicate, first);

  let receipt = await first;
  assert.equal(receipt.fired, true);
  assert.equal(clickCount, 1);
  cursor.dispose();
});

test('clearing a pending click prevents the semantic action from firing', async () => {
  let window = makePresenterDom();
  let cursor = createPresenterCursor(window.document);
  let el = boxElement(window.document, { left: 500, top: 420, width: 120, height: 40 });
  let clickCount = 0;
  el.click = () => { clickCount += 1; };

  let pending = cursor.clickElement(el, { actionId: 'cancelled-click' });
  cursor.clear();
  let receipt = await pending;

  assert.equal(receipt.status, 'aborted');
  assert.equal(receipt.fired, false);
  assert.equal(clickCount, 0);
  cursor.dispose();
});

test('resolvePresenterVisibleRect clips large targets to viewport and scroll containers', () => {
  let window = makePresenterDom();
  let { document } = window;
  let scroller = boxElement(document, { left: 100, top: 90, width: 220, height: 150 });
  scroller.style.overflow = 'auto';
  let target = document.createElement('section');
  target.getBoundingClientRect = () => ({
    left: 80,
    top: 70,
    right: 580,
    bottom: 520,
    width: 500,
    height: 450,
  });
  scroller.appendChild(target);

  assert.deepEqual(resolvePresenterVisibleRect(target, { width: 400, height: 300 }), {
    left: 100,
    top: 90,
    right: 320,
    bottom: 240,
    width: 220,
    height: 150,
  });
});

test('moveTo draws the focus frame around only the visible part of a scrollable target', async () => {
  let window = makePresenterDom();
  let { document } = window;
  let scroller = boxElement(document, { left: 100, top: 90, width: 220, height: 150 });
  scroller.style.overflow = 'auto';
  let target = document.createElement('section');
  target.getBoundingClientRect = () => ({
    left: 80,
    top: 70,
    right: 580,
    bottom: 520,
    width: 500,
    height: 450,
  });
  scroller.appendChild(target);

  let cursor = createPresenterCursor(document);
  await cursor.moveTo(target);

  let marquee = document.querySelector('.pc-marquee');
  assert.ok(document.querySelector('.symbiote-presenter-cursor').classList.contains('is-visible'));
  assert.equal(marquee.style.transform, 'translate(90px, 80px)');
  assert.equal(marquee.style.width, '240px');
  assert.equal(marquee.style.height, '170px');
  cursor.dispose();
});

test('live cursor, focus, marker, and symbol phases remain serialized at 30 FPS', async () => {
  let window = makePresenterDom(PRESENTER_FRAME_MS);
  let cursor = createPresenterCursor(window.document);
  let el = boxElement(window.document, { left: 180, top: 140, width: 180, height: 72 });

  let focusReceipt = await cursor.moveTo(el);
  let markerReceipt = await cursor.annotateElement(el, { marker: 'underline' });
  let symbolReceipt = await cursor.annotateElement(el, { kind: 'symbol', symbol: 'check' });

  assert.equal(focusReceipt.status, 'settled');
  assert.equal(markerReceipt.status, 'settled');
  assert.equal(symbolReceipt.status, 'settled');
  assert.equal(window.document.querySelector('.pc-cursor').style.opacity, '1');
  let cursorStyle = window.document.getElementById('symbiote-presenter-cursor-style').textContent;
  assert.doesNotMatch(cursorStyle, /\.pc-cursor\.is-inking svg\{display:none;\}/);
  assert.match(cursorStyle, /\.pc-cursor\.is-inking svg\{display:block;/);
  cursor.dispose();
});

test('resolvePresenterHighlightRect expands targets away from viewport edges', () => {
  assert.deepEqual(
    resolvePresenterHighlightRect({ left: 100, top: 80, width: 120, height: 40 }, { width: 500, height: 400 }),
    { left: 90, top: 70, width: 140, height: 60 },
  );
});

test('resolvePresenterHighlightRect keeps edge targets inset from the viewport', () => {
  assert.deepEqual(
    resolvePresenterHighlightRect({ left: 0, top: 2, width: 120, height: 40 }, { width: 500, height: 400 }),
    { left: 8, top: 8, width: 122, height: 44 },
  );
  assert.deepEqual(
    resolvePresenterHighlightRect({ left: 460, top: 370, width: 80, height: 50 }, { width: 500, height: 400 }),
    { left: 450, top: 360, width: 42, height: 32 },
  );
});

test('free cursor travel uses the shared arc-length planner and never exceeds its hard speed ceiling', () => {
  let plan = createPresenterTravelPlan(
    { x: 0, y: 0 },
    { x: 2000, y: 0 },
    'long-cursor-travel',
  );
  assert.equal(plan.version, PRESENTER_KINEMATICS_VERSION);
  assert.equal(resolvePresenterTravelDuration(2000, 'long-cursor-travel'), plan.durationMs);
  assert.ok(plan.durationMs > 2000 / PRESENTER_KINEMATIC_LIMITS.maxSpeedPxPerMs);
  assert.ok(plan.maxObservedSpeedPxPerMs <= PRESENTER_KINEMATIC_LIMITS.maxSpeedPxPerMs + 0.001);
  assert.equal(plan.timeTable[0].speedPxPerMs, 0);
  assert.equal(plan.timeTable.at(-1).speedPxPerMs, 0);
});

test('rectangle selection timing is deterministic and frames report mutation readiness', () => {
  let timing = resolvePresenterRectangleTiming({ left: 12, top: 18, width: 240, height: 72 });
  assert.deepEqual(
    resolvePresenterRectangleTiming({ left: 12, top: 18, width: 240, height: 72 }),
    timing,
  );
  assert.ok(timing.durationMs > timing.dragMs);

  let window = makePresenterDom(PRESENTER_FRAME_MS);
  let cursor = createPresenterCursor(window.document);
  let el = boxElement(window.document, { left: 180, top: 140, width: 180, height: 72 });
  let first = cursor.presentFocusFrame(el, { elapsedMs: 0, mode: 'rectangle-selection' });
  let final = cursor.presentFocusFrame(el, {
    elapsedMs: first.durationMs,
    mode: 'rectangle-selection',
  });

  assert.equal(first.mode, 'rectangle-selection');
  assert.equal(first.mutationReady, false);
  assert.equal(final.mutationReady, true);
  cursor.dispose();
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
