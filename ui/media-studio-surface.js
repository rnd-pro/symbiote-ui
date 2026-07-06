import {
  createPanel,
  createSplit,
  layoutHasBehaviorMetadata,
  normalizeLayoutBehavior,
} from '../layout/LayoutTree.js';
import {
  HTML_IN_CANVAS_RENDERER,
  getHtmlInCanvasSupport,
} from '../canvas/html-in-canvas.js';

export const MEDIA_STUDIO_PANEL_TYPES = Object.freeze({
  source: 'media-source',
  preview: 'media-preview',
  inspector: 'media-inspector',
  timeline: 'media-timeline',
});

export const MEDIA_STUDIO_FRAME_SOURCE_TYPES = Object.freeze({
  externalBrowser: 'external-browser',
  elementCapture: 'element-capture',
  regionCapture: 'region-capture',
  htmlInCanvas: 'html-in-canvas',
  cachedSequence: 'cached-sequence',
  mediaStream: 'media-stream',
});

export const MEDIA_PREVIEW_STATES = Object.freeze({
  empty: 'empty',
  loading: 'loading',
  waiting: 'waiting',
  ready: 'ready',
  unsupported: 'unsupported',
  error: 'error',
});

export const MEDIA_STUDIO_CSS_PARTS = Object.freeze([
  'surface',
  'source-pane',
  'preview',
  'preview-stage',
  'preview-overlay',
  'transport',
  'timeline',
  'inspector-pane',
  'fallback',
  'progress',
]);

export const MEDIA_STUDIO_STYLE_TOKENS = Object.freeze([
  '--sn-media-studio-bg',
  '--sn-media-studio-border',
  '--sn-media-studio-preview-bg',
  '--sn-media-studio-preview-radius',
  '--sn-media-studio-preview-shadow',
  '--sn-media-studio-timeline-bg',
  '--sn-media-studio-pane-bg',
  '--sn-media-studio-pane-width',
  '--sn-media-studio-timeline-height',
  '--sn-media-studio-timeline-header-width',
  '--sn-media-studio-ruler-height',
  '--sn-media-studio-track-height',
  '--sn-media-studio-control-height',
  '--sn-media-studio-progress-color',
  '--sn-media-studio-panel-gap',
  '--sn-media-studio-toolbar-bg',
  '--sn-media-studio-status-bg',
  '--sn-media-studio-checker-a',
  '--sn-media-studio-checker-b',
  '--sn-media-studio-track-video-bg',
  '--sn-media-studio-track-audio-bg',
  '--sn-media-studio-playhead-color',
]);

