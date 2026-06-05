/**
 * @fileoverview LayoutNode - Universal recursive layout node
 * Renders panel or split based on node type.
 * Split nodes recursively create child LayoutNodes.
 * Panels expose explicit fold-down actions for split/remove operations.
 */

import Symbiote from '@symbiotejs/symbiote';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import { template } from './LayoutNode.tpl.js';
import { styles } from './LayoutNode.css.js';
import { translate } from '../../locale/index.js';
import * as LayoutTree from './../LayoutTree.js';

const LAYOUT_NODE_ICONS = [
  'arrow_drop_down',
  'chevron_left',
  'chevron_right',
  'dashboard',
  'expand_less',
  'expand_more',
  'fullscreen',
  'fullscreen_exit',
  'keyboard_arrow_down',
  'keyboard_arrow_up',
  'more_horiz',
  'close',
  'delete',
  'call_split',
  'horizontal_split',
  'vertical_split',
  'control_point_duplicate',
  'unfold_less',
];

const LAYOUT_PANEL_TREE_ACTIONS = Object.freeze([
  { id: 'layout:split-horizontal', label: 'Split H', icon: 'horizontal_split', title: 'Split panel horizontally', group: 'layout' },
  { id: 'layout:split-vertical', label: 'Split V', icon: 'vertical_split', title: 'Split panel vertically', group: 'layout' },
  { id: 'layout:duplicate', label: 'Duplicate', icon: 'control_point_duplicate', title: 'Duplicate panel', group: 'layout' },
]);

function getLayoutPanelViewActions({ canCollapse = false } = {}) {
  return canCollapse
    ? [{ id: 'layout:collapse-toggle', label: 'Collapse', icon: 'unfold_less', title: 'Collapse panel', group: 'layout' }]
    : [];
}

const LAYOUT_PANEL_MENU_ACTIONS = Object.freeze([...LAYOUT_PANEL_TREE_ACTIONS]);

const LAYOUT_REMOVABLE_PANEL_MENU_ACTIONS = Object.freeze([
  { id: 'layout:remove', label: 'Remove', icon: 'close', title: 'Remove panel', group: 'layout' },
]);

const LAYOUT_UI_PANEL_MENU_ACTIONS = Object.freeze([
  { id: 'layout:close-ui-panel', label: 'Close', icon: 'close', title: 'Close temporary UI panel', group: 'layout' },
  { id: 'layout:remove-ui-panel', label: 'Remove', icon: 'delete', title: 'Remove temporary UI panel from the layout', group: 'layout' },
]);

const PANEL_MENU_GROUPS = Object.freeze({
  layout: { id: 'layout', label: 'Layout', order: 10 },
  path: { id: 'path', label: 'Connections', order: 20 },
  graph: { id: 'graph', label: 'Graph', order: 30 },
  panel: { id: 'panel', label: 'Panel', order: 40 },
});

function inferPanelMenuGroup(action) {
  let id = String(action?.id || '');
  if (id.startsWith('layout:')) return 'layout';
  if (id.startsWith('path:')) return 'path';
  if (id.startsWith('graph:')) return 'graph';
  return action?.group || 'panel';
}

function normalizePanelMenuAction(action) {
  let group = String(action.group || inferPanelMenuGroup(action));
  let groupInfo = PANEL_MENU_GROUPS[group] || { id: group, label: action.groupLabel || group, order: 50 };
  return {
    id: String(action.id),
    label: action.label || action.title || action.id,
    icon: action.icon || 'radio_button_unchecked',
    title: action.title || action.label || action.id,
    active: Boolean(action.active),
    disabled: Boolean(action.disabled),
    group,
    groupLabel: action.groupLabel || groupInfo.label,
    groupOrder: Number.isFinite(Number(action.groupOrder)) ? Number(action.groupOrder) : groupInfo.order,
    rowSpan: Math.max(1, Number(action.rowSpan) || 1),
  };
}

