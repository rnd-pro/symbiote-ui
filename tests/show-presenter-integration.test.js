import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

import { createPresenterCursor } from '../chat/presenter-cursor.js';
import { resolvePresenterClawPaths, resolvePresenterHoseGeometry } from '../chat/presenter-hose.js';
import { ShowAttentionController } from '../chat/show-attention.js';

function makeDom() {
  let { window } = parseHTML('<!doctype html><html><body></body></html>');
  Object.defineProperty(window, 'innerWidth', { value: 800 });
  Object.defineProperty(window, 'innerHeight', { value: 600 });
  window.getComputedStyle = () => ({
    overflow: 'visible',
    overflowX: 'visible',
    overflowY: 'visible',
    clipPath: 'none',
    contain: '',
  });
  window.requestAnimationFrame = () => 0;
  return window;
}

function target(document, rect) {
  let element = document.createElement('div');
  element.getBoundingClientRect = () => ({
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
  });
  document.body.appendChild(element);
  return element;
}

test('hose geometry meets the painted cursor tail and rotates around the fixed hotspot', () => {
  let anchor = { x: 500, y: 300 };
  let cursor = { x: 220, y: 180 };
  let first = resolvePresenterHoseGeometry({ anchor, cursor, angle: 0 });
  let turned = resolvePresenterHoseGeometry({ anchor, cursor, angle: Math.PI / 2 });
  assert.ok(Math.abs(Math.hypot(first.tail.x - cursor.x, first.tail.y - cursor.y) - Math.hypot(7.4, 19.8)) < 1e-9);
  assert.ok(Math.abs(Math.hypot(turned.tail.x - cursor.x, turned.tail.y - cursor.y) - Math.hypot(7.4, 19.8)) < 1e-9);
  assert.notEqual(first.tail.x, turned.tail.x);
  assert.deepEqual(first.center, cursor);
  assert.deepEqual(turned.center, cursor);
  assert.match(first.hosePath, new RegExp(`${first.tail.x} ${first.tail.y}$`));
  assert.ok(first.anchorControl.x < anchor.x, 'the hose must enter the player from its visible edge');
  assert.ok(first.tailControl.x > first.tail.x, 'the hose must approach the arrow base in its travel direction');
  let nearer = resolvePresenterHoseGeometry({ anchor, cursor: { x: 390, y: 240 }, angle: 0 });
  assert.ok(first.distance > nearer.distance);
  let horizontal = resolvePresenterHoseGeometry({
    anchor: { x: 500, y: 300 },
    cursor: { x: 220, y: 300 },
    angle: 0,
  });
  let baseOffset = horizontal.baseBend.y - (300 + (horizontal.tail.y - 300) * 0.34);
  let tipOffset = horizontal.tipBend.y - (300 + (horizontal.tail.y - 300) * 0.68);
  assert.ok(baseOffset < tipOffset, 'the hose should bend less near its player connection');
  let reduced = resolvePresenterHoseGeometry({ anchor, cursor, angle: 0, reducedMotion: true });
  assert.doesNotMatch(reduced.hosePath, /\+\s*\d+\s*\n/u);
});

