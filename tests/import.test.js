import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('root and metadata entrypoints import in Node', async () => {
  let root = await import('../index.js');
  let layout = await import('../layout/index.js');
  let runtime = await import('../runtime/index.js');
  let manifest = await import('../manifest/index.js');
  let webmcp = await import('../webmcp.js');
  let xr = await import('../xr/index.js');

  assert.equal(typeof root.NodeEditor, 'function');
  assert.equal(typeof root.createCascadeTheme, 'function');
  assert.equal(typeof root.getReadableTextForHsl, 'function');
  assert.equal(typeof root.createRuntimeUiInstance, 'function');
  assert.equal(typeof root.buildChatNavTree, 'function');
  assert.equal(typeof root.normalizeResourceTreeItem, 'function');
  assert.equal(typeof root.normalizeSourceDocument, 'function');
  assert.equal(typeof root.normalizeCanvasGraphGroups, 'function');
  assert.equal(typeof root.normalizeForceGroups, 'function');
  assert.equal(typeof root.createGraphViewModeController, 'function');
  assert.equal(typeof root.configureAutoLocalization, 'function');
  assert.equal(typeof root.getNavigatorLocalePreferences, 'function');
  assert.equal(typeof root.matchVoiceCommandAtEnd, 'function');
  assert.equal(root.defaultSendCommandPhrases().ru, 'отправить');
  assert.equal(typeof runtime.createRuntimeUiController, 'function');
  assert.equal(runtime.RUNTIME_UI_CONTRACT.version, 'runtime-ui-v1');
  assert.equal(typeof manifest.listComponents, 'function');
  assert.equal(typeof manifest.listAgentComponentDescriptions, 'function');
  assert.equal(typeof manifest.listThemeRuntimeDescriptors, 'function');
  assert.equal(typeof webmcp.createToolDescriptor, 'function');
  assert.equal(typeof webmcp.createComponentToolDescriptor, 'function');
  assert.equal(typeof layout.resolveLayoutMinSize, 'function');
  assert.equal(typeof layout.resolveResponsiveLayoutState, 'function');

  assert.equal(typeof xr.createOctree, 'function');
  assert.equal(typeof xr.createSpatialGraphModel, 'function');
  assert.equal(typeof xr.createSphericalGraphLayout, 'function');
  assert.equal(typeof xr.createSpatialDragController, 'function');
  assert.equal(typeof xr.createSimulation, 'function');
  assert.equal(typeof xr.createForceLayoutAdapter, 'function');
  assert.equal(typeof xr.createDualViewController, 'function');
});

test('locale auto mode resolves browser preferences from the library contract', async () => {
  let {
    applyLocalizationToDocument,
    configureAutoLocalization,
    configureLocalization,
    getLocalization,
    getNavigatorLocalePreferences,
    resetLocalization,
    translate,
  } = await import('../locale/index.js');

  resetLocalization();
  configureLocalization({ mode: 'auto', preferences: ['ru-RU', 'en-US'] });
  assert.equal(getLocalization().locale, 'ru');
  assert.equal(translate('dialog.cancel'), 'Отмена');

  resetLocalization();
  let localization = configureAutoLocalization({
    navigator: { languages: ['es-AR', 'en-US'] },
    document: false,
  });
  assert.equal(localization.locale, 'es');
  assert.equal(translate('dialog.confirm'), 'Confirmar');
  assert.deepEqual(getNavigatorLocalePreferences({ language: 'ru-RU' }), ['ru-RU']);

  let doc = { documentElement: { dataset: {} } };
  applyLocalizationToDocument(localization, { document: doc });
  assert.equal(doc.documentElement.lang, 'es');
  assert.equal(doc.documentElement.dataset.localeMode, 'auto');
  resetLocalization();
});

test('chat nav tree helper builds product-neutral nested sidebar descriptors', async () => {
  let { buildChatNavTree } = await import('../chat/ChatWorkspace/chat-nav-tree.js');
  let tree = buildChatNavTree({
    chats: [
      { id: 'root', projectId: 'project-graph', name: '💬 What is Project Graph?' },
      { id: 'child', projectId: 'project-graph', parentChatId: 'root', name: 'Architecture audit', lastTaskStatus: 'done' },
      { id: 'mcp', projectId: 'project-graph', name: 'WebMCP contract', origin: 'mcp' },
    ],
    projectId: 'project-graph',
    activeChatId: 'child',
  });

  assert.equal(tree.length, 2);
  assert.equal(tree[0].id, 'root');
  assert.equal(tree[0].cleanName, 'What is Project Graph?');
  assert.equal(tree[0].isExpanded, true);
  assert.equal(tree[0].subChats[0].id, 'child');
  assert.equal(tree[0].subChats[0].isActive, true);
  assert.equal(tree[0].subChats[0].statusKind, 'done');
  assert.equal(tree[0].subChats[0].statusIcon, 'check_circle');
  assert.equal(tree[0].subChats[0].metaLabel, 'Agent');
  assert.equal(tree[1].metaLabel, 'MCP');
});

test('chat message model normalizes assistant role and attaches work summaries', async () => {
  let { buildChatMessageItems, normalizeChatMessageRole } = await import('../chat/message-model.js');
  let { items } = buildChatMessageItems([
    { role: 'assistant', text: 'Rendered as an agent answer.' },
    {
      role: 'thinking',
      done: true,
      elapsed: 5,
      meta: { mode: 'auto_edit', exitCode: 0, tools: 1, tokens: 240, cost: 0.001 },
    },
  ]);

  assert.equal(normalizeChatMessageRole('assistant'), 'agent');
  assert.equal(items.length, 1);
  assert.equal(items[0].role, 'agent');
  assert.match(items[0].workSummaryHtml, /work-summary-wrap/);
  assert.match(items[0].workSummaryHtml, /content_copy/);
});

