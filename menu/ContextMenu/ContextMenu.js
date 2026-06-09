import Symbiote from '@symbiotejs/symbiote';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import { bringOverlayToFront } from '../../ui/overlay-stack.js';
import template, { ctxItemTemplate } from './ContextMenu.tpl.js';
import { styles } from './ContextMenu.css.js';

class CtxItem extends Symbiote {
  init$ = {
    label: '',
    icon: '',
    detail: '',
    disabled: false,
    destructive: false,
    checked: false,
    divider: false,
    onclick: (e) => {
      if (this.$.disabled || this.$.divider) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      this.$['^onItemClick'](this.$.label);
    },
  };

  renderCallback() {
    this.sub('divider', (val) => {
      this.toggleAttribute('divider', Boolean(val));
    });
    this.sub('disabled', (val) => {
      this.toggleAttribute('disabled', Boolean(val));
      this.setAttribute('aria-disabled', String(Boolean(val)));
      this._syncButtonState();
    });
    this.sub('destructive', (val) => {
      this.toggleAttribute('destructive', Boolean(val));
      this._syncButtonState();
    });
    this.sub('checked', (val) => {
      this.toggleAttribute('checked', Boolean(val));
      this.setAttribute('aria-checked', String(Boolean(val)));
      this.setAttribute('role', val ? 'menuitemcheckbox' : 'menuitem');
      this._syncButtonState();
    });

    if (!this.hasAttribute('role')) {
      this.setAttribute('role', this.$.checked ? 'menuitemcheckbox' : 'menuitem');
    }
    this._syncButtonState();
  }

  _syncButtonState() {
    const btn = this.querySelector('.sn-ctx-btn');
    if (!btn) return;
    const role = this.$.checked ? 'menuitemcheckbox' : 'menuitem';
    btn.setAttribute('role', role);
    btn.setAttribute('aria-checked', String(Boolean(this.$.checked)));
    if (this.$.disabled) btn.setAttribute('disabled', '');
    else btn.removeAttribute('disabled');
    if (this.$.destructive) btn.setAttribute('destructive', '');
    else btn.removeAttribute('destructive');
  }
}

CtxItem.template = ctxItemTemplate;
CtxItem.reg('ctx-item');

export class ContextMenu extends Symbiote {
  _actions = new Map();
  #triggerEl = null;

  init$ = {
    items: [],
    visible: false,
    onBackdropClick: () => this.hide(),
    onItemClick: (label) => {
      let action = this._actions.get(label);
      if (action) action();
      this.hide();
    },
    onKeydown: (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
        return;
      }

      const items = this.getItemsElements();
      if (items.length === 0) return;

      const activeEl = document.activeElement;
      const activeItem = activeEl?.closest('ctx-item');
      let index = items.indexOf(activeItem);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        index = (index + 1) % items.length;
        items[index].querySelector('.sn-ctx-btn')?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        index = (index - 1 + items.length) % items.length;
        items[index].querySelector('.sn-ctx-btn')?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0].querySelector('.sn-ctx-btn')?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1].querySelector('.sn-ctx-btn')?.focus();
      }
    },
  };

  getItemsElements() {
    return Array.from(this.querySelectorAll('ctx-item:not([disabled]):not([divider])'));
  }

  focusFirstItem() {
    const el = this.querySelector('ctx-item:not([disabled]):not([divider])');
    if (el) {
      const btn = el.querySelector('.sn-ctx-btn');
      if (btn) btn.focus();
    }
  }

  show(x, y, items, triggerEl = document.activeElement) {
    this.#triggerEl = triggerEl;
    let iconNames = items.filter(i => i.icon).map((item) => item.icon);
    if (items.some((item) => item.checked)) iconNames.push('check');
    ensureMaterialSymbols(iconNames);
    this._actions.clear();
    for (const item of items) {
      if (item.label && item.action) {
        this._actions.set(item.label, item.action);
      }
    }
    this.$.items = items.map((i) => ({
      label: i.label || '',
      icon: i.icon || '',
      detail: i.detail || '',
      disabled: Boolean(i.disabled),
      destructive: Boolean(i.destructive),
      checked: Boolean(i.checked),
      divider: Boolean(i.divider),
    }));

    let menu = this.querySelector('.sn-ctx-menu');
    if (menu) {
      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
    }
    bringOverlayToFront(this);
    this.$.visible = true;

    setTimeout(() => {
      this.focusFirstItem();
    }, 0);
  }

  hide() {
    this.$.visible = false;
    this.$.items = [];
    this._actions.clear();
    if (this.#triggerEl && typeof this.#triggerEl.focus === 'function') {
      this.#triggerEl.focus();
    }
    this.#triggerEl = null;
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

export default ContextMenu;
