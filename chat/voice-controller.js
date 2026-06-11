import { matchVoiceCommandInText } from './voice-input-defaults.js';

export const VOICE_MICROPHONE_DENIED_MESSAGE = 'Microphone access denied. Check browser microphone permissions.';
export const VOICE_WAKE_UNSUPPORTED_MESSAGE = 'Continuous listening requires browser speech recognition.';
export const TERMINAL_WAKE_ERRORS = Object.freeze([
  'not-allowed',
  'service-not-allowed',
  'not-supported',
  'start-failed',
]);

function createWakeError(error, message, cause = null) {
  return { error, message, cause };
}

export function isTerminalWakeError(error = '') {
  return TERMINAL_WAKE_ERRORS.includes(error);
}

export function voiceMicrophoneDeniedMessage() {
  return VOICE_MICROPHONE_DENIED_MESSAGE;
}

export function voiceStartErrorMessage({
  wasMicrophonePrompt = false,
  permissionRefreshMessage = '',
} = {}) {
  return wasMicrophonePrompt && permissionRefreshMessage
    ? permissionRefreshMessage
    : VOICE_MICROPHONE_DENIED_MESSAGE;
}

export function voiceWakeStartErrorMessage(error = '', {
  microphoneDeniedMessage = VOICE_MICROPHONE_DENIED_MESSAGE,
  wakeUnsupportedMessage = VOICE_WAKE_UNSUPPORTED_MESSAGE,
} = {}) {
  return error === 'not-supported'
    ? wakeUnsupportedMessage
    : microphoneDeniedMessage;
}

export class VoiceController {
  constructor({
    getLanguage = () => 'en-US',
    getWakeCandidates = () => [],
    onWakeTriggered = () => {},
    onSpeechStart = () => {},
    onSpeechEnd = () => {},
    onWakeError = () => {},
  } = {}) {
    this.getLanguage = getLanguage;
    this.getWakeCandidates = getWakeCandidates;
    this.onWakeTriggered = onWakeTriggered;
    this.onSpeechStart = onSpeechStart;
    this.onSpeechEnd = onSpeechEnd;
    this.onWakeError = onWakeError;

    this.wakeEnabled = false;
    this.wakePaused = false;
    this.speaking = false;

    this._wakeRecognition = null;
    this._speechUtterance = null;
    this._wakeTimeout = null;
  }

  static get hasSpeechRecognition() {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  static get hasSpeechSynthesis() {
    if (typeof globalThis === 'undefined') return false;
    return Boolean(globalThis.speechSynthesis && globalThis.SpeechSynthesisUtterance);
  }

  get isWakeActive() {
    return this.wakeEnabled && !this.wakePaused;
  }

  startWake() {
    this.wakeEnabled = true;
    this.wakePaused = false;
    this._startWakeRecognition();
  }

  stopWake({ disableMode = false } = {}) {
    if (disableMode) {
      this.wakeEnabled = false;
      this.cancelSpeech();
    }
    this.wakePaused = false;
    this._stopWakeRecognition();
  }

  pauseWake() {
    if (!this.wakeEnabled) return;
    this.wakePaused = true;
    this._stopWakeRecognition();
  }

  resumeWake() {
    if (!this.wakeEnabled) return;
    this.wakePaused = false;
    this._startWakeRecognition();
  }

  _startWakeRecognition() {
    if (!this.wakeEnabled || this.wakePaused || this._wakeRecognition) return;
    if (this._wakeTimeout) {
      clearTimeout(this._wakeTimeout);
      this._wakeTimeout = null;
    }

    const SpeechRecognition = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;

    if (!SpeechRecognition) {
      this.wakeEnabled = false;
      this.onWakeError(createWakeError(
        'not-supported',
        'Speech recognition is not supported by this browser.'
      ));
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = this.getLanguage();
      recognition.interimResults = true;
      recognition.continuous = true;
      this._wakeRecognition = recognition;

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        const candidates = this.getWakeCandidates();
        if (matchVoiceCommandInText(transcript, candidates).matched) {
          this.onWakeTriggered();
        }
      };

      recognition.onerror = (event) => {
        this._wakeRecognition = null;
        this.onWakeError(event);
      };

      recognition.onend = () => {
        this._wakeRecognition = null;
        if (this.wakeEnabled && !this.wakePaused) {
          this._wakeTimeout = setTimeout(() => this._startWakeRecognition(), 250);
        }
      };

      recognition.start();
    } catch (err) {
      this.wakeEnabled = false;
      this.wakePaused = false;
      this._wakeRecognition = null;
      this.onWakeError(createWakeError(
        'start-failed',
        'Speech recognition failed to start.',
        err
      ));
    }
  }

  _stopWakeRecognition() {
    if (this._wakeTimeout) {
      clearTimeout(this._wakeTimeout);
      this._wakeTimeout = null;
    }
    if (this._wakeRecognition) {
      const rec = this._wakeRecognition;
      this._wakeRecognition = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch (_) {}
    }
  }

  speak(text) {
    if (!VoiceController.hasSpeechSynthesis) return;
    this.cancelSpeech();

    this.pauseWake();
    this.speaking = true;
    this.onSpeechStart();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.getLanguage();
    this._speechUtterance = utterance;

    const cleanup = () => {
      if (this._speechUtterance === utterance) {
        this.speaking = false;
        this._speechUtterance = null;
        this.onSpeechEnd();
        this.resumeWake();
      }
    };

    utterance.onend = cleanup;
    utterance.onerror = cleanup;

    globalThis.speechSynthesis.cancel();
    globalThis.speechSynthesis.speak(utterance);
  }

  cancelSpeech() {
    if (!VoiceController.hasSpeechSynthesis) return;
    if (this.speaking) {
      globalThis.speechSynthesis.cancel();
      this.speaking = false;
      this._speechUtterance = null;
      this.onSpeechEnd();
      this.resumeWake();
    }
  }

  destroy() {
    this.stopWake({ disableMode: true });
    this.cancelSpeech();
  }
}