test('voice command helpers are importable without browser component registration', async () => {
  let helpers = await import('../chat/voice-input-defaults.js');
  let runtime = await import('../chat/voice-runtime.js');
  let ui = await import('../ui/index.js');

  assert.equal(helpers.DEFAULT_VOICE_WAKE_COMMANDS.en, 'Okay Agent');
  assert.equal(helpers.matchVoiceCommandAtEnd('draft send', [{ action: 'send', phrase: 'send' }]).text, 'draft');
  assert.equal(helpers.matchVoiceCommandInText("О'кей Агент", helpers.wakeCommandCandidates(
    helpers.defaultWakeCommandPhrases(),
    'ru'
  )).matched, true);
  assert.equal(typeof runtime.VoiceRuntime, 'function');
  assert.equal(typeof runtime.blobToBase64, 'function');
  assert.equal(typeof ui.VoiceRuntime, 'function');
  assert.equal(typeof ui.blobToBase64, 'function');
  assert.equal(typeof ui.buildResourceTreeFromEntries, 'function');
  assert.equal(typeof ui.createSourceDocument, 'function');
  assert.equal(typeof ui.createGraphViewModeController, 'function');
  assert.equal(typeof ui.groupNodes, 'function');
  assert.equal(typeof ui.ungroupNodes, 'function');
  assert.equal(ui.DEFAULT_VOICE_WAKE_COMMANDS.en, 'Okay Agent');
  assert.equal(ui.matchVoiceCommandAtEnd('draft send', [{ action: 'send', phrase: 'send' }]).text, 'draft');
  assert.equal(ui.matchVoiceCommandInText("О'кей Агент", ui.wakeCommandCandidates(
    ui.defaultWakeCommandPhrases(),
    'ru'
  )).matched, true);
});

test('canvas public entrypoint exposes graph and routing helpers', async () => {
  let canvas = await import('../canvas/index.js');
  assert.equal(typeof canvas.computeAutoLayout, 'function');
  assert.equal(typeof canvas.SubgraphRouter, 'function');
  assert.equal(typeof canvas.PinExpansion, 'function');
  assert.equal(typeof canvas.routePcbTrace, 'function');
  assert.equal(typeof canvas.analyzePcbRoute, 'function');
  assert.equal(typeof canvas.groupNodes, 'function');
  assert.equal(typeof canvas.ungroupNodes, 'function');
  assert.equal(typeof canvas.createGraphExplorerViewController, 'function');
  assert.equal(typeof canvas.createGraphViewModeController, 'function');
  assert.equal(typeof canvas.applyGraphExplorerViewMode, 'function');
  assert.deepEqual(canvas.GRAPH_VIEW_MODES, ['structured', 'flat']);
  assert.equal(canvas.normalizeGraphExplorerViewMode('flat'), 'flat');
  assert.equal(canvas.normalizeGraphViewMode('flat'), 'flat');
  assert.equal(canvas.normalizeGraphExplorerViewMode('unknown'), 'structured');
});

test('graph explorer view controller coordinates structured and flat renderers', async () => {
  let {
    applyGraphExplorerViewMode,
    createGraphExplorerViewController,
    createGraphViewModeController,
  } = await import('../canvas/graph-explorer.js');
  let calls = [];
  let makeElement = (name) => ({
    hidden: false,
    attrs: {},
    setAttribute(key, value) {
      this.attrs[key] = value;
      calls.push(`${name}:attr:${key}:${value}`);
    },
  });
  let shell = {
    ...makeElement('shell'),
    setMode(mode) {
      this.mode = mode;
      calls.push(`shell:mode:${mode}`);
    },
    setPathStyle(style) {
      this.pathStyle = style;
      calls.push(`shell:path:${style}`);
    },
  };
  let structuredCanvas = {
    ...makeElement('structured'),
    setEditor(editor) {
      this.editor = editor;
      calls.push(`structured:editor:${editor.id}`);
    },
    setEditorModel(model) {
      this.model = model;
      calls.push(`structured:model:${model.nodes.length}`);
    },
    setPathStyle(style) {
      this.pathStyle = style;
      calls.push(`structured:path:${style}`);
    },
    refreshConnections() {
      calls.push('structured:refresh');
    },
    fitView(...args) {
      calls.push(`structured:fit:${args.join(',')}`);
    },
    focusNodes(nodeIds, options) {
      calls.push(`structured:focus:${nodeIds.join(',')}:${options.select}`);
    },
  };
  let flatGraph = {
    ...makeElement('flat'),
    setGraphModel(model) {
      this.model = model;
      calls.push(`flat:model:${model.nodes.length}`);
    },
    setPath(path) {
      this.path = path;
      calls.push(`flat:path:${path || ''}`);
    },
    resizeCanvas() {
      calls.push('flat:resize');
    },
    fitView(...args) {
      calls.push(`flat:fit:${args.join(',')}`);
    },
    focusNodes(nodeIds, options) {
      calls.push(`flat:focus:${nodeIds.join(',')}:${options.select || ''}:${options.fit}`);
      return true;
    },
    flyToNode(nodeId, options) {
      calls.push(`flat:fly:${nodeId}:${options.zoom}`);
    },
    pulseNode(nodeId, duration) {
      calls.push(`flat:pulse:${nodeId}:${duration}`);
    },
  };

  let result = applyGraphExplorerViewMode({
    mode: 'flat',
    shell,
    structuredCanvas,
    flatGraph,
    refresh: false,
  });
  assert.equal(result.mode, 'flat');
  assert.equal(structuredCanvas.hidden, true);
  assert.equal(flatGraph.hidden, false);
  assert.equal(shell.attrs['data-mode'], 'flat');

  let controller = createGraphExplorerViewController({
    shell,
    structuredCanvas,
    flatGraph,
    mode: 'flat',
    pathStyle: 'orthogonal',
    structuredEditor: { id: 'editor' },
    flatModel: { nodes: [{ id: 'a' }], edges: [] },
    flatPath: 'group/a',
  });

  assert.equal(controller.mode, 'flat');
  assert.equal(createGraphViewModeController, createGraphExplorerViewController);
  assert.equal(structuredCanvas.editor.id, 'editor');
  assert.equal(flatGraph.model.nodes.length, 1);
  assert.equal(controller.getState().pathStyle, 'orthogonal');
  let eventNames = [];
  let unsubscribe = controller.subscribe((state, event) => {
    eventNames.push(`${event}:${state.mode}`);
  });
  controller.setModels({
    structuredModel: { nodes: [], connections: [], positions: {} },
    flat: { nodes: [{ id: 'b' }, { id: 'c' }], edges: [] },
    path: 'group/b',
  });
  controller.fitView({ flatArgs: [42] });
  controller.focusNode({ nodeId: 'a' });
  controller.focusNode({
    nodeId: 'a',
    flatNodeIds: ['a', 'b'],
    flatOptions: { select: 'a', padding: 64 },
  });
  controller.setMode('structured', { refresh: false });
  controller.fitView({ structuredArgs: [56, false] });
  controller.focusNode({
    nodeId: 'a',
    structuredNodeIds: ['a', 'b'],
    structuredOptions: { select: 'a' },
  });

  assert.equal(structuredCanvas.hidden, false);
  assert.equal(flatGraph.hidden, true);
  assert.ok(calls.includes('flat:model:1'));
  assert.ok(calls.includes('flat:model:2'));
  assert.ok(calls.includes('structured:model:0'));
  assert.ok(calls.includes('flat:path:group/a'));
  assert.ok(calls.includes('flat:path:group/b'));
  assert.ok(calls.includes('flat:fit:42'));
  assert.ok(calls.includes('flat:fly:a:1.1'));
  assert.ok(calls.includes('flat:focus:a,b:a:true'));
  assert.ok(calls.includes('structured:fit:56,false'));
  assert.ok(calls.includes('structured:focus:a,b:a'));
  assert.ok(eventNames.includes('flat-model:flat'));
  assert.ok(eventNames.includes('flat-path:flat'));
  assert.ok(eventNames.includes('mode:structured'));
  unsubscribe();
  controller.setMode('flat', { refresh: false });
  assert.equal(eventNames.filter((item) => item === 'mode:flat').length, 0);
  controller.destroy();
  assert.equal(controller.getState().shell, null);
});

