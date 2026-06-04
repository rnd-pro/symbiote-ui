/**
 * @fileoverview Layout - Root container for Blender-style panel layout
 * Uses LayoutNode for recursive BSP tree rendering.
 * Handles action zone events for split/join operations.
 */

import Symbiote from '@symbiotejs/symbiote';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import * as LayoutTree from './../LayoutTree.js';
import { template } from './Layout.tpl.js';
import { styles } from './Layout.css.js';
import './../LayoutNode/LayoutNode.js';
import './../LayoutPreview/LayoutPreview.js';
import './../PanelMenu/PanelMenu.js';

export class Layout extends Symbiote {
  static isoMode = true;

  init$ = {

    '@storage-key': '',
    '@min-panel-size': 50,
    '@min-panel-inline-size': 220,
    '@min-panel-block-size': 160,
    '@responsive-mode': 'preserve',
    '@responsive-breakpoint': 720,
    '@overflow-mode': 'collapse',
    '@auto-collapse': true,
    '@action-zones': false,


    layoutTree: null,
    layoutBehavior: null,


    panelTypes: {},

    panelChrome: true,
    layoutActionZones: false,

    activeGesture: null,


    fullscreenPanelId: null,


    hasFullscreenTabs: false,
    tabItems: [],


    onTabClick: (e) => {
      let panelId = e.target.closest('[data-panel-id]')?.dataset.panelId;
      if (panelId && panelId !== this.$.fullscreenPanelId) {
        this._switchFullscreenPanel(panelId);
      }
    },


    onLayoutChange: () => this._saveLayout(),
  };

  /**
   * Register panel type
   * @param {string} name - Panel type name
   * @param {Object} config - Panel configuration
   * @param {string} [config.title] - Default title
   * @param {string} [config.icon] - Material Symbols icon name
   * @param {string} [config.component] - Custom element tag name
   * @param {Array} [config.menuActions] - Fold-down header menu action descriptors
   * @param {import('./../LayoutTree.js').LayoutBehavior} [config.behavior] - Default behavior for panels of this type
   */
  registerPanelType(name, config) {
    ensureMaterialSymbols([config.icon || 'dashboard']);
    this.$.panelTypes = {
      ...this.$.panelTypes,
      [name]: config,
    };
  }

