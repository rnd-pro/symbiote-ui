import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

import { createPresenterCursor } from '../chat/presenter-cursor.js';
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

test('real presenter cursor keeps accumulated marker ink until explicitly cleared', () => {
  let window = makeDom();
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
