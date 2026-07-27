class SimpleEventTarget {
  constructor() {
    this._listeners = new Map();
  }

  addEventListener(type, listener) {
    if (typeof listener !== 'function') return;
    let listeners = this._listeners.get(type) || new Set();
    listeners.add(listener);
    this._listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this._listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event) {
    if (!event?.type) return true;
    for (let listener of this._listeners.get(event.type) || []) {
      listener.call(this, event);
    }
    return true;
  }
}

const RuntimeEventTarget = typeof EventTarget !== 'undefined' ? EventTarget : SimpleEventTarget;

function createRuntimeEvent(type, detail = {}) {
  if (typeof CustomEvent !== 'undefined') return new CustomEvent(type, { detail });
  if (typeof Event !== 'undefined') {
    let event = new Event(type);
    event.detail = detail;
    return event;
  }
  return { type, detail };
}

function stopStreamTracks(stream) {
  for (let track of stream?.getTracks?.() || []) {
    track.stop?.();
  }
}

function hasLiveAudioTrack(stream) {
  return typeof stream?.getAudioTracks === 'function' &&
    stream.getAudioTracks().some((track) => track?.readyState === 'live');
}

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function mediaRecorderSupports(mimeType) {
  return typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.isTypeSupported === 'function' &&
    MediaRecorder.isTypeSupported(mimeType);
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('FileReader API not supported'));
      return;
    }
    let reader = new FileReader();
    reader.onloadend = () => {
      let value = String(reader.result || '');
      resolve(value.includes(',') ? value.split(',')[1] || '' : value);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Product-neutral browser voice capture and speech recognition runtime.
 * Node-safe at module import time: no top-level DOM or navigator access.
 */
export class VoiceRuntime extends RuntimeEventTarget {
  constructor({
    chunkInterval = 250,
    mediaConstraints = { audio: true },
    preferredMimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'],
  } = {}) {
    super();
    this.state = 'idle';
    this.language = '';
    this.mode = 'speech';
    this.chunkInterval = chunkInterval;
    this.mediaConstraints = mediaConstraints;
    this.preferredMimeTypes = [...preferredMimeTypes];

    this._stream = null;
    this._streamOwned = false;
    this._heldStream = null;
    this._heldStreamOwned = false;
    this._mediaRecorder = null;
    this._chunks = [];
    this._recognition = null;
    this._recognitionGeneration = 0;
    this._recorderGeneration = 0;
    this._lastPhase = null;
    this._lastError = null;
    this._resultText = '';
    this._startTime = 0;
    this._elapsedTimer = null;
    this._resolveStop = null;
    this._rejectStart = null;
    this._resolved = false;
    this._onStateChange = null;
    this._onInterim = null;
  }

  static get isAvailable() {
    return this.hasSpeechRecognition || this.hasMediaCapture;
  }

  static get hasSpeechRecognition() {
    return Boolean(getSpeechRecognitionConstructor());
  }

  static get hasMediaCapture() {
    return typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia);
  }

  static get hasMediaRecorder() {
    return typeof MediaRecorder !== 'undefined';
  }

  get isAvailable() {
    return VoiceRuntime.isAvailable;
  }

  get hasSpeechRecognition() {
    return VoiceRuntime.hasSpeechRecognition;
  }

  get hasMediaCapture() {
    return VoiceRuntime.hasMediaCapture;
  }

  get hasMediaRecorder() {
    return VoiceRuntime.hasMediaRecorder;
  }

  get elapsed() {
    if (!this._startTime) return 0;
    return Math.floor((Date.now() - this._startTime) / 1000);
  }

  set onStateChange(fn) {
    this._onStateChange = typeof fn === 'function' ? fn : null;
  }

  set onInterim(fn) {
    this._onInterim = typeof fn === 'function' ? fn : null;
  }

  setLanguage(lang = '') {
    this.language = String(lang).trim();
    if (this._recognition) {
      this._recognition.lang = this._recognitionLanguage();
    }
  }

  _recognitionLanguage() {
    return this.language || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
  }

  getDiagnostics() {
    return Object.freeze({
      state: this.state,
      mode: this.mode,
      activeBackend: this.mode === 'speech' && VoiceRuntime.hasSpeechRecognition ? 'speech-recognition' : 'media-recorder',
      recognition: Object.freeze({
        generation: this._recognitionGeneration,
        active: Boolean(this._recognition && (this.state === 'recording' || this.state === 'starting')),
      }),
      recorder: Object.freeze({
        generation: this._recorderGeneration,
        active: Boolean(this._mediaRecorder && (this.state === 'recording' || this.state === 'starting')),
      }),
      heldStream: Object.freeze({
        present: Boolean(this._heldStream),
        owned: Boolean(this._heldStreamOwned),
        live: hasLiveAudioTrack(this._heldStream),
      }),
      captureOwned: Boolean(this._streamOwned),
      timerActive: Boolean(this._elapsedTimer),
      lastPhase: this._lastPhase || null,
      lastError: this._lastError || null,
    });
  }

  _emitLifecycle(phase, extraDetail = {}) {
    this._lastPhase = phase;
    let payload = Object.freeze({
      generation: this._recognitionGeneration,
      recorderGeneration: this._recorderGeneration,
      phase,
      state: this.state,
      mode: this.mode,
      active: this.state === 'recording' || this.state === 'starting',
      ...extraDetail,
    });
    this.dispatchEvent(createRuntimeEvent('lifecycle', payload));
    if (phase !== 'lifecycle') {
      this.dispatchEvent(createRuntimeEvent(phase, payload));
    }
    return payload;
  }

  async checkPermission() {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return 'prompt';
    }
    try {
      const status = await navigator.permissions.query({ name: 'microphone' });
      return status.state; // 'granted' | 'prompt' | 'denied'
    } catch (_) {
      return 'prompt';
    }
  }

  async requestPermission() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('MediaDevices API not supported');
    }
    let stream = await navigator.mediaDevices.getUserMedia(this.mediaConstraints);
    try {
      return 'granted';
    } finally {
      stopStreamTracks(stream);
    }
  }

  /**
   * Holds a pre-acquired audio MediaStream for raw-audio capture so hosts can
   * reuse an already-authorized microphone without a second getUserMedia call.
   * Ownership is deterministic: borrowed streams (default) are never stopped
   * by the runtime and stay held until replaced or cleared; owned streams are
   * stopped exactly once — when replaced, cleared, cleaned up after a capture
   * that consumed them, or released by destroy(). Liveness is validated when
   * capture starts: a held stream without a live audio track rejects the start
   * instead of silently falling back to getUserMedia. Speech-recognition mode
   * does not consume the held stream.
   * @param {MediaStream|null} stream
   * @param {{ owned?: boolean }} [options]
   */
  setHeldAudioStream(stream, { owned = false } = {}) {
    let next = stream || null;
    if (next && next === this._heldStream) {
      this._heldStreamOwned = Boolean(owned);
      return;
    }
    this._releaseHeldStream();
    this._heldStream = next;
    this._heldStreamOwned = Boolean(next && owned);
  }

  _releaseHeldStream() {
    let held = this._heldStream;
    let heldOwned = this._heldStreamOwned;
    this._heldStream = null;
    this._heldStreamOwned = false;
    if (held && heldOwned) stopStreamTracks(held);
  }

  _setState(nextState) {
    if (this.state === nextState) return;
    this.state = nextState;
    this._onStateChange?.(nextState);
    this.dispatchEvent(createRuntimeEvent('statechange', { state: nextState }));
  }

  _detachRecognitionHandlers(rec) {
    if (!rec) return;
    rec.onaudiostart = null;
    rec.onsoundstart = null;
    rec.onspeechstart = null;
    rec.onaudioend = null;
    rec.onsoundend = null;
    rec.onspeechend = null;
    rec.onstart = null;
    rec.onresult = null;
    rec.onend = null;
    rec.onerror = null;
  }

  _detachRecorderHandlers(recorder) {
    if (!recorder) return;
    recorder.ondataavailable = null;
    recorder.onstop = null;
    recorder.onerror = null;
  }

  async start({ language = this.language, mode = 'speech' } = {}) {
    if (this.state !== 'idle') return;
    this.language = language;
    this.mode = mode;
    this._setState('starting');
    this._resolved = false;
    this._lastError = null;

    try {
      if (mode === 'speech' && VoiceRuntime.hasSpeechRecognition) {
        await this._startSpeechRecognition();
      } else {
        await this._startMediaRecorder();
      }
    } catch (err) {
      this._lastError = err?.message || String(err);
      this._cleanupStream();
      this._setState('idle');
      this._emitLifecycle('error', { error: this._lastError });
      throw err;
    }
  }

  async startMediaRecorder() {
    return this.start({ language: this.language, mode: 'audio' });
  }

  async restartSpeechRecognition(language = '', { initialText = this._resultText.trim() } = {}) {
    this.setLanguage(language);
    if (this.state !== 'recording' || !this._recognition) return false;

    let startTime = this._startTime || Date.now();
    let oldRec = this._recognition;
    this._detachRecognitionHandlers(oldRec);
    try { oldRec.abort(); } catch (_) {}
    this._recognition = null;
    this._resolved = false;
    this._resolveStop = null;
    this._setState('starting');

    try {
      await this._startSpeechRecognition({ initialText, startTime });
      return true;
    } catch (err) {
      this._lastError = err?.message || String(err);
      this._setState('idle');
      this._emitLifecycle('error', { error: this._lastError });
      throw err;
    }
  }

  _startElapsedTimer() {
    if (this._elapsedTimer) clearInterval(this._elapsedTimer);
    this._elapsedTimer = setInterval(() => {
      this._onInterim?.(null, this.elapsed);
      this.dispatchEvent(createRuntimeEvent('elapsedchange', { elapsed: this.elapsed }));
    }, 500);
  }

  async _startSpeechRecognition({ initialText = '', startTime = 0 } = {}) {
    return new Promise((resolve, reject) => {
      const SpeechRecognition = getSpeechRecognitionConstructor();
      if (!SpeechRecognition) {
        reject(new Error('SpeechRecognition API not supported'));
        return;
      }

      this._rejectStart = reject;
      const prevGen = this._recognitionGeneration;
      this._recognitionGeneration += 1;
      const gen = this._recognitionGeneration;
      const rec = new SpeechRecognition();
      rec.lang = this._recognitionLanguage();
      rec.interimResults = true;
      rec.continuous = true;

      this._resultText = initialText;
      if (this._recognition) {
        this._detachRecognitionHandlers(this._recognition);
        try { this._recognition.abort(); } catch (_) {}
      }
      this._recognition = rec;
      this._emitLifecycle('instancereplace', {
        previous: prevGen > 0 ? Object.freeze({ generation: prevGen }) : null,
        current: Object.freeze({ generation: gen }),
      });
      let started = false;

      const bindLifecycle = (phase, customType) => {
        return (event) => {
          if (gen !== this._recognitionGeneration) return;
          this._emitLifecycle(phase);
          if (customType) {
            this.dispatchEvent(createRuntimeEvent(customType, { generation: gen }));
          }
        };
      };

      rec.onaudiostart = bindLifecycle('audiostart');
      rec.onsoundstart = bindLifecycle('soundstart');
      rec.onspeechstart = bindLifecycle('speechstart');
      rec.onaudioend = bindLifecycle('audioend');
      rec.onsoundend = bindLifecycle('soundend');
      rec.onspeechend = bindLifecycle('speechend');

      rec.onstart = () => {
        if (gen !== this._recognitionGeneration) return;
        if (started) return;
        started = true;
        this._rejectStart = null;
        this._startTime = startTime || Date.now();
        this._startElapsedTimer();
        this._setState('recording');
        this._emitLifecycle('start');
        resolve();
      };

      rec.onresult = (event) => {
        if (gen !== this._recognitionGeneration) return;
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        this._resultText = [initialText, transcript].filter(Boolean).join(' ').trim();
        this._onInterim?.(this._resultText);
        let isFinal = Boolean(event.results[event.results.length - 1]?.isFinal);
        this._emitLifecycle('result', { text: this._resultText, isFinal });
        this.dispatchEvent(createRuntimeEvent('speechresult', {
          text: this._resultText,
          isFinal,
        }));
      };

      rec.onend = () => {
        if (gen !== this._recognitionGeneration) return;
        this._emitLifecycle('end');
        this._finish({ text: this._resultText });
        if (!started) {
          started = true;
          this._rejectStart = null;
          reject(new Error('Speech recognition ended before starting'));
        }
      };

      rec.onerror = (event) => {
        if (gen !== this._recognitionGeneration) return;
        const err = new Error(`Speech recognition error: ${event.error}`);
        this._lastError = err.message;
        this._finish({ text: '' });
        this._emitLifecycle('error', { error: err.message });
        if (!started) {
          started = true;
          this._rejectStart = null;
          reject(err);
        }
      };

      try {
        rec.start();
      } catch (err) {
        this._detachRecognitionHandlers(rec);
        this._recognition = null;
        this._rejectStart = null;
        reject(err);
      }
    });
  }

  async _startMediaRecorder() {
    let stream;
    let streamOwned = true;
    if (this._heldStream) {
      if (!hasLiveAudioTrack(this._heldStream)) {
        throw new Error('Held audio stream has no live audio tracks');
      }
      stream = this._heldStream;
      streamOwned = this._heldStreamOwned;
      if (streamOwned) {
        this._heldStream = null;
        this._heldStreamOwned = false;
      }
    } else {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('MediaDevices API not supported');
      }
      stream = await navigator.mediaDevices.getUserMedia(this.mediaConstraints);
    }
    if (this.state !== 'starting') {
      if (streamOwned) stopStreamTracks(stream);
      return;
    }

    this._stream = stream;
    this._streamOwned = streamOwned;
    if (typeof MediaRecorder === 'undefined') {
      this._cleanupStream();
      throw new Error('MediaRecorder not supported');
    }
    let mimeType = this.preferredMimeTypes.find((type) => mediaRecorderSupports(type)) || '';

    this._recorderGeneration += 1;
    const recGen = this._recorderGeneration;
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    this._mediaRecorder = recorder;
    this._chunks = [];

    recorder.ondataavailable = (event) => {
      if (recGen !== this._recorderGeneration) return;
      if (event.data?.size > 0) {
        this._chunks.push(event.data);
        this.dispatchEvent(createRuntimeEvent('audiochunk', { chunk: event.data }));
      }
    };

    recorder.onstop = () => {
      if (recGen !== this._recorderGeneration) return;
      const blob = new Blob(this._chunks, { type: recorder.mimeType });
      this._chunks = [];
      this._mediaRecorder = null;
      this._cleanupStream();
      this.dispatchEvent(createRuntimeEvent('audioblob', { blob, mimeType: recorder.mimeType }));
      this._emitLifecycle('end');
      this._finish({ text: '', blob, mimeType: recorder.mimeType });
    };

    recorder.onerror = (event) => {
      if (recGen !== this._recorderGeneration) return;
      const err = event.error || new Error('MediaRecorder error');
      this._lastError = err.message || String(err);
      this._mediaRecorder = null;
      this._cleanupStream();
      this._finish({ text: '' });
      this._emitLifecycle('error', { error: this._lastError });
    };

    try {
      recorder.start(this.chunkInterval);
      this._startTime = Date.now();
      this._startElapsedTimer();
      this._setState('recording');
      this._emitLifecycle('start');
    } catch (err) {
      this._detachRecorderHandlers(recorder);
      this._recorderGeneration += 1;
      this._mediaRecorder = null;
      this._cleanupStream();
      throw err;
    }
  }

  _cleanupStream() {
    if (this._elapsedTimer) {
      clearInterval(this._elapsedTimer);
      this._elapsedTimer = null;
    }
    this._startTime = 0;
    this._mediaRecorder = null;
    this._chunks = [];
    if (this._stream) {
      if (this._streamOwned) stopStreamTracks(this._stream);
      this._stream = null;
    }
    this._streamOwned = false;
  }

  _finish(result) {
    if (this._resolved) return;
    this._resolved = true;
    if (this._recognition) {
      this._detachRecognitionHandlers(this._recognition);
      this._recognition = null;
    }
    if (this._mediaRecorder) {
      this._detachRecorderHandlers(this._mediaRecorder);
      this._mediaRecorder = null;
    }
    this._cleanupStream();
    this._setState('idle');
    if (this._resolveStop) {
      this._resolveStop(result);
      this._resolveStop = null;
    }
  }

  async stop() {
    if (this.state !== 'recording' && this.state !== 'starting') {
      return { text: '' };
    }
    this._setState('processing');

    return new Promise((resolve) => {
      this._resolveStop = resolve;
      if (this._recognition) {
        this._recognition.stop();
      } else if (this._mediaRecorder) {
        if (this._mediaRecorder.state === 'inactive') {
          this._finish({ text: '' });
        } else {
          this._mediaRecorder.stop();
        }
      } else {
        this._finish({ text: '' });
      }
    });
  }

  cancel() {
    this._recognitionGeneration += 1;
    this._recorderGeneration += 1;
    if (this._rejectStart) {
      this._rejectStart(new Error('VoiceRuntime start cancelled'));
      this._rejectStart = null;
    }
    if (this._recognition) {
      this._detachRecognitionHandlers(this._recognition);
      try { this._recognition.abort(); } catch (_) {}
      this._recognition = null;
    }
    if (this._mediaRecorder) {
      this._detachRecorderHandlers(this._mediaRecorder);
      try { this._mediaRecorder.stop(); } catch (_) {}
      this._mediaRecorder = null;
    }
    this._cleanupStream();
    this._chunks = [];
    this._resultText = '';
    this._finish({ text: '', cancelled: true });
    this._setState('idle');
  }

  destroy() {
    this.cancel();
    this._releaseHeldStream();
  }
}
