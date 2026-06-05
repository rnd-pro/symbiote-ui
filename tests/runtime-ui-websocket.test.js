import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { cmdDiscover, watchDiscover } from '../discover.js';
import { createRuntimeUiController } from '../runtime/index.js';
import { triggerWebMcpCommand } from '../webmcp.js';
import { registerNodeType, clearRegistry } from 'symbiote-engine';

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.parentNode = null;
    this.removed = false;
    this.calls = [];
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  append(child) {
    child.parentNode = this;
    this.children.push(child);
  }

  appendChild(child) {
    this.append(child);
  }

  remove() {
    this.removed = true;
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  addEventListener(type, handler) {
    let list = this.listeners.get(type) || [];
    list.push(handler);
    this.listeners.set(type, list);
  }

  removeEventListener(type, handler) {
    let list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((item) => item !== handler));
  }

  dispatchEvent(event) {
    let list = this.listeners.get(event.type) || [];
    for (let handler of list) {
      handler(event);
    }
    return true;
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement('body');
  }
  createElement(tagName) {
    return new FakeElement(tagName);
  }
}

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.OPEN;
    this.sent = [];
    this.closed = false;
    MockWebSocket.lastInstance = this;

    // Simulate onopen async
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }

  send(data) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.closed = true;
    if (this.onclose) this.onclose();
  }

  simulateMessage(obj) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(obj) });
    }
  }
}

test('triggerWebMcpCommand dispatches a bubbling webmcp-command event', () => {
  let element = new FakeElement('button');
  let events = [];
  element.addEventListener('webmcp-command', (e) => {
    events.push(e);
  });

  triggerWebMcpCommand(element, 'do_something', { count: 42 });

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'webmcp-command');
  assert.equal(events[0].detail.command, 'do_something');
  assert.deepEqual(events[0].detail.args, { count: 42 });
});

test('discover returns agent metadata on registered drivers', async () => {
  clearRegistry();
  registerNodeType({
    type: 'test/custom-agent-node',
    category: 'test',
    icon: 'api',
    driver: {
      description: 'Test driver with agent metadata',
      inputs: [],
      outputs: [],
      params: {},
      agent: {
        suggestedComponents: ['sn-button', 'sn-card'],
      },
    },
  });

  let manifest = await cmdDiscover({});
  let driver = manifest.registry.drivers.find((d) => d.type === 'test/custom-agent-node');

  assert.ok(driver);
  assert.deepEqual(driver.agent, {
    suggestedComponents: ['sn-button', 'sn-card'],
  });

  clearRegistry();
});

test('createRuntimeUiController WebSocket integration handles bidirectional commands and state sync', async () => {
  let fakeDoc = new FakeDocument();
  let fakeRoot = new FakeElement('div');

  let intentResult = null;
  let controller = createRuntimeUiController({
    document: fakeDoc,
    root: fakeRoot,
    onIntent: (intent) => {
      intentResult = intent;
    },
  });

  controller.connect('ws://localhost:9999', {
    WebSocket: MockWebSocket,
    document: fakeDoc,
    root: fakeRoot,
    reconnectMs: 0,
  });

  let socket = MockWebSocket.lastInstance;
  assert.ok(socket);
  assert.equal(socket.url, 'ws://localhost:9999');

  // Verify inbound "create" action
  socket.simulateMessage({
    method: 'create',
    params: {
      node: {
        id: 'child-1',
        component: 'chat-composer',
        events: {
          'chat-composer-footer-control': 'test.footer.intent',
        },
      },
    },
  });

  let child = controller.instances.get('child-1');
  assert.ok(child);
  assert.equal(child.element.tagName, 'CHAT-COMPOSER');

  // Verify outbound intent forwarding when event triggers on created element
  child.element.dispatchEvent({
    type: 'chat-composer-footer-control',
    detail: { value: 'test' },
  });

  // Event should trigger onIntent callback locally
  assert.ok(intentResult);
  assert.equal(intentResult.action, 'test.footer.intent');

  // Event should be serialized and sent to MockWebSocket
  assert.equal(socket.sent.length, 1);
  assert.equal(socket.sent[0].method, 'intent');
  assert.equal(socket.sent[0].params.action, 'test.footer.intent');

  // Verify outbound WebMCP back-channel command forwarding
  fakeRoot.dispatchEvent({
    type: 'webmcp-command',
    detail: {
      command: 'trigger_build',
      args: { target: 'release' },
    },
  });

  assert.equal(socket.sent.length, 2);
  assert.equal(socket.sent[1].method, 'command');
  assert.equal(socket.sent[1].params.command, 'trigger_build');
  assert.deepEqual(socket.sent[1].params.args, { target: 'release' });

  // Verify inbound "update" message
  socket.simulateMessage({
    method: 'update',
    params: {
      id: 'child-1',
      state: {
        props: { placeholder: 'Type here...' },
      },
    },
  });
  assert.equal(child.element.placeholder, 'Type here...');

  // Verify inbound "destroy" message
  socket.simulateMessage({
    method: 'destroy',
    params: {
      id: 'child-1',
    },
  });
  assert.equal(controller.instances.has('child-1'), false);

  // Test disconnect cleans up event listeners
  controller.disconnect();
  assert.equal(socket.closed, true);
});

