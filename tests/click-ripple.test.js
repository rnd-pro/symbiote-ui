import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import {
  CLICK_RIPPLE_CLASS,
  CLICK_RIPPLE_DURATION_MS,
  CLICK_RIPPLE_STYLE_ID,
  ensureClickRippleStyles,
  showClickRipple,
} from '../ui/click-ripple.js';

test('click ripple module is Node-safe without a DOM', () => {
  let originalDocument = globalThis.document;
  try {
    delete globalThis.document;
    assert.equal(showClickRipple({ x: 10, y: 10 }), null);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('showClickRipple appends a positioned ripple element at the click point', () => {
  let { document } = parseHTML('<html><body></body></html>');
  let ripple = showClickRipple({ x: 120, y: 45, doc: document });
  assert.ok(ripple, 'ripple element returned');
  assert.equal(ripple.classList.contains(CLICK_RIPPLE_CLASS), true);
  assert.equal(ripple.parentNode, document.body);
  assert.equal(ripple.style.left, '120px');
  assert.equal(ripple.style.top, '45px');
  assert.equal(ripple.getAttribute('aria-hidden'), 'true');
});

test('showClickRipple injects its stylesheet once into the document head', () => {
  let { document } = parseHTML('<html><head></head><body></body></html>');
  showClickRipple({ x: 1, y: 1, doc: document });
  showClickRipple({ x: 2, y: 2, doc: document });
  let styles = document.querySelectorAll(`#${CLICK_RIPPLE_STYLE_ID}`);
  assert.equal(styles.length, 1);
  assert.match(String(styles[0].textContent), new RegExp(`\\.${CLICK_RIPPLE_CLASS}\\b`));
  assert.equal(document.querySelectorAll(`.${CLICK_RIPPLE_CLASS}`).length, 2);
  assert.equal(ensureClickRippleStyles(document), styles[0]);
});

test('showClickRipple clamps non-finite coordinates and tolerates edge inputs', () => {
  let { document } = parseHTML('<html><body></body></html>');
  let ripple = showClickRipple({ x: Number.NaN, y: Number.POSITIVE_INFINITY, doc: document });
  assert.equal(ripple.style.left, '0px');
  assert.equal(ripple.style.top, '0px');
});

test('ripple self-removes after the animation duration', async () => {
  let { document } = parseHTML('<html><body></body></html>');
  showClickRipple({ x: 8, y: 8, doc: document });
  assert.equal(document.querySelectorAll(`.${CLICK_RIPPLE_CLASS}`).length, 1);
  await new Promise((resolve) => setTimeout(resolve, CLICK_RIPPLE_DURATION_MS + 120));
  assert.equal(document.querySelectorAll(`.${CLICK_RIPPLE_CLASS}`).length, 0);
});
