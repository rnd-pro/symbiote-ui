import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  TourMediaRenderError,
  createTourCaptionTrack,
  getTourMediaSupport,
  normalizeTourMediaTimeline,
  renderTourVideo,
} from '../ui/tour-media-renderer.js';

class FakeTrack {
  constructor(kind) {
    this.kind = kind;
    this.stopped = false;
  }

  stop() {
    this.stopped = true;
  }
}

class FakeStream {
  constructor(tracks = []) {
    this._tracks = tracks;
  }

  getTracks() {
    return this._tracks;
  }

  getAudioTracks() {
    return this._tracks.filter((track) => track.kind === 'audio');
  }

  getVideoTracks() {
    return this._tracks.filter((track) => track.kind === 'video');
  }
}

class FakeCanvasContext {
  constructor() {
    this.calls = [];
  }

  fillRect(...args) {
    this.calls.push(['fillRect', ...args]);
  }

  fillText(...args) {
    this.calls.push(['fillText', ...args]);
  }

  measureText(text) {
    return { width: String(text).length * 10 };
  }
}

class FakeCanvas {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.context = new FakeCanvasContext();
    this.videoTrack = new FakeTrack('video');
  }

  getContext(type) {
    return type === '2d' ? this.context : null;
  }

  captureStream() {
    return new FakeStream([this.videoTrack]);
  }
}

class FakeMediaRecorder extends EventTarget {
  static isTypeSupported(type) {
    return type === 'video/webm';
  }

  constructor(stream, options = {}) {
    super();
    this.stream = stream;
    this.mimeType = options.mimeType || 'video/webm';
    this.state = 'inactive';
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    queueMicrotask(() => {
      let event = new Event('dataavailable');
      event.data = new Blob(['webm'], { type: this.mimeType });
      this.dispatchEvent(event);
      this.dispatchEvent(new Event('stop'));
    });
  }
}

test('normalizes tour timeline and drops empty or undefined turns', () => {
  let timeline = normalizeTourMediaTimeline({
    title: '  Current UI  ',
    turns: [
      { persona: ' guide ', text: ' First section ' },
      { persona: 'ops', text: undefined },
      { persona: 'ops', text: 'undefined' },
      { persona: '', text: 'Second section' },
    ],
  });

  assert.equal(timeline.title, 'Current UI');
  assert.equal(timeline.turns.length, 2);
  assert.deepEqual(timeline.turns.map((turn) => turn.text), ['First section', 'Second section']);
  assert.deepEqual(timeline.turns.map((turn) => turn.persona), ['guide', 'ops']);
  assert.ok(timeline.totalMs > 0);
});

test('reports missing audio provider when audio rendering is requested', async () => {
  await assert.rejects(
    renderTourVideo(
      { turns: [{ text: 'Narrated section' }] },
      {
        canvas: new FakeCanvas(),
        MediaRecorder: FakeMediaRecorder,
        MediaStream: FakeStream,
        Blob,
        preferredMimeTypes: ['video/webm'],
      }
    ),
    (error) => {
      assert.ok(error instanceof TourMediaRenderError);
      assert.equal(error.code, 'missing-audio-source');
      assert.equal(error.detail.audioTrackCount, 0);
      return true;
    }
  );
});

test('renders a webm blob when an audio stream is supplied', async () => {
  let canvas = new FakeCanvas();
  let audioTrack = new FakeTrack('audio');
  let result = await renderTourVideo(
    { title: 'Demo', turns: [{ text: 'One short section', durationMs: 1 }] },
    {
      canvas,
      audioStream: new FakeStream([audioTrack]),
      MediaRecorder: FakeMediaRecorder,
      MediaStream: FakeStream,
      Blob,
      preferredMimeTypes: ['video/webm'],
      filename: 'demo.webm',
    }
  );

  assert.equal(result.type, 'video/webm');
  assert.equal(result.filename, 'demo.webm');
  assert.equal(result.audio.requested, true);
  assert.equal(result.audio.trackCount, 1);
  assert.equal(result.video.trackCount, 1);
  assert.ok(result.blob.size > 0);
  assert.equal(canvas.videoTrack.stopped, true);
});

