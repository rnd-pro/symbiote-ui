/**
 * Token tier contract — the machine-readable half of docs/cascade-theme-architecture.md.
 *
 * Defines tier membership, the one-way aliasing direction, the normative system-role list, and
 * the state-layer mix values. `audit.js` checks and the DTCG catalog generator consume this
 * module; themes and components must not import it at runtime (it is contract data, not style).
 *
 * Node-safe: pure data, no DOM.
 *
 * @module symbiote-ui/tokens/tiers
 */

/** Tier ids, outermost knob to leaf component slot. Aliasing may only point RIGHT → LEFT. */
export const TOKEN_TIERS = Object.freeze(['source', 'ref', 'sys', 'component', 'domain']);

/** Prefix → tier classification for any `--sn-*` custom property. Order matters: first match wins. */
export const TIER_PREFIXES = Object.freeze([
  { prefix: '--sn-theme-', tier: 'source' },
  { prefix: '--sn-ref-', tier: 'ref' },
  { prefix: '--sn-sys-', tier: 'sys' },
  { prefix: '--sn-dom-', tier: 'domain' },
]);

/**
 * The normative T2 system-role list (~48 roles). A sys token that is not in this list is a
 * contract violation; adding a role is a deliberate, documented act (architecture doc first).
 */
export const SYSTEM_ROLES = Object.freeze([
  // surface ladder (pro-tool chrome, dark-first monotonic)
  '--sn-sys-surface-sunken',
  '--sn-sys-surface',
  '--sn-sys-surface-panel',
  '--sn-sys-surface-raised',
  '--sn-sys-surface-toolbar',
  '--sn-sys-surface-overlay',
  '--sn-sys-scrim',
  // content
  '--sn-sys-on-surface',
  '--sn-sys-on-surface-dim',
  '--sn-sys-on-surface-faint',
  '--sn-sys-on-accent',
  '--sn-sys-on-status',
  // outline
  '--sn-sys-outline-subtle',
  '--sn-sys-outline',
  '--sn-sys-outline-strong',
  '--sn-sys-outline-focus',
  // accent + status families (container = chip/badge/banner fill tier)
  '--sn-sys-accent',
  '--sn-sys-accent-container',
  '--sn-sys-success',
  '--sn-sys-success-container',
  '--sn-sys-on-success-container',
  '--sn-sys-warning',
  '--sn-sys-warning-container',
  '--sn-sys-on-warning-container',
  '--sn-sys-danger',
  '--sn-sys-danger-container',
  '--sn-sys-on-danger-container',
  '--sn-sys-info',
  '--sn-sys-info-container',
  '--sn-sys-on-info-container',
  // state layers (the ONLY sanctioned hover/press/select/drag styling inputs)
  '--sn-sys-state-hover-mix',
  '--sn-sys-state-pressed-mix',
  '--sn-sys-state-selected-mix',
  '--sn-sys-state-dragged-mix',
  '--sn-sys-state-disabled-opacity',
  // focus
  '--sn-sys-focus-ring',
  '--sn-sys-focus-ring-width',
  '--sn-sys-focus-ring-offset',
  // elevation / effects (geometry from register profile, color from neutral ramp)
  '--sn-sys-shadow-raised',
  '--sn-sys-shadow-overlay',
  // geometry indicator (read-only; components may branch layout on it, never redefine it)
  '--sn-sys-density',
]);

/** MD3-aligned state-layer mix values; single source for themes and the audit. */
export const STATE_LAYER_MIX = Object.freeze({
  hover: '8%',
  pressed: '12%',
  selected: '16%',
  dragged: '20%',
  disabledOpacity: 0.38,
});

/** Ramp stop names (lightness values) every T1 hue family exposes: --sn-ref-<family>-<stop>. */
export const REF_RAMP_STOPS = Object.freeze([0, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100]);

/** T1 hue families the cascade generator must emit ramps for. */
export const REF_RAMP_FAMILIES = Object.freeze(['neutral', 'accent', 'success', 'warning', 'danger', 'info']);

/**
 * Legacy flat names frozen as T2 aliases during migration (wave 1 → removed in wave 3).
 * Key = legacy token, value = the sys role it must alias. The audit treats a legacy token
 * DEFINITION anywhere outside the theme alias block as an error from wave 1 on.
 */
export const LEGACY_SYS_ALIASES = Object.freeze({
  '--sn-bg': '--sn-sys-surface',
  '--sn-layout-bg': '--sn-sys-surface-sunken',
  '--sn-panel-bg': '--sn-sys-surface-panel',
  '--sn-node-bg': '--sn-sys-surface-raised',
  '--sn-ctx-bg': '--sn-sys-surface-overlay',
  '--sn-surface': '--sn-sys-surface-raised',
  '--sn-text': '--sn-sys-on-surface',
  '--sn-text-dim': '--sn-sys-on-surface-dim',
  '--sn-node-border': '--sn-sys-outline',
  '--sn-lit-border': '--sn-sys-outline-subtle',
  '--sn-node-selected': '--sn-sys-accent',
  '--sn-node-hover': '--sn-sys-state-hover-mix',
  '--sn-success-color': '--sn-sys-success',
  '--sn-warning-color': '--sn-sys-warning',
  '--sn-danger-color': '--sn-sys-danger',
  '--sn-focus-ring-color': '--sn-sys-focus-ring',
  '--sn-focus-outline-offset': '--sn-sys-focus-ring-offset',
});

/**
 * Literal-color exceptions for the `no-literal-color-in-components` audit check: semantic
 * one-offs a token would not improve. Everything else in component `*.css.js` must resolve
 * through a token chain terminating in a T2 role.
 */
export const LITERAL_COLOR_ALLOWLIST = Object.freeze(['transparent', 'currentColor', '#fff', '#000']);

/** Classify a `--sn-*` token name into a tier. Unprefixed names are legacy or component tier. */
export function classifyToken(name) {
  let token = String(name ?? '').trim();
  if (!token.startsWith('--sn-')) return null;
  for (let { prefix, tier } of TIER_PREFIXES) {
    if (token.startsWith(prefix)) return tier;
  }
  if (Object.hasOwn(LEGACY_SYS_ALIASES, token)) return 'legacy-alias';
  return 'component';
}

/**
 * May a token of tier `from` reference a token of tier `to`? One-way flow:
 * component → sys → ref → source; domain → ref/sys; legacy-alias → sys only.
 */
export function aliasingAllowed(from, to) {
  const ALLOWED = {
    source: [],
    ref: ['source'],
    sys: ['ref', 'source', 'sys'],
    domain: ['ref', 'sys'],
    component: ['sys', 'component', 'legacy-alias'],
    'legacy-alias': ['sys'],
  };
  return (ALLOWED[from] ?? []).includes(to);
}
