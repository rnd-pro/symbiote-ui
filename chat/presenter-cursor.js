/**
 * Presenter cursor: an animated pointer that walks a viewer through any set of
 * on-screen elements.
 *
 * `createPresenterCursor` renders an arrow cursor and a Windows-style
 * marching-ants marquee on a fixed overlay. `moveTo(el)` drag-selects an element
 * by growing the marquee from its top-left corner while the cursor slides to the
 * bottom-right; between checkpoints the cursor visibly travels along a gentle
 * curved (quadratic-bezier) path so the viewer perceives the journey from one
 * element to the next.
 *
 * Markers (`'underline'`, `'box'`, `'bracket'`, `'slash'`, etc.) are semantic
 * annotation gestures, separate from the focus marquee. They live in a small
 * extensible registry keyed by name
 * (an unknown name is a silent no-op) and are hand-drawn: every path carries a
 * small per-frame jitter and slight radius/length/speed variation driven by the
 * same deterministic move counter as the travel arc, so runs differ yet stay
 * reproducible without `Math.random`. A faint, themed ink trail traces under the
 * cursor so the flourish reads, then fades.
 *
 * `clickElement(el)` is the native-control gesture: the cursor travels to a real
 * button/tab/control, pulses a click target ring, and then calls the element's
 * own `click()` so the host UI changes through its normal event path.
 *
 * `playCursorScenario` plays an agent-authored scenario — a plain list of steps,
 * each naming a `target` the host resolves to a DOM element — by driving the
 * cursor step-by-step with per-step holds, an `onStep` hook, and `AbortSignal`
 * support. When a step carries a `gesture`, the player waits for the flourish to
 * finish before advancing (extending the hold when the gesture runs longer). The
 * step sequencing is host-agnostic and pure enough to unit-test against a fake
 * cursor and fake `resolveTarget` with no real DOM.
 *
 * Node-safe at import time: no top-level DOM, window, document, or rAF access.
 * Every browser touch is lazy and guarded, so importing in a non-browser env
 * never throws; `createPresenterCursor` then returns inert no-op handles and
 * `isSupported()` reports false. `playCursorScenario` works identically against
 * a real cursor or a fake one, so the scenario contract is the agent-facing API.
 */

const STYLE_ID = 'symbiote-presenter-cursor-style';
const OVERLAY_CLASS = 'symbiote-presenter-cursor';

export const PRESENTER_MARKERS = Object.freeze(['circle', 'underline', 'box', 'bracket', 'slash']);
const PRESENTER_MARKER_SET = new Set(PRESENTER_MARKERS);
const MARKER_ALIASES = Object.freeze({
  highlight: 'box',
  frame: 'box',
  rectangle: 'box',
  rect: 'box',
  marker: 'circle',
  ring: 'circle',
  round: 'circle',
  line: 'underline',
  under: 'underline',
  brackets: 'bracket',
  side: 'bracket',
  stroke: 'slash',
  diagonal: 'slash',
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
  emphasize: { kind: 'marker', marker: 'box' },
  detail: { kind: 'marker', marker: 'underline' },
  group: { kind: 'marker', marker: 'bracket' },
  risk: { kind: 'symbol', symbol: 'cross', placement: 'after' },
  question: { kind: 'symbol', symbol: 'question', placement: 'after' },
  success: { kind: 'symbol', symbol: 'check', placement: 'after' },
  affinity: { kind: 'symbol', symbol: 'heart', placement: 'after' },
  flourish: { kind: 'symbol', symbol: 'flourish', placement: 'below' },
});
const ANNOTATION_PLACEMENTS = new Set(['over', 'after', 'before', 'corner', 'below']);

const CURSOR_SIZE = 18; // px; the hotspot is the arrow's top-left tip
const DRAG_MS = 720; // cursor + marquee growth duration
const FADE_MS = 200; // clear() fade-out duration
const MARCH_MS = 600; // marching-ants loop duration
const MARQUEE_FADE_MS = 180; // previous marquee fades as the cursor leaves it
const HIGHLIGHT_PADDING_PX = 10;
const HIGHLIGHT_EDGE_INSET_PX = 8;
const HIGHLIGHT_MIN_SIZE_PX = 8;
const CLICK_ZONE_PADDING_PX = 6;
const CLICK_ZONE_MIN_SIZE_PX = 28;
const CLICK_PRESS_MS = 240;
const CLICK_FADE_MS = 220;

