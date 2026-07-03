const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_FPS = 30;
const DEFAULT_TURN_MS = 2200;
const DEFAULT_MIN_TURN_MS = 1200;
const DEFAULT_WORD_MS = 230;
const DEFAULT_CAPTION_MODE = 'off';
const CAPTION_MODES = new Set(['off', 'karaoke', 'burned-in', 'on']);

export const DEFAULT_TOUR_MEDIA_MIME_TYPES = Object.freeze([
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]);

export class TourMediaRenderError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = 'TourMediaRenderError';
    this.code = code;
    this.detail = detail;
  }
}

function getGlobalDocument() {
  return typeof document !== 'undefined' ? document : null;
}

function getGlobalMediaRecorder() {
  return typeof MediaRecorder !== 'undefined' ? MediaRecorder : null;
}

function getGlobalMediaStream() {
  return typeof MediaStream !== 'undefined' ? MediaStream : null;
}

function getGlobalBlob() {
  return typeof Blob !== 'undefined' ? Blob : null;
}

function pickMimeType(Recorder, preferredMimeTypes = DEFAULT_TOUR_MEDIA_MIME_TYPES) {
  if (!Recorder || typeof Recorder.isTypeSupported !== 'function') return '';
  return preferredMimeTypes.find((mimeType) => Recorder.isTypeSupported(mimeType)) || '';
}

function cleanText(value, fallback = '') {
  let text = String(value ?? fallback ?? '').replace(/\s+/g, ' ').trim();
  return text && text !== 'undefined' && text !== 'null' ? text : String(fallback || '').trim();
}

function normalizeCaptionMode(value) {
  let mode = cleanText(value, DEFAULT_CAPTION_MODE).toLowerCase();
  return CAPTION_MODES.has(mode) ? mode : DEFAULT_CAPTION_MODE;
}

function captionsEnabled(mode) {
  return normalizeCaptionMode(mode) !== 'off';
}

function tokenizeWords(value) {
  return cleanText(value).split(/\s+/).filter(Boolean);
}

function words(value) {
  return tokenizeWords(value).length;
}

function turnDurationMs(turn, options = {}) {
  if (Number.isFinite(Number(turn?.durationMs))) return Math.max(0, Number(turn.durationMs));
  if (typeof options.turnDurationMs === 'function') {
    let duration = Number(options.turnDurationMs(turn));
    if (Number.isFinite(duration)) return Math.max(0, duration);
  }
  let min = Number.isFinite(Number(options.minTurnMs)) ? Number(options.minTurnMs) : DEFAULT_MIN_TURN_MS;
  let wordMs = Number.isFinite(Number(options.wordMs)) ? Number(options.wordMs) : DEFAULT_WORD_MS;
  let fallback = Number.isFinite(Number(options.defaultTurnMs)) ? Number(options.defaultTurnMs) : DEFAULT_TURN_MS;
  return Math.max(min, Math.max(fallback, words(turn?.text) * wordMs));
}

export function normalizeTourMediaTimeline(timeline = {}, options = {}) {
  let turns = (Array.isArray(timeline?.turns) ? timeline.turns : [])
    .map((turn, index) => ({
      index,
      persona: cleanText(turn?.persona, index % 2 ? 'ops' : 'guide') || 'guide',
      text: cleanText(turn?.text, ''),
      cue: turn?.cue && typeof turn.cue === 'object' ? { ...turn.cue } : {},
      durationMs: turnDurationMs(turn, options),
    }))
    .filter((turn) => turn.text);

  let personas = timeline?.personas && typeof timeline.personas === 'object' ? { ...timeline.personas } : {};
  let totalMs = turns.reduce((sum, turn) => sum + turn.durationMs, 0);
  return {
    title: cleanText(options.title || timeline?.title, 'UI tour'),
    personas,
    turns,
    totalMs,
  };
}

export function createTourMediaRenderPlan(timeline = {}, options = {}) {
  let normalized = normalizeTourMediaTimeline(timeline, options);
  let elapsedMs = 0;
  let frames = normalized.turns.map((turn) => {
    let frame = {
      ...turn,
      startMs: elapsedMs,
      endMs: elapsedMs + turn.durationMs,
    };
    elapsedMs += turn.durationMs;
    return frame;
  });
  return {
    ...normalized,
    frames,
  };
}

