import assert from 'node:assert/strict';
import test from 'node:test';

import { parseHTML } from 'linkedom';

import { createPresenterCursor } from '../chat/presenter-cursor.js';
import {
  PRESENTER_MARKER_CATALOG,
  createPresenterMarkerGeometry,
} from '../chat/presenter-marker-geometry.js';
import {
  PRESENTER_MARKER_REFERENCE_SEEDS,
  PRESENTER_MARKER_REFERENCE_TARGETS,
  renderPresenterMarkerContactSheet,
  renderPresenterMarkerGalleryMarkup,
  renderPresenterMarkerReferenceSheet,
} from '../demo/presenter-marker-reference.js';

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

test('gallery DOM labels every marker and covers seed variants plus extreme target geometries', () => {
  let { document } = parseHTML(`<main>${renderPresenterMarkerGalleryMarkup()}</main>`);
  let cards = [...document.querySelectorAll('[data-marker-card]')];
  assert.deepEqual(cards.map((card) => card.dataset.markerCard), PRESENTER_MARKER_CATALOG.map(({ name }) => name));

  for (let card of cards) {
    let variants = [...card.querySelectorAll('[data-reference-variant]')];
    assert.equal(variants.length, PRESENTER_MARKER_REFERENCE_TARGETS.length * 2, card.dataset.markerCard);
    assert.deepEqual(
      [...new Set(variants.map((variant) => variant.dataset.targetKind))].sort(),
      PRESENTER_MARKER_REFERENCE_TARGETS.map(({ id }) => id).sort(),
    );
    assert.ok(variants.every((variant) => variant.querySelector('[data-production-ribbon]')));
    assert.ok(variants.every((variant) => variant.querySelector('[data-seed-label]')));
  }
});

test('oval reference sheets expose three seeds for short, wide, and multiline protected safe areas', () => {
  for (let marker of ['oval', 'multi-oval']) {
    let { document } = parseHTML(renderPresenterMarkerReferenceSheet(marker));
    let variants = [...document.querySelectorAll('[data-reference-variant]')];
    assert.equal(
      variants.length,
      PRESENTER_MARKER_REFERENCE_TARGETS.length * PRESENTER_MARKER_REFERENCE_SEEDS.length,
    );
    assert.ok(variants.every((variant) => variant.querySelector('[data-protected-safe-area]')));
    assert.ok(variants.every((variant) => variant.querySelector('[data-tail-start]')));
    assert.ok(variants.every((variant) => variant.querySelector('[data-tail-end]')));
  }
});

test('static reference paths are byte-identical to production geometry output', () => {
  let marker = 'route';
  let targetSpec = PRESENTER_MARKER_REFERENCE_TARGETS[1];
  let seed = PRESENTER_MARKER_REFERENCE_SEEDS[0];
  let expected = createPresenterMarkerGeometry({
    marker,
    targetRect: targetSpec.rect,
    seed,
    viewport: { width: 640, height: 210 },
  });
  let { document } = parseHTML(renderPresenterMarkerReferenceSheet(marker, {
    targetSpecs: [targetSpec],
    seeds: [seed],
  }));
  assert.equal(document.querySelector('[data-production-ribbon]').getAttribute('d'), expected.render.ribbonPath);
  assert.equal(document.querySelector('[data-production-ribbon]').dataset.pathHash, expected.kinematics.normalizedPathHash);
});

test('real presenter renderer and exported production geometry share the same path hash and ribbon', () => {
  let { document } = parseHTML('<html><body></body></html>');
  let rect = { left: 250, top: 70, width: 100, height: 60 };
  let viewport = { width: 640, height: 210 };
  let seed = PRESENTER_MARKER_REFERENCE_SEEDS[0];
  let element = target(document, rect);
  let cursor = createPresenterCursor(document);
  let frame = cursor.presentAnnotationFrame(element, { marker: 'oval' }, { progress: 1, seed, viewport });
  let production = createPresenterMarkerGeometry({ marker: 'oval', targetRect: rect, seed, viewport });

  assert.equal(frame.normalizedPathHash, production.kinematics.normalizedPathHash);
  assert.equal(document.querySelector('.pc-ink path').getAttribute('d'), production.render.ribbonPath);
  cursor.dispose();
});

test('contact sheet contains exactly one production-rendered sample for every catalog marker', () => {
  let { document } = parseHTML(renderPresenterMarkerContactSheet());
  let samples = [...document.querySelectorAll('[data-contact-marker]')];
  assert.deepEqual(samples.map((sample) => sample.dataset.contactMarker), PRESENTER_MARKER_CATALOG.map(({ name }) => name));
  assert.ok(samples.every((sample) => sample.querySelector('[data-production-ribbon]')));
});
