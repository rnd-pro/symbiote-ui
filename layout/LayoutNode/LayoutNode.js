/**
 * @fileoverview LayoutNode - Universal recursive layout node
 * Renders panel or split based on node type.
 * Split nodes recursively create child LayoutNodes.
 * Panels include action zones for split/join gestures.
 */

import Symbiote from '@symbiotejs/symbiote';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import { template } from './LayoutNode.tpl.js';
import { styles } from './LayoutNode.css.js';
import './../ActionZone/ActionZone.js';
import { translate } from '../../locale/index.js';

const LAYOUT_NODE_ICONS = [
  'arrow_drop_down',
  'chevron_left',
  'chevron_right',
  'dashboard',
  'expand_less',
  'expand_more',
  'fullscreen',
  'fullscreen_exit',
];

export class LayoutNode extends Symbiote {
  static isoMode = true;

  init$ = {

    nodeData: null,


    nodeType: 'panel',
    isPanel: true,
    isSplit: false,
    direction: 'horizontal',
    ratio: 0.5,
    panelType: 'default',
    nodeId: '',


    panelTitle: 'Panel',
    panelIcon: 'dashboard',
    panelChrome: true,


    isCollapsed: false,
    canCollapse: true,
    collapseDirection: 'vertical',
    collapseIcon: 'expand_less',
    savedRatio: 0.5,
    isFullscreen: false,
    fullscreenIcon: 'fullscreen',
    collapseTitle: translate('layout.collapse'),
    fullscreenTitle: translate('layout.fullscreen'),


    firstStyle: '',
    secondStyle: '',


    '^panelTypes': {},
    '^fullscreenPanelId': null,
    '^panelChrome': true,


    onResizerDown: (e) => this._startResize(e),
    onTypeClick: (e) => this._showTypeMenu(e),
    onCollapseClick: () => this._toggleCollapse(),
    onExpandClick: () => this._toggleCollapse(),
    onFullscreenClick: () => this._toggleFullscreen(),
  };

  renderCallback() {
    ensureMaterialSymbols(LAYOUT_NODE_ICONS);

    this.sub('nodeData', (data) => {
      if (!data) return;

      this.$.nodeType = data.type || 'panel';
      this.$.isPanel = this.$.nodeType === 'panel';
      this.$.isSplit = this.$.nodeType === 'split';
      this.$.direction = data.direction || 'horizontal';
      this.$.ratio = data.ratio || 0.5;
      this.$.panelType = data.panelType || 'default';
      this.$.nodeId = data.id || '';


      if (data.type === 'panel') {
        this.$.isCollapsed = data.collapsed || false;
        this.toggleAttribute('collapsed', this.$.isCollapsed);
        this.#syncHostAttribute('collapse-dir', this.$.isCollapsed ? this.$.collapseDirection : '');

        if (this.$.isCollapsed) {
          if (this.$.collapseDirection === 'horizontal') {
            this.$.collapseIcon = 'chevron_right';
          } else {
            this.$.collapseIcon = 'expand_more';
          }
        } else {
          if (this.$.collapseDirection === 'horizontal') {
            this.$.collapseIcon = 'chevron_left';
          } else {
            this.$.collapseIcon = 'expand_less';
          }
        }
      }

      this._updateStyles();
      this._updatePanelInfo();
      this._renderNode(data);
    });


    this.sub('^panelTypes', () => {
      this._updatePanelInfo();
    });


    this.sub('panelType', () => {
      this._updatePanelInfo();
    });


    if (this.$.nodeData) {
      this.sub('nodeData', () => {});
    }
  }

  _updateStyles() {
    let ratio = this.$.ratio;
    let dir = this.$.direction;
    let data = this.$.nodeData;


    let firstCollapsed = data?.first?.collapsed || false;
    let secondCollapsed = data?.second?.collapsed || false;


    const COLLAPSED_SIZE = dir === 'horizontal' ? '32px' : '28px';

    if (firstCollapsed) {

      if (dir === 'horizontal') {
        this.$.firstStyle = `width: ${COLLAPSED_SIZE}; height: 100%; flex: 0 0 ${COLLAPSED_SIZE};`;
        this.$.secondStyle = 'flex: 1; height: 100%;';
      } else {
        this.$.firstStyle = `height: ${COLLAPSED_SIZE}; width: 100%; flex: 0 0 ${COLLAPSED_SIZE};`;
        this.$.secondStyle = 'flex: 1; width: 100%;';
      }
    } else if (secondCollapsed) {

      if (dir === 'horizontal') {
        this.$.firstStyle = 'flex: 1; height: 100%;';
        this.$.secondStyle = `width: ${COLLAPSED_SIZE}; height: 100%; flex: 0 0 ${COLLAPSED_SIZE};`;
      } else {
        this.$.firstStyle = 'flex: 1; width: 100%;';
        this.$.secondStyle = `height: ${COLLAPSED_SIZE}; width: 100%; flex: 0 0 ${COLLAPSED_SIZE};`;
      }
    } else {

      if (dir === 'horizontal') {
        this.$.firstStyle = `width: ${ratio * 100}%; height: 100%;`;
        this.$.secondStyle = `width: ${(1 - ratio) * 100}%; height: 100%;`;
      } else {
        this.$.firstStyle = `height: ${ratio * 100}%; width: 100%;`;
        this.$.secondStyle = `height: ${(1 - ratio) * 100}%; width: 100%;`;
      }
    }
  }