function normalizeWordTiming(timing, frame) {
  if (!timing || Number(timing.index) !== Number(frame.index)) return null;
  let text = cleanText(timing.word || timing.text, '');
  if (!text) return null;
  let startMs = Number(timing.startMs);
  let endMs = Number(timing.endMs);
  if (!Number.isFinite(startMs)) startMs = frame.startMs;
  if (!Number.isFinite(endMs) || endMs < startMs) endMs = startMs + Math.max(80, frame.durationMs / Math.max(1, words(frame.text)));
  return {
    text,
    word: text,
    index: frame.index,
    wordIndex: Number.isFinite(Number(timing.wordIndex)) ? Number(timing.wordIndex) : undefined,
    startMs,
    endMs,
  };
}

function fallbackWordTimings(frame) {
  let tokens = tokenizeWords(frame.text);
  if (!tokens.length) return [];
  let start = frame.startMs + Math.min(320, Math.max(120, frame.durationMs * 0.12));
  let span = Math.max(100, frame.durationMs - (start - frame.startMs) - 120);
  let step = span / Math.max(1, tokens.length);
  return tokens.map((word, wordIndex) => {
    let startMs = start + wordIndex * step;
    return {
      text: word,
      word,
      index: frame.index,
      wordIndex,
      startMs,
      endMs: startMs + Math.max(70, step * 0.75),
    };
  });
}

export function createTourCaptionTrack(timelineOrPlan = {}, options = {}) {
  let plan = Array.isArray(timelineOrPlan?.frames)
    ? timelineOrPlan
    : createTourMediaRenderPlan(timelineOrPlan, options);
  let wordTimings = Array.isArray(options.wordTimings) ? options.wordTimings : [];
  let mode = normalizeCaptionMode(options.captionsMode || options.mode);
  let cues = plan.frames.map((frame) => {
    let timedWords = wordTimings
      .map((timing) => normalizeWordTiming(timing, frame))
      .filter(Boolean)
      .sort((a, b) => a.startMs - b.startMs || (a.wordIndex ?? 0) - (b.wordIndex ?? 0));
    return {
      index: frame.index,
      persona: cleanText(frame.persona, 'guide'),
      text: cleanText(frame.text, ''),
      startMs: frame.startMs,
      endMs: frame.endMs,
      durationMs: frame.durationMs,
      words: timedWords.length ? timedWords : fallbackWordTimings(frame),
    };
  });
  return {
    mode,
    title: cleanText(plan.title, 'UI tour'),
    cues,
    wordTimingCount: cues.reduce((sum, cue) => sum + cue.words.length, 0),
  };
}

function createCanvas(options = {}) {
  if (options.canvas) return options.canvas;
  let doc = options.document || getGlobalDocument();
  if (!doc?.createElement) return null;
  return doc.createElement('canvas');
}

function getVideoTracks(stream) {
  return stream?.getVideoTracks?.() || [];
}

function getAudioTracks(stream) {
  return stream?.getAudioTracks?.() || [];
}

function getTracks(stream) {
  return stream?.getTracks?.() || [];
}

function trackFromAudioInput(input) {
  if (!input) return null;
  if (input.kind === 'audio') return input;
  if (input.track?.kind === 'audio') return input.track;
  return null;
}

async function resolveAudioInput(options = {}, plan) {
  if (typeof options.audioProvider === 'function') {
    return options.audioProvider({ timeline: plan, signal: options.signal, options });
  }
  return options.audioStream || options.audioTrack || null;
}

function audioTracksFromInput(input) {
  let track = trackFromAudioInput(input);
  if (track) return [track];
  if (input?.stream?.getAudioTracks) return getAudioTracks(input.stream);
  if (input?.getAudioTracks) return getAudioTracks(input);
  return [];
}

async function closeAudioInput(input) {
  if (!input) return;
  if (typeof input.close === 'function') {
    await input.close();
    return;
  }
  if (typeof input.dispose === 'function') {
    await input.dispose();
  }
}

function createCombinedStream(videoStream, audioTracks, StreamCtor) {
  let videoTracks = getVideoTracks(videoStream);
  if (!audioTracks.length) return videoStream;
  if (!StreamCtor) {
    throw new TourMediaRenderError('missing-media-stream', 'MediaStream constructor is not available.');
  }
  return new StreamCtor([...videoTracks, ...audioTracks]);
}