export const MEDIA_STUDIO_SURFACE_STYLES = `
  .sn-media-studio-panel,
  .sn-media-studio-timeline-panel,
  .sn-media-studio-progress-shell,
  .sn-media-studio-side-panel {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    height: 100%;
    min-height: 0;
  }

  .sn-media-studio-panel {
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    gap: var(--sn-media-studio-panel-gap, var(--sn-frame-gap, 0px));
    align-content: stretch;
    background: var(--sn-media-studio-bg, var(--sn-media-studio-pane-bg, var(--sn-sys-surface-panel)));
  }

  .sn-media-studio-side-panel {
    display: grid;
    gap: var(--sn-media-studio-panel-gap, var(--sn-frame-gap, 0px));
    align-content: start;
    padding: calc(10px * var(--sn-theme-density, 1));
    min-inline-size: min(100%, var(--sn-media-studio-pane-width, 260px));
    border: 1px solid var(--sn-media-studio-border, color-mix(in srgb, var(--sn-sys-on-surface) 12%, transparent));
    border-radius: var(--sn-media-studio-preview-radius, var(--sn-node-radius, 0px));
    background: var(--sn-media-studio-pane-bg, color-mix(in srgb, var(--sn-sys-surface-panel) 92%, var(--sn-sys-surface)));
  }

  .sn-media-studio-preview-stage {
    display: grid;
    place-items: stretch;
    box-sizing: border-box;
    min-width: 0;
    min-height: 0;
    height: 100%;
    border: 1px solid var(--sn-media-studio-border, color-mix(in srgb, var(--sn-sys-on-surface) 12%, transparent));
    border-radius: var(--sn-media-studio-preview-radius, var(--sn-node-radius, 0px));
    background-color: var(--sn-media-studio-checker-a, var(--sn-media-studio-bg, var(--sn-media-studio-preview-bg, color-mix(in srgb, var(--sn-sys-surface) 84%, black))));
    background-image:
      conic-gradient(
        var(--sn-media-studio-checker-b, color-mix(in srgb, var(--sn-sys-surface) 70%, black)) 25%,
        transparent 25%,
        transparent 50%,
        var(--sn-media-studio-checker-b, color-mix(in srgb, var(--sn-sys-surface) 70%, black)) 50%,
        var(--sn-media-studio-checker-b, color-mix(in srgb, var(--sn-sys-surface) 70%, black)) 75%,
        transparent 75%
      );
    background-size: 20px 20px;
    padding: 0;
    overflow: hidden;
  }

  .sn-media-studio-preview-window {
    box-sizing: border-box;
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: var(--sn-media-studio-preview-shadow, inset 0 0 0 1px color-mix(in srgb, var(--sn-sys-on-surface) 4%, transparent));
  }

  .sn-media-studio-preview-window::before {
    display: none;
  }

  .sn-media-studio-frame {
    display: block;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    background: transparent;
    box-shadow: 0 0 0 1px color-mix(in srgb, black 60%, transparent);
  }

  .sn-media-studio-frame-placeholder {
    display: grid;
    place-items: center;
    gap: 8px;
    padding: 18px;
    color: var(--sn-sys-on-surface-dim);
    text-align: center;
    min-width: 0;
  }

  .sn-media-studio-frame-placeholder strong {
    color: var(--sn-sys-on-surface);
    font-size: calc(13px * var(--sn-theme-type-scale, 1));
  }

  .sn-media-studio-frame-placeholder span {
    max-width: 52ch;
    overflow-wrap: anywhere;
    font-size: calc(12px * var(--sn-theme-type-scale, 1));
  }

  .sn-media-studio-preview-stage[data-preview-state='ready'] .sn-media-studio-frame-placeholder {
    display: none;
  }

  .sn-media-studio-timeline-status {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    min-height: var(--sn-media-studio-control-height, 28px);
    padding: 0 10px;
    border-top: 1px solid var(--sn-media-studio-border, color-mix(in srgb, var(--sn-sys-on-surface) 12%, transparent));
    background: var(--sn-media-studio-status-bg, var(--sn-media-studio-toolbar-bg, var(--sn-sys-surface-panel)));
    color: var(--sn-sys-on-surface-dim);
    font-family: var(--sn-font-mono, monospace);
    font-size: calc(11px * var(--sn-theme-type-scale, 1));
    overflow: hidden;
    white-space: nowrap;
  }

  .sn-media-studio-timeline-status strong {
    color: var(--sn-sys-on-surface);
    font-weight: 600;
  }

  .sn-media-studio-timeline-status [data-media-studio-accent] {
    color: var(--sn-media-studio-progress-color, var(--sn-sys-accent));
  }

  .sn-media-studio-timeline-panel {
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    gap: 0;
    align-content: stretch;
    min-block-size: var(--sn-media-studio-timeline-height, 220px);
    height: 100%;
    overflow: hidden;
    border: 1px solid var(--sn-media-studio-border, color-mix(in srgb, var(--sn-sys-on-surface) 12%, transparent));
    background: var(--sn-media-studio-timeline-bg, color-mix(in srgb, var(--sn-sys-surface) 86%, black));
  }

  .sn-media-studio-timeline-editor {
    min-block-size: 0;
    block-size: 100%;
    inline-size: 100%;
    --te-header-width: var(--sn-media-studio-timeline-header-width, 140px);
    --te-track-height: var(--sn-media-studio-track-height, 36px);
    --te-ruler-height: var(--sn-media-studio-ruler-height, 28px);
    --te-playhead-color: var(--sn-media-studio-playhead-color, var(--sn-media-studio-progress-color, var(--sn-sys-accent)));
    --te-track-bg: var(--sn-media-studio-timeline-bg, var(--sn-sys-surface));
    --te-track-bg-alt: color-mix(in srgb, var(--sn-media-studio-timeline-bg, var(--sn-sys-surface)) 82%, var(--sn-sys-surface-panel));
  }

  .sn-media-studio-timeline-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 0 10px;
    border-bottom: 1px solid var(--sn-media-studio-border, color-mix(in srgb, var(--sn-sys-on-surface) 12%, transparent));
    background: var(--sn-media-studio-toolbar-bg, var(--sn-sys-surface-panel));
    color: var(--sn-sys-on-surface-dim);
  }

  .sn-media-studio-tool-group,
  .sn-media-studio-transport-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .sn-media-studio-transport-controls {
    justify-content: center;
  }

  .sn-media-studio-tool-group[data-align="end"] {
    justify-content: flex-end;
  }

  .sn-media-studio-icon-button {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    min-width: 24px;
    border: 0;
    border-radius: calc(var(--sn-node-radius, 0px) + 2px);
    background: transparent;
    color: inherit;
  }

  .sn-media-studio-icon-button[data-active="true"],
  .sn-media-studio-icon-button:hover {
    background: color-mix(in srgb, var(--sn-sys-on-surface) 8%, transparent);
    color: var(--sn-media-studio-progress-color, var(--sn-sys-accent));
  }

  .sn-media-studio-icon-button .material-symbols-outlined {
    font-size: 18px;
  }

  .sn-media-studio-timeline-canvas {
    display: grid;
    grid-template-rows: 22px minmax(0, 1fr);
    --sn-media-studio-track-label-width: 112px;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .sn-media-studio-ruler {
    display: grid;
    grid-template-columns: var(--sn-media-studio-track-label-width, 112px) repeat(4, minmax(0, 1fr));
    align-items: center;
    min-width: 0;
    padding-inline-end: 10px;
    border-bottom: 1px solid color-mix(in srgb, var(--sn-sys-on-surface) 8%, transparent);
    color: var(--sn-sys-on-surface-dim);
    font-family: var(--sn-font-mono, monospace);
    font-size: calc(11px * var(--sn-theme-type-scale, 1));
  }

  .sn-media-studio-track-stack {
    position: relative;
    display: grid;
    grid-auto-rows: minmax(var(--sn-media-studio-control-height, 28px), 1fr);
    gap: 0;
    min-width: 0;
    min-height: 0;
    background: var(--sn-media-studio-timeline-bg, color-mix(in srgb, var(--sn-sys-surface) 86%, black));
  }

  .sn-media-studio-track-row {
    display: grid;
    grid-template-columns: var(--sn-media-studio-track-label-width, 112px) minmax(0, 1fr);
    gap: 0;
    align-items: center;
    min-width: 0;
    min-height: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--sn-sys-on-surface) 8%, transparent);
  }

  .sn-media-studio-track-name {
    display: flex;
    align-items: center;
    height: 100%;
    padding-inline: 10px;
    border-inline-end: 1px solid color-mix(in srgb, var(--sn-sys-on-surface) 8%, transparent);
    color: var(--sn-sys-on-surface-dim);
    font-size: calc(11px * var(--sn-theme-type-scale, 1));
    text-transform: none;
  }

  .sn-media-studio-track-rail {
    position: relative;
    min-width: 0;
    height: 100%;
    min-height: var(--sn-media-studio-control-height, 28px);
    border-radius: 0;
    background:
      repeating-linear-gradient(
        90deg,
        color-mix(in srgb, var(--sn-sys-on-surface) 9%, transparent) 0 1px,
        transparent 1px 25%
      );
    overflow: hidden;
  }

  .sn-media-studio-track-row:first-child .sn-media-studio-track-rail {
    background:
      repeating-linear-gradient(
        90deg,
        color-mix(in srgb, var(--sn-sys-on-surface) 9%, transparent) 0 1px,
        transparent 1px 25%
      );
  }

  .sn-media-studio-track-rail::before {
    content: "";
    position: absolute;
    inset-block: 0;
    inset-inline-start: var(--sn-media-studio-playhead-position, 13%);
    z-index: 2;
    border-inline-start: 2px solid var(--sn-media-studio-playhead-color, var(--sn-media-studio-progress-color, var(--sn-sys-accent)));
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--sn-sys-surface) 70%, transparent);
    pointer-events: none;
  }

  .sn-media-studio-track-clip {
    box-sizing: border-box;
    position: absolute;
    inset-block: 4px;
    inset-inline-start: var(--clip-start, 0%);
    width: var(--clip-size, 68%);
    z-index: 1;
    min-width: 42px;
    max-width: 100%;
    padding: 3px 8px;
    border-radius: calc(var(--sn-node-radius, 8px) - 2px);
    background: var(--sn-media-studio-track-video-bg, color-mix(in srgb, var(--sn-media-studio-progress-color, var(--sn-sys-accent)) 42%, var(--sn-sys-surface)));
    border: 1px solid color-mix(in srgb, var(--sn-media-studio-progress-color, var(--sn-sys-accent)) 48%, transparent);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: calc(12px * var(--sn-theme-type-scale, 1));
  }

  .sn-media-studio-track-row:nth-child(2) .sn-media-studio-track-clip {
    background: var(--sn-media-studio-track-audio-bg, color-mix(in srgb, var(--sn-sys-warning) 42%, var(--sn-sys-surface)));
    border-color: color-mix(in srgb, var(--sn-sys-warning) 48%, transparent);
  }

  .sn-media-studio-track-row:nth-child(3) .sn-media-studio-track-clip {
    background: color-mix(in srgb, var(--sn-sys-warning) 30%, var(--sn-sys-on-surface) 5%, transparent);
    border-color: color-mix(in srgb, var(--sn-sys-warning) 48%, transparent);
  }

  .sn-media-studio-track-row:nth-child(n + 4) .sn-media-studio-track-clip {
    background: color-mix(in srgb, var(--sn-sys-danger) 24%, var(--sn-sys-on-surface) 5%, transparent);
    border-color: color-mix(in srgb, var(--sn-sys-danger) 42%, transparent);
  }

  .sn-media-studio-progress-shell {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 128px), 1fr));
    gap: calc(8px * var(--sn-theme-density, 1));
    align-content: start;
  }

  .sn-media-studio-inspector-panel {
    display: grid;
    gap: calc(12px * var(--sn-theme-density, 1));
    align-content: start;
    min-width: 0;
    color: var(--sn-sys-on-surface);
  }

  .sn-media-studio-inspector-section {
    display: grid;
    gap: calc(8px * var(--sn-theme-density, 1));
    min-width: 0;
    padding-block-end: calc(10px * var(--sn-theme-density, 1));
    border-block-end: 1px solid color-mix(in srgb, var(--sn-sys-on-surface) 9%, transparent);
  }

  .sn-media-studio-inspector-section:last-child {
    border-block-end: 0;
  }

  .sn-media-studio-inspector-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    color: var(--sn-sys-on-surface);
    font-size: calc(13px * var(--sn-theme-type-scale, 1));
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .sn-media-studio-inspector-heading .material-symbols-outlined {
    color: var(--sn-media-studio-progress-color, var(--sn-sys-accent));
    font-size: 16px;
  }

  .sn-media-studio-field-row {
    display: grid;
    grid-template-columns: minmax(80px, 0.48fr) minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    min-width: 0;
    color: var(--sn-sys-on-surface-dim);
    font-size: calc(12px * var(--sn-theme-type-scale, 1));
  }

  .sn-media-studio-field-value {
    min-width: 0;
    padding: 5px 8px;
    border: 1px solid color-mix(in srgb, var(--sn-sys-on-surface) 8%, transparent);
    border-radius: calc(var(--sn-node-radius, 0px) + 2px);
    background: color-mix(in srgb, black 18%, transparent);
    color: var(--sn-sys-on-surface);
    font-family: var(--sn-font-mono, monospace);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sn-media-studio-progress-shell sn-description-list {
    grid-column: 1 / -1;
    --sn-description-list-columns: minmax(min(9ch, 34%), max-content) minmax(0, 1fr);
  }

  .sn-media-studio-progress-shell sn-metric {
    --sn-metric-value-color: var(--sn-media-studio-progress-color, var(--sn-sys-accent));
  }

`;

