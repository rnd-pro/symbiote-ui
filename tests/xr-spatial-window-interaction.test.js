import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createXRSpatialWindowAssembly } from '../xr/spatial-window-assembly.js';
import { createXRPanelHost } from '../xr/panel-host.js';
import {
  XR_SPATIAL_WINDOW_RESIZE_RECEIPT_VERSION,
  XR_SPATIAL_WINDOW_RELAY_RECEIPT_VERSION,
  XR_SPATIAL_WINDOW_LIFECYCLE_RECEIPT_VERSION,
  XR_SPATIAL_WINDOW_FALLBACK_VERSION,
} from '../xr/spatial-window-contract.js';
import { createXRHitMap } from '../xr/pointer.js';
import { createHitMapDescriptor } from './xr-spatial-fixtures.js';
import {
  createFakeXrPlatform,
  createFakeThree,
  failFakeHtmlTexture,
  createLayoutDescriptor,
  createWindowContentElement,
} from './xr-spatial-window-fixtures.js';

function createAssemblyContext(options = {}) {
  let platform = createFakeXrPlatform({ mode: options.mode ?? 'webgl', uploadFails: options.uploadFails });
  let THREE = options.noThree ? null : createFakeThree();
  let panelHost = options.panelHostFactory?.(platform);
  let assembly = createXRSpatialWindowAssembly({
    globalThis: platform.globalThis,
    document: platform.document,
    THREE,
    ...(panelHost ? { panelHost } : {}),
    ...(options.assemblyOptions || {}),
  });
  return { platform, THREE, assembly };
}

function createEnteredContext(options = {}) {
  let context = createAssemblyContext(options);
  let layoutIds = options.layouts || ['layout-alpha'];
  let descriptors = layoutIds.map((layoutId, index) => createLayoutDescriptor({
    layoutId,
    title: `${layoutId} window`,
    pose: { position: [layoutIds.length > 1 ? index * 0.9 - 0.45 : 0, 1.35, -1.6], rotation: [0, 0, 0] },
    dom: { element: createWindowContentElement(context.platform.document) },
    ...(options.descriptorOverrides || {}),
  }));
  context.assembly.syncLayouts(descriptors);
  context.assembly.enter({ sessionId: options.sessionId || 'session-1' });
  return context;
}

function centerRay(position = [0, 1.35, -1.6]) {
  return {
    origin: [position[0], position[1], 0],
    direction: [0, 0, -1],
  };
}

test('controller ray over content relays a normalized pointer to the live DOM', () => {
  let { assembly } = createEnteredContext();
  let move = assembly.routeRay(centerRay(), {
    type: 'pointermove',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
  });
  assert.equal(move.version, XR_SPATIAL_WINDOW_RELAY_RECEIPT_VERSION);
  assert.equal(move.ok, true);
  assert.equal(move.routed, true);
  assert.equal(move.windowId, 'window:layout-alpha');
  assert.equal(move.zone, 'content');
  assert.deepEqual(move.point, { x: 0.5, y: 0.5 });
  assert.equal(move.relay.ok, true);
  assert.ok(move.relay.dispatched.includes('xr-panel-pointer'));

  let diagnostics = assembly.getDiagnostics();
  assert.equal(diagnostics.windows[0].relay.events, 1);
});

test('content select pair resolves a hit-map action against the live DOM', () => {
  let hitMap = createXRHitMap(createHitMapDescriptor({
    panelId: 'window:layout-alpha',
    contentHash: 'sha256:alpha-content',
    revision: 1,
    viewport: { width: 1280, height: 720 },
  }));
  let { assembly, platform } = createAssemblyContext();
  assembly.syncLayouts([createLayoutDescriptor({
    contentHash: 'sha256:alpha-content',
    hitMap,
    dom: { element: createWindowContentElement(platform.document) },
  })]);
  assembly.enter({ sessionId: 'session-1' });

  let actions = [];
  let element = assembly.getWindowElement('window:layout-alpha');
  element.addEventListener('xr-panel-action', (event) => actions.push(event.detail));

  let frame = { id: 'session-1:1:10', sequence: 10, time: 100 };
  let start = assembly.routeRay(centerRay(), {
    type: 'selectstart',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    buttons: { primary: true, secondary: false },
    frame,
  });
  assert.equal(start.ok, true);
  assert.equal(start.zone, 'content');
  assert.equal(start.relay.interaction.ok, true);

  let end = assembly.routeRay(centerRay(), {
    type: 'selectend',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    buttons: { primary: false, secondary: false },
    frame: { id: 'session-1:1:11', sequence: 11, time: 130 },
  });
  assert.equal(end.relay.interaction.ok, true);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].targetId, 'replace-action');
  assert.equal(actions[0].action, 'replace');
});

