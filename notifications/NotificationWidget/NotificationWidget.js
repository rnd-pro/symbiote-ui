import Symbiote from '@symbiotejs/symbiote';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import {
  bringOverlayToFront,
  mountOverlayToDocument,
  restoreOverlayHome,
  syncOverlayTheme,
} from '../../ui/overlay-stack.js';
import { positionOverlay } from '../../ui/overlay-positioner.js';
import {
  createNotificationDebouncer,
  normalizeNotificationItem,
} from '../notification-queue.js';
import { createSoundEngine } from '../sound-engine.js';
import {
  NOTIFICATION_CONFIG_DEFAULTS,
  NOTIFICATION_BOARD_STAGES,
  isStageNarrationEnabled,
  listEventPresetOptions,
  normalizeNotificationConfig,
  parseNotificationConfig,
  resolveEventPreset,
  resolvePhraseVariants,
  serializeNotificationConfig,
  setPhraseVariants,
} from '../notification-config.js';
import { NotificationNarrator } from '../../chat/notification-narrator.js';
import { getDefaultVoiceArbitrationChannel } from '../../chat/voice-arbitration.js';
import {
  NARRATION_DEPTHS,
  NOTIFICATION_EVENT_TYPES,
} from '../../chat/notification-phrases.js';
import {
  createTranslator,
  normalizeLocale,
  resolveLocale,
  getNavigatorLocalePreferences,
} from '../../locale/index.js';
import css from './NotificationWidget.css.js';
import tpl from './NotificationWidget.tpl.js';

const DEFAULT_STORAGE_KEY = 'symbiote-ui:notification-widget';
const ICONS = ['notifications', 'restart_alt', 'open_in_full', 'volume_up', 'graphic_eq', 'record_voice_over'];