test('graph explorer keeps multi-node flat focus until layout settles', async () => {
  let { createGraphExplorerViewController } = await import('../canvas/graph-explorer.js');
  let listeners = new Map();
  let calls = [];
  let flatGraph = {
    hidden: false,
    setGraphModel() {},
    setPath() {},
    resizeCanvas() {},
    focusNodes(nodeIds, options) {
      calls.push(`focus:${nodeIds.join(',')}:${options.pulse === false ? 'quiet' : 'pulse'}`);
      return true;
    },
    pulseNode(nodeId) {
      calls.push(`pulse:${nodeId}`);
    },
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      listeners.get(type)?.delete(callback);
    },
  };
  let emit = (type) => {
    for (const callback of [...(listeners.get(type) || [])]) callback({ type });
  };
  let controller = createGraphExplorerViewController({
    flatGraph,
    mode: 'flat',
  });

  controller.focusNode({
    nodeId: 'a',
    flatNodeIds: ['a', 'b'],
    flatOptions: { select: 'a' },
  });
  emit('layout-tick');
  emit('layout-done');
  emit('layout-tick');

  assert.deepEqual(calls, [
    'focus:a,b:pulse',
    'pulse:a',
    'focus:a,b:quiet',
    'focus:a,b:quiet',
  ]);
  assert.equal(listeners.get('layout-tick')?.size || 0, 0);
  assert.equal(listeners.get('layout-done')?.size || 0, 0);
});

test('canvas graph pulse queue defaults to a single visual wave', async () => {
  let { findActiveTransitionMarker, getNextPulseQueue } = await import('../canvas/CanvasGraph/CanvasGraphDrawState.js');
  let [pulse] = getNextPulseQueue({
    nodeId: 'a',
    startTime: 10,
    duration: 900,
  });
  let queue = getNextPulseQueue({
    pulses: [pulse],
    nodeId: 'b',
    startTime: 20,
    duration: 1200,
    waves: 2,
  });
  let customPulse = queue.find((item) => item.id === 'b');

  assert.equal(pulse.waves, 1);
  assert.equal(customPulse.waves, 2);

  let marker = { toId: 'b', startTime: 100, duration: 400 };
  assert.equal(findActiveTransitionMarker([marker], 'b', 250), marker);
  assert.equal(findActiveTransitionMarker([marker], 'b', 500), null);
  assert.equal(findActiveTransitionMarker([marker], 'a', 250), null);
});

