# symbiote-ui

`symbiote-ui` owns the browser-facing and agent-facing UI contracts for Symbiote provider systems.

It is built for agents that construct components, data views, and surrounding layouts dynamically. A chat agent can choose a component descriptor, bind data, compose a layout, and let the browser hydrate interactive Web Components without restarting the server.

See [Agent UI Construction Principles](./docs/agent-ui-principles.md) for the
UX scenarios and workspace rules that guide agent-built interfaces.

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
- `symbiote-ui/layout` - SSR-safe layout, behavior, and lifecycle helpers.
- `symbiote-ui/graph` - provider graph normalization and projection helpers.
- `symbiote-ui/manifest` - component, schema, rule, theme, and provider catalogs.
- `symbiote-ui/runtime` - Node-safe agent UI construction helpers.
- `symbiote-ui/ui` - browser Web Component registration and UI runtime.
- `symbiote-ui/webmcp` - WebMCP descriptor helpers and registration utilities.
- `symbiote-ui/xr` - WebXR provider helpers, spatial algorithms, 3D graph layout, and multi-view coordination.
- `symbiote-ui/locale` - Node-safe locale catalogs and translation helpers.
- `symbiote-ui/discover` - provider discovery JSON API used by the CLI.
- `symbiote-ui/chat/voice-input-defaults.js` - Node-safe wake/send/action voice command defaults and matching helpers.
- `symbiote-ui/chat/voice-controller.js` - browser wake listening and response speech orchestration for chat hosts.
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
defineModule('canvas-graph');
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
import {
  createGraphViewModeController,
  defineModule,
} from 'symbiote-ui/ui';

defineModule('node-canvas');
defineModule('canvas-graph');
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

let graphView = createGraphViewModeController({
  shell: document.querySelector('graph-explorer-shell'),
  structuredCanvas: canvas,
  flatGraph: document.querySelector('canvas-graph'),
  structuredEditor: editor,
  flatModel: {
    nodes: [{ id: 'generated-view', label: 'Generated view', type: 'data' }],
    edges: [],
  },
});

graphView.setMode(new URLSearchParams(location.search).get('mode'));
graphView.focusNode({ nodeId: 'generated-view' });
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

Use `cascade-theme-widget` for shell-level quick controls and
`cascade-theme-editor` for the full layout panel. Keep both components on the
same `storage-key` and `target-selector`; the widget emits
`cascade-theme-open-full`, and the host opens a registered `panel-layout`
panel:

```html
<section id="app-shell">
  <header>
    <cascade-theme-widget
      storage-key="my-app:cascade-theme"
      target-selector="#app-shell"
    ></cascade-theme-widget>
  </header>
  <panel-layout id="workspace-layout"></panel-layout>
</section>
```

```js
import { defineModule } from 'symbiote-ui/ui';

defineModule('cascade-theme-widget');
defineModule('cascade-theme-editor');
defineModule('panel-layout');

class AppThemePanel extends HTMLElement {
  connectedCallback() {
    if (this.ready) return;
    this.ready = true;
    this.innerHTML = `
      <cascade-theme-editor
        storage-key="my-app:cascade-theme"
        target-selector="#app-shell"
      ></cascade-theme-editor>
    `;
  }
}

customElements.define('app-theme-panel', AppThemePanel);

let layout = document.querySelector('#workspace-layout');
layout.registerPanelType('theme-editor', {
  title: 'Theme',
  icon: 'palette',
  component: 'app-theme-panel',
});

document.addEventListener('cascade-theme-open-full', () => {
  layout.openPanel('theme-editor', {
    uiInvoked: true,
    source: 'cascade-theme-widget',
  });
});
```

