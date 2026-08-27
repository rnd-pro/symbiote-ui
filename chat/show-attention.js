import { createPresenterTextSelectionAnimation } from './presenter-text-selection.js';
import { PRESENTER_KINEMATICS_VERSION } from './presenter-kinematics.js';

export const SHOW_TRANSIENT_ATTENTION_MODES = Object.freeze(['frame', 'native-selection', 'click']);
export const SHOW_ATTENTION_SETTLEMENT_VERSION = 'show-attention-settlement-v1';

function presenterFrame(request, overrides = {}) {
  return {
    ...request.frame,
    ...(request.seed === undefined ? {} : { seed: request.seed }),
    ...(request.style === undefined ? {} : { style: request.style }),
    ...(request.gestureId === undefined ? {} : { gestureId: request.gestureId }),
    ...overrides,
  };
}

function finiteOrNull(value) {
  let number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function settledReceipt(mode, status, receipt = null, metadata = {}, timing = {}) {
  return Object.freeze({
    version: SHOW_ATTENTION_SETTLEMENT_VERSION,
    planVersion: receipt?.planVersion || PRESENTER_KINEMATICS_VERSION,
    mode,
    status,
    gestureId: metadata.gestureId || '',
    generation: metadata.generation || 0,
    seed: metadata.seed ?? null,
    cueTimeMs: metadata.cueTimeMs ?? null,
    mediaTimeMs: metadata.mediaTimeMs ?? null,
    startedAtMs: timing.startedAtMs ?? null,
    firstFrameAtMs: timing.firstFrameAtMs ?? null,
    settledAtMs: timing.settledAtMs ?? null,
    elapsedMs: timing.elapsedMs ?? receipt?.elapsedMs ?? 0,
    durationMs: receiptDuration(receipt),
    normalizedPathHash: receipt?.normalizedPathHash || '',
    receipt,
  });
}

function receiptDuration(receipt) {
  let durationMs = Number(receipt?.durationMs);
  return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
}

function receiptProgress(receipt) {
  for (let value of [receipt?.progress, receipt?.revealProgress]) {
    let progress = Number(value);
    if (Number.isFinite(progress)) return Math.max(0, Math.min(1, progress));
  }
  let durationMs = receiptDuration(receipt);
  let elapsedMs = Number(receipt?.elapsedMs);
  if (durationMs && Number.isFinite(elapsedMs)) {
    return Math.max(0, Math.min(1, elapsedMs / durationMs));
  }
  return durationMs ? 0 : 1;
}

function resolveFrameHost(target) {
  let view = target?.ownerDocument?.defaultView;
  if (!view || typeof view.requestAnimationFrame !== 'function'
    || typeof view.cancelAnimationFrame !== 'function') return null;
  return {
    request: view.requestAnimationFrame.bind(view),
    cancel: view.cancelAnimationFrame.bind(view),
    now: () => Number(view.performance?.now?.()) || Date.now(),
    reducedMotion: () => Boolean(view.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches),
  };
}

export class ShowAttentionController {
  constructor({ cursor, selectText, resolveTarget } = {}) {
    this.cursor = cursor || null;
    this.selectText = typeof selectText === 'function' ? selectText : createPresenterTextSelectionAnimation;
    this.resolveTarget = typeof resolveTarget === 'function' ? resolveTarget : (value) => value;
    this._transient = null;
    this._markers = [];
    this._cursorOwner = '';
    this._animation = null;
    this._generation = 0;
    this._activeRequest = null;
    this._settled = Promise.resolve(settledReceipt('', 'idle'));
  }

  get snapshot() {
    return Object.freeze({
      cursorOwner: this._cursorOwner,
      transientMode: this._transient?.mode || '',
      markerCount: this._markers.length,
      markers: Object.freeze([...this._markers]),
      animating: Boolean(this._animation),
      animationMode: this._animation?.mode || '',
      animationElapsedMs: this._animation?.elapsedMs || 0,
      animationDurationMs: this._animation?.durationMs || 0,
      animationProgress: this._animation?.progress || 0,
      paused: Boolean(this._animation?.paused),
      generation: this._animation?.metadata?.generation || this._generation,
      gestureId: this._animation?.metadata?.gestureId || '',
    });
  }

  /** Resolves when the active presenter gesture settles or is cancelled. */
  whenSettled() {
    return this._settled;
  }

  _cancelAnimation(status) {
    let animation = this._animation;
    if (!animation) return;
    this._animation = null;
    if (animation.frameId !== null) animation.host.cancel(animation.frameId);
    animation.resolve(settledReceipt(animation.mode, status, animation.receipt, animation.metadata, {
      startedAtMs: animation.startedAtMs ?? animation.host.now(),
      firstFrameAtMs: animation.firstFrameAtMs,
      settledAtMs: animation.host.now(),
      elapsedMs: animation.elapsedMs,
    }));
  }

  _settleImmediately(mode, receipt, onSettled, metadata = {}, status = 'settled', host = null) {
    onSettled?.(receipt);
    let now = host?.now?.() ?? Date.now();
    this._settled = Promise.resolve(settledReceipt(mode, status, receipt, metadata, {
      startedAtMs: now,
      firstFrameAtMs: null,
      settledAtMs: now,
      elapsedMs: receipt?.elapsedMs ?? receiptDuration(receipt),
    }));
    return receipt;
  }

  _animate({ mode, target, receipt, render, onSettled, metadata }) {
    let durationMs = receiptDuration(receipt);
    let host = resolveFrameHost(target);
    if (!receipt?.presented || !durationMs || receiptProgress(receipt) >= 1) {
      return this._settleImmediately(mode, receipt, onSettled, metadata, 'settled', host);
    }
    if (!host) return this._settleImmediately(mode, render(durationMs), onSettled, metadata);
    if (host.reducedMotion()) {
      return this._settleImmediately(
        mode,
        render(durationMs),
        onSettled,
        metadata,
        'reduced-motion',
        host,
      );
    }

    let resolve;
    let settled = new Promise((done) => { resolve = done; });
    let animation = {
      mode,
      host,
      frameId: null,
      frameOriginAt: null,
      startedAtMs: null,
      firstFrameAtMs: null,
      elapsedMs: 0,
      durationMs,
      progress: receiptProgress(receipt),
      receipt,
      resolve,
      render,
      onSettled,
      metadata,
      paused: false,
      tick: null,
    };
    this._animation = animation;
    this._settled = settled;

    let tick = (timestamp) => {
      if (this._animation !== animation) return;
      animation.frameId = null;
      if (animation.paused) return;
      if (animation.firstFrameAtMs === null) {
        animation.firstFrameAtMs = timestamp;
        animation.startedAtMs = timestamp;
      }
      if (animation.frameOriginAt === null) animation.frameOriginAt = timestamp - animation.elapsedMs;
      animation.elapsedMs = Math.min(durationMs, Math.max(0, timestamp - animation.frameOriginAt));
      animation.receipt = render(animation.elapsedMs);
      animation.progress = receiptProgress(animation.receipt);
      if (animation.elapsedMs >= durationMs || animation.progress >= 1) {
        this._animation = null;
        onSettled?.(animation.receipt);
        resolve(settledReceipt(mode, 'settled', animation.receipt, metadata, {
          startedAtMs: animation.startedAtMs,
          firstFrameAtMs: animation.firstFrameAtMs,
          settledAtMs: timestamp,
          elapsedMs: animation.elapsedMs,
        }));
        return;
      }
      animation.frameId = host.request(tick);
    };
    animation.tick = tick;
    animation.frameId = host.request(tick);
    return receipt;
  }

  pause() {
    let animation = this._animation;
    if (!animation || animation.paused) return false;
    animation.paused = true;
    if (animation.frameId !== null) {
      animation.host.cancel(animation.frameId);
      animation.frameId = null;
    }
    return true;
  }

  resume() {
    let animation = this._animation;
    if (!animation || !animation.paused) return false;
    animation.paused = false;
    animation.frameOriginAt = null;
    animation.frameId = animation.host.request(animation.tick);
    return true;
  }

  seek(elapsedMs = 0) {
    let animation = this._animation;
    if (!animation) return null;
    if (animation.frameId !== null) {
      animation.host.cancel(animation.frameId);
      animation.frameId = null;
    }
    animation.elapsedMs = Math.min(animation.durationMs, Math.max(0, Number(elapsedMs) || 0));
    animation.frameOriginAt = null;
    animation.receipt = animation.render(animation.elapsedMs);
    animation.progress = receiptProgress(animation.receipt);
    if (animation.elapsedMs >= animation.durationMs || animation.progress >= 1) {
      this._animation = null;
      animation.onSettled?.(animation.receipt);
      animation.resolve(settledReceipt(animation.mode, 'settled', animation.receipt, animation.metadata, {
        startedAtMs: animation.startedAtMs ?? animation.host.now(),
        firstFrameAtMs: animation.firstFrameAtMs,
        settledAtMs: animation.host.now(),
        elapsedMs: animation.elapsedMs,
      }));
    } else if (!animation.paused) {
      animation.frameId = animation.host.request(animation.tick);
    }
    return animation.receipt;
  }

  cancel(status = 'cancelled') {
    if (!this._animation) return false;
    this._cancelAnimation(status);
    return true;
  }

  captureState() {
    return Object.freeze({
      version: 'show-attention-state-v1',
      request: this._activeRequest ? Object.freeze({ ...this._activeRequest }) : null,
      elapsedMs: this._animation?.elapsedMs || 0,
      paused: Boolean(this._animation?.paused),
    });
  }

  restoreState(state = {}) {
    let request = state?.request;
    if (!request) return { presented: false, reason: 'state-empty' };
    let receipt = this.present(request);
    if (this._animation) {
      this.seek(state.elapsedMs);
      if (state.paused) this.pause();
    }
    return receipt;
  }

  reset(reason = 'branch-reset') {
    this.clearTransient(reason);
    this.clearMarkers();
    this._activeRequest = null;
  }

  clearTransient(status = 'cleared') {
    this._cancelAnimation(status);
    this._transient?.handle?.clear?.();
    this._transient = null;
    this._cursorOwner = '';
    this.cursor?.clear?.({ preserveInk: true });
  }

  clearMarkers() {
    if (this._animation?.mode === 'marker') {
      this._cancelAnimation('cleared-markers');
      this._cursorOwner = '';
    }
    this._markers = [];
    this.cursor?.clearAccumulatedAnnotations?.();
  }

  present(request = {}) {
    let mode = String(request.mode || 'cursor');
    let target = this.resolveTarget(request.target ?? request.targetId);
    if (!target) return { presented: false, reason: 'target-unresolved', mode };
    let generation = ++this._generation;
    let cueTimeMs = finiteOrNull(request.cueTimeMs);
    let mediaTimeMs = finiteOrNull(request.mediaTimeMs);
    let metadata = Object.freeze({
      generation,
      gestureId: String(request.gestureId || request.id || `${mode}:${generation}`),
      seed: request.seed ?? request.frame?.seed ?? null,
      cueTimeMs,
      mediaTimeMs,
    });
    this._activeRequest = Object.freeze({ ...request });

    if (mode === 'marker') {
      this.clearTransient('replaced');
      let annotation = request.annotation
        || {
          ...(request.intent === undefined ? {} : { intent: request.intent }),
          ...(request.marker === undefined ? {} : { marker: request.marker }),
          ...(request.label === undefined ? {} : { label: request.label }),
        };
      let render = (elapsedMs) => this.cursor?.presentAnnotationFrame?.(
        target,
        annotation,
        presenterFrame(request, { elapsedMs, accumulate: true, ownsCursor: true }),
      ) || { presented: false, reason: 'cursor-unavailable' };
      let receipt = this.cursor?.presentAnnotationFrame?.(
        target,
        annotation,
        presenterFrame(request, { accumulate: true, ownsCursor: true }),
      ) || { presented: false, reason: 'cursor-unavailable' };
      if (!receipt.presented) return this._settleImmediately(mode, receipt, null, metadata);
      this._cursorOwner = 'marker';
      let onSettled = (finalReceipt) => {
        this._markers.push(Object.freeze({
          targetId: String(request.targetId || ''),
          receipt: finalReceipt,
        }));
      };
      return this._animate({ mode, target, receipt, render, onSettled, metadata });
    }

    this.clearTransient('replaced');
    let receipt;
    if (mode === 'native-selection') {
      let handle = this.selectText?.(target, request.selection || request);
      receipt = handle?.receipt || handle || { status: 'unsupported' };
      this._transient = { mode, handle };
      this._cursorOwner = 'native-selection';
      if (typeof handle?.presentFrame !== 'function') return this._settleImmediately(mode, receipt, null, metadata);
      let render = (elapsedMs) => handle.presentFrame(elapsedMs);
      return this._animate({ mode, target, receipt, render, metadata });
    }
    if (mode === 'click') {
      let render = (elapsedMs) => this.cursor?.presentClickFrame?.(
        target,
        presenterFrame(request, { elapsedMs, preserveInk: true }),
      ) || { presented: false, reason: 'cursor-unavailable' };
      receipt = this.cursor?.presentClickFrame?.(
        target,
        presenterFrame(request, { preserveInk: true }),
      ) || { presented: false, reason: 'cursor-unavailable' };
      this._transient = { mode, receipt };
      this._cursorOwner = mode;
      return this._animate({ mode, target, receipt, render, metadata });
    }
    let render = (elapsedMs) => this.cursor?.presentFocusFrame?.(target, presenterFrame(request, {
      elapsedMs,
      preserveInk: true,
      mode: mode === 'frame' ? 'frame' : 'cursor',
    })) || { presented: false, reason: 'cursor-unavailable' };
    receipt = this.cursor?.presentFocusFrame?.(target, presenterFrame(request, {
      preserveInk: true,
      mode: mode === 'frame' ? 'frame' : 'cursor',
    })) || { presented: false, reason: 'cursor-unavailable' };
    this._transient = { mode, receipt };
    this._cursorOwner = mode;
    return this._animate({ mode, target, receipt, render, metadata });
  }

  dispose() {
    this.clearTransient('disposed');
    this.clearMarkers();
    this._activeRequest = null;
  }
}
