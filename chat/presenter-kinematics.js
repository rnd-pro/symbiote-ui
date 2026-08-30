export const PRESENTER_KINEMATICS_VERSION = 'symbiote-presenter-kinematics-v2';

export const PRESENTER_KINEMATIC_LIMITS = Object.freeze({
  minMovingSpeedPxPerMs: 1.6,
  targetSpeedPxPerMs: 3,
  maxSpeedPxPerMs: 3,
  minDurationMs: 220,
  baseWidthPx: 4.2,
  minWidthRatio: 0.7,
  maxWidthRatio: 1.3,
  noiseAmplitudePx: 1.8,
});

const UNDERDRAW_KINDS = new Set(['box', 'frame', 'label']);
const OVERLAP_KINDS = new Set(['oval', 'multi-oval', 'heart']);
const TIME_SAMPLE_COUNT = 240;
const GEOMETRY_TOLERANCE_PX = 0.12;
const MAX_GEOMETRY_DEPTH = 14;
const NORMALIZED_PATH_SAMPLE_COUNT = 128;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function finite(value, fallback) {
  let number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function point(value, name) {
  let x = Number(value?.x);
  let y = Number(value?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new TypeError(`${name} must return finite x and y coordinates`);
  }
  return { x, y };
}

export function normalizePresenterSeed(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value) >>> 0;
  let input = String(value ?? '0');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomUnit(seed, index) {
  let value = (seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x21f0aaad);
  value ^= value >>> 15;
  value = Math.imul(value, 0x735a2d97);
  value ^= value >>> 15;
  return (value >>> 0) / 4294967295;
}

function smoothNoise(seed, coordinate) {
  let index = Math.floor(coordinate);
  let fraction = coordinate - index;
  let eased = fraction * fraction * fraction * (fraction * (fraction * 6 - 15) + 10);
  let left = randomUnit(seed, index) * 2 - 1;
  let right = randomUnit(seed, index + 1) * 2 - 1;
  return left + (right - left) * eased;
}

function distance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function interpolate(left, right, progress) {
  return {
    x: left.x + (right.x - left.x) * progress,
    y: left.y + (right.y - left.y) * progress,
  };
}

function tailPolicy(kind, seed, baseWidthPx) {
  if (UNDERDRAW_KINDS.has(kind)) {
    let amount = 0.0475;
    return Object.freeze({ mode: 'underdraw', amount, sourceEnd: 1 - amount });
  }
  if (OVERLAP_KINDS.has(kind)) {
    let amount = 0.0375;
    return Object.freeze({
      mode: 'displaced-overlap',
      amount,
      sourceEnd: 1 + amount,
      lateralOffsetPx: baseWidthPx * 2.6,
      // Oval factories use clockwise screen-space winding, so the negative
      // normal keeps the closing tail outside the protected content.
      direction: -1,
    });
  }
  return Object.freeze({ mode: 'open', amount: 0, sourceEnd: 1 });
}

function pointSegmentDistance(sample, left, right) {
  let dx = right.x - left.x;
  let dy = right.y - left.y;
  let lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return distance(sample, left);
  let ratio = clamp(((sample.x - left.x) * dx + (sample.y - left.y) * dy) / lengthSquared, 0, 1);
  return distance(sample, { x: left.x + dx * ratio, y: left.y + dy * ratio });
}

function adaptiveParametricSamples(pointAt, sourceEnd, tolerancePx = GEOMETRY_TOLERANCE_PX) {
  let cache = new Map();
  let resolve = (parameter) => {
    let key = parameter.toPrecision(17);
    if (!cache.has(key)) cache.set(key, point(pointAt(parameter), 'pointAt(progress)'));
    return cache.get(key);
  };
  let first = resolve(0);
  let samples = [first];
  let subdivide = (leftT, left, rightT, right, depth) => {
    let span = rightT - leftT;
    let quarterT = leftT + span * 0.25;
    let middleT = leftT + span * 0.5;
    let threeQuarterT = leftT + span * 0.75;
    let quarter = resolve(quarterT);
    let middle = resolve(middleT);
    let threeQuarter = resolve(threeQuarterT);
    let flatness = Math.max(
      pointSegmentDistance(quarter, left, right),
      pointSegmentDistance(middle, left, right),
      pointSegmentDistance(threeQuarter, left, right),
    );
    let excess = distance(left, quarter) + distance(quarter, middle)
      + distance(middle, threeQuarter) + distance(threeQuarter, right)
      - distance(left, right);
    if (depth >= MAX_GEOMETRY_DEPTH || (flatness <= tolerancePx && excess <= tolerancePx)) {
      samples.push(right);
      return;
    }
    subdivide(leftT, left, middleT, middle, depth + 1);
    subdivide(middleT, middle, rightT, right, depth + 1);
  };
  subdivide(0, first, sourceEnd, resolve(sourceEnd), 0);
  return samples;
}

function resampleSpatially(points, count) {
  let metrics = spatialMetrics(points);
  let samples = [];
  for (let index = 0; index <= count; index += 1) {
    let sample = sampleAtDistance(metrics.samples, metrics.arcLengthPx, metrics.arcLengthPx * index / count);
    samples.push({ x: sample.x, y: sample.y });
  }
  return samples;
}

function sourceAnchors(pointAt, policy) {
  let samplePoint = pointAt;
  if (policy.mode === 'displaced-overlap') {
    let start = 1 - policy.amount * 2;
    samplePoint = (parameter) => {
      let center = point(pointAt(parameter), 'pointAt(progress)');
      if (parameter <= start) return center;
      let epsilon = 0.0005;
      let before = point(pointAt(Math.max(0, parameter - epsilon)), 'pointAt(progress)');
      let after = point(
        pointAt(Math.min(policy.sourceEnd, parameter + epsilon)),
        'pointAt(progress)',
      );
      let dx = after.x - before.x;
      let dy = after.y - before.y;
      let magnitude = Math.hypot(dx, dy) || 1;
      let progress = clamp((parameter - start) / (policy.sourceEnd - start), 0, 1);
      let eased = progress * progress * (3 - 2 * progress);
      let offset = policy.lateralOffsetPx * eased * policy.direction;
      return {
        x: center.x - dy / magnitude * offset,
        y: center.y + dx / magnitude * offset,
      };
    };
  }
  let adaptive = adaptiveParametricSamples(samplePoint, policy.sourceEnd);
  let length = spatialMetrics(adaptive).arcLengthPx;
  let count = clamp(Math.ceil(length / 18), 16, 96);
  return {
    anchors: resampleSpatially(adaptive, count),
    sourceSamples: adaptive,
  };
}

function knot(previous, next, current) {
  return current + Math.sqrt(Math.max(0.000001, distance(previous, next)));
}

function knotBlend(left, right, time, leftTime, rightTime) {
  let span = rightTime - leftTime;
  if (Math.abs(span) < 0.000001) return { ...left };
  let ratio = (time - leftTime) / span;
  return interpolate(left, right, ratio);
}

function centripetalPoint(p0, p1, p2, p3, progress) {
  let t0 = 0;
  let t1 = knot(p0, p1, t0);
  let t2 = knot(p1, p2, t1);
  let t3 = knot(p2, p3, t2);
  let time = t1 + (t2 - t1) * progress;
  let a1 = knotBlend(p0, p1, time, t0, t1);
  let a2 = knotBlend(p1, p2, time, t1, t2);
  let a3 = knotBlend(p2, p3, time, t2, t3);
  let b1 = knotBlend(a1, a2, time, t0, t2);
  let b2 = knotBlend(a2, a3, time, t1, t3);
  return knotBlend(b1, b2, time, t1, t2);
}

function smoothAnchors(anchors) {
  let samples = [{ ...anchors[0] }];
  for (let index = 0; index < anchors.length - 1; index += 1) {
    let p1 = anchors[index];
    let p2 = anchors[index + 1];
    let p0 = anchors[Math.max(0, index - 1)];
    let p3 = anchors[Math.min(anchors.length - 1, index + 2)];
    let sample = (progress) => centripetalPoint(p0, p1, p2, p3, progress);
    let subdivide = (leftT, left, rightT, right, depth) => {
      let span = rightT - leftT;
      let quarter = sample(leftT + span * 0.25);
      let middleT = leftT + span * 0.5;
      let middle = sample(middleT);
      let threeQuarter = sample(leftT + span * 0.75);
      let flatness = Math.max(
        pointSegmentDistance(quarter, left, right),
        pointSegmentDistance(middle, left, right),
        pointSegmentDistance(threeQuarter, left, right),
      );
      let excess = distance(left, quarter) + distance(quarter, middle)
        + distance(middle, threeQuarter) + distance(threeQuarter, right)
        - distance(left, right);
      if (depth >= MAX_GEOMETRY_DEPTH || (flatness <= GEOMETRY_TOLERANCE_PX && excess <= GEOMETRY_TOLERANCE_PX)) {
        samples.push(right);
        return;
      }
      subdivide(leftT, left, middleT, middle, depth + 1);
      subdivide(middleT, middle, rightT, right, depth + 1);
    };
    subdivide(0, p1, 1, p2, 0);
  }
  return samples;
}

function spatialVariation(samples, seed, amplitude) {
  if (!amplitude) return samples.map((sample) => ({ ...sample }));
  return samples.map((sample, index) => {
    let previous = samples[Math.max(0, index - 1)];
    let next = samples[Math.min(samples.length - 1, index + 1)];
    let dx = next.x - previous.x;
    let dy = next.y - previous.y;
    let magnitude = Math.hypot(dx, dy) || 1;
    let progress = clamp(finite(sample.progress, 0), 0, 1);
    let envelope = 0.35 + Math.pow(Math.sin(progress * Math.PI), 2) * 0.65;
    let low = smoothNoise(seed, progress * 3.25 + 11.7);
    let high = smoothNoise(seed ^ 0xa53a9e7d, progress * 8.5 + 3.1);
    let offset = (low * 0.76 + high * 0.24) * amplitude * envelope;
    return {
      x: sample.x - dy / magnitude * offset,
      y: sample.y + dx / magnitude * offset,
    };
  });
}

function spatialMetrics(points) {
  let samples = [];
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    if (index) total += distance(points[index - 1], points[index]);
    samples.push({ ...points[index], distancePx: total, progress: 0, curvature: 0 });
  }
  for (let sample of samples) sample.progress = total ? sample.distancePx / total : 0;
  for (let index = 1; index < samples.length - 1; index += 1) {
    let previous = samples[index - 1];
    let current = samples[index];
    let next = samples[index + 1];
    let a = distance(previous, current);
    let b = distance(current, next);
    let c = distance(previous, next);
    let twiceArea = Math.abs(
      (current.x - previous.x) * (next.y - previous.y)
      - (current.y - previous.y) * (next.x - previous.x),
    );
    samples[index].curvature = a && b && c ? 2 * twiceArea / (a * b * c) : 0;
  }
  if (samples.length > 1) {
    samples[0].curvature = samples[1].curvature;
    samples.at(-1).curvature = samples.at(-2).curvature;
  }
  return { samples, arcLengthPx: total };
}

