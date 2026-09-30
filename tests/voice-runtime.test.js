import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VoiceRuntime, blobToBase64 } from '../chat/voice-runtime.js';

function defineGlobal(name, value) {
  let descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
  return () => {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      delete globalThis[name];
    }
  };
}

function makeAudioTrack({ live = true } = {}) {
  return {
    readyState: live ? 'live' : 'ended',
    stopCount: 0,
    stop() {
      this.stopCount += 1;
      this.readyState = 'ended';
    },
  };
}

function makeAudioStream({ live = true, audioTracks = 1 } = {}) {
  let tracks = [];
  for (let i = 0; i < audioTracks; i++) {
    tracks.push(makeAudioTrack({ live }));
  }
  return {
    tracks,
    getTracks() {
      return [...tracks];
    },
    getAudioTracks() {
      return [...tracks];
    },
  };
}

function installVoiceCaptureMocks() {
  let getUserMediaCalls = [];
  let recorderInstances = [];
  let control = { startError: null };
  let restoreWindow = defineGlobal('window', {});
  let restoreNavigator = defineGlobal('navigator', {
    language: 'en-US',
    mediaDevices: {
      async getUserMedia(constraints) {
        getUserMediaCalls.push(constraints);
        return makeAudioStream();
      },
    },
  });
  let restoreMediaRecorder = defineGlobal('MediaRecorder', class {
    constructor(stream, options) {
      this.stream = stream;
      this.options = options || null;
      this.mimeType = options?.mimeType || '';
      this.state = 'inactive';
      recorderInstances.push(this);
    }

    static isTypeSupported() {
      return true;
    }

    start(interval) {
      if (control.startError) throw control.startError;
      this.interval = interval;
      this.state = 'recording';
    }

    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({
        data: new Blob(['voice'], { type: this.mimeType }),
      });
      this.onstop?.();
    }
  });
  return {
    getUserMediaCalls,
    recorderInstances,
    control,
    restore() {
      restoreMediaRecorder();
      restoreNavigator();
      restoreWindow();
    },
  };
}

test('VoiceRuntime capability detection in Node', () => {
  assert.equal(VoiceRuntime.isAvailable, false);
  assert.equal(VoiceRuntime.hasSpeechRecognition, false);
  assert.equal(VoiceRuntime.hasMediaCapture, false);
});

test('VoiceRuntime state machine and event emitters', async () => {
  let runtime;
  try {
    runtime = new VoiceRuntime();
    assert.equal(runtime.state, 'idle');

    runtime.setLanguage('ru-RU');
    assert.equal(runtime.language, 'ru-RU');

    // Since browser APIs are not available, start should throw
    await assert.rejects(async () => {
      await runtime.start({ language: 'ru-RU', mode: 'media' });
    }, /MediaDevices API not supported/);
  } finally {
    await runtime?.destroy();
  }
});

test('VoiceRuntime mocked browser environment query/request permission', async () => {
  let streamStopped = false;
  const mockTrack = {
    stop() {
      streamStopped = true;
    }
  };

  const mockStream = {
    getTracks() {
      return [mockTrack];
    }
  };

  let restoreWindow = defineGlobal('window', {
    SpeechRecognition: class {},
    webkitSpeechRecognition: class {},
  });
  let restoreMediaRecorder = defineGlobal('MediaRecorder', class {
    constructor(stream, options) {
      this.stream = stream;
      this.options = options;
      this.mimeType = options?.mimeType || '';
      this.state = 'inactive';
    }

    static isTypeSupported() {
      return true;
    }

    start(interval) {
      this.interval = interval;
      this.state = 'recording';
    }

    stop() {
      this.state = 'inactive';
      this.onstop?.();
    }
  });
  let restoreNavigator = defineGlobal('navigator', {
    language: 'en-US',
    permissions: {
      async query() {
        return { state: 'granted' };
      }
    },
    mediaDevices: {
      async getUserMedia() {
        return mockStream;
      }
    }
  });

  let runtime;
  try {
    assert.equal(VoiceRuntime.isAvailable, true);
    assert.equal(VoiceRuntime.hasSpeechRecognition, true);
    assert.equal(VoiceRuntime.hasMediaCapture, true);
    assert.equal(VoiceRuntime.hasMediaRecorder, true);

    runtime = new VoiceRuntime();
    assert.equal(runtime.isAvailable, true);
    assert.equal(runtime.hasSpeechRecognition, true);
    assert.equal(runtime.hasMediaCapture, true);
    assert.equal(runtime.hasMediaRecorder, true);
    assert.equal(await runtime.checkPermission(), 'granted');
    assert.equal(await runtime.requestPermission(), 'granted');
    assert.equal(streamStopped, true);
  } finally {
    await runtime?.destroy();
    restoreNavigator();
    restoreMediaRecorder();
    restoreWindow();
  }
});

