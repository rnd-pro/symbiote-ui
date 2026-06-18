# symbiote-engine

`symbiote-engine` owns the Symbiote runtime layer:

- graph primitives
- workflow execution
- runtime CLI commands
- server helpers
- registry, persistence, lifecycle, and handler loading
- runtime packs

It must stay independent from browser UI runtime modules.

```js
import { Graph, Executor, loadHandlers } from 'symbiote-engine';
```

Browser UI code must use the browser-safe runtime entrypoint so client imports
do not pull Node-only server, CLI, handler-loader, or file-watch modules:

```js
import { Graph, Executor, deserialize } from 'symbiote-engine/browser';
```

Use `symbiote-ui` for provider catalogs, Web Components, layout metadata, and WebMCP descriptors.

## Related Packages

- [`symbiote-ui`](https://github.com/RND-PRO/symbiote-ui) - Web Components, provider catalogs, layout metadata, and WebMCP descriptors.
- [`symbiote-node`](https://github.com/RND-PRO/symbiote-node) - terminal migration facade for older imports.
- [Package split guide](https://github.com/RND-PRO/symbiote-node/blob/main/docs/package-split.md)
