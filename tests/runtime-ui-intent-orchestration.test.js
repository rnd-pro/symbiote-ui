import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createRuntimeUiController,
  executeAgentIntent,
  createDynamicComponentRegistry,
} from '../runtime/index.js';

class FakeStyle {
  constructor() {
    this.props = new Map();
  }
  setProperty(name, val) {
    this.props.set(name, String(val));
  }
  getPropertyValue(name) {
    return this.props.get(name) || '';
  }
  removeProperty(name) {
    this.props.delete(name);
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.style = new FakeStyle();
    this.parentNode = null;
    this.removed = false;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    return this.attributes.get(name) || null;
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
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode = null;
    }
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement('body');
  }
  createElement(tagName) {
    return new FakeElement(tagName);
  }
  querySelector(selector) {
    if (selector === 'body') return this.body;
    return null;
  }
}

test('executeAgentIntent runs operations sequentially and mounts components', async () => {
  let fakeDoc = new FakeDocument();
  let fakeRoot = new FakeElement('div');

  let controller = createRuntimeUiController({
    document: fakeDoc,
    root: fakeRoot,
  });

  // Mock registry dynamic register
  controller.dynamicRegistry = {
    register: async (tagName, codeOrClass) => {
      // Mock class returned
      return class Dummy {};
    },
  };

  let driverRegistered = null;
  let intent = {
    version: 'agent-intent-v1',
    intentId: 'transaction-1',
    operations: [
      {
        type: 'register-component',
        params: {
          tagName: 'sn-chat-widget',
          code: 'export default class widget {}',
        },
      },
      {
        type: 'register-driver',
        params: {
          driverType: 'test/chat-driver',
        },
      },
      {
        type: 'ui',
        params: {
          action: 'create',
          node: {
            id: 'widget-1',
            component: 'sn-chat-widget',
            props: { placeholder: 'Start typing...' },
          },
          targetSelector: 'body',
        },
      },
      {
        type: 'theme',
        params: {
          targetSelector: 'body',
          presets: {
            color: 'carbon',
            skin: 'compact',
            motion: 'disabled',
          },
        },
      },
      {
        type: 'state',
        params: {
          id: 'widget-1',
          state: {
            props: { placeholder: 'Ask anything...' },
          },
        },
      },
    ],
  };

  let res = await executeAgentIntent(controller, intent, {
    document: fakeDoc,
    onRegisterDriver: async (params) => {
      driverRegistered = params;
    },
  });

  assert.ok(res.success);
  assert.equal(res.executedCount, 5);
  assert.deepEqual(driverRegistered, { driverType: 'test/chat-driver' });

  let widget = controller.instances.get('widget-1');
  assert.ok(widget);
  assert.equal(widget.element.placeholder, 'Ask anything...');
  assert.equal(fakeDoc.body.children.length, 1);
  assert.equal(fakeDoc.body.children[0].tagName, 'SN-CHAT-WIDGET');

  // Verify theme properties were applied to body style
  assert.equal(fakeDoc.body.style.getPropertyValue('--sn-theme-motion-scale'), '0.00');
});

test('executeAgentIntent rolls back completed actions in case of subsequent failure', async () => {
  let fakeDoc = new FakeDocument();
  let fakeRoot = new FakeElement('div');

  let controller = createRuntimeUiController({
    document: fakeDoc,
    root: fakeRoot,
  });

  let intent = {
    version: 'agent-intent-v1',
    intentId: 'transaction-fail',
    operations: [
      {
        type: 'ui',
        params: {
          action: 'create',
          node: {
            id: 'temp-widget-1',
            component: 'sn-temp-widget',
          },
          targetSelector: 'body',
        },
      },
      {
        type: 'theme',
        params: {
          targetSelector: '#non-existent-selector', // This will fail!
          presets: {
            color: 'light',
          },
        },
      },
    ],
  };

  await assert.rejects(async () => {
    await executeAgentIntent(controller, intent, {
      document: fakeDoc,
    });
  }, /Theme target element not found/);

  // The first ui creation should be rolled back and the element should be destroyed
  assert.equal(controller.instances.has('temp-widget-1'), false);
  assert.equal(fakeDoc.body.children.length, 0);
});