test('VoiceRuntime records media chunks and resolves stop result', async () => {
  let stopCount = 0;
  let recorderInstance = null;
  let restoreWindow = defineGlobal('window', {});
  let restoreNavigator = defineGlobal('navigator', {
    language: 'en-US',
    mediaDevices: {
      async getUserMedia() {
        return {
          getTracks() {
            return [{
              stop() {
                stopCount += 1;
              }
            }];
          }
        };
      }
    }
  });
  let restoreMediaRecorder = defineGlobal('MediaRecorder', class {
    constructor(stream, options) {
      this.stream = stream;
      this.mimeType = options?.mimeType || '';
      this.state = 'inactive';
      recorderInstance = this;
    }

    static isTypeSupported(type) {
      return type === 'audio/webm;codecs=opus';
    }

    start(interval) {
      this.interval = interval;
      this.state = 'recording';
    }

    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({
        data: new Blob(['voice'], { type: this.mimeType }),
      });
      this.onstop?.();
    }
  });

  let runtime;
  try {
    runtime = new VoiceRuntime({ chunkInterval: 125 });
    let states = [];
    let chunkCount = 0;
    let blobType = '';
    runtime.addEventListener('statechange', (event) => states.push(event.detail.state));
    runtime.addEventListener('audiochunk', () => { chunkCount += 1; });
    runtime.addEventListener('audioblob', (event) => { blobType = event.detail.mimeType; });

    await runtime.startMediaRecorder();

    assert.equal(runtime.state, 'recording');
    assert.equal(recorderInstance.interval, 125);
    assert.deepEqual(states, ['starting', 'recording']);

    let result = await runtime.stop();

    assert.equal(runtime.state, 'idle');
    assert.equal(chunkCount, 1);
    assert.equal(result.blob.size, 5);
    assert.equal(result.mimeType, 'audio/webm;codecs=opus');
    assert.equal(blobType, 'audio/webm;codecs=opus');
    assert.equal(stopCount, 1);
    assert.deepEqual(states, ['starting', 'recording', 'processing', 'idle']);
  } finally {
    await runtime?.destroy();
    restoreMediaRecorder();
    restoreNavigator();
    restoreWindow();
  }
});

test('VoiceRuntime restarts active speech recognition with preserved text and new language', async () => {
  let instances = [];
  let restoreWindow = defineGlobal('window', {
    SpeechRecognition: class {
      constructor() {
        this.lang = '';
        this.interimResults = false;
        this.continuous = false;
        instances.push(this);
      }

      start() {
        this.onstart?.();
      }

      stop() {
        this.onend?.();
      }

      abort() {
        this.aborted = true;
      }
    },
  });
  let restoreNavigator = defineGlobal('navigator', {
    language: 'en-US',
  });

  let runtime;
  try {
    runtime = new VoiceRuntime();
    let speech = [];
    let interim = [];
    let callbackStates = [];
    runtime.onInterim = (text) => interim.push(text);
    runtime.onStateChange = (state) => callbackStates.push(state);
    runtime.addEventListener('speechresult', (event) => speech.push(event.detail.text));

    await runtime.start({ language: 'en-US', mode: 'speech' });
    instances[0].onresult?.({
      results: Object.assign([[{ transcript: 'hello' }]], { length: 1 }),
    });

    assert.equal(runtime.state, 'recording');
    assert.equal(instances[0].lang, 'en-US');

    let restarted = await runtime.restartSpeechRecognition('es-ES', { initialText: 'hello' });

    assert.equal(restarted, true);
    assert.equal(instances[0].aborted, true);
    assert.equal(instances[1].lang, 'es-ES');
    assert.equal(runtime.state, 'recording');

    instances[1].onresult?.({
      results: Object.assign([[{ transcript: 'mundo' }]], { length: 1 }),
    });

    assert.deepEqual(speech, ['hello', 'hello mundo']);
    assert.deepEqual(interim, ['hello', 'hello mundo']);
    assert.deepEqual(await runtime.stop(), { text: 'hello mundo' });
    assert.deepEqual(callbackStates, ['starting', 'recording', 'starting', 'recording', 'processing', 'idle']);
  } finally {
    await runtime?.destroy();
    restoreNavigator();
    restoreWindow();
  }
});