  initCallback() {
    ensureMaterialSymbols(['dashboard']);
    this._loadLayout();


    this.addEventListener('layout-change', () => this._saveLayout());


    this.addEventListener('action-zone-start', (e) => this._onActionZoneStart(e));
    this.addEventListener('action-zone-gesture', (e) => this._onActionZoneGesture(e));
    this.addEventListener('action-zone-execute', (e) => this._onActionZoneExecute(e));
    this.addEventListener('action-zone-end', (e) => this._onActionZoneEnd(e));


    this.addEventListener('panel-type-menu', (e) => this._onPanelTypeMenu(e));
    this.addEventListener('panel-type-select', (e) => this._onPanelTypeSelect(e));
    this.addEventListener('panel-fullscreen', (e) => this._onPanelFullscreen(e));
    this.addEventListener('panel-collapse-toggle', (e) => this._onPanelCollapseToggle(e));
    this.addEventListener('panel-menu-action', (e) => this._onPanelMenuAction(e));
    this.addEventListener('panel-close', (e) => this._onPanelClose(e));


    this._resizeFallback = () => this._scheduleResponsiveLayout();
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this._scheduleResponsiveLayout());
      this._resizeObserver.observe(this);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', this._resizeFallback);
    }


    this._globalPointerFallback = () => {
      if (this.$.activeGesture) {
        this.$.activeGesture = null;
        if (this.ref.preview) {
          this.ref.preview.hide();
        }
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerup', this._globalPointerFallback);
      document.addEventListener('pointercancel', this._globalPointerFallback);
    }
  }

  disconnectedCallback() {
    if (this._globalPointerFallback && typeof document !== 'undefined') {
      document.removeEventListener('pointerup', this._globalPointerFallback);
      document.removeEventListener('pointercancel', this._globalPointerFallback);
    }
    this._resizeObserver?.disconnect();
    if (this._resizeFallback && typeof window !== 'undefined') {
      window.removeEventListener('resize', this._resizeFallback);
    }
    if (this._responsiveFrame && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this._responsiveFrame);
      this._responsiveFrame = 0;
    }
    super.disconnectedCallback?.();
  }

  renderCallback() {
    this._renderRoot();
    this._scheduleResponsiveLayout();
    this.sub('layoutTree', () => {
      this._renderRoot();
      this._scheduleResponsiveLayout();

      if (this.$.fullscreenPanelId) {

        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => {
            let allPanels = this.querySelectorAll('layout-node[node-type="panel"]');

            let panelExists = Array.from(allPanels).some(
              (p) => p.$.nodeId === this.$.fullscreenPanelId
            );
            if (panelExists) {
              this._updateTabItems(allPanels, this.$.fullscreenPanelId);
            } else {

              this.$.fullscreenPanelId = null;
              this.$.hasFullscreenTabs = false;
              this.$.tabItems = [];
              allPanels.forEach((p) => {
                p.removeAttribute('fullscreen');
                p.$.isFullscreen = false;
                this.#setPanelVisible(p, true);
              });
            }
          });
        }
      }
    });
  }

  _loadLayout() {
    let storageKey = this.$['@storage-key'];


    if (storageKey && typeof localStorage !== 'undefined') {
      let stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          this.$.layoutTree = LayoutTree.deserialize(stored);
          return;
        } catch (e) {
          void e;
        }
      }
    }


    let layoutAttr = this.getAttribute('layout');
    if (layoutAttr) {
      try {
        this.$.layoutTree = JSON.parse(layoutAttr);
        return;
      } catch (e) {
        void e;
      }
    }


    this.$.layoutTree = LayoutTree.createPanel('default');
  }

  _saveLayout() {
    let storageKey = this.$['@storage-key'];
    if (storageKey && this.$.layoutTree && typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, LayoutTree.serialize(this.$.layoutTree));
    }
  }

  _getAttributeBehavior() {
    let autoCollapseAttr = this.getAttribute('auto-collapse');
    let autoCollapse = autoCollapseAttr === null
      ? this.$['@auto-collapse'] !== false
      : autoCollapseAttr !== 'false' && autoCollapseAttr !== 'never';
    return LayoutTree.normalizeLayoutBehavior({
      minInlineSize: this.getAttribute('min-panel-inline-size') || this.$['@min-panel-inline-size'],
      minBlockSize: this.getAttribute('min-panel-block-size') || this.$['@min-panel-block-size'],
      collapse: autoCollapse ? 'auto' : 'never',
      overflow: this.getAttribute('overflow-mode') || this.$['@overflow-mode'],
      responsiveMode: this.getAttribute('responsive-mode') || this.$['@responsive-mode'],
      responsiveBreakpoint: this.getAttribute('responsive-breakpoint') || this.$['@responsive-breakpoint'],
    });
  }

  _getRootBehavior() {
    return LayoutTree.normalizeLayoutBehavior(this.$.layoutBehavior || {}, this._getAttributeBehavior());
  }

  _renderRoot() {
    if (!this.$.layoutTree || !this.ref.root) return;


    let rootNode = this.ref.root.querySelector('layout-node');
    if (!rootNode) {
      rootNode = document.createElement('layout-node');
      this.ref.root.appendChild(rootNode);
    }


    let chromeEnabled = this.$.panelChrome !== false;
    let actionZonesEnabled = this._getActionZonesEnabled();
    rootNode.$.panelChrome = chromeEnabled;
    rootNode.$.layoutActionZones = actionZonesEnabled;
    rootNode.setAttribute('panel-chrome', chromeEnabled ? 'default' : 'none');
    rootNode.setAttribute('action-zones', actionZonesEnabled ? 'enabled' : 'disabled');
    rootNode.$.nodeData = this.$.layoutTree;
  }

  _getActionZonesEnabled() {
    let attr = this.getAttribute('action-zones');
    if (attr !== null) return attr === 'true' || attr === 'enabled';
    return this.$['@action-zones'] === true || this.$.layoutActionZones === true;
  }

  _scheduleResponsiveLayout() {
    if (typeof requestAnimationFrame === 'undefined') {
      this._applyResponsiveLayout();
      return;
    }
    if (this._responsiveFrame) return;
    this._responsiveFrame = requestAnimationFrame(() => {
      this._responsiveFrame = 0;
      this._applyResponsiveLayout();
    });
  }

  _applyResponsiveLayout() {
    if (!this.$.layoutTree || !this.isConnected) return;
    let behavior = this._getRootBehavior();
    let rect = this.getBoundingClientRect();
    let responsiveActive =
      behavior.responsiveMode !== 'preserve' &&
      rect.width > 0 &&
      rect.width <= behavior.responsiveBreakpoint;

    this.setAttribute('responsive-mode', behavior.responsiveMode);
    this.setAttribute('overflow-mode', behavior.overflow);
    this.toggleAttribute('responsive-active', responsiveActive);

    if (this.$.fullscreenPanelId) return;

    let tree = this.$.layoutTree;
    let collapseAllowed =
      behavior.collapse === 'auto' &&
      behavior.overflow === 'collapse' &&
      !responsiveActive;

    if (!collapseAllowed) {
      if (this._clearAutoCollapsedPanels(tree)) {
        this.$.layoutTree = { ...tree };
        this._saveLayout();
      }
      return;
    }

    let changed = this._restoreAutoCollapsedPanels(tree);
    let candidates = this._collectAutoCollapseCandidates(tree, behavior)
      .sort((a, b) => a.behavior.importance - b.behavior.importance);

    for (let candidate of candidates) {
      let node = LayoutTree.findNode(tree, candidate.node.id);
      if (!node || node.collapsed || !this._canAutoCollapseNode(tree, node, candidate.behavior)) continue;
      node.collapsed = true;
      node.autoCollapsed = true;
      changed = true;
    }

    if (changed) {
      this.$.layoutTree = { ...tree };
      this._saveLayout();
    }
  }

  _collectAutoCollapseCandidates(tree, fallbackBehavior) {
    let candidates = [];
    let walk = (node, fallback) => {
      if (!node) return;
      let branchBehavior = LayoutTree.getNodeBehavior(node, fallback);
      if (node.type === 'panel') {
        let typeBehavior = this.$.panelTypes[node.panelType]?.behavior || {};
        let behavior = LayoutTree.getNodeBehavior(node, LayoutTree.normalizeLayoutBehavior(typeBehavior, branchBehavior));
        let panelNode = this._findPanelNode(node.id);
        if (!panelNode || node.collapsed) return;
        let rect = panelNode.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        if (rect.width < behavior.minInlineSize || rect.height < behavior.minBlockSize) {
          candidates.push({ node, behavior, rect });
        }
        return;
      }
      walk(node.first, branchBehavior);
      walk(node.second, branchBehavior);
    };
    walk(tree, fallbackBehavior);
    return candidates;
  }

  _restoreAutoCollapsedPanels(tree) {
    let changed = false;
    let walk = (node, fallback) => {
      if (!node) return;
      let branchBehavior = LayoutTree.getNodeBehavior(node, fallback);
      if (node.type === 'panel') {
        let typeBehavior = this.$.panelTypes[node.panelType]?.behavior || {};
        let behavior = LayoutTree.getNodeBehavior(node, LayoutTree.normalizeLayoutBehavior(typeBehavior, branchBehavior));
        if (
          node.collapsed &&
          node.autoCollapsed &&
          this._hasExpandedSpace(tree, node, behavior) &&
          this._canRestoreAutoCollapsedPanel(tree, node)
        ) {
          node.collapsed = false;
          node.autoCollapsed = false;
          changed = true;
        }
        return;
      }
      walk(node.first, branchBehavior);
      walk(node.second, branchBehavior);
    };
    walk(tree, this._getRootBehavior());
    return changed;
  }

  _clearAutoCollapsedPanels(tree) {
    let changed = false;
    let walk = (node) => {
      if (!node) return;
      if (node.type === 'panel') {
        if (node.autoCollapsed) {
          node.collapsed = false;
          node.autoCollapsed = false;
          changed = true;
        }
        return;
      }
      walk(node.first);
      walk(node.second);
    };
    walk(tree);
    return changed;
  }

  _canAutoCollapseNode(tree, node, behavior) {
    if (behavior.collapse !== 'auto') return false;
    let parentInfo = LayoutTree.findParent(tree, node.id);
    if (!parentInfo) return false;
    let sibling = parentInfo.which === 'first' ? parentInfo.parent.second : parentInfo.parent.first;
    return !sibling?.collapsed;
  }

  _hasExpandedSpace(tree, node, behavior) {
    let parentInfo = LayoutTree.findParent(tree, node.id);
    let rect = this.getBoundingClientRect();
    let inlineSize = rect.width;
    let blockSize = rect.height;

    if (parentInfo) {
      let parentNode = this._findLayoutNode(parentInfo.parent.id);
      let parentRect = parentNode?.getBoundingClientRect();
      if (parentRect?.width > 0 && parentRect?.height > 0) {
        let ratio = parentInfo.parent.ratio || 0.5;
        let share = parentInfo.which === 'first' ? ratio : 1 - ratio;
        if (parentInfo.parent.direction === 'horizontal') {
          inlineSize = parentRect.width * share;
          blockSize = parentRect.height;
        } else {
          inlineSize = parentRect.width;
          blockSize = parentRect.height * share;
        }
      }
    }

    return inlineSize >= behavior.minInlineSize * 1.08 && blockSize >= behavior.minBlockSize * 1.08;
  }

  _canRestoreAutoCollapsedPanel(tree, targetNode) {
    let rect = this.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    return LayoutTree.branchFitsExpandedState(
      tree,
      rect.width,
      rect.height,
      {
        fallbackBehavior: this._getRootBehavior(),
        restoringNodeId: targetNode.id,
        resolvePanelBehavior: (node, branchBehavior) => {
          let typeBehavior = this.$.panelTypes[node.panelType]?.behavior || {};
          return LayoutTree.getNodeBehavior(node, LayoutTree.normalizeLayoutBehavior(typeBehavior, branchBehavior));
        },
      }
    );
  }


  /**
   * Called when action zone drag starts
   * @param {CustomEvent} e
   */
  _onActionZoneStart(e) {
    if (this.$.panelChrome === false) return;
    let { panelId, corner } = e.detail;
    this.$.activeGesture = { panelId, corner };
  }

  /**
   * Called during action zone drag with gesture type
   * @param {CustomEvent} e
   */
  _onActionZoneGesture(e) {
    if (this.$.panelChrome === false) return;
    let { panelId, gesture, dx, dy } = e.detail;


    let panelNode = this._findPanelNode(panelId);
    if (!panelNode) return;

    let panelRect = panelNode.getBoundingClientRect();


    let preview = this.ref.preview;
    if (!preview) return;

    if (gesture === 'split-h' || gesture === 'split-v') {
      preview.showSplit(gesture, panelRect, 0.5);
    } else if (gesture === 'join') {

      let neighborInfo = this._findJoinTarget(panelId, dx, dy);
      if (neighborInfo) {
        let neighborNode = this._findPanelNode(neighborInfo.id);
        if (neighborNode) {
          preview.showJoin(neighborNode.getBoundingClientRect());
        }
      }
    }
  }

  /**
   * Called when action zone gesture is completed
   * @param {CustomEvent} e
   */
  _onActionZoneExecute(e) {
    if (this.$.panelChrome === false) return;
    let { panelId, corner: _corner, gesture } = e.detail;

    if (gesture === 'split-h') {
      this.splitPanel(panelId, 'horizontal', 0.5);
    } else if (gesture === 'split-v') {
      this.splitPanel(panelId, 'vertical', 0.5);
    } else if (gesture === 'join') {

      this.joinPanels(panelId);
    }
  }

   /**
   * Called when action zone drag ends
   * @param {CustomEvent} _e
   */
  _onActionZoneEnd(_e) {
    this.$.activeGesture = null;


    let preview = this.ref.preview;
    if (preview) {
      preview.hide();
    }
  }

  /**
   * Show panel type selection menu
   * @param {CustomEvent} e
   */
  _onPanelTypeMenu(e) {
    if (this.$.panelChrome === false) return;
    let { panelId, currentType, x, y } = e.detail;
    let menu = this.ref.menu;
    if (!menu) return;


    let items = Object.entries(this.$.panelTypes).map(([type, config]) => ({
      type,
      title: config.title || type,
      icon: config.icon || 'dashboard',
    }));

    menu.show(x, y, panelId, currentType, items);
  }

  /**
   * Handle panel type change
   * @param {CustomEvent} e
   */
  _onPanelTypeSelect(e) {
    if (this.$.panelChrome === false) return;
    let { panelId, type } = e.detail;


    let tree = this.$.layoutTree;
    if (!tree) return;

    let updateNode = (node) => {
      if (!node) return;
      if (node.id === panelId) {
        node.panelType = type;
        return;
      }
      if (node.first) updateNode(node.first);
      if (node.second) updateNode(node.second);
    };

    updateNode(tree);
    this.$.layoutTree = { ...tree };
    this._saveLayout();
  }

  /**
   * Toggle panel collapse state
   * @param {CustomEvent} e
   */
  _onPanelCollapseToggle(e) {
    if (this.$.panelChrome === false) return;
    let { panelId, collapsed } = e.detail;
    let tree = this.$.layoutTree;
    if (!tree) return;


    LayoutTree.updateNode(tree, panelId, { collapsed, autoCollapsed: false });


    this.$.layoutTree = { ...tree };
    this._renderRoot();
    this._saveLayout();


    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        let panelNode = this._findPanelNode(panelId);
        if (panelNode) {

          let container = panelNode.parentElement;
          if (
            container?.classList.contains('split-first') ||
            container?.classList.contains('split-second')
          ) {
            let siblingContainer = container.classList.contains('split-first')
              ? container.parentElement?.querySelector('.split-second')
              : container.parentElement?.querySelector('.split-first');


            if (siblingContainer) {
              let siblingPanel = siblingContainer.querySelector('layout-node[node-type="panel"]');
              if (siblingPanel?._updatePanelInfo) {
                siblingPanel._updatePanelInfo();
              }
            }


            if (panelNode._updatePanelInfo) {
              panelNode._updatePanelInfo();
            }
          }
        }
      });
    }
  }

  _onPanelMenuAction(e) {
    if (this.$.panelChrome === false) return;
    let { panelId, actionId } = e.detail || {};
    if (!panelId || !String(actionId || '').startsWith('layout:')) return;

    e.stopPropagation();

    if (actionId === 'layout:split-horizontal') {
      this.splitPanel(panelId, 'horizontal', 0.5);
    } else if (actionId === 'layout:split-vertical') {
      this.splitPanel(panelId, 'vertical', 0.5);
    } else if (actionId === 'layout:duplicate') {
      this.duplicatePanel(panelId, 'horizontal', 0.5);
    } else if (actionId === 'layout:remove') {
      this.joinPanels(panelId);
    }
  }

  _onPanelClose(e) {
    if (this.$.panelChrome === false) return;
    let panelId = e.detail?.panelId;
    if (!panelId) return;
    e.stopPropagation();
    this.joinPanels(panelId);
  }

  /**
   * Toggle panel fullscreen
   * @param {CustomEvent} e
   */
  _onPanelFullscreen(e) {
    if (this.$.panelChrome === false) return;
    let { panelId } = e.detail;
    let panelNode = this._findPanelNode(panelId);
    if (!panelNode) return;

    let allPanels = this.querySelectorAll('layout-node[node-type="panel"]');

    if (this.$.fullscreenPanelId === panelId) {

      this.$.fullscreenPanelId = null;
      this.$.hasFullscreenTabs = false;
      this.$.tabItems = [];

      panelNode.removeAttribute('fullscreen');
      panelNode.$.isFullscreen = false;
      panelNode.$.fullscreenIcon = 'fullscreen';


      allPanels.forEach((p) => {
        p.removeAttribute('fullscreen');
        p.$.isFullscreen = false;
        p.$.fullscreenIcon = 'fullscreen';
        this.#setPanelVisible(p, true);
      });


      this._renderRoot();
      this.dispatchEvent(new CustomEvent('layout-change', { bubbles: true }));
    } else {

      this.$.fullscreenPanelId = panelId;


      allPanels.forEach((p) => {
        if (p === panelNode) {
          p.toggleAttribute('fullscreen', true);
          p.$.isFullscreen = true;
          p.$.fullscreenIcon = 'fullscreen_exit';
          this.#setPanelVisible(p, true);
        } else {
          this.#setPanelVisible(p, false);
        }
      });


      this._updateTabItems(allPanels, panelId);
      this.$.hasFullscreenTabs = true;
    }
  }

  /**
   * Update tabItems array for Itemize-based tab bar
   * @param {NodeListOf<Element>} [allPanels] - Optional, will query DOM if not provided
   * @param {string} [activePanelId] - Optional, defaults to fullscreenPanelId
   * @returns {void}
   */
  _updateTabItems(allPanels, activePanelId) {
    let panels = allPanels || this.querySelectorAll('layout-node[node-type="panel"]');
    let activeId = activePanelId || this.$.fullscreenPanelId;

    this.$.tabItems = Array.from(panels).map((p) => {
      let nodeData = p.$.nodeData;
      let panelType = nodeData?.panelType || 'panel';
      let typeConfig = this.$.panelTypes[panelType] || {};

      return {
        panelId: p.$.nodeId,
        icon: typeConfig.icon || 'dashboard',
        title: typeConfig.title || panelType,
        isActive: p.$.nodeId === activeId,
      };
    });
  }

  /**
   * Switch fullscreen to another panel
   * @param {string} panelId - Panel ID to switch to
   */
  _switchFullscreenPanel(panelId) {
    let allPanels = this.querySelectorAll('layout-node[node-type="panel"]');
    let newPanel = this._findPanelNode(panelId);
    if (!newPanel) return;


    allPanels.forEach((p) => {
      if (p.$.nodeId === panelId) {
        p.toggleAttribute('fullscreen', true);
        p.$.isFullscreen = true;
        p.$.fullscreenIcon = 'fullscreen_exit';
        this.#setPanelVisible(p, true);
      } else {
        p.removeAttribute('fullscreen');
        p.$.isFullscreen = false;
        p.$.fullscreenIcon = 'fullscreen';
        this.#setPanelVisible(p, false);
      }
    });

    this.$.fullscreenPanelId = panelId;


    this._updateTabItems(allPanels, panelId);
  }

  /**
   * Find a panel node by ID
   * @param {string} panelId
   * @returns {HTMLElement|null}
   */
  _findPanelNode(panelId) {
    let nodes = this.querySelectorAll('layout-node[node-type="panel"]');
    for (const node of nodes) {
      if (node.$.nodeId === panelId) {
        return node;
      }
    }
    return null;
  }

  _findLayoutNode(nodeId) {
    let nodes = this.querySelectorAll('layout-node');
    for (const node of nodes) {
      if (node.$.nodeId === nodeId) {
        return node;
      }
    }
    return null;
  }

  /**
   * Find the neighbor panel for join operation
   * @param {string} panelId
   * @param {number} _dx
   * @param {number} _dy
   * @returns {{id: string, direction: string}|null}
   */
  _findJoinTarget(panelId, _dx, _dy) {

    let parentInfo = LayoutTree.findParent(this.$.layoutTree, panelId);
    if (!parentInfo) return null;

    let { parent, which } = parentInfo;


    let sibling = which === 'first' ? parent.second : parent.first;
    if (!sibling) return null;


    let siblingId = this._getFirstPanelId(sibling);

    return { id: siblingId, direction: parent.direction };
  }

  /**
   * Get the first panel ID from a node (handles nested splits)
   * @param {Object} node
   * @returns {string}
   */
  _getFirstPanelId(node) {
    if (node.type === 'panel') return node.id;

    return this._getFirstPanelId(node.first);
  }


  /**
   * Split a panel
   * @param {string} panelId - Panel ID to split
   * @param {'horizontal' | 'vertical'} direction - Split direction
   * @param {number} [ratio=0.5] - Split ratio
   * @param {string} [newPanelType] - Type for new panel
   */
  splitPanel(panelId, direction, ratio = 0.5, newPanelType) {
    let newTree = LayoutTree.splitPanel(
      LayoutTree.clone(this.$.layoutTree),
      panelId,
      direction,
      ratio,
      newPanelType
    );

    if (newTree) {
      this.$.layoutTree = newTree;
      this._saveLayout();
    }
  }

  /**
   * Join panels (remove one)
   * @param {string} panelToRemove - Panel ID to remove
   */
  joinPanels(panelToRemove) {
    let newTree = LayoutTree.joinPanels(LayoutTree.clone(this.$.layoutTree), panelToRemove);

    if (newTree) {
      this.$.layoutTree = newTree;
      this._saveLayout();
    }
  }

  /**
   * Duplicate a panel.
   * @param {string} panelId - Panel ID to duplicate
   * @param {'horizontal' | 'vertical'} [direction='horizontal'] - Split direction
   * @param {number} [ratio=0.5] - Split ratio
   */
  duplicatePanel(panelId, direction = 'horizontal', ratio = 0.5) {
    let newTree = LayoutTree.duplicatePanel(
      LayoutTree.clone(this.$.layoutTree),
      panelId,
      direction,
      ratio
    );

    if (newTree) {
      this.$.layoutTree = newTree;
      this._saveLayout();
    }
  }

  /**
   * Set the fold-down header menu actions for a panel.
   * @param {string} panelId
   * @param {Array<{id: string, label?: string, icon?: string, title?: string, active?: boolean, disabled?: boolean}>} actions
   */
  setPanelMenuActions(panelId, actions = []) {
    let panelNode = this._findPanelNode(panelId);
    panelNode?.setPanelMenuActions?.(actions);
  }

  /**
   * Set root layout behavior used for auto-collapse and responsive overflow.
   * @param {import('./../LayoutTree.js').LayoutBehavior} behavior
   */
  setLayoutBehavior(behavior = {}) {
    this.$.layoutBehavior = LayoutTree.normalizeLayoutBehavior(behavior, this._getAttributeBehavior());
    this._scheduleResponsiveLayout();
  }

  /**
   * Set responsive behavior for a concrete layout tree insertion point.
   * @param {string} nodeId
   * @param {import('./../LayoutTree.js').LayoutBehavior} behavior
   * @returns {boolean}
   */
  setNodeBehavior(nodeId, behavior = {}) {
    let tree = LayoutTree.clone(this.$.layoutTree);
    let updated = LayoutTree.setNodeBehavior(tree, nodeId, behavior, this._getRootBehavior());
    if (!updated) return false;
    this.$.layoutTree = tree;
    this._saveLayout();
    this._scheduleResponsiveLayout();
    return true;
  }

  /**
   * Get current layout
   * @returns {import('./../LayoutTree.js').LayoutNode}
   */
  getLayout() {
    return LayoutTree.clone(this.$.layoutTree);
  }

  /**
   * Set layout
   * @param {import('./../LayoutTree.js').LayoutNode} layout
   */
  setLayout(layout) {
    let allPanels = this.querySelectorAll('layout-node[node-type="panel"]');
    allPanels.forEach((panelNode) => {
      panelNode.removeAttribute('fullscreen');
      panelNode.$.isFullscreen = false;
      panelNode.$.fullscreenIcon = 'fullscreen';
      this.#setPanelVisible(panelNode, true);
      this.#clearInlineProperties(panelNode, ['left', 'width']);
    });

    if (this.$.fullscreenPanelId) {
      let panelNode = this._findPanelNode(this.$.fullscreenPanelId);
      if (panelNode) {
        panelNode.removeAttribute('fullscreen');
        panelNode.$.isFullscreen = false;
        panelNode.$.fullscreenIcon = 'fullscreen';
        this.#clearInlineProperties(panelNode, ['left', 'width']);
      }
      this.$.fullscreenPanelId = null;
      this.$.hasFullscreenTabs = false;
      this.$.tabItems = [];
    }


    this.querySelectorAll('layout-node[stripe]').forEach((node) => {
      node.removeAttribute('stripe');
      this.#clearInlineProperties(node, ['left', 'top', 'width', 'height']);
    });


    this.querySelectorAll('layout-node[collapsed]').forEach((node) => {
      node.removeAttribute('collapsed');
      node.removeAttribute('collapse-dir');
      node.$.isCollapsed = false;

      if (node.$.collapseDirection === 'horizontal') {
        node.$.collapseIcon = 'chevron_left';
      } else {
        node.$.collapseIcon = 'expand_less';
      }
    });


    this.querySelectorAll('[collapsed-child]').forEach((el) => {
      el.removeAttribute('collapsed-child');
      el.removeAttribute('saved-ratio');
      this.#clearInlineProperties(el, ['width', 'height', 'flex']);
    });

    this.$.layoutTree = layout;
    this._saveLayout();
    this._scheduleResponsiveLayout();
  }

  #setPanelVisible(panel, visible) {
    let style = panel.style;
    style.display = visible ? '' : 'none';
  }

  #clearInlineProperties(el, properties) {
    let style = el.style;
    properties.forEach((property) => style.removeProperty(property));
  }
}

Layout.template = template;
Layout.rootStyles = styles;

Layout.reg('panel-layout');
