# symbiote-ui

`symbiote-ui` owns the browser-facing and agent-facing UI contracts for Symbiote provider systems.

It is built for agents that construct components, data views, and surrounding layouts dynamically. A chat agent can choose a component descriptor, bind data, compose a layout, and let the browser hydrate interactive Web Components without restarting the server.

## Install

```sh
npm install symbiote-ui @symbiotejs/symbiote@3.8.0-webmcp.2
```

For SSR integration tests or JSDA-based hosts, install the integration dependencies in the host project:

```sh
npm install jsda-kit linkedom
```

`jsda-kit` is intentionally not a runtime dependency of `symbiote-ui`.

## Entry Points

- `symbiote-ui` - Node-safe core primitives.
- `symbiote-ui/core` - graph editor data primitives.
- `symbiote-ui/layout` - SSR-safe layout helpers.
- `symbiote-ui/graph` - provider graph normalization and projection helpers.
- `symbiote-ui/manifest` - component, schema, rule, theme, and provider catalogs.
- `symbiote-ui/runtime` - Node-safe agent UI construction helpers.
- `symbiote-ui/ui` - browser Web Component registration and UI runtime.
- `symbiote-ui/webmcp` - WebMCP descriptor helpers and registration utilities.
- `symbiote-ui/xr` - WebXR provider helpers.
- `symbiote-ui/locale` - Node-safe locale catalogs and translation helpers.
- `symbiote-ui/discover` - provider discovery JSON API used by the CLI.
- `symbiote-ui/custom-elements.json` - Custom Elements manifest.
- `symbiote-ui/schemas/*`, `symbiote-ui/tokens/*`, `symbiote-ui/rules/*` - machine-readable provider contracts.
- `symbiote-ui/display/*` - reusable display utilities exposed by package export map.

For the complete export map and provider catalog, run:

```sh
symbiote-ui discover
```

Use `symbiote-node` only as the terminal migration facade for older consumers.

## Related Packages

