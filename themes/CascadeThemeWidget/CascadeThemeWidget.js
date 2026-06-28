import Symbiote from '@symbiotejs/symbiote';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import {
  applyCascadeTheme,
  CASCADE_THEME_DEFAULTS,
  getCascadeThemeControls,
  normalizeCascadeThemeOptions,
} from '../cascade-theme.js';
import { geometryRegisterScaleTokens, GEOMETRY_PROFILE_NAMES } from '../../tokens/scale.js';
import {
  bringOverlayToFront,
  mountOverlayToDocument,
  restoreOverlayHome,
  syncOverlayTheme,
} from '../../ui/overlay-stack.js';
import { positionOverlay } from '../../ui/overlay-positioner.js';
import { broadcastPopoverOpen, registerPopoverDismissal } from '../../ui/popover-coordinator.js';
import css from './CascadeThemeWidget.css.js';
import tpl from './CascadeThemeWidget.tpl.js';

const DEFAULT_STORAGE_KEY = 'symbiote-ui:cascade-theme-editor';
const COMPACT_CONTROLS = ['brightness', 'contrast', 'chroma', 'hue', 'pattern'];
const CONTROL_ICONS = getCascadeThemeControls()
  .map((control) => control.icon)
  .filter(Boolean);
const ICONS = [...new Set(['palette', 'content_copy', 'restart_alt', 'open_in_full', ...CONTROL_ICONS])];

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  return null;
}

