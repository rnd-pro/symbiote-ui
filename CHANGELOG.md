# Changelog

All notable changes to `symbiote-ui` will be documented in this file.

## Unreleased

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

- Extended the cascade theme contract to write public Symbiote theme aliases such as `--sn-bg`, `--sn-text`, `--sn-node-bg`, `--sn-panel-bg`, `--sn-ctx-bg`, `--sn-button-bg`, and `--sn-field-control-bg`.
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
