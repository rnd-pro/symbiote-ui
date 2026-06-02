import Symbiote, { html } from '@symbiotejs/symbiote';
import '../../control/Button/Button.js';
import { translate } from '../../locale/index.js';
import css from './ChatComposer.css.js';

function emit(el, type, detail = {}) {
  el.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

export class ChatComposer extends Symbiote {
  init$ = {
    value: '',
    disabled: false,
    placeholder: translate('chat.composer.placeholder'),
    attachedContext: [],
    footerHtml: '',
    isSending: false,

    onInput: (event) => {
      let input = event.target;
      this.$.value = input.value;
      this.resizeInput();
      emit(this, 'chat-composer-input', {
        value: input.value,
        selectionStart: input.selectionStart,
      });
    },

    onKeyDown: (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        emit(this, 'chat-composer-submit');
        return;
      }
      if (event.key === 'Escape' || event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Tab') {
        emit(this, 'chat-composer-key', { key: event.key, event });
      }
    },

    onSend: () => {
      emit(this, 'chat-composer-send');
    },

    onVoiceApprove: () => {
      emit(this, 'chat-composer-voice-approve');
    },

    onVoiceCancel: () => {
      emit(this, 'chat-composer-voice-cancel');
    },

    onVoiceSend: () => {
      emit(this, 'chat-composer-voice-send');
    },

    onParamChange: (event) => {
      let el = event.target;
      if (!el || (!el.classList.contains('composer-footer-select') && !el.classList.contains('composer-footer-checkbox'))) return;
      emit(this, 'chat-composer-param-change', {
        id: el.dataset.param,
        value: el.type === 'checkbox' ? el.checked : el.value,
        inputType: el.type,
      });
    },

    onRemoveContext: (event) => {
      emit(this, 'chat-composer-context-remove', {
        key: event.currentTarget?.dataset?.key,
      });
    },

    onDragOver: (event) => {
      event.preventDefault();
      this.classList.add('drag-over');
    },

    onDragLeave: () => {
      this.classList.remove('drag-over');
    },

    onDrop: (event) => {
      event.preventDefault();
      this.classList.remove('drag-over');
      let path = event.dataTransfer?.getData('text/plain');
      if (path && path.trim()) {
        emit(this, 'chat-composer-context-drop', { path: path.trim() });
      }
    },
  };

  renderCallback() {
    this.sub('value', (value) => {
      let input = this.getInputElement();
      if (input && input.value !== value) {
        input.value = value || '';
        this.resizeInput();
      }
    });
    this.sub('isSending', () => this._syncSendingState());
    this.sub('disabled', () => this._syncDisabledState());
    queueMicrotask(() => {
      this._syncSendingState();
      this._syncDisabledState();
    });
  }

  getInputElement() {
    return this.ref.chatInput || null;
  }

  getAutocompleteElement() {
    return this.ref.autocompletePopup || null;
  }

  getParamControls() {
    return [...(this.ref.footer?.querySelectorAll('.composer-footer-select, .composer-footer-checkbox') || [])];
  }

  getVoicePreviewElement() {
    return this.ref.voicePreview || null;
  }

  getVoicePreviewBody() {
    return this.ref.voicePreviewBody || null;
  }

  setValue(value) {
    this.$.value = value || '';
  }

  setAttachedContext(items) {
    this.$.attachedContext = Array.isArray(items) ? items : [];
  }

  setFooterHtml(htmlStr) {
    this.$.footerHtml = htmlStr || '';
  }

  setDisabled(disabled) {
    this.$.disabled = Boolean(disabled);
  }

  setPlaceholder(placeholder) {
    this.$.placeholder = placeholder || '';
  }

  setSending(active) {
    this.$.isSending = Boolean(active);
  }

  setVoicePreview({ mode = 'recording', text = '', status = '', elapsed = false, editable = false, commandHints = [] } = {}) {
    let preview = this.ref.voicePreview;
    let statusEl = this.ref.voicePreviewStatus;
    let body = this.ref.voicePreviewBody;
    if (!preview || !body || !statusEl) return;

    preview.hidden = false;
    preview.className = `composer-body voice-preview ${mode}`;
    statusEl.textContent = status || '';
    statusEl.hidden = !status;
    statusEl.classList.toggle('voice-preview-elapsed', Boolean(elapsed));
    body.textContent = text || '';
    body.hidden = !text && mode === 'recording';
    if (editable) {
      body.contentEditable = 'true';
      body.spellcheck = false;
    } else {
      body.removeAttribute('contenteditable');
      body.removeAttribute('spellcheck');
    }
    if (this.ref.voiceCommandHints) {
      let hints = Array.isArray(commandHints) ? commandHints.filter(Boolean) : [];
      this.ref.voiceCommandHints.hidden = hints.length === 0 || mode !== 'recording';
      this.ref.voiceCommandHints.replaceChildren(...hints.map((hint) => {
        let item = document.createElement('span');
        item.className = 'voice-command-hint';
        item.textContent = hint;
        return item;
      }));
    }

    if (this.ref.voiceApproveBtn) this.ref.voiceApproveBtn.hidden = mode !== 'recording';
    if (this.ref.voiceCancelBtn) this.ref.voiceCancelBtn.hidden = false;
    if (this.ref.voiceSendBtn) this.ref.voiceSendBtn.hidden = mode !== 'result';
  }

  clearVoicePreview() {
    let preview = this.ref.voicePreview;
    let statusEl = this.ref.voicePreviewStatus;
    let body = this.ref.voicePreviewBody;
    if (!preview || !body || !statusEl) return;
    preview.hidden = true;
    preview.className = 'composer-body voice-preview';
    statusEl.textContent = '';
    statusEl.hidden = true;
    statusEl.classList.remove('voice-preview-elapsed');
    body.textContent = '';
    body.hidden = false;
    body.removeAttribute('contenteditable');
    body.removeAttribute('spellcheck');
    if (this.ref.voiceCommandHints) {
      this.ref.voiceCommandHints.hidden = true;
      this.ref.voiceCommandHints.replaceChildren();
    }
  }

  resizeInput() {
    let input = this.getInputElement();
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
  }

  resetInputHeight() {
    let input = this.getInputElement();
    if (input) input.style.height = 'auto';
  }

  _syncSendingState() {
    let btn = this.ref.btnSend;
    let icon = this.ref.sendIcon;
    if (!btn || !icon) return;
    if (this.$.isSending) {
      btn.classList.add('btn-stop');
      icon.textContent = 'stop';
    } else {
      btn.classList.remove('btn-stop');
      icon.textContent = 'arrow_upward';
    }
  }

  _syncDisabledState() {
    let input = this.getInputElement();
    if (input) input.disabled = Boolean(this.$.disabled);
    if (this.ref.btnSend) this.ref.btnSend.disabled = Boolean(this.$.disabled);
  }
}

