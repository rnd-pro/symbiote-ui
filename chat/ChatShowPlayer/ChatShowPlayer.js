import Symbiote from '@symbiotejs/symbiote';
import { slotProcessor } from '@symbiotejs/symbiote/core/slotProcessor.js';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import { translate } from '../../locale/index.js';
import { CHAT_SHOW_VIDEO_CONTROL_SEMANTICS } from '../show-player-contract.js';
import template from './ChatShowPlayer.tpl.js';
import css from './ChatShowPlayer.css.js';

const PLAYER_ICONS = [
  'auto_stories',
  'more_vert',
  'close',
  'first_page',
  'skip_previous',
  'play_arrow',
  'pause',
  'skip_next',
  'stop',
  'play_circle',
  'open_in_full',
  'close_fullscreen',
];

const VIDEO_SEMANTICS = new Set(CHAT_SHOW_VIDEO_CONTROL_SEMANTICS);

function normalizeVideoControls(controls = []) {
  if (!Array.isArray(controls)) throw new TypeError('videoControls must be an array');
  return controls.map((control, index) => {
    if (!control || typeof control !== 'object') throw new TypeError('video control must be an object');
    let id = String(control.id || control.action || `video-${index}`).trim();
    let action = String(control.action || id).trim();
    let semantics = String(control.semantics || 'detail').trim();
    if (!id || !action) throw new TypeError('video control id and action must be non-empty strings');
    if (!VIDEO_SEMANTICS.has(semantics)) throw new TypeError(`unsupported video control semantics "${semantics}"`);
    return Object.freeze({
      id,
      action,
      semantics,
      label: String(control.label || action),
      glyph: String(control.glyph || 'play_circle'),
      disabled: Boolean(control.disabled),
    });
  });
}

function readPlaying(controller, state = {}) {
  if (typeof state.playing === 'boolean') return state.playing;
  if (typeof controller?.isPlaying === 'boolean') return controller.isPlaying;
  if (typeof controller?.isPaused === 'boolean') return !controller.isPaused;
  return false;
}

