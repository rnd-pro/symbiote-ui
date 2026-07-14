import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

class TestCSSStyleSheet {
  replaceSync(text) {
    this.cssText = text;
  }
}

function installDom() {
  let { window } = parseHTML('<!doctype html><html><head></head><body></body></html>');
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    customElements: window.customElements,
    Node: window.Node,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    KeyboardEvent: window.KeyboardEvent,
    MutationObserver: window.MutationObserver,
    CSSStyleSheet: TestCSSStyleSheet,
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
  });
  window.document.adoptedStyleSheets = [];
  Object.defineProperty(window.HTMLElement.prototype, 'adoptedStyleSheets', {
    configurable: true,
    get() {
      return this.__symbioteSsrSheets || [];
    },
    set(value) {
      this.__symbioteSsrSheets = value;
    },
  });
  globalThis.getComputedStyle = (element) => ({
    getPropertyValue(prop) {
      return element?.style?.getPropertyValue?.(prop) || '';
    },
  });
}

installDom();

const { normalizeMediaDescriptor } = await import('../graph/media-descriptor.js');
await import('../node/GraphNode/GraphNode.js');

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeNode(params) {
  return {
    id: 'node-1',
    label: 'Case study',
    category: 'default',
    icon: '',
    shape: 'rect',
    type: 'default',
    params,
    inputs: {},
    outputs: {},
    controls: {},
  };
}

async function mountGraphNode(params) {
  let el = document.createElement('graph-node');
  el._nodeData = makeNode(params);
  el.setAttribute('node-id', 'node-1');
  document.body.append(el);
  await tick();
  return el;
}

test('media node renders a clean poster and keyboard-activatable button, never an iframe', async () => {
  let descriptor = normalizeMediaDescriptor({
    kind: 'video',
    poster: 'https://cdn.example/poster.jpg',
    alt: 'Lesson intro',
    fit: 'crop',
    activation: { provider: 'youtube', videoId: 'abc123XYZ_-' },
    targetIds: ['project-a', 'pulse-b'],
  });

  let el = await mountGraphNode({ media: descriptor });

  let img = el.querySelector('.sn-node-media-img');
  assert.ok(img, 'poster image is rendered');
  assert.equal(img.getAttribute('src'), 'https://cdn.example/poster.jpg');

  assert.equal(el.querySelector('.sn-node-media-badge'), null, 'media type is not overlaid on the poster');

  let button = el.querySelector('.sn-node-media-activate');
  assert.ok(button && !button.hasAttribute('hidden'), 'activation button is visible');
  assert.equal(button.tagName.toLowerCase(), 'button', 'native button gives keyboard activation');
  assert.equal(button.getAttribute('type'), 'button');
  assert.ok((button.getAttribute('aria-label') || '').includes('Lesson intro'), 'accessible name present');

  assert.equal(el.querySelectorAll('iframe').length, 0, 'graph node never mounts a player');
  assert.equal(el.getAttribute('data-media-fit'), 'cover', 'descriptor fit maps to object-fit attribute');
});

test('activating a media node emits a bubbling sn-media-activate intent carrying the descriptor', async () => {
  let descriptor = normalizeMediaDescriptor({
    kind: 'gallery',
    poster: 'https://cdn.example/g.jpg',
    alt: 'Gallery',
    activation: { provider: 'ims', src: 'https://cdn.example/gallery.json' },
    targetIds: ['project-a'],
  });

  let el = await mountGraphNode({ media: descriptor });

  let received = [];
  document.addEventListener('sn-media-activate', (event) => received.push(event));

  let button = el.querySelector('.sn-node-media-activate');
  let clickEvent = new window.CustomEvent('click', { bubbles: true });
  button.dispatchEvent(clickEvent);

  assert.equal(received.length, 1, 'exactly one activation intent');
  let intent = received[0];
  assert.equal(intent.bubbles, true);
  assert.deepEqual(intent.detail.descriptor, descriptor, 'intent carries the normalized descriptor');
  assert.equal(intent.detail.nodeId, 'node-1');
});

test('media activation pointer input does not start node selection or dragging', async () => {
  let descriptor = normalizeMediaDescriptor({
    kind: 'video',
    poster: 'https://cdn.example/video.jpg',
    alt: 'Video',
    activation: { provider: 'youtube', videoId: 'abc123XYZ_-' },
    targetIds: ['project-a'],
  });
  let el = await mountGraphNode({ media: descriptor });
  let pointerDowns = 0;
  el.addEventListener('pointerdown', () => pointerDowns++);

  el.querySelector('.sn-node-media-activate').dispatchEvent(
    new window.CustomEvent('pointerdown', { bubbles: true }),
  );

  assert.equal(pointerDowns, 0, 'the native media button owns pointer activation');
});

test('plain image nodes render a poster only, with no activation affordance', async () => {
  let el = await mountGraphNode({ image: 'https://cdn.example/avatar.png', imageAlt: 'Avatar' });

  let img = el.querySelector('.sn-node-media-img');
  assert.equal(img.getAttribute('src'), 'https://cdn.example/avatar.png');

  let button = el.querySelector('.sn-node-media-activate');
  assert.ok(button.hasAttribute('hidden'), 'no activation button for non-activatable media');
  assert.equal(el.querySelector('.sn-node-media-badge'), null, 'plain images have no type overlay');

  let received = [];
  document.addEventListener('sn-media-activate', (event) => received.push(event));
  button.dispatchEvent(new window.CustomEvent('click', { bubbles: true }));
  assert.equal(received.length, 0, 'a plain image node emits no activation intent');
});

test('hidden media activation controls stay out of layout', async () => {
  let source = await readFile(new URL('../node/GraphNode/GraphNode.css.js', import.meta.url), 'utf8');

  assert.match(
    source,
    /\.sn-node-media-activate\[hidden\]\s*\{[^}]*display:\s*none;/s,
    'component styles must preserve the native hidden contract',
  );
});
