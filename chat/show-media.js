import { SHOW_MEDIA_MODES } from './show-contracts.js';

const MODES = new Set(SHOW_MEDIA_MODES);

export const SHOW_MEDIA_INTERACTION_POLICIES = Object.freeze({
  'short-muted-montage': Object.freeze({ semantics: 'pointer-only', nativeControls: false, skippable: false }),
  'full-with-media-audio': Object.freeze({ semantics: 'detail', nativeControls: true, skippable: true }),
});

export function captureShowMediaState(media) {
  if (!media) throw new TypeError('a media element is required');
  return Object.freeze({
    currentTime: Number(media.currentTime) || 0,
    paused: media.paused !== false,
    muted: Boolean(media.muted),
    volume: Number.isFinite(Number(media.volume)) ? Number(media.volume) : 1,
    playbackRate: Number.isFinite(Number(media.playbackRate)) ? Number(media.playbackRate) : 1,
    controls: Boolean(media.controls),
  });
}

export function restoreShowMediaState(media, state) {
  if (!media || !state) return;
  media.muted = state.muted;
  media.volume = state.volume;
  media.playbackRate = state.playbackRate;
  media.controls = state.controls;
  try { media.currentTime = state.currentTime; } catch {}
  if (state.paused) media.pause?.();
}

export class ShowMediaController {
  constructor({ audioArbiter, onEvent } = {}) {
    this.audioArbiter = audioArbiter || null;
    this.onEvent = typeof onEvent === 'function' ? onEvent : null;
    this._active = null;
  }

  get activeMode() {
    return this._active?.mode || '';
  }

  async play(media, options = {}) {
    if (!media) throw new TypeError('a media element is required');
    let mode = String(options.mode || 'short-muted-montage');
    if (!MODES.has(mode)) throw new TypeError(`unsupported show media mode "${mode}"`);
    await this.stop('replaced');
    let state = captureShowMediaState(media);
    let id = String(options.id || options.mediaId || 'show-media');
    let audioToken = null;
    if (mode === 'short-muted-montage') {
      media.muted = true;
      media.controls = false;
    } else {
      media.muted = false;
      media.controls = true;
      audioToken = await this.audioArbiter?.acquire?.({
        id,
        kind: 'media',
        pause: () => media.pause?.(),
      });
    }
    if (Number.isFinite(Number(options.startMs))) media.currentTime = Math.max(0, Number(options.startMs) / 1000);
    let ended = () => this.stop('ended');
    media.addEventListener?.('ended', ended, { once: true });
    this._active = { media, mode, state, id, audioToken, ended };
    try {
      await media.play?.();
    } catch (error) {
      await this.stop('play-rejected');
      throw error;
    }
    let interaction = SHOW_MEDIA_INTERACTION_POLICIES[mode];
    this.onEvent?.({ type: 'show:media-start', mode, mediaId: id, ...interaction });
    return Object.freeze({ mode, mediaId: id, muted: media.muted, ...interaction });
  }

  async skip() {
    if (this._active?.mode !== 'full-with-media-audio') return false;
    await this.stop('skipped');
    return true;
  }

  async stop(reason = 'stopped') {
    if (!this._active) return false;
    let active = this._active;
    this._active = null;
    active.media.removeEventListener?.('ended', active.ended);
    active.media.pause?.();
    if (active.audioToken) await this.audioArbiter?.release?.(active.audioToken);
    restoreShowMediaState(active.media, active.state);
    this.onEvent?.({ type: 'show:media-stop', mode: active.mode, mediaId: active.id, reason });
    return true;
  }
}
