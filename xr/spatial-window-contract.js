import { createXRPanelContentViewport } from './layout-projection.js';
import { freezeSpatialValue } from './spatial-contract.js';
import { computeXRPanelChromeLayout } from './panel-frame.js';
import { createXRThemeSnapshot } from './theme-bridge.js';

export const XR_SPATIAL_WINDOW_LAYOUT_VERSION = 'xr-spatial-window-layout-v1';
export const XR_SPATIAL_WINDOW_SYNC_RECEIPT_VERSION = 'xr-spatial-window-sync-receipt-v1';
export const XR_SPATIAL_WINDOW_LIFECYCLE_RECEIPT_VERSION = 'xr-spatial-window-lifecycle-receipt-v1';
export const XR_SPATIAL_WINDOW_RESIZE_RECEIPT_VERSION = 'xr-spatial-window-resize-receipt-v1';
export const XR_SPATIAL_WINDOW_RELAY_RECEIPT_VERSION = 'xr-spatial-window-relay-receipt-v1';
export const XR_SPATIAL_WINDOW_SCROLL_RECEIPT_VERSION = 'xr-spatial-window-scroll-receipt-v1';
export const XR_SPATIAL_WINDOW_SELECTION_RECEIPT_VERSION = 'xr-spatial-window-selection-receipt-v1';
export const XR_SPATIAL_WINDOW_FOCUS_RECEIPT_VERSION = 'xr-spatial-window-focus-receipt-v1';
export const XR_SPATIAL_WINDOW_VIEWPORT_RECEIPT_VERSION = 'xr-spatial-window-viewport-receipt-v1';
export const XR_SPATIAL_WINDOW_THEME_REDRAW_RECEIPT_VERSION = 'xr-spatial-window-theme-redraw-receipt-v1';
export const XR_SPATIAL_WINDOW_FALLBACK_VERSION = 'xr-spatial-window-fallback-v1';
export const XR_SPATIAL_WINDOW_DIAGNOSTICS_VERSION = 'xr-spatial-window-assembly-diagnostics-v1';
export const XR_SPATIAL_WINDOW_FRAME_VERSION = 'xr-spatial-window-frame-v1';

export const XR_SPATIAL_WINDOW_SCROLL_PHASES = Object.freeze(['begin', 'update', 'end', 'cancel']);
export const XR_SPATIAL_WINDOW_SCROLL_KINDS = Object.freeze(['wheel', 'drag']);
export const XR_SPATIAL_WINDOW_SELECTION_PHASES = Object.freeze(['begin', 'update', 'end', 'cancel']);
export const XR_SPATIAL_WINDOW_FOCUS_ACTIONS = Object.freeze(['content-focus', 'content-blur', 'content-focus-cancel']);
export const XR_SPATIAL_WINDOW_IME_MODES = Object.freeze(['dom-focus', 'dom-overlay', 'unavailable']);

export const XR_SPATIAL_WINDOW_CONTENT_KINDS = Object.freeze(['dom', 'volumetric']);
export const XR_SPATIAL_WINDOW_FALLBACK_MODES = Object.freeze([
  'none',
  'provider-material-fallback',
  'dom-overlay',
]);

export const XR_SPATIAL_WINDOW_DEFAULT_POSE = Object.freeze({
  position: Object.freeze([0, 1.35, -1.6]),
  rotation: Object.freeze([0, 0, 0]),
});
export const XR_SPATIAL_WINDOW_DEFAULT_SIZE = Object.freeze([0.8, 0.45]);
export const XR_SPATIAL_WINDOW_SIZE_LIMITS = Object.freeze({
  minWidth: 0.24,
  minHeight: 0.16,
  maxWidth: 3.2,
  maxHeight: 2.4,
});
export const XR_SPATIAL_WINDOW_VIEWPORT_BOUNDS = Object.freeze({
  minWidth: 320,
  minHeight: 240,
  maxWidth: 4096,
  maxHeight: 3072,
});

const ROUNDING_PRECISION = 1_000_000;

function roundMetric(value) {
  return Math.round(value * ROUNDING_PRECISION) / ROUNDING_PRECISION;
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function isVector(value, length) {
  return Array.isArray(value) && value.length === length && value.every(isFiniteNumber);
}

function normalizeVector(value, fallback) {
  if (value === undefined) return [...fallback];
  return value.map((entry) => roundMetric(Number(entry)));
}

function normalizeRevision(value) {
  if (value === undefined) return 0;
  return Number(value);
}

function isValidRevision(value) {
  return Number.isInteger(value) && value >= 0;
}

function invalid(reason, layoutId) {
  return { ok: false, reason, layoutId: layoutId ?? null };
}

/**
 * @param {Object} layout
 * @param {Object} [options]
 * @returns {Object} `{ ok: true, layout }` with a frozen normalized descriptor,
 *   or `{ ok: false, reason, layoutId }` when the input cannot be reconciled.
 */
export function normalizeXRSpatialWindowLayout(layout = {}, options = {}) {
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) {
    return invalid('missing-layout-id');
  }
  let layoutId = typeof layout.layoutId === 'string' && layout.layoutId.trim()
    ? layout.layoutId.trim()
    : null;
  if (!layoutId) return invalid('missing-layout-id');
  if (layout.version !== undefined && layout.version !== XR_SPATIAL_WINDOW_LAYOUT_VERSION) {
    return invalid('invalid-version', layoutId);
  }
  let contentKind = layout.contentKind ?? 'dom';
  if (!XR_SPATIAL_WINDOW_CONTENT_KINDS.includes(contentKind)) {
    return invalid('invalid-content-kind', layoutId);
  }
  let pose = layout.pose ?? XR_SPATIAL_WINDOW_DEFAULT_POSE;
  if (!isVector(pose.position, 3) || !isVector(pose.rotation, 3)) {
    return invalid('invalid-pose', layoutId);
  }
  let sizeMeters = layout.sizeMeters ?? XR_SPATIAL_WINDOW_DEFAULT_SIZE;
  if (
    !isVector(sizeMeters, 2)
    || Number(sizeMeters[0]) <= 0
    || Number(sizeMeters[1]) <= 0
  ) {
    return invalid('invalid-size', layoutId);
  }
  let normalizedSize = normalizeVector(sizeMeters, XR_SPATIAL_WINDOW_DEFAULT_SIZE);
  let viewport = layout.viewport ?? createXRPanelContentViewport({ size: normalizedSize }, options.viewport);
  if (
    !viewport
    || !isFiniteNumber(viewport.width)
    || !isFiniteNumber(viewport.height)
    || Number(viewport.width) <= 0
    || Number(viewport.height) <= 0
  ) {
    return invalid('invalid-viewport', layoutId);
  }
  let contentRevision = normalizeRevision(layout.contentRevision);
  let themeRevision = normalizeRevision(layout.themeRevision);
  if (!isValidRevision(contentRevision) || !isValidRevision(themeRevision)) {
    return invalid('invalid-revision', layoutId);
  }
  let state = layout.state ?? {};
  let stateFields = ['focused', 'pinned', 'hidden', 'closable'];
  if (
    stateFields.some((field) => state[field] !== undefined && typeof state[field] !== 'boolean')
  ) {
    return invalid('invalid-state', layoutId);
  }
  let normalizedState = {
    focused: Boolean(state.focused),
    pinned: Boolean(state.pinned),
    hidden: Boolean(state.hidden),
    closable: state.closable === undefined ? true : state.closable,
  };
  let volumetric = layout.volumetric ?? [];
  if (!Array.isArray(volumetric)) {
    return invalid('invalid-volumetric', layoutId);
  }
  let windowId = typeof layout.windowId === 'string' && layout.windowId.trim()
    ? layout.windowId.trim()
    : `window:${layoutId}`;
  let dom = layout.dom && typeof layout.dom === 'object' ? layout.dom : {};
  return {
    ok: true,
    layout: freezeSpatialValue({
      version: XR_SPATIAL_WINDOW_LAYOUT_VERSION,
      layoutId,
      windowId,
      contentKind,
      title: typeof layout.title === 'string' ? layout.title : null,
      pose: {
        position: normalizeVector(pose.position, XR_SPATIAL_WINDOW_DEFAULT_POSE.position),
        rotation: normalizeVector(pose.rotation, XR_SPATIAL_WINDOW_DEFAULT_POSE.rotation),
      },
      sizeMeters: normalizedSize,
      viewport: {
        width: Math.round(Number(viewport.width)),
        height: Math.round(Number(viewport.height)),
      },
      contentRevision,
      themeRevision,
      state: normalizedState,
      themeScope: typeof layout.themeScope === 'string' ? layout.themeScope : null,
      contentHash: typeof layout.contentHash === 'string' ? layout.contentHash : null,
      volumetric: volumetric.map((entry) => ({ ...(entry && typeof entry === 'object' ? entry : {}) })),
    }),
    dom: {
      element: dom.element || null,
      component: dom.component || null,
      layoutNode: dom.layoutNode || null,
      props: dom.props && typeof dom.props === 'object' ? dom.props : null,
    },
    hitMap: layout.hitMap || null,
  };
}

/**
 * @param {Object} windowEntry
 * @returns {string}
 */
export function resolveXRSpatialWindowTextureKey(windowEntry = {}) {
  let viewport = windowEntry.viewport || {};
  return [
    Number(windowEntry.contentRevision ?? 0),
    Number(windowEntry.themeRevision ?? 0),
    `${Number(viewport.width || 0)}x${Number(viewport.height || 0)}`,
    Number(windowEntry.themeEpoch ?? 0),
    Number(windowEntry.contentEpoch ?? 0),
  ].join(':');
}

const DIFF_FIELDS = Object.freeze([
  'contentKind',
  'title',
  'pose',
  'sizeMeters',
  'viewport',
  'contentRevision',
  'themeRevision',
  'state',
  'themeScope',
  'contentHash',
  'volumetric',
]);

function fieldEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * @param {Object} current normalized descriptor
 * @param {Object} next normalized descriptor
 * @returns {Object} `{ changed, changes }` field names that differ.
 */
export function diffXRSpatialWindowLayouts(current = {}, next = {}) {
  let changes = [];
  for (let field of DIFF_FIELDS) {
    if (!fieldEqual(current[field], next[field])) changes.push(field);
  }
  return { changed: changes.length > 0, changes };
}

/**
 * @param {Array<number>} sizeMeters
 * @param {Object} [limits]
 * @returns {Array<number>}
 */