test('presenter click ripple uses one layer below the hose and arrow', () => {
  let window = makeDom();
  Object.defineProperty(window.document, 'hidden', { value: false });
  let queuedFrames = [];
  window.matchMedia = () => ({ matches: false });
  window.requestAnimationFrame = (callback) => {
    queuedFrames.push(callback);
    return queuedFrames.length;
  };
  window.cancelAnimationFrame = () => {};
  let anchor = target(window.document, { left: 500, top: 200, width: 280, height: 180 });
  let clickTarget = target(window.document, { left: 100, top: 100, width: 80, height: 40 });
  let cursor = createPresenterCursor(window.document, { resolveHoseAnchor: () => anchor });

  let frame = cursor.presentClickFrame(clickTarget, { elapsedMs: 0 });
  assert.equal(frame.visible, true);
  let overlay = window.document.querySelector('.symbiote-presenter-cursor');
  Object.defineProperty(overlay, 'isConnected', { value: true });
  assert.ok(overlay.classList.contains('has-presenter-hose'));
  assert.match(window.document.getElementById('symbiote-presenter-cursor-style').textContent,
    /\.has-presenter-hose \.pc-click\{display:none !important;\}/u);
  let svgMarkup = overlay.querySelector('svg').innerHTML;
  let rippleIndex = svgMarkup.indexOf('data-ripple');
  let hoseIndex = svgMarkup.indexOf('data-hose');
  let connectorIndex = svgMarkup.indexOf('data-port');
  let arrowIndex = svgMarkup.indexOf('data-arrow');
  assert.ok(rippleIndex < hoseIndex && hoseIndex < connectorIndex && connectorIndex < arrowIndex);

  Object.defineProperty(overlay, 'isConnected', { value: true });
  let draw = queuedFrames.shift();
  assert.equal(typeof draw, 'function');
  draw(window.performance.now() + 16);
  assert.match(overlay.querySelector('[data-ripple]').getAttribute('d') || '', /^M/u);
  cursor.dispose();
});

test('real presenter cursor keeps accumulated marker ink until explicitly cleared', () => {
  let window = makeDom();
  window.matchMedia = () => ({ matches: true });
  let targets = {
    first: target(window.document, { left: 80, top: 80, width: 100, height: 60 }),
    second: target(window.document, { left: 320, top: 180, width: 120, height: 70 }),
  };
  let cursor = createPresenterCursor(window.document);
  let attention = new ShowAttentionController({ cursor, resolveTarget: (id) => targets[id] });

  let first = attention.present({ mode: 'marker', targetId: 'first', marker: 'box', frame: { progress: 1, seed: 3 } });
  let second = attention.present({ mode: 'marker', targetId: 'second', marker: 'bracket', frame: { progress: 1, seed: 4 } });
  assert.equal(first.accumulatedCount, 1);
  assert.equal(second.accumulatedCount, 2);
  assert.equal(attention.snapshot.markerCount, 2);
  assert.ok((window.document.querySelector('.pc-ink path')?.getAttribute('d').match(/M/g) || []).length >= 2);

  attention.clearMarkers();
  assert.equal(window.document.querySelector('.pc-ink path')?.getAttribute('d'), '');
  attention.dispose();
});

test('every canonical Show marker has real deterministic ink and no focus-frame fallback', () => {
  let window = makeDom();
  let element = target(window.document, { left: 260, top: 190, width: 180, height: 80 });
  let cursor = createPresenterCursor(window.document);
  let markers = [
    'oval',
    'multi-oval',
    'arrow',
    'converging-arrows',
    'route',
    'bidirectional-route',
    'parallel-route',
    'label',
    'number',
  ];
  for (let [index, marker] of markers.entries()) {
    let receipt = cursor.presentAnnotationFrame(
      element,
      { marker, ...(marker === 'number' ? { label: '7' } : {}) },
      { progress: 1, seed: 20 + index },
    );
    assert.equal(receipt.presented, true, marker);
    assert.equal(receipt.name, marker, marker);
    assert.equal(receipt.fallback, undefined, marker);
    assert.ok(receipt.pathSamples.length > 0, marker);
    assert.equal(receipt.safety.safe, true, marker);
  }
  cursor.dispose();
});

test('hose claw fingertips spread when open and meet at the hotspot when closed', () => {
  let tip = (d) => d.split(' L').at(-1).split(' ').map(Number);
  let [openA, openB] = resolvePresenterClawPaths(0).map(tip);
  let [closedA, closedB] = resolvePresenterClawPaths(1).map(tip);
  assert.ok(Math.hypot(openA[0] - openB[0], openA[1] - openB[1]) > 8, 'open claw leaves a gap between the fingertips');
  assert.ok(Math.hypot(closedA[0] - closedB[0], closedA[1] - closedB[1]) < 3, 'closed claw touches at the hotspot');
  assert.ok(Math.hypot((closedA[0] + closedB[0]) / 2, (closedA[1] + closedB[1]) / 2) < 0.1, 'fingertips are centered on the hotspot');
});
