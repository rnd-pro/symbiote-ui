function snapGrid(value, grid) {
  return Math.round(value / grid) * grid;
}

function snapOutside(value, grid, direction) {
  return (direction < 0 ? Math.floor(value / grid) : Math.ceil(value / grid)) * grid;
}

function alignGrid(value, grid, snapToGrid) {
  return snapToGrid ? snapGrid(value, grid) : value;
}

function alignOutside(value, grid, direction, snapToGrid) {
  return snapToGrid ? snapOutside(value, grid, direction) : value;
}

function snapDir(deg) {
  const r = ((deg % 360) + 360) % 360;
  if (r < 45 || r >= 315) return { dx: 1, dy: 0 };
  if (r >= 45 && r < 135) return { dx: 0, dy: 1 };
  if (r >= 135 && r < 225) return { dx: -1, dy: 0 };
  return { dx: 0, dy: -1 };
}

function dirAngle(dir) {
  if (dir.dx > 0) return 0;
  if (dir.dx < 0) return 180;
  if (dir.dy > 0) return 90;
  if (dir.dy < 0) return 270;
  return 0;
}

function parallelGroup(connections, conn) {
  return connections.filter((candidate) =>
    candidate.from === conn.from ||
    candidate.from === conn.to ||
    candidate.to === conn.from ||
    candidate.to === conn.to ||
    (candidate.from === conn.from && candidate.to === conn.to)
  );
}

function parallelShift(connections, conn, grid) {
  const group = parallelGroup(connections, conn);
  if (group.length <= 1) return 0;
  const index = Math.max(0, group.findIndex((candidate) => candidate.id === conn.id));
  return (index - (group.length - 1) / 2) * grid;
}

function parallelSpread(connections, conn, grid) {
  const group = parallelGroup(connections, conn);
  if (group.length <= 1) return 0;
  return (group.length - 1) / 2 * grid;
}

function uniqueSorted(values) {
  return [...new Set(values.map((value) => Math.round(value * 100) / 100))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

function endpointStub(point, rect, dir, distance) {
  if (dir.dx > 0) {
    return { x: Math.max(point.x + distance, rect.x + rect.w + distance), y: point.y };
  }
  if (dir.dx < 0) {
    return { x: Math.min(point.x - distance, rect.x - distance), y: point.y };
  }
  if (dir.dy > 0) {
    return { x: point.x, y: Math.max(point.y + distance, rect.y + rect.h + distance) };
  }
  if (dir.dy < 0) {
    return { x: point.x, y: Math.min(point.y - distance, rect.y - distance) };
  }
  return { ...point };
}

const ORTHOGONAL_DIRECTIONS = [
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: -1 },
];

function directionKey(dir) {
  return `${dir.dx},${dir.dy}`;
}

function addDirection(result, seen, dir) {
  const key = directionKey(dir);
  if (seen.has(key)) return;
  seen.add(key);
  result.push(dir);
}

function orderedDirections(preferred, fromPoint, toPoint) {
  const result = [];
  const seen = new Set();
  const delta = {
    x: toPoint.x - fromPoint.x,
    y: toPoint.y - fromPoint.y,
  };

  addDirection(result, seen, preferred);
  if (preferred.dx !== 0) {
    const verticalSign = Math.sign(delta.y) || 1;
    addDirection(result, seen, { dx: 0, dy: verticalSign });
    addDirection(result, seen, { dx: 0, dy: -verticalSign });
  } else {
    const horizontalSign = Math.sign(delta.x) || 1;
    addDirection(result, seen, { dx: horizontalSign, dy: 0 });
    addDirection(result, seen, { dx: -horizontalSign, dy: 0 });
  }
  addDirection(result, seen, { dx: -preferred.dx, dy: -preferred.dy });

  for (const dir of ORTHOGONAL_DIRECTIONS) {
    addDirection(result, seen, dir);
  }

  return result;
}

function compactPoints(points) {
  const compact = [];
  for (const point of points) {
    const previous = compact.at(-1);
    if (!previous || Math.abs(previous.x - point.x) > 0.5 || Math.abs(previous.y - point.y) > 0.5) {
      compact.push(point);
    }
  }
  return compact;
}

function simplifyCollinear(points) {
  const simplified = compactPoints(points);
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = 1; index < simplified.length - 1; index += 1) {
      const prev = simplified[index - 1];
      const curr = simplified[index];
      const next = simplified[index + 1];
      const sameVertical = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5;
      const sameHorizontal = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5;
      if (sameVertical || sameHorizontal) {
        simplified.splice(index, 1);
        changed = true;
        break;
      }
    }
  }
  return simplified;
}