  _updatePanelInfo() {
    let panelTypes = this.$['^panelTypes'] || {};
    let config = panelTypes[this.$.panelType] || {};
    this.$.panelTitle = config.title || this.$.panelType;
    this.$.panelIcon = config.icon || 'dashboard';
    ensureMaterialSymbols([this.$.panelIcon]);


    this._injectPanelComponent(config);


    let container = this.parentElement;
    if (!container) return;
    let isSplitChild =
      container &&
      (container.classList.contains('split-first') || container.classList.contains('split-second'));


    let siblingExists = false;
    let siblingCollapsed = false;
    let isFirst = false;

    if (isSplitChild) {
      isFirst = container.classList.contains('split-first');

      let siblingContainer = isFirst
        ? container.parentElement.querySelector(':scope > .split-second')
        : container.parentElement.querySelector(':scope > .split-first');
      siblingExists = !!siblingContainer;


      if (siblingContainer) {
        let siblingNode = siblingContainer.querySelector(':scope > layout-node');

        if (siblingNode?.getAttribute('node-type') === 'panel') {
          siblingCollapsed = siblingNode.$.isCollapsed || false;
        }
      }
    }


    if (this.$.nodeType === 'panel') {

      this.$.canCollapse = !!isSplitChild && siblingExists && !siblingCollapsed;

      if (isSplitChild) {

        let parentNode = container.closest('layout-node');
        if (!parentNode && container.getRootNode() instanceof ShadowRoot) {
          parentNode = container.getRootNode().host;
        }

        if (parentNode) {
          let parentDir = parentNode.getAttribute('direction');
          this.$.collapseDirection = parentDir;
          if (this.$.isCollapsed) {
            this.#syncHostAttribute('collapse-dir', parentDir);
          }


          if (!this.$.isCollapsed) {
            if (parentDir === 'horizontal') {
              this.$.collapseIcon = isFirst ? 'chevron_left' : 'chevron_right';
            } else {
              this.$.collapseIcon = isFirst ? 'expand_less' : 'expand_more';
            }
          }
        }
      }
    }
  }

  /**
   * Inject custom component into panel content.
   * Hides existing components instead of destroying them to preserve state.
   * Uses style.display instead of hidden attribute because components may have
   * CSS rules (e.g. display:block) that override the hidden attribute.
   * @param {Object} config - Panel type configuration
   */
  _injectPanelComponent(config) {
    let contentEl = this.ref.panelContent;
    if (!contentEl) return;

    let componentTag = config.component;
    if (!componentTag) return;


    for (const child of contentEl.children) {
      child.style.display = 'none';
    }


    let existing = contentEl.querySelector(componentTag);
    if (existing) {
      existing.style.display = '';
      return;
    }


    let component = document.createElement(componentTag);
    component.dataset.panelId = this.$.nodeData?.id || '';
    contentEl.appendChild(component);
  }

  _renderNode(data) {
    this.$.panelChrome = this.$.panelChrome !== false && this.$['^panelChrome'] !== false;
    this.setAttribute('panel-chrome', this.$.panelChrome ? 'default' : 'none');

    let prevType = this.getAttribute('node-type');
    this.#syncHostAttribute('node-type', data.type);

    if (data.type === 'split') {
      this.#syncHostAttribute('direction', data.direction);
      this._renderSplit(data);
    } else {
      this.removeAttribute('direction');


      if (prevType === 'split') {
        if (this.ref.first) this.ref.first.replaceChildren();
        if (this.ref.second) this.ref.second.replaceChildren();
      }


      this._setupActionZones(data.id);

      this._updatePanelInfo();
    }
  }

  _renderSplit(data) {


    if (data.first && this.ref.first) {
      this._ensureChildNode(this.ref.first, data.first);
    }
    if (data.second && this.ref.second) {
      this._ensureChildNode(this.ref.second, data.second);
    }
  }