function clampProgress(value) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function formatClock(valueMs) {
  let totalSeconds = Math.max(0, Math.floor(Number(valueMs) / 1_000 || 0));
  let seconds = totalSeconds % 60;
  let totalMinutes = Math.floor(totalSeconds / 60);
  let minutes = totalMinutes % 60;
  let hours = Math.floor(totalMinutes / 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function resolveTimelinePosition(source, requestedMs) {
  let durations = source.map(({ durationMs }) => Number(durationMs));
  if (!durations.length || !durations.every((duration) => Number.isFinite(duration) && duration > 0)) {
    return null;
  }
  let totalMs = durations.reduce((total, duration) => total + duration, 0);
  let absoluteMs = Math.min(totalMs, Math.max(0, Number(requestedMs) || 0));
  let elapsedMs = 0;
  for (let index = 0; index < durations.length; index += 1) {
    let durationMs = durations[index];
    if (absoluteMs < elapsedMs + durationMs || index === durations.length - 1) {
      return {
        index,
        positionMs: Math.min(durationMs, Math.max(0, absoluteMs - elapsedMs)),
        absoluteMs,
        totalMs,
      };
    }
    elapsedMs += durationMs;
  }
  return null;
}

function resolveProgress(source, index, state, caption) {
  let durations = source.map(({ durationMs }) => Number(durationMs));
  let weights = durations.every((duration) => Number.isFinite(duration) && duration > 0)
    ? durations
    : source.map(() => 1);
  let progress = state?.progress && typeof state.progress === 'object' ? state.progress : {};
  let currentDuration = durations[index];
  let positionMs = Number(progress.positionMs);
  let fraction = Number(progress.fraction);
  if (Number.isFinite(positionMs) && Number.isFinite(currentDuration) && currentDuration > 0) {
    fraction = positionMs / currentDuration;
  } else if (!Number.isFinite(fraction)) {
    let activeWordIndex = Number(caption.activeWordIndex ?? caption.wordIndex ?? -1);
    let words = Array.isArray(caption.words) ? caption.words : [];
    fraction = activeWordIndex >= 0 && words.length ? (activeWordIndex + 1) / words.length : 0;
  }
  if (state?.state === 'completed' && index === source.length - 1) fraction = 1;
  fraction = clampProgress(fraction);
  let totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let completedWeight = weights.slice(0, Math.max(0, index))
    .reduce((total, weight) => total + weight, 0);
  let currentWeight = index >= 0 ? weights[index] || 0 : 0;
  let overall = totalWeight ? (completedWeight + currentWeight * fraction) / totalWeight : 0;
  let progressNow = Math.round(clampProgress(overall) * 100);
  let seekable = durations.length > 0
    && durations.every((duration) => Number.isFinite(duration) && duration > 0);
  let elapsedMs = seekable ? completedWeight + currentWeight * fraction : 0;
  let totalMs = seekable ? totalWeight : 0;
  return {
    now: progressNow,
    value: Math.round(elapsedMs / 1_000),
    max: Math.max(0, Math.round(totalMs / 1_000)),
    text: `${index < 0 ? 0 : index + 1} / ${source.length} · ${formatClock(elapsedMs)} / ${formatClock(totalMs)}`,
    elapsedLabel: formatClock(elapsedMs),
    totalLabel: formatClock(totalMs),
    elapsedMs,
    totalMs,
    seekable,
    segments: weights.map((weight, segmentIndex) => {
      let fill = segmentIndex < index ? 1 : segmentIndex === index ? fraction : 0;
      return {
        style: `--chat-show-progress-weight:${weight};--chat-show-progress-fill:${fill}`,
      };
    }),
  };
}

export class ChatShowPlayer extends Symbiote {
  init$ = {
    title: '',
    icon: 'auto_stories',
    turns: [],
    positionLabel: '0 / 0',
    captionText: '',
    captionWords: [],
    hasCaptionWords: false,
    progressNow: 0,
    progressValue: 0,
    progressMax: 0,
    progressText: '0 / 0 · 0:00 / 0:00',
    progressElapsedLabel: '0:00',
    progressTotalLabel: '0:00',
    progressSeekable: false,
    progressTabIndex: '-1',
    progressDisabled: 'true',
    progressStyle: '--chat-show-progress-position:0',
    progressSegments: [],
    showCaption: true,
    showSettings: true,
    showClose: true,
    menuOpen: false,
    menuExpanded: 'false',
    showMenuLabel: translate('chat.show.menu'),
    quickControlsLabel: translate('chat.show.quickControls'),
    menuTitle: translate('chat.show.title'),
    progressLabel: translate('chat.show.progress'),
    restartLabel: translate('chat.show.restart'),
    layoutActionLabel: translate('chat.show.openLayout'),
    layoutActionGlyph: 'open_in_full',
    showTts: false,
    ttsLabel: '',
    ttsText: '',
    ttsStatus: '',
    videoControls: [],
    hasVideoControls: false,
    playing: false,
    playLabel: 'Play',
    playGlyph: 'play_arrow',
    onRestart: () => this.control('restart'),
    onPrev: () => this.control('prev'),
    onPlayPause: () => this.control('toggle'),
    onNext: () => this.control('next'),
    onStop: () => this.control('stop'),
    onSettings: () => {
      this.$.menuOpen = !this.$.menuOpen;
      this.$.menuExpanded = this.$.menuOpen ? 'true' : 'false';
      this._emitRequest('chat-show-settings-request', {
        controller: this._controller,
        timeline: this._timeline,
        state: this._state,
        open: this.$.menuOpen,
      });
    },
    onLayoutAction: () => {
      let placement = this._layoutPlacement === 'panel' ? 'inline' : 'panel';
      this.$.menuOpen = false;
      this.$.menuExpanded = 'false';
      this._emitRequest('chat-show-layout-request', {
        placement,
        controller: this._controller,
        timeline: this._timeline,
        state: this._state,
      });
    },
    onClose: () => this._emitRequest('chat-show-close-request', {
      controller: this._controller,
      timeline: this._timeline,
    }, true),
    onTimelineClick: (event) => {
      let row = event.target?.closest?.('.chat-show-row');
      if (!row || !this.contains(row)) return;
      let index = Number(row.dataset.index);
      if (!Number.isInteger(index)) return;
      this.control('preview', index);
    },
    onVideoControl: (event) => {
      let button = event.target?.closest?.('[data-video-control]');
      if (!button || !this.contains(button)) return;
      this.controlVideo(button.dataset.videoControl, { source: 'user' });
    },
    onProgressPointerDown: (event) => this._startProgressScrub(event),
    onProgressPointerMove: (event) => this._moveProgressScrub(event),
    onProgressPointerUp: (event) => this._finishProgressScrub(event),
    onProgressPointerCancel: () => this._cancelProgressScrub(),
    onProgressKeyDown: (event) => this._onProgressKeyDown(event),
  };

  constructor() {
    super();
    this.templateProcessors.add(slotProcessor);
  }

  connectedCallback() {
    super.connectedCallback?.();
    ensureMaterialSymbols(PLAYER_ICONS);
    this._connected = true;
    if (this._controller && !this._controllerHooks) this._bindControllerHooks();
    this._sync();
    this._scheduleAutoplay();
  }

  disconnectedCallback() {
    this._connected = false;
    this._restoreControllerHooks();
    super.disconnectedCallback?.();
  }

  bind({
    controller = null,
    timeline = null,
    state = {},
    title = '',
    icon = 'auto_stories',
    autoplay = false,
    captions = true,
    settings = true,
    closable = true,
    videoController = null,
    videoControls = [],
  } = {}) {
    this._restoreControllerHooks();
    this._controller = controller;
    this._timeline = timeline || { turns: [] };
    this._state = state && typeof state === 'object' ? { ...state } : {};
    this._autoplay = Boolean(autoplay);
    this._autoplayStarted = false;
    this._title = String(title || timeline?.title || '');
    this._icon = String(icon || 'auto_stories');
    this._showCaption = captions !== false;
    this._showSettings = settings !== false;
    this._showClose = closable !== false;
    this._videoController = videoController;
    this._videoControls = normalizeVideoControls(videoControls);
    ensureMaterialSymbols([this._icon, ...PLAYER_ICONS]);
    this._bindControllerHooks();
    this._sync();
    this._scheduleAutoplay();
    return this;
  }

  _emitRequest(type, detail, cancelable = false) {
    return this.dispatchEvent(new CustomEvent(type, {
      bubbles: true,
      composed: true,
      cancelable,
      detail,
    }));
  }

  setState(state = {}) {
    this._state = state && typeof state === 'object' ? { ...state } : {};
    this._sync();
    return this;
  }

  setLayoutPlacement(placement = 'inline') {
    this._layoutPlacement = placement === 'panel' ? 'panel' : 'inline';
    this.toggleAttribute('panel-layout', this._layoutPlacement === 'panel');
    this.$.layoutActionLabel = this._layoutPlacement === 'panel'
      ? translate('chat.show.returnToChat')
      : translate('chat.show.openLayout');
    this.$.layoutActionGlyph = this._layoutPlacement === 'panel'
      ? 'close_fullscreen'
      : 'open_in_full';
    return this;
  }

  control(action, index = undefined) {
    let controller = this._controller;
    if (!controller) return false;
    let normalized = String(action || '');
    if (normalized === 'toggle') {
      if (typeof controller.toggle === 'function') controller.toggle();
      else if (readPlaying(controller, this._state)) controller.pause?.();
      else controller.play?.();
    } else if (normalized === 'restart') {
      if (typeof controller.seek !== 'function') return false;
      controller.seek(0, 0);
    } else if (normalized === 'preview' || normalized === 'seek') {
      let target = Number(index);
      if (!Number.isInteger(target)) return false;
      if (normalized === 'preview' && typeof controller.preview === 'function') controller.preview(target);
      else controller.seek?.(target);
    } else if (['play', 'pause', 'prev', 'next', 'stop'].includes(normalized)) {
      controller[normalized]?.();
    } else {
      return false;
    }
    this._sync();
    this.dispatchEvent(new CustomEvent('chat-show-control', {
      bubbles: true,
      composed: true,
      detail: {
        action: normalized,
        ...(normalized === 'restart' ? { index: 0, positionMs: 0 } : {}),
        ...(index === undefined ? {} : { index: Number(index) }),
      },
    }));
    return true;
  }

  controlVideo(id, detail = {}) {
    let control = this._videoControls?.find((item) => item.id === String(id || ''));
    if (!control || control.disabled) return false;
    let request = Object.freeze({
      id: control.id,
      action: control.action,
      semantics: control.semantics,
      source: String(detail.source || 'api'),
      controller: this._videoController,
      timeline: this._timeline,
      state: this._state,
      payload: detail.payload ?? null,
    });
    let activated = false;
    let reason = control.semantics === 'pointer-only' ? 'pointer-only' : '';
    if (control.semantics === 'detail') {
      let allowed = this._emitRequest('chat-show-video-request', request, true);
      if (!allowed) reason = 'prevented';
      else if (typeof this._videoController?.[control.action] === 'function') {
        this._videoController[control.action](request);
        activated = true;
      } else reason = 'controller-unavailable';
    }
    let receipt = Object.freeze({ ...request, activated, reason });
    this._emitRequest('chat-show-video-control', receipt);
    return receipt;
  }

  _progressPositionAtClientX(clientX) {
    let source = Array.isArray(this._timeline?.turns) ? this._timeline.turns : [];
    let track = this.ref.progressTrack;
    let rect = track?.getBoundingClientRect?.();
    if (!rect || !(rect.width > 0)) return null;
    let ratio = clampProgress((Number(clientX) - rect.left) / rect.width);
    let durations = source.map(({ durationMs }) => Number(durationMs));
    if (!durations.every((duration) => Number.isFinite(duration) && duration > 0)) return null;
    return resolveTimelinePosition(source, durations.reduce((total, duration) => total + duration, 0) * ratio);
  }

  _previewProgressPosition(position) {
    if (!position) return false;
    this._state = {
      ...this._state,
      index: position.index,
      progress: { ...this._state?.progress, positionMs: position.positionMs },
    };
    this._sync();
    return true;
  }

  _commitProgressPosition(position, source = 'pointer') {
    if (!position || typeof this._controller?.seek !== 'function') return false;
    this._controller.seek(position.index, position.positionMs);
    this.dispatchEvent(new CustomEvent('chat-show-control', {
      bubbles: true,
      composed: true,
      detail: {
        action: 'seek',
        index: position.index,
        positionMs: position.positionMs,
        absoluteMs: position.absoluteMs,
        source,
      },
    }));
    return true;
  }

  _startProgressScrub(event) {
    if (event.button !== undefined && event.button !== 0) return;
    let position = this._progressPositionAtClientX(event.clientX);
    if (!position) return;
    event.preventDefault?.();
    this._scrub = {
      pointerId: event.pointerId,
      originState: this._state,
      position,
    };
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    this._previewProgressPosition(position);
  }

  _moveProgressScrub(event) {
    if (!this._scrub || this._scrub.pointerId !== event.pointerId) return;
    let position = this._progressPositionAtClientX(event.clientX);
    if (!position) return;
    this._scrub.position = position;
    this._previewProgressPosition(position);
  }

  _finishProgressScrub(event) {
    if (!this._scrub || this._scrub.pointerId !== event.pointerId) return;
    let position = this._progressPositionAtClientX(event.clientX) || this._scrub.position;
    this._scrub = null;
    event.currentTarget?.releasePointerCapture?.(event.pointerId);
    this._previewProgressPosition(position);
    this._commitProgressPosition(position);
  }

  _cancelProgressScrub() {
    if (!this._scrub) return;
    this._state = this._scrub.originState;
    this._scrub = null;
    this._sync();
  }

  _onProgressKeyDown(event) {
    let source = Array.isArray(this._timeline?.turns) ? this._timeline.turns : [];
    let progress = resolveProgress(source, Number(this._state?.index ?? this._controller?.index ?? 0), this._state, {});
    if (!progress.seekable) return;
    let requestedMs = progress.elapsedMs;
    if (event.key === 'ArrowLeft') requestedMs -= 5_000;
    else if (event.key === 'ArrowRight') requestedMs += 5_000;
    else if (event.key === 'Home') requestedMs = 0;
    else if (event.key === 'End') requestedMs = progress.totalMs;
    else return;
    event.preventDefault?.();
    let position = resolveTimelinePosition(source, requestedMs);
    this._previewProgressPosition(position);
    this._commitProgressPosition(position, 'keyboard');
  }

  _bindControllerHooks() {
    let controller = this._controller;
    if (!controller) return;
    let previousIndex = controller.onIndexChange;
    let previousState = controller.onStateChange;
    let indexHook = (index) => {
      try { previousIndex?.(index); } catch {}
      this._state = { ...this._state, index };
      this._sync();
    };
    let stateHook = (state) => {
      try { previousState?.(state); } catch {}
      this._state = { ...this._state, state, playing: state === 'playing' };
      this._sync();
    };
    try {
      controller.onIndexChange = indexHook;
      controller.onStateChange = stateHook;
      this._controllerHooks = { controller, previousIndex, previousState, indexHook, stateHook };
    } catch {
      this._controllerHooks = null;
    }
  }

  _restoreControllerHooks() {
    let hooks = this._controllerHooks;
    this._controllerHooks = null;
    if (!hooks) return;
    try {
      if (hooks.controller.onIndexChange === hooks.indexHook) hooks.controller.onIndexChange = hooks.previousIndex;
      if (hooks.controller.onStateChange === hooks.stateHook) hooks.controller.onStateChange = hooks.previousState;
    } catch {}
  }

  _sync() {
    let source = Array.isArray(this._timeline?.turns) ? this._timeline.turns : [];
    let requestedIndex = Number(this._state?.index ?? this._controller?.index ?? 0);
    let index = source.length ? Math.min(source.length - 1, Math.max(0, Number.isFinite(requestedIndex) ? Math.trunc(requestedIndex) : 0)) : -1;
    let current = index >= 0 ? source[index] || {} : {};
    this.$.title = this._title || '';
    this.$.icon = this._icon || 'auto_stories';
    this.$.turns = index < 0 ? [] : [{
      index,
      speaker: String(current?.speaker || current?.persona || ''),
      text: String(current?.text || current?.caption || ''),
      current: true,
      ariaCurrent: 'step',
    }];
    this.$.positionLabel = `${index < 0 ? 0 : index + 1} / ${source.length}`;
    let caption = this._state?.caption && typeof this._state.caption === 'object'
      ? this._state.caption
      : {};
    let progress = resolveProgress(source, index, this._state, caption);
    this.$.progressNow = progress.now;
    this.$.progressValue = progress.value;
    this.$.progressMax = progress.max;
    this.$.progressText = progress.text;
    this.$.progressElapsedLabel = progress.elapsedLabel;
    this.$.progressTotalLabel = progress.totalLabel;
    this.$.progressSeekable = progress.seekable;
    this.$.progressTabIndex = progress.seekable ? '0' : '-1';
    this.$.progressDisabled = progress.seekable ? 'false' : 'true';
    this.$.progressStyle = `--chat-show-progress-position:${clampProgress(progress.totalMs ? progress.elapsedMs / progress.totalMs : 0)}`;
    this.$.progressSegments = progress.segments;
    this.$.captionText = String(caption.text || current?.caption || current?.text || '');
    let activeWordIndex = Number(caption.activeWordIndex ?? caption.wordIndex ?? -1);
    let words = Array.isArray(caption.words) ? caption.words : [];
    this.$.captionWords = words.map((word, wordIndex) => ({
      text: String(typeof word === 'string' ? word : word?.text || ''),
      active: wordIndex === activeWordIndex,
      spoken: wordIndex < activeWordIndex,
    }));
    this.$.hasCaptionWords = words.length > 0;
    if (activeWordIndex >= 0) queueMicrotask(() => {
      this.ref.captionViewport?.querySelector?.('.chat-show-caption-word[active]')
        ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
    let videoControls = (this._videoControls || []).map((control) => ({
      ...control,
      ariaDisabled: control.disabled ? 'true' : 'false',
    }));
    this.$.hasVideoControls = videoControls.length > 0;
    this.$.videoControls = videoControls;
    this.$.showCaption = this._showCaption !== false;
    this.$.showSettings = this._showSettings !== false;
    this.$.showClose = this._showClose !== false;
    let playing = readPlaying(this._controller, this._state);
    this.$.playing = playing;
    this.$.playLabel = playing ? 'Pause' : 'Play';
    this.$.playGlyph = playing ? 'pause' : 'play_arrow';
  }

  _scheduleAutoplay() {
    if (!this._connected || !this._autoplay || this._autoplayStarted || !this._controller) return;
    this._autoplayStarted = true;
    let start = () => {
      if (!this._connected || readPlaying(this._controller, this._state)) return;
      this._controller.play?.();
      this._sync();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(start);
    else queueMicrotask(start);
  }
}

ChatShowPlayer.template = template;
ChatShowPlayer.rootStyles = css;
ChatShowPlayer.reg('chat-show-player');

export default ChatShowPlayer;
