import { getShape } from '../shapes/index.js';
import { routePcbTrace } from './PcbRouter.js';

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
  #animationFrameId;
  #batchMode = false;
  #batchDirty = false;
  #pathCache = new Map();
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


    this.#animationFrameId = requestAnimationFrame(this.#renderLoop);
  }

  /**
   * Resize observer to keep the canvas 1:1 with device pixels
   */
  #initResizeObserver() {
    let parent = this.#canvasLayer.parentElement;
    if (!parent) return;

    this.#resizeObserver = new ResizeObserver((entries) => {
      let rect = entries[0].contentRect;
      let dpr = window.devicePixelRatio || 1;

      this.#canvasLayer.width = rect.width * dpr;
      this.#canvasLayer.height = rect.height * dpr;

      this.redraw();
    });

    this.#resizeObserver.observe(parent);
  }

  #updateStyles() {
    let source = resolveThemeSource(this.#canvasLayer);
    let computed = getComputedStyle(source);
    this.#colorParams.normal = resolveThemeValue(source, '--sn-conn-color', '--sn-node-selected');
    this.#colorParams.selected = resolveThemeValue(source, '--sn-conn-selected', '--sn-danger-color');
    this.#colorParams.outline = resolveThemeValue(source, '--sn-port-outline', '--sn-node-bg');
    this.#colorParams.bg = resolveThemeValue(source, '--sn-bg');
    this.#colorParams.text = resolveThemeValue(source, '--sn-text');
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

  /** @param {'bezier'|'orthogonal'|'straight'|'pcb'} style */
  setPathStyle(style) {
    this.#pathStyle = style;
    this.#invalidatePathCache();
    this.redraw();
  }

  get data() {
    return this.#connectionData;
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
    this.#invalidatePathCache();
    this.redraw();
  }

  updateForNode(_nodeId) {
    this.#invalidatePathCache();
    this.redraw();
  }

  setFlowing(connId, active) {
    let conn = this.#connectionData.get(connId);
    if (conn) conn.flowing = active;
  }

  setAllFlowing(active) {
    for (const conn of this.#connectionData.values()) {
      conn.flowing = active;
    }
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
  }

  /**
   * Retrieve actual connector coordinate relative to the origin.
   * @returns {{x: number, y: number}}
   */
  getSocketOffset(nodeEl, portKey, side, targetPos) {
    if (!nodeEl) return { x: 0, y: 0 };
    let w = nodeEl._cachedW || nodeEl.offsetWidth || 180;
    let h = nodeEl._cachedH || nodeEl.offsetHeight || 100;

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
      let sideGap = Math.PI / 6;
      let angle = baseAngle + (side === 'output' ? -sideGap : sideGap);
      let shouldReverse = side === 'output' ? targetPos.y < cy : targetPos.y > cy;
      let effectiveIndex = shouldReverse ? total - 1 - index : index;
      if (total > 1) {
        angle += (effectiveIndex - (total - 1) / 2) * ((2 * Math.PI) / (total * 2));
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
            let nodeRect = nodeEl.getBoundingClientRect();
            let socketRect = socket.getBoundingClientRect();
            let z = this.#getZoom();
            return {
              x: (socketRect.left - nodeRect.left + socketRect.width / 2) / z,
              y: (socketRect.top - nodeRect.top + socketRect.height / 2) / z,
            };
          }
        }
      }
    }

    return {
      x: side === 'output' ? nodeEl._cachedW || nodeEl.offsetWidth || 180 : 0,
      y: (nodeEl._cachedH || nodeEl.offsetHeight || 100) / 2,
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
        this._nodeRectMap.set(nid, {
          id: nid,
          x: el._position.x,
          y: el._position.y,
          w: el._cachedW || 180,
          h: el._cachedH || 60,
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


    if (!hasFlowing && this.#animationFrameId) {
      cancelAnimationFrame(this.#animationFrameId);
      this.#animationFrameId = null;
    } else if (hasFlowing && !this.#animationFrameId) {
      this.#animationFrameId = requestAnimationFrame(this.#renderLoop);
    }
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
    this.redraw();
    this.#animationFrameId = requestAnimationFrame(this.#renderLoop);
  };

  #plotPath(ctx, conn) {
    let cached = this.#pathCache.get(conn.id);
    if (cached?.pathStyle === this.#pathStyle) {
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

    let fromW = fromEl._cachedW || fromEl.offsetWidth || 180;
    let fromH = fromEl._cachedH || fromEl.offsetHeight || 100;
    let toW = toEl._cachedW || toEl.offsetWidth || 180;
    let toH = toEl._cachedH || toEl.offsetHeight || 100;

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
    let effectiveStyle = this.#pathStyle;
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
      });
      d = routed.path;
      arrow = routed.arrow;
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

    let coords = { startX, startY, endX, endY, path2D: new Path2D(d), arrow, pathStyle: effectiveStyle };
    this.#pathCache.set(conn.id, coords);
    return coords;
  }

  destroy() {
    if (this.#resizeObserver) this.#resizeObserver.disconnect();
    if (this.#animationFrameId) cancelAnimationFrame(this.#animationFrameId);
    this.#connectionData.clear();
    this.#phantomSignature = '';
    this.#invalidatePathCache();
  }
}
