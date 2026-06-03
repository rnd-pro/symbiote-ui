import Symbiote from '@symbiotejs/symbiote';
import { ForceLayout } from '../ForceLayout.js';
import { createCanvasGraphStore } from '../graph-model.js';
import css from './CanvasGraph.css.js';
import {
  DOT_RADIUS,
  HIT_RADIUS,
  getCanvasNodeScreenHit,
  getGroupOrbitMetrics,
  getLayerTransform,
  getNodeHitRadius,
  getNodeColor,
  getNodeRadius,
  getRadialMenuHit,
  getRadialMenuLayout,
} from './CanvasGraphGeometry.js';
import { GRAPH_TYPE_COLOR_TOKENS } from '../../graph/theme-contract.js';
import {
  getDepthGroupsFrame,
  getLayerAnimationFrame,
  getNextPulseQueue,
  resolveGroupOrbitRotationFrame,
  resolveDeactivationFrame,
  resolveFocusFrame,
  resolveIdleFrame,
  resolveViewportAnimation,
} from './CanvasGraphDrawState.js';

const INIT_NODE_COUNT = 40;
const EDGE_RATIO = 1.2;

const NODE_TYPES = ['data', 'action', 'output', 'config', 'external', 'style', 'docs', 'asset'];

const DEFAULT_EVENT_NAMES = Object.freeze({
  fileSelected: 'file-selected',
  groupSelected: 'group-selected',
  layoutDone: 'layout-done',
  layoutSnapshot: 'layout-snapshot',
  layoutTick: 'layout-tick',
  nodeDeselected: 'node-deselected',
  pathChanged: 'path-changed',
  toolbarAction: 'toolbar-action',
});