function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function rectsOverlap(a, b, pad = 0) {
  return !(
    a.x + a.w + pad < b.x - pad ||
    b.x + b.w + pad < a.x - pad ||
    a.y + a.h + pad < b.y - pad ||
    b.y + b.h + pad < a.y - pad
  );
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 0.5) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return (
    b.x <= Math.max(a.x, c.x) + 0.5 &&
    b.x >= Math.min(a.x, c.x) - 0.5 &&
    b.y <= Math.max(a.y, c.y) + 0.5 &&
    b.y >= Math.min(a.y, c.y) - 0.5
  );
}

function segmentsIntersect(a1, a2, b1, b2) {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;
  return false;
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

function countSelfIntersections(points) {
  let count = 0;
  for (let aIndex = 0; aIndex < points.length - 1; aIndex += 1) {
    for (let bIndex = aIndex + 2; bIndex < points.length - 1; bIndex += 1) {
      const a1 = points[aIndex];
      const a2 = points[aIndex + 1];
      const b1 = points[bIndex];
      const b2 = points[bIndex + 1];
      if (samePoint(a2, b1)) continue;
      if (aIndex === 0 && bIndex === points.length - 2 && samePoint(a1, b2)) continue;
      if (segmentsIntersect(a1, a2, b1, b2)) count += 1;
    }
  }
  return count;
}

function segmentIntersectsRect(a, b, rect, pad = 0) {
  const expanded = {
    x: rect.x - pad,
    y: rect.y - pad,
    w: rect.w + pad * 2,
    h: rect.h + pad * 2,
  };

  if (pointInRect(a, expanded) || pointInRect(b, expanded)) return true;

  const left = expanded.x;
  const right = expanded.x + expanded.w;
  const top = expanded.y;
  const bottom = expanded.y + expanded.h;
  const edges = [
    [{ x: left, y: top }, { x: right, y: top }],
    [{ x: right, y: top }, { x: right, y: bottom }],
    [{ x: right, y: bottom }, { x: left, y: bottom }],
    [{ x: left, y: bottom }, { x: left, y: top }],
  ];

  return edges.some(([edgeStart, edgeEnd]) => segmentsIntersect(a, b, edgeStart, edgeEnd));
}

function segmentCrossesRectInterior(a, b, rect, inset = 3) {
  const inner = {
    x: rect.x + inset,
    y: rect.y + inset,
    w: rect.w - inset * 2,
    h: rect.h - inset * 2,
  };
  if (inner.w <= 0 || inner.h <= 0) return false;
  return segmentIntersectsRect(a, b, inner, 0);
}

function pointOnRectBoundary(point, rect, tolerance = 0.25) {
  const withinX = point.x >= rect.x - tolerance && point.x <= rect.x + rect.w + tolerance;
  const withinY = point.y >= rect.y - tolerance && point.y <= rect.y + rect.h + tolerance;
  if (!withinX || !withinY) return false;
  return (
    Math.abs(point.x - rect.x) <= tolerance ||
    Math.abs(point.x - (rect.x + rect.w)) <= tolerance ||
    Math.abs(point.y - rect.y) <= tolerance ||
    Math.abs(point.y - (rect.y + rect.h)) <= tolerance
  );
}

function mergeEndpointRects(rects, fromRect, toRect) {
  const merged = new Map(rects.map((rect) => [rect.id, rect]));
  merged.set(fromRect.id, fromRect);
  merged.set(toRect.id, toRect);
  return [...merged.values()];
}

function routeHitsBlockedArea(points, rects, fromRect, toRect, pad) {
  const endpointsOverlap = rectsOverlap(fromRect, toRect, 0);
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    for (const rect of rects) {
      if (endpointsOverlap && (rect.id === fromRect.id || rect.id === toRect.id)) continue;
      const crossesEndpointInterior = segmentCrossesRectInterior(a, b, rect);
      const nearSourceEndpoint = rect.id === fromRect.id && index <= 1;
      const nearTargetEndpoint = rect.id === toRect.id && index >= points.length - 3;
      const endpointEdgeSegment =
        (nearSourceEndpoint || nearTargetEndpoint) &&
        !crossesEndpointInterior &&
        (pointOnRectBoundary(a, rect) || pointOnRectBoundary(b, rect));
      if (endpointEdgeSegment) continue;
      const sourceStub = rect.id === fromRect.id && index === 0 && !crossesEndpointInterior;
      const targetStub = rect.id === toRect.id && index === points.length - 2 && !crossesEndpointInterior;
      if (sourceStub || targetStub) continue;
      if (segmentIntersectsRect(a, b, rect, pad)) return true;
    }
  }
  return false;
}