test('chrome zones route to window actions instead of the DOM relay', () => {
  let { assembly } = createEnteredContext();
  let windowEntry = assembly.getWindow('window:layout-alpha');
  let zones = windowEntry.chrome.zones;
  let rayAtZone = (zone) => {
    let point = {
      x: zone.x + zone.width / 2,
      y: zone.y + zone.height / 2,
    };
    return {
      origin: [
        windowEntry.pose.position[0] + (point.x - 0.5) * windowEntry.sizeMeters[0],
        windowEntry.pose.position[1] + (0.5 - point.y) * windowEntry.sizeMeters[1],
        0,
      ],
      direction: [0, 0, -1],
    };
  };
  let grab = assembly.routeRay(rayAtZone(zones.move), {
    type: 'pointerdown',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
  });
  assert.equal(grab.ok, true);
  assert.equal(grab.routed, true);
  assert.equal(grab.zone, 'move');
  assert.equal(grab.action, 'move-begin');

  let pinHit = assembly.routeRay(rayAtZone(zones.actions.pin), {
    type: 'pointerdown',
    source: 'xr-hand',
    sourceId: 'hand-left',
    sessionId: 'session-1',
  });
  assert.equal(pinHit.zone, 'action');
  assert.equal(pinHit.action, 'pin');
  assert.equal(assembly.getWindow('window:layout-alpha').state.pinned, true);

  let closeHit = assembly.routeRay(rayAtZone(zones.actions.close), {
    type: 'pointerdown',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
  });
  assert.equal(closeHit.zone, 'action');
  assert.equal(closeHit.action, 'close');
  assert.equal(assembly.getWindow('window:layout-alpha').state.hidden, true);

  let relayAfter = assembly.routeRay(centerRay(), { type: 'pointermove', source: 'xr-controller', sourceId: 'controller-right', sessionId: 'session-1' });
  assert.equal(relayAfter.routed, false, 'hidden windows are not routed');
});

test('ray routing reports misses and invalid rays as data', () => {
  let { assembly } = createEnteredContext();
  let miss = assembly.routeRay({ origin: [5, 5, 0], direction: [0, 1, 0] }, { type: 'pointermove', source: 'xr-controller' });
  assert.equal(miss.version, XR_SPATIAL_WINDOW_RELAY_RECEIPT_VERSION);
  assert.equal(miss.ok, true);
  assert.equal(miss.routed, false);
  assert.equal(miss.reason, 'no-window-hit');

  let invalid = assembly.routeRay({ origin: [0, 0, 0] }, { type: 'pointermove' });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.reason, 'invalid-ray');
});