test('blobToBase64 converts browser Blob payloads', async () => {
  class MockFileReader {
    readAsDataURL() {
      this.result = 'data:audio/webm;base64,dm9pY2U=';
      this.onloadend();
    }
  }
  let restoreFileReader = defineGlobal('FileReader', MockFileReader);

  try {
    assert.equal(await blobToBase64(new Blob(['voice'], { type: 'audio/webm' })), 'dm9pY2U=');
  } finally {
    restoreFileReader();
  }
});

test('VoiceRuntime cancel stops active media stream and resolves pending stop', async () => {
  let stopCount = 0;
  let recorderInstance = null;
  let restoreWindow = defineGlobal('window', {});
  let restoreNavigator = defineGlobal('navigator', {
    mediaDevices: {
      async getUserMedia() {
        return {
          getTracks() {
            return [{
              stop() {
                stopCount += 1;
              }
            }];
          }
        };
      }
    }
  });
  let restoreMediaRecorder = defineGlobal('MediaRecorder', class {
    constructor() {
      this.mimeType = '';
      this.state = 'inactive';
      recorderInstance = this;
    }

    static isTypeSupported() {
      return false;
    }

    start() {
      this.state = 'recording';
    }

    stop() {
      this.state = 'inactive';
    }
  });

  let runtime;
  try {
    runtime = new VoiceRuntime();
    await runtime.start({ mode: 'media' });
    let stopPromise = runtime.stop();

    runtime.cancel();
    let result = await stopPromise;

    assert.equal(runtime.state, 'idle');
    assert.equal(result.cancelled, true);
    assert.equal(stopCount, 1);
    assert.equal(recorderInstance.state, 'inactive');
  } finally {
    await runtime?.destroy();
    restoreMediaRecorder();
    restoreNavigator();
    restoreWindow();
  }
});

test('held borrowed stream feeds MediaRecorder with zero getUserMedia calls and survives cleanup', async () => {
  let mocks = installVoiceCaptureMocks();

  let runtime;
  try {
    runtime = new VoiceRuntime();
    let held = makeAudioStream();
    let states = [];
    runtime.addEventListener('statechange', (event) => states.push(event.detail.state));

    runtime.setHeldAudioStream(held);
    await runtime.startMediaRecorder();

    assert.equal(mocks.getUserMediaCalls.length, 0);
    assert.equal(mocks.recorderInstances.length, 1);
    assert.equal(mocks.recorderInstances[0].stream, held);
    assert.equal(runtime.state, 'recording');
    assert.notEqual(runtime._elapsedTimer, null);

    let result = await runtime.stop();

    assert.equal(result.blob.size, 5);
    assert.equal(held.tracks[0].stopCount, 0);
    assert.equal(held.tracks[0].readyState, 'live');
    assert.equal(runtime._elapsedTimer, null);
    assert.equal(runtime._stream, null);
    assert.equal(runtime._mediaRecorder, null);
    assert.equal(runtime.state, 'idle');
    assert.deepEqual(states, ['starting', 'recording', 'processing', 'idle']);
  } finally {
    await runtime?.destroy();
    mocks.restore();
  }
});

test('owned held stream is stopped exactly once across stop, cancel, and destroy', async () => {
  let mocks = installVoiceCaptureMocks();

  let runtime;
  try {
    runtime = new VoiceRuntime();
    let held = makeAudioStream();

    runtime.setHeldAudioStream(held, { owned: true });
    await runtime.startMediaRecorder();

    assert.equal(mocks.getUserMediaCalls.length, 0);
    assert.equal(mocks.recorderInstances[0].stream, held);
    assert.equal(runtime._heldStream, null);

    await runtime.stop();
    assert.equal(held.tracks[0].stopCount, 1);

    runtime.cancel();
    runtime.destroy();

    assert.equal(held.tracks[0].stopCount, 1);
    assert.equal(runtime._heldStream, null);
    assert.equal(runtime._stream, null);
    assert.equal(runtime._elapsedTimer, null);
  } finally {
    await runtime?.destroy();
    mocks.restore();
  }
});

