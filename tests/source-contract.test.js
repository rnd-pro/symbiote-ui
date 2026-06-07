import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { test } from 'node:test';

class TestCSSStyleSheet {
  replaceSync(text) {
    this.cssText = text;
  }
}

function installDom() {
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
  });
  window.document.adoptedStyleSheets = [];
}

async function nextRenderTick() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test('source viewer forwards save actions and syntax tokens to code rendering', async () => {
  installDom();
  await import('../display/CodeBlock/CodeBlock.js');
  await import('../display/SourceViewer/SourceViewer.js');

  let viewer = document.createElement('source-viewer');
  document.body.append(viewer);
  await nextRenderTick();

  let actionDetail = null;
  viewer.addEventListener('source-viewer-action', (event) => {
    actionDetail = event.detail;
  });

  viewer.showFile({
    path: 'src/app.js',
    raw: 'export const ok = true;',
    lang: 'js',
    saveAction: {
      id: 'save-source',
      label: 'Save',
      intent: 'source:save',
      payload: { panel: 'source' },
    },
    syntaxTokens: {
      keyword: 'rgb(1, 2, 3)',
      '--sn-syntax-string': 'rgb(4, 5, 6)',
      unsafe: 'red',
    },
  });
  await nextRenderTick();

  let codeBlock = viewer.querySelector('code-block');
  assert.equal(viewer.hasAttribute('has-save-action'), true);
  assert.equal(viewer.style.getPropertyValue('--sn-syntax-keyword'), 'rgb(1, 2, 3)');
  assert.equal(viewer.style.getPropertyValue('--sn-syntax-string'), 'rgb(4, 5, 6)');
  assert.equal(viewer.style.getPropertyValue('unsafe') || '', '');
  assert.equal(codeBlock.style.getPropertyValue('--sn-syntax-keyword'), 'rgb(1, 2, 3)');

  assert.equal(viewer.triggerSourceAction(), true);
  assert.equal(actionDetail.path, 'src/app.js');
  assert.equal(actionDetail.content, 'export const ok = true;');
  assert.deepEqual(actionDetail.action, {
    id: 'save-source',
    label: 'Save',
    intent: 'source:save',
    payload: { panel: 'source' },
  });

  viewer.showEmpty();
  assert.equal(viewer.hasAttribute('has-save-action'), false);
  assert.equal(viewer.style.getPropertyValue('--sn-syntax-keyword') || '', '');
  assert.equal(codeBlock.style.getPropertyValue('--sn-syntax-keyword') || '', '');
});

test('source editor accepts source documents and emits host save intents', async () => {
  installDom();
  await import('../display/SourceEditor/SourceEditor.js');

  let editor = document.createElement('source-editor');
  document.body.append(editor);
  await nextRenderTick();

  let saveDetail = null;
  editor.addEventListener('source-editor-save', (event) => {
    saveDetail = event.detail;
  });

  editor.setSourceDocument({
    path: 'docs/readme.md',
    content: '# Readme',
    language: 'md',
    readOnly: true,
    dirty: true,
    saveAction: 'save-doc',
    syntaxTheme: {
      id: 'agent-docs',
      tokens: {
        comment: 'rgb(10, 20, 30)',
      },
    },
  });
  await nextRenderTick();

  assert.equal(editor.getContent(), '# Readme');
  assert.equal(editor.readOnly, true);
  assert.equal(editor.$.language, 'md');
  assert.equal(editor.$.dirty, true);
  assert.equal(editor.hasAttribute('dirty'), true);
  assert.equal(editor.hasAttribute('has-save-action'), true);
  assert.equal(editor.style.getPropertyValue('--sn-syntax-comment'), 'rgb(10, 20, 30)');

  assert.equal(editor.triggerSave({ source: 'keyboard' }), true);
  assert.deepEqual(saveDetail, {
    action: { id: 'save-doc', label: 'save-doc' },
    path: 'docs/readme.md',
    value: '# Readme',
    dirty: true,
    language: 'md',
    source: 'keyboard',
  });
});