function segmentHitsAnyRect(a, b, rects, pad) {
  return rects.some((rect) => segmentIntersectsRect(a, b, rect, pad));
}

function segmentHitsBlockingRect(a, b, rects, allowedId, pad) {
  return rects.some((rect) => rect.id !== allowedId && segmentIntersectsRect(a, b, rect, pad));
}

function directionDeviation(preferred, dir) {
  return 1 - (preferred.dx * dir.dx + preferred.dy * dir.dy);
}

function chooseCleanStubDirection(point, targetPoint, rect, preferred, distance, rects, pad) {
  let best = null;
  for (const dir of orderedDirections(preferred, point, targetPoint)) {
    const stubPoint = endpointStub(point, rect, dir, distance);
    const selfBlocked = segmentCrossesRectInterior(point, stubPoint, rect);
    const blocked = segmentHitsBlockingRect(point, stubPoint, rects, rect.id, pad);
    const score = (selfBlocked ? 2000 : 0) + (blocked ? 1000 : 0) + directionDeviation(preferred, dir) * 10;
    if (!best || score < best.score) {
      best = { dir, score };
    }
    if (!selfBlocked && !blocked && directionDeviation(preferred, dir) === 0) break;
  }
  return best?.dir || preferred;
}

function routeLength(points) {
  let length = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    length += Math.abs(points[index + 1].x - points[index].x) + Math.abs(points[index + 1].y - points[index].y);
  }
  return length;
}

function segmentDirections(points) {
  const directions = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    if (Math.abs(dx) >= Math.abs(dy)) {
      directions.push({ axis: 'x', sign: Math.sign(dx), length: Math.abs(dx) });
    } else {
      directions.push({ axis: 'y', sign: Math.sign(dy), length: Math.abs(dy) });
    }
  }
  return directions;
}

function countBends(points) {
  const directions = segmentDirections(points);
  let bends = 0;
  for (let index = 1; index < directions.length; index += 1) {
    if (directions[index].axis !== directions[index - 1].axis) bends += 1;
  }
  return bends;
}

function countReversals(points, grid) {
  const directions = segmentDirections(points);
  let reversals = 0;
  for (let index = 1; index < directions.length; index += 1) {
    const prev = directions[index - 1];
    const curr = directions[index];
    if (prev.axis === curr.axis && prev.sign === -curr.sign) {
      reversals += 1;
    }
    const before = directions[index - 2];
    if (
      before &&
      before.axis === curr.axis &&
      before.sign === -curr.sign &&
      prev.length <= grid * 2
    ) {
      reversals += 1;
    }
  }
  return reversals;
}

function countShortJogs(points, grid) {
  const directions = segmentDirections(points);
  let jogs = 0;
  for (let index = 1; index < directions.length - 1; index += 1) {
    if (directions[index].length < grid) jogs += 1;
  }
  return jogs;
}

function routeScore(points, grid) {
  return (
    countReversals(points, grid) * 1_000_000 +
    routeLength(points) +
    countBends(points) * grid * 5 +
    countShortJogs(points, grid) * grid * 8
  );
}

function hasHardGeometryIssue(points, grid) {
  return countReversals(points, grid) > 0 || countSelfIntersections(points) > 0;
}

function chooseBestRoute(candidates, rects, fromRect, toRect, grid, pad) {
  let best = null;
  for (const candidate of candidates) {
    const rawPoints = compactPoints(candidate);
    if (rawPoints.length < 2) continue;
    if (routeHitsBlockedArea(rawPoints, rects, fromRect, toRect, pad)) continue;
    const points = simplifyCollinear(rawPoints);
    if (points.length < 2) continue;
    if (routeHitsBlockedArea(points, rects, fromRect, toRect, pad)) continue;
    if (hasHardGeometryIssue(points, grid)) continue;
    const score = routeScore(points, grid);
    if (!best || score < best.score) {
      best = { points, score };
    }
  }
  return best?.points || null;
}

function chooseFallbackRoute(candidates, rects, fromRect, toRect, grid, pad) {
  let best = null;
  for (const candidate of candidates) {
    const points = simplifyCollinear(compactPoints(candidate));
    if (points.length < 2) continue;
    const hardPenalty = hasHardGeometryIssue(points, grid) ? 1_000_000_000 : 0;
    const blockedPenalty = routeHitsBlockedArea(points, rects, fromRect, toRect, pad) ? 10_000_000 : 0;
    const score = hardPenalty + blockedPenalty + routeScore(points, grid);
    if (!best || score < best.score) {
      best = { points, score };
    }
  }
  return best?.points || null;
}