test('canvas graph starts node pulse when the transition marker arrives', async () => {
  let source = await readFile(new URL('../canvas/CanvasGraph/CanvasGraph.js', import.meta.url), 'utf8');

  assert.match(source, /findActiveTransitionMarker\(this\._transitionMarkers, nodeId, now\)/);
  assert.match(source, /marker\.pendingPulse = \{/);
  assert.match(source, /this\._pulses = \(this\._pulses \|\| \[\]\)\.filter\(\(pulse\) => pulse\.id !== nodeId\)/);
  assert.match(source, /this\._completeTransitionMarker\(marker, now\);/);
  assert.match(source, /this\._queuePulseNow\(marker\.toId, pulse\.duration, \{ waves: pulse\.waves \}, now\)/);
});

test('canvas graph focus transition uses queued activation before depth recalculation', async () => {
  let { resolveDeactivationFrame } = await import('../canvas/CanvasGraph/CanvasGraphDrawState.js');
  let source = await readFile(new URL('../canvas/CanvasGraph/CanvasGraph.js', import.meta.url), 'utf8');
  let activeNode = { id: 'current' };
  let nextActiveNode = { id: 'next' };
  let frame = resolveDeactivationFrame({
    deactivating: true,
    activeNode,
    nextActiveNode,
    layerAnim: {
      0: { scale: 1 },
      4: { scale: 1 },
    },
  });

  assert.equal(frame.activeNode, nextActiveNode);
  assert.equal(frame.nextActiveNode, null);
  assert.equal(frame.deactivating, false);
  assert.equal(frame.interactionDepthsChanged, true);
  assert.match(source, /_activateNode\(selectedId/);
  assert.match(source, /this\.nextActiveNode = node;/);
  assert.match(source, /_queueTransitionMarker\(previousNode\.id, node\.id, options\)/);
  assert.match(source, /_drawTransitionMarkers\(mainCtx\)/);
});

test('canvas graph exits active focus before accepting a different node click', async () => {
  let source = await readFile(new URL('../canvas/CanvasGraph/CanvasGraph.js', import.meta.url), 'utf8');

  assert.match(source, /this\._focusExitOnDown = false/);
  assert.match(source, /_beginFocusExit\(\)/);
  assert.match(source, /this\.activeNode && this\.activeNode\.id !== hit\.id && !this\.deactivating/);
  assert.match(source, /this\._focusExitOnDown = this\._beginFocusExit\(\)/);
  assert.match(source, /if \(this\._focusExitOnDown\) \{/);
  assert.match(source, /this\._focusExitOnDown = false;/);
  assert.ok(
    source.indexOf('this._focusExitOnDown = this._beginFocusExit();') <
      source.indexOf('this._activateNode(hit, { transition: false, marker: false });')
  );
});

test('canvas graph exposes device-orientation parallax as progressive enhancement', async () => {
  let source = await readFile(new URL('../canvas/CanvasGraph/CanvasGraph.js', import.meta.url), 'utf8');

  assert.match(source, /enableDeviceOrientationParallax\(options = \{\}\)/);
  assert.match(source, /device-orientation-parallax/);
  assert.match(source, /orientationParallaxStatus: 'orientation-parallax-status'/);
  assert.match(source, /getDeviceOrientationParallaxStatus\(\)/);
  assert.match(source, /_requestDeviceOrientationParallaxFromGesture\(\)/);
  assert.match(source, /typeof globalThis\.DeviceOrientationEvent === 'undefined'/);
  assert.match(source, /globalThis\.isSecureContext === false/);
  assert.match(source, /DeviceOrientationEvent\.requestPermission/);
  assert.match(source, /requestPermission\.call\(globalThis\.DeviceOrientationEvent, Boolean\(options\.absolute\)\)/);
  assert.match(source, /reason: 'permission-error'/);
  assert.match(source, /this\._setDeviceOrientationParallaxStatus/);
  assert.ok(
    source.indexOf('this._requestDeviceOrientationParallaxFromGesture();') <
      source.indexOf('this._rememberPointer(e);')
  );
  assert.match(source, /window\.addEventListener\('deviceorientation', handleOrientation, \{ passive: true \}\)/);
  assert.match(source, /disableDeviceOrientationParallax\(\)/);
  assert.match(source, /const visualDragDeltaX = dragDeltaX \+ this\._orientationParallaxX/);
  assert.match(source, /const pOffX = -la\.parallax \* visualDragDeltaX/);
});

test('canvas graph focus layer targets separate selected hubs from surrounding layers', async () => {
  let {
    CANVAS_GRAPH_LAYER_TARGETS,
    getLayerAnimationFrame,
  } = await import('../canvas/CanvasGraph/CanvasGraphDrawState.js');
  let layerAnim = {
    0: { scale: 1, opacity: 1, parallax: 0 },
    1: { scale: 1, opacity: 1, parallax: 0 },
    2: { scale: 1, opacity: 1, parallax: 0 },
    3: { scale: 1, opacity: 1, parallax: 0 },
    4: { scale: 1, opacity: 1, parallax: 0 },
  };
  let frame = getLayerAnimationFrame({
    layerAnim,
    layerTargets: CANVAS_GRAPH_LAYER_TARGETS,
    isIdle: false,
    inGroupMode: false,
  });

  assert.equal(CANVAS_GRAPH_LAYER_TARGETS.opacity[0], 1);
  assert.ok(CANVAS_GRAPH_LAYER_TARGETS.opacity[1] <= 0.6);
  assert.ok(CANVAS_GRAPH_LAYER_TARGETS.opacity[2] <= CANVAS_GRAPH_LAYER_TARGETS.opacity[1] * 0.5);
  assert.ok(CANVAS_GRAPH_LAYER_TARGETS.opacity[4] <= 0.03);
  assert.ok(CANVAS_GRAPH_LAYER_TARGETS.scale[1] < CANVAS_GRAPH_LAYER_TARGETS.scale[0]);
  assert.ok(CANVAS_GRAPH_LAYER_TARGETS.blur[2] > CANVAS_GRAPH_LAYER_TARGETS.blur[1]);
  assert.ok(CANVAS_GRAPH_LAYER_TARGETS.parallax[4] > CANVAS_GRAPH_LAYER_TARGETS.parallax[2]);
  assert.ok(frame[1].opacity < 1);
  assert.ok(frame[2].opacity < frame[1].opacity);
  assert.ok(frame[2].scale < frame[1].scale);
});

test('canvas graph passes normalized semantic groups into the force layout', async () => {
  let source = await readFile(new URL('../canvas/CanvasGraph/CanvasGraph.js', import.meta.url), 'utf8');

  assert.match(source, /getVisibleForceGroups\(\)/);
  assert.match(source, /groups:\s*forceGroups/);
  assert.match(source, /group:\s*findForceNodeGroup\(forceGroups,\s*n\.id\)/);
  assert.doesNotMatch(source, /groups:\s*\{\}/);
});

test('force layout fallback preserves continuous drag dynamics without a browser worker', async () => {
  let NativeWorker = globalThis.Worker;
  let nativeRaf = globalThis.requestAnimationFrame;
  let nativeCancelRaf = globalThis.cancelAnimationFrame;
  let nativeWarn = console.warn;
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  console.warn = () => {};

  try {
    delete globalThis.Worker;
    let { ForceLayout } = await import('../canvas/ForceLayout.js');
    let force = new ForceLayout('/missing-force-worker.js');
    let ticks = [];
    let nextTick = () => new Promise((resolve, reject) => {
      let timer = setTimeout(() => reject(new Error('force layout fallback did not tick')), 200);
      let previous = force.onTick;
      force.onTick = (positions, meta) => {
        previous?.(positions, meta);
        ticks.push({ positions, meta });
        clearTimeout(timer);
        resolve({ positions, meta });
      };
    });

    let firstTick = nextTick();
    force.start({
      nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 140, y: 0 }],
      edges: [{ from: 'a', to: 'b' }],
      options: { mode: 'continuous', alphaDecay: 0.5, brownian: 0 },
    });
    let first = await firstTick;
    assert.equal(first.meta.fallback, true);
    assert.ok(Number.isFinite(first.positions.a.x));

    force.pin('a', 320, 180);
    let pinned = await nextTick();
    assert.deepEqual(
      {
        x: Math.round(pinned.positions.a.x),
        y: Math.round(pinned.positions.a.y),
      },
      { x: 320, y: 180 }
    );

    force.unpin('a');
    let released = await nextTick();
    assert.equal(released.meta.fallback, true);
    assert.ok(ticks.length >= 3);
    force.stop();
  } finally {
    console.warn = nativeWarn;
    if (NativeWorker) {
      globalThis.Worker = NativeWorker;
    } else {
      delete globalThis.Worker;
    }
    if (nativeRaf) {
      globalThis.requestAnimationFrame = nativeRaf;
    } else {
      delete globalThis.requestAnimationFrame;
    }
    if (nativeCancelRaf) {
      globalThis.cancelAnimationFrame = nativeCancelRaf;
    } else {
      delete globalThis.cancelAnimationFrame;
    }
  }
});

test('force layout fallback applies semantic group links without a browser worker', async () => {
  let NativeWorker = globalThis.Worker;
  let nativeRaf = globalThis.requestAnimationFrame;
  let nativeCancelRaf = globalThis.cancelAnimationFrame;
  let nativeWarn = console.warn;
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  console.warn = () => {};

  try {
    delete globalThis.Worker;
    let { ForceLayout } = await import('../canvas/ForceLayout.js');
    let force = new ForceLayout('/missing-force-worker.js');
    let firstTick = new Promise((resolve, reject) => {
      let timer = setTimeout(() => reject(new Error('semantic group fallback did not tick')), 200);
      force.onTick = (positions, meta) => {
        clearTimeout(timer);
        resolve({ positions, meta });
      };
    });

    force.start({
      nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 100, y: 0 }],
      edges: [],
      groups: { pair: ['a', 'b'] },
      options: {
        mode: 'continuous',
        alphaDecay: 0.5,
        brownian: 0,
        chargeStrength: 0,
        centerStrength: 0,
        centerPull: 0,
        collideStrength: 0,
        groupDistance: 10,
        groupStrength: 1,
      },
    });

    let first = await firstTick;
    assert.equal(first.meta.fallback, true);
    assert.ok(first.positions.a.x > 0);
    assert.ok(first.positions.b.x < 100);
    force.stop();
  } finally {
    console.warn = nativeWarn;
    if (NativeWorker) {
      globalThis.Worker = NativeWorker;
    } else {
      delete globalThis.Worker;
    }
    if (nativeRaf) {
      globalThis.requestAnimationFrame = nativeRaf;
    } else {
      delete globalThis.requestAnimationFrame;
    }
    if (nativeCancelRaf) {
      globalThis.cancelAnimationFrame = nativeCancelRaf;
    } else {
      delete globalThis.cancelAnimationFrame;
    }
  }
});

