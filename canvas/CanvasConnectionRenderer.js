import { getShape } from '../shapes/index.js';
import { routePcbTrace } from './PcbRouter.js';
import { alignSampledRouteEndpoints } from './CanvasGraph/CanvasGraphViewport.js';

function resolveThemeSource(canvasLayer) {
  return canvasLayer?.parentElement || canvasLayer?.getRootNode?.()?.host || canvasLayer || document.documentElement;
}

function resolveThemeValue(source, token, fallbackToken) {
  let computed = getComputedStyle(source);
  let value = computed.getPropertyValue(token).trim();
  if (value) return value;
  if (!fallbackToken) return '';
  return computed.getPropertyValue(fallbackToken).trim();
}

function resolveCssLength(source, value, fallback) {
  if (!value) return fallback;
  if (!value.includes('var(') && !value.includes('calc(')) {
    let direct = Number.parseFloat(value);
    if (Number.isFinite(direct)) return direct;
  }

  let probe = document.createElement('span');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.width = value;
  (source.append ? source : document.documentElement).append(probe);
  let resolved = Number.parseFloat(getComputedStyle(probe).width);
  probe.remove();
  return Number.isFinite(resolved) ? resolved : fallback;
}

function resolveThemeLength(source, token, fallback) {
  let value = getComputedStyle(source).getPropertyValue(token).trim();
  return resolveCssLength(source, value, fallback);
}

function resolveCssVars(source, value, seen = new Set()) {
  if (!value || !value.includes('var(')) return value || '';
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_match, token, fallback = '') => {
    if (seen.has(token)) return fallback.trim();
    seen.add(token);
    let nextValue = getComputedStyle(source).getPropertyValue(token).trim() || fallback.trim();
    return resolveCssVars(source, nextValue, seen);
  });
}

function parseCssRgb(value, source = document.documentElement) {
  if (!value) return null;
  let probe = document.createElement('span');
  probe.style.color = resolveCssVars(source, value);
  document.documentElement.append(probe);
  let normalized = getComputedStyle(probe).color;
  probe.remove();
  let match = normalized.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  let [r, g, b] = match[1]
    .split(',')
    .slice(0, 3)
    .map((part) => Number.parseFloat(part));
  return [r, g, b].every(Number.isFinite) ? [r, g, b] : null;
}

function mixRgb(a, b, weight) {
  return a.map((channel, index) => Math.round(channel * weight + b[index] * (1 - weight)));
}

function toRgba(rgb, alpha = 1) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function compactPathPoints(points) {
  let compact = [];
  for (let point of points) {
    let prev = compact.at(-1);
    if (!prev || Math.abs(prev.x - point.x) > 0.5 || Math.abs(prev.y - point.y) > 0.5) {
      compact.push(point);
    }
  }
  return compact;
}

