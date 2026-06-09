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

let testWindow = null;
const sourceViewerStylesUrl = new URL('../display/SourceViewer/SourceViewer.css.js', import.meta.url);
const sourceViewerTemplateUrl = new URL('../display/SourceViewer/SourceViewer.tpl.js', import.meta.url);

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

test('source viewer compact header keeps hidden labels out of control text', async () => {
  installDom();
  await defineSourceViewerElements();

  let viewer = document.createElement('source-viewer');
  document.body.append(viewer);
  await nextRenderTick();

  viewer.showFile({
    path: 'profile/photo.md',
    raw: '# Vladimir Matiasevich',
    lang: 'md',
    statsText: 'profile-photo',
  });
  await nextRenderTick();

  let controls = viewer.querySelector('.sv-controls');
  let stats = viewer.querySelector('.sv-stats');
  let toggleLabel = viewer.querySelector('.sv-toggle-label');
  let toggleAction = viewer.querySelector('.sv-toggle-action');

  assert.equal(stats.getAttribute('data-source-text'), 'profile-photo');
  assert.equal(toggleLabel.getAttribute('data-label'), 'rendered');
  assert.equal(toggleAction.getAttribute('aria-label'), viewer.$.toggleModeTitle);
  assert.doesNotMatch(controls.textContent, /profile-photo/);
  assert.doesNotMatch(controls.textContent, /rendered/);
});

test('source viewer header keeps one row and hides controls by priority', async () => {
  const [styles, template] = await Promise.all([
    readFile(sourceViewerStylesUrl, 'utf8'),
    readFile(sourceViewerTemplateUrl, 'utf8'),
  ]);

  assert.match(template, /class="sv-shell"/);
  assert.match(styles, /\.sv-shell \{[\s\S]*?display: flex;[\s\S]*?block-size: 100%;[\s\S]*?min-block-size: 0;[\s\S]*?overflow: hidden;/);
  assert.match(styles, /\.sv-header \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(0, max-content\);[\s\S]*?block-size: var\(--sn-source-header-block-size,/);
  assert.match(styles, /\.sv-controls \{[\s\S]*?flex-wrap: nowrap;[\s\S]*?max-inline-size: var\(--sn-source-controls-max-inline-size, 46cqw\);[\s\S]*?overflow: hidden;/);
  assert.match(styles, /\.sv-stats::before \{[\s\S]*?content: attr\(data-source-text\);/);
  assert.match(styles, /\.sv-action-label::before \{[\s\S]*?content: attr\(data-label\);/);
  assert.match(styles, /@container \(max-width: 520px\) \{[\s\S]*?\.sv-action-label \{[\s\S]*?display: none;/);
  assert.match(styles, /@container \(max-width: 460px\) \{[\s\S]*?\.sv-stats \{[\s\S]*?display: none;/);
  assert.match(styles, /@container \(max-width: 380px\) \{[\s\S]*?\.sv-graph-action \{[\s\S]*?display: none;/);
  assert.match(styles, /@container \(max-width: 320px\) \{[\s\S]*?\.sv-save-action \{[\s\S]*?display: none;/);
  assert.doesNotMatch(styles, /grid-template-columns: minmax\(0, 1fr\);\s*align-items: start;/);
  assert.doesNotMatch(template, /textContent: statsText/);
  assert.doesNotMatch(template, /textContent: saveLabel/);
  assert.doesNotMatch(template, /textContent: graphLabel/);
  assert.doesNotMatch(template, /textContent: modeLabel/);
  assert.match(template, /class="sv-stats"/);
  assert.match(template, /class="sv-action-label sv-save-label"/);
  assert.match(template, /class="sv-action sv-graph-action"/);
  assert.match(template, /class="sv-action sv-toggle-action"/);
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
