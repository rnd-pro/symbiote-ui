import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

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

test('DOM: sn-chart Spec V1 rendering and events', async () => {
  installDom();

  let { Chart, normalizeChartSpec } = await import('../display/Chart/Chart.js');
  if (!customElements.get('sn-chart')) {
    customElements.define('sn-chart', Chart);
  }

  let chartEl = document.createElement('sn-chart');
  document.body.append(chartEl);
  await nextRenderTick();

  // Set Chart Spec V1
  chartEl.setSpec({
    title: 'Observability Matrix',
    type: 'mixed',
    xAxis: {
      type: 'category',
      data: ['Q1', 'Q2', 'Q3', 'Q4']
    },
    yAxis: {
      min: 0,
      max: 100
    },
    series: [
      { name: 'Server A', type: 'bar', data: [80, 90, 70, 85] },
      { name: 'Server B', type: 'line', data: [60, 65, 80, 75] }
    ],
    thresholds: [
      { value: 90, label: 'Warning Threshold', color: 'red' }
    ]
  });
  await nextRenderTick();

  // Test SVG element exists and title rendered
  let svg = chartEl.ref.svg;
  assert.ok(svg);
  assert.equal(chartEl.$.title, 'Observability Matrix');

  // Verify thresholds rendering
  let warningThresholdLine = svg.querySelector('.sn-chart-threshold-line');
  assert.ok(warningThresholdLine);
  assert.equal(warningThresholdLine.getAttribute('stroke'), 'red');

  // Verify bars and points are rendered
  let bars = svg.querySelectorAll('.sn-chart-bar');
  assert.equal(bars.length, 4); // 4 items in categories

  let lines = svg.querySelectorAll('.sn-chart-line');
  assert.equal(lines.length, 1);

  // Verify legend clicks toggle series
  let legendItems = chartEl.querySelectorAll('.sn-chart-legend-item');
  assert.equal(legendItems.length, 2);

  // Click on Server A legend to hide it
  legendItems[0].dispatchEvent(new Event('click'));
  await nextRenderTick();

  // Server A should be hidden (no bars rendered, only lines)
  let barsAfterHide = svg.querySelectorAll('.sn-chart-bar');
  assert.equal(barsAfterHide.length, 0);

  // Click again to show it
  legendItems[0].dispatchEvent(new Event('click'));
  await nextRenderTick();

  let barsAfterShow = svg.querySelectorAll('.sn-chart-bar');
  assert.equal(barsAfterShow.length, 4);

  let normalized = normalizeChartSpec({
    type: 'mixed',
    series: [
      { name: 'Unsafe', type: 'bar', color: 'red; background:url(x)', data: ['1', 'bad'] },
    ],
    thresholds: [
      { value: 'bad', color: 'url(javascript:alert(1))' },
    ],
  });
  assert.equal(normalized.series[0].color, undefined);
  assert.deepEqual(normalized.series[0].data, [1, 0]);
  assert.equal(normalized.thresholds[0].value, 0);
  assert.equal(normalized.thresholds[0].color, 'var(--sn-chart-threshold-color, var(--sn-sys-danger))');

  chartEl.setSpec({
    title: '<Unsafe>',
    series: [
      { name: '<img src=x>', color: 'red; background:url(x)', data: [1] },
    ],
  });
  await nextRenderTick();

  let legendItem = chartEl.querySelector('.sn-chart-legend-item');
  assert.ok(legendItem);
  assert.equal(legendItem.textContent, '<img src=x>');
  assert.equal(legendItem.querySelector('img'), null);

  let bar = chartEl.ref.svg.querySelector('.sn-chart-bar');
  assert.ok(bar);
  let hover = new Event('mousemove', { bubbles: true });
  Object.defineProperty(hover, 'clientX', { value: 10 });
  Object.defineProperty(hover, 'clientY', { value: 10 });
  bar.dispatchEvent(hover);
  await nextRenderTick();

  assert.equal(chartEl.ref.tooltip.querySelector('img'), null);
  assert.match(chartEl.ref.tooltip.textContent, /<img src=x>/);
});

