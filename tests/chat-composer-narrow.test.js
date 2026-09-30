import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { parseHTML } from 'linkedom';

class TestCSSStyleSheet {
  replaceSync(text) {
    this.cssText = text;
  }
}

function installSsrDom() {
  let { window } = parseHTML('<!doctype html><html><body></body></html>');
  let baseGetComputedStyle = window.getComputedStyle?.bind(window);
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    customElements: window.customElements,
    Node: window.Node,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    MutationObserver: window.MutationObserver,
    CSSStyleSheet: TestCSSStyleSheet,
    getComputedStyle: (el) => {
      let computed = baseGetComputedStyle?.(el) || {};
      return {
        ...computed,
        transitionDuration: computed.transitionDuration || '0s',
        getPropertyValue: (name) => computed.getPropertyValue?.(name) || '',
      };
    },
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
}

installSsrDom();

await import('../chat/ChatComposer/ChatComposer.js');

async function nextRenderTick() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function extractBlock(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing block: ${marker}`);
  const openingBrace = source.indexOf('{', start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(openingBrace + 1, index);
  }
  assert.fail(`Unclosed block: ${marker}`);
}

test('ChatComposer CSS layout <=480px block has no three-row grid override for .composer-body', () => {
  const css = fs.readFileSync('chat/ChatComposer/ChatComposer.css.js', 'utf8');
  const narrowBlock = extractBlock(css, '@container chat-composer (width <= 480px)');
  assert.ok(!narrowBlock.includes('.composer-body'), 'Should not override .composer-body layout in narrow block');
  assert.ok(!narrowBlock.includes('grid-row: 3'), 'Should not place controls on a third row');
  assert.ok(!narrowBlock.includes('grid-template-rows'), 'Should preserve the base two-row composer layout');
});

test('ChatComposer JS templates bind accessibleName via aria-label', () => {
  const js = fs.readFileSync('chat/ChatComposer/ChatComposer.js', 'utf8');
  assert.match(js, /<select class="composer-footer-select"[^>]*'@aria-label': 'accessibleName'/);
  assert.match(js, /<input class="composer-footer-checkbox"[^>]*'@aria-label': 'accessibleName'/);
  assert.match(js, /accessibleName = String\(item\.title \|\| item\.label \|\| item\.id \|\| ''\)/);
});

test('voice language control renders host title on the DOM button title and aria-label', async () => {
  let composer = document.createElement('chat-composer');
  document.body.append(composer);
  await nextRenderTick();

  composer.setVoiceControls({ language: { visible: true, title: 'Conversation language: Русский' } });

  let btn = composer.ref.voiceLanguageBtn;
  assert.ok(btn, 'voice language button is rendered');
  assert.equal(btn.hidden, false);
  assert.equal(btn.title, 'Conversation language: Русский');
  assert.equal(btn.getAttribute('aria-label'), 'Conversation language: Русский');

  composer.remove();
});

test('voice language control with empty title keeps the template default tooltip', async () => {
  let composer = document.createElement('chat-composer');
  document.body.append(composer);
  await nextRenderTick();

  composer.setVoiceLanguageState({ visible: true, title: '' });

  let btn = composer.ref.voiceLanguageBtn;
  assert.ok(btn, 'voice language button is rendered');
  assert.equal(btn.title, 'Voice language');
  assert.equal(btn.getAttribute('aria-label'), null);

  composer.remove();
});
