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
  return window;
}

installSsrDom();

const { toChatMessageItem, normalizeChatMessagePart, MESSAGE_PART_KINDS } = await import('../chat/message-model.js');
await import('../chat/ChatMessageItem/ChatMessageItem.js');
const { ChatTranscript } = await import('../chat/ChatTranscript/ChatTranscript.js');
await import('../chat/ChatWorkspace/ChatWorkspace.js');

async function nextRenderTick() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function messageItemText(item) {
  return (item.shadowRoot || item).textContent.trim();
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
  let toolCards = root.querySelectorAll('.tool-card');
  assert.equal(toolCards.length, 1);
  assert.equal(toolCards[0].querySelector('.tool-name')?.textContent, 'fetch_data');
  let toolSections = toolCards[0].querySelectorAll('.tool-section');
  assert.equal(toolSections.length, 2);
  assert.match(toolSections[0].textContent || '', /"limit": 5/);
  assert.match(toolSections[1].textContent || '', /"data": \[/);
  assert.equal(root.querySelector('.source-badge a')?.textContent, 'Reference Doc');
  assert.equal(root.querySelector('.attachment-title')?.textContent, 'Screenshot');
  assert.equal(root.querySelector('.artifact-title')?.textContent, 'Script');
  assert.match(root.querySelector('.approval-card')?.textContent || '', /Permit action\?/);
  assert.match(root.querySelector('.action-card')?.textContent || '', /Retry action/);
  assert.match(root.querySelector('.error-card')?.textContent || '', /Failed execution/);
  assert.doesNotMatch(root.textContent || '', /chat\.message\./);

  el.remove();
});

test('only the latest tool message opens its paired tool details', async () => {
  let first = document.createElement('chat-message-item');
  let latest = document.createElement('chat-message-item');
  document.body.append(first, latest);

  first.set$({
    role: 'tool',
    isLatestTool: false,
    parts: [
      { type: 'tool_call', name: 'read_file', args: { path: 'old.js' } },
      { type: 'tool_result', name: 'read_file', result: 'ok' },
    ],
  });
  latest.set$({
    role: 'tool',
    isLatestTool: true,
    parts: [
      { type: 'tool_call', name: 'write_file', args: { path: 'new.js' } },
      { type: 'tool_result', name: 'write_file', result: 'ok' },
    ],
  });

  await nextRenderTick();

  let firstRoot = first.shadowRoot || first;
  let latestRoot = latest.shadowRoot || latest;
  let firstCards = firstRoot.querySelectorAll('.tool-card');
  let latestCards = latestRoot.querySelectorAll('.tool-card');

  assert.equal(firstCards.length, 1);
  assert.equal(latestCards.length, 1);
  assert.equal(firstCards[0].hasAttribute('open'), false);
  assert.equal(latestCards[0].hasAttribute('open'), true);
  assert.match(latestCards[0].textContent || '', /new\.js/);
  assert.match(latestCards[0].textContent || '', /ok/);

  first.remove();
  latest.remove();
});

test('adjacent unnamed tool results stay inside the previous tool card', async () => {
  let el = document.createElement('chat-message-item');
  document.body.append(el);

  el.set$({
    role: 'tool',
    isLatestTool: true,
    parts: [
      { type: 'tool_call', name: 'mcp_tool', args: { goalId: 'goal-1' } },
      { type: 'tool_result', result: { ok: true } },
    ],
  });

  await nextRenderTick();

  let root = el.shadowRoot || el;
  let message = root.querySelector('.message.tool');
  let cards = message.querySelectorAll(':scope > details.tool-card');
  let sections = cards[0].querySelectorAll('.tool-section');

  assert.equal(cards.length, 1);
  assert.equal(cards[0].hasAttribute('open'), true);
  assert.equal(sections.length, 2);
  assert.match(sections[0].textContent || '', /goal-1/);
  assert.match(sections[1].textContent || '', /ok/);

  el.remove();
});

