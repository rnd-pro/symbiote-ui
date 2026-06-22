import Symbiote from '@symbiotejs/symbiote';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import {
  applyCascadeTheme,
  CASCADE_THEME_DEFAULTS,
  getCascadeThemeControls,
  normalizeCascadeThemeOptions,
} from '../cascade-theme.js';
import { geometryRegisterScaleTokens, GEOMETRY_PROFILE_NAMES } from '../../tokens/scale.js';
import template from './CascadeThemeEditor.tpl.js';
import css from './CascadeThemeEditor.css.js';

const DEFAULT_STORAGE_KEY = 'symbiote-ui:cascade-theme-editor';
const CONTROL_ICONS = getCascadeThemeControls()
  .map((control) => control.icon)
  .filter(Boolean);
const ICONS = [...new Set(['palette', 'content_copy', 'restart_alt', 'data_object', ...CONTROL_ICONS])];

function canUseStorage() {
  return getStorage() !== null;
}

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

export class CascadeThemeEditor extends Symbiote {
  static observedAttributes = ['storage-key', 'target-selector'];

  #controls = getCascadeThemeControls();
  #state = normalizeCascadeThemeOptions(CASCADE_THEME_DEFAULTS);
  #geometryRegister = '';
  #ready = false;
  #copyTimer = 0;

