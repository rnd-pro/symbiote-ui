import Symbiote, { html } from '@symbiotejs/symbiote';
import '../ChatMessageItem/ChatMessageItem.js';
import css from './ChatTranscript.css.js';

function emit(el, type, detail = {}) {
  el.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

export class ChatTranscript extends Symbiote {
  static isoMode = true;

  init$ = {
    messageItems: [],
    onScroll: () => {
      this.updateScrollBottomButton();
      emit(this, 'chat-transcript-scroll', this.getScrollState());
    },
    onScrollToBottom: () => {
      this.scrollToBottom({ smooth: true });
      emit(this, 'chat-transcript-scroll-bottom');
    },
    onMessageItemClick: (event) => {
      this._handleMessageItemClick(event);
    },
  };

  setMessageItems(items = []) {
    this.$.messageItems = Array.isArray(items) ? items : [];
  }

  getScrollContainer() {
    return this.ref.chatMessages || this.querySelector('.chat-messages');
  }

  isAtBottom(tolerance = 10) {
    let container = this.getScrollContainer();
    if (!container) return true;
    return container.scrollHeight - container.scrollTop <= container.clientHeight + tolerance;
  }

  getScrollState() {
    let container = this.getScrollContainer();
    if (!container) return { hasOverflow: false, isAtBottom: true };
    return {
      hasOverflow: container.scrollHeight > container.clientHeight + 12,
      isAtBottom: container.scrollHeight - container.scrollTop <= container.clientHeight + 32,
    };
  }

  scrollToBottom({ smooth = false } = {}) {
    let container = this.getScrollContainer();
    if (!container) return;
    if (smooth && typeof container.scrollTo === 'function') {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else {
      container.scrollTop = container.scrollHeight;
    }
    this.updateScrollBottomButton();
  }

  updateScrollBottomButton() {
    let btn = this.ref.scrollBottomBtn;
    if (!btn) return;
    let state = this.getScrollState();
    btn.classList.toggle('visible', state.hasOverflow && !state.isAtBottom);
  }

  findStatusBoard(cardIds = []) {
    let container = this.getScrollContainer();
    if (!container || !cardIds?.length) return null;
    let firstCard = container.querySelector(`[data-card-id="${this._cssEscape(cardIds[0])}"]`);
    return firstCard?.closest('.status-board') || null;
  }

  updateStatusCard(cardId, cardData = {}, options = {}) {
    let root = options.board || this.getScrollContainer();
    if (!root || !cardId) return null;
    let card = root.querySelector(`[data-card-id="${this._cssEscape(cardId)}"]`);
    if (!card) return null;

    let status = cardData.status || 'running';
    let isDone = status === 'done' || status === 'error' || status === 'cancelled' || status === 'lost';
    card.dataset.status = isDone ? status : 'running';

    let iconEl = card.querySelector('.status-card-header .material-symbols-outlined');
    if (iconEl) {
      iconEl.className = `material-symbols-outlined ${isDone ? '' : 'spin-icon'}`.trim();
      iconEl.textContent = isDone ? (status === 'done' ? 'check_circle' : 'error') : 'pending';
      iconEl.dataset.status = isDone ? status : 'running';
    }

    let statusEl = card.querySelector('.status-card-status');
    if (statusEl) {
      if (isDone) {
        statusEl.textContent = status === 'done' ? 'Completed' : status === 'error' ? 'Failed' : 'Cancelled';
      } else {
        let elapsed = this._formatElapsed(cardData.startedAt || cardData.updatedAt);
        statusEl.textContent = `Running${elapsed ? ' - ' + elapsed : ''}`;
      }
    }

    if (cardData.linkId && !card.dataset.linkId) {
      card.dataset.linkId = cardData.linkId;
      card.classList.add('status-card-linked');
    }

    let titleEl = card.querySelector('.card-title');
    if (titleEl && cardData.title) {
      titleEl.textContent = cardData.title;
    }

    return card;
  }

  renderLiveStatus(meta) {
    let container = this.getScrollContainer();
    if (!container) return;
    let existing = container.querySelector('.live-status-indicator');
    if (existing) existing.remove();
    if (!meta) return;

    let icon = 'pending';
    let text = 'Processing...';
    let spinClass = 'spin-icon';

    if (meta.phase === 'thinking') {
      text = meta.thinkingStatus || 'Thinking...';
    } else if (meta.phase === 'tool') {
      icon = 'build_circle';
      text = `Running: ${meta.lastToolName || 'tool'}`;
    } else if (meta.phase === 'responding') {
      icon = 'edit_note';
      text = 'Writing response...';
      spinClass = '';
    }

    let indicator = document.createElement('div');
    indicator.className = 'live-status-indicator';
    let iconEl = document.createElement('span');
    iconEl.className = `material-symbols-outlined ${spinClass}`.trim();
    iconEl.textContent = icon;
    let textEl = document.createElement('span');
    textEl.textContent = text;
    indicator.append(iconEl, ' ', textEl);
    container.appendChild(indicator);
    requestAnimationFrame(() => this.scrollToBottom());
  }

  _handleMessageItemClick(event) {
    let copyBtn = event.target.closest('.work-copy-btn');
    if (copyBtn) {
      event.preventDefault();
      event.stopPropagation();
      this._copyMessageText(copyBtn.dataset.copyText || '', copyBtn);
      return;
    }

    let card = event.target.closest('.status-card');
    if (card) {
      emit(this, 'status-card-open', {
        id: card.dataset.cardId || '',
        linkId: card.dataset.linkId || '',
        card,
      });
    }
  }

  _cssEscape(value) {
    let str = String(value || '');
    return globalThis.CSS?.escape ? CSS.escape(str) : str.replace(/["\\]/g, '\\$&');
  }

  _formatElapsed(timestamp) {
    if (!timestamp) return '';
    let seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (seconds < 60) return `${seconds}s`;
    let minutes = Math.floor(seconds / 60);
    let remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    let hours = Math.floor(minutes / 60);
    let remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  async _copyMessageText(text, btn) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        this._copyTextFallback(text);
      }
      this._flashCopyButton(btn, 'check');
      emit(this, 'message-copy', { text, ok: true });
    } catch {
      if (this._copyTextFallback(text)) {
        this._flashCopyButton(btn, 'check');
        emit(this, 'message-copy', { text, ok: true });
      } else {
        this._flashCopyButton(btn, 'error');
        emit(this, 'message-copy', { text, ok: false });
      }
    }
  }

  _copyTextFallback(text) {
    let ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }

  _flashCopyButton(btn, iconName) {
    if (!btn) return;
    let icon = btn.querySelector('.material-symbols-outlined');
    let original = icon?.textContent || 'content_copy';
    btn.classList.add(iconName === 'check' ? 'copied' : 'copy-error');
    if (icon) icon.textContent = iconName;
    setTimeout(() => {
      btn.classList.remove('copied', 'copy-error');
      if (icon) icon.textContent = original;
    }, 1200);
  }
}

ChatTranscript.template = html`
<div ref="chatMessages" class="chat-messages" ${{ itemize: 'messageItems', 'item-tag': 'chat-message-item', onscroll: 'onScroll' }}></div>
<button class="scroll-bottom-btn" ref="scrollBottomBtn" title="Scroll to bottom" ${{ onclick: 'onScrollToBottom' }}>
  <span class="material-symbols-outlined">arrow_downward</span>
</button>
`;

ChatTranscript.rootStyles = css;
ChatTranscript.reg('chat-transcript');
