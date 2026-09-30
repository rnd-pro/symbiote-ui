import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

import {
  MESSAGE_PART_KINDS,
  normalizeChatMessagePart,
} from '../chat/message-model.js';

let { window } = parseHTML('<!doctype html><html><body></body></html>');
class TestCSSStyleSheet {
  replaceSync(text) { this.cssText = text; }
}
Object.assign(globalThis, {
  window,
  document: window.document,
  HTMLElement: window.HTMLElement,
  customElements: window.customElements,
  CustomEvent: window.CustomEvent,
  CSSStyleSheet: TestCSSStyleSheet,
});
window.document.adoptedStyleSheets = [];
let { ChatMessageItem } = await import('../chat/ChatMessageItem/ChatMessageItem.js');

test('chat message model publishes reusable footnote and contextual action parts', () => {
  assert.equal(MESSAGE_PART_KINDS.FOOTNOTE, 'footnote');
  assert.equal(MESSAGE_PART_KINDS.ACTIONS, 'actions');
  let footnote = normalizeChatMessagePart({
    type: 'footnote',
    id: 'note-1',
    text: 'Reusable supporting context',
    url: 'https://example.test/reference',
    meta: { referenceId: 'ref-1' },
  });
  assert.equal(footnote.type, 'footnote');
  assert.equal(footnote.text, 'Reusable supporting context');
  assert.equal(footnote.meta.referenceId, 'ref-1');
});

test('chat message item renders footnotes as accessible product-neutral asides', () => {
  let html = ChatMessageItem.prototype._renderParts.call({
    $: {
      parts: [normalizeChatMessagePart({ type: 'footnote', text: 'Supporting context', meta: { referenceId: 'ref-1' } })],
      isStreaming: false,
    },
  });
  assert.match(html, /<aside class="footnote-card"/);
  assert.match(html, /data-reference-id="ref-1"/);
  assert.match(html, /Supporting context/);
});

test('custom-elements metadata publishes footnote parts and contextual action events', async () => {
  let manifest = JSON.parse(await readFile(new URL('../custom-elements.json', import.meta.url), 'utf8'));
  let declaration = manifest.modules
    .flatMap((module) => module.declarations || [])
    .find((item) => item.tagName === 'chat-message-item');
  assert.ok(declaration.contract.capabilities.includes('footnote-part'));
  assert.ok(declaration.contract.capabilities.includes('contextual-actions'));
  assert.ok(declaration.contract.properties.some((property) => property.name === 'parts'));
  assert.ok(declaration.contract.events.some((event) => event.name === 'chat-message-action'));
});
