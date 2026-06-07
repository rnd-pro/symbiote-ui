import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { test } from 'node:test';

class TestCSSStyleSheet {
  replaceSync(text) {
    this.cssText = text;
  }
}

let testWindow = null;

function installDom() {
  if (testWindow) {
    testWindow.document.body.innerHTML = '';
    testWindow.document.adoptedStyleSheets = [];
    return;
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
    CSSStyleSheet: TestCSSStyleSheet,
  });
  window.document.adoptedStyleSheets = [];
}

async function nextRenderTick() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function defineElement(tagName, ComponentClass) {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, ComponentClass);
  }
}

async function defineSourceViewerElements() {
  let [{ CodeBlock }, { SourceViewer }] = await Promise.all([
    import('../display/CodeBlock/CodeBlock.js'),
    import('../display/SourceViewer/SourceViewer.js'),
  ]);
  defineElement('code-block', CodeBlock);
  defineElement('source-viewer', SourceViewer);
}

async function defineSourceEditorElement() {
  let { SourceEditor } = await import('../display/SourceEditor/SourceEditor.js');
  defineElement('source-editor', SourceEditor);
}

test('source viewer forwards save actions and syntax tokens to code rendering', async () => {
  installDom();
  await defineSourceViewerElements();

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

test('source viewer exposes markdown document behavior', async () => {
  installDom();
  await defineSourceViewerElements();

  let viewer = document.createElement('source-viewer');
  document.body.append(viewer);
  await nextRenderTick();

  viewer.showFile({
    path: 'docs/agent-workspace.md',
    raw: '# Agent workspace\n\nRender markdown and code from the same library.',
    lang: 'md',
  });
  await nextRenderTick();

  let codeBlock = viewer.querySelector('code-block');
  assert.equal(viewer.$.viewMode, 'rendered');
  assert.equal(viewer.$.showToggle, true);
  assert.equal(codeBlock.$.isMarkdown, true);
  assert.match(codeBlock.$.highlighted, /Agent workspace/);

  await viewer.toggleMode();
  await nextRenderTick();
  assert.equal(viewer.$.viewMode, 'source');
  assert.equal(codeBlock.$.isMarkdown, false);
  assert.equal(codeBlock.$.lang, 'plain');
});

test('source editor accepts source documents and emits host save intents', async () => {
  installDom();
  await defineSourceEditorElement();

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