test('resize preview changes only the shell and keeps content unscaled', async () => {
  let { assembly, THREE } = createEnteredContext();
  let diagnosticsBefore = assembly.getDiagnostics();
  assert.equal(diagnosticsBefore.counters.uploads, 1);

  let begin = assembly.beginResize('window:layout-alpha', { handle: 'southEast' });
  assert.equal(begin.version, XR_SPATIAL_WINDOW_RESIZE_RECEIPT_VERSION);
  assert.equal(begin.phase, 'begin');
  assert.equal(begin.ok, true);
  assert.deepEqual(begin.committedSizeMeters, [0.8, 0.45]);

  let preview = assembly.previewResize('window:layout-alpha', [1.2, 0.675]);
  assert.equal(preview.version, XR_SPATIAL_WINDOW_RESIZE_RECEIPT_VERSION);
  assert.equal(preview.phase, 'preview');
  assert.equal(preview.ok, true);
  assert.deepEqual(preview.previewSizeMeters, [1.2, 0.675]);
  assert.equal(preview.contentScaled, false, 'preview never scales content');

  let windowEntry = assembly.getWindow('window:layout-alpha');
  assert.equal(windowEntry.resize.phase, 'preview');
  assert.deepEqual(windowEntry.sizeMeters, [0.8, 0.45], 'committed size unchanged during preview');
  assert.deepEqual(windowEntry.viewport, { width: 1280, height: 720 }, 'content viewport unchanged during preview');
  assert.equal(assembly.getDiagnostics().counters.uploads, 1, 'preview performs no uploads');

  let mesh = assembly.getWindowMesh('window:layout-alpha');
  assert.equal(mesh.geometry.parameters.width, 0.8, 'content geometry unchanged during preview');
  let previewPlane = mesh.children.find((child) => child.name === 'sn-xr-window-resize-preview');
  assert.ok(previewPlane, 'shell preview plane exists');
  assert.equal(previewPlane.geometry.parameters.width, 1.2);
  assert.equal(previewPlane.geometry.parameters.height, 0.675);

  let commit = await assembly.commitResize('window:layout-alpha');
  assert.equal(commit.version, XR_SPATIAL_WINDOW_RESIZE_RECEIPT_VERSION);
  assert.equal(commit.phase, 'commit');
  assert.equal(commit.ok, true);
  assert.deepEqual(commit.sizeMeters, [1.2, 0.675]);
  assert.equal(commit.viewport.width, 1920, 'commit runs CSS layout at the final viewport');
  assert.equal(commit.viewport.height, 1080);
  assert.equal(commit.texture.uploaded, true, 'commit uploads a fresh texture');
  assert.equal(commit.geometrySwapped, true, 'commit swaps texture and geometry transactionally');

  let committed = assembly.getWindow('window:layout-alpha');
  assert.deepEqual(committed.sizeMeters, [1.2, 0.675]);
  assert.deepEqual(committed.viewport, { width: 1920, height: 1080 });
  let committedMesh = assembly.getWindowMesh('window:layout-alpha');
  assert.equal(committedMesh.geometry.parameters.width, 1.2);
  assert.equal(
    committedMesh.children.some((child) => child.name === 'sn-xr-window-resize-preview'),
    false,
    'preview plane removed after commit',
  );
  let element = assembly.getWindowElement('window:layout-alpha');
  assert.equal(element.style.width, '1920px', 'live DOM laid out at the committed CSS viewport');
  assert.equal(element.style.height, '1080px');
  assert.equal(assembly.getDiagnostics().counters.uploads, 2, 'exactly one extra upload for the commit');
});

test('live DOM mutation advances the assembly content epoch and redraws without remount', async () => {
  let { assembly, platform } = createEnteredContext();
  let element = assembly.getWindowElement('window:layout-alpha');
  let before = assembly.getWindow('window:layout-alpha');
  let initialMounts = before.lifecycle.mounts;
  let initialUploads = assembly.getDiagnostics().counters.uploads;

  element.querySelector('input').value = 'preserved';
  assert.equal(platform.triggerMutation(element), 1);
  await new Promise((resolve) => setTimeout(resolve, 175));

  assembly.syncFrame({ time: 1 });

  let redrawn = assembly.getWindow('window:layout-alpha');
  assert.equal(redrawn.lifecycle.mounts, initialMounts);
  assert.equal(assembly.getWindowElement('window:layout-alpha'), element);
  assert.equal(element.querySelector('input').value, 'preserved');
  assert.equal(assembly.getDiagnostics().counters.uploads, initialUploads + 1);
});

