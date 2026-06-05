import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { test } from 'node:test';
import { listComponents } from '../manifest/index.js';

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

async function nextRenderTick() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const fixtures = {
  'code-block': (el) => {
    el.setContent('const value = 1;', 'js');
    return 'value';
  },
  'source-viewer': (el) => {
    el.showFile({ path: 'src/example.js', raw: 'export const answer = 42;', statsText: '1 line' });
    return 'answer';
  },
  'sn-field': (el) => {
    el.textContent = 'Field label';
    return 'Field label';
  },
  'sn-card': (el) => {
    el.textContent = 'Card content';
    return 'Card content';
  },
  'sn-badge': (el) => {
    el.textContent = 'ready';
    return 'ready';
  },
  'sn-metric': (el) => {
    el.innerHTML = '<span slot="label">Latency</span><span slot="value">12ms</span>';
    return '12ms';
  },
  'sn-data-table': (el) => {
    el.setData({
      columns: [{ key: 'name', label: 'Name' }],
      rows: [{ name: 'Runtime UI' }],
    });
    return 'Runtime UI';
  },
  'sn-event-feed': (el) => {
    el.setEvents([{ title: 'Rendered', message: 'SSR smoke' }]);
    return 'Events';
  },
  'sn-banner': (el) => {
    el.textContent = 'Banner text';
    return 'Banner text';
  },
  'sn-empty-state': (el) => {
    el.textContent = 'No host data';
    return 'No host data';
  },
};

test('jsda-ssr-renderable components render under a linkedom SSR fixture', async () => {
  installSsrDom();
  let components = listComponents().filter((component) => (
    component.contract?.ssr?.mode === 'jsda-ssr-renderable'
  ));
  assert.deepEqual(
    components.map((component) => component.tagName).sort(),
    Object.keys(fixtures).sort()
  );

  for (let component of components) {
    await import(new URL(`../${component.module}`, import.meta.url).href);
    let el = document.createElement(component.tagName);
    document.body.append(el);
    let expectedText = fixtures[component.tagName](el);
    await nextRenderTick();

    assert.match(el.outerHTML, new RegExp(component.tagName));
    assert.match(el.textContent, new RegExp(expectedText));
    assert.equal(el.outerHTML.includes('[object Object]'), false, component.tagName);
    assert.equal(el.outerHTML.includes('undefined'), false, component.tagName);
  }
});
