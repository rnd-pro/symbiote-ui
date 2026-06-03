# Changelog

All notable changes to `symbiote-ui` will be documented in this file.

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
