import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MEDIA_FRAME_SOURCE_PROVIDER_METADATA,
  MEDIA_PREVIEW_STATES,
  MEDIA_STUDIO_FRAME_SOURCE_TYPES,
  MEDIA_STUDIO_PANEL_TYPES,
  MEDIA_STUDIO_SURFACE_STYLES,
  MEDIA_STUDIO_SURFACE_CONTRACT,
  createMediaStudioLayout,
  createMediaStudioPanelTypes,
  ensureMediaStudioSurfaceStyles,
  getMediaFrameSourceSupport,
  getMediaStudioTopology,
  hasMediaStudioTopology,
  listMediaFrameSourceProviders,
  normalizeMediaFrameSource,
  normalizeMediaPreviewState,
  renderMediaStudioPreviewPanelMarkup,
  renderMediaStudioProgressPanelMarkup,
  renderMediaStudioTimelinePanelMarkup,
} from '../ui/media-studio-surface.js';
import { createCascadeTheme } from '../themes/cascade-theme.js';

function createCaptureTarget() {
  class CanvasRenderingContext2D {}
  CanvasRenderingContext2D.prototype.drawElementImage = () => {};

  class HTMLCanvasElement {}
  class MediaStreamTrack {}
  MediaStreamTrack.prototype.cropTo = () => {};
  MediaStreamTrack.prototype.restrictTo = () => {};

  return {
    CanvasRenderingContext2D,
    HTMLCanvasElement,
    MediaStreamTrack,
    CropTarget: { fromElement() {} },
    RestrictionTarget: { fromElement() {} },
    navigator: {
      mediaDevices: {
        getDisplayMedia() {},
      },
    },
    document: {
      createElement(tagName) {
        return tagName === 'canvas' ? { layoutSubtree: null } : {};
      },
    },
  };
}

test('media studio layout uses central preview, bottom timeline, and collapsed side panes', () => {
  let layout = createMediaStudioLayout({
    ids: {
      source: 'source',
      preview: 'preview',
      inspector: 'inspector',
      timeline: 'timeline',
    },
  });
  let topology = getMediaStudioTopology(layout);

  assert.equal(layout.direction, 'vertical');
  assert.equal(topology.previewPanelId, 'preview');
  assert.equal(topology.timelinePanelId, 'timeline');
  assert.equal(topology.sourcePanelId, 'source');
  assert.equal(topology.inspectorPanelId, 'inspector');
  assert.equal(topology.previewIsCentral, true);
  assert.equal(topology.timelineIsBottom, true);
  assert.equal(topology.sidePanesCollapsed, true);
  assert.equal(topology.sidePanesCollapsible, true);
  assert.equal(topology.behaviorMetadata, true);
  assert.equal(hasMediaStudioTopology(layout), true);
  assert.deepEqual(topology.panelTypes, [
    MEDIA_STUDIO_PANEL_TYPES.source,
    MEDIA_STUDIO_PANEL_TYPES.preview,
    MEDIA_STUDIO_PANEL_TYPES.inspector,
    MEDIA_STUDIO_PANEL_TYPES.timeline,
  ]);
});

test('media studio panel config and surface contract stay product neutral', () => {
  let panelTypes = createMediaStudioPanelTypes();
  let serialized = JSON.stringify({
    contract: MEDIA_STUDIO_SURFACE_CONTRACT,
    providers: MEDIA_FRAME_SOURCE_PROVIDER_METADATA,
    panelTypes,
  });

  assert.equal(panelTypes[MEDIA_STUDIO_PANEL_TYPES.preview].region, 'center');
  assert.equal(panelTypes[MEDIA_STUDIO_PANEL_TYPES.timeline].region, 'bottom');
  assert.equal(panelTypes[MEDIA_STUDIO_PANEL_TYPES.source].collapsible, true);
  assert.equal(panelTypes[MEDIA_STUDIO_PANEL_TYPES.inspector].collapsible, true);
  assert.ok(MEDIA_STUDIO_SURFACE_CONTRACT.capabilities.includes('replaceable-frame-sources'));
  assert.ok(MEDIA_STUDIO_SURFACE_CONTRACT.themeAliases.includes('--sn-media-studio-preview-bg'));
  assert.doesNotMatch(serialized, /maximo/i);
});

