export const NODE_CANVAS_RENDER_SNAPSHOT_KIND = 'node-canvas-pcb-route-snapshot';
export const NODE_CANVAS_RENDER_SNAPSHOT_VERSION = 1;
export const NODE_CANVAS_ROUTE_FINGERPRINT_SCHEMA = 'node-canvas-route-fingerprint-v1';
export const NODE_CANVAS_RENDER_SNAPSHOT_RECEIPT_SCHEMA =
  'node-canvas-render-snapshot-receipt-v1';
export const NODE_CANVAS_RENDER_SNAPSHOT_CONTRACT = Object.freeze({
  kind: NODE_CANVAS_RENDER_SNAPSHOT_KIND,
  version: NODE_CANVAS_RENDER_SNAPSHOT_VERSION,
  routeFingerprintSchema: NODE_CANVAS_ROUTE_FINGERPRINT_SCHEMA,
  receiptSchema: NODE_CANVAS_RENDER_SNAPSHOT_RECEIPT_SCHEMA,
  pathStyle: 'pcb',
  mismatchResolution: 'pcb-live-reroute',
  ownership: Object.freeze({
    snapshot: 'host-build',
    liveDom: 'node-canvas',
    invalidationPolicy: 'host-and-provider',
  }),
});

const SVG_PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/;
const MAX_PATH_LENGTH = 1024 * 1024;
const LOGICAL_SIZE_STEP = 2;
const LOGICAL_SIZE_TIE_BIAS = 1 / 32;

function fail(label) {
  throw new TypeError(`Invalid NodeCanvas render snapshot: ${label}`);
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label);
  let prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(label);
  return value;
}

function requireString(value, label) {
  let text = typeof value === 'string' ? value.trim() : '';
  if (!text) fail(label);
  return text;
}

function requireFinite(value, label) {
  if (!Number.isFinite(value)) fail(label);
  return value;
}

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) fail(label);
  return value;
}

function cssPixels(style, property) {
  let value = Number.parseFloat(style?.[property] || '');
  return Number.isFinite(value) ? value : 0;
}

function canonicalLogicalPixels(value) {
  if (!(value > 0)) return 0;
  return Math.round((value + LOGICAL_SIZE_TIE_BIAS) / LOGICAL_SIZE_STEP)
    * LOGICAL_SIZE_STEP;
}

/**
 * Resolve a node's canonical logical CSS border box.
 * @param {HTMLElement} nodeElement
 * @param {number} [fallbackWidth]
 * @param {number} [fallbackHeight]
 * @returns {{width: number, height: number}}
 */
export function readNodeCanvasLogicalSize(nodeElement, fallbackWidth = 0, fallbackHeight = 0) {
  let width = 0;
  let height = 0;
  try {
    let view = nodeElement?.ownerDocument?.defaultView;
    let readStyle = view?.getComputedStyle || globalThis.getComputedStyle;
    let style = typeof readStyle === 'function'
      ? readStyle.call(view || globalThis, nodeElement)
      : null;
    width = cssPixels(style, 'width');
    height = cssPixels(style, 'height');
    if (style && style.boxSizing !== 'border-box') {
      width += cssPixels(style, 'paddingLeft')
        + cssPixels(style, 'paddingRight')
        + cssPixels(style, 'borderLeftWidth')
        + cssPixels(style, 'borderRightWidth');
      height += cssPixels(style, 'paddingTop')
        + cssPixels(style, 'paddingBottom')
        + cssPixels(style, 'borderTopWidth')
        + cssPixels(style, 'borderBottomWidth');
    }
    width = canonicalLogicalPixels(width);
    height = canonicalLogicalPixels(height);
  } catch {}
  return {
    width: width > 0 ? width : nodeElement?._cachedW || nodeElement?.offsetWidth || fallbackWidth,
    height: height > 0 ? height : nodeElement?._cachedH || nodeElement?.offsetHeight || fallbackHeight,
  };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  let result = {};
  for (let key of Object.keys(value).sort()) result[key] = canonicalize(value[key]);
  return result;
}

function normalizeProvider(value) {
  let provider = requirePlainObject(value, 'routeFingerprint.provider');
  return {
    package: requireString(provider.package, 'routeFingerprint.provider.package'),
    packageVersion: requireString(
      provider.packageVersion,
      'routeFingerprint.provider.packageVersion',
    ),
    router: requireString(provider.router, 'routeFingerprint.provider.router'),
    routerVersion: requireString(
      provider.routerVersion,
      'routeFingerprint.provider.routerVersion',
    ),
  };
}

function requireFingerprintPart(value, name) {
  return requireString(value, `routeFingerprint.${name}`);
}

