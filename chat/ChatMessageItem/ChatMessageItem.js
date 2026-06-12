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
    parts: [],
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
    this.sub('parts', () => this._renderBody());
  }

  _renderBody() {
    let role = this.$.role || this.$.type;
    this.$.messageClass = `message ${role || ''}${this.$.isStreaming ? ' streaming' : ''}`.trim();

    if (this.$.parts && this.$.parts.length > 0) {
      this.$.bodyHtml = this._renderParts();
    } else if (role === 'tool') {
      this.$.bodyHtml = this._renderTool();
    } else if (role === 'board') {
      this.$.bodyHtml = this._renderBoard();
    } else if (role === 'thinking') {
      this.$.bodyHtml = this._renderThinking();
    } else {
      this.$.bodyHtml = this._renderTextMessage();
    }
  }

  _renderParts() {
    let parts = this.$.parts || [];
    let htmlStr = '';

    let lastTextIndex = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].type === 'text' || parts[i].type === 'text_delta') {
        lastTextIndex = i;
        break;
      }
    }

    let insideStatusBoard = false;

    for (let i = 0; i < parts.length; i++) {
      let part = parts[i];
      let type = part.type;

      if (type === 'status') {
        if (!insideStatusBoard) {
          htmlStr += '<div class="status-board">';
          insideStatusBoard = true;
        }
      } else {
        if (insideStatusBoard) {
          htmlStr += '</div>';
          insideStatusBoard = false;
        }
      }

      if (type === 'text' || type === 'text_delta') {
        let cursor = (type === 'text_delta' || (this.$.isStreaming && i === lastTextIndex)) ? '<span class="streaming-cursor"></span>' : '';
        htmlStr += `<div class="msg-content">${formatMarkdown(part.text)}${cursor}</div>`;
      } else if (type === 'reasoning') {
        let isDone = part.status !== 'active' && part.status !== 'running' && this.$.done;
        let className = isDone ? 'work-summary' : 'thinking-block';
        let openAttr = isDone ? '' : ' open';
        let statusHtml = part.status ? `<span class="thinking-status">${escapeHtml(part.status)}</span>` : '';
        let details = `<details class="${className}"${openAttr}>`;
        if (isDone) {
          details += `<summary><span class="material-symbols-outlined work-summary-icon">check_circle</span>${escapeHtml(part.title || translate('chat.message.worked'))}${this._renderCopyButton(part.text)}</summary>`;
        } else {
          details += `<summary><span class="material-symbols-outlined thinking-icon spin-icon">pending</span>${escapeHtml(part.title || translate('chat.message.thinking'))}${statusHtml}</summary>`;
        }
        if (part.text) {
          details += `<div class="work-body">${formatMarkdown(part.text)}</div>`;
        }
        details += '</details>';
        if (isDone) {
          htmlStr += `<div class="work-summary-wrap">${details}</div>`;
        } else {
          htmlStr += details;
        }
      } else if (type === 'status') {
        let status = part.status || 'idle';
        let isDone = status === 'done' || status === 'error' || status === 'cancelled';
        let statusIcon = part.meta?.icon || (status === 'running' ? 'pending' : isDone ? 'check_circle' : 'schedule');
        let spinClass = status === 'running' ? 'spin-icon' : '';
        let statusText = part.text || (status === 'running' ? translate('chat.message.running') : translate('chat.message.queued'));
        let title = part.title || part.name || translate('chat.message.status');
        let id = part.id || '';
        let linkedAttr = part.url ? ` data-link-id="${escapeHtml(part.url)}"` : '';
        htmlStr += `<div class="status-card" data-card-id="${escapeHtml(id)}"${linkedAttr} data-status="${escapeHtml(status)}">
          <div class="status-card-header">
            <span class="material-symbols-outlined ${spinClass}">${escapeHtml(statusIcon)}</span><span class="card-title">${escapeHtml(title)}</span>
          </div>
          <div class="status-card-status">${escapeHtml(statusText)}</div>
        </div>`;
      } else if (type === 'tool_call') {
        let resultPart = this._isPairedToolResult(part, parts[i + 1]) ? parts[i + 1] : null;
        htmlStr += this._renderToolCallPart(part, resultPart);
        if (resultPart) i += 1;
      } else if (type === 'tool_result') {
        htmlStr += this._renderToolResultPart(part);
      } else if (type === 'source') {
        let title = part.title || part.name || part.url || translate('chat.message.source');
        let sourceBody = part.url
          ? `<a href="${escapeHtml(part.url)}" class="md-link" target="_blank">${escapeHtml(title)}</a>`
          : `<span>${escapeHtml(title)}</span>`;
        htmlStr += `<div class="source-badge">
          <span class="material-symbols-outlined">menu_book</span>
          ${sourceBody}
        </div>`;
      } else if (type === 'attachment') {
        let title = part.title || part.name || translate('chat.message.attachment');
        let icon = 'attachment';
        if (part.mimeType?.startsWith('image/')) icon = 'image';
        else if (part.mimeType?.startsWith('video/')) icon = 'video_file';
        else if (part.mimeType?.startsWith('audio/')) icon = 'audio_file';
        htmlStr += `<div class="attachment-card">
          <span class="material-symbols-outlined">${icon}</span>
          <div class="attachment-info">
            <span class="attachment-title">${escapeHtml(title)}</span>
            ${part.url ? `<a href="${escapeHtml(part.url)}" class="md-link" target="_blank">${escapeHtml(translate('chat.message.download'))}</a>` : ''}
          </div>
        </div>`;
      } else if (type === 'artifact') {
        let title = part.title || part.name || translate('chat.message.artifact');
        htmlStr += `<div class="artifact-card">
          <div class="artifact-header">
            <span class="material-symbols-outlined">description</span>
            <span class="artifact-title">${escapeHtml(title)}</span>
          </div>
          ${part.text ? `<pre class="md-code-block">${escapeHtml(part.text)}</pre>` : ''}
        </div>`;
      } else if (type === 'approval') {
        let title = part.title || part.name || translate('chat.message.approvalTitle');
        let id = part.id || '';
        let text = part.text || translate('chat.message.approvalText');
        htmlStr += `<div class="approval-card" data-approval-id="${escapeHtml(id)}">
          <div class="approval-header">
            <span class="material-symbols-outlined">rule</span>
            <span class="approval-title">${escapeHtml(title)}</span>
          </div>
          <div class="approval-body">${escapeHtml(text)}</div>
          <div class="approval-actions">
            <button class="sn-btn approval-btn approve" data-action="approve" data-id="${escapeHtml(id)}">${escapeHtml(translate('chat.message.approve'))}</button>
            <button class="sn-btn approval-btn reject" data-action="reject" data-id="${escapeHtml(id)}">${escapeHtml(translate('chat.message.reject'))}</button>
          </div>
        </div>`;
      } else if (type === 'action' || type === 'retry' || type === 'cancel') {
        let title = part.title || part.name || translate('chat.message.actionRequired');
        let id = part.id || '';
        let text = part.text || '';
        let btnLabel = part.title || part.name || translate('chat.message.retry');
        let actionType = type === 'retry' ? 'retry' : type === 'cancel' ? 'cancel' : 'action';
        let icon = actionType === 'retry' ? 'replay' : actionType === 'cancel' ? 'cancel' : 'bolt';
        htmlStr += `<div class="action-card" data-action-id="${escapeHtml(id)}">
          <div class="action-header">
            <span class="material-symbols-outlined">${icon}</span>
            <span class="action-title">${escapeHtml(title)}</span>
          </div>
          ${text ? `<div class="action-body">${escapeHtml(text)}</div>` : ''}
          <div class="action-actions">
            <button class="sn-btn action-btn" data-action="${escapeHtml(actionType)}" data-id="${escapeHtml(id)}">${escapeHtml(btnLabel)}</button>
          </div>
        </div>`;
      } else if (type === 'error' || type === 'cancelled') {
        let title = part.title || part.name || (type === 'cancelled' ? translate('chat.message.operationCancelled') : translate('chat.message.error'));
        let icon = type === 'cancelled' ? 'cancel' : 'error';
        htmlStr += `<div class="error-card ${type}">
          <div class="error-header">
            <span class="material-symbols-outlined">${icon}</span>
            <span class="error-title">${escapeHtml(title)}</span>
          </div>
          <div class="error-body">${escapeHtml(part.text)}</div>
        </div>`;
      }
    }

    if (insideStatusBoard) {
      htmlStr += '</div>';
    }

    return htmlStr;
  }

  _isPairedToolResult(callPart, resultPart) {
    if (!callPart || !resultPart || resultPart.type !== 'tool_result') return false;
    if (callPart.id || resultPart.id) {
      if (callPart.id && resultPart.id) return callPart.id === resultPart.id;
      if (callPart.name && resultPart.name) return callPart.name === resultPart.name;
      return true;
    }
    if (callPart.name && resultPart.name) return callPart.name === resultPart.name;
    return true;
  }

  _getToolResultValue(part) {
    if (!part) return null;
    if (part.result != null) return part.result;
    return part.text !== '' ? part.text : null;
  }

  _renderToolCallPart(part, resultPart = null) {
    let isRunning = part.status === 'running' || part.status === 'active';
    let isError = part.status === 'error' || resultPart?.status === 'error';
    let icon = isError ? 'error' : isRunning ? 'build_circle' : 'build';
    let spinClass = isRunning ? 'spin-icon' : '';
    let openAttr = this.$.isLatestTool || isRunning ? ' open' : '';
    let summary = summarizeToolInput(part.args);
    let summaryHtml = summary
      ? `<span class="tool-summary" title="${escapeHtml(summary)}">${escapeHtml(summary)}</span>`
      : '';
    let name = part.name || resultPart?.name || 'tool';
    let cardHtml = `<details class="tool-card"${openAttr}>
      <summary class="tool-header"><span class="material-symbols-outlined tool-icon ${spinClass}">${icon}</span><span class="tool-name">${escapeHtml(name)}</span>${summaryHtml}</summary>`;

    if (part.args != null) {
      cardHtml += `<div class="tool-section"><div class="tool-label">${escapeHtml(translate('chat.message.input'))}</div><pre class="tool-code">${escapeHtml(stringifyBlock(part.args))}</pre></div>`;
    }

    let resultValue = this._getToolResultValue(resultPart) ?? this._getToolResultValue(part);
    if (resultValue != null) {
      cardHtml += `<div class="tool-section"><div class="tool-label">${escapeHtml(translate('chat.message.result'))}</div><pre class="tool-code">${escapeHtml(truncateResult(resultValue))}</pre></div>`;
    } else if (isRunning) {
      cardHtml += `<div class="tool-section tool-waiting"><em>${escapeHtml(translate('chat.message.running'))}</em></div>`;
    }

    return `${cardHtml}</details>`;
  }

  _renderToolResultPart(part) {
    let isError = part.status === 'error';
    let icon = isError ? 'error' : 'check_circle';
    let cardHtml = `<details class="tool-card">
      <summary class="tool-header"><span class="material-symbols-outlined tool-icon">${icon}</span><span class="tool-name">${escapeHtml(part.name || 'tool result')}</span></summary>`;
    let resultValue = this._getToolResultValue(part);
    if (resultValue != null) {
      cardHtml += `<div class="tool-section"><div class="tool-label">${escapeHtml(translate('chat.message.result'))}</div><pre class="tool-code">${escapeHtml(truncateResult(resultValue))}</pre></div>`;
    }
    return `${cardHtml}</details>`;
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