- [`symbiote-engine`](https://github.com/RND-PRO/symbiote-engine) - runtime execution, CLI commands, server helpers, persistence, and handlers.
- [`symbiote-node`](https://github.com/RND-PRO/symbiote-node) - terminal migration facade for older imports.
- [Package split guide](https://github.com/RND-PRO/symbiote-node/blob/main/docs/package-split.md)
- [Agent contract index](https://github.com/RND-PRO/symbiote-node/blob/main/docs/agent-contracts.md)

## Browser Registration

```js
import { defineModule, listModules } from 'symbiote-ui/ui';

defineModule('chat-composer');
defineModule('cascade-theme-editor');

console.log(listModules());
```

The root package and Node-safe entry points must import without creating DOM globals. Import safety does not mean every exported helper is useful without host data, a DOM adapter, browser hydration, or runtime-provided objects. Browser-only custom elements and module definition helpers belong behind `symbiote-ui/ui`.

## Agent UI Construction

Agents should start from the public manifest, choose a component by its
agent-facing description, then ask the host to bind data and insert the
component into an approved layout surface:

```js
import { listAgentComponentDescriptions } from 'symbiote-ui/manifest';

let catalog = listAgentComponentDescriptions();
let graphSurface = catalog.find((item) => item.tagName === 'node-canvas');
console.log(graphSurface.componentDescription);
console.log(graphSurface.webmcp.toolNames);
```

Browser hosts register custom elements through the public UI entrypoint:

```js
import { defineModule } from 'symbiote-ui/ui';

defineModule('panel-layout');
defineModule('chat-sidebar-shell');
defineModule('chat-composer');
defineModule('graph-explorer-shell');
defineModule('node-canvas');
defineModule('graph-node');
```

`NodeCanvas` is the low-level constructor surface for node/edge previews.
When a host uses it directly, it must also register `graph-node`; this keeps
the canvas reusable while node rendering stays in its own component contract.
Use `symbiote-ui/core` for the host-owned editor model and `symbiote-ui/ui` for
browser registration, not unexported package file paths.

`canvas-graph` is not the primary node/edge constructor surface. Use it when an
agent needs a read/overview graph renderer with semantic clusters, focus,
selection, and layout snapshots. Use `node-canvas` when the agent is actively
constructing editable nodes, sockets, edges, frames, or document-flow previews.
Both components keep graph data host-owned and emit intent events; hosts own
navigation, persistence, and permission policy.

```js
import { Node, NodeEditor, Output, Socket } from 'symbiote-ui/core';
import { defineModule } from 'symbiote-ui/ui';

defineModule('node-canvas');
defineModule('graph-node');

let editor = new NodeEditor();
let socket = new Socket('flow');
let node = new Node('Generated view', { id: 'generated-view', type: 'agent' });
node.addOutput('next', new Output(socket, 'next'));
editor.addNode(node);

let canvas = document.querySelector('node-canvas');
canvas.setEditor(editor);
canvas.setPathStyle('pcb');
canvas.setFlowLayout({ nodeIds: [node.id], direction: 'vertical', scroll: true });
```

`panel-layout` owns reusable split and panel behavior only. Product routes,
transport, persistence, and permission checks remain host policy:

```js
layout.registerPanelType('chat', {
  title: 'Chat',
  icon: 'forum',
  component: 'chat-composer',
});
layout.openPanel('chat', {
  direction: 'horizontal',
  ratio: 0.42,
  uiInvoked: true,
  source: 'agent-constructor',
});
```

Theme updates should mutate the cascade target once and let components inherit
tokens:

```js
import { applyCascadeTheme, createCascadeTheme } from 'symbiote-ui';

let theme = createCascadeTheme({ mode: 'dark', brightness: 8, contrast: 64 });
applyCascadeTheme(document.documentElement, theme.state);
```

For chat construction, `chat-sidebar-shell` owns sidebar presentation and emits
selection/collapse/width intents. `chat-composer` owns composer presentation,
footer controls, and voice-control intents. The host owns actual chat
transport, model/provider policy, speech recognition, and storage.
Use `setFooterControls()` for structured provider/model/agent/resource/settings
controls; `chat-composer-footer-control` and
`chat-composer-footer-control-change` report product-neutral intents back to the
host. Voice controls emit `chat-composer-permission-intent`,
`chat-composer-recorder-intent`, and `chat-composer-transcription-intent` so
hosts can own microphone permission, recorder lifecycle, and transcription
providers without those policies leaking into the component. `setFooterHtml()`
remains available only for trusted host-rendered footer markup.
`extractChatTitleFromAgentText()` provides a product-neutral parser for
standalone `<chat-title>...</chat-title>` responses; any prompt instruction that
asks an agent to produce that tag remains host policy.

For live agent construction, `symbiote-ui/runtime` provides the Node-safe
`runtime-ui-v1` adapter:

```js
import {
  applyRuntimeLayoutAction,
  createRuntimeUiController,
} from 'symbiote-ui/runtime';

let controller = createRuntimeUiController({
  document,
  allowedMethods: ['setData'],
  onIntent(intent) {
    hostActions.dispatch(intent.action, intent.detail);
  },
});

let panel = controller.create({
  id: 'agent-kpi-panel',
  component: 'sn-data-table',
  state: {
    methods: {
      setData: [{
        columns: [{ key: 'metric', label: 'Metric' }],
        rows: [{ metric: 'Latency' }],
      }],
    },
  },
  events: {
    'row-open': 'metrics.open',
  },
});

target.append(panel.element);
controller.update('agent-kpi-panel', {
  props: { density: 'compact' },
  attrs: { 'data-live': true },
});

applyRuntimeLayoutAction(layout, {
  type: 'open-panel',
  panelType: 'agent-kpi-panel',
  options: { uiInvoked: true, source: 'agent-constructor' },
});
```

The runtime adapter never stores layouts, chat history, theme presets, or
automation results. Hosts persist the `runtime-ui-v1` tree, constructed
component state, intent mappings, and layout snapshots in their own project
store. `destroy()` tears down listeners and removes dynamic elements when the
host closes or removes UI-invoked panels. Hosts should pass `allowedMethods` or
`allowMethod()` when applying agent-authored `state.methods`; use the component
registry or a project policy allowlist to approve method calls.

## Cascade Theme

`symbiote-ui` exposes a reusable cascade theme contract for agent-built UI, graph canvases, layouts, scrollbars, and VR-ready panels:

```js
import { applyCascadeTheme, createCascadeTheme } from 'symbiote-ui';

let theme = createCascadeTheme({
  mode: 'dark',
  brightness: 0,
  contrast: 58,
  chroma: 89,
  hue: 218,
  outline: 38,
  type: 100,
  density: 100,
});

applyCascadeTheme(document.documentElement, theme.state);
```

Apply the cascade once at `:root`, an app shell, or a subtree boundary. Components inherit `--sn-*` tokens; host projects should not duplicate the formulas in app-local CSS or JS.

The contract writes both low-level controls such as `--sn-theme-bg-lightness`,
`--sn-theme-outline-strength`, `--sn-theme-type-scale`, and
`--sn-theme-density`, and public component aliases such as `--sn-bg`,
`--sn-text`, `--sn-node-bg`, `--sn-panel-bg`, `--sn-ctx-bg`,
`--sn-button-bg`, and `--sn-field-control-bg`.

`createCascadeTheme()` also derives readable foreground tokens for colored
controls. The same Node-safe formula is exposed as `getReadableTextForHsl()`;
agents should use it when they construct custom accent surfaces instead of
hard-coding light or dark button text. Tab and content-group accents rotate
through `--sn-tab-accent-0` ... `--sn-tab-accent-5`, which lets hosts separate
layout groups while still inheriting the same root cascade.

Browser hosts can mount the reusable editor module inside a layout panel:

```html
<cascade-theme-editor
  storage-key="my-app:cascade-theme"
  target-selector="#app-shell"
></cascade-theme-editor>
```

The editor reuses the same bounded cascade controls, auto-saves normalized
parameters to `localStorage`, can reset to defaults, copies the current
parameter JSON, and emits `cascade-theme-change` after applying tokens. The
layout owns where the module is shown; `panel-layout` can register it as a
panel type while keeping the panel menu closed by default.
Temporary UI-invoked panels use the built-in `Close` action and
`closeUiPanel()` contract; close marks the panel closed/collapsed so the layout
surface remains recoverable. `removeUiPanel()` is the destructive operation that
physically removes a temporary panel and may restore the captured host layout
when the last temporary panel is removed. Persistent host layout panels use
`Remove` when the host deliberately edits the split tree.

## Layout Behavior

`symbiote-ui/layout` exposes SSR-safe layout behavior helpers for hosts and
agents that compose dynamic workspaces:

```js
import {
  LayoutTree,
  resolveLayoutMinSize,
  resolveResponsiveLayoutState,
} from 'symbiote-ui/layout';

let root = LayoutTree.createSplit(
  'horizontal',
  LayoutTree.createPanel('graph', {}, { importance: 90, minInlineSize: 420 }),
  LayoutTree.createPanel('chat', {}, { importance: 40, minInlineSize: 320 }),
  0.58
);

let minSize = resolveLayoutMinSize(root);
let state = resolveResponsiveLayoutState(
  { collapse: 'auto', overflow: 'scroll-inline', responsiveMode: 'scroll-inline' },
  { inlineSize: 520, blockSize: 420, layoutMinSize: minSize }
);
```

`panel-layout` uses the same contract at runtime. Root `layoutBehavior`
is host-applied responsive policy and is not persisted into the saved layout
tree; per-panel or per-branch `behavior` belongs on layout nodes and is
persisted with the tree. `importance` decides auto-collapse order, minimum
inline/block sizes decide when panels no longer fit, `collapse` controls
whether a panel may auto-collapse, `overflow` selects collapse versus
horizontal/vertical scroll fallback, and `responsiveMode` selects mobile
preserve, vertical stack, or horizontal scroll behavior. Minimum footprint
resolution accounts for split ratios, so a skewed split still reserves enough
scrollable space for both child branches.
At runtime `panel-layout` exposes resolved scroll axes through
`scroll-inline-active` and `scroll-block-active` attributes so CSS, browser
smoke tests, and agents can distinguish requested policy from active fallback.
`layout-sidebar` owns only its sidebar configuration and width persistence; its
reset control clears that state and emits `layout-sidebar-reset` for host-owned
layout resets instead of clearing host storage or reloading the page.

## Demos

- [`demo/cascade-theme-lab.html`](./demo/cascade-theme-lab.html) - layout-hosted cascade theme editor with dark/light mode, brightness, contrast, accent chroma, graph/UI token inheritance, copy/reset, and local persistence.
- [`demo/pcb-router-stress.html`](./demo/pcb-router-stress.html) - animated PCB route diagnostics with orbit metrics, keyframes, and agent-readable JSON samples.

## WebMCP

Component metadata uses `component-descriptor-v2` with bounded agent-facing contracts:

- `componentDescription` gives agents a stable explanation of what the component represents in the current UI contract.
- `agent.semanticRole`, `agent.usage`, `agent.dataOwnership`, and `agent.webmcp` describe when to use a component, who owns its data, and which explicit tools exist.
- `contract.ssr.mode` classifies SSR safety as `node-safe`, `ssr-entry-safe`, `jsda-ssr-renderable`, `hydrate-only`, or `client-only`.
- `contract.webmcp.tools[]` documents explicit tool descriptors with `name`, `description`, `inputSchema`, `annotations`, visibility, and permission hints.
- WebMCP exposure is explicit-first. The package does not enable global `Symbiote.mcpToolMode` by default.

Use `listAgentComponentDescriptions()` from `symbiote-ui/manifest` or
`symbiote-ui discover` when an agent needs to understand which component is
which before composing a layout or choosing a tool.

`symbiote-ui/webmcp` also exposes `createComponentToolDescriptor(component,
tool)`, which appends the component context to explicit tool descriptions while
preserving the typed `ToolDescriptor` shape.

The RND-PRO overview of Symbiote WebMCP support is:

https://rnd-pro.com/pulse/symbiote-webmcp-support/

The upstream Symbiote WebMCP reference is:

https://github.com/symbiotejs/symbiote.js/blob/webmcp/docs/webmcp.md

## JSDA SSR

Hosts that use JSDA SSR should provide their own SSR runtime and DOM adapter:

```js
import { parseHTML } from 'linkedom';
import 'symbiote-ui/ui';
```

`jsda-ssr-renderable` components are expected to import safely in a JSDA SSR fixture with `ssr.enabled`, `ssr.imports`, `linkedom`, and Web Component SSR enabled by the host.

## Package Boundary

`symbiote-ui` owns Web Components, UI/layout primitives, manifests, schemas, rules, tokens, themes, locale helpers, provider-facing graph metadata, WebMCP metadata, and `custom-elements.json`.

Runtime workflow execution, persistence, server commands, handler packs, and process lifecycle belong in `symbiote-engine`.