  initCallback() {
    ensureMaterialSymbols(ICONS);
    this.addEventListener('input', this.#onInput);
    this.addEventListener('click', this.#onClick);
  }

  disconnectedCallback() {
    this.removeEventListener('input', this.#onInput);
    this.removeEventListener('click', this.#onClick);
    if (this.#copyTimer && typeof clearTimeout === 'function') {
      clearTimeout(this.#copyTimer);
    }
    super.disconnectedCallback?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'storage-key' && this.#ready) {
      this.#loadStoredState();
      this.#apply('storage-key');
    }
    if (name === 'target-selector' && this.#ready) {
      this.#apply('target');
      this.#applyGeometryRegister('target');
    }
  }

  renderCallback() {
    if (this.#ready) return;
    this.#ready = true;
    this.#renderControls();
    this.#loadStoredState();
    this.#apply('init');
    this.#applyGeometryRegister('init');
    this.#syncRegisterButtons();
  }

  get geometryRegister() {
    return this.#geometryRegister;
  }

  set geometryRegister(value) {
    this.#geometryRegister = GEOMETRY_PROFILE_NAMES.includes(value) ? value : '';
    this.#applyGeometryRegister('property');
    this.#syncRegisterButtons();
  }

  get state() {
    return { ...this.#state };
  }

  set state(value) {
    this.setState(value, { source: 'property' });
  }

  get storageKey() {
    return this.getAttribute('storage-key') || DEFAULT_STORAGE_KEY;
  }

  get targetSelector() {
    return this.getAttribute('target-selector') || '';
  }

  setState(value, options = {}) {
    this.#state = normalizeCascadeThemeOptions(value);
    this.#apply(options.source || 'set-state');
  }

  reset() {
    this.setState(CASCADE_THEME_DEFAULTS, { source: 'reset' });
    this.#geometryRegister = '';
    this.#applyGeometryRegister('reset');
    this.#syncRegisterButtons();
  }

  async copyParameters() {
    let payload = JSON.stringify(this.#state, null, 2);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(payload);
        } catch (error) {
          this.#copyWithFallback(payload);
        }
      } else {
        this.#copyWithFallback(payload);
      }
      this.#setStatus('copied');
      this.dispatchEvent(new CustomEvent('cascade-theme-copy', {
        bubbles: true,
        composed: true,
        detail: { state: this.state, text: payload },
      }));
    } catch (error) {
      this.#setStatus('copy failed');
      this.dispatchEvent(new CustomEvent('cascade-theme-copy-error', {
        bubbles: true,
        composed: true,
        detail: { error },
      }));
    }
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

    let registerButton = event.target.closest?.('[data-geometry-register]');
    if (registerButton && this.contains(registerButton)) {
      let next = registerButton.dataset.geometryRegister;
      this.#geometryRegister = GEOMETRY_PROFILE_NAMES.includes(next) ? next : '';
      this.#applyGeometryRegister('toggle');
      this.#syncRegisterButtons();
      return;
    }

    let action = event.target.closest?.('[data-action]')?.dataset.action;
    if (action === 'copy') {
      void this.copyParameters();
    }
    if (action === 'reset') {
      this.reset();
    }
  };

  #renderControls() {
    let controls = this.ref.controls;
    if (!controls) return;
    controls.innerHTML = this.#controls
      .filter((control) => control.type !== 'enum')
      .map((control) => {
        let name = escapeHtml(control.name);
        let icon = escapeHtml(control.icon || 'tune');
        let description = escapeHtml(control.description || control.name);
        return `
          <div class="cte-control" title="${description}">
            <div class="cte-control-head">
              <span class="cte-control-icon material-symbols-outlined" aria-hidden="true">${icon}</span>
              <label for="cte-${name}">${name}</label>
            </div>
            <input
              id="cte-${name}"
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
    let storage = getStorage();
    if (!storage) return;
    let stored = parseStoredState(storage.getItem(this.storageKey));
    if (stored) {
      this.#state = normalizeCascadeThemeOptions(stored);
    }
    let register = storage.getItem(this.#geometryStorageKey());
    this.#geometryRegister = GEOMETRY_PROFILE_NAMES.includes(register) ? register : '';
  }

  #persistState() {
    let storage = getStorage();
    if (!storage) return;
    storage.setItem(this.storageKey, JSON.stringify(this.#state));
  }

  #apply(source) {
    let theme = applyCascadeTheme(this.#resolveTarget(), this.#state, { notify: false });
    this.#state = theme.state;
    this.#persistState();
    this.#syncControls();
    this.#setStatus('saved');
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
      let active = button.dataset.themeMode === this.#state.mode;
      button.setAttribute('aria-pressed', String(active));
    }

    for (let input of this.querySelectorAll('[data-theme-control]')) {
      let name = input.dataset.themeControl;
      let value = this.#state[name];
      input.value = String(value);
      this.#syncRangeProgress(input, value);
    }

    for (let output of this.querySelectorAll('[data-theme-output]')) {
      let name = output.dataset.themeOutput;
      output.textContent = String(this.#state[name]);
    }

    if (this.ref.params) {
      this.ref.params.textContent = JSON.stringify(this.#state, null, 2);
    }
  }

  #resolveTarget() {
    if (typeof document === 'undefined') return this;
    if (this.targetSelector) {
      return document.querySelector(this.targetSelector) || document.documentElement;
    }
    return document.documentElement;
  }

  // Preview a canonical geometry register on the target: writes the register's
  // density knobs (--sn-base / --sn-density / --sn-theme-density|spacing-scale|
  // radius-scale) so the step ladder AND every density-scaled semantic token
  // shift together — the same knobs the density slider drives. Empty register
  // reverts to the provider root.
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
    this.#persistGeometryRegister();
    this.dispatchEvent(new CustomEvent('cascade-geometry-register-change', {
      bubbles: true,
      composed: true,
      detail: {
        source,
        register: this.#geometryRegister || 'default',
        targetSelector: this.targetSelector,
      },
    }));
  }

  #syncRegisterButtons() {
    for (let button of this.querySelectorAll('[data-geometry-register]')) {
      let active = button.dataset.geometryRegister === this.#geometryRegister;
      button.setAttribute('aria-pressed', String(active));
    }
  }

  #geometryStorageKey() {
    return `${this.storageKey}::geometry-register`;
  }

  #persistGeometryRegister() {
    let storage = getStorage();
    if (!storage) return;
    storage.setItem(this.#geometryStorageKey(), this.#geometryRegister);
  }

  #syncRangeProgress(input, value) {
    let min = Number(input.min || 0);
    let max = Number(input.max || 100);
    let range = max - min;
    let progress = range <= 0 ? 0 : ((Number(value) - min) / range) * 100;
    input.style.setProperty('--cte-range-progress', `${Math.min(100, Math.max(0, progress)).toFixed(2)}%`);
  }

  #setStatus(value) {
    if (this.ref.status) this.ref.status.textContent = value;
    if (value === 'copied' && typeof setTimeout === 'function') {
      if (this.#copyTimer) clearTimeout(this.#copyTimer);
      this.#copyTimer = setTimeout(() => this.#setStatus('saved'), 1400);
    }
  }

  #copyWithFallback(payload) {
    if (typeof document === 'undefined') return;
    let textarea = document.createElement('textarea');
    textarea.value = payload;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.append(textarea);
    textarea.select();
    document.execCommand?.('copy');
    textarea.remove();
  }
}

CascadeThemeEditor.template = template;
CascadeThemeEditor.rootStyles = css;
CascadeThemeEditor.reg('cascade-theme-editor');

export default CascadeThemeEditor;
