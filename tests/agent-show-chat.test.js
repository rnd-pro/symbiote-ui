import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  AgentShowConversation,
  createScriptedAgentProvider,
} from '../chat/agent-show.js';
import { SHOW_RUNTIME_CONTRACT } from '../manifest/show-runtime-catalog.js';
import { DEFAULT_PROVIDER_THEME } from '../themes/default-provider.js';

class TestCSSStyleSheet {
  replaceSync(text) {
    this.cssText = text;
  }
}

let testWindow = null;
let resizeObservers = [];

class TestResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.targets = new Set();
    this.observeCalls = 0;
    this.disconnectCalls = 0;
    resizeObservers.push(this);
  }

  observe(target) {
    this.observeCalls += 1;
    this.targets.add(target);
  }

  disconnect() {
    this.disconnectCalls += 1;
    this.targets.clear();
  }
}

function installDom() {
  if (testWindow) {
    testWindow.document.body.innerHTML = '';
    testWindow.document.adoptedStyleSheets = [];
    resizeObservers = [];
    return testWindow;
  }
  let { window } = parseHTML('<!doctype html><html><body></body></html>');
  testWindow = window;
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
    ResizeObserver: TestResizeObserver,
    CSSStyleSheet: TestCSSStyleSheet,
    requestAnimationFrame: (callback) => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: clearTimeout,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  });
  if (window.HTMLTextAreaElement && !window.HTMLTextAreaElement.prototype.setSelectionRange) {
    window.HTMLTextAreaElement.prototype.setSelectionRange = () => {};
  }
  window.document.adoptedStyleSheets = [];
  return window;
}

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

test('scripted provider keeps one respond boundary and conversation preserves usable contextual history', async () => {
  assert.equal(SHOW_RUNTIME_CONTRACT.chatComposition.specifier, 'symbiote-ui/chat/show-chat');
  assert.equal(SHOW_RUNTIME_CONTRACT.chatComposition.providerMethod, 'respond');
  assert.equal(SHOW_RUNTIME_CONTRACT.chatComposition.actionGatesPlayback, false);
  let provider = createScriptedAgentProvider({
    routes: [
      {
        when: { type: 'message', input: 'start' },
        response: { messages: [
          { role: 'agent', parts: [{ type: 'actions', id: 'first', actions: [{ id: 'details-1', label: 'Details' }] }] },
          { role: 'agent', parts: [{ type: 'embed', key: 'short' }] },
        ] },
      },
      {
        when: { type: 'action', actionId: 'details-1' },
        response: { message: {
          role: 'agent',
          parts: [{ type: 'actions', id: 'second', actions: [{ id: 'details-2', label: 'More' }] }],
        } },
      },
    ],
  });
  assert.deepEqual(Object.keys(provider), ['respond']);

  let conversation = new AgentShowConversation({ provider });
  await conversation.respond({ type: 'message', input: 'start' });
  await conversation.respond({ type: 'action', actionId: 'details-1', payload: { subjectId: 'generic' } });

  assert.deepEqual(conversation.messages.map((message) => message.role), ['user', 'agent', 'agent', 'agent']);
  let items = conversation.messageItems;
  let actionParts = items.flatMap((item) => item.parts.filter((part) => part.type === 'actions'));
  assert.deepEqual(actionParts.map((part) => part.meta.actionState), ['historical', 'current']);
  assert.equal(actionParts[0].actions[0].id, 'details-1', 'historical action remains available');
  assert.equal(actionParts[1].actions[0].id, 'details-2');
});

