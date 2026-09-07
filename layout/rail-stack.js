


export const RAIL_STACK_SUPPORTED_COUNTS = Object.freeze([1, 2, 3]);

function finiteHostHeight(value) {
  let height = Number(value);
  if (!Number.isFinite(height) || height <= 0) return 0;
  return height;
}

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

export function routeRailDescriptor(rails = [], railId = '') {
  let wanted = String(railId || '').trim();
  if (!wanted) return null;
  for (let rail of Array.from(rails || [])) {
    let normalized = normalizeRailDescriptor(rail);
    if (normalized && normalized.railId === wanted) return normalized;
  }
  return null;
}

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