// Map narration event types onto their localized label key.
const EVENT_LABEL_KEYS = {
  'task.created': 'notification.event.taskCreated',
  'task.moved': 'notification.event.taskMoved',
  'task.started': 'notification.event.taskStarted',
  'task.completed': 'notification.event.taskCompleted',
  'task.failed': 'notification.event.taskFailed',
  'task.blocked': 'notification.event.taskBlocked',
  'approval.required': 'notification.event.approvalRequired',
  'agent.message': 'notification.event.agentMessage',
  generic: 'notification.event.generic',
};

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  return null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export class NotificationWidget extends Symbiote {
  static observedAttributes = ['storage-key', 'locale'];

  #config = normalizeNotificationConfig(NOTIFICATION_CONFIG_DEFAULTS);
  #ready = false;
  #popoverBound = false;
  #overlayListenersBound = false;
  #sound = null;
  #narrator = null;
  #debouncer = createNotificationDebouncer();
  #flushTimer = 0;

  init$ = {
    isOpen: false,
    triggerTitle: 'Notifications',
    onToggle: () => {
      this.#setOpen(!this.$.isOpen);
    },
  };

  initCallback() {
    ensureMaterialSymbols(ICONS);
    this.addEventListener('click', this.#onClick);
    this.addEventListener('input', this.#onInput);
    this.addEventListener('change', this.#onInput);
    this._onDocumentPointerDown = (event) => {
      if (!this.$.isOpen || this.#eventTargetsWidget(event)) return;
      this.#setOpen(false);
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerdown', this._onDocumentPointerDown);
    }
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
    this.removeEventListener('input', this.#onInput);
    this.removeEventListener('change', this.#onInput);
    this.#unbindPopoverEvents();
    this.#setOpen(false);
    this.#clearFlushTimer();
    this.#narrator?.cancel?.();
    this.#sound?.dispose?.();
    this.#sound = null;
    this.#narrator = null;
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerdown', this._onDocumentPointerDown);
    }
    super.disconnectedCallback?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.#ready) return;
    if (name === 'storage-key') this.#loadStoredConfig();
    this.#render();
    this.#applyConfig('attribute');
  }

  renderCallback() {
    if (this.#ready) return;
    this.#ready = true;
    this.#bindPopoverEvents();
    this.#loadStoredConfig();
    this.#render();
    this.#ensureRuntime();
    this.#applyConfig('init');
    if (this.$.isOpen) this.#openPopover();
  }

  get storageKey() {
    return this.getAttribute('storage-key') || DEFAULT_STORAGE_KEY;
  }

  get config() {
    return normalizeNotificationConfig(this.#config);
  }

  /** Replace the whole config (normalized + persisted + applied). */
  setConfig(value, options = {}) {
    this.#config = normalizeNotificationConfig(value);
    if (this.#ready) this.#render();
    this.#applyConfig(options.source || 'set-config');
  }

  /** Reset to defaults. */
  reset() {
    this.setConfig(NOTIFICATION_CONFIG_DEFAULTS, { source: 'reset' });
  }

  /** Active locale for narration + labels (attribute > config > navigator). */
  get locale() {
    let attr = this.getAttribute('locale');
    if (attr) return normalizeLocale(attr);
    if (this.#config.locale && this.#config.locale !== 'auto') return normalizeLocale(this.#config.locale);
    return resolveLocale(getNavigatorLocalePreferences(), { fallback: 'en' });
  }

  /**
   * Feed a raw notification event in. It is debounced/coalesced, then a flush is
   * scheduled; on flush it plays the per-event sound preset and narrates the
   * phrase (honoring stage muting + voice arbitration). Safe in Node: the
   * runtime only acts in a browser.
   */
  notify(rawEvent) {
    let item = normalizeNotificationItem(rawEvent, 0);
    let now = this.#now();
    this.#debouncer.push({ ...rawEvent, ...item, stage: rawEvent?.stage, params: rawEvent?.params }, now);
    this.#scheduleFlush();
    return item;
  }

  // -- config plumbing -------------------------------------------------------

  #loadStoredConfig() {
    let raw = getStorage()?.getItem(this.storageKey);
    this.#config = parseNotificationConfig(raw);
  }

  #persistConfig() {
    getStorage()?.setItem(this.storageKey, serializeNotificationConfig(this.#config));
  }

  #applyConfig(source) {
    this.#persistConfig();
    let sound = this.#ensureSound();
    if (sound) sound.setMuted(!this.#config.enabled || !this.#config.soundEnabled);
    let narrator = this.#ensureNarrator();
    if (narrator) narrator.setEnabled(this.#config.enabled && this.#config.narrationEnabled);
    this.dispatchEvent(new CustomEvent('notification-config-change', {
      bubbles: true,
      composed: true,
      detail: { source, config: this.config, storageKey: this.storageKey },
    }));
  }

  // -- runtime (browser-only) ------------------------------------------------

  #ensureRuntime() {
    this.#ensureSound();
    this.#ensureNarrator();
  }

  #ensureSound() {
    if (this.#sound) return this.#sound;
    if (typeof window === 'undefined') return null;
    this.#sound = createSoundEngine({
      masterGain: this.#config.volume,
      muted: !this.#config.enabled || !this.#config.soundEnabled,
    });
    this.#sound.installGestureUnlock(window);
    return this.#sound;
  }

  #ensureNarrator() {
    if (this.#narrator) return this.#narrator;
    if (typeof window === 'undefined') return null;
    this.#narrator = new NotificationNarrator({
      arbitration: getDefaultVoiceArbitrationChannel(),
      enabled: this.#config.enabled && this.#config.narrationEnabled,
      getLocale: () => this.locale,
      getDepth: () => this.#config.narrationDepth,
      getVoiceParams: () => ({ volume: this.#config.volume }),
    });
    return this.#narrator;
  }

  #scheduleFlush() {
    if (typeof window === 'undefined' || typeof setTimeout !== 'function') return;
    let due = this.#debouncer.nextDueAt();
    if (due === null) return;
    let delay = Math.max(0, due - this.#now());
    this.#clearFlushTimer();
    this.#flushTimer = setTimeout(() => {
      this.#flushTimer = 0;
      this.#drain();
      this.#scheduleFlush();
    }, delay);
  }

  #clearFlushTimer() {
    if (this.#flushTimer && typeof clearTimeout === 'function') clearTimeout(this.#flushTimer);
    this.#flushTimer = 0;
  }

  #drain() {
    let flushed = this.#debouncer.flush(this.#now());
    for (let event of flushed) this.#emit(event);
  }

  // Play the sound + narrate one coalesced event. The sound preset is keyed by
  // event type; narration yields to chat voice via the shared arbitration floor.
  #emit(event) {
    if (!this.#config.enabled) return;
    let type = NOTIFICATION_EVENT_TYPES.includes(event.type) ? event.type : 'generic';
    if (this.#config.soundEnabled) {
      this.#ensureSound()?.play(resolveEventPreset(this.#config, type));
    }
    let stage = event.stage || event.params?.stage;
    if (this.#config.narrationEnabled && (!stage || isStageNarrationEnabled(this.#config, stage))) {
      this.#ensureNarrator()?.narrate({
        type,
        params: event.params || { title: event.message, stage },
        locale: this.locale,
        depth: this.#config.narrationDepth,
      });
    }
    this.dispatchEvent(new CustomEvent('notification-emit', {
      bubbles: true,
      composed: true,
      detail: { event, config: this.config },
    }));
  }

  #now() {
    if (typeof performance !== 'undefined' && performance.now) return performance.now();
    return Date.now();
  }

  // -- rendering -------------------------------------------------------------

  #t() {
    return createTranslator({ locale: this.locale });
  }

  #render() {
    let t = this.#t();
    let trigger = this.ref.triggerLabel;
    if (trigger) trigger.textContent = t('notification.widget.trigger');
    this.$.triggerTitle = t('notification.widget.trigger');
    if (this.ref.title) this.ref.title.textContent = t('notification.widget.trigger');
    if (this.ref.resetButton) {
      this.ref.resetButton.title = t('notification.widget.reset');
      this.ref.resetButton.setAttribute('aria-label', t('notification.widget.reset'));
    }
    if (this.ref.openFullButton) {
      let detailed = this.ref.detailed && !this.ref.detailed.hidden;
      let label = detailed ? t('notification.widget.trigger') : t('notification.widget.openFull');
      this.ref.openFullButton.title = label;
      this.ref.openFullButton.setAttribute('aria-label', label);
    }
    this.#renderCompact(t);
    this.#renderDetailed(t);
  }

  #renderCompact(t) {
    let host = this.ref.compact;
    if (!host) return;
    let c = this.#config;
    host.innerHTML = `
      <div class="nw-row">
        <label for="nw-enabled">${escapeHtml(t('notification.widget.master'))}</label>
        <input id="nw-enabled" type="checkbox" data-config="enabled" ${c.enabled ? 'checked' : ''}>
      </div>
      <div class="nw-row">
        <label for="nw-volume">${escapeHtml(t('notification.widget.volume'))}</label>
        <input id="nw-volume" type="range" min="0" max="100" step="1" value="${Math.round(c.volume * 100)}" data-config="volume">
      </div>
      <div class="nw-row">
        <label for="nw-narration">${escapeHtml(t('notification.widget.narration'))}</label>
        <input id="nw-narration" type="checkbox" data-config="narrationEnabled" ${c.narrationEnabled ? 'checked' : ''}>
      </div>
    `;
  }

  #renderDetailed(t) {
    let host = this.ref.detailed;
    if (!host) return;
    let c = this.#config;
    let presetOptions = listEventPresetOptions();

    let soundRows = NOTIFICATION_EVENT_TYPES.map((type) => {
      let selected = resolveEventPreset(c, type);
      let options = presetOptions
        .map((key) => `<option value="${escapeHtml(key)}" ${key === selected ? 'selected' : ''}>${escapeHtml(key)}</option>`)
        .join('');
      return `
        <div class="nw-row">
          <label>${escapeHtml(t(EVENT_LABEL_KEYS[type] || 'notification.event.generic'))}</label>
          <select class="nw-select" data-event-preset="${escapeHtml(type)}">${options}</select>
        </div>`;
    }).join('');

    let stageRows = NOTIFICATION_BOARD_STAGES.map((stage) => `
      <div class="nw-row">
        <label for="nw-stage-${escapeHtml(stage)}">${escapeHtml(t(`notification.stage.${stage}`))}</label>
        <input id="nw-stage-${escapeHtml(stage)}" type="checkbox" data-stage="${escapeHtml(stage)}" ${c.stageNarration[stage] ? 'checked' : ''}>
      </div>`).join('');

    let depthButtons = NARRATION_DEPTHS.map((depth) => `
      <button type="button" data-depth="${escapeHtml(depth)}" aria-pressed="${String(depth === c.narrationDepth)}">
        ${escapeHtml(t(`notification.depth.${depth}`))}
      </button>`).join('');

    let phraseBlocks = NOTIFICATION_EVENT_TYPES.map((type) => {
      let variants = resolvePhraseVariants(c, { type, locale: this.locale, depth: c.narrationDepth });
      return `
        <div class="nw-phrase">
          <div class="nw-phrase-head">
            <span>${escapeHtml(t(EVENT_LABEL_KEYS[type] || 'notification.event.generic'))}</span>
            <button type="button" data-phrase-reset="${escapeHtml(type)}">${escapeHtml(t('notification.detailed.phraseReset'))}</button>
          </div>
          <textarea data-phrase="${escapeHtml(type)}" rows="2">${escapeHtml(variants.join('\n'))}</textarea>
        </div>`;
    }).join('');

    host.innerHTML = `
      <div class="nw-section">
        <div class="nw-section-title">${escapeHtml(t('notification.detailed.soundSection'))}</div>
        ${soundRows}
      </div>
      <div class="nw-section">
        <div class="nw-section-title">${escapeHtml(t('notification.detailed.depth'))}</div>
        <div class="nw-depth" aria-label="${escapeHtml(t('notification.detailed.depth'))}">${depthButtons}</div>
      </div>
      <div class="nw-section">
        <div class="nw-section-title">${escapeHtml(t('notification.detailed.stageSection'))}</div>
        ${stageRows}
      </div>
      <div class="nw-section">
        <div class="nw-section-title">${escapeHtml(t('notification.detailed.phraseSection'))}</div>
        <div class="nw-hint">${escapeHtml(t('notification.detailed.phraseHint'))}</div>
        ${phraseBlocks}
      </div>
    `;
  }

  // -- interaction -----------------------------------------------------------

  #onInput = (event) => {
    let target = event.target;
    if (!target || !this.#elementTargetsWidget(target)) return;

    let configKey = target.dataset?.config;
    if (configKey) {
      let next = { ...this.#config };
      if (configKey === 'volume') next.volume = Number(target.value) / 100;
      else next[configKey] = Boolean(target.checked);
      this.#config = normalizeNotificationConfig(next);
      this.#applyConfig('input');
      return;
    }

    let eventPreset = target.dataset?.eventPreset;
    if (eventPreset) {
      this.#config = normalizeNotificationConfig({
        ...this.#config,
        eventPresets: { ...this.#config.eventPresets, [eventPreset]: target.value },
      });
      this.#applyConfig('event-preset');
      return;
    }

    let stage = target.dataset?.stage;
    if (stage) {
      this.#config = normalizeNotificationConfig({
        ...this.#config,
        stageNarration: { ...this.#config.stageNarration, [stage]: Boolean(target.checked) },
      });
      this.#applyConfig('stage');
      return;
    }

    let phraseType = target.dataset?.phrase;
    if (phraseType && event.type === 'change') {
      let variants = String(target.value).split('\n');
      this.#config = setPhraseVariants(this.#config, {
        type: phraseType,
        locale: this.locale,
        depth: this.#config.narrationDepth,
        variants,
      });
      this.#applyConfig('phrase');
    }
  };

  #onClick = (event) => {
    let depthButton = event.target.closest?.('[data-depth]');
    if (depthButton && this.#elementTargetsWidget(depthButton)) {
      let depth = depthButton.dataset.depth;
      if (NARRATION_DEPTHS.includes(depth)) {
        this.#config = normalizeNotificationConfig({ ...this.#config, narrationDepth: depth });
        this.#render();
        this.#applyConfig('depth');
      }
      return;
    }

    let phraseReset = event.target.closest?.('[data-phrase-reset]');
    if (phraseReset && this.#elementTargetsWidget(phraseReset)) {
      this.#config = setPhraseVariants(this.#config, {
        type: phraseReset.dataset.phraseReset,
        locale: this.locale,
        depth: this.#config.narrationDepth,
        variants: [],
      });
      this.#render();
      this.#applyConfig('phrase-reset');
      return;
    }

    let action = event.target.closest?.('[data-action]')?.dataset.action;
    if (!action || !this.#elementTargetsWidget(event.target)) return;
    if (action === 'reset') {
      this.reset();
      this.#render();
    } else if (action === 'open-full') {
      this.#toggleDetailed();
    }
  };

  #toggleDetailed() {
    let detailed = this.ref.detailed;
    if (!detailed) return;
    detailed.hidden = !detailed.hidden;
    this.#render();
    if (this.$.isOpen) this.#positionPopover();
    this.dispatchEvent(new CustomEvent('notification-open-full', {
      bubbles: true,
      composed: true,
      detail: { open: !detailed.hidden, config: this.config, storageKey: this.storageKey },
    }));
  }

  // -- overlay lifecycle (mirrors CascadeThemeWidget) ------------------------

  #bindPopoverEvents() {
    let popover = this.ref.popover;
    if (!popover || this.#popoverBound) return;
    popover.addEventListener('click', this.#onClick);
    popover.addEventListener('input', this.#onInput);
    popover.addEventListener('change', this.#onInput);
    this.#popoverBound = true;
  }

  #unbindPopoverEvents() {
    let popover = this.ref.popover;
    if (!popover || !this.#popoverBound) return;
    popover.removeEventListener('click', this.#onClick);
    popover.removeEventListener('input', this.#onInput);
    popover.removeEventListener('change', this.#onInput);
    this.#popoverBound = false;
  }

  #setOpen(open) {
    let nextOpen = Boolean(open);
    if (nextOpen === this.$.isOpen) {
      if (nextOpen) this.#openPopover();
      return;
    }
    this.$.isOpen = nextOpen;
    if (nextOpen) this.#openPopover();
    else this.#closePopover();
  }

  #openPopover() {
    let popover = this.ref.popover;
    if (!popover) return;
    this.#bindPopoverEvents();
    popover.hidden = false;
    mountOverlayToDocument(popover, this.#resolveTarget());
    bringOverlayToFront(popover);
    this.#positionPopover();
    this.#bindOverlayListeners();
    this.#ensureRuntime();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        if (this.$.isOpen) this.#positionPopover();
      });
    }
  }

  #closePopover() {
    let popover = this.ref.popover;
    this.#unbindOverlayListeners();
    if (!popover) return;
    popover.hidden = true;
    popover.style.removeProperty('top');
    popover.style.removeProperty('left');
    restoreOverlayHome(popover);
  }

  #bindOverlayListeners() {
    if (this.#overlayListenersBound || typeof window === 'undefined') return;
    window.addEventListener('resize', this.#onOverlayReposition);
    window.addEventListener('scroll', this.#onOverlayReposition, true);
    this.#overlayListenersBound = true;
  }

  #unbindOverlayListeners() {
    if (!this.#overlayListenersBound || typeof window === 'undefined') return;
    window.removeEventListener('resize', this.#onOverlayReposition);
    window.removeEventListener('scroll', this.#onOverlayReposition, true);
    this.#overlayListenersBound = false;
  }

  #onOverlayReposition = () => {
    if (this.$.isOpen) this.#positionPopover();
  };

  #positionPopover() {
    let popover = this.ref.popover;
    let trigger = this.ref.trigger || this.querySelector('.nw-trigger');
    if (!popover || !trigger || typeof window === 'undefined') return;
    if (window.matchMedia?.('(max-width: 820px)')?.matches) {
      popover.style.removeProperty('top');
      popover.style.removeProperty('left');
      return;
    }
    let offset = Number.parseFloat(
      getComputedStyle(trigger).getPropertyValue('--sn-notification-widget-offset') || '8',
    );
    positionOverlay(trigger, popover, 'bottom-end', {
      offset: Number.isFinite(offset) ? offset : 8,
    });
    syncOverlayTheme(popover, this.#resolveTarget());
  }

  #eventTargetsWidget(event) {
    let path = event.composedPath?.() || [];
    let popover = this.ref.popover;
    return path.includes(this) || (popover && (path.includes(popover) || popover.contains(event.target)));
  }

  #elementTargetsWidget(element) {
    let popover = this.ref.popover;
    return this.contains(element) || Boolean(popover?.contains(element));
  }

  #resolveTarget() {
    if (typeof document === 'undefined') return this;
    return this.parentElement || document.documentElement;
  }
}

NotificationWidget.template = tpl;
NotificationWidget.rootStyles = css;
NotificationWidget.reg('notification-widget');

export default NotificationWidget;