function groupPanelMenuActions(actions) {
  let rows = new Map();
  for (let action of actions) {
    let row = rows.get(action.group);
    if (!row) {
      row = {
        id: action.group,
        label: action.groupLabel,
        order: action.groupOrder,
        rowSpan: action.rowSpan,
        rowStyle: `--sn-layout-menu-row-span: ${action.rowSpan};`,
        actions: [],
      };
      rows.set(action.group, row);
    }
    row.rowSpan = Math.max(row.rowSpan, action.rowSpan);
    row.rowStyle = `--sn-layout-menu-row-span: ${row.rowSpan};`;
    row.actions.push(action);
  }
  return [...rows.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

function getLayoutPanelMenuActions(nodeData, state = {}) {
  let actions = [
    ...getLayoutPanelViewActions(state),
    ...LAYOUT_PANEL_MENU_ACTIONS,
  ];
  if (nodeData?.panelState?.uiInvoked) return [...actions, ...LAYOUT_UI_PANEL_MENU_ACTIONS];
  if (nodeData?.panelState?.removable === true) return [...actions, ...LAYOUT_REMOVABLE_PANEL_MENU_ACTIONS];
  return actions;
}

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
    panelMenuActions: [],
    panelMenuRows: [],
    hasPanelMenuActions: false,
    isPanelMenuOpen: false,
    panelMenuIcon: 'keyboard_arrow_down',
    panelMenuTitle: 'Panel actions',
    layoutImportance: 50,
    layoutMinInlineSize: 220,
    layoutMinBlockSize: 160,
    layoutCollapsePolicy: 'auto',
    layoutOverflowPolicy: 'collapse',


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
    onPanelMenuToggle: () => this._togglePanelMenu(),
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
      this._syncBehaviorInfo(data);


      if (data.type === 'panel') {
        this.$.isCollapsed = data.collapsed || false;
        this.toggleAttribute('collapsed', this.$.isCollapsed);
        this.toggleAttribute('auto-collapsed', data.autoCollapsed || false);
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

  initCallback() {
    this.addEventListener('panel-menu-actions', this._onPanelMenuActions);
    this.addEventListener('click', this._onPanelMenuClick);
  }

  disconnectedCallback() {
    this.removeEventListener('panel-menu-actions', this._onPanelMenuActions);
    this.removeEventListener('click', this._onPanelMenuClick);
    super.disconnectedCallback?.();
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
    this._syncBehaviorInfo(this.$.nodeData, config.behavior);


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
      this.$.canCollapse = false;

      this.$.canCollapse =
        this.$.layoutCollapsePolicy !== 'never' &&
        !!isSplitChild &&
        siblingExists &&
        !siblingCollapsed;

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
    this._setPanelMenuActions(config.menuActions || []);
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
      this._applyPanelComponentConfig(existing, config);
      existing.style.display = '';
      return;
    }


    let component = document.createElement(componentTag);
    component.dataset.panelId = this.$.nodeData?.id || '';
    this._applyPanelComponentConfig(component, config);
    contentEl.appendChild(component);
  }

  _applyPanelComponentConfig(component, config) {
    for (let [name, value] of Object.entries(config.attributes || {})) {
      if (value === false || value === null || value === undefined) {
        component.removeAttribute(name);
      } else if (value === true) {
        component.setAttribute(name, '');
      } else {
        component.setAttribute(name, String(value));
      }
    }

    for (let [name, value] of Object.entries(config.properties || {})) {
      component[name] = value;
    }
  }

  _syncBehaviorInfo(nodeData, fallback = {}) {
    let behavior = LayoutTree.getNodeBehavior(
      nodeData,
      LayoutTree.normalizeLayoutBehavior(fallback)
    );
    this.$.layoutImportance = behavior.importance;
    this.$.layoutMinInlineSize = behavior.minInlineSize;
    this.$.layoutMinBlockSize = behavior.minBlockSize;
    this.$.layoutCollapsePolicy = behavior.collapse;
    this.$.layoutOverflowPolicy = behavior.overflow;
    this.#syncHostAttribute('importance', behavior.importance);
    this.#syncHostAttribute('collapse-policy', behavior.collapse);
    this.#syncHostAttribute('overflow-policy', behavior.overflow);
    this.style.setProperty('--sn-layout-panel-importance', String(behavior.importance));
    this.style.setProperty('--sn-layout-panel-min-inline-size', `${behavior.minInlineSize}px`);
    this.style.setProperty('--sn-layout-panel-min-block-size', `${behavior.minBlockSize}px`);
  }

  /**
   * Replaces the fold-down panel menu actions for this panel.
   * @param {Array<{id: string, label?: string, icon?: string, title?: string, active?: boolean, disabled?: boolean, group?: string, groupLabel?: string, groupOrder?: number, rowSpan?: number}>} actions
   */
  setPanelMenuActions(actions = []) {
    this._setPanelMenuActions(actions);
  }

  _setPanelMenuActions(actions = []) {
    let customActions = Array.isArray(actions)
      ? actions
        .filter((action) => action && action.hidden !== true && action.id)
        .map(normalizePanelMenuAction)
      : [];
    let normalized = [
      ...getLayoutPanelMenuActions(this.$.nodeData, { canCollapse: this.$.canCollapse }),
      ...customActions,
    ].map(normalizePanelMenuAction);

    ensureMaterialSymbols(normalized.map((action) => action.icon));
    this.$.panelMenuActions = normalized;
    this.$.panelMenuRows = groupPanelMenuActions(normalized);
    this.$.hasPanelMenuActions = normalized.length > 0;
    this._schedulePanelMenuActionStateSync();
    if (!normalized.length) {
      this.$.isPanelMenuOpen = false;
      this.$.panelMenuIcon = 'keyboard_arrow_down';
    }
  }

  _schedulePanelMenuActionStateSync() {
    this._syncPanelMenuActionState();
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => this._syncPanelMenuActionState());
    }
  }

  _syncPanelMenuActionState() {
    let actions = new Map(this.$.panelMenuActions.map((action) => [action.id, action]));
    for (let button of this.querySelectorAll('.panel-menu-action[data-menu-action-id]')) {
      let action = actions.get(button.dataset.menuActionId);
      let active = Boolean(action?.active);
      let disabled = Boolean(action?.disabled);
      button.toggleAttribute('active', active);
      button.toggleAttribute('disabled', disabled);
      button.disabled = disabled;
    }
  }

  _onPanelMenuClick = (event) => {
    let button = event.target.closest('.panel-menu-action[data-menu-action-id]');
    if (!button || button.closest('layout-node') !== this) return;
    event.preventDefault();
    event.stopPropagation();
    this._runPanelMenuAction(event);
  };

  _togglePanelMenu() {
    if (this.$.panelChrome === false || this.$['^panelChrome'] === false) return;
    if (this.$.isCollapsed || !this.$.hasPanelMenuActions) return;
    this.$.isPanelMenuOpen = !this.$.isPanelMenuOpen;
    this.$.panelMenuIcon = this.$.isPanelMenuOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
    this._schedulePanelMenuActionStateSync();
  }

  _runPanelMenuAction(event) {
    let id = event.target.closest('[data-menu-action-id]')?.dataset.menuActionId;
    if (!id) return;
    let action = this.$.panelMenuActions.find((item) => item.id === id);
    if (!action || action.disabled) return;
    if (action.id === 'layout:collapse-toggle') {
      this._toggleCollapse();
      this.$.isPanelMenuOpen = false;
      this.$.panelMenuIcon = 'keyboard_arrow_down';
      return;
    }
    let detail = {
      panelId: this.$.nodeId,
      panelType: this.$.panelType,
      actionId: action.id,
      action,
    };

    let component = this._getActivePanelComponent();
    component?.dispatchEvent(new CustomEvent('panel-menu-action', {
      bubbles: false,
      composed: false,
      detail,
    }));

    this.dispatchEvent(new CustomEvent('panel-menu-action', {
      bubbles: true,
      composed: true,
      detail,
    }));
  }

  _getActivePanelComponent() {
    return Array.from(this.ref.panelContent?.children || [])
      .find((child) => child.style.display !== 'none') || null;
  }

  _renderNode(data) {
    this.$.panelChrome = this.$.panelChrome !== false && this.$['^panelChrome'] !== false;
    this.setAttribute('panel-chrome', this.$.panelChrome ? 'default' : 'none');

    let prevType = this.getAttribute('node-type');
    this.#syncHostAttribute('node-type', data.type);

    if (data.type === 'split') {
      if (prevType === 'panel') {
        if (this.ref.panelContent) this.ref.panelContent.replaceChildren();
        this.$.isPanelMenuOpen = false;
        this.$.panelMenuIcon = 'keyboard_arrow_down';
      }
      this.#syncHostAttribute('direction', data.direction);
      this._renderSplit(data);
    } else {
      this.removeAttribute('direction');
      this.$.isPanelMenuOpen = false;
      this.$.panelMenuIcon = 'keyboard_arrow_down';


      if (prevType === 'split') {
        if (this.ref.first) this.ref.first.replaceChildren();
        if (this.ref.second) this.ref.second.replaceChildren();
      }

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
    let children = Array.from(container.children)
      .filter((item) => item.localName === 'layout-node');
    let child = children[0];
    for (let node of children.slice(1)) {
      node.remove();
    }
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

  _onPanelMenuActions = (event) => {
    if (event.target === this) return;
    let panelId = event.detail?.panelId || event.target?.dataset?.panelId;
    if (panelId && panelId !== this.$.nodeId) return;
    this.setPanelMenuActions(event.detail?.actions || []);
    event.stopPropagation();
  };

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


      let firstChild = this.ref.first?.querySelector(':scope > layout-node');
      let secondChild = this.ref.second?.querySelector(':scope > layout-node');


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
    if (this.$.layoutCollapsePolicy === 'never') return;


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
    if (this.$.layoutCollapsePolicy === 'never') return;
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
