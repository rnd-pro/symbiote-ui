import { SHOW_MEDIA_MODES, normalizeShowDirective } from './show-contracts.js';

const MODES = new Set(SHOW_MEDIA_MODES);
const MEDIA_OPTION_FIELDS = Object.freeze([
  'startMs',
  'endMs',
  'segments',
  'segmentDurationMs',
  'frames',
  'frameHoldMs',
  'finalFrame',
  'keepPlayingDuringQuote',
]);

export const SHOW_MEDIA_INTERACTION_POLICIES = Object.freeze({
  'short-muted-montage': Object.freeze({ semantics: 'pointer-only', nativeControls: false, skippable: false }),
  'short-inline-continuous': Object.freeze({ semantics: 'pointer-only', nativeControls: false, skippable: false }),
  'full-with-media-audio': Object.freeze({ semantics: 'detail', nativeControls: true, skippable: true }),
});

function mediaElementFor(target) {
  return target?.element || target;
}

function validateShowMediaStateHooks(target) {
  let hasCapture = typeof target?.captureShowMediaState === 'function';
  let hasRestore = typeof target?.restoreShowMediaState === 'function';
  if (hasCapture === hasRestore) return;
  let error = new TypeError('custom captureShowMediaState and restoreShowMediaState hooks must be provided together');
  error.code = 'show-media-state-hook-pair-required';
  throw error;
}

function abortError(reason) {
  let error = new Error(`show media operation aborted: ${reason}`);
  error.name = 'AbortError';
  error.reason = reason;
  return error;
}

function abortOperation(operation, reason) {
  if (!operation || operation.controller.signal.aborted) return;
  operation.controller.abort(abortError(reason));
}

function throwIfAborted(operation) {
  if (!operation.controller.signal.aborted) return;
  let reason = operation.controller.signal.reason;
  throw reason instanceof Error ? reason : abortError(String(reason || 'aborted'));
}

function completionPromiseFor(result) {
  let completion = result?.completion;
  if (!completion || typeof completion.then !== 'function') return null;
  let promise = Promise.resolve(completion);
  // A rejected start notification may prevent the controller from reaching the
  // barrier. Keep the target-owned completion observed while cleanup proceeds.
  void promise.catch(() => {});
  return promise;
}

