# XR Spatial Window Assembly Contract

Current-behavior reference for the product-neutral spatial-window assembly exposed
through `symbiote-ui/xr/spatial-window-assembly` (`createXRSpatialWindowAssembly`)
and its pure contract module `symbiote-ui/xr/spatial-window-contract`.

One open layout instance maps to one independently movable XR window. A layout's
internal panel tree is the complete live DOM content of that one window and is
never projected as additional spatial windows.

## Composition, not duplication

The assembly orchestrates the existing provider primitives; it does not fork them:

- HTML-in-Canvas renderer (`createXRHtmlCanvasRenderer`) for DOM content textures;
- panel host and input relay (`createXRPanelHost`) for the live DOM and
  `xr-panel-pointer` / `xr-panel-action` dispatch;
- Three/WebXR adapter and texture bridge (`createXRThreeWebXRAdapter`,
  `createXRThreeHtmlCanvasTextureResolver`, `createXRThreePanelTextureBridge`)
  for the native shell, dirty-key-gated texture reuse, and material state;
- Meta-style external chrome (`computeXRPanelChromeLayout`, `createXRPanelFrame`,
  `hitTestXRPanelFrame`, `createMetaWindowChromeTexture`) for grab strip, corner
  resize handles, edge grips, and control-bar actions;
- portable panel state (`createXRPortablePanelStore`) for pose
  serialize/restore across session adopt/release;
- layout projection (`createXRSpatialScene`, `createXRPanelContentViewport`) for
  meters-first window placement and CSS content viewports;
- deterministic default placement (`computeXRSpatialWindowDefaultSlotPose`,
  `resolveXRSpatialWindowDefaultPlacement`) for descriptors that omit `pose`;
- theme bridge (`createXRThemeSnapshot`, `applyXRThemeToPanel`) and chrome design
  tokens (`resolveXRDesignTokens`) for cascade theme projection;
- frame timing (`createXRFrameTimingTracker`) for frame evidence;
- structured fallback (`createXRPanelTextureSourceSummary` semantics) modeled as
  data, never thrown control flow.

DOM (`document`), `globalThis`, and `THREE` are factory-injected, so module
evaluation and full reconciliation logic run in Node and SSR hosts.

## Layout descriptor (`xr-spatial-window-layout-v1`)

`syncLayouts(layouts)` reconciles the complete set of open layout instances.
Each descriptor carries:

```js
{
  version: 'xr-spatial-window-layout-v1',
  layoutId,        // required stable identity
  windowId,        // optional; defaults to `window:${layoutId}` and is immutable per layoutId
  contentKind,     // 'dom' (default) | 'volumetric'
  title,           // chrome title or null
  pose: { position: [x, y, z], rotation: [rx, ry, rz] },  // optional; meters + Euler degrees
  sizeMeters: [w, h],
  viewport: { width, height },   // CSS content viewport in pixels
  contentRevision, // non-negative integer; bump invalidates the texture
  themeRevision,   // non-negative integer
  state: { focused, pinned, hidden, closable },
  themeScope, contentHash,       // nullable strings
  volumetric: [],  // optional volumetric attachments (pass-through data)
}
```

A supplied `pose` always wins exactly: it is validated, rounded to 1e-6 m/deg,
and never reflowed, comfort-adjusted, or re-anchored by the provider. When
`pose` is omitted the window is *unplaced* and the provider assigns a
deterministic default placement (see below). Supplying a changed explicit pose
for an already open layout moves that window to the new pose and makes it the
window's reset canonical; omitting `pose` in later syncs keeps the current
pose untouched.

The live DOM host is runtime-only input: `dom.element` (adopted live element)
or `dom.component` / `dom.layoutNode` / `dom.props` (built once by the panel
host). DOM references never appear in receipts; `getWindowDataProjection(id)`
returns the data-only descriptor projection.

## Default window placement (`xr-spatial-window-placement-v2`)

Unplaced windows never share the neutral `XR_SPATIAL_WINDOW_DEFAULT_POSE`
placeholder that normalization fills in. The assembly assigns each new unplaced
window the lowest-capacity free slot from the pure Node-safe
`symbiote-ui/xr/spatial-window-placement` contract:

