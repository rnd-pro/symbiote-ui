import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import fs from 'node:fs';

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
}

async function nextTick() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

installDom();
let { KanbanCard, normalizeKanbanCardModel, normalizeKanbanCardView } = await import('../board/index.js');
let { KanbanCard: ExportedKanbanCard } = await import('../ui/index.js');

test('ui export parity', () => {
  assert.equal(ExportedKanbanCard, KanbanCard, 'ui/index.js must export the same KanbanCard');
});

test('sn-kanban-card normalizes model and view, returns deep immutable snapshots', async () => {
  assert.equal(typeof KanbanCard, 'function');
  assert.equal(typeof normalizeKanbanCardModel, 'function');
  assert.equal(typeof normalizeKanbanCardView, 'function');

  let card = document.createElement('sn-kanban-card');
  document.body.append(card);
  await nextTick();

  let model = {
    id: 'card-1',
    columnId: 'ready',
    title: 'Fix auth',
    attention: { active: true, message: 'Needs decision' },
    stages: [{ label: 'Review', status: 'pending' }],
    actions: [{ id: 'edit', label: 'Edit' }]
  };
  card.setCard(model);

  let snapshot = card.getCard();
  assert.notEqual(snapshot, model, 'snapshot should be a copy');
  assert.notEqual(snapshot.attention, model.attention, 'attention must be cloned');
  assert.notEqual(snapshot.stages, model.stages, 'stages array must be cloned');
  assert.notEqual(snapshot.stages[0], model.stages[0], 'stage items must be cloned');
  assert.notEqual(snapshot.actions, model.actions, 'actions array must be cloned');

  assert.equal(snapshot.title, 'Fix auth');
  assert.equal(snapshot.id, 'card-1');
  assert.equal(snapshot.columnId, 'ready');

  snapshot.title = 'Mutated';
  snapshot.stages[0].label = 'Mutated';
  if (snapshot.dashboard && snapshot.dashboard.length) {
    snapshot.dashboard[0].label = 'Mutated';
  }
  let snapshot2 = card.getCard();
  assert.equal(snapshot2.title, 'Fix auth');
  assert.equal(snapshot2.stages[0].label, 'Review');

  card.setCard({
    title: 'Dashboard Test',
    attention: { active: true, tone: 'unsupported', layout: 'unsupported' },
    agent: {
      name: 'Maya',
      accent: 'url(javascript:alert(1))',
      provider: 'codex',
      model: 'gpt-5.6-sol',
    },
    dashboard: [{ label: 'Dash1', steps: [{label: 'Step1'}], accent: '#6A1B9A' }]
  });
  let dashSnap = card.getCard();
  dashSnap.dashboard[0].steps[0].label = 'Mutated';
  assert.equal(card.getCard().dashboard[0].steps[0].label, 'Step1', 'dashboard items and steps must be deeply cloned');
  assert.equal(dashSnap.attention.tone, 'danger', 'unknown attention tone must fallback');
  assert.equal(dashSnap.attention.layout, 'strip', 'unknown attention layout must fallback');
  assert.equal(dashSnap.agent.accent, '', 'unsafe agent accent must be discarded');
  assert.equal(dashSnap.agent.provider, 'codex', 'provider must survive normalization');
  assert.equal(dashSnap.agent.model, 'gpt-5.6-sol', 'model must survive normalization');
  assert.equal(dashSnap.dashboard[0].accent, '#6A1B9A', 'safe dashboard accent must be preserved');
});

test('sn-kanban-card view normalization allows sizes/emphasis and deduplicates modules', () => {
  let view = normalizeKanbanCardView({
    size: 'INVALID',
    primaryEmphasis: 'unknown',
    modules: ['header', 'header', 'actions']
  });
  assert.equal(view.size, 'M', 'size must fallback to M');
  assert.equal(view.primaryEmphasis, '', 'invalid emphasis must be empty');
  assert.equal(view.modules.length, 2, 'modules must be deduplicated');
  assert.equal(view.modules[0], 'header');
  assert.equal(view.modules[1], 'actions');

  let view2 = normalizeKanbanCardView({
    size: 'XL',
    primaryEmphasis: 'cost',
    layout: 'audit-progress',
    modules: ['header']
  });
  assert.equal(view2.size, 'XL');
  assert.equal(view2.primaryEmphasis, 'cost');
  assert.equal(view2.layout, 'audit-progress');

  let view3 = normalizeKanbanCardView({ layout: 'invalid' });
  assert.equal(view3.layout, 'default', 'invalid layout falls back to default');
});

