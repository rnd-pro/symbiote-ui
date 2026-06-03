/* eslint-env browser */
/* global document, requestAnimationFrame */
/**
 * NodeCanvas — main graph viewport (facade)
 *
 * Thin orchestration layer that delegates to:
 *  - NodeViewManager (node CRUD + group drag)
 *  - ConnectionRenderer (SVG paths + gradients + flow)
 *  - PseudoConnection (temp drag line)
 *  - ViewportActions (context menu + keyboard + fitView)
 *
 * @module symbiote-node/canvas/NodeCanvas
 */

import Symbiote from '@symbiotejs/symbiote';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import { template } from './NodeCanvas.tpl.js';
import { styles } from './NodeCanvas.css.js';
import { Drag } from '../../interactions/Drag.js';
import { Zoom } from '../../interactions/Zoom.js';
import { ConnectFlow } from '../../interactions/ConnectFlow.js';
import { Selector } from '../../interactions/Selector.js';
import { SnapGrid } from '../../interactions/SnapGrid.js';
import { applyTheme } from '../../themes/Theme.js';
import { applyPalette } from '../../themes/Palette.js';
import { applySkin } from '../../themes/Skin.js';
import { NodeViewManager } from '../NodeViewManager.js';
import { FrameManager } from '../FrameManager.js';
import { SelectionSync } from '../SelectionSync.js';
import { CanvasViewport } from '../CanvasViewport.js';
import { ConnectionRenderer } from '../ConnectionRenderer.js';
import { CanvasConnectionRenderer } from '../CanvasConnectionRenderer.js';
import { PseudoConnection } from '../PseudoConnection.js';
import { ViewportActions } from '../ViewportActions.js';
import { SubgraphManager } from '../SubgraphManager.js';
import '../../menu/ContextMenu/ContextMenu.js';
import '../../toolbar/QuickToolbar/QuickToolbar.js';
import '../../node/GraphFrame/GraphFrame.js';
import '../../inspector/InspectorPanel/InspectorPanel.js';
import '../Minimap/Minimap.js';
import '../NodeSearch/NodeSearch.js';
import '../Breadcrumb/Breadcrumb.js';
import { computeAutoLayout } from '../AutoLayout.js';
import { translate } from '../../locale/index.js';

const FLOW_DIRECTIONS = new Set(['vertical', 'horizontal']);

