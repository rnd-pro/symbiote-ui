function numberOr(value, fallback) {
  let number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizePoint(point = {}) {
  // Chrome lives outside the window (Horizon-style), so frame points are NOT
  // clamped to the window UV square; the chrome hit surface supplies
  // coordinates beyond [0, 1].
  return {
    x: numberOr(point.x, 0),
    y: numberOr(point.y, 0),
  };
}

function bool(value) {
  return value === true;
}

export function computeXRPanelChromeLayout(sizeMeters = [0.8, 0.45], options = {}) {
  // Single source of truth for chrome geometry (also consumed by IWER prelude
  // targeting). Zones stay in panel UV; meter inputs convert at build time
  // (u = meters/width, v = meters/height) so chrome keeps a constant PHYSICAL
  // size across resizes. Absent meter options keep the historical UV defaults,
  // byte-identical for existing consumers.
  let size = Array.isArray(sizeMeters) ? sizeMeters : [0.8, 0.45];
  let width = Math.max(0.05, numberOr(size[0], 0.8));
  let height = Math.max(0.05, numberOr(size[1], 0.45));
  // Meter inputs are clamped in METERS (sanity bounds) before conversion;
  // the historical UV clamps apply to UV inputs only — clamping meter-derived
  // UV would break the constant-physical-size invariant on large panels.
  let handleSizeU = options.handleSizeMeters != null
    ? clamp(numberOr(options.handleSizeMeters, 0), 0, 0.5) / width
    : clamp(numberOr(options.handleSize, 0.055), 0.02, 0.16);
  let handleSizeV = options.handleSizeMeters != null
    ? clamp(numberOr(options.handleSizeMeters, 0), 0, 0.5) / height
    : handleSizeU;
  let footerHeight = options.footerHeightMeters != null
    ? clamp(numberOr(options.footerHeightMeters, 0), 0, 0.5) / height
    : clamp(numberOr(options.footerHeight ?? options.headerHeight, 0.085), 0.04, 0.22);
  let actionSize = options.actionSizeMeters != null
    ? clamp(numberOr(options.actionSizeMeters, 0), 0, 0.5) / width
    : clamp(numberOr(options.actionSize, 0.07), 0.02, 0.16);
  let footerTop = 1 + (options.footerGapMeters != null
    ? clamp(numberOr(options.footerGapMeters, 0), 0, 0.2) / height
    : clamp(numberOr(options.footerGap, 0.02), 0, 0.1));
  let barLeft = 0.34;
  let barWidth = 0.32;
  let gap = 0.02;
  // Non-closable panels omit the close zone entirely — a chrome action with
  // no handler behind it would be a dead control.
  let actions = {};
  if (options.closable !== false) {
    actions.close = { x: barLeft - actionSize * 2 - gap * 2, y: footerTop, width: actionSize, height: footerHeight };
  }
  actions.reset = { x: barLeft - actionSize - gap, y: footerTop, width: actionSize, height: footerHeight };
  actions.pin = { x: barLeft + barWidth + gap, y: footerTop, width: actionSize, height: footerHeight };
  actions.fullscreen = {
    x: barLeft + barWidth + gap * 2 + actionSize,
    y: footerTop,
    width: actionSize,
    height: footerHeight,
  };
  return {
    move: { x: barLeft, y: footerTop, width: barWidth, height: footerHeight },
    content: { x: 0, y: 0, width: 1, height: 1 },
    resize: {
      northWest: { x: -handleSizeU / 2, y: -handleSizeV / 2, width: handleSizeU, height: handleSizeV },
      northEast: { x: 1 - handleSizeU / 2, y: -handleSizeV / 2, width: handleSizeU, height: handleSizeV },
      southEast: { x: 1 - handleSizeU / 2, y: 1 - handleSizeV / 2, width: handleSizeU, height: handleSizeV },
      southWest: { x: -handleSizeU / 2, y: 1 - handleSizeV / 2, width: handleSizeU, height: handleSizeV },
    },
    actions,
  };
}

export function createXRPanelFrame(panel = {}, options = {}) {
  // Horizon-OS-style chrome, placed OUTSIDE the window like the native shell:
  // the handlebar and window actions float in a band below the window, and
  // the resize grips straddle the corners. Content owns the full window UV
  // square; the chrome hit surface supplies out-of-window coordinates.
  let sizeMeters = Array.isArray(options.panelSizeMeters)
    ? options.panelSizeMeters
    : (Array.isArray(panel.size) ? panel.size : [0.8, 0.45]);
  let state = options.state || panel.state || {};
  return {
    version: 'xr-panel-frame-v1',
    panelId: String(panel.id || ''),
    component: panel.component || panel.panelType || 'panel',
    tokens: {
      background: 'var(--sn-xr-panel-bg)',
      border: 'var(--sn-xr-panel-border)',
      radius: 'var(--sn-xr-panel-radius)',
      shadow: 'var(--sn-xr-panel-shadow)',
      pointer: 'var(--sn-xr-pointer-color)',
    },
    zones: computeXRPanelChromeLayout(sizeMeters, {
      ...options,
      closable: options.closable === false ? false : panel.closable,
    }),
    state: {
      hovered: bool(state.hovered || options.hovered),
      selected: bool(state.selected || options.selected),
      dragging: bool(state.dragging || options.dragging),
      resizing: bool(state.resizing || options.resizing),
      pinned: bool(state.pinned || options.pinned),
    },
  };
}

function contains(zone, point) {
  return point.x >= zone.x &&
    point.x <= zone.x + zone.width &&
    point.y >= zone.y &&
    point.y <= zone.y + zone.height;
}

export function hitTestXRPanelFrame(frameOrPanel = {}, point = {}, options = {}) {
  let frame = frameOrPanel.version === 'xr-panel-frame-v1'
    ? frameOrPanel
    : createXRPanelFrame(frameOrPanel, options);
  let normalizedPoint = normalizePoint(point);

  for (let [action, zone] of Object.entries(frame.zones.actions || {})) {
    if (contains(zone, normalizedPoint)) {
      return {
        version: 'xr-panel-frame-target-v1',
        panelId: frame.panelId,
        zone: 'action',
        action,
        operation: 'action',
        handle: null,
        point: normalizedPoint,
      };
    }
  }

  for (let [handle, zone] of Object.entries(frame.zones.resize || {})) {
    if (contains(zone, normalizedPoint)) {
      return {
        version: 'xr-panel-frame-target-v1',
        panelId: frame.panelId,
        zone: 'resize',
        action: null,
        operation: 'resize',
        handle,
        point: normalizedPoint,
      };
    }
  }

  if (contains(frame.zones.move, normalizedPoint)) {
    return {
      version: 'xr-panel-frame-target-v1',
      panelId: frame.panelId,
      zone: 'move',
      action: null,
      operation: 'move',
      handle: null,
      point: normalizedPoint,
    };
  }

  if (contains(frame.zones.content, normalizedPoint)) {
    return {
      version: 'xr-panel-frame-target-v1',
      panelId: frame.panelId,
      zone: 'content',
      action: null,
      operation: options.defaultContentOperation || 'focus',
      handle: null,
      point: normalizedPoint,
    };
  }

  // Outside the window and outside every chrome zone: no target at all.
  return null;
}
