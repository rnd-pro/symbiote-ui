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
