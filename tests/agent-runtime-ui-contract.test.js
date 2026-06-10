import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { test } from 'node:test';

class TestCSSStyleSheet {
  replaceSync(text) {
    this.cssText = text;
  }
}

function installSsrDom() {
  let { window } = parseHTML('<!doctype html><html><body></body></html>');
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
  return window;
}

installSsrDom();

const { toChatMessageItem, normalizeChatMessagePart, MESSAGE_PART_KINDS } = await import('../chat/message-model.js');
await import('../chat/ChatMessageItem/ChatMessageItem.js');
const { ChatTranscript } = await import('../chat/ChatTranscript/ChatTranscript.js');

async function nextRenderTick() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test('message-part model normalization works', () => {
  assert.equal(MESSAGE_PART_KINDS.TEXT, 'text');
  assert.equal(MESSAGE_PART_KINDS.APPROVAL, 'approval');

  let textPart = normalizeChatMessagePart({ type: 'text', content: 'hello' });
  assert.equal(textPart.type, 'text');
  assert.equal(textPart.text, 'hello');

  let streamPart = normalizeChatMessagePart({ type: 'stream_delta', content: 'world' });
  assert.equal(streamPart.type, 'text_delta');
  assert.equal(streamPart.text, 'world');

  let toolPart = normalizeChatMessagePart({ type: 'tool_call', arguments: '{"limit":0}', output: false });
  assert.deepEqual(toolPart.args, { limit: 0 });
  assert.equal(toolPart.result, false);

  let item1 = toChatMessageItem({ role: 'assistant', text: 'hi' });
  assert.equal(item1.parts.length, 1);
  assert.equal(item1.parts[0].type, 'text');
  assert.equal(item1.parts[0].text, 'hi');

  let itemWithZeroText = toChatMessageItem({ role: 'assistant', text: 0 });
  assert.equal(itemWithZeroText.text, 0);
  assert.equal(itemWithZeroText.parts[0].text, 0);

  let item2 = toChatMessageItem({ role: 'tool', name: 'my_tool', input: { arg: 1 }, result: { ok: true } });
  assert.equal(item2.parts.length, 2);
  assert.equal(item2.parts[0].type, 'tool_call');
  assert.equal(item2.parts[0].name, 'my_tool');
  assert.deepEqual(item2.parts[0].args, { arg: 1 });
  assert.equal(item2.parts[1].type, 'tool_result');
  assert.equal(item2.parts[1].name, 'my_tool');
  assert.deepEqual(item2.parts[1].result, { ok: true });

  let item3 = toChatMessageItem({ role: 'thinking', text: 'thinking...', status: 'loading' });
  assert.equal(item3.parts.length, 1);
  assert.equal(item3.parts[0].type, 'reasoning');
  assert.equal(item3.parts[0].text, 'thinking...');
  assert.equal(item3.parts[0].status, 'loading');

  let item4 = toChatMessageItem({
    role: 'board',
    cardItems: [{ id: '1', title: 'Task 1', status: 'running', statusText: 'working' }]
  });
  assert.equal(item4.parts.length, 1);
  assert.equal(item4.parts[0].type, 'status');
  assert.equal(item4.parts[0].id, '1');
  assert.equal(item4.parts[0].title, 'Task 1');
  assert.equal(item4.parts[0].status, 'running');
  assert.equal(item4.parts[0].text, 'working');
});

