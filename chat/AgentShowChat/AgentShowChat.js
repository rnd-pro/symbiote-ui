import Symbiote from '@symbiotejs/symbiote';
import { AgentShowConversation, assertAgentShowProvider } from '../agent-show.js';
import template from './AgentShowChat.tpl.js';
import css from './AgentShowChat.css.js';

function emit(el, type, detail = {}) {
  el.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

export class AgentShowChat extends Symbiote {
  init$ = { hasPlayer: false };

  constructor() {
    super();
    this._shows = new Map();
    this._conversation = new AgentShowConversation({
      onChange: ({ messageItems }) => this._renderMessages(messageItems),
    });
  }

  connectedCallback() {
    super.connectedCallback?.();
    if (this._eventsBound) return;
    this._eventsBound = true;
    this.addEventListener('chat-workspace-submit', this._onSubmit);
    this.addEventListener('chat-workspace-send', this._onSubmit);
    this.addEventListener('chat-workspace-stop', this._onStop);
    this.addEventListener('chat-workspace-action', this._onAction);
    this.addEventListener('chat-workspace-embeds-ready', this._onEmbedsReady);
    this.addEventListener('chat-show-close-request', this._onShowClose);
    this._renderMessages(this._conversation.messageItems);
  }

  disconnectedCallback() {
    this._eventsBound = false;
    this.removeEventListener('chat-workspace-submit', this._onSubmit);
    this.removeEventListener('chat-workspace-send', this._onSubmit);
    this.removeEventListener('chat-workspace-stop', this._onStop);
    this.removeEventListener('chat-workspace-action', this._onAction);
    this.removeEventListener('chat-workspace-embeds-ready', this._onEmbedsReady);
    this.removeEventListener('chat-show-close-request', this._onShowClose);
    this._abort?.abort();
    super.disconnectedCallback?.();
  }

  _onSubmit = (event) => {
    let value = String(event.detail?.value ?? this.getWorkspace()?.getComposer()?.$.value ?? '').trim();
    void this.submit(value);
  };

  _onStop = () => {
    this._abort?.abort();
  };

  _onAction = (event) => {
    let detail = event.detail || {};
    emit(this, 'agent-show-action', detail);
    void this._respond({
      type: 'action',
      id: String(detail.id || ''),
      actionId: String(detail.actionId || ''),
      payload: detail.payload ?? null,
    });
  };

  _onEmbedsReady = (event) => {
    for (let { key, slot } of event.detail?.embeds || []) {
      let player = this._shows.get(key)?.player;
      if (!player || !slot) continue;
      emit(this, 'agent-show-embed-ready', {
        key,
        player,
        slot,
        playerRegion: this.ref.playerRegion || null,
        fixed: true,
      });
    }
  };

  _onShowClose = (event) => {
    let match = [...this._shows.entries()].find(([, record]) => record.player === event.target);
    if (!match) return;
    event.preventDefault();
    this.removeShow(match[0]);
    emit(this, 'agent-show-embed-close', { key: match[0] });
  };

  getWorkspace() {
    return this.ref.workspace || this.querySelector('chat-workspace');
  }

  setAgentProvider(provider) {
    this._conversation.setProvider(assertAgentShowProvider(provider));
    return this;
  }

  setMessages(messages = []) {
    this._conversation.setMessages(messages);
    return this;
  }

  setShow(key, config = {}) {
    let normalizedKey = String(key || '').trim();
    if (!normalizedKey) throw new TypeError('embedded show key must be a non-empty string');
    let record = this._shows.get(normalizedKey);
    let player = record?.player || document.createElement('chat-show-player');
    player.bind(config);
    this._shows.set(normalizedKey, { player, config });
    this._activeShowKey = normalizedKey;
    this._syncPlayerRegion();
    return player;
  }

  removeShow(key, { stop = true } = {}) {
    let record = this._shows.get(String(key || ''));
    if (!record) return false;
    if (stop) record.config?.controller?.stop?.();
    record.player.remove();
    this._shows.delete(String(key || ''));
    if (this._activeShowKey === String(key || '')) {
      this._activeShowKey = [...this._shows.keys()].at(-1) || '';
    }
    this._syncPlayerRegion();
    return true;
  }

  async submit(value) {
    let input = String(value || '').trim();
    if (!input) return [];
    this.getWorkspace()?.getComposer()?.setValue?.('');
    return this._respond({ type: 'message', input });
  }

  async _respond(request) {
    this._abort?.abort();
    let abort = new AbortController();
    this._abort = abort;
    this.getWorkspace()?.setComposerState?.({ sending: true, disabled: false });
    this.getWorkspace()?.setBackgroundState?.({ state: 'responding', active: true });
    try {
      let messages = await this._conversation.respond({ ...request, signal: abort.signal });
      emit(this, 'agent-show-response', { request, messages });
      return messages;
    } catch (error) {
      if (abort.signal.aborted) return [];
      this._conversation.append({ role: 'agent', parts: [{ type: 'error', text: error?.message || String(error) }] });
      emit(this, 'agent-show-error', { request, error });
      return [];
    } finally {
      if (this._abort === abort) this._abort = null;
      this.getWorkspace()?.setComposerState?.({ sending: false, disabled: false });
      this.getWorkspace()?.setBackgroundState?.({ state: 'idle', active: false });
    }
  }

  _renderMessages(messageItems = []) {
    let workspace = this.getWorkspace();
    if (!workspace) return;
    workspace.setEmpty?.(messageItems.length === 0);
    workspace.setMessages?.(messageItems);
    queueMicrotask(() => this._syncPlayerRegion());
  }

  _syncPlayerRegion() {
    let region = this.ref.playerRegion;
    if (!region) return;
    let player = this._shows.get(this._activeShowKey)?.player || null;
    if (player && player.parentElement !== region) region.replaceChildren(player);
    else if (!player && region.childNodes.length) region.replaceChildren();
    this.$.hasPlayer = Boolean(player);
  }
}

AgentShowChat.template = template;
AgentShowChat.rootStyles = css;
AgentShowChat.reg('agent-show-chat');

export default AgentShowChat;