function wait(ms, signal) {
  if (!ms) return Promise.resolve();
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    let timer = setTimeout(resolve, ms);
    if (!signal?.addEventListener) return;
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 5) {
  let tokens = cleanText(text).split(/\s+/).filter(Boolean);
  let line = '';
  let lines = [];
  for (let token of tokens) {
    let next = line ? `${line} ${token}` : token;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = token;
      if (lines.length >= maxLines - 1) break;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((ln, index) => ctx.fillText(ln, x, y + index * lineHeight));
}

function activeCaptionCue(track, frame, nowMs) {
  if (!track?.cues?.length) return null;
  let current = Number.isFinite(Number(nowMs)) ? Number(nowMs) : frame.startMs;
  return track.cues.find((cue) => current >= cue.startMs && current <= cue.endMs) ||
    track.cues.find((cue) => cue.index === frame.index) ||
    null;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath?.();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill?.();
    return;
  }
  if (!ctx.beginPath || !ctx.moveTo || !ctx.quadraticCurveTo) {
    ctx.fillRect?.(x, y, width, height);
    return;
  }
  let r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath?.();
  ctx.fill?.();
}

function drawCaptionWords(ctx, cue, nowMs, x, y, maxWidth, lineHeight, palette) {
  let words = cue.words?.length ? cue.words : fallbackWordTimings(cue);
  let cursorX = x;
  let cursorY = y;
  for (let word of words) {
    let text = cleanText(word.text || word.word, '');
    if (!text) continue;
    let suffix = ' ';
    let token = text + suffix;
    let tokenWidth = ctx.measureText(token).width;
    if (cursorX > x && cursorX + tokenWidth > x + maxWidth) {
      cursorX = x;
      cursorY += lineHeight;
    }
    let elapsed = Number(nowMs) >= Number(word.endMs);
    let active = Number(nowMs) >= Number(word.startMs) && Number(nowMs) < Number(word.endMs);
    ctx.fillStyle = elapsed || active ? palette.accent : palette.text;
    ctx.fillText(text, cursorX, cursorY);
    cursorX += ctx.measureText(text).width;
    ctx.fillStyle = palette.muted;
    ctx.fillText(suffix, cursorX, cursorY);
    cursorX += ctx.measureText(suffix).width;
  }
}

function drawTourCaptions(ctx, frame, plan, options = {}, palette) {
  let mode = normalizeCaptionMode(options.captionsMode);
  if (!captionsEnabled(mode)) return;
  let track = options.captionTrack || createTourCaptionTrack(plan, { captionsMode: mode });
  let nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : frame.startMs;
  let cue = activeCaptionCue(track, frame, nowMs);
  if (!cue?.text) return;

  let width = Number(options.width) || DEFAULT_WIDTH;
  let height = Number(options.height) || DEFAULT_HEIGHT;
  let x = Math.round(width * 0.12);
  let y = Math.round(height * 0.78);
  let boxWidth = Math.round(width * 0.76);
  let boxHeight = Math.round(height * 0.14);

  ctx.fillStyle = palette.captionBg || 'rgba(0, 0, 0, 0.55)';
  drawRoundedRect(ctx, x, y, boxWidth, boxHeight, Math.round(height * 0.025));
  ctx.fillStyle = palette.muted;
  ctx.font = '700 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  ctx.fillText(cleanText(cue.persona, 'guide').toUpperCase(), x + 22, y + 28);
  ctx.font = '650 24px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  drawCaptionWords(ctx, cue, nowMs, x + 22, y + 66, boxWidth - 44, 30, palette);
}

function tourMediaPalette(options = {}) {
  return {
    bg: '#151719',
    panel: '#23282d',
    text: '#f4f7fb',
    muted: '#9aa6b2',
    accent: '#6db5ff',
    captionBg: 'rgba(0, 0, 0, 0.55)',
    ...options.palette,
  };
}

export function drawTourCaptionOverlay(ctx, frame, plan, options = {}) {
  drawTourCaptions(ctx, frame, plan, options, tourMediaPalette(options));
}