export function clampXRSpatialWindowSize(sizeMeters, limits = XR_SPATIAL_WINDOW_SIZE_LIMITS) {
  let width = Number(sizeMeters?.[0]);
  let height = Number(sizeMeters?.[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return [
    roundMetric(Math.min(Math.max(width, limits.minWidth), limits.maxWidth)),
    roundMetric(Math.min(Math.max(height, limits.minHeight), limits.maxHeight)),
  ];
}

/**
 * Scales the committed CSS viewport by the meter ratio between the committed
 * and target sizes, clamped to the assembly viewport bounds.
 *
 * @param {Object} committedViewport
 * @param {Array<number>} committedSize
 * @param {Array<number>} targetSize
 * @param {Object} [bounds]
 * @returns {Object}
 */
export function resolveXRSpatialWindowCommitViewport(
  committedViewport = {},
  committedSize = [],
  targetSize = [],
  bounds = XR_SPATIAL_WINDOW_VIEWPORT_BOUNDS,
) {
  let ratioX = Number(targetSize[0]) / Math.max(Number(committedSize[0]) || 0.000001, 0.000001);
  let ratioY = Number(targetSize[1]) / Math.max(Number(committedSize[1]) || 0.000001, 0.000001);
  let width = Math.round(Number(committedViewport.width || 0) * ratioX);
  let height = Math.round(Number(committedViewport.height || 0) * ratioY);
  return {
    width: Math.min(Math.max(width, bounds.minWidth), bounds.maxWidth),
    height: Math.min(Math.max(height, bounds.minHeight), bounds.maxHeight),
  };
}

/**
 * Computes the enlarged hit surface that keeps out-of-window chrome zones
 * reachable, derived from the public chrome zone layout.
 *
 * @param {Object} zones result of computeXRPanelChromeLayout()
 * @param {Array<number>} sizeMeters
 * @returns {Object} `{ sizeMeters, extents }`
 */
export function createXRSpatialWindowChromeSurface(zones = {}, sizeMeters = XR_SPATIAL_WINDOW_DEFAULT_SIZE) {
  let minU = 0;
  let minV = 0;
  let maxU = 1;
  let maxV = 1;
  let visit = (zone) => {
    if (!zone) return;
    minU = Math.min(minU, zone.x);
    minV = Math.min(minV, zone.y);
    maxU = Math.max(maxU, zone.x + zone.width);
    maxV = Math.max(maxV, zone.y + zone.height);
  };
  for (let group of ['controlBar', 'move', 'content']) visit(zones[group]);
  for (let zone of Object.values(zones.resize || {})) visit(zone);
  for (let zone of Object.values(zones.edges || {})) visit(zone);
  for (let zone of Object.values(zones.actions || {})) visit(zone);
  let width = Number(sizeMeters[0]) || XR_SPATIAL_WINDOW_DEFAULT_SIZE[0];
  let height = Number(sizeMeters[1]) || XR_SPATIAL_WINDOW_DEFAULT_SIZE[1];
  let extents = {
    x: roundMetric(Math.max(-minU, maxU - 1, 0) * width),
    y: roundMetric(Math.max(-minV, maxV - 1, 0) * height),
  };
  return {
    sizeMeters: [
      roundMetric(width + extents.x * 2),
      roundMetric(height + extents.y * 2),
    ],
    extents,
  };
}

/**
 * Converts provider Euler degrees (T * Rz * Ry * Rx convention) into an xyzw
 * quaternion for the portable panel store.
 *
 * @param {Array<number>} rotation
 * @returns {Array<number>}
 */
export function eulerDegreesToXRQuaternion(rotation = [0, 0, 0]) {
  let [rx, ry, rz] = rotation.map((degrees) => (Number(degrees) || 0) * Math.PI / 180);
  let cx = Math.cos(rx / 2);
  let sx = Math.sin(rx / 2);
  let cy = Math.cos(ry / 2);
  let sy = Math.sin(ry / 2);
  let cz = Math.cos(rz / 2);
  let sz = Math.sin(rz / 2);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ];
}

/**
 * @param {Array<number>} quaternion xyzw
 * @returns {Array<number>} Euler degrees with the provider convention.
 */
export function xrQuaternionToEulerDegrees(quaternion = [0, 0, 0, 1]) {
  let [x, y, z, w] = quaternion.map(Number);
  let sinrCosp = 2 * (w * x + y * z);
  let cosrCosp = 1 - 2 * (x * x + y * y);
  let roll = Math.atan2(sinrCosp, cosrCosp);
  let sinp = 2 * (w * y - z * x);
  let pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);
  let sinyCosp = 2 * (w * z + x * y);
  let cosyCosp = 1 - 2 * (y * y + z * z);
  let yaw = Math.atan2(sinyCosp, cosyCosp);
  return [roll, pitch, yaw].map((radians) => roundMetric(radians * 180 / Math.PI));
}

function baseReceipt(version, action, windowId, layoutId) {
  return {
    version,
    action,
    ...(windowId != null ? { windowId } : {}),
    ...(layoutId != null ? { layoutId } : {}),
  };
}

/**
 * @param {Object} input
 * @returns {Object} frozen `xr-spatial-window-sync-receipt-v1`.
 */
export function createXRSpatialWindowSyncReceipt(input = {}) {
  return freezeSpatialValue({
    version: XR_SPATIAL_WINDOW_SYNC_RECEIPT_VERSION,
    ok: input.ok === true,
    sequence: Number(input.sequence ?? 0),
    added: [...(input.added || [])],
    updated: [...(input.updated || [])],
    removed: [...(input.removed || [])],
    unchanged: [...(input.unchanged || [])],
    windows: (input.windows || []).map((entry) => ({ ...entry })),
    errors: (input.errors || []).map((entry) => ({ ...entry })),
    entered: Boolean(input.entered),
    sceneSynced: Boolean(input.sceneSynced),
  });
}

/**
 * @param {string} action
 * @param {Object} input
 * @returns {Object} frozen `xr-spatial-window-lifecycle-receipt-v1`.
 */
export function createXRSpatialWindowLifecycleReceipt(action, input = {}) {
  return freezeSpatialValue({
    ...baseReceipt(XR_SPATIAL_WINDOW_LIFECYCLE_RECEIPT_VERSION, action, input.windowId, input.layoutId),
    ok: input.ok === true,
    ...(input.reason != null ? { reason: input.reason } : { reason: null }),
    details: input.details && typeof input.details === 'object' ? { ...input.details } : {},
  });
}

/**
 * @param {string} phase 'begin' | 'preview' | 'commit' | 'cancel'
 * @param {Object} input
 * @returns {Object} frozen `xr-spatial-window-resize-receipt-v1`.
 */
export function createXRSpatialWindowResizeReceipt(phase, input = {}) {
  return freezeSpatialValue({
    ...baseReceipt(XR_SPATIAL_WINDOW_RESIZE_RECEIPT_VERSION, input.action || 'resize', input.windowId, input.layoutId),
    ok: input.ok === true,
    phase,
    ...(input.reason != null ? { reason: input.reason } : { reason: null }),
    handle: input.handle ?? null,
    committedSizeMeters: input.committedSizeMeters ? [...input.committedSizeMeters] : null,
    previewSizeMeters: input.previewSizeMeters ? [...input.previewSizeMeters] : null,
    sizeMeters: input.sizeMeters ? [...input.sizeMeters] : null,
    viewport: input.viewport ? { ...input.viewport } : null,
    contentScaled: Boolean(input.contentScaled),
    geometrySwapped: Boolean(input.geometrySwapped),
    rolledBack: Boolean(input.rolledBack),
    texture: input.texture
      ? {
        uploaded: Boolean(input.texture.uploaded),
        stage: input.texture.stage ?? null,
        reason: input.texture.reason ?? null,
        width: Number.isFinite(Number(input.texture.width)) ? Number(input.texture.width) : null,
        height: Number.isFinite(Number(input.texture.height)) ? Number(input.texture.height) : null,
      }
      : null,
  });
}

/**
 * @param {Object} input
 * @returns {Object} frozen `xr-spatial-window-relay-receipt-v1`.
 */
export function createXRSpatialWindowRelayReceipt(input = {}) {
  return freezeSpatialValue({
    ...baseReceipt(XR_SPATIAL_WINDOW_RELAY_RECEIPT_VERSION, input.action || 'route-ray', input.windowId, input.layoutId),
    ok: input.ok === true,
    routed: Boolean(input.routed),
    ...(input.reason != null ? { reason: input.reason } : { reason: null }),
    zone: input.zone ?? null,
    point: input.point ? { ...input.point } : null,
    source: input.source ?? null,
    relay: input.relay ? { ...input.relay } : null,
  });
}

function optionalNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function normalizeCapture(input) {
  if (!input || typeof input !== 'object') return null;
  return {
    sourceId: input.sourceId ?? null,
    sessionId: input.sessionId ?? null,
    pointerId: input.pointerId ?? null,
  };
}

function normalizePoint2(input) {
  if (!input || typeof input !== 'object') return null;
  return {
    x: optionalNumber(input.x),
    y: optionalNumber(input.y),
  };
}

function normalizeScrollOffsets(input) {
  if (!input || typeof input !== 'object') return null;
  return {
    left: optionalNumber(input.left),
    top: optionalNumber(input.top),
  };
}

/**
 * @param {Object} input
 * @returns {Object} frozen `xr-spatial-window-scroll-receipt-v1`.
 */
export function createXRSpatialWindowScrollReceipt(input = {}) {
  return freezeSpatialValue({
    ...baseReceipt(XR_SPATIAL_WINDOW_SCROLL_RECEIPT_VERSION, 'scroll', input.windowId, input.layoutId),
    ok: input.ok === true,
    ...(input.reason != null ? { reason: input.reason } : { reason: null }),
    phase: XR_SPATIAL_WINDOW_SCROLL_PHASES.includes(input.phase) ? input.phase : 'update',
    kind: XR_SPATIAL_WINDOW_SCROLL_KINDS.includes(input.kind) ? input.kind : 'wheel',
    point: normalizePoint2(input.point),
    delta: input.delta
      ? {
        x: optionalNumber(input.delta.x),
        y: optionalNumber(input.delta.y),
        mode: input.delta.mode || 'content-pixels',
      }
      : null,
    capture: normalizeCapture(input.capture),
    scroll: input.scroll
      ? {
        targetId: input.scroll.targetId ?? null,
        before: normalizeScrollOffsets(input.scroll.before),
        after: normalizeScrollOffsets(input.scroll.after),
        applied: input.scroll.applied
          ? { x: optionalNumber(input.scroll.applied.x), y: optionalNumber(input.scroll.applied.y) }
          : null,
      }
      : null,
    totals: input.totals
      ? { x: optionalNumber(input.totals.x), y: optionalNumber(input.totals.y) }
      : null,
    paintRequested: Boolean(input.paintRequested),
    source: input.source ?? null,
  });
}

/**
 * @param {Object} input
 * @returns {Object} frozen `xr-spatial-window-selection-receipt-v1`.
 */
export function createXRSpatialWindowSelectionReceipt(input = {}) {
  return freezeSpatialValue({
    ...baseReceipt(XR_SPATIAL_WINDOW_SELECTION_RECEIPT_VERSION, 'selection', input.windowId, input.layoutId),
    ok: input.ok === true,
    ...(input.reason != null ? { reason: input.reason } : { reason: null }),
    phase: XR_SPATIAL_WINDOW_SELECTION_PHASES.includes(input.phase) ? input.phase : 'update',
    point: normalizePoint2(input.point),
    startPoint: normalizePoint2(input.startPoint),
    capture: normalizeCapture(input.capture),
    selection: input.selection
      ? {
        text: typeof input.selection.text === 'string' ? input.selection.text : '',
        anchorOffset: optionalNumber(input.selection.anchorOffset),
        focusOffset: optionalNumber(input.selection.focusOffset),
        rangeCount: optionalNumber(input.selection.rangeCount),
      }
      : null,
    source: input.source ?? null,
  });
}

