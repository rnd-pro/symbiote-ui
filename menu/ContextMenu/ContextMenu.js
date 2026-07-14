import Symbiote from '@symbiotejs/symbiote';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import { bringOverlayToFront } from '../../ui/overlay-stack.js';
import template, { ctxItemTemplate } from './ContextMenu.tpl.js';
import { styles } from './ContextMenu.css.js';

const CONTEXT_MENU_VIEWPORT_GUTTER = 8;

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
  #openTimer = null;
  #releaseController = null;
  #popoverOpen = false;

  init$ = {
    items: [],
    visible: false,
    onItemClick: (label) => {
      let action = this._actions.get(label);
      if (action) action();
      this.hide();
    },
    onKeydown: (e) => {
      // Escape is handled natively by the `popover` light-dismiss behavior (see #onToggle).
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

  #placeInViewport(x, y) {
    let left = Number(x);
    let top = Number(y);
    if (!Number.isFinite(left)) left = CONTEXT_MENU_VIEWPORT_GUTTER;
    if (!Number.isFinite(top)) top = CONTEXT_MENU_VIEWPORT_GUTTER;

    let rect = this.getBoundingClientRect();
    let viewportWidth = Number(window.innerWidth);
    let viewportHeight = Number(window.innerHeight);
    if (Number.isFinite(viewportWidth) && viewportWidth > 0) {
      let maxLeft = Math.max(CONTEXT_MENU_VIEWPORT_GUTTER, viewportWidth - rect.width - CONTEXT_MENU_VIEWPORT_GUTTER);
      left = Math.min(Math.max(CONTEXT_MENU_VIEWPORT_GUTTER, left), maxLeft);
    }
    if (Number.isFinite(viewportHeight) && viewportHeight > 0) {
      let maxTop = Math.max(CONTEXT_MENU_VIEWPORT_GUTTER, viewportHeight - rect.height - CONTEXT_MENU_VIEWPORT_GUTTER);
      top = Math.min(Math.max(CONTEXT_MENU_VIEWPORT_GUTTER, top), maxTop);
    }

    this.style.left = `${left}px`;
    this.style.top = `${top}px`;
  }

  #scheduleOpen(x, y) {
    if (this.#openTimer !== null) clearTimeout(this.#openTimer);
    this.#openTimer = setTimeout(() => {
      this.#openTimer = null;
      if (!this.$.visible || !this.isConnected) return;
      this.#showNativePopover();
      this.#placeInViewport(x, y);
      this.focusFirstItem();
    }, 0);
  }

  #showNativePopover() {
    if (this.#popoverOpen) return;
    this.showPopover();
    this.#popoverOpen = true;
  }

  #hideNativePopover() {
    if (!this.#popoverOpen) return;
    try {
      this.hidePopover();
    } finally {
      this.#popoverOpen = false;
    }
  }

  #cancelPendingRelease() {
    if (this.#releaseController === null) return;
    this.#releaseController.abort();
    this.#releaseController = null;
  }

  #openAfterPointerRelease(event, x, y) {
    this.#cancelPendingRelease();
    let controller = new AbortController();
    this.#releaseController = controller;
    let sourcePointerId = Number(event.pointerId);
    if (!Number.isFinite(sourcePointerId)) sourcePointerId = null;

    let cancel = () => {
      if (this.#releaseController !== controller) return;
      this.#releaseController = null;
      controller.abort();
      this.hide();
    };
    let release = (pointerEvent) => {
      if (sourcePointerId !== null && pointerEvent.pointerId !== sourcePointerId) return;
      if (pointerEvent.button !== 2) return;
      if (this.#releaseController !== controller) return;
      this.#releaseController = null;
      controller.abort();
      this.#scheduleOpen(x, y);
    };
    window.addEventListener('pointerup', release, { signal: controller.signal });
    window.addEventListener('pointercancel', cancel, { signal: controller.signal });
    window.addEventListener('blur', cancel, { signal: controller.signal });
  }

  /**
   * Show action descriptors at viewport coordinates.
   * @param {number} x
   * @param {number} y
   * @param {Array<object>} items
   * @param {Element|null} [triggerEl]
   * @param {PointerEvent|MouseEvent|null} [activationEvent]
   */
  show(x, y, items, triggerEl = document.activeElement, activationEvent = null) {
    this.#cancelPendingRelease();
    if (this.#openTimer !== null) {
      clearTimeout(this.#openTimer);
      this.#openTimer = null;
    }
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

    this.style.left = `${x}px`;
    this.style.top = `${y}px`;
    bringOverlayToFront(this);
    this.$.visible = true;
    if (activationEvent && (activationEvent.buttons & 2) !== 0) {
      this.#openAfterPointerRelease(activationEvent, x, y);
    } else {
      this.#scheduleOpen(x, y);
    }
  }

  hide() {
    this.#cancelPendingRelease();
    if (this.#openTimer !== null) {
      clearTimeout(this.#openTimer);
      this.#openTimer = null;
    }
    this.$.visible = false;
    this.#hideNativePopover();
    this.$.items = [];
    this._actions.clear();
    if (this.#triggerEl && typeof this.#triggerEl.focus === 'function') {
      this.#triggerEl.focus();
    }
    this.#triggerEl = null;
  }

  // Fires for native light-dismiss (Escape / outside click) as well as our own
  // showPopover()/hidePopover() calls; hide() is idempotent once $.visible is false.
  #onBeforeToggle = (event) => {
    this.#popoverOpen = event.newState === 'open';
  };

  #onToggle = (event) => {
    this.#popoverOpen = event.newState === 'open';
    if (event.newState === 'closed' && this.#releaseController === null && this.#openTimer === null) {
      this.hide();
    }
  };

  connectedCallback() {
    super.connectedCallback?.();
    if (!this.hasAttribute('popover')) {
      this.setAttribute('popover', 'auto');
    }
    this.addEventListener('beforetoggle', this.#onBeforeToggle);
    this.addEventListener('toggle', this.#onToggle);
  }

  disconnectedCallback() {
    this.#cancelPendingRelease();
    if (this.#openTimer !== null) {
      clearTimeout(this.#openTimer);
      this.#openTimer = null;
    }
    this.removeEventListener('beforetoggle', this.#onBeforeToggle);
    this.removeEventListener('toggle', this.#onToggle);
    super.disconnectedCallback?.();
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