function buildPath(points, chamfer = 0) {
  const pts = simplifyCollinear(points);
  let path = `M ${pts[0].x} ${pts[0].y}`;

  for (let index = 1; index < pts.length; index += 1) {
    const prev = pts[index - 1];
    const curr = pts[index];
    const next = pts[index + 1];

    if (next) {
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;
      const isH1 = Math.abs(dx1) > Math.abs(dy1);
      const isH2 = Math.abs(dx2) > Math.abs(dy2);

      if (chamfer > 0 && isH1 !== isH2) {
        const len1 = Math.hypot(dx1, dy1);
        const len2 = Math.hypot(dx2, dy2);
        const minChamferSegment = chamfer * 3;
        if (len1 >= minChamferSegment && len2 >= minChamferSegment) {
          const c = Math.min(chamfer, len1 / 2, len2 / 2);
          const preX = curr.x - (dx1 / len1) * c;
          const preY = curr.y - (dy1 / len1) * c;
          const postX = curr.x + (dx2 / len2) * c;
          const postY = curr.y + (dy2 / len2) * c;
          path += ` L ${preX} ${preY} L ${postX} ${postY}`;
          continue;
        }
      }
    }

    if (Math.abs(curr.y - prev.y) < 0.5) {
      path += ` H ${curr.x}`;
    } else if (Math.abs(curr.x - prev.x) < 0.5) {
      path += ` V ${curr.y}`;
    } else {
      path += ` L ${curr.x} ${curr.y}`;
    }
  }

  return { path, points: pts };
}

function midpointArrow(points) {
  const index = Math.max(1, Math.floor(points.length / 2));
  const p1 = points[index - 1];
  const p2 = points[index] || points[index - 1];
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    angle: Math.atan2(p2.y - p1.y, p2.x - p1.x),
  };
}

function pointsHaveMinimumSegments(points, minLength) {
  return segmentDirections(points).every((segment) => segment.length >= minLength);
}

function collectLaneCandidates({ stubFrom, stubTo, obstacleRects, clearance, grid, shift, laneSpread, snapToGrid }) {
  const minX = Math.min(...obstacleRects.map((rect) => rect.x));
  const maxX = Math.max(...obstacleRects.map((rect) => rect.x + rect.w));
  const minY = Math.min(...obstacleRects.map((rect) => rect.y));
  const maxY = Math.max(...obstacleRects.map((rect) => rect.y + rect.h));
  const xValues = [
    alignGrid((stubFrom.x + stubTo.x) / 2, grid, snapToGrid) + shift,
    alignOutside(minX - clearance - laneSpread, grid, -1, snapToGrid) + shift,
    alignOutside(maxX + clearance + laneSpread, grid, 1, snapToGrid) + shift,
  ];
  const yValues = [
    alignGrid((stubFrom.y + stubTo.y) / 2, grid, snapToGrid) + shift,
    alignOutside(minY - clearance - laneSpread, grid, -1, snapToGrid) + shift,
    alignOutside(maxY + clearance + laneSpread, grid, 1, snapToGrid) + shift,
  ];

  for (const rect of obstacleRects) {
    xValues.push(
      alignOutside(rect.x - clearance - laneSpread, grid, -1, snapToGrid) + shift,
      alignOutside(rect.x + rect.w + clearance + laneSpread, grid, 1, snapToGrid) + shift
    );
    yValues.push(
      alignOutside(rect.y - clearance - laneSpread, grid, -1, snapToGrid) + shift,
      alignOutside(rect.y + rect.h + clearance + laneSpread, grid, 1, snapToGrid) + shift
    );
  }

  return {
    xLanes: uniqueSorted(xValues),
    yLanes: uniqueSorted(yValues),
  };
}

function addLaneCandidates(addCandidate, start, stubFrom, stubTo, end, xLanes, yLanes) {
  for (const midX of xLanes) {
    addCandidate([
      start,
      stubFrom,
      { x: midX, y: stubFrom.y },
      { x: midX, y: stubTo.y },
      stubTo,
      end,
    ]);
  }

  for (const midY of yLanes) {
    addCandidate([
      start,
      stubFrom,
      { x: stubFrom.x, y: midY },
      { x: stubTo.x, y: midY },
      stubTo,
      end,
    ]);
  }

  for (const midX of xLanes) {
    for (const midY of yLanes) {
      addCandidate([
        start,
        stubFrom,
        { x: stubFrom.x, y: midY },
        { x: midX, y: midY },
        { x: midX, y: stubTo.y },
        stubTo,
        end,
      ]);
      addCandidate([
        start,
        stubFrom,
        { x: midX, y: stubFrom.y },
        { x: midX, y: midY },
        { x: stubTo.x, y: midY },
        stubTo,
        end,
      ]);
    }
  }
}

