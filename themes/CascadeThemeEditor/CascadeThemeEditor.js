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

function rangeProgress(value, min, max) {
  let lo = Number(min ?? 0);
  let hi = Number(max ?? 100);
  let range = hi - lo;
  let progress = range <= 0 ? 0 : ((Number(value) - lo) / range) * 100;
  return `${Math.min(100, Math.max(0, progress)).toFixed(2)}%`;
}

export class CascadeThemeEditor extends Symbiote {
  static observedAttributes = ['storage-key', 'target-selector', 'pickable'];

  #controls = getCascadeThemeControls();
  #state = normalizeCascadeThemeOptions(CASCADE_THEME_DEFAULTS);
  #geometryRegister = '';
  #ready = false;
  #copyTimer = 0;
  #targetDefs = [];
  #activeTargetId = '';
  #switching = false;
  #picking = false;
  #pickHandlers = null;
  #pickHover = null;

  init$ = {
    // reactive scope picker: the host feeds `targets`; selecting one re-points the
    // editor's target-selector + storage-key (see #setActiveTarget). itemize renders
    // this list, so it updates live when the host adds/removes themeable windows.
    targets: [],
    hasTargets: false,
    // reactive slider list rebuilt from #state on every apply (see #syncControls).
    // Each item carries a precomputed range-fill `progress` string.
    controlsList: [],
    // mode + geometry-register button pressed flags, bound to aria-pressed.
    modeDark: 'true',
    modeLight: 'false',
    registerDefault: 'true',
    registerProduct: 'false',
    registerTool: 'false',
    registerSpacious: 'false',
    status: 'ready',
    params: '',
    // eyedropper: when `pickable` (a host selector) is set, the pick button lets the
    // user click any matching element to theme it individually (see #enterPickMode).
    picking: 'false',
    pickable: '',
    onTargetPick: (event) => {
      let id = event.currentTarget?.dataset?.targetId;
      if (id) this.#pickTarget(id);
    },
    onPickStart: () => this.#enterPickMode(),
    onControlInput: (event) => {
      let input = event.currentTarget;
      let name = input?.dataset?.themeControl;
      if (!name) return;
      this.#state = normalizeCascadeThemeOptions({ ...this.#state, [name]: Number(input.value) });
      this.#apply('input');
    },
    onModePick: (event) => {
      let mode = event.currentTarget?.dataset?.themeMode;
      if (!mode) return;
      this.#state = normalizeCascadeThemeOptions({ ...this.#state, mode });
      this.#apply('mode');
    },
    onRegisterPick: (event) => {
      let next = event.currentTarget?.dataset?.geometryRegister;
      this.#geometryRegister = GEOMETRY_PROFILE_NAMES.includes(next) ? next : '';
      this.#applyGeometryRegister('toggle');
      this.#syncRegisterButtons();
    },
    onCopy: () => void this.copyParameters(),
    onReset: () => this.reset(),
  };

  initCallback() {
    ensureMaterialSymbols(ICONS);
  }

