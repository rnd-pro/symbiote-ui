import { freezeSpatialValue } from './spatial-contract.js';
import { XR_SPATIAL_WINDOW_DEFAULT_SIZE } from './spatial-window-contract.js';
import { XR_PANEL_POSE_COMFORT_DEFAULTS } from './layout-projection.js';

export const XR_SPATIAL_WINDOW_PLACEMENT_VERSION = 'xr-spatial-window-placement-v2';

// The consumer-supported bound of simultaneous layouts. The default lattice
// holds 25 candidate slots; assignment never exceeds this capacity.
export const XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY = 24;

export const XR_SPATIAL_WINDOW_PLACEMENT_DEFAULTS = Object.freeze({
  radius: 1.96,
  innerRadius: 1.15,
  rowHeight: 1.5,
  rowSpacing: 0.46,
  slotSpacing: 0.9,
  innerSlotSpacing: 0.81,
  slotsPerRow: 4,
  innerSlotsPerRow: 3,
  floorMargin: 0.05,
});

const ROUNDING_PRECISION = 1_000_000;
const DEGREES = 180 / Math.PI;

function roundMetric(value) {
  return Math.round(value * ROUNDING_PRECISION) / ROUNDING_PRECISION;
}

function isFiniteVector(value, length) {
  return Array.isArray(value) && value.length === length && value.every((entry) => Number.isFinite(Number(entry)));
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function resolvePlacementOptions(options = {}) {
  let arc = { ...XR_SPATIAL_WINDOW_PLACEMENT_DEFAULTS, ...options };
  for (let key of Object.keys(XR_SPATIAL_WINDOW_PLACEMENT_DEFAULTS)) {
    if (!isFiniteNumber(arc[key])) {
      throw new TypeError(
        `XR spatial window placement option "${key}" must be a finite number. Received: ${arc[key]}.`,
      );
    }
  }
  for (let key of ['slotsPerRow', 'innerSlotsPerRow']) {
    if (!Number.isInteger(arc[key]) || arc[key] <= 0) {
      throw new TypeError(
        `XR spatial window placement option "${key}" must be an integral positive number. Received: ${arc[key]}.`,
      );
    }
  }
  for (let key of ['rowHeight', 'rowSpacing', 'slotSpacing', 'innerSlotSpacing']) {
    if (Number(arc[key]) <= 0) {
      throw new RangeError(
        `XR spatial window placement option "${key}" must be a positive number. Received: ${arc[key]}.`,
      );
    }
  }
  if (Number(arc.floorMargin) < 0) {
    throw new RangeError(
      `XR spatial window placement option "floorMargin" must not be negative. Received: ${arc.floorMargin}.`,
    );
  }
  let comfort = XR_PANEL_POSE_COMFORT_DEFAULTS;
  for (let key of ['radius', 'innerRadius']) {
    if (Number(arc[key]) < comfort.minDistance || Number(arc[key]) > comfort.maxDistance) {
      throw new RangeError(
        `XR spatial window placement option "${key}" must stay inside the ${comfort.minDistance}-${comfort.maxDistance} m distance envelope. Received: ${arc[key]}.`,
      );
    }
  }
  if (Number(arc.innerRadius) >= Number(arc.radius)) {
    throw new RangeError(
      `XR spatial window placement option "innerRadius" (${arc.innerRadius}) must be smaller than "radius" (${arc.radius}).`,
    );
  }
  if (Number(arc.slotSpacing) > Number(arc.radius) * 2 || Number(arc.innerSlotSpacing) > Number(arc.innerRadius) * 2) {
    throw new RangeError(
      'XR spatial window placement slot spacing must not exceed twice its tier radius so slots stay on the arc.',
    );
  }
  return arc;
}

function resolveSizeMeters(sizeMeters) {
  let size = sizeMeters === undefined ? [...XR_SPATIAL_WINDOW_DEFAULT_SIZE] : sizeMeters;
  if (!isFiniteVector(size, 2) || Number(size[0]) <= 0 || Number(size[1]) <= 0) {
    throw new TypeError(
      `XR spatial window placement sizeMeters must be a positive finite [width, height] pair. Received: ${JSON.stringify(sizeMeters)}.`,
    );
  }
  return size.map(Number);
}

// Vertical center range that keeps a window of the given height inside the
// provider comfort envelope (vertical angles and 3D distance) and above the
// floor at the given tier radius.
function comfortBand(radius, height, floorMargin) {
  let comfort = XR_PANEL_POSE_COMFORT_DEFAULTS;
  let tanLow = Math.tan(Math.abs(comfort.minVerticalAngle) / DEGREES) * radius;
  let tanHigh = Math.tan(comfort.maxVerticalAngle / DEGREES) * radius;
  let distanceSlack = Math.sqrt(Math.max(comfort.maxDistance ** 2 - radius ** 2, 0));
  let low = comfort.eyeHeight - Math.min(tanLow, distanceSlack);
  let high = comfort.eyeHeight + Math.min(tanHigh, distanceSlack);
  low = Math.max(low, height / 2 + floorMargin);
  return low > high ? null : [low, high];
}

// Center-out (left first) yaw offsets for one arc row. Adjacent columns sit
// one chord step apart so default-size windows never overlap horizontally.
function tierColumns(radius, chord, maxColumns) {
  let comfort = XR_PANEL_POSE_COMFORT_DEFAULTS;
  if (chord >= radius * 2) return [0];
  let step = 2 * Math.asin(chord / (radius * 2));
  let maxAngle = comfort.maxHorizontalAngle / DEGREES;
  let count = Math.min(maxColumns, Math.floor((2 * maxAngle) / step) + 1);
  let offsets = [];
  for (let index = 0; index < count; index += 1) {
    let offset = count % 2 === 1
      ? (index === 0 ? 0 : (index % 2 === 1 ? -1 : 1) * Math.ceil(index / 2))
      : (index % 2 === 0 ? -1 : 1) * (Math.floor(index / 2) + 0.5);
    offsets.push(offset);
  }
  return offsets.map((offset) => offset * step);
}

// Levels filling the comfort band at one tier, spaced so default-height
// windows never overlap vertically, ordered by proximity to rowHeight.
function tierLevels(radius, height, rowSpacing, rowHeight, floorMargin) {
  let band = comfortBand(radius, height, floorMargin);
  if (!band) return [];
  let [low, high] = band;
  let count = Math.floor((high - low) / rowSpacing) + 1;
  let start = low + (high - low - (count - 1) * rowSpacing) / 2;
  let levels = [];
  for (let index = 0; index < count; index += 1) levels.push(start + index * rowSpacing);
  return levels.sort((first, second) => Math.abs(first - rowHeight) - Math.abs(second - rowHeight));
}

function buildLattice(sizeMeters, arc) {
  let [width, height] = sizeMeters;
  let levelSpacing = arc.rowSpacing + Math.max(0, height - XR_SPATIAL_WINDOW_DEFAULT_SIZE[1]);
  let tiers = [
    { radius: arc.radius, chord: arc.slotSpacing, maxColumns: arc.slotsPerRow },
    { radius: arc.innerRadius, chord: arc.innerSlotSpacing, maxColumns: arc.innerSlotsPerRow },
  ];
  let slots = [];
  for (let tier of tiers) {
    let chord = tier.chord + Math.max(0, width - XR_SPATIAL_WINDOW_DEFAULT_SIZE[0]);
    let columns = tierColumns(tier.radius, chord, tier.maxColumns);
    let levels = tierLevels(tier.radius, height, levelSpacing, arc.rowHeight, arc.floorMargin);
    for (let y of levels) {
      for (let angle of columns) {
        slots.push(freezeSpatialValue({
          position: [
            roundMetric(tier.radius * Math.sin(angle)),
            roundMetric(y),
            roundMetric(-tier.radius * Math.cos(angle)),
          ],
          rotation: [0, roundMetric(-angle * DEGREES), 0],
        }));
      }
    }
  }
  return slots;
}

/**
 * Computes the deterministic provider default pose for one unplaced spatial
 * window slot. The bounded lattice spans two user-facing radial arc tiers
 * (outer `radius` with `slotsPerRow` columns, inner `innerRadius` with
 * `innerSlotsPerRow` columns) times a small set of vertical levels, so every
 * slot stays inside the `createXRPanelPoseComfortSummary` envelope, above the
 * floor, yawed to face the viewer, and non-overlapping for default 0.8 m ×
 * 0.45 m windows up to `XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY` slots. Chord and
 * level spacing grow with the candidate's actual `sizeMeters`, so larger
 * windows get a smaller lattice. The result depends only on the slot index,
 * size, and options, never on call order or environment.
 *
 * @param {number} slot non-negative integer slot index below the effective capacity
 * @param {Object} [options] lattice overrides for XR_SPATIAL_WINDOW_PLACEMENT_DEFAULTS
 * @param {Array<number>} [options.sizeMeters] size of the window being placed
 * @returns {Object} frozen `{ position, rotation }` in meters and Euler degrees
 */
export function computeXRSpatialWindowDefaultSlotPose(slot, options = {}) {
  if (!Number.isInteger(slot) || slot < 0) {
    throw new TypeError(`XR spatial window placement slot must be a non-negative integer. Received: ${slot}.`);
  }
  let { sizeMeters, ...arcOptions } = options;
  let arc = resolvePlacementOptions(arcOptions);
  let size = resolveSizeMeters(sizeMeters);
  let lattice = buildLattice(size, arc);
  let capacity = Math.min(lattice.length, XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY);
  if (slot >= capacity) {
    throw new RangeError(
      `XR spatial window placement slot ${slot} exceeds the bounded capacity ${capacity} for size ${size.join('x')} m.`,
    );
  }
  return lattice[slot];
}

/**
 * @param {Object} candidatePose `{ position }` of the slot being tested
 * @param {Array<number>} sizeMeters size of the window being placed
 * @param {Object} occupiedEntry live window as `{ position, sizeMeters? }`
 * @returns {boolean} true when the two footprints overlap
 */
export function xrSpatialWindowSlotBlocked(candidatePose, sizeMeters, occupiedEntry) {
  let occupiedSize = isFiniteVector(occupiedEntry.sizeMeters, 2)
    ? occupiedEntry.sizeMeters.map(Number)
    : sizeMeters;
  let horizontal = Math.hypot(
    candidatePose.position[0] - Number(occupiedEntry.position[0]),
    candidatePose.position[2] - Number(occupiedEntry.position[2]),
  );
  let vertical = Math.abs(candidatePose.position[1] - Number(occupiedEntry.position[1]));
  return horizontal < (sizeMeters[0] + occupiedSize[0]) / 2
    && vertical < (sizeMeters[1] + occupiedSize[1]) / 2;
}

/**
 * Assigns the lowest-capacity lattice slot whose footprint is not blocked by
 * a live window. A slot counts as occupied when an existing window center sits
 * within half the combined window width horizontally and half the combined
 * height vertically of the slot center, so explicitly posed windows push
 * unplaced windows to the next free slot and slots freed by removal or drag
 * become reusable. When no safe non-overlapping slot exists the result is
 * structured capacity data (`ok: false, reason: 'placement-capacity-exhausted'`)
 * with `pose: null`; an unsafe slot is never generated. The result is
 * deterministic for a given occupied set.
 *
 * @param {Object} [input]
 * @param {Array<Object>} [input.occupied] live windows as `{ position, sizeMeters? }`
 * @param {Array<number>} [input.sizeMeters] size of the window being placed
 * @param {Object} [input.options] lattice overrides for XR_SPATIAL_WINDOW_PLACEMENT_DEFAULTS
 * @returns {Object} frozen `{ version, ok, slot?, pose?, capacity, reason? }`
 */
export function resolveXRSpatialWindowDefaultPlacement(input = {}) {
  let occupied = Array.isArray(input.occupied) ? input.occupied : [];
  for (let [index, entry] of occupied.entries()) {
    if (!entry || !isFiniteVector(entry.position, 3)) {
      throw new TypeError(
        `XR spatial window placement occupied entries require a finite [x, y, z] position. Received entry at index ${index}.`,
      );
    }
  }
  let size = resolveSizeMeters(input.sizeMeters);
  let arc = resolvePlacementOptions(input.options);
  let lattice = buildLattice(size, arc);
  let capacity = Math.min(lattice.length, XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY);
  for (let slot = 0; slot < capacity; slot += 1) {
    let pose = lattice[slot];
    if (occupied.some((entry) => xrSpatialWindowSlotBlocked(pose, size, entry))) continue;
    return freezeSpatialValue({
      version: XR_SPATIAL_WINDOW_PLACEMENT_VERSION,
      ok: true,
      slot,
      pose,
      capacity,
    });
  }
  return freezeSpatialValue({
    version: XR_SPATIAL_WINDOW_PLACEMENT_VERSION,
    ok: false,
    reason: 'placement-capacity-exhausted',
    capacity,
    pose: null,
  });
}
