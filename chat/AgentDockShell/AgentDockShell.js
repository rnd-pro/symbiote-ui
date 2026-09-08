import Symbiote from '@symbiotejs/symbiote';
import { slotProcessor } from '@symbiotejs/symbiote/core/slotProcessor.js';
import * as LayoutTree from '../../layout/LayoutTree.js';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import template from './AgentDockShell.tpl.js';
import css from './AgentDockShell.css.js';

const DEFAULT_MIN_SIZE = 320;
const DEFAULT_BREAKPOINT = 760;
const DEFAULT_DOCK_SPLIT_RATIO = 0.67;
// The Show panel contains both a transport header and playback controls.
// On a handset-height layout it needs a useful initial block size, while the
// workspace above still retains enough room to be navigated.  The first split
// child is the workspace, so 0.62 leaves the Show panel with about 38%.
const DEFAULT_SHOW_PANEL_RATIO = 0.62;

function createDefaultDockTree(main, chat, breakpoint) {
  return LayoutTree.createSplit('horizontal', main, chat, DEFAULT_DOCK_SPLIT_RATIO, {
    importance: 100,
    minInlineSize: 720,
    minBlockSize: 320,
    collapse: 'never',
    overflow: 'scroll-inline',
    responsiveMode: 'drawer',
    responsiveBreakpoint: breakpoint,
    mobileDock: 'auto',
    swipeControl: 'rail',
  });
}

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
    this.addEventListener('chat-show-layout-request', this._onShowLayoutRequest);
    this.addEventListener('agent-show-embed-close', this._onShowEmbedClose);
    this.ref.layout?.addEventListener('layout-ui-panel-open', this._onLayoutUiPanelOpen);
    this.ref.layout?.addEventListener('layout-ui-panel-close', this._onLayoutUiPanelClose);
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
    this.removeEventListener('chat-show-layout-request', this._onShowLayoutRequest);
    this.removeEventListener('agent-show-embed-close', this._onShowEmbedClose);
    this.ref.layout?.removeEventListener('layout-ui-panel-open', this._onLayoutUiPanelOpen);
    this.ref.layout?.removeEventListener('layout-ui-panel-close', this._onLayoutUiPanelClose);
    this._restoreShowPlayer();
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

  resetPanelLayout(source = 'api') {
    let layout = this.ref.layout;
    let current = layout?.$.layoutTree;
    if (!layout || !current) return false;
    let next = LayoutTree.clone(current);
    let main = LayoutTree.findPanelByType(next, 'agent-dock-main');
    let chat = LayoutTree.findPanelByType(next, 'agent-chat');
    if (!main || !chat) return false;
    let show = LayoutTree.findPanelByType(next, 'agent-show-panel', { uiInvoked: true });
    let contains = (node, id) => Boolean(node && (node.id === id || (
      node.type === 'split' && (contains(node.first, id) || contains(node.second, id))
    )));
    let resetRatios = (node) => {
      if (node?.type !== 'split') return;
      if (contains(node.first, main.id) && contains(node.second, chat.id)) node.ratio = DEFAULT_DOCK_SPLIT_RATIO;
      if (show && contains(node.first, main.id) && contains(node.second, show.id)) node.ratio = DEFAULT_SHOW_PANEL_RATIO;
      resetRatios(node.first);
      resetRatios(node.second);
    };
    resetRatios(next);
    layout.setLayout(next);
    queueMicrotask(() => {
      this._mountMain();
      if (show && !show.collapsed && show.panelState?.closed !== true) {
        this._showPanelId = show.id;
        this._mountShowPanel();
      }
    });
    emit(this, 'agent-dock-layout-reset', { source });
    return true;
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
    layout.registerPanelType('agent-show-panel', {
      title: 'CV Show',
      icon: 'auto_stories',
      headerClose: true,
      component: 'section',
      attributes: { 'data-agent-show-panel-host': '' },
      behavior: {
        importance: 92,
        minInlineSize: 320,
        minBlockSize: 240,
        collapse: 'manual',
        responsiveMode: 'drawer',
        responsiveBreakpoint: breakpoint,
        mobileDock: 'primary',
        swipeControl: 'none',
      },
    });
    let main = LayoutTree.createPanel('agent-dock-main', { source: 'agent-dock-shell' });
    let chat = LayoutTree.createPanel('agent-chat', { source: 'agent-dock-shell' });
    chat.collapsed = !this.$.open;
    this._mainPanelId = main.id;
    this._dockPanelId = chat.id;
    layout.setLayout(createDefaultDockTree(main, chat, breakpoint));
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
    const mainSlot = this.ref.source?.querySelector?.('slot[name="main"]');
    // slotProcessor keeps named content assigned to its source slot, rather
    // than as a direct child of the hidden source wrapper.  Read the assigned
    // elements first so the actual workspace is never lost when the dock is
    // rebuilt or its native mobile drawer projection changes.
    let mainItems = [
      ...Array.from(mainSlot?.assignedElements?.() || []),
      ...Array.from(this.ref.source?.children || []).filter((item) => item !== mainSlot),
      ...Array.from(this.querySelectorAll('[slot="main"]')),
    ].filter((item) => !host.contains(item));
    for (let item of new Set(mainItems)) host.append(item);
  }

  _preserveMain() {
    const host = this.ref.layout?.querySelector?.('[data-agent-dock-main-host]');
    const source = this.ref.source;
    if (!host || !source) return;
    // `panel-layout.openPanel()` rebuilds the node that owns this host. Keep
    // the slotted workspace outside that disposable node first, then
    // `_mountMain()` attaches it to the replacement host.
    for (const item of Array.from(host.children)) source.append(item);
  }

  _isDrawerMode() {
    return Boolean(this.ref.layout?.hasAttribute?.('drawer-mode-active'));
  }

  _allowsShowPanelInMobile() {
    return this.hasAttribute('show-panel-mobile');
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
        if (this._showPanelId && !this._allowsShowPanelInMobile()) layout.closeUiPanel?.('agent-show-panel');
        if (this.$.open) layout.openDrawer?.('end', this._dockPanelId);
        else layout.closeDrawer?.('end');
      }
      emit(this, 'agent-dock-responsive-change', { mobile });
    });
    this._layoutModeObserver.observe(layout, { attributes: true, attributeFilter: ['drawer-mode-active'] });
    // A layout may already be in drawer mode before the observer is attached.
    // Publish that initial state so an embedded workspace can configure its
    // own responsive layout immediately.
    queueMicrotask(() => emit(this, 'agent-dock-responsive-change', {
      mobile: this._isDrawerMode() || this._showPanelMobileMode,
    }));
  }

  _setLayoutOpen(open) {
    let layout = this.ref.layout;
    if (!layout) return;
    let mobile = this._isDrawerMode();
    if (mobile) {
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
      // In drawer mode the dock is open only while the end drawer shows the
      // chat itself: the mobile Show panel shares the end dock, and its
      // drawer must not flip the dock open.
      let layout = this.ref.layout;
      let open = this._isDrawerMode()
        ? Boolean(layout?.$.drawerEndOpen) && layout?.$.drawerEndPanelId === this._dockPanelId
        : !Boolean(LayoutTree.findNode(layout?.$.layoutTree, this._dockPanelId)?.collapsed);
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

  _onShowLayoutRequest = (event) => {
    if (!event.detail || event.target?.localName !== 'chat-show-player') return;
    if (event.detail.placement === 'inline') {
      this.ref.layout?.closeUiPanel?.('agent-show-panel');
      return;
    }
    if (event.detail.placement !== 'panel') return;
    let mobile = this._isDrawerMode();
    if (mobile && !this._allowsShowPanelInMobile()) {
      emit(this, 'agent-show-layout-change', { placement: 'inline', reason: 'responsive-drawer' });
      return;
    }
    let layout = this.ref.layout;
    // Opening a native panel replaces its target node. Preserve the workspace
    // before that replacement so the new primary host never becomes blank.
    this._preserveMain();
    if (mobile) this._showPanelMobileMode = true;
    layout?.openPanel?.('agent-show-panel', {
      direction: 'vertical',
      ratio: DEFAULT_SHOW_PANEL_RATIO,
      targetPanelId: this._mainPanelId,
      targetBehavior: {
        mobileDock: 'primary',
        swipeControl: 'none',
        drawerGroup: true,
      },
      source: 'chat-show-player',
      uiInvoked: true,
      panelState: { placement: 'panel' },
    });
  };

  _onLayoutUiPanelOpen = (event) => {
    if (event.detail?.panelType !== 'agent-show-panel') return;
    this._showPanelId = event.detail.panelId;
    queueMicrotask(() => this._mountShowPanel());
  };

  _onLayoutUiPanelClose = (event) => {
    if (event.detail?.panelType !== 'agent-show-panel') return;
    // Dismissing the mobile Show panel (collapse or remove) ends the show:
    // inline restore would land in the closed chat drawer, invisible.
    let closeShow = this._showPanelMobileMode
      && this.hasAttribute('show-panel-mobile-close-show')
      && (event.detail?.removed === true || event.detail?.closed === true);
    let player = this.getChat()?.getShowPlayer?.() || null;
    this._restoreShowPlayer();
    if (this._showPanelMobileMode) {
      this._showPanelMobileMode = false;
      this.ref.layout?.setAttribute('responsive-mode', 'drawer');
    }
    if (closeShow) player?.requestClose?.();
  };

  _onShowEmbedClose = () => {
    if (this._showPanelId) this.ref.layout?.closeUiPanel?.('agent-show-panel');
  };

  _mountShowPanel() {
    let host = this.ref.layout?.querySelector?.('[data-agent-show-panel-host]');
    let chat = this.getChat();
    let player = chat?.getShowPlayer?.() || null;
    if (!host || !chat || !player) {
      if (this.isConnected && this._showPanelId && typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => this._mountShowPanel());
      }
      return;
    }
    host.classList.add('agent-show-panel-host');
    host.closest('layout-node')?.classList.add('agent-show-panel-node');
    if (this._showPanelMobileMode) {
      for (let panelId of [this._mainPanelId, this._showPanelId]) {
        let node = Array.from(this.ref.layout?.querySelectorAll?.('layout-node') || [])
          .find((candidate) => candidate.$?.nodeId === panelId);
        node?.setAttribute('drawer-group-member', '');
        node?.style.setProperty('position', 'relative', 'important');
        node?.style.setProperty('inset', 'auto', 'important');
        node?.style.setProperty('transform', 'none', 'important');
        node?.style.setProperty('flex', 'none', 'important');
        node?.style.setProperty('width', '100%', 'important');
        node?.style.setProperty('height', '100%', 'important');
        let splitItem = node?.parentElement;
        if (splitItem?.style.height) splitItem.style.setProperty('flex', `0 0 ${splitItem.style.height}`, 'important');
      }
    }
    chat.setPlayerHost(host);
    player.setLayoutPlacement?.('panel');
    emit(this, 'agent-show-layout-change', { placement: 'panel', player, panelId: this._showPanelId });
  }

  _restoreShowPlayer() {
    let chat = this.getChat();
    let player = chat?.getShowPlayer?.() || null;
    this.ref.layout?.querySelectorAll?.('layout-node[drawer-group-member]').forEach((node) => {
      node.removeAttribute('drawer-group-member');
      for (let property of ['position', 'inset', 'transform', 'flex', 'width', 'height']) {
        node.style.removeProperty(property);
      }
      node.parentElement?.style.removeProperty('flex');
    });
    chat?.setPlayerHost?.(null);
    player?.setLayoutPlacement?.('inline');
    if (this._showPanelId) {
      emit(this, 'agent-show-layout-change', { placement: 'inline', player, panelId: this._showPanelId });
    }
    this._showPanelId = null;
  }

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