/**
 * @param {string} action 'content-focus' | 'content-blur' | 'content-focus-cancel'
 * @param {Object} input
 * @returns {Object} frozen `xr-spatial-window-focus-receipt-v1`.
 */
export function createXRSpatialWindowFocusReceipt(action, input = {}) {
  let normalizedAction = XR_SPATIAL_WINDOW_FOCUS_ACTIONS.includes(action) ? action : 'content-focus';
  return freezeSpatialValue({
    ...baseReceipt(XR_SPATIAL_WINDOW_FOCUS_RECEIPT_VERSION, normalizedAction, input.windowId, input.layoutId),
    ok: input.ok === true,
    ...(input.reason != null ? { reason: input.reason } : { reason: null }),
    target: input.target
      ? {
        targetId: input.target.targetId ?? null,
        tagName: input.target.tagName ?? null,
        editable: Boolean(input.target.editable),
        focusable: Boolean(input.target.focusable),
      }
      : null,
    focused: typeof input.focused === 'boolean' ? input.focused : null,
    ime: input.ime
      ? {
        mode: XR_SPATIAL_WINDOW_IME_MODES.includes(input.ime.mode) ? input.ime.mode : 'unavailable',
        ...(input.ime.reason != null ? { reason: input.ime.reason } : { reason: null }),
        handoff: input.ime.handoff
          ? {
            targetId: input.ime.handoff.targetId ?? null,
            editable: Boolean(input.ime.handoff.editable),
            inputType: input.ime.handoff.inputType ?? null,
            multiline: Boolean(input.ime.handoff.multiline),
            hasValue: Boolean(input.ime.handoff.hasValue),
            valueLength: Number.isFinite(Number(input.ime.handoff.valueLength)) ? Number(input.ime.handoff.valueLength) : 0,
          }
          : null,
      }
      : null,
    releasedCapture: input.releasedCapture
      ? {
        selection: Boolean(input.releasedCapture.selection),
        scroll: Boolean(input.releasedCapture.scroll),
      }
      : null,
    source: input.source ?? null,
  });
}

/**
 * @param {Object} input
 * @returns {Object} frozen `xr-spatial-window-viewport-receipt-v1`.
 */
export function createXRSpatialWindowViewportReceipt(input = {}) {
  return freezeSpatialValue({
    ...baseReceipt(XR_SPATIAL_WINDOW_VIEWPORT_RECEIPT_VERSION, 'viewport-update', input.windowId, input.layoutId),
    ok: input.ok === true,
    ...(input.reason != null ? { reason: input.reason } : { reason: null }),
    viewport: input.viewport ? { ...input.viewport } : null,
    previousViewport: input.previousViewport ? { ...input.previousViewport } : null,
    sizeMeters: input.sizeMeters ? [...input.sizeMeters] : null,
    preserved: input.preserved
      ? {
        focus: Boolean(input.preserved.focus),
        formValues: Boolean(input.preserved.formValues),
        selection: Boolean(input.preserved.selection),
        scroll: Boolean(input.preserved.scroll),
      }
      : null,
    remounted: Boolean(input.remounted),
    rolledBack: Boolean(input.rolledBack),
    paintRequested: Boolean(input.paintRequested),
    texture: input.texture
      ? {
        uploaded: Boolean(input.texture.uploaded),
        stage: input.texture.stage ?? null,
        reason: input.texture.reason ?? null,
        width: optionalNumber(input.texture.width),
        height: optionalNumber(input.texture.height),
      }
      : null,
  });
}

/**
 * @param {Object} input
 * @returns {Object} frozen `xr-spatial-window-fallback-v1`.
 */
export function createXRSpatialWindowFallback(input = {}) {
  return freezeSpatialValue({
    version: XR_SPATIAL_WINDOW_FALLBACK_VERSION,
    windowId: input.windowId ?? null,
    layoutId: input.layoutId ?? null,
    mode: XR_SPATIAL_WINDOW_FALLBACK_MODES.includes(input.mode) ? input.mode : 'none',
    source: input.source ?? null,
    ...(input.reason != null ? { reason: input.reason } : { reason: null }),
    upload: input.upload ? { ...input.upload } : null,
  });
}

/**
 * @param {Object} input
 * @returns {Object} frozen `xr-spatial-window-theme-redraw-receipt-v1`.
 */
export function createXRSpatialWindowThemeRedrawReceipt(input = {}) {
  return freezeSpatialValue({
    version: XR_SPATIAL_WINDOW_THEME_REDRAW_RECEIPT_VERSION,
    action: 'theme-redraw',
    ok: input.ok === true,
    themeScope: input.themeScope || null,
    windowIds: Array.isArray(input.windowIds) ? [...input.windowIds] : [],
    beforeRevision: input.beforeRevision ? { ...input.beforeRevision } : {},
    afterRevision: input.afterRevision ? { ...input.afterRevision } : {},
    counters: {
      beforeUploads: Number(input.counters?.beforeUploads ?? 0),
      afterUploads: Number(input.counters?.afterUploads ?? 0),
      beforeReuses: Number(input.counters?.beforeReuses ?? 0),
      afterReuses: Number(input.counters?.afterReuses ?? 0),
    },
    bindingHash: input.bindingHash || null,
    affectedWindows: Array.isArray(input.affectedWindows) ? [...input.affectedWindows] : [],
    reusedWindows: Array.isArray(input.reusedWindows) ? [...input.reusedWindows] : [],
    windowResults: Array.isArray(input.windowResults) ? [...input.windowResults] : [],
    evidenceDigest: input.evidenceDigest || null,
  });
}

export function sortKeys(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  let sorted = {};
  for (let key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key]);
  }
  return sorted;
}

export function stringifyCanonical(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(stringifyCanonical).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const properties = keys.map((key) => {
    return JSON.stringify(key) + ':' + stringifyCanonical(obj[key]);
  });
  return '{' + properties.join(',') + '}';
}