test('chat-show-player reflects injected timeline/controller state and autoplays without contextual action gating', async () => {
  installDom();
  await import('../chat/show-chat.js');

  let calls = [];
  let videoCalls = [];
  let controller = {
    index: 0,
    isPlaying: false,
    play() { calls.push('play'); this.isPlaying = true; this.onStateChange?.('playing'); },
    toggle() { calls.push('toggle'); },
    prev() { calls.push('prev'); },
    next() { calls.push('next'); },
    stop() { calls.push('stop'); },
    preview(index) { calls.push(`preview:${index}`); },
  };
  let player = document.createElement('chat-show-player');
  player.bind({
    controller,
    title: 'Reusable show',
    autoplay: true,
    timeline: {
      turns: [
        { id: 'one', persona: 'guide', text: 'First recognized caption' },
        { id: 'two', persona: 'agent', text: 'Second recognized caption' },
        { id: 'three', persona: 'guide', text: 'Third recognized caption' },
      ],
    },
    videoController: {
      openDetail(detail) { videoCalls.push({ action: 'openDetail', detail }); },
      preview(detail) { videoCalls.push({ action: 'preview', detail }); },
    },
    videoControls: [
      { id: 'detail', label: 'Open video', action: 'openDetail', semantics: 'detail' },
      { id: 'short-preview', label: 'Preview only', action: 'preview', semantics: 'pointer-only' },
    ],
  });
  document.body.append(player);
  await settle();

  assert.equal(player.querySelector('.chat-show-title').textContent, 'Reusable show');
  assert.equal(player.querySelector('.chat-show-icon').textContent, 'auto_stories');
  assert.equal(player.querySelectorAll('.chat-show-row').length, 1, 'compact timeline renders only the current row');
  assert.equal(player.querySelector('[data-header-action="settings"]').textContent, 'more_vert');
  assert.equal(player.querySelector('[data-header-action="close"]').textContent, 'close');
  assert.equal(player.querySelector('[data-control="prev"]').textContent, 'skip_previous');
  let headerRequests = [];
  player.addEventListener('chat-show-settings-request', () => headerRequests.push('settings'));
  player.addEventListener('chat-show-close-request', () => headerRequests.push('close'));
  player.querySelector('[data-header-action="settings"]').click();
  player.querySelector('[data-header-action="close"]').click();
  assert.deepEqual(headerRequests, ['settings', 'close']);
  assert.equal(player.querySelector('.chat-show-caption-text').textContent, 'First recognized caption');
  assert.deepEqual(calls, ['play'], 'autoplay starts as soon as the embedded player is connected');

  controller.index = 1;
  controller.onIndexChange?.(1);
  assert.equal(player.querySelector('.chat-show-row[current]')?.dataset.index, '1');
  assert.equal(player.querySelector('.chat-show-caption-text').textContent, 'Second recognized caption');

  let followedWords = [];
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView(options) {
    followedWords.push({ text: this.textContent, options });
  };
  player.setState({
    index: 1,
    caption: {
      speaker: 'agent',
      text: 'Second recognized caption',
      words: [{ text: 'Second' }, { text: 'recognized' }, { text: 'caption' }],
      activeWordIndex: 1,
    },
    tts: { label: 'Speech', text: 'Aligned speech block', status: 'playing' },
  });
  await settle();
  assert.equal(player.querySelectorAll('.chat-show-caption-word').length, 3);
  assert.equal(player.querySelector('.chat-show-caption-word[active]').textContent, 'recognized');
  assert.equal(player.querySelector('.chat-show-caption-viewport').getAttribute('tabindex'), '0');
  assert.equal(player.querySelector('.chat-show-tts'), null, 'the duplicate TTS text surface is not rendered');
  assert.deepEqual(followedWords, [{
    text: 'recognized',
    options: { block: 'nearest', inline: 'nearest', behavior: 'smooth' },
  }]);
  delete window.HTMLElement.prototype.scrollIntoView;

  let playerStyles = (await import('../chat/ChatShowPlayer/ChatShowPlayer.css.js')).default;
  assert.match(playerStyles, /block-size:\s*calc\(3lh \+ var\(--sn-space-xs\)\)/);
  assert.match(playerStyles, /font-size:\s*var\(--sn-chat-show-font-size, var\(--sn-frame-font-size\)\)/);
  assert.match(playerStyles, /--sn-chat-show-header-control-size, var\(--sn-button-icon-size\)/);

  let videoReceipts = [];
  player.addEventListener('chat-show-video-control', (event) => videoReceipts.push(event.detail));
  player.querySelector('[data-video-control="detail"]').click();
  player.querySelector('[data-video-control="short-preview"]').click();
  assert.deepEqual(videoCalls.map(({ action }) => action), ['openDetail']);
  assert.equal(videoReceipts[0].activated, true);
  assert.equal(videoReceipts[1].activated, false);
  assert.equal(videoReceipts[1].reason, 'pointer-only');

  player.querySelector('[data-control="next"]').click();
  player.querySelector('.chat-show-row[data-index="1"]').click();
  assert.deepEqual(calls, ['play', 'next', 'preview:1']);
});