  disconnectedCallback() {
    this.#exitPickMode();
    if (this.#copyTimer && typeof clearTimeout === 'function') {
      clearTimeout(this.#copyTimer);
    }
    super.disconnectedCallback?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (this.#switching) return;
    if (name === 'storage-key' && this.#ready) {
      this.#loadStoredState();
      this.#apply('storage-key');
    }
    if (name === 'target-selector' && this.#ready) {
      this.#apply('target');
      this.#applyGeometryRegister('target');
    }
    if (name === 'pickable') {
      this.$.pickable = newValue || '';
    }
  }

  renderCallback() {
    if (this.#ready) return;
    this.#ready = true;
    this.$.pickable = this.getAttribute('pickable') || '';
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

  get targets() {
    return this.#targetDefs.slice();
  }

  // Host-fed list of theme scopes/windows: [{ id, label, selector, storageKey, icon?, hint? }].
  // Two or more makes the picker visible; selecting one re-points the editor at that
  // scope. The single-target capability (target-selector + storage-key) already exists —
  // this just drives it reactively from a list.
  set targets(list) {
    this.#targetDefs = Array.isArray(list) ? list.filter((entry) => entry && entry.id) : [];
    if (!this.#targetDefs.some((entry) => entry.id === this.#activeTargetId)) {
      this.#activeTargetId = this.#targetDefs[0]?.id || '';
    }
    this.#renderTargets();
    let active = this.#targetDefs.find((entry) => entry.id === this.#activeTargetId);
    if (active) this.#setActiveTarget(active);
  }

  #renderTargets() {
    this.$.targets = this.#targetDefs.map((entry) => ({
      id: entry.id,
      label: entry.label || entry.id,
      icon: entry.icon || 'web_asset',
      hint: entry.hint || entry.selector || '',
      active: String(entry.id === this.#activeTargetId),
    }));
    this.$.hasTargets = this.#targetDefs.length > 1;
  }

  #pickTarget(id) {
    let target = this.#targetDefs.find((entry) => entry.id === id);
    if (!target || id === this.#activeTargetId) return;
    this.#activeTargetId = id;
    this.#renderTargets();
    this.#setActiveTarget(target);
    this.dispatchEvent(new CustomEvent('cascade-theme-target-change', {
      bubbles: true,
      composed: true,
      detail: { id, selector: target.selector, storageKey: target.storageKey },
    }));
  }

  // Re-point target-selector + storage-key, reload that scope's saved params, apply
  // once. #switching suppresses attributeChangedCallback so the two attribute writes
  // don't each trigger an intermediate apply on the wrong scope.
  #setActiveTarget(target) {
    this.#switching = true;
    if (target.selector != null) this.setAttribute('target-selector', String(target.selector));
    if (target.storageKey != null) this.setAttribute('storage-key', String(target.storageKey));
    this.#switching = false;
    if (!this.#ready) return;
    this.#loadStoredState();
    this.#apply('target-switch');
    this.#applyGeometryRegister('target-switch');
    this.#syncRegisterButtons();
  }

  get pickable() {
    return this.getAttribute('pickable') || '';
  }

  // Eyedropper: enter pick mode, then the next click on an element matching `pickable`
  // becomes an individual theme target. The host marks pickable elements with
  // data-theme-id/-label/-key (or relies on the element id); the editor reads those.
  #enterPickMode() {
    if (this.#picking || !this.pickable) return;
    this.#picking = true;
    this.$.picking = 'true';
    let doc = this.ownerDocument || document;
    doc.documentElement.setAttribute('data-cascade-theme-picking', '');
    let onOver = (event) => {
      let element = event.target?.closest?.(this.pickable);
      if (element === this.#pickHover) return;
      this.#clearPickHover();
      if (element) {
        this.#pickHover = element;
        element.setAttribute('data-cascade-theme-pick-hover', '');
      }
    };
    let onClick = (event) => {
      let element = event.target?.closest?.(this.pickable);
      if (element) {
        event.preventDefault();
        event.stopPropagation();
        this.#applyPickedTarget(element);
      }
      this.#exitPickMode();
    };
    let onKey = (event) => { if (event.key === 'Escape') this.#exitPickMode(); };
    this.#pickHandlers = { doc, onOver, onClick, onKey };
    doc.addEventListener('pointerover', onOver, true);
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('keydown', onKey, true);
  }

  #clearPickHover() {
    if (this.#pickHover) {
      this.#pickHover.removeAttribute('data-cascade-theme-pick-hover');
      this.#pickHover = null;
    }
  }

  #exitPickMode() {
    if (!this.#picking) return;
    this.#picking = false;
    this.$.picking = 'false';
    this.#clearPickHover();
    let handlers = this.#pickHandlers;
    if (handlers) {
      handlers.doc.removeEventListener('pointerover', handlers.onOver, true);
      handlers.doc.removeEventListener('click', handlers.onClick, true);
      handlers.doc.removeEventListener('keydown', handlers.onKey, true);
      handlers.doc.documentElement.removeAttribute('data-cascade-theme-picking');
      this.#pickHandlers = null;
    }
  }

  #applyPickedTarget(element) {
    let id = element.dataset.themeId || element.id;
    let selector = element.dataset.themeTarget || (element.id ? `#${element.id}` : '');
    if (!id || !selector) return;
    let descriptor = {
      id: `pick:${id}`,
      label: element.dataset.themeLabel || id,
      icon: element.dataset.themeIcon || 'colorize',
      selector,
      storageKey: element.dataset.themeKey || `${this.storageKey}::win::${id}`,
    };
    let existing = this.#targetDefs.findIndex((entry) => entry.id === descriptor.id);
    if (existing >= 0) this.#targetDefs[existing] = descriptor;
    else this.#targetDefs.push(descriptor);
    this.#activeTargetId = descriptor.id;
    this.#renderTargets();
    this.#setActiveTarget(descriptor);
    this.dispatchEvent(new CustomEvent('cascade-theme-target-change', {
      bubbles: true,
      composed: true,
      detail: { id: descriptor.id, selector: descriptor.selector, storageKey: descriptor.storageKey, picked: true },
    }));
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

  // Rebuild the reactive slider list and mode pressed-flags from #state. Reassigning
  // this.$.controlsList re-renders the itemize template; each item carries a
  // precomputed --cte-range-progress fill string for the current value.
  #syncControls() {
    this.$.controlsList = this.#controls
      .filter((control) => control.type !== 'enum')
      .map((control) => {
        let value = this.#state[control.name];
        return {
          name: control.name,
          inputId: `cte-${control.name}`,
          icon: control.icon || 'tune',
          description: control.description || control.name,
          min: control.min,
          max: control.max,
          value,
          progress: rangeProgress(value, control.min, control.max),
        };
      });
    this.$.modeDark = String(this.#state.mode === 'dark');
    this.$.modeLight = String(this.#state.mode === 'light');
    this.$.params = JSON.stringify(this.#state, null, 2);
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

  // Drive the geometry-register buttons' aria-pressed reactively from the active
  // register. Empty register means the Default button is pressed.
  #syncRegisterButtons() {
    let active = this.#geometryRegister;
    this.$.registerDefault = String(active === '');
    this.$.registerProduct = String(active === 'product');
    this.$.registerTool = String(active === 'tool');
    this.$.registerSpacious = String(active === 'spacious');
  }

  #geometryStorageKey() {
    return `${this.storageKey}::geometry-register`;
  }

  #persistGeometryRegister() {
    let storage = getStorage();
    if (!storage) return;
    storage.setItem(this.#geometryStorageKey(), this.#geometryRegister);
  }

  #setStatus(value) {
    this.$.status = value;
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
