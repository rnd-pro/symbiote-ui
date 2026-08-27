import { createXRHtmlCanvasRenderer } from './html-canvas-renderer.js';
import { requestHtmlInCanvasPaint } from '../canvas/html-in-canvas.js';
import { createXRPanelHost } from './panel-host.js';
import {
  createXRThreeWebXRAdapter,
  createXRThreeHtmlCanvasTextureResolver,
  createXRThreePanelTextureBridge,
  updateXRThreePanelMaterialStates,
} from './three-webxr-adapter.js';
import { createXRPortablePanelStore } from './portable-panel-state.js';
import { createXRSpatialScene } from './spatial-scene.js';
import {
  createXRPanelFrame,
  hitTestXRPanelFrame,
} from './panel-frame.js';
import { hitTestXRPanels } from './pointer.js';
import {
  createXRThemeSnapshot,
  applyXRThemeToPanel,
} from './theme-bridge.js';
import { resolveXRDesignTokens, xrDesignTokenColorNumber } from './chrome-theme.js';
import { createXRFrameTimingTracker } from './frame-timing.js';
import { freezeSpatialValue } from './spatial-contract.js';
import {
  XR_SPATIAL_WINDOW_LAYOUT_VERSION,
  XR_SPATIAL_WINDOW_DIAGNOSTICS_VERSION,
  XR_SPATIAL_WINDOW_FRAME_VERSION,
  XR_SPATIAL_WINDOW_SIZE_LIMITS,
  XR_SPATIAL_WINDOW_VIEWPORT_BOUNDS,
  normalizeXRSpatialWindowLayout,
  diffXRSpatialWindowLayouts,
  resolveXRSpatialWindowTextureKey,
  clampXRSpatialWindowSize,
  resolveXRSpatialWindowCommitViewport,
  createXRSpatialWindowChromeSurface,
  eulerDegreesToXRQuaternion,
  xrQuaternionToEulerDegrees,
  createXRSpatialWindowSyncReceipt,
  createXRSpatialWindowLifecycleReceipt,
  createXRSpatialWindowResizeReceipt,
  createXRSpatialWindowRelayReceipt,
  createXRSpatialWindowScrollReceipt,
  createXRSpatialWindowSelectionReceipt,
  createXRSpatialWindowFocusReceipt,
  createXRSpatialWindowViewportReceipt,
  createXRSpatialWindowFallback,
  createXRSpatialWindowThemeRedrawReceipt,
  validateXRSpatialWindowThemeRedrawReceiptAgainstTrustedObservationSync,
  validateXRSpatialWindowDiagnosticsAgainstTrustedObservationSync,
  sortKeys,
  digest,
  sha256Sync,
  stringifyCanonical,
  validateXRThemeInput,
  validateXRThemeSnapshot,
  canonicalizeThemeSnapshot,
} from './spatial-window-contract.js';
import {
  resolveXRSpatialWindowDefaultPlacement,
  xrSpatialWindowSlotBlocked,
} from './spatial-window-placement.js';

const RECEIPT_LOG_LIMIT = 240;
const RESIZE_HANDLE_PATTERN = /^(northWest|northEast|southEast|southWest|north|south|east|west)$/;

function isVector(value, length) {
  return Array.isArray(value) && value.length === length && value.every((entry) => Number.isFinite(Number(entry)));
}

const ROUNDING_PRECISION = 1_000_000;
function roundMetric(value) {
  return Math.round(value * ROUNDING_PRECISION) / ROUNDING_PRECISION;
}

function getRectangleIntersection(r1, r2) {
  let x = Math.max(r1.x, r2.x);
  let y = Math.max(r1.y, r2.y);
  let w = Math.min(r1.x + r1.width, r2.x + r2.width) - x;
  let h = Math.min(r1.y + r1.height, r2.y + r2.height) - y;
  if (w > 0 && h > 0) {
    return w * h;
  }
  return 0;
}

const ALLOWED_OVERLAPS = {
  'content': {
    'resize:northWest': 'Corner proximity targets straddle the visible panel corner.',
    'resize:northEast': 'Corner proximity targets straddle the visible panel corner.',
    'resize:southEast': 'Corner proximity targets straddle the visible panel corner.',
    'resize:southWest': 'Corner proximity targets straddle the visible panel corner.',
  },
  'controlBar': {
    'move': 'The move handlebar is a nested interactive region within the control bar container.',
    'actions:reset': 'The reset action button is nested within the control bar container.',
    'actions:fullscreen': 'The fullscreen action button is nested within the control bar container.',
    'actions:pin': 'The pin action button is nested within the control bar container.',
    'actions:close': 'The close action button is nested within the control bar container.',
  }
};

function isOverlapAllowed(key1, key2) {
  if (ALLOWED_OVERLAPS[key1]?.[key2] || ALLOWED_OVERLAPS[key2]?.[key1]) {
    return true;
  }
  return false;
}

function clonePose(pose) {
  return { position: [...pose.position], rotation: [...pose.rotation] };
}

function createWindowUploadState() {
  return {
    dirty: false,
    resolves: 0,
    uploads: 0,
    reuses: 0,
    version: 'xr-html-canvas-upload-receipt-v1',
    panelId: null,
    mode: 'webgl',
    rendered: false,
    uploaded: false,
    canvasMatch: false,
    width: null,
    height: null,
    signature: null,
    reason: null,
    errorName: null,
  };
}

export class RollbackVerificationError extends Error {
  constructor(message, initialError, bridgeErrors = [], restorationErrors = []) {
    super(message);
    this.name = 'RollbackVerificationError';
    this.initialError = initialError;
    this.bridgeErrors = bridgeErrors;
    this.restorationErrors = restorationErrors;
  }
}

export class FinalizeContractViolationError extends Error {
  constructor(message, initialError) {
    super(message);
    this.name = 'FinalizeContractViolationError';
    this.initialError = initialError;
  }
}

/**
 * Public, product-neutral, SSR-safe spatial-window assembly. One open layout
 * instance maps to one XR window; the layout's internal panel tree stays the
 * live DOM content of that one window.
 *
 * @param {Object} [options]
 * @returns {Object}
 */
