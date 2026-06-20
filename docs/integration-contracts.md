# Integration Contracts

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
