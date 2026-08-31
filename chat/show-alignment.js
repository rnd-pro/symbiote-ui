import { normalizeShowDirective } from './show-contracts.js';

export const SHOW_ALIGNED_SEQUENCE_VERSION = 'workspace-aligned-sequence-v3';
export const SHOW_AUDIO_ALIGNMENT_RESOLUTIONS = Object.freeze(['exact', 'occurrence', 'segment']);
const OWNED_SEEK_TIMEOUT_MS = 5000;
const OWNED_SEEK_TOLERANCE_MS = 25;
const OWNED_SEEK_MAX_ASSIGNMENTS = 4;
const PLAYBACK_SAMPLE_INTERVAL_MS = 250;

export class ShowAlignmentError extends TypeError {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ShowAlignmentError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new ShowAlignmentError(code, message, details);
}

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('invalid-record', `${name} must be an object`);
  }
  return value;
}

function nonempty(value, name) {
  let normalized = String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (!normalized) fail('missing-field', `${name} must be a non-empty string`);
  return normalized;
}

function integer(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail('invalid-timing', `${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function canonicalTokens(value) {
  return nonempty(value, 'token source')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('und')
    .match(/[\p{L}\p{N}]+/gu) || [];
}

function normalizeWord(word, wordIndex, turn) {
  let input = record(word, `turns[${turn.turnIndex}].words[${wordIndex}]`);
  let startMs = integer(input.startMs, `turns[${turn.turnIndex}].words[${wordIndex}].startMs`, {
    min: turn.startMs,
    max: turn.endMs,
  });
  let endMs = integer(input.endMs, `turns[${turn.turnIndex}].words[${wordIndex}].endMs`, {
    min: startMs,
    max: turn.endMs,
  });
  return Object.freeze({
    wordIndex,
    text: nonempty(input.text, `turns[${turn.turnIndex}].words[${wordIndex}].text`),
    startMs,
    endMs,
  });
}

export function validateShowAlignedSequence(value = {}) {
  let input = record(value, 'aligned sequence');
  if (input.contractVersion !== SHOW_ALIGNED_SEQUENCE_VERSION) {
    fail('unsupported-version', `aligned sequence must use ${SHOW_ALIGNED_SEQUENCE_VERSION}`);
  }
  nonempty(input.timelineHash, 'aligned sequence timelineHash');
  let media = record(input.media, 'aligned sequence media');
  nonempty(media.hash, 'aligned sequence media.hash');
  let durationMs = integer(media.durationMs, 'aligned sequence media.durationMs', { min: 1 });
  nonempty(input.hash, 'aligned sequence hash');
  if (!Array.isArray(input.turns)) fail('missing-turns', 'aligned sequence turns must be an array');
  let priorStartMs = -1;
  for (let [turnIndex, valueTurn] of input.turns.entries()) {
    let turn = record(valueTurn, `turns[${turnIndex}]`);
    if (turn.turnIndex !== turnIndex) fail('invalid-turn-index', `turns[${turnIndex}].turnIndex must equal ${turnIndex}`);
    let startMs = integer(turn.startMs, `turns[${turnIndex}].startMs`, { max: durationMs });
    let endMs = integer(turn.endMs, `turns[${turnIndex}].endMs`, { min: startMs, max: durationMs });
    if (startMs < priorStartMs) fail('invalid-timing', 'aligned sequence turn spans must be monotonic');
    priorStartMs = startMs;
    if (turn.words !== undefined && !Array.isArray(turn.words)) fail('invalid-words', `turns[${turnIndex}].words must be an array`);
    let normalizedTurn = { turnIndex, startMs, endMs };
    for (let [wordIndex, word] of (turn.words || []).entries()) {
      normalizeWord(word, wordIndex, normalizedTurn);
    }
  }
  if (!Array.isArray(input.events)) fail('missing-events', 'aligned sequence events must be an array');
  return input;
}

function normalizedTurn(sequence, turnIndex) {
  let turn = sequence.turns[turnIndex];
  if (!turn) fail('turn-unresolved', `aligned sequence does not contain turn ${turnIndex}`, { turnIndex });
  let normalized = {
    turnIndex,
    startMs: turn.startMs,
    endMs: turn.endMs,
  };
  return {
    ...normalized,
    words: Object.freeze((turn.words || []).map((word, wordIndex) => normalizeWord(word, wordIndex, normalized))),
  };
}

function tokenizedWords(words) {
  return words.flatMap((word) => canonicalTokens(word.text).map((token) => ({ token, word })));
}

function wordMatches(words, quote) {
  let quoteTokens = canonicalTokens(quote);
  let observed = tokenizedWords(words);
  let matches = [];
  for (let index = 0; index <= observed.length - quoteTokens.length; index += 1) {
    if (quoteTokens.every((token, offset) => token === observed[index + offset].token)) {
      matches.push(observed.slice(index, index + quoteTokens.length).map((entry) => entry.word));
    }
  }
  return matches;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function provenance(sequence, turn, source, details = {}) {
  return Object.freeze({
    source,
    contractVersion: sequence.contractVersion,
    alignedSequenceHash: sequence.hash,
    mediaHash: sequence.media.hash,
    mediaDurationMs: sequence.media.durationMs,
    turnIndex: turn.turnIndex,
    segment: Object.freeze({ startMs: turn.startMs, endMs: turn.endMs }),
    ...details,
  });
}

export function resolveShowAudioAnchor(alignedSequence, value = {}, options = {}) {
  let sequence = validateShowAlignedSequence(alignedSequence);
  let anchor = record(value, 'audio anchor');
  let turnIndex = integer(anchor.turnIndex, 'audio anchor.turnIndex');
  let turn = normalizedTurn(sequence, turnIndex);
  let kind = String(anchor.anchor || 'speech');
  let edge = String(anchor.edge || 'start');
  if (!['speech', 'turn-start', 'turn-end'].includes(kind)) fail('invalid-anchor', `unsupported audio anchor "${kind}"`);
  if (!['start', 'end'].includes(edge)) fail('invalid-edge', `unsupported audio anchor edge "${edge}"`);
  let offsetMs = anchor.offsetMs === undefined ? 0 : integer(anchor.offsetMs, 'audio anchor.offsetMs', { min: Number.MIN_SAFE_INTEGER });
  let segmentBoundary = kind === 'turn-end' || (kind === 'speech' && edge === 'end') ? turn.endMs : turn.startMs;

  if (kind !== 'speech') {
    return Object.freeze({
      timeMs: clamp(segmentBoundary + offsetMs, 0, sequence.media.durationMs),
      resolution: 'segment',
      confidence: 'high',
      provenance: provenance(sequence, turn, 'recognized-segment', {
        edge: kind === 'turn-end' ? 'end' : 'start',
        offsetMs,
        fallbackReason: 'explicit-segment-anchor',
      }),
    });
  }

  let quote = nonempty(anchor.quote, 'audio anchor.quote');
  let occurrence = anchor.occurrence === undefined ? 1 : integer(anchor.occurrence, 'audio anchor.occurrence', { min: 1 });
  let matches = wordMatches(turn.words, quote);
  let match = matches[occurrence - 1];
  let timingsReliable = turn.words.every((word, index) => (
    word.endMs > word.startMs
    && (index === 0 || word.startMs >= turn.words[index - 1].endMs)
  ));
  let isWordReliable = typeof options.isWordReliable === 'function'
    ? options.isWordReliable
    : () => true;
  let reliable = timingsReliable && match && match.every((word) => isWordReliable(Object.freeze({
    word,
    wordIndex: word.wordIndex,
    turn: alignedSequence.turns[turnIndex],
    turnIndex,
    anchor,
  })) !== false);
  if (reliable) {
    let selected = edge === 'end' ? match.at(-1) : match[0];
    return Object.freeze({
      timeMs: clamp((edge === 'end' ? selected.endMs : selected.startMs) + offsetMs, 0, sequence.media.durationMs),
      resolution: matches.length === 1 ? 'exact' : 'occurrence',
      confidence: 'high',
      provenance: provenance(sequence, turn, 'recognized-word', {
        edge,
        offsetMs,
        quote,
        occurrence,
        wordIndexes: Object.freeze([...new Set(match.map((word) => word.wordIndex))]),
      }),
    });
  }

  return Object.freeze({
    timeMs: clamp(segmentBoundary + offsetMs, 0, sequence.media.durationMs),
    resolution: 'segment',
    confidence: ['high', 'medium', 'low'].includes(options.segmentConfidence)
      ? options.segmentConfidence
      : 'low',
    provenance: provenance(sequence, turn, 'recognized-segment', {
      edge,
      offsetMs,
      quote,
      occurrence,
      fallbackReason: match ? 'word-evidence-unreliable' : 'word-anchor-missing',
    }),
  });
}

export function createShowAlignedCueSchedule(alignedSequence, cues = [], options = {}) {
  let sequence = validateShowAlignedSequence(alignedSequence);
  if (!Array.isArray(cues)) fail('invalid-cues', 'show aligned cues must be an array');
  let ids = new Set();
  let schedule = cues.map((value, index) => {
    let cue = record(value, `cues[${index}]`);
    let cueId = nonempty(cue.cueId ?? cue.id, `cues[${index}].cueId`);
    if (ids.has(cueId)) fail('duplicate-cue', `show aligned cue "${cueId}" is duplicated`, { cueId });
    ids.add(cueId);
    let turnIndex = integer(cue.turnIndex, `cues[${index}].turnIndex`);
    let alignment = resolveShowAudioAnchor(sequence, { ...record(cue.at ?? cue.anchor, `cues[${index}].at`), turnIndex }, options);
    return Object.freeze({
      cueId,
      turnIndex,
      timeMs: alignment.timeMs,
      directive: normalizeShowDirective(cue.directive),
      alignment,
    });
  });
  schedule.sort((left, right) => left.timeMs - right.timeMs || left.cueId.localeCompare(right.cueId));
  return Object.freeze(schedule);
}

function mediaTimeMs(media, durationMs) {
  let seconds = Number(media?.currentTime);
  if (!Number.isFinite(seconds) || seconds < 0) fail('invalid-media-time', 'media.currentTime must be a non-negative finite number');
  return clamp(Math.round(seconds * 1000), 0, durationMs);
}

export class ShowAlignedMediaRuntime {
  constructor({ media, schedule, onCue, onReset, onSeekFailure, playbackClock, autoAttach = true } = {}) {
    if (!media || typeof media !== 'object') fail('missing-media', 'aligned media runtime requires media');
    if (!Array.isArray(schedule)) fail('invalid-schedule', 'aligned media runtime requires a cue schedule');
    this.media = media;
    this.schedule = Object.freeze([...schedule]);
    this.onCue = typeof onCue === 'function' ? onCue : null;
    this.onReset = typeof onReset === 'function' ? onReset : null;
    this.onSeekFailure = typeof onSeekFailure === 'function' ? onSeekFailure : null;
    this.durationMs = Math.max(0, ...this.schedule.map((cue) => cue.alignment?.provenance?.mediaDurationMs || cue.timeMs));
    this._fired = new Set();
    this._previousMediaTimeMs = null;
    this._attached = false;
    this._ownedSeek = null;
    this._ownedSeekSequence = 0;
    let clock = playbackClock && typeof playbackClock === 'object' ? playbackClock : {};
    this._playbackClockRequest = typeof clock.request === 'function'
      ? (callback) => clock.request(callback)
      : (callback) => globalThis.setTimeout(callback, PLAYBACK_SAMPLE_INTERVAL_MS);
    this._playbackClockCancel = typeof clock.cancel === 'function'
      ? (handle) => clock.cancel(handle)
      : (handle) => globalThis.clearTimeout(handle);
    this._playbackClockDocument = clock.document || media.ownerDocument || null;
    this._playbackClockHandle = null;
    this._playbackClockSequence = 0;
    this._documentListeners = {
      visibilitychange: () => {
        if (this._playbackClockDocument?.visibilityState === 'hidden') {
          this._stopPlaybackClock('document-hidden');
          return;
        }
        if (this.media.paused !== true && !this._ownedSeek) this.sample({ reason: 'document-visible' });
        this._startPlaybackClock('document-visible');
      },
      pagehide: () => this._stopPlaybackClock('pagehide'),
      pageshow: () => {
        if (this.media.paused !== true && !this._ownedSeek) this.sample({ reason: 'pageshow' });
        this._startPlaybackClock('pageshow');
      },
    };
    this._listeners = {
      pause: () => {
        this._stopPlaybackClock('pause');
        if (!this._ownedSeek) this.sample({ reason: 'pause' });
      },
      play: () => {
        if (!this._ownedSeek) {
          this.sample({ reason: 'resume' });
          this._startPlaybackClock('play');
        }
      },
      playing: () => this._startPlaybackClock('playing'),
      waiting: () => this._stopPlaybackClock('waiting'),
      timeupdate: () => {
        if (this._ownedSeek) return this._advanceOwnedSeek('timeupdate');
        this.sample({ reason: 'timeupdate' });
        this._startPlaybackClock('timeupdate');
      },
      seeking: () => {
        this._stopPlaybackClock('seeking');
        if (!this._ownedSeek) return;
        this._ownedSeek.phase = 'seeking';
      },
      loadedmetadata: () => this._advanceOwnedSeek('loadedmetadata'),
      loadstart: () => {
        this._stopPlaybackClock('loadstart');
        return this._advanceOwnedSeek('loadstart');
      },
      loadeddata: () => this._advanceOwnedSeek('loadeddata'),
      canplay: () => this._advanceOwnedSeek('canplay'),
      canplaythrough: () => this._advanceOwnedSeek('canplaythrough'),
      durationchange: () => this._advanceOwnedSeek('durationchange'),
      progress: () => this._advanceOwnedSeek('progress'),
      seeked: () => {
        if (this._ownedSeek) return this._completeOwnedSeek();
        let receipt = this.restore(this.nowMediaMs(), { reason: 'seeked' });
        this._startPlaybackClock('seeked');
        return receipt;
      },
      ended: () => {
        if (!this._ownedSeek) this.sample({ reason: 'ended' });
        this._stopPlaybackClock('ended');
      },
      abort: () => {
        this._stopPlaybackClock('media-abort');
        return this._handleOwnedMediaReset('media-abort');
      },
      emptied: () => {
        this._stopPlaybackClock('media-emptied');
        return this._handleOwnedMediaReset('media-emptied');
      },
      error: () => {
        this._stopPlaybackClock('media-error');
        return this._failOwnedSeek(this._ownedSeek, 'media-error');
      },
    };
    if (autoAttach) this.attach();
  }

  nowMediaMs() {
    return mediaTimeMs(this.media, this.durationMs || Number.MAX_SAFE_INTEGER);
  }

  attach() {
    if (this._attached || typeof this.media.addEventListener !== 'function') return this;
    for (let [type, listener] of Object.entries(this._listeners)) this.media.addEventListener(type, listener);
    if (typeof this._playbackClockDocument?.addEventListener === 'function') {
      for (let [type, listener] of Object.entries(this._documentListeners)) {
        this._playbackClockDocument.addEventListener(type, listener);
      }
    }
    this._attached = true;
    this._startPlaybackClock('attach');
    return this;
  }

  get playbackClockState() {
    return Object.freeze({
      active: this._playbackClockHandle !== null,
      intervalMs: PLAYBACK_SAMPLE_INTERVAL_MS,
      pendingCueCount: this.schedule.filter((cue) => !this._fired.has(cue.cueId)).length,
    });
  }

  _canRunPlaybackClock() {
    return this._attached
      && !this._ownedSeek
      && this.media.paused !== true
      && this.media.ended !== true
      && !this.media.error
      && this._playbackClockDocument?.visibilityState !== 'hidden'
      && this.schedule.some((cue) => !this._fired.has(cue.cueId));
  }

  _startPlaybackClock() {
    if (this._playbackClockHandle !== null || !this._canRunPlaybackClock()) return false;
    let sequence = ++this._playbackClockSequence;
    this._playbackClockHandle = this._playbackClockRequest(() => {
      if (sequence !== this._playbackClockSequence) return;
      this._playbackClockHandle = null;
      if (!this._canRunPlaybackClock()) return;
      this.sample({ reason: 'playback-clock' });
      this._startPlaybackClock('continue');
    });
    return true;
  }

  _stopPlaybackClock() {
    this._playbackClockSequence += 1;
    if (this._playbackClockHandle === null) return false;
    this._playbackClockCancel(this._playbackClockHandle);
    this._playbackClockHandle = null;
    return true;
  }

  _dispatch(cues, mediaTime, reason, { notify = true } = {}) {
    let receipts = [];
    for (let cue of cues) {
      if (this._fired.has(cue.cueId)) continue;
      this._fired.add(cue.cueId);
      let receipt = Object.freeze({ cue, mediaTimeMs: mediaTime, cueTimeMs: cue.timeMs, reason });
      receipts.push(receipt);
      if (notify) this.onCue?.(receipt);
    }
    return Object.freeze(receipts);
  }

  sample({ reason = 'sample' } = {}) {
    let observed = this.nowMediaMs();
    if (this._previousMediaTimeMs === null || observed < this._previousMediaTimeMs) {
      return this.restore(observed, { reason: this._previousMediaTimeMs === null ? 'initial' : reason });
    }
    let due = this.schedule.filter((cue) => cue.timeMs > this._previousMediaTimeMs && cue.timeMs <= observed);
    this._previousMediaTimeMs = observed;
    return this._dispatch(due, observed, reason);
  }

  restore(mediaTime = this.nowMediaMs(), { reason = 'restore', notify = true } = {}) {
    let observed = integer(mediaTime, 'restore mediaTimeMs', { max: this.durationMs || Number.MAX_SAFE_INTEGER });
    this._fired.clear();
    this._previousMediaTimeMs = observed;
    this.onReset?.(Object.freeze({ reason, mediaTimeMs: observed }));
    return this._dispatch(this.schedule.filter((cue) => cue.timeMs <= observed), observed, reason, { notify });
  }

  _startOwnedSeekTimeout(operation) {
    if (!operation || operation !== this._ownedSeek) return;
    let timeoutSignal = AbortSignal.timeout(OWNED_SEEK_TIMEOUT_MS);
    let onTimeout = () => this._failOwnedSeek(operation, 'timeout');
    operation.timeoutSignal = timeoutSignal;
    operation.onTimeout = onTimeout;
    timeoutSignal.addEventListener('abort', onTimeout, { once: true });
  }

  _clearOwnedSeek(operation, reason) {
    if (!operation || operation !== this._ownedSeek) return false;
    if (operation.mode === 'load') {
      return this._settleOwnedSeek(operation, reason === 'completed' ? 'completed' : 'cancelled', reason);
    }
    if (operation.timeoutSignal && operation.onTimeout) {
      operation.timeoutSignal.removeEventListener('abort', operation.onTimeout);
    }
    this._ownedSeek = null;
    operation.controller.abort(reason);
    if (reason === 'completed') this._startPlaybackClock('owned-seek-completed');
    return true;
  }

  _ownedSeekReceipt(operation, status, terminalReason) {
    let receipt = {
      status,
      reason: status === 'completed' ? operation.reason : terminalReason,
      terminalReason,
      operationId: operation.operationId,
      requestedMs: operation.requestedMs,
      observedMs: this._ownedSeekObservedMs(),
      phase: status === 'completed' ? 'completed' : operation.phase,
      source: operation.source,
    };
    if (operation.mode === 'load') receipt.generation = operation.generation;
    if (status !== 'completed') receipt.requestReason = operation.reason;
    return Object.freeze(receipt);
  }

  _settleOwnedSeek(operation, status, terminalReason) {
    if (!operation || operation !== this._ownedSeek) return false;
    let receipt = this._ownedSeekReceipt(operation, status, terminalReason);
    if (operation.timeoutSignal && operation.onTimeout) {
      operation.timeoutSignal.removeEventListener('abort', operation.onTimeout);
    }
    this._ownedSeek = null;
    operation.controller.abort(terminalReason);
    operation.resolve?.(receipt);
    if (status !== 'completed') this.onSeekFailure?.(receipt);
    if (status === 'completed' && operation.resumeOnComplete) this.media.play?.();
    return receipt;
  }

  _ownedSeekObservedMs() {
    let value = Number(this.media?.currentTime);
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * 1000);
  }

  _failOwnedSeek(operation, reason) {
    if (!operation || operation !== this._ownedSeek) return false;
    if (operation.mode === 'load') return this._settleOwnedSeek(operation, 'failed', reason);
    let receipt = Object.freeze({
      status: 'failed',
      reason,
      operationId: operation.operationId,
      requestedMs: operation.requestedMs,
      observedMs: this._ownedSeekObservedMs(),
      phase: operation.phase,
      source: operation.source,
    });
    this._clearOwnedSeek(operation, reason);
    this.onSeekFailure?.(receipt);
    return true;
  }

  _beginOwnedSeek(requestedMs, reason, options = {}) {
    this._stopPlaybackClock('owned-seek');
    this._clearOwnedSeek(this._ownedSeek, 'replaced');
    let operation = {
      operationId: ++this._ownedSeekSequence,
      requestedMs,
      reason,
      mode: options.mode || 'seek',
      phase: 'requested',
      source: String(options.source ?? this.media.src ?? this.media.currentSrc ?? ''),
      assignmentCount: 0,
      controller: new AbortController(),
      timeoutSignal: null,
      onTimeout: null,
    };
    if (operation.mode === 'load') {
      operation.generation = operation.operationId;
      operation.metadataObserved = false;
      operation.currentDataObserved = false;
      operation.seekedObserved = false;
      operation.resumeOnComplete = options.paused === false;
      operation.promise = new Promise((resolve) => {
        operation.resolve = resolve;
      });
    }
    this._ownedSeek = operation;
    this._startOwnedSeekTimeout(operation);
    return operation;
  }

  _canSeekOwnedPosition(operation) {
    let seekable = this.media.seekable;
    if (!seekable || !Number.isInteger(seekable.length)) return false;
    let requested = operation.requestedMs / 1000;
    for (let index = 0; index < seekable.length; index += 1) {
      if (requested >= seekable.start(index) && requested <= seekable.end(index)) return true;
    }
    return false;
  }

  _isOwnedSeekObserved(operation, observedMs) {
    if (operation.requestedMs > 0 && observedMs === 0) return false;
    return Math.abs(observedMs - operation.requestedMs) <= OWNED_SEEK_TOLERANCE_MS;
  }

  _canReassertOwnedSeek(operation) {
    return this._canSeekOwnedPosition(operation) || Number(this.media.readyState) >= 1;
  }

  _assignOwnedSeek(operation, phase) {
    if (!operation || operation !== this._ownedSeek) return false;
    if (operation.assignmentCount >= OWNED_SEEK_MAX_ASSIGNMENTS) {
      operation.phase = 'awaiting-observed-position';
      return false;
    }
    operation.assignmentCount += 1;
    operation.phase = phase;
    try {
      this.media.currentTime = operation.requestedMs / 1000;
    } catch (error) {
      this._failOwnedSeek(operation, `${phase}-assignment-error`);
      throw error;
    }
    return true;
  }

  _completeOwnedSeek() {
    let operation = this._ownedSeek;
    if (!operation) return false;
    let observed = this.nowMediaMs();
    if (operation.mode === 'load') {
      operation.seekedObserved = this._isOwnedSeekObserved(operation, observed);
      if (
        operation.seekedObserved
        && operation.metadataObserved
        && Number(this.media.readyState) >= 2
      ) {
        operation.phase = 'completed';
        return this._clearOwnedSeek(operation, 'completed');
      }
      operation.phase = 'awaiting-current-data';
      if (operation.metadataObserved && !operation.seekedObserved && this._canReassertOwnedSeek(operation)) {
        this._assignOwnedSeek(operation, 'seeked-reassert');
      }
      return true;
    }
    if (this._isOwnedSeekObserved(operation, observed)) {
      operation.phase = 'observed';
      return this._clearOwnedSeek(operation, 'completed');
    }
    operation.phase = 'awaiting-readiness';
    if (this._canReassertOwnedSeek(operation)) this._assignOwnedSeek(operation, 'seeked-reassert');
    return true;
  }

  _handleOwnedMediaReset(reason) {
    let operation = this._ownedSeek;
    if (!operation) return false;
    let source = String(this.media.src || this.media.currentSrc || '');
    if (source !== operation.source) {
      return this._clearOwnedSeek(operation, operation.mode === 'load' ? 'source-replaced' : reason);
    }
    if (operation.mode === 'load' && operation.metadataObserved) {
      operation.phase = 'generation-invalidated';
      return this._failOwnedSeek(operation, reason === 'media-abort' ? 'generation-aborted' : 'generation-reset');
    }
    if (operation.mode === 'load') {
      operation.metadataObserved = false;
      operation.currentDataObserved = false;
      operation.seekedObserved = false;
    }
    operation.phase = 'loading';
    return true;
  }

  _advanceOwnedSeek(eventType) {
    let operation = this._ownedSeek;
    if (!operation) return false;
    let source = String(this.media.src || this.media.currentSrc || '');
    if (source !== operation.source) return this._clearOwnedSeek(operation, 'source-replaced');
    if (operation.mode === 'load') {
      if (eventType === 'loadstart') {
        operation.phase = 'loading';
        return true;
      }
      if (eventType === 'loadedmetadata') operation.metadataObserved = true;
      if (Number(this.media.readyState) >= 2) operation.currentDataObserved = true;
      let observed = this._ownedSeekObservedMs();
      let observedRequested = observed !== null && this._isOwnedSeekObserved(operation, observed);
      if (
        operation.metadataObserved
        && operation.currentDataObserved
        && (operation.requestedMs === 0 ? observedRequested : operation.seekedObserved && observedRequested)
      ) {
        operation.phase = 'completed';
        return this._clearOwnedSeek(operation, 'completed');
      }
      operation.phase = `awaiting-${eventType}`;
      if (!operation.metadataObserved || observedRequested || !this._canReassertOwnedSeek(operation)) return true;
      return this._assignOwnedSeek(operation, `${eventType}-restore`);
    }
    let observed = this._ownedSeekObservedMs();
    if (observed !== null && this._isOwnedSeekObserved(operation, observed)) {
      operation.phase = `awaiting-seeked-after-${eventType}`;
      return true;
    }
    operation.phase = `awaiting-${eventType}`;
    if (!this._canReassertOwnedSeek(operation)) return true;
    return this._assignOwnedSeek(operation, `${eventType}-reassert`);
  }

  seek(mediaTime, { reason = 'seek' } = {}) {
    let observed = integer(mediaTime, 'seek mediaTimeMs', { max: this.durationMs || Number.MAX_SAFE_INTEGER });
    let operation = this._beginOwnedSeek(observed, reason);
    this._assignOwnedSeek(operation, 'initial');
    return this.restore(observed, { reason, notify: this.media.paused !== true });
  }

  // Project/NLE transport moves physical media without resetting presentation state.
  seekTransport(mediaTime, { reason = 'transport-seek' } = {}) {
    let observed = integer(mediaTime, 'transport seek mediaTimeMs', {
      max: this.durationMs || Number.MAX_SAFE_INTEGER,
    });
    let operation = this._beginOwnedSeek(observed, reason, { mode: 'transport' });
    this._previousMediaTimeMs = observed;
    this._assignOwnedSeek(operation, 'initial');
    return Object.freeze({
      operationId: operation.operationId,
      requestedMs: observed,
      reason,
    });
  }

  restorePlayback(snapshot = {}, { reason = 'branch-return' } = {}) {
    let input = record(snapshot, 'playback snapshot');
    return this.seek(integer(input.positionMs, 'playback snapshot.positionMs'), { reason });
  }

  loadAndRestorePlayback(snapshot = {}, { reason = 'branch-return' } = {}) {
    let input = record(snapshot, 'aligned playback load');
    let source = nonempty(input.source, 'aligned playback load.source');
    let positionMs = integer(input.positionMs, 'aligned playback load.positionMs');
    let paused = input.paused === undefined ? true : input.paused === true;
    let preload = String(input.preload ?? 'auto');
    this.attach();
    let operation = this._beginOwnedSeek(positionMs, reason, { mode: 'load', source, paused });
    if (paused) this.media.pause?.();
    this.restore(positionMs, { reason, notify: paused !== true && this.media.paused !== true });
    try {
      this.media.preload = preload;
      this.media.src = source;
      operation.source = String(this.media.src || source);
      operation.phase = 'source-assigned';
      if (typeof this.media.load !== 'function') {
        this._failOwnedSeek(operation, 'load-unavailable');
        return operation.promise;
      }
      this.media.load();
      if (operation === this._ownedSeek && operation.phase === 'source-assigned') {
        operation.phase = 'awaiting-loadstart';
      }
    } catch {
      this._failOwnedSeek(operation, 'load-error');
    }
    return operation.promise;
  }

  pause() {
    this._stopPlaybackClock('pause-request');
    this.media.pause?.();
  }

  resume() {
    this.sample({ reason: 'resume' });
    let result = this.media.play?.();
    this._startPlaybackClock('resume-request');
    return result;
  }

  dispose() {
    this._stopPlaybackClock('disposed');
    this._clearOwnedSeek(this._ownedSeek, 'disposed');
    if (this._attached && typeof this.media.removeEventListener === 'function') {
      for (let [type, listener] of Object.entries(this._listeners)) this.media.removeEventListener(type, listener);
    }
    if (typeof this._playbackClockDocument?.removeEventListener === 'function') {
      for (let [type, listener] of Object.entries(this._documentListeners)) {
        this._playbackClockDocument.removeEventListener(type, listener);
      }
    }
    this._attached = false;
    this._fired.clear();
  }
}
