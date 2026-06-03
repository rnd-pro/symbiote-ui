import Symbiote from '@symbiotejs/symbiote';
import '../ChatSidebarItem/ChatSidebarItem.js';
import template from './ChatSidebar.tpl.js';
import css from './ChatSidebar.css.js';
import { translate } from '../../locale/index.js';
import {
  AUTO_COLLAPSE_WIDTH,
  AUTO_UNCOLLAPSE_WIDTH,
  COLLAPSE_DRAG_THRESHOLD,
  COLLAPSED_NAV_WIDTH,
  DEFAULT_NAV_WIDTH,
  MAX_NAV_WIDTH,
  MIN_NAV_WIDTH,
  clampChatSidebarWidth,
} from './constants.js';

export {
  AUTO_COLLAPSE_WIDTH,
  AUTO_UNCOLLAPSE_WIDTH,
  COLLAPSE_DRAG_THRESHOLD,
  COLLAPSED_NAV_WIDTH,
  DEFAULT_NAV_WIDTH,
  MAX_NAV_WIDTH,
  MIN_NAV_WIDTH,
  clampChatSidebarWidth,
} from './constants.js';

function emit(el, type, detail = {}) {
  el.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

export class ChatSidebarShell extends Symbiote {
  static isoMode = true;

  init$ = {
    navCollapsed: true,
    navWidth: DEFAULT_NAV_WIDTH,
    groupDividers: true,
    chats: [],
    title: translate('chat.sidebar.title'),
    newChatTitle: translate('chat.sidebar.new'),
    onToggleNav: () => {
      this._autoCollapsed = false;
      this.setCollapsed(!this.$.navCollapsed);
    },
    onResizeStart: (event) => {
      this._startResize(event);
    },
    onNewChat: () => {
      emit(this, 'chat-sidebar-new');
    },
    onChatClick: (event) => {
      this._handleChatClick(event);
    },
  };

  initCallback() {
    this.sub('navCollapsed', (value) => {
      this._applyNavWidth();
      emit(this, 'chat-sidebar-collapse-change', {
        collapsed: Boolean(value),
        auto: Boolean(this._autoCollapsed),
      });
    });

    this.sub('navWidth', (value) => {
      this._applyNavWidth();
      emit(this, 'chat-sidebar-width-change', {
        width: clampChatSidebarWidth(Number(value) || DEFAULT_NAV_WIDTH),
      });
    });

    this.sub('groupDividers', () => {
      this._applyGroupDividers();
    });

    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver(() => this._syncCollapseForAvailableWidth());
      let shell = this.closest('.chat-shell') || this.parentElement;
      if (shell) this._resizeObserver.observe(shell);
    }

    queueMicrotask(() => {
      this._applyNavWidth();
      this._applyGroupDividers();
      this._syncCollapseForAvailableWidth();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._resizeObserver?.disconnect();
  }

  setChats(chats = []) {
    this.$.chats = Array.isArray(chats) ? chats : [];
    let raf = globalThis.requestAnimationFrame || ((callback) => setTimeout(callback, 0));
    raf(() => this.syncExpandedChatItems(this.$.chats));
  }

  setCollapsed(collapsed, { auto = false } = {}) {
    this._autoCollapsed = auto;
    this.$.navCollapsed = Boolean(collapsed);
  }

  setWidth(width) {
    this.$.navWidth = clampChatSidebarWidth(Number(width) || DEFAULT_NAV_WIDTH);
  }

  setGroupDividers(enabled) {
    this.$.groupDividers = Boolean(enabled);
  }

  _applyNavWidth() {
    let width = this.$.navCollapsed ? COLLAPSED_NAV_WIDTH : clampChatSidebarWidth(this.$.navWidth);
    this.style.setProperty('--chat-nav-width', `${width}px`);
    let nav = this.querySelector('.chat-nav');
    if (nav) nav.toggleAttribute('collapsed', this.$.navCollapsed);
    this.toggleAttribute('collapsed', this.$.navCollapsed);
  }

  _applyGroupDividers() {
    let nav = this.querySelector('.chat-nav');
    if (nav) nav.toggleAttribute('data-group-dividers', Boolean(this.$.groupDividers));
  }

  _syncCollapseForAvailableWidth() {
    if (this._isResizing) return;
    let shell = this.closest('.chat-shell') || this.parentElement;
    if (!shell) return;
    let width = shell.getBoundingClientRect().width;
    if (width <= AUTO_COLLAPSE_WIDTH && !this.$.navCollapsed) {
      this.setCollapsed(true, { auto: true });
    } else if (width >= AUTO_UNCOLLAPSE_WIDTH && this.$.navCollapsed && this._autoCollapsed) {
      this.setCollapsed(false, { auto: false });
    }
  }

  _startResize(event) {
    event.preventDefault();
    event.stopPropagation();

    let nav = this.querySelector('.chat-nav');
    let handle = this.querySelector('.chat-nav-resize-handle');
    if (!nav) return;

    let startX = event.clientX;
    let startWidth = this.$.navCollapsed ? COLLAPSED_NAV_WIDTH : nav.getBoundingClientRect().width;
    let wasCollapsed = this.$.navCollapsed;
    this._isResizing = true;
    this.setAttribute('resizing', '');
    handle?.classList.add('dragging');
    nav.setAttribute('resizing', '');

    let onMove = (moveEvent) => {
      let rawWidth = startWidth + (moveEvent.clientX - startX);
      if (wasCollapsed && rawWidth > COLLAPSE_DRAG_THRESHOLD) {
        this.setCollapsed(false);
        wasCollapsed = false;
        startX = moveEvent.clientX;
        startWidth = MIN_NAV_WIDTH;
        this.setWidth(startWidth);
        return;
      }

      if (!wasCollapsed && rawWidth < COLLAPSE_DRAG_THRESHOLD) {
        this.setCollapsed(true);
        return;
      }

      if (!this.$.navCollapsed) {
        this.setWidth(rawWidth);
      }
    };

    let onUp = () => {
      handle?.classList.remove('dragging');
      nav.removeAttribute('resizing');
      this.removeAttribute('resizing');
      this._isResizing = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      this._autoCollapsed = false;
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  _handleChatClick(event) {
    let btnDelete = event.target.closest('.chat-item-delete');
    let item = event.target.closest('.chat-item, .chat-item-child');
    if (!item) return;

    let chatId = item.dataset.id;
    if (btnDelete) {
      event.stopPropagation();
      emit(this, 'chat-sidebar-delete', { id: chatId });
      return;
    }

    let expandIcon = event.target.closest('.chat-expand-icon');
    if (expandIcon) {
      event.stopPropagation();
      let subContainer = this.querySelector(`.chat-sub-items[data-parent="${chatId}"]`);
      if (!subContainer) return;
      let isExpanded = subContainer.hasAttribute('expanded');
      subContainer.toggleAttribute('expanded', !isExpanded);
      item.classList.toggle('chat-item-expanded', !isExpanded);
      emit(this, 'chat-sidebar-toggle', { id: chatId, expanded: !isExpanded });
      return;
    }

    if (chatId) {
      emit(this, 'chat-sidebar-select', { id: chatId });
    }
  }

  syncExpandedChatItems(chats = this.$.chats) {
    for (let chat of chats || []) {
      let item = [...this.querySelectorAll('chat-sidebar-item')].find((el) => el.$?.id === chat.id);
      if (!item) continue;
      item.$.isExpanded = Boolean(chat.isExpanded);
    }
  }
}

ChatSidebarShell.template = template;
ChatSidebarShell.rootStyles = css;
ChatSidebarShell.reg('chat-sidebar-shell');
