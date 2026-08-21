/**
 * Browser-safe presenter overlay with one deterministic 30 FPS projector for
 * live playback and independently rendered frames. Focus frames, handwritten
 * annotations, pointer travel, and exactly-once semantic clicks stay separate.
 * Browser access is lazy, so the module remains Node-safe at import time.
 */

import {
  createPresenterRelationshipPath,
  resolvePresenterGesturePolicy,
} from './presenter-gesture-policy.js';

const STYLE_ID = 'symbiote-presenter-cursor-style';
const OVERLAY_CLASS = 'symbiote-presenter-cursor';

export const PRESENTER_HAND_PROFILE_VERSION = 'symbiote-presenter-hand-profile-v1';
export const PRESENTER_MARKERS = Object.freeze(['freehand', 'underline', 'oval', 'arrow']);
const PRESENTER_MARKER_SET = new Set(PRESENTER_MARKERS);
const MARKER_ALIASES = Object.freeze({
  circle: 'oval',
  marker: 'oval',
  ring: 'oval',
  round: 'oval',
  line: 'underline',
  under: 'underline',
  pointer: 'arrow',
  point: 'arrow',
});
export const PRESENTER_SYMBOLS = Object.freeze(['question', 'cross', 'check', 'heart', 'flourish']);
const PRESENTER_SYMBOL_SET = new Set(PRESENTER_SYMBOLS);
const SYMBOL_ALIASES = Object.freeze({
  '?': 'question',
  help: 'question',
  unknown: 'question',
  issue: 'question',
  x: 'cross',
  error: 'cross',
  reject: 'cross',
  no: 'cross',
  ok: 'check',
  done: 'check',
  success: 'check',
  yes: 'check',
  love: 'heart',
  like: 'heart',
  favorite: 'heart',
  stroke: 'flourish',
  scribble: 'flourish',
  signature: 'flourish',
  flourish: 'flourish',
});
export const PRESENTER_ANNOTATION_INTENTS = Object.freeze([
  'emphasize',
  'detail',
  'group',
  'pointer',
  'risk',
  'question',
  'success',
  'affinity',
  'flourish',
]);
const ANNOTATION_INTENT_SET = new Set(PRESENTER_ANNOTATION_INTENTS);
const INTENT_ALIASES = Object.freeze({
  important: 'emphasize',
  highlight: 'emphasize',
  value: 'detail',
  word: 'detail',
  text: 'detail',
  field: 'detail',
  collection: 'group',
  set: 'group',
  arrow: 'pointer',
  point: 'pointer',
  warning: 'risk',
  problem: 'risk',
  error: 'risk',
  reject: 'risk',
  unknown: 'question',
  help: 'question',
  ok: 'success',
  done: 'success',
  approve: 'success',
  like: 'affinity',
  favorite: 'affinity',
  signature: 'flourish',
});
const INTENT_DEFAULTS = Object.freeze({
  emphasize: { kind: 'marker', marker: 'freehand' },
  detail: { kind: 'marker', marker: 'underline' },
  group: { kind: 'marker', marker: 'oval' },
  pointer: { kind: 'marker', marker: 'arrow', placement: 'before' },
  risk: { kind: 'symbol', symbol: 'cross', placement: 'after' },
  question: { kind: 'symbol', symbol: 'question', placement: 'after' },
  success: { kind: 'symbol', symbol: 'check', placement: 'after' },
  affinity: { kind: 'symbol', symbol: 'heart', placement: 'after' },
  flourish: { kind: 'symbol', symbol: 'flourish', placement: 'below' },
});
const ANNOTATION_PLACEMENTS = new Set(['over', 'after', 'before', 'corner', 'below', 'above']);

const CURSOR_SIZE = 18; // px; the hotspot is the arrow's top-left tip
const INK_CURSOR_SIZE = 4;
export const PRESENTER_ANNOTATION_COLLISION_ALLOWANCE_PX = 4.4;
export const PRESENTER_ANNOTATION_TARGET_INSET_PX = 8;
export const PRESENTER_CURSOR_SIZE_PX = CURSOR_SIZE;
const MARCH_MS = 600; // marching-ants loop duration
const HIGHLIGHT_PADDING_PX = 10;
const HIGHLIGHT_EDGE_INSET_PX = 8;
const HIGHLIGHT_MIN_SIZE_PX = 8;
const CLICK_ZONE_PADDING_PX = 6;
const CLICK_ZONE_MIN_SIZE_PX = 28;
const CLICK_RIPPLE_SIZE_PX = 36;
const CLICK_PRESS_MS = 240;
const CLICK_FADE_MS = 220;
export const PRESENTER_CLICK_DURATION_MS = CLICK_PRESS_MS + CLICK_FADE_MS;
export const PRESENTER_FOCUS_REVEAL_DURATION_MS = 600;

export const PRESENTER_FOCUS_PRESS_MS = 240;
export const PRESENTER_FOCUS_HOLD_MS = 240;
export const PRESENTER_FOCUS_RELEASE_MS = 300;
export const PRESENTER_FOCUS_SPEED_PX_MS = 0.8;
export const PRESENTER_FOCUS_MIN_DRAG_MS = 150;

export const PRESENTER_ANNOTATION_MIN_SPEED_PX_MS = 0.08;
export const PRESENTER_ANNOTATION_TARGET_SPEED_PX_MS = 0.6;
export const PRESENTER_ANNOTATION_MAX_SPEED_PX_MS = 0.9;
export const PRESENTER_ANNOTATION_MIN_DURATION_MS = 220;
export const PRESENTER_ANNOTATION_MAX_DURATION_MS = 12000;
export const PRESENTER_ANNOTATION_MAX_SHORT_SIDE_RATIO = 0.75;

export function resolvePresenterAnnotationTiming(arcLengthPx) {
  let arcLength = Math.max(0, Number(arcLengthPx) || 0);
  let durationMs = Math.round(Math.max(
    PRESENTER_ANNOTATION_MIN_DURATION_MS,
    Math.min(
      PRESENTER_ANNOTATION_MAX_DURATION_MS,
      arcLength / PRESENTER_ANNOTATION_TARGET_SPEED_PX_MS,
    ),
  ));
  let averageSpeedPxPerMs = durationMs > 0 ? arcLength / durationMs : 0;
  return Object.freeze({
    arcLengthPx: arcLength,
    durationMs,
    averageSpeedPxPerMs,
    minSpeedPxPerMs: PRESENTER_ANNOTATION_MIN_SPEED_PX_MS,
    targetSpeedPxPerMs: PRESENTER_ANNOTATION_TARGET_SPEED_PX_MS,
    maxSpeedPxPerMs: PRESENTER_ANNOTATION_MAX_SPEED_PX_MS,
    perceptualFloorApplied: durationMs === PRESENTER_ANNOTATION_MIN_DURATION_MS,
    perceptualCeilingApplied: durationMs === PRESENTER_ANNOTATION_MAX_DURATION_MS,
  });
}

export function resolvePresenterAnnotationDuration(arcLengthPx) {
  return resolvePresenterAnnotationTiming(arcLengthPx).durationMs;
}

export function resolvePresenterRectangleTiming(rect = {}) {
  let width = Math.max(0, Number(rect.width) || 0);
  let height = Math.max(0, Number(rect.height) || 0);
  let distancePx = Math.hypot(width, height);
  let dragMs = Math.max(
    PRESENTER_FOCUS_MIN_DRAG_MS,
    Math.round(distancePx / PRESENTER_FOCUS_SPEED_PX_MS),
  );
  let durationMs = PRESENTER_FOCUS_PRESS_MS
    + dragMs
    + PRESENTER_FOCUS_HOLD_MS
    + PRESENTER_FOCUS_RELEASE_MS;
  return Object.freeze({
    pressMs: PRESENTER_FOCUS_PRESS_MS,
    dragMs,
    holdMs: PRESENTER_FOCUS_HOLD_MS,
    releaseMs: PRESENTER_FOCUS_RELEASE_MS,
    durationMs,
    distancePx,
    averageDragSpeedPxPerMs: dragMs > 0 ? distancePx / dragMs : 0,
  });
}
export const PRESENTER_FRAME_RATE = 30;
export const PRESENTER_FRAME_MS = 1000 / PRESENTER_FRAME_RATE;