function findGridLaneRoute({ stubFrom, stubTo, obstacleRects, xLanes, yLanes, pad }) {
  const xs = uniqueSorted([stubFrom.x, stubTo.x, ...xLanes]);
  const ys = uniqueSorted([stubFrom.y, stubTo.y, ...yLanes]);
  const keyOf = (x, y) => `${x},${y}`;
  const parseKey = (key) => {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  };
  const startKey = keyOf(stubFrom.x, stubFrom.y);
  const endKey = keyOf(stubTo.x, stubTo.y);
  const keys = [];

  for (const x of xs) {
    for (const y of ys) {
      keys.push(keyOf(x, y));
    }
  }

  const dist = new Map(keys.map((key) => [key, Number.POSITIVE_INFINITY]));
  const prev = new Map();
  const visited = new Set();
  dist.set(startKey, 0);

  const neighbors = (key) => {
    const point = parseKey(key);
    const xIndex = xs.indexOf(point.x);
    const yIndex = ys.indexOf(point.y);
    const result = [];
    for (const nextXIndex of [xIndex - 1, xIndex + 1]) {
      if (nextXIndex < 0 || nextXIndex >= xs.length) continue;
      const next = { x: xs[nextXIndex], y: point.y };
      if (!segmentHitsAnyRect(point, next, obstacleRects, pad)) {
        result.push({ key: keyOf(next.x, next.y), cost: Math.abs(next.x - point.x) });
      }
    }
    for (const nextYIndex of [yIndex - 1, yIndex + 1]) {
      if (nextYIndex < 0 || nextYIndex >= ys.length) continue;
      const next = { x: point.x, y: ys[nextYIndex] };
      if (!segmentHitsAnyRect(point, next, obstacleRects, pad)) {
        result.push({ key: keyOf(next.x, next.y), cost: Math.abs(next.y - point.y) });
      }
    }
    return result;
  };

  while (visited.size < keys.length) {
    let current = null;
    let currentDist = Number.POSITIVE_INFINITY;
    for (const key of keys) {
      if (visited.has(key)) continue;
      const value = dist.get(key);
      if (value < currentDist) {
        current = key;
        currentDist = value;
      }
    }

    if (!current || currentDist === Number.POSITIVE_INFINITY) break;
    if (current === endKey) break;
    visited.add(current);

    for (const next of neighbors(current)) {
      if (visited.has(next.key)) continue;
      const nextDist = currentDist + next.cost;
      if (nextDist < dist.get(next.key)) {
        dist.set(next.key, nextDist);
        prev.set(next.key, current);
      }
    }
  }

  if (!prev.has(endKey) && startKey !== endKey) return null;

  const route = [];
  let current = endKey;
  route.unshift(parseKey(current));
  while (current !== startKey) {
    current = prev.get(current);
    if (!current) return null;
    route.unshift(parseKey(current));
  }
  return simplifyCollinear(route);
}

function shortOrthogonalCandidates(start, end, fDir, tDir, shift, grid, snapToGrid) {
  const startHorizontal = fDir.dx !== 0;
  const endHorizontal = tDir.dx !== 0;

  if (startHorizontal && endHorizontal) {
    const midX = alignGrid((start.x + end.x) / 2, grid, snapToGrid) + shift;
    return [[start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]];
  }

  if (!startHorizontal && !endHorizontal) {
    const midY = alignGrid((start.y + end.y) / 2, grid, snapToGrid) + shift;
    return [[start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]];
  }

  return startHorizontal
    ? [[start, { x: end.x, y: start.y }, end]]
    : [[start, { x: start.x, y: end.y }, end]];
}

function localOrthogonalCandidates(start, end, grid, snapToGrid) {
  const midX = alignGrid((start.x + end.x) / 2, grid, snapToGrid);
  const midY = alignGrid((start.y + end.y) / 2, grid, snapToGrid);
  return [
    [start, { x: end.x, y: start.y }, end],
    [start, { x: start.x, y: end.y }, end],
    [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end],
    [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end],
  ];
}

