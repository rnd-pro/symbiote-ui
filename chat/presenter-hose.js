let nextId = 0;
const SVG_NS = 'http://www.w3.org/2000/svg';

const cubicPoint = ([p0, p1, p2, p3], t) => {
  let u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
};
const segmentsPath = (segments) => `M${segments[0][0].x} ${segments[0][0].y}${segments.map(([, c1, c2, end]) => ` C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`).join('')}`;
const sampleSegments = (segments, count) => Array.from({ length: count + 1 }, (_, index) => {
  let along = index / count * segments.length;
  let segment = Math.min(segments.length - 1, Math.floor(along));
  return cubicPoint(segments[segment], along - segment);
});
// Between the straight and the hanging pose the arm morphs point by point, so
// the default pose is reached by a continuous motion, never a snap.
const blendedPath = (from, to, weight, count = 36) => {
  let a = sampleSegments(from, count);
  let b = sampleSegments(to, count);
  return a.map((point, index) => `${index ? 'L' : 'M'}${point.x + (b[index].x - point.x) * weight} ${point.y + (b[index].y - point.y) * weight}`).join(' ');
};

export function resolvePresenterHoseGeometry({ anchor, cursor, angle = 0, midpoints, reducedMotion = false, mirror = 1, sagScale = 1, hang = 0, sway = null }) {
  let radians = Number(angle) || 0;
  let cos = Math.cos(radians);
  let sin = Math.sin(radians);
  // Keep the cursor hotspot at the actual SVG arrow tip (0,0). The hose meets
  // the drawn tail at (7.4,19.8), the same point used by the arrow outline.
  let attachment = { x: 7.4, y: 19.8 };
  let tail = {
    x: cursor.x + mirror * (attachment.x * cos - attachment.y * sin),
    y: cursor.y + attachment.x * sin + attachment.y * cos,
  };
  let dx = tail.x - anchor.x;
  let dy = tail.y - anchor.y;
  let distance = Math.hypot(dx, dy);
  let tangent = { x: dx / Math.max(1, distance), y: dy / Math.max(1, distance) };
  let reach = Math.min(70, distance * 0.18);
  let sag = reducedMotion ? 0 : Math.min(45, distance * 0.08) * sagScale;
  let baseBend = midpoints?.base || {
    x: anchor.x + dx * 0.34,
    y: anchor.y + dy * 0.34 + sag * 0.18,
  };
  let tipBend = midpoints?.tip || {
    x: anchor.x + dx * 0.68,
    y: anchor.y + dy * 0.68 + sag * 0.82,
  };
  if (sway) {
    // Water drift: the bends swing sideways, the tip more than the base.
    baseBend = { x: baseBend.x - tangent.y * sway.base, y: baseBend.y + tangent.x * sway.base };
    tipBend = { x: tipBend.x - tangent.y * sway.tip, y: tipBend.y + tangent.x * sway.tip };
  }
  let baseReach = Math.min(reach, distance * 0.12);
  let centerReach = Math.min(reach, distance * 0.16);
  let tipReach = Math.min(reach, distance * 0.12);
  let anchorControl = { x: anchor.x + tangent.x * baseReach, y: anchor.y + tangent.y * baseReach };
  let tailControl = {
    x: tail.x - tangent.x * tipReach,
    y: tail.y - tangent.y * tipReach,
  };
  let at = (point, k) => ({ x: point.x + tangent.x * k, y: point.y + tangent.y * k });
  let straightSegments = [
    [anchor, anchorControl, at(baseBend, -baseReach), baseBend],
    [baseBend, at(baseBend, centerReach), at(tipBend, -centerReach), tipBend],
    [tipBend, at(tipBend, tipReach), tailControl, tail],
  ];
  // A hanging arm leaves its connector level and bends progressively more
  // toward the claw, like a cable stiff at the base and limp at the end.
  let hangSegments = [[
    anchor,
    { x: anchor.x - mirror * Math.abs(dx) * 0.85, y: anchor.y + (sway?.base || 0) },
    { x: tail.x + (sway?.tip || 0), y: tail.y - Math.abs(dy) * 0.4 },
    tail,
  ]];
  let weight = Math.max(0, Math.min(1, Number(hang) || 0));
  return {
    tail,
    center: cursor,
    distance,
    baseBend,
    tipBend,
    anchorControl,
    tailControl,
    hosePath: weight <= 0 ? segmentsPath(straightSegments)
      : weight >= 1 ? segmentsPath(hangSegments)
        : blendedPath(straightSegments, hangSegments, weight),
    portPath: `M${anchor.x} ${anchor.y - 4} V${anchor.y + 4}`,
  };
}