const MEDIA_STUDIO_PANEL_BEHAVIORS = Object.freeze({
  root: normalizeLayoutBehavior({
    importance: 100,
    minInlineSize: 640,
    minBlockSize: 420,
    collapse: 'never',
    overflow: 'scroll',
    responsiveMode: 'drawer',
    responsiveBreakpoint: 760,
    mobileDock: 'primary',
    swipeControl: 'edge',
  }),
  row: normalizeLayoutBehavior({
    importance: 90,
    minInlineSize: 480,
    minBlockSize: 260,
    collapse: 'never',
    overflow: 'scroll-inline',
    responsiveMode: 'drawer',
    responsiveBreakpoint: 760,
    mobileDock: 'primary',
  }),
  preview: normalizeLayoutBehavior({
    importance: 100,
    minInlineSize: 420,
    minBlockSize: 240,
    collapse: 'never',
    overflow: 'scroll',
    responsiveMode: 'preserve',
    mobileDock: 'primary',
  }),
  side: normalizeLayoutBehavior({
    importance: 42,
    minInlineSize: 260,
    minBlockSize: 220,
    collapse: 'manual',
    overflow: 'scroll',
    responsiveMode: 'drawer',
    mobileDock: 'start',
    drawerHoverOpen: true,
  }),
  timeline: normalizeLayoutBehavior({
    importance: 78,
    minInlineSize: 420,
    minBlockSize: 132,
    collapse: 'manual',
    overflow: 'scroll-inline',
    responsiveMode: 'stack',
    mobileDock: 'end',
  }),
});

