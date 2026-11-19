/**
 * Flight route of the presenter body around the selection frame.
 *
 * A straight flight that would cut through the frame goes round it: to a corner
 * of the frame (inflated by the body gap) that it can reach without crossing the
 * frame, and from which the perch is in view. A corner the body has already
 * reached is never chosen again, so the body keeps moving along the frame
 * instead of waiting on its corner.
 */

const INSET = 2;
// A flight leg may graze the inflated box by this much: the body gap is larger than
// the body radius, so skimming the gap never touches the frame itself.
const LEG_INSET = 18;
const REACHED_PX = 24;
// How far past the frame edge a body still counts as being inside the frame.
const CORE_MARGIN = 10;

const strictlyInside = (point, box) => point.x > box.left + INSET && point.x < box.right - INSET
  && point.y > box.top + INSET && point.y < box.bottom - INSET;

/** True when the segment a→b passes through the interior of the box. */
export function segmentCutsBox(a, b, box, inset = INSET) {
  const left = box.left + inset;
  const right = box.right - inset;
  const top = box.top + inset;
  const bottom = box.bottom - inset;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [[-dx, a.x - left], [dx, right - a.x], [-dy, a.y - top], [dy, bottom - a.y]]) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      t0 = Math.max(t0, r);
    } else {
      if (r < t0) return false;
      t1 = Math.min(t1, r);
    }
  }
  return t0 < t1;
}

/**
 * @param {{x:number,y:number}} from body position
 * @param {{x:number,y:number}} to perch
 * @param {{left:number,top:number,right:number,bottom:number}|null} rect frame to keep clear of
 * @param {{gap:number, view:{width:number,height:number}, low:number}} options
 */
export function routeAround(from, to, rect, { gap, view, low }) {
  if (!rect) return to;
  const box = { left: rect.left - gap, top: rect.top - gap, right: rect.right + gap, bottom: rect.bottom + gap };
  // Only a body inside the frame itself heads straight out; one in the gap band
  // around it is still routed, or it would cut across the frame from there.
  const core = { left: rect.left - CORE_MARGIN, top: rect.top - CORE_MARGIN, right: rect.right + CORE_MARGIN, bottom: rect.bottom + CORE_MARGIN };
  if (strictlyInside(from, core) || strictlyInside(to, box)) return to;
  const cuts = (a, b) => segmentCutsBox(a, b, box, LEG_INSET);
  if (!cuts(from, to)) return to;
  const clampPoint = (c) => ({
    x: Math.max(low, Math.min(view.width - low, c.x)),
    y: Math.max(low, Math.min(view.height - low, c.y)),
  });
  const corners = [
    { x: box.left, y: box.top }, { x: box.right, y: box.top },
    { x: box.right, y: box.bottom }, { x: box.left, y: box.bottom },
  ].map(clampPoint).filter((c) => !strictlyInside(c, box));
  const fresh = corners.filter((c) => Math.hypot(c.x - from.x, c.y - from.y) > REACHED_PX);
  const cost = (c) => Math.hypot(c.x - from.x, c.y - from.y) + Math.hypot(to.x - c.x, to.y - c.y);
  const pick = (list) => list.reduce((best, c) => (!best || cost(c) < cost(best) ? c : best), null);
  // The leg to the corner must itself stay off the frame. Prefer a corner the
  // body can reach and from which the perch is in plain view; otherwise the best
  // reachable corner as a stepping stone, from where the next step sees one.
  // Near a corner the body is treated as standing on it: the next leg starts
  // from the corner, so a few pixels of offset do not make the frame edge a wall.
  const standing = corners.find((c) => Math.hypot(c.x - from.x, c.y - from.y) <= REACHED_PX);
  const origin = standing || from;
  const reachable = fresh.filter((c) => !cuts(origin, c));
  return pick(reachable.filter((c) => !cuts(c, to))) || pick(reachable) || pick(fresh) || to;
}
