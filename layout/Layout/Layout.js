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


    layoutTree: null,


    panelTypes: {},

    panelChrome: true,

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
  }

  renderCallback() {
    this._renderRoot();
    this.sub('layoutTree', () => {
      this._renderRoot();

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

  _renderRoot() {
    if (!this.$.layoutTree || !this.ref.root) return;


    let rootNode = this.ref.root.querySelector('layout-node');
    if (!rootNode) {
      rootNode = document.createElement('layout-node');
      this.ref.root.appendChild(rootNode);
    }


    let chromeEnabled = this.$.panelChrome !== false;
    rootNode.$.panelChrome = chromeEnabled;
    rootNode.setAttribute('panel-chrome', chromeEnabled ? 'default' : 'none');
    rootNode.$.nodeData = this.$.layoutTree;
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


    LayoutTree.updateNode(tree, panelId, { collapsed });


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
