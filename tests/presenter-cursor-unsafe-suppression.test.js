import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import {
  PRESENTER_HAND_PROFILE_VERSION,
  PRESENTER_MARKERS,
  createPresenterCursor,
} from '../chat/presenter-cursor.js';
import {
  PRESENTER_GESTURE_POLICY_VERSION,
  createPresenterRelationshipPath,
  resolvePresenterGesturePolicy,
} from '../chat/presenter-gesture-policy.js';

test('gesture policy projects large regions as focus frames and keeps marker ink compact', () => {
  let { window } = parseHTML('<!doctype html><html><body></body></html>');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
  window.getComputedStyle = () => ({
    overflow: 'visible',
    overflowX: 'visible',
    overflowY: 'visible',
    clipPath: 'none',
    contain: '',
  });
  window.requestAnimationFrame = () => {
    throw new Error('deterministic annotation frames must not schedule animation frames');
  };
  let el = window.document.createElement('section');
  el.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
  });
  window.document.body.appendChild(el);
  let cursor = createPresenterCursor(window.document);

  let frame = cursor.presentAnnotationFrame(el, { marker: 'underline' }, {
    progress: 0.05,
    seed: 17,
    viewport: { width: 800, height: 600 },
  });

  assert.equal(frame.presented, true);
  assert.equal(frame.kind, 'focus');
  assert.equal(frame.fallback, true);
  assert.equal(frame.gesturePolicy.policyVersion, PRESENTER_GESTURE_POLICY_VERSION);
  assert.equal(frame.gesturePolicy.reason, 'target-geometry-prefers-frame');
  assert.equal(frame.safety.safe, true);
  assert.equal(frame.safety.policyFallback, true);
  assert.equal(window.document.querySelector('.pc-ink path')?.getAttribute('d') || '', '');

  let compact = window.document.createElement('span');
  compact.getBoundingClientRect = () => ({
    left: 180,
    top: 140,
    right: 280,
    bottom: 220,
    width: 100,
    height: 80,
  });
  window.document.body.appendChild(compact);
  let safeFrame = cursor.presentAnnotationFrame(compact, { marker: 'oval' }, {
    progress: 1,
    seed: 23,
    viewport: { width: 800, height: 600 },
  });
  assert.equal(safeFrame.presented, true);
  assert.equal(safeFrame.kind, 'marker');
  assert.equal(safeFrame.suppressed, false);
  assert.equal(safeFrame.safety.safe, true);
  assert.equal(safeFrame.gesturePolicy.reason, 'compact-target');
  assert.notEqual(window.document.querySelector('.pc-ink path')?.getAttribute('d') || '', '');

  let panel = window.document.createElement('section');
  panel.getBoundingClientRect = () => ({
    left: 180,
    top: 80,
    right: 620,
    bottom: 570,
    width: 440,
    height: 490,
  });
  window.document.body.appendChild(panel);
  let groupFrame = cursor.presentAnnotationFrame(panel, { marker: 'oval' }, {
    progress: 1,
    seed: 31,
    viewport: { width: 800, height: 600 },
  });
  assert.equal(groupFrame.presented, true);
  assert.equal(groupFrame.kind, 'focus');
  assert.equal(groupFrame.fallback, true);
  assert.equal(groupFrame.gesturePolicy.reason, 'target-geometry-prefers-frame');
  assert.equal(window.document.querySelector('.pc-ink path')?.getAttribute('d') || '', '');
  cursor.dispose();
});