test('shrink preview masks old content while grow preview exposes themed background', () => {
  let { assembly } = createEnteredContext();
  assembly.beginResize('window:layout-alpha', { handle: 'southEast' });
  assembly.previewResize('window:layout-alpha', [0.5, 0.3]);

  let mesh = assembly.getWindowMesh('window:layout-alpha');
  let masks = mesh.children.filter((child) => child.name.startsWith('sn-xr-window-resize-mask-'));
  assert.ok(masks.length >= 2, 'shrink masks content outside the target bounds');
  assert.equal(mesh.geometry.parameters.width, 0.8, 'content remains at committed size');

  assembly.previewResize('window:layout-alpha', [1.2, 0.675]);
  let preview = mesh.children.find((child) => child.name === 'sn-xr-window-resize-preview');
  assert.equal(mesh.children.some((child) => child.name.startsWith('sn-xr-window-resize-mask-')), false);
  assert.equal(preview.geometry.parameters.width, 1.2);
  assert.ok(preview.material.color, 'grow area uses themed preview material');
  assert.equal(mesh.geometry.parameters.width, 0.8, 'grow does not scale content');
});

test('resize commit rolls back before publication when the panel host rejects viewport reflow', async () => {
  let host;
  let { assembly } = createEnteredContext({
    panelHostFactory(platform) {
      host = createXRPanelHost({ document: platform.document, globalThis: platform.globalThis });
      let updatePanelViewport = host.updatePanelViewport;
      host.updatePanelViewport = (...args) => (
        args[2]?.requestPaint
          ? { ok: false, reason: 'viewport-reflow-rejected', panelId: args[0] }
          : updatePanelViewport(...args)
      );
      return host;
    },
  });
  let mesh = assembly.getWindowMesh('window:layout-alpha');
  let geometry = mesh.geometry;
  assembly.beginResize('window:layout-alpha', { handle: 'southEast' });
  assembly.previewResize('window:layout-alpha', [1.2, 0.675]);

  let commit = await assembly.commitResize('window:layout-alpha');
  assert.equal(commit.ok, false);
  assert.equal(commit.reason, 'viewport-reflow-rejected');
  assert.equal(commit.rolledBack, true);
  assert.equal(commit.geometrySwapped, false);
  assert.equal(mesh.geometry, geometry, 'geometry is not published before the host receipt');
  assert.deepEqual(assembly.getWindow('window:layout-alpha').sizeMeters, [0.8, 0.45]);
  assert.deepEqual(assembly.getWindow('window:layout-alpha').viewport, { width: 1280, height: 720 });
});

for (let failureMode of ['false', 'throw']) {
  test(`resize commit restores a partially mutated DOM viewport after host ${failureMode}`, async () => {
    let { assembly } = createEnteredContext({
      panelHostFactory(platform) {
        let host = createXRPanelHost({ document: platform.document, globalThis: platform.globalThis });
        let updatePanelViewport = host.updatePanelViewport;
        host.updatePanelViewport = (...args) => {
          let result = updatePanelViewport(...args);
          if (args[2]?.requestPaint) {
            if (failureMode === 'throw') throw new Error('viewport-reflow-threw-after-mutation');
            return { ...result, ok: false, reason: 'viewport-reflow-rejected-after-mutation' };
          }
          return result;
        };
        return host;
      },
    });
    let element = assembly.getWindowElement('window:layout-alpha');
    assembly.beginResize('window:layout-alpha', { handle: 'southEast' });
    assembly.previewResize('window:layout-alpha', [1.2, 0.675]);

    let commit = await assembly.commitResize('window:layout-alpha');
    assert.equal(commit.ok, false);
    assert.equal(commit.rolledBack, true);
    assert.equal(element.style.width, '1280px');
    assert.equal(element.style.height, '720px');
    assert.equal(assembly.getDiagnostics().activeGesture, null);
  });
}

