import Symbiote from '@symbiotejs/symbiote';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import {
  applyCascadeTheme,
  CASCADE_THEME_DEFAULTS,
  getCascadeThemeControls,
  normalizeCascadeThemeOptions,
} from '../cascade-theme.js';
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
  #ready = false;

  init$ = {
    isOpen: false,
    triggerTitle: 'Theme quick controls',

    onToggle: () => {
      this.$.isOpen = !this.$.isOpen;
    },
  };

  initCallback() {
    ensureMaterialSymbols(ICONS);
    this.addEventListener('input', this.#onInput);
    this.addEventListener('click', this.#onClick);
    this._onDocumentPointerDown = (event) => {
      if (!this.$.isOpen || this.contains(event.target)) return;
      this.$.isOpen = false;
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerdown', this._onDocumentPointerDown);
    }
  }

  disconnectedCallback() {
    this.removeEventListener('input', this.#onInput);
    this.removeEventListener('click', this.#onClick);
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerdown', this._onDocumentPointerDown);
    }
    super.disconnectedCallback?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.#ready) return;
    if (name === 'storage-key') {
      this.#loadStoredState();
    }
    this.#apply(name);
  }

  renderCallback() {
    if (this.#ready) return;
    this.#ready = true;
    this.#renderControls();
    this.#loadStoredState();
    this.#apply('init');
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
    if (!input || !this.contains(input)) return;
    this.#state = normalizeCascadeThemeOptions({
      ...this.#state,
      [input.dataset.themeControl]: Number(input.value),
    });
    this.#apply('input');
  };

  #onClick = (event) => {
    let modeButton = event.target.closest?.('[data-theme-mode]');
    if (modeButton && this.contains(modeButton)) {
      this.#state = normalizeCascadeThemeOptions({
        ...this.#state,
        mode: modeButton.dataset.themeMode,
      });
      this.#apply('mode');
      return;
    }

    let action = event.target.closest?.('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'copy') {
      void this.copyParameters();
    } else if (action === 'reset') {
      this.reset();
    } else if (action === 'open-full') {
      this.$.isOpen = false;
      this.dispatchEvent(new CustomEvent('cascade-theme-open-full', {
        bubbles: true,
        composed: true,
        detail: { state: this.state, storageKey: this.storageKey, targetSelector: this.targetSelector },
      }));
    }
  };

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
  }

  #persistState() {
    getStorage()?.setItem(this.storageKey, JSON.stringify(this.#state));
  }

  #apply(source) {
    let theme = applyCascadeTheme(this.#resolveTarget(), this.#state, { notify: false });
    this.#state = theme.state;
    this.#persistState();
    this.#syncControls();
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
    for (let button of this.querySelectorAll('[data-theme-mode]')) {
      button.setAttribute('aria-pressed', String(button.dataset.themeMode === this.#state.mode));
    }
    for (let input of this.querySelectorAll('[data-theme-control]')) {
      input.value = String(this.#state[input.dataset.themeControl]);
    }
    for (let output of this.querySelectorAll('[data-theme-output]')) {
      output.textContent = String(this.#state[output.dataset.themeOutput]);
    }
  }

  #resolveTarget() {
    if (typeof document === 'undefined') return this;
    if (this.targetSelector) {
      return document.querySelector(this.targetSelector) || document.documentElement;
    }
    return document.documentElement;
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
