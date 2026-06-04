import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const scrollbarSource = new URL('../themes/scrollbar-styles.js', import.meta.url);
const cascadeThemeSource = new URL('../themes/cascade-theme.js', import.meta.url);
const defaultProviderThemeSource = new URL('../themes/default-provider.js', import.meta.url);
const cascadeThemeEditorSource = new URL('../themes/CascadeThemeEditor/CascadeThemeEditor.js', import.meta.url);
const cascadeThemeWidgetSource = new URL('../themes/CascadeThemeWidget/CascadeThemeWidget.js', import.meta.url);
const cascadeDemoSource = new URL('../demo/cascade-theme-lab.js', import.meta.url);
const cascadeDemoHtml = new URL('../demo/cascade-theme-lab.html', import.meta.url);
const graphNodeStyles = new URL('../node/GraphNode/GraphNode.css.js', import.meta.url);
const nodeViewManagerSource = new URL('../canvas/NodeViewManager.js', import.meta.url);
const portItemStyles = new URL('../node/PortItem/PortItem.css.js', import.meta.url);
const ctrlItemStyles = new URL('../node/CtrlItem/CtrlItem.css.js', import.meta.url);
const nodeSocketStyles = new URL('../node/NodeSocket/NodeSocket.css.js', import.meta.url);
const nodeCanvasStyles = new URL('../canvas/NodeCanvas/NodeCanvas.css.js', import.meta.url);
const layoutStyles = new URL('../layout/Layout/Layout.css.js', import.meta.url);
const layoutSource = new URL('../layout/Layout/Layout.js', import.meta.url);
const layoutNodeSource = new URL('../layout/LayoutNode/LayoutNode.js', import.meta.url);
const layoutNodeTemplate = new URL('../layout/LayoutNode/LayoutNode.tpl.js', import.meta.url);
const layoutNodeStyles = new URL('../layout/LayoutNode/LayoutNode.css.js', import.meta.url);
const layoutShellMenuSource = new URL('../layout/LayoutShellMenu/LayoutShellMenu.js', import.meta.url);
const layoutShellMenuTemplate = new URL('../layout/LayoutShellMenu/LayoutShellMenu.tpl.js', import.meta.url);
const layoutShellMenuStyles = new URL('../layout/LayoutShellMenu/LayoutShellMenu.css.js', import.meta.url);
const layoutSidebarSource = new URL('../layout/LayoutSidebar/LayoutSidebar.js', import.meta.url);
const projectTabsSource = new URL('../layout/ProjectTabs/ProjectTabs.js', import.meta.url);
const projectTabsStyles = new URL('../layout/ProjectTabs/ProjectTabs.css.js', import.meta.url);
const panelMenuStyles = new URL('../layout/PanelMenu/PanelMenu.css.js', import.meta.url);
const treeViewStyles = new URL('../tree/TreeView/TreeView.css.js', import.meta.url);
const codeBlockStyles = new URL('../display/CodeBlock/CodeBlock.css.js', import.meta.url);
const chatMessageItemStyles = new URL('../chat/ChatMessageItem/ChatMessageItem.css.js', import.meta.url);
const chatTranscriptStyles = new URL('../chat/ChatTranscript/ChatTranscript.css.js', import.meta.url);
const chatComposerSource = new URL('../chat/ChatComposer/ChatComposer.js', import.meta.url);
const chatComposerStyles = new URL('../chat/ChatComposer/ChatComposer.css.js', import.meta.url);
const chatListStyles = new URL('../chat/ChatList/ChatList.css.js', import.meta.url);
const chatListItemStyles = new URL('../chat/ChatListItem/ChatListItem.css.js', import.meta.url);
const chatSidebarSource = new URL('../chat/ChatSidebar/ChatSidebar.js', import.meta.url);
const chatSidebarStyles = new URL('../chat/ChatSidebar/ChatSidebar.css.js', import.meta.url);
const chatSidebarItemSource = new URL('../chat/ChatSidebarItem/ChatSidebarItem.js', import.meta.url);
const chatSidebarItemStyles = new URL('../chat/ChatSidebarItem/ChatSidebarItem.css.js', import.meta.url);
const cellBgSource = new URL('../effects/CellBg/CellBg.js', import.meta.url);
const cellBgStyles = new URL('../effects/CellBg/CellBg.css.js', import.meta.url);
const cellBgThemeSource = new URL('../effects/CellBg/cell-bg-theme.js', import.meta.url);
const uiIndexSource = new URL('../ui/index.js', import.meta.url);
const componentRegistrySource = new URL('../manifest/component-registry.js', import.meta.url);
const customElementsSource = new URL('../custom-elements.json', import.meta.url);
const componentDescriptorV2Source = new URL('../schemas/component-descriptor-v2.json', import.meta.url);

function parseRgbToken(_source, value) {
  let match = value.match(/rgba?\(([^)]+)\)/);
  assert.ok(match, `expected rgb token, got ${value}`);
  return match[1]
    .replaceAll(',', ' ')
    .split(/[ /\t]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(Number);
}

test('theme scrollbar normal state uses the normal thumb token', async () => {
  const source = await readFile(scrollbarSource, 'utf8');

  assert.match(
    source,
    /const SCROLLBAR_COLOR = 'var\(--sn-scrollbar-thumb, currentColor\) var\(--sn-scrollbar-track, transparent\)'/
  );
});