test('borrowed held stream stays live and reusable across cancel and repeated starts', async () => {
  let mocks = installVoiceCaptureMocks();

  let runtime;
  try {
    runtime = new VoiceRuntime();
    let held = makeAudioStream();

    runtime.setHeldAudioStream(held);
    await runtime.startMediaRecorder();
    assert.notEqual(runtime._elapsedTimer, null);

    runtime.cancel();

    assert.equal(runtime.state, 'idle');
    assert.equal(runtime._elapsedTimer, null);
    assert.equal(runtime._stream, null);
    assert.equal(runtime._mediaRecorder, null);
    assert.equal(held.tracks[0].stopCount, 0);
    assert.equal(held.tracks[0].readyState, 'live');

    await runtime.startMediaRecorder();

    assert.equal(mocks.getUserMediaCalls.length, 0);
    assert.equal(mocks.recorderInstances.length, 2);
    assert.equal(mocks.recorderInstances[1].stream, held);

    let result = await runtime.stop();

    assert.equal(result.blob.size, 5);
    assert.equal(held.tracks[0].stopCount, 0);
    assert.equal(held.tracks[0].readyState, 'live');
  } finally {
    await runtime?.destroy();
    mocks.restore();
  }
});

test('clearing held stream with null restores getUserMedia capture', async () => {
  let mocks = installVoiceCaptureMocks();

  let runtime;
  try {
    runtime = new VoiceRuntime();
    let held = makeAudioStream();

    runtime.setHeldAudioStream(held);
    runtime.setHeldAudioStream(null);
    await runtime.startMediaRecorder();

    assert.equal(mocks.getUserMediaCalls.length, 1);
    assert.equal(mocks.recorderInstances.length, 1);
    assert.notEqual(mocks.recorderInstances[0].stream, held);

    let captured = mocks.recorderInstances[0].stream;
    await runtime.stop();

    assert.equal(captured.tracks[0].stopCount, 1);
    assert.equal(held.tracks[0].stopCount, 0);
    assert.equal(held.tracks[0].readyState, 'live');
  } finally {
    await runtime?.destroy();
    mocks.restore();
  }
});

test('dead or audio-less held stream fails deterministically before capture until cleared', async () => {
  let mocks = installVoiceCaptureMocks();

  let runtime;
  try {
    runtime = new VoiceRuntime();

    runtime.setHeldAudioStream(makeAudioStream({ live: false }));
    await assert.rejects(() => runtime.startMediaRecorder(), /no live audio tracks/);
    await assert.rejects(() => runtime.startMediaRecorder(), /no live audio tracks/);

    assert.equal(mocks.getUserMediaCalls.length, 0);
    assert.equal(mocks.recorderInstances.length, 0);
    assert.equal(runtime.state, 'idle');
    assert.equal(runtime._elapsedTimer, null);
    assert.equal(runtime._stream, null);
    assert.equal(runtime._mediaRecorder, null);

    runtime.setHeldAudioStream(makeAudioStream({ audioTracks: 0 }));
    await assert.rejects(() => runtime.startMediaRecorder(), /no live audio tracks/);

    assert.equal(mocks.getUserMediaCalls.length, 0);
    assert.equal(runtime.state, 'idle');

    runtime.setHeldAudioStream(null);
    await runtime.startMediaRecorder();

    assert.equal(mocks.getUserMediaCalls.length, 1);
    assert.equal(runtime.state, 'recording');

    await runtime.stop();
    assert.equal(runtime._elapsedTimer, null);
  } finally {
    await runtime?.destroy();
    mocks.restore();
  }
});

test('recorder start failure releases capture state and borrowed tracks stay live', async () => {
  let mocks = installVoiceCaptureMocks();

  let runtime;
  try {
    runtime = new VoiceRuntime();
    let held = makeAudioStream();

    mocks.control.startError = new Error('recorder start failed');
    runtime.setHeldAudioStream(held);
    await assert.rejects(() => runtime.startMediaRecorder(), /recorder start failed/);

    assert.equal(runtime.state, 'idle');
    assert.equal(runtime._elapsedTimer, null);
    assert.equal(runtime._mediaRecorder, null);
    assert.equal(runtime._stream, null);
    assert.equal(held.tracks[0].stopCount, 0);
    assert.equal(held.tracks[0].readyState, 'live');

    mocks.control.startError = null;
    await runtime.startMediaRecorder();

    assert.equal(runtime.state, 'recording');
    assert.equal(mocks.recorderInstances.length, 2);
    assert.equal(mocks.recorderInstances[1].stream, held);

    await runtime.stop();
    assert.equal(runtime._elapsedTimer, null);
    assert.equal(held.tracks[0].stopCount, 0);
  } finally {
    await runtime?.destroy();
    mocks.restore();
  }
});

