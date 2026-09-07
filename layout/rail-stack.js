/**
 * @fileoverview Cross-layout rail stack contract.
 *
 * Canonical provider/host contract for nested `panel-layout` instances whose
 * collapsed drawer rails would otherwise overlap in the viewport (for example
 * an inner graph+theme layout whose two collapsed rails share one rect while
 * an outer chat layout owns a separate rail).
 *
 * The contract is intentionally small and explicit:
 * - nested layouts contribute rail descriptors to a shared host zone,
 * - the host renders each independent rail identity-preserving in equal
 *   vertical regions for N=2 and N=3,
 * - click/open-close is routed back to the owning layout, which keeps its
 *   existing same-layout launchers and single-active drawer semantics.
 *
 * This module stays Node-safe: pure geometry plus a tiny in-memory registry.
 * DOM rendering lives in `Layout` (host zone) and forwards through the
 * descriptor `owner` reference. No CSS hacks, no implicit global discovery.
 */

/**
 * @typedef {Object} RailDescriptor
 * @property {string} railId - Stable identity for the rail (layoutId:panelId).
 * @property {Object|null} owner - Owning layout instance (routes open/close).
 * @property {string} ownerId - Stable owner identity for tests and routing.
 * @property {string} panelId - Panel id to open in the owning layout.
 * @property {string} dock - Drawer dock (`start` or `end`).
 * @property {string} [icon] - Glyph for the identity-preserving proxy button.
 * @property {string} [label] - Accessible label for the proxy button.
 */

/**
 * @typedef {Object} RailStackRegion
 * @property {number} index - Zero-based region index.
 * @property {number} top - Region top offset in host pixels.
 * @property {number} height - Region height in host pixels.
 */

export const RAIL_STACK_SUPPORTED_COUNTS = Object.freeze([1, 2, 3]);

function finiteHostHeight(value) {
  let height = Number(value);
  if (!Number.isFinite(height) || height <= 0) return 0;
  return height;
}

/**
 * Normalize one contributed rail descriptor without touching the DOM.
 * @param {Object} descriptor
 * @returns {RailDescriptor|null}
 */
export function normalizeRailDescriptor(descriptor = {}) {
  let railId = String(descriptor.railId || '').trim();
  let panelId = String(descriptor.panelId || '').trim();
  let dock = String(descriptor.dock || '').trim();
  if (!railId || !panelId || (dock !== 'start' && dock !== 'end')) return null;
  return {
    railId,
    owner: descriptor.owner || null,
    ownerId: String(descriptor.ownerId || '').trim(),
    panelId,
    dock,
    icon: String(descriptor.icon || '').trim(),
    label: String(descriptor.label || panelId).trim(),
  };
}

/**
 * Resolve equal vertical regions for N stacked rails.
 * N=1 is a passthrough full-height region; N=2 splits halves; N=3 splits
 * thirds. Counts outside 1..3 are clamped to the nearest supported count so
 * callers never render overlapping full-height rails by accident.
 * @param {number} count
 * @param {number} hostHeight
 * @returns {Array<RailStackRegion>}
 */
export function resolveRailStackRegions(count, hostHeight) {
  let height = finiteHostHeight(hostHeight);
  let safeCount = Math.floor(Number(count) || 0);
  if (!(safeCount >= 1)) return [];
  if (safeCount > 3) safeCount = 3;
  if (height <= 0) {
    return Array.from({ length: safeCount }, (_, index) => ({ index, top: 0, height: 0 }));
  }
  let regionHeight = height / safeCount;
  return Array.from({ length: safeCount }, (_, index) => ({
    index,
    top: index * regionHeight,
    height: index === safeCount - 1 ? height - index * regionHeight : regionHeight,
  }));
}

/**
 * Attach resolved geometry to an ordered descriptor list.
 * @param {Array<Object>} rails
 * @param {number} hostHeight
 * @returns {Array<RailDescriptor & {region: RailStackRegion}>}
 */
export function layoutRailStack(rails = [], hostHeight = 0) {
  let normalized = Array.from(rails || [])
    .map(normalizeRailDescriptor)
    .filter(Boolean);
  let regions = resolveRailStackRegions(normalized.length, hostHeight);
  return normalized.map((rail, index) => ({
    ...rail,
    region: regions[index] || { index, top: 0, height: 0 },
  }));
}

/**
 * Find one stacked rail by stable identity.
 * @param {Array<Object>} rails
 * @param {string} railId
 * @returns {RailDescriptor|null}
 */
export function routeRailDescriptor(rails = [], railId = '') {
  let wanted = String(railId || '').trim();
  if (!wanted) return null;
  for (let rail of Array.from(rails || [])) {
    let normalized = normalizeRailDescriptor(rail);
    if (normalized && normalized.railId === wanted) return normalized;
  }
  return null;
}

/**
 * In-memory host registry: owners contribute descriptors, the host renders
 * the flattened identity-preserving list. Registration order decides stack
 * order; re-registering one owner replaces only that owner's slice.
 * @returns {{register: Function, unregister: Function, list: Function, count: Function}}
 */
export function createRailStackRegistry() {
  let slices = new Map();
  return {
    register(ownerId, descriptors = []) {
      let key = String(ownerId || '').trim();
      if (!key) return [];
      let normalized = Array.from(descriptors || [])
        .map((item) => normalizeRailDescriptor({ ...item, ownerId: item?.ownerId || key }))
        .filter(Boolean)
        .filter((item, index, all) => all.findIndex((other) => other.railId === item.railId) === index);
      if (!normalized.length) {
        slices.delete(key);
      } else {
        slices.set(key, normalized);
      }
      return this.list();
    },
    unregister(ownerId) {
      slices.delete(String(ownerId || '').trim());
      return this.list();
    },
    list() {
      return Array.from(slices.values()).flat();
    },
    count() {
      return Array.from(slices.values()).reduce((sum, slice) => sum + slice.length, 0);
    },
  };
}