function sampleAtDistance(samples, arcLengthPx, distancePx) {
  let target = clamp(finite(distancePx, 0), 0, arcLengthPx);
  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    let middle = Math.floor((low + high) / 2);
    if (samples[middle].distancePx < target) low = middle + 1;
    else high = middle;
  }
  let right = samples[low];
  let left = samples[Math.max(0, low - 1)];
  let span = right.distancePx - left.distancePx;
  let ratio = span > 0 ? (target - left.distancePx) / span : 0;
  return {
    ...interpolate(left, right, ratio),
    distancePx: target,
    progress: arcLengthPx ? target / arcLengthPx : 1,
    curvature: finite(left.curvature, 0) + (finite(right.curvature, 0) - finite(left.curvature, 0)) * ratio,
    widthPx: finite(left.widthPx, 0) + (finite(right.widthPx, 0) - finite(left.widthPx, 0)) * ratio,
  };
}

function minimumJerk(progress) {
  let value = clamp(progress, 0, 1);
  return value * value * value * (10 + value * (-15 + value * 6));
}

function localSpeedCap(sample, limits) {
  let curvature = clamp(sample.curvature * 24, 0, 1);
  return Math.max(
    limits.minMovingSpeedPxPerMs,
    limits.targetSpeedPxPerMs * (1 - curvature * 0.46),
  );
}

