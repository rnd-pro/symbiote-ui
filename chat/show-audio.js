export const SHOW_AUDIO_KINDS = Object.freeze(['speech', 'media']);

function supersededAcquireError() {
  let error = new Error('show audio acquisition was superseded');
  error.name = 'AbortError';
  error.code = 'show-audio-acquire-superseded';
  return error;
}

function appendError(errors, error) {
  if (error instanceof AggregateError) errors.push(...error.errors);
  else errors.push(error);
}

function isPauseReason(reason) {
  return ['preempted', 'paused'].includes(reason);
}

export class ShowAudioArbiter {
  constructor({ onChange } = {}) {
    this._onChange = typeof onChange === 'function' ? onChange : null;
    this._active = null;
    this._sequence = 0;
    this._acquireGeneration = 0;
    this._releaseBarrier = null;
  }

  get snapshot() {
    return this._active
      ? Object.freeze({ id: this._active.id, kind: this._active.kind, tokenId: this._active.token.id })
      : null;
  }

  async acquire({ id, kind, pause, stop } = {}) {
    let normalizedKind = String(kind || 'speech');
    if (!SHOW_AUDIO_KINDS.includes(normalizedKind)) throw new TypeError(`unsupported show audio kind "${normalizedKind}"`);
    let normalizedId = String(id || `${normalizedKind}-${this._sequence + 1}`);
    let generation = ++this._acquireGeneration;
    if (!this._releaseBarrier && this._active?.ready && this._active.id === normalizedId && this._active.kind === normalizedKind) {
      return this._active.token;
    }
    await this._startRelease({ reason: 'preempted' });
    if (generation !== this._acquireGeneration) throw supersededAcquireError();
    let token = Object.freeze({ id: ++this._sequence, sourceId: normalizedId, kind: normalizedKind });
    let active = { id: normalizedId, kind: normalizedKind, pause, stop, token, ready: false };
    this._active = active;
    try {
      await this._onChange?.(this.snapshot);
    } catch (error) {
      let errors = [error];
      if (this._active === active && generation === this._acquireGeneration) {
        this._acquireGeneration += 1;
        try {
          await this._startRelease({ ...token, reason: 'acquire-notification-failed' });
        } catch (cleanupError) {
          appendError(errors, cleanupError);
        }
      }
      throw new AggregateError(errors, `show audio acquisition failed for "${normalizedId}"`);
    }
    if (generation !== this._acquireGeneration || this._active !== active) throw supersededAcquireError();
    active.ready = true;
    return token;
  }

  async release(tokenOrOptions = {}) {
    let token = tokenOrOptions?.sourceId ? tokenOrOptions : null;
    if (token && (!this._active || token.id !== this._active.token.id)) {
      if (token.id !== this._releaseBarrier?.active.token.id) return false;
      return this._startRelease(tokenOrOptions);
    }
    this._acquireGeneration += 1;
    return this._startRelease(tokenOrOptions);
  }

  _startRelease(tokenOrOptions = {}) {
    let token = tokenOrOptions?.sourceId ? tokenOrOptions : null;
    let reason = tokenOrOptions?.reason || 'released';
    if (this._releaseBarrier) {
      if (token && token.id !== this._releaseBarrier.active.token.id) return Promise.resolve(false);
      if (isPauseReason(this._releaseBarrier.reason) && !isPauseReason(reason)) {
        this._releaseBarrier.reason = reason;
      }
      return this._releaseBarrier.promise;
    }
    if (!this._active) return Promise.resolve(false);
    if (token && token.id !== this._active.token.id) return Promise.resolve(false);
    let active = this._active;
    this._active = null;
    let barrier = { active, reason, promise: null };
    this._releaseBarrier = barrier;
    barrier.promise = Promise.resolve().then(() => this._releaseActive(barrier));
    let clear = () => {
      if (this._releaseBarrier === barrier) this._releaseBarrier = null;
    };
    barrier.promise.then(clear, clear);
    return barrier.promise;
  }

  async _releaseActive(barrier) {
    let active = barrier.active;
    let errors = [];
    try {
      await this._onChange?.(null);
    } catch (error) {
      errors.push(error);
    }
    try {
      let reason = barrier.reason;
      if (isPauseReason(reason) && typeof active.pause === 'function') {
        await active.pause({ reason });
      }
      else if (typeof active.stop === 'function') await active.stop({ reason });
      else if (typeof active.pause === 'function') await active.pause({ reason });
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) {
      throw new AggregateError(errors, `show audio release failed for "${active.id}"`);
    }
    return true;
  }
}