test('texture failure clears the gesture and reports a failed viewport restoration honestly', async () => {
  let { assembly, platform } = createEnteredContext({
    mode: 'canvas2d',
    panelHostFactory(fakePlatform) {
      let host = createXRPanelHost({ document: fakePlatform.document, globalThis: fakePlatform.globalThis });
      let updatePanelViewport = host.updatePanelViewport;
      let calls = 0;
      host.updatePanelViewport = (...args) => {
        calls += 1;
        if (calls === 2) return { ok: false, reason: 'committed-viewport-restore-rejected' };
        return updatePanelViewport(...args);
      };
      return host;
    },
  });
  platform.setDrawFails(true);
  assembly.beginResize('window:layout-alpha', { handle: 'southEast' });
  assembly.previewResize('window:layout-alpha', [1.2, 0.675]);

  let commit = await assembly.commitResize('window:layout-alpha');
  assert.equal(commit.ok, false);
  assert.equal(commit.rolledBack, false);
  assert.match(commit.reason, /rollback-failed:committed-viewport-restore-rejected/);
  assert.equal(commit.geometrySwapped, false);
  assert.equal(assembly.getDiagnostics().activeGesture, null);
  assert.equal(assembly.getWindow('window:layout-alpha').resize.phase, 'idle');
});

test('resize cancel restores the shell without uploads or layout churn', () => {
  let { assembly } = createEnteredContext();
  assembly.beginResize('window:layout-alpha', { handle: 'east' });
  assembly.previewResize('window:layout-alpha', [1.1, 0.45]);
  let cancel = assembly.cancelResize('window:layout-alpha');
  assert.equal(cancel.version, XR_SPATIAL_WINDOW_RESIZE_RECEIPT_VERSION);
  assert.equal(cancel.phase, 'cancel');
  assert.equal(cancel.ok, true);
  assert.deepEqual(cancel.sizeMeters, [0.8, 0.45]);

  let windowEntry = assembly.getWindow('window:layout-alpha');
  assert.equal(windowEntry.resize.phase, 'idle');
  assert.deepEqual(windowEntry.sizeMeters, [0.8, 0.45]);
  assert.deepEqual(windowEntry.viewport, { width: 1280, height: 720 });
  assert.equal(assembly.getDiagnostics().counters.uploads, 1, 'cancel performs no uploads');
  let mesh = assembly.getWindowMesh('window:layout-alpha');
  assert.equal(mesh.children.some((child) => child.name === 'sn-xr-window-resize-preview'), false);
});

test('resize commit rolls back transactionally when the texture upload fails', async () => {
  let { assembly, platform } = createEnteredContext({ mode: 'canvas2d' });
  assert.equal(assembly.getDiagnostics().counters.uploads, 1);
  platform.setDrawFails(true);

  assembly.beginResize('window:layout-alpha', { handle: 'southEast' });
  assembly.previewResize('window:layout-alpha', [1.2, 0.675]);
  let commit = await assembly.commitResize('window:layout-alpha');
  assert.equal(commit.phase, 'commit');
  assert.equal(commit.ok, false);
  assert.equal(commit.geometrySwapped, false);
  assert.equal(commit.rolledBack, true);
  assert.equal(commit.texture.uploaded, false);
  assert.ok(commit.texture.reason);

  let windowEntry = assembly.getWindow('window:layout-alpha');
  assert.deepEqual(windowEntry.sizeMeters, [0.8, 0.45], 'failed commit keeps the committed size');
  assert.deepEqual(windowEntry.viewport, { width: 1280, height: 720 });
  let element = assembly.getWindowElement('window:layout-alpha');
  assert.equal(element.style.width, '1280px', 'failed commit restores the committed CSS viewport');
  assert.equal(windowEntry.fallback.version, XR_SPATIAL_WINDOW_FALLBACK_VERSION);
  assert.ok(windowEntry.fallback.reason);
  assert.equal(assembly.getDiagnostics().activeGesture, null);
});