test('relationship arrows require an exact registered pair and separated geometry', () => {
  let relation = { id: 'relation:source-detail', from: 'source', to: 'detail' };
  let sourceRect = { left: 80, top: 120, width: 120, height: 60 };
  let destinationRect = { left: 420, top: 220, width: 140, height: 80 };
  let arrow = resolvePresenterGesturePolicy({
    cueKind: 'relationship',
    relation,
    sourceTargetId: 'source',
    destinationTargetId: 'detail',
    sourceRect,
    destinationRect,
    targetRect: destinationRect,
    viewport: { width: 800, height: 600 },
  });
  assert.equal(arrow.selectedKind, 'arrow');
  assert.equal(arrow.reason, 'registered-separated-relationship');
  assert.ok(arrow.relationGapPx >= 24);

  let path = createPresenterRelationshipPath({ sourceRect, destinationRect });
  assert.ok(path.lengthPx > 0);
  assert.equal(path.arrowHead.length, 2);

  let forged = resolvePresenterGesturePolicy({
    cueKind: 'relationship',
    relation,
    sourceTargetId: 'source',
    destinationTargetId: 'other',
    sourceRect,
    destinationRect,
    targetRect: destinationRect,
    viewport: { width: 800, height: 600 },
  });
  assert.equal(forged.selectedKind, 'focus-frame');
  assert.equal(forged.reason, 'relationship-unbound');

  let reveal = resolvePresenterGesturePolicy({
    cueKind: 'action',
    interactionType: 'panel-reveal',
    targetRect: destinationRect,
    viewport: { width: 800, height: 600 },
  });
  assert.equal(reveal.selectedKind, 'cursor-click-then-focus');
  assert.deepEqual(reveal.sequence, ['cursor-click', 'focus-frame']);

  let { window } = parseHTML('<!doctype html><html><body></body></html>');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
  window.getComputedStyle = () => ({ overflow: 'visible', overflowX: 'visible', overflowY: 'visible', clipPath: 'none', contain: '' });
  let source = window.document.createElement('section');
  let destination = window.document.createElement('section');
  source.getBoundingClientRect = () => ({ ...sourceRect, right: 200, bottom: 180 });
  destination.getBoundingClientRect = () => ({ ...destinationRect, right: 560, bottom: 300 });
  window.document.body.append(source, destination);
  let cursor = createPresenterCursor(window.document);
  let frame = cursor.presentRelationshipFrame(source, destination, relation, {
    progress: 1,
    sourceTargetId: 'source',
    destinationTargetId: 'detail',
    viewport: { width: 800, height: 600 },
  });
  assert.equal(frame.presented, true);
  assert.equal(frame.kind, 'relationship');
  assert.equal(frame.name, 'arrow');
  assert.match(window.document.querySelector('.pc-ink path')?.getAttribute('d') || '', /^M/);
  cursor.dispose();
});

test('pointer marker draws a repeatable hand-made arrow to a compact registered target', () => {
  assert.equal(PRESENTER_HAND_PROFILE_VERSION, 'symbiote-presenter-hand-profile-v1');
  assert.ok(PRESENTER_MARKERS.includes('arrow'));

  let { window } = parseHTML('<!doctype html><html><body></body></html>');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
  window.getComputedStyle = () => ({ overflow: 'visible', overflowX: 'visible', overflowY: 'visible', clipPath: 'none', contain: '' });
  let input = window.document.createElement('textarea');
  input.getBoundingClientRect = () => ({
    left: 250,
    top: 420,
    right: 610,
    bottom: 474,
    width: 360,
    height: 54,
  });
  window.document.body.appendChild(input);
  let cursor = createPresenterCursor(window.document);
  let frame = cursor.presentAnnotationFrame(input, { intent: 'pointer' }, {
    progress: 1,
    seed: 4242,
    viewport: { width: 800, height: 600 },
  });
  let repeated = cursor.presentAnnotationFrame(input, { intent: 'pointer' }, {
    progress: 1,
    seed: 4242,
    viewport: { width: 800, height: 600 },
  });
  let alternate = cursor.presentAnnotationFrame(input, { intent: 'pointer' }, {
    progress: 1,
    seed: 4243,
    viewport: { width: 800, height: 600 },
  });

  assert.equal(frame.presented, true);
  assert.equal(frame.kind, 'marker');
  assert.equal(frame.name, 'arrow');
  assert.equal(frame.safety.safe, true);
  assert.equal(frame.safety.targetInteriorCollision, false);
  assert.ok(frame.pathPoints > 20);
  let targetCenter = { x: 430, y: 447 };
  let viewportCenter = { x: 400, y: 300 };
  let tip = frame.pathSamples.reduce((nearest, point) => (
    Math.hypot(point.x - targetCenter.x, point.y - targetCenter.y)
      < Math.hypot(nearest.x - targetCenter.x, nearest.y - targetCenter.y)
      ? point
      : nearest
  ));
  let start = frame.pathSamples[0];
  let expected = { x: targetCenter.x - viewportCenter.x, y: targetCenter.y - viewportCenter.y };
  let actual = { x: tip.x - start.x, y: tip.y - start.y };
  let cosine = (expected.x * actual.x + expected.y * actual.y)
    / (Math.hypot(expected.x, expected.y) * Math.hypot(actual.x, actual.y));
  assert.ok(cosine > 0.95, 'primary pointer approaches the target on the viewport-center vector');
  assert.equal(repeated.pathDigest, frame.pathDigest);
  assert.notEqual(alternate.pathDigest, frame.pathDigest);
  assert.deepEqual(repeated.pathSamples, frame.pathSamples);
  assert.notDeepEqual(alternate.pathSamples, frame.pathSamples);
  cursor.dispose();
});