// Pure JS SHA-256 implementation
export function sha256Sync(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i, j; // Database

  // Constants
  const hash = [];
  const k = [];
  let primeCounter = 0;

  const isPrime = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isPrime[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isPrime[i] = 1;
      }
      hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  
  // Convert string to UTF-8 bytes to correctly support multi-byte characters
  const encoder = new TextEncoder();
  const bytes = encoder.encode(ascii);
  
  // Pad the bytes
  const words = [];
  const byteLength = bytes.length;
  const bitLength = byteLength * 8;
  
  for (i = 0; i < byteLength; i++) {
    words[i >> 2] |= bytes[i] << ((3 - i % 4) * 8);
  }
  
  // Append the 1 bit
  words[byteLength >> 2] |= 0x80 << ((3 - byteLength % 4) * 8);
  
  // Pad with zeros until length is 56 bytes (14 words) mod 64
  const paddedLengthWords = (((byteLength + 8) >> 6) + 1) * 16;
  while (words.length < paddedLengthWords - 2) {
    words.push(0);
  }
  
  // Append original length in bits as 64-bit integer
  words.push((bitLength / maxWord) | 0);
  words.push(bitLength | 0);
  
  // Process each 512-bit chunk
  for (j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = [...hash];
    
    for (i = 0; i < 64; i++) {
      const w16 = w[i - 16] || 0, w15 = w[i - 15] || 0, w7 = w[i - 7] || 0, w2 = w[i - 2] || 0;
      const a = hash[0], e = hash[4];
      
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      
      if (i >= 16) {
        w[i] = (w16 + s0 + w7 + s1) | 0;
      }
      
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & hash[5]) ^ (~e & hash[6]);
      const temp1 = (hash[7] + S1 + ch + k[i] + w[i]) | 0;
      
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (S0 + maj) | 0;
      
      hash.unshift((temp1 + temp2) | 0);
      hash.pop();
      hash[4] = (hash[4] + temp1) | 0;
    }
    
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  
  let hex = '';
  for (i = 0; i < 8; i++) {
    const word = hash[i];
    hex += ((word >>> 24) & 0xff).toString(16).padStart(2, '0')
        + ((word >>> 16) & 0xff).toString(16).padStart(2, '0')
        + ((word >>> 8) & 0xff).toString(16).padStart(2, '0')
        + (word & 0xff).toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Deterministic evidence digest: canonical SHA-256, exact 64 lowercase hex.
 * Suitable for proving integrity/self-consistency.
 */
export async function computeXREvidenceDigest(value) {
  const serialized = stringifyCanonical(value);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(serialized);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  try {
    const cryptoModule = await import('node:crypto');
    return cryptoModule.createHash('sha256').update(serialized).digest('hex');
  } catch (e) {}
  
  return sha256Sync(serialized);
}

/**
 * Deterministic evidence digest sync: canonical SHA-256 fallback, exact 64 lowercase hex.
 * Suitable for proving integrity/self-consistency.
 */
export function computeXREvidenceDigestSync(value) {
  const serialized = stringifyCanonical(value);
  return sha256Sync(serialized);
}

/**
 * Fast cache hash (FNV-1a/32).
 * WARNING: This is only a cache hash, not an evidence digest. Never use for integrity verification.
 */
export function digest(value) {
  let text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export const computeXRCacheHash = digest;

function getRectangleIntersection(r1, r2) {
  if (!r1 || !r2) return 0;
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

export function validateXRThemeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { ok: false, reason: 'snapshot-must-be-object' };
  }
  const snapshotKeys = new Set(['version', 'themeScope', 'tokens', 'material']);
  for (let key of Object.keys(snapshot)) {
    if (!snapshotKeys.has(key)) {
      return { ok: false, reason: `disallowed-snapshot-property-${key}` };
    }
  }
  for (let key of snapshotKeys) {
    if (!(key in snapshot)) {
      return { ok: false, reason: `missing-snapshot-property-${key}` };
    }
  }
  if (snapshot.version !== 'xr-theme-snapshot-v1') {
    return { ok: false, reason: 'invalid-snapshot-version' };
  }
  if (snapshot.themeScope !== null && typeof snapshot.themeScope !== 'string') {
    return { ok: false, reason: 'themeScope-must-be-string-or-null' };
  }

  // tokens
  let tokens = snapshot.tokens;
  if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
    return { ok: false, reason: 'tokens-must-be-object' };
  }
  const requiredTokens = [
    '--sn-xr-panel-bg',
    '--sn-xr-panel-border',
    '--sn-xr-panel-radius',
    '--sn-xr-panel-shadow',
    '--sn-xr-pointer-color',
    '--sn-sys-on-surface',
    '--sn-sys-on-surface-dim',
    '--sn-duration-fast',
    '--sn-ease-standard',
    '--sn-layout-resizer-size'
  ];
  for (let key of requiredTokens) {
    if (!(key in tokens)) {
      return { ok: false, reason: `missing-token-property-${key}` };
    }
  }
  for (let [key, val] of Object.entries(tokens)) {
    if (!key.startsWith('--')) {
      return { ok: false, reason: `disallowed-token-property-${key}` };
    }
    if (typeof val !== 'string') {
      return { ok: false, reason: `token-${key}-must-be-string` };
    }
  }

  // material
  let materialRes = validateXRThemeMaterial(snapshot.material);
  if (!materialRes.ok) {
    return materialRes;
  }

  return { ok: true };
}

export function validateXRThemeMaterial(material) {
  if (material === null) {
    return { ok: true };
  }
  if (typeof material !== 'object' || Array.isArray(material)) {
    return { ok: false, reason: 'material-must-be-object-or-null' };
  }
  const materialKeys = new Set([
    'background',
    'backgroundColor',
    'border',
    'borderColor',
    'radius',
    'shadow',
    'pointer',
    'pointerColor',
    'text',
    'textColor',
    'textDim',
    'textDimColor',
    'gap',
    'motion'
  ]);
  for (let key of Object.keys(material)) {
    if (!materialKeys.has(key)) {
      return { ok: false, reason: `disallowed-material-property-${key}` };
    }
  }
  for (let key of materialKeys) {
    if (!(key in material)) {
      return { ok: false, reason: `missing-material-property-${key}` };
    }
  }

  const stringProps = ['background', 'border', 'radius', 'shadow', 'pointer', 'text', 'textDim', 'gap'];
  for (let key of stringProps) {
    if (typeof material[key] !== 'string') {
      return { ok: false, reason: `material-${key}-must-be-string` };
    }
  }

  const anyProps = ['backgroundColor', 'borderColor', 'pointerColor', 'textColor', 'textDimColor'];
  for (let key of anyProps) {
    let val = material[key];
    if (typeof val !== 'string' && typeof val !== 'number') {
      return { ok: false, reason: `material-${key}-must-be-string-or-number` };
    }
  }

  let motion = material.motion;
  if (!motion || typeof motion !== 'object' || Array.isArray(motion)) {
    return { ok: false, reason: 'motion-must-be-object' };
  }
  const motionKeys = new Set(['duration', 'easing']);
  for (let key of Object.keys(motion)) {
    if (!motionKeys.has(key)) {
      return { ok: false, reason: `disallowed-motion-property-${key}` };
    }
  }
  for (let key of motionKeys) {
    if (!(key in motion)) {
      return { ok: false, reason: `missing-motion-property-${key}` };
    }
    if (typeof motion[key] !== 'string') {
      return { ok: false, reason: `motion-${key}-must-be-string` };
    }
  }

  return { ok: true };
}

export function validateXRThemeInput(input) {
  if (input === null || input === undefined) {
    return { ok: true };
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, reason: 'theme-input-must-be-object' };
  }
  const allowedKeys = new Set(['version', 'themeScope', 'tokens', 'material', 'global', 'root']);
  for (let key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, reason: `disallowed-input-property-${key}` };
    }
  }

  if (input.version !== undefined && input.version !== 'xr-theme-snapshot-v1') {
    return { ok: false, reason: 'invalid-input-version' };
  }

  if (input.themeScope !== undefined && input.themeScope !== null && typeof input.themeScope !== 'string') {
    return { ok: false, reason: 'themeScope-must-be-string-or-null' };
  }

  if (input.global !== undefined && typeof input.global !== 'boolean') {
    return { ok: false, reason: 'global-must-be-boolean' };
  }

  // root
  if (input.root !== undefined) {
    let r = input.root;
    if (!r || typeof r !== 'object' || Array.isArray(r)) {
      return { ok: false, reason: 'root-must-be-object' };
    }
    if (r.nodeType === 11) {
      return { ok: false, reason: 'unsupported-cascade-root' };
    }
    let isDoc = (r.nodeType === 9 || (r.documentElement && typeof r.createElement === 'function'));
    let isElem = (r.nodeType === 1 && r.ownerDocument && r.style && typeof r.getAttribute === 'function');
    if (!isDoc && !isElem) {
      return { ok: false, reason: 'unsupported-cascade-root' };
    }
  }

  // tokens
  if (input.tokens !== undefined) {
    let tokens = input.tokens;
    if (tokens === null || typeof tokens !== 'object' || Array.isArray(tokens)) {
      return { ok: false, reason: 'tokens-must-be-object' };
    }
    for (let [key, val] of Object.entries(tokens)) {
      if (!key.startsWith('--')) {
        return { ok: false, reason: `disallowed-token-property-${key}` };
      }
      if (typeof val !== 'string') {
        return { ok: false, reason: `token-${key}-must-be-string` };
      }
    }
  }

  // material
  if (input.material !== undefined && input.material !== null) {
    let material = input.material;
    if (typeof material !== 'object' || Array.isArray(material)) {
      return { ok: false, reason: 'material-must-be-object-or-null' };
    }
    const materialKeys = new Set([
      'background',
      'backgroundColor',
      'border',
      'borderColor',
      'radius',
      'shadow',
      'pointer',
      'pointerColor',
      'text',
      'textColor',
      'textDim',
      'textDimColor',
      'gap',
      'motion'
    ]);
    for (let key of Object.keys(material)) {
      if (!materialKeys.has(key)) {
        return { ok: false, reason: `disallowed-material-property-${key}` };
      }
    }

    const stringProps = ['background', 'border', 'radius', 'shadow', 'pointer', 'text', 'textDim', 'gap'];
    for (let key of stringProps) {
      if (material[key] !== undefined && typeof material[key] !== 'string') {
        return { ok: false, reason: `material-${key}-must-be-string` };
      }
    }

    const anyProps = ['backgroundColor', 'borderColor', 'pointerColor', 'textColor', 'textDimColor'];
    for (let key of anyProps) {
      if (material[key] !== undefined && typeof material[key] !== 'string' && typeof material[key] !== 'number') {
        return { ok: false, reason: `material-${key}-must-be-string-or-number` };
      }
    }

    if (material.motion !== undefined) {
      let motion = material.motion;
      if (motion === null || typeof motion !== 'object' || Array.isArray(motion)) {
        return { ok: false, reason: 'motion-must-be-object' };
      }
      const motionKeys = new Set(['duration', 'easing']);
      for (let key of Object.keys(motion)) {
        if (!motionKeys.has(key)) {
          return { ok: false, reason: `disallowed-motion-property-${key}` };
        }
        if (typeof motion[key] !== 'string') {
          return { ok: false, reason: `motion-${key}-must-be-string` };
        }
      }
    }
  }

  return { ok: true };
}

export function canonicalizeThemeSnapshot(input, documentRef = null) {
  let baseSnapshot = createXRThemeSnapshot(documentRef, { themeScope: input?.themeScope });
  
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return baseSnapshot;
  }
  
  let themeScope = input.themeScope || baseSnapshot.themeScope;
  let tokens = { ...baseSnapshot.tokens, ...(input.tokens || {}) };
  
  let material = null;
  if (input.material !== null) {
    let baseMaterial = baseSnapshot.material || {};
    let inputMaterial = input.material || {};
    let motion = {
      duration: inputMaterial.motion?.duration || baseMaterial.motion?.duration || '120ms',
      easing: inputMaterial.motion?.easing || baseMaterial.motion?.easing || 'ease',
    };
    material = {
      background: inputMaterial.background !== undefined ? String(inputMaterial.background) : baseMaterial.background,
      backgroundColor: inputMaterial.backgroundColor !== undefined ? inputMaterial.backgroundColor : baseMaterial.backgroundColor,
      border: inputMaterial.border !== undefined ? String(inputMaterial.border) : baseMaterial.border,
      borderColor: inputMaterial.borderColor !== undefined ? inputMaterial.borderColor : baseMaterial.borderColor,
      radius: inputMaterial.radius !== undefined ? String(inputMaterial.radius) : baseMaterial.radius,
      shadow: inputMaterial.shadow !== undefined ? String(inputMaterial.shadow) : baseMaterial.shadow,
      pointer: inputMaterial.pointer !== undefined ? String(inputMaterial.pointer) : baseMaterial.pointer,
      pointerColor: inputMaterial.pointerColor !== undefined ? inputMaterial.pointerColor : baseMaterial.pointerColor,
      text: inputMaterial.text !== undefined ? String(inputMaterial.text) : baseMaterial.text,
      textColor: inputMaterial.textColor !== undefined ? inputMaterial.textColor : baseMaterial.textColor,
      textDim: inputMaterial.textDim !== undefined ? String(inputMaterial.textDim) : baseMaterial.textDim,
      textDimColor: inputMaterial.textDimColor !== undefined ? inputMaterial.textDimColor : baseMaterial.textDimColor,
      gap: inputMaterial.gap !== undefined ? String(inputMaterial.gap) : baseMaterial.gap,
      motion
    };
  }
  
  return {
    version: 'xr-theme-snapshot-v1',
    themeScope,
    tokens,
    material
  };
}

/**
 * Validates theme redraw receipt self-consistency synchronously.
 * @param {Object} receipt
 * @returns {Object} `{ ok: boolean, reason?: string, type?: 'redraw' | 'no-op' }`
 */
