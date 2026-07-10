# Changelog

All notable changes to `symbiote-ui` will be documented in this file.

## Unreleased

### Added

- Added bounded, cancellation-aware Media Studio frame-sequence playback,
  caption overlays, and external-clock timeline controls for synchronized
  audio, seek, pause, and resume workflows.
- Added a Node-safe installable render clock for deterministic UI animation,
  plus decoded-byte-bounded LRU proxy-frame caching with explicit bitmap release.
- Added seekable CanvasGraph pulses through `pulseNode(..., { startTime })` and
  `clearPulses()` for deterministic offline frame projection.
- Added `CanvasGraph.setFrameDriver()` and `presentFrame()` for synchronous
  externally driven canvas presentation without a competing animation-frame loop.
- Added cascade theme variants (`modern`, `classic`) and project tab shape
  controls (`frame`, `ear`, `classic-ear`) so hosts can restore the older Agent
  Portal tab geometry without product-local CSS.
- Added an independent `tabRadius` cascade control and public active-tab color
  tokens, and removed the experimental tab-strip separator line.
- Added an independent `cellRadius` cascade control so animated `cell-bg` dot
  sizes are no longer coupled to UI corner radius.
- Added `createDialogueStage`, `playDialogueTimeline`, `buildAlternatingTimeline`,
  and `createDialoguePlayer` for multi-voice narrated tours — overlapping
  per-persona speechSynthesis, a cue-driven timeline, and a play/pause/seek
  transport controller; plus `sanitizeVoiceResponseText` now runs inside the
  dialogue stage so spoken text is markdown/symbol-free.
- Added `createPresenterCursor` and `playCursorScenario`
  (`symbiote-ui/chat/presenter-cursor.js`) — an animated arrow cursor that
  drag-selects any element with a marching-ants marquee and travels between
  checkpoints along a curved path (`moveTo`/`clear`/`dispose`, Node-safe at
  import), plus a player for agent-authored
  `{ steps: [{ target, holdMs?, gesture?, label? }] }` scenarios with a host
  `resolveTarget`, per-step `onStep`, configurable `defaultHoldMs`, and
  `AbortSignal` support.
- Added `actions` and `embed` custom-content message parts to `ChatMessageItem`
  and the message model: an `actions` part
  (`{ type: 'actions', actions: [{ id, label, icon, variant }] }`) renders inline
  action buttons and emits `chat-message-action` / `chat-workspace-action`
  `{ id, actionId, payload }`, while an `embed` part (`{ type: 'embed', key }`)
  renders a keyed slot so `ChatTranscript` emits `chat-transcript-embeds-ready` /
  `chat-workspace-embeds-ready` `{ embeds: [{ key, slot }] }` for hosts to mount
  and re-attach live widgets.

### Fixed

- Fixed cascade theme widget/editor slider rows staying stale or failing to
  apply range input after switching theme variants, and tuned the `classic`
  preset to sharp, no-outline chrome while keeping its lightness and chroma
  controls fully live.
- Added themed content insets for `sn-description-list` and `sn-scroll-area`,
  and centered collapsed `layout-sidebar` items so library-composed workspaces
  do not need local padding fixes.

## [0.3.0-alpha.50] - 2026-06-27

### Fixed

- Kept markdown table row hover backgrounds on the active theme background
  instead of using the dark overlay/backdrop token.

## [0.3.0-alpha.49] - 2026-06-27

### Fixed

- Aligned the canvas graph info panel background with the global canvas
  background and prevented dark fallback panels in light cascade themes.

## [0.3.0-alpha.48] - 2026-06-27

### Fixed

- Kept the full cascade theme editor controls in separate grid rows after the
  geometry register toggle was added, preventing overlap in narrow layout
  panels.

## [0.3.0-alpha.46] - 2026-06-20

### Changed

- Expanded `llms.txt` into a current agent-facing resource map aligned with
  the public README, docs, skills, schemas, and component catalog.
- Updated the `symbiote-engine` dependency to `0.3.0-alpha.12`.
- Aligned the public README and package description with the shared
  jsda-kit-style package presentation.
