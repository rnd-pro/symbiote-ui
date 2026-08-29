import Symbiote from '@symbiotejs/symbiote';
import { slotProcessor } from '@symbiotejs/symbiote/core/slotProcessor.js';
import * as LayoutTree from '../../layout/LayoutTree.js';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import template from './AgentDockShell.tpl.js';
import css from './AgentDockShell.css.js';

const DEFAULT_MIN_SIZE = 320;
const DEFAULT_BREAKPOINT = 760;

function numberAttr(element, name, fallback) {
  let value = Number(element.getAttribute(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function emit(element, type, detail = {}) {
  element.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

export class AgentDockShell extends Symbiote {
  init$ = { open: true, dockLabel: 'Agent' };

  constructor() {
    super();
    this.templateProcessors.add(slotProcessor);
    this._pendingShows = new Map();
  }

  connectedCallback() {
    super.connectedCallback?.();
    ensureMaterialSymbols(['smart_toy', 'forum']);
    this.$.dockLabel = this.getAttribute('label') || 'Agent';
    this.$.open = !this.hasAttribute('closed');
    this.toggleAttribute('open', this.$.open);
    this._configureLayout();
    this._observeLayoutMode();
    this.addEventListener('panel-collapse-toggle', this._onPanelCollapseToggle);
    this.addEventListener('panel-close', this._onPanelClose);
    this.addEventListener('chat-workspace-close', this._onPanelClose);
    queueMicrotask(() => {
      this._mountMain();
      this._flushComposition();
    });
  }

  disconnectedCallback() {
    this._layoutModeObserver?.disconnect();
    this.removeEventListener('panel-collapse-toggle', this._onPanelCollapseToggle);
    this.removeEventListener('panel-close', this._onPanelClose);
    this.removeEventListener('chat-workspace-close', this._onPanelClose);
    super.disconnectedCallback?.();
  }

  getChat() {
    return this.ref.layout?.querySelector?.('agent-show-chat') || null;
  }

  setAgentProvider(provider) {
    let chat = this.getChat();
    if (chat) chat.setAgentProvider?.(provider);
    else this._pendingAgentProvider = provider;
    return this;
  }

  setMessages(messages = [], options = {}) {
    let chat = this.getChat();
    if (chat) chat.setMessages?.(messages, options);
    else this._pendingMessages = { messages, options };
    return this;
  }

  setShow(key, config = {}) {
    let normalizedKey = String(key);
    let chat = this.getChat();
    if (chat) {
      this._pendingShows.delete(normalizedKey);
      return chat.setShow?.(normalizedKey, config) || null;
    }
    this._pendingShows.set(normalizedKey, config);
    return null;
  }

  removeShow(key, options) {
    this._pendingShows.delete(String(key));
    return this.getChat()?.removeShow?.(key, options) || false;
  }

  open(source = 'api') {
    if (this.$.open) return false;
    this.$.open = true;
    this.removeAttribute('closed');
    this.setAttribute('open', '');
    this._setLayoutOpen(true);
    emit(this, 'agent-dock-change', { open: true, source, mobile: this._isDrawerMode() });
    queueMicrotask(() => this._flushComposition());
    return true;
  }

  close(source = 'api') {
    if (!this.$.open) return false;
    this.$.open = false;
    this.removeAttribute('open');
    this.setAttribute('closed', '');
    this._setLayoutOpen(false);
    emit(this, 'agent-dock-change', { open: false, source, mobile: this._isDrawerMode() });
    return true;
  }

  toggle(source = 'api') {
    return this.$.open ? this.close(source) : this.open(source);
  }

  _configureLayout() {
    let layout = this.ref.layout;
    if (!layout?.registerPanelType || this._layoutConfigured) return;
    this._layoutConfigured = true;
    let minSize = numberAttr(this, 'min-size', DEFAULT_MIN_SIZE);
    let breakpoint = numberAttr(this, 'responsive-breakpoint', DEFAULT_BREAKPOINT);
    layout.$.panelChrome = true;
    layout.setAttribute('responsive-mode', 'drawer');
    layout.setAttribute('responsive-breakpoint', String(breakpoint));
    layout.setAttribute('swipe-control', 'rail');
    layout.registerPanelType('agent-dock-main', {
      title: 'Workspace',
      icon: 'dashboard',
      component: 'section',
      attributes: { 'data-agent-dock-main-host': '' },
      behavior: {
        importance: 100,
        minInlineSize: 320,
        minBlockSize: 320,
        collapse: 'never',
        responsiveMode: 'drawer',
        responsiveBreakpoint: breakpoint,
        mobileDock: 'primary',
        swipeControl: 'none',
      },
    });
    layout.registerPanelType('agent-chat', {
      title: this.$.dockLabel,
      icon: 'smart_toy',
      component: 'agent-show-chat',
      behavior: {
        importance: 42,
        minInlineSize: minSize,
        minBlockSize: 320,
        collapse: 'manual',
        responsiveMode: 'drawer',
        responsiveBreakpoint: breakpoint,
        mobileDock: 'end',
        swipeControl: 'rail',
      },
    });
    let main = LayoutTree.createPanel('agent-dock-main', { source: 'agent-dock-shell' });
    let chat = LayoutTree.createPanel('agent-chat', { source: 'agent-dock-shell' });
    chat.collapsed = !this.$.open;
    this._mainPanelId = main.id;
    this._dockPanelId = chat.id;
    layout.setLayout(LayoutTree.createSplit('horizontal', main, chat, 0.67, {
      importance: 100,
      minInlineSize: 720,
      minBlockSize: 320,
      collapse: 'never',
      overflow: 'scroll-inline',
      responsiveMode: 'drawer',
      responsiveBreakpoint: breakpoint,
      mobileDock: 'auto',
      swipeControl: 'rail',
    }));
  }

  _mountMain() {
    let host = this.ref.layout?.querySelector?.('[data-agent-dock-main-host]');
    if (!host) {
      if (this.isConnected && typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => this._mountMain());
      }
      return;
    }
    host.classList.add('agent-dock-main-host');
    host.closest('layout-node')?.classList.add('agent-dock-main-node');
    let mainItems = [
      ...Array.from(this.ref.source?.children || []),
      ...Array.from(this.querySelectorAll('[slot="main"]')),
    ].filter((item) => !host.contains(item));
    for (let item of new Set(mainItems)) host.append(item);
  }

  _isDrawerMode() {
    return Boolean(this.ref.layout?.hasAttribute?.('drawer-mode-active'));
  }

  _observeLayoutMode() {
    let layout = this.ref.layout;
    if (!layout || typeof MutationObserver === 'undefined') return;
    this._layoutModeObserver?.disconnect();
    let previousMobile = this._isDrawerMode();
    this._layoutModeObserver = new MutationObserver((records) => {
      if (!records.some((record) => record.attributeName === 'drawer-mode-active')) return;
      let mobile = this._isDrawerMode();
      if (mobile === previousMobile) return;
      previousMobile = mobile;
      this.toggleAttribute('mobile', mobile);
      if (mobile) {
        if (this.$.open) layout.openDrawer?.('end', this._dockPanelId);
        else layout.closeDrawer?.('end');
      }
      emit(this, 'agent-dock-responsive-change', { mobile });
    });
    this._layoutModeObserver.observe(layout, { attributes: true, attributeFilter: ['drawer-mode-active'] });
  }

  _setLayoutOpen(open) {
    let layout = this.ref.layout;
    if (!layout) return;
    if (this._isDrawerMode()) {
      if (open) layout.openDrawer?.('end', this._dockPanelId);
      else layout.closeDrawer?.('end');
      return;
    }
    let node = LayoutTree.findNode(layout.$.layoutTree, this._dockPanelId);
    if (!node || Boolean(node.collapsed) === !open) return;
    layout.dispatchEvent(new CustomEvent('panel-collapse-toggle', {
      bubbles: true,
      composed: true,
      detail: { panelId: this._dockPanelId, collapsed: !open },
    }));
  }

  _onPanelCollapseToggle = (event) => {
    if (event.detail?.panelId !== this._dockPanelId) return;
    queueMicrotask(() => {
      let open = this._isDrawerMode()
        ? Boolean(this.ref.layout?.$.drawerEndOpen)
        : !Boolean(LayoutTree.findNode(this.ref.layout?.$.layoutTree, this._dockPanelId)?.collapsed);
      if (open === this.$.open) return;
      this.$.open = open;
      this.toggleAttribute('open', open);
      this.toggleAttribute('closed', !open);
      emit(this, 'agent-dock-change', { open, source: 'panel-layout', mobile: this._isDrawerMode() });
    });
  };

  _onPanelClose = (event) => {
    if (event.target === this || this.contains(event.target)) this.close('panel');
  };

  _flushComposition() {
    let chat = this.getChat();
    if (!chat) {
      if (this.isConnected && typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => this._flushComposition());
      }
      return;
    }
    if (this._pendingAgentProvider) {
      chat.setAgentProvider?.(this._pendingAgentProvider);
      this._pendingAgentProvider = null;
    }
    if (this._pendingMessages) {
      let pendingMessages = this._pendingMessages;
      this._pendingMessages = null;
      chat.setMessages?.(pendingMessages.messages, pendingMessages.options);
    }
    for (let [key, config] of this._pendingShows) {
      chat.setShow?.(key, config);
      this._pendingShows.delete(key);
    }
    emit(this, 'agent-dock-ready', { chat, workspace: chat.getWorkspace?.() || null });
  }
}

AgentDockShell.template = template;
AgentDockShell.rootStyles = css;
AgentDockShell.reg('agent-dock-shell');

export default AgentDockShell;
