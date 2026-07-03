# Cascade Theme Architecture — Tiered Token System

Status: TARGET architecture (adopted 2026-07-03). Governs all theme/token work in symbiote-ui.
Companion machine contract: `tokens/tiers.js` (tier membership + aliasing direction the audit
enforces). Supersedes the flat token list as the source of order; existing rules SYM-014…SYM-017
remain in force and this document is their concrete shape.

## Why (state of the world this replaces)

The library exposes ~1200 flat `--sn-*` custom properties with no tier discipline: source knobs
(`--sn-theme-hue`), semantic roles (`--sn-bg`, `--sn-text`), domain palettes (`--sn-type-*`,
`--sn-graph-type-*`, 25+ node-type hues), and per-component values (`--sn-button-primary-bg`,
`--sn-tab-accent-3`) all live in one namespace and one cascade list. The DTCG catalog
(`tokens/base.json`) describes 9 of them. There is no elevation ladder, no state-layer system
(only `--sn-focus-ring-*` exists — hover/pressed/selected are hand-rolled per component), and
components carry hardcoded colors (display: 128, control: 102, chat: 24 at adoption time).
Result: themes cascade, but components look assembled ad-hoc — exactly the user-visible symptom.

## Reference model

Material Design 3's three-tier token system (reference palettes → system roles → component
tokens), adapted for **professional tool UIs** (graphic/video editors: Figma, Blender, Resolve):
dense-first geometry, a dark-first surface ladder for panel chrome vs canvas vs floating
surfaces, uniform state layers, and domain palettes as extension blocks rather than core roles.
We keep our HSL cascade engine as the generator (it plays the role MD3's HCT source-color does);
switching the color math to HCT/OKLCH later is an isolated generator change and does not affect
this contract.

## The four tiers + domain blocks

```
T0 source knobs      --sn-theme-*        human/agent inputs (exist today)
T1 reference ramps   --sn-ref-*          generated lightness ramps per hue family
T2 system roles      --sn-sys-*          THE semantic contract (~48 roles)
T3 component tokens  --sn-<comp>-*       aliases of T2 only
DOM domain blocks    --sn-dom-<domain>-* extension palettes (graph types, categories, tabs)
```

Aliasing direction is one-way and enforced: `T3 → T2 → T1 → T0`, `DOM → T1/T2`. A component
token may never reference a ref ramp or a literal; a sys role may never reference a component
token. Fallback chains in `*.css.js` must terminate in a T2 role — never in a literal color.

### T0 — source knobs (exists, unchanged)

`mode, brightness, contrast, chroma, hue, bgLightness, surfaceLightness, accentLightness,
accentChroma, …` (`themes/cascade-theme-controls.js`). Recipes (`themes/theme-recipes.js`)
stay the preset layer over the knobs.

### T1 — reference ramps (new, generated)

For each hue family the cascade generates a 13-stop lightness ramp (0,5,10,…,95,100 — stop
names are lightness, not index):

- `--sn-ref-neutral-N` — from mode/brightness/contrast (surfaces, text, borders)
- `--sn-ref-accent-N` — from hue/chroma
- `--sn-ref-success-N`, `--sn-ref-warning-N`, `--sn-ref-danger-N`, `--sn-ref-info-N` — from
  semantic hue offsets (existing `--sn-hue-*` machinery)

Ramps make every derived value auditable (a sys role is a pointer into a ramp, not an opaque
`hsl()` computation) and give domain blocks a lawful base. Ramps are IMPLEMENTATION, not public
API: components never consume them.

### T2 — system roles (the contract, ~48 roles)

Grouped by rule blocks (SYM-014). Names below are the normative list; `tokens/tiers.js` is the
machine copy.

**Surface ladder (pro-tool chrome, dark-first):**

| Role | Editor meaning | MD3 analog |
|---|---|---|
| `--sn-sys-surface-sunken` | canvas / viewport wells | surface-container-lowest |
| `--sn-sys-surface` | page background | surface |
| `--sn-sys-surface-panel` | docked panels, sidebars | surface-container-low |
| `--sn-sys-surface-raised` | cards, list items, nodes | surface-container |
| `--sn-sys-surface-toolbar` | toolbars, headers | surface-container-high |
| `--sn-sys-surface-overlay` | popovers, menus, floating palettes | surface-container-highest |
| `--sn-sys-scrim` | modal backdrop | scrim |

Each step is a fixed neutral-ramp offset from `--sn-sys-surface`; the ladder is monotonic in
dark mode (raised = lighter) and inverts correctly in light mode — components never hand-pick
lightness.

**Content:** `--sn-sys-on-surface`, `--sn-sys-on-surface-dim`, `--sn-sys-on-surface-faint`,
`--sn-sys-on-accent`, `--sn-sys-on-status` (readable-text formula already exists as
`getReadableTextForHsl`).

**Outline:** `--sn-sys-outline-subtle` (hairlines, dividers), `--sn-sys-outline` (inputs,
cards), `--sn-sys-outline-strong` (emphasis), `--sn-sys-outline-focus` (alias of focus ring).

**Accent & status:** `--sn-sys-accent`, `--sn-sys-accent-container`, and per status
(success/warning/danger/info): `--sn-sys-<status>`, `--sn-sys-<status>-container`,
`--sn-sys-on-<status>-container`. Containers are the chip/badge/banner fill tier — the missing
piece behind today's outline-only chips.

**State layers (SYM-017, the biggest gap):**

```
--sn-sys-state-hover-mix:    8%;
--sn-sys-state-pressed-mix:  12%;
--sn-sys-state-selected-mix: 16%;
--sn-sys-state-dragged-mix:  20%;
--sn-sys-state-disabled-opacity: 0.38;
```

Canonical pattern (the ONLY sanctioned hover/press/select styling in components):

```css
background: color-mix(in srgb, var(--sn-sys-accent) var(--sn-sys-state-hover-mix), var(--sn-sys-surface-raised));
```

**Focus:** `--sn-sys-focus-ring`, `--sn-sys-focus-ring-width`, `--sn-sys-focus-ring-offset`
(absorbs today's `--sn-focus-ring-*`).

**Elevation/effects:** `--sn-sys-shadow-raised`, `--sn-sys-shadow-overlay` (geometry from the
register profile, color from neutral ramp). Motion stays in `themes/Motion.js` tokens.

**Geometry:** unchanged — the register/rung system in `tokens/scale.js` already implements the
tiered model for space/radius/size (`base × density` knobs, `product/tool/spacious` profiles).
Pro-tool vector = the `tool` register; components must consume rungs only (SYM-015). One
addition: `--sn-sys-density` exposed as a read-only indicator so components can branch layout
(e.g. hide card summaries under `tool` density) without inventing their own breakpoints.

### T3 — component tokens

`--sn-<component>-<slot>[-<state>]`, defined in the component's `*.css.js` header as aliases of
T2 with T2 fallbacks: `--sn-kanban-card-bg: var(--sn-sys-surface-raised)`. Rules:

- a component introduces a token ONLY for a slot a consumer legitimately re-skins;
- no component invents colors, mixes, or state effects outside the T2 vocabulary;
- existing `--sn-button-*`, `--sn-tab-accent-*`, `--sn-kanban-*`, `--sn-scrollbar-*` migrate to
  aliases; their VALUES move into T2 or die.

### DOM — domain palettes

Graph-editor vocabulary (`--sn-type-*` ×25, `--sn-graph-type-*` ×25, `--sn-cat-*` ×5,
`--sn-tab-accent-*` ×6, resource-group hues consumed by agent-portal) moves to
`--sn-dom-graph-type-*`, `--sn-dom-category-*`, `--sn-dom-tab-*`, `--sn-dom-group-*` — derived
from T1 ramps by hue-rotation formulas (exactly what `theme-recipes.js` relations already do).
Domain blocks are opt-in per surface, keeping the core contract at ~48 roles instead of 120+.

## Legacy names and migration

`--sn-bg`, `--sn-text`, `--sn-text-dim`, `--sn-node-bg`, `--sn-panel-bg`, `--sn-node-border`,
`--sn-node-selected`, status colors, etc. are consumed ~1200 times across this repo and
consumers (agent-portal). They become **frozen T2 aliases** during migration (e.g.
`--sn-bg: var(--sn-sys-surface)`) and are REMOVED in wave 3 — a scheduled rename sweep, not a
permanent compatibility layer (no-legacy-compat). `custom-elements.json` + `discover` must list
tier + status (`system|legacy-alias|component|domain`) for every token so agents see the
contract, not the flat dump.

## Enforcement (what makes the order stick)

1. `tokens/tiers.js` — machine-readable tier membership, aliasing direction, state-mix values.
2. `audit.js` gains three checks (wave 1): `token-tier-direction` (T3 never references T1/T0;
   nothing references T3), `no-literal-color-in-components` (`*.css.js` outside `themes/` and
   `tokens/`: zero `#hex`/`hsl()`/`rgb()` literals — semantic exceptions whitelisted in
   tiers.js), `state-layer-usage` (hover/active selectors must use the state-mix pattern —
   warning first, error at wave 3).
3. DTCG catalogs regenerated from tiers.js (`tokens/system.json`), replacing the 9-token stub —
   the discover/catalog output becomes the real public contract.

## Component maturity (measured 2026-07-03, drives wave 2 order)

Hardcoded color literals per directory: display 128, control 102, chat 24, menu 12, list 9,
timeline 6, surface 5, navigation 5, viewport 3, toolbar 1. State-layer coverage: focus-ring
only (25 uses); zero shared hover/pressed/selected tokens. Board/KanbanBoard additionally has
the footer chip-clipping and in-card menu defects logged in the agent-portal UI/UX audit
(team-memory: `delegation/workflow-board-ui-ux-audit-2026-07-03.md`).

## Waves

- **W1 — foundation (this repo, additive):** emit T1 ramps + T2 roles from the cascade engine;
  legacy names become aliases; `tokens/tiers.js`; regenerate DTCG catalogs; audit checks land
  as warnings. No component visually changes.
- **W2 — component re-base (top offenders first):** display → control → chat → board(Kanban:
  chips/footer/menu popover/summary clamp) → menu → list. Each component: literals → T2 roles,
  hovers → state layers, local tokens → T3 aliases, geometry → rungs. Audit numbers must go to
  zero per directory as each lands.
- **W3 — rename sweep:** consumers (agent-portal + demos) migrate off legacy aliases; aliases
  deleted; audit checks flip to error; domain palettes complete their `--sn-dom-*` move.

Provider discipline: every wave is committed and released in symbiote-ui, consumers bump the
dependency — never patched from product CSS (the agent-portal UI audit found product styling
reaching into `sn-kanban` internals; W2 gives those needs first-class T3 slots instead).
