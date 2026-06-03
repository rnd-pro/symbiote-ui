import Symbiote, { html } from '@symbiotejs/symbiote';
import { escapeHtml, formatMarkdown } from '../../display/markdown-formatter.js';
import { translate } from '../../locale/index.js';
import { summarizeToolInput } from '../message-model.js';
import css from './ChatMessageItem.css.js';

export function stringifyBlock(value) {
  if (value == null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export function truncateResult(value) {
  let text = stringifyBlock(value);
  return text.length > 500 ? `${text.slice(0, 500)}\n...` : text;
}

export class ChatMessageItem extends Symbiote {
  init$ = {
    type: '',
    role: '',
    text: '',
    isStreaming: false,
    isLatestTool: false,
    name: '',
    input: null,
    result: null,
    done: false,
    elapsedText: '',
    status: '',
    metaHtml: '',
    workSummaryHtml: '',
    copyText: '',
    cardItems: [],
    messageClass: 'message',
    bodyHtml: '',
  };

  renderCallback() {
    this.sub('type', () => this._renderBody());
    this.sub('role', () => this._renderBody());
    this.sub('text', () => this._renderBody());
    this.sub('isStreaming', () => this._renderBody());
    this.sub('isLatestTool', () => this._renderBody());
    this.sub('name', () => this._renderBody());
    this.sub('input', () => this._renderBody());
    this.sub('result', () => this._renderBody());
    this.sub('done', () => this._renderBody());
    this.sub('elapsedText', () => this._renderBody());
    this.sub('status', () => this._renderBody());
    this.sub('metaHtml', () => this._renderBody());
    this.sub('workSummaryHtml', () => this._renderBody());
    this.sub('copyText', () => this._renderBody());
    this.sub('cardItems', () => this._renderBody());
  }

  _renderBody() {
    let role = this.$.role || this.$.type;
    this.$.messageClass = `message ${role || ''}${this.$.isStreaming ? ' streaming' : ''}`.trim();

    if (role === 'tool') {
      this.$.bodyHtml = this._renderTool();
    } else if (role === 'board') {
      this.$.bodyHtml = this._renderBoard();
    } else if (role === 'thinking') {
      this.$.bodyHtml = this._renderThinking();
    } else {
      this.$.bodyHtml = this._renderTextMessage();
    }
  }

  _renderTool() {
    let icon = this.$.isStreaming ? 'build_circle' : 'build';
    let spinClass = this.$.isStreaming ? 'spin-icon' : '';
    let openAttr = this.$.isLatestTool ? ' open' : '';
    let summary = summarizeToolInput(this.$.input);
    let summaryHtml = summary
      ? `<span class="tool-summary" title="${escapeHtml(summary)}">${escapeHtml(summary)}</span>`
      : '';
    let htmlStr = `<details class="tool-card"${openAttr}>
      <summary class="tool-header"><span class="material-symbols-outlined tool-icon ${spinClass}">${icon}</span><span class="tool-name">${escapeHtml(this.$.name || 'tool')}</span>${summaryHtml}</summary>`;

    if (this.$.input) {
      htmlStr += `<div class="tool-section"><div class="tool-label">${escapeHtml(translate('chat.message.input'))}</div><pre class="tool-code">${escapeHtml(stringifyBlock(this.$.input))}</pre></div>`;
    }

    if (this.$.result) {
      htmlStr += `<div class="tool-section"><div class="tool-label">${escapeHtml(translate('chat.message.result'))}</div><pre class="tool-code">${escapeHtml(truncateResult(this.$.result))}</pre></div>`;
    } else if (this.$.isStreaming) {
      htmlStr += `<div class="tool-section tool-waiting"><em>${escapeHtml(translate('chat.message.running'))}</em></div>`;
    }

    return `${htmlStr}</details>`;
  }

  _renderBoard() {
    let cardsHtml = (this.$.cardItems || []).map((card) => {
      let id = String(card?.id || '');
      let title = card?.title || (id ? `${id.substring(0, 8)}...` : translate('chat.message.item'));
      let status = card?.status || (this.$.isStreaming ? 'running' : 'idle');
      let statusIcon = card?.icon || (status === 'running' ? 'pending' : 'schedule');
      let spinClass = status === 'running' ? 'spin-icon' : '';
      let statusText = card?.statusText || (status === 'running' ? translate('chat.message.running') : translate('chat.message.queued'));
      let linkedAttr = card?.linkId ? ` data-link-id="${escapeHtml(card.linkId)}"` : '';
      return `<div class="status-card" data-card-id="${escapeHtml(id)}"${linkedAttr} data-status="${escapeHtml(status)}">
        <div class="status-card-header">
          <span class="material-symbols-outlined ${spinClass}">${escapeHtml(statusIcon)}</span><span class="card-title">${escapeHtml(title)}</span>
        </div>
        <div class="status-card-status">${escapeHtml(statusText)}</div>
        <div class="status-card-events"></div>
      </div>`;
    }).join('');

    return `<div class="status-board">${cardsHtml}</div>`;
  }

  _renderThinking() {
    let className = this.$.done ? 'work-summary' : 'thinking-block';
    let openAttr = this.$.done ? '' : ' open';
    let details = `<details class="${className}"${openAttr}>`;

    if (this.$.done) {
      details += `<summary><span class="material-symbols-outlined work-summary-icon">check_circle</span>${escapeHtml(translate('chat.message.workedFor', { elapsed: this.$.elapsedText }))}${this._renderCopyButton(this.$.copyText)}</summary>`;
    } else {
      let statusHtml = this.$.status ? `<span class="thinking-status">${escapeHtml(this.$.status)}</span>` : '';
      details += `<summary><span class="material-symbols-outlined thinking-icon spin-icon">pending</span>${escapeHtml(translate('chat.message.thinkingFor', { elapsed: this.$.elapsedText }))}${statusHtml}</summary>`;
    }

    if (this.$.done && this.$.metaHtml) {
      details += `<div class="work-body">${this.$.metaHtml}</div>`;
    }

    details += '</details>';

    if (!this.$.done) return details;
    return `<div class="work-summary-wrap">${details}</div>`;
  }

  _renderTextMessage() {
    let cursor = this.$.isStreaming ? '<span class="streaming-cursor"></span>' : '';
    let summary = this.$.workSummaryHtml || '';
    return `<div class="msg-content">${formatMarkdown(this.$.text)}${cursor}</div>${summary}`;
  }

  _renderCopyButton(copyText) {
    return copyText
      ? `<button class="work-copy-btn" type="button" title="${escapeHtml(translate('chat.message.copyResponse'))}" data-copy-text="${escapeHtml(copyText)}"><span class="material-symbols-outlined">content_copy</span></button>`
      : '';
  }
}

ChatMessageItem.template = html`
<div ${{ className: 'messageClass', innerHTML: 'bodyHtml', onclick: '^onMessageItemClick' }}></div>
`;
ChatMessageItem.rootStyles = css;

ChatMessageItem.reg('chat-message-item');