export function validateXRSpatialWindowThemeRedrawReceiptStructure(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return { ok: false, reason: 'receipt-must-be-object' };
  }

  const expectedTopLevel = new Set([
    'version', 'action', 'ok', 'themeScope', 'windowIds',
    'beforeRevision', 'afterRevision', 'counters', 'bindingHash',
    'affectedWindows', 'reusedWindows', 'windowResults', 'evidenceDigest'
  ]);

  for (let key of Object.keys(receipt)) {
    if (!expectedTopLevel.has(key)) {
      return { ok: false, reason: `disallowed-top-level-property-${key}` };
    }
  }

  for (let key of expectedTopLevel) {
    if (!(key in receipt)) {
      return { ok: false, reason: `missing-required-property-${key}` };
    }
  }

  if (receipt.version !== 'xr-spatial-window-theme-redraw-receipt-v1') {
    return { ok: false, reason: 'invalid-version' };
  }

  if (receipt.action !== 'theme-redraw') {
    return { ok: false, reason: 'invalid-action' };
  }

  if (typeof receipt.ok !== 'boolean') {
    return { ok: false, reason: 'ok-must-be-boolean' };
  }

  if (receipt.themeScope !== null && typeof receipt.themeScope !== 'string') {
    return { ok: false, reason: 'themeScope-must-be-string-or-null' };
  }

  if (!Array.isArray(receipt.windowIds) || receipt.windowIds.some(id => typeof id !== 'string')) {
    return { ok: false, reason: 'windowIds-must-be-array-of-strings' };
  }

  if (!Array.isArray(receipt.affectedWindows) || receipt.affectedWindows.some(id => typeof id !== 'string')) {
    return { ok: false, reason: 'affectedWindows-must-be-array-of-strings' };
  }

  if (!Array.isArray(receipt.reusedWindows) || receipt.reusedWindows.some(id => typeof id !== 'string')) {
    return { ok: false, reason: 'reusedWindows-must-be-array-of-strings' };
  }

  // beforeRevision
  if (!receipt.beforeRevision || typeof receipt.beforeRevision !== 'object' || Array.isArray(receipt.beforeRevision)) {
    return { ok: false, reason: 'beforeRevision-must-be-object' };
  }
  for (let [k, v] of Object.entries(receipt.beforeRevision)) {
    if (!Number.isInteger(v)) {
      return { ok: false, reason: `beforeRevision-value-for-${k}-must-be-integer` };
    }
  }

  // afterRevision
  if (!receipt.afterRevision || typeof receipt.afterRevision !== 'object' || Array.isArray(receipt.afterRevision)) {
    return { ok: false, reason: 'afterRevision-must-be-object' };
  }
  for (let [k, v] of Object.entries(receipt.afterRevision)) {
    if (!Number.isInteger(v)) {
      return { ok: false, reason: `afterRevision-value-for-${k}-must-be-integer` };
    }
  }

  // counters
  if (!receipt.counters || typeof receipt.counters !== 'object' || Array.isArray(receipt.counters)) {
    return { ok: false, reason: 'counters-must-be-object' };
  }
  const counterKeys = new Set(['beforeUploads', 'afterUploads', 'beforeReuses', 'afterReuses']);
  for (let key of Object.keys(receipt.counters)) {
    if (!counterKeys.has(key)) {
      return { ok: false, reason: `disallowed-counters-property-${key}` };
    }
  }
  for (let key of counterKeys) {
    if (!(key in receipt.counters)) {
      return { ok: false, reason: `missing-counters-property-${key}` };
    }
    let val = receipt.counters[key];
    if (!Number.isInteger(val) || val < 0) {
      return { ok: false, reason: `counters-${key}-must-be-non-negative-integer` };
    }
  }

  if (receipt.bindingHash !== null && typeof receipt.bindingHash !== 'string') {
    return { ok: false, reason: 'bindingHash-must-be-string-or-null' };
  }

  if (typeof receipt.evidenceDigest !== 'string' || !/^[0-9a-f]{64}$/.test(receipt.evidenceDigest)) {
    return { ok: false, reason: 'invalid-evidenceDigest-format' };
  }

  // windowResults
  if (!Array.isArray(receipt.windowResults)) {
    return { ok: false, reason: 'windowResults-must-be-array' };
  }

  const expectedResultKeys = new Set([
    'windowId', 'themeScope', 'beforeRevision', 'afterRevision',
    'snapshot', 'requestedMaterial', 'actualMaterial', 'outcome',
    'counters', 'hash'
  ]);

  const allowedOutcomes = new Set(['upload', 'reuse', 'skipped']);

  for (let i = 0; i < receipt.windowResults.length; i++) {
    let r = receipt.windowResults[i];
    if (!r || typeof r !== 'object' || Array.isArray(r)) {
      return { ok: false, reason: `windowResults-item-at-index-${i}-must-be-object` };
    }

    for (let key of Object.keys(r)) {
      if (!expectedResultKeys.has(key)) {
        return { ok: false, reason: `disallowed-windowResults-property-${key}-at-index-${i}` };
      }
    }

    for (let key of expectedResultKeys) {
      if (!(key in r)) {
        return { ok: false, reason: `missing-windowResults-property-${key}-at-index-${i}` };
      }
    }

    if (typeof r.windowId !== 'string') {
      return { ok: false, reason: `windowResults-windowId-at-index-${i}-must-be-string` };
    }
    if (typeof r.themeScope !== 'string') {
      return { ok: false, reason: `windowResults-themeScope-at-index-${i}-must-be-string` };
    }
    if (!Number.isInteger(r.beforeRevision) || r.beforeRevision < 0) {
      return { ok: false, reason: `windowResults-beforeRevision-at-index-${i}-must-be-non-negative-integer` };
    }
    if (!Number.isInteger(r.afterRevision) || r.afterRevision < 0) {
      return { ok: false, reason: `windowResults-afterRevision-at-index-${i}-must-be-non-negative-integer` };
    }

    if (r.snapshot !== null && (typeof r.snapshot !== 'object' || Array.isArray(r.snapshot))) {
      return { ok: false, reason: `windowResults-snapshot-at-index-${i}-must-be-object-or-null` };
    }
    if (r.requestedMaterial !== null && (typeof r.requestedMaterial !== 'object' || Array.isArray(r.requestedMaterial))) {
      return { ok: false, reason: `windowResults-requestedMaterial-at-index-${i}-must-be-object-or-null` };
    }
    if (r.actualMaterial !== null && (typeof r.actualMaterial !== 'object' || Array.isArray(r.actualMaterial))) {
      return { ok: false, reason: `windowResults-actualMaterial-at-index-${i}-must-be-object-or-null` };
    }


    if (typeof r.outcome !== 'string' || !allowedOutcomes.has(r.outcome)) {
      return { ok: false, reason: `windowResults-outcome-at-index-${i}-must-be-valid-enum` };
    }

    // windowResults counters
    if (!r.counters || typeof r.counters !== 'object' || Array.isArray(r.counters)) {
      return { ok: false, reason: `windowResults-counters-at-index-${i}-must-be-object` };
    }
    for (let key of Object.keys(r.counters)) {
      if (!counterKeys.has(key)) {
        return { ok: false, reason: `disallowed-windowResults-counters-property-${key}-at-index-${i}` };
      }
    }
    for (let key of counterKeys) {
      if (!(key in r.counters)) {
        return { ok: false, reason: `missing-windowResults-counters-property-${key}-at-index-${i}` };
      }
      let val = r.counters[key];
      if (!Number.isInteger(val) || val < 0) {
        return { ok: false, reason: `windowResults-counters-${key}-at-index-${i}-must-be-non-negative-integer` };
      }
    }

    if (typeof r.hash !== 'string') {
      return { ok: false, reason: `windowResults-hash-at-index-${i}-must-be-string` };
    }
  }

  return { ok: true };
}

/**
 * Validates theme redraw receipt self-consistency synchronously.
 * @param {Object} receipt
 * @returns {Object} `{ ok: boolean, reason?: string, type?: 'redraw' | 'no-op' }`
 */
export function validateXRSpatialWindowThemeRedrawReceiptSelfConsistencySync(receipt) {
  let structRes = validateXRSpatialWindowThemeRedrawReceiptStructure(receipt);
  if (!structRes.ok) {
    return structRes;
  }

  // Validate the evidence digest over every semantic field of the receipt envelope
  const envelopeToHash = { ...receipt };
  delete envelopeToHash.evidenceDigest;
  const expectedEvidenceDigest = computeXREvidenceDigestSync(envelopeToHash);
  if (receipt.evidenceDigest !== expectedEvidenceDigest) {
    return { ok: false, reason: 'evidenceDigest-recomputation-mismatch' };
  }

  let windowIdsSet = new Set(receipt.windowIds);
  if (windowIdsSet.size !== receipt.windowIds.length) {
    return { ok: false, reason: 'duplicate-windowIds' };
  }
  
  let affectedSet = new Set(receipt.affectedWindows);
  if (affectedSet.size !== receipt.affectedWindows.length) {
    return { ok: false, reason: 'duplicate-affectedWindows' };
  }
  
  let reusedSet = new Set(receipt.reusedWindows);
  if (reusedSet.size !== receipt.reusedWindows.length) {
    return { ok: false, reason: 'duplicate-reusedWindows' };
  }

  // Partition check: affectedWindows and reusedWindows must partition windowIds
  for (let id of affectedSet) {
    if (!windowIdsSet.has(id)) {
      return { ok: false, reason: `foreign-affected-id-${id}` };
    }
  }
  for (let id of reusedSet) {
    if (!windowIdsSet.has(id)) {
      return { ok: false, reason: `foreign-reused-id-${id}` };
    }
  }
  for (let id of affectedSet) {
    if (reusedSet.has(id)) {
      return { ok: false, reason: `duplicate-id-in-both-partitions-${id}` };
    }
  }
  if (affectedSet.size + reusedSet.size !== windowIdsSet.size) {
    return { ok: false, reason: 'partitions-do-not-cover-windowIds' };
  }

  if (receipt.affectedWindows.length === 0) {
    if (receipt.ok === true) {
      return { ok: false, reason: 'empty-or-no-op-transition-cannot-claim-ok' };
    }
  }

  let hasRedrawOutcome = receipt.windowResults.some(r =>
    receipt.affectedWindows.includes(r.windowId) && (r.outcome === 'upload' || r.outcome === 'reuse')
  );
  if (receipt.ok === true && !hasRedrawOutcome) {
    return { ok: false, reason: 'trusted-success-requires-active-session-and-redraw' };
  }

  if (receipt.windowResults.length !== receipt.windowIds.length) {
    return { ok: false, reason: 'windowResults-length-mismatch' };
  }
  let resultsSet = new Set(receipt.windowResults.map(r => r.windowId));
  if (resultsSet.size !== receipt.windowResults.length) {
    return { ok: false, reason: 'duplicate-windowId-in-results' };
  }

  for (let r of receipt.windowResults) {
    if (!windowIdsSet.has(r.windowId)) {
      return { ok: false, reason: `unknown-windowId-in-results-${r.windowId}` };
    }
  }

  let expectedBeforeUploads = 0;
  let expectedAfterUploads = 0;
  let expectedBeforeReuses = 0;
  let expectedAfterReuses = 0;
  let windowHashes = [];

  for (let r of receipt.windowResults) {
    let recordToHash = {
      windowId: r.windowId,
      themeScope: r.themeScope,
      beforeRevision: r.beforeRevision,
      afterRevision: r.afterRevision,
      snapshot: r.snapshot,
      requestedMaterial: r.requestedMaterial,
      actualMaterial: r.actualMaterial,
      outcome: r.outcome,
      counters: r.counters,
    };
    let expectedHash = computeXREvidenceDigestSync(recordToHash);
    if (r.hash !== expectedHash) {
      return { ok: false, reason: `incorrect-window-hash-for-${r.windowId}` };
    }
    windowHashes.push(r.hash);

    expectedBeforeUploads += r.counters.beforeUploads ?? 0;
    expectedAfterUploads += r.counters.afterUploads ?? 0;
    expectedBeforeReuses += r.counters.beforeReuses ?? 0;
    expectedAfterReuses += r.counters.afterReuses ?? 0;

    let expectedRequested = r.snapshot?.material ? r.snapshot.material : null;
    if (JSON.stringify(r.requestedMaterial) !== JSON.stringify(expectedRequested)) {
      return { ok: false, reason: `requestedMaterial-mismatch-with-snapshot-for-${r.windowId}` };
    }

    if (affectedSet.has(r.windowId)) {
      if (r.afterRevision !== r.beforeRevision + 1) {
        return { ok: false, reason: `revision-not-advanced-by-one-for-affected-window-${r.windowId}` };
      }
    } else {
      if (r.afterRevision !== r.beforeRevision) {
        return { ok: false, reason: `revision-changed-for-skipped-window-${r.windowId}` };
      }
      if (r.counters.afterUploads !== r.counters.beforeUploads || r.counters.afterReuses !== r.counters.beforeReuses) {
        return { ok: false, reason: `skipped-window-with-non-zero-delta-${r.windowId}` };
      }
    }
  }

  let counters = receipt.counters;
  if (counters.beforeUploads !== expectedBeforeUploads ||
      counters.afterUploads !== expectedAfterUploads ||
      counters.beforeReuses !== expectedBeforeReuses ||
      counters.afterReuses !== expectedAfterReuses) {
    return { ok: false, reason: 'counters-recomputation-mismatch' };
  }

  if (receipt.bindingHash !== null) {
    if (typeof receipt.bindingHash !== 'string' || !/^[0-9a-f]{64}$/.test(receipt.bindingHash)) {
      return { ok: false, reason: 'invalid-bindingHash-format' };
    }
  }

  let expectedBindingHash = computeXREvidenceDigestSync(windowHashes.sort());
  if (receipt.bindingHash !== expectedBindingHash) {
    return { ok: false, reason: 'bindingHash-recomputation-mismatch' };
  }

  if (receipt.ok) {
    for (let r of receipt.windowResults) {
      if (affectedSet.has(r.windowId)) {
        if (JSON.stringify(r.actualMaterial) !== JSON.stringify(r.requestedMaterial)) {
          return { ok: false, reason: `actualMaterial-mismatch-with-requestedMaterial-for-affected-window-${r.windowId}` };
        }

        if (r.outcome === 'upload') {
          if (r.counters.afterUploads !== r.counters.beforeUploads + 1 || r.counters.afterReuses !== r.counters.beforeReuses) {
            return { ok: false, reason: `invalid-upload-delta-for-affected-mounted-window-${r.windowId}` };
          }
        } else if (r.outcome === 'reuse') {
          if (r.counters.afterReuses !== r.counters.beforeReuses + 1 || r.counters.afterUploads !== r.counters.beforeUploads) {
            return { ok: false, reason: `invalid-reuse-delta-for-affected-mounted-window-${r.windowId}` };
          }
        } else if (r.outcome === 'accepted-without-redraw') {
          return { ok: false, reason: `disallowed-outcome-accepted-without-redraw-for-${r.windowId}` };
        } else {
          return { ok: false, reason: `invalid-outcome-for-affected-window-${r.windowId}` };
        }
      } else {
        if (r.outcome !== 'skipped') {
          return { ok: false, reason: `invalid-outcome-for-skipped-window-${r.windowId}` };
        }
      }
    }
  } else {
    for (let r of receipt.windowResults) {
      if (affectedSet.has(r.windowId)) {
        if (r.outcome === 'skipped') {
          return { ok: false, reason: `affected-window-cannot-have-skipped-outcome-${r.windowId}` };
        }
      } else {
        if (r.outcome !== 'skipped') {
          return { ok: false, reason: `invalid-outcome-for-skipped-window-${r.windowId}` };
        }
      }
    }
  }

  let beforeRevision = receipt.beforeRevision || {};
  let afterRevision = receipt.afterRevision || {};
  let beforeKeys = Object.keys(beforeRevision);
  let afterKeys = Object.keys(afterRevision);
  if (beforeKeys.length !== receipt.windowIds.length || afterKeys.length !== receipt.windowIds.length) {
    return { ok: false, reason: 'revision-maps-size-mismatch-with-windowIds' };
  }
  for (let id of beforeKeys) {
    if (!windowIdsSet.has(id)) {
      return { ok: false, reason: `foreign-id-in-beforeRevision-${id}` };
    }
    let val = beforeRevision[id];
    let r = receipt.windowResults.find(w => w.windowId === id);
    if (val !== r.beforeRevision) {
      return { ok: false, reason: `beforeRevision-mismatch-for-${id}` };
    }
  }
  for (let id of afterKeys) {
    if (!windowIdsSet.has(id)) {
      return { ok: false, reason: `foreign-id-in-afterRevision-${id}` };
    }
    let val = afterRevision[id];
    let r = receipt.windowResults.find(w => w.windowId === id);
    if (val !== r.afterRevision) {
      return { ok: false, reason: `afterRevision-mismatch-for-${id}` };
    }
  }

  for (let i = 0; i < receipt.windowResults.length; i++) {
    let r = receipt.windowResults[i];
    if (r.snapshot !== null) {
      let snapRes = validateXRThemeSnapshot(r.snapshot);
      if (!snapRes.ok) {
        return { ok: false, reason: `windowResults-snapshot-at-index-${i}-${snapRes.reason}` };
      }
    }
    if (r.requestedMaterial !== null) {
      let matRes = validateXRThemeMaterial(r.requestedMaterial);
      if (!matRes.ok) {
        return { ok: false, reason: `windowResults-requestedMaterial-at-index-${i}-${matRes.reason}` };
      }
    }
    if (r.actualMaterial !== null) {
      let matRes = validateXRThemeMaterial(r.actualMaterial);
      if (!matRes.ok) {
        return { ok: false, reason: `windowResults-actualMaterial-at-index-${i}-${matRes.reason}` };
      }
    }
  }

  let type = receipt.affectedWindows.length > 0 ? 'redraw' : 'no-op';
  return { ok: true, type };
}

