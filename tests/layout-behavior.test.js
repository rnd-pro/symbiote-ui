import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_LAYOUT_BEHAVIOR,
  branchFitsExpandedState,
  closeUiPanel,
  createPanel,
  createSplit,
  duplicatePanel,
  findPanelByType,
  findNode,
  getBehaviorImportance,
  getNodeBehavior,
  normalizeLayoutBehavior,
  openPanel,
  resolveLayoutMinSize,
  resolveResponsiveLayoutState,
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

test('layout tree duplicates panel metadata for explicit menu duplicate action', () => {
  let theme = createPanel('theme', { view: 'full' }, { importance: 80, collapse: 'manual' });
  let graph = createPanel('graph');
  let root = createSplit('horizontal', theme, graph, 0.4);
  let duplicated = duplicatePanel(root, theme.id, 'vertical', 0.5);
  let parent = findNode(duplicated, theme.id);

  assert.equal(parent.panelType, 'theme');
  assert.equal(parent.panelState.view, 'full');
  assert.equal(getNodeBehavior(parent).importance, 80);
  assert.equal(getNodeBehavior(parent).collapse, 'manual');
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

test('layout behavior resolves responsive state and scroll fallback axes', () => {
  let wide = resolveResponsiveLayoutState(
    {
      collapse: 'auto',
      overflow: 'collapse',
      responsiveMode: 'stack',
      responsiveBreakpoint: 640,
      minInlineSize: 300,
      minBlockSize: 180,
    },
    { inlineSize: 900, blockSize: 520, layoutMinSize: { inlineSize: 740, blockSize: 360 } }
  );

  assert.equal(wide.responsiveActive, false);
  assert.equal(wide.effectiveResponsiveMode, 'preserve');
  assert.equal(wide.collapseAllowed, true);
  assert.equal(wide.scrollInline, false);
  assert.equal(wide.scrollBlock, false);

  let state = resolveResponsiveLayoutState(
    {
      collapse: 'auto',
      overflow: 'collapse',
      responsiveMode: 'scroll-inline',
      responsiveBreakpoint: 640,
      minInlineSize: 320,
      minBlockSize: 180,
    },
    {
      inlineSize: 520,
      blockSize: 420,
      layoutMinSize: { inlineSize: 940, blockSize: 360 },
    }
  );

  assert.equal(state.responsiveActive, true);
  assert.equal(state.effectiveResponsiveMode, 'scroll-inline');
  assert.equal(state.collapseAllowed, false);
  assert.equal(state.scrollInline, true);
  assert.equal(state.scrollBlock, false);
  assert.equal(state.cssVars['--sn-layout-overflow-inline-size'], '940px');
  assert.equal(state.cssVars['--sn-layout-overflow-block-size'], '420px');
  assert.equal(state.cssVars['--sn-layout-responsive-panel-min-block-size'], '180px');

  let stack = resolveResponsiveLayoutState(
    { collapse: 'auto', overflow: 'collapse', responsiveMode: 'stack', responsiveBreakpoint: 640 },
    { inlineSize: 480, blockSize: 300, layoutMinSize: { inlineSize: 900, blockSize: 760 } }
  );

  assert.equal(stack.responsiveActive, true);
  assert.equal(stack.effectiveResponsiveMode, 'stack');
  assert.equal(stack.collapseAllowed, false);
  assert.equal(stack.scrollInline, false);
  assert.equal(stack.scrollBlock, true);

  let blockScroll = resolveResponsiveLayoutState(
    { collapse: 'never', overflow: 'scroll-block', responsiveMode: 'preserve' },
    { inlineSize: 900, blockSize: 300, layoutMinSize: { inlineSize: 500, blockSize: 760 } }
  );

  assert.equal(blockScroll.responsiveActive, false);
  assert.equal(blockScroll.collapseAllowed, false);
  assert.equal(blockScroll.scrollInline, false);
  assert.equal(blockScroll.scrollBlock, true);
  assert.equal(blockScroll.cssVars['--sn-layout-overflow-inline-size'], '900px');
  assert.equal(blockScroll.cssVars['--sn-layout-overflow-block-size'], '760px');

  let bothAxes = resolveResponsiveLayoutState(
    { collapse: 'never', overflow: 'scroll' },
    { inlineSize: 300, blockSize: 200, layoutMinSize: { inlineSize: 640, blockSize: 480 } }
  );

  assert.equal(bothAxes.scrollInline, true);
  assert.equal(bothAxes.scrollBlock, true);
  assert.equal(bothAxes.collapseAllowed, false);
});

test('layout minimum size estimate follows split direction and node behavior', () => {
  let graph = createPanel('graph', {}, { minInlineSize: 420, minBlockSize: 260 });
  let chat = createPanel('chat', {}, { minInlineSize: 320, minBlockSize: 280 });
  let inspector = createPanel('inspector', {}, { minInlineSize: 280, minBlockSize: 360 });
  let right = createSplit('vertical', chat, inspector, 0.5);
  let root = createSplit('horizontal', graph, right, 0.55);

  let size = resolveLayoutMinSize(root);

  assert.equal(size.inlineSize, 740);
  assert.equal(size.blockSize, 640);

  chat.collapsed = true;
  let collapsedSize = resolveLayoutMinSize(root);

  assert.equal(collapsedSize.inlineSize, 700);
  assert.equal(collapsedSize.blockSize, 388);
});

test('layout tree opens and closes UI-invoked panels without owning host layout policy', () => {
  let root = createPanel('graph', {}, { importance: 90 });
  let opened = openPanel(root, 'theme', {
    behavior: { importance: 100, collapse: 'manual', minInlineSize: 320 },
    direction: 'horizontal',
    panelState: { storageKey: 'symbiote-ui:test-theme' },
    ratio: 0.66,
    source: 'theme-widget',
    uiInvoked: true,
  });

  assert.equal(opened.created, true);
  assert.equal(opened.root.type, 'split');
  assert.equal(opened.root.direction, 'horizontal');
  assert.equal(opened.root.ratio, 0.66);
  assert.equal(opened.panel.panelType, 'theme');
  assert.equal(opened.panel.panelState.uiInvoked, true);
  assert.equal(opened.panel.panelState.source, 'theme-widget');
  assert.equal(opened.panel.panelState.storageKey, 'symbiote-ui:test-theme');
  assert.equal(getNodeBehavior(opened.panel).importance, 100);
  assert.equal(getNodeBehavior(opened.panel).collapse, 'manual');

  let reused = openPanel(opened.root, 'theme', {
    source: 'theme-widget',
    uiInvoked: true,
  });
  assert.equal(reused.created, false);
  assert.equal(reused.panel.id, opened.panel.id);

  let closed = closeUiPanel(reused.root, 'theme');
  assert.equal(closed.removed, true);
  assert.equal(findPanelByType(closed.root, 'theme'), null);
  assert.equal(findPanelByType(closed.root, 'graph').panelType, 'graph');
});

test('layout tree closeUiPanel refuses to remove host-owned panels', () => {
  let root = createSplit(
    'horizontal',
    createPanel('theme', { source: 'host-layout' }),
    createPanel('graph'),
    0.5
  );

  let result = closeUiPanel(root, 'theme');

  assert.equal(result.removed, false);
  assert.equal(findPanelByType(result.root, 'theme').panelState.source, 'host-layout');
});

test('layout tree opens UI-invoked panels separately from host-owned panels of the same type', () => {
  let root = createSplit(
    'horizontal',
    createPanel('theme', { source: 'host-layout' }),
    createPanel('graph'),
    0.5
  );
  let opened = openPanel(root, 'theme', {
    source: 'theme-widget',
    uiInvoked: true,
  });

  assert.equal(opened.created, true);
  assert.notEqual(opened.panel.panelState.source, 'host-layout');
  assert.equal(opened.panel.panelState.source, 'theme-widget');
  assert.equal(findPanelByType(opened.root, 'theme', { uiInvoked: false }).panelState.source, 'host-layout');
  assert.equal(findPanelByType(opened.root, 'theme', { uiInvoked: true }).panelState.source, 'theme-widget');

  let closed = closeUiPanel(opened.root, 'theme');
  assert.equal(closed.removed, true);
  assert.equal(findPanelByType(closed.root, 'theme').panelState.source, 'host-layout');
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

  assert.equal(
    branchFitsExpandedState(root, 1120, 420, {
      restoringNodeId: inspector.id,
      stableFactor: 1,
      restoreFactor: 1.25,
    }),
    false
  );
});