// Travel-between-checkpoints tuning.
const TRAVEL_MIN_MS = 850;
const TRAVEL_MAX_MS = 1600;
const TRAVEL_PX_PER_MS = 0.75; // longer hops take a little more time

// Gesture-flourish tuning.
const GESTURE_MS = 720; // base duration of a single gesture pass
const GESTURE_JITTER_PX = 2.4; // peak per-frame hand-tremor amplitude
const INK_FADE_MS = 520; // how long the ink trail lingers before it clears

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
  transition:opacity ${FADE_MS}ms ease;
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
  transition:opacity ${MARQUEE_FADE_MS}ms ease;
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
  animation:pc-march ${MARCH_MS}ms linear infinite;
}
${overlaySelector} .pc-ants-black{stroke:#000;}
${overlaySelector} .pc-ants-white{stroke:#fff;animation-name:pc-march-offset;}
${overlaySelector}.is-paused .pc-ants{animation-play-state:paused;}
${overlaySelector} .pc-ink{
  position:absolute;
  top:0;
  left:0;
  overflow:visible;
  pointer-events:none;
  opacity:0;
  transition:opacity ${INK_FADE_MS}ms ease;
}
${overlaySelector} .pc-ink.is-inking{opacity:0.55;}
${overlaySelector} .pc-ink path{
  fill:none;
  stroke:var(--sn-presenter-marker, var(--sn-node-selected, var(--sn-accent-color, #7ccfff)));
  stroke-width:2.6;
  stroke-opacity:0.86;
  stroke-linecap:round;
  stroke-linejoin:round;
  shape-rendering:geometricPrecision;
  filter:drop-shadow(0 0 3px color-mix(in oklab, var(--sn-presenter-marker, var(--sn-node-selected, #7ccfff)) 35%, transparent));
}
${overlaySelector} .pc-click{
  position:absolute;
  top:0;
  left:0;
  min-width:${CLICK_ZONE_MIN_SIZE_PX}px;
  min-height:${CLICK_ZONE_MIN_SIZE_PX}px;
  border:2px solid var(--sn-presenter-click, var(--sn-node-selected, var(--sn-accent-color, #7ccfff)));
  border-radius:999px;
  background:color-mix(in oklab, var(--sn-presenter-click, var(--sn-node-selected, #7ccfff)) 18%, transparent);
  box-shadow:0 0 0 1px color-mix(in oklab, var(--sn-bg, #111) 40%, transparent),
    0 0 14px color-mix(in oklab, var(--sn-presenter-click, var(--sn-node-selected, #7ccfff)) 42%, transparent);
  opacity:0;
  transform:scale(0.78);
  transition:opacity ${CLICK_FADE_MS}ms ease, transform ${CLICK_FADE_MS}ms ease;
  pointer-events:none;
  will-change:opacity,transform,left,top,width,height;
}
${overlaySelector} .pc-click.is-clicking{
  opacity:1;
  transform:scale(1);
}
${overlaySelector} .pc-click.pc-click-fired{
  opacity:0;
  transform:scale(0.58);
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
@keyframes pc-march{
  from{stroke-dashoffset:0;}
  to{stroke-dashoffset:-8;}
}
@keyframes pc-march-offset{
  from{stroke-dashoffset:-4;}
  to{stroke-dashoffset:-12;}
}
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
function jitter(seed, t, amp, axis) {
  let phase = t * 6.5 + axis * 19.7;
  let low = noise(seed + axis * 101, Math.floor(phase));
  let high = noise(seed + axis * 101, Math.floor(phase) + 1);
  let frac = phase - Math.floor(phase);
  return (low + (high - low) * frac) * amp;
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
  // One or two slightly elliptical loops around the target's center. Radius and
  // loop count vary a touch per move; the ellipse is squashed and tilted so it
  // never reads as a machine-perfect circle.
  circle(rect, seed) {
    let cx = rect.left + rect.width / 2;
    let cy = rect.top + rect.height / 2;
    let minSide = Math.min(rect.width, rect.height);
    let baseR = minSide * (0.4 + 0.1 * (variation(seed, 3) * 0.5 + 0.5)); // 40-50% of the smaller side
    let loops = variation(seed, 7) > 0.2 ? 2 : 1;
    let squash = 0.82 + variation(seed, 11) * 0.12; // gentle ellipse
    let tilt = variation(seed, 13) * 0.5; // small rotation, radians
    let dir = variation(seed, 17) >= 0 ? 1 : -1; // clockwise or not
    let cos = Math.cos(tilt);
    let sin = Math.sin(tilt);
    return {
      loops,
      rest: { x: cx, y: cy },
      point(t) {
        // Ease the radius open at the start and closed at the end so the loop
        // grows out of, and settles back into, the rest point.
        let grow = Math.sin(Math.min(1, t * 1.15) * Math.PI);
        let r = baseR * (0.35 + 0.65 * grow);
        let a = dir * t * loops * Math.PI * 2 - Math.PI / 2;
        let ex = Math.cos(a) * r;
        let ey = Math.sin(a) * r * squash;
        return {
          x: cx + ex * cos - ey * sin,
          y: cy + ex * sin + ey * cos,
        };
      },
    };
  },

  // A left-to-right stroke just below the target, as if underlining it, with a
  // short partial return so the pen lifts naturally. Length and the underline
  // offset vary slightly per move.
  underline(rect, seed) {
    let pad = rect.width * (0.06 + 0.04 * (variation(seed, 5) * 0.5 + 0.5));
    let x0 = rect.left + pad;
    let x1 = rect.left + rect.width - pad;
    let len = x1 - x0;
    let y = rect.top + rect.height + Math.min(8, rect.height * 0.12) + variation(seed, 9) * 2;
    let droop = 2 + variation(seed, 19) * 2; // slight mid-stroke dip
    let returnFrac = 0.22 + (variation(seed, 23) * 0.5 + 0.5) * 0.12; // short pull-back
    return {
      loops: 0,
      rest: { x: x1, y },
      point(t) {
        if (t <= 1 - returnFrac) {
          let p = t / (1 - returnFrac);
          return { x: x0 + len * p, y: y + Math.sin(p * Math.PI) * droop };
        }
        // Brief return sweep back to the left before lifting.
        let p = (t - (1 - returnFrac)) / returnFrac;
        return { x: x1 - len * 0.3 * p, y: y - Math.sin(p * Math.PI) * droop * 0.5 };
      },
    };
  },

  box(rect, seed) {
    let inset = 2 + (variation(seed, 37) * 0.5 + 0.5) * 5;
    let left = rect.left + inset;
    let top = rect.top + inset;
    let right = rect.left + rect.width - inset;
    let bottom = rect.top + rect.height - inset;
    let bow = 2 + variation(seed, 41) * 1.5;
    let points = [
      { x: left, y: top + bow },
      { x: right - bow, y: top },
      { x: right, y: bottom - bow },
      { x: left + bow, y: bottom },
      { x: left, y: top + bow },
    ];
    return {
      loops: 0.35,
      rest: points[0],
      point(t) {
        let total = points.length - 1;
        let scaled = Math.min(total - 0.001, t * total);
        let i = Math.floor(scaled);
        let p = scaled - i;
        let a = points[i];
        let b = points[i + 1];
        return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
      },
    };
  },

  bracket(rect, seed) {
    let inset = 3 + (variation(seed, 43) * 0.5 + 0.5) * 5;
    let left = rect.left + inset;
    let right = rect.left + rect.width - inset;
    let top = rect.top + rect.height * 0.14;
    let bottom = rect.top + rect.height * 0.86;
    let hook = Math.min(rect.width * 0.14, 18) + variation(seed, 47) * 2;
    let points = [
      { x: left + hook, y: top },
      { x: left, y: top },
      { x: left, y: bottom },
      { x: left + hook, y: bottom },
      { x: right - hook, y: bottom },
      { x: right, y: bottom },
      { x: right, y: top },
      { x: right - hook, y: top },
    ];
    return {
      loops: 0,
      rest: points[points.length - 1],
      point(t) {
        let total = points.length - 1;
        let scaled = Math.min(total - 0.001, t * total);
        let i = Math.floor(scaled);
        let p = scaled - i;
        let a = points[i];
        let b = points[i + 1];
        return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
      },
    };
  },

  slash(rect, seed) {
    let padX = rect.width * (0.08 + (variation(seed, 59) * 0.5 + 0.5) * 0.06);
    let padY = rect.height * (0.14 + (variation(seed, 61) * 0.5 + 0.5) * 0.08);
    let x0 = rect.left + padX;
    let y0 = rect.top + rect.height - padY;
    let x1 = rect.left + rect.width - padX;
    let y1 = rect.top + padY;
    let sag = variation(seed, 67) * Math.min(14, rect.height * 0.16);
    return {
      loops: 0,
      rest: { x: x1, y: y1 },
      point(t) {
        return {
          x: x0 + (x1 - x0) * t,
          y: y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag,
        };
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
 * @returns {{ moveTo: (el: Element, opts?: object) => void, markElement: (el: Element, opts?: object) => void, annotateElement: (el: Element, opts?: object) => void, clickElement: (el: Element, opts?: object) => void, clear: () => void, dispose: () => void, isSupported: () => boolean }}
 */
export function createPresenterCursor(doc = typeof document !== 'undefined' ? document : null) {
  if (!hasDocument(doc)) return inertCursor();

  ensureStyle(doc);

  let overlay = doc.createElement('div');
  overlay.className = OVERLAY_CLASS;

  let marquee = doc.createElement('div');
  marquee.className = 'pc-marquee';

  let { svg, black: rectBlack, white: rectWhite } = buildMarqueeSvg(doc);
  marquee.appendChild(svg);

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
  cursor.innerHTML = CURSOR_SVG;

  overlay.appendChild(marquee);
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

  let disposed = false;
  // Whether a previous checkpoint has been shown, so the first move drag-selects
  // directly and later moves travel from the current cursor position.
  let hasPrev = false;
  // Current cursor tip position (viewport coords), kept in sync across the rAF
  // travel and the CSS drag step so each hop starts where the last one ended.
  let cursorX = 0;
  let cursorY = 0;
  // Monotonic counter drives a deterministic (non-random) variation of the
  // bezier control point and the gesture noise so repeated runs differ slightly.
  let moveIndex = 0;
  let travelRaf = 0;
  let gestureRaf = 0;
  let dragRaf = 0;
  let inkFadeTimer = 0;
  let clickTimers = new Set();
  let clickResolve = null;
  // Resolver for the in-flight gesture's completion promise, if any.
  let gestureResolve = null;

  function cancelTravel() {
    if (travelRaf) {
      caf(travelRaf);
      travelRaf = 0;
    }
  }

  function cancelDrag() {
    if (dragRaf) {
      caf(dragRaf);
      dragRaf = 0;
    }
  }

  // Stop any running gesture, settle its completion promise, and hide the ink
  // trail. Safe to call when nothing is running.
  function cancelGesture() {
    if (gestureRaf) {
      caf(gestureRaf);
      gestureRaf = 0;
    }
    if (inkFadeTimer) {
      clearTimeout(inkFadeTimer);
      inkFadeTimer = 0;
    }
    ink.classList.remove('is-inking');
    if (gestureResolve) {
      let resolve = gestureResolve;
      gestureResolve = null;
      resolve();
    }
  }

  function setClickTimer(fn, ms) {
    let timer = setTimeout(() => {
      clickTimers.delete(timer);
      fn();
    }, ms);
    clickTimers.add(timer);
    return timer;
  }

  function cancelClick() {
    for (let timer of clickTimers) clearTimeout(timer);
    clickTimers.clear();
    clickHalo.classList.remove('is-clicking', 'pc-click-fired');
    if (clickResolve) {
      let resolve = clickResolve;
      clickResolve = null;
      resolve();
    }
  }

  function setCursor(x, y) {
    cursorX = x;
    cursorY = y;
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  }

  function hideMarqueeFrame() {
    marquee.classList.add('pc-marquee-faded');
    marquee.style.width = '0px';
    marquee.style.height = '0px';
    sizeMarqueeSvg(svg, [rectBlack, rectWhite], 0, 0);
  }

  // Drag-select the element: grow the marquee from its top-left corner exactly as
  // the cursor moves to the bottom-right, so the frame appears while it is drawn.
  function dragSelect(left, top, w, h, done) {
    cancelDrag();
    overlay.classList.remove('is-paused');
    overlay.classList.add('is-visible');

    marquee.classList.remove('pc-marquee-faded');
    marquee.style.transform = `translate(${left}px, ${top}px)`;
    marquee.style.width = '0px';
    marquee.style.height = '0px';
    sizeMarqueeSvg(svg, [rectBlack, rectWhite], 0, 0);

    setCursor(left, top);

    hasPrev = true;

    let start = nowMs();
    function frame(now) {
      if (disposed) return;
      let elapsed = (now == null ? nowMs() : now) - start;
      let t = elapsed >= DRAG_MS ? 1 : elapsed / DRAG_MS;
      let e = easeInOutCubic(t);
      let currentW = w * e;
      let currentH = h * e;
      marquee.style.width = `${currentW}px`;
      marquee.style.height = `${currentH}px`;
      sizeMarqueeSvg(svg, [rectBlack, rectWhite], currentW, currentH);
      setCursor(left + currentW, top + currentH);

      if (t >= 1) {
        dragRaf = 0;
        if (typeof done === 'function') done();
        return;
      }
      dragRaf = raf(frame);
    }

    dragRaf = raf(frame);
  }

  // Glide from the current position to (toX, toY) along a gentle quadratic-bezier
  // arc, then invoke done(). The control point is offset perpendicular to the
  // straight line; its sign and a small magnitude vary by moveIndex so successive
  // hops are not identical, with no Math.random.
  function travel(toX, toY, done) {
    let fromX = cursorX;
    let fromY = cursorY;
    let dx = toX - fromX;
    let dy = toY - fromY;
    let dist = Math.hypot(dx, dy);

    if (dist < 1) {
      setCursor(toX, toY);
      done();
      return;
    }

    let duration = resolvePresenterTravelDuration(dist);

    // Perpendicular unit vector to the travel line.
    let px = -dy / dist;
    let py = dx / dist;

    // Deterministic-but-varied arc: alternate the bow direction every move and
    // nudge the bow depth by a small repeating pattern.
    let side = moveIndex % 2 === 0 ? 1 : -1;
    let wobble = ((moveIndex % 5) - 2) * 0.04; // -0.08..+0.08
    let bow = dist * (0.16 + wobble) * side;

    // Quadratic-bezier control point: midpoint pushed out along the normal.
    let cx = fromX + dx * 0.5 + px * bow;
    let cy = fromY + dy * 0.5 + py * bow;

    let start = nowMs();

    function frame(now) {
      if (disposed) return;
      let elapsed = (now == null ? nowMs() : now) - start;
      let t = elapsed >= duration ? 1 : elapsed / duration;
      let e = easeInOutCubic(t);
      let mt = 1 - e;
      // Quadratic bezier B(e) = (1-e)^2 P0 + 2(1-e)e C + e^2 P1.
      let x = mt * mt * fromX + 2 * mt * e * cx + e * e * toX;
      let y = mt * mt * fromY + 2 * mt * e * cy + e * e * toY;
      setCursor(x, y);

      if (t >= 1) {
        travelRaf = 0;
        done();
        return;
      }
      travelRaf = raf(frame);
    }

    travelRaf = raf(frame);
  }

  function runStrokePlan(planFactory, rect, opts = {}) {
    cancelGesture();
    if (typeof planFactory !== 'function') return Promise.resolve();

    let seed = moveIndex;
    let built;
    try {
      built = planFactory(rect, seed, opts);
    } catch (_) {
      return Promise.resolve();
    }
    if (!built || typeof built.point !== 'function') return Promise.resolve();

    // More loops take proportionally longer; a small per-move speed wobble keeps
    // the timing human.
    let loops = Math.max(0, built.loops || 0);
    let speed = 1 + variation(seed, 29) * 0.12; // ~0.88..1.12
    let duration = Math.max(220, GESTURE_MS * (1 + loops * 0.55) * speed);
    let amp = GESTURE_JITTER_PX * (0.85 + (variation(seed, 31) * 0.5 + 0.5) * 0.4);

    // Begin the ink trail at the cursor's current point.
    let pts = [];
    inkPath.setAttribute('d', '');
    ink.classList.add('is-inking');

    return new Promise((resolve) => {
      gestureResolve = resolve;
      let start = nowMs();

      function frame(now) {
        if (disposed) return;
        let elapsed = (now == null ? nowMs() : now) - start;
        let t = elapsed >= duration ? 1 : elapsed / duration;
        // Ease the timeline so the flourish accelerates and settles naturally.
        let e = easeInOutCubic(t);
        let ideal = built.point(e);
        // Hand-tremor: a smoothly drifting jitter that eases out near the end so
        // the cursor lands cleanly on the rest point.
        let fade = 1 - e * e;
        let jx = jitter(seed, e, amp, 0) * fade;
        let jy = jitter(seed, e, amp, 1) * fade;
        let x = ideal.x + jx;
        let y = ideal.y + jy;
        setCursor(x, y);

        pts.push(x, y);
        if (pts.length >= 4) {
          let d = `M${pts[0].toFixed(1)} ${pts[1].toFixed(1)}`;
          for (let i = 2; i < pts.length; i += 2) {
            d += `L${pts[i].toFixed(1)} ${pts[i + 1].toFixed(1)}`;
          }
          inkPath.setAttribute('d', d);
        }

        if (t >= 1) {
          gestureRaf = 0;
          let rest = built.rest || ideal;
          setCursor(rest.x, rest.y);
          // Let the ink linger briefly, then fade it out.
          ink.classList.remove('is-inking');
          inkFadeTimer = setTimeout(() => {
            inkFadeTimer = 0;
            inkPath.setAttribute('d', '');
          }, INK_FADE_MS);
          if (gestureResolve === resolve) gestureResolve = null;
          resolve();
          return;
        }
        gestureRaf = raf(frame);
      }

      gestureRaf = raf(frame);
    });
  }

  // Play a named marker flourish around the just-settled rect, then come to rest
  // at the marker's rest point. Unknown markers resolve immediately. The path is
  // jittered per frame and the ink trail traces it, both driven by the deterministic
  // move seed so each run looks hand-drawn yet reproducible.
  function runGesture(name, rect) {
    let marker = normalizePresenterMarker(name);
    let plan = marker && Object.prototype.hasOwnProperty.call(GESTURES, marker) ? GESTURES[marker] : null;
    return runStrokePlan(plan, rect);
  }

  function runSymbol(name, rect, opts = {}) {
    let symbol = normalizePresenterSymbol(name);
    let plan = symbol && Object.prototype.hasOwnProperty.call(SYMBOLS, symbol) ? SYMBOLS[symbol] : null;
    return runStrokePlan(plan, rect, opts);
  }

  // Fire the optional per-step gesture-settled callback exactly once. Used so
  // `playCursorScenario` can wait for a flourish to finish (or extend the hold).
  function settle(opts) {
    let cb = opts && typeof opts.onGestureSettled === 'function' ? opts.onGestureSettled : null;
    if (cb) {
      try {
        cb();
      } catch (_) {}
    }
  }

  function moveTo(el, opts) {
    if (disposed) return;
    if (!el || typeof el.getBoundingClientRect !== 'function') {
      clear();
      settle(opts);
      return;
    }

    // Always recompute against live viewport coords.
    let rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      clear();
      settle(opts);
      return;
    }

    let viewport = {
      width: win?.innerWidth || doc.documentElement?.clientWidth || 0,
      height: win?.innerHeight || doc.documentElement?.clientHeight || 0,
    };
    let highlightRect = resolvePresenterHighlightRect(rect, viewport);
    let left = highlightRect.left;
    let top = highlightRect.top;
    let w = highlightRect.width;
    let h = highlightRect.height;
    let marker = normalizePresenterMarker(opts?.marker || opts?.gesture || '');

    cancelTravel();
    cancelDrag();
    cancelGesture();
    moveIndex += 1;

    // After the marquee settles, play the gesture (if any) around the element,
    // then report the flourish as settled. `settledRect` is the live box the
    // gesture animates around.
    let afterSettle = () => {
      runGesture(marker, { left, top, width: w, height: h }).then(() => settle(opts));
    };

    // First checkpoint (or after a clear/dispose reset): no journey to show, so
    // drag-select directly from the element's top-left corner.
    if (!hasPrev) {
      overlay.classList.add('is-visible');
      dragSelect(left, top, w, h, afterSettle);
      return;
    }

    // Between checkpoints: fade the previous marquee as the cursor leaves it,
    // travel along a curved path to the new start corner, then drag-select.
    overlay.classList.remove('is-paused');
    overlay.classList.add('is-visible');

    marquee.classList.add('pc-marquee-faded');

    travel(left, top, () => {
      dragSelect(left, top, w, h, afterSettle);
    });
  }

  function markElement(el, opts = {}) {
    let marker = normalizePresenterMarker(opts?.marker || opts?.gesture || '', 'circle');
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

  function clickElement(el, opts = {}) {
    if (disposed) return;
    if (!el || typeof el.getBoundingClientRect !== 'function') {
      settle(opts);
      return;
    }
    let rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      settle(opts);
      return;
    }
    let viewport = {
      width: win?.innerWidth || doc.documentElement?.clientWidth || 0,
      height: win?.innerHeight || doc.documentElement?.clientHeight || 0,
    };
    let zone = clickZoneRectFor(rect, viewport);

    cancelTravel();
    cancelDrag();
    cancelGesture();
    cancelClick();
    moveIndex += 1;
    overlay.classList.remove('is-paused');
    overlay.classList.add('is-visible');
    hideMarqueeFrame();

    let finish = () => {
      clickHalo.classList.remove('is-clicking', 'pc-click-fired');
      if (clickResolve) {
        let resolve = clickResolve;
        clickResolve = null;
        resolve();
      }
    };
    clickResolve = () => settle(opts);

    let pulse = () => {
      clickHalo.style.left = `${zone.left}px`;
      clickHalo.style.top = `${zone.top}px`;
      clickHalo.style.width = `${zone.width}px`;
      clickHalo.style.height = `${zone.height}px`;
      clickHalo.classList.remove('pc-click-fired');
      clickHalo.classList.add('is-clicking');
      setClickTimer(() => {
        fireNativeClick(el, zone);
        clickHalo.classList.add('pc-click-fired');
        clickHalo.classList.remove('is-clicking');
        setClickTimer(finish, CLICK_FADE_MS);
      }, CLICK_PRESS_MS);
    };

    if (!hasPrev) {
      hasPrev = true;
      setCursor(zone.x, zone.y);
      pulse();
    } else {
      travel(zone.x, zone.y, pulse);
    }
  }

  function annotationRectFor(rect, viewport, annotation) {
    let source = annotation?.kind === 'marker' && annotation.marker !== 'underline'
      ? resolvePresenterHighlightRect(rect, viewport)
      : rect;
    let left = Math.max(HIGHLIGHT_EDGE_INSET_PX, Number(source.left) || 0);
    let top = Math.max(HIGHLIGHT_EDGE_INSET_PX, Number(source.top) || 0);
    let maxRight = Math.max(left + HIGHLIGHT_MIN_SIZE_PX, (viewport.width || left + source.width) - HIGHLIGHT_EDGE_INSET_PX);
    let maxBottom = Math.max(top + HIGHLIGHT_MIN_SIZE_PX, (viewport.height || top + source.height) - HIGHLIGHT_EDGE_INSET_PX);
    let right = Math.min(maxRight, left + Math.max(HIGHLIGHT_MIN_SIZE_PX, Number(source.width) || HIGHLIGHT_MIN_SIZE_PX));
    let bottom = Math.min(maxBottom, top + Math.max(HIGHLIGHT_MIN_SIZE_PX, Number(source.height) || HIGHLIGHT_MIN_SIZE_PX));
    return { left, top, width: Math.max(HIGHLIGHT_MIN_SIZE_PX, right - left), height: Math.max(HIGHLIGHT_MIN_SIZE_PX, bottom - top) };
  }

  function annotateElement(el, opts = {}) {
    if (disposed) return;
    let annotation = normalizePresenterAnnotation(opts, { intent: 'emphasize' });
    if (!annotation) {
      settle(opts);
      return;
    }
    if (!el || typeof el.getBoundingClientRect !== 'function') {
      settle(opts);
      return;
    }
    let rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      settle(opts);
      return;
    }
    let viewport = {
      width: win?.innerWidth || doc.documentElement?.clientWidth || 0,
      height: win?.innerHeight || doc.documentElement?.clientHeight || 0,
    };
    let drawRect = annotationRectFor(rect, viewport, annotation);
    let start = annotation.kind === 'symbol'
      ? symbolRect(drawRect, annotation.placement)
      : drawRect;
    let toX = start.left + start.width * 0.12;
    let toY = start.top + start.height * 0.88;

    cancelTravel();
    cancelDrag();
    cancelGesture();
    moveIndex += 1;
    overlay.classList.remove('is-paused');
    overlay.classList.add('is-visible');
    hideMarqueeFrame();

    let draw = () => {
      let done = annotation.kind === 'symbol'
        ? runSymbol(annotation.symbol, drawRect, { placement: annotation.placement })
        : runGesture(annotation.marker, drawRect);
      done.then(() => settle(opts));
    };
    if (!hasPrev) {
      setCursor(toX, toY);
      hasPrev = true;
      draw();
    } else {
      travel(toX, toY, draw);
    }
  }

  function clear() {
    if (disposed) return;
    cancelTravel();
    cancelDrag();
    cancelGesture();
    cancelClick();
    inkPath.setAttribute('d', '');
    overlay.classList.remove('is-visible');
    overlay.classList.add('is-paused');
    // Next moveTo starts fresh (direct drag-select, no stale travel).
    hasPrev = false;
  }

  function dispose() {
    if (disposed) return;
    cancelTravel();
    cancelDrag();
    cancelGesture();
    cancelClick();
    disposed = true;
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  return {
    moveTo,
    markElement,
    annotateElement,
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

/** Resolves when `signal` aborts (or never, if there is no signal). */
function abortPromise(signal) {
  return new Promise((resolve) => {
    if (!signal) return; // no abort source: this branch only matters in a race
    if (signal.aborted) {
      resolve();
      return;
    }
    signal.addEventListener?.('abort', () => resolve(), { once: true });
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
 * @param {{ steps?: Array<{ target:any, holdMs?:number, marker?:string, gesture?:string, label?:string, action?:string, click?:boolean }> }} scenario
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

      let moveOpts = { label: step.label, onGestureSettled: onSettled };
      if (marker) {
        moveOpts.marker = marker;
        moveOpts.gesture = marker;
      }
      if (wantsClick && typeof cursor.clickElement === 'function') {
        cursor.clickElement(element, moveOpts);
      } else if (marker && typeof cursor.annotateElement === 'function') {
        cursor.annotateElement(element, { ...moveOpts, kind: 'marker', marker });
      } else {
        cursor.moveTo(element, moveOpts);
      }

      let hold = nonNegative(step.holdMs, baseHold);
      await delay(hold, signal);

      // If a gesture is still in flight after the hold, extend the step until it
      // settles (or the run aborts). A watchdog caps the extension so a cursor
      // that never reports settlement (e.g. a minimal fake) cannot stall the run.
      if ((marker || wantsClick) && !settled && !signal?.aborted) {
        await Promise.race([settledPromise, abortPromise(signal), delay(GESTURE_WAIT_CAP_MS, signal)]);
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