- Split long README reference material into focused docs for entry points,
  runtime UI construction, cascade theming, layout/spatial contracts, and
  integration boundaries.

### Fixed

- Included the CLI audit module in the published package so `symbiote-ui
  discover` works from installed npm bin shims.

## [0.3.0-alpha.44] - 2026-06-11

### Added

- Added product-neutral `VoiceController` error helpers for shared
  microphone-denied and unsupported wake-listening messages.

## [0.3.0-alpha.43] - 2026-06-11

### Added

- Added `radius` as a cascade theme parameter with WebMCP/schema coverage and
  `--sn-theme-radius-scale` token output.

### Fixed

- Kept cascade theme radius recipe overrides relative to the global radius
  scale instead of only density.
- Improved cascade theme button text selection so light recipe primary actions
  keep readable contrast.
- Updated browser smoke coverage for the current showcase video workspace route
  and valid presentation/table design-policy parameters.

## [0.3.0-alpha.23] - 2026-06-08

### Added

- Added reusable base controls and display primitives for rating, segmented
  selection, native selection controls, sliders, and tooltips.
- Expanded agent-facing component metadata, Custom Elements output, and
  discovery coverage for the broader component catalog.
- Added segmented browser smoke execution so visual/layout scenarios run as
  independent release gates.

### Changed

- Hardened reusable buttons, fields, list items, tables, menus, project tabs,
  cards, banners, metrics, empty states, and loading overlays with stronger
  state, ARIA, keyboard, and intent contracts.
- Synchronized package test execution through the suite runner and lock helper
  so browser and non-browser tests do not collide.

### Fixed

- Made browser smoke tests require Chrome for Testing, Chromium, or an explicit
  `CHROME_BIN` instead of silently launching the unsupported macOS Chrome app
  wrapper.
- Tightened CDP page readiness checks so browser tests only pass after the
  expected URL and document body are present.

## [0.3.0-alpha.22] - 2026-06-08

### Added

- Added `canvas-graph` multi-node focus via `fitNodes()`, `flyToNodes()`,
  and `focusNodes()`, including WebMCP/discovery metadata for
  `canvas_graph_focus_nodes`.
- Extended `createGraphViewModeController().focusNode()` with `flatNodeIds` so
  flat graph demos can fit several visible nodes without drilling into a parent
  group.
- Added a main-thread `ForceLayout` fallback so bundled hosts still render
  `canvas-graph` when the standalone worker file is not served.

### Fixed

- Kept flat graph selection emphasis scoped to the selected node by default so
  multi-node focus does not fan out repeated pulse waves across every fitted
  neighbor.
- Refreshed cached `canvas-graph` drawing colors on `cascade-theme-change` and
  root/component theme mutations so flat canvas nodes, edges, and backgrounds
  inherit the active cascade theme without host-local redraw hacks.

## [0.3.0-alpha.20] - 2026-06-08

### Changed

- Updated the `symbiote-engine` dependency to `0.3.0-alpha.11` so browser-safe video packs stay on the published browser runtime contract.

## [0.3.0-alpha.19] - 2026-06-08

### Changed

- Updated the `symbiote-engine` dependency to `0.3.0-alpha.10` for the browser-safe engine runtime entrypoint.

## [0.3.0-alpha.18] - 2026-06-08

### Added

- Added `node-canvas` multi-node focus via `flyToNodes()` and `focusNodes()`,
  including WebMCP/discovery metadata for `node_canvas_focus_nodes`.

## [0.3.0-alpha.17] - 2026-06-08

### Fixed

- Kept repeated `node-canvas` drag gestures continuous in flow-scroll layouts by
  updating native scroll state instead of viewport pan transform state.

## [0.3.0-alpha.16] - 2026-06-08

### Fixed

- Added cascade theme `--sn-grid-dot` and `--sn-grid-size` output so `node-canvas` background dots inherit from the provider theme and respond to the pattern control.

## [0.3.0-alpha.12] - 2026-06-06

### Added