function collisionRect(value = {}) {
  if (!value || typeof value !== 'object') return null;
  let left = Number(value.left ?? value.x);
  let top = Number(value.top ?? value.y);
  let width = Number(value.width);
  let height = Number(value.height);
  if (![left, top, width, height].every(Number.isFinite) || width < 0 || height < 0) return null;
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function expandCollisionRect(rect, amount) {
  return {
    left: rect.left - amount,
    top: rect.top - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
    right: rect.right + amount,
    bottom: rect.bottom + amount,
  };
}

function rectsIntersect(left, right) {
  return left.left <= right.right
    && left.right >= right.left
    && left.top <= right.bottom
    && left.bottom >= right.top;
}

function segmentIntersectsRect(from, to, rect) {
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  let t0 = 0;
  let t1 = 1;
  for (let [p, q] of [
    [-dx, from.x - rect.left],
    [dx, rect.right - from.x],
    [-dy, from.y - rect.top],
    [dy, rect.bottom - from.y],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    let ratio = q / p;
    if (p < 0) {
      if (ratio > t1) return false;
      t0 = Math.max(t0, ratio);
    } else {
      if (ratio < t0) return false;
      t1 = Math.min(t1, ratio);
    }
  }
  return true;
}

function pathIntersectsRect(samples, rect) {
  if (!samples.length) return false;
  if (samples.length === 1) {
    let point = samples[0];
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
  }
  for (let index = 1; index < samples.length; index += 1) {
    if (segmentIntersectsRect(samples[index - 1], samples[index], rect)) return true;
  }
  return false;
}

export function analyzePresenterAnnotationSafety({
  pathSamples = [],
  cursor = null,
  targetRect = null,
  obstacles = [],
  viewport = null,
  allowancePx = PRESENTER_ANNOTATION_COLLISION_ALLOWANCE_PX,
  targetInsetPx = PRESENTER_ANNOTATION_TARGET_INSET_PX,
  cursorSizePx = PRESENTER_CURSOR_SIZE_PX,
} = {}) {
  let samples = Array.isArray(pathSamples)
    ? pathSamples.map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];
  let allowance = Number.isFinite(allowancePx)
    ? Math.max(0, allowancePx)
    : PRESENTER_ANNOTATION_COLLISION_ALLOWANCE_PX;
  let normalizedTarget = collisionRect(targetRect);
  let missingTarget = !normalizedTarget;
  let protectedTarget = null;
  if (normalizedTarget) {
    let insetLimit = Math.min(normalizedTarget.width, normalizedTarget.height) * 0.25;
    let inset = Math.min(Math.max(0, Number(targetInsetPx) || 0), insetLimit);
    protectedTarget = collisionRect({
      left: normalizedTarget.left + inset,
      top: normalizedTarget.top + inset,
      width: Math.max(0, normalizedTarget.width - inset * 2),
      height: Math.max(0, normalizedTarget.height - inset * 2),
    });
  }
  let cursorPoint = cursor && Number.isFinite(Number(cursor.x)) && Number.isFinite(Number(cursor.y))
    ? { x: Number(cursor.x), y: Number(cursor.y) }
    : null;
  let cursorSize = Number.isFinite(cursorSizePx) ? Math.max(0, cursorSizePx) : PRESENTER_CURSOR_SIZE_PX;
  let cursorRect = cursorPoint
    ? collisionRect({ ...cursorPoint, width: cursorSize, height: cursorSize })
    : null;
  let viewportRect = presenterViewportRect(viewport || {});
  let inkViewportCollision = Boolean(viewportRect && samples.some((point) => (
    point.x < viewportRect.left
      || point.x > viewportRect.right
      || point.y < viewportRect.top
      || point.y > viewportRect.bottom
  )));
  let cursorViewportCollision = Boolean(viewportRect && cursorRect && (
    cursorRect.left < viewportRect.left
      || cursorRect.right > viewportRect.right
      || cursorRect.top < viewportRect.top
      || cursorRect.bottom > viewportRect.bottom
  ));
  let viewportCollision = inkViewportCollision || cursorViewportCollision;
  let targetCollisionRect = protectedTarget ? expandCollisionRect(protectedTarget, allowance) : null;
  let targetInteriorCollision = Boolean(
    targetCollisionRect && pathIntersectsRect(samples, targetCollisionRect),
  );
  let cursorTargetCollision = Boolean(
    targetCollisionRect && cursorRect && rectsIntersect(cursorRect, targetCollisionRect),
  );
  let collisions = [];
  for (let [index, obstacle] of (Array.isArray(obstacles) ? obstacles : []).entries()) {
    let rect = collisionRect(obstacle?.rect || obstacle);
    if (!rect) continue;
    let protectedRect = expandCollisionRect(rect, allowance);
    let ink = pathIntersectsRect(samples, protectedRect);
    let cursorCollision = Boolean(cursorRect && rectsIntersect(cursorRect, protectedRect));
    if (ink || cursorCollision) {
      collisions.push({
        id: String(obstacle?.id || `obstacle-${index + 1}`),
        kind: String(obstacle?.kind || 'obstacle'),
        ink,
        cursor: cursorCollision,
        rect,
      });
    }
  }
  return {
    safe: !missingTarget
      && !targetInteriorCollision
      && !cursorTargetCollision
      && !viewportCollision
      && collisions.length === 0,
    allowancePx: allowance,
    targetInsetPx: normalizedTarget && protectedTarget ? protectedTarget.left - normalizedTarget.left : 0,
    cursorSizePx: cursorSize,
    sampleCount: samples.length,
    missingTarget,
    targetInteriorCollision,
    cursorTargetCollision,
    viewportCollision,
    inkViewportCollision,
    cursorViewportCollision,
    viewportRect,
    collisions,
  };
}

// Travel-between-checkpoints tuning.
const TRAVEL_MIN_MS = 850;
const TRAVEL_MAX_MS = 1600;
const TRAVEL_PX_PER_MS = 0.75; // longer hops take a little more time

// Gesture-flourish tuning.
const GESTURE_JITTER_PX = 2.4; // peak per-frame hand-tremor amplitude
const DETERMINISTIC_GESTURE_STEPS = 96;

const DEFAULT_HOLD_MS = 1200;

// Safety cap on how long a step waits for a gesture to report settlement past
// its hold, so a cursor that never reports back cannot stall the scenario. Well
// above any real gesture's animated duration.
const GESTURE_WAIT_CAP_MS = 4000;

const SVG_NS = 'http://www.w3.org/2000/svg';

export function normalizePresenterMarker(value, fallback = '') {
  let raw = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  let marker = MARKER_ALIASES[raw] || raw;
  if (PRESENTER_MARKER_SET.has(marker)) return marker;
  let rawFallback = String(fallback || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  let markerFallback = MARKER_ALIASES[rawFallback] || rawFallback;
  return PRESENTER_MARKER_SET.has(markerFallback) ? markerFallback : '';
}

export function normalizePresenterSymbol(value, fallback = '') {
  let raw = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  let symbol = SYMBOL_ALIASES[raw] || raw;
  if (PRESENTER_SYMBOL_SET.has(symbol)) return symbol;
  let rawFallback = String(fallback || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  let symbolFallback = SYMBOL_ALIASES[rawFallback] || rawFallback;
  return PRESENTER_SYMBOL_SET.has(symbolFallback) ? symbolFallback : '';
}

export function normalizePresenterAnnotationIntent(value, fallback = '') {
  let raw = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  let intent = INTENT_ALIASES[raw] || raw;
  if (ANNOTATION_INTENT_SET.has(intent)) return intent;
  let rawFallback = String(fallback || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  let fallbackIntent = INTENT_ALIASES[rawFallback] || rawFallback;
  return ANNOTATION_INTENT_SET.has(fallbackIntent) ? fallbackIntent : '';
}

function normalizeAnnotationKind(value, fallback = '') {
  let raw = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (raw === 'symbol' || raw === 'marker') return raw;
  return fallback === 'symbol' || fallback === 'marker' ? fallback : '';
}

function normalizeAnnotationPlacement(value, fallback = 'over') {
  let raw = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (ANNOTATION_PLACEMENTS.has(raw)) return raw;
  return ANNOTATION_PLACEMENTS.has(fallback) ? fallback : 'over';
}

export function normalizePresenterAnnotation(value = {}, fallback = {}) {
  let input = value && typeof value === 'object' ? value : { intent: value };
  let fallbackInput = fallback && typeof fallback === 'object' ? fallback : { intent: fallback };
  let intent = normalizePresenterAnnotationIntent(input.intent, fallbackInput.intent);
  let defaults = INTENT_DEFAULTS[intent] || {};
  let symbolCandidate = input.symbol || input.sign || (input.kind === 'symbol' ? input.intent : '') || defaults.symbol || fallbackInput.symbol;
  let markerCandidate = input.marker || input.gesture || input.shape || (input.kind === 'marker' ? input.intent : '') || defaults.marker || fallbackInput.marker;
  let symbol = normalizePresenterSymbol(symbolCandidate);
  let marker = normalizePresenterMarker(markerCandidate);
  let kind = normalizeAnnotationKind(input.kind, defaults.kind || fallbackInput.kind || (symbol ? 'symbol' : marker ? 'marker' : ''));
  if (kind === 'symbol') {
    symbol = symbol || normalizePresenterSymbol(input.intent || defaults.symbol || fallbackInput.intent);
    if (!symbol) return null;
    return {
      kind,
      intent,
      symbol,
      placement: normalizeAnnotationPlacement(input.placement, defaults.placement || fallbackInput.placement || 'after'),
    };
  }
  if (kind === 'marker') {
    marker = marker || normalizePresenterMarker(input.intent || defaults.marker || fallbackInput.intent);
    if (!marker) return null;
    return {
      kind,
      intent,
      marker,
      placement: normalizeAnnotationPlacement(input.placement, defaults.placement || fallbackInput.placement || 'over'),
    };
  }
  return null;
}

function styleText(overlaySelector) {
  return `
${overlaySelector}{
  position:fixed;
  inset:0;
  width:100vw;
  height:100vh;
  margin:0;
  padding:0;
  pointer-events:none;
  z-index:2147483646;
  opacity:0;
  overflow:visible;
}
${overlaySelector}.is-visible{opacity:1;}
${overlaySelector} .pc-marquee{
  position:absolute;
  top:0;
  left:0;
  width:0;
  height:0;
  overflow:visible;
  transform:translate(0,0);
  opacity:1;
  will-change:transform,width,height,opacity;
}
${overlaySelector} .pc-marquee.pc-marquee-faded{opacity:0;}
${overlaySelector} .pc-marquee svg{
  position:absolute;
  top:0;
  left:0;
  overflow:visible;
  display:block;
}
${overlaySelector} .pc-ants{
  fill:none;
  stroke-width:1;
  stroke-dasharray:4 4;
  shape-rendering:crispEdges;
}
${overlaySelector} .pc-ants-black{stroke:#000;}
${overlaySelector} .pc-ants-white{stroke:#fff;}
${overlaySelector} .pc-focus-handle{
  position:absolute;
  top:0;
  left:0;
  box-sizing:border-box;
  width:8px;
  height:8px;
  border:1px solid #fff;
  border-radius:2px;
  background:#111;
  box-shadow:0 0 0 1px #111;
  transform:translate(-50%, -50%);
  pointer-events:none;
  display:none;
}
${overlaySelector} .pc-ink{
  position:absolute;
  top:0;
  left:0;
  overflow:visible;
  pointer-events:none;
  opacity:0;
}
${overlaySelector} .pc-ink.is-inking{opacity:0.9;}
${overlaySelector} .pc-ink path{
  fill:none;
  stroke:var(--sn-presenter-marker, var(--sn-sys-accent));
  stroke-width:4.2;
  stroke-opacity:0.96;
  stroke-linecap:round;
  stroke-linejoin:round;
  shape-rendering:geometricPrecision;
  filter:drop-shadow(0 0 3px color-mix(in oklab, var(--sn-presenter-marker, var(--sn-sys-accent)) 35%, transparent));
}
${overlaySelector} .pc-click{
  position:absolute;
  top:0;
  left:0;
  width:${CLICK_RIPPLE_SIZE_PX}px;
  height:${CLICK_RIPPLE_SIZE_PX}px;
  border:2px solid var(--sn-presenter-click, var(--sn-sys-accent));
  border-radius:999px;
  background:color-mix(in oklab, var(--sn-presenter-click, var(--sn-sys-accent)) 18%, transparent);
  box-shadow:0 0 0 1px color-mix(in oklab, var(--sn-sys-surface) 40%, transparent),
    0 0 14px color-mix(in oklab, var(--sn-presenter-click, var(--sn-sys-accent)) 42%, transparent);
  opacity:0;
  transform:translate(-50%, -50%) scale(0.45);
  pointer-events:none;
  will-change:opacity,transform,left,top;
}
${overlaySelector} .pc-click.is-clicking{
  opacity:1;
  transform:translate(-50%, -50%) scale(1.85);
}
${overlaySelector} .pc-click.pc-click-fired{
  opacity:0;
  transform:translate(-50%, -50%) scale(2.15);
}
${overlaySelector} .pc-cursor{
  position:absolute;
  top:0;
  left:0;
  width:${CURSOR_SIZE}px;
  height:${CURSOR_SIZE}px;
  transform:translate(0,0);
  will-change:transform;
  filter:drop-shadow(0 1px 1px rgba(0,0,0,0.35));
}
${overlaySelector} .pc-cursor.is-inking{
  box-sizing:border-box;
  width:${INK_CURSOR_SIZE}px;
  height:${INK_CURSOR_SIZE}px;
  border:1px solid color-mix(in oklab, var(--sn-presenter-marker, var(--sn-sys-accent)) 78%, #fff);
  border-radius:50%;
  background:var(--sn-presenter-marker, var(--sn-sys-accent));
  box-shadow:0 0 4px color-mix(in oklab, var(--sn-presenter-marker, var(--sn-sys-accent)) 45%, transparent);
}
${overlaySelector} .pc-cursor.is-inking svg{display:none;}
`;
}

// Classic arrow pointer; the tip (hotspot) sits at 0,0 of the cursor box.
const CURSOR_SVG = `
<svg viewBox="0 0 24 24" xmlns="${SVG_NS}" width="${CURSOR_SIZE}" height="${CURSOR_SIZE}" aria-hidden="true">
  <path d="M2 1 L2 18 L6.5 13.7 L9.4 20.8 L12.3 19.6 L9.4 12.7 L15.6 12.4 Z"
        fill="#000" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/>
</svg>`;

function ensureStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  let style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = styleText(`.${OVERLAY_CLASS}`);
  (doc.head || doc.documentElement).appendChild(style);
}

function buildMarqueeSvg(doc) {
  let svg = doc.createElementNS(SVG_NS, 'svg');
  let black = doc.createElementNS(SVG_NS, 'rect');
  black.setAttribute('class', 'pc-ants pc-ants-black');
  let white = doc.createElementNS(SVG_NS, 'rect');
  white.setAttribute('class', 'pc-ants pc-ants-white');
  svg.appendChild(black);
  svg.appendChild(white);
  return { svg, black, white };
}

function sizeMarqueeSvg(svg, rects, w, h) {
  // Pad so the 1px stroke is not clipped at the marquee edges.
  let pad = 2;
  svg.setAttribute('width', String(w + pad * 2));
  svg.setAttribute('height', String(h + pad * 2));
  svg.style.left = `${-pad}px`;
  svg.style.top = `${-pad}px`;
  for (let rect of rects) {
    rect.setAttribute('x', String(pad + 0.5));
    rect.setAttribute('y', String(pad + 0.5));
    rect.setAttribute('width', String(Math.max(0, w - 1)));
    rect.setAttribute('height', String(Math.max(0, h - 1)));
  }
}

function normalizePresenterRect(rect = {}) {
  let left = Number(rect.left);
  let top = Number(rect.top);
  let right = Number(rect.right);
  let bottom = Number(rect.bottom);
  let width = Number(rect.width);
  let height = Number(rect.height);
  if (!Number.isFinite(left)) left = 0;
  if (!Number.isFinite(top)) top = 0;
  if (!Number.isFinite(right) && Number.isFinite(width)) right = left + width;
  if (!Number.isFinite(bottom) && Number.isFinite(height)) bottom = top + height;
  if (!Number.isFinite(width) && Number.isFinite(right)) width = right - left;
  if (!Number.isFinite(height) && Number.isFinite(bottom)) height = bottom - top;
  if (!Number.isFinite(width) || width < 0) width = 0;
  if (!Number.isFinite(height) || height < 0) height = 0;
  if (!Number.isFinite(right)) right = left + width;
  if (!Number.isFinite(bottom)) bottom = top + height;
  return { left, top, right, bottom, width, height };
}

function intersectPresenterRects(a, b) {
  let left = Math.max(a.left, b.left);
  let top = Math.max(a.top, b.top);
  let right = Math.min(a.right, b.right);
  let bottom = Math.min(a.bottom, b.bottom);
  let width = right - left;
  let height = bottom - top;
  if (width <= 0 || height <= 0) return null;
  return { left, top, right, bottom, width, height };
}

function presenterViewportRect(viewport = {}) {
  let width = Number(viewport.width);
  let height = Number(viewport.height);
  if (!Number.isFinite(width) || width <= 0) width = 0;
  if (!Number.isFinite(height) || height <= 0) height = 0;
  if (width <= 0 || height <= 0) return null;
  return { left: 0, top: 0, right: width, bottom: height, width, height };
}

function clampPresenterPoint(point, viewport = {}, cursorSize = CURSOR_SIZE) {
  let x = Number(point?.x);
  let y = Number(point?.y);
  if (!Number.isFinite(x)) x = 0;
  if (!Number.isFinite(y)) y = 0;
  let viewportRect = presenterViewportRect(viewport);
  if (!viewportRect) return { x, y };
  let size = Math.max(0, Number(cursorSize) || 0);
  let maxX = Math.max(viewportRect.left, viewportRect.right - size);
  let maxY = Math.max(viewportRect.top, viewportRect.bottom - size);
  return {
    x: Math.min(maxX, Math.max(viewportRect.left, x)),
    y: Math.min(maxY, Math.max(viewportRect.top, y)),
  };
}

function clampPresenterRect(rect, viewport = {}, inset = 0) {
  let source = normalizePresenterRect(rect);
  let viewportRect = presenterViewportRect(viewport);
  if (!viewportRect) return source;
  let edgeInset = Math.max(0, Number(inset) || 0);
  let leftEdge = Math.min(viewportRect.right, viewportRect.left + edgeInset);
  let topEdge = Math.min(viewportRect.bottom, viewportRect.top + edgeInset);
  let rightEdge = Math.max(leftEdge, viewportRect.right - edgeInset);
  let bottomEdge = Math.max(topEdge, viewportRect.bottom - edgeInset);
  let width = Math.min(source.width, rightEdge - leftEdge);
  let height = Math.min(source.height, bottomEdge - topEdge);
  let left = Math.min(rightEdge - width, Math.max(leftEdge, source.left));
  let top = Math.min(bottomEdge - height, Math.max(topEdge, source.top));
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function clipsPresenterTarget(el, win) {
  let style = null;
  try { style = win?.getComputedStyle?.(el); } catch {}
  let overflow = [
    style?.overflow,
    style?.overflowX,
    style?.overflowY,
  ].filter(Boolean).join(' ');
  if (/(auto|scroll|hidden|clip)/.test(overflow)) return true;
  if (style?.clipPath && style.clipPath !== 'none') return true;
  if (style?.contain && String(style.contain).split(/\s+/).includes('paint')) return true;
  return false;
}

function presenterClipAncestors(el, doc) {
  let out = [];
  let root = doc?.documentElement || null;
  let node = el?.parentElement || el?.parentNode || null;
  while (node && node !== doc && node !== doc?.body) {
    if (node.nodeType === 1) out.push(node);
    node = node.parentElement || node.parentNode || node.host || null;
  }
  if (root && root !== el) out.push(root);
  return out;
}

export function resolvePresenterVisibleRect(el, viewport = {}) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return null;
  let doc = el.ownerDocument || null;
  let win = doc?.defaultView || globalThis;
  let visible = normalizePresenterRect(el.getBoundingClientRect());
  if (visible.width <= 0 || visible.height <= 0) return null;

  let viewportClip = presenterViewportRect(viewport);
  if (viewportClip) {
    visible = intersectPresenterRects(visible, viewportClip);
    if (!visible) return null;
  }

  for (let ancestor of presenterClipAncestors(el, doc)) {
    if (!clipsPresenterTarget(ancestor, win) && ancestor !== doc?.documentElement) continue;
    if (typeof ancestor.getBoundingClientRect !== 'function') continue;
    let clipRect = normalizePresenterRect(ancestor.getBoundingClientRect());
    if (clipRect.width <= 0 || clipRect.height <= 0) continue;
    visible = intersectPresenterRects(visible, clipRect);
    if (!visible) return null;
  }
  return visible;
}

export function resolvePresenterHighlightRect(rect, viewport = {}) {
  let source = rect || {};
  let left = Number(source.left);
  let top = Number(source.top);
  let width = Number(source.width);
  let height = Number(source.height);
  if (!Number.isFinite(width) && Number.isFinite(source.right) && Number.isFinite(left)) {
    width = Number(source.right) - left;
  }
  if (!Number.isFinite(height) && Number.isFinite(source.bottom) && Number.isFinite(top)) {
    height = Number(source.bottom) - top;
  }
  if (!Number.isFinite(left)) left = 0;
  if (!Number.isFinite(top)) top = 0;
  if (!Number.isFinite(width) || width < 0) width = 0;
  if (!Number.isFinite(height) || height < 0) height = 0;

  let viewportWidth = Number(viewport.width);
  let viewportHeight = Number(viewport.height);
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    viewportWidth = Math.max(left + width, HIGHLIGHT_EDGE_INSET_PX * 2 + HIGHLIGHT_MIN_SIZE_PX);
  }
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    viewportHeight = Math.max(top + height, HIGHLIGHT_EDGE_INSET_PX * 2 + HIGHLIGHT_MIN_SIZE_PX);
  }

  let right = left + width;
  let bottom = top + height;
  let paddedLeft = left - HIGHLIGHT_PADDING_PX;
  let paddedTop = top - HIGHLIGHT_PADDING_PX;
  let paddedRight = right + HIGHLIGHT_PADDING_PX;
  let paddedBottom = bottom + HIGHLIGHT_PADDING_PX;

  let minLeft = HIGHLIGHT_EDGE_INSET_PX;
  let minTop = HIGHLIGHT_EDGE_INSET_PX;
  let maxRight = Math.max(minLeft + HIGHLIGHT_MIN_SIZE_PX, viewportWidth - HIGHLIGHT_EDGE_INSET_PX);
  let maxBottom = Math.max(minTop + HIGHLIGHT_MIN_SIZE_PX, viewportHeight - HIGHLIGHT_EDGE_INSET_PX);

  let nextLeft = Math.max(minLeft, paddedLeft);
  let nextTop = Math.max(minTop, paddedTop);
  let nextRight = Math.min(maxRight, paddedRight);
  let nextBottom = Math.min(maxBottom, paddedBottom);

  if (nextRight - nextLeft < HIGHLIGHT_MIN_SIZE_PX) {
    let cx = Math.min(Math.max(left + width / 2, minLeft + HIGHLIGHT_MIN_SIZE_PX / 2), maxRight - HIGHLIGHT_MIN_SIZE_PX / 2);
    nextLeft = Math.max(minLeft, cx - HIGHLIGHT_MIN_SIZE_PX / 2);
    nextRight = Math.min(maxRight, nextLeft + HIGHLIGHT_MIN_SIZE_PX);
  }
  if (nextBottom - nextTop < HIGHLIGHT_MIN_SIZE_PX) {
    let cy = Math.min(Math.max(top + height / 2, minTop + HIGHLIGHT_MIN_SIZE_PX / 2), maxBottom - HIGHLIGHT_MIN_SIZE_PX / 2);
    nextTop = Math.max(minTop, cy - HIGHLIGHT_MIN_SIZE_PX / 2);
    nextBottom = Math.min(maxBottom, nextTop + HIGHLIGHT_MIN_SIZE_PX);
  }

  return {
    left: nextLeft,
    top: nextTop,
    width: Math.max(HIGHLIGHT_MIN_SIZE_PX, nextRight - nextLeft),
    height: Math.max(HIGHLIGHT_MIN_SIZE_PX, nextBottom - nextTop),
  };
}

function presenterAnnotationRect(rect, viewport, annotation) {
  let clamped = clampPresenterRect(rect, viewport, HIGHLIGHT_EDGE_INSET_PX);
  let viewportRect = presenterViewportRect(viewport);
  if (!viewportRect
    || annotation?.kind !== 'marker'
    || !['freehand', 'underline'].includes(annotation.marker)) return clamped;

  let shortSide = Math.min(viewportRect.width, viewportRect.height);
  let maxWidth = shortSide * PRESENTER_ANNOTATION_MAX_SHORT_SIDE_RATIO;
  if (!(maxWidth > 0) || clamped.width <= maxWidth) return clamped;

  let width = maxWidth;
  let centerX = clamped.left + clamped.width / 2;
  let left = Math.min(
    viewportRect.right - HIGHLIGHT_EDGE_INSET_PX - width,
    Math.max(viewportRect.left + HIGHLIGHT_EDGE_INSET_PX, centerX - width / 2),
  );
  return {
    ...clamped,
    left,
    right: left + width,
    width,
  };
}

export function resolvePresenterTravelDuration(distance) {
  let dist = Math.max(0, Number(distance) || 0);
  return Math.max(
    TRAVEL_MIN_MS,
    Math.min(TRAVEL_MAX_MS, dist * (1 / TRAVEL_PX_PER_MS) + TRAVEL_MIN_MS * 0.6),
  );
}

// easeInOutCubic — slow start, quick middle, gentle settle: reads as a natural
// human glide rather than a linear slide.
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Deterministic pseudo-noise in [-1, 1]. A cheap hash of an integer seed and a
// phase, used in place of Math.random (which may be unavailable and would break
// reproducibility). The same (seed, phase) always yields the same value, so a
// gesture looks hand-drawn yet a given run is repeatable.
function noise(seed, phase) {
  let s = Math.sin(seed * 12.9898 + phase * 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

// Smoothly varying jitter offset for a frame: blends two noise samples so the
// tremor drifts rather than flickering, scaled by `amp`. `axis` separates the x
// and y streams so they wander independently.
function interpolatedNoise(seed, phase) {
  let low = noise(seed, Math.floor(phase));
  let high = noise(seed, Math.floor(phase) + 1);
  let frac = phase - Math.floor(phase);
  let smooth = frac * frac * (3 - 2 * frac);
  return low + (high - low) * smooth;
}

function jitter(seed, t, amp, axis) {
  let stream = seed + axis * 101;
  let wristDrift = interpolatedNoise(stream, t * 3.25 + axis * 19.7);
  let fingerTremor = interpolatedNoise(stream + 47, t * 10.5 + axis * 7.3);
  return (wristDrift * 0.72 + fingerTremor * 0.28) * amp;
}

// A small signed variation factor in roughly [-1, 1] derived from the move
// counter, so successive gestures differ in radius/length/speed without random.
function variation(seed, salt) {
  return noise(seed * 0.37 + 1, salt * 1.7);
}

/**
 * Gesture registry. Each entry, given the settled target rect, the move seed,
 * and the cursor's current rest point, returns a parametric path the runner
 * samples over progress `t` in [0, 1]. The runner adds per-frame jitter, eases
 * the timeline, and draws the ink trail, so a gesture only describes its ideal
 * shape. Add a name here to extend the set; an unknown name is a no-op.
 *
 * @typedef {{ x:number, y:number }} Pt
 * @typedef {{
 *   loops?: number,           // extra passes (duration multiplier ~ loops)
 *   point: (t:number) => Pt,  // ideal path position at progress t
 *   rest: Pt,                 // where the cursor comes to rest at the end
 * }} GesturePlan
 */
const GESTURES = {
  freehand(rect, seed) {
    let margin = Math.max(9, Math.min(18, rect.height * 0.18));
    let x0 = rect.left - Math.min(8, rect.width * 0.04);
    let x1 = rect.left + rect.width + Math.min(8, rect.width * 0.04);
    let baseY = rect.top + rect.height + margin;
    let amplitude = 3.5 + (variation(seed, 37) * 0.5 + 0.5) * 3;
    return {
      loops: 0,
      rest: { x: x1, y: baseY },
      point(t) {
        let drift = variation(seed, 41) * 2 * t;
        return {
          x: x0 + (x1 - x0) * t,
          y: baseY + Math.sin(t * Math.PI * 3.2) * amplitude * (1 - t * 0.2) + drift,
        };
      },
    };
  },

  // A left-to-right stroke just below the target, as if underlining it.
  underline(rect, seed, opts = {}) {
    let pad = rect.width * (0.06 + 0.04 * (variation(seed, 5) * 0.5 + 0.5));
    let x0 = rect.left + pad;
    let x1 = rect.left + rect.width - pad;
    let len = x1 - x0;
    let below = opts.placement !== 'above';
    let margin = below
      ? Math.max(10, Math.min(14, rect.height * 0.18))
      : CURSOR_SIZE + PRESENTER_ANNOTATION_COLLISION_ALLOWANCE_PX + 3;
    let direction = below ? 1 : -1;
    let edge = below ? rect.top + rect.height : rect.top;
    let y = edge + direction * (margin + variation(seed, 9) * 2);
    let droop = 2 + variation(seed, 19) * 2; // slight mid-stroke dip
    let returnFrac = 0.22 + (variation(seed, 23) * 0.5 + 0.5) * 0.12; // short pull-back
    return {
      loops: 0,
      rest: { x: x1, y },
      point(t) {
        if (t <= 1 - returnFrac) {
          let p = t / (1 - returnFrac);
          return { x: x0 + len * p, y: y + direction * Math.sin(p * Math.PI) * droop };
        }
        let p = (t - (1 - returnFrac)) / returnFrac;
        return {
          x: x1 - len * 0.3 * p,
          y: y - direction * Math.sin(p * Math.PI) * droop * 0.5,
        };
      },
    };
  },

  oval(rect, seed) {
    let cx = rect.left + rect.width / 2;
    let cy = rect.top + rect.height / 2;
    let shortSide = Math.min(rect.width, rect.height);
    let expressiveGap = 1.5 + Math.min(4.5, Math.max(0, shortSide - 24) * 0.075);
    let targetInset = Math.min(PRESENTER_ANNOTATION_TARGET_INSET_PX, shortSide * 0.25);
    let jitterScale = Math.max(0.4, Math.min(1, shortSide / 80));
    let verticalSafetyGap = INK_CURSOR_SIZE / 2
      + PRESENTER_ANNOTATION_COLLISION_ALLOWANCE_PX
      + GESTURE_JITTER_PX * jitterScale
      - targetInset
      + 0.75;
    let horizontalSafetyGap = verticalSafetyGap + INK_CURSOR_SIZE / 2;
    let horizontalGap = Math.max(expressiveGap, horizontalSafetyGap);
    let verticalGap = Math.max(expressiveGap, verticalSafetyGap);
    let rx = rect.width / 2 + horizontalGap + 0.5 + variation(seed, 33) * 0.2;
    let ry = rect.height / 2 + verticalGap + variation(seed, 35) * 0.2;
    return {
      loops: 0.15,
      jitterScale,
      rest: { x: cx + rx, y: cy },
      point(t) {
        let angle = t * Math.PI * 2 * 1.15;
        let cosine = Math.cos(angle);
        let sine = Math.sin(angle);
        let roundedX = Math.sign(cosine) * Math.pow(Math.abs(cosine), 0.25);
        let roundedY = Math.sign(sine) * Math.pow(Math.abs(sine), 0.25);
        let w = 1 + Math.sin(angle * 3) * 0.008 * variation(seed, 37);
        return {
          x: cx + rx * w * roundedX,
          y: cy + ry * w * roundedY,
        };
      },
    };
  },

  // One continuous felt-tip stroke: a slightly bowed shaft approaches the
  // target edge, then retraces twice to form the arrow head. Geometry remains
  // deterministic; the shared hand profile adds low-frequency wrist drift and
  // a smaller high-frequency tremor during projection.
  arrow(rect, seed, opts = {}) {
    let placement = opts.placement || 'before';
    let cx = rect.left + rect.width / 2;
    let cy = rect.top + rect.height / 2;
    let horizontal = placement === 'before' || placement === 'after';
    let viewportRect = presenterViewportRect(opts.viewport || {});
    let centerVector = Boolean(opts.centerVector && viewportRect);
    let ux = 0;
    let uy = 0;

    if (centerVector) {
      let viewportCenter = {
        x: viewportRect.left + viewportRect.width / 2,
        y: viewportRect.top + viewportRect.height / 2,
      };
      let dx = cx - viewportCenter.x;
      let dy = cy - viewportCenter.y;
      let distance = Math.hypot(dx, dy);
      if (distance >= 48) {
        ux = dx / distance;
        uy = dy / distance;
      } else {
        centerVector = false;
      }
    }

    if (!centerVector) {
      if (horizontal) {
        ux = placement === 'before' ? 1 : -1;
        uy = 0;
      } else {
        ux = 0;
        uy = placement === 'above' ? 1 : -1;
      }
    }

    let halfWidth = Math.max(1, rect.width / 2);
    let halfHeight = Math.max(1, rect.height / 2);
    let edgeDistance = Math.min(
      Math.abs(ux) > 0.0001 ? halfWidth / Math.abs(ux) : Number.POSITIVE_INFINITY,
      Math.abs(uy) > 0.0001 ? halfHeight / Math.abs(uy) : Number.POSITIVE_INFINITY,
    );
    let targetGap = 12;
    let tip = {
      x: cx - ux * (edgeDistance + targetGap),
      y: cy - uy * (edgeDistance + targetGap),
    };
    let viewportCenterDistance = viewportRect
      ? Math.hypot(
        tip.x - (viewportRect.left + viewportRect.width / 2),
        tip.y - (viewportRect.top + viewportRect.height / 2),
      )
      : Math.max(rect.width, rect.height) * 0.75 + 96;
    let reach = centerVector
      ? Math.max(132, Math.min(270, viewportCenterDistance * 0.48))
      : horizontal
        ? Math.max(108, Math.min(210, rect.width * 0.42 + 88))
        : Math.max(96, Math.min(190, rect.height * 0.8 + 72));
    if (centerVector) {
      let reachScale = Number(opts.reachScale);
      if (Number.isFinite(reachScale)) reach *= Math.max(0.5, Math.min(1, reachScale));
    }
    let normal = { x: -uy, y: ux };
    let tailOffset = variation(seed, 113) * Math.min(18, reach * 0.08);
    let start = {
      x: tip.x - ux * reach + normal.x * tailOffset,
      y: tip.y - uy * reach + normal.y * tailOffset,
    };
    let bend = (8 + Math.abs(variation(seed, 117)) * 8) * (variation(seed, 119) < 0 ? -1 : 1);
    let headLength = 30 + (variation(seed, 127) * 0.5 + 0.5) * 6;
    let headWidth = headLength * (0.82 + variation(seed, 131) * 0.035);
    let leftHead = {
      x: tip.x - ux * headLength + normal.x * headWidth,
      y: tip.y - uy * headLength + normal.y * headWidth,
    };
    let rightHead = {
      x: tip.x - ux * headLength - normal.x * headWidth,
      y: tip.y - uy * headLength - normal.y * headWidth,
    };
    return {
      loops: 0,
      pathMode: 'linear',
      jitterScale: 0.72,
      rest: tip,
      point(t) {
        if (t <= 0.72) {
          let p = t / 0.72;
          let ease = p * p * (3 - 2 * p);
          let bow = Math.sin(p * Math.PI) * bend * (1 - p);
          return {
            x: start.x + (tip.x - start.x) * ease + normal.x * bow,
            y: start.y + (tip.y - start.y) * ease + normal.y * bow,
          };
        }
        if (t <= 0.82) {
          let p = (t - 0.72) / 0.1;
          return { x: tip.x + (leftHead.x - tip.x) * p, y: tip.y + (leftHead.y - tip.y) * p };
        }
        if (t <= 0.9) {
          let p = (t - 0.82) / 0.08;
          return { x: leftHead.x + (tip.x - leftHead.x) * p, y: leftHead.y + (tip.y - leftHead.y) * p };
        }
        let p = (t - 0.9) / 0.1;
        return { x: tip.x + (rightHead.x - tip.x) * p, y: tip.y + (rightHead.y - tip.y) * p };
      },
    };
  },
};

function symbolRect(rect, placement = 'after') {
  let min = Math.max(18, Math.min(44, Math.min(rect.width || 24, rect.height || 24) * 0.9));
  let size = Math.max(min, Math.min(48, Math.max(rect.width, rect.height) * 0.28));
  let gap = Math.max(6, size * 0.2);
  let cx = rect.left + rect.width / 2;
  let cy = rect.top + rect.height / 2;
  if (placement === 'after') cx = rect.left + rect.width + gap + size / 2;
  else if (placement === 'before') cx = rect.left - gap - size / 2;
  else if (placement === 'corner') {
    cx = rect.left + rect.width - size * 0.1;
    cy = rect.top + size * 0.1;
  } else if (placement === 'below') {
    cy = rect.top + rect.height + gap + size / 2;
  } else if (placement === 'above') {
    cy = rect.top - gap - size / 2;
  }
  return { left: cx - size / 2, top: cy - size / 2, width: size, height: size };
}

function pointListPlan(points, rest = points[points.length - 1], loops = 0) {
  return {
    loops,
    rest,
    point(t) {
      let total = points.length - 1;
      let scaled = Math.min(total - 0.001, Math.max(0, t) * total);
      let i = Math.floor(scaled);
      let p = scaled - i;
      let a = points[i];
      let b = points[i + 1];
      return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
    },
  };
}

const SYMBOLS = {
  question(rect, seed, opts = {}) {
    let r = symbolRect(rect, opts.placement);
    let cx = r.left + r.width / 2;
    let top = r.top + r.height * 0.16;
    let mid = r.top + r.height * 0.48;
    let lower = r.top + r.height * 0.68;
    let dotY = r.top + r.height * 0.84;
    let w = r.width * (0.24 + (variation(seed, 71) * 0.5 + 0.5) * 0.08);
    let points = [
      { x: cx - w * 0.9, y: top + r.height * 0.08 },
      { x: cx - w * 0.4, y: top },
      { x: cx + w * 0.8, y: top + r.height * 0.06 },
      { x: cx + w, y: mid - r.height * 0.08 },
      { x: cx + w * 0.2, y: mid + r.height * 0.04 },
      { x: cx, y: lower },
      { x: cx, y: dotY - r.height * 0.08 },
      { x: cx + w * 0.2, y: dotY },
      { x: cx - w * 0.18, y: dotY + r.height * 0.02 },
      { x: cx + w * 0.12, y: dotY - r.height * 0.03 },
    ];
    return pointListPlan(points, points[points.length - 1], 0);
  },

  cross(rect, seed, opts = {}) {
    let r = symbolRect(rect, opts.placement);
    let pad = r.width * 0.2;
    let wobble = variation(seed, 73) * 2;
    return pointListPlan([
      { x: r.left + pad, y: r.top + pad + wobble },
      { x: r.left + r.width - pad, y: r.top + r.height - pad },
      { x: r.left + r.width * 0.54, y: r.top + r.height * 0.52 },
      { x: r.left + r.width - pad, y: r.top + pad },
      { x: r.left + pad, y: r.top + r.height - pad - wobble },
    ]);
  },

  check(rect, seed, opts = {}) {
    let r = symbolRect(rect, opts.placement);
    let pad = r.width * 0.18;
    let lift = variation(seed, 79) * 2;
    return pointListPlan([
      { x: r.left + pad, y: r.top + r.height * 0.58 },
      { x: r.left + r.width * 0.42, y: r.top + r.height - pad + lift },
      { x: r.left + r.width - pad, y: r.top + pad },
    ]);
  },

  heart(rect, seed, opts = {}) {
    let r = symbolRect(rect, opts.placement);
    let cx = r.left + r.width / 2;
    let cy = r.top + r.height * 0.56;
    let scale = r.width / 32;
    let tilt = variation(seed, 83) * 0.08;
    return {
      loops: 0.25,
      rest: { x: cx, y: r.top + r.height * 0.25 },
      point(t) {
        let a = Math.PI * 2 * t;
        let x = 16 * Math.pow(Math.sin(a), 3);
        let y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
        return {
          x: cx + (x * Math.cos(tilt) - y * Math.sin(tilt)) * scale,
          y: cy + (x * Math.sin(tilt) + y * Math.cos(tilt)) * scale,
        };
      },
    };
  },

  flourish(rect, seed, opts = {}) {
    let r = symbolRect(rect, opts.placement || 'below');
    let left = r.left - r.width * 0.4;
    let right = r.left + r.width * 1.4;
    let y = r.top + r.height * 0.55;
    let amp = r.height * (0.18 + (variation(seed, 89) * 0.5 + 0.5) * 0.12);
    return {
      loops: 0,
      rest: { x: right, y },
      point(t) {
        let x = left + (right - left) * t;
        return { x, y: y + Math.sin(t * Math.PI * 3.2) * amp * (1 - t * 0.25) };
      },
    };
  },
};

function annotationPlacementCandidates(annotation) {
  if (annotation.kind === 'marker') {
    if (annotation.marker === 'arrow') {
      let preferred = annotation.placement || 'before';
      return [preferred, ...['before', 'above', 'below', 'after'].filter((placement) => placement !== preferred)];
    }
    if (annotation.marker !== 'underline') return [annotation.placement || 'over'];
    return annotation.placement === 'above' ? ['above', 'below'] : ['below', 'above'];
  }
  let preferred = annotation.placement || 'after';
  if (preferred === 'after') return ['after', 'before', 'above', 'below', 'over'];
  if (preferred === 'below') return ['below', 'above', 'before', 'after', 'over'];
  if (preferred === 'before') return ['before', 'after', 'above', 'below', 'over'];
  if (preferred === 'above') return ['above', 'below', 'before', 'after', 'over'];
  return [preferred];
}

function presenterPlanOverflow(plan, seed, viewport) {
  let viewportRect = presenterViewportRect(viewport);
  if (!viewportRect || !plan?.point) return 0;
  let maxX = viewportRect.right - INK_CURSOR_SIZE;
  let maxY = viewportRect.bottom - INK_CURSOR_SIZE;
  if (maxX < viewportRect.left || maxY < viewportRect.top) return Number.POSITIVE_INFINITY;
  let points = [];
  let totalSteps = plan.arcLength ? Math.max(32, Math.floor(plan.arcLength / 2)) : DETERMINISTIC_GESTURE_STEPS;
  for (let index = 0; index <= totalSteps; index += 1) {
    points.push(projectStrokePoint(plan, seed, index / totalSteps));
  }
  if (plan.rest) points.push(plan.rest);
  return points.reduce((total, point) => total
    + Math.max(0, viewportRect.left - point.x)
    + Math.max(0, point.x - maxX)
    + Math.max(0, viewportRect.top - point.y)
    + Math.max(0, point.y - maxY), 0);
}

function estimatePlanLength(plan) {
  let length = 0;
  let prev = plan.point(0);
  for (let index = 1; index <= 200; index += 1) {
    let pt = plan.point(index / 200);
    length += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    prev = pt;
  }
  return length;
}

function createPresenterStrokeArc(plan, seed, viewport) {
  let idealLength = estimatePlanLength(plan);
  let sampleCount = Math.max(200, Math.min(800, Math.ceil(idealLength / 2)));
  let amplitude = strokeJitterAmplitude(seed);
  let samples = [];
  let totalDistance = 0;
  let previous = projectStrokePoint(plan, seed, 0, amplitude, viewport);
  samples.push({ point: previous, distancePx: 0 });
  for (let index = 1; index <= sampleCount; index += 1) {
    let point = projectStrokePoint(plan, seed, index / sampleCount, amplitude, viewport);
    totalDistance += Math.hypot(point.x - previous.x, point.y - previous.y);
    samples.push({ point, distancePx: totalDistance });
    previous = point;
  }
  return { samples, arcLengthPx: totalDistance };
}

function presenterArcPointAtDistance(arc, distancePx) {
  let target = Math.max(0, Math.min(arc.arcLengthPx, Number(distancePx) || 0));
  let low = 0;
  let high = arc.samples.length - 1;
  while (low < high) {
    let middle = Math.floor((low + high) / 2);
    if (arc.samples[middle].distancePx < target) low = middle + 1;
    else high = middle;
  }
  let next = arc.samples[low];
  let previous = arc.samples[Math.max(0, low - 1)];
  let span = next.distancePx - previous.distancePx;
  if (span <= 0) return { ...next.point };
  let ratio = (target - previous.distancePx) / span;
  return {
    x: previous.point.x + (next.point.x - previous.point.x) * ratio,
    y: previous.point.y + (next.point.y - previous.point.y) * ratio,
  };
}

function samplePresenterStrokeArc(arc, distancePx, stepPx = 2) {
  let target = Math.max(0, Math.min(arc.arcLengthPx, Number(distancePx) || 0));
  if (target <= 0) return [];
  let points = [{ ...arc.samples[0].point }];
  for (let distance = stepPx; distance <= target; distance += stepPx) {
    points.push(presenterArcPointAtDistance(arc, distance));
  }
  return points;
}

function resolvePresenterAnnotationLayout(annotation, targetRect, viewport, seed, obstacles = []) {
  let drawRect = presenterAnnotationRect(targetRect, viewport, annotation);
  let factory = annotation.kind === 'symbol'
    ? SYMBOLS[annotation.symbol]
    : GESTURES[annotation.marker];
  let best = null;
  let placements = annotationPlacementCandidates(annotation);
  let candidates = annotation.kind === 'marker' && annotation.marker === 'arrow'
    ? [1, 0.8, 0.64, 0.5].map((reachScale) => ({
      placement: placements[0],
      centerVector: true,
      reachScale,
    }))
    : placements.map((placement) => ({ placement, centerVector: false }));
  for (let candidate of candidates) {
    let { placement, centerVector, reachScale } = candidate;
    let nextAnnotation = { ...annotation, placement };
    let plan = factory?.(drawRect, seed, {
      placement,
      viewport,
      centerVector,
      reachScale,
    });
    if (!plan) continue;
    let overflow = presenterPlanOverflow(plan, seed, viewport);
    let strokeArc = createPresenterStrokeArc(plan, seed, viewport);
    let fullPathSamples = strokeArc.samples.map((sample) => ({ ...sample.point }));
    let fullCursor = fullPathSamples.at(-1) || null;
    let fullSafety = analyzePresenterAnnotationSafety({
      pathSamples: fullPathSamples,
      cursor: fullCursor,
      targetRect,
      obstacles,
      viewport,
      cursorSizePx: INK_CURSOR_SIZE,
    });
    if (!best
      || (fullSafety.safe && !best.fullSafety.safe)
      || (fullSafety.safe === best.fullSafety.safe && overflow < best.overflow)) {
      let rawGeometryRect = annotation.kind === 'symbol'
        ? symbolRect(drawRect, placement)
        : drawRect;
      best = {
        annotation: nextAnnotation,
        drawRect,
        geometryRect: clampPresenterRect(rawGeometryRect, viewport),
        plan: {
          ...plan,
          arcLength: strokeArc.arcLengthPx,
        },
        fullPathSamples,
        fullCursor,
        fullSafety,
        overflow,
      };
    }
    if (fullSafety.safe && overflow === 0) break;
  }
  return best;
}

function hasDocument(doc) {
  return Boolean(doc && doc.body && typeof doc.createElement === 'function');
}

/** Inert handle returned when there is no DOM to drive (e.g. Node import). */
function inertCursor() {
  return {
    // Still honor the gesture-settled contract so a scenario awaiting a gesture
    // never hangs in a non-browser env.
    moveTo(_el, opts) {
      if (opts && typeof opts.onGestureSettled === 'function') {
        try {
          opts.onGestureSettled();
        } catch (_) {}
      }
    },
    markElement(_el, opts) {
      if (opts && typeof opts.onGestureSettled === 'function') {
        try {
          opts.onGestureSettled();
        } catch (_) {}
      }
    },
    annotateElement(_el, opts) {
      if (opts && typeof opts.onGestureSettled === 'function') {
        try {
          opts.onGestureSettled();
        } catch (_) {}
      }
    },
    clickElement(_el, opts) {
      if (opts && typeof opts.onGestureSettled === 'function') {
        try {
          opts.onGestureSettled();
        } catch (_) {}
      }
    },
    presentAnnotationFrame() {
      return { presented: false, reason: 'unsupported' };
    },
    presentApproachFrame() {
      return { presented: false, reason: 'unsupported' };
    },
    presentFocusFrame() {
      return { presented: false, reason: 'unsupported' };
    },
    presentClickFrame() {
      return { presented: false, reason: 'unsupported' };
    },
    clear() {},
    dispose() {},
    isSupported() {
      return false;
    },
  };
}

/**
 * Create a presenter cursor over `doc`.
 *
 * Works on any element: `moveTo(el)` reads `el.getBoundingClientRect()` live, so
 * the marquee always tracks the element's current viewport box. In a non-browser
 * env this returns inert no-ops and `isSupported()` is false.
 *
 * @param {Document} [doc] - document to render into (defaults to the global one).
 * @returns {{ moveTo: (el: Element, opts?: object) => void, markElement: (el: Element, opts?: object) => void, annotateElement: (el: Element, opts?: object) => void, presentApproachFrame: (el: Element, frame: object) => object, presentFocusFrame: (el: Element, frame: object) => object, presentAnnotationFrame: (el: Element, annotation: object, frame: object) => object, presentClickFrame: (el: Element, frame: object) => object, clickElement: (el: Element, opts?: object) => void, clear: () => void, dispose: () => void, isSupported: () => boolean }}
 */
function layerStartMs(layer) {
  let value = Number(layer?.startMs ?? layer?.startTime ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function frameElapsed(timeMs, layer, durationMs) {
  let raw = Math.max(0, Number(timeMs) - layerStartMs(layer));
  if (raw >= durationMs) return durationMs;
  return Math.floor(raw / PRESENTER_FRAME_MS) * PRESENTER_FRAME_MS;
}

function smoothPresenterPath(points, mode = 'smooth') {
  if (points.length < 2) return '';
  if (mode === 'linear') {
    return points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join('');
  }
  let [first, second, ...rest] = points;
  let path = `M${first.x.toFixed(1)} ${first.y.toFixed(1)}Q${first.x.toFixed(1)} ${first.y.toFixed(1)} ${second.x.toFixed(1)} ${second.y.toFixed(1)}`;
  for (let point of rest) path += `T${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  return path;
}

function strokeJitterAmplitude(seed) {
  return GESTURE_JITTER_PX * (0.85 + (variation(seed, 31) * 0.5 + 0.5) * 0.4);
}

function projectStrokePoint(
  plan,
  seed,
  t,
  amplitude = strokeJitterAmplitude(seed),
  viewport = null,
) {
  let eased = easeInOutCubic(t);
  let ideal = plan.point(eased);
  let fade = 1 - eased * eased;
  let jitterScale = Number.isFinite(plan?.jitterScale)
    ? Math.max(0, Math.min(1, plan.jitterScale))
    : 1;
  let point = {
    x: ideal.x + jitter(seed, eased, amplitude * jitterScale, 0) * fade,
    y: ideal.y + jitter(seed, eased, amplitude * jitterScale, 1) * fade,
  };
  return viewport ? clampPresenterPoint(point, viewport) : point;
}

function projectStroke(layer, timeMs, seed, registry, normalizeName, options = {}) {
  let result = {
    visible: false,
    path: '',
    points: [],
    opacity: 0,
    name: '',
    placement: '',
    rect: null,
    cursor: null,
    safety: null,
    completed: false,
    motorActive: false,
  };
  if (!layer?.active || !layer.rect || Number(timeMs) < layerStartMs(layer)) return result;
  let name = normalizeName(layer.name);
  if (!name || !registry[name]) return result;
  let viewport = presenterViewportRect(layer.viewport || {}) ? layer.viewport : options.viewport;
  let targetRect = layer.targetRect || layer.rect;
  let annotation = options.kind === 'symbol'
    ? { kind: 'symbol', symbol: name, placement: layer.placement || 'after' }
    : { kind: 'marker', marker: name, placement: layer.placement || 'over' };
  let layout = layer.layout
    || resolvePresenterAnnotationLayout(annotation, targetRect, viewport, seed);
  if (!layout?.plan) return result;
  let plan = layout.plan;

  let arc = createPresenterStrokeArc(plan, seed, viewport);
  let timing = resolvePresenterAnnotationTiming(arc.arcLengthPx);
  let duration = timing.durationMs;
  if (layer.durationMs !== undefined) duration = Math.max(1, Number(layer.durationMs) || 1);
  else if (layer.duration !== undefined) duration = Math.max(1, Number(layer.duration) || 1);

  let elapsedMs = frameElapsed(timeMs, layer, duration);
  let progress = Math.max(0, Math.min(1, elapsedMs / duration));
  let drawnLengthPx = progress * arc.arcLengthPx;
  let points = samplePresenterStrokeArc(arc, drawnLengthPx);

  let strokeTip = points.length
    ? points[points.length - 1]
    : { ...arc.samples[0].point };
  if (progress >= 1 && plan.rest) strokeTip = clampPresenterPoint(plan.rest, viewport, 0);
  let cursorPoint = clampPresenterPoint({
    x: strokeTip.x - INK_CURSOR_SIZE * 0.35,
    y: strokeTip.y - INK_CURSOR_SIZE * 0.35,
  }, viewport, INK_CURSOR_SIZE);
  let obstacles = Array.isArray(layer.obstacles) ? layer.obstacles : options.obstacles;
  let safety = analyzePresenterAnnotationSafety({
    pathSamples: points,
    cursor: cursorPoint,
    targetRect,
    obstacles,
    viewport,
    cursorSizePx: INK_CURSOR_SIZE,
  });
  let hideCursor = layer.hideCursor === true
    || layer.cursor === false
    || layer.ownsCursor === false;
  return {
    visible: true,
    path: smoothPresenterPath(points, plan.pathMode),
    points,
    opacity: 1,
    name,
    placement: layout.annotation.placement,
    rect: layout.geometryRect,
    drawRect: layout.drawRect,
    cursor: hideCursor ? null : cursorPoint,
    ownsCursor: layer.ownsCursor !== false,
    cursorSizePx: INK_CURSOR_SIZE,
    safety,
    completed: progress >= 1,
    motorActive: progress < 1,
    durationMs: duration,
    elapsedMs,
    progress,
    arcLengthPx: arc.arcLengthPx,
    drawnLengthPx,
    averageSpeedPxPerMs: duration > 0 ? arc.arcLengthPx / duration : 0,
    timing,
  };
}

function projectFocusLayer(layer, timeMs, viewport) {
  let hidden = {
    visible: false,
    activePhase: '',
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    opacity: 0,
    antsDashOffset: 0,
    revealProgress: 0,
    revealing: false,
    completed: false,
    motorActive: false,
    dragHandle: null,
    targetRect: null,
  };
  if (!layer?.active || !layer.rect || Number(timeMs) < layerStartMs(layer)) return hidden;

  let targetRect = clampPresenterRect(layer.rect, viewport);
  let rawElapsedMs = Math.max(0, Number(timeMs) - layerStartMs(layer));
  let marchTime = frameElapsed(timeMs, layer, Number.MAX_SAFE_INTEGER);
  if (layer.mode !== 'rectangle-selection') {
    let durationMs = Math.max(
      PRESENTER_FRAME_MS,
      Number(layer.durationMs ?? layer.duration) || PRESENTER_FOCUS_REVEAL_DURATION_MS,
    );
    let elapsedMs = frameElapsed(timeMs, layer, durationMs);
    let progress = Math.min(1, elapsedMs / durationMs);
    let revealProgress = easeInOutCubic(progress);
    let width = progress >= 1
      ? targetRect.width
      : Math.min(targetRect.width, Math.max(1, targetRect.width * revealProgress));
    let height = progress >= 1
      ? targetRect.height
      : Math.min(targetRect.height, Math.max(1, targetRect.height * revealProgress));
    return {
      visible: true,
      activePhase: progress >= 1 ? 'complete' : 'reveal',
      left: targetRect.left,
      top: targetRect.top,
      width,
      height,
      opacity: 1,
      antsDashOffset: -8 * ((marchTime % MARCH_MS) / MARCH_MS),
      revealProgress,
      revealing: progress < 1,
      completed: progress >= 1,
      motorActive: progress < 1,
      mutationReady: false,
      dragHandle: {
        x: targetRect.left + width,
        y: targetRect.top + height,
        visible: progress < 1,
      },
      cursor: null,
      targetRect,
      timing: { durationMs },
    };
  }

  let timing = resolvePresenterRectangleTiming(targetRect);
  let elapsedMs = Math.min(rawElapsedMs, timing.durationMs);
  let dragStartMs = timing.pressMs;
  let holdStartMs = dragStartMs + timing.dragMs;
  let releaseStartMs = holdStartMs + timing.holdMs;
  let activePhase = 'complete';
  let revealProgress = 1;
  let opacity = 0;
  if (rawElapsedMs < dragStartMs) {
    activePhase = 'press';
    revealProgress = 0;
    opacity = 1;
  } else if (rawElapsedMs < holdStartMs) {
    activePhase = 'drag';
    revealProgress = easeInOutCubic((elapsedMs - dragStartMs) / timing.dragMs);
    opacity = 1;
  } else if (rawElapsedMs < releaseStartMs) {
    activePhase = 'hold';
    opacity = 1;
  } else if (rawElapsedMs < timing.durationMs) {
    activePhase = 'release';
    opacity = 1 - ((elapsedMs - releaseStartMs) / timing.releaseMs);
  }
  let width = revealProgress <= 0
    ? 1
    : Math.min(targetRect.width, Math.max(1, targetRect.width * revealProgress));
  let height = revealProgress <= 0
    ? 1
    : Math.min(targetRect.height, Math.max(1, targetRect.height * revealProgress));
  let complete = activePhase === 'complete';
  return {
    visible: !complete,
    activePhase,
    left: targetRect.left,
    top: targetRect.top,
    width,
    height,
    opacity: Math.max(0, opacity),
    antsDashOffset: -8 * ((marchTime % MARCH_MS) / MARCH_MS),
    revealProgress,
    revealing: activePhase === 'press' || activePhase === 'drag',
    completed: complete,
    motorActive: !complete,
    mutationReady: complete,
    dragHandle: {
      x: targetRect.left + width,
      y: targetRect.top + height,
      visible: false,
    },
    cursor: {
      x: targetRect.left + width,
      y: targetRect.top + height,
      visible: !complete,
    },
    targetRect,
    timing,
  };
}

export function projectPresenterState(layers = {}, timeMs = 0, seed = 0, viewport = {}) {
  let focusRes = projectFocusLayer(layers.focus, timeMs, viewport);

  let markerRes = projectStroke(
    layers.marker,
    timeMs,
    seed,
    GESTURES,
    normalizePresenterMarker,
    { kind: 'marker', viewport, obstacles: viewport?.obstacles },
  );
  let symbolRes = projectStroke(
    layers.symbol,
    timeMs,
    seed,
    SYMBOLS,
    normalizePresenterSymbol,
    { kind: 'symbol', viewport, obstacles: viewport?.obstacles },
  );

  let click = layers.click;
  let clickRes = { visible: false, x: 0, y: 0, scale: 0.45, opacity: 0, completed: false, motorActive: false };
  let clickDuration = CLICK_PRESS_MS + CLICK_FADE_MS;
  if (click?.active && Number(timeMs) >= layerStartMs(click)) {
    let progress = frameElapsed(timeMs, click, clickDuration) / clickDuration;
    clickRes = {
      visible: progress <= 1,
      x: click.x,
      y: click.y,
      scale: 0.45 + (2.15 - 0.45) * progress,
      opacity: progress < 0.5 ? 1 : Math.max(0, 1 - (progress - 0.5) / 0.5),
      completed: progress >= 1,
      motorActive: progress < 1,
    };
  }

  let cursorLayer = layers.cursor;
  let cursorRes = { visible: false, x: 0, y: 0, opacity: 1, completed: false, motorActive: false };
  if (cursorLayer?.active && Number(timeMs) >= layerStartMs(cursorLayer)) {
    cursorRes.visible = true;
    let duration = Math.max(1, Number(cursorLayer.durationMs ?? cursorLayer.duration) || TRAVEL_MIN_MS);
    let progress = frameElapsed(timeMs, cursorLayer, duration) / duration;
    let isTraveling = cursorLayer.fromX !== undefined && cursorLayer.toX !== undefined && progress < 1;

    cursorRes.motorActive = isTraveling;
    cursorRes.completed = !isTraveling;

    if (isTraveling) {
      let eased = easeInOutCubic(progress);
      let dx = cursorLayer.toX - cursorLayer.fromX;
      let dy = cursorLayer.toY - cursorLayer.fromY;
      let distance = Math.hypot(dx, dy);
      if (distance < 1) {
        cursorRes.x = cursorLayer.toX;
        cursorRes.y = cursorLayer.toY;
      } else {
        let perpendicularX = -dy / distance;
        let perpendicularY = dx / distance;
        let side = seed % 2 === 0 ? 1 : -1;
        let wobble = ((seed % 5) - 2) * 0.04;
        let bow = distance * (0.16 + wobble) * side;
        let controlX = cursorLayer.fromX + dx * 0.5 + perpendicularX * bow;
        let controlY = cursorLayer.fromY + dy * 0.5 + perpendicularY * bow;
        let inverse = 1 - eased;
        cursorRes.x = inverse * inverse * cursorLayer.fromX
          + 2 * inverse * eased * controlX
          + eased * eased * cursorLayer.toX;
        cursorRes.y = inverse * inverse * cursorLayer.fromY
          + 2 * inverse * eased * controlY
          + eased * eased * cursorLayer.toY;
      }
    } else if (cursorLayer.fromX !== undefined && cursorLayer.toX !== undefined && progress >= 1) {
      cursorRes.x = cursorLayer.toX;
      cursorRes.y = cursorLayer.toY;
    } else {
      cursorRes.x = cursorLayer.x !== undefined ? Number(cursorLayer.x) : (cursorLayer.toX !== undefined ? Number(cursorLayer.toX) : 0);
      cursorRes.y = cursorLayer.y !== undefined ? Number(cursorLayer.y) : (cursorLayer.toY !== undefined ? Number(cursorLayer.toY) : 0);
      if (!Number.isFinite(cursorRes.x)) cursorRes.x = 0;
      if (!Number.isFinite(cursorRes.y)) cursorRes.y = 0;
    }

    let clampedCursor = clampPresenterPoint(cursorRes, viewport);
    cursorRes.x = clampedCursor.x;
    cursorRes.y = clampedCursor.y;
  }

  let activeMotorLayers = [];
  if (focusRes.visible && focusRes.motorActive) {
    activeMotorLayers.push('focus');
  }
  if (markerRes.visible && markerRes.motorActive) {
    activeMotorLayers.push('marker');
  }
  if (symbolRes.visible && symbolRes.motorActive) {
    activeMotorLayers.push('symbol');
  }
  if (cursorRes.visible && cursorRes.motorActive) {
    activeMotorLayers.push('cursor');
  }
  if (clickRes.visible && clickRes.motorActive) {
    activeMotorLayers.push('click');
  }

  if (activeMotorLayers.length > 1) {
    activeMotorLayers.sort();
    let err = new Error(`Malformed input: Mutually exclusive emphasis layers (${activeMotorLayers.join(', ')}) active simultaneously.`);
    err.code = 'ERR_MUTUALLY_EXCLUSIVE_LAYERS';
    err.diagnostics = {
      error: 'Mutually exclusive emphasis layers active simultaneously',
      code: 'ERR_MUTUALLY_EXCLUSIVE_LAYERS',
      activeLayers: activeMotorLayers,
      focus: layers.focus,
      marker: layers.marker,
      symbol: layers.symbol,
      cursor: layers.cursor,
      click: layers.click,
    };
    throw err;
  }

  let activeAnnotation = null;
  if (markerRes.visible && !markerRes.completed) {
    activeAnnotation = { kind: 'marker', ...markerRes };
  } else if (symbolRes.visible && !symbolRes.completed) {
    activeAnnotation = { kind: 'symbol', ...symbolRes };
  } else if (markerRes.visible) {
    activeAnnotation = { kind: 'marker', ...markerRes };
  } else if (symbolRes.visible) {
    activeAnnotation = { kind: 'symbol', ...symbolRes };
  }

  if (activeAnnotation && activeAnnotation.ownsCursor === false) {
    activeAnnotation.cursor = null;
  }

  return {
    focus: focusRes,
    marker: markerRes,
    symbol: symbolRes,
    click: clickRes,
    cursor: cursorRes,
    annotation: activeAnnotation,
  };
}

export function createPresenterCursor(doc = typeof document !== 'undefined' ? document : null) {
  if (!hasDocument(doc)) return inertCursor();

  ensureStyle(doc);

  let overlay = doc.createElement('div');
  overlay.className = OVERLAY_CLASS;

  let marquee = doc.createElement('div');
  marquee.className = 'pc-marquee';

  let { svg, black: rectBlack, white: rectWhite } = buildMarqueeSvg(doc);
  marquee.appendChild(svg);

  let focusHandle = doc.createElement('div');
  focusHandle.className = 'pc-focus-handle';

  // Ink trail: a faint SVG path drawn under the cursor during a gesture so the
  // flourish reads, then fades out. Sits below the cursor in the overlay.
  let ink = doc.createElementNS(SVG_NS, 'svg');
  ink.setAttribute('class', 'pc-ink');
  let inkPath = doc.createElementNS(SVG_NS, 'path');
  ink.appendChild(inkPath);

  let clickHalo = doc.createElement('div');
  clickHalo.className = 'pc-click';

  let cursor = doc.createElement('div');
  cursor.className = 'pc-cursor';
  cursor.style.opacity = '0';
  cursor.innerHTML = CURSOR_SVG;

  overlay.appendChild(marquee);
  overlay.appendChild(focusHandle);
  overlay.appendChild(ink);
  overlay.appendChild(clickHalo);
  overlay.appendChild(cursor);
  doc.body.appendChild(overlay);

  let win = doc.defaultView || (typeof window !== 'undefined' ? window : null);
  let nowMs = () =>
    win && win.performance && typeof win.performance.now === 'function'
      ? win.performance.now()
      : Date.now();
  let raf =
    (win && win.requestAnimationFrame && win.requestAnimationFrame.bind(win)) ||
    ((cb) => setTimeout(() => cb(nowMs()), 16));
  let caf =
    (win && win.cancelAnimationFrame && win.cancelAnimationFrame.bind(win)) ||
    ((id) => clearTimeout(id));

  function resolveViewport(supplied = {}) {
    let width = Number(supplied?.width);
    let height = Number(supplied?.height);
    if (!Number.isFinite(width) || width <= 0) {
      width = win?.innerWidth || doc.documentElement?.clientWidth || 0;
    }
    if (!Number.isFinite(height) || height <= 0) {
      height = win?.innerHeight || doc.documentElement?.clientHeight || 0;
    }
    return { width, height };
  }

  let disposed = false;
  let cursorX = null;
  let cursorY = null;
  let cursorPositioned = false;
  let moveIndex = 0;
  let actionCounter = 0;
  let currentActionId = null;
  let currentActionResolver = null;
  let activeElementTarget = null;
  let gestureResolve = null;
  let clickActions = new Map();

  let activeLayers = {
    focus: null,
    marker: null,
    symbol: null,
    click: null,
    cursor: null,
    viewport: null,
  };
  let animationStartMs = null;
  let renderLoopId = null;

  function defaultCursorPoint(viewport) {
    return clampPresenterPoint({
      x: viewport.width * 0.5,
      y: viewport.height * 0.8,
    }, viewport);
  }

  function currentCursorPoint(viewport) {
    return cursorPositioned
      ? clampPresenterPoint({ x: cursorX, y: cursorY }, viewport)
      : defaultCursorPoint(viewport);
  }

  function runRenderLoop() {
    if (renderLoopId) return;
    function tick(now) {
      if (disposed) {
        renderLoopId = 0;
        return;
      }
      let elapsed = now - (animationStartMs ?? now);

      let viewport = resolveViewport(activeLayers.viewport);
      let projected = projectPresenterState(activeLayers, elapsed, moveIndex, viewport);

      if (projected.focus.visible) {
        marquee.classList.remove('pc-marquee-faded');
        marquee.style.transform = `translate(${projected.focus.left}px, ${projected.focus.top}px)`;
        marquee.style.width = `${projected.focus.width}px`;
        marquee.style.height = `${projected.focus.height}px`;
        sizeMarqueeSvg(svg, [rectBlack, rectWhite], projected.focus.width, projected.focus.height);
        rectBlack.style.strokeDashoffset = `${projected.focus.antsDashOffset}`;
        rectWhite.style.strokeDashoffset = `${projected.focus.antsDashOffset - 4}`;
        if (projected.focus.dragHandle?.visible) {
          focusHandle.style.left = `${projected.focus.dragHandle.x}px`;
          focusHandle.style.top = `${projected.focus.dragHandle.y}px`;
          focusHandle.style.display = 'block';
        } else {
          focusHandle.style.display = 'none';
        }
      } else {
        hideMarqueeFrame();
      }

      let dParts = [];
      if (projected.marker.visible && projected.marker.path) {
        dParts.push(projected.marker.path);
      }
      if (projected.symbol.visible && projected.symbol.path) {
        dParts.push(projected.symbol.path);
      }
      let d = dParts.join(' ');
      inkPath.setAttribute('d', d);
      ink.classList.toggle('is-inking', Boolean(d));
      cursor.classList.toggle('is-inking', Boolean(projected.annotation && !projected.annotation.completed));

      if (projected.click.visible) {
        clickHalo.style.left = `${projected.click.x}px`;
        clickHalo.style.top = `${projected.click.y}px`;
        clickHalo.style.transform = `translate(-50%, -50%) scale(${projected.click.scale})`;
        clickHalo.style.opacity = projected.click.opacity;
        clickHalo.style.display = 'block';
      } else {
        clickHalo.style.display = 'none';
      }

      if (projected.annotation?.cursor && !projected.annotation.completed) {
        setCursor(projected.annotation.cursor.x, projected.annotation.cursor.y);
      } else if (projected.cursor.visible) {
        setCursor(projected.cursor.x, projected.cursor.y);
      } else if (projected.annotation?.cursor) {
        setCursor(projected.annotation.cursor.x, projected.annotation.cursor.y);
      } else {
        cursor.style.opacity = '0';
      }

      let needsNextFrame = false;
      if (activeLayers.focus?.active
        && elapsed < layerStartMs(activeLayers.focus)
          + (activeLayers.focus.duration || PRESENTER_FOCUS_REVEAL_DURATION_MS)) {
        needsNextFrame = true;
      }
      if (activeLayers.cursor?.active
        && elapsed < layerStartMs(activeLayers.cursor) + (activeLayers.cursor.duration || TRAVEL_MIN_MS)) {
        needsNextFrame = true;
      }
      if (activeLayers.marker?.active
        && elapsed < layerStartMs(activeLayers.marker) + (activeLayers.marker.duration || resolvePresenterAnnotationDuration(activeLayers.marker.layout?.plan?.arcLength || 0, activeLayers.marker.layout?.plan?.loops || 0))) {
        needsNextFrame = true;
      }
      if (activeLayers.symbol?.active
        && elapsed < layerStartMs(activeLayers.symbol) + (activeLayers.symbol.duration || resolvePresenterAnnotationDuration(activeLayers.symbol.layout?.plan?.arcLength || 0, activeLayers.symbol.layout?.plan?.loops || 0))) {
        needsNextFrame = true;
      }
      if (activeLayers.click?.active
        && elapsed < layerStartMs(activeLayers.click) + CLICK_PRESS_MS + CLICK_FADE_MS) {
        needsNextFrame = true;
      }

      if (needsNextFrame) {
        renderLoopId = raf(tick);
      } else {
        renderLoopId = 0;
        if (activeLayers.click && activeLayers.click.active) {
          activeLayers.click.active = false;
        }
        if (currentActionResolver) {
          let resolve = currentActionResolver;
          currentActionResolver = null;
          let receipt = {
            actionId: currentActionId,
            status: 'settled',
            target: activeElementTarget,
          };
          if (projected.annotation?.safety) {
            receipt.annotation = {
              kind: projected.annotation.kind,
              name: projected.annotation.name,
              placement: projected.annotation.placement,
              rect: projected.annotation.rect,
            };
            receipt.placement = projected.annotation.placement;
            receipt.safety = projected.annotation.safety;
          }
          resolve(receipt);
        }
        if (gestureResolve) {
          let resolve = gestureResolve;
          gestureResolve = null;
          resolve();
        }
      }
    }
    animationStartMs = nowMs();
    renderLoopId = raf(tick);
  }

  function cancelTravel() {
    if (renderLoopId) {
      caf(renderLoopId);
      renderLoopId = 0;
    }
  }

  function cancelDrag() {
    if (renderLoopId) {
      caf(renderLoopId);
      renderLoopId = 0;
    }
  }

  function cancelGesture() {
    if (renderLoopId) {
      caf(renderLoopId);
      renderLoopId = 0;
    }
    ink.classList.remove('is-inking');
    cursor.classList.remove('is-inking');
    if (gestureResolve) {
      let resolve = gestureResolve;
      gestureResolve = null;
      resolve();
    }
  }

  function cancelClick() {
    if (renderLoopId) {
      caf(renderLoopId);
      renderLoopId = 0;
    }
    clickHalo.style.display = 'none';
  }

  function setCursor(x, y) {
    cursorX = x;
    cursorY = y;
    cursorPositioned = true;
    cursor.style.opacity = '1';
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  }

  function hideMarqueeFrame() {
    marquee.classList.add('pc-marquee-faded');
    focusHandle.style.display = 'none';
    marquee.style.width = '0px';
    marquee.style.height = '0px';
    sizeMarqueeSvg(svg, [rectBlack, rectWhite], 0, 0);
  }

  function abortCurrentAction() {
    if (!currentActionResolver) return;
    let resolve = currentActionResolver;
    let actionId = currentActionId;
    currentActionResolver = null;
    resolve({ actionId, status: 'aborted', target: activeElementTarget });
  }

  function moveTo(el, opts) {
    if (disposed) return Promise.resolve({ status: 'disposed' });
    let actionId = opts?.actionId || `act-${++actionCounter}`;
    abortCurrentAction();
    currentActionId = actionId;
    activeElementTarget = el;

    if (!el || typeof el.getBoundingClientRect !== 'function') {
      clear();
      settle(opts);
      return Promise.resolve({ actionId, status: 'settled', target: el });
    }

    let viewport = resolveViewport(opts?.viewport);
    let rect = resolvePresenterVisibleRect(el, viewport);
    if (!rect) {
      clear();
      settle(opts);
      return Promise.resolve({ actionId, status: 'settled', target: el });
    }

    let highlightRect = resolvePresenterHighlightRect(rect, viewport);
    let left = highlightRect.left;
    let top = highlightRect.top;
    let w = highlightRect.width;
    let h = highlightRect.height;

    cancelTravel();
    cancelDrag();
    cancelGesture();
    showOverlay();
    moveIndex += 1;

    let cursorStart = currentCursorPoint(viewport);
    let distance = Math.hypot(left - cursorStart.x, top - cursorStart.y);
    let duration = resolvePresenterTravelDuration(distance);

    activeLayers.focus = {
      active: true,
      rect: { left, top, width: w, height: h },
      startTime: duration,
      duration: PRESENTER_FOCUS_REVEAL_DURATION_MS,
    };
    activeLayers.cursor = {
      active: true,
      fromX: cursorStart.x,
      fromY: cursorStart.y,
      toX: left,
      toY: top,
      startTime: 0,
      duration,
    };
    activeLayers.marker = null;
    activeLayers.symbol = null;
    activeLayers.click = null;
    activeLayers.viewport = viewport;


    return new Promise((resolve) => {
      currentActionResolver = (receipt) => {
        settle(opts);
        resolve(receipt);
      };
      runRenderLoop();
    });
  }

  function markElement(el, opts = {}) {
    let marker = normalizePresenterMarker(opts?.marker || opts?.gesture || '', 'oval');
    return annotateElement(el, { ...opts, kind: 'marker', marker });
  }

  function clickZoneRectFor(rect, viewport = {}) {
    let pad = CLICK_ZONE_PADDING_PX;
    let width = Math.max(CLICK_ZONE_MIN_SIZE_PX, Number(rect.width) + pad * 2 || CLICK_ZONE_MIN_SIZE_PX);
    let height = Math.max(CLICK_ZONE_MIN_SIZE_PX, Number(rect.height) + pad * 2 || CLICK_ZONE_MIN_SIZE_PX);
    let centerX = Number(rect.left) + Number(rect.width) / 2;
    let centerY = Number(rect.top) + Number(rect.height) / 2;
    let left = centerX - width / 2;
    let top = centerY - height / 2;
    let maxLeft = Math.max(HIGHLIGHT_EDGE_INSET_PX, (viewport.width || left + width) - width - HIGHLIGHT_EDGE_INSET_PX);
    let maxTop = Math.max(HIGHLIGHT_EDGE_INSET_PX, (viewport.height || top + height) - height - HIGHLIGHT_EDGE_INSET_PX);
    left = Math.min(maxLeft, Math.max(HIGHLIGHT_EDGE_INSET_PX, left));
    top = Math.min(maxTop, Math.max(HIGHLIGHT_EDGE_INSET_PX, top));
    return { left, top, width, height, x: centerX, y: centerY };
  }

  function fireNativeClick(el, point) {
    if (!el) return;
    if (typeof el.click === 'function') {
      el.click();
      return;
    }
    try {
      el.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: point.x,
        clientY: point.y,
        view: win || undefined,
      }));
    } catch (_) {}
  }

  function performClick(el, opts, actionId) {
    if (disposed) return Promise.resolve({ actionId, status: 'disposed', target: el, fired: false });
    abortCurrentAction();
    currentActionId = actionId;
    activeElementTarget = el;

    if (!el || typeof el.getBoundingClientRect !== 'function') {
      settle(opts);
      return Promise.resolve({ actionId, status: 'settled', target: el, fired: false });
    }
    let viewport = resolveViewport(opts?.viewport);
    let rect = resolvePresenterVisibleRect(el, viewport);
    if (!rect) {
      settle(opts);
      return Promise.resolve({ actionId, status: 'settled', target: el, fired: false });
    }
    let zone = clickZoneRectFor(rect, viewport);

    cancelTravel();
    cancelDrag();
    cancelGesture();
    cancelClick();
    showOverlay();
    moveIndex += 1;

    let cursorStart = currentCursorPoint(viewport);
    let distance = Math.hypot(zone.x - cursorStart.x, zone.y - cursorStart.y);
    let duration = resolvePresenterTravelDuration(distance);

    activeLayers.focus = null;
    activeLayers.cursor = {
      active: true,
      fromX: cursorStart.x,
      fromY: cursorStart.y,
      toX: zone.x,
      toY: zone.y,
      startTime: 0,
      duration,
    };
    activeLayers.marker = null;
    activeLayers.symbol = null;
    activeLayers.click = null;
    activeLayers.viewport = viewport;


    return new Promise((resolve) => {
      currentActionResolver = (receipt) => {
        if (receipt.status !== 'settled') {
          settle(opts);
          resolve({ ...receipt, fired: false });
          return;
        }
        fireNativeClick(el, zone);
        activeLayers.click = { active: true, x: zone.x, y: zone.y, startTime: 0 };
        activeLayers.cursor = {
          active: true,
          x: zone.x,
          y: zone.y,
          startTime: 0,
          duration: CLICK_PRESS_MS + CLICK_FADE_MS,
        };
        currentActionResolver = (rippleReceipt) => {
          settle(opts);
          resolve({
            actionId,
            status: 'settled',
            target: el,
            fired: true,
            rippleStatus: rippleReceipt.status,
          });
        };
        runRenderLoop();
      };
      runRenderLoop();
    });
  }

  function clickElement(el, opts = {}) {
    let actionId = opts?.actionId || `act-${++actionCounter}`;
    if (clickActions.has(actionId)) return clickActions.get(actionId);
    let action = performClick(el, opts, actionId);
    clickActions.set(actionId, action);
    return action;
  }

  function presentFocusFrame(el, frame = {}) {
    if (disposed) return { presented: false, reason: 'disposed' };
    if (!el || typeof el.getBoundingClientRect !== 'function') {
      hideMarqueeFrame();
      return { presented: false, reason: 'invalid-target' };
    }
    let viewport = resolveViewport(frame.viewport);
    let targetRect = resolvePresenterVisibleRect(el, viewport);
    if (!targetRect) {
      hideMarqueeFrame();
      return { presented: false, reason: 'hidden-target' };
    }
    let elapsedMs = Number(frame.elapsedMs);
    if (!Number.isFinite(elapsedMs)) elapsedMs = 0;
    let seed = Number(frame.seed);
    if (!Number.isFinite(seed)) seed = 0;
    let mode = frame.mode;
    if (mode !== 'frame' && mode !== 'cursor' && mode !== 'rectangle-selection') mode = 'cursor';
    let focusRect = resolvePresenterHighlightRect(targetRect, viewport);
    let rectangleTiming = resolvePresenterRectangleTiming(focusRect);
    let durationMs = mode === 'rectangle-selection'
      ? rectangleTiming.durationMs
      : Math.max(
        PRESENTER_FRAME_MS,
        Number(frame.durationMs) || PRESENTER_FOCUS_REVEAL_DURATION_MS,
      );
    let projected = projectPresenterState({
      focus: {
        active: true,
        rect: focusRect,
        ...(mode === 'rectangle-selection' ? {} : { duration: durationMs }),
        mode,
      },
      marker: null,
      symbol: null,
      click: null,
      cursor: mode === 'cursor'
        ? { active: true, x: focusRect.left, y: focusRect.top, duration: Number.MAX_SAFE_INTEGER }
        : null,
    }, Math.max(0, elapsedMs), seed, viewport);

    cancelTravel();
    cancelDrag();
    cancelGesture();
    cancelClick();
    showOverlay();
    inkPath.setAttribute('d', '');
    ink.classList.remove('is-inking');
    if (projected.focus.visible) {
      marquee.classList.remove('pc-marquee-faded');
      marquee.style.opacity = `${projected.focus.opacity}`;
      marquee.style.transform = `translate(${projected.focus.left}px, ${projected.focus.top}px)`;
      marquee.style.width = `${projected.focus.width}px`;
      marquee.style.height = `${projected.focus.height}px`;
      sizeMarqueeSvg(svg, [rectBlack, rectWhite], projected.focus.width, projected.focus.height);
      rectBlack.style.strokeDashoffset = `${projected.focus.antsDashOffset}`;
      rectWhite.style.strokeDashoffset = `${projected.focus.antsDashOffset - 4}`;
    } else {
      hideMarqueeFrame();
    }
    if (projected.focus.dragHandle?.visible) {
      focusHandle.style.left = `${projected.focus.dragHandle.x}px`;
      focusHandle.style.top = `${projected.focus.dragHandle.y}px`;
      focusHandle.style.display = 'block';
    } else {
      focusHandle.style.display = 'none';
    }
    if (mode === 'cursor' && projected.cursor.visible) {
      setCursor(projected.cursor.x, projected.cursor.y);
    } else if (mode === 'rectangle-selection' && projected.focus.cursor?.visible) {
      setCursor(projected.focus.cursor.x, projected.focus.cursor.y);
    } else {
      cursor.style.opacity = '0';
    }

    return {
      presented: true,
      visible: projected.focus.visible,
      mode,
      elapsedMs,
      durationMs,
      phases: mode === 'rectangle-selection'
        ? { ...rectangleTiming, totalMs: rectangleTiming.durationMs }
        : { totalMs: durationMs },
      activePhase: projected.focus.activePhase,
      revealProgress: projected.focus.revealProgress,
      revealing: projected.focus.revealing,
      targetRect,
      frameRect: {
        left: projected.focus.left,
        top: projected.focus.top,
        width: projected.focus.width,
        height: projected.focus.height,
        right: projected.focus.left + projected.focus.width,
        bottom: projected.focus.top + projected.focus.height,
      },
      antsDashOffset: projected.focus.antsDashOffset,
      dragHandle: projected.focus.dragHandle,
      mutationReady: projected.focus.mutationReady,
      cursor: mode === 'cursor'
        ? { x: projected.cursor.x, y: projected.cursor.y, visible: projected.cursor.visible }
        : (mode === 'rectangle-selection' ? projected.focus.cursor : null),
    };
  }

  function presentApproachFrame(el, frame = {}) {
    if (disposed) return { presented: false, reason: 'disposed' };
    if (!el || typeof el.getBoundingClientRect !== 'function') {
      cursor.style.opacity = '0';
      return { presented: false, reason: 'invalid-target' };
    }
    let viewport = resolveViewport(frame.viewport);
    let rect = resolvePresenterVisibleRect(el, viewport);
    if (!rect) {
      cursor.style.opacity = '0';
      return { presented: false, reason: 'hidden-target' };
    }
    let seed = Number(frame.seed);
    if (!Number.isFinite(seed)) seed = 0;
    let elapsedMs = Number(frame.elapsedMs);
    if (!Number.isFinite(elapsedMs)) elapsedMs = 0;
    let zone = clickZoneRectFor(rect, viewport);
    let fallback = defaultCursorPoint(viewport);
    let fromX = frame.fromX === null || frame.fromX === undefined || frame.fromX === ''
      ? fallback.x
      : Number(frame.fromX);
    let fromY = frame.fromY === null || frame.fromY === undefined || frame.fromY === ''
      ? fallback.y
      : Number(frame.fromY);
    if (!Number.isFinite(fromX)) fromX = fallback.x;
    if (!Number.isFinite(fromY)) fromY = fallback.y;
    let start = clampPresenterPoint({ x: fromX, y: fromY }, viewport);
    let durationMs = resolvePresenterTravelDuration(Math.hypot(zone.x - start.x, zone.y - start.y));
    let projected = projectPresenterState({
      focus: null,
      marker: null,
      symbol: null,
      click: null,
      cursor: {
        active: true,
        fromX: start.x,
        fromY: start.y,
        toX: zone.x,
        toY: zone.y,
        duration: durationMs,
      },
    }, Math.max(0, elapsedMs), seed, viewport);

    cancelTravel();
    cancelDrag();
    cancelGesture();
    cancelClick();
    showOverlay();
    hideMarqueeFrame();
    inkPath.setAttribute('d', '');
    ink.classList.remove('is-inking');
    setCursor(projected.cursor.x, projected.cursor.y);

    return {
      presented: true,
      visible: projected.cursor.visible,
      elapsedMs,
      durationMs,
      progress: Math.max(0, Math.min(1, elapsedMs / durationMs)),
      rect,
      start,
      hotspot: { x: zone.x, y: zone.y },
      cursor: {
        x: projected.cursor.x,
        y: projected.cursor.y,
        visible: projected.cursor.visible,
      },
      mutationReady: projected.cursor.completed,
    };
  }

  function presentClickFrame(el, frame = {}) {
    if (disposed) return { presented: false, reason: 'disposed' };
    if (!el || typeof el.getBoundingClientRect !== 'function') {
      cancelClick();
      return { presented: false, reason: 'invalid-target' };
    }
    let viewport = resolveViewport(frame.viewport);
    let rect = resolvePresenterVisibleRect(el, viewport);
    if (!rect) {
      cancelClick();
      return { presented: false, reason: 'hidden-target' };
    }
    let elapsedMs = Number(frame.elapsedMs);
    if (!Number.isFinite(elapsedMs)) elapsedMs = 0;
    let seed = Number(frame.seed);
    if (!Number.isFinite(seed)) seed = 0;
    let zone = clickZoneRectFor(rect, viewport);
    let inRange = elapsedMs >= 0 && elapsedMs <= PRESENTER_CLICK_DURATION_MS;
    let projected = projectPresenterState({
      focus: null,
      marker: null,
      symbol: null,
      click: { active: inRange, x: zone.x, y: zone.y },
      cursor: { active: inRange, x: zone.x, y: zone.y, duration: PRESENTER_CLICK_DURATION_MS },
    }, Math.max(0, elapsedMs), seed, viewport);

    cancelTravel();
    cancelDrag();
    cancelGesture();
    cancelClick();
    showOverlay();
    hideMarqueeFrame();
    inkPath.setAttribute('d', '');
    ink.classList.remove('is-inking');

    if (inRange && projected.click.visible) {
      clickHalo.style.left = `${projected.click.x}px`;
      clickHalo.style.top = `${projected.click.y}px`;
      clickHalo.style.transform = `translate(-50%, -50%) scale(${projected.click.scale})`;
      clickHalo.style.opacity = projected.click.opacity;
      clickHalo.style.display = 'block';
      setCursor(projected.cursor.x, projected.cursor.y);
    } else {
      clickHalo.style.display = 'none';
    }

    return {
      presented: true,
      visible: inRange && projected.click.visible && projected.click.opacity > 0,
      elapsedMs,
      durationMs: PRESENTER_CLICK_DURATION_MS,
      progress: Math.max(0, Math.min(1, elapsedMs / PRESENTER_CLICK_DURATION_MS)),
      rect,
      hotspot: { x: zone.x, y: zone.y },
      scale: projected.click.scale,
      opacity: projected.click.opacity,
      cursor: { x: projected.cursor.x, y: projected.cursor.y },
    };
  }

  function presentRelationshipFrame(sourceEl, destinationEl, relation, frame = {}) {
    if (disposed) return { presented: false, reason: 'disposed' };
    if (!sourceEl?.getBoundingClientRect || !destinationEl?.getBoundingClientRect) {
      clear();
      return { presented: false, reason: 'invalid-target' };
    }
    let viewport = resolveViewport(frame.viewport);
    let sourceRect = resolvePresenterVisibleRect(sourceEl, viewport);
    let destinationRect = resolvePresenterVisibleRect(destinationEl, viewport);
    if (!sourceRect || !destinationRect) {
      clear();
      return { presented: false, reason: 'hidden-target' };
    }
    let gesturePolicy = resolvePresenterGesturePolicy({
      cueKind: 'relationship',
      relation,
      sourceTargetId: frame.sourceTargetId || relation?.from || relation?.sourceTargetId,
      destinationTargetId: frame.destinationTargetId || relation?.to || relation?.destinationTargetId,
      sourceRect,
      destinationRect,
      targetRect: destinationRect,
      viewport,
    });
    if (gesturePolicy.selectedKind !== 'arrow') {
      let focus = presentFocusFrame(destinationEl, { ...frame, mode: 'frame' });
      return {
        ...focus,
        kind: 'focus',
        name: 'frame',
        originalKind: 'relationship',
        gesturePolicy,
        fallback: true,
        pathSamples: [],
      };
    }
    let relationshipPath = createPresenterRelationshipPath({ sourceRect, destinationRect });
    let durationMs = Math.max(PRESENTER_FRAME_MS, Number(frame.durationMs) || resolvePresenterAnnotationDuration(relationshipPath.lengthPx));
    let elapsedMs = Number(frame.elapsedMs);
    if (!Number.isFinite(elapsedMs)) elapsedMs = Math.max(0, Math.min(1, Number(frame.progress) || 0)) * durationMs;
    let progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
    let tip = {
      x: relationshipPath.start.x + (relationshipPath.end.x - relationshipPath.start.x) * progress,
      y: relationshipPath.start.y + (relationshipPath.end.y - relationshipPath.start.y) * progress,
    };
    let pathD = `M${relationshipPath.start.x} ${relationshipPath.start.y} L${tip.x} ${tip.y}`;
    if (progress >= 1) {
      pathD += ` M${relationshipPath.arrowHead[0].x} ${relationshipPath.arrowHead[0].y} L${relationshipPath.end.x} ${relationshipPath.end.y} L${relationshipPath.arrowHead[1].x} ${relationshipPath.arrowHead[1].y}`;
    }

    cancelTravel();
    cancelDrag();
    cancelGesture();
    cancelClick();
    showOverlay();
    hideMarqueeFrame();
    inkPath.setAttribute('d', pathD);
    ink.classList.add('is-inking');
    if (frame.ownsCursor !== false && progress < 1) setCursor(tip.x, tip.y);
    else cursor.style.opacity = '0';

    return {
      presented: true,
      visible: true,
      kind: 'relationship',
      name: 'arrow',
      progress,
      elapsedMs,
      durationMs,
      sourceRect,
      destinationRect,
      cursor: progress < 1 ? tip : null,
      pathSamples: [relationshipPath.start, tip],
      relationshipPath,
      gesturePolicy,
    };
  }

  function annotateElement(el, opts = {}) {
    if (disposed) return Promise.resolve({ status: 'disposed' });
    let actionId = opts?.actionId || `act-${++actionCounter}`;
    abortCurrentAction();
    currentActionId = actionId;
    activeElementTarget = el;

    let annotation = normalizePresenterAnnotation(opts, { intent: 'emphasize' });
    if (!annotation) {
      settle(opts);
      return Promise.resolve({ actionId, status: 'settled', target: el });
    }
    if (!el || typeof el.getBoundingClientRect !== 'function') {
      settle(opts);
      return Promise.resolve({ actionId, status: 'settled', target: el });
    }
    let viewport = resolveViewport(opts.viewport);
    let rect = resolvePresenterVisibleRect(el, viewport);
    if (!rect) {
      settle(opts);
      return Promise.resolve({ actionId, status: 'settled', target: el });
    }
    let gesturePolicy = resolvePresenterGesturePolicy({
      cueKind: 'annotation',
      annotation,
      semanticRole: opts.semanticRole,
      targetRect: rect,
      viewport,
    });
    if (gesturePolicy.selectedKind === 'focus-frame') {
      return moveTo(el, opts).then((receipt) => ({ ...receipt, gesturePolicy }));
    }
    let nextSeed = moveIndex + 1;
    let layout = resolvePresenterAnnotationLayout(annotation, rect, viewport, nextSeed, opts.obstacles);
    if (!layout) {
      settle(opts);
      return Promise.resolve({ actionId, status: 'settled', target: el });
    }
    if (layout.fullSafety?.safe === false) {
      let fallbackPolicy = resolvePresenterGesturePolicy({
        cueKind: 'annotation',
        annotation,
        semanticRole: opts.semanticRole,
        targetRect: rect,
        viewport,
        safety: layout.fullSafety,
      });
      return moveTo(el, opts).then((receipt) => ({ ...receipt, gesturePolicy: fallbackPolicy }));
    }
    annotation = layout.annotation;
    let drawRect = layout.drawRect;
    let plan = layout.plan;
    let startPoint = projectStrokePoint(plan, nextSeed, 0, strokeJitterAmplitude(nextSeed), viewport);
    let toX = startPoint.x;
    let toY = startPoint.y;

    cancelTravel();
    cancelDrag();
    cancelGesture();
    showOverlay();
    moveIndex = nextSeed;

    let cursorStart = currentCursorPoint(viewport);
    let distance = Math.hypot(toX - cursorStart.x, toY - cursorStart.y);
    let duration = resolvePresenterTravelDuration(distance);

    activeLayers.focus = null;
    activeLayers.cursor = {
      active: true,
      fromX: cursorStart.x,
      fromY: cursorStart.y,
      toX,
      toY,
      startTime: 0,
      duration,
    };
    activeLayers.marker = null;
    activeLayers.symbol = null;
    activeLayers.click = null;
    activeLayers.viewport = viewport;


    return new Promise((resolve) => {
      currentActionResolver = (receipt) => {
        if (receipt.status !== 'settled') {
          settle(opts);
          resolve(receipt);
          return;
        }
        let activeStroke;
        let strokeLayer = {
          active: true,
          rect: drawRect,
          targetRect: rect,
          placement: annotation.placement,
          obstacles: Array.isArray(opts.obstacles) ? opts.obstacles : [],
          viewport,
          layout,
        };
        if (annotation.kind === 'symbol') {
          activeStroke = { ...strokeLayer, name: annotation.symbol };
          activeLayers.symbol = activeStroke;
        } else {
          activeStroke = { ...strokeLayer, name: annotation.marker };
          activeLayers.marker = activeStroke;
        }

        let loops = Math.max(0, plan?.loops || 0);
        let gestureDuration = resolvePresenterAnnotationDuration(plan?.arcLength || 0, loops);
        activeStroke.startTime = 0;
        activeStroke.duration = gestureDuration;

        let rest = clampPresenterPoint(plan?.rest || startPoint, viewport);
        activeLayers.cursor = {
          active: true,
          x: rest.x,
          y: rest.y,
        };

        currentActionResolver = (r) => {
          settle(opts);
          resolve(r);
        };
        runRenderLoop();
      };
      runRenderLoop();
    });
  }

  function presentAnnotationFrame(el, value, frame = {}) {
    if (disposed) return { presented: false, reason: 'disposed' };
    let annotation = normalizePresenterAnnotation(value);
    if (!annotation) {
      clear();
      return { presented: false, reason: 'invalid-annotation' };
    }
    if (!el || typeof el.getBoundingClientRect !== 'function') {
      clear();
      return { presented: false, reason: 'invalid-target' };
    }
    let viewport = resolveViewport(frame.viewport);
    let rect = resolvePresenterVisibleRect(el, viewport);
    if (!rect) {
      clear();
      return { presented: false, reason: 'hidden-target' };
    }
    let gesturePolicy = resolvePresenterGesturePolicy({
      cueKind: 'annotation',
      annotation,
      semanticRole: frame.semanticRole,
      targetRect: rect,
      viewport,
    });
    if (gesturePolicy.selectedKind === 'focus-frame') {
      let focus = presentFocusFrame(el, {
        ...frame,
        mode: 'frame',
      });
      return {
        ...focus,
        kind: 'focus',
        name: 'frame',
        originalKind: 'annotation',
        gesturePolicy,
        fallback: true,
        pathSamples: [],
        safety: { safe: true, policyFallback: true },
      };
    }
    let requestedProgress = Math.max(0, Math.min(1, Number(frame.progress) || 0));
    let seed = Number(frame.seed);
    if (!Number.isFinite(seed)) seed = 0;

    let layout = resolvePresenterAnnotationLayout(annotation, rect, viewport, seed, frame.obstacles);
    if (!layout) {
      clear();
      return { presented: false, reason: 'invalid-annotation' };
    }
    annotation = layout.annotation;
    let drawRect = layout.drawRect;
    let startPoint = projectStrokePoint(
      layout.plan,
      seed,
      0,
      strokeJitterAmplitude(seed),
      viewport,
    );
    let strokeLayer = {
      active: true,
      rect: drawRect,
      targetRect: rect,
      placement: annotation.placement,
      obstacles: Array.isArray(frame.obstacles) ? frame.obstacles : [],
      viewport,
      layout,
      ownsCursor: frame.ownsCursor !== false,
      duration: resolvePresenterAnnotationDuration(layout.plan.arcLength || 0),
    };

    let layers = {
      focus: { active: false },
      marker: annotation.kind === 'marker' ? { ...strokeLayer, name: annotation.marker } : null,
      symbol: annotation.kind === 'symbol' ? { ...strokeLayer, name: annotation.symbol } : null,
      click: null,
      cursor: { active: true, x: startPoint.x, y: startPoint.y },
    };

    let requestedElapsedMs = Number(frame.elapsedMs);
    let elapsedMs = Number.isFinite(requestedElapsedMs)
      ? Math.max(0, requestedElapsedMs)
      : requestedProgress * strokeLayer.duration;
    let progress = Math.max(0, Math.min(1, elapsedMs / strokeLayer.duration));
    let projected = projectPresenterState(layers, elapsedMs, seed, viewport);
    let enclosingOval = annotation.kind === 'marker'
      && annotation.marker === 'oval'
      && layout.fullSafety?.missingTarget === false
      && layout.fullSafety?.viewportCollision === false
      && layout.fullSafety?.collisions?.length === 0;
    let suppressUnsafe = layout.fullSafety?.safe === false && !enclosingOval;

    if (suppressUnsafe) {
      let fallbackPolicy = resolvePresenterGesturePolicy({
        cueKind: 'annotation',
        annotation,
        semanticRole: frame.semanticRole,
        targetRect: rect,
        viewport,
        safety: layout.fullSafety,
      });
      let focus = presentFocusFrame(el, {
        ...frame,
        mode: 'frame',
      });
      return {
        ...focus,
        kind: 'focus',
        name: 'frame',
        originalKind: 'annotation',
        gesturePolicy: fallbackPolicy,
        fallback: true,
        pathSamples: [],
        safety: { ...layout.fullSafety, safe: true, policyFallback: true },
      };
    }

    cancelTravel();
    cancelDrag();
    cancelGesture();
    cancelClick();
    showOverlay();

    if (projected.focus.visible) {
      marquee.classList.remove('pc-marquee-faded');
      marquee.style.transform = `translate(${projected.focus.left}px, ${projected.focus.top}px)`;
      marquee.style.width = `${projected.focus.width}px`;
      marquee.style.height = `${projected.focus.height}px`;
      sizeMarqueeSvg(svg, [rectBlack, rectWhite], projected.focus.width, projected.focus.height);
    } else {
      hideMarqueeFrame();
    }

    let evidencePathD = '';
    if (suppressUnsafe) {
      evidencePathD = smoothPresenterPath(layout.fullPathSamples);
    } else if (projected.marker.visible && projected.marker.path) {
      evidencePathD = projected.marker.path;
    } else if (projected.symbol.visible && projected.symbol.path) {
      evidencePathD = projected.symbol.path;
    }
    let inkPathD = suppressUnsafe ? '' : evidencePathD;

    inkPath.setAttribute('d', inkPathD);
    ink.classList.toggle('is-inking', Boolean(inkPathD));

    let activeAnnotation = projected.annotation;
    cursor.classList.toggle('is-inking', Boolean(!suppressUnsafe && activeAnnotation && !activeAnnotation.completed));
    let evidenceAnnotation = activeAnnotation;
    let strokePoints = suppressUnsafe ? layout.fullPathSamples : activeAnnotation.points;
    let cursorPoint = suppressUnsafe ? layout.fullCursor : activeAnnotation.cursor;
    if (!suppressUnsafe && cursorPoint) {
      setCursor(cursorPoint.x, cursorPoint.y);
    } else {
      cursor.style.opacity = '0';
    }

    let pathDigest = 2166136261;
    for (let index = 0; index < evidencePathD.length; index += 1) {
      pathDigest ^= evidencePathD.charCodeAt(index);
      pathDigest = Math.imul(pathDigest, 16777619);
    }

    let pathSamples = strokePoints.map((point) => ({ x: point.x, y: point.y }));

    return {
      presented: !suppressUnsafe,
      visible: !suppressUnsafe,
      suppressed: suppressUnsafe,
      ...(suppressUnsafe ? { reason: 'unsafe-annotation' } : {}),
      kind: activeAnnotation.kind,
      name: activeAnnotation.name,
      placement: activeAnnotation.placement,
      progress,
      elapsedMs: activeAnnotation.elapsedMs,
      seed,
      rect: activeAnnotation.rect,
      drawRect: activeAnnotation.drawRect,
      cursor: cursorPoint,
      cursorSizePx: activeAnnotation.cursorSizePx,
      pathPoints: pathSamples.length,
      pathSamples,
      pathDigest: (pathDigest >>> 0).toString(16).padStart(8, '0'),
      safety: suppressUnsafe ? layout.fullSafety : evidenceAnnotation.safety,
      durationMs: activeAnnotation.durationMs,
      arcLengthPx: activeAnnotation.arcLengthPx,
      drawnLengthPx: activeAnnotation.drawnLengthPx,
      averageSpeedPxPerMs: activeAnnotation.averageSpeedPxPerMs,
      phase: activeAnnotation.completed ? 'complete' : 'draw',
      timing: activeAnnotation.timing,
      gesturePolicy,
    };
  }

  function settle(opts) {
    let cb = opts && typeof opts.onGestureSettled === 'function' ? opts.onGestureSettled : null;
    if (cb) {
      try {
        cb();
      } catch (_) {}
    }
  }

  function showOverlay() {
    overlay.classList.remove('is-paused');
    overlay.classList.add('is-visible');
  }

  function clear() {
    if (disposed) return;
    cancelTravel();
    cancelDrag();
    cancelGesture();
    cancelClick();
    abortCurrentAction();
    inkPath.setAttribute('d', '');
    overlay.classList.remove('is-visible');
    overlay.classList.add('is-paused');
  }

  function dispose() {
    if (disposed) return;
    cancelTravel();
    cancelDrag();
    cancelGesture();
    cancelClick();
    abortCurrentAction();
    disposed = true;
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  return {
    moveTo,
    markElement,
    annotateElement,
    presentApproachFrame,
    presentFocusFrame,
    presentRelationshipFrame,
    presentAnnotationFrame,
    presentClickFrame,
    clickElement,
    clear,
    dispose,
    isSupported() {
      return !disposed;
    },
  };
}

function nonNegative(value, fallback) {
  let n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function waitForSettlement(settledPromise, signal, timeoutMs) {
  return new Promise((resolve) => {
    let timer = setTimeout(done, timeoutMs);
    let onAbort = () => done();
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }
    if (signal?.aborted) return done();
    signal?.addEventListener?.('abort', onAbort, { once: true });
    Promise.resolve(settledPromise).then(done, done);
  });
}

/** Abortable timer. Resolves after `ms`, or immediately on abort. */
function delay(ms, signal) {
  return new Promise((resolve) => {
    if (!(ms > 0)) {
      resolve();
      return;
    }
    let timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    let onAbort = () => {
      cleanup();
      resolve();
    };
    let cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
    };
    if (signal?.aborted) {
      cleanup();
      resolve();
      return;
    }
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });
}

/**
 * Play an agent-authored cursor scenario across a presenter cursor.
 *
 * A scenario is plain data an agent can author:
 *
 *   {
 *     steps: [
 *       { target, holdMs?, marker?, gesture?, label? },
 *       ...
 *     ]
 *   }
 *
 * For each step, in order: `resolveTarget(step.target)` maps the agent-authored
 * target reference to a DOM element (or any value the cursor's `moveTo` accepts);
 * the cursor moves to it; if the step carries a `marker` (or legacy `gesture`), the cursor plays that
 * flourish once it settles on the target; playback holds for `holdMs` (or
 * `defaultHoldMs`), extending the hold until any gesture finishes; then
 * `onStep(step, index)` fires. A step whose target resolves to nothing is skipped
 * (its `moveTo` and hold are not run) but still reports through `onStep` so a host
 * can react. `marker` names an entry in the cursor's marker registry (e.g.
 * `'circle'`, `'underline'`, or `'box'`); an unknown name is a silent no-op.
 *
 * The run honors an `AbortSignal`: aborting stops before the next step and
 * promptly ends any in-progress hold, and clears the cursor.
 *
 * Host-agnostic and unit-testable without a real DOM: pass a fake cursor that
 * records `moveTo` calls and a fake `resolveTarget`.
 *
 * @param {{ moveTo: Function, clickElement?: Function, clear?: Function }} cursor - a presenter cursor (or fake).
 * @param {{ steps?: Array<object> }} scenario
 * @param {object} [options]
 * @param {(target:any, step:object, index:number) => any} options.resolveTarget - maps a step target to an element.
 * @param {AbortSignal} [options.signal] - abort to stop the run and clear the cursor.
 * @param {(step:object, index:number) => void} [options.onStep] - fired once per step, after its hold.
 * @param {number} [options.defaultHoldMs=1200] - hold used when a step omits `holdMs`.
 * @returns {Promise<void>} resolves when the last step completes or the run aborts.
 */
export async function playCursorScenario(
  cursor,
  scenario,
  { resolveTarget, signal, onStep, defaultHoldMs = DEFAULT_HOLD_MS } = {},
) {
  if (!cursor || typeof cursor.moveTo !== 'function') return;

  let steps = Array.isArray(scenario?.steps) ? scenario.steps : [];
  let baseHold = nonNegative(defaultHoldMs, DEFAULT_HOLD_MS);
  let resolve = typeof resolveTarget === 'function' ? resolveTarget : () => null;

  let clearCursor = () => {
    if (typeof cursor.clear === 'function') {
      try {
        cursor.clear();
      } catch (_) {}
    }
  };

  if (signal?.aborted) {
    clearCursor();
    return;
  }

  for (let index = 0; index < steps.length; index += 1) {
    if (signal?.aborted) {
      clearCursor();
      return;
    }

    let step = steps[index] || {};
    let element = resolve(step.target, step, index);
    let wantsClick = step.action === 'click' || step.click === true;

    if (element != null) {
      // A step's `marker` plays a flourish after the cursor settles on the
      // target. The cursor reports completion via `onGestureSettled`; the player
      // waits for it within the hold and extends the hold when the gesture runs
      // longer, so the next step never starts mid-flourish.
      let marker = normalizePresenterMarker(step.marker || step.gesture || '');
      let settled = false;
      let onSettled = null;
      let settledPromise = new Promise((res) => {
        onSettled = () => {
          settled = true;
          res();
        };
      });

      let moveOpts = {
        actionId: step.actionId,
        label: step.label,
        onGestureSettled: onSettled,
      };
      if (marker) {
        moveOpts.marker = marker;
        moveOpts.gesture = marker;
      }
      let cursorAction = null;
      if (wantsClick && typeof cursor.clickElement === 'function') {
        cursorAction = cursor.clickElement(element, moveOpts);
      } else if (marker && typeof cursor.annotateElement === 'function') {
        cursorAction = cursor.annotateElement(element, { ...moveOpts, kind: 'marker', marker });
      } else {
        cursorAction = cursor.moveTo(element, moveOpts);
      }
      if (cursorAction && typeof cursorAction.then === 'function') {
        Promise.resolve(cursorAction).then(onSettled, onSettled);
      }

      let hold = nonNegative(step.holdMs, baseHold);
      await delay(hold, signal);

      // If a gesture is still in flight after the hold, extend the step until it
      // settles (or the run aborts). A watchdog caps the extension so a cursor
      // that never reports settlement (e.g. a minimal fake) cannot stall the run.
      if ((marker || wantsClick) && !settled && !signal?.aborted) {
        await waitForSettlement(settledPromise, signal, GESTURE_WAIT_CAP_MS);
      }
    }

    if (signal?.aborted) {
      clearCursor();
      return;
    }

    if (typeof onStep === 'function') {
      try {
        onStep(step, index);
      } catch (_) {}
    }
  }
}