export function createXRSpatialWindowAssembly(options = {}) {
  let globalRef = options.globalThis || globalThis;
  let documentRef = options.document || globalRef?.document || null;
  let THREE = options.THREE || null;
  let htmlCanvasRenderer = options.htmlCanvasRenderer || createXRHtmlCanvasRenderer({
    globalThis: globalRef,
    mode: options.mode,
    onInvalidate: ({ panelId } = {}) => {
      let windowEntry = windows.get(windowIds.get(panelId));
      if (windowEntry) markWindowContentChanged(windowEntry);
    },
  });
  let panelHost = options.panelHost || (documentRef?.createElement
    ? createXRPanelHost({
      document: documentRef,
      globalThis: globalRef,
      componentResolver: options.componentResolver,
      propsResolver: options.propsResolver,
    })
    : null);
  let adapter = options.adapter || (THREE ? createXRThreeWebXRAdapter({ THREE }) : null);
  let textureResolver = options.textureResolver || (THREE
    ? createXRThreeHtmlCanvasTextureResolver({
      THREE,
      document: documentRef,
      globalThis: globalRef,
      htmlCanvasRenderer,
      textureQuality: options.textureQuality,
      canvasFactory: (panel) => windows.get(windowIds.get(panel?.id))?.canvas || null,
    })
    : null);
  let textureBridge = options.textureBridge || (textureResolver
    ? createXRThreePanelTextureBridge({
      htmlCanvasRenderer,
      textureResolver: textureResolver.resolve,
      getPanelElement: (panelId) => panelHost?.getPanelElement?.(panelId) || null,
      textureQuality: options.textureQuality,
    })
    : null);



  let themeTokens = resolveXRDesignTokens(options.theme || undefined);

  let windows = new Map();
  let windowIds = new Map();
  let receipts = [];
  let status = 'idle';
  let disposed = false;
  let syncSequence = 0;
  let sessionCounter = 0;
  let adoptedSession = null;
  let poseSnapshot = null;
  let portableStore = null;
  let themeSnapshot = options.themeSnapshot || null;
  let themeSnapshotsByScope = new Map();
  if (themeSnapshot) {
    themeSnapshotsByScope.set(themeSnapshot.themeScope || 'xr', themeSnapshot);
  }
  let sceneSyncPending = false;
  let activeGesture = null;
  let frameTracker = createXRFrameTimingTracker({
    nominalFrameRate: options.nominalFrameRate,
    supportedFrameRates: options.supportedFrameRates,
  });
  let sessionStats = { entries: 0, exits: 0 };
  let resizeStats = { previews: 0, commits: 0, cancels: 0 };
  let focusStats = { handoffs: 0 };
  let viewportStats = { updates: 0 };
  let frameBaseline = { uploads: 0, reuses: 0 };
  let sizeLimits = { ...XR_SPATIAL_WINDOW_SIZE_LIMITS, ...(options.sizeLimits || {}) };
  let viewportBounds = { ...XR_SPATIAL_WINDOW_VIEWPORT_BOUNDS, ...(options.viewportBounds || {}) };

  function emit(receipt) {
    receipts.push(receipt);
    if (receipts.length > RECEIPT_LOG_LIMIT) receipts.splice(0, receipts.length - RECEIPT_LOG_LIMIT);
    options.onReceipt?.(receipt);
    return receipt;
  }

  function shellReady() {
    return Boolean(adapter && THREE);
  }

  function getSupport() {
    return htmlCanvasRenderer.getSupport();
  }

  function computeFallback(windowEntry, textureRecord = null) {
    let mode = 'none';
    let source = 'html-in-canvas';
    let reason = null;
    if (!windowEntry.mounted && windowEntry.contentKind === 'dom') {
      mode = 'dom-overlay';
      source = 'unsupported';
      reason = 'dom-host-unavailable';
    } else if (windowEntry.contentKind === 'dom') {
      let support = getSupport();
      let supported = Boolean(support?.diagnostics?.supported || support?.supported);
      let failed = textureRecord && textureRecord.textureApplied === false;
      if (!supported || failed) {
        mode = shellReady() ? 'provider-material-fallback' : 'dom-overlay';
        source = 'provider-material-fallback';
        reason = textureRecord?.reason
          || textureRecord?.summary?.reason
          || support?.diagnostics?.recommendation
          || 'html-in-canvas-unsupported';
      }
    }
    let previous = windowEntry.fallback;
    let next = createXRSpatialWindowFallback({
      windowId: windowEntry.windowId,
      layoutId: windowEntry.layoutId,
      mode,
      source,
      reason,
      upload: textureRecord
        ? {
          uploaded: textureRecord.textureApplied === true,
          stage: textureRecord.stage || null,
          reason: textureRecord.reason || null,
        }
        : previous?.upload || null,
    });
    windowEntry.fallback = next;
    if (mode !== 'none' && (previous?.mode !== mode || previous?.reason !== reason)) {
      emit(next);
    }
    return next;
  }

  function buildPanelDescriptor(windowEntry, overrides = {}) {
    let size = overrides.sizeMeters || windowEntry.sizeMeters;
    let panel = {
      id: windowEntry.windowId,
      component: 'panel',
      title: windowEntry.title,
      position: [...windowEntry.pose.position],
      rotation: [...windowEntry.pose.rotation],
      size: [...size],
      xr: {
        position: [...windowEntry.pose.position],
        rotation: [...windowEntry.pose.rotation],
        size: [...size],
      },
      contentViewport: { ...(overrides.viewport || windowEntry.viewport) },
      textureKey: windowEntry.textureKey,
      closable: windowEntry.state.closable,
      pinned: windowEntry.state.pinned,
      state: { ...windowEntry.state },
    };
    let scope = windowEntry.themeScope || 'xr';
    let winSnapshot = themeSnapshotsByScope.get(scope) || (scope === 'xr' ? themeSnapshot : null);
    if (!winSnapshot) return panel;
    return applyXRThemeToPanel(
      windowEntry.material ? { ...panel, material: { ...windowEntry.material } } : panel,
      winSnapshot,
    );
  }

  function refreshWindowFrame(windowEntry, sizeMeters = windowEntry.sizeMeters) {
    let frame = createXRPanelFrame(buildPanelDescriptor(windowEntry, { sizeMeters }), {
      panelSizeMeters: sizeMeters,
      closable: windowEntry.state.closable,
    });
    windowEntry.frame = frame;
    windowEntry.chromeSurface = createXRSpatialWindowChromeSurface(frame.zones, sizeMeters);
    return frame;
  }

  function mountWindow(windowEntry) {
    if (windowEntry.mounted || windowEntry.contentKind !== 'dom') return windowEntry.mounted;
    if (!panelHost || !documentRef?.createElement) {
      computeFallback(windowEntry);
      return false;
    }
    let canvas = documentRef.createElement('canvas');
    canvas.classList?.add?.('sn-xr-window-canvas');
    if (canvas.dataset) canvas.dataset.windowId = windowEntry.windowId;
    canvas.width = windowEntry.viewport.width;
    canvas.height = windowEntry.viewport.height;
    let panel = {
      id: windowEntry.windowId,
      component: windowEntry.dom.component || 'section',
      layoutNode: windowEntry.dom.layoutNode || undefined,
      element: windowEntry.dom.element || undefined,
      state: windowEntry.dom.props || undefined,
      size: [...windowEntry.sizeMeters],
      contentViewport: { ...windowEntry.viewport },
      contentHash: windowEntry.contentHash,
      revision: windowEntry.contentRevision,
      hitMap: windowEntry.hitMap || undefined,
    };
    try {
      windowEntry.element = panelHost.mountPanel(panel, canvas);
    } catch {
      windowEntry.element = null;
      computeFallback(windowEntry);
      return false;
    }
    windowEntry.canvas = canvas;
    windowEntry.mounted = true;
    windowEntry.lifecycle.mounted = true;
    windowEntry.lifecycle.mounts += 1;
    windowEntry.dirty = true;
    computeFallback(windowEntry);
    return true;
  }

  function unmountWindow(windowEntry) {
    if (!windowEntry.mounted) return false;
    removePreviewPlane(windowEntry);
    panelHost?.unmountPanel?.(windowEntry.windowId);
    windowEntry.element = null;
    windowEntry.canvas = null;
    windowEntry.mounted = false;
    windowEntry.lifecycle.mounted = false;
    windowEntry.lifecycle.disposals += 1;
    return true;
  }

  function createWindowRecord(normalized, { poseProvided = true, batchExplicitPoses = [] } = {}) {
    let { layout } = normalized;
    let placement = null;
    let pose = layout.pose;
    if (!poseProvided) {
      let occupied = [...windows.values()].map((entry) => ({
        position: [...entry.pose.position],
        sizeMeters: [...entry.sizeMeters],
      }));
      occupied.push(...batchExplicitPoses.map((entry) => ({
        position: [...entry.position],
        sizeMeters: [...entry.sizeMeters],
      })));
      placement = resolveXRSpatialWindowDefaultPlacement({
        occupied,
        sizeMeters: layout.sizeMeters,
      });
      if (!placement.ok) {
        return {
          error: {
            reason: placement.reason,
            capacity: placement.capacity,
          },
        };
      }
      pose = placement.pose;
    }
    let scope = layout.themeScope || 'xr';
    let winSnapshot = themeSnapshotsByScope.get(scope) || (scope === 'xr' ? themeSnapshot : null);
    let initialMaterial = winSnapshot?.material ? { ...winSnapshot.material } : null;

    let windowEntry = {
      layoutId: layout.layoutId,
      windowId: layout.windowId,
      contentKind: layout.contentKind,
      title: layout.title,
      pose: clonePose(pose),
      sizeMeters: [...layout.sizeMeters],
      viewport: { ...layout.viewport },
      contentRevision: layout.contentRevision,
      themeRevision: layout.themeRevision,
      state: { ...layout.state },
      themeScope: layout.themeScope,
      contentHash: layout.contentHash,
      volumetric: layout.volumetric.map((entry) => ({ ...entry })),
      hitMap: normalized.hitMap || null,
      dom: { ...normalized.dom },
      material: initialMaterial,
      element: null,
      canvas: null,
      mounted: false,
      dirty: true,
      themeEpoch: 0,
      contentEpoch: 0,
      textureKey: null,
      upload: createWindowUploadState(),
      relay: { events: 0, actions: 0, lastReason: null, scrolls: 0, selections: 0 },
      contentFocus: null,
      resize: { phase: 'idle', session: null, previews: 0 },
      fallback: null,
      lifecycle: { mounted: false, mounts: 0, disposals: 0 },
      canonicalPose: clonePose(pose),
      defaultSlot: placement ? placement.slot : null,
      frame: null,
      chromeSurface: null,
    };
    windowEntry.textureKey = resolveXRSpatialWindowTextureKey(windowEntry);
    refreshWindowFrame(windowEntry);
    windowEntry.dirty = true;
    computeFallback(windowEntry);
    return { windowEntry };
  }

  function applyLayoutUpdate(windowEntry, normalized, { poseProvided = true } = {}) {
    let { layout } = normalized;
    if (!poseProvided) layout = { ...layout, pose: clonePose(windowEntry.pose) };
    let diff = diffXRSpatialWindowLayouts(buildDataProjection(windowEntry), layout);
    if (!diff.changed) return diff;
    windowEntry.contentKind = layout.contentKind;
    windowEntry.title = layout.title;
    windowEntry.pose = clonePose(layout.pose);
    if (poseProvided && diff.changes.includes('pose')) {
      // A supplied pose is authoritative: it becomes the reset canonical and
      // the window no longer claims a default slot.
      windowEntry.canonicalPose = clonePose(layout.pose);
      windowEntry.defaultSlot = null;
    }
    windowEntry.sizeMeters = [...layout.sizeMeters];
    windowEntry.viewport = { ...layout.viewport };
    windowEntry.state = { ...layout.state };
    let scopeChanged = layout.themeScope !== windowEntry.themeScope;
    windowEntry.themeScope = layout.themeScope;
    windowEntry.contentHash = layout.contentHash;
    windowEntry.volumetric = layout.volumetric.map((entry) => ({ ...entry }));
    if (normalized.hitMap) windowEntry.hitMap = normalized.hitMap;
    if (normalized.dom?.element) windowEntry.dom = { ...normalized.dom };
    let revisionChanged = layout.contentRevision !== windowEntry.contentRevision
      || layout.themeRevision !== windowEntry.themeRevision;
    let viewportChanged = diff.changes.includes('viewport');
    windowEntry.contentRevision = layout.contentRevision;
    windowEntry.themeRevision = layout.themeRevision;
    if (viewportChanged && windowEntry.mounted && panelHost) {
      panelHost.updatePanelViewport(windowEntry.windowId, windowEntry.viewport, {
        requestPaint: () => requestWindowPaint(windowEntry),
      });
    }
    if (revisionChanged || viewportChanged || scopeChanged) {
      if (scopeChanged || revisionChanged) {
        let scope = windowEntry.themeScope || 'xr';
        let winSnapshot = themeSnapshotsByScope.get(scope) || (scope === 'xr' ? themeSnapshot : null);
        windowEntry.material = winSnapshot?.material ? { ...winSnapshot.material } : null;
      }
      windowEntry.textureKey = resolveXRSpatialWindowTextureKey(windowEntry);
      windowEntry.dirty = true;
    }
    if (diff.changes.includes('sizeMeters')) {
      windowEntry.textureKey = resolveXRSpatialWindowTextureKey(windowEntry);
      windowEntry.dirty = true;
      refreshWindowFrame(windowEntry);
    }
    if (diff.changes.includes('pose')) {
      sceneSyncPending = true;
    }
    return diff;
  }

  function buildDataProjection(windowEntry) {
    return freezeSpatialValue({
      version: XR_SPATIAL_WINDOW_LAYOUT_VERSION,
      layoutId: windowEntry.layoutId,
      windowId: windowEntry.windowId,
      contentKind: windowEntry.contentKind,
      title: windowEntry.title,
      pose: clonePose(windowEntry.pose),
      sizeMeters: [...windowEntry.sizeMeters],
      viewport: { ...windowEntry.viewport },
      contentRevision: windowEntry.contentRevision,
      themeRevision: windowEntry.themeRevision,
      state: { ...windowEntry.state },
      themeScope: windowEntry.themeScope,
      contentHash: windowEntry.contentHash,
      volumetric: windowEntry.volumetric.map((entry) => ({ ...entry })),
    });
  }

  function projectScene() {
    let panels = [];
    for (let windowEntry of windows.values()) {
      if (windowEntry.state.hidden) continue;
      panels.push(buildPanelDescriptor(windowEntry));
    }
    let scene = createXRSpatialScene({ panels }, {
      adjustComfort: false,
      adjustFacing: false,
      themeScope: themeSnapshot?.themeScope || 'xr',
    });
    scene.panels = (scene.panels || []).map((panel) => {
      let windowEntry = windows.get(windowIds.get(panel.id));
      if (!windowEntry) return panel;
      return {
        ...panel,
        contentViewport: { ...windowEntry.viewport },
        textureKey: windowEntry.textureKey,
        title: windowEntry.title,
        closable: windowEntry.state.closable,
        pinned: windowEntry.state.pinned,
        ...(windowEntry.material ? { material: { ...windowEntry.material } } : (
          (() => {
            let scope = windowEntry.themeScope || 'xr';
            let snap = themeSnapshotsByScope.get(scope) || (scope === 'xr' ? themeSnapshot : null);
            return snap?.material ? { material: { ...snap.material } } : {};
          })()
        )),
      };
    });
    return scene;
  }

  function noteTextureOutcome(windowEntry, record) {
    if (!record) return null;
    windowEntry.upload.resolves += 1;
    let resolverRecord = textureResolver?.getState?.().records.find((entry) => (
      entry.panelId === windowEntry.windowId
    ));
    let stage = resolverRecord?.stage || record.stage || null;
    windowEntry.upload.panelId = windowEntry.windowId;
    windowEntry.upload.mode = resolverRecord?.mode || record.mode || 'webgl';
    windowEntry.upload.rendered = record.textureApplied === true;
    windowEntry.upload.uploaded = record.textureApplied === true;
    windowEntry.upload.canvasMatch = record.canvasMatch === true || resolverRecord?.canvasMatch === true || false;
    windowEntry.upload.signature = record.signature || resolverRecord?.signature || null;
    windowEntry.upload.reason = record.reason || resolverRecord?.reason || null;
    windowEntry.upload.errorName = record.errorName || resolverRecord?.errorName || null;
    if (typeof resolverRecord?.redrawCount === 'number') {
      windowEntry.upload.uploads = resolverRecord.redrawCount;
    } else if (record.textureApplied === true && !(stage && stage.endsWith('-reused'))) {
      windowEntry.upload.uploads += 1;
    }
    if (Number.isFinite(Number(resolverRecord?.width))) {
      windowEntry.upload.width = Number(resolverRecord.width);
    } else {
      windowEntry.upload.width = null;
    }
    if (Number.isFinite(Number(resolverRecord?.height))) {
      windowEntry.upload.height = Number(resolverRecord.height);
    } else {
      windowEntry.upload.height = null;
    }
    if (stage && stage.endsWith('-reused')) {
      windowEntry.upload.reuses += 1;
    }
    if (windowEntry.upload.uploaded) {
      windowEntry.dirty = false;
    }
    computeFallback(windowEntry, {
      textureApplied: record.textureApplied === true,
      stage,
      reason: windowEntry.upload.reason,
      summary: record.summary || null,
    });
    return resolverRecord || null;
  }

  function flushWindowTexture(windowEntry) {
    if (!shellReady() || status !== 'entered' || !textureBridge || !windowEntry.mounted) return null;
    let mesh = adapter.getPanelMesh(windowEntry.windowId);
    if (!mesh) return null;
    let record = textureBridge.applyPanelTexture(mesh, buildPanelDescriptor(windowEntry), {
      element: windowEntry.element,
      canvas: windowEntry.canvas,
      onInvalidate: () => markWindowContentChanged(windowEntry),
    });
    return noteTextureOutcome(windowEntry, record);
  }

  function requestWindowPaint(windowEntry) {
    return requestHtmlInCanvasPaint(windowEntry?.canvas || null) === true;
  }

  function markWindowContentChanged(windowEntry) {
    windowEntry.contentEpoch += 1;
    windowEntry.textureKey = resolveXRSpatialWindowTextureKey(windowEntry);
    windowEntry.dirty = true;
  }

  function flushSceneSync() {
    sceneSyncPending = false;
    if (!shellReady() || status !== 'entered') return null;
    let scene = projectScene();
    let result = adapter.setScene(scene, { textureBridge });
    for (let record of result?.textureSources || []) {
      let windowEntry = windows.get(windowIds.get(record.panelId));
      if (windowEntry) noteTextureOutcome(windowEntry, record);
    }
    applyMaterialStates();
    frameBaseline = currentUploadTotals();
    return result;
  }

  function currentUploadTotals() {
    let uploads = 0;
    let reuses = 0;
    for (let windowEntry of windows.values()) {
      uploads += windowEntry.upload.uploads;
      reuses += windowEntry.upload.reuses;
    }
    return { uploads, reuses };
  }

  function requestSceneSync() {
    sceneSyncPending = true;
  }

  function syncSceneIfNeeded() {
    if (sceneSyncPending) flushSceneSync();
  }

  function applyMaterialStates() {
    if (!shellReady()) return;
    let focused = [...windows.values()].find((windowEntry) => windowEntry.state.focused);
    for (let windowEntry of windows.values()) {
      let mesh = adapter.getPanelMesh(windowEntry.windowId);
      if (!mesh) continue;
      let scope = windowEntry.themeScope || 'xr';
      let snap = themeSnapshotsByScope.get(scope) || (scope === 'xr' ? themeSnapshot : null);
      try {
        updateXRThreePanelMaterialStates({
          adapter,
          meshes: [mesh],
          sessionState: { selectedPanelId: focused?.windowId || null },
          themeSnapshot: snap || undefined,
        });
      } catch {
        // Material visuals are best-effort chrome state; never fail a sync.
      }
    }
  }

  function portablePanelsFromRecords() {
    return [...windows.values()].map((windowEntry) => ({
      id: windowEntry.windowId,
      canonical: {
        position: [...windowEntry.canonicalPose.position],
        quaternion: eulerDegreesToXRQuaternion(windowEntry.canonicalPose.rotation),
        size: [...windowEntry.sizeMeters],
      },
      current: {
        position: [...windowEntry.pose.position],
        quaternion: eulerDegreesToXRQuaternion(windowEntry.pose.rotation),
        size: [...windowEntry.sizeMeters],
      },
      portable: true,
      pinned: windowEntry.state.pinned,
      focused: windowEntry.state.focused,
      revision: windowEntry.contentRevision,
      sourceMetadata: { layoutId: windowEntry.layoutId, contentKind: windowEntry.contentKind },
      ...(windowEntry.state.hidden ? { hidden: true } : {}),
    }));
  }

  function serializePoseSnapshot() {
    let store = createXRPortablePanelStore(portablePanelsFromRecords());
    return store.serialize();
  }

  function restorePoseSnapshot() {
    portableStore = createXRPortablePanelStore(portablePanelsFromRecords());
    if (!poseSnapshot) {
      return { restored: false, reason: 'no-pose-snapshot' };
    }
    try {
      portableStore.restore(poseSnapshot);
    } catch (error) {
      return { restored: false, reason: error?.message || 'pose-snapshot-rejected' };
    }
    let snapshot = portableStore.getSnapshot();
    for (let panel of snapshot.panels) {
      let windowEntry = windows.get(windowIds.get(panel.id));
      if (!windowEntry) continue;
      windowEntry.pose = {
        position: [...panel.current.position],
        rotation: xrQuaternionToEulerDegrees(panel.current.quaternion),
      };
      refreshWindowFrame(windowEntry);
    }
    return { restored: true, reason: null };
  }

  function adoptSessionInternal(sessionId) {
    let poseRestore = restorePoseSnapshot();
    adoptedSession = { sessionId };
    return poseRestore;
  }

  function syncLayouts(layouts = [], syncOptions = {}) {
    if (disposed) {
      return createXRSpatialWindowSyncReceipt({ ok: false, sequence: syncSequence, errors: [{ reason: 'assembly-disposed' }] });
    }
    syncSequence += 1;
    let added = [];
    let updated = [];
    let removed = [];
    let unchanged = [];
    let entries = [];
    let errors = [];
    let seen = new Set();
    let prepared = [];
    let structuralChange = false;
    let textureOnlyUpdates = new Set();

    for (let input of Array.isArray(layouts) ? layouts : []) {
      let normalized = normalizeXRSpatialWindowLayout(input);
      if (!normalized.ok) {
        errors.push({ layoutId: normalized.layoutId, reason: normalized.reason });
        continue;
      }
      let { layout } = normalized;
      if (seen.has(layout.layoutId)) {
        errors.push({ layoutId: layout.layoutId, reason: 'duplicate-layout-id' });
        continue;
      }
      seen.add(layout.layoutId);
      let existing = windows.get(layout.layoutId);
      if (existing && existing.windowId !== layout.windowId) {
        errors.push({ layoutId: layout.layoutId, reason: 'window-id-conflict' });
        continue;
      }
      prepared.push({ normalized, poseProvided: input.pose != null, existing });
    }

    // Explicit descriptor poses are authoritative: every default placement in
    // this batch resolves against all of them first, so input ordering can
    // never put a default window on an explicit descriptor's pose.
    let batchExplicitPoses = prepared
      .filter((entry) => entry.poseProvided)
      .map((entry) => ({
        position: [...entry.normalized.layout.pose.position],
        sizeMeters: [...entry.normalized.layout.sizeMeters],
      }));

    for (let { normalized, poseProvided, existing } of prepared) {
      let { layout } = normalized;
      if (!existing) {
        let record = createWindowRecord(normalized, { poseProvided, batchExplicitPoses });
        if (record.error) {
          errors.push({ layoutId: layout.layoutId, ...record.error });
          continue;
        }
        let windowEntry = record.windowEntry;
        windows.set(layout.layoutId, windowEntry);
        windowIds.set(layout.windowId, layout.layoutId);
        mountWindow(windowEntry);
        added.push(layout.windowId);
        entries.push({
          layoutId: layout.layoutId,
          windowId: layout.windowId,
          action: 'added',
          changes: [],
          contentRevision: windowEntry.contentRevision,
          themeRevision: windowEntry.themeRevision,
        });
        structuralChange = true;
        continue;
      }
      let diff = applyLayoutUpdate(existing, normalized, { poseProvided });
      if (!diff.changed) {
        unchanged.push(layout.windowId);
        entries.push({
          layoutId: layout.layoutId,
          windowId: layout.windowId,
          action: 'unchanged',
          changes: [],
          contentRevision: existing.contentRevision,
          themeRevision: existing.themeRevision,
        });
        continue;
      }
      updated.push(layout.windowId);
      entries.push({
        layoutId: layout.layoutId,
        windowId: layout.windowId,
        action: 'updated',
        changes: diff.changes,
        contentRevision: existing.contentRevision,
        themeRevision: existing.themeRevision,
      });
      let textureOnly = diff.changes.every((field) => (
        field === 'contentRevision'
        || field === 'contentHash'
        || field === 'themeRevision'
      ));
      if (textureOnly) {
        textureOnlyUpdates.add(layout.windowId);
      } else {
        structuralChange = true;
      }
    }

    for (let [layoutId, windowEntry] of [...windows.entries()]) {
      if (seen.has(layoutId)) continue;
      unmountWindow(windowEntry);
      windows.delete(layoutId);
      windowIds.delete(windowEntry.windowId);
      removed.push(windowEntry.windowId);
      entries.push({
        layoutId,
        windowId: windowEntry.windowId,
        action: 'removed',
        changes: [],
        contentRevision: windowEntry.contentRevision,
        themeRevision: windowEntry.themeRevision,
      });
      structuralChange = true;
      if (activeGesture?.windowId === windowEntry.windowId) activeGesture = null;
    }

    if (structuralChange) requestSceneSync();
    syncSceneIfNeeded();
    if (!structuralChange && status === 'entered') {
      for (let windowId of textureOnlyUpdates) {
        let windowEntry = windows.get(windowIds.get(windowId));
        if (windowEntry?.dirty && windowEntry.mounted) flushWindowTexture(windowEntry);
      }
      if (textureOnlyUpdates.size) applyMaterialStates();
      frameBaseline = currentUploadTotals();
    }
    let focusedLayout = [...windows.values()].find((windowEntry) => windowEntry.state.focused);
    if (focusedLayout) applyFocus(focusedLayout, null);
    return emit(createXRSpatialWindowSyncReceipt({
      ok: errors.length === 0,
      sequence: syncSequence,
      added,
      updated,
      removed,
      unchanged,
      windows: entries,
      errors,
      entered: status === 'entered',
      sceneSynced: structuralChange && status === 'entered' && shellReady(),
    }));
  }

  function enter(enterOptions = {}) {
    if (disposed) {
      return emit(createXRSpatialWindowLifecycleReceipt('enter', { ok: false, reason: 'assembly-disposed' }));
    }
    if (status === 'entered') {
      return emit(createXRSpatialWindowLifecycleReceipt('enter', {
        ok: true,
        details: {
          entered: true,
          alreadyEntered: true,
          windowCount: windows.size,
          sessionId: adoptedSession?.sessionId || null,
          poseRestore: { restored: false, reason: 'already-entered' },
        },
      }));
    }
    let sessionId = enterOptions.sessionId || adoptedSession?.sessionId || `session:${++sessionCounter}`;
    let poseRestore = adoptSessionInternal(sessionId);
    for (let windowEntry of windows.values()) {
      if (!windowEntry.mounted) mountWindow(windowEntry);
    }
    status = 'entered';
    sessionStats.entries += 1;
    requestSceneSync();
    flushSceneSync();
    return emit(createXRSpatialWindowLifecycleReceipt('enter', {
      ok: true,
      details: {
        entered: true,
        alreadyEntered: false,
        windowCount: windows.size,
        sessionId,
        poseRestore,
      },
    }));
  }

  function exit() {
    if (status !== 'entered') {
      return emit(createXRSpatialWindowLifecycleReceipt('exit', {
        ok: true,
        reason: 'not-entered',
        details: { exited: false, windowCount: windows.size },
      }));
    }
    poseSnapshot = serializePoseSnapshot();
    portableStore = null;
    adoptedSession = null;
    status = 'idle';
    sessionStats.exits += 1;
    if (shellReady()) adapter.setScene({ panels: [] }, { textureBridge });
    return emit(createXRSpatialWindowLifecycleReceipt('exit', {
      ok: true,
      details: {
        exited: true,
        windowCount: windows.size,
        poseSnapshotVersion: poseSnapshot.version,
      },
    }));
  }

  function adoptSession(adoptOptions = {}) {
    if (disposed) {
      return emit(createXRSpatialWindowLifecycleReceipt('adopt-session', { ok: false, reason: 'assembly-disposed' }));
    }
    let sessionId = adoptOptions.sessionId || `session:${++sessionCounter}`;
    if (adoptedSession && adoptedSession.sessionId === sessionId) {
      return emit(createXRSpatialWindowLifecycleReceipt('adopt-session', {
        ok: true,
        details: { sessionId, alreadyAdopted: true, poseRestore: { restored: false, reason: 'already-adopted' } },
      }));
    }
    let poseRestore = adoptSessionInternal(sessionId);
    return emit(createXRSpatialWindowLifecycleReceipt('adopt-session', {
      ok: true,
      details: { sessionId, alreadyAdopted: false, poseRestore },
    }));
  }

  function releaseSession() {
    if (!adoptedSession) {
      return emit(createXRSpatialWindowLifecycleReceipt('release-session', {
        ok: true,
        reason: 'no-adopted-session',
        details: { released: false },
      }));
    }
    poseSnapshot = serializePoseSnapshot();
    portableStore = null;
    adoptedSession = null;
    return emit(createXRSpatialWindowLifecycleReceipt('release-session', {
      ok: true,
      details: { released: true, poseSnapshot },
    }));
  }

  function applyFocus(windowEntry, previousWindowId) {
    for (let other of windows.values()) {
      other.state.focused = other === windowEntry;
    }
    if (windowEntry.mounted) panelHost?.focusPanel?.(windowEntry.windowId);
    applyMaterialStates();
  }

  function focusWindow(windowId) {
    let windowEntry = windows.get(windowIds.get(windowId));
    if (!windowEntry) {
      return emit(createXRSpatialWindowLifecycleReceipt('focus', {
        ok: false,
        reason: 'window-not-found',
        windowId,
      }));
    }
    let previous = [...windows.values()].find((entry) => entry.state.focused && entry !== windowEntry);
    applyFocus(windowEntry, previous?.windowId || null);
    return emit(createXRSpatialWindowLifecycleReceipt('focus', {
      ok: true,
      windowId,
      layoutId: windowEntry.layoutId,
      details: { focused: true, previousFocusedWindowId: previous?.windowId || null },
    }));
  }

  function emitFocusReceipt(action, windowId, hostResult, request = {}) {
    let windowEntry = windowId ? windows.get(windowIds.get(windowId)) : null;
    if (hostResult.ok && hostResult.ime) {
      windowEntry.contentFocus = {
        targetId: hostResult.target?.targetId || null,
        editable: hostResult.target?.editable === true,
        imeMode: hostResult.ime.mode,
      };
      focusStats.handoffs += 1;
    } else if (hostResult.ok && action !== 'content-focus') {
      windowEntry.contentFocus = null;
    }
    return emit(createXRSpatialWindowFocusReceipt(action, {
      ok: hostResult.ok,
      reason: hostResult.reason || null,
      windowId: windowEntry?.windowId ?? windowId,
      layoutId: windowEntry?.layoutId ?? null,
      target: hostResult.target || null,
      focused: hostResult.focused ?? null,
      ime: hostResult.ime || null,
      releasedCapture: hostResult.releasedCapture || null,
      source: request.source || null,
    }));
  }

  function focusWindowContent(windowId, request = {}) {
    let windowEntry = windows.get(windowIds.get(windowId));
    if (!windowEntry) {
      return emitFocusReceipt('content-focus', windowId, { ok: false, reason: 'window-not-found' }, request);
    }
    if (!panelHost || !windowEntry.mounted) {
      return emitFocusReceipt('content-focus', windowId, { ok: false, reason: 'panel-host-unavailable' }, request);
    }
    let hostResult = panelHost.focusContent(windowEntry.windowId, {
      target: request.target,
      targetId: request.targetId,
      element: request.element,
      sourceId: request.sourceId || null,
      sessionId: request.sessionId || adoptedSession?.sessionId || null,
    });
    return emitFocusReceipt('content-focus', windowId, hostResult, request);
  }

  function blurWindowContent(windowId, request = {}) {
    let windowEntry = windows.get(windowIds.get(windowId));
    if (!windowEntry) {
      return emitFocusReceipt('content-blur', windowId, { ok: false, reason: 'window-not-found' }, request);
    }
    if (!panelHost || !windowEntry.mounted) {
      return emitFocusReceipt('content-blur', windowId, { ok: false, reason: 'panel-host-unavailable' }, request);
    }
    let hostResult = panelHost.blurContent(windowEntry.windowId);
    return emitFocusReceipt('content-blur', windowId, hostResult, request);
  }

  function cancelWindowContentFocus(windowId, request = {}) {
    let windowEntry = windows.get(windowIds.get(windowId));
    if (!windowEntry) {
      return emitFocusReceipt('content-focus-cancel', windowId, { ok: false, reason: 'window-not-found' }, request);
    }
    if (!panelHost || !windowEntry.mounted) {
      return emitFocusReceipt('content-focus-cancel', windowId, { ok: false, reason: 'panel-host-unavailable' }, request);
    }
    let hostResult = panelHost.cancelContentFocus(windowEntry.windowId, {
      sourceId: request.sourceId || null,
    });
    return emitFocusReceipt('content-focus-cancel', windowId, hostResult, request);
  }

  function applyWindowTextureAndGeometry(windowEntry, sizeMeters) {
    let texture = { uploaded: false, stage: 'native-shell-absent', reason: null, width: null, height: null };
    let mesh = shellReady() && status === 'entered' ? adapter.getPanelMesh(windowEntry.windowId) : null;
    if (mesh && textureBridge && windowEntry.mounted) {
      let record = textureBridge.applyPanelTexture(mesh, buildPanelDescriptor(windowEntry), {
        element: windowEntry.element,
        canvas: windowEntry.canvas,
        onInvalidate: () => markWindowContentChanged(windowEntry),
      });
      let resolverRecord = noteTextureOutcome(windowEntry, record);
      texture = {
        uploaded: record.textureApplied === true,
        stage: record.stage || null,
        reason: record.reason || null,
        width: Number.isFinite(Number(resolverRecord?.width)) ? Number(resolverRecord.width) : null,
        height: Number.isFinite(Number(resolverRecord?.height)) ? Number(resolverRecord.height) : null,
      };
    }
    let geometrySwapped = false;
    if (mesh && sizeMeters && texture.uploaded && typeof adapter.setPanelSize === 'function') {
      let sizeResult = adapter.setPanelSize(windowEntry.windowId, sizeMeters);
      geometrySwapped = sizeResult?.ok === true;
    }
    return { texture, geometrySwapped, mesh };
  }

  function updateWindowViewport(windowId, input = {}) {
    if (disposed) {
      return emit(createXRSpatialWindowViewportReceipt({ ok: false, reason: 'assembly-disposed', windowId }));
    }
    let windowEntry = windows.get(windowIds.get(windowId));
    if (!windowEntry) {
      return emit(createXRSpatialWindowViewportReceipt({ ok: false, reason: 'window-not-found', windowId }));
    }
    let width = Number(input.viewport?.width);
    let height = Number(input.viewport?.height);
    let viewportValid = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
      && width >= viewportBounds.minWidth && width <= viewportBounds.maxWidth
      && height >= viewportBounds.minHeight && height <= viewportBounds.maxHeight;
    if (!viewportValid) {
      return emit(createXRSpatialWindowViewportReceipt({
        ok: false,
        reason: 'invalid-viewport',
        windowId,
        layoutId: windowEntry.layoutId,
      }));
    }
    let nextViewport = { width: Math.round(width), height: Math.round(height) };
    let nextSize = null;
    if (input.sizeMeters != null) {
      nextSize = clampXRSpatialWindowSize(input.sizeMeters, sizeLimits);
      if (!nextSize) {
        return emit(createXRSpatialWindowViewportReceipt({
          ok: false,
          reason: 'invalid-size',
          windowId,
          layoutId: windowEntry.layoutId,
        }));
      }
    }
    if (windowEntry.mounted && !panelHost) {
      return emit(createXRSpatialWindowViewportReceipt({
        ok: false,
        reason: 'panel-host-unavailable',
        windowId,
        layoutId: windowEntry.layoutId,
      }));
    }
    let previousViewport = { ...windowEntry.viewport };
    let previousSize = [...windowEntry.sizeMeters];
    let hostResult = { ok: true, preserved: null, remounted: false, paintRequested: false };
    if (windowEntry.mounted) {
      hostResult = panelHost.updatePanelViewport(windowEntry.windowId, nextViewport, {
        sizeMeters: nextSize || undefined,
        requestPaint: () => requestWindowPaint(windowEntry),
      });
      if (!hostResult.ok) {
        return emit(createXRSpatialWindowViewportReceipt({
          ok: false,
          reason: hostResult.reason || 'viewport-update-failed',
          windowId,
          layoutId: windowEntry.layoutId,
        }));
      }
    }
    windowEntry.viewport = nextViewport;
    if (nextSize) {
      windowEntry.sizeMeters = nextSize;
    }
    windowEntry.textureKey = resolveXRSpatialWindowTextureKey(windowEntry);
    windowEntry.dirty = true;
    if (nextSize) refreshWindowFrame(windowEntry, nextSize);

    let { texture } = applyWindowTextureAndGeometry(windowEntry, nextSize);
    if (texture.stage !== 'native-shell-absent' && !texture.uploaded) {
      if (windowEntry.mounted) {
        panelHost.updatePanelViewport(windowEntry.windowId, previousViewport, {
          sizeMeters: previousSize,
        });
      }
      windowEntry.viewport = previousViewport;
      windowEntry.sizeMeters = previousSize;
      windowEntry.textureKey = resolveXRSpatialWindowTextureKey(windowEntry);
      refreshWindowFrame(windowEntry, previousSize);
      computeFallback(windowEntry, {
        textureApplied: false,
        stage: texture.stage,
        reason: texture.reason,
      });
      return emit(createXRSpatialWindowViewportReceipt({
        ok: false,
        reason: texture.reason || 'texture-upload-failed',
        windowId,
        layoutId: windowEntry.layoutId,
        viewport: previousViewport,
        previousViewport: nextViewport,
        sizeMeters: [...windowEntry.sizeMeters],
        preserved: hostResult.preserved || null,
        remounted: false,
        rolledBack: true,
        paintRequested: hostResult.paintRequested === true,
        texture,
      }));
    }
    windowEntry.dirty = !texture.uploaded && texture.stage !== 'native-shell-absent';
    applyMaterialStates();
    viewportStats.updates += 1;
    return emit(createXRSpatialWindowViewportReceipt({
      ok: true,
      windowId,
      layoutId: windowEntry.layoutId,
      viewport: nextViewport,
      previousViewport,
      sizeMeters: [...windowEntry.sizeMeters],
      preserved: hostResult.preserved || null,
      remounted: false,
      rolledBack: false,
      paintRequested: hostResult.paintRequested === true,
      texture,
    }));
  }

  function settleWindowPose(windowId, pose = {}) {
    let windowEntry = windows.get(windowIds.get(windowId));
    if (!windowEntry) {
      return emit(createXRSpatialWindowLifecycleReceipt('move', {
        ok: false,
        reason: 'window-not-found',
        windowId,
      }));
    }
    if (!isVector(pose.position, 3) || !isVector(pose.rotation, 3)) {
      return emit(createXRSpatialWindowLifecycleReceipt('move', {
        ok: false,
        reason: 'invalid-pose',
        windowId,
      }));
    }
    windowEntry.pose = { position: pose.position.map(Number), rotation: pose.rotation.map(Number) };
    refreshWindowFrame(windowEntry);
    requestSceneSync();
    syncSceneIfNeeded();
    activeGesture = null;
    return emit(createXRSpatialWindowLifecycleReceipt('move', {
      ok: true,
      windowId,
      layoutId: windowEntry.layoutId,
      details: { pose: clonePose(windowEntry.pose) },
    }));
  }

  // Transactional reset target: restore the canonical pose while it is
  // currently free, otherwise re-resolve the lowest safe default slot against
  // the other live windows, otherwise report structured failure. Nothing is
  // mutated before a safe target is known, so a reset can never overlap a
  // live window.
  function resolveResetTarget(windowEntry) {
    let occupied = [...windows.values()]
      .filter((entry) => entry !== windowEntry)
      .map((entry) => ({
        position: [...entry.pose.position],
        sizeMeters: [...entry.sizeMeters],
      }));
    let canonicalFree = windowEntry.canonicalPose
      && !occupied.some((entry) => xrSpatialWindowSlotBlocked(windowEntry.canonicalPose, windowEntry.sizeMeters, entry));
    if (canonicalFree) {
      return { ok: true, pose: clonePose(windowEntry.canonicalPose), slot: windowEntry.defaultSlot, source: 'canonical' };
    }
    let placement = resolveXRSpatialWindowDefaultPlacement({
      occupied,
      sizeMeters: windowEntry.sizeMeters,
    });
    if (placement.ok) {
      return { ok: true, pose: clonePose(placement.pose), slot: placement.slot, source: 're-resolved' };
    }
    return { ok: false, reason: placement.reason || 'placement-capacity-exhausted' };
  }

  function applyResetTarget(windowEntry, target) {
    windowEntry.pose = clonePose(target.pose);
    windowEntry.canonicalPose = clonePose(target.pose);
    windowEntry.defaultSlot = target.slot;
    refreshWindowFrame(windowEntry);
    requestSceneSync();
    syncSceneIfNeeded();
  }

  function resetWindowPose(windowId) {
    let windowEntry = windows.get(windowIds.get(windowId));
    if (!windowEntry) {
      return emit(createXRSpatialWindowLifecycleReceipt('reset', {
        ok: false,
        reason: 'window-not-found',
        windowId,
      }));
    }
    let target = resolveResetTarget(windowEntry);
    if (!target.ok) {
      return emit(createXRSpatialWindowLifecycleReceipt('reset', {
        ok: false,
        reason: target.reason,
        windowId,
        layoutId: windowEntry.layoutId,
      }));
    }
    applyResetTarget(windowEntry, target);
    return emit(createXRSpatialWindowLifecycleReceipt('reset', {
      ok: true,
      windowId,
      layoutId: windowEntry.layoutId,
      details: { pose: clonePose(windowEntry.pose), source: target.source },
    }));
  }

  function resolvePreviewColor(windowEntry) {
    return xrDesignTokenColorNumber(
      windowEntry.material?.threeColor
      || windowEntry.material?.backgroundColor
      || themeTokens.colors?.surfacePanel,
    ) ?? 0x22262c;
  }

  function createPreviewMaterial(windowEntry, opacity = 0.9) {
    let color = resolvePreviewColor(windowEntry);
    return typeof THREE.MeshBasicMaterial === 'function'
      ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color });
  }

  function removePreviewMasks(mesh) {
    for (let mask of [...(mesh?.children || [])].filter((child) => child.name?.startsWith('sn-xr-window-resize-mask-'))) {
      mesh.remove?.(mask);
      mask.geometry?.dispose?.();
      mask.material?.dispose?.();
    }
  }

  function ensurePreviewPlane(windowEntry, sizeMeters) {
    let mesh = adapter?.getPanelMesh?.(windowEntry.windowId);
    if (!mesh || !THREE?.Mesh || !THREE?.PlaneGeometry) return null;
    removePreviewMasks(mesh);
    let plane = mesh.children?.find((child) => child.name === 'sn-xr-window-resize-preview');
    if (!plane) {
      plane = new THREE.Mesh(new THREE.PlaneGeometry(sizeMeters[0], sizeMeters[1]), createPreviewMaterial(windowEntry));
      plane.name = 'sn-xr-window-resize-preview';
      plane.userData = { kind: 'window-resize-preview', panelId: windowEntry.windowId };
      plane.position?.set?.(0, 0, -0.002);
      mesh.add?.(plane);
    } else {
      plane.geometry?.dispose?.();
      plane.geometry = new THREE.PlaneGeometry(sizeMeters[0], sizeMeters[1]);
      plane.material?.color?.setHex?.(resolvePreviewColor(windowEntry));
    }

    let committedWidth = windowEntry.sizeMeters[0];
    let committedHeight = windowEntry.sizeMeters[1];
    let visibleWidth = Math.min(committedWidth, sizeMeters[0]);
    let visibleHeight = Math.min(committedHeight, sizeMeters[1]);
    let masks = [
      ['left', (committedWidth - visibleWidth) / 2, committedHeight, -(visibleWidth + committedWidth) / 4, 0],
      ['right', (committedWidth - visibleWidth) / 2, committedHeight, (visibleWidth + committedWidth) / 4, 0],
      ['top', visibleWidth, (committedHeight - visibleHeight) / 2, 0, (visibleHeight + committedHeight) / 4],
      ['bottom', visibleWidth, (committedHeight - visibleHeight) / 2, 0, -(visibleHeight + committedHeight) / 4],
    ];
    for (let [name, width, height, x, y] of masks) {
      if (width <= 0 || height <= 0) continue;
      let mask = new THREE.Mesh(new THREE.PlaneGeometry(width, height), createPreviewMaterial(windowEntry, 1));
      mask.name = `sn-xr-window-resize-mask-${name}`;
      mask.userData = { kind: 'window-resize-mask', panelId: windowEntry.windowId };
      mask.position?.set?.(x, y, 0.002);
      mesh.add?.(mask);
    }
    return plane;
  }

  function removePreviewPlane(windowEntry) {
    let mesh = adapter?.getPanelMesh?.(windowEntry.windowId);
    let plane = mesh?.children?.find((child) => child.name === 'sn-xr-window-resize-preview');
    if (mesh && plane) {
      mesh.remove?.(plane);
      plane.geometry?.dispose?.();
      plane.material?.dispose?.();
    }
    removePreviewMasks(mesh);
    return Boolean(plane);
  }

  function beginResize(windowId, beginOptions = {}) {
    let windowEntry = windows.get(windowIds.get(windowId));
    if (!windowEntry) {
      return emit(createXRSpatialWindowResizeReceipt('begin', {
        ok: false,
        reason: 'window-not-found',
        windowId,
      }));
    }
    if (windowEntry.resize.phase !== 'idle') {
      return emit(createXRSpatialWindowResizeReceipt('begin', {
        ok: false,
        reason: 'resize-already-active',
        windowId,
        layoutId: windowEntry.layoutId,
      }));
    }
    let handle = String(beginOptions.handle || 'southEast');
    if (!RESIZE_HANDLE_PATTERN.test(handle)) {
      return emit(createXRSpatialWindowResizeReceipt('begin', {
        ok: false,
        reason: 'invalid-resize-handle',
        windowId,
        layoutId: windowEntry.layoutId,
      }));
    }
    windowEntry.resize = {
      phase: 'preview',
      previews: windowEntry.resize.previews,
      session: {
        handle,
        committedSizeMeters: [...windowEntry.sizeMeters],
        committedViewport: { ...windowEntry.viewport },
        targetSizeMeters: [...windowEntry.sizeMeters],
      },
    };
    activeGesture = { windowId, operation: 'resize', handle };
    return emit(createXRSpatialWindowResizeReceipt('begin', {
      ok: true,
      windowId,
      layoutId: windowEntry.layoutId,
      handle,
      committedSizeMeters: windowEntry.resize.session.committedSizeMeters,
      sizeMeters: [...windowEntry.sizeMeters],
      viewport: { ...windowEntry.viewport },
    }));
  }

  function previewResize(windowId, sizeMeters) {
    let windowEntry = windows.get(windowIds.get(windowId));
    if (!windowEntry) {
      return createXRSpatialWindowResizeReceipt('preview', {
        ok: false,
        reason: 'window-not-found',
        windowId,
      });
    }
    let session = windowEntry.resize.session;
    if (windowEntry.resize.phase !== 'preview' || !session) {
      return createXRSpatialWindowResizeReceipt('preview', {
        ok: false,
        reason: 'resize-not-active',
        windowId,
        layoutId: windowEntry.layoutId,
      });
    }
    let clamped = clampXRSpatialWindowSize(sizeMeters, sizeLimits);
    if (!clamped) {
      return createXRSpatialWindowResizeReceipt('preview', {
        ok: false,
        reason: 'invalid-size',
        windowId,
        layoutId: windowEntry.layoutId,
      });
    }
    session.targetSizeMeters = clamped;
    windowEntry.resize.previews += 1;
    ensurePreviewPlane(windowEntry, clamped);
    resizeStats.previews += 1;
    return createXRSpatialWindowResizeReceipt('preview', {
      ok: true,
      windowId,
      layoutId: windowEntry.layoutId,
      handle: session.handle,
      committedSizeMeters: [...session.committedSizeMeters],
      previewSizeMeters: clamped,
      contentScaled: false,
    });
  }

  async function commitResize(windowId) {
    let windowEntry = windows.get(windowIds.get(windowId));
    if (!windowEntry) {
      return emit(createXRSpatialWindowResizeReceipt('commit', {
        ok: false,
        reason: 'window-not-found',
        windowId,
      }));
    }
    let session = windowEntry.resize.session;
    if (windowEntry.resize.phase !== 'preview' || !session) {
      return emit(createXRSpatialWindowResizeReceipt('commit', {
        ok: false,
        reason: 'resize-not-active',
        windowId,
        layoutId: windowEntry.layoutId,
      }));
    }
    let targetSize = [...session.targetSizeMeters];
    let targetViewport = resolveXRSpatialWindowCommitViewport(
      session.committedViewport,
      session.committedSizeMeters,
      targetSize,
      viewportBounds,
    );
    function restoreCommittedViewport() {
      if (!windowEntry.mounted || !panelHost) return { ok: true, reason: null };
      try {
        let result = panelHost.updatePanelViewport(windowEntry.windowId, session.committedViewport, {
          sizeMeters: [...session.committedSizeMeters],
        });
        return result?.ok
          ? { ok: true, reason: null }
          : { ok: false, reason: result?.reason || 'viewport-restore-rejected' };
      } catch (error) {
        return { ok: false, reason: error?.message || 'viewport-restore-threw' };
      }
    }

    let hostResult = { ok: true };
    if (windowEntry.mounted && panelHost) {
      try {
        hostResult = panelHost.updatePanelViewport(windowEntry.windowId, targetViewport, {
          sizeMeters: targetSize,
          requestPaint: () => requestWindowPaint(windowEntry),
        });
      } catch (error) {
        hostResult = { ok: false, reason: error?.message || 'viewport-update-failed' };
      }
      if (!hostResult?.ok) {
        let restoration = restoreCommittedViewport();
        removePreviewPlane(windowEntry);
        windowEntry.resize = { phase: 'idle', session: null, previews: windowEntry.resize.previews };
        resizeStats.cancels += 1;
        activeGesture = null;
        return emit(createXRSpatialWindowResizeReceipt('commit', {
          ok: false,
          reason: restoration.ok
            ? hostResult?.reason || 'viewport-update-failed'
            : `${hostResult?.reason || 'viewport-update-failed'}:rollback-failed:${restoration.reason}`,
          windowId,
          layoutId: windowEntry.layoutId,
          handle: session.handle,
          committedSizeMeters: [...session.committedSizeMeters],
          sizeMeters: [...windowEntry.sizeMeters],
          viewport: { ...windowEntry.viewport },
          rolledBack: restoration.ok,
          geometrySwapped: false,
        }));
      }
    }

    removePreviewPlane(windowEntry);
    let previousViewport = windowEntry.viewport;
    let previousSize = windowEntry.sizeMeters;
    windowEntry.viewport = targetViewport;
    windowEntry.sizeMeters = targetSize;
    windowEntry.textureKey = resolveXRSpatialWindowTextureKey(windowEntry);
    windowEntry.dirty = true;

    let { texture, geometrySwapped, mesh } = applyWindowTextureAndGeometry(windowEntry, targetSize);

    if (mesh && !texture.uploaded) {
      let restoration = restoreCommittedViewport();
      windowEntry.viewport = previousViewport;
      windowEntry.sizeMeters = previousSize;
      windowEntry.textureKey = resolveXRSpatialWindowTextureKey(windowEntry);
      refreshWindowFrame(windowEntry, previousSize);
      windowEntry.resize = { phase: 'idle', session: null, previews: windowEntry.resize.previews };
      resizeStats.cancels += 1;
      activeGesture = null;
      return emit(createXRSpatialWindowResizeReceipt('commit', {
        ok: false,
        reason: restoration.ok
          ? texture.reason || 'texture-upload-failed'
          : `${texture.reason || 'texture-upload-failed'}:rollback-failed:${restoration.reason}`,
        windowId,
        layoutId: windowEntry.layoutId,
        handle: session.handle,
        committedSizeMeters: [...session.committedSizeMeters],
        sizeMeters: [...windowEntry.sizeMeters],
        viewport: { ...windowEntry.viewport },
        texture,
        rolledBack: restoration.ok,
        geometrySwapped: false,
      }));
    }

    windowEntry.dirty = !texture.uploaded && texture.stage !== 'native-shell-absent';
    refreshWindowFrame(windowEntry, targetSize);
    windowEntry.resize = { phase: 'idle', session: null, previews: windowEntry.resize.previews };
    resizeStats.commits += 1;
    activeGesture = null;
    applyMaterialStates();
    return emit(createXRSpatialWindowResizeReceipt('commit', {
      ok: true,
      windowId,
      layoutId: windowEntry.layoutId,
      handle: session.handle,
      committedSizeMeters: [...session.committedSizeMeters],
      sizeMeters: targetSize,
      viewport: targetViewport,
      texture,
      geometrySwapped,
    }));
  }

  function cancelResize(windowId) {
    let windowEntry = windows.get(windowIds.get(windowId));
    if (!windowEntry) {
      return emit(createXRSpatialWindowResizeReceipt('cancel', {
        ok: false,
        reason: 'window-not-found',
        windowId,
      }));
    }
    let session = windowEntry.resize.session;
    if (windowEntry.resize.phase !== 'preview' || !session) {
      return emit(createXRSpatialWindowResizeReceipt('cancel', {
        ok: false,
        reason: 'resize-not-active',
        windowId,
        layoutId: windowEntry.layoutId,
      }));
    }
    removePreviewPlane(windowEntry);
    windowEntry.resize = { phase: 'idle', session: null, previews: windowEntry.resize.previews };
    resizeStats.cancels += 1;
    activeGesture = null;
    return emit(createXRSpatialWindowResizeReceipt('cancel', {
      ok: true,
      windowId,
      layoutId: windowEntry.layoutId,
      handle: session.handle,
      committedSizeMeters: [...session.committedSizeMeters],
      sizeMeters: [...windowEntry.sizeMeters],
      viewport: { ...windowEntry.viewport },
    }));
  }

  function rayPanels() {
    let panels = [];
    for (let windowEntry of windows.values()) {
      if (windowEntry.state.hidden) continue;
      panels.push({
        id: windowEntry.windowId,
        position: [...windowEntry.pose.position],
        rotation: [...windowEntry.pose.rotation],
        size: [...windowEntry.chromeSurface.sizeMeters],
      });
    }
    return panels;
  }

  function framePointFor(windowEntry, point) {
    let [surfaceWidth, surfaceHeight] = windowEntry.chromeSurface.sizeMeters;
    let { x: extentX, y: extentY } = windowEntry.chromeSurface.extents;
    let [width, height] = windowEntry.sizeMeters;
    return {
      x: (point.x * surfaceWidth - extentX) / width,
      y: (point.y * surfaceHeight - extentY) / height,
    };
  }

  function handleChromeTarget(windowEntry, target, input) {
    let { zone, action, operation, handle } = target;
    if (input.type === 'wheel' || input.type === 'scroll') {
      return { action: null, ok: true };
    }
    if (zone === 'action' && action === 'close') {
      if (!windowEntry.state.closable) {
        return { action: 'close', ok: false, reason: 'window-not-closable' };
      }
      windowEntry.state.hidden = true;
      requestSceneSync();
      syncSceneIfNeeded();
      return { action: 'close', ok: true };
    }
    if (zone === 'action' && action === 'pin') {
      windowEntry.state.pinned = !windowEntry.state.pinned;
      return { action: 'pin', ok: true };
    }
    if (zone === 'action' && action === 'reset') {
      let target = resolveResetTarget(windowEntry);
      if (!target.ok) {
        return { action: 'reset', ok: false, reason: target.reason };
      }
      applyResetTarget(windowEntry, target);
      return { action: 'reset', ok: true };
    }
    if (zone === 'action' && action === 'fullscreen') {
      return { action: 'fullscreen-intent', ok: true };
    }
    if (zone === 'action') {
      return { action: action || 'action', ok: true };
    }
    if (operation === 'resize') {
      let begin = beginResize(windowEntry.windowId, { handle: handle || 'southEast' });
      return { action: 'resize-begin', ok: begin.ok, reason: begin.reason };
    }
    if (operation === 'move' || zone === 'move' || zone === 'edge') {
      activeGesture = { windowId: windowEntry.windowId, operation: 'move', handle: handle || null };
      return { action: 'move-begin', ok: true };
    }
    return { action: null, ok: true };
  }

  function finalizeScrollRelay(windowEntry, hostResult, input) {
    let paintRequested = false;
    if (hostResult.ok && hostResult.scroll?.applied && (hostResult.scroll.applied.x !== 0 || hostResult.scroll.applied.y !== 0)) {
      paintRequested = requestWindowPaint(windowEntry);
      markWindowContentChanged(windowEntry);
      windowEntry.relay.scrolls += 1;
      flushWindowTexture(windowEntry);
    }
    return createXRSpatialWindowScrollReceipt({
      ok: hostResult.ok,
      reason: hostResult.reason || null,
      phase: hostResult.phase,
      kind: hostResult.kind,
      windowId: windowEntry.windowId,
      layoutId: windowEntry.layoutId,
      point: hostResult.point,
      delta: hostResult.delta,
      capture: hostResult.capture,
      scroll: hostResult.scroll,
      totals: hostResult.totals,
      paintRequested,
      source: input.source || null,
    });
  }

  function relayScrollInput(windowEntry, input, point) {
    if (!panelHost || !windowEntry.mounted) {
      return {
        receipt: createXRSpatialWindowScrollReceipt({
          ok: false,
          reason: 'panel-host-unavailable',
          phase: input.phase || 'update',
          kind: input.type === 'wheel' ? 'wheel' : 'drag',
          windowId: windowEntry.windowId,
          layoutId: windowEntry.layoutId,
          point,
          source: input.source || null,
        }),
        dispatched: [],
      };
    }
    let baseInput = {
      targetId: windowEntry.windowId,
      panelId: windowEntry.windowId,
      source: input.source || 'xr-controller',
      sourceId: input.sourceId || null,
      sessionId: input.sessionId || adoptedSession?.sessionId || null,
      pointerId: input.pointerId || input.sourceId || null,
      point,
    };
    if (input.type === 'wheel') {
      panelHost.dispatchScrollEvent({ ...baseInput, phase: 'begin', kind: 'wheel' });
      panelHost.dispatchScrollEvent({ ...baseInput, phase: 'update', kind: 'wheel', delta: input.delta || { x: 0, y: 0 } });
      let end = panelHost.dispatchScrollEvent({ ...baseInput, phase: 'end', kind: 'wheel' });
      return {
        receipt: finalizeScrollRelay(windowEntry, end, input),
        dispatched: [...(end.dispatched || ['xr-panel-scroll'])],
      };
    }
    let result = panelHost.dispatchScrollEvent({
      ...baseInput,
      phase: input.phase || 'update',
      kind: input.kind || 'drag',
      delta: input.delta || null,
    });
    return {
      receipt: finalizeScrollRelay(windowEntry, result, input),
      dispatched: [...(result.dispatched || ['xr-panel-scroll'])],
    };
  }

  function routeRay(ray = {}, input = {}) {
    if (!isVector(ray.origin, 3) || !isVector(ray.direction, 3)) {
      return emit(createXRSpatialWindowRelayReceipt({
        ok: false,
        routed: false,
        reason: 'invalid-ray',
        source: input.source || null,
      }));
    }
    let hit = hitTestXRPanels(
      { origin: ray.origin.map(Number), direction: ray.direction.map(Number) },
      rayPanels(),
    );
    if (!hit) {
      return emit(createXRSpatialWindowRelayReceipt({
        ok: true,
        routed: false,
        reason: 'no-window-hit',
        source: input.source || null,
      }));
    }
    let windowEntry = windows.get(windowIds.get(hit.panelId));
    if (!windowEntry) {
      return emit(createXRSpatialWindowRelayReceipt({
        ok: true,
        routed: false,
        reason: 'no-window-hit',
        source: input.source || null,
      }));
    }
    let framePoint = framePointFor(windowEntry, hit.point);
    let target = hitTestXRPanelFrame(windowEntry.frame, framePoint, { defaultContentOperation: 'focus' });
    if (!target) {
      return emit(createXRSpatialWindowRelayReceipt({
        ok: true,
        routed: false,
        reason: 'no-zone-hit',
        windowId: windowEntry.windowId,
        layoutId: windowEntry.layoutId,
        source: input.source || null,
      }));
    }
    if (target.zone !== 'content') {
      let chrome = handleChromeTarget(windowEntry, target, input);
      return emit(createXRSpatialWindowRelayReceipt({
        ok: chrome.ok,
        routed: true,
        reason: chrome.reason || null,
        zone: target.zone,
        action: chrome.action,
        windowId: windowEntry.windowId,
        layoutId: windowEntry.layoutId,
        source: input.source || null,
      }));
    }
    let point = {
      x: Math.round(Math.min(Math.max(framePoint.x, 0), 1) * 1_000_000) / 1_000_000,
      y: Math.round(Math.min(Math.max(framePoint.y, 0), 1) * 1_000_000) / 1_000_000,
    };
    if (input.point && Number.isFinite(Number(input.point.x)) && Number.isFinite(Number(input.point.y))) {
      point = {
        x: Math.round(Math.min(Math.max(Number(input.point.x), 0), 1) * 1_000_000) / 1_000_000,
        y: Math.round(Math.min(Math.max(Number(input.point.y), 0), 1) * 1_000_000) / 1_000_000,
      };
    }
    if (input.type === 'wheel' || input.type === 'scroll') {
      let inputPoint = input.point && Number.isFinite(Number(input.point.x)) && Number.isFinite(Number(input.point.y))
        ? {
          x: Math.round(Math.min(Math.max(Number(input.point.x), 0), 1) * 1_000_000) / 1_000_000,
          y: Math.round(Math.min(Math.max(Number(input.point.y), 0), 1) * 1_000_000) / 1_000_000,
        }
        : point;
      let { receipt: scrollReceipt, dispatched } = relayScrollInput(windowEntry, input, inputPoint);
      windowEntry.relay.events += 1;
      windowEntry.relay.lastReason = scrollReceipt.ok ? null : scrollReceipt.reason || null;
      return emit(createXRSpatialWindowRelayReceipt({
        ok: scrollReceipt.ok,
        routed: true,
        reason: scrollReceipt.ok ? null : scrollReceipt.reason || null,
        zone: 'content',
        point,
        windowId: windowEntry.windowId,
        layoutId: windowEntry.layoutId,
        source: input.source || null,
        relay: {
          ok: scrollReceipt.ok,
          dispatched,
          interaction: null,
          scroll: scrollReceipt,
          selection: null,
          capture: scrollReceipt.capture
            ? { ...scrollReceipt.capture, phase: scrollReceipt.phase }
            : null,
        },
      }));
    }
    let relay = { ok: false, reason: 'panel-host-unavailable' };
    if (panelHost && windowEntry.mounted) {
      relay = panelHost.dispatchPointerEvent({
        type: input.type || 'pointermove',
        targetId: windowEntry.windowId,
        panelId: windowEntry.windowId,
        source: input.source || 'xr-controller',
        sourceId: input.sourceId || null,
        sessionId: input.sessionId || adoptedSession?.sessionId || null,
        pointerId: input.pointerId || input.sourceId || null,
        point,
        frame: input.frame || null,
        buttons: input.buttons || { primary: false, secondary: false },
      }, {
        hitMap: windowEntry.hitMap || undefined,
        contentHash: windowEntry.contentHash || undefined,
        revision: windowEntry.contentRevision,
        sessionId: input.sessionId || adoptedSession?.sessionId || undefined,
        scrollTarget: input.scrollTarget || undefined,
      });
    }
    windowEntry.relay.events += 1;
    windowEntry.relay.lastReason = relay.ok ? null : relay.reason || null;
    let interaction = relay.interaction || null;
    if (interaction?.ok && interaction.receipt?.action) {
      windowEntry.relay.actions += 1;
    }
    let selectionReceipt = null;
    if (relay.selection) {
      selectionReceipt = createXRSpatialWindowSelectionReceipt({
        ok: relay.selection.ok,
        reason: relay.selection.reason || null,
        phase: relay.selection.phase,
        windowId: windowEntry.windowId,
        layoutId: windowEntry.layoutId,
        point: relay.selection.point,
        startPoint: relay.selection.startPoint,
        capture: relay.selection.capture,
        selection: relay.selection.selection,
        source: input.source || null,
      });
      if (relay.selection.ok && relay.selection.phase === 'end') {
        windowEntry.relay.selections += 1;
      }
    }
    let scrollReceipt = null;
    if (relay.scroll) {
      scrollReceipt = createXRSpatialWindowScrollReceipt({
        ok: relay.scroll.ok,
        reason: relay.scroll.reason || null,
        phase: relay.scroll.phase,
        kind: relay.scroll.kind,
        windowId: windowEntry.windowId,
        layoutId: windowEntry.layoutId,
        point: relay.scroll.point,
        delta: relay.scroll.delta,
        capture: relay.scroll.capture,
        scroll: relay.scroll.scroll,
        totals: relay.scroll.totals,
        paintRequested: false,
        source: input.source || null,
      });
    }
    return emit(createXRSpatialWindowRelayReceipt({
      ok: relay.ok !== false,
      routed: true,
      reason: relay.ok === false ? relay.reason || null : null,
      zone: 'content',
      point,
      windowId: windowEntry.windowId,
      layoutId: windowEntry.layoutId,
      source: input.source || null,
      relay: {
        ok: relay.ok !== false,
        dispatched: [...(relay.dispatched || [])],
        interaction: interaction
          ? {
            ok: interaction.ok === true,
            reason: interaction.reason || null,
            action: interaction.receipt?.action || null,
            targetId: interaction.target?.id || interaction.receipt?.targetId || null,
          }
          : null,
        scroll: scrollReceipt,
        selection: selectionReceipt,
        capture: relay.capture ? { ...relay.capture } : null,
      },
    }));
  }

  function getMaterialHash(material) {
    if (!material) return 'empty';
    let keys = Object.keys(material).sort();
    let str = keys.map((k) => {
      let val = material[k];
      if (typeof val === 'object' && val !== null) {
        return `${k}:${JSON.stringify(val)}`;
      }
      return `${k}:${val}`;
    }).join(',');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `hash:${Math.abs(hash).toString(16)}`;
  }

  function isValidCascadeRoot(r) {
    if (!r || typeof r !== 'object') return false;
    let g = globalRef;
    let ElementClass = g?.Element || (typeof Element !== 'undefined' ? Element : null);
    let DocumentClass = g?.Document || (typeof Document !== 'undefined' ? Document : null);
    if (!ElementClass || !DocumentClass) return false;
    let isDoc = r instanceof DocumentClass;
    let isElem = r instanceof ElementClass;
    if (!isDoc && !isElem) return false;
    let doc = isDoc ? r : r.ownerDocument;
    if (!(doc instanceof DocumentClass)) return false;
    let match = (doc === documentRef || doc === g?.document);
    if (!match && documentRef) {
      match = (Object.getPrototypeOf(documentRef) === doc || documentRef.defaultView?.document === doc);
    }
    if (!match) return false;
    if (isElem) {
      if (r.isConnected === true) return true;
      let curr = r;
      while (curr) {
        if (curr === doc) return true;
        if (!(curr instanceof ElementClass) && !(curr instanceof DocumentClass) && curr !== doc.documentElement && curr !== doc.body) {
          return false;
        }
        curr = curr.parentNode;
      }
      return false;
    }
    return true;
  }

  function verifyInspection(observation, txItem) {
    if (!observation) return { ok: false, reason: 'missing-observation' };
    if (observation.ok === false) {
      return { ok: false, reason: observation.reason || 'observation-failed' };
    }

    if (
      observation.materialId === undefined ||
      observation.textureId === undefined ||
      observation.mapId === undefined ||
      observation.color === undefined ||
      observation.opacity === undefined ||
      observation.transparent === undefined ||
      observation.dimensions === undefined ||
      observation.samplerParams === undefined ||
      observation.snapshotDigest === undefined
    ) {
      return { ok: false, reason: 'incomplete-inspection-fields' };
    }

    let cand = txItem.candidate;
    let panel = txItem.panel;

    if (observation.snapshotDigest !== cand.snapshotDigest) {
      return { ok: false, reason: 'inspection-snapshot-digest-mismatch' };
    }

    if (observation.textureId !== cand.textureId) {
      return { ok: false, reason: 'texture-identity-mismatch' };
    }

    if (observation.mapId !== cand.textureId) {
      return { ok: false, reason: 'map-identity-mismatch' };
    }

    if (observation.color !== cand.colorHex) {
      return { ok: false, reason: 'color-mismatch' };
    }

    if (observation.opacity !== cand.opacity) {
      return { ok: false, reason: 'opacity-mismatch' };
    }

    if (observation.transparent !== cand.transparent) {
      return { ok: false, reason: 'transparency-mismatch' };
    }

    let dimMatch = false;
    if (Array.isArray(observation.dimensions)) {
      dimMatch = observation.dimensions[0] === panel.sizeMeters[0] && observation.dimensions[1] === panel.sizeMeters[1];
    } else if (observation.dimensions && typeof observation.dimensions === 'object') {
      dimMatch = observation.dimensions.width === panel.sizeMeters[0] && observation.dimensions.height === panel.sizeMeters[1];
    }
    if (!dimMatch) {
      return { ok: false, reason: 'dimensions-mismatch' };
    }

    if (
      observation.samplerParams.wrapS !== cand.samplerParams.wrapS ||
      observation.samplerParams.wrapT !== cand.samplerParams.wrapT ||
      observation.samplerParams.minFilter !== cand.samplerParams.minFilter ||
      observation.samplerParams.magFilter !== cand.samplerParams.magFilter
    ) {
      return { ok: false, reason: 'sampler-params-mismatch' };
    }

    return { ok: true };
  }

  function inspectWindowGPUState(windowEntry) {
    if (!textureBridge || typeof textureBridge.inspectBatch !== 'function') {
      return null;
    }
    let mesh = getWindowMesh(windowEntry.windowId);
    let candidateEntry = {
      ...windowEntry,
      themeRevision: windowEntry.themeRevision || 0,
      themeEpoch: windowEntry.themeEpoch || 0,
    };
    let candidateTextureKey = resolveXRSpatialWindowTextureKey(candidateEntry);
    let panelDesc = {
      id: windowEntry.windowId,
      contentKind: windowEntry.contentKind,
      title: windowEntry.title,
      sizeMeters: [...windowEntry.sizeMeters],
      viewport: { ...windowEntry.viewport },
      contentRevision: windowEntry.contentRevision,
      themeRevision: candidateEntry.themeRevision,
      themeScope: windowEntry.themeScope,
      textureKey: candidateTextureKey,
    };

    let txMock = {
      items: [{
        windowId: windowEntry.windowId,
        mesh,
        panel: panelDesc,
      }]
    };

    let res = textureBridge.inspectBatch(txMock);
    if (!res || res.ok === false || !res.observations) {
      return null;
    }
    return res.observations.get(windowEntry.windowId) || res.observations[windowEntry.windowId] || null;
  }

  function applyTheme(input = {}) {
    // 1. Preflight validation of input (throws before any mutation)
    let inputVal = validateXRThemeInput(input);
    if (!inputVal.ok) {
      throw new Error(`Theme redraw receipt validation failed: ${inputVal.reason}`);
    }

    // Validate root if supplied
    let rootToUse = input && input.root !== undefined ? input.root : documentRef;
    if (rootToUse !== null && rootToUse !== undefined) {
      if (!isValidCascadeRoot(rootToUse)) {
        throw new Error('Theme redraw receipt validation failed: unsupported-cascade-root');
      }
    }

    // 2. Canonicalize input (passing exact root if supplied)
    let snapshot = canonicalizeThemeSnapshot(input, rootToUse);

    // 3. Validate canonicalized snapshot (throws before any mutation)
    let snapVal = validateXRThemeSnapshot(snapshot);
    if (!snapVal.ok) {
      throw new Error(`Theme redraw receipt validation failed: ${snapVal.reason}`);
    }

    let targetScope = input?.themeScope || 'xr';
    let isGlobal = input?.global === true || input?.themeScope === '*';

    const sortedWindows = Array.from(windows.values()).sort((a, b) => a.windowId.localeCompare(b.windowId));

    // Determine prior snapshot and theme change before mutating maps
    let affected = [];
    let reused = [];
    let afterRevisionMap = {};

    for (let windowEntry of sortedWindows) {
      let id = windowEntry.windowId;
      let winScope = windowEntry.themeScope || 'xr';
      let matches = isGlobal || (winScope === targetScope);
      
      let priorSnapshotForWin = themeSnapshotsByScope.get(winScope) || (winScope === 'xr' ? themeSnapshot : null);
      let themeChanged = stringifyCanonical(priorSnapshotForWin) !== stringifyCanonical(snapshot);

      if (matches && themeChanged) {
        affected.push(id);
      } else {
        reused.push(id);
      }
    }

    if (affected.length === 0) {
      throw new Error('Theme redraw receipt validation failed: zero-handle/no-op');
    }

    if (status !== 'entered') {
      throw new Error('Theme redraw receipt validation failed: no-session');
    }
    if (!shellReady()) {
      throw new Error('Theme redraw receipt validation failed: shell-not-ready');
    }

    if (!textureBridge) {
      throw new Error('Theme redraw receipt validation failed: missing-bridge-capability');
    }
    let missing = [];
    if (typeof textureBridge.prepareBatch !== 'function') missing.push('prepareBatch');
    if (typeof textureBridge.commitBatch !== 'function') missing.push('commitBatch');
    if (typeof textureBridge.rollbackBatch !== 'function') missing.push('rollbackBatch');
    if (typeof textureBridge.inspectBatch !== 'function') missing.push('inspectBatch');
    if (typeof textureBridge.finalizeBatch !== 'function') missing.push('finalizeBatch');
    if (missing.length > 0) {
      throw new Error(`Theme redraw receipt validation failed: missing-bridge-capability:${missing.join(',')}`);
    }

    let affectedMounted = affected.filter(id => windows.get(windowIds.get(id))?.lifecycle?.mounted);
    if (affectedMounted.length !== affected.length) {
      throw new Error('Theme redraw receipt validation failed: affected-window-unmounted');
    }

    let preObservation = JSON.parse(JSON.stringify(listWindows()));

    // Backup synchronous assembly state
    const priorThemeSnapshot = themeSnapshot;
    const priorThemeSnapshotsByScope = new Map(themeSnapshotsByScope);

    let winBeforeCounters = {};
    let winBeforeRevisions = {};
    let beforeRevisionMap = {};
    let beforeUploads = 0;
    let beforeReuses = 0;

    for (let windowEntry of sortedWindows) {
      let id = windowEntry.windowId;
      winBeforeCounters[id] = {
        uploads: windowEntry.upload.uploads,
        reuses: windowEntry.upload.reuses,
      };
      winBeforeRevisions[id] = windowEntry.themeRevision || 0;
      beforeUploads += windowEntry.upload.uploads;
      beforeReuses += windowEntry.upload.reuses;
      beforeRevisionMap[id] = windowEntry.themeRevision || 0;
    }

    let priorWindowStates = new Map();
    for (let windowEntry of sortedWindows) {
      let id = windowEntry.windowId;
      let mesh = getWindowMesh(id);
      let map = mesh?.material?.map;
      let winScope = windowEntry.themeScope || 'xr';
      let snap = themeSnapshotsByScope.get(winScope) || (winScope === 'xr' ? themeSnapshot : null);
      let priorDigest = snap ? sha256Sync(stringifyCanonical(snap)) : '';
      
      let meshColor = mesh?.material?.color ? (typeof mesh.material.color.getHex === 'function' ? mesh.material.color.getHex() : (typeof mesh.material.color.value === 'number' ? mesh.material.color.value : null)) : null;
      let priorColor = snap?.material?.backgroundColor || snap?.material?.threeColor || meshColor;
      let priorOpacity = snap?.material?.opacity ?? (mesh && mesh.material ? mesh.material.opacity : 1);
      let priorTransparent = snap?.material?.transparent ?? (mesh && mesh.material ? mesh.material.transparent : false);
      let priorDimensions = [...windowEntry.sizeMeters];
      
      priorWindowStates.set(id, {
        snapshotDigest: priorDigest,
        color: priorColor,
        opacity: priorOpacity,
        transparent: priorTransparent,
        dimensions: priorDimensions,
        textureKey: windowEntry.textureKey,
        textureId: map?.uuid || (windowEntry.lifecycle?.mounted ? null : 'unmounted'),
        isAffected: false,
        mounted: windowEntry.lifecycle?.mounted,
        hasMaterial: mesh && mesh.material ? true : false,
      });
    }

    const windowBackups = new Map();
    for (let [id, windowEntry] of windows.entries()) {
      let mesh = getWindowMesh(windowEntry.windowId);
      windowBackups.set(id, {
        themeRevision: windowEntry.themeRevision || 0,
        themeEpoch: windowEntry.themeEpoch || 0,
        material: windowEntry.material ? { ...windowEntry.material } : null,
        textureKey: windowEntry.textureKey,
        dirty: windowEntry.dirty,
        fallback: windowEntry.fallback ? { ...windowEntry.fallback } : null,
        sizeMeters: [...windowEntry.sizeMeters],
        viewport: windowEntry.viewport ? { ...windowEntry.viewport } : null,
        
        // upload state
        uploadResolves: windowEntry.upload.resolves,
        uploadUploads: windowEntry.upload.uploads,
        uploadReuses: windowEntry.upload.reuses,
        uploadVersion: windowEntry.upload.version,
        uploadPanelId: windowEntry.upload.panelId,
        uploadMode: windowEntry.upload.mode,
        uploadRendered: windowEntry.upload.rendered,
        uploadUploaded: windowEntry.upload.uploaded,
        uploadCanvasMatch: windowEntry.upload.canvasMatch,
        uploadWidth: windowEntry.upload.width,
        uploadHeight: windowEntry.upload.height,
        uploadSignature: windowEntry.upload.signature,
        uploadReason: windowEntry.upload.reason,
        uploadErrorName: windowEntry.upload.errorName,
        uploadDirty: windowEntry.upload.dirty,

        // GPU / mesh states
        meshMaterialRef: mesh ? mesh.material : null,
        meshUserDataPanel: mesh ? (mesh.userData.panel ? { ...mesh.userData.panel } : null) : null,
        meshUserDataBaseColor: mesh ? mesh.userData.baseColor : null,
        meshUserDataTextureSource: mesh ? mesh.userData.textureSource : null,
        meshUserDataTextureBridge: mesh ? mesh.userData.textureBridge : null,
        meshUserDataPanelFrameVisuals: mesh ? mesh.userData.panelFrameVisuals : null,
        meshUserDataSnapshotDigest: mesh ? mesh.userData.snapshotDigest : null,
        
        // material/texture GPU state
        materialMap: mesh && mesh.material ? mesh.material.map : null,
        materialColorHex: mesh && mesh.material && mesh.material.color ? (typeof mesh.material.color.getHex === 'function' ? mesh.material.color.getHex() : (typeof mesh.material.color.value === 'number' ? mesh.material.color.value : null)) : null,
        materialOpacity: mesh && mesh.material ? mesh.material.opacity : null,
        materialTransparent: mesh && mesh.material ? mesh.material.transparent : null,
        materialNeedsUpdate: mesh && mesh.material ? mesh.material.needsUpdate : null,
        meshVisible: mesh ? mesh.visible : true,
      });
    }

    let transaction = null;

    function rollback(initialError) {
      let rollbackErrors = [];

      if (transaction && transaction.ok !== false) {
        try {
          let rollbackRes = textureBridge.rollbackBatch(transaction);
          if (rollbackRes && rollbackRes.ok === false) {
            if (rollbackRes.errors) {
              rollbackErrors.push(...rollbackRes.errors);
            } else {
              rollbackErrors.push(new Error(rollbackRes.reason || 'bridge-rollback-failed'));
            }
          }
        } catch (rollbackErr) {
          rollbackErrors.push(rollbackErr);
        }
      }

      let restorationErrors = [];
      try {
        themeSnapshot = priorThemeSnapshot;
        themeSnapshotsByScope.clear();
        for (let [k, v] of priorThemeSnapshotsByScope.entries()) {
          themeSnapshotsByScope.set(k, v);
        }
      } catch (err) {
        restorationErrors.push(err);
      }

      for (let [id, backup] of windowBackups.entries()) {
        try {
          let windowEntry = windows.get(id);
          if (windowEntry) {
            windowEntry.themeRevision = backup.themeRevision;
            windowEntry.themeEpoch = backup.themeEpoch;
            windowEntry.material = backup.material;
            windowEntry.textureKey = backup.textureKey;
            windowEntry.dirty = backup.dirty;
            windowEntry.fallback = backup.fallback;
            windowEntry.sizeMeters = backup.sizeMeters;
            windowEntry.viewport = backup.viewport;
            
            windowEntry.upload.resolves = backup.uploadResolves;
            windowEntry.upload.uploads = backup.uploadUploads;
            windowEntry.upload.reuses = backup.uploadReuses;
            windowEntry.upload.version = backup.uploadVersion;
            windowEntry.upload.panelId = backup.uploadPanelId;
            windowEntry.upload.mode = backup.uploadMode;
            windowEntry.upload.rendered = backup.uploadRendered;
            windowEntry.upload.uploaded = backup.uploadUploaded;
            windowEntry.upload.canvasMatch = backup.uploadCanvasMatch;
            windowEntry.upload.width = backup.uploadWidth;
            windowEntry.upload.height = backup.uploadHeight;
            windowEntry.upload.signature = backup.uploadSignature;
            windowEntry.upload.reason = backup.uploadReason;
            windowEntry.upload.errorName = backup.uploadErrorName;
            windowEntry.upload.dirty = backup.uploadDirty;
            
            let mesh = getWindowMesh(windowEntry.windowId);
            if (mesh) {
              mesh.material = backup.meshMaterialRef;
              if (backup.meshUserDataPanel) {
                mesh.userData.panel = backup.meshUserDataPanel;
              } else {
                delete mesh.userData.panel;
              }
              mesh.userData.baseColor = backup.meshUserDataBaseColor;
              mesh.userData.textureSource = backup.meshUserDataTextureSource;
              mesh.userData.textureBridge = backup.meshUserDataTextureBridge;
              mesh.userData.panelFrameVisuals = backup.meshUserDataPanelFrameVisuals;
              mesh.userData.snapshotDigest = backup.meshUserDataSnapshotDigest;

              if (mesh.material) {
                mesh.material.map = backup.materialMap;
                if (mesh.material.color && typeof mesh.material.color.setHex === 'function' && backup.materialColorHex !== null) {
                  mesh.material.color.setHex(backup.materialColorHex);
                }
                if (backup.materialOpacity !== null) {
                  mesh.material.opacity = backup.materialOpacity;
                }
                if (backup.materialTransparent !== null) {
                  mesh.material.transparent = backup.materialTransparent;
                }
                if (backup.materialNeedsUpdate !== null) {
                  mesh.material.needsUpdate = backup.materialNeedsUpdate;
                }
              }
              
              mesh.visible = backup.meshVisible;
            }
          }
        } catch (resErr) {
          restorationErrors.push(resErr);
        }
      }

      if (initialError instanceof FinalizeContractViolationError) {
        if (rollbackErrors.length > 0 || restorationErrors.length > 0) {
          throw new RollbackVerificationError(
            'Theme redraw receipt validation failed: rollback-verification-failed (during finalize contract violation)',
            initialError,
            rollbackErrors,
            restorationErrors
          );
        }
        throw initialError;
      }

      if (rollbackErrors.length > 0 || restorationErrors.length > 0) {
        throw new RollbackVerificationError(
          'Theme redraw receipt validation failed: rollback-verification-failed',
          initialError,
          rollbackErrors,
          restorationErrors
        );
      }

      let msg = initialError.message || 'texture-operation-failed';
      if (msg.startsWith('Theme redraw receipt validation failed: ')) {
        msg = msg.substring('Theme redraw receipt validation failed: '.length);
      }
      if (msg.startsWith('receipt-validation-failed:')) {
        msg = msg.substring('receipt-validation-failed:'.length);
      }
      throw new Error(`Theme redraw receipt validation failed: ${msg}`);
    }

    try {
      // 4. Prepare batch
      let preparedItems = affectedMounted.map(id => {
        let windowEntry = windows.get(windowIds.get(id));
        let mesh = getWindowMesh(id);
        let winScope = windowEntry.themeScope || 'xr';
        let snap = affected.includes(id) ? snapshot : (themeSnapshotsByScope.get(winScope) || (winScope === 'xr' ? themeSnapshot : null));

        let candidateEntry = {
          ...windowEntry,
          themeRevision: (windowEntry.themeRevision || 0) + 1,
          themeEpoch: (windowEntry.themeEpoch || 0) + 1,
        };
        let candidateTextureKey = resolveXRSpatialWindowTextureKey(candidateEntry);
        let candidatePanelDescriptor = {
          id: windowEntry.windowId,
          contentKind: windowEntry.contentKind,
          title: windowEntry.title,
          sizeMeters: [...windowEntry.sizeMeters],
          viewport: { ...windowEntry.viewport },
          contentRevision: windowEntry.contentRevision,
          themeRevision: candidateEntry.themeRevision,
          themeScope: windowEntry.themeScope,
          textureKey: candidateTextureKey,
        };

        return {
          windowId: id,
          mesh,
          panel: candidatePanelDescriptor,
          element: windowEntry.element,
          canvas: windowEntry.canvas,
          snapshot: snap,
          snapshotDigest: snap ? sha256Sync(stringifyCanonical(snap)) : ''
        };
      });

      transaction = textureBridge.prepareBatch(preparedItems, { themeSnapshot: snapshot });
      if (!transaction || transaction.ok === false) {
        let reason = transaction?.reason || 'prepare-batch-failed';
        throw new Error(reason);
      }

      // 5. Commit batch
      let commitResult = textureBridge.commitBatch(transaction);
      if (!commitResult || commitResult.ok === false) {
        throw new Error(commitResult?.reason || 'commit-batch-failed');
      }

      // 6. Inspect batch
      let inspectResult = textureBridge.inspectBatch(transaction);
      if (!inspectResult || inspectResult.ok === false || !inspectResult.observations) {
        throw new Error(inspectResult?.reason || 'inspect-batch-failed');
      }

      // Verify inspections
      for (let id of affectedMounted) {
        let observation = inspectResult.observations.get(id) || inspectResult.observations[id];
        let txItem = {
          windowId: id,
          panel: observation.panel,
          candidate: observation.candidate,
        };
        let verifyRes = verifyInspection(observation, txItem);
        if (!verifyRes.ok) {
          throw new Error(verifyRes.reason || 'inspection-failed');
        }
      }

      // -- BUILD & VALIDATE PROSPECTIVE RECEIPT --
      let windowResults = [];
      for (let windowEntry of sortedWindows) {
        let id = windowEntry.windowId;
        let winScope = windowEntry.themeScope || 'xr';
        let isAffected = affected.includes(id);

        let beforeRev = winBeforeRevisions[id];
        let afterRev = isAffected ? beforeRev + 1 : beforeRev;
        let snap = isAffected ? snapshot : (themeSnapshotsByScope.get(winScope) || null);
        let requestedMat = snap?.material ? { ...snap.material } : null;

        let actualMat = isAffected
          ? (snapshot.material ? { ...snapshot.material } : null)
          : (windowEntry.material ? { ...windowEntry.material } : null);

        let outcome;
        let uDelta = 0;
        let rDelta = 0;
        if (isAffected) {
          let bridgeRecord = inspectResult.observations.get(id)?.candidate?.record;
          if (bridgeRecord && bridgeRecord.stage && (bridgeRecord.stage.includes('reused') || bridgeRecord.stage.includes('reuse'))) {
            rDelta = 1;
            outcome = 'reuse';
          } else {
            uDelta = 1;
            outcome = 'upload';
          }
        } else {
          outcome = 'skipped';
        }

        let winBefore = winBeforeCounters[id];
        let rCounters = {
          beforeUploads: winBefore.uploads,
          afterUploads: winBefore.uploads + uDelta,
          beforeReuses: winBefore.reuses,
          afterReuses: winBefore.reuses + rDelta,
        };

        let recordToHash = {
          windowId: id,
          themeScope: winScope,
          beforeRevision: beforeRev,
          afterRevision: afterRev,
          snapshot: snap,
          requestedMaterial: requestedMat,
          actualMaterial: actualMat,
          outcome,
          counters: rCounters,
        };

        let recordHash = sha256Sync(stringifyCanonical(recordToHash));

        windowResults.push({
          windowId: id,
          themeScope: winScope,
          beforeRevision: beforeRev,
          afterRevision: afterRev,
          snapshot: snap,
          requestedMaterial: requestedMat,
          actualMaterial: actualMat,
          outcome,
          counters: rCounters,
          hash: recordHash,
        });
      }

      let bindingHash = sha256Sync(stringifyCanonical([...windowResults].map(r => r.hash).sort()));

      let afterUploads = 0;
      let afterReuses = 0;
      for (let windowEntry of sortedWindows) {
        let isAffected = affected.includes(windowEntry.windowId);
        let winBefore = winBeforeCounters[windowEntry.windowId];
        let uDelta = 0;
        let rDelta = 0;
        if (isAffected && windowEntry.lifecycle?.mounted) {
          let bridgeRecord = inspectResult.observations.get(windowEntry.windowId)?.candidate?.record;
          if (bridgeRecord && bridgeRecord.stage && (bridgeRecord.stage.includes('reused') || bridgeRecord.stage.includes('reuse'))) {
            rDelta = 1;
          } else {
            uDelta = 1;
          }
        }
        afterUploads += winBefore.uploads + uDelta;
        afterReuses += winBefore.reuses + rDelta;
      }

      for (let windowEntry of sortedWindows) {
        let isAffected = affected.includes(windowEntry.windowId);
        afterRevisionMap[windowEntry.windowId] = (windowEntry.themeRevision || 0) + (isAffected ? 1 : 0);
      }

      let ok = (status === 'entered') &&
               shellReady() &&
               (transaction && transaction.ok !== false) &&
               affected.length > 0;

      const finalEnvelope = {
        version: 'xr-spatial-window-theme-redraw-receipt-v1',
        action: 'theme-redraw',
        ok: ok,
        themeScope: isGlobal ? '*' : targetScope,
        windowIds: affected.concat(reused),
        beforeRevision: beforeRevisionMap,
        afterRevision: afterRevisionMap,
        counters: {
          beforeUploads,
          afterUploads,
          beforeReuses,
          afterReuses,
        },
        bindingHash,
        affectedWindows: affected,
        reusedWindows: reused,
        windowResults,
      };
      let evidenceDigest = sha256Sync(stringifyCanonical(finalEnvelope));

      let themeRedrawReceipt = createXRSpatialWindowThemeRedrawReceipt({
        ok,
        themeScope: isGlobal ? '*' : targetScope,
        windowIds: affected.concat(reused),
        beforeRevision: beforeRevisionMap,
        afterRevision: afterRevisionMap,
        counters: {
          beforeUploads,
          afterUploads,
          beforeReuses,
          afterReuses,
        },
        bindingHash,
        affectedWindows: affected,
        reusedWindows: reused,
        windowResults,
        evidenceDigest,
      });

      let postObservation = JSON.parse(JSON.stringify(preObservation));
      for (let w of postObservation) {
        if (affected.includes(w.windowId)) {
          w.themeRevision = (w.themeRevision || 0) + 1;
          w.themeEpoch = (w.themeEpoch || 0) + 1;
          w.material = snapshot.material ? { ...snapshot.material } : null;
          if (w.theme) {
            w.theme.themeRevision = w.themeRevision;
            w.theme.snapshot = {
              version: snapshot.version,
              themeScope: snapshot.themeScope || null,
              tokens: snapshot.tokens ? { ...snapshot.tokens } : {},
              material: snapshot.material ? { ...snapshot.material } : null,
            };
            w.theme.actualMaterial = w.material;
          }
          let winBefore = winBeforeCounters[w.windowId];
          let uDelta = 0;
          let rDelta = 0;
          if (w.lifecycle?.mounted ?? false) {
            let bridgeRecord = inspectResult.observations.get(w.windowId)?.candidate?.record;
            if (bridgeRecord && bridgeRecord.stage && (bridgeRecord.stage.includes('reused') || bridgeRecord.stage.includes('reuse'))) {
              rDelta = 1;
            } else {
              uDelta = 1;
            }
          }
          w.upload = {
            ...w.upload,
            uploads: winBefore.uploads + uDelta,
            reuses: winBefore.reuses + rDelta,
          };
        }
      }

      let finalValidation = validateXRSpatialWindowThemeRedrawReceiptAgainstTrustedObservationSync(themeRedrawReceipt, { pre: preObservation, post: postObservation });
      if (!finalValidation.ok) {
        throw new Error(`receipt-validation-failed:${finalValidation.reason}`);
      }

      // -- INITIATE INCOMPATIBLE/FINAL BARRIER --
      try {
        let finalizeResult = textureBridge.finalizeBatch(transaction);
        if (finalizeResult && finalizeResult.ok === false) {
          throw new Error(finalizeResult.reason || 'finalize-failed');
        }
      } catch (finalizeErr) {
        throw new FinalizeContractViolationError(
          `Finalize contract violation: ${finalizeErr.message || finalizeErr}`,
          finalizeErr
        );
      }

      // -- PUBLISH MATCHING ASSEMBLY STATE --
      for (let id of affected) {
        let windowEntry = windows.get(windowIds.get(id));
        if (windowEntry) {
          windowEntry.themeRevision = (windowEntry.themeRevision || 0) + 1;
          windowEntry.themeEpoch += 1;
          windowEntry.material = snapshot.material ? { ...snapshot.material } : null;
          windowEntry.textureKey = resolveXRSpatialWindowTextureKey(windowEntry);
          windowEntry.dirty = true;
          if (windowEntry.resize.phase === 'preview' && windowEntry.resize.session) {
            ensurePreviewPlane(windowEntry, windowEntry.resize.session.targetSizeMeters);
          }

          // Counters are updated canonically inside noteTextureOutcome below
        }
      }

      // afterRevisionMap is already populated prospectively before validation

      let scope = snapshot.themeScope || 'xr';
      themeSnapshotsByScope.set(scope, snapshot);
      if (scope === 'xr' || !themeSnapshot) {
        themeSnapshot = snapshot;
      }

      for (let windowEntry of sortedWindows) {
        let id = windowEntry.windowId;
        if (affected.includes(id)) {
          let winScope = windowEntry.themeScope || 'xr';
          themeSnapshotsByScope.set(winScope, snapshot);
        }
      }

      // Update mesh userData and material states for all affected
      let focused = [...windows.values()].find((w) => w.state.focused);
      for (let id of affectedMounted) {
        let windowEntry = windows.get(windowIds.get(id));
        let mesh = getWindowMesh(id);
        let snap = affected.includes(id) ? snapshot : (themeSnapshotsByScope.get(windowEntry?.themeScope || 'xr') || null);
        if (mesh && windowEntry) {
          mesh.userData.panel = {
            ...mesh.userData.panel,
            textureKey: windowEntry.textureKey,
            material: windowEntry.material ? { ...windowEntry.material } : (snap?.material ? { ...snap.material } : null),
          };
          mesh.userData.baseColor = mesh.userData.panel.material?.threeColor || mesh.userData.panel.material?.backgroundColor || null;
          mesh.userData.snapshotDigest = snap ? sha256Sync(stringifyCanonical(snap)) : '';

          updateXRThreePanelMaterialStates({
            adapter,
            meshes: [mesh],
            sessionState: { selectedPanelId: focused?.windowId || null },
            themeSnapshot: snap || undefined,
          });
        }

        let bridgeRecord = inspectResult.observations.get(id)?.candidate?.record;
        if (bridgeRecord && windowEntry) {
          noteTextureOutcome(windowEntry, bridgeRecord);
        }
      }

      emit(themeRedrawReceipt);

      return emit(createXRSpatialWindowLifecycleReceipt('apply-theme', {
        ok,
        details: {
          themeScope: isGlobal ? '*' : targetScope,
          affectedWindowIds: affected,
        },
      }));
    } catch (err) {
      rollback(err);
    }
  }

  function syncFrame(frameInfo = {}) {
    if (disposed) {
      return freezeSpatialValue({
        version: XR_SPATIAL_WINDOW_FRAME_VERSION,
        ok: false,
        uploads: 0,
        reuses: 0,
        totalUploads: 0,
        totalReuses: 0,
        dirtyWindows: 0,
        frame: frameTracker.getMetrics(),
      });
    }

    let timestamp = typeof frameInfo.timestamp === 'number' ? frameInfo.timestamp : (globalRef?.performance?.now() || Date.now());
    frameTracker.recordFrame(timestamp, {
      visible: frameInfo.visible !== false,
      discontinuous: frameInfo.discontinuous === true,
    });

    if (status === 'entered' && shellReady()) {
      syncSceneIfNeeded();
      for (let windowEntry of windows.values()) {
        if (windowEntry.dirty && windowEntry.mounted) {
          flushWindowTexture(windowEntry);
        }
      }
    }

    let totalUploads = 0;
    let totalReuses = 0;
    let dirtyWindows = 0;
    for (let windowEntry of windows.values()) {
      totalUploads += windowEntry.upload.uploads;
      totalReuses += windowEntry.upload.reuses;
      if (windowEntry.dirty) dirtyWindows += 1;
    }
    let delta = {
      uploads: totalUploads - frameBaseline.uploads,
      reuses: totalReuses - frameBaseline.reuses,
    };
    frameBaseline = { uploads: totalUploads, reuses: totalReuses };
    return freezeSpatialValue({
      version: XR_SPATIAL_WINDOW_FRAME_VERSION,
      ok: true,
      uploads: delta.uploads,
      reuses: delta.reuses,
      totalUploads,
      totalReuses,
      dirtyWindows,
      frame: frameTracker.getMetrics(),
    });
  }

  function posesEqual(first, second) {
    return Boolean(first && second)
      && first.position.every((value, index) => value === second.position[index])
      && first.rotation.every((value, index) => value === second.rotation[index]);
  }

  function buildWindowSummary(windowEntry) {
    let zones = windowEntry.frame.zones;
    let zoneRects = {
      content: zones.content,
      controlBar: zones.controlBar,
      move: zones.move,
      'resize:northWest': zones.resize.northWest,
      'resize:northEast': zones.resize.northEast,
      'resize:southEast': zones.resize.southEast,
      'resize:southWest': zones.resize.southWest,
      'edges:north': zones.edges.north,
      'edges:east': zones.edges.east,
      'edges:south': zones.edges.south,
      'edges:west': zones.edges.west,
    };
    for (let [action, rect] of Object.entries(zones.actions || {})) {
      zoneRects[`actions:${action}`] = rect;
    }

    let intersections = [];
    let zeroForbiddenOverlap = true;
    let keys = Object.keys(zoneRects);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        let key1 = keys[i];
        let key2 = keys[j];
        let r1 = zoneRects[key1];
        let r2 = zoneRects[key2];
        let area = getRectangleIntersection(r1, r2);
        let roundedArea = roundMetric(area);
        if (roundedArea > 0) {
          let allowed = isOverlapAllowed(key1, key2);
          if (!allowed) {
            zeroForbiddenOverlap = false;
          }
          intersections.push({
            zones: [key1, key2],
            intersectionArea: roundedArea,
            allowed,
          });
        }
      }
    }

    let chrome = {
      zones: {
        controlBar: { ...zones.controlBar },
        move: { ...zones.move },
        content: { ...zones.content },
        resize: {
          northWest: { ...zones.resize.northWest },
          northEast: { ...zones.resize.northEast },
          southEast: { ...zones.resize.southEast },
          southWest: { ...zones.resize.southWest },
        },
        edges: {
          north: { ...zones.edges.north },
          east: { ...zones.edges.east },
          south: { ...zones.edges.south },
          west: { ...zones.edges.west },
        },
        actions: Object.fromEntries(
          Object.entries(zones.actions || {}).map(([k, v]) => [k, { ...v }])
        ),
      },
      surface: {
        sizeMeters: [...windowEntry.chromeSurface.sizeMeters],
        extents: { ...windowEntry.chromeSurface.extents },
      },
      geometry: {
        sizeMeters: [...windowEntry.sizeMeters],
        viewport: { ...windowEntry.viewport },
        pose: clonePose(windowEntry.pose),
      },
      overlap: {
        zeroForbiddenOverlap,
        verdict: zeroForbiddenOverlap ? 'PASS' : 'FAIL',
        intersections,
      },
    };

    let scope = windowEntry.themeScope || 'xr';
    let winSnapshot = themeSnapshotsByScope.get(scope) || (scope === 'xr' ? themeSnapshot : null);
    let winSnapshotObj = winSnapshot ? {
      version: winSnapshot.version,
      themeScope: winSnapshot.themeScope || null,
      tokens: winSnapshot.tokens ? { ...winSnapshot.tokens } : {},
      material: winSnapshot.material ? { ...winSnapshot.material } : null,
    } : null;
    let actualMaterial = windowEntry.material ? { ...windowEntry.material } : null;

    let boundEvidence = {
      themeScope: scope,
      snapshot: winSnapshotObj,
      actualMaterial: actualMaterial,
    };
    let winBindingHash = sha256Sync(stringifyCanonical(boundEvidence));

    return {
      layoutId: windowEntry.layoutId,
      windowId: windowEntry.windowId,
      contentKind: windowEntry.contentKind,
      title: windowEntry.title,
      pose: clonePose(windowEntry.pose),
      // Slot ownership is live: a window claims its default slot only while it
      // actually occupies the assigned canonical pose, so a vacated slot can
      // never show duplicate live owners.
      defaultSlot: windowEntry.defaultSlot !== null && posesEqual(windowEntry.pose, windowEntry.canonicalPose)
        ? windowEntry.defaultSlot
        : null,
      sizeMeters: [...windowEntry.sizeMeters],
      viewport: { ...windowEntry.viewport },
      contentRevision: windowEntry.contentRevision,
      themeRevision: windowEntry.themeRevision,
      state: { ...windowEntry.state },
      themeScope: windowEntry.themeScope,
      theme: {
        themeScope: scope,
        snapshot: winSnapshotObj,
        bindingHash: winBindingHash,
        actualMaterial: actualMaterial,
      },
      lifecycle: {
        mounted: windowEntry.mounted,
        mounts: windowEntry.lifecycle.mounts,
        disposals: windowEntry.lifecycle.disposals,
      },
      upload: { ...windowEntry.upload },
      relay: { ...windowEntry.relay },
      contentFocus: windowEntry.contentFocus ? { ...windowEntry.contentFocus } : null,
      resize: {
        phase: windowEntry.resize.phase,
        previews: windowEntry.resize.previews,
      },
      fallback: windowEntry.fallback,
      chrome,
    };
  }

  function getWindow(windowId) {
    let windowEntry = windows.get(windowIds.get(windowId));
    return windowEntry ? buildWindowSummary(windowEntry) : null;
  }

  function listWindows() {
    return [...windows.values()].map(buildWindowSummary);
  }

  function getWindowDataProjection(windowId) {
    let windowEntry = windows.get(windowIds.get(windowId));
    return windowEntry ? buildDataProjection(windowEntry) : null;
  }

  function getWindowElement(windowId) {
    return windows.get(windowIds.get(windowId))?.element || null;
  }

  function getWindowMesh(windowId) {
    if (!shellReady()) return null;
    return adapter.getPanelMesh(windowId) || null;
  }

  function getDiagnostics() {
    let counters = {
      syncs: syncSequence,
      uploads: 0,
      reuses: 0,
      relayedEvents: 0,
      relayedActions: 0,
      scrollGestures: 0,
      selectionGestures: 0,
      contentFocusHandoffs: focusStats.handoffs,
      viewportUpdates: viewportStats.updates,
      resizePreviews: resizeStats.previews,
      resizeCommits: resizeStats.commits,
      resizeCancels: resizeStats.cancels,
    };
    let summaries = listWindows();
    for (let summary of summaries) {
      counters.uploads += summary.upload.uploads;
      counters.reuses += summary.upload.reuses;
      counters.relayedEvents += summary.relay.events;
      counters.relayedActions += summary.relay.actions;
      counters.scrollGestures += summary.relay.scrolls;
      counters.selectionGestures += summary.relay.selections;
    }
    let support = getSupport() || {};
    let diagnostics = {
      version: XR_SPATIAL_WINDOW_DIAGNOSTICS_VERSION,
      status,
      disposed,
      session: {
        sessionId: adoptedSession?.sessionId || null,
        adopted: Boolean(adoptedSession),
        entries: sessionStats.entries,
        exits: sessionStats.exits,
      },
      windows: summaries,
      counters,
      frame: frameTracker.getMetrics(),
      theme: {
        themeScope: themeSnapshot?.themeScope || null,
        material: themeSnapshot?.material ? { ...themeSnapshot.material } : null,
      },
      shell: {
        present: shellReady(),
        panelCount: shellReady() ? adapter.getState().panelCount : 0,
      },
      support: {
        supported: Boolean(support.diagnostics?.supported ?? support.supported),
        preferredMode: support.preferredMode || null,
        availability: support.diagnostics?.availability || null,
      },
      activeGesture: activeGesture ? { ...activeGesture } : null,
    };

    let validation = validateXRSpatialWindowDiagnosticsAgainstTrustedObservationSync(diagnostics, summaries);
    if (!validation.ok) {
      throw new Error(`Diagnostics validation failed: ${validation.reason}`);
    }

    return diagnostics;
  }

  function dispose() {
    if (disposed) return false;
    for (let windowEntry of windows.values()) {
      unmountWindow(windowEntry);
    }
    if (shellReady()) adapter.setScene({ panels: [] }, { textureBridge });
    textureBridge?.dispose?.();
    textureResolver?.dispose?.();
    panelHost?.cleanup?.();
    windows.clear();
    windowIds.clear();
    status = 'idle';
    disposed = true;
    return true;
  }

  return {
    syncLayouts,
    enter,
    exit,
    adoptSession,
    releaseSession,
    focusWindow,
    focusWindowContent,
    blurWindowContent,
    cancelWindowContentFocus,
    settleWindowPose,
    resetWindowPose,
    routeRay,
    beginResize,
    previewResize,
    commitResize,
    cancelResize,
    updateWindowViewport,
    applyTheme,
    inspectWindowGPUState: (windowId) => {
      let windowEntry = windows.get(windowIds.get(windowId));
      return windowEntry ? inspectWindowGPUState(windowEntry) : null;
    },
    syncFrame,
    getWindow,
    listWindows,
    getWindowDataProjection,
    getWindowElement,
    getWindowMesh,
    getPortablePanelSnapshot: () => poseSnapshot,
    getReceipts: () => receipts.map((receipt) => receipt),
    getDiagnostics,
    getState: () => ({
      status,
      disposed,
      windowCount: windows.size,
      sessionId: adoptedSession?.sessionId || null,
      syncSequence,
    }),
    dispose,
  };
}