For chat construction, use `chat-workspace` when the host needs the complete
reusable shell: sidebar, transcript, composer, footer controls, voice-control
intents, and animated `cell-bg` lifecycle. `chat-sidebar-shell` and
`chat-composer` remain lower-level primitives for custom composition. The host
owns actual chat transport, model/provider policy, speech recognition, routes,
and storage.
Use `setFooterControls()` for structured provider/model/agent/resource/settings
controls; `chat-composer-footer-control` and
`chat-composer-footer-control-change` report product-neutral intents back to the
host. Voice controls emit cancelable primary events and granular
`chat-composer-permission-intent`, `chat-composer-recorder-intent`, and
`chat-composer-transcription-intent` stages so hosts can override microphone
permission, recorder lifecycle, and transcription providers without those
policies leaking into the component. If the host does not call
`event.preventDefault()`, the library falls back to its built-in browser-level
voice runtime (`VoiceRuntime` in `chat/voice-runtime.js`, exported via
`symbiote-ui/ui` and `symbiote-ui/chat/voice-runtime.js`, but NOT the root entry
point to remain Node-safe). `VoiceRuntime`
manages capability detection, checks/requests permissions through native browser
APIs, and captures/transcribes input using native Web Speech Recognition. If
SpeechRecognition is unsupported but recording is active, it records audio
chunks and dispatches a `chat-composer-audio-captured` event with the resulting
raw audio blob so the host can process or transcribe it. Use
`symbiote-ui/chat/voice-input-defaults.js` for shared wake/send/cancel/delete/off
phrases, command parsing, and matching when hosts need Agent Portal-compatible
voice command behavior. `VoiceController` in
`symbiote-ui/chat/voice-controller.js` coordinates browser wake listening,
pause/resume while recording or speaking, wake-command matching, and response
speech lifecycle while leaving settings, transcription providers, persistence,
and routing to the host. It is also exported through `symbiote-ui/ui` for
browser hosts. `setFooterHtml()`
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
  pattern: 60,
  outline: 38,
  type: 100,
  heading: 100,
  density: 100,
  motion: 100,
});

applyCascadeTheme(document.documentElement, theme.state);
```

Apply the cascade once at `:root`, an app shell, or a subtree boundary. Components inherit `--sn-*` tokens; host projects should not duplicate the formulas in app-local CSS or JS.

The contract writes both low-level controls such as `--sn-theme-bg-lightness`,
`--sn-theme-outline-strength`, `--sn-theme-type-scale`, and
`--sn-theme-heading-scale`, `--sn-theme-density`, and
`--sn-theme-pattern-brightness`, `--sn-theme-motion-scale`, and public component aliases such as `--sn-bg`,
`--sn-text`, `--sn-node-bg`, `--sn-panel-bg`, `--sn-ctx-bg`,
`--sn-button-bg`, and `--sn-field-control-bg`. Motion also exposes
`--sn-motion-enabled`, `--sn-animation-play-state`,
`--sn-animation-duration-scale`, and `--sn-transition-easing`; disabled
motion sets transition durations to zero and pauses cascade-driven animations.
The `pattern` control tunes animated background dots, noise, and glare through
`--sn-cell-base-alpha`, `--sn-cell-alpha-span`, and
`--sn-theme-pattern-brightness` without changing foreground surface contrast.

`createCascadeTheme()` also derives readable foreground tokens for colored
controls. The same Node-safe formula is exposed as `getReadableTextForHsl()`;
agents should use it when they construct custom accent surfaces instead of
hard-coding light or dark button text. Tab and content-group accents rotate
through `--sn-tab-accent-0` ... `--sn-tab-accent-5`, which lets hosts separate
layout groups while still inheriting the same root cascade.

Runtime hosts can set `data-engine-state="idle"`, `"running"`, `"success"`,
or `"error"` on a reusable surface. The default provider maps those states to
`--sn-engine-state-color`, `--sn-engine-state-bg`, and
`--sn-engine-state-border`; running state animation uses
`--sn-animation-play-state` so reduced or disabled motion pauses it without
component-local JavaScript.

Preset composition is available through `ThemeFactory` exports. Agents can use
`resolveThemePresetsForTask('chat' | 'editor' | 'monitor' | 'terminal')` for
task defaults, then call `applyThemePresets(element, { color, skin, motion })`.
The motion preset comes from the same `Motion.js` definitions as direct
`applyMotion()` usage.

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
  resumeLayoutSubtree,
  resolveLayoutMinSize,
  resolveResponsiveLayoutState,
  suspendLayoutSubtree,
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

suspendLayoutSubtree(workspaceEl, { reason: 'workspace-inactive' });
resumeLayoutSubtree(workspaceEl, { reason: 'workspace-active' });
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
`suspendLayoutSubtree()` and `resumeLayoutSubtree()` call public
`suspendLayout()`/`resumeLayout()` methods on reusable components and host
adapters in a hidden layout subtree. `chat-workspace`, `chat-composer`, and
`cell-bg` implement this contract so hidden workspace groups stop animated
backgrounds, wake listeners, voice capture, and UI timers without destroying
host-owned chat, route, or layout state.

## Spatial Algorithms

`symbiote-ui/xr` includes a set of dependency-free spatial primitives for 3D
graph visualization, force-directed layout, spatial indexing, and multi-view
coordination. All algorithmic cores are pure JavaScript, renderer-neutral, and
Node-safe. Three.js and WebXR adapters accept runtime dependencies through
injection, never as hard imports.

### Octree / Spatial Index

High-performance 3D octree for spatial queries and Barnes-Hut force
approximation:

```js
import { createOctree } from 'symbiote-ui/xr/spatial-index';