function compactTraceRoute({
  start,
  end,
  fDir,
  tDir,
  shift,
  routeFromRect,
  routeToRect,
  obstacleRects,
  grid,
  stub,
  chamfer,
  snapToGrid,
}) {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const directLength = Math.hypot(dx, dy);
  const manhattanLength = dx + dy;
  const compactLimit = Math.max(stub * 2, grid * 5);
  const straightLimit = Math.max(grid * 2, chamfer * 2.5);
  const minKneeSegment = Math.max(grid * 1.5, chamfer * 2);

  if (directLength > compactLimit && manhattanLength > compactLimit + grid) return null;

  const limitedShift = Math.max(-grid, Math.min(grid, shift));
  const candidates = shortOrthogonalCandidates(start, end, fDir, tDir, limitedShift, grid, snapToGrid)
    .map((candidate) => simplifyCollinear(candidate))
    .filter((candidate) => candidate.length > 2 && pointsHaveMinimumSegments(candidate, minKneeSegment));

  if (candidates.length) {
    const points = chooseBestRoute(candidates, obstacleRects, routeFromRect, routeToRect, grid, 2);
    if (points) {
      const routed = buildPath(points, 0);

      return {
        path: routed.path,
        points: routed.points,
        arrow: midpointArrow(routed.points),
        strategy: 'compact-elbow',
      };
    }
  }

  if (directLength > straightLimit && manhattanLength > straightLimit + grid) return null;

  const directPoints = [start, end];
  if (routeHitsBlockedArea(directPoints, obstacleRects, routeFromRect, routeToRect, 2)) return null;
  const routed = buildPath(directPoints, 0);

  return {
    path: routed.path,
    points: routed.points,
    arrow: midpointArrow(routed.points),
    strategy: 'compact-direct',
  };
}

function findAlternateDirectionRoute({
  start,
  end,
  fromRect,
  toRect,
  preferredFDir,
  preferredTDir,
  rects,
  connections,
  conn,
  grid,
  stub,
  clearance,
  chamfer,
  snapToGrid,
  routeFromRect,
  routeToRect,
  obstacleRects,
}) {
  let best = null;
  const fromDirs = orderedDirections(preferredFDir, start, end);
  const toDirs = orderedDirections(preferredTDir, end, start);

  for (const fromDirection of fromDirs) {
    for (const toDirection of toDirs) {
      if (
        fromDirection.dx === preferredFDir.dx &&
        fromDirection.dy === preferredFDir.dy &&
        toDirection.dx === preferredTDir.dx &&
        toDirection.dy === preferredTDir.dy
      ) {
        continue;
      }

      const routed = routePcbTrace({
        start,
        end,
        fromRect,
        toRect,
        fromAngle: dirAngle(fromDirection),
        toAngle: dirAngle(toDirection),
        rects,
        connections,
        conn,
        grid,
        stub,
        clearance,
        chamfer,
        snapToGrid,
        fromDirection,
        toDirection,
        allowDirectionAlternates: false,
      });

      if (routeHitsBlockedArea(routed.points, obstacleRects, routeFromRect, routeToRect, 2)) continue;
      if (hasHardGeometryIssue(routed.points, grid)) continue;
      const score = routeScore(routed.points, grid);
      if (!best || score < best.score) {
        best = { ...routed, score };
      }
    }
  }

  if (!best) return null;
  const { score, ...routed } = best;
  return { ...routed, alternateDirections: true };
}

