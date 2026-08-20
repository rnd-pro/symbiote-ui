import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { createPresenterCursor } from '../chat/presenter-cursor.js';

test('unsafe full-panel marker is suppressed before any ink is shown', () => {
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

  assert.equal(frame.presented, false);
  assert.equal(frame.visible, false);
  assert.equal(frame.suppressed, true);
  assert.equal(frame.reason, 'unsafe-annotation');
  assert.equal(frame.safety.safe, false);
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
  assert.equal(safeFrame.suppressed, false);
  assert.equal(safeFrame.safety.safe, true);
  assert.notEqual(window.document.querySelector('.pc-ink path')?.getAttribute('d') || '', '');
  cursor.dispose();
});
