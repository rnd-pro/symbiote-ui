import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  hasLayoutBehaviorMetadata,
  joinPanels,
  layoutHasBehaviorMetadata,
  normalizeLayoutBehavior,
  openPanel,
  removeUiPanel,
  resolveMobileDrawerLayout,
  resolveLayoutMinSize,
  resolveResponsiveLayoutState,
  setNodeBehavior,
} from '../layout/LayoutTree.js';
import { withGlobalPanel } from '../layout/LayoutRouter/SectionRegistry.js';
import {
  DEFAULT_WHEEL_ZOOM_SENSITIVITY,
  resolveWheelZoomDelta,
  resolveWheelZoomFactor,
} from '../interactions/Zoom.js';

const layoutNodeStyles = new URL('../layout/LayoutNode/LayoutNode.css.js', import.meta.url);
const layoutNodeTemplate = new URL('../layout/LayoutNode/LayoutNode.tpl.js', import.meta.url);
const layoutNodeSource = new URL('../layout/LayoutNode/LayoutNode.js', import.meta.url);
const layoutSource = new URL('../layout/Layout/Layout.js', import.meta.url);
const layoutStyles = new URL('../layout/Layout/Layout.css.js', import.meta.url);
const layoutTemplate = new URL('../layout/Layout/Layout.tpl.js', import.meta.url);
const canvasGraphSource = new URL('../canvas/CanvasGraph/CanvasGraph.js', import.meta.url);
const cascadeThemeSource = new URL('../themes/cascade-theme.js', import.meta.url);
const defaultProviderThemeSource = new URL('../themes/default-provider.js', import.meta.url);
const defaultDarkThemeSource = new URL('../themes/default-dark.js', import.meta.url);
const componentRegistrySource = new URL('../manifest/component-registry.js', import.meta.url);
const customElementsSource = new URL('../custom-elements.json', import.meta.url);