  /**
   * @param {HTMLElement} container
   * @param {Object} nodeData
   */
  _ensureChildNode(container, nodeData) {
    let child = container.querySelector('layout-node');
    if (!child) {
      child = document.createElement('layout-node');
      container.appendChild(child);

      if (typeof setTimeout !== 'undefined') {
        setTimeout(() => child._updatePanelInfo && child._updatePanelInfo());
      }
    }

    child.$.panelChrome = this.$.panelChrome !== false;
    child.setAttribute('panel-chrome', this.$.panelChrome ? 'default' : 'none');
    child.$.nodeData = { ...nodeData };
  }

  _setupActionZones(panelId) {

    let zones = this.querySelectorAll('action-zone');
    zones.forEach((zone) => {
      zone.$.panelId = panelId;
    });
  }

  _startResize(e) {
    if (this.$.panelChrome === false || this.$['^panelChrome'] === false) return;
    e.preventDefault();
    this.toggleAttribute('resizing', true);


    const COLLAPSE_THRESHOLD = 0.05;
    const UNCOLLAPSE_THRESHOLD = 0.08;

    let onMove = (moveEvent) => {
      let rect = this.getBoundingClientRect();
      let currentPos = this.$.direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
      let containerSize = this.$.direction === 'horizontal' ? rect.width : rect.height;
      let startOffset = this.$.direction === 'horizontal' ? rect.left : rect.top;


      let rawRatio = (currentPos - startOffset) / containerSize;


      let firstChild = this.ref.first?.querySelector('layout-node');
      let secondChild = this.ref.second?.querySelector('layout-node');


      if (rawRatio < COLLAPSE_THRESHOLD && firstChild && !firstChild.$.isCollapsed) {

        firstChild._setCollapsed(true);
        return;
      } else if (rawRatio > UNCOLLAPSE_THRESHOLD && firstChild?.$.isCollapsed) {

        firstChild._setCollapsed(false);
      }


      if (rawRatio > 1 - COLLAPSE_THRESHOLD && secondChild && !secondChild.$.isCollapsed) {

        secondChild._setCollapsed(true);
        return;
      } else if (rawRatio < 1 - UNCOLLAPSE_THRESHOLD && secondChild?.$.isCollapsed) {

        secondChild._setCollapsed(false);
      }


      if (firstChild?.$.isCollapsed || secondChild?.$.isCollapsed) {
        return;
      }


      let newRatio = Math.max(0.1, Math.min(0.9, rawRatio));


      this.$.ratio = newRatio;
      this._updateStyles();


      if (this.$.nodeData) {
        this.$.nodeData.ratio = newRatio;
      }


      this._notifyChange();
    };

    let onUp = () => {
      this.removeAttribute('resizing');
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  #syncHostAttribute(name, value) {
    if (value === undefined || value === null || value === '') {
      this.removeAttribute(name);
      return;
    }
    this.toggleAttribute(name, true);
    let attr = this.getAttributeNode(name);
    if (attr) attr.value = String(value);
  }

  _notifyChange() {
    this.dispatchEvent(
      new CustomEvent('layout-change', {
        bubbles: true,
        detail: { nodeId: this.$.nodeId },
      })
    );
  }

  _toggleCollapse() {
    if (this.$.panelChrome === false || this.$['^panelChrome'] === false) return;


    this.dispatchEvent(
      new CustomEvent('panel-collapse-toggle', {
        bubbles: true,
        composed: true,
        detail: {
          panelId: this.$.nodeId,
          collapsed: !this.$.isCollapsed,
        },
      })
    );
  }

  /**
   * Programmatically set collapsed state (used by resize gesture)
   * @param {boolean} collapsed
   */
  _setCollapsed(collapsed) {
    if (this.$.panelChrome === false || this.$['^panelChrome'] === false) return;
    if (this.$.isCollapsed === collapsed) return;


    this.dispatchEvent(
      new CustomEvent('panel-collapse-toggle', {
        bubbles: true,
        composed: true,
        detail: {
          panelId: this.$.nodeId,
          collapsed: collapsed,
        },
      })
    );
  }

  _toggleFullscreen() {
    if (this.$.panelChrome === false || this.$['^panelChrome'] === false) return;

    if (this.$.isCollapsed) return;

    this.dispatchEvent(
      new CustomEvent('panel-fullscreen', {
        bubbles: true,
        composed: true,
        detail: { panelId: this.$.nodeId },
      })
    );
  }

  _showTypeMenu(e) {
    if (this.$.panelChrome === false || this.$['^panelChrome'] === false) return;

    if (this.$.isCollapsed) return;

    let rect = e.target.getBoundingClientRect();
    this.dispatchEvent(
      new CustomEvent('panel-type-menu', {
        bubbles: true,
        composed: true,
        detail: {
          panelId: this.$.nodeId,
          currentType: this.$.panelType,
          x: rect.left,
          y: rect.bottom + 4,
        },
      })
    );
  }
}

LayoutNode.template = template;
LayoutNode.rootStyles = styles;

LayoutNode.reg('layout-node');