function parsePathPoints(d) {
  let tokens = String(d || '').match(/[MLHVCSQTAZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  let points = [];
  let index = 0;
  let command = '';
  let x = 0;
  let y = 0;
  let readNumber = () => Number(tokens[index++]);

  while (index < tokens.length) {
    let token = tokens[index++];
    if (/^[a-z]$/i.test(token)) command = token.toUpperCase();
    else index -= 1;

    if (command === 'M' || command === 'L') {
      x = readNumber();
      y = readNumber();
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    } else if (command === 'H') {
      x = readNumber();
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    } else if (command === 'V') {
      y = readNumber();
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    } else if (command === 'C') {
      index += 4;
      x = readNumber();
      y = readNumber();
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    } else {
      break;
    }
  }

  return compactPathPoints(points);
}

function samplePathDPoints(d, sampleCount = 36) {
  if (typeof document === 'undefined') return parsePathPoints(d);
  let path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d || '');
  if (!path.getTotalLength || !path.getPointAtLength) return parsePathPoints(d);
  try {
    let total = path.getTotalLength();
    if (!Number.isFinite(total) || total <= 0) return parsePathPoints(d);
    let count = Math.max(2, Math.round(sampleCount));
    let points = [];
    for (let i = 0; i < count; i++) {
      let point = path.getPointAtLength((total * i) / (count - 1));
      points.push({ x: point.x, y: point.y });
    }
    return compactPathPoints(points);
  } catch {
    return parsePathPoints(d);
  }
}

function appendRouteSegment(route, points) {
  for (let point of points) {
    let previous = route.at(-1);
    if (!previous || Math.abs(previous.x - point.x) > 0.5 || Math.abs(previous.y - point.y) > 0.5) {
      route.push(point);
    }
  }
}

/**
 * Parallel support for connection rendering via HTML5 Canvas API.
 * This is used to test performance against the DOM-bound SVG renderer.
 */
export class CanvasConnectionRenderer {
  #canvasLayer;
  #dotLayer;
  #nodeViews;
  #editor;
  #onConnectionClick;
  #getZoom;
  #getPan;
  #onDotDrag;

  #pathStyle = 'bezier';
  #connectionData = new Map();
  #ctx;
  #resizeObserver;
  #resizeParent;
  #animationFrameId;
  #batchMode = false;
  #batchDirty = false;
  #pathCache = new Map();
  #transientPathStyle = '';
  #transientPathStyleRequests = new Map();
  #frozenConnectionLayer = null;
  #progressivePcbQueue = new Set();
  #progressivePcbFrame = 0;
  #progressivePcbBatchSize = 4;
  #processingProgressivePcb = false;
  #phantomSignature = '';

  /** @type {Array<{id:string, x:number, y:number, w:number, h:number, degree:number, color:string, label:string}>} */
  #phantomNodes = [];
  /** @type {Map<string, Object>} Fast lookup for phantom proxy by nodeId */
  #phantomMap = new Map();


  #colorParams = {
    normal: '',
    selected: '',
    outline: '',
    bg: '',
    text: '',
    width: 2,
    dotRadius: 7,
    dotStrokeWidth: 2,
  };

  /**
   * @param {Object} config
   * @param {HTMLCanvasElement} config.canvasLayer
   * @param {HTMLElement} config.dotLayer
   * @param {Map<string, HTMLElement>} config.nodeViews
   * @param {import('../core/GraphEditor.js').GraphEditor} config.editor
   * @param {function(string, MouseEvent)} config.onConnectionClick
   * @param {function(): number} config.getZoom
   * @param {function(): {x: number, y: number}} config.getPan
   * @param {function(Object)} config.onDotDrag
   */
  constructor(config = {}) {
    this.#canvasLayer = config.canvasLayer || document.createElement('canvas');
    this.#dotLayer = config.dotLayer;
    this.#nodeViews = config.nodeViews;
    this.#editor = config.editor;
    this.#onConnectionClick = config.onConnectionClick;
    this.#getZoom = config.getZoom || (() => 1);
    this.#getPan = config.getPan || (() => ({ x: 0, y: 0 }));
    this.#onDotDrag = config.onDotDrag;

    this.#ctx = this.#canvasLayer.getContext('2d', { alpha: true, desynchronized: false });
    this.#initResizeObserver();
    this.#updateStyles();
  }

  /**
   * Resize observer to keep the canvas 1:1 with device pixels
   */
  #initResizeObserver() {
    let parent = this.#canvasLayer.parentElement;
    if (!parent) return;
    if (this.#resizeObserver && this.#resizeParent === parent) {
      let rect = parent.getBoundingClientRect();
      this.#resizeCanvas(rect.width, rect.height);
      return;
    }
    this.#resizeObserver?.disconnect();
    this.#resizeParent = parent;

    this.#resizeObserver = new ResizeObserver((entries) => {
      let rect = entries[0].contentRect;
      this.#resizeCanvas(rect.width, rect.height);
      this.redraw();
    });

    this.#resizeObserver.observe(parent);
    let rect = parent.getBoundingClientRect();
    this.#resizeCanvas(rect.width, rect.height);
  }

  #resizeCanvas(width, height) {
    let dpr = window.devicePixelRatio || 1;
    let nextWidth = Math.max(1, Math.round(width * dpr));
    let nextHeight = Math.max(1, Math.round(height * dpr));
    if (this.#canvasLayer.width !== nextWidth) this.#canvasLayer.width = nextWidth;
    if (this.#canvasLayer.height !== nextHeight) this.#canvasLayer.height = nextHeight;
  }

  #updateStyles() {
    let source = resolveThemeSource(this.#canvasLayer);
    let computed = getComputedStyle(source);
    this.#colorParams.normal = resolveThemeValue(source, '--sn-conn-color', '--sn-sys-accent');
    this.#colorParams.selected = resolveThemeValue(source, '--sn-conn-selected', '--sn-sys-danger');
    this.#colorParams.outline = resolveThemeValue(source, '--sn-port-outline', '--sn-sys-surface-raised');
    this.#colorParams.bg = resolveThemeValue(source, '--sn-sys-surface');
    this.#colorParams.text = resolveThemeValue(source, '--sn-sys-on-surface');
    this.#colorParams.width = parseFloat(computed.getPropertyValue('--sn-conn-width')) || 2;
    let socketSize = resolveThemeLength(source, '--sn-socket-size', 12);
    let socketBorderWidth = resolveThemeLength(source, '--sn-socket-border-width', 2);
    this.#colorParams.dotStrokeWidth = resolveThemeLength(
      source,
      '--sn-conn-dot-stroke-width',
      socketBorderWidth
    );
    this.#colorParams.dotRadius = resolveThemeLength(
      source,
      '--sn-conn-dot-r',
      (socketSize + this.#colorParams.dotStrokeWidth) / 2
    );
  }

  #resolveColor(value) {
    let source = resolveThemeSource(this.#canvasLayer);
    return resolveCssVars(source, value);
  }

  #getNodeSize(nodeEl, fallbackWidth, fallbackHeight) {
    return {
      width: nodeEl?.offsetWidth || nodeEl?._cachedW || fallbackWidth,
      height: nodeEl?.offsetHeight || nodeEl?._cachedH || fallbackHeight,
    };
  }

  #getLocalElementCenter(nodeEl, childEl) {
    let nodeRect = nodeEl.getBoundingClientRect();
    let childRect = childEl.getBoundingClientRect();
    let localWidth = nodeEl.offsetWidth || nodeEl._cachedW || nodeRect.width;
    let localHeight = nodeEl.offsetHeight || nodeEl._cachedH || nodeRect.height;
    let scaleX = nodeRect.width && localWidth ? nodeRect.width / localWidth : this.#getZoom();
    let scaleY = nodeRect.height && localHeight ? nodeRect.height / localHeight : this.#getZoom();
    if (!Number.isFinite(scaleX) || scaleX === 0) scaleX = 1;
    if (!Number.isFinite(scaleY) || scaleY === 0) scaleY = scaleX;
    return {
      x: (childRect.left - nodeRect.left + childRect.width / 2) / scaleX,
      y: (childRect.top - nodeRect.top + childRect.height / 2) / scaleY,
    };
  }

  /** @param {'bezier'|'orthogonal'|'straight'|'pcb'} style */
  setPathStyle(style) {
    this.#pathStyle = style;
    this.#invalidatePathCache();
    this.redraw();
  }

  get data() {
    return this.#connectionData;
  }

  getConnectionPathPoints(connId) {
    let cached = this.#pathCache.get(connId);
    return cached?.d ? samplePathDPoints(cached.d) : [];
  }

  #connectionsForRouting() {
    let connections = [...this.#connectionData.values()];
    if (connections.length) return connections;
    return this.#editor?.getConnections?.() || [];
  }

  #connectionForId(connId) {
    let key = String(connId);
    return this.#connectionsForRouting().find((conn) => String(conn.id) === key) || null;
  }

  getConnectionEndpoints(connId) {
    let conn = this.#connectionForId(connId);
    if (!conn) return null;
    let fromEl = this.#nodeViews.get(conn.from) || this.#getPhantomProxy(conn.from);
    let toEl = this.#nodeViews.get(conn.to) || this.#getPhantomProxy(conn.to);
    if (!fromEl || !toEl) return null;
    let fromRect = this._nodeRectMap?.get(conn.from);
    let toRect = this._nodeRectMap?.get(conn.to);
    let fromPos = fromEl._position || (fromRect ? { x: fromRect.x, y: fromRect.y } : { x: 0, y: 0 });
    let toPos = toEl._position || (toRect ? { x: toRect.x, y: toRect.y } : { x: 0, y: 0 });
    let fromSize = this.#getNodeSize(fromEl, 180, 100);
    let toSize = this.#getNodeSize(toEl, 180, 100);
    let fromCenter = { x: fromPos.x + fromSize.width / 2, y: fromPos.y + fromSize.height / 2 };
    let toCenter = { x: toPos.x + toSize.width / 2, y: toPos.y + toSize.height / 2 };
    let fromOffset = this.getSocketOffset(fromEl, conn.out, 'output', toCenter);
    let toOffset = this.getSocketOffset(toEl, conn.in, 'input', fromCenter);
    return {
      start: { x: fromPos.x + fromOffset.x, y: fromPos.y + fromOffset.y },
      end: { x: toPos.x + toOffset.x, y: toPos.y + toOffset.y },
    };
  }

  getRouteBetweenNodes(fromNodeId, toNodeId, { maxDepth = 8 } = {}) {
    let fromId = String(fromNodeId || '');
    let toId = String(toNodeId || '');
    if (!fromId || !toId || fromId === toId) return null;

    let adjacency = new Map();
    let ensure = (id) => {
      if (!adjacency.has(id)) adjacency.set(id, []);
      return adjacency.get(id);
    };
    for (const conn of this.#connectionsForRouting()) {
      ensure(conn.from).push({ nodeId: conn.to, connId: conn.id, reverse: false });
      ensure(conn.to).push({ nodeId: conn.from, connId: conn.id, reverse: true });
    }

    let queue = [{ nodeId: fromId, segments: [] }];
    let visited = new Set([fromId]);
    while (queue.length) {
      let current = queue.shift();
      if (!current || current.segments.length >= maxDepth) continue;
      for (let edge of adjacency.get(current.nodeId) || []) {
        if (visited.has(edge.nodeId)) continue;
        let nextSegments = [...current.segments, edge];
        if (edge.nodeId === toId) {
          let route = [];
          for (let segment of nextSegments) {
            let endpoints = this.getConnectionEndpoints(segment.connId);
            let sampled = this.getConnectionPathPoints(segment.connId);
            if (segment.reverse) sampled = [...sampled].reverse();
            let points;
            if (endpoints) {
              let start = segment.reverse ? endpoints.end : endpoints.start;
              let end = segment.reverse ? endpoints.start : endpoints.end;
              points = sampled.length >= 2
                ? alignSampledRouteEndpoints(sampled, start, end)
                : [start, end];
            } else {
              points = sampled;
            }
            appendRouteSegment(route, points);
          }
          return {
            points: route.length >= 2 ? route : [],
            nodeIds: [fromId, ...nextSegments.map((segment) => segment.nodeId)],
            connectionIds: nextSegments.map((segment) => segment.connId),
          };
        }
        visited.add(edge.nodeId);
        queue.push({ nodeId: edge.nodeId, segments: nextSegments });
      }
    }

    return null;
  }

  addBatch(conns) {
    for (const conn of conns) {
      this.#connectionData.set(conn.id, conn);
    }
    this.#invalidatePathCache();
    this.redraw();
  }

  refreshAll() {
    this.#invalidatePathCache();
    this.redraw();
  }

  refreshViewportTransform() {
    this.redraw();
  }

  add(conn) {
    this.#connectionData.set(conn.id, conn);
    this.#invalidatePathCache();
    this.redraw();
  }

  remove(conn) {
    this.#connectionData.delete(conn.id);
    this.#pathCache.delete(conn.id);
    this.#progressivePcbQueue.delete(conn.id);
    this.redraw();
  }

  updateForNode(nodeId) {
    if (!nodeId) {
      this.#invalidatePathCache();
      this.redraw();
      return;
    }
    if (!this.#hasPcbDragProxyForNode(nodeId)) {
      for (const connId of this.#connectionIdsForNode(nodeId)) this.#pathCache.delete(connId);
    }
    this.redraw();
  }

  setTransientPathStyle(style = '', options = {}) {
    let nextStyle = style || '';
    let source = options.source || 'default';
    let previousScope = this.#transientPathScope();
    let previousRequest = this.#transientPathStyleRequests.get(source);
    let wasProgressiveSuspended = this.#progressivePcbSuspended();

    if (nextStyle) {
      let connectionIds = options.connectionIds
        ? new Set(Array.from(options.connectionIds, String))
        : null;
      if (nextStyle === 'pcb-drag-proxy' && options.freezeLayer === true) {
        this.#captureFrozenConnectionLayer();
      } else if (nextStyle !== 'pcb-drag-proxy' || options.reuseFrozenPaths !== true) {
        this.#frozenConnectionLayer = null;
      }
      let frozenPaths =
        options.reuseFrozenPaths === true && previousRequest?.style === nextStyle
          ? previousRequest.frozenPaths
          : null;
      if (nextStyle === 'pcb-drag-proxy' && !frozenPaths) {
        frozenPaths = this.#captureConnectionPathPoints(connectionIds);
      }
      this.#transientPathStyleRequests.delete(source);
      this.#transientPathStyleRequests.set(source, {
        style: nextStyle,
        connectionIds,
        draggedNodeId: options.draggedNodeId,
        frozenPaths,
        suspendProgressivePcb: options.suspendProgressivePcb === true,
      });
    } else {
      this.#transientPathStyleRequests.delete(source);
      this.#frozenConnectionLayer = null;
    }

    let isProgressiveSuspended = this.#progressivePcbSuspended();
    if (!wasProgressiveSuspended && isProgressiveSuspended) {
      this.#cancelProgressivePcbFrame();
    }

    this.#transientPathStyle = this.#globalTransientPathStyle();
    let nextScope = this.#transientPathScope();
    if (previousScope.global || nextScope.global) {
      this.#invalidatePathCache();
      this.redraw();
      return;
    }

    let affected = this.#changedTransientConnections(previousScope.connectionIds, nextScope.connectionIds);
    let protectedProxyIds = this.#activePcbDragProxyConnectionIds();
    for (const connId of affected) {
      if (!protectedProxyIds.global && !protectedProxyIds.ids.has(connId)) {
        this.#pathCache.delete(connId);
      }
    }
    this.redraw();
    if (wasProgressiveSuspended && !isProgressiveSuspended) {
      this.#requestProgressivePcbFrame();
    }
  }

  get transientPathStyle() {
    return this.#transientPathStyle;
  }

  setFlowing(connId, active) {
    let conn = this.#connectionData.get(connId);
    if (!conn || conn.flowing === active) return;
    conn.flowing = active;
    this.redraw();
  }

  setAllFlowing(active) {
    let changed = false;
    for (const conn of this.#connectionData.values()) {
      if (conn.flowing === active) continue;
      conn.flowing = active;
      changed = true;
    }
    if (changed) this.redraw();
  }

  highlightDotsForNodes(_compatibleNodeIds) {}
  clearDotHighlights() {}
  renderFreeDots(_nodeId) {}
  removeFreeDot(_nodeId, _key, _side) {}
  refreshFreeDots(_nodeId) {}
  findNearestDot(_wx, _wy, _radius = 20) {
    return null;
  }

  clear() {
    this.#connectionData.clear();
    this.#phantomNodes = [];
    this.#phantomMap.clear();
    this.#phantomSignature = '';
    this.#invalidatePathCache();
    this.redraw();
  }


  /**
   * Set phantom nodes — nodes without DOM that are rendered as Canvas dots.
   * @param {Array<{id:string, x:number, y:number, w:number, h:number, degree:number, color:string, label:string}>} nodes
   */
  setPhantomNodes(nodes) {
    let nextNodes = nodes || [];
    let nextSignature = this.#getPhantomSignature(nextNodes);
    if (nextSignature === this.#phantomSignature) return;

    this.#phantomNodes = nextNodes;
    this.#phantomSignature = nextSignature;
    this.#phantomMap.clear();
    for (const n of this.#phantomNodes) {
      this.#phantomMap.set(n.id, n);
    }
    this.#invalidatePathCache();
    this.redraw();
  }

  #getPhantomSignature(nodes) {
    return nodes
      .map((node) => [
        node?.id || '',
        node?.x ?? 0,
        node?.y ?? 0,
        node?.w ?? 0,
        node?.h ?? 0,
        node?.degree ?? 0,
        node?.color || '',
        node?.label || '',
      ].join(':'))
      .join('|');
  }

  #invalidatePathCache() {
    this.#pathCache.clear();
    this.#frozenConnectionLayer = null;
    this.#cancelProgressivePcb();
  }

  #cancelProgressivePcb() {
    this.#cancelProgressivePcbFrame();
    this.#processingProgressivePcb = false;
    this.#progressivePcbQueue.clear();
  }

  #cancelProgressivePcbFrame() {
    if (this.#progressivePcbFrame && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.#progressivePcbFrame);
    }
    this.#progressivePcbFrame = 0;
  }

  #progressivePcbSuspended() {
    for (const request of this.#transientPathStyleRequests.values()) {
      if (request.suspendProgressivePcb) return true;
    }
    return false;
  }

  #requestProgressivePcbFrame() {
    if (
      this.#processingProgressivePcb ||
      this.#progressivePcbFrame ||
      this.#progressivePcbSuspended() ||
      !this.#progressivePcbQueue.size ||
      typeof requestAnimationFrame !== 'function'
    ) {
      return;
    }
    this.#progressivePcbFrame = requestAnimationFrame(() => {
      this.#progressivePcbFrame = 0;
      this.#processProgressivePcb();
    });
  }

  suspendProgressiveRendering(source = 'viewport-motion') {
    this.#transientPathStyleRequests.set(source, {
      style: this.#pathStyle,
      connectionIds: new Set(),
      suspendProgressivePcb: true,
    });
    this.#cancelProgressivePcbFrame();
  }

  resumeProgressiveRendering(source = 'viewport-motion') {
    let changed = this.#transientPathStyleRequests.delete(source);
    if (changed) this.#requestProgressivePcbFrame();
  }

  #connectionHasTransientRequest(connId) {
    for (const request of this.#transientPathStyleRequests.values()) {
      if (!request.connectionIds || request.connectionIds.has(connId)) return true;
    }
    return false;
  }

  #scheduleProgressivePcb(connId) {
    if (this.#connectionHasTransientRequest(connId)) return;
    this.#progressivePcbQueue.add(connId);
    this.#requestProgressivePcbFrame();
  }

  #processProgressivePcb() {
    if (!this.#progressivePcbQueue.size) return;
    if (this.#progressivePcbSuspended()) return;
    let batch = [...this.#progressivePcbQueue]
      .filter((connId) => !this.#connectionHasTransientRequest(connId))
      .slice(0, this.#progressivePcbBatchSize);
    if (!batch.length) {
      this.#progressivePcbFrame = 0;
      return;
    }
    for (const connId of batch) {
      this.#progressivePcbQueue.delete(connId);
      let conn = this.#connectionData.get(connId);
      if (conn) this.#plotPath(this.#ctx, conn, { fullPcb: true });
    }
    this.#processingProgressivePcb = true;
    try {
      this.redraw();
    } finally {
      this.#processingProgressivePcb = false;
    }
    this.#requestProgressivePcbFrame();
  }

  #captureFrozenConnectionLayer() {
    if (!this.#canvasLayer.width || !this.#canvasLayer.height) return;
    let layer = document.createElement('canvas');
    layer.width = this.#canvasLayer.width;
    layer.height = this.#canvasLayer.height;
    let ctx = layer.getContext('2d', { alpha: true });
    if (!ctx) return;
    ctx.drawImage(this.#canvasLayer, 0, 0);
    this.#frozenConnectionLayer = layer;
  }

  #connectionIdsForNode(nodeId) {
    let ids = [];
    for (const [connId, conn] of this.#connectionData) {
      if (conn.from === nodeId || conn.to === nodeId) ids.push(connId);
    }
    return ids;
  }

  #hasPcbDragProxyForNode(nodeId) {
    for (const request of this.#transientPathStyleRequests.values()) {
      if (request.style !== 'pcb-drag-proxy') continue;
      if (request.draggedNodeId === nodeId) return true;
      if (!request.connectionIds) return true;
    }
    return false;
  }

  #activePcbDragProxyConnectionIds() {
    let ids = new Set();
    for (const request of this.#transientPathStyleRequests.values()) {
      if (request.style !== 'pcb-drag-proxy') continue;
      if (!request.connectionIds) return { global: true, ids };
      for (const connId of request.connectionIds) ids.add(connId);
    }
    return { global: false, ids };
  }

  #captureConnectionPathPoints(connectionIds) {
    let frozenPaths = new Map();
    let ids = connectionIds || this.#connectionData.keys();
    for (const connId of ids) {
      let cached = this.#pathCache.get(connId);
      let points = parsePathPoints(cached?.d || '');
      if (points.length >= 2) frozenPaths.set(connId, points);
    }
    return frozenPaths;
  }

  #globalTransientPathStyle() {
    let pathStyle = '';
    for (const request of this.#transientPathStyleRequests.values()) {
      if (!request.connectionIds) pathStyle = request.style;
    }
    return pathStyle;
  }

  #transientPathScope() {
    let connectionIds = new Set();
    for (const request of this.#transientPathStyleRequests.values()) {
      if (!request.connectionIds) return { global: true, connectionIds };
      for (const connId of request.connectionIds) connectionIds.add(connId);
    }
    return { global: false, connectionIds };
  }

  #changedTransientConnections(previousIds, nextIds) {
    let changed = new Set();
    for (const connId of previousIds) {
      if (!nextIds.has(connId)) changed.add(connId);
    }
    for (const connId of nextIds) {
      if (!previousIds.has(connId)) changed.add(connId);
    }
    return changed;
  }

  #transientRequestForConnection(conn) {
    let pathStyle = this.#pathStyle;
    let matched = null;
    for (const request of this.#transientPathStyleRequests.values()) {
      if (!request.connectionIds || request.connectionIds.has(conn.id)) {
        pathStyle = request.style;
        matched = request;
      }
    }
    return matched ? { ...matched, style: pathStyle } : null;
  }

  #buildPcbDragProxyPath(conn, request, { start, end }) {
    let frozen = request?.frozenPaths?.get?.(conn.id);
    if (!frozen || frozen.length < 2) return '';
    let draggedNodeId = request?.draggedNodeId;
    let movingFrom = draggedNodeId === conn.from;
    let movingTo = draggedNodeId === conn.to;
    if (!movingFrom && !movingTo) return '';

    if (movingFrom) {
      let anchor = frozen[0];
      return `M ${anchor.x} ${anchor.y} L ${start.x} ${start.y}`;
    }

    let anchor = frozen.at(-1);
    return `M ${anchor.x} ${anchor.y} L ${end.x} ${end.y}`;
  }

  #scheduleRenderLoop() {
    if (this.#animationFrameId) return;
    this.#animationFrameId = requestAnimationFrame(this.#renderLoop);
  }

  #stopRenderLoop() {
    if (!this.#animationFrameId) return;
    cancelAnimationFrame(this.#animationFrameId);
    this.#animationFrameId = null;
  }

  /**
   * Retrieve actual connector coordinate relative to the origin.
   * @returns {{x: number, y: number}}
   */
  getSocketOffset(nodeEl, portKey, side, targetPos) {
    if (!nodeEl) return { x: 0, y: 0 };
    let nodeSize = this.#getNodeSize(nodeEl, 180, 100);
    let w = nodeSize.width;
    let h = nodeSize.height;

    if (nodeEl._slotCache && nodeEl._slotCache.has(portKey)) {
      let cached = nodeEl._slotCache.get(portKey);
      return {
        x: cached.x,
        y: cached.y,
        angle: cached.angle,
      };
    }

    let nodeModel = this.#editor?.getNode(nodeEl.getAttribute?.('node-id') || nodeEl.id);
    let portIndex = 0;
    let totalPorts = 1;

    if (nodeModel && nodeModel.type !== 'param') {
      let portsData = side === 'output' ? nodeModel.outputs : nodeModel.inputs;
      if (portsData) {
        let keys = Object.keys(portsData);
        totalPorts = keys.length || 1;
        let idx = keys.indexOf(portKey);
        if (idx !== -1) portIndex = idx;
      }
    }


    let shapeConfig = getShape(nodeModel?.shape);
    if (shapeConfig && shapeConfig.pathData && targetPos && shapeConfig.getEdgePoint) {
      let portsData = side === 'output' ? nodeModel?.outputs : nodeModel?.inputs;
      let keys = portsData ? Object.keys(portsData) : [portKey];
      let index = Math.max(0, keys.indexOf(portKey));
      let total = Math.max(1, keys.length);
      let nodePos = nodeEl._position || { x: 0, y: 0 };
      let cx = nodePos.x + w / 2;
      let cy = nodePos.y + h / 2;
      let baseAngle = Math.atan2(targetPos.y - cy, targetPos.x - cx);
      let angle = baseAngle;
      let shouldReverse = side === 'output' ? targetPos.y < cy : targetPos.y > cy;
      let effectiveIndex = shouldReverse ? total - 1 - index : index;
      if (total > 1) {
        let sideGap = Math.PI / 6;
        angle =
          baseAngle +
          (side === 'output' ? -sideGap : sideGap) +
          (effectiveIndex - (total - 1) / 2) * ((2 * Math.PI) / (total * 2));
      }
      let step = Math.PI / 12;
      angle = Math.round(angle / step) * step;
      return shapeConfig.getEdgePoint(angle, { width: w, height: h });
    }

    if (shapeConfig && shapeConfig.pathData && shapeConfig.getSocketPosition) {
      let pos = shapeConfig.getSocketPosition(
        side,
        portIndex,
        totalPorts,
        { width: w, height: h },
        targetPos
      );
      if (pos) return pos;
    }


    let container =
      side === 'output' ? nodeEl.querySelector('.outputs') : nodeEl.querySelector('.inputs');

    if (container) {
      let portItems = container.querySelectorAll('port-item');
      for (const portItem of portItems) {
        if (String(portItem.$.key) === String(portKey)) {
          let socket = portItem.querySelector('.sn-socket');
          if (socket) {
            return this.#getLocalElementCenter(nodeEl, socket);
          }
        }
      }
    }

    return {
      x: side === 'output' ? w : 0,
      y: h / 2,
    };
  }

  #hasSelection = false;
  #activeConnIds = new Set();

  setSelectionState(hasSelection, activeConnIds) {
    this.#hasSelection = hasSelection;
    this.#activeConnIds = activeConnIds;
    this.redraw();
  }

  /** Suppress redraws during batch operations (e.g. setEditor initialization) */
  setBatchMode(on) {
    this.#batchMode = on;
    if (!on && this.#batchDirty) {
      this.#batchDirty = false;
      this.redraw();
    }
  }

  /** Perform full synchronous redraw of all connections */
  redraw() {
    if (this.#batchMode) {
      this.#batchDirty = true;
      return;
    }
    this.#initResizeObserver();
    let ctx = this.#ctx;
    if (!ctx) return;


    let dpr = window.devicePixelRatio || 1;
    let zoom = this.#getZoom();
    this._frameZoom = zoom;
    let pan = this.#getPan();


    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.#canvasLayer.width, this.#canvasLayer.height);


    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * pan.x, dpr * pan.y);


    this.#updateStyles();

    let time = Date.now();
    let hasFlowing = false;


    this._nodeRectMap = new Map();
    for (const [nid, el] of this.#nodeViews) {
      if (el && el._position) {
        let size = this.#getNodeSize(el, 180, 60);
        this._nodeRectMap.set(nid, {
          id: nid,
          x: el._position.x,
          y: el._position.y,
          w: size.width,
          h: size.height,
          el: el,
        });
      }
    }

    for (const node of this.#phantomNodes) {
      if (node && !this._nodeRectMap.has(node.id)) {
        this._nodeRectMap.set(node.id, {
          id: node.id,
          x: node.x || 0,
          y: node.y || 0,
          w: node.w || 180,
          h: node.h || 60,
          el: null,
        });
      }
    }


    let connIndexMap = new Map();
    let ci = 0;
    for (const key of this.#connectionData.keys()) {
      connIndexMap.set(key, ci++);
    }
    this._connIndexMap = connIndexMap;

    let frozenProxyIds = this.#activePcbDragProxyConnectionIds();
    if (this.#frozenConnectionLayer && (frozenProxyIds.global || frozenProxyIds.ids.size)) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.#frozenConnectionLayer, 0, 0);
      ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * pan.x, dpr * pan.y);
      this.#drawFrozenDragProxies(ctx, zoom, frozenProxyIds);
      this.#stopRenderLoop();
      return;
    }

    let socketsToDraw = new Map();

    let drawConnection = (id, connection) => {

      let isFlowing = connection.flowing;
      let isActive = this.#activeConnIds ? this.#activeConnIds.has(connection.id) : false;
      let isSelected = isActive;
      let isDimmed = !isActive && this.#hasSelection;

      let fromNode = this.#editor?.getNode(connection.from);
      let toNode = this.#editor?.getNode(connection.to);
      let fromColor = this.#resolveColor(fromNode?.outputs?.[connection.out]?.socket?.color);
      let toColor = this.#resolveColor(toNode?.inputs?.[connection.in]?.socket?.color);


      let baseWidth = this.#colorParams.width;
      ctx.lineWidth = Math.max(baseWidth, 1.5 / zoom);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 1.0;

      ctx.beginPath();
      let coords = null;
      try {
        coords = this.#plotPath(ctx, connection);
      } catch (err) {
        if (CanvasConnectionRenderer.debug) {
          console.warn('[CanvasConnectionRenderer] Path failed:', err);
        }
      }
      if (!coords) return;


      socketsToDraw.set(`${connection.from}:${connection.out}`, {
        x: coords.startX,
        y: coords.startY,
        color: fromColor || this.#colorParams.normal,
      });
      socketsToDraw.set(`${connection.to}:${connection.in}`, {
        x: coords.endX,
        y: coords.endY,
        color: toColor || this.#colorParams.normal,
      });

      let finalColor;
      if (fromColor && toColor && fromColor !== toColor) {
        let grad = ctx.createLinearGradient(coords.startX, coords.startY, coords.endX, coords.endY);
        grad.addColorStop(0, fromColor);
        grad.addColorStop(1, toColor);
        finalColor = grad;
      } else {
        finalColor = fromColor || this.#colorParams.normal;
      }

      if (isDimmed) {

        let baseColor = fromColor || this.#colorParams.normal;
        let source = resolveThemeSource(this.#canvasLayer);
        let baseRgb = parseCssRgb(baseColor, source);
        let bgRgb = parseCssRgb(this.#colorParams.bg, source);
        if (baseRgb && bgRgb) {
          finalColor = toRgba(mixRgb(baseRgb, bgRgb, 0.15));
        }
      }

      ctx.strokeStyle = finalColor;
      ctx.fillStyle = finalColor;

      if (isFlowing) {
        ctx.setLineDash([10, 10]);
        ctx.lineDashOffset = -(time / 20) % 20;
        hasFlowing = true;
      } else {
        ctx.setLineDash([]);
      }


      if (isSelected && !isDimmed) {
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.stroke(coords.path2D);

      if (coords.dragProxyPath2D) {
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.setLineDash([]);
        ctx.strokeStyle = this.#colorParams.selected || this.#colorParams.normal;
        ctx.lineWidth = Math.max(baseWidth + 1, 2 / zoom);
        ctx.stroke(coords.dragProxyPath2D);
        ctx.restore();
      }


      if (coords.arrow) {
        ctx.save();
        ctx.translate(coords.arrow.x, coords.arrow.y);

        ctx.rotate(coords.arrow.angle);
        ctx.beginPath();
        ctx.moveTo(-5, -3.5);
        ctx.lineTo(5, 0);
        ctx.lineTo(-5, 3.5);
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
        ctx.restore();
      }
    };

    if (this.#hasSelection) {
      for (const [id, connection] of this.#connectionData) {
        if (!this.#activeConnIds.has(connection.id)) drawConnection(id, connection);
      }
      for (const [id, connection] of this.#connectionData) {
        if (this.#activeConnIds.has(connection.id)) drawConnection(id, connection);
      }
    } else {
      for (const [id, connection] of this.#connectionData) {
        drawConnection(id, connection);
      }
    }


    ctx.setLineDash([]);

    for (const [, pos] of socketsToDraw) {
      ctx.beginPath();


      ctx.arc(pos.x, pos.y, this.#colorParams.dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = pos.color;
      ctx.fill();
      ctx.lineWidth = this.#colorParams.dotStrokeWidth;
      ctx.strokeStyle = this.#colorParams.outline;
      ctx.stroke();
    }


    this.#drawPhantomDots(ctx, zoom);


    if (hasFlowing) this.#scheduleRenderLoop();
    else this.#stopRenderLoop();
  }

  #drawFrozenDragProxies(ctx, zoom, proxyIds) {
    let ids = proxyIds.global ? this.#connectionData.keys() : proxyIds.ids;
    let baseWidth = this.#colorParams.width;

    ctx.save();
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    ctx.strokeStyle = this.#colorParams.selected || this.#colorParams.normal;
    ctx.lineWidth = Math.max(baseWidth + 1, 2 / zoom);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const connId of ids) {
      let connection = this.#connectionData.get(connId);
      if (!connection) continue;
      let coords = this.#plotPath(ctx, connection);
      if (coords?.dragProxyPath2D) ctx.stroke(coords.dragProxyPath2D);
    }

    ctx.restore();
  }

  /**
   * Draw phantom nodes as colored dots with size proportional to degree.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} zoom
   */
  #drawPhantomDots(ctx, zoom) {
    if (this.#phantomNodes.length === 0) return;

    ctx.shadowBlur = 0;
    ctx.setLineDash([]);


    let minWorldW = Math.max(180, 8 / zoom);
    let minWorldH = Math.max(60, 4 / zoom);
    let showLabels = zoom > 0.15;
    let labelFontSize = Math.max(9, Math.min(14, 12 / zoom));

    for (const node of this.#phantomNodes) {
      if (!node || node.w === undefined || node.h === undefined) continue;

      let w = Math.max(minWorldW, node.w);
      let h = Math.max(minWorldH, node.h);

      let x = (node.x || 0) - (w - node.w) / 2;
      let y = (node.y || 0) - (h - node.h) / 2;

      ctx.beginPath();
      try {
        let r = Math.min(6, w * 0.1, h * 0.1);
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
      } catch {
        ctx.rect(x, y, w, h);
      }

      ctx.fillStyle = node.color || this.#colorParams.normal;
      ctx.globalAlpha = 0.85;
      ctx.fill();


      ctx.lineWidth = Math.max(1.5, 1 / zoom);
      ctx.strokeStyle = this.#colorParams.outline;
      ctx.stroke();
      ctx.globalAlpha = 1.0;


      if (showLabels && node.label) {
        ctx.fillStyle = this.#colorParams.text;
        ctx.globalAlpha = 1;
        ctx.font = `${labelFontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 4, y, w - 8, h);
        ctx.clip();
        ctx.fillText(node.label, x + w / 2, y + h / 2);
        ctx.restore();
      }
    }
  }

  /**
   * Create a minimal proxy object for a phantom node so #plotPath can work.
   * Mimics the shape of a DOM nodeView element with _position and _cachedW/H.
   * @returns {object|null}
   */
  #getPhantomProxy(nodeId) {
    let phantom = this.#phantomMap.get(nodeId);
    if (!phantom) return null;
    return {
      id: phantom.id,
      _position: { x: phantom.x, y: phantom.y },
      _cachedW: phantom.w,
      _cachedH: phantom.h,
      offsetWidth: phantom.w,
      offsetHeight: phantom.h,
      getAttribute: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      style: {},
    };
  }

  #renderLoop = () => {
    this.#animationFrameId = null;
    this.redraw();
  };

  #plotPath(ctx, conn, options = {}) {
    let transientRequest = this.#transientRequestForConnection(conn);
    let effectiveStyle = transientRequest?.style || this.#pathStyle;
    let cached = this.#pathCache.get(conn.id);
    let renderFullPcb = options.fullPcb === true || this.#progressivePcbSuspended();
    if (effectiveStyle !== 'pcb-drag-proxy' && cached?.pathStyle === effectiveStyle) {
      return cached;
    }
    if (
      !renderFullPcb &&
      effectiveStyle === 'pcb' &&
      cached?.pathStyle === 'pcb-draft'
    ) {
      this.#scheduleProgressivePcb(conn.id);
      return cached;
    }

    let fromElNodeView = this.#nodeViews.get(conn.from);
    let toElNodeView = this.#nodeViews.get(conn.to);


    if (!fromElNodeView) fromElNodeView = this.#getPhantomProxy(conn.from);
    if (!toElNodeView) toElNodeView = this.#getPhantomProxy(conn.to);
    if (!fromElNodeView || !toElNodeView) return;

    let fromPos = fromElNodeView._position || { x: 0, y: 0 };
    let toPos = toElNodeView._position || { x: 0, y: 0 };

    let fromEl = fromElNodeView;
    let toEl = toElNodeView;

    if (this._nodeRectMap) {
      let c1 = this._nodeRectMap.get(conn.from);
      if (c1) {
        fromPos = { x: c1.x, y: c1.y };
        if (c1.el) fromEl = c1.el;
      }
      let c2 = this._nodeRectMap.get(conn.to);
      if (c2) {
        toPos = { x: c2.x, y: c2.y };
        if (c2.el) toEl = c2.el;
      }
    }

    let fromSizeMeasured = this.#getNodeSize(fromEl, 180, 100);
    let toSizeMeasured = this.#getNodeSize(toEl, 180, 100);
    let fromW = fromSizeMeasured.width;
    let fromH = fromSizeMeasured.height;
    let toW = toSizeMeasured.width;
    let toH = toSizeMeasured.height;

    let fromSize = { width: fromW, height: fromH };
    let toSize = { width: toW, height: toH };
    let fromNode = this.#editor?.getNode(conn.from);
    let toNode = this.#editor?.getNode(conn.to);
    let fromShape = getShape(fromNode?.shape);
    let toShape = getShape(toNode?.shape);

    let fromCenter = { x: fromPos.x + fromW / 2, y: fromPos.y + fromH / 2 };
    let toCenter = { x: toPos.x + toW / 2, y: toPos.y + toH / 2 };

    let fromOffset = this.getSocketOffset(fromEl, conn.out, 'output', toCenter);
    let toOffset = this.getSocketOffset(toEl, conn.in, 'input', fromCenter);

    let startX = fromPos.x + fromOffset.x;
    let startY = fromPos.y + fromOffset.y;
    let endX = toPos.x + toOffset.x;
    let endY = toPos.y + toOffset.y;

    let d;
    let arrow = { x: endX, y: endY, angle: 0 };
    let cachePathStyle = effectiveStyle;
    if (effectiveStyle === 'straight') {
      d = `M ${startX} ${startY} L ${endX} ${endY}`;
      arrow.x = (startX + endX) / 2;
      arrow.y = (startY + endY) / 2;
      arrow.angle = Math.atan2(endY - startY, endX - startX);
    } else if (effectiveStyle === 'orthogonal') {
      let connIndex = this._connIndexMap ? (this._connIndexMap.get(conn.id) ?? 0) : 0;
      let traceOffset = (connIndex > -1 ? connIndex % 10 : 0) * 4;

      let fromAngle = fromOffset.angle !== undefined ? fromOffset.angle : 0;
      let toAngle = toOffset.angle !== undefined ? toOffset.angle : 180;

      let stubLen = 20;
      let getDxDy = (deg) => ({
        dx: Math.round(Math.cos((deg * Math.PI) / 180)),
        dy: Math.round(Math.sin((deg * Math.PI) / 180)),
      });

      let fDir = getDxDy(fromAngle);
      let tDir = getDxDy(toAngle);

      let p1x = startX + fDir.dx * stubLen;
      let p1y = startY + fDir.dy * stubLen;
      let p2x = endX + tDir.dx * stubLen;
      let p2y = endY + tDir.dy * stubLen;

      let fromH = fromEl._cachedH || 60;
      let toH = toEl._cachedH || 60;

      let pts = [
        { x: startX, y: startY },
        { x: p1x, y: p1y },
      ];
      let skipObstacles = this._nodeRectMap && this._nodeRectMap.size > 200;

      if (endX < startX) {
        let bottomY = Math.max(fromPos.y + fromH, toPos.y + toH) + 30 + traceOffset;
        pts.push({ x: p1x, y: bottomY });
        pts.push({ x: p2x, y: bottomY });
      } else if (skipObstacles) {

        let midX = (p1x + p2x) / 2 + traceOffset;
        pts.push({ x: midX, y: p1y });
        pts.push({ x: midX, y: p2y });
      } else {
        let maxH = Math.max(fromH, toH);
        if (Math.abs(p1y - p2y) < maxH) {
          let nodeBetween = false;
          let obstacleIter = this._nodeRectMap ? this._nodeRectMap.values() : [];
          for (const rect of obstacleIter) {
            let nx = rect.x;
            let ny = rect.y;
            let nw = rect.w || 180;
            let nh = rect.h || 60;
            if (nx > p1x && nx + nw < p2x) {
              if (Math.min(p1y, p2y) <= ny + nh && Math.max(p1y, p2y) >= ny) {
                nodeBetween = true;
                break;
              }
            }
          }

          if (nodeBetween) {
            let detourY = Math.min(fromPos.y, toPos.y) - 30 - traceOffset;
            pts.push({ x: p1x, y: detourY });
            pts.push({ x: p2x, y: detourY });
          } else {
            let midX = (p1x + p2x) / 2 + traceOffset;
            pts.push({ x: midX, y: p1y });
            pts.push({ x: midX, y: p2y });
          }
        } else {
          let midX = (p1x + p2x) / 2 + traceOffset;
          let obstacleNode = null;
          let minY = Math.min(p1y, p2y);
          let maxY = Math.max(p1y, p2y);

          let obstIter = this._nodeRectMap ? this._nodeRectMap.values() : [];
          for (const rect of obstIter) {
            let nx = rect.x;
            let ny = rect.y;
            let nw = rect.w || 180;
            let nh = rect.h || 60;
            if (midX >= nx && midX <= nx + nw) {
              if (ny <= maxY && ny + nh >= minY) {
                obstacleNode = { x: nx, w: nw };
                break;
              }
            }
          }

          if (obstacleNode) {
            let leftDist = Math.abs(midX - obstacleNode.x);
            let rightDist = Math.abs(midX - (obstacleNode.x + obstacleNode.w));
            if (leftDist < rightDist) {
              midX = obstacleNode.x - 30 - traceOffset;
            } else {
              midX = obstacleNode.x + obstacleNode.w + 30 + traceOffset;
            }
          }

          pts.push({ x: midX, y: p1y });
          pts.push({ x: midX, y: p2y });
        }
      }

      pts.push({ x: p2x, y: p2y });
      pts.push({ x: endX, y: endY });

      let path = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        let prev = pts[i - 1];
        let curr = pts[i];
        if (curr.x === prev.x && curr.y === prev.y) continue;
        if (curr.x !== prev.x && curr.y !== prev.y) {
          path += ` H ${curr.x} V ${curr.y}`;
        } else if (curr.x !== prev.x) {
          path += ` H ${curr.x}`;
        } else if (curr.y !== prev.y) {
          path += ` V ${curr.y}`;
        }
      }
      if (pts.length >= 2) {
        let midIndex = Math.floor(pts.length / 2);
        let p1 = pts[midIndex - 1];
        let p2 = pts[midIndex];
        if (p1 && p2) {
          arrow.x = (p1.x + p2.x) / 2;
          arrow.y = (p1.y + p2.y) / 2;
          arrow.angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        }
      }
      d = path;
    } else if (effectiveStyle === 'pcb-drag-proxy') {
      let proxyD =
        this.#buildPcbDragProxyPath(conn, transientRequest, {
          start: { x: startX, y: startY },
          end: { x: endX, y: endY },
          fromAngle: fromOffset.angle ?? 0,
          toAngle: toOffset.angle ?? 180,
        }) || `M ${startX} ${startY} L ${endX} ${endY}`;
      let base = cached?.pathStyle === 'pcb' ? cached : null;
      if (!base) {
        let straight = `M ${startX} ${startY} L ${endX} ${endY}`;
        base = {
          startX,
          startY,
          endX,
          endY,
          d: straight,
          path2D: new Path2D(straight),
          arrow: null,
          pathStyle: 'pcb',
        };
      }
      return {
        ...base,
        startX,
        startY,
        endX,
        endY,
        dragProxyPath2D: new Path2D(proxyD),
        pathStyle: 'pcb-drag-proxy',
      };
    } else if (effectiveStyle === 'pcb') {
      let routed = routePcbTrace({
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        fromRect: { id: conn.from, x: fromPos.x, y: fromPos.y, w: fromW, h: fromH },
        toRect: { id: conn.to, x: toPos.x, y: toPos.y, w: toW, h: toH },
        fromAngle: fromOffset.angle ?? 0,
        toAngle: toOffset.angle ?? 180,
        rects: this._nodeRectMap ? [...this._nodeRectMap.values()] : [],
        connections: [...this.#connectionData.values()],
        conn,
        quality: renderFullPcb ? 'full' : 'draft',
      });
      d = routed.path;
      arrow = routed.arrow;
      if (!renderFullPcb) {
        this.#scheduleProgressivePcb(conn.id);
        cachePathStyle = 'pcb-draft';
      } else {
        cachePathStyle = 'pcb';
      }
    } else {

      let fromAngleDeg, toAngleDeg;

      if (fromOffset.angle !== undefined) {
        fromAngleDeg = fromOffset.angle;
      } else {
        let fromPortIndex = fromNode ? Object.keys(fromNode.outputs).indexOf(conn.out) : 0;
        let fromPortTotal = fromNode ? Object.keys(fromNode.outputs).length : 1;
        let pos = fromShape?.getSocketPosition?.('output', fromPortIndex, fromPortTotal, fromSize);
        fromAngleDeg = pos?.angle ?? 0;
      }

      if (toOffset.angle !== undefined) {
        toAngleDeg = toOffset.angle;
      } else {
        let toPortIndex = toNode ? Object.keys(toNode.inputs).indexOf(conn.in) : 0;
        let toPortTotal = toNode ? Object.keys(toNode.inputs).length : 1;
        let pos = toShape?.getSocketPosition?.('input', toPortIndex, toPortTotal, toSize);
        toAngleDeg = pos?.angle ?? 180;
      }

      let dist = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
      let cpLen = Math.max(50, dist * 0.4);
      let fromRad = (fromAngleDeg * Math.PI) / 180;
      let toRad = (toAngleDeg * Math.PI) / 180;

      let cp1x = startX + Math.cos(fromRad) * cpLen;
      let cp1y = startY + Math.sin(fromRad) * cpLen;
      let cp2x = endX + Math.cos(toRad) * cpLen;
      let cp2y = endY + Math.sin(toRad) * cpLen;

      d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

      arrow.x = (startX + 3 * cp1x + 3 * cp2x + endX) / 8;
      arrow.y = (startY + 3 * cp1y + 3 * cp2y + endY) / 8;
      arrow.angle = Math.atan2(endY + cp2y - cp1y - startY, endX + cp2x - cp1x - startX);
    }

    let coords = {
      startX,
      startY,
      endX,
      endY,
      d,
      path2D: new Path2D(d),
      arrow,
      pathStyle: cachePathStyle,
    };
    this.#pathCache.set(conn.id, coords);
    return coords;
  }

  destroy() {
    if (this.#resizeObserver) this.#resizeObserver.disconnect();
    this.#resizeObserver = null;
    this.#resizeParent = null;
    this.#stopRenderLoop();
    this.#cancelProgressivePcb();
    this.#connectionData.clear();
    this.#phantomSignature = '';
    this.#invalidatePathCache();
  }
}