test('mixed system status and action parts stack at narrow chat widths', async () => {
  let messageStyles = (await import('../chat/ChatMessageItem/ChatMessageItem.css.js')).default;
  assert.match(messageStyles, /\.message\.system:has\(\.status-board, \.action-card, \.actions-card\)/);
  assert.match(messageStyles, /flex-direction: column/);
  assert.match(messageStyles, /\.message\.system \.status-card[\s\S]*max-inline-size: none/);
});

test('agent-dock-shell owns one standard split layout, collapse/drawer state, and preserves one chat composition', async () => {
  assert.equal(DEFAULT_PROVIDER_THEME.tokens['--sn-agent-dock-z'], '16000');
  installDom();
  await import('../chat/show-chat.js');

  let shell = document.createElement('agent-dock-shell');
  shell.getBoundingClientRect = () => ({ width: 1440, height: 844 });
  let main = document.createElement('panel-layout');
  main.setAttribute('slot', 'main');
  shell.append(main);
  document.body.append(shell);
  await settle();

  let chat = shell.getChat();
  assert.ok(chat, 'dock panel mounts the shared agent-show-chat composition');
  assert.equal(shell.ref.layout.$.layoutTree.type, 'split');
  assert.equal(shell.ref.layout.$.layoutTree.first.panelType, 'agent-dock-main');
  assert.equal(shell.ref.layout.$.layoutTree.second.panelType, 'agent-chat');
  assert.equal(shell.querySelector('.agent-dock-resizer'), null, 'the shell does not duplicate panel-layout resizing');
  assert.equal(shell.querySelector('.agent-dock-reveal'), null, 'the shell does not duplicate panel-layout reveal controls');
  assert.equal(main.closest('layout-node').$.panelType, 'agent-dock-main');

  shell.setAgentProvider({ respond: async () => ({ messages: [] }) });
  shell.setMessages([{ role: 'agent', parts: [
    { type: 'text', text: 'History stays mounted' },
    { type: 'embed', key: 'dock-show' },
  ] }]);
  shell.setShow('dock-show', {
    timeline: { turns: [{ persona: 'guide', text: 'Stable embedded player' }] },
    controller: { index: 0, isPlaying: false, play() {}, toggle() {}, prev() {}, next() {}, stop() {}, preview() {} },
  });
  await settle();
  assert.equal(shell.getChat(), chat);
  let dockPlayer = shell.querySelector('.agent-show-player-region > chat-show-player');
  assert.ok(dockPlayer);
  assert.equal(dockPlayer.parentElement.nextElementSibling, chat.getWorkspace().getComposer(), 'player is mounted directly above the composer');
  assert.equal(shell.querySelector('[data-embed-key="dock-show"] chat-show-player'), null, 'the live player stays outside transcript scrolling');

  let changes = [];
  shell.addEventListener('agent-dock-change', (event) => changes.push(event.detail));
  shell.close('test');
  assert.equal(shell.hasAttribute('closed'), true);
  assert.equal(shell.ref.layout.$.layoutTree.second.collapsed, true);
  assert.equal(shell.getChat(), chat, 'closing hides instead of recreating chat/embed state');
  shell.open('test');
  assert.equal(shell.getChat(), chat);
  assert.equal(shell.ref.layout.$.layoutTree.second.collapsed, false);
  assert.equal(shell.querySelector('.agent-show-player-region > chat-show-player'), dockPlayer);
  assert.deepEqual(changes.map(({ open }) => open), [false, true]);

  shell._isDrawerMode = () => true;
  shell.close('mobile-test');
  shell.open('mobile-test');
  assert.equal(shell.ref.layout.$.drawerEndOpen, true, 'mobile reveal uses the standard end drawer');
  shell.close('mobile-test');
  assert.equal(shell.ref.layout.$.drawerEndOpen, false);
  shell.remove();
});