function createTimeTable(samples, arcLengthPx, limits) {
  if (!arcLengthPx) return [{ timeMs: 0, distancePx: 0, speedPxPerMs: 0 }];
  let baseDuration = Math.max(
    limits.minDurationMs,
    1.875 * arcLengthPx / limits.targetSpeedPxPerMs,
    1.875 * arcLengthPx / limits.maxSpeedPxPerMs,
  );
  let table = [{ timeMs: 0, distancePx: 0, speedPxPerMs: 0 }];
  let timeMs = 0;
  let previousDistance = 0;
  for (let index = 1; index <= TIME_SAMPLE_COUNT; index += 1) {
    let progress = index / TIME_SAMPLE_COUNT;
    let distancePx = minimumJerk(progress) * arcLengthPx;
    let spatial = sampleAtDistance(samples, arcLengthPx, (previousDistance + distancePx) / 2);
    let cap = Math.min(limits.maxSpeedPxPerMs, localSpeedCap(spatial, limits));
    let deltaDistance = distancePx - previousDistance;
    let deltaTime = Math.max(baseDuration / TIME_SAMPLE_COUNT, deltaDistance / cap);
    timeMs += deltaTime;
    table.push({
      timeMs,
      distancePx,
      speedPxPerMs: deltaDistance / deltaTime,
    });
    previousDistance = distancePx;
  }
  if (timeMs < limits.minDurationMs) {
    let scale = limits.minDurationMs / timeMs;
    for (let sample of table) {
      sample.timeMs *= scale;
      sample.speedPxPerMs /= scale;
    }
    table.at(-1).timeMs = limits.minDurationMs;
  }
  table[0].speedPxPerMs = 0;
  table.at(-1).speedPxPerMs = 0;
  return table;
}

