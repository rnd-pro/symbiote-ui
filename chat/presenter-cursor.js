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
 * After a checkpoint settles, an optional per-step `gesture` (e.g. `'circle'` or
 * `'underline'`) plays an animated flourish around the target before the cursor
 * comes to rest on it. Gestures live in a small extensible registry keyed by name
 * (an unknown name is a silent no-op) and are hand-drawn: every path carries a
 * small per-frame jitter and slight radius/length/speed variation driven by the
 * same deterministic move counter as the travel arc, so runs differ yet stay
 * reproducible without `Math.random`. A faint, themed ink trail traces under the
 * cursor so the flourish reads, then fades.
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

const CURSOR_SIZE = 18; // px; the hotspot is the arrow's top-left tip
const DRAG_MS = 420; // cursor + marquee growth duration
const FADE_MS = 200; // clear() fade-out duration
const MARCH_MS = 600; // marching-ants loop duration
const MARQUEE_FADE_MS = 220; // previous marquee fades as the cursor leaves it

// Travel-between-checkpoints tuning.
const TRAVEL_MIN_MS = 500;
const TRAVEL_MAX_MS = 800;
const TRAVEL_PX_PER_MS = 1.6; // longer hops take a little more time

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
  stroke:#000;
  stroke-width:1.5;
  stroke-linecap:round;
  stroke-linejoin:round;
  shape-rendering:geometricPrecision;
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

  // Ink trail: a faint SVG path drawn under the cursor during a gesture so the
  // flourish reads, then fades out. Sits below the cursor in the overlay.
  let ink = doc.createElementNS(SVG_NS, 'svg');
  ink.setAttribute('class', 'pc-ink');
  let inkPath = doc.createElementNS(SVG_NS, 'path');
  ink.appendChild(inkPath);

  let cursor = doc.createElement('div');
  cursor.className = 'pc-cursor';
  cursor.innerHTML = CURSOR_SVG;

  overlay.appendChild(marquee);
  overlay.appendChild(ink);
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
  let inkFadeTimer = 0;
  let dragSettleTimer = 0;
  // Resolver for the in-flight gesture's completion promise, if any.
  let gestureResolve = null;

  function cancelTravel() {
    if (travelRaf) {
      caf(travelRaf);
      travelRaf = 0;
    }
  }

  // Stop any running gesture, settle its completion promise, and hide the ink
  // trail. Safe to call when nothing is running.
  function cancelGesture() {
    if (dragSettleTimer) {
      clearTimeout(dragSettleTimer);
      dragSettleTimer = 0;
    }
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

  // Play a named gesture flourish around the just-settled rect, then come to rest
  // at the gesture's rest point. Returns a promise that resolves when the
  // flourish finishes (or is aborted). Unknown gestures resolve immediately. The
  // path is jittered per frame and the ink trail traces it, both driven by the
  // deterministic move seed so each run looks hand-drawn yet reproducible.
  function runGesture(name, rect) {
    cancelGesture();
    let plan = name && Object.prototype.hasOwnProperty.call(GESTURES, name) ? GESTURES[name] : null;
    if (!plan) return Promise.resolve();

    let seed = moveIndex;
    let built;
    try {
      built = plan(rect, seed);
    } catch (_) {
      return Promise.resolve();
    }
    if (!built || typeof built.point !== 'function') return Promise.resolve();

    // More loops take proportionally longer; a small per-move speed wobble keeps
    // the timing human. Drag-select still owns the cursor transform via CSS, so
    // drop that class for frame-by-frame control during the flourish.
    let loops = Math.max(0, built.loops || 0);
    let speed = 1 + variation(seed, 29) * 0.12; // ~0.88..1.12
    let duration = Math.max(220, GESTURE_MS * (1 + loops * 0.55) * speed);
    let amp = GESTURE_JITTER_PX * (0.85 + (variation(seed, 31) * 0.5 + 0.5) * 0.4);
    cursor.classList.remove('pc-cursor-drag');

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
    let w = rect.width;
    let h = rect.height;
    if (w <= 0 || h <= 0) {
      clear();
      settle(opts);
      return;
    }

    let left = rect.left;
    let top = rect.top;
    let gesture = opts && typeof opts.gesture === 'string' ? opts.gesture : null;

    cancelTravel();
    cancelGesture();
    moveIndex += 1;

    // After the marquee settles, play the gesture (if any) around the element,
    // then report the flourish as settled. `settledRect` is the live box the
    // gesture animates around.
    let afterSettle = () => {
      runGesture(gesture, { left, top, width: w, height: h }).then(() => settle(opts));
    };

    // First checkpoint (or after a clear/dispose reset): no journey to show, so
    // drag-select directly from the element's top-left corner.
    if (!hasPrev) {
      overlay.classList.add('is-visible');
      dragSelect(left, top, w, h);
      scheduleAfterDrag(afterSettle);
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
      scheduleAfterDrag(afterSettle);
    });
  }

  // Run `fn` once the CSS drag-select transition has visually settled. Tracked so
  // a new moveTo/clear/dispose can cancel a pending settle.
  function scheduleAfterDrag(fn) {
    if (dragSettleTimer) {
      clearTimeout(dragSettleTimer);
      dragSettleTimer = 0;
    }
    dragSettleTimer = setTimeout(() => {
      dragSettleTimer = 0;
      if (!disposed) fn();
    }, DRAG_MS);
  }

  function clear() {
    if (disposed) return;
    cancelTravel();
    cancelGesture();
    inkPath.setAttribute('d', '');
    overlay.classList.remove('is-visible');
    overlay.classList.add('is-paused');
    // Next moveTo starts fresh (direct drag-select, no stale travel).
    hasPrev = false;
  }

  function dispose() {
    if (disposed) return;
    cancelTravel();
    cancelGesture();
    disposed = true;
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
 *       { target, holdMs?, gesture?, label? },
 *       ...
 *     ]
 *   }
 *
 * For each step, in order: `resolveTarget(step.target)` maps the agent-authored
 * target reference to a DOM element (or any value the cursor's `moveTo` accepts);
 * the cursor moves to it; if the step carries a `gesture`, the cursor plays that
 * flourish once it settles on the target; playback holds for `holdMs` (or
 * `defaultHoldMs`), extending the hold until any gesture finishes; then
 * `onStep(step, index)` fires. A step whose target resolves to nothing is skipped
 * (its `moveTo` and hold are not run) but still reports through `onStep` so a host
 * can react. `gesture` names an entry in the cursor's gesture registry (e.g.
 * `'circle'` or `'underline'`); an unknown name is a silent no-op.
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

    if (element != null) {
      // A step's `gesture` plays a flourish after the cursor settles on the
      // target. The cursor reports completion via `onGestureSettled`; the player
      // waits for it within the hold and extends the hold when the gesture runs
      // longer, so the next step never starts mid-flourish.
      let settled = false;
      let onSettled = null;
      let settledPromise = new Promise((res) => {
        onSettled = () => {
          settled = true;
          res();
        };
      });

      cursor.moveTo(element, {
        gesture: step.gesture,
        label: step.label,
        onGestureSettled: onSettled,
      });

      let hold = nonNegative(step.holdMs, baseHold);
      await delay(hold, signal);

      // If a gesture is still in flight after the hold, extend the step until it
      // settles (or the run aborts). A watchdog caps the extension so a cursor
      // that never reports settlement (e.g. a minimal fake) cannot stall the run.
      if (step.gesture && !settled && !signal?.aborted) {
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