test('agent-dock-shell reparenting keeps a nested panel layout responsive across repeated reconnects', async () => {
  installDom();
  await import('../chat/show-chat.js');

  let width = 1200;
  let main = document.createElement('panel-layout');
  main.setAttribute('slot', 'main');
  main.setAttribute('responsive-mode', 'swipe');
  main.setAttribute('responsive-breakpoint', '760');
  main.getBoundingClientRect = () => ({ width, height: 844, left: 0, top: 0, right: width, bottom: 844 });
  document.body.append(main);
  await settle();

  let mainObserver = resizeObservers.find((observer) => observer.targets.has(main));
  assert.ok(mainObserver, 'the initially connected consumer layout is observed');
  assert.equal(main.hasAttribute('responsive-active'), false);

  let shell = document.createElement('agent-dock-shell');
  shell.getBoundingClientRect = () => ({ width: 390, height: 844, left: 0, top: 0, right: 390, bottom: 844 });
  shell.append(main);
  document.body.append(shell);
  width = 355.6875;
  await settle();

  assert.equal(resizeObservers.filter((observer) => observer === mainObserver).length, 1);
  assert.equal(mainObserver.targets.has(main), true, 'the existing observer resumes after shell reparenting');
  assert.equal(main.hasAttribute('responsive-active'), true);
  assert.equal(main.hasAttribute('drawer-mode-active'), true);
  shell.ref.layout._clearDrawerProjection();
  assert.equal(
    main.querySelector('layout-node[node-type="panel"]').getAttribute('mobile-dock'),
    'primary',
    'an outer layout never clears drawer metadata owned by its nested layout',
  );
  let nestedPanel = main.querySelector('layout-node[node-type="panel"]');
  let stableNodeId = nestedPanel.$.nodeId;
  nestedPanel.$.nodeId = '';
  nestedPanel.removeAttribute('node-type');
  nestedPanel.removeAttribute('mobile-dock');
  main._applyResponsiveLayout();
  assert.equal(nestedPanel.getAttribute('mobile-dock'), 'primary', 'drawer projection uses canonical nodeData while DOM mirrors reconnect');
  nestedPanel.$.nodeId = stableNodeId;
  nestedPanel.setAttribute('node-type', 'panel');
  let observerCountAfterMount = resizeObservers.length;
  let observeCallsAfterMount = mainObserver.observeCalls;
  let disconnectCallsAfterMount = mainObserver.disconnectCalls;

  for (let index = 0; index < 2; index += 1) {
    main.remove();
    shell.querySelector('[data-agent-dock-main-host]').append(main);
    await settle();
  }

  assert.equal(resizeObservers.length, observerCountAfterMount, 'reconnect does not allocate replacement observers');
  assert.equal(mainObserver.targets.has(main), true);
  assert.equal(mainObserver.observeCalls, observeCallsAfterMount + 2, 'each repeated connection observes once');
  assert.equal(mainObserver.disconnectCalls, disconnectCallsAfterMount + 2, 'each repeated disconnect tears down once');
  assert.equal(main.hasAttribute('responsive-active'), true);
  assert.equal(main.hasAttribute('drawer-mode-active'), true);
  let pointerMoveCalls = 0;
  main._onDrawerPointerMove = () => { pointerMoveCalls += 1; };
  main.dispatchEvent(new Event('pointermove'));
  assert.equal(pointerMoveCalls, 1, 'reconnect does not duplicate connection-scoped pointer listeners');
  shell.remove();
});

