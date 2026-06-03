/**
 * SelectionSync.js
 *
 * Synchronizes the canvas DOM state (nodes, connections, inspector, toolbar)
 * with the internal Selector state.
 *
 * @module symbiote-node/canvas/SelectionSync
 */

export class SelectionSync {
  /** @type {import('./NodeCanvas/NodeCanvas.js').NodeCanvas} */
  #canvas;
  /** @type {function(): import('../core/Editor.js').NodeEditor} */
  #getEditor;
  /** @type {Map<string, HTMLElement>} */
  #nodeViews;
  /** @type {function(): import('./ConnectionRenderer.js').ConnectionRenderer} */
  #getConnRenderer;

  #zCounter = 0;
  #connPathCache = new Map();

  /**
   * @param {object} options
   * @param {import('./NodeCanvas/NodeCanvas.js').NodeCanvas} options.canvas
   * @param {function(): import('../core/Editor.js').NodeEditor} options.getEditor
   * @param {Map<string, HTMLElement>} options.nodeViews
   * @param {function(): import('./ConnectionRenderer.js').ConnectionRenderer} options.getConnRenderer
   */
  constructor({ canvas, getEditor, nodeViews, getConnRenderer }) {
    this.#canvas = canvas;
    this.#getEditor = getEditor;
    this.#nodeViews = nodeViews;
    this.#getConnRenderer = getConnRenderer;
  }

  /**
   * Synchronize DOM when selection changes
   * @param {Set<string>} selectedNodes
   * @param {Set<string>} selectedConnections
   */
  sync(selectedNodes, selectedConnections) {
    this.#zCounter++;
    let editor = this.#getEditor();


    let neighbors = new Set();
    if (editor && selectedNodes.size > 0) {
      for (const conn of editor.getConnections()) {
        if (selectedNodes.has(conn.from)) neighbors.add(conn.to);
        if (selectedNodes.has(conn.to)) neighbors.add(conn.from);
      }
    }


    for (const [id, el] of this.#nodeViews) {
      let shouldSelect = selectedNodes.has(id);
      let isSelected = el.hasAttribute('data-selected');
      if (shouldSelect && !isSelected) {
        el.setAttribute('data-selected', '');
        el.style.zIndex = this.#zCounter;
      } else if (!shouldSelect && isSelected) {
        el.removeAttribute('data-selected');
      }

      let shouldNeighbor = neighbors.has(id) && !shouldSelect;
      let isNeighbor = el.hasAttribute('data-neighbor-focused');
      if (shouldNeighbor && !isNeighbor) {
        el.setAttribute('data-neighbor-focused', '');
      } else if (!shouldNeighbor && isNeighbor) {
        el.removeAttribute('data-neighbor-focused');
      }
    }


    let activeConnIds = new Set();
    if (editor && selectedNodes.size > 0) {
      for (const conn of editor.getConnections()) {
        if (selectedNodes.has(conn.from) || selectedNodes.has(conn.to)) {
          activeConnIds.add(conn.id);
        }
      }
    }


    let connSvg = this.#canvas.ref.connections;
    let connRenderer = this.#getConnRenderer();
    if (!this.#connPathCache) this.#connPathCache = new Map();
    for (const [id] of connRenderer?.data || []) {
      let path = this.#connPathCache.get(id);
      if (!path || !path.isConnected) {
        path = connSvg.querySelector(`[data-conn-id="${id}"]`);
        if (path) this.#connPathCache.set(id, path);
      }
      if (!path) continue;


      let shouldSelectConn = selectedConnections.has(id);
      if (shouldSelectConn !== path.hasAttribute('data-selected')) {
        shouldSelectConn
          ? path.setAttribute('data-selected', '')
          : path.removeAttribute('data-selected');
      }


      let isActive = activeConnIds.has(id);
      if (isActive !== path.hasAttribute('data-active-conn')) {
        isActive
          ? path.setAttribute('data-active-conn', '')
          : path.removeAttribute('data-active-conn');
      }


      let shouldDim = !isActive && selectedNodes.size > 0;
      if (shouldDim !== path.hasAttribute('data-dimmed')) {
        shouldDim ? path.setAttribute('data-dimmed', '') : path.removeAttribute('data-dimmed');
      }
    }


    if (connRenderer && typeof connRenderer.setSelectionState === 'function') {
      connRenderer.setSelectionState(selectedNodes.size > 0, activeConnIds);
    }


    let toolbar = this.#canvas.ref.quickToolbar;
    if (toolbar) {
      if (selectedNodes.size === 1) {
        let nodeId = [...selectedNodes][0];
        let nodeEl = this.#nodeViews.get(nodeId);
        if (nodeEl) toolbar.show(nodeId, nodeEl, { sticky: true });
      } else {
        toolbar.hide();
      }
    }


    let inspector = this.#canvas.ref.inspector;
    if (inspector) {
      inspector._canvas = this.#canvas;
      if (selectedNodes.size === 1) {
        let nodeId = [...selectedNodes][0];
        let node = editor?.getNode(nodeId);
        if (node) {
          inspector.inspect(node);
          inspector.hidden = false;
        }
      } else {
        inspector.clear();
        inspector.hidden = true;
      }
    }


    this.#canvas.dispatchEvent(
      new CustomEvent('selection-changed', {
        detail: { nodes: [...selectedNodes], connections: [...selectedConnections] },
      })
    );
  }
}

export { SelectionSync as default };
