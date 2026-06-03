/* global requestAnimationFrame, cancelAnimationFrame, getComputedStyle */
/**
 * CanvasViewport.js
 *
 * Manages viewport transformations (pan/zoom), Level of Detail (LOD),
 * and node virtualization (phantom data) to optimize rendering of large graphs.
 *
 * @module symbiote-node/canvas/CanvasViewport
 */

export class CanvasViewport {
  /** @type {import('./NodeCanvas/NodeCanvas.js').NodeCanvas} */
  #canvas;
  /** @type {Map<string, HTMLElement>} */
  #nodeViews;
  /** @type {import('./NodeViewManager.js').NodeViewManager} */
  #viewManager;
  /** @type {function(): import('./ConnectionRenderer.js').ConnectionRenderer} */
  #getConnRenderer;


  /** All node data objects from editor — the full set regardless of DOM state */
  #allNodes = new Map();
  /** Position + size cache for nodes without DOM (phantom rendering on Canvas) */
  #phantomData = new Map();
  /** Degree (connection count) per node — for dot sizing */
  #nodeDegrees = new Map();
  /** Debounce timer for promote/demote batch */
  #virtTimer = null;
  /** Dirty flag — phantom positions changed, needs re-sync to renderer */
  #phantomDirty = false;

  /** @type {number|null} */
  #panAnimFrame = null;

  /**
   * @param {object} config
   * @param {import('./NodeCanvas/NodeCanvas.js').NodeCanvas} config.canvas
   * @param {Map<string, HTMLElement>} config.nodeViews
   * @param {import('./NodeViewManager.js').NodeViewManager} config.viewManager
   * @param {function(): import('./ConnectionRenderer.js').ConnectionRenderer} config.getConnRenderer
   */
  constructor({ canvas, nodeViews, viewManager, getConnRenderer }) {
    this.#canvas = canvas;
    this.#nodeViews = nodeViews;
    this.#viewManager = viewManager;
    this.#getConnRenderer = getConnRenderer;
  }