/**
 * Validates theme redraw receipt against trusted observation synchronously.
 * @param {Object} receipt
 * @param {Object} trustedObservation
 * @returns {Object} `{ ok: boolean, reason?: string, type?: 'redraw' | 'no-op' }`
 */
export function validateXRSpatialWindowThemeRedrawReceiptAgainstTrustedObservationSync(receipt, trustedObservation) {
  if (!trustedObservation) {
    return { ok: false, reason: 'missing-trusted-observation' };
  }

  if (typeof trustedObservation !== 'object' || !('pre' in trustedObservation) || !('post' in trustedObservation)) {
    return { ok: false, reason: 'invalid-pre-post-observations' };
  }

  let selfRes = validateXRSpatialWindowThemeRedrawReceiptSelfConsistencySync(receipt);
  if (!selfRes.ok) {
    return selfRes;
  }

  let preWindows = [];
  if (Array.isArray(trustedObservation.pre)) {
    preWindows = trustedObservation.pre;
  } else if (trustedObservation.pre && Array.isArray(trustedObservation.pre.windows)) {
    preWindows = trustedObservation.pre.windows;
  } else if (trustedObservation.pre && typeof trustedObservation.pre === 'object') {
    preWindows = Object.values(trustedObservation.pre);
  }

  let postWindows = [];
  if (Array.isArray(trustedObservation.post)) {
    postWindows = trustedObservation.post;
  } else if (trustedObservation.post && Array.isArray(trustedObservation.post.windows)) {
    postWindows = trustedObservation.post.windows;
  } else if (trustedObservation.post && typeof trustedObservation.post === 'object') {
    postWindows = Object.values(trustedObservation.post);
  }

  let preMap = new Map();
  for (let w of preWindows) {
    if (w && w.windowId) preMap.set(w.windowId, w);
  }
  let postMap = new Map();
  for (let w of postWindows) {
    if (w && w.windowId) postMap.set(w.windowId, w);
  }

  if (preMap.size !== postMap.size) {
    return { ok: false, reason: 'pre-post-window-count-mismatch' };
  }
  for (let id of preMap.keys()) {
    if (!postMap.has(id)) {
      return { ok: false, reason: `window-${id}-missing-in-post-observation` };
    }
  }

  let expectedAffected = [];
  let expectedReused = [];
  for (let id of preMap.keys()) {
    let wPre = preMap.get(id);
    let wPost = postMap.get(id);
    let beforeRev = wPre.themeRevision ?? wPre.theme?.themeRevision ?? 0;
    let afterRev = wPost.themeRevision ?? wPost.theme?.themeRevision ?? 0;

    if (afterRev === beforeRev + 1) {
      expectedAffected.push(id);
    } else if (afterRev === beforeRev) {
      expectedReused.push(id);
    } else {
      return { ok: false, reason: `invalid-revision-transition-for-${id}` };
    }
  }

  let hasUnmountedAffected = expectedAffected.some(id => {
    let wPost = postMap.get(id);
    return !(wPost?.lifecycle?.mounted);
  });
  if (hasUnmountedAffected) {
    return { ok: false, reason: 'unsafe-unmounted-affected-window' };
  }

  let expectedWindowIds = expectedAffected.concat(expectedReused);

  let expectedType = expectedAffected.length > 0 ? 'redraw' : 'no-op';
  if (selfRes.type !== expectedType) {
    return { ok: false, reason: `transition-type-mismatch-expected-${expectedType}-got-${selfRes.type}` };
  }

  if (receipt.windowIds.length !== expectedWindowIds.length ||
      !receipt.windowIds.every((id, idx) => id === expectedWindowIds[idx])) {
    return { ok: false, reason: 'windowIds-sequence-mismatch' };
  }
  if (receipt.affectedWindows.length !== expectedAffected.length ||
      !receipt.affectedWindows.every((id, idx) => id === expectedAffected[idx])) {
    return { ok: false, reason: 'affectedWindows-sequence-mismatch' };
  }
  if (receipt.reusedWindows.length !== expectedReused.length ||
      !receipt.reusedWindows.every((id, idx) => id === expectedReused[idx])) {
    return { ok: false, reason: 'reusedWindows-sequence-mismatch' };
  }

  if (receipt.ok) {
    if (receipt.themeScope === '*') {
      if (expectedReused.length > 0) {
        return { ok: false, reason: 'skipped-windows-present-for-global-scope' };
      }
    } else {
      for (let id of expectedWindowIds) {
        let wPost = postMap.get(id);
        let winScope = wPost.themeScope || wPost.theme?.themeScope || 'xr';
        if (winScope === receipt.themeScope) {
          if (!expectedAffected.includes(id)) {
            return { ok: false, reason: `window-${id}-expected-in-affectedWindows-for-scope-${receipt.themeScope}` };
          }
        } else {
          if (expectedAffected.includes(id)) {
            return { ok: false, reason: `window-${id}-unexpectedly-affected-for-scope-${receipt.themeScope}` };
          }
        }
      }
    }
  }

  let expectedWindowResults = [];
  for (let id of expectedWindowIds) {
    let wPre = preMap.get(id);
    let wPost = postMap.get(id);

    let beforeRev = wPre.themeRevision ?? wPre.theme?.themeRevision ?? 0;
    let afterRev = wPost.themeRevision ?? wPost.theme?.themeRevision ?? 0;
    let winScope = wPost.themeScope || wPost.theme?.themeScope || 'xr';

    let twSnapshot = wPost.theme?.snapshot ? {
      version: wPost.theme.snapshot.version,
      themeScope: wPost.theme.snapshot.themeScope || null,
      tokens: wPost.theme.snapshot.tokens ? { ...wPost.theme.snapshot.tokens } : {},
      material: wPost.theme.snapshot.material ? { ...wPost.theme.snapshot.material } : null,
    } : null;

    let requestedMat = twSnapshot?.material ? { ...twSnapshot.material } : null;
    let actualMat = wPost.material ?? wPost.theme?.actualMaterial ?? null;

    let outcome;
    let isAffected = expectedAffected.includes(id);
    if (isAffected) {
      let wPostMounted = wPost.lifecycle?.mounted ?? false;
      if (wPostMounted) {
        let uDelta = (wPost.upload?.uploads ?? 0) - (wPre.upload?.uploads ?? 0);
        let rDelta = (wPost.upload?.reuses ?? 0) - (wPre.upload?.reuses ?? 0);
        if (uDelta > 0) {
          outcome = 'upload';
        } else if (rDelta > 0) {
          outcome = 'reuse';
        } else {
          outcome = 'upload';
        }
      } else {
        outcome = 'upload';
      }
    } else {
      outcome = 'skipped';
    }

    let rCounters = {
      beforeUploads: wPre.upload?.uploads ?? 0,
      afterUploads: wPost.upload?.uploads ?? 0,
      beforeReuses: wPre.upload?.reuses ?? 0,
      afterReuses: wPost.upload?.reuses ?? 0,
    };

    let expectedRecord = {
      windowId: id,
      themeScope: winScope,
      beforeRevision: beforeRev,
      afterRevision: afterRev,
      snapshot: twSnapshot,
      requestedMaterial: requestedMat,
      actualMaterial: actualMat,
      outcome,
      counters: rCounters,
    };

    let recordHash = computeXREvidenceDigestSync(expectedRecord);

    expectedWindowResults.push({
      ...expectedRecord,
      hash: recordHash,
    });
  }

  if (receipt.windowResults.length !== expectedWindowResults.length) {
    return { ok: false, reason: 'windowResults-length-mismatch-with-expected' };
  }
  for (let i = 0; i < expectedWindowResults.length; i++) {
    let r = receipt.windowResults[i];
    let exp = expectedWindowResults[i];
    if (r.windowId !== exp.windowId) {
      return { ok: false, reason: `windowResult-windowId-mismatch-at-index-${i}` };
    }
    if (stringifyCanonical(r) !== stringifyCanonical(exp)) {
      return { ok: false, reason: `canonical-record-mismatch-for-${r.windowId}` };
    }
  }

  let expectedBeforeUploads = 0;
  let expectedAfterUploads = 0;
  let expectedBeforeReuses = 0;
  let expectedAfterReuses = 0;
  for (let exp of expectedWindowResults) {
    expectedBeforeUploads += exp.counters.beforeUploads;
    expectedAfterUploads += exp.counters.afterUploads;
    expectedBeforeReuses += exp.counters.beforeReuses;
    expectedAfterReuses += exp.counters.afterReuses;
  }
  if (!receipt.counters || typeof receipt.counters !== 'object') {
    return { ok: false, reason: 'counters-must-be-object' };
  }
  if (receipt.counters.beforeUploads !== expectedBeforeUploads ||
      receipt.counters.afterUploads !== expectedAfterUploads ||
      receipt.counters.beforeReuses !== expectedBeforeReuses ||
      receipt.counters.afterReuses !== expectedAfterReuses) {
    return { ok: false, reason: 'counters-recomputation-mismatch' };
  }

  let expectedBindingHash = computeXREvidenceDigestSync(expectedWindowResults.map(r => r.hash).sort());
  if (receipt.bindingHash !== expectedBindingHash) {
    return { ok: false, reason: 'bindingHash-recomputation-mismatch' };
  }

  let expectedOk = expectedAffected.length > 0 &&
                   expectedAffected.some(id => {
                     let wPost = postMap.get(id);
                     return wPost.lifecycle?.mounted ?? false;
                   }) &&
                   expectedWindowResults.every(r => {
                     let wPre = preMap.get(r.windowId);
                     let wPost = postMap.get(r.windowId);
                     if (expectedAffected.includes(r.windowId)) {
                       let wPostMounted = wPost.lifecycle?.mounted ?? false;
                       if (wPostMounted) {
                         let uDelta = r.counters.afterUploads - r.counters.beforeUploads;
                         let rDelta = r.counters.afterReuses - r.counters.beforeReuses;
                         if (r.outcome === 'upload') {
                           return uDelta === 1 && rDelta === 0 && r.afterRevision === r.beforeRevision + 1;
                         } else if (r.outcome === 'reuse') {
                           return rDelta === 1 && uDelta === 0 && r.afterRevision === r.beforeRevision + 1;
                         }
                         return false;
                       } else {
                         return false;
                       }
                     } else {
                       return r.outcome === 'skipped' && r.afterRevision === r.beforeRevision;
                     }
                   });

  let hasMountedAffected = expectedAffected.some(id => {
    let wPost = postMap.get(id);
    return wPost.lifecycle?.mounted ?? false;
  });
  if (hasMountedAffected && !expectedOk) {
    return { ok: false, reason: 'expected-ok-verdict-not-satisfied' };
  }

  if (receipt.ok !== expectedOk) {
    return { ok: false, reason: 'final-verdict-mismatch-with-trusted-observation' };
  }

  return { ok: true, type: selfRes.type };
}

