import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  hydrateMediaStudioTimelinePanel,
  listMediaFrameSourceProviders,
  normalizeMediaFrameSource,
  normalizeMediaPreviewState,
  normalizeMediaStudioTimelineData,
  renderMediaStudioInspectorPanelMarkup,
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

test('media studio layout uses central preview, bottom timeline, collapsed source, and expanded inspector', () => {
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
  assert.equal(topology.sidePanesCollapsed, false);
  assert.equal(topology.sourceCollapsed, true);
  assert.equal(topology.inspectorExpanded, true);
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
      /var\(--sn-sys-|color-mix\(in oklab, var\(--sn-sys-|px|var\(--sn-node-radius\)|var\(--sn-frame-gap\)/,
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
  assert.equal(typeof ui.renderMediaStudioInspectorPanelMarkup, 'function');
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
  let inspector = renderMediaStudioInspectorPanelMarkup({
    status: 'capturing',
    progress: 0.42,
    source: MEDIA_STUDIO_FRAME_SOURCE_TYPES.externalBrowser,
    state: { frameCount: 12, output: 'workspace-tour.mp4' },
  });

  assert.match(MEDIA_STUDIO_SURFACE_STYLES, /\.sn-media-studio-preview-stage/);
  assert.match(MEDIA_STUDIO_SURFACE_STYLES, /\.sn-media-studio-inspector-section/);
  assert.doesNotMatch(MEDIA_STUDIO_SURFACE_STYLES, /\.sn-media-studio-timeline-toolbar/);
  assert.doesNotMatch(MEDIA_STUDIO_SURFACE_STYLES, /\.sn-media-studio-track-row/);
  assert.match(preview, /data-render-proof="frame-source-cache"/);
  assert.match(preview, /data-frame-source-provider="external-browser"/);
  assert.match(preview, /data-preview-state="loading"/);
  assert.match(preview, /data-frame-progress="42%"/);
  assert.match(preview, /src="\.\/cache\/frame-0001\.png"/);
  assert.doesNotMatch(preview, /waiting-for-frames/);
  assert.doesNotMatch(preview, /clone|iframe|live-dom/i);
  assert.doesNotMatch(preview, /sn-media-studio-preview-footer/);
  assert.doesNotMatch(preview, /sn-media-studio-overlay/);
  assert.doesNotMatch(preview, /sn-media-studio-transport/);
  assert.match(timeline, /sn-timeline-editor/);
  assert.match(timeline, /data-media-studio-timeline-editor/);
  assert.match(MEDIA_STUDIO_SURFACE_STYLES, /\.sn-media-studio-timeline-editor/);
  assert.doesNotMatch(timeline, /sn-media-studio-track-row/);
  assert.doesNotMatch(timeline, /sn-media-studio-timeline-toolbar/);
  assert.match(inspector, /sn-media-studio-inspector-panel/);
  assert.match(inspector, /workspace-tour\.mp4/);
  assert.match(progress, /data-progress-channel="RT_WORKSPACE_EXECUTION_NODE_PROGRESS"/);
  assert.match(progress, /maximo-current-ui/);
});

test('media studio timeline visual geometry is driven by the timeline editor theme contract', async () => {
  let [editorSource, editorStyles, editorTemplate] = await Promise.all([
    readFile(new URL('../timeline/TimelineEditor/TimelineEditor.js', import.meta.url), 'utf8'),
    readFile(new URL('../timeline/TimelineEditor/TimelineEditor.css.js', import.meta.url), 'utf8'),
    readFile(new URL('../timeline/TimelineEditor/TimelineEditor.tpl.js', import.meta.url), 'utf8'),
  ]);

  assert.match(MEDIA_STUDIO_SURFACE_STYLES, /--te-track-height: var\(--sn-media-studio-control-height, 28px\)/);
  assert.match(MEDIA_STUDIO_SURFACE_STYLES, /--te-ruler-height: var\(--sn-media-studio-control-height, 28px\)/);
  assert.match(MEDIA_STUDIO_SURFACE_STYLES, /--te-transport-height: var\(--sn-media-studio-control-height, 28px\)/);
  assert.match(editorSource, /cssPixelValue\(computed, '--te-track-height', 36\)/);
  assert.match(editorSource, /cssPixelValue\(computed, '--te-ruler-height', 28\)/);
  assert.doesNotMatch(editorSource, /Math\.floor\(y \/ 36\)/);
  assert.doesNotMatch(editorSource, /let trackH = 36/);
  assert.doesNotMatch(editorSource, /TRACK_ICONS/);
  assert.doesNotMatch(editorSource, /LAYER_COLORS/);
  assert.doesNotMatch(editorSource, /theme\.timeline/);
  assert.match(editorSource, /toggleAttribute\('playing', true\)/);
  assert.match(editorSource, /#focusPlayhead\(\)/);
  assert.match(editorSource, /#syncHeaderScroll\(\)/);
  assert.match(editorSource, /#manualScrollUntil/);
  assert.match(editorSource, /#readTheme\(\)/);
  assert.match(editorSource, /normalizeClip/);
  assert.match(editorStyles, /--te-transport-height: 28px/);
  assert.match(editorStyles, /\.te-transport \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
  assert.match(editorStyles, /\.te-transport-playback \{[\s\S]*?justify-content: center/);
  assert.match(editorStyles, /\.te-body \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: var\(--te-header-width\) minmax\(0, 1fr\)/);
  assert.match(editorStyles, /\.te-headers-list/);
  assert.match(editorStyles, /\.te-headers-scroll \{[\s\S]*?overflow: hidden/);
  assert.match(editorStyles, /\.te-timeline-viewport \{[\s\S]*?overflow: auto/);
  assert.match(editorStyles, /\.te-ruler-canvas \{[\s\S]*?position: sticky/);
  assert.match(editorStyles, /\.te-tracks-canvas \{[\s\S]*?position: absolute/);
  assert.match(editorStyles, /color: transparent/);
  assert.doesNotMatch(editorStyles, /themedScrollFadeInlineStyles/);
  assert.doesNotMatch(editorStyles, /\.te-canvas-area/);
  assert.match(editorStyles, /\.te-playhead::before/);
  assert.match(editorTemplate, /material-symbols-outlined/);
  assert.match(editorTemplate, /te-transport-playback/);
  assert.match(editorTemplate, /te-timeline-viewport/);
  assert.match(editorTemplate, /te-timeline-content/);
  assert.match(editorTemplate, /te-ruler-canvas/);
  assert.match(editorTemplate, /te-tracks-canvas/);
  assert.equal([...editorTemplate.matchAll(/class="te-playhead"/g)].length, 1);
  assert.doesNotMatch(editorTemplate, /te-playhead-ruler/);
  assert.doesNotMatch(editorTemplate, /te-playhead-tracks/);
  assert.doesNotMatch(editorTemplate, /[\u23ee\u25b6\u23f9\u23ed\u229e]/);
  assert.match(editorSource, /material-symbols-outlined[\s\S]*?volume_off/);
  assert.doesNotMatch(editorSource, />M<\/button>/);
  assert.match(MEDIA_STUDIO_SURFACE_STYLES, /layout-node:has\(\.sn-media-studio-panel\) \.panel-content/);
  assert.match(MEDIA_STUDIO_SURFACE_STYLES, /\.sn-media-studio-timeline-panel \{[\s\S]*?border: 0/);
  assert.match(MEDIA_STUDIO_SURFACE_STYLES, /\.sn-media-studio-preview-stage \{[\s\S]*?border: 0/);
  assert.match(MEDIA_STUDIO_SURFACE_STYLES, /\.sn-media-studio-frame \{[\s\S]*?position: absolute/);
  assert.match(MEDIA_STUDIO_SURFACE_STYLES, /\.sn-media-studio-frame \{[\s\S]*?object-fit: contain/);
  assert.doesNotMatch(MEDIA_STUDIO_SURFACE_STYLES, /sn-media-studio-frame \{[\s\S]*?box-shadow: 0 0 0 1px/);
});

test('media studio timeline uses the library timeline editor data contract', () => {
  let empty = normalizeMediaStudioTimelineData({ durationFrames: 300 });
  assert.equal(empty.duration, 300);
  assert.equal(empty.tracks.length, 0);

  let data = normalizeMediaStudioTimelineData({
    durationFrames: 300,
    clips: [
      { lane: 'video', label: 'Current UI frames', startPercent: 0, sizePercent: 50 },
      { lane: 'voice', label: 'Narration', startPercent: 10, sizePercent: 40 },
    ],
  });
  assert.equal(data.duration, 300);
  assert.equal(data.tracks.length, 2);
  assert.equal(data.tracks[0].type, 'video');
  assert.equal(data.tracks[1].type, 'audio');

  let multiLane = normalizeMediaStudioTimelineData({
    durationFrames: 300,
    clips: [
      { lane: 'video', label: 'FrameSource cache', startPercent: 0, sizePercent: 90 },
      { lane: 'voice:guide', label: 'Guide voice', startPercent: 10, sizePercent: 50 },
      { lane: 'voice:ops', label: 'Ops voice', startPercent: 20, sizePercent: 50 },
      { lane: 'captions', label: 'Whisper captions', startPercent: 30, sizePercent: 50 },
      { lane: 'actions', label: 'Workspace actions', startPercent: 40, sizePercent: 50 },
    ],
  });
  assert.equal(multiLane.tracks.length, 5);
  assert.deepEqual(multiLane.tracks.map((track) => track.type), ['video', 'audio', 'audio', 'text', 'effect']);

  let loaded = null;
  let frame = null;
  let editor = {
    loadTimeline(value) { loaded = value; },
    setFrame(value) { frame = value; },
  };
  let root = {
    matches(selector) { return selector === '[data-media-studio-timeline-editor]'; },
    querySelector() { return null; },
    loadTimeline: editor.loadTimeline,
    setFrame: editor.setFrame,
  };
  let hydrated = hydrateMediaStudioTimelinePanel(root, {
    durationFrames: 300,
    currentFrame: 42,
    clips: [{ lane: 'video', label: 'Current UI frames', startPercent: 0, sizePercent: 50 }],
  });
  assert.equal(loaded.duration, 300);
  assert.equal(hydrated.tracks.length, 1);
  assert.equal(frame, 42);
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