test('legacy tool messages render one paired full-width card in transcripts', async () => {
  let transcript = document.createElement('chat-transcript');
  document.body.append(transcript);

  transcript.setMessageItems([
    toChatMessageItem({
      role: 'tool',
      name: 'mcp_tool',
      input: { goalId: 'goal-1' },
      result: { ok: true },
    }, { isLatestTool: true }),
  ]);

  await nextRenderTick();

  let item = transcript.querySelector('chat-message-item');
  let root = item.shadowRoot || item;
  let message = root.querySelector('.message.tool');
  let cards = message.querySelectorAll(':scope > details.tool-card');
  let sections = cards[0].querySelectorAll('.tool-section');

  assert.equal(cards.length, 1);
  assert.equal(cards[0].hasAttribute('open'), true);
  assert.equal(sections.length, 2);
  assert.match(sections[0].textContent || '', /goal-1/);
  assert.match(sections[1].textContent || '', /ok/);

  transcript.remove();
});

test('tool message cards use a vertical full-width layout', async () => {
  let source = await readFile(
    new URL('../chat/ChatMessageItem/ChatMessageItem.css.js', import.meta.url),
    'utf8',
  );

  assert.match(source, /\.message\.tool\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(source, /\.tool-card\s*\{[^}]*width:\s*100%/s);
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

test('ChatTranscript message windows can replace and prepend without using host chat state', async () => {
  let transcript = document.createElement('chat-transcript');
  document.body.append(transcript);

  transcript.replaceMessageWindow([
    toChatMessageItem({ role: 'assistant', text: 'message-2' }),
    toChatMessageItem({ role: 'assistant', text: 'message-3' }),
  ], {
    startIndex: 2,
    totalItems: 5,
  });

  await nextRenderTick();
  assert.deepEqual(
    Array.from(transcript.querySelectorAll('chat-message-item')).map(messageItemText),
    ['message-2', 'message-3'],
  );
  assert.deepEqual(transcript.getMessageWindow(), {
    startIndex: 2,
    count: 2,
    totalItems: 5,
    hasOlder: true,
    hasNewer: true,
  });

  transcript.prependMessageItems([
    toChatMessageItem({ role: 'user', text: 'message-0' }),
    toChatMessageItem({ role: 'user', text: 'message-1' }),
  ], {
    startIndex: 0,
    totalItems: 5,
    hasOlder: false,
    hasNewer: true,
  });

  await nextRenderTick();
  assert.deepEqual(
    Array.from(transcript.querySelectorAll('chat-message-item')).map(messageItemText),
    ['message-0', 'message-1', 'message-2', 'message-3'],
  );
  assert.deepEqual(transcript.getMessageWindow(), {
    startIndex: 0,
    count: 4,
    totalItems: 5,
    hasOlder: false,
    hasNewer: true,
  });

  transcript.setMessageItems([
    toChatMessageItem({ role: 'assistant', text: 'full-reset' }),
  ]);
  assert.deepEqual(transcript.getMessageWindow(), {
    startIndex: 0,
    count: 1,
    totalItems: 1,
    hasOlder: false,
    hasNewer: false,
  });

  transcript.remove();
});

test('ChatWorkspace forwards transcript window APIs and load older events', async () => {
  let workspace = document.createElement('chat-workspace');
  document.body.append(workspace);
  await nextRenderTick();

  workspace.replaceMessageWindow([
    toChatMessageItem({ role: 'assistant', text: 'workspace-message-1' }),
  ], {
    startIndex: 1,
    totalItems: 3,
  });

  await nextRenderTick();
  assert.deepEqual(workspace.getMessageWindow(), {
    startIndex: 1,
    count: 1,
    totalItems: 3,
    hasOlder: true,
    hasNewer: true,
  });

  workspace.prependMessages([
    toChatMessageItem({ role: 'user', text: 'workspace-message-0' }),
  ], {
    startIndex: 0,
    totalItems: 3,
  });

  await nextRenderTick();
  assert.deepEqual(
    Array.from(workspace.getTranscript().querySelectorAll('chat-message-item')).map(messageItemText),
    ['workspace-message-0', 'workspace-message-1'],
  );

  let eventPromise = new Promise((resolve) => {
    workspace.addEventListener('chat-workspace-load-older', (event) => resolve(event.detail));
  });
  workspace.getTranscript().dispatchEvent(new CustomEvent('chat-transcript-load-older', {
    bubbles: true,
    composed: true,
    detail: { fromIndex: 0 },
  }));

  let detail = await eventPromise;
  assert.equal(detail.fromIndex, 0);
  assert.equal(detail.sourceEvent, 'chat-transcript-load-older');

  workspace.remove();
});
