export const MIN_CANVAS_GRAPH_ZOOM = 0.02;
export const MAX_CANVAS_GRAPH_ZOOM = 5;
export const MAX_ZOOM_OUT_FIT_MULTIPLIER = 4;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function resolveFitPadding(padding, rect) {
  let requested = Number.isFinite(padding) ? padding : 0;
  let minSide = Math.min(rect?.width || 0, rect?.height || 0);
  if (minSide <= 0) return Math.max(0, requested);
  let maxPadding = Math.max(12, minSide * 0.32);
  return Math.max(0, Math.min(requested, maxPadding));
}

export function resolveFrameFitZoom(frame, rect, padding = 0) {
  if (!frame || !rect || rect.width === 0 || rect.height === 0) return MIN_CANVAS_GRAPH_ZOOM;
  let graphW = frame.maxX - frame.minX || 1;
  let graphH = frame.maxY - frame.minY || 1;
  return Math.min(
    Math.max(1, rect.width - padding * 2) / graphW,
    Math.max(1, rect.height - padding * 2) / graphH
  );
}

export function resolveCanvasGraphViewportFit({
  frame,
  rect,
  padding = 0,
  minZoom = MIN_CANVAS_GRAPH_ZOOM,
  maxZoom = 2,
} = {}) {
  let fitPadding = resolveFitPadding(padding, rect);
  let zoom = clamp(
    resolveFrameFitZoom(frame, rect, fitPadding),
    Number.isFinite(minZoom) ? minZoom : MIN_CANVAS_GRAPH_ZOOM,
    Number.isFinite(maxZoom) ? maxZoom : 2
  );
  let cx = frame ? (frame.minX + frame.maxX) / 2 : 0;
  let cy = frame ? (frame.minY + frame.maxY) / 2 : 0;
  return {
    zoom,
    panX: (rect?.width || 0) / 2 - cx * zoom,
    panY: (rect?.height || 0) / 2 - cy * zoom,
    padding: fitPadding,
  };
}

export function resolveCanvasGraphMinZoom({
  frame,
  rect,
  padding = 0,
  visibleNodeCount = 0,
} = {}) {
  if (visibleNodeCount <= 1) return MIN_CANVAS_GRAPH_ZOOM;
  let fitPadding = resolveFitPadding(padding, rect);
  let fitZoom = resolveFrameFitZoom(frame, rect, fitPadding);
  if (!Number.isFinite(fitZoom) || fitZoom <= 0) return MIN_CANVAS_GRAPH_ZOOM;
  return Math.max(
    MIN_CANVAS_GRAPH_ZOOM,
    Math.min(MAX_CANVAS_GRAPH_ZOOM, fitZoom / MAX_ZOOM_OUT_FIT_MULTIPLIER)
  );
}