// Robot claw: two angular fingers (a simple chevron each) meet at the cursor
// hotspot (0,0) and are hinged at the hose attachment point. `closure` 0 is
// fully open, 1 is closed on the hotspot.
const CLAW_WRIST = { x: 7.4, y: 19.8 };
const CLAW_FINGER_WIDTH = 3.6;
const CLAW_HINGE_RADIUS = 5;

export function resolvePresenterClawPaths(closure = 0) {
  let c = Math.max(0, Math.min(1, Number(closure) || 0));
  let open = 1 - c;
  let length = Math.hypot(CLAW_WRIST.x, CLAW_WRIST.y);
  let ux = -CLAW_WRIST.x / length;
  let uy = -CLAW_WRIST.y / length;
  let nx = -uy;
  let ny = ux;
  let at = (along, side) => {
    let x = CLAW_WRIST.x + ux * along + nx * side;
    let y = CLAW_WRIST.y + uy * along + ny * side;
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  };
  return [1, -1].map((side) => (
    `M${at(0, side * 2.4)} L${at(length * 0.46, side * (4.4 + 5.4 * open))} L${at(length, side * (0.9 + 5.8 * open))}`
  ));
}

// `side` picks which edge of the anchor the hose leaves from: a flying body
// carries one hose on each side.
export default function createPresenterHose(overlay, resolveAnchor, { side = 'left', rigid = false, before = null } = {}) {
  let outward = side === 'right' ? 1 : -1;
  // The claw is drawn for a hose leaving the left edge; the right arm is its
  // mirror image, so both arms share the same physics and attachment.
  let mirror = side === 'right' ? -1 : 1;
  // A telescopic hose barely sags: it stays nearly straight at the base.
  let bendScale = rigid ? 0.3 : 1;
  let hanging = false;
  let wave = 0;
  let wavePhase = side === 'right' ? 2.1 : 0;
  let hangWeight = 0;
  let anchorPoint = (rect) => ({
    x: side === 'right' ? rect.right : rect.left,
    y: rect.top + rect.height / 2,
  });
  let doc = overlay.ownerDocument;
  let win = doc.defaultView;
  let svg = doc.createElementNS(SVG_NS, 'svg');
  let id = `presenter-hose-${++nextId}`;
  // Keep the hose in the overlay's stacking context: a negative child falls
  // behind the viewport and disappears, while this source order keeps it
  // below the cursor, marquee, ink, and click feedback. A robot arm (`before`:
  // the robot body) goes just under its body instead, so it lies above the ink.
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;z-index:0;pointer-events:none';
  svg.innerHTML = `<defs><filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"
    color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate"
    radius="2" result="expanded"/><feFlood flood-color="var(--presenter-hose-outline, var(--presenter-hose-accent, #ff6237))"
    result="color"/><feComposite in="color" in2="expanded" operator="in"/>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <g filter="url(#${id})" fill="var(--presenter-hose-ink, #22251f)"
    stroke="var(--presenter-hose-ink, #22251f)" stroke-linecap="round"
    stroke-linejoin="round"><path data-ripple fill="none" stroke-width="2"
    stroke="var(--presenter-hose-accent, #ff6237)"/><path data-hose fill="none" stroke-width="7" stroke-dasharray="3 8" stroke-linecap="butt"/>
    <path data-port stroke-width="6"/><g data-arrow fill="none" stroke-width="${CLAW_FINGER_WIDTH}"><path data-claw-finger/><path data-claw-finger/>
    <circle data-claw-hinge cx="${CLAW_WRIST.x}" cy="${CLAW_WRIST.y}" r="${CLAW_HINGE_RADIUS}" fill="var(--presenter-hose-ink, #22251f)" stroke="none"/></g></g>`;
  overlay.insertBefore(svg, before && before.parentNode === overlay ? before : overlay.firstChild);
  let hose = svg.querySelector('[data-hose]');
  // Robot arms carry a denser stripe pattern than the player hose.
  if (rigid) hose.setAttribute('stroke-dasharray', '3 4.5');
  let port = svg.querySelector('[data-port]');
  let arrow = svg.querySelector('[data-arrow]');
  let fingers = [...svg.querySelectorAll('[data-claw-finger]')];
  let ripple = svg.querySelector('[data-ripple]');
  // Environments without `matchMedia` (SSR, linkedom, older hosts) still get a
  // hose; they simply never report a reduced-motion preference.
  let media = typeof win?.matchMedia === 'function'
    ? win.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false, addEventListener() {}, removeEventListener() {} };
  let frame = 0;
  let last = 0;
  let position = null;
  let bends = {
    base: { x: 0, y: 0, vx: 0, vy: 0 },
    tip: { x: 0, y: 0, vx: 0, vy: 0 },
  };
  let angle = 0;
  let gripTarget = 0;
  let grip = 0;
  let clickPosition = null;
  let clickStarted = 0;
  let clickElapsed = null;
  let disposed = false;
  let returningHome = false;
  let returnSpeed = 0;
  let returnFast = false;
  let homeResolver = null;
  let homePromise = Promise.resolve(Object.freeze({ status: 'home' }));

  let finishHome = (status) => {
    if (!homeResolver) return;
    let resolve = homeResolver;
    homeResolver = null;
    resolve(Object.freeze({ status }));
  };

  let beginHomeReturn = () => {
    if (!homeResolver) {
      homePromise = new Promise((resolve) => { homeResolver = resolve; });
    }
    return homePromise;
  };

  let observedRect = null;
  let draw = (time) => {
    frame = 0;
    if (disposed || !position || !overlay.isConnected) return;
    let rect = resolveAnchor()?.getBoundingClientRect();
    let anchorChanged = rect && observedRect
      && (rect.left !== observedRect.left || rect.top !== observedRect.top
        || rect.width !== observedRect.width || rect.height !== observedRect.height);
    observedRect = rect;
    let visible = rect?.width > 0 && rect?.height > 0;
    svg.style.display = visible && !doc.hidden ? '' : 'none';
    if (!visible || doc.hidden) {
      if (!visible && returningHome) {
        returningHome = false;
        finishHome('anchor-unavailable');
      }
      return;
    }
    let dt = Math.min(Math.max((time - last) / 1000, 0.001), 0.032);
    last = time;
    let anchor = anchorPoint(rect);
    if (returningHome) {
      let home = { x: anchor.x + outward * 22, y: anchor.y };
      let dx = home.x - position.x;
      let dy = home.y - position.y;
      let distance = Math.hypot(dx, dy);
      // Limit speed and acceleration, and brake before the dock.
      let [maxSpeed, acceleration] = returnFast ? [4200, 16000] : [550, 1100];
      let targetSpeed = Math.min(maxSpeed, Math.sqrt(2 * acceleration * distance));
      returnSpeed += Math.max(-acceleration * dt, Math.min(acceleration * dt, targetSpeed - returnSpeed));
      let travel = dt * returnSpeed;
      if (distance <= travel || distance < 1) {
        position = home;
        returningHome = false;
      } else if (distance > 0) {
        position = { x: position.x + dx / distance * travel, y: position.y + dy / distance * travel };
      }
    }
    let wanted = Math.atan2(position.y - anchor.y, mirror * (position.x - anchor.x)) + Math.PI / 2;
    let delta = Math.atan2(Math.sin(wanted - angle), Math.cos(wanted - angle));
    angle += media.matches ? delta : delta * (1 - Math.exp(-dt * 12));
    let cos = Math.cos(angle);
    let sin = Math.sin(angle);
    let desired = resolvePresenterHoseGeometry({ anchor, cursor: position, angle, reducedMotion: media.matches, mirror, sagScale: bendScale, hang: hangWeight });
    // A rigid (telescopic) hose has no springy bends: its length follows the
    // distance to the claw and it never trails behind like a tail.
    if (rigid) {
      for (let name of ['base', 'tip']) {
        Object.assign(bends[name], desired[`${name}Bend`], { vx: 0, vy: 0 });
      }
    }
    let step = dt / 4;
    for (let i = 0; i < 4; i++) {
      for (let [name, stiffness, damping] of [['base', 360, 36], ['tip', 170, 26]]) {
        let node = bends[name];
        for (let axis of ['x', 'y']) {
          let velocity = axis === 'x' ? 'vx' : 'vy';
          node[velocity] += ((desired[`${name}Bend`][axis] - node[axis]) * stiffness - node[velocity] * damping) * step;
          node[axis] += node[velocity] * step;
        }
      }
    }
    let settled = ['base', 'tip'].every((name) => (
      Math.hypot(bends[name].x - desired[`${name}Bend`].x, bends[name].y - desired[`${name}Bend`].y) < 0.05
      && Math.hypot(bends[name].vx, bends[name].vy) < 0.1
    )) && Math.abs(delta) < 0.001;
    if (settled || media.matches) {
      for (let name of ['base', 'tip']) {
        Object.assign(bends[name], desired[`${name}Bend`], { vx: 0, vy: 0 });
      }
      angle = wanted;
    }
    if (!returningHome && settled) finishHome('home');
    let hangGoal = hanging ? 1 : 0;
    hangWeight = media.matches ? hangGoal : hangWeight + (hangGoal - hangWeight) * (1 - Math.exp(-dt / 0.4));
    if (Math.abs(hangGoal - hangWeight) < 0.004) hangWeight = hangGoal;
    let geometry = resolvePresenterHoseGeometry({
      anchor,
      cursor: position,
      angle,
      midpoints: { base: bends.base, tip: bends.tip },
      reducedMotion: media.matches,
      mirror,
      sagScale: bendScale, hang: hangWeight,
      sway: wave > 0 && !media.matches
        ? { base: wave * 0.1 * Math.sin(time / 520 + wavePhase), tip: wave * 1.3 * Math.sin(time / 380 + wavePhase + 1.3) }
        : null,
    });
    hose.setAttribute('d', geometry.hosePath);
    port.setAttribute('d', geometry.portPath);
    arrow.setAttribute('transform', `translate(${geometry.center.x} ${geometry.center.y}) scale(${mirror} 1) rotate(${angle * 180 / Math.PI})`);
    grip = media.matches || Math.abs(gripTarget - grip) < 0.004
      ? gripTarget
      : grip + (gripTarget - grip) * (1 - Math.exp(-dt * 22));
    resolvePresenterClawPaths(grip).forEach((d, index) => fingers[index].setAttribute('d', d));
    if (clickPosition) {
      let age = clickElapsed ?? time - clickStarted;
      let radius = 15 + age * 0.05;
      ripple.setAttribute('d', age < 550
        ? `M${clickPosition.x - radius} ${clickPosition.y}
          a${radius} ${radius} 0 1 0 ${radius * 2} 0
          a${radius} ${radius} 0 1 0 -${radius * 2} 0`
        : '');
      ripple.setAttribute('opacity', String(Math.max(0, 1 - age / 550)));
      if (age >= 550) clickPosition = null;
    }
    if (anchorChanged || (!settled && !media.matches) || (wave > 0 && !media.matches) || hangWeight !== (hanging ? 1 : 0) || (clickPosition && clickElapsed === null) || returningHome
      || grip !== gripTarget) {
      frame = win.requestAnimationFrame(draw);
    }
  };
  let observer = null;
  let observedAnchor = null;
  let syncAnchorObserver = () => {
    let anchor = resolveAnchor();
    if (anchor === observedAnchor) return;
    if (observedAnchor) observer?.unobserve(observedAnchor);
    observedAnchor = anchor || null;
    if (observedAnchor) observer?.observe(observedAnchor);
  };
  let wake = () => {
    syncAnchorObserver();
    last = win.performance.now();
    if (!frame && position && !disposed) frame = win.requestAnimationFrame(draw);
  };
  observer = win.ResizeObserver ? new win.ResizeObserver(wake) : null;
  observer?.observe(doc.documentElement);
  if (doc.body) observer?.observe(doc.body);
  syncAnchorObserver();
  win.addEventListener('resize', wake);
  doc.addEventListener('scroll', wake, true);
  doc.addEventListener('visibilitychange', wake);
  media.addEventListener?.('change', wake);
  return {
    getPosition() { return position && { ...position }; },
    // A parked arm droops under its own weight instead of staying straight.
    // Amplitude (px) of the water-like undulation along the arm.
    setWave(amount) { let next = Math.max(0, Number(amount) || 0); if (next !== wave) { wave = next; wake(); } },
    setHang(value) { if (hanging !== (value === true)) { hanging = value === true; wake(); } },
    // Redraw after the anchor moved without a resize (a flying body).
    refresh: wake,
    // Retracted rest point: the claw is folded into the player edge until the
    // first gesture extends the hose from here.
    getRestPoint() {
      let rect = resolveAnchor()?.getBoundingClientRect();
      return rect?.width > 0 && rect?.height > 0 ? anchorPoint(rect) : null;
    },
    move(x, y) {
      if (returningHome) finishHome('interrupted');
      returningHome = false;
      if (!position) {
        let rect = resolveAnchor()?.getBoundingClientRect();
        let anchor = rect?.width > 0 && rect?.height > 0 ? anchorPoint(rect) : { x, y };
        let initialAngle = Math.atan2(y - anchor.y, mirror * (x - anchor.x)) + Math.PI / 2;
        let initial = resolvePresenterHoseGeometry({ anchor, cursor: { x, y }, angle: initialAngle, mirror });
        for (let name of ['base', 'tip']) Object.assign(bends[name], initial[`${name}Bend`]);
      }
      position = { x, y };
      wake();
    },
    presentClick(x, y, elapsedMs) {
      clickPosition = { x, y };
      clickElapsed = elapsedMs;
      wake();
    },
    // Close (true) or open (false) the claw; animated in the draw loop.
    setGrip(closed) {
      let next = closed ? 1 : 0;
      if (next === gripTarget) return;
      gripTarget = next;
      wake();
    },
    click(x, y) { clickElapsed = null; clickPosition = { x, y }; clickStarted = win.performance.now(); wake(); },
    // `fast` retracts a hose that is only being put away (a retired arm).
    returnHome(fast = false) {
      if (!position) return Promise.resolve(Object.freeze({ status: 'home' }));
      returnFast = fast === true;
      if (!returningHome) returnSpeed = 0;
      returningHome = Boolean(position);
      let pending = beginHomeReturn();
      wake();
      return pending;
    },
    planHomeReturn(from = position) {
      let rect = resolveAnchor()?.getBoundingClientRect();
      if (!from || !(rect?.width > 0 && rect?.height > 0)) {
        return Object.freeze({ durationMs: 0, destination: null });
      }
      let destination = { ...anchorPoint(rect), x: anchorPoint(rect).x + outward * 22 };
      let distance = Math.hypot(destination.x - from.x, destination.y - from.y);
      let acceleration = 1.1 / 1000;
      let maximumSpeed = 550 / 1000;
      let accelerationDistance = maximumSpeed ** 2 / (2 * acceleration);
      let durationMs = distance <= accelerationDistance * 2
        ? 2 * Math.sqrt(distance / acceleration)
        : (2 * maximumSpeed / acceleration)
          + ((distance - accelerationDistance * 2) / maximumSpeed);
      return Object.freeze({ durationMs: Math.ceil(durationMs + 350), destination });
    },
    whenHome() {
      return homePromise;
    },
    hide() {
      svg.style.display = 'none'; position = null; clickPosition = null;
      win.cancelAnimationFrame(frame); frame = 0;
    },
    dispose() {
      finishHome('disposed');
      disposed = true; win.cancelAnimationFrame(frame); observer?.disconnect();
      win.removeEventListener('resize', wake); doc.removeEventListener('scroll', wake, true);
      doc.removeEventListener('visibilitychange', wake); media.removeEventListener?.('change', wake);
      svg.remove();
    },
  };
}
