import { CONNECTION_MARKER_METRICS } from '../tokens/scale.js';

const NON_MARKER_KINDS = new Set([
  'association',
  'containment',
  'reference',
  'secondary',
]);

export function resolveConnectionMarker(points, conn, options = {}) {
  const requestedRole = conn.design?.marker?.role || 'none';
  const kind = conn.kind || conn.type || '';
  const direction = conn.direction;
  const isDirected = direction === 'forward' || direction === 'reverse' || direction === 'both';
  const isPrimary = !NON_MARKER_KINDS.has(kind);
  const role = isDirected && isPrimary && (requestedRole === 'flow' || requestedRole === 'gate')
    ? requestedRole
    : 'none';

  const portClearance = options.portClearance ?? CONNECTION_MARKER_METRICS.portClearance;
  const bendClearance = options.bendClearance ?? CONNECTION_MARKER_METRICS.bendClearance;
  const labelClearance = options.labelClearance ?? CONNECTION_MARKER_METRICS.labelClearance;
  const minMarkerLength = options.minMarkerLength ?? CONNECTION_MARKER_METRICS.minMarkerLength;

  const hasLabel = Boolean(conn.label || conn.metadata?.label);

  const dists = [0];
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    totalLength += d;
    dists.push(totalLength);
  }

  const labelCenter = totalLength * 0.5;

  let bestSegmentIndex = -1;
  let bestSafeInterval = null;
  let bestSafeLength = -1;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const segmentLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (segmentLength < 1e-3) continue;

    let startSafe = 0;
    let endSafe = segmentLength;

    if (i === 0) {
      startSafe = Math.max(startSafe, portClearance);
    }
    if (i === points.length - 2) {
      endSafe = Math.min(endSafe, segmentLength - portClearance);
    }

    if (i > 0) {
      startSafe = Math.max(startSafe, bendClearance);
    }
    if (i < points.length - 2) {
      endSafe = Math.min(endSafe, segmentLength - bendClearance);
    }

    if (hasLabel) {
      const segStartDist = dists[i];
      const segEndDist = dists[i + 1];
      if (labelCenter >= segStartDist && labelCenter <= segEndDist) {
        const labelLocal = labelCenter - segStartDist;
        const leftLen = Math.max(0, (labelLocal - labelClearance) - startSafe);
        const rightLen = Math.max(0, endSafe - (labelLocal + labelClearance));
        if (leftLen >= rightLen && leftLen > 0) {
          endSafe = labelLocal - labelClearance;
        } else if (rightLen > 0) {
          startSafe = labelLocal + labelClearance;
        } else {
          startSafe = endSafe;
        }
      }
    }

    const safeLength = endSafe - startSafe;
    if (safeLength > minMarkerLength) {
      const localMid = (startSafe + endSafe) * 0.5;
      const midDistAlongRoute = dists[i] + localMid;
      const distToCenter = Math.abs(midDistAlongRoute - totalLength * 0.5);

      let isBetter = false;
      if (bestSegmentIndex === -1) {
        isBetter = true;
      } else if (safeLength > bestSafeLength + 1e-5) {
        isBetter = true;
      } else if (Math.abs(safeLength - bestSafeLength) < 1e-5) {
        const bestLocalMid = (bestSafeInterval.start + bestSafeInterval.end) * 0.5;
        const bestMidDist = dists[bestSegmentIndex] + bestLocalMid;
        const bestDistToCenter = Math.abs(bestMidDist - totalLength * 0.5);
        if (distToCenter < bestDistToCenter - 1e-5) {
          isBetter = true;
        } else if (Math.abs(distToCenter - bestDistToCenter) < 1e-5) {
          if (i < bestSegmentIndex) {
            isBetter = true;
          }
        }
      }

      if (isBetter) {
        bestSegmentIndex = i;
        bestSafeInterval = { start: startSafe, end: endSafe };
        bestSafeLength = safeLength;
      }
    }
  }

  const drawModel = {
    type: 'none',
    x: 0,
    y: 0,
    angle: 0,
    direction: conn.direction || 'none',
  };

  if (role !== 'none') {
    if (bestSegmentIndex !== -1) {
      const p1 = points[bestSegmentIndex];
      const p2 = points[bestSegmentIndex + 1];
      const localMid = (bestSafeInterval.start + bestSafeInterval.end) * 0.5;
      const segmentLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const ratio = localMid / segmentLength;

      drawModel.type = role;
      drawModel.x = p1.x + (p2.x - p1.x) * ratio;
      drawModel.y = p1.y + (p2.y - p1.y) * ratio;

      let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      if (conn.direction === 'reverse') {
        angle += Math.PI;
      }
      drawModel.angle = angle;
    }
  }

  return drawModel;
}