function createConstantSpeedTimeTable(arcLengthPx, speedPxPerMs) {
  if (!arcLengthPx) return [{ timeMs: 0, distancePx: 0, speedPxPerMs: 0 }];
  return [
    { timeMs: 0, distancePx: 0, speedPxPerMs: 0 },
    {
      timeMs: arcLengthPx / speedPxPerMs,
      distancePx: arcLengthPx,
      speedPxPerMs,
    },
  ];
}

function widthProfile(samples, seed, limits, baseWidthPx) {
  let widths = samples.map((sample) => {
    let curvature = clamp(sample.curvature * 120, 0, 1);
    let speed = localSpeedCap(sample, limits) / limits.maxSpeedPxPerMs;
    let pressure = 0.52 + curvature * 0.35 - speed * 0.18
      + smoothNoise(seed ^ 0x4f1bbcdc, sample.progress * 3.5 + 2.7) * 0.06;
    return clamp(
      baseWidthPx * (0.72 + pressure * 0.58),
      baseWidthPx * limits.minWidthRatio,
      baseWidthPx * limits.maxWidthRatio,
    );
  });
  for (let pass = 0; pass < 2; pass += 1) {
    widths = widths.map((value, index) => {
      let previous = widths[Math.max(0, index - 1)];
      let next = widths[Math.min(widths.length - 1, index + 1)];
      return previous * 0.25 + value * 0.5 + next * 0.25;
    });
  }
  return widths;
}

function bounds(samples) {
  let xs = samples.map((sample) => sample.x);
  let ys = samples.map((sample) => sample.y);
  let left = Math.min(...xs);
  let top = Math.min(...ys);
  let right = Math.max(...xs);
  let bottom = Math.max(...ys);
  return Object.freeze({ left, top, right, bottom, width: right - left, height: bottom - top });
}

function canonicalPathSamples(samples, arcLengthPx) {
  let normalized = [];
  for (let index = 0; index <= NORMALIZED_PATH_SAMPLE_COUNT; index += 1) {
    let sample = sampleAtDistance(samples, arcLengthPx, arcLengthPx * index / NORMALIZED_PATH_SAMPLE_COUNT);
    normalized.push(Object.freeze({ x: sample.x, y: sample.y, widthPx: sample.widthPx }));
  }
  return Object.freeze(normalized);
}

