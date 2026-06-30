import Symbiote from '@symbiotejs/symbiote';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import {
  applyCascadeTheme,
  applyCascadeThemeBundle,
  CASCADE_THEME_DEFAULTS,
  getCascadeThemeControls,
  isCascadeThemeBundle,
  normalizeCascadeThemeOptions,
  serializeCascadeThemeBundle,
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

function clearLocalStorage() {
  let storage = getStorage();
  if (!storage) return;
  try { storage.clear(); } catch (error) { /* storage unavailable */ }
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

export class CascadeThemeWidget extends Symbiote {
  static observedAttributes = ['storage-key', 'target-selector', 'default-state', 'scopes'];

  #controls = getCascadeThemeControls().filter((control) => COMPACT_CONTROLS.includes(control.name));
  #state = normalizeCascadeThemeOptions(CASCADE_THEME_DEFAULTS);
  #geometryRegister = '';
  #scopes = [];
  #ready = false;

  init$ = {
    isOpen: false,
    triggerTitle: 'Theme quick controls',
    // Compact slider list rendered by itemize on .ctw-controls. Reassigning
    // controlsList (see #syncControls) re-renders the values reactively.
    controlsList: [],
    // mode + geometry-register button pressed flags, bound to aria-pressed.
    // Kept in sync from #syncControls (mode) and #syncRegisterButtons (register).
    modeDarkActive: 'true',
    modeLightActive: 'false',
    registerDefaultActive: 'true',
    registerProductActive: 'false',
    registerToolActive: 'false',
    registerSpaciousActive: 'false',

    onToggle: () => {
      this.#setOpen(!this.$.isOpen);
    },
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
    onCopy: () => {
      void this.copyParameters();
    },
    onReset: () => {
      this.reset();
    },
    onOpenFull: () => {
      this.#setOpen(false);
      this.dispatchEvent(new CustomEvent('cascade-theme-open-full', {
        bubbles: true,
        composed: true,
        detail: { state: this.state, storageKey: this.storageKey, targetSelector: this.targetSelector },
      }));
    },
  };

  initCallback() {
    ensureMaterialSymbols(ICONS);
  }

  disconnectedCallback() {
    this.#setOpen(false);
    super.disconnectedCallback?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.#ready) return;
    if (name === 'storage-key' || name === 'default-state') {
      this.#loadStoredState();
    }
    this.#apply(name);
    this.#applyGeometryRegister(name);
    this.#syncRegisterButtons();
  }

  renderCallback() {
    if (this.#ready) return;
    this.#ready = true;
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
    let source = options.source || 'set-state';
    let scopes = this.scopes;
    // a full bundle restores every scope (and named window) at once when the host
    // has fed the scope set; afterwards reload this widget's own scope so the
    // sliders reflect what was applied
    if (isCascadeThemeBundle(value) && scopes.length) {
      applyCascadeThemeBundle(value, scopes, {
        applyState: (target, state) => { applyCascadeTheme(target, state, { notify: false }); },
        namedStorageBase: scopes[0]?.storageKey,
        resolveNamed: (name) => Array.from(
          (this.ownerDocument || document).querySelectorAll(`[data-theme-label="${CSS.escape(name)}"]`)
        ),
      });
      this.#loadStoredState();
      this.#apply(source);
      this.#applyGeometryRegister(source);
      this.#syncRegisterButtons();
      return;
    }
    let params = value;
    // a snapshot may carry the geometry profile alongside the parameters (see
    // copyParameters); split it back out so the preset round-trips too
    let hasRegister = value && typeof value === 'object' && 'register' in value;
    if (hasRegister) {
      let { register, ...rest } = value;
      params = rest;
      this.#geometryRegister = GEOMETRY_PROFILE_NAMES.includes(register) ? register : '';
    }
    this.#state = normalizeCascadeThemeOptions(params);
    this.#apply(source);
    if (hasRegister) {
      this.#applyGeometryRegister(source);
      this.#syncRegisterButtons();
    }
  }

  get storageKey() {
    return this.getAttribute('storage-key') || DEFAULT_STORAGE_KEY;
  }

  // The first-visit default and the target the reset button restores to. Consumers
  // declare it via the default-state attribute (JSON); without it the built-in
  // cascade defaults stand. Stored state always wins, so this never overwrites edits.
  get defaultState() {
    return parseStoredState(this.getAttribute('default-state')) || CASCADE_THEME_DEFAULTS;
  }

  get targetSelector() {
    return this.getAttribute('target-selector') || '';
  }

  // The structural + picked scopes the bundle copy/apply spans, set by the host
  // like the editor's targets: Array<{ id, selector, storageKey }>. Falls back to
  // a `scopes` attribute (JSON) so a host can declare them declaratively.
  get scopes() {
    if (this.#scopes.length) return this.#scopes;
    let parsed = parseStoredState(this.getAttribute('scopes'));
    return Array.isArray(parsed) ? parsed : [];
  }

  set scopes(value) {
    this.#scopes = Array.isArray(value) ? value : [];
  }

  reset() {
    let def = this.defaultState;
    let hasRegister = def && typeof def === 'object' && 'register' in def;
    this.setState(def, { source: 'reset' });
    // setState restores any profile the default carries; otherwise clear it so
    // reset always lands on the default geometry
    if (!hasRegister) {
      this.#geometryRegister = '';
      this.#applyGeometryRegister('reset');
    }
    this.#syncRegisterButtons();
    clearLocalStorage();
  }

  async copyParameters() {
    // with host-fed scopes, copy the whole multi-scope bundle (every structural
    // and picked scope plus named windows) so the snapshot round-trips through
    // setState; otherwise copy this scope's parameters plus its geometry profile.
    let scopes = this.scopes;
    let payload = scopes.length
      ? serializeCascadeThemeBundle(scopes.map((scope) => ({ id: scope.id, storageKey: scope.storageKey })))
      : this.#geometryRegister
        ? { ...this.#state, register: this.#geometryRegister }
        : { ...this.#state };
    let text = JSON.stringify(payload, null, 2);
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
      detail: { state: this.state, register: this.#geometryRegister || 'default', text },
    }));
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

  #overlayListenersBound = false;
  #dismissalCleanup = null;

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

  #renderControls() {
    this.$.controlsList = this.#controls.map((control) => ({
      name: control.name,
      icon: control.icon || 'tune',
      inputId: `ctw-${control.name}`,
      min: control.min,
      max: control.max,
      value: this.#state[control.name] ?? control.default,
    }));
  }

  #loadStoredState() {
    let stored = parseStoredState(getStorage()?.getItem(this.storageKey));
    this.#state = normalizeCascadeThemeOptions(stored || this.defaultState);
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

  // Push current #state into the reactive scope: the mode toggle's aria-pressed
  // flags derive from #state.mode and the slider list re-renders its values from
  // controlsList. Reactive bindings survive the popover portal move, so this keeps
  // the inline host DOM and the document-mounted popover in sync from one place.
  #syncControls() {
    this.$.modeDarkActive = String(this.#state.mode === 'dark');
    this.$.modeLightActive = String(this.#state.mode === 'light');
    this.$.controlsList = this.#controls.map((control) => ({
      name: control.name,
      icon: control.icon || 'tune',
      inputId: `ctw-${control.name}`,
      min: control.min,
      max: control.max,
      value: this.#state[control.name],
    }));
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

  // Drive the geometry-register buttons' aria-pressed reactively from the active
  // register. Empty register means the Default button is pressed.
  #syncRegisterButtons() {
    let active = this.#geometryRegister;
    this.$.registerDefaultActive = String(active === '');
    this.$.registerProductActive = String(active === 'product');
    this.$.registerToolActive = String(active === 'tool');
    this.$.registerSpaciousActive = String(active === 'spacious');
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
