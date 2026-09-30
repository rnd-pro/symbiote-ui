import { SHOW_MARKER_SHAPES } from './show-contracts.js';
import {
  PRESENTER_KINEMATIC_LIMITS,
  createPresenterKinematicPlan,
  normalizePresenterSeed,
} from './presenter-kinematics.js';

export const PRESENTER_MARKER_GEOMETRY_VERSION = 'symbiote-presenter-marker-geometry-v1';

export const PRESENTER_MARKER_GEOMETRY_CONSTANTS = Object.freeze({
  cursorSizePx: 18,
  inkCursorSizePx: 4,
  collisionAllowancePx: 4.4,
  targetInsetPx: 8,
  gestureJitterPx: 2.4,
  protectedContentClearancePx: 4,
  drawSpeedPxPerMs: 0.471,
});

const CORE_MARKERS = new Set([
  'freehand',
  'underline',
  'oval',
  'multi-oval',
  'arrow',
  'converging-arrows',
  'route',
]);

const MARKER_METADATA = Object.freeze({
  freehand: ['loose emphasis beneath a target', 'exterior'],
  underline: ['text or value emphasis', 'exterior'],
  oval: ['one protected group or decision', 'enclosure'],
  'multi-oval': ['strong repeated group emphasis', 'enclosure'],
  arrow: ['directional pointer to one target', 'exterior'],
  'converging-arrows': ['two inputs converging on one point', 'exterior'],
  route: ['ordered flow or traversal', 'exterior'],
  'bidirectional-route': ['two-way exchange or feedback', 'exterior'],
  'parallel-route': ['parallel work or independent tracks', 'exterior'],
  label: ['named bounded region', 'enclosure'],
  number: ['ordered step or sequence rank', 'exterior'],
  box: ['precise bounded region', 'enclosure'],
  bracket: ['section or grouped rows', 'exterior'],
  slash: ['intentional rejection or cancellation overlay', 'intentional-overlay'],
});

export const PRESENTER_MARKER_CATALOG = Object.freeze(SHOW_MARKER_SHAPES.map((name) => Object.freeze({
  name,
  semantics: MARKER_METADATA[name]?.[0] || name,
  safetyPolicy: MARKER_METADATA[name]?.[1] || 'exterior',
  contractTier: CORE_MARKERS.has(name) ? 'core' : 'extended',
})));

const CATALOG_BY_NAME = new Map(PRESENTER_MARKER_CATALOG.map((entry) => [entry.name, entry]));