- Added the reusable `cascade-theme-editor` browser module for layout-hosted cascade theme editing.
- Added copy parameters, reset defaults, and automatic `localStorage` persistence for cascade theme controls.
- Added `componentDescription` and agent-facing WebMCP context to component descriptors and discovery output.
- Added `createComponentToolDescriptor()` for explicit WebMCP tools with component context.
- Added the reusable browser `VoiceRuntime` package contract to packed output and `symbiote-ui/ui`.
- Added the public `symbiote-ui/canvas` entrypoint for graph, PCB routing, diagnostics, project graph, and HTML-in-canvas helpers.

### Changed

- Updated the cascade theme lab to show the editor as a layout panel instead of owning local toolbar controls.
- Hardened `VoiceRuntime` for Agent Portal host adapters with instance capability getters, callback hooks, media-recorder start, and blob-to-base64 conversion.
- Extended `withGlobalPanel()` to carry panel behavior and split behavior into generated layout trees.

## [0.3.0-alpha.11] - 2026-06-04

### Fixed

- Extended the cascade theme contract to write the public Symbiote theme aliases for the background, text, node, panel, and context-menu surfaces plus `--sn-button-bg` and `--sn-field-control-bg` (flat aliases since removed by the wave-3 rename sweep).
- Documented the alias coverage so downstream apps can apply `applyCascadeTheme()` once at the root instead of duplicating theme formulas or component-local theme setters.

## [0.3.0-alpha.10] - 2026-06-04

### Added

- Added a reusable cascade theme contract with `createCascadeTheme()` and `applyCascadeTheme()`.
- Exposed cascade theme controls and WebMCP metadata through provider discovery.

### Changed

- Updated the cascade theme lab to consume the library API instead of owning local theme formulas.

## [0.3.0-alpha.6] - 2026-06-03

### Changed

- Updated package metadata to point at the standalone `symbiote-ui` repository.
- Updated the `symbiote-engine` dependency to `0.3.0-alpha.6`.

## [0.3.0-alpha.5] - 2026-06-03

### Fixed

- Kept browser UI exports off the `symbiote-engine` barrel so browser bundlers do not pull Node-only engine modules into UI builds.

## [0.3.0-alpha.4] - 2026-06-03

### Added

- Split UI/provider ownership from the former `symbiote-node` monolith.
- Added `symbiote-ui/webmcp` for explicit WebMCP descriptors and registration helpers.
- Added `component-descriptor-v2` with SSR and WebMCP contract metadata.
- Added provider discovery through `symbiote-ui/discover` and the `symbiote-ui discover` CLI command.

### Changed

- UI/provider imports now belong under `symbiote-ui`.
- Runtime execution imports now belong under `symbiote-engine`.
- `symbiote-node` remains only as the terminal migration facade.

## [0.3.0-alpha.0] — 2026-04-18

### Fixed
- **Memory leak**: zombie `setTimeout` loops in SubgraphNode preview rendering — replaced with on-demand redraws
- **Memory leak**: event listener accumulation in `NodeCanvas.setEditor()` — added explicit unsubscribe on context switch
- **Memory leak**: incorrect `cancelAnimationFrame` cleanup for `setTimeout` IDs in `NodeViewManager.removeView()`
- **Layout overlap**: nodes measured as 4px height (DOM not ready) caused overlap — enforced minimum `nodeHeight` floor in `getSize()`
- **Inspector z-index**: panel header overlapped toolbar buttons — removed header, added toolbar-aware padding

### Added
- `Editor.removeAllListeners()` — clean teardown method for editor event system
- `computeTreeLayout()` — directory-hierarchy-aware tree layout with indent levels
- Shape primitives: `CircleShape`, `DiamondShape`, `PillShape`, `RectShape`
- PCB dark theme enhancements: improved node styling, copper trace connections

### Breaking
- `InspectorPanel` no longer renders a title header bar — consumers relying on `.insp-header` CSS should update

## [0.2.1] — 2026-04-13

- Initial open-source release
- Node graph editor with Symbiote.js web components
- Sugiyama-based auto layout (`computeAutoLayout`)
- PCB/Carbon theming system
- Inspector panel with resize handle
- Subgraph navigation (drill-down/drill-up)
- Execution engine with topological sorting
