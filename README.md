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

console.log(listModules());
```

The root package and Node-safe entry points must import without creating DOM globals. Import safety does not mean every exported helper is useful without host data, a DOM adapter, browser hydration, or runtime-provided objects. Browser-only custom elements and module definition helpers belong behind `symbiote-ui/ui`.

## WebMCP

Component metadata uses `component-descriptor-v2` with bounded agent-facing contracts:

- `contract.ssr.mode` classifies SSR safety as `node-safe`, `ssr-entry-safe`, `jsda-ssr-renderable`, `hydrate-only`, or `client-only`.
- `contract.webmcp.tools[]` documents explicit tool descriptors with `name`, `description`, `inputSchema`, `annotations`, visibility, and permission hints.
- WebMCP exposure is explicit-first. The package does not enable global `Symbiote.mcpToolMode` by default.

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