test('sn-kanban-card handles module order, active-only attention, and resets on null', async () => {
  let card = document.createElement('sn-kanban-card');
  document.body.append(card);
  await nextTick();

  card.setCard({ title: 'Task', attention: { active: false, message: 'Hidden' } });
  card.setView({ size: 'XL', modules: ['header'] });
  let viewSnapshot = card.getView();
  assert.ok(!viewSnapshot.modules.includes('attention'), 'inactive attention must NOT be injected into view');
  assert.equal(card.getAttribute('data-has-attention'), null, 'host data-has-attention removed');

  card.setCard({
    title: 'Task2',
    attention: { active: true, message: 'Urgent', tone: 'warning' },
    agent: {
      name: 'Maya',
      local: true,
      accent: '#6A1B9A',
      provider: 'codex',
      model: 'gpt-5.6-sol',
    }
  });
  let viewSnapshot2 = card.getView();
  assert.ok(viewSnapshot2.modules.includes('attention'), 'active attention must be prepended');
  assert.equal(viewSnapshot2.modules[0], 'attention', 'attention must be first');
  assert.equal(card.getAttribute('data-has-attention'), 'true', 'host gets data-has-attention');
  assert.equal(card.getAttribute('data-attention-tone'), 'warning', 'host reflects attention severity');
  assert.equal(card.querySelector('.sn-kc-attention').getAttribute('data-tone'), 'warning', 'attention reflects severity');
  assert.equal(
    card.querySelector('.sn-kc-agent').style.getPropertyValue('--sn-kanban-card-agent-accent'),
    '#6A1B9A',
    'agent identity accent must reach the component style hook'
  );
  assert.equal(card.querySelector('.sn-kc-agent-provider span').textContent, 'codex');
  assert.equal(card.querySelector('.sn-kc-agent-provider').title, 'gpt-5.6-sol');

  card.setCard(null);
  let emptySnapshot = card.getCard();
  assert.equal(emptySnapshot.title, '', 'setCard(null) resets to defaults');
  assert.equal(emptySnapshot.attention, null);

  card.setView(null);
  let emptyView = card.getView();
  assert.equal(emptyView.size, 'M', 'setView(null) resets to defaults');
  assert.equal(emptyView.modules.length, 1);
});

test('sn-kanban-card DOM renders progress min/max, neutral aria labels, no emoji', async () => {
  let card = document.createElement('sn-kanban-card');
  document.body.append(card);
  card.setView({ modules: ['header', 'childRealization', 'metric'] });
  card.setCard({
    title: 'Моя задача',
    metric: { value: '10', progress: 50 },
    childRealization: { progress: 30 }
  });
  await nextTick();

  let pbars = card.querySelectorAll('[role="progressbar"]');
  assert.ok(pbars.length > 0, 'progressbars exist');
  for (let bar of pbars) {
    assert.equal(bar.getAttribute('aria-valuemin'), '0', 'must have aria-valuemin 0');
    assert.equal(bar.getAttribute('aria-valuemax'), '100', 'must have aria-valuemax 100');
  }

  let btn = card.querySelector('.sn-kc-selector');
  assert.equal(btn.getAttribute('aria-label'), 'Моя задача', 'aria-label derived from title');

  card.setCard({ ariaLabel: 'Особая карточка', title: 'test', icon: '<script>alert(1)</script>' });
  await nextTick();
  assert.equal(card.querySelector('.sn-kc-selector').getAttribute('aria-label'), 'Особая карточка', 'explicit ariaLabel overrides');

  let headerIcon = card.querySelector('.sn-kc-header-icon');
  assert.equal(headerIcon.innerHTML, '', 'unknown icon must not be injected via innerHTML');
  assert.equal(headerIcon.hidden, true, 'unknown icon must not reserve visual space');

  card.setView({ modules: ['header', 'stages'] });
  card.setCard({
    title: 'Safe steps',
    stages: [{ label: 'Stage', steps: [{ status: 'active', label: '<img src=x onerror=alert(1)>' }] }]
  });
  await nextTick();
  let step = card.querySelector('.sn-kc-step');
  assert.equal(step.textContent, '<img src=x onerror=alert(1)>', 'step labels must render as text');
  assert.equal(step.querySelector('img'), null, 'step labels must not create markup');

  let tpl = await import('../board/KanbanCard/KanbanCard.tpl.js');
  let tplString = String(tpl.default);
  assert.doesNotMatch(tplString, /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u, 'template must not contain emojis');
});