- `XR_SPATIAL_WINDOW_PLACEMENT_DEFAULTS`: 1.96 m outer arc radius with four
  columns (0.9 m chord), 1.15 m inner arc radius with three columns (0.81 m
  chord), 0.46 m level spacing around a 1.5 m preferred row height, 0.05 m
  floor clearance.
- The lattice is a bounded 3D arrangement, not a growing row sequence: two
  radial arc tiers times a small set of vertical levels. Level heights and
  column angles derive from the `createXRPanelPoseComfortSummary` envelope
  (1.0-2.2 m distance, ±42° horizontal, −28°..+16° vertical at 1.55 m eye
  height), so every default slot is comfortable, above the floor, yawed to
  face the viewer, and non-overlapping for default 0.8 m × 0.45 m windows.
- Geometry adapts to each candidate's actual `sizeMeters`: chord and level
  spacing grow with width and height, so wide/tall windows get a smaller
  lattice and very large windows may fit only a single slot.
- Capacity is bounded by `XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY` (24, the
  consumer-supported layout bound). When no safe non-overlapping slot exists,
  `resolveXRSpatialWindowDefaultPlacement` returns frozen structured data
  (`ok: false, reason: 'placement-capacity-exhausted', capacity, pose: null`)
  and the sync receipt carries a per-layout `placement-capacity-exhausted`
  error with the capacity instead of adding a window. An unsafe slot is never
  generated and windows never silently overlap.
- Slot occupancy derives from live record poses only (no parallel store): a
  slot is blocked while a live window center sits within half the combined
  window width horizontally and half the combined height vertically of the
  slot center. Explicitly posed windows therefore push unplaced windows to
  the next free slot, and slots freed by removal or by dragging a window away
  become reusable.
- Batch resolution is explicit-first: within one `syncLayouts` call, default
  placement resolves against all explicit descriptor poses in the batch, so
  input ordering can never place a default window on an explicit descriptor's
  pose. Existing mounted windows are never reflowed during sync.
- Determinism: the same ordered initial descriptors always produce the same
  placement. A stable re-sync that omits `pose` keeps every existing record
  pose, including user-settled poses after drag; opening one new unplaced
  layout mid-session moves no existing window.

Window summaries and diagnostics expose the assigned slot as `defaultSlot`,
or `null` for descriptor-posed windows and for windows that no longer occupy
their assigned slot pose, so a vacated slot never shows duplicate live owners.
`resetWindowPose` and the chrome reset action are transactional: they restore
the canonical pose while it is currently free, otherwise re-resolve the lowest
safe default slot against the other live windows (which becomes the new
canonical pose), and otherwise return a structured
`placement-capacity-exhausted` failure without moving the window. A reset
never overlaps a live window. The canonical pose tracks the latest explicit
descriptor pose, so resetting an explicitly posed window returns it to that
pose (or re-resolves a safe default slot when another window now occupies it).

## Idempotent reconciliation (`xr-spatial-window-sync-receipt-v1`)

`syncLayouts` diffs by `layoutId` and reports per-window `added`, `updated`
(with a `changes` field list), `removed`, and `unchanged` actions plus data-only
`errors` (`missing-layout-id`, `invalid-*`, `duplicate-layout-id`,
`window-id-conflict`, `placement-capacity-exhausted` with the bounded
capacity). Re-syncing an identical set yields only `unchanged`
entries and performs zero scene work and zero uploads. Windows absent from the
input are unmounted and removed.

## Lifecycle and session adopt/release

`enter({ sessionId })` is idempotent (`alreadyEntered: true` on re-entry while
entered) and mounts every window exactly once. `exit()` serializes poses into
an `xr-portable-panel-state-v1` snapshot and clears the native scene.
Re-entering restores poses through the portable store and reports
`poseRestore.restored` — open layouts, window identity, and poses survive
enter/exit/re-entry without duplicates. `adoptSession({ sessionId })` /
`releaseSession()` bind and release pose state explicitly for hosts that manage
the WebXR session themselves; releasing without an adopted session returns
`released: false, reason: 'no-adopted-session'` as data.

`focusWindow(windowId)`, `settleWindowPose(windowId, pose)`, and
`resetWindowPose(windowId)` emit `xr-spatial-window-lifecycle-receipt-v1`
receipts with a fixed envelope (`version`, `action`, `ok`, `reason`, `details`).

## Ray routing (`xr-spatial-window-relay-receipt-v1`)

