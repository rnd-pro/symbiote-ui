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

Read-only inventory of the current CV candidate found 24 authored marker cues:
22 `underline` and 2 `arrow`. Refinement metadata is more varied (`oval`,
`ovals`, `route`, `bidirectional-route`, `parallel-route`, `number`), but that
metadata does not currently diversify the authored cue marker itself.

The following deterministic assignment is recommended for a later CV Project
authoring handoff. It is semantic, not seed-randomized:

| Authored cue(s) | Recommended marker | Why |
| --- | --- | --- |
| `positioning.tenure-marker` | `oval` | protects and groups one compact tenure value |
| `symbiote-engine.workspace-join` | `converging-arrows` | several workspace inputs converge into one read-only graph |
| `agent-portal.path`, `agent-pool.flow`, `mobile-smm.stable-path` | `route` | each scene explains an ordered execution path |
| `agent-portal.human-decision` | `oval` | a single decision checkpoint deserves bounded emphasis |
| `lifecycle.product-number`, `lifecycle.runtime-number` | `number` with authored labels `1` and `2` | the pair is an ordered enumeration, not generic text emphasis |
| `lifecycle.digital-twin`, `lifecycle-details.twin` | `bidirectional-route` | the subject is synchronized two-way state |
| `mobile-smm.agent-update`, `autobox.buddha`, `symbiote-ui-details.workspace-route`, `complexscan-details.autobox` | `arrow` | each cue points to one concrete artifact or link |
| `autobox.renders` | `multi-oval` | a gallery/collection merits stronger group emphasis |
| `complexscan.platform` | `box` | a precise platform boundary is the semantic subject |
| `finale.scale-route`, `workspace-details.flow-route`, `video-studio-details.route`, `lifecycle-details.route`, `autobox-details.working-route` | `route` | the named subject is explicitly a flow or route |
| `agent-pool-details.work`, `agent-pool-details.review`, `agent-pool-details.result` | `number` with authored labels `1`, `2`, `3` | three ordered stages read more clearly as a sequence |

This table is recommendation-only. Applying it requires edits to the CV
presentation Project, regenerated contract hashes/evidence, and the normal CV
release handoff. None of those consumer changes belong in this provider task.

## Reproducible references

Run `npm run references:presenter-markers`. It writes one all-gesture contact
sheet, one SVG reference sheet per marker, and a machine-readable manifest to
`artifacts/presenter-markers/`. Every per-marker sheet covers short, wide, and
multiline targets across three stable seeds. Oval sheets additionally display
the protected safe-area and both tail endpoints.
