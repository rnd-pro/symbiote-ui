# Entry Points

- `symbiote-ui` - Node-safe core primitives.
- `symbiote-ui/core` - graph editor data primitives.
- `symbiote-ui/layout` - SSR-safe layout, behavior, and lifecycle helpers.
- `symbiote-ui/graph` - provider graph normalization and projection helpers.
- `symbiote-ui/manifest` - component, schema, rule, theme, and provider catalogs.
- `symbiote-ui/runtime` - Node-safe agent UI construction helpers.
- `symbiote-ui/runtime/product-context` - Node-safe product context normalization for host-owned agent views.
- `symbiote-ui/ui` - browser Web Component registration and UI runtime.
- `symbiote-ui/webmcp` - WebMCP descriptor helpers and registration utilities.
- `symbiote-ui/xr` - WebXR provider helpers, spatial algorithms, 3D graph layout, and multi-view coordination.
- `symbiote-ui/locale` - Node-safe locale catalogs and translation helpers.
- `symbiote-ui/discover` - provider discovery JSON API used by the CLI.
- `symbiote-ui/chat/voice-input-defaults.js` - Node-safe wake/send/action voice command defaults and matching helpers.
- `symbiote-ui/chat/voice-controller.js` - browser wake listening and response speech orchestration for chat hosts.
- `symbiote-ui/chat/voice-arbitration.js` - Node-safe shared speaking-channel lock so notification narration yields to chat voice and never overlaps the microphone.
- `symbiote-ui/chat/notification-phrases.js` - Node-safe localized, randomized notification phrase bank with terse/chatty depth.
- `symbiote-ui/chat/notification-narrator.js` - browser `speechSynthesis` narration primitive that speaks phrase-bank phrases through the arbitration channel.
- `symbiote-ui/custom-elements.json` - Custom Elements manifest.
- `symbiote-ui/schemas/*`, `symbiote-ui/tokens/*`, `symbiote-ui/rules/*` - machine-readable provider contracts.
- `symbiote-ui/display/*` - reusable display utilities exposed by package export map.

For the complete export map and provider catalog, run:

```sh
symbiote-ui discover
```

Use `symbiote-node` only as the terminal migration facade for older consumers.