const DEFAULT_PANEL_TITLES = Object.freeze({
  [MEDIA_STUDIO_PANEL_TYPES.source]: 'Source',
  [MEDIA_STUDIO_PANEL_TYPES.preview]: 'Preview',
  [MEDIA_STUDIO_PANEL_TYPES.inspector]: 'Inspector',
  [MEDIA_STUDIO_PANEL_TYPES.timeline]: 'Timeline',
});

const DEFAULT_PANEL_ICONS = Object.freeze({
  [MEDIA_STUDIO_PANEL_TYPES.source]: 'input',
  [MEDIA_STUDIO_PANEL_TYPES.preview]: 'smart_display',
  [MEDIA_STUDIO_PANEL_TYPES.inspector]: 'tune',
  [MEDIA_STUDIO_PANEL_TYPES.timeline]: 'view_timeline',
});

export const MEDIA_FRAME_SOURCE_PROVIDER_METADATA = Object.freeze([
  Object.freeze({
    id: MEDIA_STUDIO_FRAME_SOURCE_TYPES.externalBrowser,
    label: 'External browser frames',
    status: 'service-required',
    runtime: 'external-service',
    sourceKinds: ['url', 'route', 'workspace-surface'],
    outputKinds: ['frame-stream', 'cached-sequence', 'progress'],
    capabilities: ['real-browser-pixels', 'shadow-dom', 'canvas', 'css-animation', 'overlay-capture'],
    supportKey: 'externalBrowserFrameSource',
    fallback: {
      state: MEDIA_PREVIEW_STATES.unsupported,
      reason: 'missing-frame-source-service',
    },
  }),
  Object.freeze({
    id: MEDIA_STUDIO_FRAME_SOURCE_TYPES.elementCapture,
    label: 'Element Capture',
    status: 'experimental',
    runtime: 'browser-api',
    sourceKinds: ['element'],
    outputKinds: ['media-stream'],
    capabilities: ['live-preview', 'element-subtree-capture', 'user-mediated-capture'],
    supportKey: 'elementCapture',
    fallback: {
      state: MEDIA_PREVIEW_STATES.unsupported,
      reason: 'element-capture-unavailable',
    },
  }),
  Object.freeze({
    id: MEDIA_STUDIO_FRAME_SOURCE_TYPES.regionCapture,
    label: 'Region Capture',
    status: 'experimental',
    runtime: 'browser-api',
    sourceKinds: ['element-bounds', 'current-tab'],
    outputKinds: ['media-stream'],
    capabilities: ['live-preview', 'cropped-tab-capture', 'user-mediated-capture'],
    supportKey: 'regionCapture',
    fallback: {
      state: MEDIA_PREVIEW_STATES.unsupported,
      reason: 'region-capture-unavailable',
    },
  }),
  Object.freeze({
    id: MEDIA_STUDIO_FRAME_SOURCE_TYPES.htmlInCanvas,
    label: 'HTML in Canvas',
    status: HTML_IN_CANVAS_RENDERER.status,
    runtime: 'browser-api',
    sourceKinds: ['element', 'canvas'],
    outputKinds: ['canvas-frame', 'texture'],
    capabilities: HTML_IN_CANVAS_RENDERER.capabilities,
    supportKey: 'htmlInCanvas',
    fallback: {
      state: MEDIA_PREVIEW_STATES.unsupported,
      reason: 'html-in-canvas-unavailable',
    },
  }),
  Object.freeze({
    id: MEDIA_STUDIO_FRAME_SOURCE_TYPES.cachedSequence,
    label: 'Cached frame sequence',
    status: 'draft',
    runtime: 'library',
    sourceKinds: ['image-sequence', 'frame-cache'],
    outputKinds: ['scrubbable-preview', 'encoder-input'],
    capabilities: ['replay', 'scrub', 'filmstrip', 'offline-preview'],
    supportKey: 'cachedSequence',
    fallback: {
      state: MEDIA_PREVIEW_STATES.empty,
      reason: 'missing-cached-frames',
    },
  }),
  Object.freeze({
    id: MEDIA_STUDIO_FRAME_SOURCE_TYPES.mediaStream,
    label: 'MediaStream',
    status: 'draft',
    runtime: 'browser-api',
    sourceKinds: ['media-stream', 'display-media'],
    outputKinds: ['live-preview'],
    capabilities: ['live-preview', 'user-mediated-capture'],
    supportKey: 'displayMedia',
    fallback: {
      state: MEDIA_PREVIEW_STATES.unsupported,
      reason: 'display-media-unavailable',
    },
  }),
]);

export const MEDIA_STUDIO_SURFACE_CONTRACT = Object.freeze({
  name: 'media-studio-surface',
  specifier: 'symbiote-ui/ui',
  status: 'draft',
  schemaVersion: 'media-studio-surface-v1',
  topology: {
    preview: 'center',
    timeline: 'bottom',
    sidePanes: ['source', 'inspector'],
    sidePaneDefault: { source: 'collapsed', inspector: 'expanded' },
  },
  panelTypes: MEDIA_STUDIO_PANEL_TYPES,
  frameSourceTypes: MEDIA_STUDIO_FRAME_SOURCE_TYPES,
  capabilities: [
    'nle-editor-topology',
    'central-preview',
    'bottom-timeline',
    'collapsible-side-panes',
    'expanded-inspector',
    'replaceable-frame-sources',
    'preview-fallback-state',
  ],
  parts: MEDIA_STUDIO_CSS_PARTS,
  themeAliases: MEDIA_STUDIO_STYLE_TOKENS,
});

function clonePlain(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(clonePlain);
  return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, clonePlain(val)]));
}