let tree = createOctree();
tree.insertAll([
  { x: 1, y: 2, z: 3 },
  { x: 4, y: 5, z: 6 },
  { x: 0, y: 0, z: 0 },
]);

let nearest = tree.nearest(1, 1, 1);
let box = tree.queryBox(0, 0, 0, 3, 3, 3);

tree.visit((node, x0, y0, z0, x1, y1, z1) => {
  // depth-first traversal of octants
});
```

### Spatial Graph Model

Pure functions to create and query a renderer-agnostic 3D graph model
conforming to the `spatial-graph-v1` contract:

```js
import {
  createSpatialGraphModel,
  updateSpatialNodePosition,
  selectSpatialNode,
  focusSpatialNode,
  pinSpatialNode,
  unpinSpatialNode,
} from 'symbiote-ui/xr/spatial-graph';

let model = createSpatialGraphModel({
  nodes: [
    { id: 'a', label: 'Module A', type: 'module', position: [0, 0, 0] },
    { id: 'b', label: 'Module B', type: 'module' },
  ],
  links: [
    { source: 'a', target: 'b', type: 'dependency' },
  ],
});

model = updateSpatialNodePosition(model, 'a', [1, 2, 3]);
model = selectSpatialNode(model, 'a');
model = focusSpatialNode(model, 'b');
model = pinSpatialNode(model, 'a', [1, 2, 3]);
model = unpinSpatialNode(model, 'a');
```

All functions are pure and return new model objects. Host metadata is preserved
in `node.metadata` without product-specific fields leaking into the contract.

### Force-Directed Layout

3D force simulation with Barnes-Hut many-body repulsion via the built-in
octree. No external dependencies:

```js
import {
  createSimulation,
  forceCenter3D,
  forceLink3D,
  forceManyBody3D,
  forceCluster3D,
} from 'symbiote-ui/xr/force-layout';

let nodes = [
  { id: 'a', x: 0, y: 0, z: 0, category: 'core' },
  { id: 'b', x: 1, y: 0, z: 0, category: 'core' },
  { id: 'c', x: 0, y: 1, z: 0, category: 'util' },
];

let links = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },
];

let sim = createSimulation(nodes);
sim.force('center', forceCenter3D(0, 0, 0));
sim.force('charge', forceManyBody3D().strength(-3.5));
sim.force('link', forceLink3D(links));
sim.force('cluster', forceCluster3D().strength(0.15));

for (let i = 0; i < 300; i++) sim.tick();
// nodes[0].x, .y, .z now contain settled positions
```

The `createForceLayoutAdapter` bridge connects a `NodeEditor` to the 3D
simulation:

```js
import { createForceLayoutAdapter } from 'symbiote-ui/xr/force-layout-adapter';

let adapter = createForceLayoutAdapter(editor, {
  strength: -4,
  distance: 1.5,
  useCluster: true,
});

adapter.tick(); // one simulation step, syncs coordinates back to editor nodes
```

### Spherical Layout

Deterministic 3D layout using Fibonacci spiral distribution. Units are meters
for XR compatibility:

```js
import { createSphericalGraphLayout } from 'symbiote-ui/xr/spherical-layout';

let layout = createSphericalGraphLayout(
  [
    { id: 'a', type: 'module' },
    { id: 'b', type: 'module' },
    { id: 'c', type: 'util' },
  ],
  [{ source: 'a', target: 'b' }],
  {
    mode: 'clustered-shell', // 'sphere' | 'shell' | 'clustered-shell'
    radius: 1.6,
    center: [0, 1.55, 0],
    category: (d) => d.type,
  }
);