export function drawTourMediaFrame(ctx, frame, plan, options = {}) {
  let width = Number(options.width) || DEFAULT_WIDTH;
  let height = Number(options.height) || DEFAULT_HEIGHT;
  let palette = tourMediaPalette(options);

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = palette.panel;
  ctx.fillRect(Math.round(width * 0.07), Math.round(height * 0.14), Math.round(width * 0.86), Math.round(height * 0.72));
  ctx.fillStyle = palette.accent;
  ctx.font = '700 30px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  ctx.fillText(cleanText(plan.title, 'UI tour'), Math.round(width * 0.11), Math.round(height * 0.23));
  ctx.fillStyle = palette.muted;
  ctx.font = '700 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  ctx.fillText(cleanText(frame.persona, 'guide').toUpperCase(), Math.round(width * 0.11), Math.round(height * 0.36));
  ctx.fillStyle = palette.text;
  ctx.font = '500 40px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  drawWrappedText(ctx, frame.text, Math.round(width * 0.11), Math.round(height * 0.46), Math.round(width * 0.78), 52, 4);
  ctx.fillStyle = palette.muted;
  ctx.font = '500 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  ctx.fillText(`${frame.index + 1} / ${plan.turns.length}`, Math.round(width * 0.11), Math.round(height * 0.79));
  drawTourCaptionOverlay(ctx, frame, plan, options);
}

function resolveFrameRenderer(options = {}) {
  for (let key of ['frameRenderer', 'renderFrame', 'drawFrame']) {
    if (typeof options[key] === 'function') return options[key];
  }
  return null;
}

async function renderVideoFrame(ctx, canvas, frame, plan, renderOptions, renderer, sourceOptions) {
  if (!renderer) {
    drawTourMediaFrame(ctx, frame, plan, renderOptions);
    return 'default';
  }
  let detail = {
    canvas,
    ctx,
    frame,
    plan,
    width: renderOptions.width,
    height: renderOptions.height,
    nowMs: renderOptions.nowMs,
    elapsedMs: Math.max(0, Number(renderOptions.nowMs) - Number(frame.startMs || 0)),
    captionsMode: renderOptions.captionsMode,
    captionTrack: renderOptions.captionTrack,
    options: sourceOptions,
    drawDefaultFrame(overrides = {}) {
      drawTourMediaFrame(ctx, frame, plan, { ...renderOptions, ...overrides });
    },
    drawCaptionOverlay(overrides = {}) {
      drawTourCaptionOverlay(ctx, frame, plan, { ...renderOptions, ...overrides });
    },
  };
  try {
    await renderer(detail);
  } catch (cause) {
    throw new TourMediaRenderError('frame-render-failed', 'Tour frame renderer failed.', {
      frameIndex: frame.index,
      nowMs: renderOptions.nowMs,
      cause,
    });
  }
  if (sourceOptions.captionOverlay !== false) {
    drawTourCaptionOverlay(ctx, frame, plan, renderOptions);
  }
  return 'custom';
}

export function getTourMediaSupport(options = {}) {
  let canvas = createCanvas(options);
  let Recorder = options.MediaRecorder || getGlobalMediaRecorder();
  let StreamCtor = options.MediaStream || getGlobalMediaStream();
  let BlobCtor = options.Blob || getGlobalBlob();
  return {
    canvas: Boolean(canvas?.getContext && canvas?.captureStream),
    mediaRecorder: Boolean(Recorder),
    mediaStream: Boolean(StreamCtor),
    blob: Boolean(BlobCtor),
    supported: Boolean(canvas?.getContext && canvas?.captureStream && Recorder && StreamCtor && BlobCtor),
  };
}