test('resize state machine rejects out-of-phase calls as data', async () => {
  let { assembly } = createEnteredContext();
  let idlePreview = assembly.previewResize('window:layout-alpha', [1, 0.5]);
  assert.equal(idlePreview.ok, false);
  assert.equal(idlePreview.reason, 'resize-not-active');
  let idleCommit = await assembly.commitResize('window:layout-alpha');
  assert.equal(idleCommit.ok, false);
  assert.equal(idleCommit.reason, 'resize-not-active');
  let idleCancel = assembly.cancelResize('window:layout-alpha');
  assert.equal(idleCancel.ok, false);
  assert.equal(idleCancel.reason, 'resize-not-active');

  assembly.beginResize('window:layout-alpha', { handle: 'east' });
  let secondBegin = assembly.beginResize('window:layout-alpha', { handle: 'west' });
  assert.equal(secondBegin.ok, false);
  assert.equal(secondBegin.reason, 'resize-already-active');
  let missing = assembly.beginResize('window:nope', { handle: 'east' });
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'window-not-found');
});

test('unsupported capability stays explicit fallback data', () => {
  let { assembly, platform } = createAssemblyContext({ mode: 'none' });
  assembly.syncLayouts([createLayoutDescriptor({
    dom: { element: createWindowContentElement(platform.document) },
  })]);
  assembly.enter({ sessionId: 'session-1' });
  let windowEntry = assembly.getWindow('window:layout-alpha');
  assert.equal(windowEntry.fallback.version, XR_SPATIAL_WINDOW_FALLBACK_VERSION);
  assert.equal(windowEntry.fallback.mode, 'provider-material-fallback');
  assert.equal(windowEntry.fallback.source, 'provider-material-fallback');
  assert.ok(windowEntry.fallback.reason);
  assert.equal(windowEntry.upload.uploads, 0);
});

test('runtime upload failure stays explicit fallback data', () => {
  let { assembly, platform } = createAssemblyContext({ mode: 'webgl' });
  failFakeHtmlTexture();
  assembly.syncLayouts([createLayoutDescriptor({
    dom: { element: createWindowContentElement(platform.document) },
  })]);
  let enter = assembly.enter({ sessionId: 'session-1' });
  assert.equal(enter.ok, true, 'upload failure never throws out of enter');
  let windowEntry = assembly.getWindow('window:layout-alpha');
  assert.equal(windowEntry.fallback.mode, 'provider-material-fallback');
  assert.ok(windowEntry.fallback.reason);
  assert.equal(windowEntry.upload.uploads, 0);
  let fallbackReceipt = assembly.getReceipts().find((receipt) => receipt.version === XR_SPATIAL_WINDOW_FALLBACK_VERSION);
  assert.ok(fallbackReceipt, 'fallback receipt recorded as data');
  assert.equal(fallbackReceipt.windowId, 'window:layout-alpha');
});

test('dirty gating uploads only affected windows and stays at zero while idle', () => {
  let { assembly, platform } = createAssemblyContext();
  assembly.syncLayouts([
    createLayoutDescriptor({ dom: { element: createWindowContentElement(platform.document) } }),
    createLayoutDescriptor({
      layoutId: 'layout-beta',
      pose: { position: [0.9, 1.35, -1.6], rotation: [0, 0, 0] },
      dom: { element: createWindowContentElement(platform.document) },
    }),
  ]);
  assembly.enter({ sessionId: 'session-1' });
  assert.equal(assembly.getDiagnostics().counters.uploads, 2);

  let idleFrame = assembly.syncFrame({ timestamp: 100 });
  assert.equal(idleFrame.uploads, 0, 'idle frame performs zero uploads');
  let idleAgain = assembly.syncFrame({ timestamp: 116 });
  assert.equal(idleAgain.uploads, 0);
  assert.equal(assembly.getDiagnostics().counters.uploads, 2);

  assembly.syncLayouts([
    createLayoutDescriptor({ contentRevision: 2 }),
    createLayoutDescriptor({
      layoutId: 'layout-beta',
      pose: { position: [0.9, 1.35, -1.6], rotation: [0, 0, 0] },
    }),
  ]);
  let betaAfter = assembly.getDiagnostics().windows.find((entry) => entry.layoutId === 'layout-beta');
  assert.equal(betaAfter.upload.uploads, 1, 'unaffected window is not re-uploaded');
  let alphaAfter = assembly.getDiagnostics().windows.find((entry) => entry.layoutId === 'layout-alpha');
  assert.equal(alphaAfter.upload.uploads, 2, 'changed window re-uploaded once');
  assert.equal(assembly.getDiagnostics().counters.uploads, 3);
  let settledFrame = assembly.syncFrame({ timestamp: 132 });
  assert.equal(settledFrame.uploads, 0, 'coalesced update leaves no duplicate redraw queued');
  assert.equal(assembly.getDiagnostics().counters.uploads, 3);
});