`routeRay(ray, input)` hit-tests controller and hand rays (`input.source` is
free-form, e.g. `'xr-controller'`, `'xr-hand'`, `'mouse-fallback'`) against the
enlarged chrome surface derived from the public chrome zone layout:

- Chrome zones (`move`, `edge`, `resize`, `action`) stay external: move/edge
  begins a tracked gesture (`move-begin`), resize begins the resize state
  machine (`resize-begin`), and control-bar actions apply `close` (honors
  `closable: false`), `pin`, `reset`, or emit a host-owned `fullscreen-intent`.
  Wheel and scroll inputs never trigger chrome actions.
- Content zones relay a normalized `0..1` point to the live DOM through the
  panel host (`xr-panel-pointer`, plus PointerEvent synthesis when available),
  with select pairing and hit-map resolution (`xr-panel-action`) unchanged.
  An explicit `input.point` overrides the ray-derived content point for
  tracked drag sequences.

Hidden windows are never routed. Misses and malformed rays are data
(`no-window-hit`, `no-zone-hit`, `invalid-ray`).

## Scroll relay (`xr-spatial-window-scroll-receipt-v1`)

Wheel input and select-drag scroll reach the live DOM through one gesture
contract, nested as `relay.scroll` in the relay receipt:

- `input.type: 'wheel'` runs an atomic begin → update → end gesture with
  `input.delta` (content pixels by default; `delta.mode: 'normalized'` scales
  by the content viewport, `'lines'` by 40 px).
- `input.type: 'scroll'` with `phase: 'begin' | 'update' | 'end' | 'cancel'`
  drives select-drag scrolling explicitly. When `delta` is omitted on update
  or end, the grab delta derives from normalized point movement
  (`(last − current) × viewport`), so content follows the pointer.
- Capture identity (`sourceId`, `sessionId`, `pointerId`) is stable across the
  gesture; foreign sources and out-of-phase calls are data
  (`scroll-not-active`, `scroll-already-active`, `scroll-capture-mismatch`).
- The provider scrolls the real live DOM target (explicit
  `input.scrollTarget` selector/element, else the nearest `[data-xr-scroll]`,
  else the panel root) with `scrollBy` or offset assignment and reports
  `before`/`after`/`applied` offsets plus `totals` as data. Cancel never
  rewinds applied scroll. A real `WheelEvent` is dispatched first when the
  platform constructor exists, and content `preventDefault` suppresses the
  applied scroll.
- Applied scroll requests paint on the window canvas, bumps the window's
  content epoch (fifth texture-key segment), and re-uploads exactly that
  window's texture; every other window stays reused/idle. Scroll offsets live
  in the live DOM subtree, which is never remounted on exit/re-entry, so
  offsets survive when the host restores product state.

## Text selection (`xr-spatial-window-selection-receipt-v1`)

`pointerdown` (primary) opens a tracked pointer capture; `pointermove` updates
it; `pointerup` ends it and reads the platform selection from the live DOM
(`document.getSelection()` or the focused editable's `selectionStart/End`);
`pointercancel` cancels it. The relay receipt carries `relay.capture` on every
phase and `relay.selection` on end/cancel. The provider never fabricates
selection: when the platform cannot report it, the receipt says
`selection: null` with `reason: 'selection-api-unavailable'`. Real
`setPointerCapture`/`releasePointerCapture` calls happen where the platform
supports them. `pointercancel` also cancels any active scroll capture for the
same source, keeping cancellation complete.

## Content focus and IME handoff (`xr-spatial-window-focus-receipt-v1`)

`focusWindowContent(windowId, { target, ... })` resolves the target inside the
window's live DOM (element reference, CSS selector, or `targetId` matched
against `data-xr-target-id`/`id`), calls the real `focus()`, and reports:

- `target`: `{ targetId, tagName, editable, focusable }` — data only;
- `focused`: `true`/`false` from `document.activeElement`, or `null` when the
  platform cannot report focus;
- `ime.mode`: `'dom-focus'` when a real editable target holds (or is believed
  to hold) focus, so the headset/browser IME can attach to the live DOM;
  `'dom-overlay'` with a reason (`target-not-editable`, `focus-rejected`,
  `focus-unavailable`) plus a structured handoff (`inputType`, `multiline`,
  `hasValue`, `valueLength`) when IME cannot operate directly;
  `'unavailable'` when no target was found.

