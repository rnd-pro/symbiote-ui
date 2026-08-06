import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import {
  DOM_RASTER_INACTIVE_ATTRIBUTE,
  setDomRasterLayoutActivity,
} from '../xr/dom-raster-source-deck.js';

test('DOM raster source deck toggles inactive accessibility state idempotently', () => {
  let { document } = parseHTML('<html><body><section id="layout"></section></body></html>');
  let layout = document.querySelector('#layout');

  assert.equal(setDomRasterLayoutActivity(layout, false), false);
  assert.equal(setDomRasterLayoutActivity(layout, false), false);
  assert.equal(layout.hasAttribute(DOM_RASTER_INACTIVE_ATTRIBUTE), true);
  assert.equal(layout.hasAttribute('inert'), true);
  assert.equal(layout.getAttribute('aria-hidden'), 'true');

  assert.equal(setDomRasterLayoutActivity(layout, true), true);
  assert.equal(setDomRasterLayoutActivity(layout, true), true);
  assert.equal(layout.hasAttribute(DOM_RASTER_INACTIVE_ATTRIBUTE), false);
  assert.equal(layout.hasAttribute('inert'), false);
  assert.equal(layout.hasAttribute('aria-hidden'), false);
});

test('DOM raster source deck restores pre-existing inert and aria-hidden values exactly', () => {
  let { document } = parseHTML('<html><body><section id="layout" inert aria-hidden="false"></section></body></html>');
  let layout = document.querySelector('#layout');

  setDomRasterLayoutActivity(layout, false);
  assert.equal(layout.getAttribute('aria-hidden'), 'true');
  setDomRasterLayoutActivity(layout, true);

  assert.equal(layout.hasAttribute('inert'), true);
  assert.equal(layout.getAttribute('inert'), '');
  assert.equal(layout.getAttribute('aria-hidden'), 'false');
});

test('DOM raster source deck rejects invalid activity requests', () => {
  assert.throws(() => setDomRasterLayoutActivity(null, false), /requires a DOM element/);
  let { document } = parseHTML('<html><body><section></section></body></html>');
  assert.throws(() => setDomRasterLayoutActivity(document.querySelector('section'), 'inactive'), /must be a boolean/);
});

test('DOM raster source deck is a public SSR-safe provider entrypoint', async () => {
  let publicModule = await import('symbiote-ui/xr/dom-raster-source-deck');
  assert.equal(publicModule.DOM_RASTER_INACTIVE_ATTRIBUTE, DOM_RASTER_INACTIVE_ATTRIBUTE);
  assert.equal(publicModule.setDomRasterLayoutActivity, setDomRasterLayoutActivity);

  let { cmdDiscover } = await import('../discover.js');
  let discovery = await cmdDiscover();
  let entrypoint = discovery.exports.entrypoints.find((entry) => (
    entry.specifier === 'symbiote-ui/xr/dom-raster-source-deck'
  ));
  assert.ok(entrypoint, 'discover lists the DOM raster source deck entrypoint');
  assert.equal(entrypoint.kind, 'ssr-entry-safe');
  let packageExport = discovery.exports.subpaths.find((entry) => (
    entry.specifier === 'symbiote-ui/xr/dom-raster-source-deck'
  ));
  assert.equal(packageExport?.target, './xr/dom-raster-source-deck.js');
});