export function resolveContainmentJunctions(connections, routePointsById, options = {}) {
  const minTrunk = options.minTrunk ?? CONNECTION_MARKER_METRICS.minTrunk;
  const minTail = options.minTail ?? CONNECTION_MARKER_METRICS.minTail;

  const getPoints = (id) => {
    if (routePointsById instanceof Map) return routePointsById.get(id);
    if (routePointsById && typeof routePointsById === 'object') return routePointsById[id];
    return null;
  };

  const groups = new Map();
  for (const conn of connections) {
    const kind = conn.kind || conn.type || '';
    if (kind !== 'containment') continue;

    const from = conn.from || conn.source?.nodeId;
    const out = conn.out || conn.source?.portId || 'out';
    if (!from) continue;

    const key = `${from}::${out}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(conn);
  }

  const junctions = [];

  for (const [groupKey, groupConns] of groups.entries()) {
    if (groupConns.length < 2) continue;

    groupConns.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const candidates = [];

    for (let i = 0; i < groupConns.length; i++) {
      for (let j = i + 1; j < groupConns.length; j++) {
        const cA = groupConns[i];
        const cB = groupConns[j];
        const ptsA = getPoints(cA.id);
        const ptsB = getPoints(cB.id);
        if (!ptsA || ptsA.length < 2 || !ptsB || ptsB.length < 2) continue;

        const D = findMaxSharedTrunk(ptsA, ptsB);
        if (D < minTrunk) continue;

        const pBranch = getPointAtDistance(ptsA, D);
        candidates.push({ D, x: pBranch.x, y: pBranch.y, connections: [cA, cB] });
      }
    }

    const uniqueJunctions = [];
    for (const cand of candidates) {
      const sharing = [];
      for (const conn of groupConns) {
        const pts = getPoints(conn.id);
        if (!pts || pts.length < 2) continue;

        const pAtD = getPointAtDistance(pts, cand.D);
        if (Math.hypot(pAtD.x - cand.x, pAtD.y - cand.y) < 0.5) {
          const len = getRouteLength(pts);
          if (len - cand.D >= minTail) {
            sharing.push({ conn, pts });
          }
        }
      }

      if (sharing.length < 2) continue;

      if (!hasAtLeastTwoDistinctTangents(sharing.map(s => s.pts), cand.D)) {
        continue;
      }

      const connectionIds = sharing.map(s => String(s.conn.id)).sort();
      const ownerId = connectionIds[0];
      const duplicate = uniqueJunctions.find(j => Math.hypot(j.x - cand.x, j.y - cand.y) < 1.0);
      if (!duplicate) {
        uniqueJunctions.push({
          branchDistance: cand.D,
          ownerId,
          connectionIds,
          type: 'junction',
          x: cand.x,
          y: cand.y,
          angle: 0,
        });
      }
    }

    uniqueJunctions.sort((a, b) =>
      a.branchDistance - b.branchDistance
      || a.x - b.x
      || a.y - b.y
      || a.connectionIds.join('\u001f').localeCompare(b.connectionIds.join('\u001f'))
    );

    const occurrences = new Map();
    for (const junction of uniqueJunctions) {
      const signature = `${groupKey}\u001e${junction.connectionIds.join('\u001f')}`;
      const occurrence = occurrences.get(signature) || 0;
      occurrences.set(signature, occurrence + 1);
      const result = { ...junction };
      delete result.branchDistance;
      junctions.push({
        ...result,
        key: `junction::${encodeURIComponent(signature)}::${occurrence}`,
      });
    }
  }

  return junctions;
}

function getRouteLength(points) {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    len += Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y);
  }
  return len;
}

function getPointAtDistance(points, d) {
  if (points.length === 0) return { x: 0, y: 0 };
  if (d <= 0) return { x: points[0].x, y: points[0].y };
  let accum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (accum + segLen >= d) {
      const ratio = (d - accum) / segLen;
      return {
        x: p1.x + (p2.x - p1.x) * ratio,
        y: p1.y + (p2.y - p1.y) * ratio,
      };
    }
    accum += segLen;
  }
  return { x: points[points.length - 1].x, y: points[points.length - 1].y };
}

function getVertexDistances(points) {
  const dists = [0];
  let accum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    accum += Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y);
    dists.push(accum);
  }
  return dists;
}

function findMaxSharedTrunk(pointsA, pointsB) {
  const pA0 = pointsA[0];
  const pB0 = pointsB[0];
  if (Math.hypot(pA0.x - pB0.x, pA0.y - pB0.y) > 1.0) {
    return 0;
  }

  const distsA = getVertexDistances(pointsA);
  const distsB = getVertexDistances(pointsB);
  const lenA = distsA[distsA.length - 1];
  const lenB = distsB[distsB.length - 1];

  const allDists = [...new Set([...distsA, ...distsB])].sort((a, b) => a - b);
  let D = 0;
  for (let i = 1; i < allDists.length; i++) {
    const d = allDists[i];
    if (d > Math.min(lenA, lenB) + 1e-3) break;

    const pA = getPointAtDistance(pointsA, d);
    const pB = getPointAtDistance(pointsB, d);
    if (Math.hypot(pA.x - pB.x, pA.y - pB.y) < 0.5) {
      D = d;
    } else {
      break;
    }
  }
  return D;
}

function getOutgoingTangent(points, D) {
  const sampleDist = D + 5;
  const pBranch = getPointAtDistance(points, D);
  const pAhead = getPointAtDistance(points, sampleDist);
  const dx = pAhead.x - pBranch.x;
  const dy = pAhead.y - pBranch.y;
  const len = Math.hypot(dx, dy);
  return len > 1e-3 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
}

function hasAtLeastTwoDistinctTangents(routes, D) {
  const tangents = routes.map(r => getOutgoingTangent(r, D));
  for (let i = 0; i < tangents.length; i++) {
    for (let j = i + 1; j < tangents.length; j++) {
      const dot = tangents[i].x * tangents[j].x + tangents[i].y * tangents[j].y;
      if (dot < 0.95) { // cosine of ~18 degrees
        return true;
      }
    }
  }
  return false;
}


export function projectConnectionMarkerGeometry(marker) {
  if (!marker || marker.type === 'none') return [];

  if (marker.type === 'flow') {
    const width = CONNECTION_MARKER_METRICS.flowWidth;
    const height = CONNECTION_MARKER_METRICS.flowHeight;
    const primitives = [{
      type: 'rect',
      x: -width / 2,
      y: -height / 2,
      width,
      height,
      fill: 'trace',
    }];

    if (marker.direction === 'both') {
      const tip = CONNECTION_MARKER_METRICS.flowBidirectionalTipX;
      const base = CONNECTION_MARKER_METRICS.flowBidirectionalBaseX;
      const halfHeight = CONNECTION_MARKER_METRICS.flowBidirectionalHalfHeight;
      primitives.push(
        {
          type: 'polygon',
          points: [[-tip, 0], [-base, -halfHeight], [-base, halfHeight]],
          fill: 'background',
        },
        {
          type: 'polygon',
          points: [[tip, 0], [base, -halfHeight], [base, halfHeight]],
          fill: 'background',
        }
      );
    } else {
      primitives.push({
        type: 'polygon',
        points: [
          [CONNECTION_MARKER_METRICS.flowArrowTailX, -CONNECTION_MARKER_METRICS.flowArrowHalfHeight],
          [CONNECTION_MARKER_METRICS.flowArrowTipX, 0],
          [CONNECTION_MARKER_METRICS.flowArrowTailX, CONNECTION_MARKER_METRICS.flowArrowHalfHeight],
        ],
        fill: 'background',
      });
    }
    return primitives;
  }

  if (marker.type === 'junction') {
    return [{
      type: 'circle',
      x: 0,
      y: 0,
      radius: CONNECTION_MARKER_METRICS.junctionRadius,
      fill: 'trace',
    }];
  }

  if (marker.type === 'gate') {
    const size = CONNECTION_MARKER_METRICS.gateSize;
    return [{
      type: 'rect',
      x: -size / 2,
      y: -size / 2,
      width: size,
      height: size,
      fill: 'trace',
    }];
  }

  return [];
}

export function drawCanvasMarker(ctx, marker, traceColor, bgColor) {
  const primitives = projectConnectionMarkerGeometry(marker);
  if (primitives.length === 0) return;

  ctx.save();
  ctx.translate(marker.x, marker.y);
  ctx.rotate(marker.angle);
  ctx.strokeStyle = traceColor;

  for (const primitive of primitives) {
    ctx.fillStyle = primitive.fill === 'background' ? bgColor : traceColor;
    if (primitive.type === 'rect') {
      ctx.fillRect(primitive.x, primitive.y, primitive.width, primitive.height);
    } else if (primitive.type === 'circle') {
      ctx.beginPath();
      ctx.arc(primitive.x, primitive.y, primitive.radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (primitive.type === 'polygon') {
      ctx.beginPath();
      ctx.moveTo(primitive.points[0][0], primitive.points[0][1]);
      for (const point of primitive.points.slice(1)) {
        ctx.lineTo(point[0], point[1]);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}
