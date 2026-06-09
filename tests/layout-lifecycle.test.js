import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

class TestCSSStyleSheet {
  replaceSync(text) {
    this.cssText = text;
  }
}

let layoutWindow = null;

function installLayoutDom() {
  if (!layoutWindow) {
    let { window } = parseHTML('<!doctype html><html><body></body></html>');
    layoutWindow = window;
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
    });
    window.document.adoptedStyleSheets = [];
    return;
  }

  layoutWindow.document.body.innerHTML = '';
  layoutWindow.document.adoptedStyleSheets = [];
}

async function nextLayoutRenderTick() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function defineLayoutTestElement(tagName, lifecycle) {
  if (customElements.get(tagName)) return;
  customElements.define(tagName, class extends HTMLElement {
    connectedCallback() {
      lifecycle.connected += 1;
    }

    disconnectedCallback() {
      lifecycle.disconnected += 1;
      if (this._layoutSuspendReason !== 'layout-move') {
        lifecycle.teardown += 1;
      }
    }

    suspendLayout(context = {}) {
      lifecycle.suspended += 1;
      this._layoutSuspendReason = context.reason || 'layout-suspend';
    }

    resumeLayout() {
      lifecycle.resumed += 1;
      this._layoutSuspendReason = '';
    }
  });
}

test('layout lifecycle helpers suspend and resume reusable and host-owned subtree elements once', async () => {
  let { suspendLayoutSubtree, resumeLayoutSubtree } = await import('../layout/index.js');
  let { document } = parseHTML(`
    <section id="workspace">
      <agent-chat>
        <chat-workspace>
          <chat-composer></chat-composer>
          <cell-bg></cell-bg>
        </chat-workspace>
      </agent-chat>
    </section>
  `);
  let root = document.getElementById('workspace');
  let calls = [];
  for (let element of root.querySelectorAll('agent-chat, chat-workspace, chat-composer, cell-bg')) {
    element.suspendLayout = (context) => calls.push(['suspend', element.localName, context.reason]);
    element.resumeLayout = (context) => calls.push(['resume', element.localName, context.reason]);
  }

  assert.equal(suspendLayoutSubtree(root, { reason: 'workspace-inactive' }), 4);
  assert.deepEqual(calls, [
    ['suspend', 'agent-chat', 'workspace-inactive'],
    ['suspend', 'chat-workspace', 'workspace-inactive'],
    ['suspend', 'chat-composer', 'workspace-inactive'],
    ['suspend', 'cell-bg', 'workspace-inactive'],
  ]);
  for (let element of root.querySelectorAll('agent-chat, chat-workspace, chat-composer, cell-bg')) {
    assert.equal(element.hasAttribute('data-layout-suspended'), true);
  }

  calls = [];
  assert.equal(resumeLayoutSubtree(root, { reason: 'workspace-active' }), 4);
  assert.deepEqual(calls, [
    ['resume', 'agent-chat', 'workspace-active'],
    ['resume', 'chat-workspace', 'workspace-active'],
    ['resume', 'chat-composer', 'workspace-active'],
    ['resume', 'cell-bg', 'workspace-active'],
  ]);
  for (let element of root.querySelectorAll('agent-chat, chat-workspace, chat-composer, cell-bg')) {
    assert.equal(element.hasAttribute('data-layout-suspended'), false);
  }
});

test('opening a UI panel preserves existing layout panel components by node id', async () => {
  installLayoutDom();
  let [{ createPanel, createSplit }] = await Promise.all([
    import('../layout/LayoutTree.js'),
    import('../layout/Layout/Layout.js'),
  ]);
  let graphLifecycle = { connected: 0, disconnected: 0, teardown: 0, suspended: 0, resumed: 0 };
  let contentLifecycle = { connected: 0, disconnected: 0, teardown: 0, suspended: 0, resumed: 0 };
  let materialsLifecycle = { connected: 0, disconnected: 0, teardown: 0, suspended: 0, resumed: 0 };
  let themeLifecycle = { connected: 0, disconnected: 0, teardown: 0, suspended: 0, resumed: 0 };

  defineLayoutTestElement('test-lifecycle-graph-panel', graphLifecycle);
  defineLayoutTestElement('test-lifecycle-content-panel', contentLifecycle);
  defineLayoutTestElement('test-lifecycle-materials-panel', materialsLifecycle);
  defineLayoutTestElement('test-lifecycle-theme-panel', themeLifecycle);

  let layout = document.createElement('panel-layout');
  document.body.append(layout);
  layout.registerPanelType('materials', { component: 'test-lifecycle-materials-panel' });
  layout.registerPanelType('graph', { component: 'test-lifecycle-graph-panel' });
  layout.registerPanelType('content', { component: 'test-lifecycle-content-panel' });
  layout.registerPanelType('theme', { component: 'test-lifecycle-theme-panel' });
  layout.setLayout(createSplit(
    'horizontal',
    createPanel('materials'),
    createSplit('horizontal', createPanel('graph'), createPanel('content'), 0.64),
    0.24
  ));
  await nextLayoutRenderTick();

  let graphPanel = layout.querySelector('test-lifecycle-graph-panel');
  let contentPanel = layout.querySelector('test-lifecycle-content-panel');
  assert.equal(graphLifecycle.connected, 1);
  assert.equal(contentLifecycle.connected, 1);

  layout.openPanel('theme', {
    direction: 'horizontal',
    ratio: 0.72,
    source: 'theme-widget',
    uiInvoked: true,
  });
  await nextLayoutRenderTick();

  assert.equal(graphLifecycle.teardown, 0);
  assert.equal(contentLifecycle.teardown, 0);
  assert.equal(graphLifecycle.suspended, 1);
  assert.equal(graphLifecycle.resumed, 1);
  assert.equal(contentLifecycle.suspended, 1);
  assert.equal(contentLifecycle.resumed, 1);
  assert.equal(layout.querySelector('test-lifecycle-graph-panel'), graphPanel);
  assert.equal(layout.querySelector('test-lifecycle-content-panel'), contentPanel);
  assert.equal(themeLifecycle.connected, 1);
});
