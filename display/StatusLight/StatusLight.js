import Symbiote from '@symbiotejs/symbiote';
import template from './StatusLight.tpl.js';
import css from './StatusLight.css.js';

export class StatusLight extends Symbiote {
  static observedAttributes = ['variant'];

  init$ = {
    variant: 'neutral',
  };

  connectedCallback() {
    super.connectedCallback?.();
    if (!this.hasAttribute('role')) {
      this.setAttribute('role', 'status');
    }
    // Hydrate $ from pre-set attributes
    if (this.hasAttribute('variant')) {
      this.$.variant = this.getAttribute('variant');
    }
    this.#syncState();
  }

  get variant() {
    return this.getAttribute('variant') || 'neutral';
  }

  set variant(val) {
    this.setAttribute('variant', val);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (!this.isConnected) return;
    if (name === 'variant') {
      this.$.variant = newValue || 'neutral';
      this.#syncState();
    } else {
      super.attributeChangedCallback?.(name, oldValue, newValue);
    }
  }

  #syncState() {
    this.setAttribute('variant', this.$.variant);
  }
}

StatusLight.template = template;
StatusLight.rootStyles = css;
StatusLight.reg('sn-status-light');

export default StatusLight;