function planHash(kind, policy, seed, samples, sourceBounds) {
  let width = Math.max(1, sourceBounds.width);
  let height = Math.max(1, sourceBounds.height);
  let normalized = samples.map((sample) => ({
    x: (sample.x - sourceBounds.left) / width,
    y: (sample.y - sourceBounds.top) / height,
  }));
  let count = Math.max(1, normalized.length);
  let moments = normalized.reduce((result, sample) => ({
    x: result.x + sample.x,
    y: result.y + sample.y,
    xx: result.xx + sample.x * sample.x,
    yy: result.yy + sample.y * sample.y,
    xy: result.xy + sample.x * sample.y,
  }), { x: 0, y: 0, xx: 0, yy: 0, xy: 0 });
  let signature = Object.values(moments).map((value) => Math.round(value / count * 100));
  let input = JSON.stringify([
    PRESENTER_KINEMATICS_VERSION,
    kind,
    policy.mode,
    seed,
    signature,
  ]);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function centerlinePath(samples) {
  if (samples.length < 2) return '';
  return samples.map((sample, index) => (
    `${index ? 'L' : 'M'}${sample.x.toFixed(2)} ${sample.y.toFixed(2)}`
  )).join('');
}

function ribbonPath(samples) {
  if (samples.length < 2) return '';
  let left = [];
  let right = [];
  for (let index = 0; index < samples.length; index += 1) {
    let previous = samples[Math.max(0, index - 1)];
    let next = samples[Math.min(samples.length - 1, index + 1)];
    let dx = next.x - previous.x;
    let dy = next.y - previous.y;
    let magnitude = Math.hypot(dx, dy) || 1;
    let half = samples[index].widthPx / 2;
    let offsetX = -dy / magnitude * half;
    let offsetY = dx / magnitude * half;
    left.push({ x: samples[index].x + offsetX, y: samples[index].y + offsetY });
    right.push({ x: samples[index].x - offsetX, y: samples[index].y - offsetY });
  }
  let first = samples[0];
  let second = samples[1];
  let last = samples.at(-1);
  let beforeLast = samples.at(-2);
  let startMagnitude = Math.hypot(second.x - first.x, second.y - first.y) || 1;
  let endMagnitude = Math.hypot(last.x - beforeLast.x, last.y - beforeLast.y) || 1;
  let startRadius = first.widthPx / 2;
  let endRadius = last.widthPx / 2;
  let startTangent = {
    x: (second.x - first.x) / startMagnitude,
    y: (second.y - first.y) / startMagnitude,
  };
  let endTangent = {
    x: (last.x - beforeLast.x) / endMagnitude,
    y: (last.y - beforeLast.y) / endMagnitude,
  };
  let startNormal = { x: -startTangent.y, y: startTangent.x };
  let endNormal = { x: -endTangent.y, y: endTangent.x };
  let startTip = {
    x: first.x - startTangent.x * startRadius,
    y: first.y - startTangent.y * startRadius,
  };
  let endTip = {
    x: last.x + endTangent.x * endRadius,
    y: last.y + endTangent.y * endRadius,
  };
  let leftPath = left.map((sample, index) => (
    `${index ? 'L' : 'M'}${sample.x.toFixed(2)} ${sample.y.toFixed(2)}`
  )).join('');
  let reverseRight = right.reverse();
  let rightStart = reverseRight[0];
  let rightEnd = reverseRight.at(-1);
  let rightPath = reverseRight.slice(1)
    .map((sample) => `L${sample.x.toFixed(2)} ${sample.y.toFixed(2)}`)
    .join('');
  const kappa = 0.5522847498;
  let endControl = endRadius * kappa;
  let startControl = startRadius * kappa;
  let endCap = `C${(left.at(-1).x + endTangent.x * endControl).toFixed(2)} `
    + `${(left.at(-1).y + endTangent.y * endControl).toFixed(2)} `
    + `${(endTip.x + endNormal.x * endControl).toFixed(2)} `
    + `${(endTip.y + endNormal.y * endControl).toFixed(2)} `
    + `${endTip.x.toFixed(2)} ${endTip.y.toFixed(2)}`
    + `C${(endTip.x - endNormal.x * endControl).toFixed(2)} `
    + `${(endTip.y - endNormal.y * endControl).toFixed(2)} `
    + `${(rightStart.x + endTangent.x * endControl).toFixed(2)} `
    + `${(rightStart.y + endTangent.y * endControl).toFixed(2)} `
    + `${rightStart.x.toFixed(2)} ${rightStart.y.toFixed(2)}`;
  let startCap = `C${(rightEnd.x - startTangent.x * startControl).toFixed(2)} `
    + `${(rightEnd.y - startTangent.y * startControl).toFixed(2)} `
    + `${(startTip.x - startNormal.x * startControl).toFixed(2)} `
    + `${(startTip.y - startNormal.y * startControl).toFixed(2)} `
    + `${startTip.x.toFixed(2)} ${startTip.y.toFixed(2)}`
    + `C${(startTip.x + startNormal.x * startControl).toFixed(2)} `
    + `${(startTip.y + startNormal.y * startControl).toFixed(2)} `
    + `${(left[0].x - startTangent.x * startControl).toFixed(2)} `
    + `${(left[0].y - startTangent.y * startControl).toFixed(2)} `
    + `${left[0].x.toFixed(2)} ${left[0].y.toFixed(2)}`;
  return `${leftPath}${endCap}${rightPath}${startCap}Z`;
}

function partialSamples(plan, distancePx) {
  let target = clamp(distancePx, 0, plan.arcLengthPx);
  if (target <= 0) return [];
  let samples = plan.samples.filter((sample) => sample.distancePx < target)
    .map((sample) => ({ ...sample }));
  samples.push(sampleAtDistance(plan.samples, plan.arcLengthPx, target));
  return samples;
}

/**
 * @param {{kind?:string, seed?:string|number, pointAt:Function, style?:object,
 *   noiseAmplitudePx?:number}} request
 * @returns {object}
 */
export function createPresenterKinematicPlan(request = {}) {
  if (typeof request.pointAt !== 'function') {
    throw new TypeError('presenter kinematics requires pointAt(progress)');
  }
  let kind = String(request.kind || 'freehand').trim().toLowerCase();
  let seed = normalizePresenterSeed(request.seed);
  let style = request.style && typeof request.style === 'object' ? request.style : {};
  let constantSpeedPxPerMs = clamp(
    finite(style.constantSpeedPxPerMs, 0),
    0,
    PRESENTER_KINEMATIC_LIMITS.maxSpeedPxPerMs,
  );
  let limits = {
    minMovingSpeedPxPerMs: clamp(
      finite(style.minMovingSpeedPxPerMs, PRESENTER_KINEMATIC_LIMITS.minMovingSpeedPxPerMs),
      0.001,
      PRESENTER_KINEMATIC_LIMITS.maxSpeedPxPerMs,
    ),
    targetSpeedPxPerMs: clamp(
      finite(style.targetSpeedPxPerMs, PRESENTER_KINEMATIC_LIMITS.targetSpeedPxPerMs),
      0.001,
      PRESENTER_KINEMATIC_LIMITS.maxSpeedPxPerMs,
    ),
    maxSpeedPxPerMs: clamp(
      finite(style.maxSpeedPxPerMs, PRESENTER_KINEMATIC_LIMITS.maxSpeedPxPerMs),
      0.001,
      PRESENTER_KINEMATIC_LIMITS.maxSpeedPxPerMs,
    ),
    minDurationMs: Math.max(1, finite(style.minDurationMs, PRESENTER_KINEMATIC_LIMITS.minDurationMs)),
    minWidthRatio: PRESENTER_KINEMATIC_LIMITS.minWidthRatio,
    maxWidthRatio: PRESENTER_KINEMATIC_LIMITS.maxWidthRatio,
  };
  limits.targetSpeedPxPerMs = Math.min(limits.targetSpeedPxPerMs, limits.maxSpeedPxPerMs);
  limits.minMovingSpeedPxPerMs = Math.min(
    limits.minMovingSpeedPxPerMs,
    limits.targetSpeedPxPerMs,
  );
  if (constantSpeedPxPerMs > 0) {
    limits.minMovingSpeedPxPerMs = constantSpeedPxPerMs;
    limits.targetSpeedPxPerMs = constantSpeedPxPerMs;
    limits.maxSpeedPxPerMs = constantSpeedPxPerMs;
  }
  let baseWidthPx = Math.max(0.5, finite(style.baseWidthPx, PRESENTER_KINEMATIC_LIMITS.baseWidthPx));
  let noiseAmplitudePx = clamp(
    finite(request.noiseAmplitudePx, finite(style.noiseAmplitudePx, PRESENTER_KINEMATIC_LIMITS.noiseAmplitudePx)),
    0,
    3,
  );
  let policy = tailPolicy(kind, seed, baseWidthPx);
  let source = sourceAnchors(request.pointAt, policy);
  let anchors = source.anchors;
  let sourceBounds = bounds(source.sourceSamples);
  let smooth = smoothAnchors(anchors);
  let semanticMetrics = spatialMetrics(smooth);
  let varied = spatialVariation(semanticMetrics.samples, seed, noiseAmplitudePx);
  let metrics = spatialMetrics(varied);
  let widths = widthProfile(metrics.samples, seed, limits, baseWidthPx);
  for (let index = 0; index < metrics.samples.length; index += 1) {
    metrics.samples[index].widthPx = widths[index];
  }
  let timeTable;
  let motionProfile;
  if (constantSpeedPxPerMs > 0) {
    motionProfile = 'constant-speed';
    timeTable = createConstantSpeedTimeTable(metrics.arcLengthPx, constantSpeedPxPerMs);
  } else {
    motionProfile = 'minimum-jerk';
    let semanticTimeTable = createTimeTable(
      semanticMetrics.samples,
      semanticMetrics.arcLengthPx,
      limits,
    );
    let distanceScale = semanticMetrics.arcLengthPx
      ? metrics.arcLengthPx / semanticMetrics.arcLengthPx
      : 1;
    timeTable = semanticTimeTable.map((sample) => ({
      ...sample,
      distancePx: sample.distancePx * distanceScale,
      speedPxPerMs: sample.speedPxPerMs * distanceScale,
    }));
  }
  let planBounds = bounds(metrics.samples);
  let frozenSamples = Object.freeze(metrics.samples.map((sample) => Object.freeze({ ...sample })));
  let frozenTime = Object.freeze(timeTable.map((sample) => Object.freeze({ ...sample })));
  let normalizedPath = canonicalPathSamples(frozenSamples, metrics.arcLengthPx);
  let result = {
    version: PRESENTER_KINEMATICS_VERSION,
    kind,
    motionProfile,
    seed,
    tailPolicy: policy,
    samples: frozenSamples,
    timeTable: frozenTime,
    arcLengthPx: metrics.arcLengthPx,
    durationMs: timeTable.at(-1).timeMs,
    baseWidthPx,
    minWidthPx: Math.min(...widths),
    maxWidthPx: Math.max(...widths),
    noiseAmplitudePx,
    geometryTolerancePx: GEOMETRY_TOLERANCE_PX,
    normalizedPath,
    bounds: planBounds,
    limits: Object.freeze({ ...limits }),
    maxObservedSpeedPxPerMs: Math.max(...timeTable.map((sample) => sample.speedPxPerMs)),
  };
  result.pathHash = planHash(kind, policy, seed, normalizedPath, sourceBounds);
  result.normalizedPathHash = result.pathHash;
  result.centerlinePath = centerlinePath(frozenSamples);
  result.ribbonPath = ribbonPath(frozenSamples);
  return Object.freeze(result);
}

/**
 * @param {object} plan
 * @param {number} elapsedMs
 * @returns {object}
 */
export function samplePresenterKinematicPlan(plan, elapsedMs = 0) {
  if (!plan?.timeTable || !plan?.samples) {
    throw new TypeError('samplePresenterKinematicPlan requires a presenter kinematic plan');
  }
  let elapsed = clamp(finite(elapsedMs, 0), 0, plan.durationMs);
  let low = 0;
  let high = plan.timeTable.length - 1;
  while (low < high) {
    let middle = Math.floor((low + high) / 2);
    if (plan.timeTable[middle].timeMs < elapsed) low = middle + 1;
    else high = middle;
  }
  let right = plan.timeTable[low];
  let left = plan.timeTable[Math.max(0, low - 1)];
  let span = right.timeMs - left.timeMs;
  let ratio = span > 0 ? (elapsed - left.timeMs) / span : 0;
  let distancePx = left.distancePx + (right.distancePx - left.distancePx) * ratio;
  let completed = elapsed >= plan.durationMs;
  if (completed) distancePx = plan.arcLengthPx;
  let pointAtTime = sampleAtDistance(plan.samples, plan.arcLengthPx, distancePx);
  let visibleSamples = partialSamples(plan, distancePx);
  return Object.freeze({
    elapsedMs: elapsed,
    durationMs: plan.durationMs,
    progress: completed ? 1 : (plan.arcLengthPx ? distancePx / plan.arcLengthPx : 1),
    timelineProgress: plan.durationMs ? elapsed / plan.durationMs : 1,
    distancePx,
    point: Object.freeze({ x: pointAtTime.x, y: pointAtTime.y }),
    widthPx: pointAtTime.widthPx,
    speedPxPerMs: elapsed <= 0 || completed ? 0 : right.speedPxPerMs,
    completed,
    pathHash: plan.pathHash,
    normalizedPathHash: plan.normalizedPathHash,
    samples: Object.freeze(visibleSamples.map((sample) => Object.freeze({ ...sample }))),
    centerlinePath: centerlinePath(visibleSamples),
    ribbonPath: ribbonPath(visibleSamples),
  });
}