function toFiniteNumber(value, fallback) {
  let number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeFlowPadding(value) {
  if (typeof value === 'number') {
    return { top: value, right: value, bottom: value, left: value };
  }
  if (!value || typeof value !== 'object') {
    return { top: 24, right: 24, bottom: 24, left: 24 };
  }
  return {
    top: toFiniteNumber(value.top, 24),
    right: toFiniteNumber(value.right, 24),
    bottom: toFiniteNumber(value.bottom, 24),
    left: toFiniteNumber(value.left, 24),
  };
}

function clampFlowSize(value, min, max) {
  let next = value;
  if (Number.isFinite(min)) next = Math.max(min, next);
  if (Number.isFinite(max)) next = Math.min(max, next);
  return next;
}

export class NodeCanvas extends Symbiote {
  init$ = {
    zoom: 1,
    panX: 0,
    panY: 0,
    chrome: true,
    minimapToggleTitle: translate('nodeCanvas.toggleMinimap'),
    '+contentTransform': () =>
      `translate(${this.$.panX}px, ${this.$.panY}px) scale(${this.$.zoom})`,
  };

  /** @type {import('../../core/Editor.js').NodeEditor|null} */
  _editor = null;

  /** @type {Drag|null} */
  _drag = null;

  /** @type {Zoom|null} */
  _zoom = null;

  /** @type {ConnectFlow|null} */
  _connectFlow = null;

  /** @type {Map<string, HTMLElement>} */
  _nodeViews = new Map();

  /** @type {SelectionSync} */
  _selectionSync = new SelectionSync({
    canvas: this,
    getEditor: () => this._editor,
    nodeViews: this._nodeViews,
    getConnRenderer: () => this._connRenderer,
  });

  /** @type {Selector} */
  _selector = new Selector({
    onChange: (nodes, connections) => this._selectionSync.sync(nodes, connections),
  });

  /** @type {SnapGrid} */
  _snapGrid = new SnapGrid({ size: 16, dynamic: false });

  /** @type {FrameManager|null} */
  _frameManager = null;

  /** @type {boolean} */
  _readonly = false;

  /** @type {boolean} */
  _readonlyNodeDragging = false;

  /** @type {boolean} */
  _viewportLocked = false;

  /** @type {boolean} */
  _panelsEnabled = true;

  /** @type {boolean} */
  _snapEnabled = false;

  /** @type {boolean} */
  _nodeDragActive = false;

  /** @type {number|null} */
  _panAnimFrame = null;

  /** @type {string} */
  _themeName = 'default-provider';

  /** @type {NodeViewManager|null} */
  _viewManager = null;

  /** @type {import('../ConnectionRenderer.js').ConnectionRenderer | import('../CanvasConnectionRenderer.js').CanvasConnectionRenderer | null} */
  _connRenderer = null;

  /** @type {PseudoConnection|null} */
  _pseudo = null;

  /** @type {ViewportActions|null} */
  _actions = null;

  /** @type {'bezier'|'orthogonal'|'straight'|'pcb'} saved across setEditor calls */
  _pathStyle = 'bezier';

  /** @type {Object|null} */
  _flowLayout = null;

  /** @type {CanvasViewport|null} */
  _viewport = null;

  /** @type {SubgraphManager} */
  _subgraphManager = new SubgraphManager();

  /** @type {boolean} - guard to prevent setEditor re-init during navigation */
  _navigating = false;

  /** @type {number} */
  _lastClickTime = 0;

  /** @type {string|null} */
  _lastClickNodeId = null;


  /**
   * Clear all existing node, connection, and frame views from the DOM.
   * Called before switching to a new editor to ensure clean state.
   */
  _clearViews() {

    for (const [, el] of this._nodeViews) {
      if (el._previewRaf) {
        clearTimeout(el._previewRaf);
        el._previewRaf = null;
      }
      if (el._drag) el._drag.destroy();
      el._redrawPreview = null;
      el.remove();
    }
    this._nodeViews.clear();
    if (this._viewport) this._viewport.clear();


    if (this._editor) {
      this._editor.removeAllListeners?.();
    }


    if (this._connRenderer) {
      let conns = [...this._connRenderer.data.values()];
      for (const conn of conns) {
        this._connRenderer.remove(conn);
      }
    }


    if (this._frameManager) {
      this._frameManager.clear();
    }


    if (this._selector) this._selector.unselectAll();
  }

  /**
   * Bind editor to canvas
   * @param {import('../../core/Editor.js').NodeEditor} editor
   * @returns {void}
   */
  setEditor(editor) {

    this._clearViews();

    this._editor = editor;

    let engineMode = this.getAttribute('connection-engine') || 'svg';

    if (engineMode === 'canvas') {
      this._connRenderer = new CanvasConnectionRenderer({
        canvasLayer: this.ref.connCanvas,
        dotLayer: this.ref.pseudoSvg,
        nodeViews: this._nodeViews,
        editor,
        onConnectionClick: (connId, e) => this._handleConnectionClick(connId, e),
        getZoom: () => this.$.zoom,
        getPan: () => ({ x: this.$.panX, y: this.$.panY }),
        onDotDrag: (socketData) => {
          if (this._connectFlow && !this._readonly) {
            this._connectFlow.pickSocket(socketData);
          }
        },
      });
    } else {
      this._connRenderer = new ConnectionRenderer({
        svgLayer: this.ref.connections,
        dotLayer: this.ref.pseudoSvg,
        nodeViews: this._nodeViews,
        editor,
        onConnectionClick: (connId, e) => this._handleConnectionClick(connId, e),
        getZoom: () => this.$.zoom,
        onDotDrag: (socketData) => {
          if (this._connectFlow && !this._readonly) {
            this._connectFlow.pickSocket(socketData);
          }
        },
      });
    }

    if (this._pathStyle !== 'bezier') {
      this._connRenderer.setPathStyle(this._pathStyle);
    }

    this._pseudo = new PseudoConnection(this.ref.pseudoSvg);

    this._actions = new ViewportActions({
      editor,
      selector: this._selector,
      nodeViews: this._nodeViews,
      canvas: this,
    });


    let toolbar = this.ref.quickToolbar;
    if (toolbar) {
      let actionMap = {
        delete: (nodeId) => {
          this._actions.deleteNode(nodeId);
          toolbar.hide();
        },
        duplicate: (nodeId) => {
          this._actions.cloneNode(nodeId);
        },
        enter: (nodeId) => {
          this.drillDown(nodeId);
          toolbar.hide();
        },
        mute: (nodeId) => {
          this._actions.muteNode(nodeId);
          let nodeEl = this._nodeViews.get(nodeId);
          if (nodeEl) toolbar.show(nodeId, nodeEl, { sticky: true });
        },
      };
      toolbar._onAction = (action, nodeId) => {
        let handler = actionMap[action];
        if (handler) {
          handler(nodeId);
        } else {

          this.dispatchEvent(
            new CustomEvent('toolbar-action', {
              detail: { action, nodeId },
              bubbles: true,
            })
          );
          toolbar.hide();
        }
      };
    }

    this._viewManager = new NodeViewManager({
      nodeViews: this._nodeViews,
      editor,
      selector: this._selector,
      snapGrid: this._snapGrid,
      getZoom: () => this.$.zoom,
      setNodePosition: (id, x, y) => this.setNodePosition(id, x, y),
      animateNodeToPosition: (id, x, y) => this.animateNodeToPosition(id, x, y),
      onNodeClick: (id, e) => this._handleNodeClick(id, e),
      onNodePointerEnter: (id, el) => this._handleNodePointerEnter(id, el),
      onNodePointerLeave: (id) => this._handleNodePointerLeave(id),
      onNodeDragStart: (id, el, e) => this._handleNodeDragStart(id, el, e),
      onNodeDragEnd: (id, el, e) => this._handleNodeDragEnd(id, el, e),
      nodesLayer: this.ref.nodesLayer,
      canvas: this,
      onSvgShapeReady: (nodeId) => this._connRenderer?.renderFreeDots(nodeId),
    });
    this._viewManager.setReadonly(this._readonly);
    this._viewManager.setReadonlyNodeDragging(this._readonlyNodeDragging);

    this._frameManager = new FrameManager({
      nodeViews: this._nodeViews,
      editor,
      canvas: this,
      setNodePosition: (id, x, y) => this.setNodePosition(id, x, y),
    });

    this._viewport = new CanvasViewport({
      canvas: this,
      nodeViews: this._nodeViews,
      viewManager: this._viewManager,
      getConnRenderer: () => this._connRenderer,
    });


    this._connectFlow = new ConnectFlow(editor, {
      getNodePosition: (id) => {
        let el = this._nodeViews.get(id);
        return el?._position || { x: 0, y: 0 };
      },
      getNodeSize: (id) => {
        let el = this._nodeViews.get(id);
        return { width: el?.offsetWidth || 180, height: el?.offsetHeight || 60 };
      },
      getTransform: () => ({
        k: this.$.zoom,
        x: this.$.panX,
        y: this.$.panY,
        rect: this.ref.canvasContainer.getBoundingClientRect(),
      }),
      onPseudoStart: (sx, sy, socketData) => {
        this._actions.highlightCompatibleSockets(socketData, this.ref.nodesLayer);
      },
      onPseudoMove: (sx, sy, ex, ey) => {
        this._pseudo.show(sx, sy, ex, ey);
      },
      onPseudoEnd: () => {
        this._pseudo.hide();
        this._actions.clearSocketHighlights(this.ref.nodesLayer);
        this._actions.clearPortHints();
        this._connRenderer?.clearDotHighlights();
      },
      onCompatibleMove: (worldX, worldY, socketData) => {

        let compatibleIds = this._actions.getCompatibleNodeIds(socketData);
        this._connRenderer?.highlightDotsForNodes(compatibleIds);
      },

      onDropEmpty: (x, y, socketData) => {
        this._actions.handleDropEmpty(x, y, socketData);

        let menuX = x * this.$.zoom + this.$.panX;
        let menuY = y * this.$.zoom + this.$.panY;
        this.ref.contextMenu?.show(menuX, menuY, [
          {
            label: translate('nodeCanvas.addNode'),
            icon: 'add_box',
            action: () => this._editor?.emit('contextadd', { x, y }),
          },
        ]);
      },
      findNearestDot: (wx, wy) => this._connRenderer?.findNearestDot(wx, wy),
    });


    editor.on('nodecreated', (node) => this._viewport.handleNodeCreated(node));
    editor.on('noderemoved', (node) => {
      this._viewManager.removeView(node);

      for (const [, conn] of this._connRenderer.data) {
        if (conn.from === node.id || conn.to === node.id) {
          this._connRenderer.remove(conn);
        }
      }
      this.refreshFlowLayout();
    });
    editor.on('connectioncreated', (conn) => this._connRenderer.add(conn));
    editor.on('connectionremoved', (conn) => {
      this._connRenderer.remove(conn);
      this._selector.getSelectedConnections().delete(conn.id);
    });


    let refreshNodeConnections = ({ nodeId }) => {
      requestAnimationFrame(() => this._connRenderer?.updateForNode(nodeId));
    };
    editor.on('nodecollapse', refreshNodeConnections);
    editor.on('nodemute', refreshNodeConnections);


    this._viewport.initializeData(editor);


    this._connRenderer.setBatchMode?.(true);
    let allConns = editor.getConnections();
    this._connRenderer.addBatch(allConns);
    this._viewport.syncPhantom();
    this._connRenderer.setBatchMode?.(false);


    editor.on('framecreated', (frame) => this._frameManager.addView(frame));
    editor.on('frameremoved', (frame) => this._frameManager.removeView(frame));


    editor.on('nodemovetopos', ({ nodeId, x, y }) => {
      this.setNodePosition(nodeId, x, y);
    });


    for (const frame of editor.getFrames()) {
      this._frameManager.addView(frame);
    }


    if (!this._navigating) {
      this._subgraphManager.initialize(this, editor);
      let breadcrumb = this.ref.breadcrumb;
      if (breadcrumb) {
        this._subgraphManager.onNavigate((path) => {
          breadcrumb.setPath(path);
        });
        breadcrumb.onNavigate((level) => {
          this.drillUp(level);
        });
      }
    }
  }

  /** @returns {ConnectFlow|null} */
  getConnectFlow() {
    return this._connectFlow;
  }

  /**
   * Enable/disable snap to grid
   * @param {boolean} enabled
   * @param {number} [size]
   */
  setSnapGrid(enabled, size) {
    this._snapEnabled = enabled;
    if (size) this._snapGrid.setSize(size);
    this._viewManager?.setSnapEnabled(enabled);
  }

  /**
   * Enable/disable readonly mode
   * @param {boolean} enabled
   */
  setReadonly(enabled) {
    this._readonly = enabled;
    this.toggleAttribute('data-readonly', enabled);
    this._viewManager?.setReadonly(enabled);
    this._actions?.setReadonly(enabled);
  }

  /**
   * Allow graph nodes to move while the canvas remains readonly.
   * @param {boolean} enabled
   */
  setReadonlyNodeDragging(enabled) {
    this._readonlyNodeDragging = enabled;
    this.toggleAttribute('data-readonly-node-dragging', enabled);
    this._viewManager?.setReadonlyNodeDragging(enabled);
  }

  /**
   * Enable or remove viewport controls, context menu, and node toolbar.
   * @param {boolean} enabled
   */
  setChrome(enabled) {
    this.$.chrome = enabled;
    this.toggleAttribute('data-chrome-none', !enabled);
    if (!enabled) {
      this.ref.quickToolbar?.hide?.();
      if (this.ref.minimap) this.ref.minimap.hidden = true;
      if (this.ref.nodeSearch) this.ref.nodeSearch.hidden = true;
      if (this.ref.breadcrumb) this.ref.breadcrumb.hidden = true;
      if (this.ref.contextMenu) this.ref.contextMenu.hidden = true;
      if (this.ref.inspector) this.ref.inspector.hidden = true;
    }
  }

  /**
   * Enable or remove canvas side panels while keeping node menus available.
   * @param {boolean} enabled
   */
  setPanels(enabled) {
    this._panelsEnabled = enabled;
    this.toggleAttribute('data-panels-none', !enabled);
    if (!enabled) {
      if (this.ref.minimap) this.ref.minimap.hidden = true;
      if (this.ref.nodeSearch) this.ref.nodeSearch.hidden = true;
      if (this.ref.breadcrumb) this.ref.breadcrumb.hidden = true;
      if (this.ref.inspector) this.ref.inspector.hidden = true;
    }
  }

  /**
   * Lock viewport pan and zoom while keeping graph rendering active.
   * @param {boolean} locked
   */
  setViewportLocked(locked) {
    this._viewportLocked = locked;
    this.toggleAttribute('data-viewport-locked', locked);
  }

  /**
   * Enable/disable compact mode (hides node body: ports & controls).
   * Use this for schematic/PCB views where nodes show only labels.
   * This is a structural setting — independent of visual theme.
   * @param {boolean} enabled
   */
  setCompactMode(enabled) {
    this.toggleAttribute('data-compact', enabled);
  }

  /**
   * Apply a theme to the canvas
   * @param {import('../../themes/Theme.js').ThemeDefinition} theme
   */
  setTheme(theme) {
    applyTheme(this, theme);
    this._themeName = theme.name;
  }

  /**
   * Apply only color palette
   * @param {import('../../themes/Palette.js').PaletteDefinition} palette
   */
  setPalette(palette) {
    applyPalette(this, palette);
  }

  /**
   * Apply only geometry skin
   * @param {import('../../themes/Skin.js').SkinDefinition} skin
   */
  setSkin(skin) {
    applySkin(this, skin);
  }

  /** @returns {string} */
  getThemeName() {
    return this._themeName;
  }

  /**
   * Set data flow animation on a connection
   * @param {string} connId
   * @param {boolean} active
   */
  setFlowing(connId, active) {
    this._connRenderer?.setFlowing(connId, active);
  }

  /**
   * Set data flow animation on all connections
   * @param {boolean} active
   */
  setAllFlowing(active) {
    this._connRenderer?.setAllFlowing(active);
  }

  /**
   * Set connection path style (persists across setEditor/drill-down)
   * @param {'bezier'|'orthogonal'|'straight'|'pcb'} style
   */
  setPathStyle(style) {
    this._pathStyle = style;
    this._connRenderer?.setPathStyle(style);
  }

  /** @returns {'bezier'|'orthogonal'|'straight'|'pcb'} */
  getPathStyle() {
    return this._pathStyle;
  }

  /**
   * Programmatically select a node by ID
   * @param {string} nodeId
   */
  selectNode(nodeId) {
    this._selector?.selectNode(nodeId);
  }

  /**
   * Clear all connector caches and re-render.
   * Call after initial node positioning to settle SVG connectors.
   */
  refreshConnections() {
    this._connRenderer?.refreshAll();
  }

  /**
   * Set error state on a node with frame-style error display
   * @param {string} nodeId
   * @param {string} message - Error message to display
   */
  setNodeError(nodeId, message) {
    let el = this._nodeViews.get(nodeId);
    if (!el) return;


    this.clearNodeError(nodeId);

    el.toggleAttribute('data-error', true);


    let frame = document.createElement('div');
    frame.className = 'error-frame';

    let header = document.createElement('div');
    header.className = 'error-frame-header';
    let icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.textContent = 'error';
    ensureMaterialSymbols(['error']);
    header.append(icon, ' Error');

    let body = document.createElement('div');
    body.className = 'error-frame-body';
    body.textContent = message;

    frame.append(header, body);
    el.append(frame);
  }

  /**
   * Clear error state from a node
   * @param {string} nodeId
   */
  clearNodeError(nodeId) {
    let el = this._nodeViews.get(nodeId);
    if (!el) return;
    el.removeAttribute('data-error');
    let frame = el.querySelector('.error-frame');
    if (frame) frame.remove();
  }

  /**
   * Clear all error states
   */
  clearAllErrors() {
    for (const [id] of this._nodeViews) {
      this.clearNodeError(id);
    }
  }

  /**
   * Apply auto layout to all nodes
   */
  autoLayout() {
    if (!this._editor) return;
    let positions = computeAutoLayout(this._editor);
    for (const [nodeId, pos] of Object.entries(positions)) {
      this.setNodePosition(nodeId, pos.x, pos.y);
    }
  }

  /**
   * Fit all nodes into the viewport.
   * Calculates required zoom/pan based on current node layout,
   * accounting for the inspector panel if open.
   */
  fitView() {
    this._viewport?.fitView();
  }

  /**
   * Focus viewport on a specific node by ID.
   * Deducts inspector panel width from visibility calculation.
   * @param {string} nodeId - Target node ID
   * @param {Object} [opts]
   * @param {number} [opts.zoom=0.8] - Target zoom level
   * @returns {boolean}
   */
  flyToNode(nodeId, opts) {
    return this._viewport?.flyToNode(nodeId, opts) || false;
  }

  /**
   * Measure actual DOM sizes of all rendered nodes.
   * Returns a plain object { [nodeId]: { w, h } } suitable for AutoLayout's nodeSizes option.
   * Call after nodes are rendered to DOM (after setEditor + requestAnimationFrame).
   * @returns {Object<string, { w: number, h: number }>}
   */
  measureNodeSizes() {
    let sizes = {};
    for (const [nodeId, el] of this._nodeViews) {
      if (el && el.offsetWidth > 0) {
        sizes[nodeId] = { w: el.offsetWidth, h: el.offsetHeight };
      }
    }
    return sizes;
  }

  /**
   * Position nodes as a document-like flow and optionally make the canvas scrollable.
   * @param {Object} [options]
   * @param {string[]} [options.nodeIds] Nodes to lay out. Defaults to all editor nodes.
   * @param {'vertical'|'horizontal'} [options.direction='vertical'] Main flow direction.
   * @param {number} [options.gap=32] Main-axis spacing between nodes.
   * @param {number|{top?: number, right?: number, bottom?: number, left?: number}} [options.padding=24]
   * @param {'start'|'center'|'end'|'stretch'} [options.align='start'] Cross-axis alignment.
   * @param {number} [options.minNodeWidth] Minimum node width when sizing flow items.
   * @param {number} [options.maxNodeWidth] Maximum node width when sizing flow items.
   * @param {number} [options.minNodeHeight] Minimum node height when sizing horizontal flow items.
   * @param {number} [options.maxNodeHeight] Maximum node height when sizing horizontal flow items.
   * @param {boolean} [options.scroll=false] Enables native canvas scrolling in the flow direction.
   * @returns {{width: number, height: number, positions: Object<string, {x: number, y: number}>}}
   */
  setFlowLayout(options = {}) {
    let direction = FLOW_DIRECTIONS.has(options.direction) ? options.direction : 'vertical';
    let gap = Math.max(0, toFiniteNumber(options.gap, 32));
    let padding = normalizeFlowPadding(options.padding);
    let align = ['start', 'center', 'end', 'stretch'].includes(options.align) ? options.align : 'start';
    let nodeIds = Array.isArray(options.nodeIds)
      ? options.nodeIds
      : this._editor?.getNodes().map((node) => node.id) || [];
    let scroll = options.scroll === true;
    let viewportWidth = this.clientWidth || this.ref?.canvasContainer?.clientWidth || 0;
    let viewportHeight = this.clientHeight || this.ref?.canvasContainer?.clientHeight || 0;
    let minNodeWidth = toFiniteNumber(options.minNodeWidth, NaN);
    let maxNodeWidth = toFiniteNumber(options.maxNodeWidth, NaN);
    let minNodeHeight = toFiniteNumber(options.minNodeHeight, NaN);
    let maxNodeHeight = toFiniteNumber(options.maxNodeHeight, NaN);
    let positions = {};
    let cursor = direction === 'vertical' ? padding.top : padding.left;
    let contentWidth = viewportWidth;
    let contentHeight = viewportHeight;

    this._flowLayout = {
      ...options,
      align,
      direction,
      gap,
      padding,
      scroll,
    };

    this.setAttribute('data-flow-layout', direction);
    if (scroll) {
      this.setAttribute('data-flow-scroll', direction);
    } else {
      this.removeAttribute('data-flow-scroll');
    }

    this.setBatchMode(true);

    for (let nodeId of nodeIds) {
      let el = this._nodeViews.get(nodeId);
      if (!el) continue;

      if (direction === 'vertical') {
        let availableWidth = Math.max(0, viewportWidth - padding.left - padding.right);
        let targetWidth = align === 'stretch'
          ? clampFlowSize(availableWidth, minNodeWidth, maxNodeWidth)
          : clampFlowSize(el.offsetWidth || availableWidth, minNodeWidth, maxNodeWidth);
        if (Number.isFinite(targetWidth) && targetWidth > 0) {
          el.style.width = `${targetWidth}px`;
          el.style.setProperty('--sn-node-min-width', `${targetWidth}px`);
          el.style.setProperty('--sn-node-max-width', `${targetWidth}px`);
        }

        let width = el.offsetWidth || targetWidth || 0;
        let height = el.offsetHeight || 0;
        let x = padding.left;
        if (align === 'center') {
          x = padding.left + Math.max(0, availableWidth - width) / 2;
        } else if (align === 'end') {
          x = padding.left + Math.max(0, availableWidth - width);
        }
        let y = cursor;
        this.setNodePosition(nodeId, x, y);
        positions[nodeId] = { x, y };
        cursor += height + gap;
        contentWidth = Math.max(contentWidth, x + width + padding.right);
        contentHeight = Math.max(contentHeight, y + height + padding.bottom);
      } else {
        let availableHeight = Math.max(0, viewportHeight - padding.top - padding.bottom);
        let targetHeight = align === 'stretch'
          ? clampFlowSize(availableHeight, minNodeHeight, maxNodeHeight)
          : clampFlowSize(el.offsetHeight || availableHeight, minNodeHeight, maxNodeHeight);
        if (Number.isFinite(targetHeight) && targetHeight > 0) {
          el.style.minHeight = `${targetHeight}px`;
        }

        let width = el.offsetWidth || 0;
        let height = el.offsetHeight || targetHeight || 0;
        let x = cursor;
        let y = padding.top;
        if (align === 'center') {
          y = padding.top + Math.max(0, availableHeight - height) / 2;
        } else if (align === 'end') {
          y = padding.top + Math.max(0, availableHeight - height);
        }
        this.setNodePosition(nodeId, x, y);
        positions[nodeId] = { x, y };
        cursor += width + gap;
        contentWidth = Math.max(contentWidth, x + width + padding.right);
        contentHeight = Math.max(contentHeight, y + height + padding.bottom);
      }
    }

    this.setBatchMode(false);
    this.#setFlowContentSize(contentWidth, contentHeight);
    this.syncPhantom();
    this.refreshConnections();

    return { width: contentWidth, height: contentHeight, positions };
  }

  clearFlowLayout() {
    this._flowLayout = null;
    this.removeAttribute('data-flow-layout');
    this.removeAttribute('data-flow-scroll');
    this.#setFlowContentSize(0, 0);
    for (const [, el] of this._nodeViews) {
      el.style.width = '';
      el.style.minHeight = '';
      el.style.removeProperty('--sn-node-min-width');
      el.style.removeProperty('--sn-node-max-width');
    }
  }

  refreshFlowLayout() {
    if (this._flowLayout) this.setFlowLayout(this._flowLayout);
  }

  #setFlowContentSize(width, height) {
    if (!width || !height) {
      this.style.removeProperty('--sn-flow-content-width');
      this.style.removeProperty('--sn-flow-content-height');
      return;
    }
    this.style.setProperty('--sn-flow-content-width', `${Math.ceil(width)}px`);
    this.style.setProperty('--sn-flow-content-height', `${Math.ceil(height)}px`);
  }

  /**
   * Set preview content on a node (image URL or text)
   * @param {string} nodeId
   * @param {string} content - Image URL or text
   * @param {'image'|'text'} [type='text']
   */
  setPreview(nodeId, content, type = 'text') {
    let el = this._nodeViews.get(nodeId);
    if (!el) return;
    let preview = el.ref?.previewArea;
    if (!preview) return;

    preview.hidden = false;
    preview.replaceChildren();
    if (type === 'image') {
      let img = document.createElement('img');
      img.src = content;
      img.alt = 'Preview';
      preview.appendChild(img);
    } else {
      let div = document.createElement('div');
      div.className = 'sn-preview-text';
      div.textContent = content;
      preview.appendChild(div);
    }
  }

  /**
   * Clear preview from a node
   * @param {string} nodeId
   */
  clearPreview(nodeId) {
    let el = this._nodeViews.get(nodeId);
    if (!el) return;
    let preview = el.ref?.previewArea;
    if (!preview) return;
    preview.hidden = true;
    preview.replaceChildren();
  }

  /**
   * Get node view element by ID (used by FlowSimulator)
   * @param {string} nodeId
   * @returns {HTMLElement|undefined}
   */
  _getNodeView(nodeId) {
    return this._nodeViews.get(nodeId);
  }

  /**
   * Alias for SubgraphManager
   * @param {string} nodeId
   * @returns {HTMLElement|undefined}
   */
  getNodeView(nodeId) {
    return this._nodeViews.get(nodeId);
  }

  /**
   * Highlight nodes sequentially based on execution trace.
   * Each node pulses green in order, then fades.
   *
   * @param {Array<{nodeId: string}>} trace - Execution trace from Fire/Run
   * @param {number} [stepDelay=300] - Delay between node highlights (ms)
   */
  highlightTrace(trace, stepDelay = 300) {
    if (!trace || !trace.length) return;


    for (const [, el] of this._nodeViews) {
      el.removeAttribute('data-fire-state');
    }


    for (const step of trace) {
      let el = this._nodeViews.get(step.nodeId);
      if (el) {
        el.setAttribute('data-fire-state', 'pending');
      }
    }


    trace.forEach((step, i) => {
      setTimeout(() => {
        let el = this._nodeViews.get(step.nodeId);
        if (!el) return;


        el.setAttribute('data-fire-state', 'active');


        setTimeout(() => {
          el.setAttribute('data-fire-state', 'complete');
        }, 600);
      }, i * stepDelay);
    });


    let totalDuration = trace.length * stepDelay + 3500;
    setTimeout(() => {
      for (const [, el] of this._nodeViews) {
        el.removeAttribute('data-fire-state');
      }
    }, totalDuration);
  }


  /**
   * Drill down into a subgraph node
   * @param {string} nodeId - SubgraphNode ID
   */
  drillDown(nodeId) {
    if (!this._editor) return;
    let node = this._editor.getNode(nodeId);
    if (!node?._isSubgraph) return;
    this._navigating = true;
    this._subgraphManager.drillDown(node);
    this._navigating = false;
    this.dispatchEvent(
      new CustomEvent('subgraph-enter', {
        detail: { node, nodeId },
        bubbles: true,
      })
    );
  }

  /**
   * Navigate up to a breadcrumb level
   * @param {number} level - 0 = root
   */
  drillUp(level) {
    this._navigating = true;
    this._subgraphManager.drillUp(level);
    this._navigating = false;
    this.dispatchEvent(
      new CustomEvent('subgraph-exit', {
        detail: { level },
        bubbles: true,
      })
    );
  }

  /**
   * Get current subgraph depth (0 = root)
   * @returns {number}
   */
  getSubgraphDepth() {
    return this._subgraphManager.depth;
  }

  /**
   * Get subgraph breadcrumb path
   * @returns {Array<{ label: string, level: number }>}
   */
  getSubgraphPath() {
    return this._subgraphManager.getPath();
  }

  /**
   * Enable/disable batch positioning mode.
   * When true, setNodePosition skips connection updates.
   * Call refreshConnections() after batch is done.
   * @param {boolean} active
   */
  setBatchMode(active) {
    this._batchMode = !!active;
    if (!this._batchMode) {
      this._viewport?.updateTransform();
    }
  }

  /**
   * Set node position
   * @param {string} nodeId
   * @param {number} x
   * @param {number} y
   */
  setNodePosition(nodeId, x, y) {
    let el = this._nodeViews.get(nodeId);
    if (!el) {
      this._viewport?.updatePhantomPosition(nodeId, x, y);
      return;
    }
    el.style.transform = `translate(${x}px, ${y}px)`;
    el._position = { x, y };


    if (this._batchMode) return;

    this._connRenderer?.updateForNode(nodeId);

    if (el.hasAttribute('data-svg-shape')) {
      this._connRenderer?.refreshFreeDots(nodeId);
    }


    let toolbar = this.ref.quickToolbar;
    if (toolbar && toolbar._nodeId === nodeId) {
      toolbar.updatePosition(el);
    }
  }

  /**
   * Animate node to position with wires synced via RAF
   * @param {string} nodeId
   * @param {number} targetX
   * @param {number} targetY
   * @param {number} [duration=200] - Animation duration in ms
   */
  animateNodeToPosition(nodeId, targetX, targetY, duration = 200) {
    let el = this._nodeViews.get(nodeId);
    if (!el) return;

    let startX = el._position.x;
    let startY = el._position.y;
    let dx = targetX - startX;
    let dy = targetY - startY;


    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

    let startTime = performance.now();

    let animate = (now) => {
      let t = Math.min((now - startTime) / duration, 1);

      let ease = 1 - (1 - t) ** 3;
      let x = startX + dx * ease;
      let y = startY + dy * ease;

      el.style.transform = `translate(${x}px, ${y}px)`;
      el._position = { x, y };
      this._connRenderer?.updateForNode(nodeId);
      this._connRenderer?.refreshFreeDots(nodeId);

      let toolbar = this.ref.quickToolbar;
      if (toolbar && toolbar._nodeId === nodeId) {
        toolbar.updatePosition(el);
      }

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {

        el._position = { x: targetX, y: targetY };
        el.style.transform = `translate(${targetX}px, ${targetY}px)`;
        this._connRenderer?.updateForNode(nodeId);
        this._connRenderer?.refreshFreeDots(nodeId);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Get all node positions — includes both DOM nodes and phantom (virtualized) nodes.
   * SubgraphRouter relies on this to decide whether a node is on the current canvas layer;
   * phantom nodes DO have layout positions but no DOM element, so they must be included here.
   * @returns {Object<string, number[]>}
   */
  getPositions() {
    return this._viewport?.getPositions() || {};
  }

  /**
   * Check whether a node exists on the current canvas layer (DOM or phantom).
   * SubgraphRouter uses this to avoid spurious drillDown when layout is still in progress.
   * @param {string} nodeId
   * @returns {boolean}
   */
  hasNode(nodeId) {
    return this._viewport?.hasNode(nodeId) || false;
  }


  /**
   * Add a frame to the canvas
   * @param {import('../../core/Frame.js').Frame} frame
   */
  addFrame(frame) {
    this._editor?.addFrame(frame);
  }

  /**
   * Set frame position
   * @param {string} frameId
   * @param {number} x
   * @param {number} y
   */
  setFramePosition(frameId, x, y) {
    this._frameManager?.setPosition(frameId, x, y);
  }

  /**
   * Set frame size
   * @param {string} frameId
   * @param {number} w
   * @param {number} h
   */
  setFrameSize(frameId, w, h) {
    this._frameManager?.setSize(frameId, w, h);
  }


  _handleNodeClick(nodeId, e) {
    let accumulate = e.ctrlKey || e.metaKey;
    this._selector.selectNode(nodeId, accumulate);


    let now = Date.now();
    if (this._lastClickNodeId === nodeId && now - this._lastClickTime < 400) {
      this.drillDown(nodeId);
      this._lastClickTime = 0;
      this._lastClickNodeId = null;
    } else {
      this._lastClickTime = now;
      this._lastClickNodeId = nodeId;
    }
  }

  _handleNodePointerEnter(nodeId, nodeEl) {
    if (this._nodeDragActive) return;
    let toolbar = this.ref.quickToolbar;
    if (!toolbar) return;
    toolbar.show(nodeId, nodeEl, { sticky: false });
  }

  _handleNodePointerLeave(nodeId) {
    let toolbar = this.ref.quickToolbar;
    if (!toolbar) return;
    toolbar.scheduleHide?.(undefined, nodeId);
  }

  _handleNodeDragStart(nodeId) {
    this._nodeDragActive = true;
    this.setAttribute('data-node-dragging', nodeId);
    this.ref.quickToolbar?.hide?.();
  }

  _handleNodeDragEnd(nodeId, nodeEl, event) {
    this._nodeDragActive = false;
    this.removeAttribute('data-node-dragging');

    if (!nodeEl?.isConnected || !this._selector.isNodeSelected(nodeId)) return;

    let restoreToolbar = () => {
      if (this._nodeDragActive || !nodeEl.isConnected || !this._selector.isNodeSelected(nodeId)) return;
      this.ref.quickToolbar?.show?.(nodeId, nodeEl, { sticky: true });
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(restoreToolbar);
    } else {
      restoreToolbar();
    }
  }

  _handleConnectionClick(connId, e) {
    let accumulate = e.ctrlKey || e.metaKey;
    this._selector.selectConnection(connId, accumulate);
  }


  _updateTransform() {
    this._viewport?.updateTransform();
  }

  /** Public: force sync phantom data to renderer (for use after batch setNodePosition) */
  syncPhantom() {
    this._viewport?.syncPhantom();
  }


  renderCallback() {
    ensureMaterialSymbols(['map']);

    let container = this.ref.canvasContainer;
    let content = this.ref.content;


    this._drag = new Drag();
    this._drag.initialize(
      container,
      {
        getPosition: () => this._flowLayout
          ? ({ x: -container.scrollLeft, y: -container.scrollTop })
          : ({ x: this.$.panX, y: this.$.panY }),
        getZoom: () => 1,
      },
      {
        shouldStart: () => !this._viewportLocked,
        onStart: (e) => {

          this._panStart = e ? { x: e.pageX, y: e.pageY, target: e.target } : null;
        },
        onTranslate: (x, y) => {
          if (this._viewportLocked) return;
          if (this._zoom?.isTranslating()) return;
          if (this._connectFlow?.isPicking()) return;
          this.$.panX = x;
          this.$.panY = y;
          this._updateTransform();
          this.dispatchEvent(new CustomEvent('manualviewport'));


          this.toggleAttribute('data-interacting', true);
        },
        onDrop: (e) => {

          if (this._panStart && e) {
            let dx = Math.abs(e.pageX - this._panStart.x);
            let dy = Math.abs(e.pageY - this._panStart.y);
            let t = this._panStart.target;
            let isNode = t?.closest?.('graph-node, quick-toolbar, context-menu, inspector-panel');
            if (dx < 5 && dy < 5 && !isNode) {
              this._selector.unselectAll();
            }
          }
          this._panStart = null;
          this.removeAttribute('data-interacting');
        },
      }
    );


    this._zoom = new Zoom(0.1);
    let interactingTimer = null;
    this._zoom.initialize(
      container,
      content,
      (delta, ox, oy) => {
        if (this._viewportLocked) return;
        let k = this.$.zoom;
        let newK = k * (1 + delta);
        if (newK < 0.001 || newK > 5) return;
        this.$.zoom = newK;
        this.$.panX += ox;
        this.$.panY += oy;
        this._updateTransform();
        this.dispatchEvent(new CustomEvent('manualviewport'));


        this.toggleAttribute('data-interacting', true);
        clearTimeout(interactingTimer);
        interactingTimer = setTimeout(() => {
          this.removeAttribute('data-interacting');
        }, 150);
      },
      () => ({ x: this.$.panX, y: this.$.panY }),
      {
        shouldHandleWheel: (event) => {
          if (!this.hasAttribute('data-flow-scroll')) return true;
          return event.ctrlKey || event.metaKey || event.altKey;
        },
      }
    );


    container.addEventListener('contextmenu', (e) => {
      if (!this.$.chrome) return;
      this._actions?.showContextMenu(e, this.ref.contextMenu, container, {
        panX: this.$.panX,
        panY: this.$.panY,
        zoom: this.$.zoom,
      });
    });
    container.addEventListener('keydown', (e) => this._actions?.handleKeydown(e));


    container.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        this.ref.nodeSearch?.toggle();
      }
    });


    this.sub('+contentTransform', (val) => {
      if (this.ref.content) {
        this.ref.content.style.transform = val;
      }
      this._connRenderer?.refreshViewportTransform?.();
    });

    this._updateTransform();


    let minimap = this.ref.minimap;
    let minimapToggle = this.ref.minimapToggle;
    const MINIMAP_KEY = 'sn-minimap-enabled';
    let minimapEnabled = localStorage.getItem(MINIMAP_KEY) === 'true';
    let fadeTimer = null;
    const FADE_DELAY = 2000;

    let showMinimap = () => {
      if (!minimapEnabled || !minimap) return;
      minimap.hidden = false;
      minimap.removeAttribute('data-fading');
      minimap.update?.();
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => {
        minimap.toggleAttribute('data-fading', true);

        setTimeout(() => {
          if (minimap.hasAttribute('data-fading')) {
            minimap.hidden = true;
            minimap.removeAttribute('data-fading');
          }
        }, 400);
      }, FADE_DELAY);
    };

    let updateToggleState = () => {
      if (minimapToggle) {
        minimapToggle.toggleAttribute('data-active', minimapEnabled);
      }
      if (!minimapEnabled && minimap) {
        minimap.hidden = true;
        minimap.removeAttribute('data-fading');
        clearTimeout(fadeTimer);
      }
    };

    updateToggleState();

    if (minimapToggle) {
      minimapToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        minimapEnabled = !minimapEnabled;
        localStorage.setItem(MINIMAP_KEY, minimapEnabled);
        updateToggleState();
        if (minimapEnabled) showMinimap();
      });
    }


    if (minimap) {
      minimap.setStateGetter(() => {
        let nodes = [];
        for (const [, el] of this._nodeViews) {
          let pos = el._position || { x: 0, y: 0 };
          if (!el._cachedW) {
            el._cachedW = el.offsetWidth || 180;
            el._cachedH = el.offsetHeight || 60;
          }
          nodes.push({
            x: pos.x,
            y: pos.y,
            width: el._cachedW,
            height: el._cachedH,
            bypassed: el.hasAttribute('data-bypassed'),
          });
        }
        return {
          nodes,
          transform: { x: this.$.panX, y: this.$.panY, zoom: this.$.zoom },
          containerSize: {
            width: container.clientWidth,
            height: container.clientHeight,
          },
        };
      });


      minimap.addEventListener('minimap-navigate', (e) => {
        this.$.panX = e.detail.x;
        this.$.panY = e.detail.y;
        this._updateTransform();
      });
    }


    let nodeSearch = this.ref.nodeSearch;
    if (nodeSearch) {
      nodeSearch.configure({
        getNodes: () => {
          let result = [];
          if (this._editor) {
            for (const node of this._editor.getNodes()) {
              result.push({
                id: node.id,
                label: node.label,
                type: node.type,
                category: node.category,
              });
            }
          }
          return result;
        },
        onSelect: (nodeId) => {

          this._selector.selectNode(nodeId);

          let el = this._nodeViews.get(nodeId);
          if (el?._position) {
            let cx = container.clientWidth / 2;
            let cy = container.clientHeight / 2;
            this.$.panX = -el._position.x * this.$.zoom + cx;
            this.$.panY = -el._position.y * this.$.zoom + cy;
            this._updateTransform();
          }
        },
      });
    }
  }

  /**
   * Smoothly pan viewport to center on a node
   * @param {string} nodeId
   * @param {number} [duration=400] - Animation duration in ms
   */
  panToNode(nodeId, duration = 400) {
    this._viewport?.panToNode(nodeId, duration);
  }

  destroyCallback() {
    if (this._viewport) this._viewport.clear();
    if (this._drag) this._drag.destroy();
    if (this._zoom) this._zoom.destroy();
    if (this._connectFlow) this._connectFlow.destroy();
    for (const [, el] of this._nodeViews) {
      if (el._drag) el._drag.destroy();
    }
  }
}

NodeCanvas.template = template;
NodeCanvas.rootStyles = styles;
NodeCanvas.reg('node-canvas');
