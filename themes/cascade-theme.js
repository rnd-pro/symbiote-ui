const CASCADE_THEME_CONTROL_LIST = [
  {
    name: 'mode',
    type: 'enum',
    values: ['dark', 'light'],
    default: 'dark',
    icon: 'routine',
    description: 'Neutral luminance branch used to derive background, surface, text, border, and hover tokens.',
  },
  {
    name: 'brightness',
    type: 'number',
    min: 0,
    max: 100,
    default: 0,
    icon: 'brightness_6',
    description: 'Global neutral brightness control. Dark mode moves surfaces upward; light mode moves them downward.',
  },
  {
    name: 'contrast',
    type: 'number',
    min: 0,
    max: 100,
    default: 58,
    icon: 'contrast',
    description: 'Contrast control for text, borders, hover surfaces, and accent lightness.',
  },
  {
    name: 'chroma',
    type: 'number',
    min: 0,
    max: 100,
    default: 89,
    icon: 'opacity',
    description: 'Accent saturation from grayscale to vivid color.',
  },
  {
    name: 'hue',
    type: 'number',
    min: 0,
    max: 360,
    default: 218,
    icon: 'palette',
    description: 'Accent hue in native CSS HSL space.',
  },
  {
    name: 'outline',
    type: 'number',
    min: 0,
    max: 100,
    default: 38,
    icon: 'border_outer',
    description: 'Outline visibility and emphasis for DOM borders, SVG shapes, split resizers, focus rings, sockets, and graph connections.',
  },
  {
    name: 'type',
    type: 'number',
    min: 80,
    max: 130,
    default: 100,
    icon: 'text_fields',
    description: 'Typography scale for graph nodes, chat messages, controls, layout chrome, menus, tree rows, and demo labels.',
  },
  {
    name: 'heading',
    type: 'number',
    min: 80,
    max: 140,
    default: 100,
    icon: 'title',
    description: 'Heading-to-body type balance for titles, graph labels, panel headings, cards, chat markdown, and document markdown.',
  },
  {
    name: 'density',
    type: 'number',
    min: 75,
    max: 140,
    default: 100,
    icon: 'density_medium',
    description: 'Spacing and hit-target scale for graph nodes, ports, chat composer, controls, layout chrome, action zones, and tree rows.',
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
    '--sn-hue-accent',
    '--sn-hue-success',
    '--sn-hue-warning',
    '--sn-hue-danger',
    '--sn-hue-data',
    '--sn-node-selected',
    '--sn-node-hover',
    '--sn-cat-server',
    '--sn-cat-instance',
    '--sn-cat-control',
    '--sn-cat-data',
    '--sn-cat-default',
    '--sn-subgraph-accent',
    '--sn-graph-type-data',
    '--sn-graph-type-action',
    '--sn-tabs-accent',
    '--sn-tab-accent-0',
    '--sn-tab-accent-1',
    '--sn-tab-accent-2',
    '--sn-tab-accent-3',
    '--sn-tab-accent-4',
    '--sn-tab-accent-5',
    '--sn-button-primary-bg',
    '--sn-button-primary-border',
    '--sn-button-primary-color',
    '--sn-button-success-bg',
    '--sn-button-success-border',
    '--sn-button-success-color',
    '--sn-button-danger-hover-bg',
    '--sn-button-danger-hover-border',
    '--sn-button-danger-hover-color',
    '--sn-scrollbar-thumb',
    '--sn-scrollbar-thumb-hover',
    '--sn-cell-bg',
    '--sn-cell-dot',
    '--sn-cell-base-alpha',
    '--sn-cell-alpha-span',
    '--sn-cell-glare',
    '--sn-cell-vignette-mid',
    '--sn-cell-vignette-edge',
    '--sn-chat-bg',
    '--sn-chat-message-bg',
    '--sn-chat-user-message-bg',
    '--sn-chat-agent-message-bg',
    '--sn-composer-bg',
    '--sn-composer-action-bg',
    '--sn-composer-send-hover-bg',
    '--sn-syntax-keyword',
    '--sn-syntax-string',
    '--sn-syntax-comment',
    '--sn-syntax-function',
    '--sn-syntax-property',
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
    '--sn-composer-border',
    '--sn-effect-focus-ring',
  ],
  typography: [
    '--sn-theme-type-scale',
    '--sn-theme-heading-scale',
    '--sn-node-font-size',
    '--sn-node-label-size',
    '--sn-node-item-title-size',
    '--sn-node-summary-size',
    '--sn-node-icon-size',
    '--sn-port-label-size',
    '--sn-control-input-size',
    '--sn-card-title-size',
    '--sn-markdown-h1-size',
    '--sn-markdown-h2-size',
    '--sn-markdown-h3-size',
    '--sn-markdown-h4-size',
    '--sn-chat-markdown-h1-size',
    '--sn-chat-markdown-h2-size',
    '--sn-chat-markdown-h3-size',
    '--sn-chat-markdown-h4-size',
    '--sn-chat-live-icon-size',
    '--sn-chat-meta-icon-size',
    '--sn-chat-status-icon-size',
    '--sn-chat-tool-icon-size',
    '--sn-chat-summary-icon-size',
    '--sn-chat-message-font-size',
    '--sn-chat-small-size',
    '--sn-chat-tool-font-size',
    '--sn-chat-tool-label-size',
    '--sn-chat-code-size',
    '--sn-chat-table-size',
    '--sn-chat-status-card-size',
    '--sn-chat-sidebar-title-size',
    '--sn-chat-sidebar-meta-size',
    '--sn-chat-list-title-size',
    '--sn-chat-list-meta-size',
    '--sn-code-font-size',
    '--sn-code-markdown-size',
    '--sn-code-table-size',
    '--sn-composer-send-icon-size',
    '--sn-composer-input-size',
    '--sn-composer-footer-size',
    '--sn-composer-chip-size',
    '--sn-composer-popup-header-size',
    '--sn-composer-popup-item-size',
    '--sn-composer-popup-hint-size',
    '--sn-composer-voice-label-size',
    '--sn-composer-voice-preview-size',
    '--sn-composer-voice-status-size',
    '--sn-composer-footer-icon-size',
    '--sn-composer-footer-toggle-icon-size',
    '--sn-layout-header-icon-size',
    '--sn-layout-menu-action-size',
    '--sn-layout-menu-icon-size',
    '--sn-panel-menu-icon-size',
    '--sn-shape-icon-size',
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
    '--sn-layout-menu-min-height',
    '--sn-layout-menu-padding',
    '--sn-layout-menu-gap',
    '--sn-layout-menu-action-gap',
    '--sn-layout-menu-action-height',
    '--sn-layout-menu-action-padding',
    '--sn-layout-overflow-inline-size',
    '--sn-layout-overflow-block-size',
    '--sn-layout-responsive-panel-min-block-size',
    '--sn-layout-collapsed-horizontal-size',
    '--sn-chat-gap',
    '--sn-chat-transcript-padding',
    '--sn-chat-scroll-bottom',
    '--sn-chat-message-padding',
    '--sn-chat-tool-padding',
    '--sn-chat-code-padding',
    '--sn-chat-status-card-padding',
    '--sn-chat-status-card-gap',
    '--sn-composer-padding',
    '--sn-composer-body-padding',
    '--sn-composer-control-gap',
    '--sn-composer-send-size',
    '--sn-composer-input-min-height',
    '--sn-composer-input-padding',
    '--sn-composer-footer-gap',
    '--sn-composer-footer-padding',
    '--sn-composer-footer-btn-min-height',
    '--sn-composer-footer-btn-padding',
    '--sn-composer-chip-gap',
    '--sn-composer-chip-padding',
    '--sn-composer-autocomplete-padding',
    '--sn-composer-autocomplete-item-padding',
    '--sn-composer-popup-inset',
    '--sn-composer-voice-label-max',
    '--sn-composer-voice-command-max',
    '--sn-code-padding',
    '--sn-code-gutter-padding',
    '--sn-code-gutter-width',
    '--sn-code-markdown-padding',
    '--sn-code-table-cell-padding',
    '--sn-cell-size',
    '--sn-cell-min-radius',
    '--sn-cell-max-radius',
    '--sn-cell-step-ms',
    '--sn-cell-fade-rate',
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

function headingToken(px) {
  return `calc(${px}px * var(--sn-theme-type-scale) * var(--sn-theme-heading-scale))`;
}

function hueRotate(hue, offset) {
  return String((((Number(hue) + offset) % 360) + 360) % 360);
}

function densityToken(px) {
  return `calc(${px}px * var(--sn-theme-density))`;
}

function svgStrokeToken(px, outlineStrength) {
  let defaultOutlineStrength = CASCADE_THEME_DEFAULTS.outline / 100;
  let scale = defaultOutlineStrength <= 0 ? outlineStrength : outlineStrength / defaultOutlineStrength;
  return (px * scale).toFixed(2);
}

function hslToRgb(hue, saturation, lightness) {
  let h = (((Number(hue) % 360) + 360) % 360) / 360;
  let s = clamp(saturation, 0, 100) / 100;
  let l = clamp(lightness, 0, 100) / 100;

  if (s === 0) {
    let value = l * 255;
    return [value, value, value];
  }

  let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  let p = 2 * l - q;
  let channel = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

function relativeLuminance(rgb) {
  let channels = rgb.map((channel) => {
    let value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(a, b) {
  let lighter = Math.max(a, b);
  let darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function readableTextForHsl(hue, saturation, lightness, preferredLightness) {
  let bgLum = relativeLuminance(hslToRgb(hue, saturation, lightness));
  let preferred = { hue: 0, saturation: 0, lightness: preferredLightness };
  let inverted = { hue: 0, saturation: 0, lightness: preferredLightness > 50 ? 8 : 98 };
  let candidates = [preferred, inverted].map((candidate) => ({
    ...candidate,
    ratio: contrastRatio(bgLum, relativeLuminance(hslToRgb(
      candidate.hue,
      candidate.saturation,
      candidate.lightness
    ))),
  }));
  let winner = candidates.sort((a, b) => b.ratio - a.ratio)[0];
  return `hsl(${winner.hue} ${winner.saturation}% ${winner.lightness.toFixed(1)}%)`;
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
    heading: clamp(merged.heading, 80, 140),
    density: clamp(merged.density, 75, 140),
  };
}

export function createCascadeTheme(options = {}) {
  let state = normalizeCascadeThemeOptions(options);
  let dark = state.mode === 'dark';
  let outlineStrength = state.outline / 100;
  let typeScale = state.type / 100;
  let headingScale = state.heading / 100;
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
  let dataLight = dark
    ? Math.max(34, accentLight - 21)
    : Math.max(34, accentLight - 10);
  let actionLight = dark
    ? Math.min(82, accentLight + 15)
    : Math.max(42, accentLight - 4);
  let semanticHues = {
    accent: hueRotate(state.hue, 0),
    success: hueRotate(state.hue, -96),
    warning: hueRotate(state.hue, 178),
    danger: hueRotate(state.hue, 146),
    data: hueRotate(state.hue, -30),
  };
  let neutralChroma = percent(state.chroma);
  let bgColor = `hsl(0 0% ${bg.toFixed(1)}%)`;
  let panelColor = `hsl(0 0% ${surface.toFixed(1)}%)`;
  let textColor = `hsl(0 0% ${text.toFixed(1)}%)`;
  let textDimColor = `hsl(0 0% ${dim.toFixed(1)}%)`;
  let accent = `hsl(${state.hue} ${neutralChroma} ${accentLight}%)`;
  let accentSoft = `hsl(${state.hue} ${neutralChroma} ${accentLight}% / 0.18)`;
  let primaryButtonColor = readableTextForHsl(state.hue, state.chroma, accentLight, text);
  let successButtonColor = readableTextForHsl(122, state.chroma, 57, text);
  let dangerButtonColor = readableTextForHsl(4, state.chroma, 58, text);
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
  let shapeStrokeWidth = svgStrokeToken(0.4, outlineStrength);
  let shapePortHintStrokeWidth = svgStrokeToken(0.5, outlineStrength);
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
    '--sn-theme-heading-scale': headingScale.toFixed(2),
    '--sn-theme-density': densityScale.toFixed(2),
    '--sn-theme-spacing-scale': densityScale.toFixed(2),
    '--sn-hue-accent': semanticHues.accent,
    '--sn-hue-success': semanticHues.success,
    '--sn-hue-warning': semanticHues.warning,
    '--sn-hue-danger': semanticHues.danger,
    '--sn-hue-data': semanticHues.data,
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
    '--sn-cell-dot': `hsl(0 0% ${dim.toFixed(1)}%)`,
    '--sn-cell-base-alpha': dark ? '0.06' : '0.035',
    '--sn-cell-alpha-span': dark ? '0.18' : '0.12',
    '--sn-cell-glare': `hsl(0 0% ${text.toFixed(1)}% / ${dark ? '0.02' : '0.08'})`,
    '--sn-cell-vignette-mid': `hsl(0 0% ${bg.toFixed(1)}% / ${dark ? '0.70' : '0.36'})`,
    '--sn-cell-vignette-edge': 'var(--sn-bg)',
    '--sn-text': textColor,
    '--sn-text-dim': textDimColor,
    '--sn-outline-color': outlineColor,
    '--sn-outline-color-soft': softOutlineColor,
    '--sn-node-selected': accent,
    '--sn-node-accent': accent,
    '--sn-cat-server': 'var(--sn-node-selected)',
    '--sn-cat-instance': `hsl(${semanticHues.success} ${neutralChroma} 57%)`,
    '--sn-cat-control': `hsl(${semanticHues.warning} ${neutralChroma} 58%)`,
    '--sn-cat-data': `hsl(${semanticHues.data} ${neutralChroma} ${dataLight.toFixed(1)}%)`,
    '--sn-cat-default': `hsl(0 0% ${dim.toFixed(1)}%)`,
    '--sn-cat-directory': `hsl(${semanticHues.warning} ${neutralChroma} 60%)`,
    '--sn-cat-file': `hsl(${semanticHues.accent} ${neutralChroma} 66%)`,
    '--sn-cat-function': 'var(--sn-success-color)',
    '--sn-cat-class': `hsl(${semanticHues.data} ${neutralChroma} 72%)`,
    '--sn-cat-module': `hsl(${semanticHues.danger} ${neutralChroma} 70%)`,
    '--sn-subgraph-accent': 'var(--sn-cat-data)',
    '--sn-graph-type-data': `hsl(${semanticHues.accent} ${neutralChroma} ${Math.min(86, accentLight + 11).toFixed(1)}%)`,
    '--sn-graph-type-action': `hsl(${semanticHues.danger} ${neutralChroma} ${actionLight.toFixed(1)}%)`,
    '--sn-tabs-accent': 'var(--sn-cat-server)',
    '--sn-tab-accent-0': 'var(--sn-cat-server)',
    '--sn-tab-accent-1': 'var(--sn-cat-data)',
    '--sn-tab-accent-2': 'var(--sn-cat-control)',
    '--sn-tab-accent-3': 'var(--sn-cat-instance)',
    '--sn-tab-accent-4': 'var(--sn-graph-type-action)',
    '--sn-tab-accent-5': 'var(--sn-cat-class)',
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
    '--sn-shape-port-hint-stroke-width': shapePortHintStrokeWidth,
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
    '--sn-button-primary-bg': 'var(--sn-node-selected)',
    '--sn-button-primary-border': 'var(--sn-node-selected)',
    '--sn-button-primary-color': primaryButtonColor,
    '--sn-button-success-bg': 'var(--sn-success-color)',
    '--sn-button-success-border': 'var(--sn-success-color)',
    '--sn-button-success-color': successButtonColor,
    '--sn-button-success-hover-bg': 'color-mix(in srgb, var(--sn-success-color) 85%, var(--sn-text))',
    '--sn-button-success-hover-border': 'color-mix(in srgb, var(--sn-success-color) 85%, var(--sn-text))',
    '--sn-button-success-hover-color': successButtonColor,
    '--sn-button-danger-bg': 'transparent',
    '--sn-button-danger-border': 'var(--sn-danger-color)',
    '--sn-button-danger-color': 'var(--sn-danger-color)',
    '--sn-button-danger-hover-bg': 'var(--sn-danger-color)',
    '--sn-button-danger-hover-border': 'var(--sn-danger-color)',
    '--sn-button-danger-hover-color': dangerButtonColor,
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
    '--sn-chat-bg': 'transparent',
    '--sn-chat-message-bg': 'var(--sn-node-bg)',
    '--sn-chat-user-message-bg': 'color-mix(in srgb, var(--sn-panel-bg) 88%, var(--sn-node-selected) 12%)',
    '--sn-chat-agent-message-bg': 'var(--sn-node-bg)',
    '--sn-composer-bg': 'color-mix(in srgb, var(--sn-panel-bg) 90%, var(--sn-text) 4%)',
    '--sn-composer-border': outlineColor,
    '--sn-composer-action-bg': 'var(--sn-node-hover)',
    '--sn-composer-send-hover-bg': 'var(--sn-node-selected)',
    '--sn-syntax-keyword': `hsl(${semanticHues.danger} ${neutralChroma} ${Math.min(86, actionLight + 4).toFixed(1)}%)`,
    '--sn-syntax-string': `hsl(${semanticHues.warning} ${neutralChroma} ${Math.min(78, accentLight + 2).toFixed(1)}%)`,
    '--sn-syntax-comment': 'var(--sn-text-dim)',
    '--sn-syntax-function': `hsl(${semanticHues.accent} ${neutralChroma} ${Math.min(86, accentLight + 8).toFixed(1)}%)`,
    '--sn-syntax-number': 'var(--sn-syntax-string)',
    '--sn-syntax-builtin': 'var(--sn-syntax-function)',
    '--sn-syntax-property': `hsl(${semanticHues.data} ${neutralChroma} ${Math.min(82, dataLight + 30).toFixed(1)}%)`,
    '--sn-syntax-literal': 'var(--sn-syntax-keyword)',
    '--sn-syntax-doc': `hsl(${semanticHues.success} ${neutralChroma} ${dim.toFixed(1)}%)`,
    '--sn-syntax-doc-tag': `hsl(${semanticHues.success} ${neutralChroma} ${Math.min(78, accentLight + 5).toFixed(1)}%)`,
    '--sn-syntax-doc-type': `hsl(${semanticHues.accent} ${neutralChroma} ${Math.min(80, accentLight + 7).toFixed(1)}%)`,
    '--sn-syntax-template': `hsl(${semanticHues.warning} ${neutralChroma} ${Math.min(78, accentLight + 1).toFixed(1)}%)`,
    '--sn-syntax-template-tag': `hsl(${semanticHues.accent} ${neutralChroma} ${accentLight.toFixed(1)}%)`,
    '--sn-syntax-template-attr': 'var(--sn-syntax-function)',
    '--sn-syntax-template-bracket': 'var(--sn-text-dim)',
    '--sn-syntax-template-interpolation': `hsl(${semanticHues.warning} ${neutralChroma} ${Math.min(84, accentLight + 10).toFixed(1)}%)`,
    '--sn-syntax-template-selector': 'var(--sn-syntax-string)',
    '--sn-syntax-template-property': 'var(--sn-syntax-template-attr)',
    '--sn-syntax-template-value': 'var(--sn-syntax-template)',
    '--sn-effect-focus-ring': `${focusRingWidth} solid var(--sn-node-selected)`,
    '--sn-node-font-size': typeToken(13),
    '--sn-node-label-size': headingToken(13),
    '--sn-node-summary-size': typeToken(12),
    '--sn-node-icon-size': typeToken(18),
    '--sn-node-link-size': typeToken(12),
    '--sn-node-link-icon-size': typeToken(15),
    '--sn-node-error-frame-header-size': typeToken(12),
    '--sn-node-error-frame-icon-size': typeToken(14),
    '--sn-node-error-frame-body-size': typeToken(11),
    '--sn-node-item-kicker-size': typeToken(10),
    '--sn-node-item-title-size': headingToken(13),
    '--sn-node-item-summary-size': typeToken(11),
    '--sn-port-label-size': typeToken(12),
    '--sn-control-label-size': typeToken(10),
    '--sn-control-input-size': typeToken(12),
    '--sn-node-preview-text-size': typeToken(11),
    '--sn-shape-icon-size': typeToken(40),
    '--sn-button-font-size': typeToken(12),
    '--sn-button-icon-font-size': typeToken(16),
    '--sn-card-title-size': headingToken(11),
    '--sn-banner-font-size': typeToken(12),
    '--sn-banner-icon-size': typeToken(18),
    '--sn-badge-font-size': typeToken(11),
    '--sn-tree-label-size': typeToken(12),
    '--sn-tree-icon-size': typeToken(15),
    '--sn-tree-kind-size': typeToken(10),
    '--sn-tree-badge-size': typeToken(10),
    '--sn-tree-panel-font-size': typeToken(12),
    '--sn-tree-panel-title-size': headingToken(11),
    '--sn-tree-panel-input-size': typeToken(11),
    '--sn-markdown-h1-size': headingToken(24),
    '--sn-markdown-h2-size': headingToken(20),
    '--sn-markdown-h3-size': headingToken(16),
    '--sn-markdown-h4-size': headingToken(14),
    '--sn-chat-markdown-h1-size': headingToken(20),
    '--sn-chat-markdown-h2-size': headingToken(18),
    '--sn-chat-markdown-h3-size': headingToken(16),
    '--sn-chat-markdown-h4-size': headingToken(14),
    '--sn-chat-message-font-size': typeToken(13),
    '--sn-chat-small-size': typeToken(11),
    '--sn-chat-tool-font-size': typeToken(12),
    '--sn-chat-tool-label-size': typeToken(10),
    '--sn-chat-code-size': typeToken(12),
    '--sn-chat-table-size': typeToken(12),
    '--sn-chat-status-card-size': typeToken(12),
    '--sn-chat-live-icon-size': typeToken(14),
    '--sn-chat-meta-icon-size': typeToken(12),
    '--sn-chat-status-icon-size': typeToken(12),
    '--sn-chat-tool-icon-size': typeToken(14),
    '--sn-chat-summary-icon-size': typeToken(16),
    '--sn-chat-sidebar-title-size': typeToken(11),
    '--sn-chat-sidebar-meta-size': typeToken(9),
    '--sn-chat-list-title-size': typeToken(13),
    '--sn-chat-list-meta-size': typeToken(11),
    '--sn-code-font-size': typeToken(12),
    '--sn-code-markdown-size': typeToken(14),
    '--sn-code-table-size': typeToken(13),
    '--sn-composer-input-size': typeToken(13),
    '--sn-composer-send-icon-size': typeToken(18),
    '--sn-composer-footer-size': typeToken(11),
    '--sn-composer-chip-size': typeToken(11),
    '--sn-composer-popup-header-size': typeToken(10),
    '--sn-composer-popup-item-size': typeToken(12),
    '--sn-composer-popup-hint-size': typeToken(10),
    '--sn-composer-voice-label-size': typeToken(11),
    '--sn-composer-voice-preview-size': typeToken(13),
    '--sn-composer-voice-status-size': typeToken(12),
    '--sn-composer-footer-icon-size': typeToken(12),
    '--sn-composer-footer-toggle-icon-size': typeToken(18),
    '--sn-layout-header-button-size': typeToken(12),
    '--sn-layout-header-icon-size': typeToken(16),
    '--sn-layout-header-dropdown-size': typeToken(18),
    '--sn-layout-menu-action-size': typeToken(12),
    '--sn-layout-menu-icon-size': typeToken(16),
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
    '--sn-chat-gap': densityToken(8),
    '--sn-chat-transcript-padding': `${densityToken(18)} ${densityToken(16)} ${densityToken(10)}`,
    '--sn-chat-scroll-bottom': densityToken(82),
    '--sn-chat-message-padding': `${densityToken(12)} ${densityToken(16)}`,
    '--sn-chat-tool-padding': `${densityToken(8)} ${densityToken(12)}`,
    '--sn-chat-code-padding': densityToken(8),
    '--sn-chat-status-card-padding': `${densityToken(10)} ${densityToken(12)}`,
    '--sn-chat-status-card-gap': densityToken(6),
    '--sn-composer-padding': `${densityToken(10)} ${densityToken(14)} ${densityToken(14)}`,
    '--sn-composer-body-padding': `${densityToken(8)} ${densityToken(8)} ${densityToken(8)} ${densityToken(14)}`,
    '--sn-composer-control-gap': densityToken(8),
    '--sn-composer-send-size': densityToken(32),
    '--sn-composer-input-min-height': densityToken(20),
    '--sn-composer-input-padding': `${densityToken(4)} 0`,
    '--sn-composer-footer-gap': densityToken(4),
    '--sn-composer-footer-padding': `${densityToken(6)} ${densityToken(16)} 0`,
    '--sn-composer-footer-btn-min-height': densityToken(24),
    '--sn-composer-footer-btn-padding': `${densityToken(3)} ${densityToken(8)}`,
    '--sn-composer-chip-gap': densityToken(4),
    '--sn-composer-chip-padding': `${densityToken(3)} ${densityToken(8)}`,
    '--sn-composer-autocomplete-padding': densityToken(4),
    '--sn-composer-autocomplete-item-padding': `${densityToken(6)} ${densityToken(10)}`,
    '--sn-composer-popup-inset': densityToken(20),
    '--sn-composer-voice-label-max': densityToken(118),
    '--sn-composer-voice-command-max': densityToken(170),
    '--sn-code-padding': densityToken(12),
    '--sn-code-gutter-padding': `${densityToken(12)} ${densityToken(8)} ${densityToken(12)} ${densityToken(12)}`,
    '--sn-code-gutter-width': densityToken(32),
    '--sn-code-markdown-padding': `${densityToken(20)} ${densityToken(28)}`,
    '--sn-code-table-cell-padding': `${densityToken(6)} ${densityToken(12)}`,
    '--sn-cell-size': densityToken(14),
    '--sn-cell-min-radius': densityToken(2),
    '--sn-cell-max-radius': densityToken(5),
    '--sn-cell-step-ms': `${Math.round(75 / densityScale)}ms`,
    '--sn-cell-fade-rate': `${(0.025 + (1 / densityScale) * 0.015).toFixed(3)}`,
    '--sn-lab-toolbar-gap': densityToken(12),
    '--sn-lab-toolbar-padding': `${densityToken(10)} ${densityToken(12)}`,
    '--sn-lab-title-size': headingToken(14),
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
    '--sn-layout-menu-min-height': densityToken(34),
    '--sn-layout-menu-padding': `${densityToken(3)} ${densityToken(6)}`,
    '--sn-layout-menu-gap': densityToken(4),
    '--sn-layout-menu-action-gap': densityToken(4),
    '--sn-layout-menu-action-height': densityToken(28),
    '--sn-layout-menu-action-padding': `${densityToken(4)} ${densityToken(8)}`,
    '--sn-layout-overflow-inline-size': densityToken(960),
    '--sn-layout-overflow-block-size': densityToken(720),
    '--sn-layout-responsive-panel-min-block-size': densityToken(260),
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
