const CASCADE_THEME_CONTROL_LIST = [
  {
    name: 'mode',
    type: 'enum',
    values: ['dark', 'light'],
    default: 'dark',
    description: 'Neutral luminance branch used to derive background, surface, text, border, and hover tokens.',
  },
  {
    name: 'brightness',
    type: 'number',
    min: 0,
    max: 100,
    default: 0,
    description: 'Global neutral brightness control. Dark mode moves surfaces upward; light mode moves them downward.',
  },
  {
    name: 'contrast',
    type: 'number',
    min: 0,
    max: 100,
    default: 58,
    description: 'Contrast control for text, borders, hover surfaces, and accent lightness.',
  },
  {
    name: 'chroma',
    type: 'number',
    min: 0,
    max: 100,
    default: 89,
    description: 'Accent saturation from grayscale to vivid color.',
  },
  {
    name: 'hue',
    type: 'number',
    min: 0,
    max: 360,
    default: 218,
    description: 'Accent hue in native CSS HSL space.',
  },
  {
    name: 'outline',
    type: 'number',
    min: 0,
    max: 100,
    default: 38,
    description: 'Outline visibility and emphasis for DOM borders, SVG shapes, split resizers, focus rings, sockets, and graph connections.',
  },
  {
    name: 'type',
    type: 'number',
    min: 80,
    max: 130,
    default: 100,
    description: 'Typography scale for graph nodes, controls, layout chrome, menus, tree rows, and demo labels.',
  },
  {
    name: 'density',
    type: 'number',
    min: 75,
    max: 140,
    default: 100,
    description: 'Spacing and hit-target scale for graph nodes, ports, controls, layout chrome, action zones, and tree rows.',
  },
];

export const CASCADE_THEME_DEFAULTS = Object.freeze(Object.fromEntries(
  CASCADE_THEME_CONTROL_LIST.map((control) => [control.name, control.default])
));

export const CASCADE_THEME_TOKEN_TARGETS = Object.freeze({
  color: [
    '--sn-theme-name',
    '--sn-theme-hue',
    '--sn-theme-chroma',
    '--sn-theme-bg-lightness',
    '--sn-theme-surface-lightness',
    '--sn-theme-text-lightness',
    '--sn-bg',
    '--sn-panel-bg',
    '--sn-layout-bg',
    '--sn-node-bg',
    '--sn-surface',
    '--sn-text',
    '--sn-text-dim',
    '--sn-ctx-bg',
    '--sn-lit-border',
    '--sn-lit-hover',
    '--sn-lit-text-dim',
    '--sn-lit-accent',
    '--sn-node-selected',
    '--sn-node-hover',
    '--sn-scrollbar-thumb',
    '--sn-scrollbar-thumb-hover',
  ],
  outline: [
    '--sn-outline-color',
    '--sn-outline-color-soft',
    '--sn-node-border',
    '--sn-node-border-width',
    '--sn-shape-stroke',
    '--sn-shape-stroke-width',
    '--sn-shape-port-hint-stroke-width',
    '--sn-conn-width',
    '--sn-conn-hover-width',
    '--sn-conn-selected-width',
    '--sn-layout-border',
    '--sn-ctx-border',
    '--sn-effect-focus-ring',
  ],
  typography: [
    '--sn-theme-type-scale',
    '--sn-node-font-size',
    '--sn-node-label-size',
    '--sn-node-summary-size',
    '--sn-node-icon-size',
    '--sn-port-label-size',
    '--sn-control-input-size',
    '--sn-layout-header-icon-size',
    '--sn-panel-menu-icon-size',
    '--sn-shape-watermark-size',
  ],
  density: [
    '--sn-theme-density',
    '--sn-theme-spacing-scale',
    '--sn-node-header-padding',
    '--sn-node-body-padding',
    '--sn-node-content-padding',
    '--sn-port-padding',
    '--sn-port-min-height',
    '--sn-control-padding',
    '--sn-layout-header-padding',
    '--sn-layout-header-min-height',
    '--sn-layout-collapsed-horizontal-size',
    '--sn-action-zone-size',
    '--sn-socket-hit-size',
  ],
});

