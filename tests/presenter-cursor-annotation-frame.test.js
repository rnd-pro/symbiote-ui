import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import {
  createPresenterCursor,
  PRESENTER_MARKERS,
  PRESENTER_SYMBOLS,
} from '../chat/presenter-cursor.js';

function makeDom() {
  let { window } = parseHTML('<!doctype html><html><body></body></html>');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
  window.getComputedStyle = (el) => ({
    overflow: el.style?.overflow || 'visible',
    overflowX: el.style?.overflowX || el.style?.overflow || 'visible',
    overflowY: el.style?.overflowY || el.style?.overflow || 'visible',
    clipPath: el.style?.clipPath || 'none',
    contain: el.style?.contain || '',
  });
  window.requestAnimationFrame = () => {
    throw new Error('deterministic annotation frames must not schedule animation frames');
  };
  return window;
}

function target(document, rect = { left: 180, top: 140, width: 260, height: 160 }) {
  let el = document.createElement('section');
  el.getBoundingClientRect = () => ({
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
  });
  document.body.appendChild(el);
  return el;
}

function inkPath(document) {
  return document.querySelector('.pc-ink path')?.getAttribute('d') || '';
}

test('deterministic annotation frame is idempotent and prefix-stable', () => {
  let window = makeDom();
  let cursor = createPresenterCursor(window.document);
  let el = target(window.document);

  let first = cursor.presentAnnotationFrame(el, { marker: 'circle' }, { progress: 0.4, seed: 17 });
  let prefix = inkPath(window.document);
  let repeated = cursor.presentAnnotationFrame(el, { marker: 'circle' }, { progress: 0.4, seed: 17 });
  assert.deepEqual(repeated, first);
  assert.equal(inkPath(window.document), prefix);

  let later = cursor.presentAnnotationFrame(el, { marker: 'circle' }, { progress: 0.7, seed: 17 });
  assert.ok(inkPath(window.document).startsWith(prefix));
  assert.ok(later.pathPoints > first.pathPoints);
  assert.notEqual(later.pathDigest, first.pathDigest);

  cursor.dispose();
});

test('deterministic annotation frame clamps progress and respects explicit seed', () => {
  let window = makeDom();
  let cursor = createPresenterCursor(window.document);
  let el = target(window.document);

  let empty = cursor.presentAnnotationFrame(el, { marker: 'underline' }, { progress: -1, seed: 5 });
  assert.equal(empty.progress, 0);
  assert.equal(empty.pathPoints, 0);
  assert.equal(inkPath(window.document), '');

  let full = cursor.presentAnnotationFrame(el, { marker: 'underline' }, { progress: 2, seed: 5 });
  let firstPath = inkPath(window.document);
  assert.equal(full.progress, 1);
  assert.equal(full.pathPoints, 97);
  let changedSeed = cursor.presentAnnotationFrame(el, { marker: 'underline' }, { progress: 1, seed: 6 });
  assert.notEqual(inkPath(window.document), firstPath);
  assert.notEqual(changedSeed.pathDigest, full.pathDigest);

  cursor.dispose();
});

test('progress zero cursor projection is independent of presentation history', () => {
  let firstWindow = makeDom();
  let firstCursor = createPresenterCursor(firstWindow.document);
  let firstTarget = target(firstWindow.document);
  firstCursor.presentAnnotationFrame(firstTarget, { marker: 'circle' }, { progress: 1, seed: 99 });
  let afterHistory = firstCursor.presentAnnotationFrame(
    firstTarget,
    { marker: 'underline' },
    { progress: 0, seed: 5 },
  );
  let afterHistoryTransform = firstWindow.document.querySelector('.pc-cursor')?.style.transform;

  let freshWindow = makeDom();
  let freshCursor = createPresenterCursor(freshWindow.document);
  let freshTarget = target(freshWindow.document);
  let fromFresh = freshCursor.presentAnnotationFrame(
    freshTarget,
    { marker: 'underline' },
    { progress: 0, seed: 5 },
  );
  let freshTransform = freshWindow.document.querySelector('.pc-cursor')?.style.transform;

  assert.deepEqual(afterHistory, fromFresh);
  assert.equal(afterHistoryTransform, freshTransform);
  assert.match(freshTransform, /^translate\(.+px, .+px\)$/);
  firstCursor.dispose();
  freshCursor.dispose();
});

test('deterministic annotation frame renders every marker and symbol', () => {
  let window = makeDom();
  let cursor = createPresenterCursor(window.document);
  let el = target(window.document);

  for (let [index, marker] of PRESENTER_MARKERS.entries()) {
    let result = cursor.presentAnnotationFrame(el, { kind: 'marker', marker }, { progress: 1, seed: index + 1 });
    assert.equal(result.presented, true, marker);
    assert.equal(result.name, marker);
    assert.ok(result.pathPoints > 2, marker);
    assert.ok(inkPath(window.document).length > 10, marker);
  }
  for (let [index, symbol] of PRESENTER_SYMBOLS.entries()) {
    let result = cursor.presentAnnotationFrame(
      el,
      { kind: 'symbol', symbol, placement: 'over' },
      { progress: 1, seed: index + 20 },
    );
    assert.equal(result.presented, true, symbol);
    assert.equal(result.name, symbol);
    assert.ok(result.pathPoints > 2, symbol);
    assert.ok(inkPath(window.document).length > 10, symbol);
  }

  cursor.dispose();
});

test('deterministic annotation frame rejects hidden targets and is inert without a DOM', () => {
  let window = makeDom();
  let cursor = createPresenterCursor(window.document);
  let hidden = target(window.document, { left: 100, top: 100, width: 0, height: 0 });
  assert.deepEqual(
    cursor.presentAnnotationFrame(hidden, { marker: 'box' }, { progress: 1, seed: 1 }),
    { presented: false, reason: 'hidden-target' },
  );
  assert.deepEqual(
    createPresenterCursor(null).presentAnnotationFrame(null, { marker: 'box' }, { progress: 1, seed: 1 }),
    { presented: false, reason: 'unsupported' },
  );
  cursor.dispose();
});