test('material symbols loader reuses a host-provided package stylesheet', async () => {
  let NativeDocument = globalThis.document;
  let NativeWindow = globalThis.window;
  let appended = [];
  let links = [{
    rel: 'stylesheet',
    href: 'http://127.0.0.1:4213/packages/symbiote-ui/icons/material-symbols.css',
    dataset: {},
  }];
  globalThis.document = {
    nodeType: 9,
    head: {
      append(link) {
        appended.push(link);
        links.push(link);
      },
    },
    createElement(tagName) {
      return {
        tagName,
        rel: '',
        href: '',
        dataset: {},
      };
    },
    querySelector(selector) {
      if (selector === 'link[data-sn-material-symbols="managed"]') {
        return links.find((link) => link.dataset.snMaterialSymbols === 'managed') || null;
      }
      if (selector.includes('material-symbols.css')) {
        return links.find((link) => (
          link.rel.split(/\s+/).includes('stylesheet') &&
          (
            link.href.endsWith('/packages/symbiote-ui/icons/material-symbols.css') ||
            link.href.endsWith('/icons/material-symbols.css')
          )
        )) || null;
      }
      return null;
    },
  };
  globalThis.window = {};

  try {
    let materialSymbols = await import(`../icons/MaterialSymbols.js?host-stylesheet=${Date.now()}`);
    materialSymbols.configureMaterialSymbols({ autoload: true, hrefBuilder: null });
    materialSymbols.ensureMaterialSymbols(['hub', 'folder_open']);

    assert.equal(appended.length, 0);
    assert.equal(links.length, 1);
    assert.equal(links[0].href, 'http://127.0.0.1:4213/packages/symbiote-ui/icons/material-symbols.css');
    assert.equal(links[0].dataset.snMaterialSymbols, 'managed');
    assert.equal(links[0].dataset.snMaterialSymbolsIcons, 'folder_open,hub');
  } finally {
    if (NativeDocument) {
      globalThis.document = NativeDocument;
    } else {
      delete globalThis.document;
    }
    if (NativeWindow) {
      globalThis.window = NativeWindow;
    } else {
      delete globalThis.window;
    }
  }
});

