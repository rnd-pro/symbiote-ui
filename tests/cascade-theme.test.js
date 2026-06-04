import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const scrollbarSource = new URL('../themes/scrollbar-styles.js', import.meta.url);
const cascadeThemeSource = new URL('../themes/cascade-theme.js', import.meta.url);
const cascadeDemoSource = new URL('../demo/cascade-theme-lab.js', import.meta.url);
const cascadeDemoHtml = new URL('../demo/cascade-theme-lab.html', import.meta.url);
const graphNodeStyles = new URL('../node/GraphNode/GraphNode.css.js', import.meta.url);
const portItemStyles = new URL('../node/PortItem/PortItem.css.js', import.meta.url);
const ctrlItemStyles = new URL('../node/CtrlItem/CtrlItem.css.js', import.meta.url);
const nodeSocketStyles = new URL('../node/NodeSocket/NodeSocket.css.js', import.meta.url);
const nodeCanvasStyles = new URL('../canvas/NodeCanvas/NodeCanvas.css.js', import.meta.url);
const layoutStyles = new URL('../layout/Layout/Layout.css.js', import.meta.url);
const layoutNodeStyles = new URL('../layout/LayoutNode/LayoutNode.css.js', import.meta.url);
const panelMenuStyles = new URL('../layout/PanelMenu/PanelMenu.css.js', import.meta.url);
const actionZoneStyles = new URL('../layout/ActionZone/ActionZone.css.js', import.meta.url);
const treeViewStyles = new URL('../tree/TreeView/TreeView.css.js', import.meta.url);

test('theme scrollbar normal state uses the normal thumb token', async () => {
  const source = await readFile(scrollbarSource, 'utf8');

  assert.match(
    source,
    /const SCROLLBAR_COLOR = 'var\(--sn-scrollbar-thumb, currentColor\) var\(--sn-scrollbar-track, transparent\)'/
  );
});

test('cascade theme lab mutates root tokens instead of applying local component themes', async () => {
  const source = await readFile(cascadeDemoSource, 'utf8');

  assert.match(source, /import Symbiote, \{ html \} from '@symbiotejs\/symbiote'/);
  assert.match(source, /applyCascadeTheme\(root, readThemeState\(\)\)/);
  assert.match(source, /class CascadeGraphPanel extends Symbiote/);
  assert.match(source, /class CascadeUiPanel extends Symbiote/);
  assert.match(source, /applyTheme\(document\.documentElement, DEFAULT_PROVIDER_THEME\)/);
  assert.match(source, /--sn-theme-outline-strength/);
  assert.match(source, /--sn-theme-type-scale/);
  assert.match(source, /--sn-shape-stroke/);
  assert.match(source, /--sn-shape-stroke-width/);
  assert.match(source, /--sn-node-label-size/);
  assert.match(source, /--sn-node-icon-size/);
  assert.match(source, /--sn-port-label-size/);
  assert.match(source, /--sn-shape-watermark-size/);
  assert.match(source, /--sn-layout-header-icon-size/);
  assert.match(source, /--sn-action-zone-size/);
  assert.doesNotMatch(source, /extends HTMLElement/);
  assert.doesNotMatch(source, /\.setTheme\(/);
  assert.doesNotMatch(source, /10 \+ brightness \* 0\.18/);
  assert.doesNotMatch(source, /setToken\(/);
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

  assert.equal(theme.name, 'cascade-theme');
  assert.equal(theme.state.mode, 'dark');
  assert.equal(theme.tokens['--sn-theme-bg-lightness'], '10.0%');
  assert.equal(theme.tokens['--sn-theme-text-lightness'], '94.0%');
  assert.equal(theme.tokens['--sn-shape-stroke-width'], '0.86');
  assert.equal(theme.tokens['--sn-node-label-size'], 'calc(13px * var(--sn-theme-type-scale))');
  assert.equal(theme.tokens['--sn-action-zone-size'], 'calc(16px * var(--sn-theme-density))');
  assert.match(source, /CASCADE_THEME_DESCRIPTOR/);
  assert.match(source, /symbiote-ui\.createCascadeTheme/);
  assert.match(source, /theme:compose/);
  assert.match(source, /--sn-shape-stroke/);
  assert.match(source, /--sn-layout-header-icon-size/);
  assert.match(source, /--sn-node-summary-size/);
  assert.match(source, /--sn-node-pill-body-padding/);
  assert.match(source, /--sn-node-circle-body-padding/);
  assert.match(source, /--sn-node-svg-body-padding/);
  assert.match(source, /--sn-control-input-size/);
  assert.match(source, /--sn-panel-menu-icon-size/);
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
    panelMenu,
    actionZone,
    treeView,
  ] = await Promise.all([
    readFile(graphNodeStyles, 'utf8'),
    readFile(portItemStyles, 'utf8'),
    readFile(ctrlItemStyles, 'utf8'),
    readFile(nodeSocketStyles, 'utf8'),
    readFile(nodeCanvasStyles, 'utf8'),
    readFile(layoutStyles, 'utf8'),
    readFile(layoutNodeStyles, 'utf8'),
    readFile(panelMenuStyles, 'utf8'),
    readFile(actionZoneStyles, 'utf8'),
    readFile(treeViewStyles, 'utf8'),
  ]);

  assert.match(graphNode, /--sn-node-label-size/);
  assert.match(graphNode, /--sn-node-summary-size/);
  assert.match(graphNode, /--sn-node-icon-size/);
  assert.match(graphNode, /--sn-shape-watermark-size/);
  assert.match(graphNode, /--sn-node-pill-body-padding/);
  assert.match(graphNode, /--sn-node-circle-body-padding/);
  assert.match(graphNode, /--sn-node-comment-body-padding/);
  assert.match(graphNode, /--sn-node-svg-body-padding/);
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
  assert.match(panelMenu, /--sn-panel-menu-item-size/);
  assert.match(actionZone, /--sn-action-zone-size/);
  assert.match(treeView, /--sn-tree-badge-padding/);
});

test('cascade theme lab declares browser import map for bare package imports', async () => {
  const source = await readFile(cascadeDemoHtml, 'utf8');

  assert.match(source, /<script type="importmap">/);
  assert.match(source, /"@symbiotejs\/symbiote": "\.\.\/node_modules\/@symbiotejs\/symbiote\/core\/index\.js"/);
  assert.match(source, /"symbiote-engine\/": "\.\.\/node_modules\/symbiote-engine\/"/);
});