test('panel layout reconnect restores one window resize fallback when ResizeObserver is unavailable', async () => {
  let testDom = installDom();
  let originalResizeObserver = globalThis.ResizeObserver;
  let originalAddEventListener = testDom.addEventListener.bind(testDom);
  let originalRemoveEventListener = testDom.removeEventListener.bind(testDom);
  let activeResizeListeners = new Set();
  let resizeAdds = 0;
  let resizeRemoves = 0;

  try {
    delete globalThis.ResizeObserver;
    testDom.addEventListener = (type, listener, options) => {
      if (type === 'resize') {
        resizeAdds += 1;
        activeResizeListeners.add(listener);
      }
      return originalAddEventListener(type, listener, options);
    };
    testDom.removeEventListener = (type, listener, options) => {
      if (type === 'resize') {
        resizeRemoves += 1;
        activeResizeListeners.delete(listener);
      }
      return originalRemoveEventListener(type, listener, options);
    };

    let layout = document.createElement('panel-layout');
    document.body.append(layout);
    await settle();
    assert.equal(activeResizeListeners.size, 1);

    for (let index = 0; index < 2; index += 1) {
      layout.remove();
      document.body.append(layout);
      await settle();
      assert.equal(activeResizeListeners.size, 1);
    }

    assert.equal(resizeAdds, 3);
    assert.equal(resizeRemoves, 2);
    layout.remove();
    assert.equal(activeResizeListeners.size, 0);
    assert.equal(resizeRemoves, 3);
  } finally {
    globalThis.ResizeObserver = originalResizeObserver;
    testDom.addEventListener = originalAddEventListener;
    testDom.removeEventListener = originalRemoveEventListener;
  }
});

test('agent-show-chat owns normal submit/history and preserves one fixed live player across transcript renders', async () => {
  installDom();
  await import('../chat/show-chat.js');

  let requests = [];
  let provider = {
    async respond(request) {
      requests.push(request);
      if (request.type === 'action') {
        return { message: { role: 'agent', parts: [
          { type: 'text', text: 'Optional detail' },
          { type: 'actions', id: 'follow-up', actions: [{ id: 'again', label: 'Again' }] },
        ] } };
      }
      return { messages: [
        { role: 'agent', parts: [{ type: 'actions', id: 'context', actions: [{ id: 'details', label: 'Details' }] }] },
        { role: 'agent', parts: [{ type: 'embed', key: 'short' }] },
      ] };
    },
  };
  let playCount = 0;
  let showController = {
    index: 0,
    isPlaying: false,
    play() { playCount += 1; this.isPlaying = true; },
    toggle() {}, prev() {}, next() {}, stop() {}, preview() {},
  };

  let chat = document.createElement('agent-show-chat');
  chat.setAgentProvider(provider);
  chat.setShow('short', {
    controller: showController,
    autoplay: true,
    title: 'Short',
    timeline: { turns: [{ persona: 'guide', text: 'Autonomous narration' }] },
  });
  document.body.append(chat);
  await settle();

  let composer = chat.getWorkspace().getComposer();
  assert.equal(composer.$.disabled, false, 'normal composer stays interactive');
  await chat.submit('show me');
  await settle();

  let firstPlayer = chat.querySelector('.agent-show-player-region > chat-show-player');
  assert.ok(firstPlayer, 'show player is mounted in the fixed player region');
  assert.equal(chat.ref.playerRegion.nextElementSibling, composer, 'the sole live player is pinned above the composer');
  assert.equal(chat.ref.playerRegion.previousElementSibling, chat.getWorkspace().getTranscript(), 'the transcript remains the scrolling region above the player');
  assert.equal(chat.querySelector('[data-embed-key="short"] chat-show-player'), null, 'transcript retains only the embed receipt');
  assert.equal(playCount, 1, 'short narration progresses autonomously');
  assert.equal(requests[0].type, 'message');
  assert.equal(requests[0].input, 'show me');

  chat.dispatchEvent(new CustomEvent('chat-workspace-action', {
    bubbles: true,
    detail: { id: 'context', actionId: 'details', payload: { branch: 'detail' } },
  }));
  await settle();

  assert.equal(requests[1].type, 'action', 'contextual action uses the same provider respond boundary');
  assert.equal(showController.isPlaying, true, 'optional detail does not pause or gate narration');
  let actionCards = chat.querySelectorAll('.actions-card');
  assert.equal(actionCards.length, 2, 'older contextual cards accumulate in transcript history');
  assert.equal(actionCards[0].dataset.actionState, 'historical');
  assert.equal(actionCards[0].querySelector('button').disabled, false, 'historical action remains usable');
  assert.equal(actionCards[1].dataset.actionState, 'current');
  assert.equal(chat.querySelector('.agent-show-player-region > chat-show-player'), firstPlayer, 'the same live player instance survives transcript rerender');
  chat.remove();
  await settle();
});