test('cascade theme projection marks affected windows dirty and updates diagnostics', () => {
  let { assembly } = createEnteredContext({
    descriptorOverrides: { themeScope: 'default-provider' }
  });
  assert.equal(assembly.getDiagnostics().counters.uploads, 1);
  let applied = assembly.applyTheme({
    version: 'xr-theme-snapshot-v1',
    themeScope: 'default-provider',
    tokens: { '--sn-xr-panel-bg': '#101820' },
    material: {
      background: '#101820',
      backgroundColor: 0x101820,
      border: '#2a3542',
      borderColor: 0x2a3542,
      pointer: '#4c8bf5',
      pointerColor: 0x4c8bf5,
    },
  });
  assert.equal(applied.version, XR_SPATIAL_WINDOW_LIFECYCLE_RECEIPT_VERSION);
  assert.equal(applied.action, 'apply-theme');
  assert.equal(applied.ok, true);
  assert.ok(applied.details.affectedWindowIds.includes('window:layout-alpha'));
  assert.equal(assembly.getDiagnostics().counters.uploads, 2, 'theme change re-uploads affected windows');
  assert.equal(assembly.getDiagnostics().theme.themeScope, 'default-provider');
});

test('syncFrame records frame timing evidence', () => {
  let { assembly } = createEnteredContext({ assemblyOptions: { nominalFrameRate: 90 } });
  assembly.syncFrame({ timestamp: 0 });
  assembly.syncFrame({ timestamp: 11.1 });
  assembly.syncFrame({ timestamp: 22.2 });
  let diagnostics = assembly.getDiagnostics();
  assert.equal(diagnostics.frame.version, 'xr-frame-timing-v1');
  assert.equal(diagnostics.frame.sampleCount, 3);
  assert.equal(diagnostics.frame.nominalFrameRate, 90);
});

test('getDiagnostics exposes per-window lifecycle, upload, relay, resize, and frame evidence', () => {
  let { assembly } = createEnteredContext();
  assembly.routeRay(centerRay(), { type: 'pointermove', source: 'xr-controller', sourceId: 'controller-right', sessionId: 'session-1' });
  let diagnostics = assembly.getDiagnostics();
  assert.equal(diagnostics.version, 'xr-spatial-window-assembly-diagnostics-v1');
  assert.equal(diagnostics.status, 'entered');
  assert.equal(diagnostics.session.sessionId, 'session-1');
  assert.equal(diagnostics.session.entries, 1);
  assert.equal(diagnostics.windows.length, 1);
  let entry = diagnostics.windows[0];
  assert.equal(entry.windowId, 'window:layout-alpha');
  assert.equal(entry.layoutId, 'layout-alpha');
  assert.equal(entry.lifecycle.mounted, true);
  assert.equal(entry.upload.uploads, 1);
  assert.equal(entry.upload.dirty, false);
  assert.equal(entry.relay.events, 1);
  assert.equal(entry.resize.phase, 'idle');
  assert.equal(entry.fallback.mode, 'none');
  assert.ok(entry.pose);
  assert.ok(entry.viewport);
});