test('message parts rendering works', async () => {
  let el = document.createElement('chat-message-item');
  document.body.append(el);

  el.set$({
    role: 'agent',
    done: true,
    parts: [
      { type: 'text', text: 'Here is the result:' },
      { type: 'reasoning', text: 'Still checking', status: 'active' },
      { type: 'reasoning', text: 'I need to check the data first', status: 'done' },
      { type: 'tool_call', name: 'fetch_data', args: { limit: 5 }, id: 'call-1' },
      { type: 'tool_result', name: 'fetch_data', result: { data: [1, 2] }, id: 'call-1' },
      { type: 'source', url: 'https://example.com/doc', title: 'Reference Doc' },
      { type: 'attachment', url: 'https://example.com/image.png', mimeType: 'image/png', title: 'Screenshot' },
      { type: 'artifact', text: 'return "hello";', title: 'Script' },
      { type: 'approval', text: 'Permit action?', id: 'app-1' },
      { type: 'action', title: 'Retry action', id: 'act-1' },
      { type: 'error', text: 'Failed execution' }
    ]
  });

  await nextRenderTick();

  let root = el.shadowRoot || el;
  assert.equal(root.querySelector('.msg-content')?.textContent.trim(), 'Here is the result:');
  assert.match(root.querySelector('.work-summary-wrap')?.textContent || '', /I need to check the data first/);
  assert.equal(root.querySelector('.tool-card .tool-name')?.textContent, 'fetch_data');
  assert.equal(root.querySelector('.source-badge a')?.textContent, 'Reference Doc');
  assert.equal(root.querySelector('.attachment-title')?.textContent, 'Screenshot');
  assert.equal(root.querySelector('.artifact-title')?.textContent, 'Script');
  assert.match(root.querySelector('.approval-card')?.textContent || '', /Permit action\?/);
  assert.match(root.querySelector('.action-card')?.textContent || '', /Retry action/);
  assert.match(root.querySelector('.error-card')?.textContent || '', /Failed execution/);
  assert.doesNotMatch(root.textContent || '', /chat\.message\./);

  el.remove();
});

test('approval and action events are dispatched properly', async () => {
  let transcriptSource = await readFile(new URL('../chat/ChatTranscript/ChatTranscript.js', import.meta.url), 'utf8');
  assert.match(transcriptSource, /new CustomEvent\(type, \{ bubbles: true, composed: true, cancelable: true, detail \}\)/);

  let transcript = document.createElement('chat-transcript');
  document.body.append(transcript);

  transcript.setMessageItems([
    toChatMessageItem({
      role: 'agent',
      parts: [
        { type: 'approval', text: 'Permit action?', id: 'app-1' },
        { type: 'action', title: 'Retry action', id: 'act-1' }
      ]
    })
  ]);

  await nextRenderTick();

  let approvalPromise = new Promise((resolve) => {
    transcript.addEventListener('chat-approval', (event) => {
      resolve({ ...event.detail, event });
    });
  });

  let approveBtn = transcript.querySelector('.approval-btn.approve');
  assert.ok(approveBtn);
  approveBtn.click();

  let approvalDetail = await approvalPromise;
  assert.equal(approvalDetail.id, 'app-1');
  assert.equal(approvalDetail.action, 'approve');
  assert.equal(approvalDetail.event.cancelable, true);
  assert.equal(approvalDetail.event.bubbles, true);

  let actionPromise = new Promise((resolve) => {
    transcript.addEventListener('chat-action', (event) => {
      event.preventDefault();
      resolve({ ...event.detail, event });
    });
  });

  let actBtn = transcript.querySelector('.action-btn');
  assert.ok(actBtn);
  actBtn.click();

  let actionDetail = await actionPromise;
  assert.equal(actionDetail.id, 'act-1');
  assert.equal(actionDetail.action, 'action');
  assert.equal(actionDetail.event.cancelable, true);
  assert.equal(actionDetail.event.bubbles, true);
  assert.equal(actionDetail.event.defaultPrevented, true);

  transcript.remove();
});

test('ChatTranscript stream auto-pin behavior works', async () => {
  let transcript = document.createElement('chat-transcript');
  document.body.append(transcript);

  let scrollToBottomCalls = 0;
  transcript.scrollToBottom = () => {
    scrollToBottomCalls += 1;
  };

  transcript.isAtBottom = () => true;

  transcript.setMessageItems([
    toChatMessageItem({ role: 'user', text: 'hello' })
  ]);

  await nextRenderTick();
  assert.equal(scrollToBottomCalls, 1);

  scrollToBottomCalls = 0;
  transcript.isAtBottom = () => false;

  transcript.setMessageItems([
    toChatMessageItem({ role: 'user', text: 'hello' }),
    toChatMessageItem({ role: 'agent', text: 'hi' })
  ]);

  await nextRenderTick();
  assert.equal(scrollToBottomCalls, 0);

  transcript.remove();
});
