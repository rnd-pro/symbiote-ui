export const SHOW_AUDIO_KINDS = Object.freeze(['speech', 'media']);

export class ShowAudioArbiter {
  constructor({ onChange } = {}) {
    this._onChange = typeof onChange === 'function' ? onChange : null;
    this._active = null;
    this._sequence = 0;
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
    if (this._active?.id === normalizedId && this._active.kind === normalizedKind) return this._active.token;
    await this.release({ reason: 'preempted' });
    let token = Object.freeze({ id: ++this._sequence, sourceId: normalizedId, kind: normalizedKind });
    this._active = { id: normalizedId, kind: normalizedKind, pause, stop, token };
    this._onChange?.(this.snapshot);
    return token;
  }

  async release(tokenOrOptions = {}) {
    if (!this._active) return false;
    let token = tokenOrOptions?.sourceId ? tokenOrOptions : null;
    if (token && token.id !== this._active.token.id) return false;
    let active = this._active;
    this._active = null;
    let reason = tokenOrOptions?.reason || 'released';
    if (['preempted', 'paused'].includes(reason) && typeof active.pause === 'function') {
      await active.pause({ reason });
    }
    else if (typeof active.stop === 'function') await active.stop({ reason });
    else if (typeof active.pause === 'function') await active.pause({ reason });
    this._onChange?.(null);
    return true;
  }
}
