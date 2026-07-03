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

test('sn-kanban-board renders columns and emits card intents', async () => {
  installDom();
  let { KanbanBoard, normalizeKanbanBoardModel } = await import('../board/index.js');

  assert.equal(typeof KanbanBoard, 'function');
  let normalized = normalizeKanbanBoardModel({
    id: 'workflow',
    columns: [{ id: 'ready', title: 'Ready' }],
    cards: [{ id: 'task-1', columnId: 'ready', title: 'Task 1' }],
  });
  assert.equal(normalized.columns[0].cards[0].title, 'Task 1');

  let board = document.createElement('sn-kanban-board');
  let selected = null;
  let action = null;
  board.addEventListener('sn-board-card-select', (event) => {
    selected = event.detail;
  });
  board.addEventListener('sn-board-card-action', (event) => {
    action = event.detail;
  });
  document.body.append(board);
  await nextTick();

  board.setBoard({
    columns: [{
      id: 'ready',
      title: 'Ready',
      cards: [{
        id: 'task-1',
        title: 'Task 1',
        summary: 'Accepted work',
        meta: ['project-a'],
        actions: [{ id: 'move-next', icon: 'arrow_forward', title: 'Move next' }],
      }],
    }],
  });

  assert.equal(board.querySelectorAll('.sn-kanban-column').length, 1);
  assert.equal(board.querySelector('.sn-kanban-card-title-text')?.textContent, 'Task 1');
  assert.equal(board.querySelector('.sn-kanban-card')?.tagName.toLowerCase(), 'article');
  assert.equal(board.querySelector('.sn-kanban-card')?.getAttribute('role'), 'button');
  assert.equal(
    board.querySelector('.sn-kanban-card-actions')?.tagName.toLowerCase(),
    'sn-dropdown',
    'card actions should render behind one native-popover dropdown trigger, not an in-card expanding menu',
  );
  assert.ok(
    board.querySelector('.sn-kanban-card-actions .sn-dropdown-trigger .sn-kanban-card-menu'),
    'slot distribution should place the card menu button inside the dropdown trigger',
  );
  assert.ok(
    board.querySelector('.sn-kanban-card-actions .sn-dropdown-popover sn-menu'),
    'slot distribution should place the action menu inside the native popover, hidden until triggered',
  );
  board.querySelector('.sn-kanban-card').click();
  assert.equal(selected.card.id, 'task-1');
  board.querySelector('[data-sn-board-action]').click();
  assert.equal(action.actionId, 'move-next');
  assert.equal(action.card.id, 'task-1');

  board.setBoard({ columns: [] });
  let emptyState = board.querySelector('sn-empty-state.sn-kanban-empty');
  assert.ok(emptyState, 'board empty state should compose the shared display primitive');
  assert.equal(emptyState.hidden, false);
});

test('sn-kanban-board exposes column stretch sizing tokens', async () => {
  let { default: css } = await import('../board/KanbanBoard/KanbanBoard.css.js');

  assert.match(css, /align-items: var\(--sn-kanban-columns-align, stretch\);/);
  assert.match(css, /height: var\(--sn-kanban-columns-height, 100%\);/);
  assert.match(css, /min-height: var\(--sn-kanban-columns-min-height, 0\);/);
  assert.match(css, /height: var\(--sn-kanban-column-height, auto\);/);
  assert.match(css, /overflow: var\(--sn-kanban-card-list-overflow, auto\);/);
  assert.match(css, /sn-kanban-board \.sn-kanban-column-header \{[\s\S]*flex: 0 0 auto;/);
  assert.match(css, /sn-kanban-board \.sn-kanban-card \{[\s\S]*flex: 0 0 auto;/);
  // U01: footer chip row wraps instead of clipping in a non-wrapping grid.
  assert.match(css, /sn-kanban-board \.sn-kanban-card-footer \{[^}]*flex-wrap: wrap;/);
  assert.doesNotMatch(css, /sn-kanban-board \.sn-kanban-card-footer \{[^}]*display: grid;/);
  // U07: the actions menu is the sn-dropdown native popover + anchor-positioning primitive —
  // no in-card grid-column: 1/-1 expansion class remains.
  assert.doesNotMatch(css, /grid-column:\s*1\s*\/\s*-1/);
  assert.doesNotMatch(css, /\[open\]/);
  assert.match(css, /sn-kanban-board \.sn-kanban-card-actions \{[^}]*--sn-dropdown-position-area/);
  // U02: card summary clamps instead of rendering unbounded raw text.
  assert.match(css, /sn-kanban-board \.sn-kanban-card-summary \{[^}]*-webkit-line-clamp: var\(--sn-kanban-card-summary-lines, 3\);/);
  // U05: status/priority chips carry container-fill weight; plain chips stay outline-only.
  assert.match(css, /sn-kanban-board \.sn-kanban-chip\[data-kind="status"\] \{[^}]*background: var\(--sn-sys-success-container\);/);
  assert.doesNotMatch(css, /sn-kanban-board \.sn-kanban-chip \{[^}]*background:/);
  // U08: grab/grabbing cursor affordance for the draggable card.
  assert.match(css, /sn-kanban-board \.sn-kanban-card \{[\s\S]*cursor: grab;/);
  assert.match(css, /sn-kanban-board \.sn-kanban-card:active \{[\s\S]*cursor: grabbing;/);
  // No legacy flat token names or literal colors remain — only T2 system roles / T3 aliases.
  // (--sn-text-xs/-xl/-2xs etc. are unrelated typography-scale tokens, not the legacy color alias.)
  assert.doesNotMatch(css, /var\(--sn-text(?:-dim)?[,)]/);
  assert.doesNotMatch(css, /var\(--sn-node-/);
  assert.doesNotMatch(css, /var\(--sn-panel-bg/);
  assert.doesNotMatch(css, /var\(--sn-(?:success|warning|danger)-color/);
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(css, /\b(?:hsla?|rgba?)\(/);
});