test('layout node panel header adapts without overlapping actions', async () => {
  let [styles, template] = await Promise.all([
    readFile(layoutNodeStyles, 'utf8'),
    readFile(layoutNodeTemplate, 'utf8'),
  ]);

  assert.match(template, /class="panel-actions"/);
  assert.match(template, /class="panel-menu-action-label"/);
  assert.match(styles, /\.panel-view\s*\{[\s\S]*?container-type: inline-size;[\s\S]*?container-name: layout-panel;/);
  assert.match(styles, /\.panel-header\s*\{[\s\S]*?box-sizing: border-box;[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\);[\s\S]*?block-size: var\(--sn-layout-header-block-size,/);
  assert.match(styles, /\.type-btn\s*\{[\s\S]*?grid-column: 1;[\s\S]*?overflow: hidden;/);
  assert.match(styles, /\.panel-menu-toggle\s*\{[\s\S]*?grid-column: 2;[\s\S]*?position: static;[\s\S]*?transform: none;/);
  assert.match(styles, /\.panel-actions\s*\{[\s\S]*?grid-column: 3;[\s\S]*?justify-content: flex-end;[\s\S]*?overflow: hidden;/);
  assert.match(styles, /\.panel-menu-row\s*\{[\s\S]*?min-block-size: calc\(var\(--sn-layout-menu-row-height,/);
  assert.doesNotMatch(styles, /\.panel-menu-row\s*\{[\s\S]*?height: calc\(var\(--sn-layout-menu-row-height,/);
  assert.match(styles, /\.panel-menu-actions\s*\{[\s\S]*?flex-wrap: wrap;[\s\S]*?overflow: hidden;/);
  assert.match(styles, /\.panel-menu-action-label\s*\{[\s\S]*?text-overflow: ellipsis;/);
  assert.match(styles, /@container layout-panel \(max-width: 360px\) \{[\s\S]*?\.panel-menu-action-label \{[\s\S]*?display: none;/);
  assert.match(styles, /@container layout-panel \(max-width: 280px\) \{[\s\S]*?\.panel-menu-row \{[\s\S]*?grid-template-columns: 1fr;/);
  assert.match(styles, /@container layout-panel \(max-width: 360px\) \{[\s\S]*?\.panel-title \{[\s\S]*?display: none;/);
  assert.match(styles, /@container layout-panel \(max-width: 260px\) \{[\s\S]*?\.dropdown-arrow \{[\s\S]*?display: none;/);
  assert.match(styles, /@container layout-panel \(max-width: 220px\) \{[\s\S]*?\.fullscreen-btn \{[\s\S]*?display: none;/);
  assert.match(styles, /&\[collapsed\]\[collapse-dir='vertical'\]\s*\{[\s\S]*?\.panel-actions\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;[\s\S]*?block-size:\s*100%;/);
  assert.match(styles, /&\[collapsed\]\[collapse-dir='vertical'\]\s*\{[\s\S]*?\.collapse-btn\s*\{[\s\S]*?inset:\s*0;[\s\S]*?inline-size:\s*100%;[\s\S]*?block-size:\s*100%;/);
  assert.match(styles, /&\[collapsed\]\[collapse-dir='horizontal'\]\s*\{[\s\S]*?\.panel-actions\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;[\s\S]*?block-size:\s*100%;/);
  assert.match(styles, /&\[collapsed\]\[collapse-dir='horizontal'\]\s*\{[\s\S]*?\.collapse-btn\s*\{[\s\S]*?inline-size:\s*100%;[\s\S]*?block-size:\s*100%;/);
  assert.match(styles, /&\[collapsed\]\[collapse-dir='horizontal'\]\s*\{[\s\S]*?\.type-btn\s*\{[\s\S]*?block-size:\s*var\(--sn-layout-header-block-size,/);
  assert.match(styles, /&\[collapsed\]\[collapse-dir='horizontal'\]\s*\{[\s\S]*?\.panel-icon\s*\{[\s\S]*?font-size:\s*var\(--sn-layout-header-icon-size,\s*16px\);/);
  let menuBlock = styles.slice(styles.indexOf('    .panel-menu-toggle {'), styles.indexOf('    .panel-actions {'));
  assert.doesNotMatch(menuBlock, /position: absolute;/);
});

test('layout node collapsed icon points toward expansion side', async () => {
  let [source, layout] = await Promise.all([
    readFile(layoutNodeSource, 'utf8'),
    readFile(layoutSource, 'utf8'),
  ]);

  assert.match(source, /collapseSlot: 'first'/);
  assert.match(source, /this\.\$\.collapseSlot = isFirst \? 'first' : 'second'/);
  assert.match(source, /this\.\#syncHostAttribute\('collapse-side', this\.\$\.collapseSlot\)/);
  assert.match(source, /if \(this\.\$\.isCollapsed\) return isFirst \? 'chevron_right' : 'chevron_left';/);
  assert.match(source, /return isFirst \? 'chevron_left' : 'chevron_right';/);
  assert.match(source, /if \(this\.\$\.isCollapsed\) return isFirst \? 'expand_more' : 'expand_less';/);
  assert.match(source, /return isFirst \? 'expand_less' : 'expand_more';/);
  assert.match(layout, /node\._syncCollapsePresentation\?\.\(\)/);
  assert.doesNotMatch(source, /this\.\$\.isCollapsed\)[\s\S]{0,120}this\.\$\.collapseIcon = 'chevron_right'/);
});

test('layout behavior normalizes responsive collapse and overflow policy', () => {
  let behavior = normalizeLayoutBehavior({
    importance: 200,
    minInlineSize: 360,
    minBlockSize: 240,
    collapse: 'never',
    overflow: 'scroll-inline',
    responsiveMode: 'swipe',
    responsiveBreakpoint: 640,
    mobileDock: 'end',
    swipeControl: 'island',
  });

  assert.equal(behavior.importance, 100);
  assert.equal(behavior.minInlineSize, 360);
  assert.equal(behavior.minBlockSize, 240);
  assert.equal(behavior.collapse, 'never');
  assert.equal(behavior.overflow, 'scroll-inline');
  assert.equal(behavior.responsiveMode, 'swipe');
  assert.equal(behavior.responsiveBreakpoint, 640);
  assert.equal(behavior.mobileDock, 'end');
  assert.equal(behavior.swipeControl, 'island');
  assert.equal(hasLayoutBehaviorMetadata(behavior), true);
  assert.equal(hasLayoutBehaviorMetadata({ ...behavior, overflow: 'invalid' }), false);
  assert.equal(hasLayoutBehaviorMetadata({ ...behavior, mobileDock: 'invalid' }), false);
  assert.equal(hasLayoutBehaviorMetadata({ ...behavior, swipeControl: 'invalid' }), false);
});

test('layout behavior metadata predicate validates complete layout trees', () => {
  let nav = createPanel('navigation', {}, { importance: 80, minInlineSize: 220 });
  let main = createPanel('main', {}, { importance: 95, minInlineSize: 520, collapse: 'never' });
  let complete = createSplit('horizontal', nav, main, 0.3, { responsiveMode: 'scroll-inline' });

  assert.equal(layoutHasBehaviorMetadata(complete), true);

  let incompletePanel = createPanel('legacy');
  let incomplete = createSplit('horizontal', nav, incompletePanel, 0.4, { responsiveMode: 'stack' });
  assert.equal(layoutHasBehaviorMetadata(incomplete), false);
  assert.equal(layoutHasBehaviorMetadata(null), false);
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

  let stackedInlineScroll = resolveResponsiveLayoutState(
    { collapse: 'auto', overflow: 'scroll-inline', responsiveMode: 'stack', responsiveBreakpoint: 640 },
    { inlineSize: 480, blockSize: 300, layoutMinSize: { inlineSize: 900, blockSize: 760 } }
  );

  assert.equal(stackedInlineScroll.responsiveActive, true);
  assert.equal(stackedInlineScroll.effectiveResponsiveMode, 'stack');
  assert.equal(stackedInlineScroll.collapseAllowed, false);
  assert.equal(stackedInlineScroll.scrollInline, true);
  assert.equal(stackedInlineScroll.scrollBlock, true);
  assert.equal(stackedInlineScroll.cssVars['--sn-layout-overflow-inline-size'], '900px');
  assert.equal(stackedInlineScroll.cssVars['--sn-layout-overflow-block-size'], '760px');

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

  let drawer = resolveResponsiveLayoutState(
    { collapse: 'auto', overflow: 'collapse', responsiveMode: 'drawer', responsiveBreakpoint: 760 },
    { inlineSize: 390, blockSize: 760, layoutMinSize: { inlineSize: 1060, blockSize: 420 } }
  );

  assert.equal(drawer.responsiveActive, true);
  assert.equal(drawer.effectiveResponsiveMode, 'drawer');
  assert.equal(drawer.drawerActive, true);
  assert.equal(drawer.collapseAllowed, false);
  assert.equal(drawer.scrollInline, false);
  assert.equal(drawer.scrollBlock, false);

  let swipe = resolveResponsiveLayoutState(
    { collapse: 'auto', overflow: 'collapse', responsiveMode: 'swipe', responsiveBreakpoint: 760 },
    { inlineSize: 390, blockSize: 760, layoutMinSize: { inlineSize: 1060, blockSize: 420 } }
  );

  assert.equal(swipe.responsiveActive, true);
  assert.equal(swipe.effectiveResponsiveMode, 'swipe');
  assert.equal(swipe.drawerActive, true);
  assert.equal(swipe.collapseAllowed, false);
});

test('layout tree resolves mobile drawer docks without product panel names', () => {
  let materials = createPanel('materials', {}, { importance: 60, mobileDock: 'start' });
  let content = createPanel('content', {}, { importance: 100, mobileDock: 'primary' });
  let graph = createPanel('graph', {}, { importance: 80, mobileDock: 'end', swipeControl: 'island' });
  let theme = createPanel('theme', {}, { importance: 70, mobileDock: 'end' });
  let root = createSplit(
    'horizontal',
    materials,
    createSplit('horizontal', content, createSplit('vertical', graph, theme, 0.5), 0.55),
    0.24,
    { responsiveMode: 'drawer' }
  );
  let projection = resolveMobileDrawerLayout(root);

  assert.equal(projection.primaryPanelId, content.id);
  assert.deepEqual(projection.startPanelIds, [materials.id]);
  assert.deepEqual(projection.endPanelIds, [graph.id, theme.id]);
  assert.equal(projection.panels.find((panel) => panel.id === materials.id).dock, 'start');
  assert.equal(projection.panels.find((panel) => panel.id === content.id).dock, 'primary');
  assert.equal(projection.panels.find((panel) => panel.id === graph.id).dock, 'end');
  assert.equal(projection.panels.find((panel) => panel.id === graph.id).swipeControl, 'island');
  assert.equal(projection.panels.find((panel) => panel.id === theme.id).dock, 'end');

  let autoRoot = createSplit(
    'horizontal',
    createPanel('tree', {}, { importance: 40 }),
    createSplit(
      'horizontal',
      createPanel('reader', {}, { importance: 95 }),
      createPanel('map', {}, { importance: 70 }),
      0.6
    ),
    0.25,
    { responsiveMode: 'drawer' }
  );
  let autoProjection = resolveMobileDrawerLayout(autoRoot);

  assert.equal(autoProjection.panels.map((panel) => panel.dock).join(','), 'start,primary,end');
  assert.equal(autoProjection.primaryPanelId, autoProjection.panels[1].id);
});

test('panel layout drawer mode has gesture, theme, and metadata contracts', async () => {
  let [layout, styles, template, nodeStyles, registry, customElements] = await Promise.all([
    readFile(layoutSource, 'utf8'),
    readFile(layoutStyles, 'utf8'),
    readFile(layoutTemplate, 'utf8'),
    readFile(layoutNodeStyles, 'utf8'),
    readFile(componentRegistrySource, 'utf8'),
    readFile(customElementsSource, 'utf8'),
  ]);

  assert.match(layout, /setPointerCapture/);
  assert.match(layout, /releasePointerCapture/);
  assert.match(layout, /pointercancel/);
  assert.match(layout, /drawer-mode-active/);
  assert.match(layout, /resolveMobileDrawerLayout/);
  assert.match(layout, /drawer-start-open/);
  assert.match(layout, /drawer-end-open/);
  assert.match(layout, /drawerStartPanelId/);
  assert.match(layout, /drawerEndPanelId/);
  assert.match(layout, /drawer-active-panel/);
  assert.match(layout, /dataset\.drawerPanelId/);
  assert.match(layout, /_renderDrawerHandleStack/);
  assert.match(layout, /_resolveDrawerSwipeControl/);
  assert.match(layout, /dataset\.swipeControl/);
  assert.match(layout, /startPanels\.length > 0 && !startOpen && !endOpen/);
  assert.match(layout, /endPanels\.length > 0 && !startOpen && !endOpen/);
  assert.match(template, /layout-drawer-handle-stack-start/);
  assert.match(template, /layout-drawer-handle-stack-end/);
  assert.match(styles, /\[drawer-mode-active\]/);
  assert.match(styles, /\.layout-drawer-handle-stack\s*\{/);
  assert.match(styles, /\.layout-drawer-handle-stack\[data-swipe-control='island'\]\s*\{/);
  assert.match(styles, /--sn-layout-swipe-island-size/);
  assert.match(styles, /touch-action:\s*none;/);
  assert.match(styles, /cursor:\s*grab;/);
  assert.match(styles, /min-block-size:\s*var\(--sn-layout-drawer-min-block-size,\s*inherit\)/);
  assert.match(styles, /inset:\s*0;/);
  assert.match(styles, /--sn-layout-drawer-translate:\s*-100%/);
  assert.match(styles, /--sn-layout-drawer-translate:\s*100%/);
  assert.match(styles, /transform:\s*translateX\(var\(--sn-layout-drawer-translate\)\)/);
  assert.match(styles, /\[drawer-mode-active\]\[drawer-start-open\]\s+layout-node\[mobile-dock='start'\]/);
  assert.match(styles, /\[drawer-mode-active\]\[drawer-end-open\]\s+layout-node\[mobile-dock='end'\]/);
  assert.match(layout, /--sn-layout-drawer-translate/);
  assert.match(layout, /setImportantStylePropertyIfChanged\(node\.style,\s*'transform'/);
  assert.match(layout, /_setDrawerHandleVisualState/);
  assert.match(layout, /_applyDrawerHandleProgress/);
  assert.match(layout, /_getDrawerHandleOpenOffset/);
  assert.match(layout, /_setDrawerNodeExpanded/);
  assert.match(layout, /_restoreDrawerNodeCollapseState/);
  assert.match(layout, /drawer-expanded/);
  assert.match(layout, /_clearDrawerDrag\('all'\)/);
  assert.match(styles, /--sn-layout-drawer-handle-inline-size/);
  assert.match(styles, /--sn-layout-drawer-handle-gap/);
  assert.match(layout, /inset-inline-start/);
  assert.match(layout, /inset-inline-end/);
  assert.doesNotMatch(layout, /open \? 'var\(--sn-layout-drawer-size\)'/);
  assert.doesNotMatch(styles, /layout-drawer-handle-start[\s\S]{0,140}var\(--sn-layout-drawer-size\)/);
  assert.match(styles, /box-sizing:\s*border-box/);
  assert.match(styles, /touch-action:\s*pan-y;/);
  assert.match(styles, /overscroll-behavior:\s*contain;/);
  assert.match(styles, /--sn-layout-drawer-bg/);
  assert.match(styles, /--sn-layout-drawer-shadow/);
  assert.match(styles, /box-shadow:\s*var\(--sn-layout-drawer-shadow,\s*var\(--sn-shadow-xl\)\)/);
  assert.match(styles, /--sn-layout-drawer-handle-bg/);
  assert.match(styles, /--sn-layout-drawer-backdrop-bg,\s*transparent/);
  assert.match(styles, /--sn-layout-drawer-backdrop-filter,\s*none/);
  assert.match(styles, /border-inline-start-width:\s*0/);
  assert.match(styles, /border-inline-end-width:\s*0/);
  assert.doesNotMatch(styles, /--sn-layout-drawer-open-handle-radius/);
  assert.match(styles, /layout-node\[drawer-expanded\]/);
  assert.match(styles, /\.panel-content\s*\{[\s\S]*?display:\s*block !important;/);
  assert.match(styles, /layout-node\[drawer-expanded\]\s*\{[\s\S]*?\.type-btn,[\s\S]*?\.collapse-btn\s*\{[\s\S]*?display:\s*none !important;/);
  assert.match(styles, /--sn-layout-drawer-handle-shadow,\s*none/);
  assert.doesNotMatch(styles, /--sn-layout-drawer-backdrop-bg,\s*color-mix/);
  assert.doesNotMatch(styles, /--sn-layout-drawer-backdrop-filter,\s*blur/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(layout, /_syncFullscreenBounds/);
  assert.match(layout, /fullscreen-active/);
  assert.match(layout, /setAttributeIfChanged\(this,\s*'fullscreen-active',\s*'true'\)/);
  assert.match(layout, /this\._clearDrawerProjection\(\);/);
  assert.match(layout, /removeAttribute\('drawer-mode-active'\)/);
  assert.match(layout, /--sn-layout-fullscreen-host-top', '0px'/);
  assert.match(styles, /\.fullscreen-tab-bar\s*\{[\s\S]*?top:\s*0;/);
  assert.match(styles, /height:\s*var\(--sn-fullscreen-tab-bar-height,\s*32px\)/);
  assert.match(styles, /z-index:\s*var\(--sn-fullscreen-tab-bar-z,\s*20010\)/);
  assert.match(styles, /\[fullscreen-active\]\s*\{[\s\S]*?\.layout-drawer-backdrop,[\s\S]*?\.layout-drawer-handle-stack,[\s\S]*?\.layout-drawer-handle\s*\{[\s\S]*?display:\s*none !important;/);
  assert.ok(
    styles.lastIndexOf('layout-node[fullscreen]') > styles.indexOf("layout-node[mobile-dock='start'],"),
    'drawer-mode fullscreen override must be after start/end drawer sizing'
  );
  assert.match(nodeStyles, /--sn-layout-fullscreen-host-top/);
  assert.match(nodeStyles, /--sn-fullscreen-tab-bar-height,\s*32px/);
  assert.match(nodeStyles, /--sn-layout-fullscreen-host-bottom/);
  assert.match(nodeStyles, /layout-node\s*\{[\s\S]*?&\[fullscreen\]\s*\{[\s\S]*?height:\s*auto !important;/);
  assert.match(registry, /mobile-drawer/);
  assert.match(registry, /mobile-swipe-mode/);
  assert.match(registry, /swipe-island-control/);
  assert.match(registry, /multi-drawer-handles/);
  assert.match(registry, /drawer-start-panel-id/);
  assert.match(registry, /drawer-end-panel-id/);
  assert.match(registry, /drawer/);
  assert.match(registry, /mobileDock/);
  assert.match(registry, /swipeControl/);
  assert.match(customElements, /mobile-drawer/);
  assert.match(customElements, /mobile-swipe-mode/);
  assert.match(customElements, /swipe-island-control/);
  assert.match(customElements, /drawer/);
  assert.match(customElements, /swipe/);
  assert.match(customElements, /mobileDock/);
  assert.match(customElements, /swipeControl/);
  assert.doesNotMatch(customElements, /--sn-layout-drawer-open-handle-radius/);
});

test('fullscreen tab layer stays above floating toolbars in theme defaults', async () => {
  let [cascadeTheme, defaultProvider, defaultDark] = await Promise.all([
    readFile(cascadeThemeSource, 'utf8'),
    readFile(defaultProviderThemeSource, 'utf8'),
    readFile(defaultDarkThemeSource, 'utf8'),
  ]);

  for (let source of [cascadeTheme, defaultProvider, defaultDark]) {
    assert.match(source, /--sn-fullscreen-tab-bar-z['"]:\s*['"]20010['"]/);
  }
  assert.match(cascadeTheme, /--sn-fullscreen-tab-bar-height['"]:\s*densityToken\(32\)/);
  assert.match(cascadeTheme, /--sn-fullscreen-tab-active-height['"]:\s*densityToken\(33\)/);
});

test('canvas graph fit clamps padding for narrow viewports', async () => {
  let source = await readFile(canvasGraphSource, 'utf8');
  let styles = await readFile(new URL('../canvas/CanvasGraph/CanvasGraph.css.js', import.meta.url), 'utf8');

  assert.match(source, /function resolveFitPadding/);
  assert.match(source, /minSide \* 0\.32/);
  assert.match(source, /Math\.max\(1,\s*rect\.width - fitPadding \* 2\)/);
  assert.match(source, /Math\.max\(1,\s*rect\.width - padding \* 2\)/);
  assert.match(styles, /touch-action:\s*none;/);
  assert.match(source, /_activePointers = new Map/);
  assert.match(source, /_startPinchGesture/);
  assert.match(source, /_applyPinchGesture/);
  assert.match(source, /this\.zoom = nextZoom/);
  assert.match(source, /this\._targetZoom = nextZoom/);
  assert.match(source, /pointercancel/);
});

test('canvas graph wheel zoom uses deltaMode-aware half-strength scaling', async () => {
  let source = await readFile(canvasGraphSource, 'utf8');

  assert.equal(DEFAULT_WHEEL_ZOOM_SENSITIVITY, 0.5);
  assert.match(source, /resolveWheelZoomFactor\(e\)/);
  assert.doesNotMatch(source, /e\.deltaY > 0 \? 0\.92 : 1\.08/);
  assert.match(source, /const MAX_ZOOM_OUT_FIT_MULTIPLIER = 4;/);
  assert.match(source, /_resolveMinZoom\(rect[\s\S]*this\._resolveGraphFitZoom\(rect\) \/ MAX_ZOOM_OUT_FIT_MULTIPLIER/);
  assert.match(source, /_clampZoom\(this\._targetZoom \* factor,\s*rect\)/);
  assert.match(source, /_clampZoom\(this\._pinchGesture\.zoom \* \(distance \/ this\._pinchGesture\.distance\),\s*rect\)/);
  assert.doesNotMatch(source, /this\._targetZoom = Math\.max\(0\.02,\s*Math\.min\(5,\s*this\._targetZoom \* factor\)\)/);

  let pixelWheel = { deltaY: 120, deltaMode: 0, ctrlKey: false };
  let trackpadWheel = { deltaY: 10, deltaMode: 0, ctrlKey: false };
  let lineWheel = { deltaY: 3, deltaMode: 1, ctrlKey: false };
  let pageWheel = { deltaY: 1, deltaMode: 2, ctrlKey: false };

  assert.equal(resolveWheelZoomDelta(pixelWheel), -0.12);
  assert.ok(Math.abs(resolveWheelZoomDelta(lineWheel) + 0.075) < Number.EPSILON);
  assert.equal(resolveWheelZoomDelta(pageWheel), -0.5);
  assert.equal(resolveWheelZoomDelta(pixelWheel, 1), resolveWheelZoomDelta(pixelWheel) * 2);
  assert.ok(resolveWheelZoomFactor(trackpadWheel) > 0.99);
  assert.ok(resolveWheelZoomFactor(pixelWheel) < 0.93);
});

test('layout minimum size estimate follows split direction and node behavior', () => {
  let graph = createPanel('graph', {}, { minInlineSize: 420, minBlockSize: 260 });
  let chat = createPanel('chat', {}, { minInlineSize: 320, minBlockSize: 280 });
  let inspector = createPanel('inspector', {}, { minInlineSize: 280, minBlockSize: 360 });
  let right = createSplit('vertical', chat, inspector, 0.5);
  let root = createSplit('horizontal', graph, right, 0.55);

  let size = resolveLayoutMinSize(root);

  assert.equal(Math.round(size.inlineSize), 764);
  assert.equal(size.blockSize, 720);

  chat.collapsed = true;
  let collapsedSize = resolveLayoutMinSize(root);

  assert.equal(Math.round(collapsedSize.inlineSize), 764);
  assert.equal(collapsedSize.blockSize, 720);
});

test('layout minimum size estimate respects split ratios', () => {
  let primary = createPanel('primary', {}, { minInlineSize: 520, minBlockSize: 240 });
  let side = createPanel('side', {}, { minInlineSize: 300, minBlockSize: 220 });
  let root = createSplit('horizontal', primary, side, 0.68);
  let size = resolveLayoutMinSize(root);

  assert.equal(Math.round(size.inlineSize), 938);
  assert.equal(size.blockSize, 240);

  let top = createPanel('top', {}, { minInlineSize: 260, minBlockSize: 280 });
  let bottom = createPanel('bottom', {}, { minInlineSize: 280, minBlockSize: 360 });
  let vertical = createSplit('vertical', top, bottom, 0.44);
  let verticalSize = resolveLayoutMinSize(vertical);

  assert.equal(verticalSize.inlineSize, 280);
  assert.equal(Math.round(verticalSize.blockSize), 643);
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
  assert.equal(closed.closed, true);
  assert.equal(closed.removed, false);
  assert.equal(findPanelByType(closed.root, 'theme').collapsed, true);
  assert.equal(findPanelByType(closed.root, 'theme').panelState.closed, true);
  assert.equal(findPanelByType(closed.root, 'graph').panelType, 'graph');

  let reopened = openPanel(closed.root, 'theme', {
    source: 'theme-widget',
    uiInvoked: true,
  });
  assert.equal(reopened.created, false);
  assert.equal(reopened.panel.id, opened.panel.id);
  assert.equal(reopened.panel.collapsed, false);
  assert.equal(reopened.panel.panelState.closed, false);
});

test('global panel helper preserves panel and split behavior contracts', () => {
  let createLayout = withGlobalPanel(
    () => createPanel('main', {}, { importance: 60, minInlineSize: 320 }),
    'agent-chat',
    {
      behavior: { importance: 95, collapse: 'manual', minInlineSize: 360 },
      splitBehavior: { overflow: 'scroll-inline', responsiveMode: 'scroll-inline' },
      panelState: { source: 'global-chat', removable: true },
      ratio: 0.72,
    },
  );

  let root = createLayout();
  assert.equal(root.type, 'split');
  assert.equal(root.ratio, 0.72);
  assert.equal(root.behavior.overflow, 'scroll-inline');
  assert.equal(root.second.panelType, 'agent-chat');
  assert.equal(root.second.panelState.source, 'global-chat');
  assert.equal(root.second.panelState.removable, true);
  assert.equal(getNodeBehavior(root.second).importance, 95);
  assert.equal(getNodeBehavior(root.second).collapse, 'manual');
  assert.equal(getNodeBehavior(root.second).minInlineSize, 360);
});

test('layout tree removeUiPanel restores captured host layout for the last temporary panel', () => {
  let graph = createPanel('graph');
  let ui = createPanel('ui');
  let chat = createPanel('chat');
  let hostRoot = createSplit(
    'horizontal',
    graph,
    createSplit('vertical', ui, chat, 0.48),
    0.58
  );
  let opened = openPanel(hostRoot, 'theme', {
    source: 'theme-widget',
    uiInvoked: true,
    ratio: 0.66,
  });

  let removed = removeUiPanel(opened.root, 'theme', { fallbackRoot: hostRoot });

  assert.equal(removed.removed, true);
  assert.equal(removed.restored, true);
  assert.equal(removed.root.id, hostRoot.id);
  assert.equal(removed.root.ratio, 0.58);
  assert.equal(removed.root.second.ratio, 0.48);
  assert.equal(findPanelByType(removed.root, 'theme'), null);
});

test('layout tree expands promoted survivor after panel removal', () => {
  let graph = createPanel('graph');
  let chat = createPanel('chat');
  let inspector = createPanel('inspector');
  let root = createSplit(
    'horizontal',
    createSplit('vertical', graph, chat, 0.55),
    inspector,
    0.64
  );

  inspector.collapsed = true;
  inspector.autoCollapsed = true;

  let promotedPanel = joinPanels(root, root.first.id);

  assert.equal(promotedPanel.id, inspector.id);
  assert.equal(promotedPanel.collapsed, false);
  assert.equal(promotedPanel.autoCollapsed, false);

  let canvas = createPanel('canvas');
  let toolbar = createPanel('toolbar');
  let status = createPanel('status');
  let branch = createSplit('vertical', toolbar, status, 0.5);
  let nested = createSplit('horizontal', canvas, branch, 0.7);

  toolbar.collapsed = true;
  toolbar.autoCollapsed = true;
  status.collapsed = true;

  let promotedBranch = joinPanels(nested, canvas.id);

  assert.equal(promotedBranch.id, branch.id);
  assert.equal(toolbar.collapsed, false);
  assert.equal(toolbar.autoCollapsed, false);
  assert.equal(status.collapsed, true);
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
  assert.equal(result.closed, false);
  assert.equal(findPanelByType(result.root, 'theme').panelState.source, 'host-layout');
});

test('layout tree removeUiPanel can restore host layout when temporary panel is root', () => {
  let hostRoot = createSplit(
    'horizontal',
    createPanel('graph'),
    createPanel('chat'),
    0.58
  );
  let temporaryRoot = createPanel('theme', {
    source: 'theme-widget',
    uiInvoked: true,
  });

  let result = removeUiPanel(temporaryRoot, 'theme', { fallbackRoot: hostRoot });

  assert.equal(result.removed, true);
  assert.equal(result.restored, true);
  assert.equal(result.root.type, 'split');
  assert.equal(result.root.ratio, 0.58);
  assert.equal(findPanelByType(result.root, 'graph').panelType, 'graph');
  assert.equal(findPanelByType(result.root, 'chat').panelType, 'chat');
  assert.equal(findPanelByType(result.root, 'theme'), null);
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
  assert.equal(closed.closed, true);
  assert.equal(closed.removed, false);
  assert.equal(findPanelByType(closed.root, 'theme', { uiInvoked: false }).panelState.source, 'host-layout');
  assert.equal(findPanelByType(closed.root, 'theme', { uiInvoked: true }).panelState.closed, true);

  let removed = removeUiPanel(closed.root, 'theme');
  assert.equal(removed.removed, true);
  assert.equal(findPanelByType(removed.root, 'theme').panelState.source, 'host-layout');
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

test('panel layout drawer handle pointer gesture opens and closes drawer panels', async () => {
  let { parseHTML } = await import('linkedom');
  let { window } = parseHTML('<!doctype html><html><body></body></html>');
  let TestCSSStyleSheet = class {
    replaceSync(text) { this.cssText = text; }
  };
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

  // Mock getPropertyPriority for linkedom's style object
  const div = window.document.createElement('div');
  const StyleProto = Object.getPrototypeOf(div.style);
  StyleProto.getPropertyPriority = StyleProto.getPropertyPriority || (() => '');

  // Import Layout
  await import('../layout/Layout/Layout.js');
  await import('../layout/LayoutNode/LayoutNode.js');

  const layout = document.createElement('panel-layout');
  document.body.append(layout);

  layout.getBoundingClientRect = () => ({
    width: 300,
    height: 600,
    top: 0,
    left: 0,
    bottom: 600,
    right: 300,
  });

  layout.$.layoutBehavior = {
    responsiveMode: 'drawer',
    responsiveBreakpoint: 720,
  };

  layout.registerPanelType('materials', { title: 'Materials', icon: 'folder', behavior: { minInlineSize: 320, minBlockSize: 240, responsiveMode: 'drawer' } });
  layout.registerPanelType('graph', { title: 'Graph', icon: 'hub', behavior: { minInlineSize: 640, minBlockSize: 480 } });

  layout.setLayout(createSplit(
    'horizontal',
    createPanel('graph'),
    createPanel('materials', { mobileDock: 'end' }),
    0.5
  ));

  // Trigger next layout cycle
  layout._applyResponsiveLayout();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Verify it is in drawer-mode-active
  assert.equal(layout.hasAttribute('drawer-mode-active'), true);

  // Find the end drawer handle (stack-end)
  const stackEnd = layout.querySelector('.layout-drawer-handle-stack-end');
  assert.ok(stackEnd);
  const handleButton = stackEnd.querySelector('.layout-drawer-handle');
  assert.ok(handleButton);

  // Start gesture by pointerdown on the handle button
  const pointerDownEvent = new Event('pointerdown');
  pointerDownEvent.pointerId = 1;
  pointerDownEvent.button = 0;
  pointerDownEvent.clientX = 290;
  pointerDownEvent.preventDefault = () => {};
  handleButton.dispatchEvent(pointerDownEvent);

  // Verify gesture is active
  assert.ok(layout._drawerGesture);
  assert.equal(layout.hasAttribute('drawer-dragging'), true);

  // Move pointer to simulate drag
  const pointerMoveEvent = new Event('pointermove');
  pointerMoveEvent.pointerId = 1;
  pointerMoveEvent.clientX = 150; // drag left to open the end drawer (dock end is at right)
  pointerMoveEvent.preventDefault = () => {};
  layout.dispatchEvent(pointerMoveEvent);

  // Verify gesture progress
  assert.ok(layout._drawerGesture.moved);
  assert.equal(layout.getAttribute('drawer-dragging'), '');

  // Release pointer to complete gesture and open
  const pointerUpEvent = new Event('pointerup');
  pointerUpEvent.pointerId = 1;
  pointerUpEvent.clientX = 100;
  pointerUpEvent.preventDefault = () => {};
  layout.dispatchEvent(pointerUpEvent);

  // Wait for sync
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));

  // The drawer should be open now
  assert.equal(layout.$.drawerEndOpen, true);
  assert.equal(layout.hasAttribute('drawer-end-open'), true);
  assert.equal(layout._drawerGesture, null);
  assert.notEqual(stackEnd.style.getPropertyValue('inset-inline-end'), '0px');

  const closePointerDownEvent = new Event('pointerdown');
  closePointerDownEvent.pointerId = 2;
  closePointerDownEvent.button = 0;
  closePointerDownEvent.clientX = 100;
  closePointerDownEvent.preventDefault = () => {};
  handleButton.dispatchEvent(closePointerDownEvent);

  assert.ok(layout._drawerGesture);
  assert.equal(layout._drawerGesture.startOpen, true);

  const closePointerMoveEvent = new Event('pointermove');
  closePointerMoveEvent.pointerId = 2;
  closePointerMoveEvent.clientX = 260;
  closePointerMoveEvent.preventDefault = () => {};
  layout.dispatchEvent(closePointerMoveEvent);

  assert.ok(layout._drawerGesture.moved);

  const closePointerUpEvent = new Event('pointerup');
  closePointerUpEvent.pointerId = 2;
  closePointerUpEvent.clientX = 280;
  closePointerUpEvent.preventDefault = () => {};
  layout.dispatchEvent(closePointerUpEvent);

  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(layout.$.drawerEndOpen, false);
  assert.equal(layout.hasAttribute('drawer-end-open'), false);
  assert.equal(layout._drawerGesture, null);
  assert.equal(stackEnd.style.getPropertyValue('inset-inline-end'), '0px');

  // Clean up
  layout.remove();
});