ChatComposer.template = html`
<div ${{ ondragover: 'onDragOver', ondragleave: 'onDragLeave', ondrop: 'onDrop' }}>
  <div class="chat-context-bar" itemize="attachedContext">
    <div class="context-chip" title="{{title}}">
      <span class="material-symbols-outlined icon-sm">{{icon}}</span>
      <span class="context-path">{{name}}</span>
      <sn-button class="context-remove" variant="icon" ${{ '@data-key': 'key', onclick: '^onRemoveContext' }}>
        <span class="material-symbols-outlined">close</span>
      </sn-button>
    </div>
  </div>
  <div class="composer-body voice-preview" ref="voicePreview" hidden>
    <div class="voice-preview-content">
      <div class="voice-preview-status voice-preview-elapsed" ref="voicePreviewStatus" hidden></div>
      <div class="voice-preview-body" ref="voicePreviewBody"></div>
      <div class="voice-command-hints" ref="voiceCommandHints" hidden></div>
    </div>
    <div class="voice-preview-actions">
      <sn-button class="voice-preview-btn cancel" ref="voiceCancelBtn" variant="danger" title="Cancel" ${{ onclick: 'onVoiceCancel' }}>
        <span class="material-symbols-outlined">close</span>
      </sn-button>
      <sn-button class="voice-preview-btn approve" ref="voiceApproveBtn" variant="success" title="Approve and send" ${{ onclick: 'onVoiceApprove' }}>
        <span class="material-symbols-outlined">check</span>
      </sn-button>
      <sn-button class="voice-preview-btn send" ref="voiceSendBtn" variant="success" title="Send" ${{ onclick: 'onVoiceSend' }}>
        <span class="material-symbols-outlined">send</span>
      </sn-button>
    </div>
  </div>
  <div class="composer-body">
    <textarea ref="chatInput" rows="1"
      ${{ value: 'value', disabled: 'disabled', placeholder: 'placeholder',
          oninput: 'onInput', onkeydown: 'onKeyDown' }}></textarea>
    <sn-button class="btn-send" ref="btnSend" variant="icon" ${{ onclick: 'onSend' }}>
      <span class="material-symbols-outlined" ref="sendIcon">arrow_upward</span>
    </sn-button>
  </div>
  <div class="composer-footer" ref="footer" ${{ innerHTML: 'footerHtml', onchange: 'onParamChange' }}></div>
  <div class="autocomplete-popup" ref="autocompletePopup"></div>
</div>
`;

ChatComposer.rootStyles = css;
ChatComposer.reg('chat-composer');