export const CASCADE_THEME_DESCRIPTOR = Object.freeze({
  name: 'cascade-theme',
  kind: 'runtime-theme-contract',
  description: 'Runtime cascade theme contract for agent-built Symbiote UI, graph canvases, layouts, scrollbars, and VR-ready panels.',
  entrypoint: 'symbiote-ui/themes/cascade-theme.js',
  exports: ['createCascadeTheme', 'applyCascadeTheme', 'normalizeCascadeThemeOptions', 'getCascadeThemeControls'],
  cascade: 'Apply once at :root, an app shell, or a subtree boundary. Components consume inherited --sn-* tokens through the CSS cascade.',
  controls: CASCADE_THEME_CONTROL_LIST,
  tokenTargets: CASCADE_THEME_TOKEN_TARGETS,
  webmcp: {
    name: 'symbiote-ui.createCascadeTheme',
    description: 'Generate cascade theme tokens from bounded controls for agent-composed Symbiote UI and graph layouts.',
    inputSchema: {
      type: 'object',
      properties: Object.fromEntries(CASCADE_THEME_CONTROL_LIST.map((control) => [
        control.name,
        control.type === 'enum'
          ? { type: 'string', enum: control.values, default: control.default, description: control.description }
          : { type: 'number', minimum: control.min, maximum: control.max, default: control.default, description: control.description },
      ])),
      additionalProperties: false,
    },
    annotations: {
      title: 'Create Symbiote cascade theme',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    visibility: 'agent-readable',
    permissions: ['theme:read', 'theme:compose'],
  },
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function percent(value) {
  return `${value}%`;
}

function typeToken(px) {
  return `calc(${px}px * var(--sn-theme-type-scale))`;
}

function densityToken(px) {
  return `calc(${px}px * var(--sn-theme-density))`;
}

export function getCascadeThemeControls() {
  return CASCADE_THEME_CONTROL_LIST.map((control) => ({ ...control }));
}

export function normalizeCascadeThemeOptions(options = {}) {
  let merged = { ...CASCADE_THEME_DEFAULTS, ...options };
  let mode = merged.mode === 'light' ? 'light' : 'dark';
  return {
    mode,
    brightness: clamp(merged.brightness, 0, 100),
    contrast: clamp(merged.contrast, 0, 100),
    chroma: clamp(merged.chroma, 0, 100),
    hue: clamp(merged.hue, 0, 360),
    outline: clamp(merged.outline, 0, 100),
    type: clamp(merged.type, 80, 130),
    density: clamp(merged.density, 75, 140),
  };
}

export function createCascadeTheme(options = {}) {
  let state = normalizeCascadeThemeOptions(options);
  let dark = state.mode === 'dark';
  let outlineStrength = state.outline / 100;
  let typeScale = state.type / 100;
  let densityScale = state.density / 100;
  let bg = dark
    ? 10 + state.brightness * 0.18
    : 98 - state.brightness * 0.32;
  let surface = dark
    ? Math.min(34, bg + 3 + (state.contrast - 58) * 0.05)
    : Math.max(72, bg - 4 - state.contrast * 0.10);
  let text = dark
    ? Math.min(98, Math.max(72, 94 + (state.contrast - 58) * 0.12))
    : Math.max(8, 34 - state.contrast * 0.26);
  let dim = dark
    ? Math.min(78, Math.max(46, 60 + (state.contrast - 58) * 0.18))
    : Math.max(24, 66 - state.contrast * 0.22);
  let border = dark
    ? Math.min(46, Math.max(12, 17 + (state.contrast - 58) * 0.10))
    : Math.max(50, surface - 5 - state.contrast * 0.08);
  let hover = dark
    ? Math.min(58, Math.max(18, 27 + (state.contrast - 58) * 0.10))
    : Math.max(42, surface - 8 - state.contrast * 0.12);
  let accentLight = dark
    ? Math.min(72, Math.max(48, 63 + (state.contrast - 58) * 0.12))
    : Math.max(36, 62 - state.contrast * 0.10);
  let neutralChroma = percent(state.chroma);
  let bgColor = `hsl(0 0% ${bg.toFixed(1)}%)`;
  let panelColor = `hsl(0 0% ${surface.toFixed(1)}%)`;
  let textColor = `hsl(0 0% ${text.toFixed(1)}%)`;
  let textDimColor = `hsl(0 0% ${dim.toFixed(1)}%)`;
  let accent = `hsl(${state.hue} ${neutralChroma} ${accentLight}%)`;
  let accentSoft = `hsl(${state.hue} ${neutralChroma} ${accentLight}% / 0.18)`;
  let outlineAlpha = state.outline === 0
    ? 0
    : dark
      ? 0.02 + outlineStrength * 0.21
      : 0.04 + outlineStrength * 0.28;
  let outlineLit = dark
    ? Math.min(62, text - 10 + outlineStrength * 28)
    : Math.max(32, text + 42 - outlineStrength * 26);
  let outlineColor = `hsl(0 0% ${outlineLit.toFixed(1)}% / ${outlineAlpha.toFixed(3)})`;
  let softOutlineColor = `hsl(0 0% ${text.toFixed(1)}% / ${(outlineAlpha * 0.55).toFixed(3)})`;
  let nodeBorderWidth = `${(1 + outlineStrength).toFixed(2)}px`;
  let focusRingWidth = `${(1 + outlineStrength * 2).toFixed(1)}px`;
  let shapeStrokeWidth = (0.4 + outlineStrength * 1.2).toFixed(2);
  let connectionWidth = (1.5 + outlineStrength * 0.8).toFixed(2);
  let connectionHoverWidth = (2.4 + outlineStrength * 1.2).toFixed(2);

  let tokens = {
    '--sn-theme-name': 'cascade-theme',
    '--sn-theme-hue': String(state.hue),
    '--sn-theme-chroma': neutralChroma,
    '--sn-theme-bg-lightness': `${bg.toFixed(1)}%`,
    '--sn-theme-surface-lightness': `${surface.toFixed(1)}%`,
    '--sn-theme-text-lightness': `${text.toFixed(1)}%`,
    '--sn-theme-outline-strength': outlineStrength.toFixed(2),
    '--sn-theme-type-scale': typeScale.toFixed(2),
    '--sn-theme-density': densityScale.toFixed(2),
    '--sn-theme-spacing-scale': densityScale.toFixed(2),
    '--sn-lit-border': `${border.toFixed(1)}%`,
    '--sn-lit-hover': `${hover.toFixed(1)}%`,
    '--sn-lit-text-dim': `${dim.toFixed(1)}%`,
    '--sn-lit-accent': `${accentLight.toFixed(1)}%`,
    '--sn-bg': bgColor,
    '--sn-panel-bg': panelColor,
    '--sn-layout-bg': 'var(--sn-bg)',
    '--sn-node-bg': 'var(--sn-panel-bg)',
    '--sn-surface': 'var(--sn-node-bg)',
    '--sn-bg-overlay': dark ? 'hsl(0 0% 0% / 0.45)' : 'hsl(0 0% 100% / 0.55)',
    '--sn-cell-bg': 'var(--sn-bg)',
    '--sn-cell-vignette-edge': 'var(--sn-bg)',
    '--sn-text': textColor,
    '--sn-text-dim': textDimColor,
    '--sn-outline-color': outlineColor,
    '--sn-outline-color-soft': softOutlineColor,
    '--sn-node-selected': accent,
    '--sn-node-accent': accent,
    '--sn-cat-data': accent,
    '--sn-node-active-border': `color-mix(in srgb, ${accent} 54%, transparent)`,
    '--sn-node-hover': accentSoft,
    '--sn-node-border': outlineColor,
    '--sn-node-border-width': nodeBorderWidth,
    '--sn-node-header-bg': 'var(--sn-panel-bg)',
    '--sn-node-header-border': state.outline === 0 ? 'transparent' : softOutlineColor,
    '--sn-node-item-border': state.outline === 0 ? 'transparent' : softOutlineColor,
    '--sn-node-callout-bg': 'color-mix(in srgb, var(--sn-node-bg) 94%, var(--sn-node-selected) 6%)',
    '--sn-node-callout-color': 'var(--sn-text)',
    '--sn-shape-fill': 'var(--sn-node-bg)',
    '--sn-shape-stroke': outlineColor,
    '--sn-shape-stroke-width': shapeStrokeWidth,
    '--sn-shape-port-hint-stroke-width': (0.5 + outlineStrength * 1.6).toFixed(2),
    '--sn-conn-width': connectionWidth,
    '--sn-conn-hover-width': connectionHoverWidth,
    '--sn-conn-selected-width': connectionHoverWidth,
    '--sn-pseudo-conn-width': connectionWidth,
    '--sn-plus-indicator-stroke-width': connectionWidth,
    '--sn-conn-dot-stroke': 'var(--sn-node-bg)',
    '--sn-conn-dot-stroke-width': `${(1.4 + outlineStrength * 1.2).toFixed(2)}px`,
    '--sn-layout-border': outlineColor,
    '--sn-layout-resizer-hover-bg': state.outline === 0 ? 'transparent' : softOutlineColor,
    '--sn-ctx-border': outlineColor,
    '--sn-ctx-bg': 'color-mix(in srgb, var(--sn-panel-bg) 82%, var(--sn-text) 4%)',
    '--sn-panel-menu-border-width': nodeBorderWidth,
    '--sn-card-bg': 'var(--sn-node-bg)',
    '--sn-xr-panel-border': outlineColor,
    '--sn-xr-panel-bg': 'var(--sn-panel-bg)',
    '--sn-card-border': outlineColor,
    '--sn-card-title-color': 'var(--sn-text-dim)',
    '--sn-button-border': outlineColor,
    '--sn-button-bg': 'var(--sn-node-bg)',
    '--sn-button-color': 'var(--sn-text)',
    '--sn-button-hover-bg': 'color-mix(in srgb, var(--sn-node-bg) 86%, var(--sn-node-selected) 14%)',
    '--sn-banner-border': outlineColor,
    '--sn-banner-bg': 'var(--sn-node-bg)',
    '--sn-banner-color': 'var(--sn-text)',
    '--sn-badge-border': outlineColor,
    '--sn-badge-bg': 'var(--sn-node-bg)',
    '--sn-badge-color': 'var(--sn-text-dim)',
    '--sn-field-control-border': outlineColor,
    '--sn-field-label-color': 'var(--sn-text-dim)',
    '--sn-field-control-bg': 'var(--sn-bg)',
    '--sn-field-control-color': 'var(--sn-text)',
    '--sn-field-placeholder-color': 'var(--sn-text-dim)',
    '--sn-tree-label-color': 'var(--sn-text)',
    '--sn-tree-muted-color': 'var(--sn-text-dim)',
    '--sn-tree-icon-color': 'var(--sn-text-dim)',
    '--sn-tree-badge-color': 'var(--sn-text-dim)',
    '--sn-tree-row-selected-bg': 'var(--sn-node-hover)',
    '--sn-tree-row-selected-border': state.outline === 0 ? 'transparent' : softOutlineColor,
    '--sn-data-table-bg': 'var(--sn-node-bg)',
    '--sn-data-table-color': 'var(--sn-text)',
    '--sn-data-table-header-bg': 'var(--sn-panel-bg)',
    '--sn-data-table-header-color': 'var(--sn-text-dim)',
    '--sn-list-detail-bg': 'var(--sn-panel-bg)',
    '--sn-list-detail-color': 'var(--sn-text)',
    '--sn-list-detail-sidebar-bg': 'var(--sn-node-bg)',
    '--sn-source-bg': 'var(--sn-bg)',
    '--sn-source-editor-bg': 'var(--sn-bg)',
    '--sn-source-editor-color': 'var(--sn-text)',
    '--sn-effect-focus-ring': `${focusRingWidth} solid var(--sn-node-selected)`,
    '--sn-node-font-size': typeToken(13),
    '--sn-node-label-size': typeToken(13),
    '--sn-node-summary-size': typeToken(12),
    '--sn-node-icon-size': typeToken(18),
    '--sn-node-link-size': typeToken(12),
    '--sn-node-link-icon-size': typeToken(15),
    '--sn-node-error-frame-header-size': typeToken(12),
    '--sn-node-error-frame-icon-size': typeToken(14),
    '--sn-node-error-frame-body-size': typeToken(11),
    '--sn-node-item-kicker-size': typeToken(10),
    '--sn-node-item-title-size': typeToken(13),
    '--sn-node-item-summary-size': typeToken(11),
    '--sn-port-label-size': typeToken(12),
    '--sn-control-label-size': typeToken(10),
    '--sn-control-input-size': typeToken(12),
    '--sn-node-preview-text-size': typeToken(11),
    '--sn-shape-watermark-size': typeToken(40),
    '--sn-button-font-size': typeToken(12),
    '--sn-button-icon-font-size': typeToken(16),
    '--sn-card-title-size': typeToken(11),
    '--sn-banner-font-size': typeToken(12),
    '--sn-banner-icon-size': typeToken(18),
    '--sn-badge-font-size': typeToken(11),
    '--sn-tree-label-size': typeToken(12),
    '--sn-tree-icon-size': typeToken(15),
    '--sn-tree-kind-size': typeToken(10),
    '--sn-tree-badge-size': typeToken(10),
    '--sn-tree-panel-font-size': typeToken(12),
    '--sn-tree-panel-title-size': typeToken(11),
    '--sn-tree-panel-input-size': typeToken(11),
    '--sn-layout-header-button-size': typeToken(12),
    '--sn-layout-header-icon-size': typeToken(16),
    '--sn-layout-header-dropdown-size': typeToken(18),
    '--sn-layout-collapsed-icon-size': typeToken(18),
    '--sn-layout-collapsed-horizontal-icon-size': typeToken(20),
    '--sn-fullscreen-tab-size': typeToken(12),
    '--sn-fullscreen-tab-icon-size': typeToken(16),
    '--sn-panel-menu-item-size': typeToken(12),
    '--sn-panel-menu-icon-size': typeToken(18),
    '--sn-socket-size': densityToken(12),
    '--sn-socket-border-width': `${(1.5 + outlineStrength * 0.8).toFixed(2)}px`,
    '--sn-socket-hit-size': densityToken(44),
    '--sn-card-padding': densityToken(14),
    '--sn-card-title-margin-block-end': densityToken(12),
    '--sn-card-footer-gap': densityToken(8),
    '--sn-button-padding': `${densityToken(6)} ${densityToken(14)}`,
    '--sn-button-gap': densityToken(6),
    '--sn-button-min-height': densityToken(30),
    '--sn-button-icon-size': densityToken(28),
    '--sn-banner-padding': `${densityToken(10)} ${densityToken(14)}`,
    '--sn-banner-gap': densityToken(8),
    '--sn-badge-padding': `${densityToken(2)} ${densityToken(8)}`,
    '--sn-badge-gap': densityToken(4),
    '--sn-tree-gap': densityToken(4),
    '--sn-tree-row-min-height': densityToken(22),
    '--sn-tree-row-padding-block': densityToken(2),
    '--sn-tree-badge-gap': densityToken(4),
    '--sn-tree-badge-padding': `${densityToken(1)} ${densityToken(5)}`,
    '--sn-tree-panel-title-gap': densityToken(5),
    '--sn-tree-panel-title-padding': `${densityToken(6)} ${densityToken(8)}`,
    '--sn-tree-panel-toolbar-gap': densityToken(6),
    '--sn-tree-panel-toolbar-padding': `${densityToken(6)} ${densityToken(8)}`,
    '--sn-tree-panel-input-padding': `${densityToken(4)} ${densityToken(8)}`,
    '--sn-tree-panel-content-padding': densityToken(4),
    '--sn-lab-toolbar-gap': densityToken(12),
    '--sn-lab-toolbar-padding': `${densityToken(10)} ${densityToken(12)}`,
    '--sn-lab-title-size': typeToken(14),
    '--sn-lab-control-font-size': typeToken(12),
    '--sn-lab-control-height': densityToken(30),
    '--sn-lab-control-gap': densityToken(8),
    '--sn-lab-toggle-padding': `0 ${densityToken(10)}`,
    '--sn-lab-mode-button-padding': `0 ${densityToken(9)}`,
    '--sn-lab-tuners-gap': densityToken(12),
    '--sn-lab-slider-width': densityToken(128),
    '--sn-lab-content-padding': densityToken(12),
    '--sn-lab-panel-gap': densityToken(12),
    '--sn-lab-panel-padding': densityToken(12),
    '--sn-lab-row-gap': densityToken(8),
    '--sn-lab-scroll-padding': densityToken(8),
    '--sn-lab-stack-gap': densityToken(10),
    '--sn-lab-token-gap': densityToken(8),
    '--sn-lab-token-padding': densityToken(10),
    '--sn-lab-token-label-size': typeToken(12),
    '--sn-lab-token-value-size': typeToken(11),
    '--sn-node-header-gap': densityToken(6),
    '--sn-node-header-padding': `${densityToken(8)} ${densityToken(12)}`,
    '--sn-node-collapsed-body-padding': `${densityToken(4)} 0`,
    '--sn-node-lod-body-padding': `${densityToken(2)} 0`,
    '--sn-node-body-padding': `${densityToken(8)} 0`,
    '--sn-node-body-gap': densityToken(4),
    '--sn-node-pill-body-padding': `${densityToken(8)} ${densityToken(20)}`,
    '--sn-node-pill-body-gap': densityToken(8),
    '--sn-node-circle-header-padding': densityToken(6),
    '--sn-node-circle-body-padding': `0 ${densityToken(8)} ${densityToken(8)}`,
    '--sn-node-comment-body-padding': `${densityToken(12)} ${densityToken(16)}`,
    '--sn-node-svg-body-padding': `${densityToken(4)} 0`,
    '--sn-node-content-padding': `${densityToken(8)} ${densityToken(12)} ${densityToken(10)}`,
    '--sn-node-link-gap': densityToken(5),
    '--sn-node-link-margin-block-start': densityToken(8),
    '--sn-node-items-padding': densityToken(6),
    '--sn-node-items-gap': densityToken(6),
    '--sn-node-item-gap': densityToken(3),
    '--sn-node-item-padding': `${densityToken(8)} ${densityToken(9)}`,
    '--sn-node-controls-padding': `0 ${densityToken(12)}`,
    '--sn-node-error-frame-header-gap': densityToken(6),
    '--sn-node-error-frame-header-padding': `${densityToken(5)} ${densityToken(10)}`,
    '--sn-node-error-frame-body-padding': `${densityToken(6)} ${densityToken(10)}`,
    '--sn-node-preview-text-padding': `${densityToken(6)} ${densityToken(10)}`,
    '--sn-port-gap': densityToken(6),
    '--sn-port-padding': `${densityToken(3)} ${densityToken(12)}`,
    '--sn-port-min-height': densityToken(28),
    '--sn-control-gap': densityToken(2),
    '--sn-control-margin': `${densityToken(4)} 0`,
    '--sn-control-padding': `${densityToken(4)} ${densityToken(12)}`,
    '--sn-control-input-padding': `${densityToken(4)} ${densityToken(8)}`,
    '--sn-layout-header-gap': densityToken(2),
    '--sn-layout-header-padding': `${densityToken(2)} ${densityToken(4)}`,
    '--sn-layout-header-min-height': densityToken(28),
    '--sn-layout-header-button-gap': densityToken(4),
    '--sn-layout-header-button-padding': `${densityToken(4)} ${densityToken(6)}`,
    '--sn-layout-collapsed-vertical-size': densityToken(28),
    '--sn-layout-collapsed-type-padding': `${densityToken(4)} ${densityToken(8)}`,
    '--sn-layout-collapsed-button-padding': densityToken(4),
    '--sn-layout-collapsed-horizontal-size': densityToken(32),
    '--sn-layout-collapsed-horizontal-type-padding': `${densityToken(6)} ${densityToken(4)}`,
    '--sn-layout-collapsed-horizontal-button-padding': `${densityToken(8)} ${densityToken(4)}`,
    '--sn-layout-resizer-thickness': `${(1 + outlineStrength * 2).toFixed(2)}px`,
    '--sn-fullscreen-tab-bar-height': densityToken(28),
    '--sn-fullscreen-tab-gap': densityToken(6),
    '--sn-fullscreen-tab-padding': `0 ${densityToken(12)}`,
    '--sn-fullscreen-tab-height': densityToken(28),
    '--sn-fullscreen-tab-active-height': densityToken(29),
    '--sn-panel-menu-padding': `${densityToken(4)} 0`,
    '--sn-panel-menu-item-gap': densityToken(8),
    '--sn-panel-menu-item-padding': `${densityToken(8)} ${densityToken(12)}`,
    '--sn-action-zone-size': densityToken(16),
    '--sn-scrollbar-thumb': `hsl(0 0% ${text.toFixed(1)}% / ${dark ? 0.08 : 0.24})`,
    '--sn-scrollbar-thumb-hover': dark
      ? `hsl(0 0% ${text.toFixed(1)}% / 0.25)`
      : `hsl(${state.hue} ${neutralChroma} ${accentLight}% / 0.55)`,
    '--sn-scrollbar-track': 'transparent',
  };

  return {
    name: 'cascade-theme',
    descriptor: CASCADE_THEME_DESCRIPTOR,
    state,
    tokens,
  };
}

export function applyCascadeTheme(element, options = {}) {
  let theme = createCascadeTheme(options);
  for (let [key, value] of Object.entries(theme.tokens)) {
    element?.style?.setProperty(key, value);
  }
  return theme;
}