async function awaitOperationCompletion(completion, operation) {
  let { signal } = operation.controller;
  throwIfAborted(operation);
  let onAbort;
  let aborted = new Promise((_resolve, reject) => {
    onAbort = () => {
      let reason = signal.reason;
      reject(reason instanceof Error ? reason : abortError(String(reason || 'aborted')));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    await Promise.race([completion, aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

function normalizeMediaPlayOptions(options = {}) {
  let mode = String(options.mode || 'short-muted-montage');
  if (!MODES.has(mode)) throw new TypeError(`unsupported show media mode "${mode}"`);
  let id = String(options.id || options.mediaId || 'show-media');
  let directiveInput = { type: 'media', mediaId: id, mode };
  for (let field of MEDIA_OPTION_FIELDS) {
    if (Object.hasOwn(options, field)) directiveInput[field] = options[field];
  }
  let normalized = normalizeShowDirective(directiveInput);
  let result = { id, mediaId: id, mode };
  for (let field of MEDIA_OPTION_FIELDS) {
    if (Object.hasOwn(normalized, field)) result[field] = normalized[field];
  }
  return Object.freeze(result);
}

function mediaPolicyFor(mode) {
  return Object.freeze({
    mode,
    muted: mode !== 'full-with-media-audio',
    ...SHOW_MEDIA_INTERACTION_POLICIES[mode],
  });
}

export function captureShowMediaState(target, context, element = mediaElementFor(target)) {
  if (!target) throw new TypeError('a media element or target is required');
  validateShowMediaStateHooks(target);
  if (typeof target.captureShowMediaState === 'function') return target.captureShowMediaState(context);
  let media = element;
  return Object.freeze({
    currentTime: Number(media.currentTime) || 0,
    paused: media.paused !== false,
    muted: Boolean(media.muted),
    volume: Number.isFinite(Number(media.volume)) ? Number(media.volume) : 1,
    playbackRate: Number.isFinite(Number(media.playbackRate)) ? Number(media.playbackRate) : 1,
    controls: Boolean(media.controls),
  });
}

export function restoreShowMediaState(target, state, context, element = mediaElementFor(target)) {
  if (!target || !state) return undefined;
  validateShowMediaStateHooks(target);
  if (typeof target.restoreShowMediaState === 'function') return target.restoreShowMediaState(state, context);
  let media = element;
  media.muted = state.muted;
  media.volume = state.volume;
  media.playbackRate = state.playbackRate;
  media.controls = state.controls;
  try { media.currentTime = state.currentTime; } catch {}
  if (state.paused) media.pause?.();
  else return media.play?.();
  return undefined;
}

function applyShowMediaPolicy(target, element, policy, options, context) {
  if (typeof target.applyShowMediaPolicy === 'function') {
    return target.applyShowMediaPolicy(policy, options, context);
  }
  let media = element;
  media.muted = policy.muted;
  media.controls = policy.nativeControls;
  return undefined;
}

function playShowMedia(target, element, options, context) {
  if (typeof target.playShowMedia === 'function') {
    return target.playShowMedia(options, context);
  }
  let media = element;
  if (options.startMs !== undefined) media.currentTime = Math.max(0, options.startMs / 1000);
  return media.play?.();
}

function pauseShowMedia(target, element, reason, context) {
  if (typeof target.pauseShowMedia === 'function') return target.pauseShowMedia(reason, context);
  return element.pause?.();
}

export class ShowMediaController {
  constructor({ audioArbiter, onEvent } = {}) {
    this.audioArbiter = audioArbiter || null;
    this.onEvent = typeof onEvent === 'function' ? onEvent : null;
    this._active = null;
    this._operation = null;
    this._operationSequence = 0;
    this._lifecycle = Promise.resolve();
  }

  get activeMode() {
    return this._active?.mode || '';
  }

  _enqueueLifecycle(task) {
    let pending = this._lifecycle.then(task);
    this._lifecycle = pending.then(() => undefined, () => undefined);
    return pending;
  }

  _beginOperation() {
    abortOperation(this._operation, 'replaced');
    let controller = new AbortController();
    let operation = {
      id: ++this._operationSequence,
      controller,
      context: null,
    };
    operation.context = Object.freeze({ operationId: operation.id, signal: controller.signal });
    this._operation = operation;
    return operation;
  }

  async _stopActive(reason) {
    if (!this._active) return false;
    let active = this._active;
    this._active = null;
    if (this._operation === active.operation) this._operation = null;
    let errors = [];
    try {
      active.element?.removeEventListener?.('ended', active.ended);
    } catch (error) {
      errors.push(error);
    }
    try {
      await active.pause(reason);
    } catch (error) {
      errors.push(error);
    }
    if (active.audioToken) {
      try {
        await this.audioArbiter?.release?.({ ...active.audioToken, reason });
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      await restoreShowMediaState(active.target, active.state, active.operation.context, active.element);
    } catch (error) {
      errors.push(error);
    }
    try {
      await this.onEvent?.({ type: 'show:media-stop', mode: active.mode, mediaId: active.id, reason });
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) {
      throw new AggregateError(errors, `show media cleanup failed for "${active.id}"`);
    }
    return true;
  }

  async _stopOwned(active, reason) {
    if (this._active !== active) return false;
    abortOperation(active.operation, reason);
    return this._stopActive(reason);
  }

  async _reportCleanupError(active, reason, error) {
    try {
      await this.onEvent?.({
        type: 'show:media-error',
        phase: 'cleanup',
        mode: active.mode,
        mediaId: active.id,
        reason,
        error,
      });
    } catch {}
  }

  _handleEnded(active) {
    if (this._active !== active) return;
    // A bounded custom choreography may dispatch `ended` immediately before
    // resolving its completion barrier. Let that normal terminal signal settle
    // successfully; lifecycle cleanup remains serialized after `_playOwned`.
    if (!active.completionPending) abortOperation(active.operation, 'ended');
    void this._enqueueLifecycle(() => this._stopOwned(active, 'ended'))
      .catch((error) => this._reportCleanupError(active, 'ended', error))
      .catch(() => {});
  }

  async play(target, options = {}) {
    if (!target) throw new TypeError('a media element or target is required');
    validateShowMediaStateHooks(target);
    let element = mediaElementFor(target);
    let normalizedOptions = normalizeMediaPlayOptions(options);
    let { mode, mediaId: id } = normalizedOptions;
    let policy = mediaPolicyFor(mode);
    let operation = this._beginOperation();
    return this._enqueueLifecycle(() => this._playOwned(target, element, normalizedOptions, policy, operation));
  }

  async _playOwned(target, element, normalizedOptions, policy, operation) {
    let { mode, mediaId: id } = normalizedOptions;
    throwIfAborted(operation);
    try {
      await this._stopActive('replaced');
    } catch (error) {
      abortOperation(operation, 'startup-failed');
      if (this._operation === operation) this._operation = null;
      throw error;
    }
    throwIfAborted(operation);

    let state;
    try {
      state = await captureShowMediaState(target, operation.context, element);
      throwIfAborted(operation);
    } catch (error) {
      if (this._operation === operation) this._operation = null;
      throw error;
    }

    let active = {
      target,
      element,
      mode,
      state,
      id,
      audioToken: null,
      operation,
      ended: null,
      completionPending: false,
      pausePromise: null,
      pause(reason) {
        if (!this.pausePromise) {
          try {
            this.pausePromise = Promise.resolve(pauseShowMedia(target, element, reason, operation.context));
          } catch (error) {
            this.pausePromise = Promise.reject(error);
          }
        }
        return this.pausePromise;
      },
    };
    active.ended = () => this._handleEnded(active);
    active.element?.addEventListener?.('ended', active.ended, { once: true });
    this._active = active;

    let interaction = SHOW_MEDIA_INTERACTION_POLICIES[mode];
    let phase = 'policy';
    try {
      await applyShowMediaPolicy(target, element, policy, normalizedOptions, operation.context);
      throwIfAborted(operation);
      if (mode === 'full-with-media-audio') {
        let audioToken = await this.audioArbiter?.acquire?.({
          id,
          kind: 'media',
          pause: ({ reason } = {}) => active.pause(reason || 'audio-paused'),
        });
        active.audioToken = audioToken || null;
        if (operation.controller.signal.aborted && audioToken) {
          await this.audioArbiter?.release?.({ ...audioToken, reason: 'aborted' });
        }
        throwIfAborted(operation);
      }
      phase = 'play';
      let playResult = await playShowMedia(target, element, normalizedOptions, operation.context);
      throwIfAborted(operation);
      let completion = completionPromiseFor(playResult);
      active.completionPending = Boolean(completion);
      phase = 'start-notification';
      await this.onEvent?.({ type: 'show:media-start', mode, mediaId: id, ...interaction });
      throwIfAborted(operation);
      if (completion) {
        phase = 'completion';
        try {
          await awaitOperationCompletion(completion, operation);
          throwIfAborted(operation);
        } finally {
          active.completionPending = false;
        }
      }
    } catch (error) {
      let aborted = operation.controller.signal.aborted;
      if (aborted) {
        let reason = operation.controller.signal.reason;
        throw reason instanceof Error ? reason : abortError(String(reason || 'aborted'));
      }
      let cleanupError = null;
      let failureReason = phase === 'start-notification' ? 'start-notification-failed' : 'play-rejected';
      if (this._active === active) {
        abortOperation(operation, failureReason);
        try {
          await this._stopActive(failureReason);
        } catch (caught) {
          cleanupError = caught;
        }
      }
      if (this._operation === operation) this._operation = null;
      if (phase === 'start-notification') {
        let errors = [error];
        if (cleanupError instanceof AggregateError) errors.push(...cleanupError.errors);
        else if (cleanupError) errors.push(cleanupError);
        throw new AggregateError(errors, `show media start notification and cleanup failed for "${id}"`);
      }
      if (cleanupError) {
        throw new AggregateError([error, cleanupError], `show media playback and cleanup failed for "${id}"`);
      }
      throw error;
    }

    let muted = typeof element?.muted === 'boolean' ? element.muted : policy.muted;
    return Object.freeze({ mode, mediaId: id, muted, ...interaction });
  }

  async skip() {
    if (this._active?.mode !== 'full-with-media-audio') return false;
    await this.stop('skipped');
    return true;
  }

  async stop(reason = 'stopped') {
    let operation = this._operation;
    let hadOperation = Boolean(operation);
    abortOperation(operation, reason);
    if (this._operation === operation) this._operation = null;
    return this._enqueueLifecycle(async () => {
      let stopped = await this._stopActive(reason);
      return stopped || hadOperation;
    });
  }
}
