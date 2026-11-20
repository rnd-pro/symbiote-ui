import { routeAround as routeBodyAround } from './presenter-rig-route.js';
import { DEFAULT_MASK, MASK_ORDER, MASK_VARIANTS } from './presenter-rig-masks.js';
import createPresenterHose from './presenter-hose.js';

// Experimental presenter body: a round avatar that flies over the page with a
// claw hose on each side. It exposes the same surface as `createPresenterHose`
// so the cursor can use it as a drop-in replacement. The arms take turns: the
// body settles on the side of the target opposite the arm that reaches for it.
const BODY_RADIUS = 30;
const REACH = 190;
// While the claw holds a selection the arm shortens and the body comes close.
const HOLD_REACH = 105;
const REACH_TAU_S = 0.3;
// Body roll: a limited pendulum around the center of the circle.
const ROLL_LIMIT_DEG = 16;
const ROLL_SPRING = { stiffness: 26, damping: 3.2 };
const EVENT_DISTANCE_PX = 260;
const EDGE_MARGIN = 10;
const MAX_SPEED = 380;
const AIM_TAU_S = 0.28;
// The body never chases the claw directly: it perches by a slow, smoothed copy
// of the claw position (LOOK_TAU_S), so a claw that jumps across the page pulls
// the body along a long, soft curve. The arm is an elastic leash that only
// lengthens up to LEASH_SLACK_PX past its rest length.
const LOOK_TAU_S = 0.55;
const MAX_WEB_PX = 1100;
// The body waits while the claw is thrown and is reeled in once it lands.
const WAIT_PULL = 0.12;
// With a planned perch the body already drifts toward it while the claw flies.
const PLANNED_WAIT_PULL = 0.5;
const LANDED_SPEED_PX_S = 220;
const RETRACT_TAU_S = 0.07;
// Fallback only (lost events): the gesture's own end retracts the arm. The claw
// legitimately waits still at the start of a selection before the frame appears,
// so the wait must be longer than any authored hold.
const IDLE_RETRACT_MS = 3000;
// The end of a gesture retracts the arm after this grace: when the next cue starts
// within it, the arm stays out instead of being drawn in and thrown out again.
const RETIRE_GRACE_MS = 800;
// Slightly underdamped: the body overshoots a little and settles back.
const SPRING = { stiffness: 11, damping: 4.6 };
// While the user holds the robot it follows the pointer on a firmer spring.
const DRAG_SPRING = { stiffness: 70, damping: 13 };
const DRAG_MAX_SPEED = 1600;