test('cascade theme lab mutates root tokens instead of applying local component themes', async () => {
  const [source, html] = await Promise.all([
    readFile(cascadeDemoSource, 'utf8'),
    readFile(cascadeDemoHtml, 'utf8'),
  ]);

  assert.match(source, /import Symbiote, \{ html \} from '@symbiotejs\/symbiote'/);
  assert.match(source, /'cascade-theme-editor'/);
  assert.match(source, /'cascade-theme-widget'/);
  assert.match(source, /'project-tabs'/);
  assert.match(source, /component: 'cascade-theme-editor'/);
  assert.match(source, /'storage-key': 'symbiote-ui:cascade-theme-lab'/);
  assert.match(source, /class CascadeGraphPanel extends Symbiote/);
  assert.match(source, /class CascadeUiPanel extends Symbiote/);
  assert.match(source, /class CascadeChatPanel extends Symbiote/);
  assert.match(source, /applyTheme\(document\.documentElement, DEFAULT_PROVIDER_THEME\)/);
  assert.match(source, /--sn-theme-outline-strength/);
  assert.match(source, /--sn-theme-type-scale/);
  assert.match(source, /--sn-theme-heading-scale/);
  assert.match(source, /--sn-shape-stroke/);
  assert.match(source, /--sn-shape-stroke-width/);
  assert.match(source, /--sn-node-label-size/);
  assert.match(source, /--sn-type-source/);
  assert.match(source, /--sn-type-action/);
  assert.match(source, /--sn-cat-control/);
  assert.match(source, /--sn-cat-data/);
  assert.match(source, /--sn-tab-accent-1/);
  assert.match(source, /--sn-markdown-h1-size/);
  assert.match(source, /--sn-chat-markdown-h1-size/);
  assert.match(source, /--sn-chat-user-message-bg/);
  assert.match(source, /--sn-composer-bg/);
  assert.match(source, /--sn-chat-list-header-padding/);
  assert.match(source, /--sn-chat-list-item-padding/);
  assert.match(source, /--sn-chat-sidebar-header-padding/);
  assert.match(source, /--sn-chat-sidebar-row-padding/);
  assert.match(source, /--sn-syntax-keyword/);
  assert.match(source, /--sn-cell-dot/);
  assert.match(source, /--sn-cell-noise/);
  assert.match(source, /--sn-node-icon-size/);
  assert.match(source, /--sn-node-pill-body-padding/);
  assert.match(source, /--sn-node-circle-body-padding/);
  assert.match(source, /--sn-node-comment-body-padding/);
  assert.match(source, /--sn-port-label-size/);
  assert.match(source, /--sn-layout-header-icon-size/);
  assert.match(source, /'chat-transcript'/);
  assert.match(source, /'chat-composer'/);
  assert.match(source, /'cell-bg'/);
  assert.match(source, /component: 'cascade-chat-panel'/);
  assert.match(source, /setMessageItems\(/);
  assert.match(source, /setContent\(/);
  assert.match(source, /setVoiceControls\(/);
  assert.match(source, /menuActions/);
  assert.match(source, /path:pcb/);
  assert.match(source, /panel-menu-actions/);
  assert.match(source, /setLayoutBehavior/);
  assert.match(source, /responsiveMode: 'stack'/);
  assert.match(source, /importance: 95/);
  assert.match(source, /const layoutGroups = \[/);
  assert.match(source, /const layoutFactories = new Map/);
  assert.match(source, /createGraphLayout/);
  assert.doesNotMatch(source, /createLayout:/);
  assert.match(source, /setGroups\?\.\(layoutGroups, activeLayoutGroupId\)/);
  assert.match(source, /layout-group-change/);
  assert.doesNotMatch(source, /project-tabs-select/);
  assert.match(source, /'layout-shell-menu'/);
  assert.doesNotMatch(source, /setShellTabs/);
  assert.match(source, /cascade-theme-open-full/);
  assert.match(source, /createThemeLayout/);
  assert.match(source, /FORCED_SCROLL_INLINE_SIZE/);
  assert.match(source, /100% \+ var\(--sn-layout-scroll-inline-extra/);
  assert.match(source, /data-layout-command/);
  assert.match(source, /voice command/);
  assert.match(html, /layout module/);
  assert.match(html, /<layout-shell-menu/);
  assert.match(html, /<cascade-theme-widget/);
  assert.match(html, /class="lab-shell"/);
  assert.match(html, /100dvh/);
  assert.doesNotMatch(html, /100vh/);
  assert.doesNotMatch(html, /--sn-tabs-bg/);
  assert.match(html, /project-path="symbiote-ui \/ layout module"/);
  assert.match(html, /<layout-sidebar id="lab-sidebar" slot="sidebar"/);
  assert.match(html, /slot="actions" type="button" data-layout-command="reset"/);
  assert.match(html, /slot="actions" type="button" data-layout-command="scroll"/);
  assert.doesNotMatch(source, /sidebarSections/);
  assert.doesNotMatch(source, /sidebar\.setSections/);
  assert.match(source, /sidebar\.\$\.collapsed = true/);
  assert.doesNotMatch(source, /sidebar\.setActiveSection/);
  assert.match(source, /Agent Chat/);
  assert.match(source, /Live Monitor/);
  assert.match(source, /disabled: true/);
  assert.doesNotMatch(html, /class="lab-toolbar"/);
  assert.doesNotMatch(html, /lab-main-menu/);
  assert.doesNotMatch(html, /<project-tabs/);
  assert.doesNotMatch(html, /menu-open/);
  assert.doesNotMatch(html, /slot="menu-actions"/);
  assert.doesNotMatch(html, /data-layout-group=/);
  assert.doesNotMatch(source, /extends HTMLElement/);
  assert.doesNotMatch(source, /\.setTheme\(/);
  assert.doesNotMatch(source, /10 \+ brightness \* 0\.18/);
  assert.doesNotMatch(source, /setToken\(/);
  assert.doesNotMatch(source, /querySelector\('\[data-control/);
  assert.doesNotMatch(html, /data-control=/);
});

test('layout shell menu mirrors the Agent Portal topbar, tabs, sidebar, and workspace shell', async () => {
  const [source, template, styles] = await Promise.all([
    readFile(layoutShellMenuSource, 'utf8'),
    readFile(layoutShellMenuTemplate, 'utf8'),
    readFile(layoutShellMenuStyles, 'utf8'),
  ]);

  assert.match(source, /setTabs\(tabs = \[\], activeId = this\.\$\.activeId\)/);
  assert.match(template, /class="app-topbar"/);
  assert.match(template, /class="shell-tabs-row"/);
  assert.match(template, /<project-tabs class="shell-tabs"/);
  assert.match(template, /slot name="sidebar"/);
  assert.match(template, /class="app-workspace-content"/);
  assert.match(styles, /background-image: linear-gradient\(to bottom, var\(--sn-node-bg/);
  assert.match(styles, /background-size: 100% var\(--sn-shell-top-gradient-size, 78px\)/);
  assert.match(styles, /height: var\(--sn-app-topbar-height, 40px\)/);
  assert.match(styles, /\.shell-tabs-row/);
  assert.match(styles, /\.shell-tabs-row \{[\s\S]*?background: transparent;/);
  assert.match(styles, /--sn-tabs-bg: var\(--sn-shell-tabs-bg, transparent\)/);
  assert.match(styles, /::slotted\(\[slot='sidebar'\]\)/);
  assert.match(styles, /letter-spacing: var\(--sn-app-title-letter-spacing, 0\.5px\)/);
  assert.doesNotMatch(source, /sideMenuItems/);
  assert.doesNotMatch(source, /layout-shell-menu-item/);
  assert.doesNotMatch(template, /shell-menu-drawer/);
  assert.doesNotMatch(template, /slot name="menu-actions"/);
});

test('cascade theme is a reusable library contract with WebMCP metadata', async () => {
  const source = await readFile(cascadeThemeSource, 'utf8');
  const themeModule = await import(cascadeThemeSource.href);
  const theme = themeModule.createCascadeTheme({
    mode: 'dark',
    brightness: 0,
    contrast: 58,
    chroma: 89,
    hue: 218,
    outline: 38,
    type: 100,
    density: 100,
  });
  const noOutlineTheme = themeModule.createCascadeTheme({ outline: 0 });
  const fullOutlineTheme = themeModule.createCascadeTheme({ outline: 100 });
  const balancedHeadingTheme = themeModule.createCascadeTheme({ type: 100, heading: 120 });

  assert.equal(theme.name, 'cascade-theme');
  assert.equal(theme.state.mode, 'dark');
  assert.equal(theme.tokens['--sn-theme-name'], 'cascade-theme');
  assert.equal(theme.tokens['--sn-theme-bg-lightness'], '10.0%');
  assert.equal(theme.tokens['--sn-theme-text-lightness'], '94.0%');
  assert.equal(theme.tokens['--sn-theme-heading-scale'], '1.00');
  assert.equal(balancedHeadingTheme.tokens['--sn-theme-heading-scale'], '1.20');
  assert.equal(theme.descriptor.controls.find((control) => control.name === 'brightness')?.icon, 'brightness_6');
  assert.equal(theme.descriptor.controls.find((control) => control.name === 'heading')?.icon, 'title');
  assert.equal(theme.tokens['--sn-bg'], 'hsl(0 0% 10.0%)');
  assert.equal(theme.tokens['--sn-text'], 'hsl(0 0% 94.0%)');
  assert.equal(theme.tokens['--sn-node-bg'], 'var(--sn-panel-bg)');
  assert.equal(theme.tokens['--sn-field-control-bg'], 'var(--sn-bg)');
  assert.equal(theme.tokens['--sn-chat-user-message-bg'], 'color-mix(in srgb, var(--sn-panel-bg) 88%, var(--sn-node-selected) 12%)');
  assert.equal(theme.tokens['--sn-composer-bg'], 'color-mix(in srgb, var(--sn-panel-bg) 90%, var(--sn-text) 4%)');
  assert.equal(theme.tokens['--sn-cell-dot'], 'hsl(0 0% 60.0%)');
  assert.equal(theme.tokens['--sn-hue-accent'], '218');
  assert.equal(theme.tokens['--sn-hue-warning'], '36');
  assert.equal(theme.tokens['--sn-hue-data'], '188');
  assert.equal(theme.tokens['--sn-hue-danger'], '4');
  assert.equal(theme.tokens['--sn-cat-control'], 'hsl(36 89% 58%)');
  assert.equal(theme.tokens['--sn-cat-data'], 'hsl(188 89% 42.0%)');
  assert.equal(theme.tokens['--sn-type-action'], 'hsl(4 89% 78.0%)');
  assert.equal(theme.tokens['--sn-type-data'], 'hsl(218 89% 74.0%)');
  assert.equal(theme.tokens['--sn-type-source'], 'var(--sn-cat-server)');
  assert.equal(theme.tokens['--sn-type-canvas'], 'var(--sn-cat-module)');
  assert.equal(theme.tokens['--sn-type-layout'], 'var(--sn-cat-data)');
  assert.equal(theme.tokens['--sn-type-controls'], 'var(--sn-cat-control)');
  assert.equal(theme.tokens['--sn-graph-type-action'], 'var(--sn-type-action)');
  assert.equal(theme.tokens['--sn-graph-type-data'], 'var(--sn-type-data)');
  assert.equal(theme.tokens['--sn-tab-accent-0'], 'var(--sn-cat-server)');
  assert.equal(theme.tokens['--sn-tab-accent-1'], 'var(--sn-cat-data)');
  assert.equal(theme.tokens['--sn-tab-accent-2'], 'var(--sn-cat-control)');
  assert.equal(theme.tokens['--sn-tab-accent-4'], 'var(--sn-type-action)');
  assert.equal(theme.tokens['--sn-button-primary-bg'], 'var(--sn-node-selected)');
  assert.equal(theme.tokens['--sn-button-primary-color'], 'hsl(0 0% 8.0%)');
  assert.equal(theme.tokens['--sn-button-success-color'], 'hsl(0 0% 8.0%)');
  assert.equal(theme.tokens['--sn-button-danger-hover-color'], 'hsl(0 0% 8.0%)');
  assert.equal(theme.tokens['--sn-shape-stroke-width'], '0.40');
  assert.equal(theme.tokens['--sn-shape-port-hint-stroke-width'], '0.50');
  assert.equal(noOutlineTheme.tokens['--sn-shape-stroke-width'], '0.00');
  assert.equal(noOutlineTheme.tokens['--sn-shape-port-hint-stroke-width'], '0.00');
  assert.equal(fullOutlineTheme.tokens['--sn-shape-stroke-width'], '1.05');
  assert.equal(fullOutlineTheme.tokens['--sn-shape-port-hint-stroke-width'], '1.32');
  assert.equal(theme.tokens['--sn-node-label-size'], 'calc(13px * var(--sn-theme-type-scale) * var(--sn-theme-heading-scale))');
  assert.equal(theme.tokens['--sn-markdown-h1-size'], 'calc(24px * var(--sn-theme-type-scale) * var(--sn-theme-heading-scale))');
  assert.equal(theme.tokens['--sn-chat-markdown-h2-size'], 'calc(18px * var(--sn-theme-type-scale) * var(--sn-theme-heading-scale))');
  assert.equal(theme.tokens['--sn-chat-message-font-size'], 'calc(13px * var(--sn-theme-type-scale))');
  assert.equal(theme.tokens['--sn-composer-input-size'], 'calc(13px * var(--sn-theme-type-scale))');
  assert.equal(theme.tokens['--sn-composer-input-min-inline-size'], 'calc(160px * var(--sn-theme-density))');
  assert.equal(theme.tokens['--sn-code-font-size'], 'calc(12px * var(--sn-theme-type-scale))');
  assert.equal(theme.tokens['--sn-composer-send-size'], 'calc(32px * var(--sn-theme-density))');
  assert.equal(theme.tokens['--sn-cell-size'], 'calc(14px * var(--sn-theme-density))');
  assert.match(source, /CASCADE_THEME_DESCRIPTOR/);
  assert.match(source, /svgStrokeToken/);
  assert.match(source, /headingToken/);
  assert.match(source, /hueRotate/);
  assert.match(source, /readableTextForHsl/);
  assert.match(source, /symbiote-ui\.createCascadeTheme/);
  assert.match(source, /theme:compose/);
  assert.match(source, /--sn-shape-stroke/);
  assert.match(source, /--sn-bg/);
  assert.match(source, /--sn-text-dim/);
  assert.match(source, /--sn-field-control-bg/);
  assert.match(source, /--sn-chat-user-message-bg/);
  assert.match(source, /--sn-composer-bg/);
  assert.match(source, /--sn-syntax-keyword/);
  assert.match(source, /--sn-cell-dot/);
  assert.match(source, /--sn-cell-size/);
  assert.match(source, /--sn-chat-message-font-size/);
  assert.match(source, /--sn-composer-input-size/);
  assert.match(source, /--sn-code-font-size/);
  assert.match(source, /--sn-layout-header-icon-size/);
  assert.match(source, /--sn-layout-menu-action-size/);
  assert.match(source, /--sn-layout-overflow-inline-size/);
  assert.match(source, /--sn-layout-scroll-inline-extra/);
  assert.match(source, /--sn-layout-responsive-panel-min-block-size/);
  assert.match(source, /--sn-node-summary-size/);
  assert.match(source, /--sn-node-pill-body-padding/);
  assert.match(source, /--sn-node-circle-body-padding/);
  assert.match(source, /--sn-control-input-size/);
  assert.match(source, /--sn-panel-menu-icon-size/);
  assert.match(source, /--sn-shape-icon-size/);
});

test('applyCascadeTheme notifies subtree targets by default', async () => {
  const themeModule = await import(cascadeThemeSource.href);
  const NativeCustomEvent = globalThis.CustomEvent;
  const events = [];
  const styles = new Map();
  const target = new EventTarget();
  target.style = {
    setProperty(name, value) {
      styles.set(name, value);
    },
  };
  target.addEventListener('cascade-theme-change', (event) => events.push(event));

  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, init = {}) {
      super(type, init);
      this.detail = init.detail;
    }
  };
  try {
    const theme = themeModule.applyCascadeTheme(target, { mode: 'light' }, {
      source: 'unit-test',
      targetSelector: '#panel',
    });
    themeModule.applyCascadeTheme(target, { mode: 'dark' }, { notify: false });

    assert.equal(styles.get('--sn-bg'), 'hsl(0 0% 10.0%)');
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'cascade-theme-change');
    assert.equal(events[0].bubbles, true);
    assert.equal(events[0].composed, true);
    assert.equal(events[0].detail.source, 'unit-test');
    assert.equal(events[0].detail.targetSelector, '#panel');
    assert.equal(events[0].detail.theme.name, 'cascade-theme');
    assert.equal(events[0].detail.state.mode, 'light');
    assert.equal(theme.state.mode, 'light');
  } finally {
    if (NativeCustomEvent) {
      globalThis.CustomEvent = NativeCustomEvent;
    } else {
      delete globalThis.CustomEvent;
    }
  }
});

test('node type color tokens are canonical across themes and graph aliases', async () => {
  const [cascadeSource, defaultProviderTheme] = await Promise.all([
    readFile(cascadeThemeSource, 'utf8'),
    import(defaultProviderThemeSource.href),
  ]);
  const themeModule = await import(cascadeThemeSource.href);
  const theme = themeModule.createCascadeTheme();

  assert.match(cascadeSource, /'--sn-type-action': typeAction/);
  assert.match(cascadeSource, /'--sn-graph-type-action': 'var\(--sn-type-action\)'/);
  assert.match(cascadeSource, /'--sn-type-source': 'var\(--sn-cat-server\)'/);
  assert.equal(theme.tokens['--sn-type-output'].startsWith('hsl('), true);
  assert.equal(theme.tokens['--sn-type-config'].startsWith('hsl('), true);
  assert.equal(theme.tokens['--sn-graph-type-output'], 'var(--sn-type-output)');
  assert.equal(defaultProviderTheme.DEFAULT_PROVIDER_THEME.tokens['--sn-graph-type-action'], 'var(--sn-type-action)');
  assert.equal(defaultProviderTheme.DEFAULT_PROVIDER_THEME.tokens['--sn-type-action'], 'hsl(var(--sn-hue-danger) var(--sn-sat-vivid) 78%)');
  assert.equal(defaultProviderTheme.DEFAULT_PROVIDER_THEME.tokens['--sn-type-source'], 'var(--sn-cat-server)');
});

test('svg shape nodes keep visual icons without internal labels or watermarks', async () => {
  const [graphNode, nodeViewManager] = await Promise.all([
    readFile(graphNodeStyles, 'utf8'),
    readFile(nodeViewManagerSource, 'utf8'),
  ]);

  assert.match(graphNode, /& \.sn-node-header,\n      & \.sn-node-body \{\n        display: none;/);
  assert.match(graphNode, /& \.sn-node-shape-icon \{/);
  assert.match(graphNode, /font-size: var\(--sn-shape-icon-size, 40px\)/);
  assert.match(graphNode, /& \.sn-node-shape-icon \{\n          display: none;/);
  assert.doesNotMatch(graphNode, /sn-shape-watermark/);
  assert.doesNotMatch(graphNode, /--sn-shape-watermark-size/);
  assert.match(nodeViewManager, /sn-node-shape-icon material-symbols-outlined/);
  assert.doesNotMatch(nodeViewManager, /sn-shape-watermark/);
  assert.doesNotMatch(nodeViewManager, /ensureMaterialSymbols\(\[iconEl\.textContent\]\)/);
});

test('cascade theme editor is a reusable browser module', async () => {
  const [editor, widget, widgetStyles, styles, uiIndex, registry, customElements, layoutNode] = await Promise.all([
    readFile(cascadeThemeEditorSource, 'utf8'),
    readFile(cascadeThemeWidgetSource, 'utf8'),
    readFile(new URL('../themes/CascadeThemeWidget/CascadeThemeWidget.css.js', import.meta.url), 'utf8'),
    readFile(new URL('../themes/CascadeThemeEditor/CascadeThemeEditor.css.js', import.meta.url), 'utf8'),
    readFile(uiIndexSource, 'utf8'),
    readFile(componentRegistrySource, 'utf8'),
    readFile(customElementsSource, 'utf8'),
    readFile(layoutNodeSource, 'utf8'),
  ]);

  assert.match(editor, /class CascadeThemeEditor extends Symbiote/);
  assert.match(editor, /applyCascadeTheme\(this\.\#resolveTarget\(\), this\.\#state, \{ notify: false \}\)/);
  assert.match(editor, /CASCADE_THEME_DEFAULTS/);
  assert.match(editor, /getCascadeThemeControls\(\)/);
  assert.match(editor, /CONTROL_ICONS/);
  assert.match(editor, /control\.icon/);
  assert.match(editor, /cte-control-icon material-symbols-outlined/);
  assert.match(editor, /getStorage\(\)/);
  assert.match(editor, /storage\.setItem\(this\.storageKey/);
  assert.match(editor, /copyParameters\(\)/);
  assert.match(editor, /reset\(\)/);
  assert.match(editor, /#syncRangeProgress/);
  assert.match(editor, /--cte-range-progress/);
  assert.match(editor, /new CustomEvent\('cascade-theme-change'/);
  assert.match(editor, /CascadeThemeEditor\.reg\('cascade-theme-editor'\)/);
  assert.match(widget, /class CascadeThemeWidget extends Symbiote/);
  assert.match(widget, /COMPACT_CONTROLS = \['brightness', 'contrast', 'chroma', 'hue'\]/);
  assert.match(widget, /applyCascadeTheme\(this\.\#resolveTarget\(\), this\.\#state, \{ notify: false \}\)/);
  assert.match(widget, /cascade-theme-open-full/);
  assert.match(widget, /CascadeThemeWidget\.reg\('cascade-theme-widget'\)/);
  assert.match(widgetStyles, /cascade-theme-widget/);
  assert.match(widgetStyles, /--sn-theme-widget-width/);
  assert.match(styles, /cascade-theme-editor/);
  assert.match(styles, /--sn-scrollbar-thumb/);
  assert.match(styles, /input\[type="range"\]/);
  assert.match(styles, /appearance: none/);
  assert.match(styles, /--sn-theme-outline-strength/);
  assert.match(styles, /cte-control-icon/);
  assert.match(styles, /--sn-theme-editor-control-icon-size/);
  assert.match(styles, /::-webkit-slider-thumb/);
  assert.match(styles, /::-moz-range-thumb/);
  assert.match(uiIndex, /CascadeThemeEditor/);
  assert.match(uiIndex, /CascadeThemeWidget/);
  assert.match(uiIndex, /themes\/CascadeThemeEditor\/CascadeThemeEditor\.js/);
  assert.match(uiIndex, /themes\/CascadeThemeWidget\/CascadeThemeWidget\.js/);
  assert.match(registry, /tagName: 'cascade-theme-editor'/);
  assert.match(registry, /tagName: 'cascade-theme-widget'/);
  assert.match(registry, /componentDescription/);
  assert.match(registry, /WEBMCP_SUPPORT_REFERENCE/);
  assert.match(registry, /cascade_theme_editor_apply/);
  assert.match(registry, /cascade_theme_widget_open_full/);
  assert.match(registry, /cascade_theme_widget_apply_quick/);
  assert.match(customElements, /"tagName": "cascade-theme-editor"/);
  assert.match(customElements, /"tagName": "cascade-theme-widget"/);
  assert.match(customElements, /"componentDescription"/);
  assert.match(layoutNode, /_applyPanelComponentConfig/);
  assert.match(layoutNode, /config\.attributes/);
  assert.match(layoutNode, /config\.properties/);
});

test('component descriptor v2 includes agent-facing WebMCP context', async () => {
  const schema = await readFile(componentDescriptorV2Source, 'utf8');

  assert.match(schema, /"componentDescription"/);
  assert.match(schema, /"agentContext"/);
  assert.match(schema, /"webMcpAgentContext"/);
  assert.match(schema, /"globalToolMode"/);
});

test('static custom elements catalog mirrors agent-facing WebMCP metadata', async () => {
  const [customElements, registry] = await Promise.all([
    readFile(customElementsSource, 'utf8').then((source) => JSON.parse(source)),
    import(componentRegistrySource.href),
  ]);
  const declarations = new Map(
    customElements.modules
      .flatMap((module) => module.declarations || [])
      .filter((declaration) => declaration.tagName)
      .map((declaration) => [declaration.tagName, declaration])
  );

  for (let component of registry.listComponents()) {
    let declaration = declarations.get(component.tagName);
    assert.ok(declaration, `missing static declaration for ${component.tagName}`);
    assert.equal(declaration.componentDescription, component.componentDescription);
    assert.deepEqual(declaration.agent, component.agent);
    assert.equal(declaration.agent.webmcp.globalToolMode.includes('Do not enable global Symbiote.mcpToolMode'), true);
    assert.equal(declaration.agent.webmcp.references.includes(registry.WEBMCP_SUPPORT_REFERENCE), true);
    assert.equal(declaration.agent.webmcp.references.includes(registry.WEBMCP_FEATURE_REFERENCE), true);
  }
});

test('cascade theme derives distinct dark and light branches', async () => {
  const themeModule = await import(cascadeThemeSource.href);
  const darkTheme = themeModule.createCascadeTheme({ mode: 'dark' });
  const lightTheme = themeModule.createCascadeTheme({ mode: 'light' });

  assert.equal(darkTheme.state.mode, 'dark');
  assert.equal(lightTheme.state.mode, 'light');
  assert.equal(darkTheme.tokens['--sn-bg'], 'hsl(0 0% 10.0%)');
  assert.equal(lightTheme.tokens['--sn-bg'], 'hsl(0 0% 98.0%)');
  assert.equal(darkTheme.tokens['--sn-text'], 'hsl(0 0% 94.0%)');
  assert.equal(lightTheme.tokens['--sn-text'], 'hsl(0 0% 18.9%)');
  assert.equal(darkTheme.tokens['--sn-theme-outline-strength'], lightTheme.tokens['--sn-theme-outline-strength']);
  assert.equal(darkTheme.tokens['--sn-field-control-bg'], 'var(--sn-bg)');
  assert.equal(lightTheme.tokens['--sn-field-control-bg'], 'var(--sn-bg)');
  assert.equal(lightTheme.tokens['--sn-button-primary-color'], 'hsl(0 0% 98.0%)');
  assert.equal(lightTheme.tokens['--sn-button-success-color'], 'hsl(0 0% 18.9%)');
});

test('cell background derives runtime palette and metrics from cascade tokens', async () => {
  const [{ readCellBgTheme }, componentSource] = await Promise.all([
    import(cellBgThemeSource.href),
    readFile(cellBgSource, 'utf8'),
  ]);
  const makeReaders = (tokens, numbers = {}) => ({
    readToken: (_source, token) => tokens[token] || '',
    readNumber: (_source, token, fallback) => numbers[token] ?? fallback,
    normalizeColor: (_source, value) => value || null,
    parseRgb: parseRgbToken,
  });
  const darkTokens = {
    '--sn-cell-bg': 'rgb(0 0 0)',
    '--sn-cell-dot': 'rgb(255 255 255)',
    '--sn-cell-base-alpha': '0.10',
    '--sn-cell-alpha-span': '0.50',
  };
  const lightTokens = {
    '--sn-cell-bg': 'rgb(250 250 250)',
    '--sn-cell-dot': 'rgb(30 30 30)',
    '--sn-cell-base-alpha': '0.05',
    '--sn-cell-alpha-span': '0.40',
  };
  const metrics = {
    '--sn-cell-size': 18,
    '--sn-cell-min-radius': 3,
    '--sn-cell-max-radius': 7,
    '--sn-cell-step-ms': 60,
    '--sn-cell-fade-rate': 0.08,
  };

  const darkState = readCellBgTheme(null, makeReaders(darkTokens, metrics));
  const lightState = readCellBgTheme(null, makeReaders(lightTokens, {
    ...metrics,
    '--sn-cell-size': 22,
  }));

  assert.equal(darkState.cellSize, 18);
  assert.equal(darkState.minRadius, 3);
  assert.equal(darkState.maxRadius, 7);
  assert.equal(darkState.stepMs, 60);
  assert.equal(darkState.fadeRate, 0.08);
  assert.equal(darkState.bgFill, 'rgb(0 0 0)');
  assert.equal(darkState.palette[0], '#1a1a1a');
  assert.equal(darkState.palette.at(-1), '#999999');
  assert.equal(lightState.cellSize, 22);
  assert.equal(lightState.bgFill, 'rgb(250 250 250)');
  assert.notEqual(lightState.palette[0], darkState.palette[0]);
  assert.match(componentSource, /readCellBgTheme/);
  assert.match(componentSource, /_applyThemeState/);
});

test('cascade theme controls reach canvas objects and layout chrome', async () => {
  const [
    graphNode,
    portItem,
    ctrlItem,
    nodeSocket,
    nodeCanvas,
    layout,
    layoutSourceText,
    layoutNodeSourceText,
    layoutNode,
    layoutNodeTpl,
    layoutSidebarSourceText,
    projectTabs,
    projectTabsCss,
    panelMenu,
    treeView,
    codeBlock,
    chatMessage,
    chatTranscript,
    chatComposer,
    chatList,
    chatListItem,
    chatSidebarSourceText,
    chatSidebar,
    chatSidebarItemSourceText,
    chatSidebarItem,
    cellBgComponent,
    cellBg,
    cellBgTheme,
    registry,
    customElements,
  ] = await Promise.all([
    readFile(graphNodeStyles, 'utf8'),
    readFile(portItemStyles, 'utf8'),
    readFile(ctrlItemStyles, 'utf8'),
    readFile(nodeSocketStyles, 'utf8'),
    readFile(nodeCanvasStyles, 'utf8'),
    readFile(layoutStyles, 'utf8'),
    readFile(layoutSource, 'utf8'),
    readFile(layoutNodeSource, 'utf8'),
    readFile(layoutNodeStyles, 'utf8'),
    readFile(layoutNodeTemplate, 'utf8'),
    readFile(layoutSidebarSource, 'utf8'),
    readFile(projectTabsSource, 'utf8'),
    readFile(projectTabsStyles, 'utf8'),
    readFile(panelMenuStyles, 'utf8'),
    readFile(treeViewStyles, 'utf8'),
    readFile(codeBlockStyles, 'utf8'),
    readFile(chatMessageItemStyles, 'utf8'),
    readFile(chatTranscriptStyles, 'utf8'),
    readFile(chatComposerStyles, 'utf8'),
    readFile(chatListStyles, 'utf8'),
    readFile(chatListItemStyles, 'utf8'),
    readFile(chatSidebarSource, 'utf8'),
    readFile(chatSidebarStyles, 'utf8'),
    readFile(chatSidebarItemSource, 'utf8'),
    readFile(chatSidebarItemStyles, 'utf8'),
    readFile(cellBgSource, 'utf8'),
    readFile(cellBgStyles, 'utf8'),
    readFile(cellBgThemeSource, 'utf8'),
    readFile(componentRegistrySource, 'utf8'),
    readFile(customElementsSource, 'utf8'),
  ]);

  assert.match(graphNode, /--sn-node-label-size/);
  assert.match(graphNode, /--sn-node-summary-size/);
  assert.match(graphNode, /--sn-node-icon-size/);
  assert.match(graphNode, /--sn-shape-icon-size/);
  assert.match(graphNode, /--sn-node-pill-body-padding/);
  assert.match(graphNode, /--sn-node-circle-body-padding/);
  assert.match(graphNode, /--sn-node-comment-body-padding/);
  assert.match(graphNode, /stroke: var\(--sn-shape-stroke/);
  assert.match(graphNode, /stroke-width: var\(--sn-shape-stroke-width/);
  assert.match(graphNode, /--sn-shape-port-hint-stroke-width/);
  assert.match(portItem, /--sn-port-label-size/);
  assert.match(ctrlItem, /--sn-control-input-size/);
  assert.match(nodeSocket, /--sn-socket-hit-size/);
  assert.match(nodeCanvas, /--sn-conn-hover-width/);
  assert.match(nodeCanvas, /--sn-pseudo-conn-width/);
  assert.match(nodeCanvas, /--sn-plus-indicator-stroke-width/);
  assert.match(layout, /--sn-fullscreen-tab-icon-size/);
  assert.match(layout, /overflow-mode='scroll-inline'/);
  assert.match(layout, /responsive-active/);
  assert.match(layout, /responsive-mode='stack'/);
  assert.match(layout, /--sn-layout-responsive-panel-min-block-size/);
  assert.match(layoutSourceText, /ResizeObserver/);
  assert.match(layoutSourceText, /setLayoutBehavior/);
  assert.match(layoutSourceText, /setNodeBehavior/);
  assert.match(layoutSourceText, /autoCollapsed/);
  assert.match(layoutSourceText, /setPanelMenuActions/);
  assert.match(layoutSourceText, /duplicatePanel/);
  assert.match(layoutSourceText, /panel-close/);
  assert.match(layoutSourceText, /_onPanelClose/);
  assert.match(layoutSourceText, /#setPanelVisible\(panelNode, true\)/);
  assert.match(layoutSourceText, /layout:split-horizontal/);
  assert.match(layoutSourceText, /layout:split-vertical/);
  assert.match(layoutSourceText, /layout:duplicate/);
  assert.match(layoutSourceText, /layout:remove/);
  assert.doesNotMatch(layoutSourceText, /_getActionZonesEnabled/);
  assert.doesNotMatch(layoutSourceText, /action-zone-/);
  assert.doesNotMatch(layoutSourceText, /LayoutPreview|layout-preview/);
  assert.match(layoutNodeSourceText, /layoutCollapsePolicy/);
  assert.match(layoutNodeSourceText, /collapse-policy/);
  assert.match(layoutNodeSourceText, /setPanelMenuActions/);
  assert.match(layoutNodeSourceText, /panel-menu-actions/);
  assert.match(layoutNodeSourceText, /panel-menu-action/);
  assert.match(layoutNodeSourceText, /LAYOUT_PANEL_MENU_ACTIONS/);
  assert.match(layoutNodeSourceText, /layout:duplicate/);
  assert.match(layoutNodeSourceText, /layout:remove/);
  assert.doesNotMatch(layoutNodeSourceText, /showActionZones/);
  assert.doesNotMatch(layoutNodeSourceText, /layoutActionZones/);
  assert.match(layoutSidebarSourceText, /isDisabled: Boolean\(item\.disabled\)/);
  assert.match(layoutNode, /--sn-layout-menu-action-size/);
  assert.match(layoutNode, /--sn-layout-menu-action-height/);
  assert.match(layoutNode, /--sn-layout-menu-icon-size/);
  assert.match(layoutNodeTpl, /panel-menu-drawer/);
  assert.match(layoutNodeTpl, /panelMenuActions/);
  assert.match(layoutNodeTpl, /onPanelMenuAction/);
  assert.doesNotMatch(layoutNodeTpl, /<action-zone/);
  assert.doesNotMatch(layoutNodeTpl, /showActionZones/);
  assert.match(layoutNode, /--sn-layout-header-icon-size/);
  assert.match(layoutNode, /--sn-layout-resizer-thickness/);
  assert.match(projectTabs, /--sn-tab-accent-\$\{index % 6\}/);
  assert.match(projectTabsCss, /--tab-accent, var\(--sn-tabs-accent/);
  assert.match(projectTabsCss, /border-color: color-mix\(in srgb, var\(--tab-accent/);
  assert.match(panelMenu, /--sn-panel-menu-item-size/);
  assert.match(treeView, /--sn-tree-badge-padding/);
  assert.match(codeBlock, /--sn-markdown-h1-size/);
  assert.match(codeBlock, /--sn-markdown-h4-size/);
  assert.match(codeBlock, /--sn-code-font-size/);
  assert.match(codeBlock, /--sn-code-padding/);
  assert.match(chatMessage, /--sn-chat-markdown-h1-size/);
  assert.match(chatMessage, /--sn-chat-markdown-h4-size/);
  assert.match(chatMessage, /--sn-chat-message-font-size/);
  assert.match(chatMessage, /--sn-chat-message-padding/);
  assert.match(chatMessage, /--sn-chat-status-card-size/);
  assert.match(chatMessage, /--sn-chat-user-message-bg/);
  assert.match(chatMessage, /--sn-chat-agent-message-bg/);
  assert.match(chatMessage, /--sn-syntax-keyword/);
  assert.match(chatTranscript, /--sn-chat-bg/);
  assert.match(chatTranscript, /--sn-chat-transcript-padding/);
  assert.match(chatComposer, /--sn-composer-bg/);
  assert.match(chatComposer, /--sn-composer-send-size/);
  assert.match(chatComposer, /--sn-composer-input-size/);
  assert.match(chatComposer, /--sn-composer-input-min-inline-size/);
  assert.match(chatComposer, /--sn-composer-footer-size/);
  assert.match(chatComposer, /--sn-composer-voice-label-size/);
  assert.match(chatComposer, /--sn-composer-collapsed-control-width/);
  assert.match(chatComposer, /--sn-composer-collapsed-control-padding/);
  assert.match(chatList, /--sn-chat-list-header-padding/);
  assert.match(chatList, /--sn-chat-list-filter-button-size/);
  assert.match(chatListItem, /--sn-chat-list-item-padding/);
  assert.match(chatListItem, /--sn-chat-list-badge-size/);
  assert.match(chatListItem, /--sn-chat-list-delete-size/);
  assert.match(chatSidebarSourceText, /--sn-chat-sidebar-width/);
  assert.match(chatSidebarSourceText, /--sn-chat-sidebar-collapsed-width/);
  assert.match(chatSidebarSourceText, /_hasExplicitNavWidth/);
  assert.match(chatSidebar, /--sn-chat-sidebar-header-padding/);
  assert.match(chatSidebar, /--sn-chat-sidebar-button-icon-size/);
  assert.match(chatSidebarItemSourceText, /--sn-chat-sidebar-title-size/);
  assert.match(chatSidebarItemSourceText, /--sn-chat-sidebar-compact-label-extra/);
  assert.match(chatSidebarItem, /--sn-chat-sidebar-row-padding/);
  assert.match(chatSidebarItem, /--sn-chat-sidebar-child-padding/);
  assert.match(chatSidebarItem, /--sn-chat-sidebar-delete-box-size/);
  assert.match(chatSidebarItem, /--sn-chat-sidebar-compact-label-inset/);
  assert.match(cellBgComponent, /refreshTheme/);
  assert.match(cellBgComponent, /_scheduleThemeRefresh/);
  assert.match(cellBgComponent, /cascade-theme-change/);
  assert.match(cellBgComponent, /MutationObserver/);
  assert.match(cellBgComponent, /prefers-reduced-motion: reduce/);
  assert.match(cellBgComponent, /_prefersReducedMotion/);
  assert.match(cellBgComponent, /readCellBgTheme/);
  assert.match(cellBgTheme, /--sn-cell-size/);
  assert.match(cellBgTheme, /--sn-cell-dot/);
  assert.match(cellBg, /--sn-cell-bg/);
  assert.match(cellBg, /--sn-cell-glare/);
  assert.match(cellBg, /--sn-cell-noise/);
  assert.match(registry, /panel-menu-actions/);
  assert.match(registry, /fold-down-panel-actions/);
  assert.match(registry, /responsive-behavior/);
  assert.match(registry, /setLayoutBehavior/);
  assert.match(registry, /setNodeBehavior/);
  assert.doesNotMatch(registry, /action-zone/);
  assert.doesNotMatch(registry, /layout-preview/);
  assert.match(registry, /--sn-layout-menu-action-height/);
  assert.match(registry, /--sn-layout-overflow-inline-size/);
  assert.match(registry, /preview-approve/);
  assert.match(registry, /--sn-cell-noise/);
  assert.match(registry, /--sn-composer-collapsed-control-width/);
  assert.match(registry, /--sn-composer-input-min-inline-size/);
  assert.match(registry, /--sn-chat-list-header-padding/);
  assert.match(registry, /--sn-chat-list-item-padding/);
  assert.match(registry, /--sn-chat-list-delete-size/);
  assert.match(registry, /--sn-chat-sidebar-header-padding/);
  assert.match(registry, /--sn-chat-sidebar-row-padding/);
  assert.match(registry, /--sn-chat-sidebar-delete-box-size/);
  assert.match(registry, /--sn-node-pill-body-padding/);
  assert.match(registry, /--sn-node-circle-body-padding/);
  assert.match(registry, /--sn-node-comment-body-padding/);
  assert.match(customElements, /"name": "setPanelMenuActions"/);
  assert.match(customElements, /"name": "setLayoutBehavior"/);
  assert.match(customElements, /"name": "setNodeBehavior"/);
  assert.match(customElements, /"name": "panel-menu-action"/);
  assert.doesNotMatch(customElements, /action-zone/);
  assert.doesNotMatch(customElements, /layout-preview/);
  assert.match(customElements, /"name": "--sn-cell-noise"/);
  assert.match(customElements, /"name": "--sn-composer-collapsed-control-width"/);
  assert.match(customElements, /"name": "--sn-composer-input-min-inline-size"/);
  assert.match(customElements, /"name": "--sn-chat-list-header-padding"/);
  assert.match(customElements, /"name": "--sn-chat-list-item-padding"/);
  assert.match(customElements, /"name": "--sn-chat-list-delete-size"/);
  assert.match(customElements, /"name": "--sn-chat-sidebar-header-padding"/);
  assert.match(customElements, /"name": "--sn-chat-sidebar-row-padding"/);
  assert.match(customElements, /"name": "--sn-chat-sidebar-delete-box-size"/);
  assert.match(customElements, /"name": "--sn-node-pill-body-padding"/);
  assert.match(customElements, /"name": "--sn-node-circle-body-padding"/);
  assert.match(customElements, /"name": "--sn-node-comment-body-padding"/);
});

test('chat composer exposes reusable voice controls and agent-facing metadata', async () => {
  const [composer, styles, registry, customElements] = await Promise.all([
    readFile(chatComposerSource, 'utf8'),
    readFile(chatComposerStyles, 'utf8'),
    readFile(componentRegistrySource, 'utf8'),
    readFile(customElementsSource, 'utf8'),
  ]);

  assert.match(composer, /setVoiceControls\(config = \{\}\)/);
  assert.match(composer, /setVoiceInputState/);
  assert.match(composer, /setWakeListenState/);
  assert.match(composer, /setVoiceResponseState/);
  assert.match(composer, /setVoiceCommandState/);
  assert.match(composer, /setVoiceLanguageState/);
  assert.match(composer, /getVoiceControlElements/);
  assert.match(composer, /chat-composer-voice-input/);
  assert.match(composer, /chat-composer-wake-listen/);
  assert.match(composer, /chat-composer-voice-response-toggle/);
  assert.match(composer, /chat-composer-voice-command-toggle/);
  assert.match(composer, /chat-composer-voice-language-change/);
  assert.match(composer, /class="btn-mic"/);
  assert.match(composer, /class="btn-wake-listen"/);
  assert.match(composer, /class="btn-voice-response"/);
  assert.match(composer, /class="btn-voice-command"/);
  assert.match(composer, /class="btn-voice-language"/);
  assert.match(styles, /\.btn-mic\[hidden\]/);
  assert.match(styles, /\.btn-wake-listen\[hidden\]/);
  assert.match(styles, /container: composer-body \/ inline-size/);
  assert.match(styles, /flex-wrap: wrap/);
  assert.match(styles, /flex: 0 0 var\(--sn-composer-send-size\)/);
  assert.match(styles, /@container composer-body \(width <= 460px\)/);
  assert.match(styles, /@container composer-body \(width <= 340px\)/);
  assert.match(styles, /36cqi/);
  assert.match(styles, /38cqi/);
  assert.match(styles, /--sn-composer-input-min-inline-size/);
  assert.match(styles, /--sn-composer-wake-command-max/);
  assert.doesNotMatch(styles, /28vw/);
  assert.match(registry, /component-descriptor-v2/);
  assert.match(registry, /voice-controls/);
  assert.match(registry, /chat_composer_voice_control/);
  assert.match(registry, /preview-approve/);
  assert.match(registry, /preview-cancel/);
  assert.match(registry, /preview-send/);
  assert.match(registry, /chat-composer-voice-language-change/);
  assert.match(customElements, /"name": "setVoiceControls"/);
  assert.match(customElements, /"name": "chat-composer-voice-input"/);
  assert.match(customElements, /"name": "--sn-composer-send-icon-size"/);
  assert.match(customElements, /"name": "--sn-composer-collapsed-control-padding"/);
  assert.match(customElements, /"name": "--sn-composer-wake-command-max"/);
});

test('static custom elements catalog carries agent-facing descriptions for chat surfaces', async () => {
  const catalog = JSON.parse(await readFile(customElementsSource, 'utf8'));
  const descriptions = new Map();
  for (const moduleRecord of catalog.modules) {
    for (const declaration of moduleRecord.declarations || []) {
      if (declaration.tagName) descriptions.set(declaration.tagName, declaration.componentDescription || '');
    }
  }

  for (const tagName of [
    'chat-composer',
    'chat-list',
    'chat-list-item',
    'chat-sidebar-shell',
    'chat-sidebar-item',
    'cell-bg',
  ]) {
    assert.match(descriptions.get(tagName) || '', /Use this/);
  }
});

test('cascade theme lab declares browser import map for bare package imports', async () => {
  const source = await readFile(cascadeDemoHtml, 'utf8');

  assert.match(source, /<script type="importmap">/);
  assert.match(source, /"@symbiotejs\/symbiote": "\.\.\/node_modules\/@symbiotejs\/symbiote\/core\/index\.js"/);
  assert.match(source, /"symbiote-engine\/": "\.\.\/node_modules\/symbiote-engine\/"/);
});
