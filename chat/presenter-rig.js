import createPresenterHose from './presenter-hose.js';

// Experimental presenter body: a round avatar that flies over the page with a
// claw hose on each side. It exposes the same surface as `createPresenterHose`
// so the cursor can use it as a drop-in replacement. The arms take turns: the
// body settles on the side of the target opposite the arm that reaches for it.
const BODY_RADIUS = 30;
const REACH = 190;
const EVENT_DISTANCE_PX = 260;
const EDGE_MARGIN = 10;
const MAX_SPEED = 1100;
const RETRACT_TAU_S = 0.07;
const IDLE_RETRACT_MS = 700;
const SPRING = { stiffness: 45, damping: 12 };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function createPresenterRig(overlay, resolvePlayer, { avatarSrc = '' } = {}) {
  let doc = overlay.ownerDocument;
  let win = doc.defaultView;
  let body = doc.createElement('div');
  body.className = 'pc-rig-body';
  body.setAttribute('aria-hidden', 'true');
  body.style.cssText = `position:absolute;left:0;top:0;box-sizing:border-box;pointer-events:none;
    width:${BODY_RADIUS * 2}px;height:${BODY_RADIUS * 2}px;margin:${-BODY_RADIUS}px 0 0 ${-BODY_RADIUS}px;
    border-radius:50%;border:3px solid var(--presenter-hose-outline, #fff);opacity:0;
    box-shadow:0 0 0 2px var(--presenter-hose-ink, #22251f), 0 6px 18px rgba(0,0,0,.28);
    background:#22251f ${avatarSrc ? `url("${avatarSrc}")` : ''} 50% 50% / 120% no-repeat`;
  // Connectors where the hoses leave the body, drawn like the hose ports on
  // the claws (the body sits above the hose layer and would hide those).
  for (let side of ['left', 'right']) {
    let connector = doc.createElement('span');
    connector.style.cssText = `position:absolute;top:50%;${side}:-8px;width:6px;height:14px;margin-top:-7px;
      box-sizing:border-box;border-radius:3px;background:var(--presenter-hose-ink, #22251f);
      box-shadow:0 0 0 2px var(--presenter-hose-outline, #fff)`;
    body.appendChild(connector);
  }
  overlay.appendChild(body);
  // Arm 0 leaves the left edge and reaches left; arm 1 mirrors it.
  let arms = ['left', 'right'].map((side) => createPresenterHose(overlay, () => body, { side, rigid: true }));
  let parked = [true, true];
  let retiring = new Map();
  let lastMoveAt = 0;
  let active = null;
  let lastArm = 1;
  let docked = true;
  let gripClosed = false;
  let disposed = false;
  let pos = null;
  let goal = null;
  let scale = 0;
  let frame = 0;
  let last = 0;
  let outward = { x: 0.9, y: -0.4 };
  let centroid = null;
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
      x: pos.x + (index === 0 ? -1 : 1) * (radius + 22),
      y: pos.y,
    };
  };

  // Keep the body inside the viewport and off the player; when the preferred
  // side is blocked, perch on the other side of the cursor.
  let fit = (point) => {
    let view = viewport();
    let player = resolvePlayer()?.getBoundingClientRect();
    let place = (sign) => ({
      x: clamp(point.x + outward.x * sign * REACH, BODY_RADIUS + EDGE_MARGIN, view.width - BODY_RADIUS - EDGE_MARGIN),
      y: clamp(point.y + outward.y * sign * REACH, BODY_RADIUS + EDGE_MARGIN, view.height - BODY_RADIUS - EDGE_MARGIN),
    });
    let blocked = (spot) => player
      && spot.x + BODY_RADIUS > player.left - 12 && spot.x - BODY_RADIUS < player.right + 12
      && spot.y + BODY_RADIUS > player.top - 12 && spot.y - BODY_RADIUS < player.bottom + 12;
    let spot = place(1);
    if (blocked(spot) || Math.hypot(spot.x - point.x, spot.y - point.y) < BODY_RADIUS + 60) {
      let other = place(-1);
      if (!blocked(other)) spot = other;
    }
    return spot;
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
      retiring.set(previous, { ...(cursorPoint || armHome(previous)) });
    }
    parked[index] = true;
  };

  // The arm that takes the next event: arms alternate, and the body trails
  // the claw on the side that arm reaches from.
  let startEvent = (point, index) => {
    centroid = { ...point };
    outward = index === 0 ? { x: 0.9, y: -0.4 } : { x: -0.9, y: -0.4 };
    let length = Math.hypot(outward.x, outward.y);
    outward = { x: outward.x / length, y: outward.y / length };
    if (cursorPoint) setActive(index);
    else active = index;
  };

  // Draw the active arm back into the body; the body keeps hovering.
  let retireActive = () => {
    if (active === null) return;
    let index = active;
    parked[index] = false;
    arms[index].setGrip(false);
    retiring.set(index, { ...(cursorPoint || armHome(index)) });
    active = null;
    cursorPoint = null;
    gripClosed = false;
    ensureLoop();
  };

  let undock = (point) => {
    docked = false;
    pos = pos || { ...(restPoint() || point), vx: 0, vy: 0 };
    if (!goal) goal = { x: pos.x, y: pos.y };
  };

  let step = (time) => {
    frame = 0;
    if (disposed || !pos) return;
    let dt = Math.min(Math.max((time - last) / 1000, 0.001), 0.032);
    last = time;
    let moving = false;
    if (goal) {
      if (media.matches) {
        Object.assign(pos, goal, { vx: 0, vy: 0 });
      } else {
        for (let axis of ['x', 'y']) {
          let velocity = axis === 'x' ? 'vx' : 'vy';
          pos[velocity] += ((goal[axis] - pos[axis]) * SPRING.stiffness - pos[velocity] * SPRING.damping) * dt;
          pos[axis] += pos[velocity] * dt;
        }
        // Cap the flight speed so a far jump stays a glide, not a dash.
        let speed = Math.hypot(pos.vx, pos.vy);
        if (speed > MAX_SPEED) {
          pos.vx *= MAX_SPEED / speed;
          pos.vy *= MAX_SPEED / speed;
        }
      }
      // Telescopic arms of fixed length: the body can come closer than the arm
      // length but never pulls the claw further than it, so the hose is not
      // stretched by flight; it only changes length through its own motion.
      if (cursorPoint && active !== null && !docked) {
        let dx = pos.x - cursorPoint.x;
        let dy = pos.y - cursorPoint.y;
        let distance = Math.hypot(dx, dy);
        if (distance > REACH) {
          let nx = dx / distance;
          let ny = dy / distance;
          pos.x = cursorPoint.x + nx * REACH;
          pos.y = cursorPoint.y + ny * REACH;
          let outwardSpeed = pos.vx * nx + pos.vy * ny;
          if (outwardSpeed > 0) {
            pos.vx -= outwardSpeed * nx;
            pos.vy -= outwardSpeed * ny;
          }
        }
      }
      moving = Math.hypot(goal.x - pos.x, goal.y - pos.y) > 0.4 || Math.hypot(pos.vx, pos.vy) > 4;
    }
    let scaleGoal = docked ? 0 : 1;
    scale = media.matches ? scaleGoal : scale + (scaleGoal - scale) * (1 - Math.exp(-dt * 12));
    if (Math.abs(scaleGoal - scale) < 0.01) scale = scaleGoal;
    let tilt = media.matches ? 0 : clamp(pos.vx * 0.012, -10, 10);
    // Idle hover: a slow bob keeps the hovering body alive between gestures.
    let bob = media.matches || docked ? 0 : Math.sin(time / 650) * 2.5;
    // Gaze: shift the portrait toward what the arm is reaching for.
    if (cursorPoint && !docked) {
      let dx = cursorPoint.x - pos.x;
      let dy = cursorPoint.y - pos.y;
      let length = Math.max(1, Math.hypot(dx, dy));
      body.style.backgroundPosition = `${50 + dx / length * 9}% ${50 + dy / length * 9}%`;
    }
    body.style.opacity = String(Math.min(1, scale * 1.6));
    body.style.transform = `translate(${pos.x}px, ${pos.y + bob}px) rotate(${tilt}deg) scale(${Math.max(0.02, scale)})`;
    // An action that ended without a planned return still draws the arm in.
    if (active !== null && !gripClosed && time - lastMoveAt > IDLE_RETRACT_MS) retireActive();
    if (scale > 0) {
      arms.forEach((arm, index) => {
        let claw = retiring.get(index);
        if (claw) {
          let home = armHome(index);
          let follow = media.matches ? 1 : 1 - Math.exp(-dt / RETRACT_TAU_S);
          claw.x += (home.x - claw.x) * follow;
          claw.y += (home.y - claw.y) * follow;
          // The retiring arm is also fixed-length: its claw is drawn in.
          let reach = Math.hypot(claw.x - pos.x, claw.y - pos.y);
          if (reach > REACH) {
            claw.x = pos.x + (claw.x - pos.x) * REACH / reach;
            claw.y = pos.y + (claw.y - pos.y) * REACH / reach;
          }
          if (Math.hypot(home.x - claw.x, home.y - claw.y) < 2) {
            retiring.delete(index);
            parked[index] = true;
          }
          arm.move(claw.x, claw.y);
        } else if (index !== active && parked[index]) arm.move(armHome(index).x, armHome(index).y);
        else arm.refresh();
      });
    }
    if (docked && scale === 0) arms.forEach((arm) => arm.hide());
    if (moving || retiring.size || active !== null || scale !== scaleGoal || (!docked && !media.matches)) frame = win.requestAnimationFrame(step);
  };
  let ensureLoop = () => {
    if (frame || disposed || !pos) return;
    last = now();
    frame = win.requestAnimationFrame(step);
  };

  return {
    getPosition() { return active === null ? null : arms[active].getPosition(); },
    getRestPoint() { return restPoint(); },
    // The cursor announces where the next gesture is headed so the body can
    // fly there while the arm is still extending.
    setTarget(point) {
      if (!point || disposed || gripClosed) return;
      undock(point);
      // A new event far from the current area passes to the other arm; the
      // frames of one illustration stay with the same arm and perch.
      if (active === null || !centroid
        || Math.hypot(point.x - centroid.x, point.y - centroid.y) > EVENT_DISTANCE_PX) {
        startEvent(point, 1 - lastArm);
      }
    },
    // The body keeps flying while the claw works: it trails the cursor and
    // slides around the area's perimeter, always on the outer side.
    move(x, y) {
      if (disposed) return;
      let first = docked || active === null;
      cursorPoint = { x, y };
      lastMoveAt = now();
      if (first) {
        undock({ x, y });
        startEvent({ x, y }, 1 - lastArm);
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
      goal = fit({ x, y });
      ensureLoop();
      arms[active].move(x, y);
    },
    presentClick(x, y, elapsedMs) { if (active !== null) arms[active].presentClick(x, y, elapsedMs); },
    click(x, y) { if (active !== null) arms[active].click(x, y); },
    setGrip(closed) {
      gripClosed = closed === true;
      if (active !== null) arms[active].setGrip(gripClosed);
    },
    // End of a gesture: the active arm retracts to the body, which keeps
    // hovering for the next event.
    planHomeReturn(from) {
      if (active === null || !pos) return Object.freeze({ durationMs: 0, destination: null });
      let plan = arms[active].planHomeReturn(from);
      return Object.freeze({ durationMs: plan.durationMs, destination: plan.destination });
    },
    // Pause or end of a gesture: the arm retracts but the body stays in the
    // air for as long as the tour is on; only dispose() removes it.
    returnHome() {
      retireActive();
      return Promise.resolve(Object.freeze({ status: 'home' }));
    },
    whenHome() { return active === null ? Promise.resolve(Object.freeze({ status: 'home' })) : arms[active].whenHome(); },
    hide() {
      arms.forEach((arm) => arm.hide());
      body.style.opacity = '0';
      docked = true; active = null; cursorPoint = null; scale = 0;
    },
    dispose() {
      disposed = true;
      win.cancelAnimationFrame(frame);
      arms.forEach((arm) => arm.dispose());
      body.remove();
    },
  };
}