// Subtitles become a cartoon speech cloud that grows out of the avatar.
const SPEECH_POLL_MS = 90;
// Comic-style lines: a few words per balloon, broken at punctuation.
const PHRASE_WORDS = 4;
const PHRASE_CHARS = 26;
const PHRASE_END = /[,;:\u2014\u2013.!?\u2026]["')\]]*$/;
const SPEECH_HOLD_MS = 1400;

// Cartoon mouth: a stylised oval that follows the letters of the word being said.
// Each letter gives a [width, height] of the mouth (0..1 of its largest oval);
// vowels open wide, round or narrow, lip sounds close it, other consonants only
// part the lips. Vowels also last longer than consonants inside a word.
const MOUTH_REST = [0.6, 0.07];
const MOUTH_DEFAULT = [0.62, 0.22];
const MOUTH_SHAPES = new Map(Object.entries({
  а: [0.82, 1], я: [0.78, 0.9], о: [0.55, 0.85], ё: [0.55, 0.8], у: [0.38, 0.5], ю: [0.4, 0.55],
  э: [0.88, 0.6], е: [0.85, 0.55], и: [0.92, 0.28], ы: [0.8, 0.3], й: [0.8, 0.25],
  a: [0.82, 1], e: [0.85, 0.55], i: [0.92, 0.28], o: [0.55, 0.85], u: [0.38, 0.5], y: [0.8, 0.3],
  м: [0.62, 0.07], б: [0.62, 0.07], п: [0.62, 0.07], m: [0.62, 0.07], b: [0.62, 0.07], p: [0.62, 0.07],
  ф: [0.72, 0.16], в: [0.72, 0.16], f: [0.72, 0.16], v: [0.72, 0.16], w: [0.5, 0.3],
  ш: [0.45, 0.32], щ: [0.45, 0.32], ж: [0.45, 0.32], ч: [0.45, 0.3],
}));
const MOUTH_VOWELS = /[аяоёуюэеиыaeiouy]/u;
const MOUTH_TAU_S = 0.045;
const MOUTH_LETTER_MS = 80;
// A pause shorter than this between two words keeps the last sound's shape.
const MOUTH_HOLD_MS = 160;
// The mouth leads the narration clock by this much (the sound reaches the ear later).
const MOUTH_LEAD_MS = 0;
// The narration clock counts as running while its position moved within this long;
// between two scenes it stands still while the next sound loads.
const CLOCK_STALL_MS = 180;

// Face mask: while the show plays the presenter wears a faceplate (dark metal, the
// site's orange accent, slanted eye slits); on pause it lifts. The eyes in the
// slits look toward the accent: the claw, or the area being marked.
const MASK_OFF_DELAY_MS = 260;
const EYE_TAU_S = 0.09;
const BLINK_MS = 120;
const BLINK_GAP_MS = [2600, 6200];
const SENTENCE_END = /[.!?\u2026]["')\]]*$/;

// The free arm throws to an anchor beyond the perch, grips, and reels the body in.
// Push-off: the free arm grabs the canvas right next to the body, behind the
// direction of travel, and shoves the body away from it.
const GRAB_DIST_PX = 34;
const PUSH_ACCEL = 1700;
const PUSH_TIME_S = 0.34;
const PUSH_RELEASE_PX = 150;
const THROW_TAU_S = 0.035;
// Any relocation of at least this much (px) is a grab; re-grab after the cooldown.
const MOVE_MIN_PX = 14;
const REGRAB_PX = 110;
const REGRAB_COOLDOWN_MS = 700;
const PUSH_SPEED_BOOST = 1.5;
const PERCH_GAP_PX = BODY_RADIUS + 14;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const TRACE_SAMPLE_MS = 150;

// `onTrace(type, data)` is an optional diagnostics sink: state changes and a
// periodic state sample, so a bug in the motion can be read back afterwards.
export default function createPresenterRig(overlay, resolvePlayer, {
  avatarSrc = '', onTrace = null, speechClock = null, mask: maskName = DEFAULT_MASK, onMaskChange = null,
  isPaused = null, subtitles = true,
} = {}) {
  // The speech cloud is the subtitles: it hides on pause and can be switched off.
  let subtitlesOn = subtitles !== false;
  let trace = (type, data) => { if (typeof onTrace === 'function') onTrace(type, data); };
  let lastTraceAt = 0;
  let lastTraceSample = null;
  let lastTracePhase = 'idle';
  let doc = overlay.ownerDocument;
  let win = doc.defaultView;
  let body = doc.createElement('div');
  body.className = 'pc-rig-body';
  body.setAttribute('aria-hidden', 'true');
  body.style.cssText = `position:absolute;left:0;top:0;box-sizing:border-box;pointer-events:none;
    width:${BODY_RADIUS * 2}px;height:${BODY_RADIUS * 2}px;margin:${-BODY_RADIUS}px 0 0 ${-BODY_RADIUS}px;
    border-radius:50%;opacity:0;
    /* A translucent matte-white ring: the page shows through it (softly blurred), and the dark
       outline stays. The face is clipped to the padding box, so only the ring is glass. */
    border:3px solid color-mix(in srgb, var(--presenter-hose-outline, #fff) 66%, transparent);
    -webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);
    box-shadow:0 0 0 2px var(--presenter-hose-ink, #22251f), 0 6px 18px rgba(0,0,0,.28)`;
  // Connectors where the hoses leave the body, drawn like the hose ports on
  // the claws (the body sits above the hose layer and would hide those).
  // The photo is its own layer, so it can fade out under the face mask and let the page show through.
  let photo = doc.createElement('span');
  photo.style.cssText = `position:absolute;inset:0;border-radius:50%;pointer-events:none;
    background:#22251f ${avatarSrc ? `url("${avatarSrc}")` : ''} 50% 50% / 120% no-repeat;transition:opacity .25s`;
  body.appendChild(photo);
  let mask = doc.createElement('span');
  mask.setAttribute('data-rig-mask', 'up');
  mask.style.cssText = `position:absolute;inset:0;border-radius:50%;overflow:hidden;pointer-events:none`;
  // Under the frosted face: beads circle round the visor and each spoken word sets one going,
  // its size following the word's length. They take the theme's ink (no colour of their own) and are
  // blurred by the mask's glass, so they read as soft shapes moving behind it.
  let orbit = doc.createElement('span');
  orbit.style.cssText = 'position:absolute;inset:0;border-radius:50%;overflow:hidden;pointer-events:none;opacity:0;transition:opacity .3s';
  body.appendChild(orbit);
  body.appendChild(mask);
  let maskSvg = null;
  let eyeNodes = [];
  let maskKind = MASK_VARIANTS[maskName] ? maskName : DEFAULT_MASK;
  let maskState = { on: false, offSince: 0 };
  let eyeState = { x: 0, y: 0, blinkAt: 0, blinkEnd: 0 };
  // (Re)draws the face mask; the lifted or lowered position is kept.
  let buildMask = () => {
    mask.innerHTML = `<svg viewBox="0 0 54 54" width="100%" height="100%" aria-hidden="true"
      style="display:block;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);transform:translateY(${maskState.on ? '0' : '-110%'})">${MASK_VARIANTS[maskKind].svg}</svg>`;
    maskSvg = mask.firstElementChild;
    eyeNodes = [...mask.querySelectorAll('[data-eye]')];
  };
  buildMask();
  let setMask = (name) => {
    if (!MASK_VARIANTS[name] || name === maskKind) return maskKind;
    maskKind = name;
    buildMask();
    trace('mask', { kind: name });
    if (typeof onMaskChange === 'function') onMaskChange(name);
    return maskKind;
  };
  // A double click on the presenter tries the next face.
  body.addEventListener('dblclick', (event) => {
    event.stopPropagation();
    setMask(MASK_ORDER[(MASK_ORDER.indexOf(maskKind) + 1) % MASK_ORDER.length]);
    // Show the mask even if the show is paused, so the new face can be judged.
    maskState.on = true;
    maskState.offSince = 0;
    maskSvg.style.transform = 'translateY(0)';
  });
  let mouth = doc.createElement('span');
  mouth.style.cssText = `position:absolute;left:50%;top:68%;box-sizing:border-box;border-radius:50%;
    transform:translate(-50%,-50%);opacity:0;overflow:hidden;
    background:#240a0c;border:1.5px solid var(--presenter-hose-outline, #fff);
    box-shadow:0 0 0 1px rgba(0,0,0,.35)`;
  let tongue = doc.createElement('span');
  tongue.style.cssText = `position:absolute;left:50%;bottom:-18%;width:70%;height:55%;border-radius:50%;
    transform:translateX(-50%);background:#c47a72`;
  mouth.appendChild(tongue);
  body.appendChild(mouth);
  let connectors = ['left', 'right'].map((side) => {
    let connector = doc.createElement('span');
    connector.style.cssText = `position:absolute;top:50%;${side}:-8px;width:6px;height:14px;margin-top:-7px;
      box-sizing:border-box;border-radius:3px;background:var(--presenter-hose-ink, #22251f);
      box-shadow:0 0 0 2px var(--presenter-hose-outline, #fff)`;
    body.appendChild(connector);
    return connector;
  });
  overlay.appendChild(body);
  let ink = 'var(--presenter-hose-ink, #22251f)';
  let paper = 'var(--presenter-hose-outline, #fff)';
  // Theme-bound: the cloud's fill is the panel surface, its text the theme ink.
  let fill = 'var(--sn-sys-surface-panel, var(--presenter-hose-outline, #fff))';
  let cloud = doc.createElement('div');
  cloud.className = 'pc-rig-cloud';
  cloud.setAttribute('aria-hidden', 'true');
  // Sizes follow the avatar (BODY_RADIUS) so the cloud stays in proportion.
  let unit = BODY_RADIUS / 30;
  cloud.style.cssText = `position:absolute;left:0;top:0;box-sizing:border-box;pointer-events:none;opacity:0;
    width:max-content;max-width:${Math.round(176 * unit)}px;padding:${7 * unit}px ${15 * unit}px ${8 * unit}px;
    color:${ink};background:${fill};font:800 ${12 * unit}px/1.2 var(--sn-font, system-ui, sans-serif);
    text-align:center;text-transform:uppercase;letter-spacing:.03em;white-space:normal;overflow-wrap:anywhere;
    border:3px solid ${paper};border-radius:${22 * unit}px ${26 * unit}px ${24 * unit}px ${20 * unit}px / ${20 * unit}px ${22 * unit}px ${20 * unit}px ${24 * unit}px;
    box-shadow:0 0 0 2px ${ink}, 0 ${6 * unit}px ${18 * unit}px rgba(0,0,0,.28);will-change:transform;`;
  let puffs = [9, 6.5, 4].map((size) => {
    let puff = doc.createElement('div');
    puff.style.cssText = `position:absolute;left:0;top:0;box-sizing:border-box;pointer-events:none;opacity:0;
      width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;
      background:${fill};border:2px solid ${paper};box-shadow:0 0 0 1.5px ${ink};will-change:transform;`;
    overlay.appendChild(puff);
    return puff;
  });
  overlay.appendChild(cloud);
  // The cloud replaces the player's own caption: it is removed from the layout
  // for as long as the rig exists (the words stay in the DOM for readSpeech).
  let captionStyle = doc.createElement('style');
  captionStyle.textContent = 'chat-show-player .chat-show-caption{display:none !important}';
  (doc.head || doc.documentElement).appendChild(captionStyle);
  // Arm 0 leaves the left connector and reaches left; arm 1 mirrors it. Each
  // hose is anchored on its own connector, so a tilted, bobbing body still
  // has its hoses leave exactly from the connectors.
  let arms = ['left', 'right'].map((side, index) => createPresenterHose(overlay, () => connectors[index], { side, rigid: true, before: body }));
  let parked = [true, true];
  let retiring = new Map();
  let lastMoveAt = 0;
  let retireDueAt = 0;
  let active = null;
  let lastArm = 1;
  let docked = true;
  let gripClosed = false;
  let disposed = false;
  let pos = null;
  let goal = null;
  let aim = null;
  let clawShown = null;
  let clawSlow = null;
  let hintPoint = null;
  let scale = 0;
  let frame = 0;
  let last = 0;
  let outward = { x: 0.9, y: -0.4 };
  let centroid = null;
  let perchSign = 1;
  let reachNow = REACH;
  let drag = null;
  let plan = null;
  let lastGrabAt = -1e9;
  let free = { index: -1, phase: 'idle', claw: null, anchor: null, reelAt: 0 };
  let pinned = false;
  let speech = { key: '', words: [], active: -1, spans: [], lastPollAt: -1e9, lastActiveAt: -1e9 };
  let speechNow = null;
  let clockWatch = { pos: -1, movedAt: 0 };
  let mouthState = { w: MOUTH_REST[0], h: MOUTH_REST[1], opacity: 0, word: null, msPerLetter: MOUTH_LETTER_MS, clockIndex: 0 };
  let cloudState = { x: 0, y: 0, scale: 0, ready: false, width: 0, height: 0, below: false };
  let reel = 1;
  let clawPrev = null;
  let clawSpeed = 0;
  let roll = { angle: 0, velocity: 0 };
  let prevVelocity = { x: 0, y: 0 };
  // Idle hover offset of the drawn body, which parked claws share.
  let hover = { x: 0, y: 0 };
  let selectionSide = -1;
  let cursorPoint = null;
  let media = typeof win.matchMedia === 'function'
    ? win.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  let now = () => win.performance.now();
  let viewport = () => ({
    width: win.innerWidth || doc.documentElement.clientWidth,
    height: win.innerHeight || doc.documentElement.clientHeight,
  });
  let restPoint = () => {
    let rect = resolvePlayer()?.getBoundingClientRect();
    return rect?.width > 0 && rect?.height > 0
      ? { x: rect.left, y: rect.top + rect.height / 2 }
      : null;
  };
  let armHome = (index) => {
    let radius = BODY_RADIUS * scale;
    return {
      x: pos.x + hover.x + (index === 0 ? -1 : 1) * (radius + 48),
      y: pos.y + hover.y + 50 * scale,
    };
  };

  // Keep the body inside the viewport and off the player; when the preferred
  // side is blocked, perch on the other side of the cursor.
  let fit = (point) => {
    let view = viewport();
    let player = resolvePlayer()?.getBoundingClientRect();
    let place = (sign) => ({
      x: clamp(point.x + outward.x * sign * reachNow, BODY_RADIUS + EDGE_MARGIN, view.width - BODY_RADIUS - EDGE_MARGIN),
      y: clamp(point.y + outward.y * sign * reachNow, BODY_RADIUS + EDGE_MARGIN, view.height - BODY_RADIUS - EDGE_MARGIN),
    });
    let blocked = (spot) => player
      && spot.x + BODY_RADIUS > player.left - 12 && spot.x - BODY_RADIUS < player.right + 12
      && spot.y + BODY_RADIUS > player.top - 12 && spot.y - BODY_RADIUS < player.bottom + 12;
    // Hysteresis: keep the current side until it is actually unusable, so a
    // perch evaluated every frame never flickers between the two sides.
    let unusable = (candidate) => blocked(candidate)
      || Math.hypot(candidate.x - point.x, candidate.y - point.y) < BODY_RADIUS + 60;
    let spot = place(perchSign);
    if (unusable(spot)) {
      let other = place(-perchSign);
      if (!unusable(other)) {
        spot = other;
        perchSign = -perchSign;
      }
    }
    return clearOfSelection(spot, view);
  };

  // The selection frame holds the text being presented: the body perches
  // outside it, on whichever side needs the least flight.
  let selectionRect = () => {
    let frame = overlay.querySelector('.pc-marquee');
    if (!frame || frame.classList.contains('pc-marquee-faded')) return null;
    let rect = frame.getBoundingClientRect();
    return rect.width > 4 && rect.height > 4 ? rect : null;
  };
  let clearOfSelection = (spot, view) => {
    let rect = selectionRect();
    if (!rect) return spot;
    let gap = BODY_RADIUS + 14;
    let box = { left: rect.left - gap, right: rect.right + gap, top: rect.top - gap, bottom: rect.bottom + gap };
    if (spot.x <= box.left || spot.x >= box.right || spot.y <= box.top || spot.y >= box.bottom) return spot;
    let inside = (candidate) => candidate.x > box.left && candidate.x < box.right && candidate.y > box.top && candidate.y < box.bottom;
    let candidates = [
      { x: box.left, y: spot.y }, { x: box.right, y: spot.y },
      { x: spot.x, y: box.top }, { x: spot.x, y: box.bottom },
    ].map((candidate) => ({
      x: clamp(candidate.x, BODY_RADIUS + EDGE_MARGIN, view.width - BODY_RADIUS - EDGE_MARGIN),
      y: clamp(candidate.y, BODY_RADIUS + EDGE_MARGIN, view.height - BODY_RADIUS - EDGE_MARGIN),
    }));
    // Nearest free side, but the side already in use wins unless another is
    // clearly (80px) shorter, so the body does not hop around the frame.
    let cost = (candidate, index) => (inside(candidate) ? Infinity
      : Math.hypot(candidate.x - spot.x, candidate.y - spot.y) - (index === selectionSide ? 80 : 0));
    let best = -1;
    candidates.forEach((candidate, index) => {
      if (cost(candidate, index) < (best < 0 ? Infinity : cost(candidates[best], best))) best = index;
    });
    if (best < 0) return spot;
    selectionSide = best;
    return candidates[best];
  };

  // Where the body perches for a given side of the (final) selection rect: just
  // outside it, level with the claw, kept inside the viewport.
  let sidePerch = (side, rect, point) => {
    let view = viewport();
    let low = BODY_RADIUS + EDGE_MARGIN;
    // Beside the claw at the default arm length (the end of the selection), but
    // never closer to the frame than the body gap.
    let raw = side === 'right' ? { x: Math.max(rect.right + PERCH_GAP_PX, point.x + REACH), y: clamp(point.y, rect.top, rect.bottom) }
      : side === 'left' ? { x: Math.min(rect.left - PERCH_GAP_PX, point.x - REACH), y: clamp(point.y, rect.top, rect.bottom) }
        : side === 'top' ? { x: clamp(point.x, rect.left, rect.right), y: Math.min(rect.top - PERCH_GAP_PX, point.y - REACH) }
          : { x: clamp(point.x, rect.left, rect.right), y: Math.max(rect.bottom + PERCH_GAP_PX, point.y + REACH) };
    let spot = { x: clamp(raw.x, low, view.width - low), y: clamp(raw.y, low, view.height - low) };
    let player = resolvePlayer()?.getBoundingClientRect();
    let blocked = Boolean(player
      && spot.x + BODY_RADIUS > player.left - 12 && spot.x - BODY_RADIUS < player.right + 12
      && spot.y + BODY_RADIUS > player.top - 12 && spot.y - BODY_RADIUS < player.bottom + 12);
    return { ...spot, shift: Math.hypot(spot.x - raw.x, spot.y - raw.y), blocked };
  };
  // The body settles in free space beside the final selection (right of it in
  // the usual case) and reaches with the arm on that side, so the arm never
  // crosses the body.
  let choosePlan = (point, box) => {
    let rect = box && box.width > 1 && box.height > 1 ? box
      : { left: point.x - 20, right: point.x + 20, top: point.y - 20, bottom: point.y + 20 };
    let best = null;
    for (let side of ['right', 'left', 'top', 'bottom']) {
      let spot = sidePerch(side, rect, point);
      let score = spot.shift + (spot.blocked ? 1000 : 0);
      if (!best || score < best.score - 1e-6) best = { side, spot, score };
      if (score < 8) break;
    }
    let workArm = best.side === 'right' ? 0 : best.side === 'left' ? 1 : (point.x <= best.spot.x ? 0 : 1);
    return { rect, hasBox: Boolean(box && box.width > 1 && box.height > 1), side: best.side, workArm, perch: { x: best.spot.x, y: best.spot.y } };
  };
  // Live perch: tracks the actual selection frame once it is on screen.
  let planPerch = (point) => {
    // The frame grows while it is drawn and the body trails its perch: aim at the
    // union of the frame so far and the final frame the plan already knows, so
    // the body is never inside the part that is still to be selected.
    let live = selectionRect();
    let rect = live || plan.rect;
    if (live && plan.hasBox) {
      rect = {
        left: Math.min(live.left, plan.rect.left), top: Math.min(live.top, plan.rect.top),
        right: Math.max(live.right, plan.rect.right), bottom: Math.max(live.bottom, plan.rect.bottom),
      };
    }
    let spot = sidePerch(plan.side, rect, point);
    return clearOfSelection({ x: spot.x, y: spot.y }, viewport());
  };

  // The frame the body must not cross: what is drawn so far plus the final frame.
  let planFrame = () => {
    let live = selectionRect();
    let rect = live || (plan && plan.hasBox ? plan.rect : null);
    if (live && plan && plan.hasBox) {
      rect = {
        left: Math.min(live.left, plan.rect.left), top: Math.min(live.top, plan.rect.top),
        right: Math.max(live.right, plan.rect.right), bottom: Math.max(live.bottom, plan.rect.bottom),
      };
    }
    return rect;
  };
  let releaseFree = () => {
    if (free.phase === 'idle') return;
    if (free.claw && free.index >= 0) {
      arms[free.index].setGrip(false);
      parked[free.index] = false;
      retiring.set(free.index, { ...free.claw });
    }
    free.phase = 'idle';
  };

  // Locomotion: the free arm throws to a point beyond the perch, grips the
  // space there and the body is reeled along it. Skipped when the body is
  // already near the perch or the anchor would lie across the body.
  let startFreeArm = () => {
    releaseFree();
    if (!plan || !pos || drag) return;
    let dx = plan.perch.x - pos.x;
    let dy = plan.perch.y - pos.y;
    let dist = Math.hypot(dx, dy);
    if (dist < MOVE_MIN_PX) return;
    let dir = { x: dx / dist, y: dy / dist };
    let index = 1 - plan.workArm;
    let armSign = index === 0 ? -1 : 1;
    // The claw grips behind the travel; the arm can only reach its own side,
    // so when "behind" is across the body it grips above or below on that side.
    let back = { x: -dir.x, y: -dir.y };
    if (back.x * armSign < 0.25) {
      back = { x: armSign * 0.5, y: (back.y || 1) > 0 ? 0.87 : -0.87 };
    }
    let view = viewport();
    let anchor = {
      x: clamp(pos.x + back.x * (BODY_RADIUS + GRAB_DIST_PX), 20, view.width - 20),
      y: clamp(pos.y + back.y * (BODY_RADIUS + GRAB_DIST_PX), 20, view.height - 20),
    };
    let start = retiring.get(index) || armHome(index);
    retiring.delete(index);
    parked[index] = false;
    free = { index, phase: 'throw', claw: { ...start }, anchor, dir, pushAt: 0, at: now() };
    lastGrabAt = free.at;
    arms[index].setGrip(false);
  };

  let setActive = (index) => {
    if (active === index) return;
    let previous = active;
    active = index;
    lastArm = index;
    arms[index].setGrip(false);
    if (previous !== null) {
      // The retired arm telescopes back into the body on its own clock, so it
      // never trails behind the flying body.
      parked[previous] = false;
      arms[previous].setGrip(false);
      retiring.set(previous, { ...(clawShown || cursorPoint || armHome(previous)) });
    }
    parked[index] = true;
    clawShown = cursorPoint ? { ...cursorPoint } : null;
  };

  // The arm that takes the next event: arms alternate, and the body trails
  // the claw on the side that arm reaches from.
  let startEvent = (point, index) => {
    if (free.phase !== 'idle') releaseFree();
    // `via` names the callers, so a surprising event point can be traced back to its gesture.
    trace('start-event', {
      arm: index, x: point.x, y: point.y,
      via: String(new Error().stack || '').split('\n').slice(2, 6).map((line) => line.trim().replace(/^at\s+/, '').split(' (')[0]).join(' < '),
    });
    centroid = { ...point };
    hintPoint = null;
    pinned = false;
    // Start from where the body already is relative to the target (biased
    // slightly upward), so a new event never sends the body across it.
    let from = pos && Math.hypot(pos.x - point.x, pos.y - point.y) > 1
      ? { x: pos.x - point.x, y: pos.y - point.y }
      : (index === 0 ? { x: 0.9, y: -0.4 } : { x: -0.9, y: -0.4 });
    let length = Math.hypot(from.x, from.y);
    outward = { x: from.x / length, y: from.y / length - 0.25 };
    length = Math.hypot(outward.x, outward.y);
    outward = { x: outward.x / length, y: outward.y / length };
    perchSign = 1;
    if (cursorPoint) setActive(index);
    else active = index;
  };

  // The arm on the side facing the target takes the event: with the body to
  // the right of the target the left arm reaches, and vice versa; the arms
  // still alternate when the target is straight above or below.
  let armFor = (point) => {
    if (!pos) return 1 - lastArm;
    let dx = point.x - pos.x;
    if (Math.abs(dx) < BODY_RADIUS) return 1 - lastArm;
    return dx < 0 ? 0 : 1;
  };

  // Draw the active arm back into the body; the body keeps hovering.
  let retireActive = () => {
    if (active === null) return;
    let index = active;
    trace('retire-arm', { arm: index, selection: Boolean(selectionRect()) });
    parked[index] = false;
    arms[index].setGrip(false);
    retiring.set(index, { ...(clawShown || cursorPoint || armHome(index)) });
    active = null;
    cursorPoint = null;
    clawShown = null;
    hintPoint = null;
    gripClosed = false;
    ensureLoop();
  };

  let undock = (point) => {
    docked = false;
    pos = pos || { ...(restPoint() || point), vx: 0, vy: 0 };
    if (!goal) goal = { x: pos.x, y: pos.y };
  };

  let readSpeech = (time) => {
    if (time - speech.lastPollAt < SPEECH_POLL_MS) return;
    speech.lastPollAt = time;
    let nodes = [...doc.querySelectorAll('.chat-show-caption-word')];
    let activeIndex = nodes.findIndex((node) => node.hasAttribute('active'));
    // The caption highlight only moves on the player's coarse time updates and
    // trails the voice; the narration clock (same words, read now) does not.
    let clock = speechNow;
    if (clock && clock.playing && clock.advancing && clock.words && clock.words.length === nodes.length) {
      let at = clock.positionMs + MOUTH_LEAD_MS;
      let index = -1;
      for (let k = 0; k < clock.words.length && clock.words[k].startMs <= at; k++) index = k;
      if (index >= 0 && at <= clock.words[index].endMs + MOUTH_HOLD_MS) activeIndex = index;
    }
    if (activeIndex < 0) return;
    speech.lastActiveAt = time;
    let texts = nodes.map((node) => node.textContent || '');
    // Walk back to the sentence start, then cut it into short phrases and
    // take the one holding the active word.
    let sentence = activeIndex;
    while (sentence > 0 && !SENTENCE_END.test(texts[sentence - 1])) sentence -= 1;
    let start = sentence;
    let end = sentence;
    for (let index = sentence, count = 0, chars = 0, from = sentence; index < texts.length; index++) {
      count += 1;
      chars += texts[index].length + 1;
      let last = PHRASE_END.test(texts[index]) || count >= PHRASE_WORDS || chars >= PHRASE_CHARS
        || index === texts.length - 1;
      if (!last) continue;
      if (index >= activeIndex) {
        start = from;
        end = index;
        break;
      }
      from = index + 1;
      count = 0;
      chars = 0;
    }
    let key = `${start}:${end}:${texts.length}:${texts[start]}`;
    if (key !== speech.key) {
      speech.key = key;
      cloud.textContent = '';
      speech.spans = [];
      for (let index = start; index <= end; index++) {
        let span = doc.createElement('span');
        span.textContent = texts[index];
        span.style.cssText = 'display:inline-block;margin:0;transition:background-color .12s,color .12s;border-radius:.45em;padding:0 .16em';
        cloud.appendChild(span);
        speech.spans.push(span);
        cloud.appendChild(doc.createTextNode(' '));
      }
      speech.first = start;
      cloudState.width = 0;
      cloudState.measureAt = 2;
    }
    speech.active = activeIndex;
    let current = mouthState.word;
    if (!current || current.index !== activeIndex || current.text !== texts[activeIndex]) {
      // The pace of the speech: how long the previous word took per letter.
      if (current && current.letters.length >= 3) {
        let spent = time - current.since;
        if (spent > 80 && spent < 1600) {
          mouthState.msPerLetter += (clamp(spent / current.letters.length, 45, 150) - mouthState.msPerLetter) * 0.5;
        }
      }
      let letters = [...(texts[activeIndex] || '').toLowerCase()].filter((ch) => /\p{L}/u.test(ch));
      mouthState.word = { index: activeIndex, text: texts[activeIndex], since: time, letters };
      spawnBead(letters.length, time);
    }
    speech.spans.forEach((span, offset) => {
      let index = speech.first + offset;
      let current = index === activeIndex;
      span.style.opacity = '1';
      span.style.background = current ? 'var(--presenter-hose-accent, var(--sn-sys-accent, #ff6237))' : 'transparent';
      span.style.color = current ? '#fff' : 'inherit';
    });
  };

  // The cloud floats above the avatar (below it near the top edge), on the
  // side away from the working claw, and lags behind with a springy bob.
  // The mouth for this frame: the letter of the word being said (vowels last
  // longer), eased to its shape so one sound melts into the next.
  // Mask on while the narration plays, off after a short pause in playing (so the
  // gap between two scenes does not make it flicker); the eyes follow the accent.
  let updateMask = (time, dt, talking) => {
    let playing = speechNow ? Boolean(speechNow.playing) : talking;
    let wantOn = playing && !docked && scale > 0.5;
    if (wantOn) {
      maskState.offSince = 0;
      maskState.on = true;
    } else if (maskState.on) {
      if (!maskState.offSince) maskState.offSince = time;
      if (time - maskState.offSince >= MASK_OFF_DELAY_MS) maskState.on = false;
    }
    let state = maskState.on ? 'down' : 'up';
    if (mask.getAttribute('data-rig-mask') !== state) {
      mask.setAttribute('data-rig-mask', state);
      // Under the lowered mask the photo fades out, so the page shows through its translucent face.
      photo.style.transitionDelay = state === 'down' ? '.12s' : '0s';
      photo.style.opacity = state === 'down' ? '0' : '1';
      maskSvg.style.transition = media.matches ? 'none'
        : state === 'down' ? 'transform .38s cubic-bezier(.34,1.56,.64,1)' : 'transform .26s cubic-bezier(.5,0,.75,0)';
      maskSvg.style.transform = state === 'down' ? 'translateY(0)' : 'translateY(-110%)';
      // On the mask the mouth is a lit slot, without the cartoon lips.
      mouth.style.borderColor = state === 'down' ? '#e9e7e2' : 'var(--presenter-hose-outline, #fff)';
      mouth.style.background = state === 'down' ? '#0d0d10' : '#240a0c';
    }
    if (!maskState.on || media.matches) return;
    // Look at the accent: the claw at work, else the middle of what is marked.
    let from = { x: pos.x, y: pos.y };
    let at = cursorPoint && active !== null ? cursorPoint : null;
    if (!at) {
      let zone = focusZones(time)[0];
      if (zone) at = { x: (zone.left + zone.right) / 2, y: (zone.top + zone.bottom) / 2 };
    }
    let goalX = 0;
    let goalY = 0;
    if (at) {
      let dx = at.x - from.x;
      let dy = at.y - from.y;
      let dist = Math.hypot(dx, dy) || 1;
      let reach = Math.min(1, dist / 140);
      let travel = MASK_VARIANTS[maskKind].travel * unit;
      goalX = dx / dist * reach * travel;
      goalY = dy / dist * reach * travel * 0.7;
    }
    let follow = 1 - Math.exp(-dt / EYE_TAU_S);
    eyeState.x += (goalX - eyeState.x) * follow;
    eyeState.y += (goalY - eyeState.y) * follow;
    if (!eyeState.blinkAt) eyeState.blinkAt = time + 1800;
    if (time >= eyeState.blinkAt) {
      eyeState.blinkEnd = time + BLINK_MS;
      eyeState.blinkAt = time + BLINK_GAP_MS[0] + Math.random() * (BLINK_GAP_MS[1] - BLINK_GAP_MS[0]);
    }
    let squint = time < eyeState.blinkEnd ? 0.12 : 1;
    for (let eye of eyeNodes) eye.style.transform = `translate(${eyeState.x}px, ${eyeState.y}px) scaleY(${squint})`;
  };

  let lettersOf = (text) => [...String(text || '').toLowerCase()].filter((ch) => /\p{L}/u.test(ch));
  // The shape for the point `fraction` (0..1) of a word's letters, vowels weighing more.
  let shapeAt = (letters, fraction) => {
    let weights = letters.map((ch) => (MOUTH_VOWELS.test(ch) ? 1.6 : 0.8));
    let total = weights.reduce((sum, weight) => sum + weight, 0);
    let at = clamp(fraction, 0, 0.999) * total;
    let index = 0;
    while (index < weights.length - 1 && at >= weights[index]) { at -= weights[index]; index += 1; }
    return MOUTH_SHAPES.get(letters[index]) || MOUTH_DEFAULT;
  };
  // Beads of the spoken words: a ring buffer, each lives BEAD_LIFE_MS and runs round the orbit.
  const BEAD_LIFE_MS = 2600;
  const BEAD_SPEED = 1.5; // rad/s
  let beads = Array.from({ length: 12 }, () => {
    let el = doc.createElement('span');
    el.style.cssText = 'position:absolute;left:0;top:0;border-radius:50%;opacity:0;background:color-mix(in srgb, var(--presenter-hose-ink, #22251f) 55%, transparent);will-change:transform';
    orbit.appendChild(el);
    return { el, born: -1, angle: 0, size: 0 };
  });
  let beadNext = 0;
  let spawnBead = (letters, time) => {
    let bead = beads[beadNext];
    beadNext = (beadNext + 1) % beads.length;
    // Longer words, bigger beads; they all start at the bottom and run round.
    bead.born = time;
    bead.angle = Math.PI / 2;
    bead.size = Math.min(9, 2 + letters * 0.9);
  };
  let updateBeads = (time, dt) => {
    orbit.style.opacity = maskState.on && scale > 0.5 ? '1' : '0';
    let center = 27 * unit;
    let radius = 19.5 * unit;
    for (let bead of beads) {
      if (bead.born < 0) continue;
      let age = time - bead.born;
      if (age > BEAD_LIFE_MS) { bead.born = -1; bead.el.style.opacity = '0'; continue; }
      bead.angle += BEAD_SPEED * dt * (media.matches ? 0 : 1);
      let life = age / BEAD_LIFE_MS;
      let fade = life < 0.12 ? life / 0.12 : Math.min(1, (1 - life) / 0.4);
      let size = bead.size * unit * (0.7 + 0.3 * fade);
      bead.el.style.width = `${size}px`;
      bead.el.style.height = `${size}px`;
      bead.el.style.opacity = String(Math.max(0, fade));
      bead.el.style.transform = `translate(${center + Math.cos(bead.angle) * radius - size / 2}px, ${center + Math.sin(bead.angle) * radius - size / 2}px)`;
    }
  };
  let updateMouth = (time, dt, talking) => {
    if (media.matches) {
      mouth.style.opacity = '0';
      return;
    }
    let target = MOUTH_REST;
    let speaking = talking;
    let clock = speechNow;
    if (clock && clock.words && clock.words.length) {
      // The narration clock gives the word and the point inside it every frame.
      let words = clock.words;
      let position = clock.positionMs + MOUTH_LEAD_MS;
      speaking = Boolean(clock.playing && clock.advancing);
      let index = clamp(mouthState.clockIndex, 0, words.length - 1);
      while (index > 0 && words[index].startMs > position) index -= 1;
      while (index < words.length - 1 && words[index + 1].startMs <= position) index += 1;
      mouthState.clockIndex = index;
      let word = words[index];
      let next = words[index + 1];
      let letters = lettersOf(word.text);
      let held = next ? Math.min(MOUTH_HOLD_MS, Math.max(0, next.startMs - word.endMs)) : 0;
      if (speaking && letters.length && position >= word.startMs && position <= word.endMs + held) {
        let span = Math.max(60, word.endMs - word.startMs);
        target = shapeAt(letters, (position - word.startMs) / span);
      }
    } else if (talking && mouthState.word && mouthState.word.letters.length
      && time - speech.lastActiveAt < SPEECH_POLL_MS * 2.2) {
      // No narration clock: estimate from the highlighted word and the pace so far.
      let word = mouthState.word;
      target = shapeAt(word.letters, (time - word.since) / (mouthState.msPerLetter * word.letters.length));
    }
    let ease = 1 - Math.exp(-dt / MOUTH_TAU_S);
    mouthState.w += (target[0] - mouthState.w) * ease;
    mouthState.h += (target[1] - mouthState.h) * ease;
    mouthState.opacity += ((speaking ? 1 : 0) - mouthState.opacity) * (1 - Math.exp(-dt / 0.12));
    let maxW = BODY_RADIUS * 0.72;
    let maxH = BODY_RADIUS * 0.56;
    mouth.style.opacity = String(mouthState.opacity < 0.02 ? 0 : mouthState.opacity);
    mouth.style.width = `${Math.max(3, mouthState.w * maxW)}px`;
    mouth.style.height = `${Math.max(2.5, mouthState.h * maxH)}px`;
    // The cartoon tongue belongs to the human face; a robot's mouth is just a lit slot.
    tongue.style.opacity = maskState.on ? '0' : String(Math.min(1, Math.max(0, (mouthState.h - 0.3) * 2.2)));
  };

  // What the presenter is marking right now (the selection frame and the ink
  // stroke): the speech cloud must not cover it. Cached for a few frames.
  let focusCache = { at: -1e9, zones: [] };
  let focusZones = (time) => {
    if (time - focusCache.at < 100) return focusCache.zones;
    let zones = [];
    let frame = selectionRect();
    if (frame) zones.push({ left: frame.left, top: frame.top, right: frame.right, bottom: frame.bottom });
    for (let path of overlay.querySelectorAll('.pc-ink path')) {
      if (!path.getAttribute('d')) continue;
      let box = path.getBoundingClientRect();
      if (box.width > 4 || box.height > 4) zones.push({ left: box.left, top: box.top, right: box.right, bottom: box.bottom });
    }
    focusCache = { at: time, zones };
    return zones;
  };
  let overlapArea = (x, y, width, height, zone, margin) => {
    let w = Math.min(x + width / 2 + margin, zone.right) - Math.max(x - width / 2 - margin, zone.left);
    let h = Math.min(y + height / 2 + margin, zone.bottom) - Math.max(y - height / 2 - margin, zone.top);
    return w > 0 && h > 0 ? w * h : 0;
  };

  let placeCloud = (time, dt, shown, anchor) => {
    let goalScale = shown ? 1 : 0;
    cloudState.scale = media.matches ? goalScale
      : cloudState.scale + (goalScale - cloudState.scale) * (1 - Math.exp(-dt / (shown ? 0.09 : 0.14)));
    if (Math.abs(goalScale - cloudState.scale) < 0.01) cloudState.scale = goalScale;
    if (cloudState.scale <= 0) {
      cloud.style.opacity = '0';
      puffs.forEach((puff) => { puff.style.opacity = '0'; });
      return;
    }
    if (!cloudState.width || cloudState.measureAt > 0) {
      cloudState.width = cloud.offsetWidth || 140;
      cloudState.height = cloud.offsetHeight || 34;
      cloudState.measureAt = Math.max(0, (cloudState.measureAt || 0) - 1);
    }
    let view = viewport();
    let width = cloudState.width;
    let height = cloudState.height;
    let sideAway = cursorPoint ? (anchor.x >= cursorPoint.x ? 1 : -1) : 1;
    let wantBelow = cloudState.below
      ? anchor.y - BODY_RADIUS - height - 36 * unit < 8 + height
      : anchor.y - BODY_RADIUS - height - 36 * unit < 8;
    cloudState.below = wantBelow;
    let fitX = (x) => clamp(x, width / 2 + 8, view.width - width / 2 - 8);
    let fitY = (y) => clamp(y, height / 2 + 8, view.height - height / 2 - 8);
    let above = anchor.y - BODY_RADIUS - 22 * unit - height / 2;
    let below = anchor.y + BODY_RADIUS + 22 * unit + height / 2;
    let near = BODY_RADIUS + 22 * unit + width / 2;
    let preferredY = wantBelow ? below : above;
    let otherY = wantBelow ? above : below;
    // The preferred spot first, then the other places round the body: the cloud
    // takes the first one that leaves the marked area uncovered.
    let candidates = [
      { x: anchor.x + sideAway * width * 0.28, y: preferredY },
      { x: anchor.x - sideAway * width * 0.28, y: preferredY },
      { x: anchor.x + sideAway * near, y: anchor.y - height * 0.2 },
      { x: anchor.x - sideAway * near, y: anchor.y - height * 0.2 },
      { x: anchor.x + sideAway * width * 0.28, y: otherY },
      { x: anchor.x - sideAway * width * 0.28, y: otherY },
    ].map((c) => ({ x: fitX(c.x), y: fitY(c.y) }));
    let zones = focusZones(time);
    let covered = (c) => zones.reduce((sum, zone) => sum + overlapArea(c.x, c.y, width, height, zone, 8), 0);
    let chosen = candidates[0];
    if (zones.length) {
      // Keep the spot already in use while it stays clear, so the cloud does not hop.
      let kept = candidates[cloudState.slot ?? 0];
      if (kept && covered(kept) === 0) chosen = kept;
      else {
        let best = null;
        candidates.forEach((c, index) => {
          let area = covered(c);
          if (!best || area < best.area - 1) best = { c, index, area };
        });
        chosen = best.c;
        cloudState.slot = best.index;
      }
    } else cloudState.slot = 0;
    let targetX = chosen.x;
    let targetY = chosen.y;
    if (!cloudState.ready || media.matches) {
      cloudState.x = targetX;
      cloudState.y = targetY;
      cloudState.ready = true;
    } else {
      let follow = 1 - Math.exp(-dt / 0.22);
      cloudState.x += (targetX - cloudState.x) * follow;
      cloudState.y += (targetY - cloudState.y) * follow;
    }
    let wobble = media.matches ? 0 : Math.sin(time / 480) * 2.2;
    let squash = media.matches ? 0 : Math.sin(time / 700) * 0.012;
    // Cartoon pop: the cloud overshoots its size while it grows in.
    let overshoot = cloudState.scale + Math.sin(cloudState.scale * Math.PI) * 0.14;
    cloud.style.opacity = String(Math.min(1, cloudState.scale * 1.4));
    cloud.style.transform = `translate(${cloudState.x - width / 2}px, ${cloudState.y - height / 2 + wobble}px) scale(${overshoot * (1 + squash)}, ${overshoot * (1 - squash)})`;
    // Thought-bubble puffs trail from the avatar up to the cloud.
    let toward = Math.hypot(cloudState.x - anchor.x, cloudState.y - anchor.y) || 1;
    let from = {
      x: anchor.x + (cloudState.x - anchor.x) / toward * (BODY_RADIUS + 6),
      y: anchor.y + (cloudState.y - anchor.y) / toward * (BODY_RADIUS + 6),
    };
    let faceX = anchor.x - cloudState.x;
    let faceY = anchor.y - cloudState.y;
    let faceScale = Math.min((width / 2) / (Math.abs(faceX) || 1e-6), (height / 2) / (Math.abs(faceY) || 1e-6), 1);
    let to = { x: cloudState.x + faceX * faceScale, y: cloudState.y + faceY * faceScale };
    puffs.forEach((puff, index) => {
      let t = 0.2 + index * 0.27;
      puff.style.opacity = String(Math.min(1, cloudState.scale * 1.4));
      puff.style.transform = `translate(${from.x + (to.x - from.x) * t}px, ${from.y + (to.y - from.y) * t + wobble * t}px) scale(${cloudState.scale})`;
    });
  };

  let step = (time) => {
    frame = 0;
    if (disposed || !pos) return;
    let dt = Math.min(Math.max((time - last) / 1000, 0.001), 0.032);
    last = time;
    let moving = false;
    let overFrame = false;
    if (cursorPoint && active !== null) {
      clawSpeed = clawPrev ? Math.hypot(cursorPoint.x - clawPrev.x, cursorPoint.y - clawPrev.y) / dt : 0;
      clawPrev = { ...cursorPoint };
    } else {
      clawPrev = null;
      clawSpeed = 0;
    }
    let reachGoal = gripClosed && active !== null ? HOLD_REACH : REACH;
    reachNow = media.matches ? reachGoal : reachNow + (reachGoal - reachNow) * (1 - Math.exp(-dt / REACH_TAU_S));
    if (goal) {
      if (cursorPoint && active !== null && !docked && !drag && !pinned) {
        let look = hintPoint || cursorPoint;
        if (hintPoint && Math.hypot(cursorPoint.x - hintPoint.x, cursorPoint.y - hintPoint.y) < 60) hintPoint = null;
        if (!clawSlow) clawSlow = { ...look };
        let ease = media.matches ? 1 : 1 - Math.exp(-dt / LOOK_TAU_S);
        clawSlow.x += (look.x - clawSlow.x) * ease;
        clawSlow.y += (look.y - clawSlow.y) * ease;
        aim = plan
          ? routeBodyAround(pos, planPerch(clawSlow), planFrame(), {
            gap: BODY_RADIUS + 14, view: viewport(), low: BODY_RADIUS + EDGE_MARGIN,
          })
          : fit(clawSlow);
        if (plan) {
          plan.perch = { x: aim.x, y: aim.y };
          // The perch slid far (a wide selection, a new side): grab again.
          if (free.phase === 'idle' && time - lastGrabAt > REGRAB_COOLDOWN_MS
            && Math.hypot(aim.x - pos.x, aim.y - pos.y) > REGRAB_PX) startFreeArm();
        }
      }
      if (aim && !drag && !pinned && !media.matches) {
        let ease = 1 - Math.exp(-dt / AIM_TAU_S);
        goal.x += (aim.x - goal.x) * ease;
        goal.y += (aim.y - goal.y) * ease;
      } else if (aim && !drag && !pinned) Object.assign(goal, aim);
      if (media.matches) {
        Object.assign(pos, goal, { vx: 0, vy: 0 });
      } else {
        // A body sitting over the selection frame always hurries out of it.
        let frameRect = active !== null && !drag ? selectionRect() : null;
        overFrame = Boolean(frameRect && pos.x > frameRect.left - BODY_RADIUS && pos.x < frameRect.right + BODY_RADIUS
          && pos.y > frameRect.top - BODY_RADIUS && pos.y < frameRect.bottom + BODY_RADIUS);
        let landed = overFrame ? true : free.phase === 'throw' ? false : (free.phase === 'push' || drag || pinned) ? true : gripClosed || !cursorPoint || active === null || clawSpeed < LANDED_SPEED_PX_S;
        reel += ((landed ? 1 : (plan ? PLANNED_WAIT_PULL : WAIT_PULL)) - reel) * (1 - Math.exp(-dt / (landed ? 0.35 : 0.12)));
        for (let axis of ['x', 'y']) {
          let velocity = axis === 'x' ? 'vx' : 'vy';
          let spring = drag ? DRAG_SPRING : SPRING;
          pos[velocity] += ((goal[axis] - pos[axis]) * spring.stiffness * (drag ? 1 : reel) - pos[velocity] * spring.damping) * dt;
          pos[axis] += pos[velocity] * dt;
        }
      }
      // The web has no length limit: the claw lands anywhere and the body is
      // reeled in afterwards. Only an absurd distance is held back.
      if (cursorPoint && active !== null && !docked) {
        let dx = pos.x - cursorPoint.x;
        let dy = pos.y - cursorPoint.y;
        let distance = Math.hypot(dx, dy);
        if (distance > MAX_WEB_PX) {
          pos.x = cursorPoint.x + dx / distance * MAX_WEB_PX;
          pos.y = cursorPoint.y + dy / distance * MAX_WEB_PX;
        }
      }
      if (!media.matches) {
        // Cap the flight speed so a far jump stays a glide, not a dash.
        let cap = drag ? DRAG_MAX_SPEED : MAX_SPEED * ((free.phase === 'push' || overFrame) ? PUSH_SPEED_BOOST : 1);
        let speed = Math.hypot(pos.vx, pos.vy);
        if (speed > cap) {
          pos.vx *= cap / speed;
          pos.vy *= cap / speed;
        }
      }
      moving = (aim && Math.hypot(aim.x - goal.x, aim.y - goal.y) > 0.4) || Math.hypot(goal.x - pos.x, goal.y - pos.y) > 0.4 || Math.hypot(pos.vx, pos.vy) > 4;
    }
    let scaleGoal = docked ? 0 : 1;
    scale = media.matches ? scaleGoal : scale + (scaleGoal - scale) * (1 - Math.exp(-dt * 12));
    if (Math.abs(scaleGoal - scale) < 0.01) scale = scaleGoal;
    // Roll: driven by the body's acceleration (inertia swings it against the
    // motion) and by the pull of the working arm, with its own spring and a
    // hard limit, so every move leans into and rocks out of its direction.
    if (media.matches) roll = { angle: 0, velocity: 0 };
    else {
      let ax = (pos.vx - prevVelocity.x) / dt;
      let pullSide = cursorPoint && active !== null ? clamp((cursorPoint.x - pos.x) / REACH, -1.5, 1.5) * 4 : 0;
      let drive = clamp(-ax * 0.018, -22, 22) + clamp(pos.vx * 0.02, -8, 8) + pullSide;
      roll.velocity += ((drive - roll.angle) * ROLL_SPRING.stiffness - roll.velocity * ROLL_SPRING.damping) * dt;
      roll.angle = clamp(roll.angle + roll.velocity * dt, -ROLL_LIMIT_DEG, ROLL_LIMIT_DEG);
      if (Math.abs(roll.angle) >= ROLL_LIMIT_DEG) roll.velocity *= 0.5;
    }
    prevVelocity = { x: pos.vx, y: pos.vy };
    let tilt = roll.angle;
    // Idle hover: a slow bob keeps the hovering body alive between gestures.
    let bob = media.matches || docked ? 0 : Math.sin(time / 900) * 4 + Math.sin(time / 1700) * 3;
    let drift = media.matches || docked ? 0 : Math.cos(time / 1250) * 3.5;
    hover = { x: drift, y: bob };
    // Gaze: shift the portrait toward what the arm is reaching for.
    if (cursorPoint && !docked) {
      let dx = cursorPoint.x - pos.x;
      let dy = cursorPoint.y - pos.y;
      let length = Math.max(1, Math.hypot(dx, dy));
      photo.style.backgroundPosition =`${50 + dx / length * 9}% ${50 + dy / length * 9}%`;
    }
    body.style.opacity = String(Math.min(1, scale * 1.6));
    body.style.pointerEvents = scale > 0.6 ? 'auto' : 'none';
    body.dataset.rigFree = free.phase;
    if (onTrace) {
      if (free.phase !== lastTracePhase) {
        trace('free-arm', { from: lastTracePhase, to: free.phase, arm: free.index });
        lastTracePhase = free.phase;
      }
      if (time - lastTraceAt >= TRACE_SAMPLE_MS) {
        lastTraceAt = time;
        let claw = cursorPoint;
        let sample = {
          x: pos.x, y: pos.y, active, free: free.phase, side: plan ? plan.side : '',
          claw: claw ? { x: claw.x, y: claw.y } : null,
          clawDist: claw ? Math.hypot(claw.x - pos.x, claw.y - pos.y) : null,
          grip: gripClosed, selection: Boolean(selectionRect()), docked, drag: Boolean(drag),
          cloud: cloudState.scale > 0.5
            ? { x: cloudState.x, y: cloudState.y, w: cloudState.width, h: cloudState.height }
            : null,
        };
        // A resting rig adds nothing to the log: sample only when it moved or
        // one of its discrete states changed.
        let moved = !lastTraceSample
          || Math.hypot(sample.x - lastTraceSample.x, sample.y - lastTraceSample.y) > 2
          || (sample.clawDist !== null && Math.abs(sample.clawDist - (lastTraceSample.clawDist ?? -999)) > 2)
          || ['active', 'free', 'side', 'grip', 'selection', 'docked', 'drag']
            .some((key) => sample[key] !== lastTraceSample[key])
          || Boolean(sample.cloud) !== Boolean(lastTraceSample.cloud)
          || (sample.cloud && lastTraceSample.cloud
            && Math.hypot(sample.cloud.x - lastTraceSample.cloud.x, sample.cloud.y - lastTraceSample.cloud.y) > 4);
        if (moved) {
          lastTraceSample = sample;
          trace('state', sample);
        }
      }
    }
    body.dataset.rigSide = plan ? plan.side : '';
    body.style.transform = `translate(${pos.x + drift}px, ${pos.y + bob}px) rotate(${tilt + (docked || media.matches ? 0 : Math.sin(time / 1100) * 3)}deg) scale(${Math.max(0.02, scale)})`;
    // Subtitles: the cloud speaks the words currently being said.
    let clockRaw = typeof speechClock === 'function' ? speechClock() : null;
    if (clockRaw) {
      if (clockRaw.positionMs !== clockWatch.pos) {
        clockWatch.pos = clockRaw.positionMs;
        clockWatch.movedAt = time;
      }
      speechNow = { ...clockRaw, advancing: time - clockWatch.movedAt < CLOCK_STALL_MS };
    } else speechNow = null;
    readSpeech(time);
    let talking = scale > 0 && time - speech.lastActiveAt < SPEECH_HOLD_MS;
    updateMask(time, dt, talking);
    updateMouth(time, dt, talking);
    updateBeads(time, dt);
    placeCloud(time, dt, talking && subtitlesOn && !(typeof isPaused === 'function' && isPaused()), { x: pos.x + drift, y: pos.y + bob });
    // An action that ended without a planned return still draws the arm in.
    // (Never while a selection frame is still on screen: the claw that made
    // it stays on it until the show clears the frame.)
    if (retireDueAt && now() >= retireDueAt) {
      retireDueAt = 0;
      retireActive();
    }
    if (active !== null && !gripClosed && time - lastMoveAt > IDLE_RETRACT_MS && !selectionRect()) retireActive();
    // The claw is always exactly on the cursor: timing of every action is the
    // show's; only the body is smoothed.
    if (scale > 0 && active !== null && cursorPoint && !retiring.has(active)) {
      clawShown = { ...cursorPoint };
      arms[active].move(clawShown.x, clawShown.y);
    }
    // Free arm: grab the canvas beside the body, push off it, let go.
    if (free.phase !== 'idle') {
      if (free.phase === 'throw') {
        let follow = media.matches ? 1 : 1 - Math.exp(-dt / THROW_TAU_S);
        free.claw.x += (free.anchor.x - free.claw.x) * follow;
        free.claw.y += (free.anchor.y - free.claw.y) * follow;
        if (Math.hypot(free.anchor.x - free.claw.x, free.anchor.y - free.claw.y) < 6) {
          free.claw = { ...free.anchor };
          free.phase = 'push';
          free.pushAt = time;
          arms[free.index].setGrip(true);
        }
      } else {
        let age = (time - free.pushAt) / 1000;
        let stretched = Math.hypot(pos.x - free.anchor.x, pos.y - free.anchor.y) > PUSH_RELEASE_PX;
        if (age > PUSH_TIME_S || stretched || drag) releaseFree();
        else if (!media.matches) {
          // The shove: strongest at the grip, fading as the arm extends.
          let push = PUSH_ACCEL * (1 - age / PUSH_TIME_S) * dt;
          pos.vx += free.dir.x * push;
          pos.vy += free.dir.y * push;
        }
      }
    }
    if (scale > 0) {
      arms.forEach((arm, index) => {
        if (free.phase !== 'idle' && index === free.index) {
          arm.setWave(3);
          arm.setHang(false);
          arm.move(free.claw.x, free.claw.y);
          return;
        }
        arm.setWave(index === active && !retiring.has(index) ? 4 : 9);
        arm.setHang(index !== active && !retiring.has(index) && parked[index]);
        let claw = retiring.get(index);
        if (claw) {
          let home = armHome(index);
          let follow = media.matches ? 1 : 1 - Math.exp(-dt / RETRACT_TAU_S);
          claw.x += (home.x - claw.x) * follow;
          claw.y += (home.y - claw.y) * follow;
          if (Math.hypot(home.x - claw.x, home.y - claw.y) < 2) {
            retiring.delete(index);
            parked[index] = true;
          }
          arm.move(claw.x, claw.y);
        } else if (index !== active && parked[index]) arm.move(armHome(index).x, armHome(index).y);
        else arm.refresh();
      });
    }
    if (docked && scale === 0) arms.forEach((arm) => { arm.setWave(0); arm.hide(); });
    if (moving || free.phase !== 'idle' || retiring.size || active !== null || scale !== scaleGoal || (!docked && !media.matches)) frame = win.requestAnimationFrame(step);
  };
  let ensureLoop = () => {
    if (frame || disposed || !pos) return;
    last = now();
    frame = win.requestAnimationFrame(step);
  };

  // The robot can be grabbed and dragged; it stays where it is dropped until
  // the show sends it to the next event.
  body.style.cursor = 'grab';
  body.style.touchAction = 'none';
  body.style.userSelect = 'none';
  let dragTarget = (event) => ({
    x: clamp(event.clientX + drag.dx, BODY_RADIUS + EDGE_MARGIN, viewport().width - BODY_RADIUS - EDGE_MARGIN),
    y: clamp(event.clientY + drag.dy, BODY_RADIUS + EDGE_MARGIN, viewport().height - BODY_RADIUS - EDGE_MARGIN),
  });
  body.addEventListener('pointerdown', (event) => {
    if (disposed || docked || !pos || (event.button || 0) !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    try { body.setPointerCapture?.(event.pointerId); } catch { /* synthetic or already-ended pointer */ }
    drag = { id: event.pointerId, dx: pos.x - event.clientX, dy: pos.y - event.clientY, vx: 0, vy: 0, at: now(), x: event.clientX, y: event.clientY };
    goal = goal || { x: pos.x, y: pos.y };
    goal.x = pos.x;
    goal.y = pos.y;
    body.style.cursor = 'grabbing';
    ensureLoop();
  });
  body.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    event.stopPropagation();
    let target = dragTarget(event);
    goal.x = target.x;
    goal.y = target.y;
    let t = now();
    let elapsed = Math.max(1, t - drag.at) / 1000;
    drag.vx += ((event.clientX - drag.x) / elapsed - drag.vx) * 0.4;
    drag.vy += ((event.clientY - drag.y) / elapsed - drag.vy) * 0.4;
    drag.at = t;
    drag.x = event.clientX;
    drag.y = event.clientY;
    ensureLoop();
  });
  let endDrag = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    event.stopPropagation();
    // A flick keeps gliding a little, like something floating in water; a
    // pointer that rested before release carries no flick.
    if (now() - drag.at > 90) { drag.vx = 0; drag.vy = 0; }
    pos.vx += clamp(drag.vx * 0.35, -500, 500);
    pos.vy += clamp(drag.vy * 0.35, -500, 500);
    goal.x = clamp(goal.x + clamp(drag.vx * 0.12, -160, 160), BODY_RADIUS + EDGE_MARGIN, viewport().width - BODY_RADIUS - EDGE_MARGIN);
    goal.y = clamp(goal.y + clamp(drag.vy * 0.12, -160, 160), BODY_RADIUS + EDGE_MARGIN, viewport().height - BODY_RADIUS - EDGE_MARGIN);
    try { body.releasePointerCapture?.(drag.id); } catch { /* already released */ }
    drag = null;
    pinned = true;
    body.style.cursor = 'grab';
    ensureLoop();
  };
  body.addEventListener('pointerup', endDrag);
  body.addEventListener('pointercancel', endDrag);
  body.addEventListener('click', (event) => event.stopPropagation());

  return {
    getPosition() { return active === null ? null : arms[active].getPosition(); },
    getRestPoint() { return restPoint(); },
    // The cursor announces where the next gesture is headed so the body can
    // fly there while the arm is still extending.
    setTarget(point, rect) {
      if (!point || disposed || gripClosed) return;
      undock(point);
      // A new event far from the current area passes to the other arm; the
      // frames of one illustration stay with the same arm and perch.
      if (active === null || !centroid
        || Math.hypot(point.x - centroid.x, point.y - centroid.y) > EVENT_DISTANCE_PX) {
        plan = choosePlan(point, rect);
        startEvent(point, plan.workArm);
        startFreeArm();
        // The body starts easing toward the hinted perch while the claw is
        // still on its way.
        hintPoint = { ...point };
        ensureLoop();
      }
    },
    // The body keeps flying while the claw works: it trails the cursor and
    // slides around the area's perimeter, always on the outer side.
    move(x, y) {
      if (disposed) return;
      retireDueAt = 0;
      let first = docked || active === null;
      cursorPoint = { x, y };
      lastMoveAt = now();
      if (first) {
        undock({ x, y });
        plan = choosePlan({ x, y }, null);
        startEvent({ x, y }, plan.workArm);
        startFreeArm();
        clawShown = { ...cursorPoint };
      } else {
        centroid.x += (x - centroid.x) * 0.02;
        centroid.y += (y - centroid.y) * 0.02;
        let dx = x - centroid.x;
        let dy = y - centroid.y;
        let length = Math.hypot(dx, dy);
        if (length > 25) {
          outward = {
            x: outward.x + (dx / length - outward.x) * 0.05,
            y: outward.y + (dy / length - outward.y) * 0.05,
          };
          let norm = Math.hypot(outward.x, outward.y) || 1;
          outward = { x: outward.x / norm, y: outward.y / norm };
        }
      }
      if (!goal) goal = { ...fit({ x, y }) };
      ensureLoop();
    },
    presentClick(x, y, elapsedMs) { if (active !== null) arms[active].presentClick(x, y, elapsedMs); },
    click(x, y) { if (active !== null) arms[active].click(x, y); },
    setGrip(closed) {
      let grabbed = closed === true && !gripClosed;
      gripClosed = closed === true;
      if (active !== null) arms[active].setGrip(gripClosed);
      // Spider-style: the moment the claw grips, the body is reeled in along
      // the arm and swings past the line like a pendulum before settling.
      if (grabbed && active !== null && cursorPoint && pos && !media.matches) {
        let dx = cursorPoint.x - pos.x;
        let dy = cursorPoint.y - pos.y;
        let length = Math.hypot(dx, dy);
        if (length > HOLD_REACH) {
          let side = active === 0 ? 1 : -1;
          pos.vx += dx / length * 130 + (-dy / length) * 55 * side;
          pos.vy += dy / length * 130 + (dx / length) * 55 * side;
          ensureLoop();
        }
      }
    },
    // End of a gesture: the active arm retracts to the body, which keeps
    // hovering for the next event.
    setMask(name) { return setMask(name); },
    getMask() { return maskKind; },
    // True while no arm is out: a cursor that is only held in place must not throw one.
    isIdle() { return active === null; },
    // The presenter is on stage as soon as the show opens: it floats at its rest point with its
    // arms in, instead of appearing only with the first gesture.
    present() {
      let rest = restPoint();
      if (disposed || !docked || !rest) return;
      undock(rest);
      ensureLoop();
    },
    setSubtitles(on) { subtitlesOn = on !== false; },
    getSubtitles() { return subtitlesOn; },
    planHomeReturn(from) {
      if (active === null || !pos) return Object.freeze({ durationMs: 0, destination: null });
      let plan = arms[active].planHomeReturn(from);
      return Object.freeze({ durationMs: plan.durationMs, destination: plan.destination });
    },
    // Pause or end of a gesture: the arm retracts but the body stays in the
    // air for as long as the tour is on; only dispose() removes it.
    returnHome() {
      if (active !== null) {
        retireDueAt = now() + RETIRE_GRACE_MS;
        ensureLoop();
      }
      return Promise.resolve(Object.freeze({ status: 'home' }));
    },
    whenHome() { return active === null ? Promise.resolve(Object.freeze({ status: 'home' })) : arms[active].whenHome(); },
    hide() {
      arms.forEach((arm) => { arm.setWave(0); arm.hide(); });
      body.style.opacity = '0';
      cloud.style.opacity = '0';
      puffs.forEach((puff) => { puff.style.opacity = '0'; });
      free.phase = 'idle';
      plan = null;
      retireDueAt = 0;
      docked = true; active = null; cursorPoint = null; scale = 0;
    },
    dispose() {
      disposed = true;
      win.cancelAnimationFrame(frame);
      arms.forEach((arm) => arm.dispose());
      captionStyle.remove();
      cloud.remove();
      puffs.forEach((puff) => puff.remove());
      body.remove();
    },
  };
}