test('creates karaoke caption tracks from audio word timings', () => {
  let track = createTourCaptionTrack({
    title: 'Workspace tour',
    turns: [{ persona: 'guide', text: 'Hello board', durationMs: 120 }],
  }, {
    captionsMode: 'karaoke',
    wordTimings: [
      { index: 0, wordIndex: 0, word: 'Hello', startMs: 12, endMs: 42 },
      { index: 0, wordIndex: 1, word: 'board', startMs: 44, endMs: 82 },
    ],
  });

  assert.equal(track.mode, 'karaoke');
  assert.equal(track.wordTimingCount, 2);
  assert.deepEqual(
    track.cues[0].words.map((word) => [word.text, word.startMs, word.endMs]),
    [['Hello', 12, 42], ['board', 44, 82]],
  );
});

test('burns karaoke captions into rendered tour video and returns caption sidecar metadata', async () => {
  let canvas = new FakeCanvas();
  let closed = 0;
  let result = await renderTourVideo(
    { title: 'Demo', turns: [{ text: 'Hello board', durationMs: 24 }] },
    {
      canvas,
      audioProvider: () => ({
        stream: new FakeStream([new FakeTrack('audio')]),
        wordTimings: [
          { index: 0, wordIndex: 0, word: 'Hello', startMs: 0, endMs: 10 },
          { index: 0, wordIndex: 1, word: 'board', startMs: 12, endMs: 24 },
        ],
        close: () => {
          closed += 1;
        },
      }),
      MediaRecorder: FakeMediaRecorder,
      MediaStream: FakeStream,
      Blob,
      preferredMimeTypes: ['video/webm'],
      captionsMode: 'karaoke',
      frameIntervalMs: 8,
    }
  );

  assert.equal(result.audio.hasAudio, true);
  assert.equal(result.audio.wordTimingCount, 2);
  assert.equal(result.captions.mode, 'karaoke');
  assert.equal(result.captions.burnedIn, true);
  assert.equal(result.captions.wordTimingCount, 2);
  assert.equal(result.captions.track.cues[0].words[1].text, 'board');
  assert.equal(closed, 1);
  assert.ok(canvas.context.calls.some((call) => call[0] === 'fillText' && call[1] === 'Hello'));
  assert.ok(canvas.context.calls.some((call) => call[0] === 'fillText' && call[1] === 'board'));
});

test('accepts a custom frame renderer for host UI capture and overlays captions after it', async () => {
  let canvas = new FakeCanvas();
  let frames = [];
  let result = await renderTourVideo(
    { title: 'Live UI', turns: [{ persona: 'guide', text: 'Panel status', durationMs: 16 }] },
    {
      canvas,
      audioStream: new FakeStream([new FakeTrack('audio')]),
      MediaRecorder: FakeMediaRecorder,
      MediaStream: FakeStream,
      Blob,
      preferredMimeTypes: ['video/webm'],
      captionsMode: 'karaoke',
      frameIntervalMs: 8,
      frameRenderer({ ctx, frame, nowMs, captionTrack, width, height }) {
        frames.push({ index: frame.index, nowMs, wordCount: captionTrack.wordTimingCount, width, height });
        ctx.fillText('LIVE UI', 4, 8);
      },
    }
  );

  assert.equal(result.video.frameRenderer, 'custom');
  assert.equal(result.video.renderedFrameCount, 2);
  assert.equal(frames.length, 2);
  assert.equal(frames[0].wordCount, 2);
  let texts = canvas.context.calls.filter((call) => call[0] === 'fillText').map((call) => call[1]);
  assert.ok(texts.includes('LIVE UI'));
  assert.ok(texts.includes('Panel'));
  assert.ok(texts.includes('status'));
});

test('closes provider-owned audio input after rendering', async () => {
  let closed = 0;
  let audioTrack = new FakeTrack('audio');
  await renderTourVideo(
    { title: 'Demo', turns: [{ text: 'One section', durationMs: 1 }] },
    {
      canvas: new FakeCanvas(),
      audioProvider: () => ({
        stream: new FakeStream([audioTrack]),
        close: () => {
          closed += 1;
          audioTrack.stop();
        },
      }),
      MediaRecorder: FakeMediaRecorder,
      MediaStream: FakeStream,
      Blob,
      preferredMimeTypes: ['video/webm'],
    }
  );

  assert.equal(closed, 1);
  assert.equal(audioTrack.stopped, true);
});

test('reports browser capability support from injected platform constructors', () => {
  let support = getTourMediaSupport({
    canvas: new FakeCanvas(),
    MediaRecorder: FakeMediaRecorder,
    MediaStream: FakeStream,
    Blob,
  });

  assert.equal(support.canvas, true);
  assert.equal(support.mediaRecorder, true);
  assert.equal(support.mediaStream, true);
  assert.equal(support.blob, true);
  assert.equal(support.supported, true);
});