/**
 * Structurally and semantically validates a theme redraw receipt.
 * @param {Object} receipt
 * @param {Object} [trustedObservation]
 * @returns {Promise<Object>} `{ ok: boolean, reason?: string }`
 */
export async function validateXRSpatialWindowThemeRedrawReceipt(receipt, trustedObservation = null) {
  if (trustedObservation) {
    return validateXRSpatialWindowThemeRedrawReceiptAgainstTrustedObservationSync(receipt, trustedObservation);
  }
  return validateXRSpatialWindowThemeRedrawReceiptSelfConsistencySync(receipt);
}

/**
 * Async version of theme redraw receipt self consistency validation.
 */
export async function validateXRSpatialWindowThemeRedrawReceiptSelfConsistency(receipt) {
  return validateXRSpatialWindowThemeRedrawReceiptSelfConsistencySync(receipt);
}

/**
 * Async version of theme redraw receipt trusted validation.
 */
export async function validateXRSpatialWindowThemeRedrawReceiptAgainstTrustedObservation(receipt, trustedObservation) {
  return validateXRSpatialWindowThemeRedrawReceiptAgainstTrustedObservationSync(receipt, trustedObservation);
}

/**
 * Validates spatial window assembly diagnostics self-consistency synchronously.
 * @param {Object} diagnostics
 * @returns {Object} `{ ok: boolean, reason?: string }`
 */
export function validateXRSpatialWindowDiagnosticsSelfConsistencySync(diagnostics) {
  if (!diagnostics || typeof diagnostics !== 'object') {
    return { ok: false, reason: 'diagnostics-must-be-object' };
  }
  if (diagnostics.version !== XR_SPATIAL_WINDOW_DIAGNOSTICS_VERSION) {
    return { ok: false, reason: 'invalid-diagnostics-version' };
  }
  if (!Array.isArray(diagnostics.windows)) {
    return { ok: false, reason: 'windows-must-be-array' };
  }
  if (!diagnostics.theme || typeof diagnostics.theme !== 'object' || Array.isArray(diagnostics.theme)) {
    return { ok: false, reason: 'diagnostics-theme-must-be-object' };
  }
  const mainThemeKeys = new Set(['themeScope', 'material']);
  for (let k of Object.keys(diagnostics.theme)) {
    if (!mainThemeKeys.has(k)) {
      return { ok: false, reason: `disallowed-diagnostics-theme-property-${k}` };
    }
  }
  if (diagnostics.theme.themeScope !== null && typeof diagnostics.theme.themeScope !== 'string') {
    return { ok: false, reason: 'diagnostics-theme-themeScope-must-be-string-or-null' };
  }
  if (diagnostics.theme.material !== null) {
    let matRes = validateXRThemeMaterial(diagnostics.theme.material);
    if (!matRes.ok) {
      return { ok: false, reason: `diagnostics-theme-material-${matRes.reason}` };
    }
  }

  for (let w of diagnostics.windows) {
    // Reconstruct canonical geometry from declared window dimensions and control state (closable)
    let canonicalZones = computeXRPanelChromeLayout(w.sizeMeters, { closable: w.state?.closable });
    
    // Compare exact zones
    let zones = w.chrome?.zones || {};
    
    function sameRect(r1, r2, tolerance = 1e-6) {
      if (!r1 || !r2) return r1 === r2;
      return (
        Math.abs(Number(r1.x) - Number(r2.x)) <= tolerance &&
        Math.abs(Number(r1.y) - Number(r2.y)) <= tolerance &&
        Math.abs(Number(r1.width) - Number(r2.width)) <= tolerance &&
        Math.abs(Number(r1.height) - Number(r2.height)) <= tolerance
      );
    }
    
    if (!sameRect(zones.controlBar, canonicalZones.controlBar) ||
        !sameRect(zones.move, canonicalZones.move) ||
        !sameRect(zones.content, canonicalZones.content)) {
      return { ok: false, reason: `chrome-zones-mismatch-for-${w.windowId}` };
    }
    for (let key of ['northWest', 'northEast', 'southEast', 'southWest']) {
      if (!sameRect(zones.resize?.[key], canonicalZones.resize?.[key])) {
        return { ok: false, reason: `resize-zone-mismatch-${key}-for-${w.windowId}` };
      }
    }
    for (let key of ['north', 'east', 'south', 'west']) {
      if (!sameRect(zones.edges?.[key], canonicalZones.edges?.[key])) {
        return { ok: false, reason: `edge-zone-mismatch-${key}-for-${w.windowId}` };
      }
    }
    let actionKeys = Object.keys(canonicalZones.actions || {});
    let inputActionKeys = Object.keys(zones.actions || {});
    if (actionKeys.length !== inputActionKeys.length ||
        actionKeys.some(k => !sameRect(zones.actions?.[k], canonicalZones.actions?.[k]))) {
      return { ok: false, reason: `actions-zones-mismatch-for-${w.windowId}` };
    }

    // Recompute all intersections from canonical geometry instead of trusting input
    let rects = {
      content: canonicalZones.content,
      controlBar: canonicalZones.controlBar,
      move: canonicalZones.move,
      'resize:northWest': canonicalZones.resize?.northWest,
      'resize:northEast': canonicalZones.resize?.northEast,
      'resize:southEast': canonicalZones.resize?.southEast,
      'resize:southWest': canonicalZones.resize?.southWest,
      'edges:north': canonicalZones.edges?.north,
      'edges:east': canonicalZones.edges?.east,
      'edges:south': canonicalZones.edges?.south,
      'edges:west': canonicalZones.edges?.west,
    };
    if (canonicalZones.actions) {
      for (let [action, rect] of Object.entries(canonicalZones.actions)) {
        rects[`actions:${action}`] = rect;
      }
    }

    for (let [name, rect] of Object.entries(rects)) {
      if (rect) {
        let x = Number(rect.x);
        let y = Number(rect.y);
        let width = Number(rect.width);
        let height = Number(rect.height);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
          return { ok: false, reason: `non-finite-rect-${name}` };
        }
        if (width < 0 || height < 0) {
          return { ok: false, reason: `negative-rect-dimension-${name}` };
        }
      }
    }

    let expectedIntersections = [];
    let expectedZeroForbiddenOverlap = true;
    let keys = Object.keys(rects).filter(k => rects[k] !== undefined && rects[k] !== null);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        let key1 = keys[i];
        let key2 = keys[j];
        let r1 = rects[key1];
        let r2 = rects[key2];
        let area = getRectangleIntersection(r1, r2);
        let roundedArea = roundMetric(area);
        if (roundedArea > 0) {
          let allowed = isOverlapAllowed(key1, key2);
          if (!allowed) {
            expectedZeroForbiddenOverlap = false;
          }
          expectedIntersections.push({
            zones: [key1, key2],
            intersectionArea: roundedArea,
            allowed,
          });
        }
      }
    }

    let inputIntersections = w.chrome?.overlap?.intersections || [];
    if (inputIntersections.length !== expectedIntersections.length) {
      return { ok: false, reason: 'intersection-count-mismatch' };
    }

    for (let expected of expectedIntersections) {
      let match = inputIntersections.find(item => {
        return Array.isArray(item.zones) &&
               item.zones.length === 2 &&
               ((item.zones[0] === expected.zones[0] && item.zones[1] === expected.zones[1]) ||
                (item.zones[0] === expected.zones[1] && item.zones[1] === expected.zones[0]));
      });
      if (!match) {
        return { ok: false, reason: `missing-expected-intersection-for-${expected.zones.join('-')}` };
      }
      if (match.intersectionArea !== expected.intersectionArea) {
        return { ok: false, reason: `intersection-area-mismatch-for-${expected.zones.join('-')}` };
      }
      if (match.allowed !== expected.allowed) {
        return { ok: false, reason: `intersection-allowed-mismatch-for-${expected.zones.join('-')}` };
      }
    }

    let verdict = w.chrome?.overlap?.verdict;
    let zeroForbiddenOverlap = w.chrome?.overlap?.zeroForbiddenOverlap;

    if (zeroForbiddenOverlap !== expectedZeroForbiddenOverlap) {
      return { ok: false, reason: 'zeroForbiddenOverlap-value-mismatch' };
    }
    let expectedVerdict = expectedZeroForbiddenOverlap ? 'PASS' : 'FAIL';
    if (verdict !== expectedVerdict) {
      return { ok: false, reason: 'verdict-value-mismatch' };
    }

    if (w.theme) {
      if (typeof w.theme !== 'object' || Array.isArray(w.theme)) {
        return { ok: false, reason: `theme-must-be-object-for-${w.windowId}` };
      }
      const themeKeys = new Set(['themeScope', 'snapshot', 'bindingHash', 'actualMaterial']);
      for (let k of Object.keys(w.theme)) {
        if (!themeKeys.has(k)) {
          return { ok: false, reason: `disallowed-theme-property-${k}-for-${w.windowId}` };
        }
      }
      if (w.theme.themeScope !== null && typeof w.theme.themeScope !== 'string') {
        return { ok: false, reason: `theme-themeScope-must-be-string-or-null-for-${w.windowId}` };
      }
      if (w.theme.bindingHash !== null && typeof w.theme.bindingHash !== 'string') {
        return { ok: false, reason: `theme-bindingHash-must-be-string-or-null-for-${w.windowId}` };
      }
      if (w.theme.snapshot !== null) {
        let snapRes = validateXRThemeSnapshot(w.theme.snapshot);
        if (!snapRes.ok) {
          return { ok: false, reason: `theme-snapshot-for-${w.windowId}-${snapRes.reason}` };
        }
      }
      if (w.theme.actualMaterial !== null) {
        let matRes = validateXRThemeMaterial(w.theme.actualMaterial);
        if (!matRes.ok) {
          return { ok: false, reason: `theme-actualMaterial-for-${w.windowId}-${matRes.reason}` };
        }
      }

      const boundEvidence = {
        themeScope: w.theme.themeScope,
        snapshot: w.theme.snapshot,
        actualMaterial: w.theme.actualMaterial,
      };
      const expectedBindingHash = computeXREvidenceDigestSync(boundEvidence);
      if (w.theme.bindingHash !== expectedBindingHash) {
        return { ok: false, reason: `theme-bindingHash-mismatch-for-${w.windowId}` };
      }
    }
  }

  return { ok: true };
}