test('media studio theme aliases are cascade-authored and consumed by styles', () => {
  let theme = createCascadeTheme({ recipe: 'media-studio', mode: 'dark' });

  for (let alias of MEDIA_STUDIO_SURFACE_CONTRACT.themeAliases) {
    let value = theme.tokens[alias];
    assert.equal(typeof value, 'string', `${alias} must be authored by cascade-theme`);
    assert.ok(value.length > 0, `${alias} must resolve to a non-empty token value`);
    assert.match(
      value,
      /var\(--sn-sys-|color-mix\(in oklab, var\(--sn-sys-|px|var\(--sn-node-radius\)/,
      `${alias} must derive from system cascade tokens or bounded geometry tokens`,
    );
    assert.match(MEDIA_STUDIO_SURFACE_STYLES, new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.equal(theme.tokens['--sn-media-studio-progress-color'], 'var(--sn-sys-accent)');
  assert.match(theme.tokens['--sn-media-studio-preview-bg'], /var\(--sn-sys-surface\)/);
  assert.match(theme.tokens['--sn-media-studio-pane-bg'], /var\(--sn-sys-surface-panel\)/);
});

test('frame source provider metadata reports browser capability fallbacks', () => {
  let unsupported = listMediaFrameSourceProviders({ globalThis: {} });
  let unsupportedRegion = unsupported.find((provider) => provider.id === MEDIA_STUDIO_FRAME_SOURCE_TYPES.regionCapture);
  let unsupportedHtmlCanvas = unsupported.find((provider) => provider.id === MEDIA_STUDIO_FRAME_SOURCE_TYPES.htmlInCanvas);
  assert.equal(unsupportedRegion.supported, false);
  assert.equal(unsupportedRegion.fallback.reason, 'region-capture-unavailable');
  assert.equal(unsupportedHtmlCanvas.supported, false);
  assert.equal(unsupportedHtmlCanvas.fallback.reason, 'html-in-canvas-unavailable');

  let supported = listMediaFrameSourceProviders({
    globalThis: createCaptureTarget(),
    externalBrowserFrameSource: true,
    cachedSequence: true,
  });
  let byId = new Map(supported.map((provider) => [provider.id, provider]));
  assert.equal(byId.get(MEDIA_STUDIO_FRAME_SOURCE_TYPES.externalBrowser).supported, true);
  assert.equal(byId.get(MEDIA_STUDIO_FRAME_SOURCE_TYPES.elementCapture).supported, true);
  assert.equal(byId.get(MEDIA_STUDIO_FRAME_SOURCE_TYPES.regionCapture).supported, true);
  assert.equal(byId.get(MEDIA_STUDIO_FRAME_SOURCE_TYPES.htmlInCanvas).supported, true);
  assert.equal(byId.get(MEDIA_STUDIO_FRAME_SOURCE_TYPES.cachedSequence).supported, true);

  let support = getMediaFrameSourceSupport({
    globalThis: createCaptureTarget(),
    cachedSequence: true,
  });
  assert.equal(support.displayMedia, true);
  assert.equal(support.elementCapture, true);
  assert.equal(support.regionCapture, true);
  assert.equal(support.htmlInCanvas, true);
  assert.equal(support.cachedSequence, true);
});

test('preview state normalization covers empty, loading, unsupported, and cached frames', () => {
  assert.deepEqual(normalizeMediaPreviewState({}).fallback, {
    state: MEDIA_PREVIEW_STATES.empty,
    reason: 'missing-source',
  });

  let unsupportedSource = normalizeMediaFrameSource({
    provider: MEDIA_STUDIO_FRAME_SOURCE_TYPES.elementCapture,
    target: '#preview',
  }, { globalThis: {} });
  assert.equal(unsupportedSource.status, 'unavailable');
  assert.equal(unsupportedSource.fallback.reason, 'element-capture-unavailable');

  let unsupportedPreview = normalizeMediaPreviewState({
    frameSource: {
      provider: MEDIA_STUDIO_FRAME_SOURCE_TYPES.elementCapture,
      target: '#preview',
    },
  }, { globalThis: {} });
  assert.equal(unsupportedPreview.state, MEDIA_PREVIEW_STATES.unsupported);
  assert.equal(unsupportedPreview.reason, 'element-capture-unavailable');

  let loading = normalizeMediaPreviewState({
    status: 'rendering',
    progress: 32,
    frameSource: {
      provider: MEDIA_STUDIO_FRAME_SOURCE_TYPES.externalBrowser,
      source: '/workspace/surface',
    },
  }, {
    externalBrowserFrameSource: true,
  });
  assert.equal(loading.state, MEDIA_PREVIEW_STATES.loading);
  assert.equal(loading.progress, 0.32);

  let cached = normalizeMediaPreviewState({
    frames: [{ url: 'frame-0001.webp' }],
    frameSource: {
      provider: MEDIA_STUDIO_FRAME_SOURCE_TYPES.cachedSequence,
      cacheKey: 'sequence-a',
    },
  }, {
    cachedSequence: true,
  });
  assert.equal(cached.state, MEDIA_PREVIEW_STATES.ready);
  assert.equal(cached.mode, MEDIA_STUDIO_FRAME_SOURCE_TYPES.cachedSequence);
  assert.equal(cached.progress, 1);
});

test('media studio helpers are exported from the browser UI entrypoint', async () => {
  let ui = await import('../ui/index.js');

  assert.equal(typeof ui.createMediaStudioLayout, 'function');
  assert.equal(typeof ui.createMediaStudioPanelTypes, 'function');
  assert.equal(typeof ui.ensureMediaStudioSurfaceStyles, 'function');
  assert.equal(typeof ui.listMediaFrameSourceProviders, 'function');
  assert.equal(typeof ui.normalizeMediaPreviewState, 'function');
  assert.equal(typeof ui.renderMediaStudioPreviewPanelMarkup, 'function');
  assert.equal(ui.MEDIA_STUDIO_FRAME_SOURCE_TYPES.htmlInCanvas, MEDIA_STUDIO_FRAME_SOURCE_TYPES.htmlInCanvas);
});

test('media studio visual layer renders reusable preview, timeline, and progress markup', () => {
  let preview = renderMediaStudioPreviewPanelMarkup({
    sourceTitle: 'Current UI',
    surfaceRoute: '/workspace/media-studio',
    support: { externalBrowserFrameSource: true },
    frameSource: {
      provider: MEDIA_STUDIO_FRAME_SOURCE_TYPES.externalBrowser,
      cacheKey: 'maximo-current-ui',
      progress: 42,
    },
    preview: {
      status: 'rendering',
      frames: [{ url: './cache/frame-0001.png' }],
    },
  });
  let timeline = renderMediaStudioTimelinePanelMarkup({
    clips: [{ lane: 'video', label: 'Current UI frames', startPercent: 0, sizePercent: 80 }],
  });
  let progress = renderMediaStudioProgressPanelMarkup({
    status: 'capturing',
    progress: 0.42,
    progressChannel: 'RT_WORKSPACE_EXECUTION_NODE_PROGRESS',
    state: { frameCount: 12, cacheKey: 'maximo-current-ui' },
  });

  assert.match(MEDIA_STUDIO_SURFACE_STYLES, /\.sn-media-studio-preview-stage/);
  assert.match(preview, /data-render-proof="frame-source-cache"/);
  assert.match(preview, /data-frame-source-provider="external-browser"/);
  assert.match(preview, /src="\.\/cache\/frame-0001\.png"/);
  assert.doesNotMatch(preview, /clone|iframe|live-dom/i);
  assert.match(timeline, /sn-media-studio-track-row/);
  assert.match(timeline, /Current UI frames/);
  assert.match(progress, /data-progress-channel="RT_WORKSPACE_EXECUTION_NODE_PROGRESS"/);
  assert.match(progress, /maximo-current-ui/);
});

test('media studio styles install once into a browser document', () => {
  let appended = [];
  let existing = null;
  let doc = {
    head: {
      querySelector(selector) {
        assert.equal(selector, 'style[data-symbiote-ui="media-studio-surface"]');
        return existing;
      },
      appendChild(node) {
        appended.push(node);
        existing = node;
        return node;
      },
    },
    createElement(tagName) {
      return {
        tagName,
        attrs: {},
        setAttribute(name, value) {
          this.attrs[name] = value;
        },
        textContent: '',
      };
    },
  };

  let first = ensureMediaStudioSurfaceStyles(doc);
  let second = ensureMediaStudioSurfaceStyles(doc);

  assert.equal(first, second);
  assert.equal(appended.length, 1);
  assert.equal(first.attrs['data-symbiote-ui'], 'media-studio-surface');
  assert.match(first.textContent, /sn-media-studio-progress-shell/);
});