test('sn-kanban-card renders segmented rails, attention layout, and nested dashboard progress', async () => {
  let card = document.createElement('sn-kanban-card');
  document.body.append(card);
  card.setView({ modules: ['attention', 'childRealization', 'dashboard'] });
  card.setCard({
    attention: { active: true, layout: 'hero', message: 'Hero text' },
    childRealization: { current: 3, total: 5 },
    dashboard: [{ label: 'Progress', current: 2, total: 3, steps: [{status: 'done'}, {status: 'active'}] }]
  });
  await nextTick();

  let attention = card.querySelector('.sn-kc-attention');
  assert.equal(attention.getAttribute('data-attention-layout'), 'hero', 'attention layout must be reflected');

  let segmented = card.querySelectorAll('.sn-kc-segmented-track');
  assert.ok(segmented.length >= 2, 'segmented tracks must render for both realization and dashboard');

  let realizationStage = card.querySelector('.sn-kc-child-realization .sn-kc-stage');
  assert.ok(realizationStage, 'child realization must use the same progress-stage structure as regular stages');
  assert.ok(realizationStage.querySelector('.sn-kc-stage-header'), 'shared progress stage must contain its label row');
  assert.ok(realizationStage.querySelector('.sn-kc-segmented-track'), 'shared progress stage must contain its rail');

  card.setCard({ childRealization: { label: 'Subtasks 3/5', current: 3, total: 5 } });
  await nextTick();
  assert.equal(card.querySelector('.sn-kc-child-realization .sn-kc-stage-header').children.length, 1, 'an inline progress count must not be duplicated at the row end');

  let dashStepper = card.querySelector('.sn-kc-dash-item .sn-kc-stepper');
  assert.ok(dashStepper, 'dashboard cell must render nested stepper');
});