function noise(seed, phase) {
  let value = Math.sin(seed * 12.9898 + phase * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function variation(seed, salt) {
  return noise(seed * 0.37 + 1, salt * 1.7);
}

function smoothStep(value) {
  let clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function normalizeRect(value = {}) {
  let left = Number(value.left);
  let top = Number(value.top);
  let width = Number(value.width);
  let height = Number(value.height);
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new TypeError('presenter marker targetRect requires finite positive left, top, width, and height');
  }
  return Object.freeze({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  });
}

function viewportRect(value = {}) {
  let width = Number(value.width);
  let height = Number(value.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;
  return { left: 0, top: 0, right: width, bottom: height, width, height };
}

function clampPoint(point, viewport = {}) {
  let bounds = viewportRect(viewport);
  if (!bounds) return point;
  return {
    x: Math.max(bounds.left, Math.min(bounds.right, point.x)),
    y: Math.max(bounds.top, Math.min(bounds.bottom, point.y)),
  };
}

function semanticMarkerSeed(marker) {
  let value = `marker:${marker}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pointListPlan(points, rest = points[points.length - 1], loops = 0) {
  return {
    loops,
    rest,
    point(progress) {
      let total = points.length - 1;
      let scaled = Math.min(total - 0.001, Math.max(0, progress) * total);
      let index = Math.floor(scaled);
      let local = scaled - index;
      let left = points[index];
      let right = points[index + 1];
      return {
        x: left.x + (right.x - left.x) * local,
        y: left.y + (right.y - left.y) * local,
      };
    },
  };
}

function createOvalPass(rect, seed, pass = 0) {
  let shortSide = Math.min(rect.width, rect.height);
  let expressiveGap = 1.5 + Math.min(4.5, Math.max(0, shortSide - 24) * 0.075);
  let targetInset = Math.min(
    PRESENTER_MARKER_GEOMETRY_CONSTANTS.targetInsetPx,
    shortSide * 0.25,
  );
  let jitterScale = Math.max(0.4, Math.min(1, shortSide / 80));
  let verticalSafetyGap = PRESENTER_MARKER_GEOMETRY_CONSTANTS.inkCursorSizePx / 2
    + PRESENTER_MARKER_GEOMETRY_CONSTANTS.collisionAllowancePx
    + PRESENTER_MARKER_GEOMETRY_CONSTANTS.gestureJitterPx * jitterScale
    - targetInset
    + 0.75;
  let horizontalSafetyGap = verticalSafetyGap
    + PRESENTER_MARKER_GEOMETRY_CONSTANTS.inkCursorSizePx / 2
    + PRESENTER_KINEMATIC_LIMITS.noiseAmplitudePx
    + 0.75;
  let horizontalGap = Math.max(expressiveGap, horizontalSafetyGap);
  let verticalGap = Math.max(expressiveGap, verticalSafetyGap);
  let passSeed = normalizePresenterSeed(`${seed}:oval-pass:${pass}`);
  let unitVariation = (salt) => variation(passSeed, salt) * 0.5 + 0.5;
  let wideBlend = smoothStep((rect.width / Math.max(1, rect.height) - 3) / 2.5);
  let sizeBlend = smoothStep((shortSide - 24) / 56);
  let centerVariationScale = sizeBlend * (1 - wideBlend * 0.92);
  let tiltVariationScale = sizeBlend * (1 - wideBlend * 0.98);
  let horizontalVariation = Math.min(9, rect.width * 0.035) * (1 - wideBlend * 0.6);
  let radiusX = rect.width / 2 + horizontalGap + 0.5
    + sizeBlend * (4 + unitVariation(201) * horizontalVariation);
  let radiusY = rect.height / 2 + verticalGap
    + sizeBlend * (4 + unitVariation(203) * Math.min(7, rect.height * 0.07));
  let centerX = rect.left + rect.width / 2
    + variation(passSeed, 205) * 2.4 * centerVariationScale;
  let centerY = rect.top + rect.height / 2
    + variation(passSeed, 207) * 2 * centerVariationScale;
  let tilt = variation(passSeed, 209) * 0.075 * tiltVariationScale;
  let compactRoundness = 0.24 + unitVariation(211) * 0.18;
  let wideRoundness = 0.22 + unitVariation(211) * 0.12;
  let roundness = compactRoundness + (wideRoundness - compactRoundness) * wideBlend;

  if (pass > 0) {
    radiusX += 3.5 + unitVariation(213) * 3.5;
    radiusY += 3 + unitVariation(215) * 3;
    centerX += variation(passSeed, 217) * 1.8 * centerVariationScale;
    centerY += variation(passSeed, 219) * 1.5 * centerVariationScale;
    tilt += variation(passSeed, 221) * 0.03 * tiltVariationScale;
    roundness = Math.max(0.27, Math.min(0.99, roundness + variation(passSeed, 223) * 0.055));
  }

  let startAngle = 0.1 + unitVariation(225) * 0.22;
  let wobblePhase = unitVariation(231) * Math.PI * 2;
  let wobble = 0.008 + unitVariation(233) * 0.012;
  let cosineTilt = Math.cos(tilt);
  let sineTilt = Math.sin(tilt);
  let pointAt = (rawProgress) => {
    let progress = Math.max(0, Number(rawProgress) || 0);
    let angle = startAngle + Math.PI * 2 * progress;
    let cosine = Math.cos(angle);
    let sine = Math.sin(angle);
    let roundedX = Math.sign(cosine) * Math.pow(Math.abs(cosine), roundness);
    let roundedY = Math.sign(sine) * Math.pow(Math.abs(sine), roundness);
    let radialWobble = 1
      + Math.sin(angle * 2 + wobblePhase) * wobble
      + Math.sin(angle * 5 - wobblePhase * 0.7) * wobble * 0.38;
    let localX = radiusX * radialWobble * roundedX;
    let localY = radiusY * radialWobble * roundedY;
    return {
      x: centerX + localX * cosineTilt - localY * sineTilt,
      y: centerY + localX * sineTilt + localY * cosineTilt,
    };
  };

  return {
    point: pointAt,
    rest: pointAt(1),
    jitterScale,
    safePaddingPx: PRESENTER_MARKER_GEOMETRY_CONSTANTS.protectedContentClearancePx,
  };
}

const MARKER_FACTORIES = {
  freehand(rect, seed, options = {}) {
    let pad = Math.min(8, rect.width * 0.04);
    let viewportWidth = Number(options.viewport?.width) || 1920;
    let width = Math.min(
      rect.width + 2 * pad,
      Math.max(320, 3 * rect.height),
      Math.max(0, 0.45 * viewportWidth - PRESENTER_MARKER_GEOMETRY_CONSTANTS.gestureJitterPx * 2.5),
    );
    let centerX = rect.left + rect.width / 2;
    let margin = Math.max(9, Math.min(18, rect.height * 0.18));
    let startX = centerX - width / 2;
    let endX = centerX + width / 2;
    let baseY = rect.bottom + margin;
    let amplitude = 3.5 + (variation(seed, 37) * 0.5 + 0.5) * 3;
    return {
      loops: 0,
      rest: { x: endX, y: baseY },
      point(progress) {
        let drift = variation(seed, 41) * 2 * progress;
        return {
          x: startX + (endX - startX) * progress,
          y: baseY + Math.sin(progress * Math.PI * 3.2) * amplitude * (1 - progress * 0.2) + drift,
        };
      },
    };
  },

  underline(rect, seed, options = {}) {
    let pad = rect.width * (0.06 + 0.04 * (variation(seed, 5) * 0.5 + 0.5));
    let startX = rect.left + pad;
    let endX = rect.right - pad;
    let length = endX - startX;
    let below = options.placement !== 'above';
    let margin = below
      ? Math.max(12, Math.min(14, rect.height * 0.2))
      : PRESENTER_MARKER_GEOMETRY_CONSTANTS.cursorSizePx
        + PRESENTER_MARKER_GEOMETRY_CONSTANTS.collisionAllowancePx + 3;
    let direction = below ? 1 : -1;
    let edge = below ? rect.bottom : rect.top;
    let y = edge + direction * (margin + variation(seed, 9));
    let droop = 1 + variation(seed, 19);
    let returnFraction = 0.22 + (variation(seed, 23) * 0.5 + 0.5) * 0.12;
    return {
      loops: 0,
      rest: { x: endX, y },
      point(progress) {
        if (progress <= 1 - returnFraction) {
          let local = progress / (1 - returnFraction);
          return {
            x: startX + length * local,
            y: y + direction * Math.sin(local * Math.PI) * droop,
          };
        }
        let local = (progress - (1 - returnFraction)) / returnFraction;
        return {
          x: endX - length * 0.3 * local,
          y: y - direction * Math.sin(local * Math.PI) * droop * 0.5,
        };
      },
    };
  },

  oval(rect, seed) {
    return { ...createOvalPass(rect, seed), loops: 0 };
  },

  box(rect, seed) {
    let pad = Math.min(12, Math.max(5, Math.min(rect.width, rect.height) * 0.06));
    let wobble = variation(seed, 11) * 2;
    return pointListPlan([
      { x: rect.left - pad + wobble, y: rect.top - pad },
      { x: rect.right + pad, y: rect.top - pad - wobble },
      { x: rect.right + pad + wobble, y: rect.bottom + pad },
      { x: rect.left - pad, y: rect.bottom + pad + wobble },
      { x: rect.left - pad - wobble, y: rect.top - pad },
    ]);
  },

  bracket(rect, seed, options = {}) {
    let after = options.placement === 'after';
    let x = after ? rect.right + 8 : rect.left - 8;
    let arm = 12 * (after ? -1 : 1);
    let startY = rect.top - 4;
    let endY = rect.bottom + 4;
    let wobble = variation(seed, 13) * 2;
    return pointListPlan([
      { x: x + arm + wobble, y: startY },
      { x, y: startY + wobble },
      { x: x - wobble, y: endY - wobble },
      { x: x + arm - wobble, y: endY },
    ]);
  },

  slash(rect, seed) {
    let pad = 8;
    let wobble = variation(seed, 17) * 3;
    return pointListPlan([
      { x: rect.right + pad + wobble, y: rect.top - pad - wobble },
      { x: rect.left - pad - wobble, y: rect.bottom + pad + wobble },
    ]);
  },

  'multi-oval'(rect, seed) {
    let first = createOvalPass(rect, seed, 0);
    let second = createOvalPass(rect, seed, 1);
    return {
      loops: 1,
      jitterScale: Math.min(first.jitterScale, second.jitterScale),
      safePaddingPx: PRESENTER_MARKER_GEOMETRY_CONSTANTS.protectedContentClearancePx,
      rest: second.rest,
      point(progress) {
        if (progress <= 0.5) return first.point(progress * 2);
        return second.point((progress - 0.5) * 2);
      },
    };
  },

  'converging-arrows'(rect, seed) {
    let gap = Math.max(18, Math.min(30, rect.height * 0.3));
    let y = rect.top - gap;
    let center = rect.left + rect.width / 2;
    let reach = Math.max(40, Math.min(100, rect.width * 0.45));
    let head = 10 + variation(seed, 121) * 1.5;
    return pointListPlan([
      { x: center - reach, y: y - 5 },
      { x: center - 4, y },
      { x: center - 4 - head, y: y - head * 0.65 },
      { x: center - 4, y },
      { x: center - 4 - head, y: y + head * 0.65 },
      { x: center - 4, y },
      { x: center + reach, y: y + 5 },
      { x: center + 4, y },
      { x: center + 4 + head, y: y - head * 0.65 },
      { x: center + 4, y },
      { x: center + 4 + head, y: y + head * 0.65 },
      { x: center + 4, y },
    ]);
  },

  route(rect, seed) {
    let gap = 12 + Math.abs(variation(seed, 123)) * 3;
    let y = rect.bottom + gap;
    let left = rect.left + rect.width * 0.08;
    let right = rect.left + rect.width * 0.92;
    let bend = Math.max(10, Math.min(24, rect.height * 0.3));
    return pointListPlan([
      { x: left, y },
      { x: left + (right - left) * 0.32, y: y + bend },
      { x: left + (right - left) * 0.68, y: y - bend * 0.4 },
      { x: right, y },
    ]);
  },

  'bidirectional-route'(rect, seed) {
    let base = MARKER_FACTORIES.route(rect, seed);
    let left = base.point(0);
    let right = base.point(1);
    let head = 10;
    return pointListPlan([
      { x: left.x + head, y: left.y - head * 0.65 },
      left,
      { x: left.x + head, y: left.y + head * 0.65 },
      left,
      base.point(0.33),
      base.point(0.66),
      right,
      { x: right.x - head, y: right.y - head * 0.65 },
      right,
      { x: right.x - head, y: right.y + head * 0.65 },
    ]);
  },

  'parallel-route'(rect, seed) {
    let gap = 12 + Math.abs(variation(seed, 127)) * 3;
    let firstY = rect.bottom + gap;
    let secondY = firstY + 11;
    let left = rect.left + rect.width * 0.08;
    let right = rect.left + rect.width * 0.92;
    return pointListPlan([
      { x: left, y: firstY },
      { x: right, y: firstY },
      { x: right, y: secondY },
      { x: left, y: secondY },
    ]);
  },

  label(rect, seed) {
    let pad = 7;
    let notch = Math.max(8, Math.min(16, rect.height * 0.2));
    let wobble = variation(seed, 131) * 1.5;
    let left = rect.left - pad;
    let top = rect.top - pad;
    let right = rect.right + pad;
    let bottom = rect.bottom + pad;
    return pointListPlan([
      { x: left + notch, y: top + wobble },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom - wobble },
      { x: left, y: top + notch },
      { x: left + notch, y: top + wobble },
    ]);
  },

  number(rect, seed, options = {}) {
    let label = String(options.label || '1').trim();
    let digit = /^[1-9]$/.test(label) ? Number(label) : 1;
    let radius = Math.max(11, Math.min(18, rect.height * 0.3));
    let centerX = rect.left - radius - 10;
    let centerY = rect.top + Math.min(radius + 2, rect.height / 2);
    let points = [];
    for (let index = 0; index <= 18; index += 1) {
      let angle = -Math.PI / 2 + (Math.PI * 2 * index) / 18;
      points.push({ x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius });
    }
    let top = centerY - radius * 0.48;
    let bottom = centerY + radius * 0.48;
    let left = centerX - radius * 0.32;
    let right = centerX + radius * 0.32;
    let middle = centerY;
    let digitPoints = {
      1: [{ x: centerX - 2, y: top + 3 }, { x: centerX + 2, y: top }, { x: centerX + 2, y: bottom }],
      2: [{ x: left, y: top }, { x: right, y: top }, { x: right, y: middle }, { x: left, y: bottom }, { x: right, y: bottom }],
      3: [{ x: left, y: top }, { x: right, y: top }, { x: centerX, y: middle }, { x: right, y: bottom }, { x: left, y: bottom }],
      4: [{ x: right, y: bottom }, { x: right, y: top }, { x: left, y: middle }, { x: right, y: middle }],
      5: [{ x: right, y: top }, { x: left, y: top }, { x: left, y: middle }, { x: right, y: middle }, { x: right, y: bottom }, { x: left, y: bottom }],
      6: [{ x: right, y: top }, { x: left, y: middle }, { x: left, y: bottom }, { x: right, y: bottom }, { x: right, y: middle }, { x: left, y: middle }],
      7: [{ x: left, y: top }, { x: right, y: top }, { x: centerX, y: bottom }],
      8: [{ x: centerX, y: middle }, { x: left, y: top }, { x: right, y: top }, { x: centerX, y: middle }, { x: left, y: bottom }, { x: right, y: bottom }, { x: centerX, y: middle }],
      9: [{ x: right, y: middle }, { x: left, y: middle }, { x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }],
    }[digit];
    return pointListPlan([...points, ...digitPoints]);
  },

  arrow(rect, seed, options = {}) {
    let placement = options.placement || 'before';
    let centerX = rect.left + rect.width / 2;
    let centerY = rect.top + rect.height / 2;
    let horizontal = placement === 'before' || placement === 'after';
    let viewport = viewportRect(options.viewport || {});
    let centerVector = Boolean(options.centerVector && viewport);
    let ux = 0;
    let uy = 0;
    if (centerVector) {
      let dx = centerX - (viewport.left + viewport.width / 2);
      let dy = centerY - (viewport.top + viewport.height / 2);
      let distance = Math.hypot(dx, dy);
      if (distance >= 48) {
        ux = dx / distance;
        uy = dy / distance;
      } else {
        centerVector = false;
      }
    }
    if (!centerVector) {
      if (horizontal) ux = placement === 'before' ? 1 : -1;
      else uy = placement === 'above' ? 1 : -1;
    }
    let halfWidth = Math.max(1, rect.width / 2);
    let halfHeight = Math.max(1, rect.height / 2);
    let edgeDistance = Math.min(
      Math.abs(ux) > 0.0001 ? halfWidth / Math.abs(ux) : Number.POSITIVE_INFINITY,
      Math.abs(uy) > 0.0001 ? halfHeight / Math.abs(uy) : Number.POSITIVE_INFINITY,
    );
    let tip = {
      x: centerX - ux * (edgeDistance + 12),
      y: centerY - uy * (edgeDistance + 12),
    };
    let viewportCenterDistance = viewport
      ? Math.hypot(tip.x - viewport.width / 2, tip.y - viewport.height / 2)
      : Math.max(rect.width, rect.height) * 0.75 + 96;
    let reach = centerVector
      ? Math.max(132, Math.min(270, viewportCenterDistance * 0.48))
      : horizontal
        ? Math.max(108, Math.min(210, rect.width * 0.42 + 88))
        : Math.max(96, Math.min(190, rect.height * 0.8 + 72));
    if (centerVector && Number.isFinite(Number(options.reachScale))) {
      reach *= Math.max(0.5, Math.min(1, Number(options.reachScale)));
    }
    let normal = { x: -uy, y: ux };
    let tailOffset = variation(seed, 113) * Math.min(18, reach * 0.08);
    let start = {
      x: tip.x - ux * reach + normal.x * tailOffset,
      y: tip.y - uy * reach + normal.y * tailOffset,
    };
    let bend = (8 + Math.abs(variation(seed, 117)) * 8) * (variation(seed, 119) < 0 ? -1 : 1);
    let headLength = 30 + (variation(seed, 127) * 0.5 + 0.5) * 6;
    let headWidth = headLength * (0.82 + variation(seed, 131) * 0.035);
    let leftHead = {
      x: tip.x - ux * headLength + normal.x * headWidth,
      y: tip.y - uy * headLength + normal.y * headWidth,
    };
    let rightHead = {
      x: tip.x - ux * headLength - normal.x * headWidth,
      y: tip.y - uy * headLength - normal.y * headWidth,
    };
    return {
      loops: 0,
      pathMode: 'linear',
      jitterScale: 0.72,
      rest: tip,
      point(progress) {
        if (progress <= 0.72) {
          let local = progress / 0.72;
          let eased = local * local * (3 - 2 * local);
          let bow = Math.sin(local * Math.PI) * bend * (1 - local);
          return {
            x: start.x + (tip.x - start.x) * eased + normal.x * bow,
            y: start.y + (tip.y - start.y) * eased + normal.y * bow,
          };
        }
        if (progress <= 0.82) {
          let local = (progress - 0.72) / 0.1;
          return { x: tip.x + (leftHead.x - tip.x) * local, y: tip.y + (leftHead.y - tip.y) * local };
        }
        if (progress <= 0.9) {
          let local = (progress - 0.82) / 0.08;
          return { x: leftHead.x + (tip.x - leftHead.x) * local, y: leftHead.y + (tip.y - leftHead.y) * local };
        }
        let local = (progress - 0.9) / 0.1;
        return { x: tip.x + (rightHead.x - tip.x) * local, y: tip.y + (rightHead.y - tip.y) * local };
      },
    };
  },
};

export function createPresenterMarkerPlan(marker, targetRect, options = {}) {
  let name = String(marker || '').trim().toLowerCase();
  let factory = MARKER_FACTORIES[name];
  if (!factory || !CATALOG_BY_NAME.has(name)) {
    throw new TypeError(`unsupported presenter marker geometry: ${name || '(empty)'}`);
  }
  let rect = normalizeRect(targetRect);
  let geometrySeed = options.geometrySeed ?? semanticMarkerSeed(name);
  return factory(rect, normalizePresenterSeed(geometrySeed), options);
}

function pointRectDistance(point, rect) {
  let dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
  let dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
  return Math.hypot(dx, dy);
}

function safeAreaReport(marker, rect, plan, kinematics) {
  let requiredClearancePx = plan.safePaddingPx || 0;
  let inset = Math.min(
    PRESENTER_MARKER_GEOMETRY_CONSTANTS.targetInsetPx,
    Math.min(rect.width, rect.height) * 0.25,
  );
  let protectedRect = Object.freeze({
    left: rect.left + inset,
    top: rect.top + inset,
    right: rect.right - inset,
    bottom: rect.bottom - inset,
    width: Math.max(0, rect.width - inset * 2),
    height: Math.max(0, rect.height - inset * 2),
  });
  let minimumClearancePx = Math.min(...kinematics.samples.map((sample) => (
    pointRectDistance(sample, protectedRect) - sample.widthPx / 2
  )));
  let safetyPolicy = CATALOG_BY_NAME.get(marker).safetyPolicy;
  let applies = safetyPolicy === 'enclosure' && ['oval', 'multi-oval'].includes(marker);
  return Object.freeze({
    rect: protectedRect,
    targetRect: rect,
    targetInsetPx: inset,
    policy: safetyPolicy,
    requiredClearancePx,
    minimumClearancePx,
    clear: !applies || minimumClearancePx >= requiredClearancePx - 0.05,
  });
}

function tailReport(kinematics) {
  let first = kinematics.samples[0];
  let last = kinematics.samples.at(-1);
  let endpointGapPx = Math.hypot(last.x - first.x, last.y - first.y);
  let requiredEndpointGapPx = (first.widthPx + last.widthPx) / 2 + 0.5;
  return Object.freeze({
    ...kinematics.tailPolicy,
    longitudinalOverlapPx: kinematics.arcLengthPx * kinematics.tailPolicy.amount
      / Math.max(1, kinematics.tailPolicy.sourceEnd),
    endpointGapPx,
    requiredEndpointGapPx,
    separated: endpointGapPx >= requiredEndpointGapPx,
  });
}

export function createPresenterMarkerGeometry(request = {}) {
  let marker = String(request.marker || '').trim().toLowerCase();
  let targetRect = normalizeRect(request.targetRect || request.rect);
  let seed = normalizePresenterSeed(request.seed);
  let semanticSeed = semanticMarkerSeed(marker);
  let geometrySeed = request.geometrySeed ?? (
    ['oval', 'multi-oval'].includes(marker)
      ? normalizePresenterSeed(`${semanticSeed}:${seed}`)
      : semanticSeed
  );
  let plan = createPresenterMarkerPlan(marker, targetRect, {
    placement: request.placement,
    viewport: request.viewport,
    centerVector: request.centerVector,
    reachScale: request.reachScale,
    label: request.label,
    geometrySeed,
  });
  let kinematics = createPresenterKinematicPlan({
    kind: marker,
    seed,
    style: {
      ...(request.style || {}),
      constantSpeedPxPerMs: Number(request.style?.constantSpeedPxPerMs)
        || PRESENTER_MARKER_GEOMETRY_CONSTANTS.drawSpeedPxPerMs,
    },
    pointAt: (progress) => clampPoint(plan.point(progress), request.viewport),
  });
  return Object.freeze({
    version: PRESENTER_MARKER_GEOMETRY_VERSION,
    marker,
    catalog: CATALOG_BY_NAME.get(marker),
    seed,
    targetRect,
    plan,
    kinematics,
    safeArea: safeAreaReport(marker, targetRect, plan, kinematics),
    tail: tailReport(kinematics),
    render: Object.freeze({
      centerlinePath: kinematics.centerlinePath,
      ribbonPath: kinematics.ribbonPath,
      linecap: 'round',
      linejoin: 'round',
    }),
    timing: Object.freeze({
      durationMs: kinematics.durationMs,
      averageSpeedPxPerMs: kinematics.arcLengthPx / kinematics.durationMs,
      minMovingSpeedPxPerMs: kinematics.limits.minMovingSpeedPxPerMs,
      targetSpeedPxPerMs: kinematics.limits.targetSpeedPxPerMs,
      maxSpeedPxPerMs: kinematics.limits.maxSpeedPxPerMs,
    }),
  });
}