function parseStoredState(value) {
  if (!value) return null;
  try {
    let parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    void error;
    return null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export class CascadeThemeWidget extends Symbiote {
  static observedAttributes = ['storage-key', 'target-selector'];

  #controls = getCascadeThemeControls().filter((control) => COMPACT_CONTROLS.includes(control.name));
  #state = normalizeCascadeThemeOptions(CASCADE_THEME_DEFAULTS);
  #geometryRegister = '';
  #ready = false;
  #popoverBound = false;
  #overlayListenersBound = false;
  #dismissalCleanup = null;

  init$ = {
    isOpen: false,
    triggerTitle: 'Theme quick controls',

    onToggle: () => {
      this.#setOpen(!this.$.isOpen);
    },
  };

  initCallback() {
    ensureMaterialSymbols(ICONS);
    this.addEventListener('input', this.#onInput);
    this.addEventListener('click', this.#onClick);
  }

  disconnectedCallback() {
    this.removeEventListener('input', this.#onInput);
    this.removeEventListener('click', this.#onClick);
    this.#unbindPopoverEvents();
    this.#setOpen(false);
    super.disconnectedCallback?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.#ready) return;
    if (name === 'storage-key') {
      this.#loadStoredState();
    }
    this.#apply(name);
    this.#applyGeometryRegister(name);
    this.#syncRegisterButtons();
  }

  renderCallback() {
    if (this.#ready) return;
    this.#ready = true;
    this.#bindPopoverEvents();
    this.#renderControls();
    this.#loadStoredState();
    this.#apply('init');
    this.#applyGeometryRegister('init');
    this.#syncRegisterButtons();
    if (this.$.isOpen) this.#openPopover();
  }

  get state() {
    return { ...this.#state };
  }

  setState(value, options = {}) {
    this.#state = normalizeCascadeThemeOptions(value);
    this.#apply(options.source || 'set-state');
  }

  get storageKey() {
    return this.getAttribute('storage-key') || DEFAULT_STORAGE_KEY;
  }

  get targetSelector() {
    return this.getAttribute('target-selector') || '';
  }

  reset() {
    this.setState(CASCADE_THEME_DEFAULTS, { source: 'reset' });
    this.#geometryRegister = '';
    this.#applyGeometryRegister('reset');
    this.#syncRegisterButtons();
  }

  async copyParameters() {
    let text = JSON.stringify(this.#state, null, 2);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        void error;
        this.#copyWithFallback(text);
      }
    } else {
      this.#copyWithFallback(text);
    }
    this.dispatchEvent(new CustomEvent('cascade-theme-copy', {
      bubbles: true,
      composed: true,
      detail: { state: this.state, text },
    }));
  }

  #onInput = (event) => {
    let input = event.target.closest?.('[data-theme-control]');
    if (!input || !this.#elementTargetsWidget(input)) return;
    this.#state = normalizeCascadeThemeOptions({
      ...this.#state,
      [input.dataset.themeControl]: Number(input.value),
    });
    this.#apply('input');
  };

  #onClick = (event) => {
    let modeButton = event.target.closest?.('[data-theme-mode]');
    if (modeButton && this.#elementTargetsWidget(modeButton)) {
      this.#state = normalizeCascadeThemeOptions({
        ...this.#state,
        mode: modeButton.dataset.themeMode,
      });
      this.#apply('mode');
      return;
    }

    let registerButton = event.target.closest?.('[data-geometry-register]');
    if (registerButton && this.#elementTargetsWidget(registerButton)) {
      let next = registerButton.dataset.geometryRegister;
      this.#geometryRegister = GEOMETRY_PROFILE_NAMES.includes(next) ? next : '';
      this.#applyGeometryRegister('toggle');
      this.#syncRegisterButtons();
      return;
    }

    let action = event.target.closest?.('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'copy') {
      void this.copyParameters();
    } else if (action === 'reset') {
      this.reset();
    } else if (action === 'open-full') {
      this.#setOpen(false);
      this.dispatchEvent(new CustomEvent('cascade-theme-open-full', {
        bubbles: true,
        composed: true,
        detail: { state: this.state, storageKey: this.storageKey, targetSelector: this.targetSelector },
      }));
    }
  };

  #bindPopoverEvents() {
    let popover = this.ref.popover;
    if (!popover || this.#popoverBound) return;
    popover.addEventListener('input', this.#onInput);
    popover.addEventListener('click', this.#onClick);
    this.#popoverBound = true;
  }

  #unbindPopoverEvents() {
    let popover = this.ref.popover;
    if (!popover || !this.#popoverBound) return;
    popover.removeEventListener('input', this.#onInput);
    popover.removeEventListener('click', this.#onClick);
    this.#popoverBound = false;
  }

  #setOpen(open) {
    let nextOpen = Boolean(open);
    if (nextOpen === this.$.isOpen) {
      if (nextOpen) this.#openPopover();
      return;
    }
    this.$.isOpen = nextOpen;
    if (nextOpen) {
      this.#openPopover();
    } else {
      this.#closePopover();
    }
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
    this.#bindDismissal();
    broadcastPopoverOpen(this);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        if (this.$.isOpen) this.#positionPopover();
      });
    }
  }

  #closePopover() {
    let popover = this.ref.popover;
    this.#unbindDismissal();
    this.#unbindOverlayListeners();
    if (!popover) return;
    popover.hidden = true;
    popover.style.removeProperty('top');
    popover.style.removeProperty('left');
    restoreOverlayHome(popover);
  }

  // Coordinated dismissal: a capture-phase outside-pointerdown closes this
  // popover, and any other widget opening its popover broadcasts so this one
  // closes too — enforcing at most one open popover at a time.
  #bindDismissal() {
    if (this.#dismissalCleanup) return;
    this.#dismissalCleanup = registerPopoverDismissal({
      owner: this,
      isInside: (event) => this.#eventTargetsWidget(event),
      onDismiss: () => this.#setOpen(false),
    });
  }

  #unbindDismissal() {
    this.#dismissalCleanup?.();
    this.#dismissalCleanup = null;
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
    let trigger = this.ref.trigger || this.querySelector('.ctw-trigger');
    if (!popover || !trigger || typeof window === 'undefined') return;
    if (window.matchMedia?.('(max-width: 820px)')?.matches) {
      popover.style.removeProperty('top');
      popover.style.removeProperty('left');
      return;
    }
    let offset = Number.parseFloat(
      getComputedStyle(trigger).getPropertyValue('--sn-theme-widget-offset') || '8'
    );
    positionOverlay(trigger, popover, 'bottom-end', {
      offset: Number.isFinite(offset) ? offset : 8,
    });
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

  #renderControls() {
    let controls = this.ref.controls;
    if (!controls) return;
    controls.innerHTML = this.#controls
      .map((control) => {
        let name = escapeHtml(control.name);
        let icon = escapeHtml(control.icon || 'tune');
        return `
          <div class="ctw-control">
            <div class="ctw-control-head">
              <span class="ctw-control-icon material-symbols-outlined" aria-hidden="true">${icon}</span>
              <label for="ctw-${name}">${name}</label>
            </div>
            <input
              id="ctw-${name}"
              type="range"
              min="${control.min}"
              max="${control.max}"
              step="1"
              value="${control.default}"
              data-theme-control="${name}"
            >
            <output data-theme-output="${name}">${control.default}</output>
          </div>
        `;
      })
      .join('');
  }

  #loadStoredState() {
    let stored = parseStoredState(getStorage()?.getItem(this.storageKey));
    if (stored) this.#state = normalizeCascadeThemeOptions(stored);
    let register = getStorage()?.getItem(`${this.storageKey}::geometry-register`);
    this.#geometryRegister = GEOMETRY_PROFILE_NAMES.includes(register) ? register : '';
  }

  #persistState() {
    getStorage()?.setItem(this.storageKey, JSON.stringify(this.#state));
  }

  #apply(source) {
    let target = this.#resolveTarget();
    let theme = applyCascadeTheme(target, this.#state, { notify: false });
    this.#state = theme.state;
    this.#persistState();
    this.#syncControls();
    this.#syncPopoverTheme(target);
    this.dispatchEvent(new CustomEvent('cascade-theme-change', {
      bubbles: true,
      composed: true,
      detail: {
        source,
        state: this.state,
        theme,
        storageKey: this.storageKey,
        targetSelector: this.targetSelector,
      },
    }));
  }

  #syncControls() {
    for (let button of this.#queryControlElements('[data-theme-mode]')) {
      button.setAttribute('aria-pressed', String(button.dataset.themeMode === this.#state.mode));
    }
    for (let input of this.#queryControlElements('[data-theme-control]')) {
      input.value = String(this.#state[input.dataset.themeControl]);
    }
    for (let output of this.#queryControlElements('[data-theme-output]')) {
      output.textContent = String(this.#state[output.dataset.themeOutput]);
    }
  }

  #queryControlElements(selector) {
    let result = new Set(this.querySelectorAll(selector));
    let popover = this.ref.popover;
    if (popover) {
      for (let element of popover.querySelectorAll(selector)) {
        result.add(element);
      }
    }
    return result;
  }

  #resolveTarget() {
    if (typeof document === 'undefined') return this;
    if (this.targetSelector) {
      return document.querySelector(this.targetSelector) || document.documentElement;
    }
    return document.documentElement;
  }

  // Preview a canonical geometry register: writes the register's density knobs
  // (--sn-base / --sn-density / --sn-theme-density|spacing-scale|radius-scale) so
  // the step ladder and every density-scaled semantic token shift together — the
  // same knobs the density slider drives. Empty register reverts to root.
  #applyGeometryRegister(source) {
    let target = this.#resolveTarget();
    if (!target?.style) return;
    for (let token of Object.keys(geometryRegisterScaleTokens('product'))) {
      target.style.removeProperty(token);
    }
    if (this.#geometryRegister) {
      for (let [token, value] of Object.entries(geometryRegisterScaleTokens(this.#geometryRegister))) {
        target.style.setProperty(token, value);
      }
    }
    getStorage()?.setItem(`${this.storageKey}::geometry-register`, this.#geometryRegister);
    this.dispatchEvent(new CustomEvent('cascade-geometry-register-change', {
      bubbles: true,
      composed: true,
      detail: { source, register: this.#geometryRegister || 'default', targetSelector: this.targetSelector },
    }));
  }

  #syncRegisterButtons() {
    for (let button of this.#queryControlElements('[data-geometry-register]')) {
      button.setAttribute('aria-pressed', String(button.dataset.geometryRegister === this.#geometryRegister));
    }
  }

  #syncPopoverTheme(target = this.#resolveTarget()) {
    let popover = this.ref.popover;
    if (!popover) return;
    syncOverlayTheme(popover, target);
  }

  #copyWithFallback(text) {
    if (typeof document === 'undefined') return;
    let textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.append(textarea);
    textarea.select();
    document.execCommand?.('copy');
    textarea.remove();
  }
}

CascadeThemeWidget.template = tpl;
CascadeThemeWidget.rootStyles = css;
CascadeThemeWidget.reg('cascade-theme-widget');

export default CascadeThemeWidget;