/**
 * Validates spatial window assembly diagnostics against trusted observation synchronously.
 * @param {Object} diagnostics
 * @param {Object} trustedObservation
 * @returns {Object} `{ ok: boolean, reason?: string }`
 */
export function validateXRSpatialWindowDiagnosticsAgainstTrustedObservationSync(diagnostics, trustedObservation) {
  if (!trustedObservation) {
    return { ok: false, reason: 'missing-trusted-observation' };
  }

  if (trustedObservation && typeof trustedObservation === 'object' && ('post' in trustedObservation)) {
    trustedObservation = trustedObservation.post;
  }

  let selfRes = validateXRSpatialWindowDiagnosticsSelfConsistencySync(diagnostics);
  if (!selfRes.ok) {
    return selfRes;
  }

  let trustedWindows = [];
  if (Array.isArray(trustedObservation)) {
    trustedWindows = trustedObservation;
  } else if (trustedObservation && Array.isArray(trustedObservation.windows)) {
    trustedWindows = trustedObservation.windows;
  } else if (trustedObservation && typeof trustedObservation === 'object') {
    trustedWindows = Object.values(trustedObservation);
  }

  let trustedMap = new Map();
  for (let tw of trustedWindows) {
    if (tw && tw.windowId) {
      trustedMap.set(tw.windowId, tw);
    }
  }

  // 1. Window Set Validation
  if (diagnostics.windows.length !== trustedMap.size) {
    return { ok: false, reason: 'windows-count-mismatch-with-trusted-observation' };
  }
  for (let w of diagnostics.windows) {
    if (!trustedMap.has(w.windowId)) {
      return { ok: false, reason: `window-${w.windowId}-missing-in-trusted-observation` };
    }
  }
  for (let tw of trustedWindows) {
    if (!diagnostics.windows.some(w => w.windowId === tw.windowId)) {
      return { ok: false, reason: `window-${tw.windowId}-missing-in-diagnostics` };
    }
  }

  // 2. Validate stable identity, size, state, theme evidence, and chrome geometry
  for (let w of diagnostics.windows) {
    let tw = trustedMap.get(w.windowId);

    // Stable identity
    if (w.layoutId !== tw.layoutId) {
      return { ok: false, reason: `layoutId-mismatch-for-${w.windowId}` };
    }

    // Size
    if (!w.sizeMeters || !tw.sizeMeters ||
        Math.abs(w.sizeMeters[0] - tw.sizeMeters[0]) > 1e-6 ||
        Math.abs(w.sizeMeters[1] - tw.sizeMeters[1]) > 1e-6) {
      return { ok: false, reason: `sizeMeters-mismatch-for-${w.windowId}` };
    }

    // State
    let wState = w.state || {};
    let twState = tw.state || {};
    for (let k in twState) {
      if (wState[k] !== twState[k]) {
        return { ok: false, reason: `state-mismatch-key-${k}-for-${w.windowId}` };
      }
    }
    for (let k in wState) {
      if (wState[k] !== twState[k]) {
        return { ok: false, reason: `state-mismatch-key-${k}-for-${w.windowId}` };
      }
    }

    // Theme evidence
    if (w.theme || tw.theme) {
      if (!w.theme || !tw.theme) {
        return { ok: false, reason: `theme-presence-mismatch-for-${w.windowId}` };
      }
      let twThemeScope = tw.themeScope || tw.theme.themeScope || 'xr';
      if (w.theme.themeScope !== twThemeScope) {
        return { ok: false, reason: `themeScope-mismatch-with-trusted-for-${w.windowId}` };
      }
      if (JSON.stringify(w.theme.snapshot) !== JSON.stringify(tw.theme.snapshot)) {
        return { ok: false, reason: `themeSnapshot-mismatch-with-trusted-for-${w.windowId}` };
      }
      if (JSON.stringify(w.theme.actualMaterial) !== JSON.stringify(tw.theme.actualMaterial)) {
        return { ok: false, reason: `actualMaterial-mismatch-with-trusted-for-${w.windowId}` };
      }
      if (w.theme.bindingHash !== tw.theme.bindingHash) {
        return { ok: false, reason: `bindingHash-mismatch-with-trusted-for-${w.windowId}` };
      }
    }

    // Canonical chrome geometry reconstructed from trusted size/state
    let canonicalZones = computeXRPanelChromeLayout(tw.sizeMeters, { closable: twState.closable });
    let zones = w.chrome?.zones || {};

    function sameRect(r1, r2, tolerance = 1e-6) {
      if (!r1 || !r2) return r1 === r2;
      return (
        Math.abs(Number(r1.x) - Number(r2.x)) <= tolerance &&
        Math.abs(Number(r1.y) - Number(r2.y)) <= tolerance &&
        Math.abs(Number(r1.width) - Number(r2.width)) <= tolerance &&
        Math.abs(Number(r1.height) - Number(r2.height)) <= tolerance
      );
    }

    if (!sameRect(zones.controlBar, canonicalZones.controlBar) ||
        !sameRect(zones.move, canonicalZones.move) ||
        !sameRect(zones.content, canonicalZones.content)) {
      return { ok: false, reason: `chrome-zones-mismatch-with-trusted-for-${w.windowId}` };
    }
    for (let key of ['northWest', 'northEast', 'southEast', 'southWest']) {
      if (!sameRect(zones.resize?.[key], canonicalZones.resize?.[key])) {
        return { ok: false, reason: `resize-zone-mismatch-${key}-with-trusted-for-${w.windowId}` };
      }
    }
    for (let key of ['north', 'east', 'south', 'west']) {
      if (!sameRect(zones.edges?.[key], canonicalZones.edges?.[key])) {
        return { ok: false, reason: `edge-zone-mismatch-${key}-with-trusted-for-${w.windowId}` };
      }
    }
    let actionKeys = Object.keys(canonicalZones.actions || {});
    let inputActionKeys = Object.keys(zones.actions || {});
    if (actionKeys.length !== inputActionKeys.length ||
        actionKeys.some(k => !sameRect(zones.actions?.[k], canonicalZones.actions?.[k]))) {
      return { ok: false, reason: `actions-zones-mismatch-with-trusted-for-${w.windowId}` };
    }
  }

  return { ok: true };
}

/**
 * Validates spatial window assembly diagnostics payload semantically.
 * @param {Object} diagnostics
 * @param {Object} [trustedObservation]
 * @returns {Promise<Object>} `{ ok: boolean, reason?: string }`
 */
export async function validateXRSpatialWindowDiagnostics(diagnostics, trustedObservation = null) {
  if (trustedObservation) {
    return validateXRSpatialWindowDiagnosticsAgainstTrustedObservationSync(diagnostics, trustedObservation);
  }
  return validateXRSpatialWindowDiagnosticsSelfConsistencySync(diagnostics);
}

/**
 * Async version of diagnostics self consistency validation.
 */
export async function validateXRSpatialWindowDiagnosticsSelfConsistency(diagnostics) {
  return validateXRSpatialWindowDiagnosticsSelfConsistencySync(diagnostics);
}

/**
 * Async version of diagnostics trusted validation.
 */
export async function validateXRSpatialWindowDiagnosticsAgainstTrustedObservation(diagnostics, trustedObservation) {
  return validateXRSpatialWindowDiagnosticsAgainstTrustedObservationSync(diagnostics, trustedObservation);
}