test('createRuntimeUiController WebSocket integration handles inbound reload messages', async () => {
  let fakeDoc = new FakeDocument();
  let fakeRoot = new FakeElement('div');

  let reloadParams = null;
  let eventReceived = null;

  fakeRoot.addEventListener('runtime-reload', (e) => {
    eventReceived = e;
  });

  let controller = createRuntimeUiController({
    document: fakeDoc,
    root: fakeRoot,
  });

  controller.connect('ws://localhost:9999', {
    WebSocket: MockWebSocket,
    document: fakeDoc,
    root: fakeRoot,
    reconnectMs: 0,
    onReload: (params) => {
      reloadParams = params;
    },
  });

  let socket = MockWebSocket.lastInstance;
  assert.ok(socket);

  let mockManifest = { some: 'manifest-data' };
  socket.simulateMessage({
    method: 'reload',
    params: {
      manifest: mockManifest,
      changedInfo: { type: 'register', nodeType: 'custom/node' },
    },
  });

  assert.ok(reloadParams);
  assert.deepEqual(reloadParams.manifest, mockManifest);
  assert.equal(reloadParams.changedInfo.nodeType, 'custom/node');

  assert.ok(eventReceived);
  assert.equal(eventReceived.type, 'runtime-reload');
  assert.deepEqual(eventReceived.detail.manifest, mockManifest);

  controller.disconnect();
});

test('watchDiscover monitors handler directory changes and triggers callback', async () => {
  clearRegistry();

  let tempDir = join(process.cwd(), 'tmp-watch-handlers-' + Date.now());
  mkdirSync(tempDir, { recursive: true });

  let manifests = [];
  let callbackInfo = [];

  let watcher = watchDiscover({ handlers: tempDir }, (manifest, info) => {
    manifests.push(manifest);
    callbackInfo.push(info);
  });

  // Wait a short moment to ensure watcher is ready
  await new Promise(resolve => setTimeout(resolve, 150));

  let handlerPath1 = join(tempDir, 'first.handler.js');
  writeFileSync(handlerPath1, `
    export default {
      type: 'watch/first',
      category: 'watch',
      driver: { description: 'First watched node' }
    };
  `);

  await new Promise((resolve) => {
    let check = () => {
      if (manifests.length >= 1) resolve();
      else setTimeout(check, 100);
    };
    check();
  });

  assert.ok(manifests.length >= 1);
  let latestManifest = manifests[manifests.length - 1];
  let firstDriver = latestManifest.registry.drivers.find(d => d.type === 'watch/first');

  assert.ok(firstDriver);
  assert.equal(firstDriver.description, 'First watched node');

  watcher.close();
  rmSync(tempDir, { recursive: true, force: true });
  clearRegistry();
});