export function routePcbTrace({
  start,
  end,
  fromRect,
  toRect,
  fromAngle = 0,
  toAngle = 180,
  rects = [],
  connections = [],
  conn,
  grid = 10,
  stub = 28,
  clearance = 28,
  chamfer = 8,
  snapToGrid = true,
  fromDirection = null,
  toDirection = null,
  allowDirectionAlternates = true,
}) {
  const preferredFDir = snapDir(fromAngle);
  const preferredTDir = snapDir(toAngle);
  const shift = parallelShift(connections, conn, grid);
  const absShift = Math.abs(shift);
  const laneSpread = parallelSpread(connections, conn, grid);
  const rectById = new Map(rects.map((rect) => [rect.id, rect]));
  const routeFromRect = rectById.get(fromRect.id) || fromRect;
  const routeToRect = rectById.get(toRect.id) || toRect;
  if (rectsOverlap(routeFromRect, routeToRect, 0)) {
    const routed = buildPath([start, end], 0);
    return {
      path: routed.path,
      points: routed.points,
      arrow: midpointArrow(routed.points),
      strategy: 'overlap-direct',
    };
  }
  const stubDistance = stub + absShift;
  const obstacleRects = mergeEndpointRects(rects, routeFromRect, routeToRect);
  const fDir = fromDirection || chooseCleanStubDirection(
    start,
    end,
    routeFromRect,
    preferredFDir,
    stubDistance,
    obstacleRects,
    2
  );
  const tDir = toDirection || chooseCleanStubDirection(
    end,
    start,
    routeToRect,
    preferredTDir,
    stubDistance,
    obstacleRects,
    2
  );
  const stubFrom = endpointStub(start, routeFromRect, fDir, stubDistance);
  const stubTo = endpointStub(end, routeToRect, tDir, stubDistance);
  const localRouteLimit = Math.max(stub * 4, clearance * 3, grid * 12);
  const endpointManhattanLength = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
  const compactRoute = compactTraceRoute({
    start,
    end,
    fDir,
    tDir,
    shift,
    routeFromRect,
    routeToRect,
    obstacleRects,
    grid,
    stub,
    chamfer,
    snapToGrid,
  });
  if (compactRoute) return compactRoute;

  const separatedDown = routeFromRect.y + routeFromRect.h + clearance < routeToRect.y - clearance;
  const separatedUp = routeToRect.y + routeToRect.h + clearance < routeFromRect.y - clearance;
  const minX = Math.min(routeFromRect.x, routeToRect.x);
  const maxX = Math.max(routeFromRect.x + routeFromRect.w, routeToRect.x + routeToRect.w);
  const leftLaneX = alignOutside(minX - clearance - laneSpread, grid, -1, snapToGrid) + shift;
  const rightLaneX = alignOutside(maxX + clearance + laneSpread, grid, 1, snapToGrid) + shift;
  const candidates = [];
  const addCandidate = (points) => candidates.push(points);

  if (end.x < start.x - grid && (separatedDown || separatedUp)) {
    const gapTop = separatedDown
      ? routeFromRect.y + routeFromRect.h + clearance
      : routeToRect.y + routeToRect.h + clearance;
    const gapBottom = separatedDown
      ? routeToRect.y - clearance
      : routeFromRect.y - clearance;
    const sourceOverTarget =
      routeFromRect.x < routeToRect.x + routeToRect.w && routeFromRect.x + routeFromRect.w > routeToRect.x;
    const compactSource = routeFromRect.w < routeToRect.w * 0.75;

    if (sourceOverTarget && compactSource) {
      const crossY = alignGrid((gapTop + gapBottom) / 2, grid, snapToGrid) + shift;
      addCandidate([
        start,
        stubFrom,
        { x: stubFrom.x, y: crossY },
        { x: leftLaneX, y: crossY },
        { x: leftLaneX, y: stubTo.y },
        stubTo,
        end,
      ]);
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const lanePad = clearance + attempt * grid * 2 + laneSpread;
      const attemptLeftLaneX = alignOutside(minX - lanePad, grid, -1, snapToGrid) + shift;
      const attemptRightLaneX = alignOutside(maxX + lanePad, grid, 1, snapToGrid) + shift;
      const crossY = alignGrid((gapTop + gapBottom) / 2, grid, snapToGrid) + shift;
      addCandidate([
        start,
        stubFrom,
        { x: attemptRightLaneX, y: stubFrom.y },
        { x: attemptRightLaneX, y: crossY },
        { x: attemptLeftLaneX, y: crossY },
        { x: attemptLeftLaneX, y: stubTo.y },
        stubTo,
        end,
      ]);
    }
  }

  const laneCandidates = collectLaneCandidates({
    stubFrom,
    stubTo,
    obstacleRects,
    clearance,
    grid,
    shift,
    laneSpread,
    snapToGrid,
  });
  addLaneCandidates(
    addCandidate,
    start,
    stubFrom,
    stubTo,
    end,
    uniqueSorted([leftLaneX, rightLaneX, ...laneCandidates.xLanes]),
    laneCandidates.yLanes
  );

  let points = chooseBestRoute(candidates, obstacleRects, routeFromRect, routeToRect, grid, 6);

  if (!points) {
    const gridRoute = findGridLaneRoute({
      stubFrom,
      stubTo,
      obstacleRects,
      xLanes: uniqueSorted([leftLaneX, rightLaneX, ...laneCandidates.xLanes]),
      yLanes: laneCandidates.yLanes,
      pad: 2,
    });
    if (gridRoute) {
      const candidate = simplifyCollinear([start, ...gridRoute, end]);
      if (
        !routeHitsBlockedArea(candidate, obstacleRects, routeFromRect, routeToRect, 2) &&
        !hasHardGeometryIssue(candidate, grid)
      ) {
        points = candidate;
      }
    }
  }

  if (!points && endpointManhattanLength <= localRouteLimit) {
    points = chooseBestRoute(
      localOrthogonalCandidates(start, end, grid, snapToGrid),
      obstacleRects,
      routeFromRect,
      routeToRect,
      grid,
      2
    );
  }

  if (!points && (separatedDown || separatedUp)) {
    const gapTop = separatedDown
      ? routeFromRect.y + routeFromRect.h + clearance
      : routeToRect.y + routeToRect.h + clearance;
    const gapBottom = separatedDown
      ? routeToRect.y - clearance
      : routeFromRect.y - clearance;
    const crossY = alignGrid((gapTop + gapBottom) / 2, grid, snapToGrid) + shift;
    const localGapRoute = simplifyCollinear([
      start,
      stubFrom,
      { x: stubFrom.x, y: crossY },
      { x: stubTo.x, y: crossY },
      stubTo,
      end,
    ]);
    if (
      !routeHitsBlockedArea(localGapRoute, obstacleRects, routeFromRect, routeToRect, 2) &&
      !hasHardGeometryIssue(localGapRoute, grid)
    ) {
      points = localGapRoute;
    }
  }

  if (!points) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const lanePad = clearance + laneSpread + attempt * grid * 4;
      const minObstacleX = Math.min(...obstacleRects.map((rect) => rect.x));
      const maxObstacleX = Math.max(...obstacleRects.map((rect) => rect.x + rect.w));
      const minObstacleY = Math.min(...obstacleRects.map((rect) => rect.y));
      const maxObstacleY = Math.max(...obstacleRects.map((rect) => rect.y + rect.h));
      const rescueCandidates = [];
      addLaneCandidates(
        (candidate) => rescueCandidates.push(candidate),
        start,
        stubFrom,
        stubTo,
        end,
        [
          alignOutside(minObstacleX - lanePad, grid, -1, snapToGrid) + shift,
          alignOutside(maxObstacleX + lanePad, grid, 1, snapToGrid) + shift,
        ],
        [
          alignOutside(minObstacleY - lanePad, grid, -1, snapToGrid) + shift,
          alignOutside(maxObstacleY + lanePad, grid, 1, snapToGrid) + shift,
        ]
      );
      points = chooseBestRoute(rescueCandidates, obstacleRects, routeFromRect, routeToRect, grid, 2);
      if (points) break;
    }
  }

  if (!points) {
    const maxBottom = Math.max(...obstacleRects.map((rect) => rect.y + rect.h));
    const bottomY = alignGrid(maxBottom + clearance + laneSpread, grid, snapToGrid) + shift;
    const bottomRoute = simplifyCollinear([
      start,
      stubFrom,
      { x: stubFrom.x, y: bottomY },
      { x: stubTo.x, y: bottomY },
      stubTo,
      end,
    ]);
    if (
      !routeHitsBlockedArea(bottomRoute, obstacleRects, routeFromRect, routeToRect, 2) &&
      !hasHardGeometryIssue(bottomRoute, grid)
    ) {
      points = bottomRoute;
    } else {
      const minTop = Math.min(...obstacleRects.map((rect) => rect.y));
      const topY = alignGrid(minTop - clearance - laneSpread, grid, snapToGrid) + shift;
      const topRoute = simplifyCollinear([
        start,
        stubFrom,
        { x: stubFrom.x, y: topY },
        { x: stubTo.x, y: topY },
        stubTo,
        end,
      ]);
      if (
        !routeHitsBlockedArea(topRoute, obstacleRects, routeFromRect, routeToRect, 2) &&
        !hasHardGeometryIssue(topRoute, grid)
      ) {
        points = topRoute;
      } else if (allowDirectionAlternates) {
        const alternate = findAlternateDirectionRoute({
          start,
          end,
          fromRect,
          toRect,
          preferredFDir,
          preferredTDir,
          rects,
          connections,
          conn,
          grid,
          stub,
          clearance,
          chamfer,
          snapToGrid,
          routeFromRect,
          routeToRect,
          obstacleRects,
        });
        if (alternate) return alternate;
        points = chooseFallbackRoute(
          [
            topRoute,
            bottomRoute,
            ...localOrthogonalCandidates(start, end, grid, snapToGrid),
          ],
          obstacleRects,
          routeFromRect,
          routeToRect,
          grid,
          2
        ) || bottomRoute;
      } else {
        points = chooseFallbackRoute([topRoute, bottomRoute], obstacleRects, routeFromRect, routeToRect, grid, 2) || bottomRoute;
      }
    }
  }

  const routed = buildPath(points, chamfer);
  return {
    path: routed.path,
    points: routed.points,
    arrow: midpointArrow(routed.points),
    strategy: 'pcb-lane',
  };
}
