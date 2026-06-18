function numberOr(value, fallback) {
  let number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizePoint(point = {}) {
  return {
    x: clamp(numberOr(point.x, 0), 0, 1),
    y: clamp(numberOr(point.y, 0), 0, 1),
  };
}

function bool(value) {
  return value === true;
}

export function createXRPanelFrame(panel = {}, options = {}) {
  let handleSize = clamp(numberOr(options.handleSize, 0.055), 0.02, 0.16);
  let headerHeight = clamp(numberOr(options.headerHeight, 0.09), 0.04, 0.22);
  let actionSize = clamp(numberOr(options.actionSize, handleSize), 0.02, 0.16);
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
    zones: {
      move: { x: 0, y: 0, width: 1, height: headerHeight },
      content: { x: handleSize, y: headerHeight, width: 1 - handleSize * 2, height: 1 - headerHeight - handleSize },
      resize: {
        north: { x: handleSize, y: 0, width: 1 - handleSize * 2, height: handleSize },
        east: { x: 1 - handleSize, y: headerHeight, width: handleSize, height: 1 - headerHeight - handleSize },
        south: { x: handleSize, y: 1 - handleSize, width: 1 - handleSize * 2, height: handleSize },
        west: { x: 0, y: headerHeight, width: handleSize, height: 1 - headerHeight - handleSize },
        northWest: { x: 0, y: 0, width: handleSize, height: handleSize },
        northEast: { x: 1 - handleSize, y: 0, width: handleSize, height: handleSize },
        southEast: { x: 1 - handleSize, y: 1 - handleSize, width: handleSize, height: handleSize },
        southWest: { x: 0, y: 1 - handleSize, width: handleSize, height: handleSize },
      },
      actions: {
        pin: { x: 1 - actionSize * 3, y: 0, width: actionSize, height: headerHeight },
        reset: { x: 1 - actionSize * 2, y: 0, width: actionSize, height: headerHeight },
        close: { x: 1 - actionSize, y: 0, width: actionSize, height: headerHeight },
      },
    },
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
