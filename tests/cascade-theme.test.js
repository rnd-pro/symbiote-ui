import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const scrollbarSource = new URL('../themes/scrollbar-styles.js', import.meta.url);
const cascadeThemeSource = new URL('../themes/cascade-theme.js', import.meta.url);
const cascadeThemeEditorSource = new URL('../themes/CascadeThemeEditor/CascadeThemeEditor.js', import.meta.url);
const cascadeDemoSource = new URL('../demo/cascade-theme-lab.js', import.meta.url);
const cascadeDemoHtml = new URL('../demo/cascade-theme-lab.html', import.meta.url);
const graphNodeStyles = new URL('../node/GraphNode/GraphNode.css.js', import.meta.url);
const nodeViewManagerSource = new URL('../canvas/NodeViewManager.js', import.meta.url);
const portItemStyles = new URL('../node/PortItem/PortItem.css.js', import.meta.url);
const ctrlItemStyles = new URL('../node/CtrlItem/CtrlItem.css.js', import.meta.url);
const nodeSocketStyles = new URL('../node/NodeSocket/NodeSocket.css.js', import.meta.url);
const nodeCanvasStyles = new URL('../canvas/NodeCanvas/NodeCanvas.css.js', import.meta.url);
const layoutStyles = new URL('../layout/Layout/Layout.css.js', import.meta.url);
const layoutNodeSource = new URL('../layout/LayoutNode/LayoutNode.js', import.meta.url);
const layoutNodeStyles = new URL('../layout/LayoutNode/LayoutNode.css.js', import.meta.url);
const projectTabsSource = new URL('../layout/ProjectTabs/ProjectTabs.js', import.meta.url);
const projectTabsStyles = new URL('../layout/ProjectTabs/ProjectTabs.css.js', import.meta.url);
const panelMenuStyles = new URL('../layout/PanelMenu/PanelMenu.css.js', import.meta.url);
const actionZoneStyles = new URL('../layout/ActionZone/ActionZone.css.js', import.meta.url);
const treeViewStyles = new URL('../tree/TreeView/TreeView.css.js', import.meta.url);
const codeBlockStyles = new URL('../display/CodeBlock/CodeBlock.css.js', import.meta.url);
const chatMessageItemStyles = new URL('../chat/ChatMessageItem/ChatMessageItem.css.js', import.meta.url);
const uiIndexSource = new URL('../ui/index.js', import.meta.url);
const componentRegistrySource = new URL('../manifest/component-registry.js', import.meta.url);
const customElementsSource = new URL('../custom-elements.json', import.meta.url);
const componentDescriptorV2Source = new URL('../schemas/component-descriptor-v2.json', import.meta.url);

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
  assert.match(source, /component: 'cascade-theme-editor'/);
  assert.match(source, /'storage-key': 'symbiote-ui:cascade-theme-lab'/);
  assert.match(source, /class CascadeGraphPanel extends Symbiote/);
  assert.match(source, /class CascadeUiPanel extends Symbiote/);
  assert.match(source, /applyTheme\(document\.documentElement, DEFAULT_PROVIDER_THEME\)/);
  assert.match(source, /--sn-theme-outline-strength/);
  assert.match(source, /--sn-theme-type-scale/);
  assert.match(source, /--sn-theme-heading-scale/);
  assert.match(source, /--sn-shape-stroke/);
  assert.match(source, /--sn-shape-stroke-width/);
  assert.match(source, /--sn-node-label-size/);
  assert.match(source, /--sn-cat-control/);
  assert.match(source, /--sn-cat-data/);
  assert.match(source, /--sn-tab-accent-1/);
  assert.match(source, /--sn-markdown-h1-size/);
  assert.match(source, /--sn-chat-markdown-h1-size/);
  assert.match(source, /--sn-node-icon-size/);
  assert.match(source, /--sn-port-label-size/);
  assert.match(source, /--sn-layout-header-icon-size/);
  assert.match(source, /--sn-action-zone-size/);
  assert.match(html, /layout module/);
  assert.doesNotMatch(source, /extends HTMLElement/);
  assert.doesNotMatch(source, /\.setTheme\(/);
  assert.doesNotMatch(source, /10 \+ brightness \* 0\.18/);
  assert.doesNotMatch(source, /setToken\(/);
  assert.doesNotMatch(source, /querySelector\('\[data-control/);
  assert.doesNotMatch(html, /data-control=/);
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
  assert.equal(theme.tokens['--sn-hue-accent'], '218');
  assert.equal(theme.tokens['--sn-hue-warning'], '36');
  assert.equal(theme.tokens['--sn-hue-data'], '188');
  assert.equal(theme.tokens['--sn-hue-danger'], '4');
  assert.equal(theme.tokens['--sn-cat-control'], 'hsl(36 89% 58%)');
  assert.equal(theme.tokens['--sn-cat-data'], 'hsl(188 89% 42.0%)');
  assert.equal(theme.tokens['--sn-graph-type-action'], 'hsl(4 89% 78.0%)');
  assert.equal(theme.tokens['--sn-tab-accent-0'], 'var(--sn-cat-server)');
  assert.equal(theme.tokens['--sn-tab-accent-1'], 'var(--sn-cat-data)');
  assert.equal(theme.tokens['--sn-tab-accent-2'], 'var(--sn-cat-control)');
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
  assert.equal(theme.tokens['--sn-action-zone-size'], 'calc(16px * var(--sn-theme-density))');
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
  assert.match(source, /--sn-layout-header-icon-size/);
  assert.match(source, /--sn-node-summary-size/);
  assert.match(source, /--sn-node-pill-body-padding/);
  assert.match(source, /--sn-node-circle-body-padding/);
  assert.match(source, /--sn-control-input-size/);
  assert.match(source, /--sn-panel-menu-icon-size/);
});

test('svg shape nodes do not render internal labels or watermarks', async () => {
  const [graphNode, nodeViewManager] = await Promise.all([
    readFile(graphNodeStyles, 'utf8'),
    readFile(nodeViewManagerSource, 'utf8'),
  ]);

  assert.match(graphNode, /& \.sn-node-header,\n      & \.sn-node-body \{\n        display: none;/);
  assert.doesNotMatch(graphNode, /sn-shape-watermark/);
  assert.doesNotMatch(graphNode, /--sn-shape-watermark-size/);
  assert.doesNotMatch(nodeViewManager, /sn-shape-watermark/);
  assert.doesNotMatch(nodeViewManager, /ensureMaterialSymbols\(\[iconEl\.textContent\]\)/);
});

test('cascade theme editor is a reusable browser module', async () => {
  const [editor, styles, uiIndex, registry, customElements, layoutNode] = await Promise.all([
    readFile(cascadeThemeEditorSource, 'utf8'),
    readFile(new URL('../themes/CascadeThemeEditor/CascadeThemeEditor.css.js', import.meta.url), 'utf8'),
    readFile(uiIndexSource, 'utf8'),
    readFile(componentRegistrySource, 'utf8'),
    readFile(customElementsSource, 'utf8'),
    readFile(layoutNodeSource, 'utf8'),
  ]);

  assert.match(editor, /class CascadeThemeEditor extends Symbiote/);
  assert.match(editor, /applyCascadeTheme\(this\.\#resolveTarget\(\), this\.\#state\)/);
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
  assert.match(uiIndex, /themes\/CascadeThemeEditor\/CascadeThemeEditor\.js/);
  assert.match(registry, /tagName: 'cascade-theme-editor'/);
  assert.match(registry, /componentDescription/);
  assert.match(registry, /WEBMCP_SUPPORT_REFERENCE/);
  assert.match(registry, /cascade_theme_editor_apply/);
  assert.match(customElements, /"tagName": "cascade-theme-editor"/);
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

test('cascade theme controls reach canvas objects and layout chrome', async () => {
  const [
    graphNode,
    portItem,
    ctrlItem,
    nodeSocket,
    nodeCanvas,
    layout,
    layoutNode,
    projectTabs,
    projectTabsCss,
    panelMenu,
    actionZone,
    treeView,
    codeBlock,
    chatMessage,
  ] = await Promise.all([
    readFile(graphNodeStyles, 'utf8'),
    readFile(portItemStyles, 'utf8'),
    readFile(ctrlItemStyles, 'utf8'),
    readFile(nodeSocketStyles, 'utf8'),
    readFile(nodeCanvasStyles, 'utf8'),
    readFile(layoutStyles, 'utf8'),
    readFile(layoutNodeStyles, 'utf8'),
    readFile(projectTabsSource, 'utf8'),
    readFile(projectTabsStyles, 'utf8'),
    readFile(panelMenuStyles, 'utf8'),
    readFile(actionZoneStyles, 'utf8'),
    readFile(treeViewStyles, 'utf8'),
    readFile(codeBlockStyles, 'utf8'),
    readFile(chatMessageItemStyles, 'utf8'),
  ]);

  assert.match(graphNode, /--sn-node-label-size/);
  assert.match(graphNode, /--sn-node-summary-size/);
  assert.match(graphNode, /--sn-node-icon-size/);
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
  assert.match(layoutNode, /--sn-layout-header-icon-size/);
  assert.match(layoutNode, /--sn-layout-resizer-thickness/);
  assert.match(projectTabs, /--sn-tab-accent-\$\{index % 6\}/);
  assert.match(projectTabsCss, /--tab-accent, var\(--sn-tabs-accent/);
  assert.match(projectTabsCss, /border-color: color-mix\(in srgb, var\(--tab-accent/);
  assert.match(panelMenu, /--sn-panel-menu-item-size/);
  assert.match(actionZone, /--sn-action-zone-size/);
  assert.match(treeView, /--sn-tree-badge-padding/);
  assert.match(codeBlock, /--sn-markdown-h1-size/);
  assert.match(codeBlock, /--sn-markdown-h4-size/);
  assert.match(chatMessage, /--sn-chat-markdown-h1-size/);
  assert.match(chatMessage, /--sn-chat-markdown-h4-size/);
});

test('cascade theme lab declares browser import map for bare package imports', async () => {
  const source = await readFile(cascadeDemoHtml, 'utf8');

  assert.match(source, /<script type="importmap">/);
  assert.match(source, /"@symbiotejs\/symbiote": "\.\.\/node_modules\/@symbiotejs\/symbiote\/core\/index\.js"/);
  assert.match(source, /"symbiote-engine\/": "\.\.\/node_modules\/symbiote-engine\/"/);
});