test('replacing an owned held stream stops the replaced stream exactly once', async () => {
  let mocks = installVoiceCaptureMocks();

  let runtime;
  try {
    runtime = new VoiceRuntime();
    let first = makeAudioStream();
    let second = makeAudioStream();

    runtime.setHeldAudioStream(first, { owned: true });
    runtime.setHeldAudioStream(second, { owned: true });

    assert.equal(first.tracks[0].stopCount, 1);
    assert.equal(second.tracks[0].stopCount, 0);

    runtime.setHeldAudioStream(second, { owned: true });
    assert.equal(second.tracks[0].stopCount, 0);

    runtime.destroy();

    assert.equal(first.tracks[0].stopCount, 1);
    assert.equal(second.tracks[0].stopCount, 1);
    assert.equal(runtime._heldStream, null);
  } finally {
    await runtime?.destroy();
    mocks.restore();
  }
});

test('consumed owned held stream is not resurrected for the next capture', async () => {
  let mocks = installVoiceCaptureMocks();

  let runtime;
  try {
    runtime = new VoiceRuntime();
    let owned = makeAudioStream();

    runtime.setHeldAudioStream(owned, { owned: true });
    await runtime.startMediaRecorder();
    await runtime.stop();

    assert.equal(owned.tracks[0].stopCount, 1);
    assert.equal(runtime._heldStream, null);

    await runtime.startMediaRecorder();

    assert.equal(mocks.getUserMediaCalls.length, 1);
    assert.equal(mocks.recorderInstances.length, 2);
    assert.notEqual(mocks.recorderInstances[1].stream, owned);

    await runtime.stop();
    runtime.destroy();

    assert.equal(owned.tracks[0].stopCount, 1);
    assert.equal(runtime._heldStream, null);
    assert.equal(runtime._stream, null);
  } finally {
    await runtime?.destroy();
    mocks.restore();
  }
});

test('held stream does not alter speech recognition mode and remains available afterwards', async () => {
  let getUserMediaCalls = [];
  let recognitionInstances = [];
  let restoreWindow = defineGlobal('window', {
    SpeechRecognition: class {
      constructor() {
        this.lang = '';
        recognitionInstances.push(this);
      }

      start() {
        this.onstart?.();
      }

      stop() {
        this.onend?.();
      }

      abort() {}
    },
  });
  let restoreNavigator = defineGlobal('navigator', {
    language: 'en-US',
    mediaDevices: {
      async getUserMedia(constraints) {
        getUserMediaCalls.push(constraints);
        return makeAudioStream();
      },
    },
  });
  let restoreMediaRecorder = defineGlobal('MediaRecorder', class {
    constructor(stream, options) {
      this.stream = stream;
      this.mimeType = options?.mimeType || '';
      this.state = 'inactive';
    }

    static isTypeSupported() {
      return true;
    }

    start() {
      this.state = 'recording';
    }

    stop() {
      this.state = 'inactive';
      this.onstop?.();
    }
  });

  let runtime;
  try {
    runtime = new VoiceRuntime();
    let held = makeAudioStream();

    runtime.setHeldAudioStream(held);
    await runtime.start({ language: 'en-US', mode: 'speech' });

    assert.equal(runtime.state, 'recording');
    assert.equal(recognitionInstances.length, 1);
    assert.equal(getUserMediaCalls.length, 0);
    assert.equal(held.tracks[0].stopCount, 0);

    await runtime.stop();

    assert.equal(held.tracks[0].stopCount, 0);
    assert.equal(held.tracks[0].readyState, 'live');

    await runtime.startMediaRecorder();

    assert.equal(getUserMediaCalls.length, 0);
    assert.equal(runtime.state, 'recording');

    await runtime.stop();
    assert.equal(held.tracks[0].stopCount, 0);
    assert.equal(held.tracks[0].readyState, 'live');
  } finally {
    await runtime?.destroy();
    restoreMediaRecorder();
    restoreNavigator();
    restoreWindow();
  }
});