function finiteNumber(value, fallback, min = -Infinity, max = Infinity) {
  let number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function cleanText(value, fallback = '') {
  let text = String(value ?? '').trim();
  return text ? text : fallback;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function globalDocument() {
  return typeof document !== 'undefined' ? document : null;
}

function panelTitle(panelType, options = {}) {
  let titles = options.titles && typeof options.titles === 'object' ? options.titles : {};
  return cleanText(titles[panelType], DEFAULT_PANEL_TITLES[panelType] || panelType);
}

function createMediaPanel(panelType, options = {}) {
  let state = {
    region: options.region || panelType,
    title: panelTitle(panelType, options),
    icon: DEFAULT_PANEL_ICONS[panelType] || 'dashboard',
    ...clonePlain(options.panelState || {}),
  };
  let panel = createPanel(panelType, state, options.behavior);
  panel.collapsed = Boolean(options.collapsed);
  if (options.id) panel.id = String(options.id);
  return panel;
}

function containsPanelType(node, panelType) {
  if (!node) return false;
  if (node.type === 'panel') return node.panelType === panelType;
  return containsPanelType(node.first, panelType) || containsPanelType(node.second, panelType);
}

function collectPanels(node, panels = []) {
  if (!node) return panels;
  if (node.type === 'panel') {
    panels.push(node);
    return panels;
  }
  collectPanels(node.first, panels);
  collectPanels(node.second, panels);
  return panels;
}

function panelConfig(panelType, behavior, options = {}) {
  return {
    title: panelTitle(panelType, options),
    icon: DEFAULT_PANEL_ICONS[panelType] || 'dashboard',
    region: options.region || panelType,
    collapsible: behavior.collapse !== 'never',
    behavior: clonePlain(behavior),
  };
}

export function createMediaStudioPanelTypes(options = {}) {
  return {
    [MEDIA_STUDIO_PANEL_TYPES.source]: panelConfig(MEDIA_STUDIO_PANEL_TYPES.source, MEDIA_STUDIO_PANEL_BEHAVIORS.side, {
      ...options,
      region: 'start',
    }),
    [MEDIA_STUDIO_PANEL_TYPES.preview]: panelConfig(MEDIA_STUDIO_PANEL_TYPES.preview, MEDIA_STUDIO_PANEL_BEHAVIORS.preview, {
      ...options,
      region: 'center',
    }),
    [MEDIA_STUDIO_PANEL_TYPES.inspector]: panelConfig(MEDIA_STUDIO_PANEL_TYPES.inspector, MEDIA_STUDIO_PANEL_BEHAVIORS.side, {
      ...options,
      region: 'end',
    }),
    [MEDIA_STUDIO_PANEL_TYPES.timeline]: panelConfig(MEDIA_STUDIO_PANEL_TYPES.timeline, MEDIA_STUDIO_PANEL_BEHAVIORS.timeline, {
      ...options,
      region: 'bottom',
    }),
  };
}

export function createMediaStudioLayout(options = {}) {
  let ids = options.ids && typeof options.ids === 'object' ? options.ids : {};
  let source = createMediaPanel(MEDIA_STUDIO_PANEL_TYPES.source, {
    ...options,
    id: ids.source,
    region: 'start',
    behavior: MEDIA_STUDIO_PANEL_BEHAVIORS.side,
    collapsed: options.sourceCollapsed ?? true,
  });
  let preview = createMediaPanel(MEDIA_STUDIO_PANEL_TYPES.preview, {
    ...options,
    id: ids.preview,
    region: 'center',
    behavior: MEDIA_STUDIO_PANEL_BEHAVIORS.preview,
  });
  let inspector = createMediaPanel(MEDIA_STUDIO_PANEL_TYPES.inspector, {
    ...options,
    id: ids.inspector,
    region: 'end',
    behavior: MEDIA_STUDIO_PANEL_BEHAVIORS.side,
    collapsed: options.inspectorCollapsed ?? false,
  });
  let timeline = createMediaPanel(MEDIA_STUDIO_PANEL_TYPES.timeline, {
    ...options,
    id: ids.timeline,
    region: 'bottom',
    behavior: MEDIA_STUDIO_PANEL_BEHAVIORS.timeline,
    collapsed: options.timelineCollapsed ?? false,
  });

  let previewInspectorRatio = finiteNumber(options.previewInspectorRatio, 0.74, 0.35, 0.92);
  let sourcePreviewRatio = finiteNumber(options.sourcePreviewRatio, 0.16, 0.08, 0.45);
  let previewTimelineRatio = finiteNumber(options.previewTimelineRatio, 0.72, 0.42, 0.88);
  let previewWithInspector = createSplit('horizontal', preview, inspector, previewInspectorRatio, MEDIA_STUDIO_PANEL_BEHAVIORS.row);
  let editorRow = createSplit('horizontal', source, previewWithInspector, sourcePreviewRatio, MEDIA_STUDIO_PANEL_BEHAVIORS.row);
  return createSplit('vertical', editorRow, timeline, previewTimelineRatio, MEDIA_STUDIO_PANEL_BEHAVIORS.root);
}

export function getMediaStudioTopology(layoutTree) {
  let panels = collectPanels(layoutTree);
  let panelTypes = panels.map((panel) => panel.panelType);
  let source = panels.find((panel) => panel.panelType === MEDIA_STUDIO_PANEL_TYPES.source);
  let preview = panels.find((panel) => panel.panelType === MEDIA_STUDIO_PANEL_TYPES.preview);
  let inspector = panels.find((panel) => panel.panelType === MEDIA_STUDIO_PANEL_TYPES.inspector);
  let timeline = panels.find((panel) => panel.panelType === MEDIA_STUDIO_PANEL_TYPES.timeline);
  let timelineIsBottom = layoutTree?.type === 'split' &&
    layoutTree.direction === 'vertical' &&
    containsPanelType(layoutTree.second, MEDIA_STUDIO_PANEL_TYPES.timeline);
  let previewIsCentral = layoutTree?.type === 'split' &&
    containsPanelType(layoutTree.first, MEDIA_STUDIO_PANEL_TYPES.preview);
  let sidePanes = [source, inspector].filter(Boolean);
  let sidePanesCollapsible = sidePanes.every((panel) => panel.behavior?.collapse !== 'never');
  let sidePanesCollapsed = sidePanes.every((panel) => panel.collapsed === true);
  let sourceCollapsed = source?.collapsed === true;
  let inspectorExpanded = inspector?.collapsed !== true;

  return {
    panelTypes,
    previewPanelId: preview?.id || null,
    timelinePanelId: timeline?.id || null,
    sourcePanelId: source?.id || null,
    inspectorPanelId: inspector?.id || null,
    previewIsCentral,
    timelineIsBottom,
    sidePanesCollapsed,
    sourceCollapsed,
    inspectorExpanded,
    sidePanesCollapsible,
    behaviorMetadata: layoutHasBehaviorMetadata(layoutTree),
    valid: Boolean(preview && timeline && timelineIsBottom && previewIsCentral && sidePanesCollapsible),
  };
}

export function hasMediaStudioTopology(layoutTree) {
  return getMediaStudioTopology(layoutTree).valid;
}

function getTarget(options = {}) {
  return options.globalThis || options.target || globalThis;
}

function hasFn(source, name) {
  return typeof source?.[name] === 'function';
}

function hasDisplayMedia(target, options = {}) {
  let navigatorRef = options.navigator || target?.navigator;
  return hasFn(navigatorRef?.mediaDevices, 'getDisplayMedia');
}

function hasRegionCapture(target, options = {}) {
  let CropTarget = options.CropTarget || target?.CropTarget;
  let Track = options.MediaStreamTrack || target?.MediaStreamTrack;
  return hasFn(CropTarget, 'fromElement') && hasFn(Track?.prototype, 'cropTo');
}

function hasElementCapture(target, options = {}) {
  let RestrictionTarget = options.RestrictionTarget || target?.RestrictionTarget;
  let Track = options.MediaStreamTrack || target?.MediaStreamTrack;
  return hasFn(RestrictionTarget, 'fromElement') && hasFn(Track?.prototype, 'restrictTo');
}

export function getMediaFrameSourceSupport(options = {}) {
  let target = getTarget(options);
  let htmlInCanvas = getHtmlInCanvasSupport(target);
  let cachedSequence = Boolean(options.cachedSequence || options.frameCache || options.sequenceCache || options.cachedFrames);
  return {
    externalBrowserFrameSource: Boolean(options.externalBrowserFrameSource || options.browserFrameSourceService),
    displayMedia: hasDisplayMedia(target, options),
    elementCapture: hasElementCapture(target, options),
    regionCapture: hasRegionCapture(target, options),
    htmlInCanvas: Boolean(htmlInCanvas.supported),
    cachedSequence,
    htmlInCanvasDetail: htmlInCanvas,
  };
}

export function getMediaFrameSourceProvider(providerId) {
  let id = cleanText(providerId);
  return MEDIA_FRAME_SOURCE_PROVIDER_METADATA.find((provider) => provider.id === id) || null;
}

export function listMediaFrameSourceProviders(options = {}) {
  let support = options.support && typeof options.support === 'object'
    ? options.support
    : getMediaFrameSourceSupport(options);
  return MEDIA_FRAME_SOURCE_PROVIDER_METADATA.map((provider) => {
    let supported = Boolean(support[provider.supportKey]);
    return {
      ...clonePlain(provider),
      supported,
      fallback: supported ? null : clonePlain(provider.fallback),
    };
  });
}

export function normalizeMediaFrameSource(source = {}, options = {}) {
  let input = source && typeof source === 'object' ? source : {};
  let providerId = cleanText(
    input.providerId || input.provider || input.type || input.id,
    MEDIA_STUDIO_FRAME_SOURCE_TYPES.cachedSequence
  );
  let provider = getMediaFrameSourceProvider(providerId) ||
    getMediaFrameSourceProvider(MEDIA_STUDIO_FRAME_SOURCE_TYPES.cachedSequence);
  let providerState = listMediaFrameSourceProviders(options).find((item) => item.id === provider.id);
  let status = cleanText(input.status, providerState.supported ? 'ready' : 'unavailable');

  return {
    id: cleanText(input.id, provider.id),
    providerId: provider.id,
    label: cleanText(input.label, provider.label),
    status,
    source: input.source || input.url || input.route || input.surfaceId || null,
    target: input.target || input.element || input.region || null,
    cacheKey: input.cacheKey || input.sequenceId || null,
    progress: normalizeMediaProgress(input.progress),
    provider: providerState,
    capabilities: [...provider.capabilities],
    fallback: status === 'unavailable' || !providerState.supported ? clonePlain(providerState.fallback) : null,
  };
}

function normalizeMediaProgress(value) {
  if (value === undefined || value === null || value === '') return null;
  let number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number > 1) number = number / 100;
  return Math.min(1, Math.max(0, number));
}

function hasRenderablePreview(input) {
  return Boolean(
    input.src ||
    input.url ||
    input.blob ||
    input.stream ||
    input.currentFrame ||
    input.frame ||
    (Array.isArray(input.frames) && input.frames.length)
  );
}

export function normalizeMediaPreviewState(preview = {}, options = {}) {
  let input = preview && typeof preview === 'object' ? preview : {};
  let frameSource = input.frameSource
    ? normalizeMediaFrameSource(input.frameSource, options)
    : null;
  let status = cleanText(input.status || frameSource?.status);
  let progress = normalizeMediaProgress(input.progress ?? frameSource?.progress);

  if (input.error || status === MEDIA_PREVIEW_STATES.error) {
    return {
      state: MEDIA_PREVIEW_STATES.error,
      reason: cleanText(input.reason, 'preview-error'),
      error: input.error || null,
      progress,
      fallback: {
        state: MEDIA_PREVIEW_STATES.error,
        reason: cleanText(input.reason, 'preview-error'),
      },
    };
  }

  if (frameSource?.fallback && (status === 'unavailable' || status === MEDIA_PREVIEW_STATES.unsupported || !hasRenderablePreview(input))) {
    return {
      state: frameSource.fallback.state,
      reason: frameSource.fallback.reason,
      frameSource,
      progress,
      fallback: clonePlain(frameSource.fallback),
    };
  }

  if (['queued', 'loading', 'capturing', 'rendering', 'buffering'].includes(status)) {
    return {
      state: MEDIA_PREVIEW_STATES.loading,
      reason: cleanText(input.reason, status),
      frameSource,
      progress,
      fallback: null,
    };
  }

  if (hasRenderablePreview(input)) {
    return {
      state: MEDIA_PREVIEW_STATES.ready,
      reason: Array.isArray(input.frames) && input.frames.length ? 'cached-sequence-ready' : 'preview-ready',
      mode: Array.isArray(input.frames) && input.frames.length ? MEDIA_STUDIO_FRAME_SOURCE_TYPES.cachedSequence : 'live',
      frameSource,
      progress: progress ?? 1,
      fallback: null,
    };
  }

  if (frameSource) {
    return {
      state: MEDIA_PREVIEW_STATES.waiting,
      reason: cleanText(input.reason, 'waiting-for-frames'),
      frameSource,
      progress,
      fallback: {
        state: MEDIA_PREVIEW_STATES.waiting,
        reason: cleanText(input.reason, 'waiting-for-frames'),
      },
    };
  }

  return {
    state: MEDIA_PREVIEW_STATES.empty,
    reason: 'missing-source',
    frameSource: null,
    progress,
    fallback: {
      state: MEDIA_PREVIEW_STATES.empty,
      reason: 'missing-source',
    },
  };
}

export function ensureMediaStudioSurfaceStyles(target = globalDocument()) {
  let doc = target?.ownerDocument || target;
  if (!doc?.createElement || !doc?.head) return null;
  let existing = doc.head.querySelector?.('style[data-symbiote-ui="media-studio-surface"]');
  if (existing) return existing;
  let style = doc.createElement('style');
  style.setAttribute('data-symbiote-ui', 'media-studio-surface');
  style.textContent = MEDIA_STUDIO_SURFACE_STYLES;
  doc.head.appendChild(style);
  return style;
}

function firstFrameUrl(input = {}) {
  let frame = input.currentFrame || input.frame || (Array.isArray(input.frames) ? input.frames[0] : null);
  if (typeof frame === 'string') return frame;
  return frame?.url || frame?.src || frame?.href || input.src || input.url || '';
}

function frameCount(input = {}) {
  if (Array.isArray(input.frames)) return input.frames.length;
  let count = Number(input.frameCount || input.cacheFrameCount || input.manifest?.frameCount);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

function percentLabel(progress) {
  let value = normalizeMediaProgress(progress);
  if (value === null) return 'ready';
  return `${Math.round(value * 100)}%`;
}

function timelineClip(input = {}, index = 0) {
  let start = finiteNumber(input.startPercent ?? input.start, Math.min(index * 8, 40), 0, 96);
  let size = finiteNumber(input.sizePercent ?? input.size ?? input.durationPercent, Math.max(20, 72 - index * 8), 4, 100);
  return {
    lane: cleanText(input.lane || input.track || input.name, index === 0 ? 'video' : `track ${index + 1}`),
    label: cleanText(input.label || input.title || input.text, `clip ${index + 1}`),
    start,
    size: Math.min(size, 100 - start),
  };
}

function timelineTrackType(lane = '') {
  let value = String(lane || '').toLowerCase();
  if (value.includes('voice') || value.includes('audio') || value.includes('sound') || value.includes('narration')) return 'audio';
  if (value.includes('caption') || value.includes('subtitle') || value.includes('title') || value.includes('text')) return 'text';
  if (value.includes('effect') || value.includes('action') || value.includes('sync')) return 'effect';
  return 'video';
}

export function normalizeMediaStudioTimelineData(options = {}) {
  let clips = (Array.isArray(options.clips) && options.clips.length ? options.clips : [
    { lane: 'video', label: 'FrameSource cache', startPercent: 0, sizePercent: 78 },
    { lane: 'voice', label: 'Narration provider', startPercent: 8, sizePercent: 64 },
    { lane: 'captions', label: 'Whisper sync', startPercent: 14, sizePercent: 58 },
    { lane: 'actions', label: 'Workspace actions', startPercent: 22, sizePercent: 46 },
  ]).map(timelineClip);
  let fps = Math.max(1, Math.round(finiteNumber(options.fps, 30, 1, 120)));
  let duration = Math.max(1, Math.round(finiteNumber(options.durationFrames ?? options.duration, fps * 15, 1, fps * 3600)));
  let tracks = [];
  let trackByLane = new Map();

  clips.forEach((clip, index) => {
    let laneId = clip.lane.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `track-${index + 1}`;
    let track = trackByLane.get(laneId);
    if (!track) {
      track = {
        id: laneId,
        type: timelineTrackType(clip.lane),
        label: clip.lane,
        clips: [],
      };
      trackByLane.set(laneId, track);
      tracks.push(track);
    }
    let start = Math.round((clip.start / 100) * duration);
    let end = Math.max(start + 1, Math.round(((clip.start + clip.size) / 100) * duration));
    track.clips.push({
      id: `${laneId}-${track.clips.length + 1}`,
      start,
      end: Math.min(end, duration),
      label: clip.label,
    });
  });

  return {
    fps,
    duration,
    tracks,
    markers: Array.isArray(options.markers) ? options.markers : [],
  };
}

export function renderMediaStudioPreviewPanelMarkup(options = {}) {
  let preview = options.preview && typeof options.preview === 'object' ? options.preview : {};
  let previewState = normalizeMediaPreviewState({
    ...preview,
    status: options.status ?? preview.status,
    progress: options.progress ?? preview.progress,
    frameSource: options.frameSource || preview.frameSource,
  }, options.support || options);
  let frameUrl = firstFrameUrl(preview);
  let sourceTitle = cleanText(options.sourceTitle || preview.sourceTitle, 'Workspace source');
  let provider = cleanText(previewState.frameSource?.providerId || options.provider, MEDIA_STUDIO_FRAME_SOURCE_TYPES.externalBrowser);
  let cacheKey = cleanText(previewState.frameSource?.cacheKey || options.cacheKey, '');
  return `
    <div class="sn-media-studio-panel" data-media-studio-role="preview" data-preview-state="${escapeHtml(previewState.state)}" data-frame-source-provider="${escapeHtml(provider)}" data-frame-cache-key="${escapeHtml(cacheKey)}">
      <div class="sn-media-studio-preview-stage" aria-label="FrameSource preview" data-preview-state="${escapeHtml(previewState.state)}" data-frame-progress="${escapeHtml(percentLabel(previewState.progress))}">
        <div class="sn-media-studio-preview-window" data-render-proof="frame-source-cache">
          ${frameUrl ? `<img class="sn-media-studio-frame" src="${escapeHtml(frameUrl)}" alt="${escapeHtml(sourceTitle)} frame">` : `
            <div class="sn-media-studio-frame-placeholder" data-frame-source-state="${escapeHtml(previewState.state)}">
              <strong>${escapeHtml(previewState.state)}</strong>
              <span>${escapeHtml(previewState.reason || 'waiting-for-frames')}</span>
            </div>`}
        </div>
      </div>
    </div>`;
}

export function renderMediaStudioTimelinePanelMarkup(options = {}) {
  let data = normalizeMediaStudioTimelineData(options);
  return `
    <div class="sn-media-studio-timeline-panel" data-media-studio-role="timeline">
      <sn-timeline-editor class="sn-media-studio-timeline-editor" data-media-studio-timeline-editor data-track-count="${data.tracks.length}" data-duration-frames="${data.duration}"></sn-timeline-editor>
    </div>`;
}

export function hydrateMediaStudioTimelinePanel(root, options = {}) {
  let host = root?.matches?.('[data-media-studio-timeline-editor]')
    ? root
    : root?.querySelector?.('[data-media-studio-timeline-editor]');
  if (!host) return null;
  let data = normalizeMediaStudioTimelineData(options);
  let currentFrame = Math.round(finiteNumber(options.currentFrame ?? options.frame, 0, 0, data.duration));
  let load = () => {
    if (typeof host.loadTimeline !== 'function') return false;
    host.loadTimeline(data);
    try { host.setFrame?.(currentFrame); } catch {}
    return true;
  };
  if (load()) return data;
  try {
    globalThis.customElements?.whenDefined?.('sn-timeline-editor')?.then(load).catch(() => {});
  } catch {}
  return data;
}

function inspectorRows(rows = []) {
  return rows.map((row) => `
    <div class="sn-media-studio-field-row">
      <span>${escapeHtml(row.label)}</span>
      <span class="sn-media-studio-field-value">${escapeHtml(row.value)}</span>
    </div>`).join('');
}

export function renderMediaStudioInspectorPanelMarkup(options = {}) {
  let state = options.state && typeof options.state === 'object' ? options.state : {};
  let status = cleanText(options.status || state.status, 'idle');
  let progress = normalizeMediaProgress(options.progress ?? state.progress);
  let source = cleanText(options.source || state.source, MEDIA_STUDIO_FRAME_SOURCE_TYPES.externalBrowser);
  let frames = Number(state.frameCount || options.frameCount || 0);
  let output = cleanText(options.output || state.output || 'workspace-tour.mp4');
  let formatRows = options.formatRows || [
    { label: 'Aspect ratio', value: cleanText(options.aspectRatio || state.aspectRatio, '16:9') },
    { label: 'Source', value: source },
  ];
  let renderRows = options.renderRows || [
    { label: 'Status', value: status },
    { label: 'Progress', value: percentLabel(progress) },
    { label: 'Frames', value: Number.isFinite(frames) && frames > 0 ? String(frames) : 'pending' },
  ];
  let outputRows = options.outputRows || [
    { label: 'Codec', value: cleanText(options.codec || state.codec, 'H.264') },
    { label: 'Format', value: cleanText(options.format || state.format, 'MP4') },
    { label: 'Output', value: output },
  ];

  return `
    <div class="sn-media-studio-inspector-panel" data-media-studio-role="inspector" data-render-status="${escapeHtml(status)}">
      <section class="sn-media-studio-inspector-section">
        <h3 class="sn-media-studio-inspector-heading"><i class="material-symbols-outlined">aspect_ratio</i> Format</h3>
        ${inspectorRows(formatRows)}
      </section>
      <section class="sn-media-studio-inspector-section">
        <h3 class="sn-media-studio-inspector-heading"><i class="material-symbols-outlined">movie_filter</i> Render</h3>
        ${inspectorRows(renderRows)}
      </section>
      <section class="sn-media-studio-inspector-section">
        <h3 class="sn-media-studio-inspector-heading"><i class="material-symbols-outlined">drive_folder_upload</i> Output</h3>
        ${inspectorRows(outputRows)}
      </section>
      ${renderMediaStudioProgressPanelMarkup(options)}
    </div>`;
}

export function renderMediaStudioProgressPanelMarkup(options = {}) {
  let state = options.state && typeof options.state === 'object' ? options.state : {};
  let status = cleanText(options.status || state.status, 'idle');
  let progress = normalizeMediaProgress(options.progress ?? state.progress);
  let channel = cleanText(options.progressChannel || state.progressChannel, 'media.frame-source.progress');
  let source = cleanText(options.source || state.source, MEDIA_STUDIO_FRAME_SOURCE_TYPES.externalBrowser);
  let frames = Number(state.frameCount || options.frameCount || 0);
  return `
    <div class="sn-media-studio-progress-shell" data-render-status="${escapeHtml(status)}" data-progress-channel="${escapeHtml(channel)}">
      <sn-metric>
        <span slot="label">Status</span>
        <span slot="value">${escapeHtml(status)}</span>
      </sn-metric>
      <sn-metric>
        <span slot="label">Frames</span>
        <span slot="value">${Number.isFinite(frames) && frames > 0 ? String(frames) : percentLabel(progress)}</span>
      </sn-metric>
      <sn-description-list>
        <sn-description-item label="Channel">${escapeHtml(channel)}</sn-description-item>
        <sn-description-item label="Source">${escapeHtml(source)}</sn-description-item>
        ${state.cacheKey || options.cacheKey ? `<sn-description-item label="Cache">${escapeHtml(state.cacheKey || options.cacheKey)}</sn-description-item>` : ''}
        ${state.error ? `<sn-description-item label="Error">${escapeHtml(state.error)}</sn-description-item>` : ''}
      </sn-description-list>
    </div>`;
}
