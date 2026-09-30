# Presenter marker geometry catalog

This document describes the reusable felt-tip geometry owned by Symbiote UI.
It does not assign authored CV cues or edit their authored time budgets. The
production source of truth is `chat/presenter-marker-geometry.js`; the live
presenter renderer and all reference exports consume that same module.

## Contract inventory

The current source tree exposes five attention modes: `cursor`, `frame`,
`native-selection`, `click`, and `marker`. Marker geometry has a seven-shape
core plus seven already-present extended shapes. The full public Show contract
therefore contains fourteen marker names, not seven total.

| Marker | Tier | Meaning | Safety policy |
| --- | --- | --- | --- |
| `freehand` | core | loose emphasis beneath a target | exterior |
| `underline` | core | text or value emphasis | exterior |
| `oval` | core | one protected group or decision | enclosure |
| `multi-oval` | core | strong repeated group emphasis | enclosure |
| `arrow` | core | directional pointer to one target | exterior |
| `converging-arrows` | core | two inputs converging on one point | exterior |
| `route` | core | ordered flow or traversal | exterior |
| `bidirectional-route` | extended | exchange or feedback loop | exterior |
| `parallel-route` | extended | parallel work or independent tracks | exterior |
| `label` | extended | named bounded region | enclosure |
| `number` | extended | ordered step or sequence rank | exterior |
| `box` | extended | precise bounded region | enclosure |
| `bracket` | extended | section or grouped rows | exterior |
| `slash` | extended | rejection or cancellation | intentional overlay |

Five separate symbol gestures remain available for compact semantic marks:
`question`, `cross`, `check`, `heart`, and `flourish`. They are not marker
shapes and are intentionally absent from the felt-tip reference sheets.

## Oval safety contract

`oval` and `multi-oval` expose a protected content safe-area inset from the
target bounds. The complete variable-width ribbon, including pressure and
seeded hand variation, must remain outside this area by at least 4 px. This
keeps the line away from text while allowing a compact enclosure when the DOM
target includes its own whitespace. The longitudinal tail continues past one
turn, then receives a deterministic lateral displacement; start and end caps
remain visibly separated. The ribbon itself owns geometrically rounded caps,
so the contract is preserved in SVG exports as well as live DOM rendering.

## Additional large-gesture investigation

Three extra ideas were evaluated and intentionally not added:

| Candidate | Decision | Reason |
| --- | --- | --- |
| broad highlight swipe | reject | crosses protected content and duplicates `underline`/`freehand` without fitting the variable-width ribbon safety model |
| radiating burst | reject | duplicates the existing `flourish` symbol and adds visual noise around dense UI |
| strike-through | reject | duplicates `slash`; rejection semantics should stay explicit rather than emerge from random decoration |

No new marker name is needed. The existing large, semantically distinct
`converging-arrows`, `bidirectional-route`, `parallel-route`, and `number`
shapes already cover convergence, feedback, parallelism, and ordered steps.

## CV master inventory

Read-only inventory of the current CV candidate found 25 authored marker cues:
12 `route`, 4 `oval`, 4 `arrow`, 2 `number`, 1 `underline`,
1 `bidirectional-route`, and 1 `parallel-route`. The scenario therefore uses
the public marker names directly instead of keeping semantic shape choices only
in refinement metadata.

The current deterministic assignment is semantic, not seed-randomized:

| Authored cue(s) | Marker | Why |
| --- | --- | --- |
| `positioning.tenure-marker`, `agent-portal.human-decision`, `mobile-smm.agent-update`, `complexscan.boothbot-catalog-ready` | `oval` | protects and groups one compact subject |
| `symbiote-ui.show-player-pointer`, `symbiote-ui.details-pointer`, `agent-portal.demo-link`, `symbiote-ui-details.workspace-route` | `arrow` | points to one concrete control, link, or artifact |
| `symbiote-engine.workspace-join` | `underline` | emphasizes the joining statement without enclosing a large block |
| `agent-portal.path`, `agent-pool.flow`, `mobile-smm.stable-path` | `route` | each scene explains an ordered execution path |
| `lifecycle.product-number`, `lifecycle.runtime-number` | `number` with authored labels `1` and `2` | the pair is an ordered enumeration, not generic text emphasis |
| `lifecycle.digital-twin` | `bidirectional-route` | the subject is synchronized two-way state |
| `lifecycle-details.twin` | `parallel-route` | the detailed branch compares linked paths in parallel |
| `finale.scale-route`, `workspace-details.flow-route`, `video-studio-details.route`, `agent-pool-details.work`, `agent-pool-details.review`, `agent-pool-details.result`, `lifecycle-details.route`, `autobox-details.working-route`, `complexscan-details.autobox` | `route` | the named subject is explicitly a flow, stage, or traversal |

This table is a read-only consumer inventory. The provider remains independent
of those cue ids; consumer edits still require regenerated hashes and the
normal CV release handoff.

## Reproducible references

Run `npm run references:presenter-markers`. It writes one all-gesture contact
sheet, one SVG reference sheet per marker, and a machine-readable manifest to
`artifacts/presenter-markers/`. Every per-marker sheet covers short, wide, and
multiline targets across three stable seeds. Oval sheets additionally display
the protected safe-area and both tail endpoints.
