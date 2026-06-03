/**
 * ContextMenu — right-click menu for graph editor
 *
 * Shows contextual actions for canvas, nodes, and connections.
 * Triple-file component: .js + .tpl.js + .css.js
 *
 * @module symbiote-node/components/ContextMenu
 */

import Symbiote from '@symbiotejs/symbiote';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import { bringOverlayToFront } from '../../ui/overlay-stack.js';
import { template, ctxItemTemplate } from './ContextMenu.tpl.js';
import { styles } from './ContextMenu.css.js';

class CtxItem extends Symbiote {
  init$ = {
    label: '',
    icon: '',
    onclick: () => {
      this.$['^onItemClick'](this.$.label);
    },
  };
}

CtxItem.template = ctxItemTemplate;
CtxItem.reg('ctx-item');

export class ContextMenu extends Symbiote {
  /** @type {Map<string, function>} */
  _actions = new Map();

  init$ = {
    items: [],
    visible: false,
    onBackdropClick: () => this.hide(),
    onItemClick: (label) => {
      let action = this._actions.get(label);
      if (action) action();
      this.hide();
    },
  };

  /**
   * Show the menu at screen coordinates
   * @param {number} x - Screen X
   * @param {number} y - Screen Y
   * @param {Array<{label: string, icon: string, action: function}>} items
   */
  show(x, y, items) {
    ensureMaterialSymbols(items.map((item) => item.icon));
    this._actions.clear();
    for (const item of items) {
      this._actions.set(item.label, item.action);
    }
    this.$.items = items.map((i) => ({ label: i.label, icon: i.icon }));
    let menu = this.querySelector('.sn-ctx-menu');
    if (menu) {
      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
    }
    bringOverlayToFront(this);
    this.$.visible = true;
  }

  /** Hide menu */
  hide() {
    this.$.visible = false;
    this.$.items = [];
    this._actions.clear();
  }

  renderCallback() {
    this.sub('visible', (val) => {
      this.toggleAttribute('hidden', !val);
    });
  }
}

ContextMenu.template = template;
ContextMenu.rootStyles = styles;
ContextMenu.reg('context-menu');