export async function renderTourVideo(timeline = {}, options = {}) {
  let includeAudio = options.includeAudio !== false;
  let plan = createTourMediaRenderPlan(timeline, options);
  if (!plan.turns.length) {
    throw new TourMediaRenderError('empty-timeline', 'Tour timeline has no narratable turns.');
  }

  let canvas = createCanvas(options);
  let ctx = canvas?.getContext?.('2d');
  if (!canvas?.captureStream || !ctx) {
    throw new TourMediaRenderError('unsupported-canvas-capture', 'Canvas captureStream is not available.');
  }

  let Recorder = options.MediaRecorder || getGlobalMediaRecorder();
  if (!Recorder) throw new TourMediaRenderError('missing-media-recorder', 'MediaRecorder is not available.');
  let StreamCtor = options.MediaStream || getGlobalMediaStream();
  let BlobCtor = options.Blob || getGlobalBlob();
  if (!BlobCtor) throw new TourMediaRenderError('missing-blob', 'Blob is not available.');

  let width = Number(options.width) || DEFAULT_WIDTH;
  let height = Number(options.height) || DEFAULT_HEIGHT;
  let fps = Number(options.fps) || DEFAULT_FPS;
  let frameIntervalMs = Number.isFinite(Number(options.frameIntervalMs))
    ? Math.max(1, Number(options.frameIntervalMs))
    : Math.max(16, Math.round(1000 / fps));
  canvas.width = width;
  canvas.height = height;

  let audioInput = await resolveAudioInput(options, plan);
  let audioTracks = audioTracksFromInput(audioInput);
  if (includeAudio && !audioTracks.length) {
    await closeAudioInput(audioInput);
    throw new TourMediaRenderError('missing-audio-source', 'Tour video rendering with audio requires an audio stream or audio provider.', {
      includeAudio,
      audioTrackCount: 0,
    });
  }
  let wordTimings = Array.isArray(audioInput?.wordTimings)
    ? audioInput.wordTimings
    : Array.isArray(audioInput?.plan?.wordTimings)
      ? audioInput.plan.wordTimings
      : [];
  let captionsMode = normalizeCaptionMode(options.captionsMode);
  let captionTrack = createTourCaptionTrack(plan, { captionsMode, wordTimings });
  let frameRenderer = resolveFrameRenderer(options);
  let renderedFrameCount = 0;

  let videoStream = canvas.captureStream(fps);
  let stream = createCombinedStream(videoStream, includeAudio ? audioTracks : [], StreamCtor);
  let mimeType = pickMimeType(Recorder, options.preferredMimeTypes) || '';
  let recorder = new Recorder(stream, mimeType ? { mimeType } : undefined);
  let chunks = [];
  let stopped = new Promise((resolve, reject) => {
    recorder.addEventListener?.('dataavailable', (event) => {
      if (event?.data?.size > 0) chunks.push(event.data);
    });
    recorder.addEventListener?.('stop', resolve, { once: true });
    recorder.addEventListener?.('error', (event) => reject(event?.error || new Error('Tour video rendering failed')), { once: true });
  });

  recorder.start(options.chunkInterval || 1000);
  for (let frame of plan.frames) {
    if (!frame.durationMs) {
      await renderVideoFrame(ctx, canvas, frame, plan, { ...options, width, height, captionsMode, captionTrack, nowMs: frame.startMs }, frameRenderer, options);
      renderedFrameCount += 1;
      continue;
    }
    for (let elapsed = 0; elapsed < frame.durationMs; elapsed += frameIntervalMs) {
      let stepMs = Math.min(frameIntervalMs, frame.durationMs - elapsed);
      let nowMs = frame.startMs + elapsed;
      await renderVideoFrame(ctx, canvas, frame, plan, { ...options, width, height, captionsMode, captionTrack, nowMs }, frameRenderer, options);
      renderedFrameCount += 1;
      await wait(stepMs, options.signal);
    }
  }
  recorder.stop();
  await stopped;

  for (let track of getTracks(videoStream)) track.stop?.();
  await closeAudioInput(audioInput);

  let type = recorder.mimeType || mimeType || 'video/webm';
  let blob = new BlobCtor(chunks, { type });
  return {
    blob,
    type,
    mimeType: type,
    plan,
    filename: options.filename || 'tour-video.webm',
    audio: {
      requested: includeAudio,
      trackCount: audioTracks.length,
      hasAudio: audioTracks.length > 0,
      wordTimingCount: wordTimings.length,
    },
    captions: {
      mode: captionsMode,
      burnedIn: captionsEnabled(captionsMode),
      track: captionTrack,
      wordTimingCount: captionTrack.wordTimingCount,
    },
    video: {
      trackCount: getVideoTracks(stream).length || getVideoTracks(videoStream).length,
      width,
      height,
      fps,
      frameRenderer: frameRenderer ? 'custom' : 'default',
      renderedFrameCount,
    },
  };
}

export function downloadTourVideoBlob(result, options = {}) {
  let doc = options.document || getGlobalDocument();
  let urlApi = options.URL || (typeof URL !== 'undefined' ? URL : null);
  let blob = result?.blob;
  if (!doc?.createElement || !doc?.body?.appendChild || !urlApi?.createObjectURL || !blob) return false;
  let href = urlApi.createObjectURL(blob);
  let link = doc.createElement('a');
  link.href = href;
  link.download = result.filename || options.filename || 'tour-video.webm';
  link.style.display = 'none';
  doc.body.appendChild(link);
  link.click?.();
  link.remove?.();
  if (typeof urlApi.revokeObjectURL === 'function') {
    setTimeout(() => urlApi.revokeObjectURL(href), 0);
  }
  return true;
}