test('diagnostics: prove live frame sizes, resize recomputes them, intersections are calculated, and scoped theme change dirties/uploads target only', () => {
  let { assembly, platform } = createAssemblyContext();
  
  assembly.syncLayouts([
    createLayoutDescriptor({
      layoutId: 'layout-alpha',
      themeScope: 'alpha-scope',
      sizeMeters: [0.8, 0.45],
      viewport: { width: 800, height: 450 },
      dom: { element: createWindowContentElement(platform.document) },
    }),
    createLayoutDescriptor({
      layoutId: 'layout-beta',
      themeScope: 'beta-scope',
      sizeMeters: [1.2, 0.6],
      viewport: { width: 1200, height: 600 },
      dom: { element: createWindowContentElement(platform.document) },
    }),
  ]);
  
  assembly.enter({ sessionId: 'session-diag-test' });

  let diagBefore = assembly.getDiagnostics();
  let winAlphaBefore = diagBefore.windows.find((w) => w.layoutId === 'layout-alpha');
  let winBetaBefore = diagBefore.windows.find((w) => w.layoutId === 'layout-beta');

  assert.deepEqual(winAlphaBefore.chrome.geometry.sizeMeters, [0.8, 0.45]);
  assert.deepEqual(winBetaBefore.chrome.geometry.sizeMeters, [1.2, 0.6]);

  assert.equal(winAlphaBefore.chrome.overlap.zeroForbiddenOverlap, true);
  assert.equal(winAlphaBefore.chrome.overlap.verdict, 'PASS');
  
  let nwStraddle = winAlphaBefore.chrome.overlap.intersections.find(
    (item) => item.zones.includes('content') && item.zones.includes('resize:northWest')
  );
  assert.equal(nwStraddle?.allowed, true, 'corner proximity overlap is explicit and deterministic');

  assembly.beginResize('window:layout-alpha', { handle: 'northWest' });
  assembly.previewResize('window:layout-alpha', [1.6, 0.9]);
  
  let diagPreview = assembly.getDiagnostics();
  let winAlphaPreview = diagPreview.windows.find((w) => w.layoutId === 'layout-alpha');
  // preview phase doesn't commit size
  assert.deepEqual(winAlphaPreview.chrome.geometry.sizeMeters, [0.8, 0.45]);

  assembly.commitResize('window:layout-alpha');
  
  let diagAfterResize = assembly.getDiagnostics();
  let winAlphaAfterResize = diagAfterResize.windows.find((w) => w.layoutId === 'layout-alpha');
  assert.deepEqual(winAlphaAfterResize.chrome.geometry.sizeMeters, [1.6, 0.9]);

  assembly.syncFrame({ timestamp: 100 });
  
  let diagPostResizeFlush = assembly.getDiagnostics();
  let winAlphaPostResizeFlush = diagPostResizeFlush.windows.find((w) => w.layoutId === 'layout-alpha');
  let winBetaPostResizeFlush = diagPostResizeFlush.windows.find((w) => w.layoutId === 'layout-beta');
  
  let alphaUploadsBefore = winAlphaPostResizeFlush.upload.uploads;
  let betaUploadsBefore = winBetaPostResizeFlush.upload.uploads;
  let alphaThemeRevBefore = winAlphaPostResizeFlush.themeRevision;
  let betaThemeRevBefore = winBetaPostResizeFlush.themeRevision;

  assembly.applyTheme({
    version: 'xr-theme-snapshot-v1',
    themeScope: 'alpha-scope',
    tokens: { '--sn-xr-panel-bg': '#111111' },
    material: {
      background: '#111111',
      backgroundColor: 0x111111,
      border: '#222222',
      borderColor: 0x222222,
      pointer: '#333333',
      pointerColor: 0x333333,
    },
  });

  assembly.syncFrame({ timestamp: 200 });

  let diagAfterTheme = assembly.getDiagnostics();
  let winAlphaAfterTheme = diagAfterTheme.windows.find((w) => w.layoutId === 'layout-alpha');
  let winBetaAfterTheme = diagAfterTheme.windows.find((w) => w.layoutId === 'layout-beta');

  assert.equal(winAlphaAfterTheme.upload.uploads, alphaUploadsBefore + 1, 'target window uploads increment');
  assert.equal(winBetaAfterTheme.upload.uploads, betaUploadsBefore, 'idle window uploads remain unchanged');
  
  assert.equal(winBetaAfterTheme.themeRevision, betaThemeRevBefore, 'idle window theme revision remains unchanged');
});
