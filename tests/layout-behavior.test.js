import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_LAYOUT_BEHAVIOR,
  branchFitsExpandedState,
  createPanel,
  createSplit,
  getBehaviorImportance,
  getNodeBehavior,
  normalizeLayoutBehavior,
  setNodeBehavior,
} from '../layout/LayoutTree.js';

test('layout behavior normalizes responsive collapse and overflow policy', () => {
  let behavior = normalizeLayoutBehavior({
    importance: 200,
    minInlineSize: 360,
    minBlockSize: 240,
    collapse: 'never',
    overflow: 'scroll-inline',
    responsiveMode: 'stack',
    responsiveBreakpoint: 640,
  });

  assert.equal(behavior.importance, 100);
  assert.equal(behavior.minInlineSize, 360);
  assert.equal(behavior.minBlockSize, 240);
  assert.equal(behavior.collapse, 'never');
  assert.equal(behavior.overflow, 'scroll-inline');
  assert.equal(behavior.responsiveMode, 'stack');
  assert.equal(behavior.responsiveBreakpoint, 640);
});

test('layout tree stores behavior per insertion point', () => {
  let graph = createPanel('graph', {}, { importance: 95, minInlineSize: 420 });
  let chat = createPanel('chat', {}, { importance: 25, collapse: 'auto' });
  let root = createSplit('horizontal', graph, chat, 0.62, { responsiveMode: 'scroll-inline' });

  assert.equal(getBehaviorImportance(graph), 95);
  assert.equal(getNodeBehavior(chat).importance, 25);
  assert.equal(getNodeBehavior(root).responsiveMode, 'scroll-inline');

  assert.equal(setNodeBehavior(root, chat.id, { importance: 5, collapse: 'never' }), true);
  assert.equal(getNodeBehavior(chat).importance, 5);
  assert.equal(getNodeBehavior(chat).collapse, 'never');
  assert.equal(getNodeBehavior(chat).minBlockSize, DEFAULT_LAYOUT_BEHAVIOR.minBlockSize);
});

test('layout restore guard rejects expanded states that would immediately collapse again', () => {
  let graph = createPanel('graph', {}, { minInlineSize: 650, minBlockSize: 260 });
  let inspector = createPanel('inspector', {}, { minInlineSize: 300, minBlockSize: 220 });
  let root = createSplit('horizontal', graph, inspector, 0.68);

  inspector.collapsed = true;
  inspector.autoCollapsed = true;

  assert.equal(
    branchFitsExpandedState(root, 900, 420, { restoringNodeId: inspector.id }),
    false
  );
  assert.equal(
    branchFitsExpandedState(root, 1160, 420, { restoringNodeId: inspector.id }),
    true
  );
});