  /**
   * Reset and initialize virtualization data from a new editor
   * @param {import('../core/Editor.js').NodeEditor} editor
   */
  initializeData(editor) {
    this.#allNodes.clear();
    this.#phantomData.clear();
    this.#nodeDegrees.clear();

    for (const node of editor.getNodes()) {
      this.#allNodes.set(node.id, node);
      this.#nodeDegrees.set(node.id, 0);
    }

    let allConns = editor.getConnections();
    for (const conn of allConns) {
      this.#nodeDegrees.set(conn.from, (this.#nodeDegrees.get(conn.from) || 0) + 1);
      this.#nodeDegrees.set(conn.to, (this.#nodeDegrees.get(conn.to) || 0) + 1);
    }

    const VIRT_THRESHOLD = 200;
    if (this.#allNodes.size <= VIRT_THRESHOLD) {

      this.#viewManager.addViews(editor.getNodes());
    } else {

      let defaultW = 180,
        defaultH = 60;
      for (const [id, node] of this.#allNodes) {
        this.#phantomData.set(id, {
          id,
          x: 0,
          y: 0,
          w: defaultW,
          h: defaultH,
          degree: this.#nodeDegrees.get(id) || 0,
          color: null,
          label: node.label || id,
        });
      }
    }
  }

  /**
   * Clear all virtualization data
   */
  clear() {
    this.#allNodes.clear();
    this.#phantomData.clear();
    this.#nodeDegrees.clear();
    if (this.#virtTimer) {
      clearTimeout(this.#virtTimer);
      this.#virtTimer = null;
    }
    if (this.#panAnimFrame) {
      cancelAnimationFrame(this.#panAnimFrame);
      this.#panAnimFrame = null;
    }
  }

  /**
   * Handle node creation event
   * @param {import('../../core/Node.js').Node} node
   */
  handleNodeCreated(node) {
    this.#allNodes.set(node.id, node);
    if (this.#phantomData.size > 0) {
      this.#phantomData.set(node.id, {
        id: node.id,
        x: 0,
        y: 0,
        w: 180,
        h: 60,
        degree: 0,
        color: null,
        label: node.label || node.id,
      });
    } else {
      this.#viewManager.addView(node);
    }
  }

  /**
   * Update phantom node position cache
   * @param {string} nodeId
   * @param {number} x
   * @param {number} y
   */
  updatePhantomPosition(nodeId, x, y) {
    let pd = this.#phantomData.get(nodeId);
    if (pd) {
      pd.x = x;
      pd.y = y;
      this.#phantomDirty = true;
    }
  }

  /**
   * Update viewport transform and schedule culling
   */
  updateTransform() {

    if (this.#canvas._gridBase === undefined) {
      this.#canvas._gridBase =
        parseInt(getComputedStyle(this.#canvas).getPropertyValue('--sn-grid-size')) || 20;
    }
    let gridBase = this.#canvas._gridBase;
    let zoom = this.#canvas.$.zoom;
    let multiplier = zoom < 0.5 ? 2 : 1;
    let gridSize = gridBase * multiplier * zoom;
    this.#canvas.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    this.#canvas.style.backgroundPosition = `${this.#canvas.$.panX}px ${this.#canvas.$.panY}px`;


    let toolbar = this.#canvas.ref.quickToolbar;
    if (toolbar) {
      toolbar._transform = { zoom, panX: this.#canvas.$.panX, panY: this.#canvas.$.panY };
      if (toolbar._nodeEl) toolbar.updatePosition(toolbar._nodeEl);
    }


    if (!this.#canvas._cullingScheduled) {
      this.#canvas._cullingScheduled = true;
      requestAnimationFrame(() => {
        this.#canvas._cullingScheduled = false;
        this.#applyCullingAndLOD();
      });
    }
  }

  /**
   * Apply culling and level of detail logic based on zoom/pan
   * @private
   */
  #applyCullingAndLOD() {
    if (!this.#canvas.ref.canvasContainer) return;
    if (this.#nodeViews.size === 0 && this.#phantomData.size === 0) return;

    let cw = this.#canvas.ref.canvasContainer.clientWidth;
    let ch = this.#canvas.ref.canvasContainer.clientHeight;
    let zoom = this.#canvas.$.zoom;
    let panX = this.#canvas.$.panX;
    let panY = this.#canvas.$.panY;
    let margin = 300;

    let lod = zoom < 0.5 ? 'medium' : 'full';
    this.#canvas._currentLod = lod;

    if (this.#canvas.ref.connections) {
      let isDimmed = this.#canvas.ref.connections.hasAttribute('data-lod-dimmed');
      if (lod !== 'full') {
        if (!isDimmed) this.#canvas.ref.connections.setAttribute('data-lod-dimmed', '');
      } else {
        if (isDimmed) this.#canvas.ref.connections.removeAttribute('data-lod-dimmed');
      }
    }

    let isVirtualized = this.#phantomData.size > 0 || this.#allNodes.size > 200;
    const FAR_ZOOM = zoom < 0.25;
    let toPromote = [];
    let toDemote = [];

    for (const [id, el] of this.#nodeViews) {
      let pos = el._position;
      if (!pos) continue;

      let screenX = pos.x * zoom + panX;
      let screenY = pos.y * zoom + panY;
      if (!el._cachedW) {
        el._cachedW = el.offsetWidth || 180;
        el._cachedH = el.offsetHeight || 60;
      }
      let w = el._cachedW * zoom;
      let h = el._cachedH * zoom;

      let visible =
        screenX + w > -margin &&
        screenX < cw + margin &&
        screenY + h > -margin &&
        screenY < ch + margin;

      if (isVirtualized && FAR_ZOOM) {
        toDemote.push(id);
      } else if (visible) {
        if (el.style.visibility !== '') el.style.visibility = '';
        if (el.getAttribute('data-lod') !== lod) el.setAttribute('data-lod', lod);
      } else if (isVirtualized) {
        toDemote.push(id);
      } else {
        if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden';
      }
    }

    if (isVirtualized && !FAR_ZOOM) {
      for (const [id, pd] of this.#phantomData) {
        let screenX = pd.x * zoom + panX;
        let screenY = pd.y * zoom + panY;
        let w = (pd.w || 180) * zoom;
        let h = (pd.h || 60) * zoom;

        let visible =
          screenX + w > -margin &&
          screenX < cw + margin &&
          screenY + h > -margin &&
          screenY < ch + margin;

        if (visible) toPromote.push(id);
      }
    }

    if (FAR_ZOOM && toDemote.length > 0) {
      if (this.#virtTimer) {
        clearTimeout(this.#virtTimer);
        this.#virtTimer = null;
      }
      for (const id of toDemote) this.#demoteNode(id);
      this.#syncPhantomToRenderer();
    } else if (toPromote.length > 0 || toDemote.length > 0) {
      if (this.#virtTimer) clearTimeout(this.#virtTimer);
      this.#virtTimer = setTimeout(() => {
        this.#virtTimer = null;
        for (const id of toDemote) this.#demoteNode(id);
        for (const id of toPromote) this.#promoteNode(id);
        this.#syncPhantomToRenderer();
      }, 100);
    } else if (this.#phantomDirty) {
      this.#phantomDirty = false;
      this.#syncPhantomToRenderer();
    }
  }

  /**
   * Promote a phantom node to a full DOM node
   * @param {string} nodeId
   * @private
   */
  #promoteNode(nodeId) {
    if (this.#nodeViews.has(nodeId)) return;
    let node = this.#allNodes.get(nodeId);
    if (!node) return;

    let pd = this.#phantomData.get(nodeId);
    this.#viewManager.addView(node);
    let el = this.#nodeViews.get(nodeId);
    if (el && pd) {
      el._position = { x: pd.x, y: pd.y };
      el._cachedW = pd.w;
      el._cachedH = pd.h;
      el.style.transform = `translate(${pd.x}px, ${pd.y}px)`;
    }
    this.#phantomData.delete(nodeId);
  }

  /**
   * Demote a DOM node to a phantom node
   * @param {string} nodeId
   * @private
   */
  #demoteNode(nodeId) {
    if (!this.#nodeViews.has(nodeId)) return;
    let el = this.#nodeViews.get(nodeId);
    let color = null;
    if (el) {
      color = el._cachedBgColor || el.style.backgroundColor || null;
    }
    let dims = this.#viewManager.removeViewInstant(nodeId);
    if (dims) {
      let node = this.#allNodes.get(nodeId);
      this.#phantomData.set(nodeId, {
        id: nodeId,
        x: dims.x,
        y: dims.y,
        w: dims.w,
        h: dims.h,
        degree: this.#nodeDegrees.get(nodeId) || 0,
        color,
        label: node?.label || nodeId,
      });
    }
  }

  /**
   * Sync phantom node data to the connection renderer
   * @private
   */
  #syncPhantomToRenderer() {
    let connRenderer = this.#getConnRenderer();
    if (connRenderer && typeof connRenderer.setPhantomNodes === 'function') {
      connRenderer.setPhantomNodes([...this.#phantomData.values()]);
    }
  }

  /**
   * Trigger a manual sync of phantom nodes
   */
  syncPhantom() {
    this.#phantomDirty = false;
    this.#syncPhantomToRenderer();
  }

  /**
   * Fit all nodes (phantom and DOM) within the viewport
   */
  fitView() {
    if (this.#nodeViews.size === 0 && this.#phantomData.size === 0) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const [, el] of this.#nodeViews) {
      if (!el._position) continue;
      let x = el._position.x;
      let y = el._position.y;
      let w = el._cachedW || el.offsetWidth || 150;
      let h = el._cachedH || el.offsetHeight || 40;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    }

    for (const [, pd] of this.#phantomData) {
      if (pd.x < minX) minX = pd.x;
      if (pd.y < minY) minY = pd.y;
      if (pd.x + pd.w > maxX) maxX = pd.x + pd.w;
      if (pd.y + pd.h > maxY) maxY = pd.y + pd.h;
    }

    if (minX === Infinity) return;

    let graphW = maxX - minX;
    let graphH = maxY - minY;
    let canvasRect = this.#canvas.ref.canvasContainer.getBoundingClientRect();

    let visibleWidth = canvasRect.width;
    let inspector = this.#canvas.ref.inspector || this.#canvas.querySelector('inspector-panel');
    if (inspector && !inspector.hasAttribute('hidden')) {
      visibleWidth -= inspector.offsetWidth || 280;
    }

    let scaleX = (visibleWidth - 80) / graphW;
    let scaleY = (canvasRect.height - 80) / graphH;
    let scale = Math.max(0.001, Math.min(scaleX, scaleY, 1.5));

    let centerX = (minX + maxX) / 2;
    let centerY = (minY + maxY) / 2;

    this.#canvas.$.zoom = scale;
    this.#canvas.$.panX = visibleWidth / 2 - centerX * scale;
    this.#canvas.$.panY = canvasRect.height / 2 - centerY * scale;
    this.updateTransform();
  }

  /**
   * Fly camera to a specific node, zooming in
   * @param {string} nodeId
   * @param {Object} [options]
   * @param {number} [options.zoom=0.8]
   * @returns {boolean} True if successful
   */
  flyToNode(nodeId, { zoom = 0.8 } = {}) {
    let el = this.#nodeViews.get(nodeId);

    if (!el && this.#phantomData.has(nodeId)) {
      this.#promoteNode(nodeId);
      el = this.#nodeViews.get(nodeId);
    }
    if (!el) return false;

    let pos =
      el._position ||
      (() => {
        let pd = this.#phantomData.get(nodeId);
        return pd ? { x: pd.x, y: pd.y } : { x: 0, y: 0 };
      })();

    let canvasRect = this.#canvas.ref.canvasContainer.getBoundingClientRect();
    let visibleWidth = canvasRect.width;

    let inspector = this.#canvas.ref.inspector || this.#canvas.querySelector('inspector-panel');
    if (inspector && !inspector.hasAttribute('hidden') && inspector.offsetWidth > 20) {
      visibleWidth -= inspector.offsetWidth;
    }

    let elWidth = el._cachedW || el.offsetWidth || 150;
    let elHeight = el._cachedH || el.offsetHeight || 40;

    let nodeX = pos.x + elWidth / 2;
    let nodeY = pos.y + elHeight / 2;

    let newPanX = visibleWidth / 2 - nodeX * zoom;
    let newPanY = canvasRect.height / 2 - nodeY * zoom;

    let dz = Math.abs(this.#canvas.$.zoom - zoom);
    let dx = Math.abs(this.#canvas.$.panX - newPanX);
    let dy = Math.abs(this.#canvas.$.panY - newPanY);

    if (dz < 0.01 && dx < 2 && dy < 2) {
      this.#canvas.selectNode(nodeId);
      if (!this.#canvas._cullingScheduled) {
        this.#canvas._cullingScheduled = true;
        requestAnimationFrame(() => {
          this.#canvas._cullingScheduled = false;
          this.#applyCullingAndLOD();
        });
      }
      return true;
    }

    this.#canvas.$.zoom = zoom;
    this.#canvas.$.panX = newPanX;
    this.#canvas.$.panY = newPanY;

    this.#canvas.selectNode(nodeId);
    return true;
  }

  /**
   * Pan smoothly to a specific node
   * @param {string} nodeId
   * @param {number} [duration=400]
   */
  panToNode(nodeId, duration = 400) {
    let el = this.#nodeViews.get(nodeId);
    if (!el?._position) return;
    let container = this.#canvas.ref.canvasContainer;
    if (!container) return;

    let cx = container.clientWidth / 2;
    let cy = container.clientHeight / 2;
    let nodeW = (el.offsetWidth || 180) / 2;
    let nodeH = (el.offsetHeight || 60) / 2;
    let targetX = -(el._position.x + nodeW) * this.#canvas.$.zoom + cx;
    let targetY = -(el._position.y + nodeH) * this.#canvas.$.zoom + cy;

    this.animatePan(targetX, targetY, duration);
  }

  /**
   * Animate pan to a target coordinate
   * @param {number} targetX
   * @param {number} targetY
   * @param {number} duration
   */
  animatePan(targetX, targetY, duration) {
    if (this.#panAnimFrame) {
      cancelAnimationFrame(this.#panAnimFrame);
      this.#panAnimFrame = null;
    }

    let startX = this.#canvas.$.panX;
    let startY = this.#canvas.$.panY;
    let dx = targetX - startX;
    let dy = targetY - startY;

    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    let startTime = performance.now();

    let step = (now) => {
      let elapsed = now - startTime;
      let t = Math.min(elapsed / duration, 1);
      let ease = 1 - Math.pow(1 - t, 3);

      this.#canvas.$.panX = startX + dx * ease;
      this.#canvas.$.panY = startY + dy * ease;
      this.updateTransform();

      if (t < 1) {
        this.#panAnimFrame = requestAnimationFrame(step);
      } else {
        this.#panAnimFrame = null;
      }
    };

    this.#panAnimFrame = requestAnimationFrame(step);
  }

  getPositions() {
    let positions = {};
    for (const [id, el] of this.#nodeViews) {
      if (el._position) {
        positions[id] = [el._position.x, el._position.y];
      }
    }
    for (const [id, pd] of this.#phantomData) {
      if (!positions[id]) {
        positions[id] = [pd.x, pd.y];
      }
    }
    return positions;
  }

  hasNode(nodeId) {
    return this.#nodeViews.has(nodeId) || this.#phantomData.has(nodeId);
  }
}

export { CanvasViewport as default };