test('VoiceRuntime dispatches public recognition lifecycle events: audiostart, soundstart, speechstart, instancereplace, and error', async () => {
  let recInstance = null;
  let restoreWindow = defineGlobal('window', {
    SpeechRecognition: class {
      constructor() {
        this.lang = '';
        recInstance = this;
      }
      start() {
        this.onstart?.();
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    },
  });
  let restoreNavigator = defineGlobal('navigator', { language: 'en-US' });

  let runtime;
  try {
    runtime = new VoiceRuntime();
    let eventsEmitted = [];

    runtime.addEventListener('instancereplace', (e) => eventsEmitted.push({ type: 'instancereplace', instance: e.detail.current }));
    runtime.addEventListener('audiostart', (e) => eventsEmitted.push({ type: 'audiostart' }));
    runtime.addEventListener('soundstart', (e) => eventsEmitted.push({ type: 'soundstart' }));
    runtime.addEventListener('speechstart', (e) => eventsEmitted.push({ type: 'speechstart' }));
    runtime.addEventListener('audioend', (e) => eventsEmitted.push({ type: 'audioend' }));
    runtime.addEventListener('soundend', (e) => eventsEmitted.push({ type: 'soundend' }));
    runtime.addEventListener('speechend', (e) => eventsEmitted.push({ type: 'speechend' }));

    await runtime.start({ language: 'en-US', mode: 'speech' });

    assert.ok(recInstance);
    assert.equal(eventsEmitted.length, 1);
    assert.equal(eventsEmitted[0].type, 'instancereplace');

    recInstance.onaudiostart?.({});
    recInstance.onsoundstart?.({});
    recInstance.onspeechstart?.({});
    recInstance.onspeechend?.({});
    recInstance.onsoundend?.({});
    recInstance.onaudioend?.({});

    assert.deepEqual(eventsEmitted.map((e) => e.type), [
      'instancereplace',
      'audiostart',
      'soundstart',
      'speechstart',
      'speechend',
      'soundend',
      'audioend',
    ]);

    await runtime.stop();
  } finally {
    await runtime?.destroy();
    restoreNavigator();
    restoreWindow();
  }
});

test('VoiceRuntime getDiagnostics exposes safe public snapshot without private fields', async () => {
  let runtime;
  try {
    runtime = new VoiceRuntime();
    let diag = runtime.getDiagnostics();

    assert.equal(diag.state, 'idle');
    assert.equal(diag.mode, 'speech');
    assert.equal(diag.activeBackend, 'media-recorder');
    assert.equal(diag.recognition.generation, 0);
    assert.equal(diag.recognition.active, false);
    assert.equal(diag.recorder.generation, 0);
    assert.equal(diag.recorder.active, false);
    assert.equal(diag.heldStream.present, false);
    assert.equal(diag.captureOwned, false);
    assert.equal(diag.timerActive, false);
    assert.equal(diag.lastPhase, null);
    assert.equal(diag.lastError, null);
    assert.equal(Object.isFrozen(diag), true);
    assert.equal(Object.isFrozen(diag.recognition), true);
    assert.equal(Object.isFrozen(diag.recorder), true);
    assert.equal(Object.isFrozen(diag.heldStream), true);
  } finally {
    await runtime?.destroy();
  }
});

test('VoiceRuntime instancereplace emits frozen safe descriptors with previous and current generation', async () => {
  let recInstance = null;
  let restoreWindow = defineGlobal('window', {
    SpeechRecognition: class {
      constructor() {
        this.lang = '';
        recInstance = this;
      }
      start() { this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() {}
    },
  });
  let restoreNavigator = defineGlobal('navigator', { language: 'en-US' });

  let runtime;
  try {
    runtime = new VoiceRuntime();
    let replaceDetails = [];
    runtime.addEventListener('instancereplace', (e) => replaceDetails.push(e.detail));

    await runtime.start({ language: 'en-US', mode: 'speech' });

    assert.equal(replaceDetails.length, 1);
    assert.equal(replaceDetails[0].previous, null);
    assert.equal(replaceDetails[0].current.generation, 1);
    assert.equal(Object.isFrozen(replaceDetails[0].current), true);

    await runtime.restartSpeechRecognition('es-ES', { initialText: 'test' });
    assert.equal(replaceDetails.length, 2);
    assert.equal(replaceDetails[1].previous.generation, 1);
    assert.equal(replaceDetails[1].current.generation, 2);
    assert.equal(Object.isFrozen(replaceDetails[1].previous), true);
    assert.equal(Object.isFrozen(replaceDetails[1].current), true);
  } finally {
    await runtime?.destroy();
    restoreNavigator();
    restoreWindow();
  }
});

test('VoiceRuntime suppresses captured stale callbacks from old SpeechRecognition and MediaRecorder closures after restart and cancel', async () => {
  let instances = [];
  let restoreWindow = defineGlobal('window', {
    SpeechRecognition: class {
      constructor() {
        this.lang = '';
        instances.push(this);
      }
      start() { this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() { this.aborted = true; }
    },
  });
  let restoreNavigator = defineGlobal('navigator', { language: 'en-US' });

  let runtime;
  try {
    runtime = new VoiceRuntime();
    let lifecyclePhases = [];
    runtime.addEventListener('lifecycle', (e) => lifecyclePhases.push({ phase: e.detail.phase, gen: e.detail.generation }));

    await runtime.start({ language: 'en-US', mode: 'speech' });
    let oldInstance = instances[0];
    let savedOnResult = oldInstance.onresult;
    let savedOnError = oldInstance.onerror;
    let savedOnEnd = oldInstance.onend;
    let firstGen = runtime.getDiagnostics().recognition.generation;

    await runtime.restartSpeechRecognition('es-ES', { initialText: 'test' });
    let newGen = runtime.getDiagnostics().recognition.generation;
    assert.notEqual(firstGen, newGen, 'generation incremented on restart');

    // Invoke captured stale closures saved before detachment
    savedOnResult?.({ results: [[{ transcript: 'STALE DATA' }]] });
    savedOnError?.({ error: 'stale-error' });
    savedOnEnd?.();

    // Verify captured stale callbacks did not alter state or diagnostics
    let diag = runtime.getDiagnostics();
    assert.equal(diag.recognition.generation, newGen);
    assert.equal(diag.lastError, null, 'stale error ignored');

    let secondInstance = instances[1];
    let savedSecondOnResult = secondInstance.onresult;
    let savedSecondOnEnd = secondInstance.onend;

    runtime.cancel();
    assert.equal(runtime.state, 'idle');

    // Invoke captured stale closures saved before cancel
    savedSecondOnResult?.({ results: [[{ transcript: 'AFTER CANCEL' }]] });
    savedSecondOnEnd?.();

    assert.equal(runtime.state, 'idle');
    assert.equal(runtime.getDiagnostics().recognition.active, false);
  } finally {
    await runtime?.destroy();
    restoreNavigator();
    restoreWindow();
  }
});

test('VoiceRuntime cancel while SpeechRecognition is starting rejects the pending start promise cleanly', async () => {
  let recInstance = null;
  let restoreWindow = defineGlobal('window', {
    SpeechRecognition: class {
      constructor() { recInstance = this; }
      start() {} // Does not call onstart synchronously
      stop() {}
      abort() {}
    },
  });
  let restoreNavigator = defineGlobal('navigator', { language: 'en-US' });

  let runtime;
  try {
    runtime = new VoiceRuntime();
    let startPromise = runtime.start({ language: 'en-US', mode: 'speech' });
    assert.equal(runtime.state, 'starting');

    runtime.cancel();

    await assert.rejects(startPromise, /VoiceRuntime start cancelled/);
    assert.equal(runtime.state, 'idle');
  } finally {
    await runtime?.destroy();
    restoreNavigator();
    restoreWindow();
  }
});

test('VoiceRuntime handles async MediaRecorder.onerror cleanup via public events and diagnostics', async () => {
  let activeRecorder = null;
  let restoreWindow = defineGlobal('window', {});
  let restoreNavigator = defineGlobal('navigator', {
    language: 'en-US',
    mediaDevices: {
      async getUserMedia() { return makeAudioStream(); },
    },
  });
  let restoreMediaRecorder = defineGlobal('MediaRecorder', class {
    constructor(stream) {
      this.stream = stream;
      this.state = 'inactive';
      activeRecorder = this;
    }
    static isTypeSupported() { return true; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; }
  });

  let runtime;
  try {
    runtime = new VoiceRuntime();
    let errorsEmitted = [];
    let lifecyclePhases = [];
    runtime.addEventListener('error', (e) => errorsEmitted.push(e.detail.error));
    runtime.addEventListener('lifecycle', (e) => lifecyclePhases.push(e.detail.phase));

    await runtime.startMediaRecorder();
    assert.equal(runtime.state, 'recording');

    // Trigger async recorder error
    activeRecorder.onerror?.({ error: new Error('recorder hardware failure') });

    let diag = runtime.getDiagnostics();
    assert.equal(diag.state, 'idle');
    assert.equal(diag.recorder.active, false);
    assert.equal(diag.timerActive, false);
    assert.equal(diag.lastPhase, 'error');
    assert.equal(diag.lastError, 'recorder hardware failure');
    assert.equal(errorsEmitted.length, 1);
  } finally {
    await runtime?.destroy();
    restoreMediaRecorder();
    restoreNavigator();
    restoreWindow();
  }
});

test('VoiceRuntime suppresses captured stale callbacks from old MediaRecorder closures after cancel', async () => {
  let activeRecorder = null;
  let restoreWindow = defineGlobal('window', {});
  let restoreNavigator = defineGlobal('navigator', {
    language: 'en-US',
    mediaDevices: { async getUserMedia() { return makeAudioStream(); } },
  });
  let restoreMediaRecorder = defineGlobal('MediaRecorder', class {
    constructor(stream) {
      this.stream = stream;
      this.state = 'inactive';
      activeRecorder = this;
    }
    static isTypeSupported() { return true; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; }
  });

  let runtime;
  try {
    runtime = new VoiceRuntime();
    let audioChunks = [];
    runtime.addEventListener('audiochunk', (e) => audioChunks.push(e.detail.chunk));

    await runtime.startMediaRecorder();
    let savedDataAvailable = activeRecorder.ondataavailable;
    let savedOnStop = activeRecorder.onstop;
    let savedOnError = activeRecorder.onerror;
    let firstGen = runtime.getDiagnostics().recorder.generation;

    runtime.cancel();
    assert.equal(runtime.state, 'idle');

    // Invoke captured stale closures saved before cancellation
    savedDataAvailable?.({ data: new Blob(['stale chunk']) });
    savedOnError?.({ error: new Error('stale recorder error') });
    savedOnStop?.();

    // Verify state and diagnostics remain idle/unchanged
    let diag = runtime.getDiagnostics();
    assert.equal(diag.state, 'idle');
    assert.equal(diag.recorder.active, false);
    assert.equal(diag.lastError, null, 'stale error ignored');
    assert.equal(audioChunks.length, 0, 'no stale chunks emitted');
  } finally {
    await runtime?.destroy();
    restoreMediaRecorder();
    restoreNavigator();
    restoreWindow();
  }
});

test('VoiceRuntime handles MediaRecorder.start failure cleanly detaching handlers and invalidating generation', async () => {
  let activeRecorder = null;
  let restoreWindow = defineGlobal('window', {});
  let restoreNavigator = defineGlobal('navigator', {
    language: 'en-US',
    mediaDevices: { async getUserMedia() { return makeAudioStream(); } },
  });
  let restoreMediaRecorder = defineGlobal('MediaRecorder', class {
    constructor(stream) {
      this.stream = stream;
      this.state = 'inactive';
      activeRecorder = this;
    }
    static isTypeSupported() { return true; }
    start() { throw new Error('Hardware recorder start failed'); }
    stop() { this.state = 'inactive'; }
  });

  let runtime;
  try {
    runtime = new VoiceRuntime();
    await assert.rejects(async () => {
      await runtime.startMediaRecorder();
    }, /Hardware recorder start failed/);

    let savedDataAvailable = activeRecorder.ondataavailable;
    let savedOnError = activeRecorder.onerror;

    assert.equal(savedDataAvailable, null, 'ondataavailable detached');
    assert.equal(savedOnError, null, 'onerror detached');

    let diag = runtime.getDiagnostics();
    assert.equal(diag.state, 'idle');
    assert.equal(diag.recorder.active, false);
    assert.equal(diag.lastError, 'Hardware recorder start failed');
  } finally {
    await runtime?.destroy();
    restoreMediaRecorder();
    restoreNavigator();
    restoreWindow();
  }
});
