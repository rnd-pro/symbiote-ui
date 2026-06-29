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
 * `playCursorScenario` plays an agent-authored scenario — a plain list of steps,
 * each naming a `target` the host resolves to a DOM element — by driving the
 * cursor step-by-step with per-step holds, an `onStep` hook, and `AbortSignal`
 * support. The step sequencing is host-agnostic and pure enough to unit-test
 * against a fake cursor and fake `resolveTarget` with no real DOM.
 *
 * Node-safe at import time: no top-level DOM, window, document, or rAF access.
 * Every browser touch is lazy and guarded, so importing in a non-browser env
 * never throws; `createPresenterCursor` then returns inert no-op handles and
 * `isSupported()` reports false. `playCursorScenario` works identically against
 * a real cursor or a fake one, so the scenario contract is the agent-facing API.
 */

const STYLE_ID = 'symbiote-presenter-cursor-style';
const OVERLAY_CLASS = 'symbiote-presenter-cursor';

const CURSOR_SIZE = 18; // px; the hotspot is the arrow's top-left tip
const DRAG_MS = 420; // cursor + marquee growth duration
const FADE_MS = 200; // clear() fade-out duration
const MARCH_MS = 600; // marching-ants loop duration
const MARQUEE_FADE_MS = 220; // previous marquee fades as the cursor leaves it

// Travel-between-checkpoints tuning.
const TRAVEL_MIN_MS = 500;
const TRAVEL_MAX_MS = 800;
const TRAVEL_PX_PER_MS = 1.6; // longer hops take a little more time

const DEFAULT_HOLD_MS = 1200;

const SVG_NS = 'http://www.w3.org/2000/svg';

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
  transition:transform ${DRAG_MS}ms ease, width ${DRAG_MS}ms ease, height ${DRAG_MS}ms ease, opacity ${MARQUEE_FADE_MS}ms ease;
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
/* Only the drag-select step uses a CSS transition; travel is driven by rAF. */
${overlaySelector} .pc-cursor.pc-cursor-drag{
  transition:transform ${DRAG_MS}ms ease;
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

// easeInOutCubic — slow start, quick middle, gentle settle: reads as a natural
// human glide rather than a linear slide.
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function hasDocument(doc) {
  return Boolean(doc && doc.body && typeof doc.createElement === 'function');
}

/** Inert handle returned when there is no DOM to drive (e.g. Node import). */
function inertCursor() {
  return {
    moveTo() {},
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
 * @returns {{ moveTo: (el: Element, opts?: object) => void, clear: () => void, dispose: () => void, isSupported: () => boolean }}
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

  let cursor = doc.createElement('div');
  cursor.className = 'pc-cursor';
  cursor.innerHTML = CURSOR_SVG;

  overlay.appendChild(marquee);
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
  // bezier control point so repeated runs differ slightly.
  let moveIndex = 0;
  let travelRaf = 0;

  function cancelTravel() {
    if (travelRaf) {
      caf(travelRaf);
      travelRaf = 0;
    }
  }

  function setCursor(x, y) {
    cursorX = x;
    cursorY = y;
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  }

  // Drag-select the element: grow the marquee from its top-left corner and slide
  // the cursor from that corner to the bottom-right, marching-ants running.
  function dragSelect(left, top, w, h) {
    overlay.classList.remove('is-paused');
    overlay.classList.add('is-visible');

    marquee.classList.remove('pc-marquee-faded');
    marquee.style.transform = `translate(${left}px, ${top}px)`;
    marquee.style.width = `${w}px`;
    marquee.style.height = `${h}px`;
    sizeMarqueeSvg(svg, [rectBlack, rectWhite], w, h);

    cursor.classList.add('pc-cursor-drag');
    setCursor(left, top);
    // Force a reflow so the second transform animates as a continuation.
    void cursor.offsetWidth;
    setCursor(left + w, top + h);

    hasPrev = true;
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

    let duration = Math.max(
      TRAVEL_MIN_MS,
      Math.min(TRAVEL_MAX_MS, dist * (1 / TRAVEL_PX_PER_MS) + TRAVEL_MIN_MS * 0.6),
    );

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

  function moveTo(el) {
    if (disposed) return;
    if (!el || typeof el.getBoundingClientRect !== 'function') {
      clear();
      return;
    }

    // Always recompute against live viewport coords.
    let rect = el.getBoundingClientRect();
    let w = rect.width;
    let h = rect.height;
    if (w <= 0 || h <= 0) {
      clear();
      return;
    }

    let left = rect.left;
    let top = rect.top;

    cancelTravel();
    moveIndex += 1;

    // First checkpoint (or after a clear/dispose reset): no journey to show, so
    // drag-select directly from the element's top-left corner.
    if (!hasPrev) {
      overlay.classList.add('is-visible');
      dragSelect(left, top, w, h);
      return;
    }

    // Between checkpoints: fade the previous marquee as the cursor leaves it,
    // travel along a curved path to the new start corner, then drag-select.
    overlay.classList.remove('is-paused');
    overlay.classList.add('is-visible');

    // The drag step owns the cursor transition; remove it so the rAF travel
    // controls the transform frame-by-frame without a fighting CSS easing.
    cursor.classList.remove('pc-cursor-drag');
    marquee.classList.add('pc-marquee-faded');

    travel(left, top, () => {
      dragSelect(left, top, w, h);
    });
  }

  function clear() {
    if (disposed) return;
    cancelTravel();
    overlay.classList.remove('is-visible');
    overlay.classList.add('is-paused');
    // Next moveTo starts fresh (direct drag-select, no stale travel).
    hasPrev = false;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelTravel();
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  return {
    moveTo,
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
 *       { target, holdMs?, gesture?, label? },
 *       ...
 *     ]
 *   }
 *
 * For each step, in order: `resolveTarget(step.target)` maps the agent-authored
 * target reference to a DOM element (or any value the cursor's `moveTo` accepts);
 * the cursor moves to it; playback holds for `holdMs` (or `defaultHoldMs`); then
 * `onStep(step, index)` fires. A step whose target resolves to nothing is skipped
 * (its `moveTo` and hold are not run) but still reports through `onStep` so a host
 * can react. `gesture` is an optional, reserved label for a future per-step
 * flourish (e.g. circle/underline); it is accepted and ignored for now.
 *
 * The run honors an `AbortSignal`: aborting stops before the next step and
 * promptly ends any in-progress hold, and clears the cursor.
 *
 * Host-agnostic and unit-testable without a real DOM: pass a fake cursor that
 * records `moveTo` calls and a fake `resolveTarget`.
 *
 * @param {{ moveTo: Function, clear?: Function }} cursor - a presenter cursor (or fake).
 * @param {{ steps?: Array<{ target:any, holdMs?:number, gesture?:string, label?:string }> }} scenario
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

    // `gesture` is reserved for a future per-step flourish; accept and ignore.

    if (element != null) {
      cursor.moveTo(element, { gesture: step.gesture, label: step.label });
      let hold = nonNegative(step.holdMs, baseHold);
      await delay(hold, signal);
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