test('provider schemas use symbiote-ui public schema ids', async () => {
  let manifest = await import('../manifest/index.js');
  let schemaFiles = [
    'component-descriptor-v1.json',
    'component-descriptor-v2.json',
    'agent-intent-v1.json',
    'graph-v1.json',
    'graph-model-v1.json',
    'project-package-v1.json',
    'project-transaction-v1.json',
    'runtime-ui-v1.json',
    'theme-rule-block-v1.json',
    'message-part-v1.json',
    'data-grid-v1.json',
    'chart-spec-v1.json',
    'source-diff-v1.json',
  ];
  let schemas = [
    ...Object.values(manifest.UI_SCHEMAS),
    ...Object.values(manifest.GRAPH_SCHEMAS),
    ...Object.values(manifest.PROJECT_SCHEMAS),
    ...await Promise.all(schemaFiles.map(async (file) => (
      JSON.parse(await readFile(new URL(`../schemas/${file}`, import.meta.url), 'utf8'))
    ))),
  ];

  for (const schema of schemas) {
    assert.match(schema.$id, /^https:\/\/rnd-pro\.github\.io\/symbiote-ui\/schemas\//);
    assert.doesNotMatch(schema.$id, /symbiote-node/);
  }
});

test('discover exposes the standalone package contract', async () => {
  let { cmdDiscover } = await import('../discover.js');
  let data = await cmdDiscover({});
  let entrypoints = new Map(data.exports.entrypoints.map((entry) => [entry.specifier, entry]));

  assert.equal(data.package.name, 'symbiote-ui');
  assert.equal(entrypoints.get('symbiote-ui')?.kind, 'node-safe');
  assert.equal(entrypoints.get('symbiote-ui/layout')?.kind, 'ssr-entry-safe');
  assert.equal(entrypoints.get('symbiote-ui/runtime')?.kind, 'ssr-entry-safe');
  assert.equal(entrypoints.get('symbiote-ui/webmcp')?.kind, 'ssr-entry-safe');
  assert.equal(entrypoints.get('symbiote-ui/display/source-viewer')?.kind, 'browser-component');
  assert.equal(entrypoints.get('symbiote-ui/display/source-editor')?.kind, 'browser-component');
  assert.equal(entrypoints.get('symbiote-ui/display/code-block')?.kind, 'browser-component');
  assert.equal(entrypoints.get('symbiote-ui/tree/TreeView')?.kind, 'browser-component');
  assert.equal(entrypoints.get('symbiote-ui/tree/TreePanel')?.kind, 'browser-component');
  let layoutEntrypoint = await import('../layout/index.js');
  assert.equal(typeof layoutEntrypoint.suspendLayoutSubtree, 'function');
  assert.equal(typeof layoutEntrypoint.resumeLayoutSubtree, 'function');
  let component = data.manifest.components.find((item) => item.tagName === 'cascade-theme-editor');
  let agentCatalogItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'cascade-theme-editor');
  let shellMenu = data.manifest.components.find((item) => item.tagName === 'layout-shell-menu');
  let shellMenuAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'layout-shell-menu');
  let layout = data.manifest.components.find((item) => item.tagName === 'panel-layout');
  let sidebar = data.manifest.components.find((item) => item.tagName === 'layout-sidebar');
  let layoutAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'panel-layout');
  let sidebarAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'layout-sidebar');
  let chatComposer = data.manifest.components.find((item) => item.tagName === 'chat-composer');
  let chatComposerAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'chat-composer');
  let chatSidebarAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'chat-sidebar-shell');
  let chatWorkspaceAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'chat-workspace');
  let nodeCanvasAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'node-canvas');
  let canvasGraphAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'canvas-graph');
  let graphExplorerAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'graph-explorer-shell');
  let cellBgAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'cell-bg');
  let codeBlockAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'code-block');
  let sourceViewerAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'source-viewer');
  let sourceEditorAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'source-editor');
  assert.ok(component.componentDescription.includes('cascade theme editor'));
  assert.equal(component.agent.webmcp.mode, 'explicit-descriptor');
  assert.ok(component.agent.webmcp.references.includes('https://rnd-pro.com/pulse/symbiote-webmcp-support/'));
  assert.ok(agentCatalogItem.componentDescription.includes('WebMCP tools: cascade_theme_editor_apply'));
  assert.equal(agentCatalogItem.webmcp.toolNames[0], 'cascade_theme_editor_apply');
  assert.ok(shellMenu.componentDescription.includes('project tabs'));
  assert.ok(shellMenu.componentDescription.includes('layout-group-controller'));
  assert.equal(shellMenu.agent.webmcp.mode, 'explicit-descriptor');
  assert.ok(shellMenu.contract.capabilities.includes('sidebar-slot'));
  assert.ok(shellMenu.contract.methods.some((method) => method.name === 'setGroups'));
  assert.ok(shellMenu.contract.slots.some((slot) => slot.name === 'sidebar'));
  assert.equal(shellMenuAgentItem.webmcp.toolNames[0], 'layout_shell_menu_select');
  assert.equal(shellMenuAgentItem.webmcp.toolNames[1], 'layout_shell_menu_set_groups');
  assert.equal(layout.contract.schemaVersion, 'component-descriptor-v2');
  assert.equal(sidebar.contract.schemaVersion, 'component-descriptor-v2');
  assert.ok(layoutAgentItem.webmcp.toolNames.includes('panel_layout_set_behavior'));
  assert.ok(layout.componentDescription.includes('min-size-fit'));
  assert.ok(layout.contract.capabilities.includes('mobile-stack'));
  assert.ok(layout.contract.attributes.some((attribute) => attribute.name === 'scroll-inline-active'));
  assert.ok(layout.contract.attributes.some((attribute) => attribute.name === 'scroll-block-active'));
  assert.ok(layout.contract.properties.find((property) => (
    property.name === 'layoutBehavior' &&
    property.description.includes('not persisted')
  )));
  assert.ok(layoutAgentItem.webmcp.toolNames.includes('panel_layout_register_panel_type'));
  assert.ok(layoutAgentItem.webmcp.toolNames.includes('panel_layout_set_panel_menu_actions'));
  assert.ok(layoutAgentItem.webmcp.toolNames.includes('panel_layout_open_panel'));
  assert.ok(layoutAgentItem.webmcp.toolNames.includes('panel_layout_close_ui_panel'));
  assert.ok(sidebarAgentItem.webmcp.toolNames.includes('layout_sidebar_set_sections'));
  assert.ok(sidebarAgentItem.webmcp.toolNames.includes('layout_sidebar_set_active_section'));
  assert.ok(chatComposerAgentItem.webmcp.toolNames.includes('chat_composer_voice_control'));
  assert.ok(chatComposerAgentItem.webmcp.toolNames.includes('chat_composer_voice_flow'));
  assert.ok(chatComposer.contract.webmcp.tools
    .find((tool) => tool.name === 'chat_composer_voice_control')
    .description.includes('VoiceController'));
  assert.ok(chatComposer.contract.webmcp.tools
    .find((tool) => tool.name === 'chat_composer_voice_flow')
    .description.includes('VoiceRuntime'));
  assert.ok(chatSidebarAgentItem.webmcp.toolNames.includes('chat_sidebar_set_chats'));
  assert.ok(chatSidebarAgentItem.webmcp.toolNames.includes('chat_sidebar_select'));
  assert.ok(chatSidebarAgentItem.webmcp.toolNames.includes('chat_sidebar_set_collapsed'));
  assert.ok(chatWorkspaceAgentItem.webmcp.toolNames.includes('chat_workspace_set_state'));
  assert.ok(chatWorkspaceAgentItem.webmcp.toolNames.includes('chat_workspace_background'));
  assert.ok(chatWorkspaceAgentItem.webmcp.toolNames.includes('chat_workspace_select_chat'));
  assert.ok(chatWorkspaceAgentItem.webmcp.toolNames.includes('chat_workspace_send'));
  assert.ok(chatWorkspaceAgentItem.componentDescription.includes('chat workspace'));
  assert.ok(chatWorkspaceAgentItem.componentDescription.includes('host-owned-transport'));
  assert.ok(chatWorkspaceAgentItem.componentDescription.includes('layout-lifecycle'));
  assert.ok(nodeCanvasAgentItem.webmcp.toolNames.includes('node_canvas_set_editor_model'));
  assert.ok(nodeCanvasAgentItem.webmcp.toolNames.includes('node_canvas_set_path_style'));
  assert.ok(nodeCanvasAgentItem.webmcp.toolNames.includes('node_canvas_set_flow_layout'));
  assert.ok(nodeCanvasAgentItem.webmcp.toolNames.includes('node_canvas_apply_layout'));
  assert.ok(nodeCanvasAgentItem.webmcp.toolNames.includes('node_canvas_focus_nodes'));
  assert.ok(nodeCanvasAgentItem.componentDescription.includes('node-editor-canvas'));
  assert.ok(nodeCanvasAgentItem.componentDescription.includes('graph-layout'));
  assert.ok(canvasGraphAgentItem.webmcp.toolNames.includes('canvas_graph_set_model'));
  assert.ok(canvasGraphAgentItem.webmcp.toolNames.includes('canvas_graph_focus_node'));
  assert.ok(canvasGraphAgentItem.webmcp.toolNames.includes('canvas_graph_set_path'));
  assert.ok(canvasGraphAgentItem.componentDescription.includes('overview-read-renderer'));
  assert.ok(data.manifest.components
    .find((item) => item.tagName === 'canvas-graph')
    .contract.methods
    .some((method) => method.name === 'suspendLayout'));
  assert.ok(data.manifest.components
    .find((item) => item.tagName === 'canvas-graph')
    .contract.methods
    .some((method) => method.name === 'resumeLayout'));
  assert.equal(
    data.manifest.components
      .find((item) => item.tagName === 'canvas-graph')
      .contract.attributes
      .some((attribute) => attribute.name === 'auto-trigger'),
    false
  );
  assert.ok(graphExplorerAgentItem.webmcp.toolNames.includes('graph_explorer_shell_set_view'));
  assert.ok(graphExplorerAgentItem.webmcp.toolNames.includes('graph_explorer_shell_set_stats'));
  assert.ok(graphExplorerAgentItem.webmcp.toolNames.includes('graph_explorer_shell_request_action'));
  assert.ok(cellBgAgentItem.componentDescription.includes('WebMCP tools: cell_bg_trigger'));
  assert.ok(cellBgAgentItem.webmcp.toolNames.includes('cell_bg_trigger'));
  assert.ok(cellBgAgentItem.webmcp.toolNames.includes('cell_bg_start'));
  assert.ok(cellBgAgentItem.webmcp.toolNames.includes('cell_bg_stop'));
  assert.ok(codeBlockAgentItem.componentDescription.includes('markdown document'));
  assert.ok(codeBlockAgentItem.webmcp.toolNames.includes('code_block_set_content'));
  assert.ok(sourceViewerAgentItem.componentDescription.includes('markdown-document-viewer'));
  assert.ok(sourceViewerAgentItem.webmcp.toolNames.includes('source_viewer_set_document'));
  assert.ok(sourceViewerAgentItem.webmcp.toolNames.includes('source_viewer_action'));
  assert.ok(sourceEditorAgentItem.componentDescription.includes('markdown-editing'));
  assert.ok(sourceEditorAgentItem.webmcp.toolNames.includes('source_editor_content'));
  assert.ok(sourceEditorAgentItem.webmcp.toolNames.includes('source_editor_save'));
  let sourceViewer = data.manifest.components.find((item) => item.tagName === 'source-viewer');
  let sourceEditor = data.manifest.components.find((item) => item.tagName === 'source-editor');
  let checkbox = data.manifest.components.find((item) => item.tagName === 'sn-checkbox');
  let radio = data.manifest.components.find((item) => item.tagName === 'sn-radio');
  let sw = data.manifest.components.find((item) => item.tagName === 'sn-switch');
  assert.ok(sourceViewer.contract.capabilities.includes('directory-summary'));
  assert.ok(sourceEditor.contract.capabilities.includes('markdown-editing'));
  assert.ok(checkbox.contract.capabilities.includes('mixed-state'));
  assert.ok(checkbox.contract.attributes.some((attribute) => attribute.name === 'indeterminate'));
  assert.ok(checkbox.contract.events.some((event) => event.name === 'sn-checkbox-change'));
  assert.ok(radio.contract.capabilities.includes('single-selection'));
  assert.ok(sw.contract.capabilities.includes('switch'));
  let customElements = JSON.parse(await readFile(new URL('../custom-elements.json', import.meta.url), 'utf8'));
  let sourceEditorDeclaration = customElements.modules
    .flatMap((module) => module.declarations || [])
    .find((declaration) => declaration.tagName === 'source-editor');
  let checkboxDeclaration = customElements.modules
    .flatMap((module) => module.declarations || [])
    .find((declaration) => declaration.tagName === 'sn-checkbox');
  assert.ok(sourceEditorDeclaration.componentDescription.includes('markdown-editing'));
  assert.ok(sourceEditorDeclaration.agent.webmcp.toolNames.includes('source_editor_save'));
  assert.ok(checkboxDeclaration.componentDescription.includes('mixed state'));
  assert.ok(checkboxDeclaration.metadata.contract.themeAliases.includes('--sn-selection-checked-bg'));
  let cascadeDescriptor = data.manifest.themeRuntimeDescriptors.find((descriptor) => descriptor.name === 'cascade-theme');
  assert.ok(cascadeDescriptor);
  assert.equal(cascadeDescriptor.webmcp?.name, 'symbiote-ui.createCascadeTheme');
  assert.ok(cascadeDescriptor.exports.includes('getReadableTextForHsl'));
  let cascadeControlNames = data.manifest.themeControls['cascade-theme'].map((control) => control.name);
  for (const name of ['mode', 'brightness', 'contrast', 'chroma', 'hue', 'pattern', 'outline', 'type', 'heading', 'density']) {
    assert.ok(cascadeControlNames.includes(name), `expected cascade theme control ${name}`);
  }

  assert.ok(data.manifest.themePresets);
  assert.deepEqual(data.manifest.themePresets.colors, ['carbon', 'neon', 'pcb', 'ebook', 'dark', 'light']);
  assert.deepEqual(data.manifest.themePresets.skins, ['modern', 'compact', 'rounded']);
  assert.deepEqual(data.manifest.themePresets.panels.chat, { color: 'dark', skin: 'modern', motion: 'smooth' });
});