test('DOM: sn-chart renders stacked bars and donut selections with semantic targets', async () => {
  installDom();
  let { Chart, normalizeChartSpec } = await import('../display/Chart/Chart.js');
  if (!customElements.get('sn-chart')) customElements.define('sn-chart', Chart);

  const normalized = normalizeChartSpec({
    type: 'donut',
    xAxis: { data: ['Priority 1', 'Priority 2'] },
    series: [{
      name: 'Orders',
      data: [4, 2],
      colors: ['var(--sn-sys-danger)', 'var(--sn-sys-warning)'],
      semanticTargets: [{ id: 'priority:1', type: 'priority', resourceType: 'dispatcher-board' }, null],
    }],
    donut: { centerValue: '6', centerLabel: 'orders' },
  });
  assert.equal(normalized.type, 'donut');
  assert.equal(normalized.series[0].semanticTargets[0].id, 'priority:1');

  const chart = document.createElement('sn-chart');
  document.body.append(chart);
  chart.setSpec(normalized);
  await nextRenderTick();
  assert.equal(chart.ref.svg.querySelectorAll('.sn-chart-pie-slice').length, 2);
  assert.equal(chart.ref.svg.querySelector('.sn-chart-donut-value').textContent, '6');

  let selection = null;
  chart.addEventListener('sn-chart-select', (event) => { selection = event.detail; });
  chart.ref.svg.querySelector('.sn-chart-pie-slice').dispatchEvent(new Event('click', { bubbles: true }));
  assert.equal(selection.label, 'Priority 1');
  assert.equal(selection.semanticTarget.id, 'priority:1');

  chart.setSpec({
    type: 'bar',
    xAxis: { data: ['Waiting'] },
    series: [
      { name: 'P1', stack: 'orders', data: [3] },
      { name: 'P2', stack: 'orders', data: [2] },
    ],
  });
  await nextRenderTick();
  const bars = [...chart.ref.svg.querySelectorAll('.sn-chart-bar')];
  assert.equal(bars.length, 2);
  assert.equal(bars[0].getAttribute('x'), bars[1].getAttribute('x'));
  assert.notEqual(bars[0].getAttribute('y'), bars[1].getAttribute('y'));

  chart.setSpec({
    type: 'line',
    xAxis: { data: ['A', 'B'] },
    series: [{ name: 'Ratio', data: [0.1, 0.4] }],
  });
  await nextRenderTick();
  assert.equal(chart.ref.svg.querySelectorAll('.sn-chart-grid-line').length, 5);
});

test('DOM: operations overview re-emits metric and chart semantic selections', async () => {
  installDom();
  const { OperationsOverview } = await import('../display/OperationsOverview/OperationsOverview.js');
  if (!customElements.get('sn-operations-overview')) customElements.define('sn-operations-overview', OperationsOverview);
  const overview = document.createElement('sn-operations-overview');
  document.body.append(overview);
  await nextRenderTick();
  overview.setModel({
    title: 'Operations Overview',
    metrics: [{ id: 'open', label: 'Open', value: '7', semanticTarget: { id: 'surface:dispatcher-board' } }],
    charts: [{ id: 'priority', spec: { type: 'donut', xAxis: { data: ['P1'] }, series: [{ name: 'Orders', data: [7], semanticTargets: [{ id: 'priority:1' }] }] } }],
  });
  await nextRenderTick();
  const selections = [];
  overview.addEventListener('sn-analytics-select', (event) => selections.push(event.detail));
  overview.querySelector('button.sn-operations-overview-metric').dispatchEvent(new Event('click', { bubbles: true }));
  overview.querySelector('.sn-chart-pie-slice').dispatchEvent(new Event('click', { bubbles: true }));
  assert.deepEqual(selections.map((item) => item.semanticTarget.id), ['surface:dispatcher-board', 'priority:1']);
});

test('operations overview owns one cascade-themed widget surface per content block', async () => {
  const css = (await import('../display/OperationsOverview/OperationsOverview.css.js')).default;
  assert.match(css, /--sn-operations-overview-widget-bg/);
  assert.match(css, /--sn-operations-overview-widget-border/);
  assert.match(css, /--sn-operations-overview-widget-radius/);
  assert.match(css, /\.sn-operations-overview-header[\s\S]*background: var\(--sn-operations-overview-widget-bg/);
  assert.match(css, /\.sn-operations-overview-chart[\s\S]*--sn-chart-bg: transparent/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
});