test('sn-kanban-card CSS uses cascade tokens, no raw values', async () => {
  let { default: css } = await import('../board/KanbanCard/KanbanCard.css.js');
  let cssString = css.cssText || String(css);

  assert.doesNotMatch(cssString, /(?<!var\([^,]+,\s*)\b\d+(?:\.\d+)?(?:px|rem)\b/i, 'no raw px/rem geometry allowed, except as keyword fallbacks, but we use thin/etc');
  assert.doesNotMatch(cssString, /:\s*\d+(?:\.\d+)?(?:px|rem)\b/i, 'no raw px/rem allowed');
  assert.doesNotMatch(cssString, /#[0-9a-fA-F]{3,8}\b/i, 'no hex colors');
  assert.doesNotMatch(cssString, /\b(?:rgb|hsl)a?\(/i, 'no rgb/hsl colors');
  assert.doesNotMatch(cssString, /:\s*(?:red|blue|green|black|white)\b/i, 'no named colors in values');
  assert.doesNotMatch(cssString, /\bz-index:\s*\d+/i, 'no numeric z-index');
  assert.doesNotMatch(cssString, /width:\s*100%\s*;/i, 'no width 100% overlay');
  assert.doesNotMatch(cssString, /--sn-sys-surface-0/, 'no invalid tokens');
  assert.doesNotMatch(cssString, /--sn-sys-font-sans/, 'no invalid tokens');
  assert.match(cssString, /var\(--sn-(?:sys|font|radius|transition|space)/i, 'must use cascade tokens');
  assert.match(cssString, /--sn-kanban-card-hero-size/, 'must define semantic hook for hero size');
  assert.match(cssString, /--sn-kanban-card-selected-bg/, 'selected fill must remain cascade-themeable');
  assert.match(cssString, /--sn-kanban-card-icon-size/, 'base icon geometry must come from a component theme alias');
  assert.match(cssString, /--sn-kanban-card-metric-size/, 'large metric geometry must not inherit from local text size');
  assert.match(cssString, /\.sn-kc-stage\s*\{[\s\S]*?gap:\s*var\(--sn-space-sm\)/, 'every progress label must use the same cascade spacing rung above its rail');
  assert.doesNotMatch(cssString, /(?:width|height|font-size):\s*var\(--sn-kanban-card-hero-size,\s*\d+(?:\.\d+)?em\)/, 'hero geometry must not be derived from inherited em size');
  assert.match(cssString, /font-size:\s*var\(--sn-text-2xs\)/, 'dashboard labels must use the canonical smallest type rung');
  assert.doesNotMatch(cssString, /--sn-text-xxs/, 'must not use the non-existent xxs type token');
  assert.match(cssString, /\.sn-kc-step:not\(:last-child\)::after[\s\S]*--sn-kanban-card-progress-thickness/, 'step connectors must remain visibly tokenized');
  assert.doesNotMatch(cssString, /--sn-sys-outline-hover/, 'no invalid outline-hover');
  assert.doesNotMatch(cssString, /--sn-sys-shadow/, 'no invalid shadow');

  let iconsSource = fs.readFileSync(new URL('../board/KanbanCard/icons.js', import.meta.url), 'utf-8');
  assert.doesNotMatch(iconsSource, /<svg[^>]+\s(?:width|height)="\d+"/, 'icon markup must leave geometry to the cascade theme');
});

test('cascade theme owns kanban card spacing and icon geometry', async () => {
  let { createCascadeTheme } = await import('../themes/cascade-theme.js');
  let theme = createCascadeTheme({ mode: 'dark', themeVariant: 'modern' });
  let targets = new Set(Object.values(theme.descriptor.tokenTargets).flat());
  let requiredTokens = [
    '--sn-kanban-card-icon-size',
    '--sn-kanban-card-hero-icon-size',
    '--sn-kanban-card-audit-icon-size',
    '--sn-kanban-card-idle-icon-size',
    '--sn-kanban-card-metric-size',
    '--sn-kanban-card-padding-sm',
    '--sn-kanban-card-padding-md',
    '--sn-kanban-card-padding-lg',
    '--sn-kanban-card-padding-xl',
    '--sn-kanban-card-gap-sm',
    '--sn-kanban-card-gap-md',
    '--sn-kanban-card-gap-lg',
    '--sn-kanban-card-gap-xl',
    '--sn-kanban-card-progress-thickness',
  ];

  for (let token of requiredTokens) {
    assert.ok(theme.tokens[token], `${token} must be emitted by the cascade theme`);
    assert.ok(targets.has(token), `${token} must be exposed through the cascade descriptor`);
  }
});

test('sn-kanban-card-lab.html contains 16 distinct gallery states, importmap, no side effect CSS', () => {
  let html = fs.readFileSync(new URL('../demo/kanban-card-lab.html', import.meta.url), 'utf-8');
  assert.match(html, /lang="ru"/i, 'must use lang=ru');
  assert.match(html, /<script type="importmap">/i, 'must contain importmap');
  assert.match(html, /viewport/i, 'must contain viewport meta');
  for (let i = 1; i <= 16; i++) {
    assert.match(html, new RegExp(`data-state-id="${i}"`), `gallery must contain state ${i}`);
  }

  let demoCss = fs.readFileSync(new URL('../demo/kanban-card-lab.css.js', import.meta.url), 'utf-8');
  assert.doesNotMatch(demoCss, /document\.head\.appendChild/i, 'demo css must have no side effect');
  assert.match(demoCss, /body[\s\S]*padding:\s*var\(--sn-space-lg/, 'demo viewport gutters must preserve usable card width');
  assert.match(demoCss, /\.state-container[\s\S]*padding:\s*var\(--sn-space-sm/, 'demo frames must not squeeze XL dashboard cells');

  let demoJs = fs.readFileSync(new URL('../demo/kanban-card-lab.js', import.meta.url), 'utf-8');
  assert.match(demoJs, /applyCascadeTheme\(document\.documentElement/, 'demo must inherit the production cascade theme contract');
  assert.doesNotMatch(demoJs, /\bCARBON\b/, 'demo must not bypass the cascade theme with a fixed legacy skin');
  assert.match(demoJs, /agentLocal:\s*'Локально'/, 'demo must preserve localized agent metadata');
  assert.match(demoJs, /stopCondition:\s*'Условие остановки'/, 'demo must preserve localized control labels');
  assert.match(demoJs, /setView\(\{ \.\.\.s\.view, strings \}\)/, 'every demo state must receive the same localized view strings');
});

test('sn-kanban-card handles localized/host-supplied labels via view strings', async () => {
  let card = document.createElement('sn-kanban-card');
  document.body.append(card);
  card.setView({
    modules: ['nextAction', 'agent'],
    strings: {
      nextAction: 'Siguiente:',
      agentLocal: 'Local'
    }
  });
  card.setCard({
    nextAction: 'Hacer algo',
    agent: { name: 'Alice', local: true }
  });
  await nextTick();

  let nextActionLabel = card.querySelector('.sn-kc-na-label');
  assert.equal(nextActionLabel.textContent, 'Siguiente:', 'nextAction string is applied');

  let agentLocalText = card.querySelector('.sn-kc-agent-local span');
  assert.equal(agentLocalText.textContent, 'Local', 'agentLocal string is applied');
});

test('sn-kanban-card preserves localized dependency text and ignores disabled actions', async () => {
  let card = document.createElement('sn-kanban-card');
  document.body.append(card);
  card.setView({ modules: ['dependencies', 'actions'] });
  card.setCard({
    id: 'card-2',
    columnId: 'active',
    dependencies: { text: 'Depends on 2 · Unlocks 4' },
    actions: [
      { id: 'start', label: 'Start' },
      { id: 'delete', label: 'Delete', disabled: true },
    ],
  });
  await nextTick();

  assert.equal(
    card.querySelector('.sn-kc-dependencies-text').textContent,
    'Depends on 2 · Unlocks 4',
  );
  let emitted = [];
  card.addEventListener('sn-kanban-card-action', event => emitted.push(event.detail));
  card.querySelector('[data-action-id="delete"]').click();
  card.querySelector('[data-action-id="start"]').click();
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].actionId, 'start');
  assert.equal(emitted[0].card.id, 'card-2');
  assert.equal(emitted[0].card.columnId, 'active');
});
