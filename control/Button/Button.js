import Symbiote from '@symbiotejs/symbiote';
import { slotProcessor } from '@symbiotejs/symbiote/core/slotProcessor.js';
import template from './Button.tpl.js';
import css from './Button.css.js';

export class ActionButton extends Symbiote {
  static observedAttributes = ['disabled'];

  #disabled = false;

  #onClick = (event) => {
    if (!this.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  #onKeyDown = (event) => {
    if (this.disabled) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.click();
  };

  constructor() {
    super();
    this.templateProcessors.add(slotProcessor);
  }

  connectedCallback() {
    super.connectedCallback?.();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'button');
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this.#disabled = this.hasAttribute('disabled');
    this._syncDisabled(this.#disabled);
    this.addEventListener('click', this.#onClick, { capture: true });
    this.addEventListener('keydown', this.#onKeyDown);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick, { capture: true });
    this.removeEventListener('keydown', this.#onKeyDown);
    super.disconnectedCallback?.();
  }

  get disabled() {
    return this.#disabled || this.hasAttribute('disabled');
  }

  set disabled(value) {
    this.#disabled = Boolean(value);
    this._syncDisabled(this.#disabled);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name !== 'disabled') {
      super.attributeChangedCallback?.(name, oldValue, newValue);
      return;
    }
    if (oldValue === newValue) return;
    this.#disabled = newValue !== null;
    this._syncDisabled(this.#disabled, { reflect: false });
  }

  _syncDisabled(value, options = {}) {
    let disabled = Boolean(value);
    if (options.reflect !== false) {
      this.toggleAttribute('disabled', disabled);
    }
    this.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    this.tabIndex = disabled ? -1 : 0;
  }
}

ActionButton.template = template;
ActionButton.rootStyles = css;
ActionButton.reg('sn-button');

export default ActionButton;
