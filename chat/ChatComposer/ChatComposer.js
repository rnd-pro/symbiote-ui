import Symbiote, { html } from '@symbiotejs/symbiote';
import '../../control/Button/Button.js';
import { translate } from '../../locale/index.js';
import { VoiceRuntime } from '../voice-runtime.js';
import {
  defaultWakeCommandPhrases,
  defaultSendCommandPhrases,
  defaultVoiceActionCommandPhrases,
  wakeCommandCandidates,
  matchVoiceCommandAtEnd,
} from '../voice-input-defaults.js';
import css from './ChatComposer.css.js';

function emit(el, type, detail = {}) {
  el.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

function emitCancelable(el, type, detail = {}) {
  let event = new CustomEvent(type, { bubbles: true, composed: true, cancelable: true, detail });
  el.dispatchEvent(event);
  return event;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderFooterIcon(icon) {
  return icon
    ? `<span class="material-symbols-outlined">${escapeHtml(icon)}</span>`
    : '';
}

function renderFooterLabel(label) {
  return label
    ? `<span class="composer-footer-label">${escapeHtml(label)}</span>`
    : '';
}

function normalizeVoiceInputState(state) {
  return state === 'recording' ? 'listening' : state === 'processing' ? 'transcribing' : state || 'idle';
}

function normalizeFooterControl(control, index) {
  let id = String(control?.id || control?.name || `control-${index + 1}`);
  let kind = String(control?.kind || control?.type || 'button');
  let priority = Math.min(Math.max(Number(control?.priority || index + 1), 1), 5);
  return {
    ...control,
    id,
    kind,
    priority,
    label: control?.label || id,
    title: control?.title || control?.label || id,
    value: control?.value ?? '',
  };
}

function renderFooterControl(control, index) {
  let item = normalizeFooterControl(control, index);
  let commonClass = [
    'composer-footer-btn',
    'composer-footer-control',
    `composer-priority-${item.priority}`,
    item.active ? 'active' : '',
    item.compact ? 'composer-param-collapsed' : '',
    item.className || '',
  ].filter(Boolean).join(' ');
  let commonAttrs = [
    `data-footer-control-id="${escapeHtml(item.id)}"`,
    `data-footer-control-kind="${escapeHtml(item.kind)}"`,
    `title="${escapeHtml(item.title)}"`,
  ].join(' ');
  let disabled = item.disabled ? ' disabled' : '';

  if (item.kind === 'select') {
    let options = Array.isArray(item.options) ? item.options : [];
    let optionHtml = options.map((option) => {
      let value = option?.value ?? option?.id ?? option?.label ?? '';
      let label = option?.label ?? value;
      let selected = String(value) === String(item.value) ? ' selected' : '';
      return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
    }).join('');
    return `
      <label class="${commonClass} composer-footer-select-control" ${commonAttrs}>
        ${renderFooterIcon(item.icon)}
        ${renderFooterLabel(item.label)}
        <select class="composer-footer-select" data-footer-control-id="${escapeHtml(item.id)}" data-footer-control-kind="${escapeHtml(item.kind)}"${disabled}>
          ${optionHtml}
        </select>
      </label>
    `;
  }

  if (item.kind === 'checkbox') {
    let checked = item.checked || item.value === true ? ' checked' : '';
    return `
      <label class="${commonClass} composer-footer-checkbox-control" ${commonAttrs}>
        ${renderFooterIcon(item.icon)}
        <input class="composer-footer-checkbox" type="checkbox" data-footer-control-id="${escapeHtml(item.id)}" data-footer-control-kind="${escapeHtml(item.kind)}"${checked}${disabled}>
        ${renderFooterLabel(item.label)}
      </label>
    `;
  }

  let value = item.value ? `<span class="composer-footer-value">${escapeHtml(item.value)}</span>` : '';
  return `
    <button class="${commonClass}" type="button" ${commonAttrs}${disabled}>
      ${renderFooterIcon(item.icon)}
      ${renderFooterLabel(item.label)}
      ${value}
    </button>
  `;
}

export class ChatComposer extends Symbiote {
  init$ = {
    value: '',
    disabled: false,
    placeholder: translate('chat.composer.placeholder'),
    attachedContext: [],
    footerControls: [],
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

    onVoiceInput: () => {
      let currentState = this._getVoiceInputState();
      let action = currentState === 'listening'
        ? 'stop'
        : currentState === 'transcribing'
          ? 'cancel'
          : 'start';
      let detail = {
        action,
        currentState,
        mode: 'voice-input',
        permission: 'microphone',
        source: 'voice-input',
      };

      let event = emitCancelable(this, 'chat-composer-voice-input', detail);
      if (event.defaultPrevented) return;
      if (!this._emitVoiceCaptureIntents(action, detail, 'voice-input')) return;
      this._handleDefaultVoiceInput(action);
    },

    onWakeListen: () => {
      let active = Boolean(this._voiceControls?.wakeListen?.active);
      let action = active ? 'stop' : 'start';
      let detail = {
        action,
        currentState: active ? 'listening' : 'idle',
        mode: 'wake-listen',
        permission: 'microphone',
        source: 'wake-listen',
      };

      let event = emitCancelable(this, 'chat-composer-wake-listen', detail);
      if (event.defaultPrevented) return;
      if (!this._emitVoiceCaptureIntents(action, detail, 'wake-listening')) return;
      this._handleDefaultWakeListen(action);
    },

    onVoiceResponse: () => {
      emitCancelable(this, 'chat-composer-voice-response-toggle');
    },

    onVoiceCommand: () => {
      let event = emitCancelable(this, 'chat-composer-voice-command-toggle');
      if (!event.defaultPrevented) {
        this._voiceCommandMode = !this._voiceCommandMode;
        this._syncLocalVoiceControls();
      }
    },

    onVoiceLanguageClick: (event) => {
      let option = event.target?.closest?.('[data-voice-language]');
      if (!option) return;
      let mode = option.dataset.voiceLanguage;
      let cevent = emitCancelable(this, 'chat-composer-voice-language-change', { mode });
      if (!cevent.defaultPrevented) {
        this.setVoiceLanguageState({ mode });
        this._handleDefaultVoiceLanguageChange(mode);
        this._syncLocalVoiceControls();
      }
    },

    onVoiceApprove: () => {
      let detail = this._getVoicePreviewIntentDetail('approve');
      let event = emitCancelable(this, 'chat-composer-voice-approve', detail);
      if (event.defaultPrevented) return;
      let intent = emitCancelable(this, 'chat-composer-transcription-intent', detail);
      if (intent.defaultPrevented) return;
      this._handleDefaultVoiceApprove();
    },

    onVoiceCancel: () => {
      let detail = this._getVoicePreviewIntentDetail('cancel');
      let event = emitCancelable(this, 'chat-composer-voice-cancel', detail);
      if (event.defaultPrevented) return;
      let intent = emitCancelable(this, 'chat-composer-transcription-intent', detail);
      if (intent.defaultPrevented) return;
      this._handleDefaultVoiceInput('cancel');
    },

    onVoiceSend: () => {
      let detail = this._getVoicePreviewIntentDetail('send');
      let event = emitCancelable(this, 'chat-composer-voice-send', detail);
      if (event.defaultPrevented) return;
      let intent = emitCancelable(this, 'chat-composer-transcription-intent', detail);
      if (intent.defaultPrevented) return;
      let text = this.getVoicePreviewText();
      this._sendVoicePreviewText(text);
    },

    onParamChange: (event) => {
      let el = event.target;
      if (!el || (!el.classList.contains('composer-footer-select') && !el.classList.contains('composer-footer-checkbox'))) return;
      let id = el.dataset.footerControlId || el.dataset.param;
      let detail = {
        id,
        kind: el.dataset.footerControlKind || el.type,
        value: el.type === 'checkbox' ? el.checked : el.value,
        inputType: el.type,
      };
      if (el.dataset.footerControlId) {
        emit(this, 'chat-composer-footer-control-change', detail);
      }
      emit(this, 'chat-composer-param-change', {
        id,
        value: detail.value,
        inputType: detail.inputType,
      });
    },

    onFooterClick: (event) => {
      let btn = event.target?.closest?.('button[data-footer-control-id]');
      if (!btn || btn.disabled) return;
      let id = btn.dataset.footerControlId;
      let control = (this.$.footerControls || []).find((item) => String(item.id || item.name) === id) || null;
      emit(this, 'chat-composer-footer-control', {
        id,
        kind: btn.dataset.footerControlKind || control?.kind || control?.type || 'button',
        value: control?.value ?? '',
        control,
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
      this._syncVoiceControls();
    });
  }

  disconnectedCallback() {
    this._stopLocalWakeRecognition();
    if (this._voiceRuntime) {
      this._voiceRuntime.destroy();
      this._voiceRuntime = null;
    }
    super.disconnectedCallback?.();
  }

  _voiceCommandLocale() {
    let locale = this._voiceControls?.language?.mode || 'en';
    return ['ru', 'es', 'en'].includes(locale) ? locale : 'en';
  }

  _getVoiceActionPhrases(action) {
    let locale = this._voiceCommandLocale();
    let phrases = defaultVoiceActionCommandPhrases();
    if (action === 'send') {
      let sendPhrases = defaultSendCommandPhrases();
      return [sendPhrases[locale] || sendPhrases.en];
    }
    return phrases[action]?.[locale] || phrases[action]?.en || [];
  }

  _getWakeCommandPhrase() {
    let configured = String(this._voiceControls?.wakeListen?.commandText || '').trim();
    if (configured) return configured;
    return wakeCommandCandidates(defaultWakeCommandPhrases(), this._voiceCommandLocale())[0] || 'Okay Agent';
  }

  _voiceRecognitionLanguage(locale = this._voiceCommandLocale()) {
    return {
      ru: 'ru-RU',
      es: 'es-ES',
      en: 'en-US',
    }[locale] || 'en-US';
  }

  _voiceLanguageOptions() {
    return [
      { mode: 'ru', label: 'RU', title: 'Russian' },
      { mode: 'es', label: 'ES', title: 'Spanish' },
      { mode: 'en', label: 'EN', title: 'English' },
    ];
  }

  _formatVoiceElapsed(elapsed = 0) {
    let value = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
    let m = String(Math.floor(value / 60)).padStart(2, '0');
    let s = String(value % 60).padStart(2, '0');
    return `● Recording ${m}:${s}`;
  }

  _getVoiceCommandHints() {
    let list = (action) => this._getVoiceActionPhrases(action).join(', ');
    return [
      `send: ${list('send')}`,
      `cancel: ${list('cancel')}`,
      `delete: ${list('delete')}`,
      `off: ${list('off')}`,
    ];
  }

  _extractVoiceCommandAction(text = '') {
    let value = String(text || '').trim();
    if (!value) return { matched: false, action: '', text: '' };
    let candidates = ['send', 'cancel', 'delete', 'off'].flatMap((action) => (
      this._getVoiceActionPhrases(action).map((phrase) => ({ action, phrase }))
    ));
    let command = matchVoiceCommandAtEnd(value, candidates);
    if (!command.matched) return { matched: false, action: '', text: value };
    if (command.action === 'send' && !command.text) return { matched: false, action: '', text: value };
    return command;
  }

  _executeVoiceCommand(command) {
    let runtime = this._getVoiceRuntime();

    if (command.action === 'send') {
      runtime.cancel();
      this.setValue(command.text);
      this.clearVoicePreview();
      emit(this, 'chat-composer-submit');
    } else if (command.action === 'delete') {
      this.setValue('');
      this.clearVoicePreview();
      this._localVoiceText = '';
      if (runtime.state === 'recording' && runtime.mode === 'speech') {
        runtime.restartSpeechRecognition?.(this._voiceRecognitionLanguage(), { initialText: '' })
          .catch((err) => this._onVoiceRuntimeError(err));
      }
    } else if (command.action === 'cancel') {
      runtime.cancel();
      this.clearVoicePreview();
    } else if (command.action === 'off') {
      runtime.cancel();
      this._voiceCommandMode = false;
      this.clearVoicePreview();
    }

    this._localVoiceState = 'idle';
    this._localVoiceActiveMode = 'idle';
    this._syncLocalVoiceControls();
  }

  _getVoiceRuntime() {
    if (!this._voiceRuntime) {
      this._voiceRuntime = new VoiceRuntime();
      this._voiceRuntime.addEventListener('statechange', (e) => {
        this._onVoiceRuntimeStateChange(e.detail.state);
      });
      this._voiceRuntime.addEventListener('speechresult', (e) => {
        this._onVoiceRuntimeSpeechResult(e.detail.text, e.detail.isFinal);
      });
      this._voiceRuntime.addEventListener('audioblob', (e) => {
        this._onVoiceRuntimeAudioBlob(e.detail.blob, e.detail.mimeType);
      });
      this._voiceRuntime.addEventListener('elapsedchange', (e) => {
        this._onVoiceRuntimeElapsedChange(e.detail.elapsed);
      });
      this._voiceRuntime.addEventListener('error', (e) => {
        this._onVoiceRuntimeError(e.detail.error);
      });
      this._voiceCommandMode = true;
    }
    return this._voiceRuntime;
  }

  _emitVoiceCaptureIntents(action, detail, reason) {
    if (action === 'start') {
      let permissionEvent = emitCancelable(this, 'chat-composer-permission-intent', {
        action: 'request',
        permission: 'microphone',
        reason,
        source: detail.source,
      });
      if (permissionEvent.defaultPrevented) return false;
    }

    let recorderEvent = emitCancelable(this, 'chat-composer-recorder-intent', detail);
    return !recorderEvent.defaultPrevented;
  }

  async _handleDefaultVoiceInput(action) {
    try {
      if (
        this._localVoiceActiveMode === 'wake' &&
        action === 'start' &&
        !this._localVoiceWakeMatched
      ) {
        await this._startDefaultWakeDictation();
        return;
      }
      let runtime = this._getVoiceRuntime();
      if (action === 'start') {
        let permission = await runtime.checkPermission();
        if (permission === 'prompt') {
          permission = await runtime.requestPermission();
        }
        if (permission !== 'granted') {
          this.setVoicePreview({
            mode: 'result',
            status: 'Permission denied',
            text: 'Microphone permission is required for voice input.',
          });
          return;
        }

        this._localVoiceActiveMode = 'manual';
        this._localVoiceState = 'listening';
        this._localVoiceElapsed = 0;
        this._localVoiceText = '';
        this._localVoiceWakeMatched = false;
        this._syncLocalVoiceControls();
        this._showLocalRecordingPreview('');

        let mode = VoiceRuntime.hasSpeechRecognition ? 'speech' : 'audio';
        await runtime.start({ language: this._voiceRecognitionLanguage(), mode });
      } else if (action === 'stop') {
        this._localVoiceState = 'transcribing';
        this._syncLocalVoiceControls();
        let result = await runtime.stop();
        this._handleVoiceResult(result);
      } else if (action === 'cancel') {
        runtime.cancel();
        this._localVoiceState = 'idle';
        this._localVoiceActiveMode = 'idle';
        this._localVoiceWakeMatched = false;
        this._syncLocalVoiceControls();
        this.clearVoicePreview();
      }
    } catch (err) {
      this._onVoiceRuntimeError(err);
    }
  }

  async _handleDefaultWakeListen(action) {
    try {
      let runtime = this._getVoiceRuntime();
      if (action === 'start') {
        let permission = await runtime.checkPermission();
        if (permission === 'prompt') {
          permission = await runtime.requestPermission();
        }
        if (permission !== 'granted') {
          this.setVoicePreview({
            mode: 'result',
            status: 'Permission denied',
            text: 'Microphone permission is required for wake listening.',
          });
          return;
        }

        this._localVoiceActiveMode = 'wake';
        this._localVoiceState = 'listening';
        this._localVoiceElapsed = 0;
        this._localVoiceText = '';
        this._localVoiceWakeMatched = false;
        this._localWakeTriggering = false;
        this._syncLocalVoiceControls();
        this._showLocalWakePreview('');

        this._startLocalWakeRecognition();
      } else {
        this._stopLocalWakeRecognition();
        runtime.cancel();
        this._localVoiceState = 'idle';
        this._localVoiceActiveMode = 'idle';
        this._localVoiceWakeMatched = false;
        this._localWakeTriggering = false;
        this._syncLocalVoiceControls();
        this.clearVoicePreview();
      }
    } catch (err) {
      this._onVoiceRuntimeError(err);
    }
  }

  _onVoiceRuntimeStateChange(state) {
    if (state === 'idle' && this._localVoiceState === 'listening') {
      if (this._localVoiceActiveMode === 'wake' && this._localVoiceWakeMatched) {
        this._localVoiceState = 'listening';
        this._localVoiceWakeMatched = false;
        this._startLocalWakeRecognition();
        this._showLocalWakePreview('');
      } else {
        this._localVoiceState = 'idle';
        this._localVoiceActiveMode = 'idle';
      }
      this._syncLocalVoiceControls();
    }
  }

  _onVoiceRuntimeSpeechResult(text, isFinal) {
    this._localVoiceText = text;
    if (this._localVoiceActiveMode === 'wake' && !this._localVoiceWakeMatched) {
      let wakePhrases = this._voiceControls?.wakeListen?.commandText || this._getWakeCommandPhrase();
      let locale = this._voiceCommandLocale();
      let candidates = wakeCommandCandidates({ [locale]: wakePhrases }, locale);
      let matchedWake = false;
      for (let cand of candidates) {
        if (text.toLowerCase().includes(cand.toLowerCase())) {
          matchedWake = true;
          break;
        }
      }
      if (matchedWake) {
        this._triggerDefaultVoiceInputFromWake();
      } else {
        this._showLocalWakePreview(text);
      }
      return;
    } else {
      this._showLocalRecordingPreview(text);
    }

    if (this._voiceCommandMode) {
      let command = this._extractVoiceCommandAction(text);
      if (command.matched) {
        this._executeVoiceCommand(command);
      }
    }
  }

  _onVoiceRuntimeAudioBlob(blob, mimeType) {
    let event = new CustomEvent('chat-composer-audio-captured', {
      bubbles: true,
      composed: true,
      detail: { blob, mimeType },
    });
    this.dispatchEvent(event);
    this.setVoicePreview({
      mode: 'result',
      status: 'audio captured',
      text: `Captured ${Math.round(blob.size / 1024)} KB audio blob (${mimeType}).`,
      editable: false,
    });
  }

  _onVoiceRuntimeElapsedChange(elapsed) {
    this._localVoiceElapsed = elapsed;
    let statusText = this._localVoiceState === 'listening'
      ? this._localVoiceActiveMode === 'wake'
        ? (this._localVoiceWakeMatched ? 'wake matched' : `Listening for "${this._getWakeCommandPhrase()}"`)
        : this._formatVoiceElapsed(elapsed)
      : this._localVoiceState;
    let preview = this.getVoicePreviewElement();
    if (preview && !preview.hidden) {
      let statusEl = this.ref.voicePreviewStatus;
      if (statusEl) {
        statusEl.textContent = statusText;
      }
    }
  }

  _onVoiceRuntimeError(err) {
    this._stopLocalWakeRecognition();
    this._localVoiceState = 'idle';
    this._localVoiceActiveMode = 'idle';
    this._localVoiceWakeMatched = false;
    this._syncLocalVoiceControls();
    this.setVoicePreview({
      mode: 'result',
      status: 'Error',
      text: err.message || String(err),
    });
  }

  _handleVoiceResult(result) {
    let wasWakeMode = this._localVoiceActiveMode === 'wake';
    this._localVoiceState = wasWakeMode ? 'listening' : 'idle';
    this._localVoiceActiveMode = wasWakeMode ? 'wake' : 'idle';
    this._localVoiceWakeMatched = false;
    this._syncLocalVoiceControls();

    if (result.cancelled) {
      if (wasWakeMode) {
        this._startLocalWakeRecognition();
        this._showLocalWakePreview('');
      } else {
        this.clearVoicePreview();
      }
      return;
    }

    let text = result.text || this._localVoiceText || '';
    if (text) {
      this.setVoicePreview({
        mode: 'result',
        status: 'transcribed',
        text: text,
        editable: true,
      });
    } else if (result.blob) {
      // Audio blob already handled by audioblob event listener
    } else {
      this.setVoicePreview({
        mode: 'result',
        status: 'no speech detected',
        text: '',
      });
    }
  }

  async _handleDefaultVoiceApprove() {
    try {
      let runtime = this._voiceRuntime;
      let result = runtime && (runtime.state === 'recording' || runtime.state === 'starting')
        ? await runtime.stop()
        : null;
      let text = result?.text || this._localVoiceText || this.getVoicePreviewText();
      if (text && text.trim()) {
        this._sendVoicePreviewText(text);
        return;
      }
      if (result) this._handleVoiceResult(result);
    } catch (err) {
      this._onVoiceRuntimeError(err);
    }
  }

  _sendVoicePreviewText(text = '') {
    let value = String(text || '').trim();
    let keepWakeMode = this._localVoiceActiveMode === 'wake';
    this._localVoiceText = '';
    this._localVoiceState = keepWakeMode ? 'listening' : 'idle';
    this._localVoiceActiveMode = keepWakeMode ? 'wake' : 'idle';
    this._localVoiceWakeMatched = false;
    this._syncLocalVoiceControls();
    this.clearVoicePreview();
    if (keepWakeMode) this._startLocalWakeRecognition();
    if (!value) return;
    this.setValue(value);
    emit(this, 'chat-composer-submit');
  }

  _showLocalRecordingPreview(text = '') {
    this.setVoicePreview({
      mode: 'recording',
      status: this._formatVoiceElapsed(this._localVoiceElapsed || 0),
      text,
      elapsed: true,
      commandHints: this._voiceCommandMode ? this._getVoiceCommandHints() : [],
    });
  }

  _showLocalWakePreview(text = '') {
    this.setVoicePreview({
      mode: 'recording',
      status: `Listening for "${this._getWakeCommandPhrase()}"`,
      text,
      elapsed: false,
      commandHints: this._voiceCommandMode ? this._getVoiceCommandHints() : [],
    });
  }

  _getSpeechRecognitionConstructor() {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  _startLocalWakeRecognition() {
    if (
      this._localVoiceActiveMode !== 'wake' ||
      this._localVoiceWakeMatched ||
      this._localWakeRecognition ||
      this._localVoiceState !== 'listening'
    ) {
      return;
    }
    let SpeechRecognition = this._getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      this._onVoiceRuntimeError(new Error('SpeechRecognition API not supported'));
      return;
    }
    let recognition = new SpeechRecognition();
    recognition.lang = this._voiceRecognitionLanguage();
    recognition.interimResults = true;
    recognition.continuous = true;
    this._localWakeRecognition = recognition;

    recognition.onresult = (event) => {
      let transcript = '';
      let start = Number.isFinite(event.resultIndex) ? event.resultIndex : 0;
      for (let i = start; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      this._handleLocalWakeRecognitionText(transcript);
    };

    recognition.onerror = (event) => {
      this._localWakeRecognition = null;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this._onVoiceRuntimeError(new Error('Microphone permission is required for wake listening.'));
        return;
      }
      if (this._localVoiceActiveMode === 'wake' && !this._localVoiceWakeMatched) {
        this._syncLocalVoiceControls();
      }
    };

    recognition.onend = () => {
      this._localWakeRecognition = null;
      if (this._localVoiceActiveMode === 'wake' && !this._localVoiceWakeMatched) {
        setTimeout(() => this._startLocalWakeRecognition(), 250);
      }
    };

    try {
      recognition.start();
    } catch (err) {
      this._localWakeRecognition = null;
      this._onVoiceRuntimeError(err);
    }
  }

  _stopLocalWakeRecognition() {
    let recognition = this._localWakeRecognition;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try { recognition.abort(); } catch (_) {}
    this._localWakeRecognition = null;
  }

  _handleLocalWakeRecognitionText(text = '') {
    let value = String(text || '').trim();
    this._localVoiceText = value;
    this._showLocalWakePreview(value);
    let locale = this._voiceCommandLocale();
    let candidates = wakeCommandCandidates(defaultWakeCommandPhrases(), locale);
    if (this._voiceControls?.wakeListen?.commandText) {
      candidates = wakeCommandCandidates({ [locale]: this._voiceControls.wakeListen.commandText }, locale);
    }
    let matchedWake = candidates.some((phrase) => value.toLowerCase().includes(String(phrase).toLowerCase()));
    if (matchedWake) this._triggerDefaultVoiceInputFromWake();
  }

  _triggerDefaultVoiceInputFromWake() {
    if (this._localWakeTriggering || this._localVoiceActiveMode !== 'wake' || this._localVoiceWakeMatched) return;
    this._localWakeTriggering = true;
    this._stopLocalWakeRecognition();
    this._localVoiceWakeMatched = true;
    this._localVoiceText = '';
    this._syncLocalVoiceControls();
    this.setVoicePreview({
      mode: 'recording',
      status: 'wake matched',
      text: '',
      elapsed: false,
      commandHints: this._voiceCommandMode ? this._getVoiceCommandHints() : [],
    });
    setTimeout(() => {
      this._startDefaultWakeDictation().finally(() => {
        this._localWakeTriggering = false;
      });
    }, 200);
  }

  async _startDefaultWakeDictation() {
    let runtime = this._getVoiceRuntime();
    if (runtime.state !== 'idle') return;
    this._stopLocalWakeRecognition();
    this._localVoiceActiveMode = 'wake';
    this._localVoiceState = 'listening';
    this._localVoiceElapsed = 0;
    this._localVoiceText = '';
    this._localVoiceWakeMatched = true;
    this._syncLocalVoiceControls();
    this._showLocalRecordingPreview('');
    let mode = VoiceRuntime.hasSpeechRecognition ? 'speech' : 'audio';
    await runtime.start({ language: this._voiceRecognitionLanguage(), mode });
  }

  _handleDefaultVoiceLanguageChange(mode) {
    let locale = ['ru', 'es', 'en'].includes(mode) ? mode : this._voiceCommandLocale();
    let runtime = this._voiceRuntime;
    if (!runtime) {
      if (this._localVoiceActiveMode === 'wake' && !this._localVoiceWakeMatched) {
        this._stopLocalWakeRecognition();
        this._startLocalWakeRecognition();
      }
      return;
    }
    runtime.setLanguage(this._voiceRecognitionLanguage(locale));
    if (runtime.state === 'recording' && runtime.mode === 'speech') {
      runtime.restartSpeechRecognition?.(this._voiceRecognitionLanguage(locale), { initialText: this._localVoiceText || '' })
        .catch((err) => this._onVoiceRuntimeError(err));
    } else if (this._localVoiceActiveMode === 'wake' && !this._localVoiceWakeMatched) {
      this._stopLocalWakeRecognition();
      this._startLocalWakeRecognition();
    }
  }

  _syncLocalVoiceControls() {
    let state = this._localVoiceState || 'idle';
    let activeMode = this._localVoiceActiveMode || 'idle';
    let isManualVoice = activeMode === 'manual' && ['listening', 'transcribing'].includes(state);
    let isWakeVoice = activeMode === 'wake' && ['listening', 'transcribing', 'speaking'].includes(state);
    let isWakeDictation = isWakeVoice && this._localVoiceWakeMatched;
    let isActive = isManualVoice || isWakeVoice;

    if (isActive && !this._localVoiceControlsManaged) {
      this._localVoiceControlsManaged = true;
      this._localVoiceVisibility = {
        input: this._voiceControls?.input?.visible,
        response: this._voiceControls?.response?.visible,
        command: this._voiceControls?.command?.visible,
        language: this._voiceControls?.language?.visible,
      };
    }

    if (!this._voiceControls) this._voiceControls = {};

    this._voiceControls.input = {
      ...(this._voiceControls.input || {}),
      state: isManualVoice ? state : isWakeDictation ? state : 'idle',
      enabled: this._voiceControls.input?.enabled !== false,
    };
    this._voiceControls.wakeListen = {
      ...(this._voiceControls.wakeListen || {}),
      active: isWakeVoice,
      commandText: isWakeVoice
        ? (this._voiceControls.wakeListen?.commandText || this._getWakeCommandPhrase())
        : (this._voiceControls.wakeListen?.commandText || ''),
    };

    if (isActive) {
      if (isWakeVoice) this._voiceControls.input.visible = true;
      this._voiceControls.response = {
        ...(this._voiceControls.response || {}),
        visible: isWakeVoice,
        enabled: typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined',
        speaking: state === 'speaking',
      };
      this._voiceControls.command = {
        ...(this._voiceControls.command || {}),
        visible: true,
        enabled: true,
        active: this._voiceCommandMode,
        text: this._voiceControls.command?.text || 'Commands',
      };
      this._voiceControls.language = {
        ...(this._voiceControls.language || {}),
        visible: VoiceRuntime.hasSpeechRecognition,
        enabled: VoiceRuntime.hasSpeechRecognition,
        mode: this._voiceCommandLocale(),
        options: this._voiceControls.language?.options || this._voiceLanguageOptions(),
      };
    } else if (this._localVoiceControlsManaged) {
      let previous = this._localVoiceVisibility || {};
      for (let key of ['input', 'response', 'command', 'language']) {
        if (!this._voiceControls[key]) continue;
        if (previous[key] === undefined) {
          delete this._voiceControls[key].visible;
        } else {
          this._voiceControls[key].visible = previous[key];
        }
      }
      this._localVoiceControlsManaged = false;
      this._localVoiceVisibility = null;
    }

    this._syncVoiceControls();
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

  getVoicePreviewText() {
    return this.getVoicePreviewBody()?.textContent || '';
  }

  getVoiceControlElements() {
    return {
      input: this.ref.voiceInputBtn || null,
      wakeListen: this.ref.wakeListenBtn || null,
      response: this.ref.voiceResponseBtn || null,
      command: this.ref.voiceCommandBtn || null,
      language: this.ref.voiceLanguageBtn || null,
    };
  }

  _getVoiceInputState() {
    return normalizeVoiceInputState(this._voiceControls?.input?.state || 'idle');
  }

  _getVoicePreviewIntentDetail(action) {
    let preview = this.getVoicePreviewElement();
    return {
      action,
      source: 'voice-preview',
      mode: preview?.hidden ? 'hidden' : Array.from(preview?.classList || [])
        .find((item) => item !== 'composer-body' && item !== 'voice-preview') || 'preview',
      text: this.getVoicePreviewText(),
    };
  }

  setValue(value) {
    this.$.value = value || '';
  }

  setAttachedContext(items) {
    this.$.attachedContext = Array.isArray(items) ? items : [];
  }

  setFooterHtml(htmlStr) {
    this.$.footerControls = [];
    this.$.footerHtml = htmlStr || '';
  }

  setFooterControls(controls = []) {
    let normalized = Array.isArray(controls) ? controls.map((control, index) => normalizeFooterControl(control, index)) : [];
    this.$.footerControls = normalized;
    this.$.footerHtml = normalized.map(renderFooterControl).join('');
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

  setVoiceControls(config = {}) {
    let current = this._voiceControls || {};
    this._voiceControls = {
      input: { ...(current.input || {}), ...(config.input || {}) },
      wakeListen: { ...(current.wakeListen || {}), ...(config.wakeListen || {}) },
      response: { ...(current.response || {}), ...(config.response || {}) },
      command: { ...(current.command || {}), ...(config.command || {}) },
      language: { ...(current.language || {}), ...(config.language || {}) },
    };
    this._syncVoiceControls();
  }

  setVoiceInputState(state = 'idle', options = {}) {
    this.setVoiceControls({ input: { ...(this._voiceControls?.input || {}), ...options, state } });
  }

  setWakeListenState(options = {}) {
    this.setVoiceControls({ wakeListen: { ...(this._voiceControls?.wakeListen || {}), ...options } });
  }

  setVoiceResponseState(options = {}) {
    this.setVoiceControls({ response: { ...(this._voiceControls?.response || {}), ...options } });
  }

  setVoiceCommandState(options = {}) {
    this.setVoiceControls({ command: { ...(this._voiceControls?.command || {}), ...options } });
  }

  setVoiceLanguageState(options = {}) {
    this.setVoiceControls({ language: { ...(this._voiceControls?.language || {}), ...options } });
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
    for (let btn of Object.values(this.getVoiceControlElements())) {
      if (btn) btn.disabled = Boolean(this.$.disabled);
    }
    let voice = this._voiceControls || {};
    if (this.ref.voiceInputBtn && (voice.input?.enabled === false || voice.input?.state === 'disabled')) {
      this.ref.voiceInputBtn.disabled = true;
    }
    if (this.ref.wakeListenBtn && voice.wakeListen?.enabled === false) {
      this.ref.wakeListenBtn.disabled = true;
    }
    if (this.ref.voiceResponseBtn && this._voiceControls?.response?.enabled === false) {
      this.ref.voiceResponseBtn.disabled = true;
    }
    if (this.ref.voiceCommandBtn && voice.command?.enabled === false) {
      this.ref.voiceCommandBtn.disabled = true;
    }
    if (this.ref.voiceLanguageBtn && voice.language?.enabled === false) {
      this.ref.voiceLanguageBtn.disabled = true;
    }
  }

  _syncVoiceControls() {
    this._syncVoiceInput(this._voiceControls?.input || {});
    this._syncWakeListen(this._voiceControls?.wakeListen || {});
    this._syncVoiceResponse(this._voiceControls?.response || {});
    this._syncVoiceCommand(this._voiceControls?.command || {});
    this._syncVoiceLanguage(this._voiceControls?.language || {});
    this._syncDisabledState();
  }

  _syncVoiceInput({ visible = false, state = 'idle', enabled = true } = {}) {
    let btn = this.ref.voiceInputBtn;
    let icon = this.ref.voiceInputIcon;
    if (!btn) return;
    let normalizedState = normalizeVoiceInputState(state);
    btn.hidden = !visible;
    btn.disabled = Boolean(this.$.disabled) || enabled === false || normalizedState === 'disabled';
    btn.classList.toggle('recording', normalizedState === 'listening');
    btn.classList.toggle('listening', normalizedState === 'listening');
    btn.classList.toggle('processing', normalizedState === 'transcribing');
    btn.classList.toggle('transcribing', normalizedState === 'transcribing');
    btn.classList.toggle('disabled-state', normalizedState === 'disabled');
    btn.dataset.voiceState = normalizedState;
    if (icon) {
      icon.textContent = normalizedState === 'transcribing'
        ? 'hourglass_top'
        : normalizedState === 'listening'
          ? 'stop_circle'
          : normalizedState === 'disabled'
            ? 'mic_off'
            : 'mic';
    }
  }

  _syncWakeListen({ visible = false, enabled = true, active = false, commandText = '' } = {}) {
    let btn = this.ref.wakeListenBtn;
    let text = this.ref.wakeCommandText;
    if (!btn) return;
    btn.hidden = !visible;
    btn.disabled = Boolean(this.$.disabled) || !enabled;
    btn.classList.toggle('listening', Boolean(active));
    btn.classList.toggle('has-command', Boolean(commandText));
    if (text) text.textContent = commandText || '';
  }

  _syncVoiceResponse({ visible = false, enabled = true, speaking = false } = {}) {
    let btn = this.ref.voiceResponseBtn;
    if (!btn) return;
    btn.hidden = !visible;
    btn.disabled = Boolean(this.$.disabled) || !enabled;
    btn.classList.toggle('enabled', Boolean(enabled));
    btn.classList.toggle('speaking', Boolean(speaking));
  }

  _syncVoiceCommand({ visible = false, enabled = true, active = false, text = '' } = {}) {
    let btn = this.ref.voiceCommandBtn;
    let label = this.ref.voiceCommandText;
    if (!btn) return;
    btn.hidden = !visible;
    btn.disabled = Boolean(this.$.disabled) || !enabled;
    btn.classList.toggle('active', Boolean(active));
    if (label) label.textContent = text || '';
  }

  _syncVoiceLanguage({ visible = false, enabled = true, mode = 'auto', options } = {}) {
    let btn = this.ref.voiceLanguageBtn;
    if (!btn) return;
    btn.hidden = !visible;
    btn.disabled = Boolean(this.$.disabled) || !enabled;
    let normalized = Array.isArray(options) && options.length
      ? options
      : [
        { mode: 'auto', label: 'auto' },
        { mode: 'ru', label: 'RU' },
        { mode: 'en', label: 'EN' },
      ];
    btn.replaceChildren(...normalized.map((option) => {
      let item = document.createElement('span');
      item.className = 'voice-language-option';
      item.dataset.voiceLanguage = option.mode;
      item.textContent = option.label || option.mode;
      item.classList.toggle('active', option.mode === mode);
      return item;
    }));
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
    <div class="composer-actions">
      <button class="btn-wake-listen" ref="wakeListenBtn" type="button" title="Wake listening" hidden ${{ onclick: 'onWakeListen' }}>
        <span class="material-symbols-outlined">hearing</span>
        <span class="wake-command-text" ref="wakeCommandText"></span>
      </button>
      <button class="btn-voice-response" ref="voiceResponseBtn" type="button" title="Voice response" hidden ${{ onclick: 'onVoiceResponse' }}>
        <span class="material-symbols-outlined">record_voice_over</span>
      </button>
      <button class="btn-voice-command" ref="voiceCommandBtn" type="button" title="Voice command mode" hidden ${{ onclick: 'onVoiceCommand' }}>
        <span class="material-symbols-outlined">keyboard_voice</span>
        <span class="voice-command-button-text" ref="voiceCommandText"></span>
      </button>
      <button class="btn-voice-language" ref="voiceLanguageBtn" type="button" title="Voice language" hidden ${{ onclick: 'onVoiceLanguageClick' }}></button>
    </div>
    <button class="btn-mic" ref="voiceInputBtn" type="button" title="Voice input" hidden ${{ onclick: 'onVoiceInput' }}>
      <span class="material-symbols-outlined" ref="voiceInputIcon">mic</span>
    </button>
    <sn-button class="btn-send" ref="btnSend" variant="icon" ${{ onclick: 'onSend' }}>
      <span class="material-symbols-outlined" ref="sendIcon">arrow_upward</span>
    </sn-button>
  </div>
  <div class="composer-footer" ref="footer" ${{ innerHTML: 'footerHtml', onchange: 'onParamChange', onclick: 'onFooterClick' }}></div>
  <div class="autocomplete-popup" ref="autocompletePopup"></div>
</div>
`;

ChatComposer.rootStyles = css;
ChatComposer.reg('chat-composer');