The handoff never clones form values and never synthesizes keyboard text.
`blurWindowContent` and `cancelWindowContentFocus` release the real DOM focus;
cancel additionally releases the source's selection and scroll captures and
reports `releasedCapture`.

## Viewport update (`xr-spatial-window-viewport-receipt-v1`)

`updateWindowViewport(windowId, { viewport, sizeMeters? })` is the public
per-window CSS viewport operation used by resize commit. It updates the live
element and canvas container CSS width/height/content viewport without
remounting or replacing the DOM subtree, preserving focus, form values,
selection, and scroll offsets (`preserved` evidence, `remounted: false`). It
then requests paint, re-uploads the texture, swaps geometry through the
adapter's per-panel `setPanelSize` (no full-scene churn, mesh identity
preserved), and returns a transaction receipt whose `texture` carries measured
`width`/`height` pixels. Texture upload failure rolls the viewport back
(`rolledBack: true`) and keeps the failure explicit. Invalid viewports, sizes,
and unknown windows are data (`invalid-viewport`, `invalid-size`,
`window-not-found`).

## Resize preview/commit/cancel (`xr-spatial-window-resize-receipt-v1`)

- `beginResize(windowId, { handle })` opens the resize session at the committed
  size.
- `previewResize(windowId, sizeMeters)` changes only the native shell: a
  `sn-xr-window-resize-preview` plane previews the target size and chrome hit
  zones relayout, while the content texture, geometry, and CSS viewport stay at
  the committed values (`contentScaled: false`, zero uploads). Raster renderers
  preview by scaling the mounted group and keep the committed hit topology and
  target generation stable until release, so an active resize capture cannot
  invalidate itself during the gesture.
- `commitResize()` runs browser CSS layout at the final viewport through
  `updateWindowViewport` (the live element keeps its state; only viewport
  styles change), uploads the texture first, and only then swaps texture and
  geometry on the same native mesh (`setPanelSize`, mesh identity preserved).
  On upload failure the commit rolls back (`rolledBack: true`, committed size,
  viewport, and styles restored) and the failure remains explicit fallback
  data. The receipt's `texture` carries measured `width`/`height` pixels.
- `cancelResize()` restores the shell with no uploads and no layout churn.

Out-of-phase calls are data (`resize-not-active`, `resize-already-active`,
`invalid-resize-handle`, `window-not-found`).

## Fallback as data (`xr-spatial-window-fallback-v1`)

Per-window fallback is first-class data: `mode` is `'none'`,
`'provider-material-fallback'` (native shell present), or `'dom-overlay'`
(no native shell or no DOM host), with `source`, `reason`, and the last upload
outcome. Unsupported capability and runtime upload failure never throw out of
`enter`, `syncLayouts`, or resize.

## Dirty gating and theme

Texture uploads are keyed by `contentRevision`, `themeRevision`, viewport, and
a theme epoch; the resolver reuses textures (`-reused` stages) whenever the key
is unchanged, so idle windows perform zero uploads. `syncFrame({ timestamp })`
returns `xr-spatial-window-frame-v1` with per-frame upload deltas (zero while
idle) and `xr-frame-timing-v1` metrics, including p50/p95/p99 intervals, total
missed frames, and the longest consecutive missed-frame run. `applyTheme(snapshot)` projects the
cascade theme onto window materials and chrome tokens and re-uploads only
affected windows.

## Diagnostics (`xr-spatial-window-assembly-diagnostics-v1`)

`getDiagnostics()` reports assembly status, session (adopt/release counts),
per-window lifecycle, live `defaultSlot` ownership (`null` for
descriptor-posed windows and for windows that vacated their assigned slot),
upload (dirty, resolves, uploads, reuses, last stage and
reason, measured `textureWidth`/`textureHeight`), relay (events, actions,
scrolls, selections), content focus (`targetId`, `editable`, `imeMode`),
resize (phase), fallback, chrome (named zones/actions, normalized zone rectangles, physical surface size/extents, geometry, and deterministic overlap/intersection calculations with verdict), counters (including `scrollGestures`,
`selectionGestures`, `contentFocusHandoffs`, `viewportUpdates`), frame timing,
theme, shell, support, and the active gesture. All public outputs are
JSON-round-trippable and contain no DOM, Three, or private references.