const DEFAULT_MENU_ITEMS = Object.freeze([
  { action: 'drill', label: 'Enter Group', path: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z' },
  { action: 'explore', label: 'Explore', path: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z' },
  { action: 'view-code', label: 'View Code', path: 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z' },
]);

function toRgba(rgb, alpha = 1) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function parseCssRgb(value) {
  let match = String(value || '').match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  let parts = match[1].split(',').slice(0, 3).map((part) => Number.parseFloat(part));
  return parts.every(Number.isFinite) ? parts.map((part) => Math.max(0, Math.min(255, Math.round(part)))) : null;
}

function resolveCanvasColor(value, fallback) {
  if (!value || typeof document === 'undefined') return fallback;
  let ctx = resolveCanvasColor.ctx || document.createElement('canvas').getContext('2d');
  resolveCanvasColor.ctx = ctx;
  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillStyle = value;
  let normalized = ctx.fillStyle;
  if (normalized.startsWith('#')) {
    let hex = normalized.slice(1);
    if (hex.length === 3) hex = hex.split('').map((part) => part + part).join('');
    if (/^[0-9a-f]{6}$/i.test(hex)) {
      return [
        Number.parseInt(hex.slice(0, 2), 16),
        Number.parseInt(hex.slice(2, 4), 16),
        Number.parseInt(hex.slice(4, 6), 16),
      ];
    }
  }
  return parseCssRgb(normalized) || fallback;
}

function resolveCssVars(source, value, seen = new Set()) {
  return String(value || '').replace(/var\(\s*(--[\w-]+)\s*\)/g, (_, token) => {
    if (seen.has(token)) return '';
    seen.add(token);
    let nextValue = getComputedStyle(source).getPropertyValue(token).trim();
    return resolveCssVars(source, nextValue, seen);
  });
}

function readThemeRgb(source, token, fallback) {
  let value = resolveCssVars(source, getComputedStyle(source).getPropertyValue(token).trim());
  return resolveCanvasColor(value, fallback);
}

export class CanvasGraph extends Symbiote {
  init$ = {
    // These defaults will be updated from external controller if needed
    chargeStrength: -150,
    linkDistance: 150,
    linkStrength: 0.25,
    centerStrength: 0,
    velocityDecay: 0.92,
    collideStrength: 1.0,
    alphaDecay: 0.015,
    theta: 0.7,
    alphaFloor: 0.0001,
    alphaTarget: 0.0001,
    brownian: 0,
    brownianThresh: 0.001,
    pinReheat: 0.02,
    pinCap: 0.08,
    wellStrength: 0.8,
    centerPull: 0.3,
    wellRepulsion: 5.0,
    crossLinkScale: 0.2,
  };

  _bgR = 15;
  _bgG = 23;
  _bgB = 42;
  _bgRgb = [26, 26, 26];
  _edgeRgb = [74, 158, 255];
  _pulseRgb = [76, 139, 245];
  _dangerRgb = [244, 67, 54];
  _textRgb = [240, 240, 240];
  _textDimRgb = [153, 153, 153];
  _typeColorRgb = {};
  _ghostColor = 'rgb(51,51,51)';

  initCallback() {
    this.eventNames = { ...DEFAULT_EVENT_NAMES, ...this.eventNames };
    this.actionItems = Array.isArray(this.actionItems) ? this.actionItems : [...DEFAULT_MENU_ITEMS];
    this.semanticPathPrefix = typeof this.semanticPathPrefix === 'string' ? this.semanticPathPrefix : 'cluster:';

    this.nodes = [];
    this.edges = [];
    this.nodeMap = new Map();
    this.adjMap = new Map();
    this.interactionDepths = new Map();
    this.nodePositions = new Map();

    this.worker = null;
    this.paused = false;
    this.dragNode = null;
    this.activeNode = null;
    this.hoverNode = null;
    this.nextActiveNode = null;
    this.deactivating = false;
    this.menuAnim = 0;
    this.dragOffset = { x: 0, y: 0 };
    this.renderMode = 'dots';

    this.focusX = 0;
    this.focusY = 0;
    this.focusActive = false;

    this.panX = 0;
    this.panY = 0;
    this.zoom = 0.5;
    this._targetZoom = 0.5;
    this._targetPanX = null;  // null = no animation target
    this._targetPanY = null;
    this._zoomAnchor = null;  // {mx, my} — screen point to keep stable during zoom
    this.isPanning = false;
    this.panStart = { x: 0, y: 0, px: 0, py: 0 };

    this.frameCount = 0;
    this.tickCount = 0;
    this.lastFpsTime = performance.now();
    this.lastAlpha = 0;

    this.smoothPositions = new Map();
    this.prevPositions = new Map();
    this.smoothing = 0.99;

    this.graphDB = { nodes: new Map(), edges: [], rootNodes: [] };
    this.currentGroupId = null;
    this._loopRunning = false;  // Whether the rAF draw loop is active
    this._idleFrames = 0;      // Count consecutive frames with no visual change
    this._prevDragDeltaX = 0;  // Previous frame's focus drag delta X
    this._prevDragDeltaY = 0;  // Previous frame's focus drag delta Y
    this._visualDragDeltaX = 0;
    this._visualDragDeltaY = 0;
    this._dragWorldTransform = null;
    this._layoutSnapshot = null;

    // Info panel state (typewriter HUD to the right of active node)
    this._infoPanel = {
      nodeId: null,
      lines: [],
      opacity: 0,
      startTime: 0,
      totalExtent: 0,
      totalExtentY: 0,
      _centeredForNode: null,  // Track which node we've centered for
    };

    this.breadcrumb = document.createElement('graph-breadcrumb');
    this.appendChild(this.breadcrumb);

    this.canvas = document.createElement('canvas');
    this.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.offscreenCanvases = {};
    for (let i = 1; i <= 4; i++) {
      const oc = document.createElement('canvas');
      this.offscreenCanvases[i] = { canvas: oc, ctx: oc.getContext('2d', { alpha: true }) };
    }

    this.layerAnim = {
      0: { scale: 1, opacity: 1, parallax: 0 },
      1: { scale: 1, opacity: 1, parallax: 0 },
      2: { scale: 1, opacity: 1, parallax: 0 },
      3: { scale: 1, opacity: 1, parallax: 0 },
      4: { scale: 1, opacity: 1, parallax: 0 }
    };

    this.LAYER_TARGETS = {
      scale:    [1.12, 1.0,  0.95, 0.88, 0.78],
      opacity:  [1.0,  0.9,  0.55, 0.06, 0.03],
      blur:     [0,    0,    1,    3,    5],
      parallax: [0,    0,    0.02, 0.04, 0.07]
    };

    this.depthGroups = {
      0: { edges: [], nodes: [] },
      1: { edges: [], nodes: [] },
      2: { edges: [], nodes: [] },
      3: { edges: [], nodes: [] },
      4: { edges: [], nodes: [] }
    };

    const resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    resizeObserver.observe(this);
    this.resizeCanvas();

    this.bindEvents();

    this._wakeLoop();

    // Bind graph-breadcrumb from symbiote-node
    if (this.breadcrumb?.onNavigate) {
      this.breadcrumb.onNavigate((levelStr) => {
        // levelStr is the path string we passed into 'level' property
        this.setPath(levelStr || null);
      });
    }

    setTimeout(() => this.syncCanvasTheme(), 100);
  }

  disconnectedCallback() {
    this._loopRunning = false;
    if (this._animationFrame) cancelAnimationFrame(this._animationFrame);
    if (this.worker) this.worker.stop();
  }

  /**
   * Ensure the rAF draw loop is running. Safe to call repeatedly.
   * Called by all state-changing entry points (interaction, worker, resize).
   */
  _wakeLoop() {
    if (this._loopRunning) return;
    this._loopRunning = true;
    this._idleFrames = 0;
    this._animationFrame = requestAnimationFrame(() => this.draw());
  }

  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.getBoundingClientRect();
    this._wakeLoop();  // Dimensions changed — redraw
    if (rect.width === 0) return;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
  }

  resetView() {
    this.fitView();
  }

  fitView(padding = 60, animate = true) {
    if (!this.nodePositions.size) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pos of this.nodePositions.values()) {
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x > maxX) maxX = pos.x;
      if (pos.y > maxY) maxY = pos.y;
    }

    const graphW = maxX - minX || 1;
    const graphH = maxY - minY || 1;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const newZoom = Math.max(0.02, Math.min(
      (rect.width - padding * 2) / graphW,
      (rect.height - padding * 2) / graphH,
      2.0
    ));
    const newPanX = rect.width / 2 - cx * newZoom;
    const newPanY = rect.height / 2 - cy * newZoom;

    if (animate) {
      this._targetZoom = newZoom;
      this._targetPanX = newPanX;
      this._targetPanY = newPanY;
      this._zoomAnchor = null;
    } else {
      this.zoom = newZoom;
      this._targetZoom = newZoom;
      this.panX = newPanX;
      this.panY = newPanY;
      this._targetPanX = null;
      this._targetPanY = null;
    }
    this.needsDraw = true;
    this._wakeLoop();
  }

  pulseNode(nodeId, durationMs = 1500) {
    this._pulses = getNextPulseQueue({
      pulses: this._pulses || [],
      nodeId,
      startTime: performance.now(),
      duration: durationMs,
    });
    this.needsDraw = true;
    this._wakeLoop();
  }

  flyToNode(nodeId, options = {}) {
    const node = this.graphDB?.nodes.get(nodeId);
    if (node && node.parentId) {
      if (node.parentId !== this.currentGroupId) {
        this.loadLevel(node.parentId, { enterSemanticCluster: true });
        setTimeout(() => this.flyToNode(nodeId, options), 500);
        return;
      }
    }

    const pos = this.getSmooth(nodeId) || this.nodePositions.get(nodeId);
    if (!pos) return;

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;

    // Set zoom target: use provided zoom level, or force a comfortable minimum for focus
    const targetZoom = options.zoom || Math.max(1.2, Math.min(2.0, this.zoom));
    this._targetZoom = targetZoom;
    this._targetPanX = rect.width / 2 - pos.x * targetZoom;
    this._targetPanY = rect.height / 2 - pos.y * targetZoom;
    this._zoomAnchor = null;

    // Activate the node
    const foundNode = this.nodeMap?.get(nodeId);
    if (foundNode) {
      this.activeNode = foundNode;
      this.updateInteractionDepths();
    }
    this.needsDraw = true;
    this._wakeLoop();
  }

  focusSemanticCluster(nodeId) {
    const node = this.graphDB?.nodes.get(nodeId);
    if (!node?.isSemanticCluster) return;
    if (this.currentGroupId) {
      this.loadLevel(null);
    }
    this.pulseNode(nodeId, 1800);
    requestAnimationFrame(() => {
      this.flyToNode(nodeId, { zoom: 1.1 });
    });
  }

  setLayoutSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      this._layoutSnapshot = null;
      return;
    }
    this._layoutSnapshot = {
      positions: snapshot.positions && typeof snapshot.positions === 'object' ? snapshot.positions : {},
      viewport: snapshot.viewport && typeof snapshot.viewport === 'object' ? snapshot.viewport : null,
    };
  }

  getLayoutSnapshot() {
    const positions = {};
    for (const [id, pos] of this.nodePositions.entries()) {
      if (!this.graphDB?.nodes?.has(id)) continue;
      if (!Number.isFinite(pos?.x) || !Number.isFinite(pos?.y)) continue;
      positions[id] = { x: Math.round(pos.x * 100) / 100, y: Math.round(pos.y * 100) / 100 };
    }
    return {
      version: 1,
      groupId: this.currentGroupId || '',
      viewport: {
        panX: Math.round(this.panX * 100) / 100,
        panY: Math.round(this.panY * 100) / 100,
        zoom: Math.round(this.zoom * 1000) / 1000,
      },
      positions,
    };
  }

  _emitLayoutSnapshot() {
    this._emitGraphEvent('layoutSnapshot', this.getLayoutSnapshot());
  }

  setEventNames(eventNames = {}) {
    this.eventNames = { ...DEFAULT_EVENT_NAMES, ...eventNames };
  }

  setActionItems(items) {
    this.actionItems = Array.isArray(items) ? [...items] : [...DEFAULT_MENU_ITEMS];
  }

  getActionItems() {
    return this.actionItems || [...DEFAULT_MENU_ITEMS];
  }

  setSemanticPathPrefix(prefix) {
    this.semanticPathPrefix = typeof prefix === 'string' ? prefix : 'cluster:';
  }

  _isSemanticPath(path) {
    return Boolean(this.semanticPathPrefix && typeof path === 'string' && path.startsWith(this.semanticPathPrefix));
  }

  _emitGraphEvent(name, detail = {}, options = {}) {
    const type = this.eventNames?.[name] || DEFAULT_EVENT_NAMES[name] || name;
    return this.dispatchEvent(new CustomEvent(type, { detail, ...options }));
  }

  setPath(pathStr) {
    if (!pathStr) {
      if (this.currentGroupId) this.loadLevel(null);
      return;
    }

    if (this._isSemanticPath(pathStr)) {
      this.focusSemanticCluster(pathStr);
      return;
    }

    if (pathStr !== this.currentGroupId) {
      this.loadLevel(pathStr);
    }
  }

  setGraphModel(model) {
    this.graphDB = createCanvasGraphStore(model);

    // Center viewport BEFORE worker starts — prevents nodes flashing at top-left
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0) {
      this.panX = rect.width / 2;
      this.panY = rect.height / 2;
    }

    this.loadLevel(null);
  }

  rebuildNodeMap() { this.nodeMap = new Map(this.nodes.map(n => [n.id, n])); }

  rebuildAdjMap() {
    this.adjMap.clear();
    for (const n of this.nodes) this.adjMap.set(n.id, new Set());
    for (const e of this.edges) {
      if (this.adjMap.has(e.from)) this.adjMap.get(e.from).add(e.to);
      if (this.adjMap.has(e.to)) this.adjMap.get(e.to).add(e.from);
    }
  }

  updateInteractionDepths() {
    this.interactionDepths.clear();
    const activeGroupId = this.currentGroupId;
    const focusNode = this.activeNode || this.dragNode;

    // Establish baseline target depths for all nodes
    for (const node of this.nodes) {
      if (activeGroupId) {
        if (node.parentId === activeGroupId) node.targetDepth = focusNode ? 3 : 0;
        else if (node.id === activeGroupId) node.targetDepth = 4; // Hide the container group itself
        else node.targetDepth = 4; // Other nodes hidden when inside a group
      } else {
        node.targetDepth = focusNode ? 3 : 0; // Dim to 3 if focused, 0 otherwise
      }
    }

    for (const edge of this.edges) { edge.targetDepth = 4; edge.minTargetDepth = 4; }

    if (!focusNode) {
      for (const edge of this.edges) {
        const d1 = this.nodeMap.get(edge.from)?.targetDepth ?? 4;
        const d2 = this.nodeMap.get(edge.to)?.targetDepth ?? 4;
        edge.targetDepth = Math.max(d1, d2);
        edge.minTargetDepth = Math.min(d1, d2);
      }
      return;
    }

    // BFS from focusNode
    const queue = [[focusNode.id, 0]];
    const visited = new Set([focusNode.id]);
    this.interactionDepths.set(focusNode.id, 0);

    while (queue.length > 0) {
      const [curr, depth] = queue.shift();
      const currNode = this.nodeMap.get(curr);
      if (currNode) currNode.targetDepth = depth;

      if (depth >= 3) continue;
      const neighbors = this.adjMap.get(curr) || new Set();
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          this.interactionDepths.set(n, depth + 1);
          queue.push([n, depth + 1]);
        }
      }
    }

    for (const edge of this.edges) {
      const d1 = this.interactionDepths.has(edge.from) ? this.interactionDepths.get(edge.from) : 4;
      const d2 = this.interactionDepths.has(edge.to) ? this.interactionDepths.get(edge.to) : 4;
      edge.targetDepth = Math.max(d1, d2);
      edge.minTargetDepth = Math.min(d1, d2);
    }
  }

  loadLevel(groupId = null, levelOptions = {}) {
    const requestedGroup = groupId ? this.graphDB.nodes.get(groupId) : null;
    if (requestedGroup?.isSemanticCluster && !levelOptions.enterSemanticCluster) {
      this.focusSemanticCluster(groupId);
      return;
    }

    this._wakeLoop();  // View changed — resume rendering
    this.activeNode = null;
    this.dragNode = null;
    this.hoverNode = null;
    this.menuAnim = 0;
    this.deactivating = false;

    for (const node of this.graphDB.nodes.values()) {
      if (node.isGroup) {
        const groupR = getNodeRadius(node, 0);
        node.w = groupR * 2;
        node.h = groupR * 2;
      }
    }

    let activeIds = [...this.graphDB.rootNodes];

    if (!groupId) {
      this.currentGroupId = null;
      if (this.breadcrumb?.setPath) this.breadcrumb.setPath([]);
    } else {
      const group = this.graphDB.nodes.get(groupId);
      if (group) {
        this.currentGroupId = groupId;
        if (!activeIds.includes(groupId)) activeIds.push(groupId);
        activeIds.push(...group.children);

        const childR = DOT_RADIUS * 1.5;
        const dynamicSize = Math.sqrt(group.children.length) * childR * 3 + childR * 4;
        group.w = dynamicSize;
        group.h = dynamicSize;

        // Render existing symbiote-node breadcrumbs
        if (this.breadcrumb?.setPath) {
          const parts = groupId.split('/');
          const pathArr = [{ label: 'Root', level: '' }];
          let acc = '';
          for (let i = 0; i < parts.length; i++) {
            if (!parts[i]) continue;
            acc += (acc ? '/' : '') + parts[i];
            pathArr.push({ label: parts[i], level: acc });
          }
          this.breadcrumb.setPath(pathArr);
        }

      } else {
        // Fallback to root if group not found
        this.currentGroupId = null;
        if (this.breadcrumb?.setPath) this.breadcrumb.setPath([]);
      }
    }

    this.nodes = activeIds.map(id => this.graphDB.nodes.get(id)).filter(Boolean);

    for (const n of this.nodes) {
      if (n.parentId && n.parentId === groupId) {
        n.w = this.renderMode === 'dots' ? DOT_RADIUS * 1.5 : 160 * 0.6;
        n.h = this.renderMode === 'dots' ? DOT_RADIUS * 1.5 : 40 * 0.6;
      }
    }

    const activeSet = new Set(activeIds);
    this.edges = this.graphDB.edges.filter(e => activeSet.has(e.from) || activeSet.has(e.to));

    this.rebuildNodeMap();
    this.rebuildAdjMap();
    this.updateInteractionDepths();

    const options = {
      chargeStrength: this.$.chargeStrength,
      linkDistance: this.$.linkDistance,
      linkStrength: this.$.linkStrength,
      centerStrength: this.$.centerStrength,
      velocityDecay: this.$.velocityDecay,
      collideStrength: this.$.collideStrength,
      alphaDecay: this.$.alphaDecay,
      theta: this.$.theta,
      nodeWidth: this.renderMode === 'dots' ? DOT_RADIUS * 2 : 160,
      nodeHeight: this.renderMode === 'dots' ? DOT_RADIUS * 2 : 40,
      mode: 'continuous',
      activeGroupId: this.currentGroupId,
      boundaryRadius: this.currentGroupId ? this.graphDB.nodes.get(this.currentGroupId).w / 2 : null,
      attractors: null,
    };

    this.startWorker(options);

    this._emitGraphEvent('pathChanged', { path: this.currentGroupId || '' });
  }

  startWorker(customOptions = null) {
    if (this.worker) this.worker.stop();
    this.worker = new ForceLayout(ForceLayout.defaultWorkerUrl());

    this.worker.onTick = (positions, meta = {}) => {
      const draggedId = this.dragNode ? this.dragNode.id : null;
      for (const [id, p] of Object.entries(positions || {})) {
        if (id === draggedId) continue;
        const pos = this.nodePositions.get(id);
        if (pos) {
          pos.x = p.x;
          pos.y = p.y;
        } else {
          this.nodePositions.set(id, p);
        }
      }
      this.lastAlpha = meta.alpha || 0;
      this.tickCount++;
      this.frameCount++;
      this._wakeLoop();
      this._emitGraphEvent('layoutTick', { alpha: this.lastAlpha });
    };

    this.worker.onDone = (positions) => {
      if (positions) {
        for (const [id, pos] of Object.entries(positions)) this.nodePositions.set(id, pos);
      }
      this._emitGraphEvent('layoutDone');
      this._emitLayoutSnapshot();
    };

    const options = customOptions || {
      chargeStrength: this.$.chargeStrength,
      linkDistance: this.$.linkDistance,
      linkStrength: this.$.linkStrength,
      centerStrength: this.$.centerStrength,
      velocityDecay: this.$.velocityDecay,
      collideStrength: this.$.collideStrength,
      alphaDecay: this.$.alphaDecay,
      theta: this.$.theta,
      wellStrength: this.$.wellStrength,
      centerPull: this.$.centerPull,
      wellRepulsion: this.$.wellRepulsion,
      crossLinkScale: this.$.crossLinkScale,
      nodeWidth: this.renderMode === 'dots' ? DOT_RADIUS * 2 : 160,
      nodeHeight: this.renderMode === 'dots' ? DOT_RADIUS * 2 : 40,
      mode: 'continuous',
    };

    this.worker.start({
      nodes: this.nodes.map(n => {
        const restoredPos = this._layoutSnapshot?.positions?.[n.id];
        const pos = this.smoothPositions.get(n.id) || this.nodePositions.get(n.id) || restoredPos;
        if (restoredPos && !this.nodePositions.has(n.id)) {
          this.nodePositions.set(n.id, { x: restoredPos.x, y: restoredPos.y });
        }
        let finalW = n.w, finalH = n.h;
        if (this.renderMode === 'dots') {
          const conns = this.adjMap.get(n.id)?.size || 0;
          const r = getNodeRadius(n, conns);
          finalW = finalH = r * 2;
        }
        return {
          id: n.id, type: n.type, parentId: n.parentId, isGroup: !!n.isGroup,
          children: n.children || [], x: pos?.x, y: pos?.y, w: finalW, h: finalH,
        };
      }),
      edges: this.edges.filter(e => this.nodeMap.has(e.from) && this.nodeMap.has(e.to)),
      groups: {}, options
    });

    this.worker.updateConfig({
      contAlphaFloor: this.$.alphaFloor, contAlphaTarget: this.$.alphaTarget,
      brownian: this.$.brownian, brownianThresh: this.$.brownianThresh,
      pinReheat: this.$.pinReheat, pinCap: this.$.pinCap,
    });

    this.smoothPositions.clear();
    const viewport = this._layoutSnapshot?.viewport;
    if (viewport && Number.isFinite(viewport.panX) && Number.isFinite(viewport.panY) && Number.isFinite(viewport.zoom)) {
      this.panX = viewport.panX;
      this.panY = viewport.panY;
      this.zoom = viewport.zoom;
      this._targetPanX = null;
      this._targetPanY = null;
      this._targetZoom = viewport.zoom;
    }
    this.paused = false;
  }

  getSmooth(id) { return this.smoothPositions.get(id) || this.nodePositions.get(id); }

  nodeCenter(id) {
    const pos = this.getSmooth(id);
    if (!pos) return null;
    if (this.renderMode === 'dots') return { x: pos.x, y: pos.y };
    const node = this.nodeMap.get(id);
    if (!node) return { x: pos.x, y: pos.y };
    return { x: pos.x + node.w / 2, y: pos.y + node.h / 2 };
  }

  resizeOffscreenCanvases() {
    const dpr = window.devicePixelRatio || 1;
    for (let i = 1; i <= 4; i++) {
      const oc = this.offscreenCanvases[i].canvas;
      if (oc.width !== this.canvas.width || oc.height !== this.canvas.height) {
        oc.width = this.canvas.width;
        oc.height = this.canvas.height;
      }
    }
  }

  blendBg(r, g, b, alpha) {
    const br = this._bgR, bg = this._bgG, bb = this._bgB;
    const rr = (r * alpha + br * (1 - alpha)) | 0;
    const gg = (g * alpha + bg * (1 - alpha)) | 0;
    const bbb = (b * alpha + bb * (1 - alpha)) | 0;
    return `rgb(${rr},${gg},${bbb})`;
  }

  syncCanvasTheme() {
    this._bgRgb = readThemeRgb(this, '--sn-bg', this._bgRgb);
    this._edgeRgb = readThemeRgb(this, '--sn-conn-color', this._edgeRgb);
    this._pulseRgb = readThemeRgb(this, '--sn-node-selected', this._pulseRgb);
    this._dangerRgb = readThemeRgb(this, '--sn-danger-color', this._dangerRgb);
    this._textRgb = readThemeRgb(this, '--sn-text', this._textRgb);
    this._textDimRgb = readThemeRgb(this, '--sn-text-dim', this._textDimRgb);
    for (let [type, token] of Object.entries(GRAPH_TYPE_COLOR_TOKENS)) {
      this._typeColorRgb[type] = readThemeRgb(this, token, this._typeColorRgb[type] || this._edgeRgb);
    }

    [this._bgR, this._bgG, this._bgB] = this._bgRgb;
    let boost = 25;
    this._ghostColor = `rgb(${Math.min(255, this._bgR + boost)},${Math.min(255, this._bgG + boost)},${Math.min(255, this._bgB + boost)})`;
  }

  draw() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;

    let viewport = resolveViewportAnimation({
      zoom: this.zoom,
      targetZoom: this._targetZoom,
      panX: this.panX,
      panY: this.panY,
      targetPanX: this._targetPanX,
      targetPanY: this._targetPanY,
      zoomAnchor: this._zoomAnchor,
    });
    this.zoom = viewport.zoom;
    this.panX = viewport.panX;
    this.panY = viewport.panY;
    this._targetPanX = viewport.targetPanX;
    this._targetPanY = viewport.targetPanY;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.resizeOffscreenCanvases();
    const mainCtx = this.ctx;
    const isIdle = (!this.activeNode && !this.currentGroupId) || this.deactivating;

    let deactivation = resolveDeactivationFrame({
      deactivating: this.deactivating,
      activeNode: this.activeNode,
      nextActiveNode: this.nextActiveNode,
      layerAnim: this.layerAnim,
    });
    this.activeNode = deactivation.activeNode;
    this.nextActiveNode = deactivation.nextActiveNode;
    this.deactivating = deactivation.deactivating;
    if (deactivation.deselected) {
      this._emitGraphEvent('nodeDeselected');
    }
    if (deactivation.interactionDepthsChanged) {
      this.updateInteractionDepths();
    }

    const inGroupMode = !!this.currentGroupId;
    this.layerAnim = getLayerAnimationFrame({
      layerAnim: this.layerAnim,
      layerTargets: this.LAYER_TARGETS,
      isIdle,
      inGroupMode,
    });

    const vcx = this.canvas.width / 2;
    const vcy = this.canvas.height / 2;
    let dragDeltaX = 0, dragDeltaY = 0;

    let activePosition = this.activeNode ? this.nodePositions.get(this.activeNode.id) : null;
    let shouldCenterFocus = this.activeNode
      && !this.deactivating
      && this._infoPanel._centeredForNode !== this.activeNode.id
      && this._infoPanel.totalExtent > 0;
    let focus = resolveFocusFrame({
      activeNode: this.activeNode,
      deactivating: this.deactivating,
      activePosition,
      infoPanel: this._infoPanel,
      canvasRect: shouldCenterFocus ? this.canvas.getBoundingClientRect() : null,
      dpr,
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
      focusX: this.focusX,
      focusY: this.focusY,
      focusActive: this.focusActive,
      vcx,
      vcy,
    });
    this.focusX = focus.focusX;
    this.focusY = focus.focusY;
    this.focusActive = focus.focusActive;
    dragDeltaX = focus.dragDeltaX;
    dragDeltaY = focus.dragDeltaY;
    this._visualDragDeltaX = dragDeltaX;
    this._visualDragDeltaY = dragDeltaY;
    this._infoPanel._centeredForNode = focus.centeredForNode;
    if (focus.targetPanX !== null) {
      this._targetPanX = focus.targetPanX;
      this._targetPanY = focus.targetPanY;
    }

    for (let i = 1; i <= 4; i++) {
      const octx = this.offscreenCanvases[i].ctx;
      const la = this.layerAnim[i];
      const s = la.scale;
      const pOffX = -la.parallax * dragDeltaX;
      const pOffY = -la.parallax * dragDeltaY;

      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      octx.setTransform(s * dpr * this.zoom, 0, 0, s * dpr * this.zoom,
                        s * dpr * this.panX + vcx * (1 - s) + pOffX,
                        s * dpr * this.panY + vcy * (1 - s) + pOffY);
    }

    const t = 1 - this.smoothing;
    for (const [id, raw] of this.nodePositions) {
      const prev = this.smoothPositions.get(id);
      if (!prev) {
        this.smoothPositions.set(id, { x: raw.x, y: raw.y });
      } else {
        if (this.dragNode && this.dragNode.id === id) {
          prev.x = raw.x; prev.y = raw.y;
        } else {
          prev.x += (raw.x - prev.x) * t;
          prev.y += (raw.y - prev.y) * t;
        }
      }
    }

    this.depthGroups = getDepthGroupsFrame({
      edges: this.edges,
      nodes: this.nodes,
      activeNode: this.activeNode,
      dragNode: this.dragNode,
      hoverNode: this.hoverNode,
    });

    const resolveLayerTransform = (d) => {
      return getLayerTransform({
        depth: d,
        layerAnim: this.layerAnim,
        dpr,
        zoom: this.zoom,
        panX: this.panX,
        panY: this.panY,
        vcx,
        vcy,
        focusActive: this.focusActive,
        focusX: this.focusX,
        focusY: this.focusY,
        dragDeltaX,
        dragDeltaY,
      });
    };

    const drawDepth = (d, currentCtx) => {
      const la = this.layerAnim[d];
      const layerOpacity = la.opacity;
      const isGhost = inGroupMode && d >= 3;
      const GHOST_COLOR = this._ghostColor;
      const tCurrent = resolveLayerTransform(d);

      const mapPosToEdgeLayer = (pos, nodeDepth) => {
        if (!pos || nodeDepth === d) return pos;
        const tNode = resolveLayerTransform(nodeDepth);
        const screenX = tNode.A * pos.x + tNode.E;
        const screenY = tNode.A * pos.y + tNode.F;
        return { x: (screenX - tCurrent.E) / tCurrent.A, y: (screenY - tCurrent.F) / tCurrent.A };
      };

      currentCtx.strokeStyle = toRgba(this._edgeRgb, 0.25);
      currentCtx.lineWidth = 1.5;

      // Edges
      for (const edge of this.depthGroups[d].edges) {
        let from = this.nodeCenter(edge.from);
        let to = this.nodeCenter(edge.to);

        if ((!from || !to) && this.currentGroupId) {
          const activeId = this.currentGroupId;
          const activePos = this.smoothPositions.get(activeId);
          const activeNode = this.graphDB.nodes.get(activeId);
          if (activePos && activeNode) {
            const radius = activeNode.w / 2;
            if (!from && to) {
              const angle = parseInt(edge.from.slice(-1), 16) || 0;
              from = { x: activePos.x + Math.cos(angle) * radius, y: activePos.y + Math.sin(angle) * radius };
            } else if (from && !to) {
              const angle = parseInt(edge.to.slice(-1), 16) || 0;
              to = { x: activePos.x + Math.cos(angle) * radius, y: activePos.y + Math.sin(angle) * radius };
            }
          }
        }

        if (!from || !to) continue;

        let tAlpha = 0.5, tWidth = 1.5;
        if (this.dragNode) {
          const minD = edge.minTargetDepth;
          if (minD === 0) { tAlpha = 1; tWidth = 3.0; }
          else if (minD === 1) { tAlpha = 0.8; tWidth = 2.0; }
          else if (minD === 2) { tAlpha = 0.4; tWidth = 1.5; }
          else { tAlpha = 0.05; tWidth = 1.0; }
        }

        const edgeOpacity = tAlpha * layerOpacity;
        edge.aAlpha = edge.aAlpha !== undefined ? edge.aAlpha : 0.5;
        edge.aWidth = edge.aWidth || 1.5;
        edge.aAlpha += (edgeOpacity - edge.aAlpha) * 0.1;
        edge.aWidth += (tWidth - edge.aWidth) * 0.1;

        const nodeFrom = this.nodeMap ? this.nodeMap.get(edge.from) : null;
        const nodeTo = this.nodeMap ? this.nodeMap.get(edge.to) : null;
        const fromDepth = nodeFrom?.targetDepth ?? 4;
        const toDepth = nodeTo?.targetDepth ?? 4;

        from = mapPosToEdgeLayer(from, fromDepth);
        to = mapPosToEdgeLayer(to, toDepth);

        const zoomFactor = this.zoom * (this.layerAnim[d]?.scale || 1);
        const wFrom = (edge.aWidth * 2.0) / zoomFactor, wTo = wFrom;
        const dx = to.x - from.x, dy = to.y - from.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.1) continue;

        const nx = -dy / len, ny = dx / len;

        let fillStyle;
        if (isGhost) {
          fillStyle = GHOST_COLOR;
        } else if (this.dragNode || this.activeNode) {
          const fromOpacity = this.layerAnim[fromDepth].opacity;
          const toOpacity = this.layerAnim[toDepth].opacity;
          const fromTC = getNodeColor(nodeFrom || {}, this._typeColorRgb);
          const toTC = getNodeColor(nodeTo || {}, this._typeColorRgb);
          const grad = currentCtx.createLinearGradient(from.x, from.y, to.x, to.y);
          grad.addColorStop(0, this.blendBg(fromTC[0], fromTC[1], fromTC[2], fromOpacity * 0.7));
          grad.addColorStop(1, this.blendBg(toTC[0], toTC[1], toTC[2], toOpacity * 0.7));
          fillStyle = grad;
        } else {
          const fromTC = getNodeColor(nodeFrom || {}, this._typeColorRgb);
          fillStyle = this.blendBg(fromTC[0], fromTC[1], fromTC[2], 0.35);
        }

        currentCtx.fillStyle = fillStyle;
        currentCtx.beginPath();
        const midX = from.x + dx * 0.5, midY = from.y + dy * 0.5;
        const pinchRatio = Math.max(0.001, Math.pow(20 / Math.max(20, len), 2.8));
        const pinchW = Math.min(wFrom, wTo) * pinchRatio;
        const ang = Math.atan2(dy, dx);

        currentCtx.moveTo(from.x + nx * wFrom, from.y + ny * wFrom);
        currentCtx.quadraticCurveTo(midX + nx * pinchW, midY + ny * pinchW, to.x + nx * wTo, to.y + ny * wTo);
        currentCtx.arc(to.x, to.y, wTo, ang + Math.PI/2, ang - Math.PI/2, true);
        currentCtx.quadraticCurveTo(midX - nx * pinchW, midY - ny * pinchW, from.x - nx * wFrom, from.y - ny * wFrom);
        currentCtx.arc(from.x, from.y, wFrom, ang - Math.PI/2, ang - Math.PI * 1.5, true);
        currentCtx.closePath();
        currentCtx.fill();
      }

      // Nodes
      for (const node of this.depthGroups[d].nodes) {
        if (this.currentGroupId && node.id === this.currentGroupId) continue;
        const pos = this.getSmooth(node.id);
        if (!pos) continue;
        const isActive = this.activeNode && this.activeNode.id === node.id;
        const tc = getNodeColor(node, this._typeColorRgb);
        const conns = this.adjMap.get(node.id)?.size || 0;

        const targetScale = isActive ? 1.5 : 1;
        node.aScale = node.aScale !== undefined ? node.aScale : 1;
        node.aScale += (targetScale - node.aScale) * 0.12;

        node.aGlow = node.aGlow !== undefined ? node.aGlow : 0;
        node.aGlow += ((isActive ? 1 : 0) - node.aGlow) * 0.1;

        if (this.renderMode === 'dots') {
          let r = getNodeRadius(node, conns, { scale: node.aScale });

          if (isGhost) {
            currentCtx.beginPath();
            currentCtx.arc(pos.x, pos.y, r * 0.7, 0, Math.PI * 2);
            currentCtx.fillStyle = GHOST_COLOR;
            currentCtx.fill();
          } else if (node.isGroup) {
            const ringW = r * 0.12;
            currentCtx.beginPath();
            currentCtx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            currentCtx.fillStyle = toRgba(this._bgRgb, layerOpacity);
            currentCtx.fill();

            currentCtx.beginPath();
            currentCtx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            currentCtx.arc(pos.x, pos.y, r - ringW, 0, Math.PI * 2, true);
            currentCtx.fillStyle = this.blendBg(tc[0], tc[1], tc[2], layerOpacity);
            currentCtx.fill();

            const { childCount, innerR, orbitR } = getGroupOrbitMetrics(node, conns, {
              scale: node.aScale || 1,
            });
            const isHovered = this.hoverNode && this.hoverNode.id === node.id;
            const isDragged = this.dragNode && this.dragNode.id === node.id;
            node.aRotSpeed = node.aRotSpeed || 0;
            const rotation = resolveGroupOrbitRotationFrame({
              rotation: node.aRot || 0,
              rotationSpeed: node.aRotSpeed,
              hovered: isHovered,
              dragged: isDragged,
            });
            node.aRotSpeed = rotation.rotationSpeed;
            node.aRot = rotation.rotation;

            for (let k = 0; k < childCount; k++) {
              const angle = (k * Math.PI * 2 / childCount) - Math.PI / 2 + node.aRot;
              const cx = pos.x + Math.cos(angle) * orbitR;
              const cy = pos.y + Math.sin(angle) * orbitR;
              currentCtx.beginPath();
              currentCtx.arc(cx, cy, innerR, 0, Math.PI * 2);
              currentCtx.fillStyle = this.blendBg(tc[0], tc[1], tc[2], layerOpacity * 0.7);
              currentCtx.fill();
            }
            if (node.aGlow > 0.01) {
              currentCtx.strokeStyle = `rgba(${tc[0]},${tc[1]},${tc[2]},${layerOpacity * 0.6 * node.aGlow})`;
              currentCtx.lineWidth = 2 * node.aGlow;
              currentCtx.beginPath();
              currentCtx.arc(pos.x, pos.y, r + 4 * node.aGlow, 0, Math.PI * 2);
              currentCtx.stroke();
            }
          } else {
            currentCtx.beginPath();
            currentCtx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            currentCtx.fillStyle = this.blendBg(tc[0], tc[1], tc[2], layerOpacity);
            currentCtx.fill();
            if (node.aGlow > 0.01) {
              currentCtx.strokeStyle = `rgba(${tc[0]},${tc[1]},${tc[2]},${layerOpacity * 0.6 * node.aGlow})`;
              currentCtx.lineWidth = 2 * node.aGlow;
              currentCtx.beginPath();
              currentCtx.arc(pos.x, pos.y, r + 4 * node.aGlow, 0, Math.PI * 2);
              currentCtx.stroke();
            }
          }
        }
      }
    };

    for (let d = 4; d >= 1; d--) drawDepth(d, this.offscreenCanvases[d].ctx);

    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    for (let d = 4; d >= 1; d--) {
      const blurPx = this.LAYER_TARGETS.blur[d];
      const blurIntensity = Math.abs(1 - this.layerAnim[d].scale) * blurPx * 8;
      mainCtx.filter = blurIntensity > 0.3 ? `blur(${blurIntensity.toFixed(1)}px)` : 'none';
      mainCtx.drawImage(this.offscreenCanvases[d].canvas, 0, 0);
    }
    mainCtx.filter = 'none';

    {
      const s = this.layerAnim[0].scale;
      if (this.focusActive && Math.abs(s - 1) > 0.001) {
        mainCtx.setTransform(s * dpr * this.zoom, 0, 0, s * dpr * this.zoom, this.focusX * (1 - s) + s * dpr * this.panX, this.focusY * (1 - s) + s * dpr * this.panY);
      } else {
        mainCtx.setTransform(dpr * this.zoom, 0, 0, dpr * this.zoom, dpr * this.panX, dpr * this.panY);
      }
      drawDepth(0, mainCtx);

      if (this._pulses && this._pulses.length > 0) {
        const now = performance.now();
        this._pulses = this._pulses.filter(p => {
          const elapsed = now - p.startTime;
          if (elapsed > p.duration) return false;
          const pos = this.getSmooth(p.id) || this.nodePositions.get(p.id);
          if (!pos) return false;
          const progress = elapsed / p.duration;
          const pulsePhase = (progress * 3) % 1;
          const r = 20 + (pulsePhase * 80);
          const opacity = 1 - pulsePhase;
          mainCtx.beginPath();
          mainCtx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
          mainCtx.fillStyle = toRgba(this._pulseRgb, opacity * 0.4);
          mainCtx.fill();
          mainCtx.lineWidth = 2;
          mainCtx.strokeStyle = toRgba(this._pulseRgb, opacity * 0.8);
          mainCtx.stroke();
          this.needsDraw = true;
          return true;
        });
      }
    }

    const showMenu = this.activeNode && !this.dragNode && !this.deactivating;
    if (showMenu) {
      this.menuAnim = Math.min(1, this.menuAnim + 0.08);
    } else {
      this.menuAnim = Math.max(0, this.menuAnim - 0.15);
    }

    if (this.menuAnim > 0.01 && this.activeNode) {
      const apos = this.getSmooth(this.activeNode.id);
      if (apos) {
        const conns = this.adjMap.get(this.activeNode.id)?.size || 0;
        const menuLayout = getRadialMenuLayout({
          activeNode: this.activeNode,
          activePosition: apos,
          connectionCount: conns,
          menuItems: this.getActionItems(),
          menuAnim: this.menuAnim,
        });
        const easeOut = menuLayout.easeOut;
        const ir = menuLayout.itemRadius;

        const s = this.layerAnim[0].scale;
        if (this.focusActive && Math.abs(s - 1) > 0.001) {
          mainCtx.setTransform(s * dpr * this.zoom, 0, 0, s * dpr * this.zoom, this.focusX * (1 - s) + s * dpr * this.panX, this.focusY * (1 - s) + s * dpr * this.panY);
        } else {
          mainCtx.setTransform(dpr * this.zoom, 0, 0, dpr * this.zoom, dpr * this.panX, dpr * this.panY);
        }

        const tc = getNodeColor(this.activeNode, this._typeColorRgb);
        for (const entry of menuLayout.items) {
          const item = entry.item;

          mainCtx.beginPath();
          mainCtx.arc(entry.x, entry.y, ir, 0, Math.PI * 2);
          mainCtx.fillStyle = item.danger
            ? toRgba(this._dangerRgb, 0.25 * easeOut)
            : toRgba(tc, 0.9 * easeOut);
          mainCtx.fill();

          mainCtx.save();
          const iconScale = (ir * 1.2) / 24;
          if (iconScale > 0) {
            mainCtx.translate(entry.x - 12 * iconScale, entry.y - 12 * iconScale);
            mainCtx.scale(iconScale, iconScale);
            const p = new Path2D(item.path);
            mainCtx.fillStyle = item.danger
              ? toRgba(this._dangerRgb, easeOut)
              : toRgba(this._bgRgb, easeOut);
            mainCtx.fill(p);
          }
          mainCtx.restore();
        }
      }
    }

    // Info panel — typewriter HUD to the right of active node
    this._drawInfoPanel(mainCtx, dpr, dragDeltaX, dragDeltaY, vcx, vcy);

    let idle = resolveIdleFrame({
      targetZoom: this._targetZoom,
      zoom: this.zoom,
      dragDeltaX,
      dragDeltaY,
      prevDragDeltaX: this._prevDragDeltaX || 0,
      prevDragDeltaY: this._prevDragDeltaY || 0,
      layerAnim: this.layerAnim,
      isIdle,
      layerTargets: this.LAYER_TARGETS,
      lastAlpha: this.lastAlpha,
      dragNode: this.dragNode,
      isPanning: this.isPanning,
      deactivating: this.deactivating,
      targetPanX: this._targetPanX,
      infoPanel: this._infoPanel,
      idleFrames: this._idleFrames,
    });
    this._prevDragDeltaX = idle.prevDragDeltaX;
    this._prevDragDeltaY = idle.prevDragDeltaY;
    this._idleFrames = idle.idleFrames;

    // Allow 3 extra frames after convergence to flush final sub-pixel lerps
    if (idle.shouldStop) {
      this._loopRunning = false;
      return;
    }

    this._animationFrame = requestAnimationFrame(() => this.draw());
  }

  /**
   * Build metadata lines for the info panel from skeleton + node data
   * @param {object} node - graph node
   * @returns {string[]}
   */
  _buildInfoLines(node) {
    const lines = [];
    lines.push(node.label);
    if (node.id !== node.label) lines.push(node.id);
    lines.push('');

    const typeLabels = {
      data: 'Data',
      action: 'Action',
      output: 'Output',
      config: 'Config',
      external: 'External',
      style: 'Style',
      docs: 'Docs',
      asset: 'Asset',
      group: 'Directory'
    };
    lines.push(`Type: ${typeLabels[node.type] || node.type}`);

    const conns = this.adjMap.get(node.id)?.size || 0;
    if (conns > 0) lines.push(`Connections: ${conns}`);

    if (node.children?.length > 0) {
      lines.push(`Children: ${node.children.length}`);
    }

    if (Array.isArray(node.exports) && node.exports.length > 0) {
      lines.push('');
      lines.push('Exports:');
      for (const exp of node.exports.slice(0, 8)) {
        lines.push(`  ${exp}`);
      }
      if (node.exports.length > 8) lines.push(`  ... +${node.exports.length - 8}`);
    }

    if (node.lines) lines.push(`Lines: ${node.lines}`);

    return lines;
  }

  /**
   * Draw info panel HUD to the right of the active node
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} dpr
   * @param {number} dragDeltaX
   * @param {number} dragDeltaY
   * @param {number} vcx
   * @param {number} vcy
   */
  _drawInfoPanel(ctx, dpr, dragDeltaX, dragDeltaY, vcx, vcy) {
    const ip = this._infoPanel;
    const showPanel = this.activeNode && !this.dragNode && !this.deactivating;

    if (showPanel && this.activeNode) {
      if (ip.nodeId !== this.activeNode.id) {
        ip.nodeId = this.activeNode.id;
        ip.lines = this._buildInfoLines(this.activeNode).map(text => ({ text, revealed: 0 }));
        ip.startTime = performance.now();
        ip.opacity = 0;
      }
      ip.opacity = Math.min(1, ip.opacity + 0.06);
    } else {
      ip.opacity = Math.max(0, ip.opacity - 0.12);
      if (ip.opacity <= 0) { ip.nodeId = null; ip.lines = []; ip.totalExtent = 0; ip.totalExtentY = 0; ip._centeredForNode = null; }
    }

    if (ip.opacity <= 0.01 || ip.lines.length === 0) return;

    const elapsed = performance.now() - ip.startTime;
    const CHAR_SPEED = 18;
    const LINE_DELAY = 60;
    let charBudget = Math.floor(elapsed / CHAR_SPEED);
    for (let i = 0; i < ip.lines.length; i++) {
      const line = ip.lines[i];
      const available = Math.max(0, charBudget - i * LINE_DELAY / CHAR_SPEED);
      line.revealed = Math.min(line.text.length, Math.floor(available));
    }

    const apos = this.activeNode ? this.getSmooth(this.activeNode.id) : null;
    if (!apos) return;

    // Apply depth-0 transform — panel lives in world-space, scales with nodes
    const s = this.layerAnim[0].scale;
    if (this.focusActive && Math.abs(s - 1) > 0.001) {
      ctx.setTransform(s * dpr * this.zoom, 0, 0, s * dpr * this.zoom,
        this.focusX * (1 - s) + s * dpr * this.panX,
        this.focusY * (1 - s) + s * dpr * this.panY);
    } else {
      ctx.setTransform(dpr * this.zoom, 0, 0, dpr * this.zoom, dpr * this.panX, dpr * this.panY);
    }

    // All dimensions in world units
    const fontSize = 11;
    const smallFontSize = 9;
    const lineHeight = 15;
    const padX = 14;
    const padY = 10;

    // Compute actual node radius to avoid overlap
    // Must account for: dot radius + glow + radial menu items
    const conns = this.adjMap.get(this.activeNode.id)?.size || 0;
    const dotR = getNodeRadius(this.activeNode, conns, { scale: this.activeNode.aScale || 1.5 });
    // Menu orbits at dotR + 14, each item has radius 6
    const menuExtent = dotR + 14 + 6;
    const panelGap = 10;
    const panelX = apos.x + menuExtent + panelGap;
    const panelY = apos.y - padY;

    ctx.font = `600 ${fontSize}px 'Inter', 'SF Mono', system-ui, sans-serif`;

    // Measure panel width from FULL text content (not just revealed)
    // This ensures totalExtent is stable from the first frame — no oscillation
    let maxW = 60;
    for (const line of ip.lines) {
      const w = ctx.measureText(line.text).width;
      if (w > maxW) maxW = w;
    }
    const panelW = maxW + padX * 2;
    const panelH = ip.lines.length * lineHeight + padY * 2;

    // Store total extent for focus centering
    ip.totalExtent = menuExtent + panelGap + panelW;
    // Vertical: panel extends from (apos.y - padY) to (apos.y - padY + panelH + 16)
    // The offset from node center to the vertical midpoint of the panel
    ip.totalExtentY = (panelH + 16) / 2 - padY;

    const tc = getNodeColor(this.activeNode || {}, this._typeColorRgb);
    const cornerR = 6;

    ctx.save();
    ctx.globalAlpha = ip.opacity;

    // Blurred backdrop
    ctx.filter = 'blur(16px)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH + 16, cornerR);
    ctx.fillStyle = toRgba(this._bgRgb, 0.85 * ip.opacity);
    ctx.fill();
    ctx.filter = 'none';

    // Border
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH + 16, cornerR);
    ctx.strokeStyle = `rgba(${tc[0]}, ${tc[1]}, ${tc[2]}, ${0.15 * ip.opacity})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Left accent
    ctx.beginPath();
    ctx.moveTo(panelX, panelY + cornerR);
    ctx.lineTo(panelX, panelY + panelH + 16 - cornerR);
    ctx.strokeStyle = `rgba(${tc[0]}, ${tc[1]}, ${tc[2]}, ${0.5 * ip.opacity})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Text lines
    let textY = panelY + padY + fontSize;
    for (let i = 0; i < ip.lines.length; i++) {
      const line = ip.lines[i];
      const text = line.text.substring(0, line.revealed);
      if (!text) { textY += lineHeight; continue; }

      if (i === 0) {
        ctx.font = `700 ${fontSize}px 'Inter', 'SF Mono', system-ui, sans-serif`;
        ctx.fillStyle = `rgba(${tc[0]}, ${tc[1]}, ${tc[2]}, ${ip.opacity})`;
      } else if (i === 1 && this.activeNode?.id !== this.activeNode?.label) {
        ctx.font = `400 ${smallFontSize}px 'SF Mono', 'JetBrains Mono', monospace`;
        ctx.fillStyle = toRgba(this._textDimRgb, 0.35 * ip.opacity);
      } else if (line.text.startsWith('  ')) {
        ctx.font = `400 ${smallFontSize}px 'SF Mono', 'JetBrains Mono', monospace`;
        ctx.fillStyle = `rgba(${tc[0]}, ${tc[1]}, ${tc[2]}, ${0.6 * ip.opacity})`;
      } else if (line.text.includes(':')) {
        ctx.font = `500 ${smallFontSize}px 'Inter', system-ui, sans-serif`;
        ctx.fillStyle = toRgba(this._textRgb, 0.5 * ip.opacity);
      } else {
        ctx.font = `500 ${smallFontSize}px 'Inter', system-ui, sans-serif`;
        ctx.fillStyle = toRgba(this._textRgb, 0.6 * ip.opacity);
      }

      ctx.fillText(text, panelX + padX, textY);

      if (line.revealed < line.text.length && line.revealed > 0) {
        const cursorX = panelX + padX + ctx.measureText(text).width + 2;
        if (Math.floor(performance.now() / 400) % 2 === 0) {
          ctx.fillStyle = `rgba(${tc[0]}, ${tc[1]}, ${tc[2]}, ${0.8 * ip.opacity})`;
          ctx.fillRect(cursorX, textY - fontSize + 2, 1.5, fontSize);
        }
      }
      textY += lineHeight;
    }

    ctx.restore();
  }

  getVisualLayerTransform(depth = 0) {
    let dpr = window.devicePixelRatio || 1;
    return getLayerTransform({
      depth,
      layerAnim: this.layerAnim,
      dpr,
      zoom: this.zoom,
      panX: this.panX,
      panY: this.panY,
      vcx: this.canvas.width / 2,
      vcy: this.canvas.height / 2,
      focusActive: this.focusActive,
      focusX: this.focusX,
      focusY: this.focusY,
      dragDeltaX: this._visualDragDeltaX || 0,
      dragDeltaY: this._visualDragDeltaY || 0,
    });
  }

  screenToWorld(sx, sy, depth = 0, transform = null) {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    transform ||= this.getVisualLayerTransform(depth);
    return {
      x: ((sx - rect.left) * dpr - transform.E) / transform.A,
      y: ((sy - rect.top) * dpr - transform.F) / transform.A,
    };
  }

  hitTest(wx, wy) {
    const inGroup = !!this.currentGroupId;
    const activeGroupId = this.currentGroupId;
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i];
      if (inGroup && node.parentId !== activeGroupId && node.id !== activeGroupId) continue;
      const pos = this.getSmooth(node.id);
      if (!pos) continue;

      if (this.renderMode === 'dots') {
        const dx = wx - pos.x, dy = wy - pos.y;
        const hitR = node.isGroup ? HIT_RADIUS * 1.5 : HIT_RADIUS;
        if (dx * dx + dy * dy <= hitR * hitR) return node;
      }
    }
    return null;
  }

  hitTestScreen(sx, sy) {
    const inGroup = !!this.currentGroupId;
    const activeGroupId = this.currentGroupId;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i];
      if (inGroup && node.parentId !== activeGroupId && node.id !== activeGroupId) continue;
      const pos = this.getSmooth(node.id);
      if (!pos) continue;

      if (this.renderMode === 'dots') {
        const depth = node.targetDepth ?? 0;
        const hit = getCanvasNodeScreenHit({
          clientX: sx,
          clientY: sy,
          canvasRect: rect,
          node,
          position: pos,
          transform: this.getVisualLayerTransform(depth),
          dpr,
          hitRadius: getNodeHitRadius(node, HIT_RADIUS),
        });
        if (hit?.hit) return node;
      }
    }
    return null;
  }

  bindEvents() {
    this.canvas.addEventListener('pointerdown', (e) => {
      this._wakeLoop();  // User interaction — resume rendering
      const world = this.screenToWorld(e.clientX, e.clientY, 0);

      if (this.activeNode && !this.dragNode && this.menuAnim > 0.5) {
        const apos = this.getSmooth(this.activeNode.id);
        if (apos) {
          const conns = this.adjMap.get(this.activeNode.id)?.size || 0;
          const menuItems = this.getActionItems();
          const hitItem = getRadialMenuHit({
            world,
            activeNode: this.activeNode,
            activePosition: apos,
            connectionCount: conns,
            menuItems,
          });
          if (hitItem) {
            const action = hitItem.action;
            if (action === 'drill') {
              if (this.activeNode.isGroup && !this.activeNode.isSemanticCluster) {
                this.loadLevel(this.activeNode.id);
              }
            } else {
              this._emitGraphEvent('toolbarAction', { action, nodeId: this.activeNode.id }, {
                bubbles: true,
                composed: true,
              });
            }
            e.preventDefault();
            return;
          }
        }
      }

      const hit = this.hitTestScreen(e.clientX, e.clientY);
      if (hit) {
        const vis = this.getSmooth(hit.id);
        const sim = this.nodePositions.get(hit.id);
        if (vis && sim) { sim.x = vis.x; sim.y = vis.y; }

        let isNewActivation = !this.activeNode || this.activeNode.id !== hit.id;
        this.activeNode = hit;
        this.nextActiveNode = null;
        this.deactivating = false;
        this.dragNode = hit;
        if (isNewActivation) this.menuAnim = 0;
        this.updateInteractionDepths();
        this._nodeActivatedOnDown = isNewActivation;
        const pos = this.nodePositions.get(hit.id);
        const hitDepth = hit.targetDepth ?? 0;
        this._dragWorldTransform = this.getVisualLayerTransform(hitDepth);
        const dragWorld = this.screenToWorld(e.clientX, e.clientY, 0, this._dragWorldTransform);
        this.dragOffset.x = dragWorld.x - pos.x;
        this.dragOffset.y = dragWorld.y - pos.y;
        this._dragStartX = e.clientX;
        this._dragStartY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
        this.canvas.setPointerCapture(e.pointerId);
        this.worker?.pin(hit.id, pos.x, pos.y);
        e.preventDefault();
      } else {
        // Start panning — cancel any fitView/flyToNode animation
        this._targetPanX = null;
        this._targetPanY = null;
        this.isPanning = true;
        this._dragStartX = e.clientX;
        this._dragStartY = e.clientY;
        this.panStart = { x: this.panX, y: this.panY, px: e.clientX, py: e.clientY };
        this.canvas.style.cursor = 'grabbing';
        this.canvas.setPointerCapture(e.pointerId);
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (this.dragNode) {
        this._wakeLoop();  // Dragging node — resume rendering
        const world = this.screenToWorld(e.clientX, e.clientY, 0, this._dragWorldTransform);
        const newX = world.x - this.dragOffset.x;
        const newY = world.y - this.dragOffset.y;
        this.nodePositions.set(this.dragNode.id, { x: newX, y: newY });
        this.worker?.pin(this.dragNode.id, newX, newY);
        this.hoverNode = null;
      } else if (this.isPanning) {
        this._wakeLoop();  // Panning — resume rendering
        this.panX = this.panStart.x + (e.clientX - this.panStart.px);
        this.panY = this.panStart.y + (e.clientY - this.panStart.py);
        this.hoverNode = null;
      } else {
        this.hoverNode = this.hitTestScreen(e.clientX, e.clientY);
      }
    });

    this.canvas.addEventListener('pointerup', (e) => {
      const draggedNode = this.dragNode;
      if (this.dragNode) {
        this.worker?.unpin(this.dragNode.id);
        this.dragNode = null;
      }
      this._dragWorldTransform = null;
      this.isPanning = false;
      this.canvas.style.cursor = 'default';

      // Detect click vs drag: if pointer moved less than 5px, it's a click
      const dx = e.clientX - (this._dragStartX || 0);
      const dy = e.clientY - (this._dragStartY || 0);
      const wasClick = (dx * dx + dy * dy) < 25;

      if (wasClick) {
        const node = draggedNode || this.hitTestScreen(e.clientX, e.clientY);
        if (node) {
          if (node.isGroup) {
            const now = Date.now();
            if (now - this.lastClickTime < 300 && this.lastClickNode === node.id) {
              // Double click on group
              if (node.isSemanticCluster) {
                this.focusSemanticCluster(node.id);
              } else {
                this.loadLevel(node.id);
              }
            } else {
              // Single click on group
              this._emitGraphEvent('groupSelected', { path: node.id });
            }
            this.lastClickTime = now;
            this.lastClickNode = node.id;
          } else {
            // File node click
            this._emitGraphEvent('fileSelected', { path: node.id });
          }
        } else {
          // Click on empty space → deselect active node
          if (this.activeNode && !this.deactivating) {
            this.deactivating = true;
            this.dragNode = null;
            this._emitGraphEvent('nodeDeselected');
          }
        }
      } else if (draggedNode && this._nodeActivatedOnDown) {
        // We dragged a node that was just activated on pointerdown.
        // Emit selection event so URL and UI synchronize.
        if (draggedNode.isGroup) {
          this._emitGraphEvent('groupSelected', { path: draggedNode.id });
        } else {
          this._emitGraphEvent('fileSelected', { path: draggedNode.id });
        }
      }
      if (draggedNode) this._emitLayoutSnapshot();
      this._nodeActivatedOnDown = false;
      this._dragStartX = 0;
      this._dragStartY = 0;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      this._targetZoom = Math.max(0.02, Math.min(5, this._targetZoom * factor));
      this._zoomAnchor = { mx, my };
      this._wakeLoop();  // Zoom changed — resume rendering
    }, { passive: false });

    this.canvas.addEventListener('dblclick', (e) => {
      // Check if we didn't hit a node
      if (!this.hitTestScreen(e.clientX, e.clientY)) {
        if (!this.nodePositions.size) return;
        let sx = 0, sy = 0, count = 0;
        for (const pos of this.nodePositions.values()) { sx += pos.x; sy += pos.y; count++; }
        const cx = sx / count, cy = sy / count;
        const rect = this.canvas.getBoundingClientRect();
        this.panX = rect.width / 2 - cx * this.zoom;
        this.panY = rect.height / 2 - cy * this.zoom;
        this._wakeLoop();  // Double-click recenter — resume rendering
      }
    });
  }
}

CanvasGraph.rootStyles = css;
CanvasGraph.reg('canvas-graph');
