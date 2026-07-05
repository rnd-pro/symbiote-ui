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
  '--sn-media-studio-control-height',
  '--sn-media-studio-progress-color',
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
    grid-template-rows: minmax(0, 1fr) auto;
    gap: calc(8px * var(--sn-theme-density, 1));
    align-content: stretch;
  }

  .sn-media-studio-side-panel {
    display: grid;
    gap: calc(8px * var(--sn-theme-density, 1));
    align-content: start;
    padding: calc(2px * var(--sn-theme-density, 1));
    min-inline-size: min(100%, var(--sn-media-studio-pane-width, 260px));
    border: 1px solid var(--sn-media-studio-border, color-mix(in srgb, var(--sn-sys-on-surface) 12%, transparent));
    border-radius: var(--sn-media-studio-preview-radius, var(--sn-node-radius, 8px));
    background: var(--sn-media-studio-pane-bg, color-mix(in srgb, var(--sn-sys-surface-panel) 92%, var(--sn-sys-surface)));
  }

  .sn-media-studio-preview-stage {
    display: grid;
    box-sizing: border-box;
    min-width: 0;
    min-height: 240px;
    border: 1px solid var(--sn-media-studio-border, color-mix(in srgb, var(--sn-sys-on-surface) 12%, transparent));
    border-radius: var(--sn-media-studio-preview-radius, var(--sn-node-radius, 8px));
    background: var(--sn-media-studio-bg, color-mix(in srgb, var(--sn-sys-surface) 92%, black));
    padding: calc(10px * var(--sn-theme-density, 1));
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
    min-height: 220px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--sn-sys-on-surface) 10%, transparent);
    border-radius: var(--sn-media-studio-preview-radius, var(--sn-node-radius, 8px));
    background:
      radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--sn-sys-on-surface) 5%, transparent), transparent 42%),
      linear-gradient(180deg, color-mix(in srgb, var(--sn-sys-on-surface) 3%, transparent), transparent 40%),
      var(--sn-media-studio-preview-bg, color-mix(in srgb, var(--sn-sys-surface) 86%, black));
    box-shadow: var(--sn-media-studio-preview-shadow, inset 0 0 0 1px color-mix(in srgb, var(--sn-sys-on-surface) 4%, transparent));
  }

  .sn-media-studio-preview-window::before {
    content: "";
    position: absolute;
    inset: clamp(18px, 5%, 42px);
    border: 1px dashed color-mix(in srgb, var(--sn-sys-on-surface) 18%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, black 18%, transparent);
    pointer-events: none;
  }

  .sn-media-studio-frame {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: black;
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

  .sn-media-studio-overlay {
    position: absolute;
    inset-inline: 10px;
    inset-block-end: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    max-width: calc(100% - 20px);
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--sn-sys-on-surface) 12%, transparent);
    border-radius: var(--sn-node-radius, 8px);
    background: color-mix(in srgb, var(--sn-sys-surface) 78%, transparent);
    backdrop-filter: blur(10px);
    font-size: calc(12px * var(--sn-theme-type-scale, 1));
  }

  .sn-media-studio-overlay strong,
  .sn-media-studio-overlay span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .sn-media-studio-overlay span {
    color: var(--sn-sys-on-surface-dim);
  }

  .sn-media-studio-transport {
    position: absolute;
    inset-inline: 10px;
    inset-block-start: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    max-width: calc(100% - 20px);
    min-width: 0;
    color: var(--sn-sys-on-surface-dim);
    font-family: var(--sn-font-mono, monospace);
    font-size: calc(11px * var(--sn-theme-type-scale, 1));
    pointer-events: none;
  }

  .sn-media-studio-transport span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 4px 7px;
    border: 1px solid color-mix(in srgb, var(--sn-sys-on-surface) 10%, transparent);
    border-radius: calc(var(--sn-node-radius, 8px) - 2px);
    background: color-mix(in srgb, var(--sn-sys-surface) 58%, transparent);
  }

  .sn-media-studio-transport .material-symbols-outlined {
    color: var(--sn-media-studio-progress-color, var(--sn-sys-accent));
    font-size: 16px;
    line-height: 1;
  }

  .sn-media-studio-timeline-panel {
    display: grid;
    gap: calc(7px * var(--sn-theme-density, 1));
    align-content: start;
    padding: calc(2px * var(--sn-theme-density, 1));
    min-block-size: var(--sn-media-studio-timeline-height, 132px);
  }

  .sn-media-studio-ruler {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: var(--sn-sys-on-surface-dim);
    font-family: var(--sn-font-mono, monospace);
    font-size: calc(11px * var(--sn-theme-type-scale, 1));
  }

  .sn-media-studio-track-stack {
    position: relative;
    display: grid;
    gap: calc(7px * var(--sn-theme-density, 1));
    min-width: 0;
  }

  .sn-media-studio-track-stack::before {
    content: "";
    position: absolute;
    inset-block: -2px;
    inset-inline-start: 42%;
    z-index: 2;
    border-inline-start: 2px solid var(--sn-media-studio-progress-color, var(--sn-sys-accent));
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--sn-sys-surface) 70%, transparent);
    pointer-events: none;
  }

  .sn-media-studio-track-row {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    min-width: 0;
  }

  .sn-media-studio-track-name {
    color: var(--sn-sys-on-surface-dim);
    font-size: calc(11px * var(--sn-theme-type-scale, 1));
    text-transform: uppercase;
  }

  .sn-media-studio-track-rail {
    position: relative;
    min-width: 0;
    min-height: var(--sn-media-studio-control-height, 28px);
    border-radius: var(--sn-node-radius, 8px);
    background: var(--sn-media-studio-timeline-bg, color-mix(in srgb, var(--sn-sys-on-surface) 5%, transparent));
    overflow: hidden;
  }

  .sn-media-studio-track-row:first-child .sn-media-studio-track-rail {
    background:
      repeating-linear-gradient(90deg, color-mix(in srgb, var(--sn-sys-on-surface) 10%, transparent) 0 1px, transparent 1px 18px),
      var(--sn-media-studio-timeline-bg, color-mix(in srgb, var(--sn-sys-on-surface) 5%, transparent));
  }

  .sn-media-studio-track-clip {
    box-sizing: border-box;
    position: absolute;
    inset-block: 3px;
    inset-inline-start: var(--clip-start, 0%);
    width: var(--clip-size, 68%);
    min-width: 42px;
    max-width: 100%;
    padding: 4px 8px;
    border-radius: calc(var(--sn-node-radius, 8px) - 2px);
    background: color-mix(in srgb, var(--sn-media-studio-progress-color, var(--sn-sys-accent)) 38%, var(--sn-sys-on-surface) 5%, transparent);
    border: 1px solid color-mix(in srgb, var(--sn-media-studio-progress-color, var(--sn-sys-accent)) 54%, transparent);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: calc(12px * var(--sn-theme-type-scale, 1));
  }

  .sn-media-studio-track-row:nth-child(2) .sn-media-studio-track-clip {
    background: color-mix(in srgb, var(--sn-sys-success) 34%, var(--sn-sys-on-surface) 5%, transparent);
    border-color: color-mix(in srgb, var(--sn-sys-success) 50%, transparent);
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

  .sn-media-studio-progress-shell sn-description-list {
    grid-column: 1 / -1;
    --sn-description-list-columns: minmax(min(9ch, 34%), max-content) minmax(0, 1fr);
  }

  .sn-media-studio-progress-shell sn-metric {
    --sn-metric-value-color: var(--sn-media-studio-progress-color, var(--sn-sys-accent));
  }

  @container (max-width: 520px) {
    .sn-media-studio-overlay {
      align-items: flex-start;
      flex-direction: column;
    }
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
    sidePaneDefault: 'collapsed',
  },
  panelTypes: MEDIA_STUDIO_PANEL_TYPES,
  frameSourceTypes: MEDIA_STUDIO_FRAME_SOURCE_TYPES,
  capabilities: [
    'nle-editor-topology',
    'central-preview',
    'bottom-timeline',
    'collapsible-side-panes',
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
    collapsed: options.inspectorCollapsed ?? true,
  });
  let timeline = createMediaPanel(MEDIA_STUDIO_PANEL_TYPES.timeline, {
    ...options,
    id: ids.timeline,
    region: 'bottom',
    behavior: MEDIA_STUDIO_PANEL_BEHAVIORS.timeline,
    collapsed: options.timelineCollapsed ?? false,
  });

  let previewInspectorRatio = finiteNumber(options.previewInspectorRatio, 0.78, 0.35, 0.92);
  let sourcePreviewRatio = finiteNumber(options.sourcePreviewRatio, 0.18, 0.08, 0.45);
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

  return {
    panelTypes,
    previewPanelId: preview?.id || null,
    timelinePanelId: timeline?.id || null,
    sourcePanelId: source?.id || null,
    inspectorPanelId: inspector?.id || null,
    previewIsCentral,
    timelineIsBottom,
    sidePanesCollapsed,
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
      reason: status,
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
      reason: 'waiting-for-frames',
      frameSource,
      progress,
      fallback: {
        state: MEDIA_PREVIEW_STATES.waiting,
        reason: 'waiting-for-frames',
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
  let frames = frameCount(preview);
  let detail = cleanText(
    options.detail || `${provider} · ${frames ? `${frames} cached frames` : previewState.reason || previewState.state}`,
    provider
  );
  return `
    <div class="sn-media-studio-panel" data-media-studio-role="preview" data-preview-state="${escapeHtml(previewState.state)}" data-frame-source-provider="${escapeHtml(provider)}" data-frame-cache-key="${escapeHtml(cacheKey)}">
      <div class="sn-media-studio-preview-stage" aria-label="FrameSource preview">
        <div class="sn-media-studio-preview-window" data-render-proof="frame-source-cache">
          ${frameUrl ? `<img class="sn-media-studio-frame" src="${escapeHtml(frameUrl)}" alt="${escapeHtml(sourceTitle)} frame">` : `
            <div class="sn-media-studio-frame-placeholder" data-frame-source-state="${escapeHtml(previewState.state)}">
              <strong>${escapeHtml(previewState.state)}</strong>
              <span>${escapeHtml(previewState.reason || 'waiting-for-frames')}</span>
            </div>`}
          <div class="sn-media-studio-transport" aria-hidden="true">
            <span><i class="material-symbols-outlined">play_arrow</i> TC 00:00:00</span>
            <span>${escapeHtml(frames ? `${frames}f` : percentLabel(previewState.progress))}</span>
          </div>
          <div class="sn-media-studio-overlay">
            <strong>${escapeHtml(sourceTitle)}</strong>
            <span>${escapeHtml(detail)}</span>
          </div>
        </div>
      </div>
      <sn-description-list>
        ${options.surfaceRoute ? `<sn-description-item label="Surface">${escapeHtml(options.surfaceRoute)}</sn-description-item>` : ''}
        <sn-description-item label="Provider">${escapeHtml(provider)}</sn-description-item>
        <sn-description-item label="Status">${escapeHtml(previewState.state)}</sn-description-item>
        <sn-description-item label="Progress">${escapeHtml(percentLabel(previewState.progress))}</sn-description-item>
      </sn-description-list>
    </div>`;
}

export function renderMediaStudioTimelinePanelMarkup(options = {}) {
  let clips = (Array.isArray(options.clips) && options.clips.length ? options.clips : [
    { lane: 'video', label: 'FrameSource cache', startPercent: 0, sizePercent: 78 },
    { lane: 'voice', label: 'Narration provider', startPercent: 8, sizePercent: 64 },
    { lane: 'captions', label: 'Whisper sync', startPercent: 14, sizePercent: 58 },
    { lane: 'actions', label: 'Workspace actions', startPercent: 22, sizePercent: 46 },
  ]).map(timelineClip);
  let marks = Array.isArray(options.marks) && options.marks.length ? options.marks : ['F00', '00:01.8', '00:05.0'];
  return `
    <div class="sn-media-studio-timeline-panel" data-media-studio-role="timeline">
      <div class="sn-media-studio-ruler">${marks.map((mark) => `<span>${escapeHtml(mark)}</span>`).join('')}</div>
      <div class="sn-media-studio-track-stack">
        ${clips.map((clip) => `
          <div class="sn-media-studio-track-row">
            <span class="sn-media-studio-track-name">${escapeHtml(clip.lane)}</span>
            <span class="sn-media-studio-track-rail">
              <span class="sn-media-studio-track-clip" style="--clip-start:${clip.start}%; --clip-size:${clip.size}%">${escapeHtml(clip.label)}</span>
            </span>
          </div>`).join('')}
      </div>
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