function normalizeFingerprint(value) {
  let fingerprint = requirePlainObject(value, 'routeFingerprint');
  if (fingerprint.schema !== NODE_CANVAS_ROUTE_FINGERPRINT_SCHEMA) {
    fail('routeFingerprint.schema');
  }
  return {
    schema: NODE_CANVAS_ROUTE_FINGERPRINT_SCHEMA,
    provider: normalizeProvider(fingerprint.provider),
    canonicalGraph: requireFingerprintPart(fingerprint.canonicalGraph, 'canonicalGraph'),
    localeContent: requireFingerprintPart(fingerprint.localeContent, 'localeContent'),
    nodePositions: requireFingerprintPart(fingerprint.nodePositions, 'nodePositions'),
    nodeSizes: requireFingerprintPart(fingerprint.nodeSizes, 'nodeSizes'),
    fontMetrics: requireFingerprintPart(fingerprint.fontMetrics, 'fontMetrics'),
  };
}

function normalizePoint(value, label) {
  let point = requirePlainObject(value, label);
  return {
    x: requireFinite(point.x, `${label}.x`),
    y: requireFinite(point.y, `${label}.y`),
  };
}

function normalizeNodeRects(value) {
  if (!Array.isArray(value)) fail('nodeRects');
  let seen = new Set();
  let rects = value.map((entry, index) => {
    let label = `nodeRects[${index}]`;
    let rect = requirePlainObject(entry, label);
    let id = requireString(rect.id, `${label}.id`);
    if (seen.has(id)) fail(`${label}.id duplicate`);
    seen.add(id);
    let width = requireFinite(rect.width, `${label}.width`);
    let height = requireFinite(rect.height, `${label}.height`);
    if (width <= 0 || height <= 0) fail(`${label}.size`);
    return {
      id,
      x: requireFinite(rect.x, `${label}.x`),
      y: requireFinite(rect.y, `${label}.y`),
      width,
      height,
    };
  });
  return rects.sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeRoutes(value) {
  if (!Array.isArray(value) || value.length === 0) fail('routes');
  let seen = new Set();
  let routes = value.map((entry, index) => {
    let label = `routes[${index}]`;
    let route = requirePlainObject(entry, label);
    let connectionId = requireString(route.connectionId, `${label}.connectionId`);
    if (seen.has(connectionId)) fail(`${label}.connectionId duplicate`);
    seen.add(connectionId);
    let path = requireString(route.path, `${label}.path`);
    if (path.length > MAX_PATH_LENGTH || !SVG_PATH_DATA.test(path) || !/^M[\s-]/i.test(path)) {
      fail(`${label}.path`);
    }
    if (!Array.isArray(route.points) || route.points.length < 2) fail(`${label}.points`);
    return {
      connectionId,
      signature: requireString(route.signature, `${label}.signature`),
      path,
      points: route.points.map((point, pointIndex) => (
        normalizePoint(point, `${label}.points[${pointIndex}]`)
      )),
    };
  });
  return routes.sort((left, right) => left.connectionId.localeCompare(right.connectionId));
}

/**
 * @param {object} routeFingerprint
 * @returns {object|null}
 */
export function normalizeNodeCanvasRouteFingerprint(routeFingerprint) {
  try {
    return normalizeFingerprint(routeFingerprint);
  } catch {
    return null;
  }
}

/**
 * @param {object} routeFingerprint
 * @returns {string}
 */
export function serializeNodeCanvasRouteFingerprint(routeFingerprint) {
  return JSON.stringify(canonicalize(normalizeFingerprint(routeFingerprint)));
}

function serializeNodeCanvasRouteIdentity(routeFingerprint) {
  let fingerprint = normalizeFingerprint(routeFingerprint);
  return JSON.stringify(canonicalize({
    schema: fingerprint.schema,
    provider: fingerprint.provider,
    canonicalGraph: fingerprint.canonicalGraph,
    localeContent: fingerprint.localeContent,
    fontMetrics: fingerprint.fontMetrics,
  }));
}

/**
 * @param {object} left
 * @param {object} right
 * @returns {boolean}
 */
export function matchNodeCanvasRouteFingerprint(left, right) {
  try {
    // Position and size digests describe measured geometry. Adoption verifies
    // that geometry independently against the renderer's exact logical CSS
    // coordinates, so integer-rounded host measurements must not reject an
    // otherwise identical route identity before that authoritative check.
    return serializeNodeCanvasRouteIdentity(left) === serializeNodeCanvasRouteIdentity(right);
  } catch {
    return false;
  }
}

/**
 * @param {Array<object>} nodeRects
 * @param {Array<object>} routes
 * @returns {string}
 */
export function createNodeCanvasGeometrySignature(nodeRects, routes) {
  let rects = normalizeNodeRects(nodeRects);
  let connections = normalizeRoutes(routes).map((route) => ({
    connectionId: route.connectionId,
    signature: route.signature,
  }));
  return JSON.stringify(canonicalize({ nodeRects: rects, connections }));
}

function normalizeSnapshot(value) {
  let snapshot = requirePlainObject(value, 'snapshot');
  if (snapshot.kind !== NODE_CANVAS_RENDER_SNAPSHOT_KIND) fail('kind');
  if (snapshot.version !== NODE_CANVAS_RENDER_SNAPSHOT_VERSION) fail('version');
  let routeFingerprint = normalizeFingerprint(snapshot.routeFingerprint);
  let nodeRects = normalizeNodeRects(snapshot.nodeRects);
  let routes = normalizeRoutes(snapshot.routes);
  let geometrySignature = requireString(snapshot.geometrySignature, 'geometrySignature');
  let expectedGeometry = createNodeCanvasGeometrySignature(nodeRects, routes);
  if (geometrySignature !== expectedGeometry) fail('geometrySignature');
  return {
    kind: NODE_CANVAS_RENDER_SNAPSHOT_KIND,
    version: NODE_CANVAS_RENDER_SNAPSHOT_VERSION,
    routeFingerprint,
    geometrySignature,
    nodeRects,
    routes,
  };
}

/**
 * @param {object} value
 * @returns {{valid: boolean, snapshot: object|null, reason: string}}
 */
export function validateNodeCanvasRenderSnapshot(value) {
  try {
    return { valid: true, snapshot: normalizeSnapshot(value), reason: '' };
  } catch (error) {
    return {
      valid: false,
      snapshot: null,
      reason: error instanceof Error ? error.message : 'Invalid NodeCanvas render snapshot.',
    };
  }
}

/**
 * @param {object} value
 * @returns {object|null}
 */
export function normalizeNodeCanvasRenderSnapshot(value) {
  return validateNodeCanvasRenderSnapshot(value).snapshot;
}

/**
 * @param {object} options
 * @returns {object}
 */
export function createNodeCanvasRenderSnapshot(options) {
  let input = requirePlainObject(options, 'options');
  let nodeRects = normalizeNodeRects(input.nodeRects);
  let routes = normalizeRoutes(input.routes);
  return normalizeSnapshot({
    kind: NODE_CANVAS_RENDER_SNAPSHOT_KIND,
    version: NODE_CANVAS_RENDER_SNAPSHOT_VERSION,
    routeFingerprint: normalizeFingerprint(input.routeFingerprint),
    geometrySignature: createNodeCanvasGeometrySignature(nodeRects, routes),
    nodeRects,
    routes,
  });
}

/**
 * @param {object} options
 * @returns {object}
 */
export function createNodeCanvasRenderSnapshotReceipt(options = {}) {
  let adopted = options.adopted === true;
  let invalidatedConnectionIds = Array.isArray(options.invalidatedConnectionIds)
    ? [...new Set(options.invalidatedConnectionIds.map(String).filter(Boolean))].sort()
    : [];
  return {
    schemaVersion: NODE_CANVAS_RENDER_SNAPSHOT_RECEIPT_SCHEMA,
    adopted,
    resolution: adopted ? 'cached-pcb' : 'pcb-live-reroute',
    reason: requireString(options.reason || (adopted ? 'adopted' : 'invalidated'), 'receipt.reason'),
    snapshotVersion: NODE_CANVAS_RENDER_SNAPSHOT_VERSION,
    routeCount: Number.isInteger(options.routeCount) && options.routeCount >= 0
      ? options.routeCount
      : 0,
    invalidatedConnectionIds,
  };
}

/**
 * @param {object} receipt
 * @returns {boolean}
 */
export function isNodeCanvasRenderSnapshotReceipt(receipt) {
  if (!receipt || receipt.schemaVersion !== NODE_CANVAS_RENDER_SNAPSHOT_RECEIPT_SCHEMA) return false;
  if (typeof receipt.adopted !== 'boolean') return false;
  if (receipt.resolution !== (receipt.adopted ? 'cached-pcb' : 'pcb-live-reroute')) return false;
  if (typeof receipt.reason !== 'string' || !receipt.reason) return false;
  if (!Number.isInteger(receipt.routeCount) || receipt.routeCount < 0) return false;
  if (!Array.isArray(receipt.invalidatedConnectionIds)) return false;
  try {
    return requirePositiveInteger(receipt.snapshotVersion, 'receipt.snapshotVersion') ===
      NODE_CANVAS_RENDER_SNAPSHOT_VERSION;
  } catch {
    return false;
  }
}