test('CLI discover works when launched through an npm bin symlink', async () => {
  let tmpDir = await mkdtemp(join(tmpdir(), 'symbiote-ui-cli-'));
  let binPath = join(tmpDir, 'symbiote-ui');

  try {
    await symlink(fileURLToPath(new URL('../cli.js', import.meta.url)), binPath);
    let { stdout } = await execFileAsync(process.execPath, [binPath, 'discover'], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      maxBuffer: 10 * 1024 * 1024,
    });
    let data = JSON.parse(stdout);

    assert.equal(data.command, 'discover');
    assert.equal(data.package.name, 'symbiote-ui');
    assert.ok(data.manifest.components.some((component) => component.tagName === 'cascade-theme-widget'));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('webmcp helpers append component context to explicit tool descriptors', async () => {
  let { createComponentToolDescriptor } = await import('../webmcp.js');
  let descriptor = createComponentToolDescriptor(
    {
      tagName: 'sample-panel',
      className: 'SamplePanel',
      componentDescription: 'Sample panel explains the visible data.',
      agent: { semanticRole: 'sample surface' },
    },
    {
      name: 'sample_action',
      description: 'Run the visible action.',
      inputSchema: { type: 'object', additionalProperties: false },
      annotations: { readOnlyHint: false },
    }
  );

  assert.equal(descriptor.name, 'sample_action');
  assert.match(descriptor.description, /Sample panel explains/);
  assert.match(descriptor.description, /Run the visible action/);
  assert.equal(descriptor.annotations.componentTag, 'sample-panel');
  assert.equal(descriptor.annotations.semanticRole, 'sample surface');
  assert.equal(descriptor.annotations.readOnlyHint, false);
});

test('discover provides agent component defaults for drivers without explicit metadata', async () => {
  let { cmdDiscover } = await import('../discover.js');
  let data = await cmdDiscover({});

  assert.ok(data.registry.drivers.length > 0);
  for (const driver of data.registry.drivers) {
    assert.ok(Array.isArray(driver.agent?.suggestedComponents), `${driver.type} suggestedComponents`);
    if (driver.agent.suggestedComponentsSource) {
      assert.equal(driver.agent.suggestedComponentsSource, 'symbiote-ui-defaults', `${driver.type} suggestedComponentsSource`);
      assert.ok(driver.agent.suggestedComponents.includes('graph-node'), `${driver.type} graph-node suggestion`);
    } else {
      assert.ok(driver.agent.suggestedComponents.length > 0, `${driver.type} explicit suggestedComponents`);
    }
  }
});

test('component registry follows the agent-facing WebMCP documentation standard', async () => {
  let { listComponents } = await import('../manifest/index.js');

  for (const component of listComponents()) {
    assert.match(component.componentDescription, /Use this/);
    assert.ok(component.agent?.semanticRole, `${component.tagName} semantic role`);
    assert.ok(component.agent?.usage, `${component.tagName} usage`);
    assert.ok(component.agent?.dataOwnership, `${component.tagName} data ownership`);
    let toolCount = component.contract?.webmcp?.tools?.length || 0;
    assert.equal(
      component.agent?.webmcp?.mode,
      toolCount ? 'explicit-descriptor' : 'described-only'
    );
    assert.ok(
      component.agent?.webmcp?.globalToolMode.includes('Do not enable global Symbiote.mcpToolMode'),
      `${component.tagName} explicit-first WebMCP guidance`
    );
    assert.ok(component.visibility, `${component.tagName} visibility`);
    assert.equal(component.contract?.schemaVersion, 'component-descriptor-v2');
    assert.ok(component.contract?.ssr?.mode, `${component.tagName} SSR mode`);
    assert.ok(Array.isArray(component.contract?.properties), `${component.tagName} properties contract`);
    assert.ok(Array.isArray(component.contract?.events), `${component.tagName} events contract`);
    assert.ok(Array.isArray(component.contract?.slots), `${component.tagName} slots contract`);
  }
});

test('explicit WebMCP tools map to public component methods or intent events', async () => {
  let { listComponents } = await import('../manifest/index.js');

  for (const component of listComponents()) {
    let tools = component.contract?.webmcp?.tools || [];
    let methods = new Set((component.contract?.methods || []).map((method) => method.name));
    let events = new Set((component.contract?.events || []).map((event) => event.name));
    for (const tool of tools) {
      let annotations = tool.annotations || {};
      let runtimeMethods = [
        annotations.runtimeMethod,
        ...(annotations.runtimeMethods || []),
      ].filter(Boolean);
      let intentEvents = [
        annotations.intentEvent,
        ...(annotations.intentEvents || []),
      ].filter(Boolean);
      assert.ok(
        runtimeMethods.length || intentEvents.length,
        `${component.tagName}:${tool.name} must declare runtimeMethod/runtimeMethods or intentEvent/intentEvents`
      );
      for (const method of runtimeMethods) {
        assert.ok(methods.has(method), `${component.tagName}:${tool.name} references missing public method ${method}`);
      }
      for (const event of intentEvents) {
        assert.ok(events.has(event), `${component.tagName}:${tool.name} references missing public event ${event}`);
      }
    }
  }
});

test('node-canvas exposes the agent-facing serializable model adapter promised by WebMCP', async () => {
  let source = await readFile(new URL('../canvas/NodeCanvas/NodeCanvas.js', import.meta.url), 'utf8');
  let { getComponent } = await import('../manifest/index.js');
  let component = getComponent('node-canvas');
  let tool = component.contract.webmcp.tools.find((item) => item.name === 'node_canvas_set_editor_model');

  assert.match(source, /setEditorModel\(model = \{\}\)/);
  assert.equal(tool.annotations.runtimeMethod, 'setEditorModel');
  assert.ok(component.contract.methods.some((method) => method.name === 'setEditorModel'));
  assert.ok(tool.inputSchema.properties.nodes);
  assert.ok(tool.inputSchema.properties.connections);
  assert.ok(tool.inputSchema.properties.positions);
  let focusTool = component.contract.webmcp.tools.find((item) => item.name === 'node_canvas_focus_nodes');
  let layoutTool = component.contract.webmcp.tools.find((item) => item.name === 'node_canvas_apply_layout');
  assert.equal(layoutTool.annotations.runtimeMethod, 'applyLayout');
  assert.ok(component.contract.methods.some((method) => method.name === 'applyLayout'));
  assert.ok(component.contract.methods.some((method) => method.name === 'autoLayout'));
  assert.deepEqual(layoutTool.inputSchema.properties.algorithm.enum, ['auto', 'tree', 'flow']);
  assert.equal(focusTool.annotations.runtimeMethod, 'focusNodes');
  assert.ok(component.contract.methods.some((method) => method.name === 'focusNodes'));
  assert.ok(component.contract.methods.some((method) => method.name === 'flyToNodes'));
  assert.ok(focusTool.inputSchema.properties.nodeIds);
});

test('node shape registry exposes disc as a supported SVG node preset', async () => {
  let [shapeModule, nodeSource] = await Promise.all([
    import(new URL('../shapes/index.js', import.meta.url).href),
    readFile(new URL('../core/Node.js', import.meta.url), 'utf8'),
  ]);
  let disc = shapeModule.getShape('disc');
  let { getComponent } = await import('../manifest/index.js');
  let graphNode = getComponent('graph-node');

  assert.equal(disc.name, 'disc');
  assert.ok(disc.pathData);
  assert.equal(disc.viewBox, '0 0 24 24');
  assert.match(nodeSource, /rect\/pill\/circle\/disc\/diamond\/comment/);
  assert.ok(graphNode.contract.capabilities.includes('shape-variant'));
  assert.ok(graphNode.contract.capabilities.includes('media-avatar'));
  assert.ok(
    graphNode.contract.attributes.some((attribute) =>
      attribute.name === 'node-shape' && attribute.description.includes('disc')
    )
  );
});

test('source component registry does not keep legacy descriptor-v1 contracts', async () => {
  let source = await readFile(new URL('../manifest/component-registry.js', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /component-descriptor-v1/);
});
