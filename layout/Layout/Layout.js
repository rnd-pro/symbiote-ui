/**
 * @fileoverview Layout - Root container for panel layouts.
 * Uses LayoutNode for recursive BSP tree rendering.
 * Handles explicit panel menu events for split/remove operations.
 */

import Symbiote from '@symbiotejs/symbiote';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import * as LayoutTree from './../LayoutTree.js';
import { template } from './Layout.tpl.js';
import { styles } from './Layout.css.js';
import './../LayoutNode/LayoutNode.js';
import './../PanelMenu/PanelMenu.js';

function setAttributeIfChanged(element, name, value) {
  let next = String(value);
  if (element.getAttribute(name) !== next) {
    element.setAttribute(name, next);
  }
}

function toggleAttributeIfChanged(element, name, value) {
  let next = Boolean(value);
  if (element.hasAttribute(name) !== next) {
    element.toggleAttribute(name, next);
  }
}

function setStylePropertyIfChanged(style, name, value) {
  if (style.getPropertyValue(name) !== value) {
    style.setProperty(name, value);
  }
}

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


    layoutTree: null,
    layoutBehavior: null,


    panelTypes: {},

    panelChrome: true,


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
  }

  disconnectedCallback() {
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


    let rootNodes = Array.from(this.ref.root.children)
      .filter((child) => child.localName === 'layout-node');
    let rootNode = rootNodes[0];
    for (let node of rootNodes.slice(1)) {
      node.remove();
    }
    if (!rootNode) {
      rootNode = document.createElement('layout-node');
      this.ref.root.appendChild(rootNode);
    }


    let chromeEnabled = this.$.panelChrome !== false;
    rootNode.$.panelChrome = chromeEnabled;
    rootNode.setAttribute('panel-chrome', chromeEnabled ? 'default' : 'none');
    rootNode.$.nodeData = this.$.layoutTree;
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
    let tree = this.$.layoutTree;
    let layoutMinSize = LayoutTree.resolveLayoutMinSize(tree, {
      fallbackBehavior: behavior,
      resolvePanelBehavior: (node, branchBehavior) => {
        let typeBehavior = this.$.panelTypes[node.panelType]?.behavior || {};
        return LayoutTree.getNodeBehavior(node, LayoutTree.normalizeLayoutBehavior(typeBehavior, branchBehavior));
      },
    });
    let responsiveState = LayoutTree.resolveResponsiveLayoutState(behavior, {
      inlineSize: rect.width,
      blockSize: rect.height,
      layoutMinSize,
    });

    setAttributeIfChanged(this, 'responsive-mode', behavior.responsiveMode);
    setAttributeIfChanged(this, 'overflow-mode', behavior.overflow);
    toggleAttributeIfChanged(this, 'responsive-active', responsiveState.responsiveActive);
    toggleAttributeIfChanged(this, 'scroll-inline-active', responsiveState.scrollInline);
    toggleAttributeIfChanged(this, 'scroll-block-active', responsiveState.scrollBlock);
    for (let [name, value] of Object.entries(responsiveState.cssVars)) {
      setStylePropertyIfChanged(this.style, name, value);
    }

    if (this.$.fullscreenPanelId) return;

    if (!responsiveState.collapseAllowed) {
      if (this._clearAutoCollapsedPanels(tree)) {
        this.$.layoutTree = { ...tree };
        this._saveLayout();
      }
      return;
    }

    if (this._restoreAutoCollapsedPanels(tree)) {
      this.$.layoutTree = { ...tree };
      this._saveLayout();
      this._scheduleResponsiveLayout();
      return;
    }

    let changed = false;
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
    } else if (actionId === 'layout:close-ui-panel') {
      let panelNode = this._findPanelNode(panelId);
      let panelType = panelNode?.$?.nodeData?.panelType;
      if (panelType) this.closeUiPanel(panelType);
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
   * Open a panel type inside the current layout tree.
   * @param {string} panelType
   * @param {Object} [options]
   * @param {'horizontal' | 'vertical'} [options.direction]
   * @param {number} [options.ratio]
   * @param {Object} [options.panelState]
   * @param {import('./../LayoutTree.js').LayoutBehavior} [options.behavior]
   * @param {boolean} [options.reuseExisting]
   * @param {boolean} [options.uiInvoked]
   * @param {string} [options.source]
   * @returns {string|null} opened or reused panel id
   */
  openPanel(panelType, options = {}) {
    let result = LayoutTree.openPanel(
      LayoutTree.clone(this.$.layoutTree),
      panelType,
      options
    );

    if (!result.panel) return null;
    if (result.root) this.$.layoutTree = result.root;
    this._saveLayout();
    this._scheduleResponsiveLayout();
    this.dispatchEvent(new CustomEvent('layout-ui-panel-open', {
      bubbles: true,
      composed: true,
      detail: {
        panelId: result.panel.id,
        panelType,
        created: result.created,
        source: options.source || '',
        uiInvoked: Boolean(result.panel.panelState?.uiInvoked),
        panelState: result.panel.panelState || {},
      },
    }));
    return result.panel.id;
  }

  /**
   * Close a panel previously opened by UI/agent intent.
   * @param {string} panelType
   * @returns {boolean}
   */
  closeUiPanel(panelType) {
    let result = LayoutTree.closeUiPanel(LayoutTree.clone(this.$.layoutTree), panelType);
    if (!result.removed) return false;
    if (result.root) {
      this.$.layoutTree = result.root;
    } else {
      this.$.layoutTree = LayoutTree.createPanel('default');
    }
    this._saveLayout();
    this._scheduleResponsiveLayout();
    this.dispatchEvent(new CustomEvent('layout-ui-panel-close', {
      bubbles: true,
      composed: true,
      detail: {
        panelId: result.panel.id,
        panelType,
        source: result.panel.panelState?.source || '',
      },
    }));
    return true;
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