// layout.nodes[i].position → [x, y, z]
// layout.bounds → { min: [x,y,z], max: [x,y,z] }
```

Fixed nodes are preserved in place. Output is fully deterministic for stable
agent-authored layouts.

### Spatial Drag Controller

Pure ray-sphere intersection math and pointer drag projection. No DOM, Three.js,
or WebXR dependencies:

```js
import {
  intersectRaySphere,
  hitTestSpatialNode,
  projectPointerToDragPlane,
  createSpatialDragController,
} from 'symbiote-ui/xr/spatial-drag-controller';

// Ray-sphere hit test
let dist = intersectRaySphere(
  [0, 0, 5],     // ray origin
  [0, 0, -1],    // ray direction
  [0, 0, 0],     // sphere center
  0.08            // sphere radius
);

// Hit test against spatial graph nodes
let hit = hitTestSpatialNode(model.nodes, {
  origin: [0, 0, 5],
  direction: [0, 0, -1],
});

// Full drag controller
let drag = createSpatialDragController();
let startEvent = drag.startDrag(hit.node, pointer);
let moveEvent = drag.moveDrag(pointer);
let endEvent = drag.endDrag();
// Events follow the spatial-node-drag contract: { type, nodeId, phase, position }
```

### Panel Auto-Tiling

Distributes workspace panels in 3D space with arc, grid, and sphere layouts:

```js
import { autoTileXRPanels } from 'symbiote-ui/xr';

let poses = autoTileXRPanels(
  [
    { id: 'chat', width: 0.6, height: 0.8 },
    { id: 'graph', width: 0.8, height: 0.6 },
    { id: 'inspector', width: 0.4, height: 0.6 },
  ],
  { layout: 'arc', comfortDistance: 1.2 }
);

// poses[i] → { id, position, rotation, ... }
```

### Three.js Adapter

Optional renderer adapter. The host supplies the `THREE` instance to avoid
making Three.js a mandatory dependency:

```js
import { createThreeSpatialGraph } from 'symbiote-ui/xr/three-spatial-graph';

let graph3D = createThreeSpatialGraph(THREE, model);
scene.add(graph3D.group);

// On model change:
graph3D.setModel(updatedModel);

// Cleanup:
graph3D.destroy();
```

Renders spherical nodes, link lines, and selection/focus color states.
Meshes are created, updated, and disposed automatically.

### Dual View Controller

Coordinates state between 2D canvas, 3D desktop preview, and XR immersive
modes:

```js
import { createDualViewController } from 'symbiote-ui/xr/dual-view-controller';

let dualView = createDualViewController({ initialMode: '2d' });

let unsubscribe = dualView.subscribe((state) => {
  console.log(state.mode, state.activeNodeId, state.focusedNodeId);
});

dualView.enter3DPreview();
dualView.focusNode('node-a');
dualView.selectNode('node-b');
dualView.updateNodePosition('node-a', [1, 2, 3]);

// Cleanup
dualView.destroy();
```

State is serializable. The controller does not own product routing, project
loading, or engine execution.

### Standalone Subpath Imports

Each spatial module is available as a standalone subpath export:

| Subpath | Module |
| --- | --- |
| `symbiote-ui/xr/spatial-index` | Octree spatial index |
| `symbiote-ui/xr/spatial-graph` | 3D graph model (spatial-graph-v1) |
| `symbiote-ui/xr/force-layout` | Force-directed 3D simulation |
| `symbiote-ui/xr/force-layout-adapter` | NodeEditor ↔ force-layout bridge |
| `symbiote-ui/xr/spherical-layout` | Fibonacci spherical layout |
| `symbiote-ui/xr/spatial-drag-controller` | Ray/sphere drag math |
| `symbiote-ui/xr/dual-view-controller` | 2D/3D/XR state bridge |
| `symbiote-ui/xr/three-spatial-graph` | Optional Three.js renderer adapter |

All modules are also re-exported from the barrel `symbiote-ui/xr`.

## Demos

- [`demo/cascade-theme-lab.html`](./demo/cascade-theme-lab.html) - agent workspace showcase with project-type top tabs, per-tab sidebar menus, a right collapsed page-agent chat layout panel, project file tree, source editor, markdown/source viewer, editable node canvas, canvas graph overview, chat and voice controls, runtime UI contracts, spatial node preview, component surfaces, and cascade theme editing.
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
