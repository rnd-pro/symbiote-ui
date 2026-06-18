import Symbiote from '@symbiotejs/symbiote';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import { accordionTemplate, accordionItemTemplate } from './Accordion.tpl.js';
import css from './Accordion.css.js';

export class Accordion extends Symbiote {
  static observedAttributes = ['multiple'];

  init$ = {
    multiple: false,
  };

  connectedCallback() {
    super.connectedCallback?.();
    this.$.multiple = this.hasAttribute('multiple');
    this.addEventListener('sn-accordion-item-toggle', this.#handleItemToggle);
  }

  disconnectedCallback() {
    this.removeEventListener('sn-accordion-item-toggle', this.#handleItemToggle);
    super.disconnectedCallback?.();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (!this.isConnected) return;
    if (name === 'multiple') {
      this.$.multiple = newValue !== null;
    } else {
      super.attributeChangedCallback?.(name, oldValue, newValue);
    }
  }

  #handleItemToggle(e) {
    if (this.$.multiple) return;
    const activeItem = e.target;
    if (!activeItem.open) return;

    Array.from(this.querySelectorAll('sn-accordion-item')).forEach((item) => {
      if (item !== activeItem && item.open) {
        item.open = false;
      }
    });
  }
}

Accordion.template = accordionTemplate;
Accordion.rootStyles = css;
Accordion.reg('sn-accordion');

export class AccordionItem extends Symbiote {
  static observedAttributes = ['open', 'disabled', 'header'];

  init$ = {
    open: false,
    disabled: false,
    header: '',
    onDetailsToggle: (e) => {
      const details = this.querySelector('.sn-accordion-details');
      if (!details) return;
      const open = details.open;
      if (this.$.open !== open) {
        this.$.open = open;
        this.toggleAttribute('open', open);
        this.dispatchEvent(new CustomEvent('sn-accordion-item-toggle', { bubbles: true, composed: true }));
      }
    }
  };

  connectedCallback() {
    super.connectedCallback?.();
    ensureMaterialSymbols(['chevron_right']);
    this.$.open = this.open;
    this.$.disabled = this.disabled;
    this.$.header = this.header;
    this.#syncState();
  }

  get open() {
    return this.hasAttribute('open');
  }

  set open(value) {
    this.toggleAttribute('open', Boolean(value));
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  set disabled(value) {
    this.toggleAttribute('disabled', Boolean(value));
  }

  get header() {
    return this.getAttribute('header') || '';
  }

  set header(value) {
    this.setAttribute('header', String(value));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (!this.isConnected) return;
    if (name === 'open') {
      this.$.open = newValue !== null;
      this.#syncState();
    } else if (name === 'disabled') {
      this.$.disabled = newValue !== null;
      this.#syncState();
    } else if (name === 'header') {
      this.$.header = newValue || '';
    } else {
      super.attributeChangedCallback?.(name, oldValue, newValue);
    }
  }

  #syncState() {
    const details = this.querySelector('.sn-accordion-details');
    if (!details) return;
    details.open = this.$.open;
    if (this.$.disabled) {
      details.setAttribute('disabled', '');
    } else {
      details.removeAttribute('disabled');
    }
  }
}

AccordionItem.template = accordionItemTemplate;
AccordionItem.reg('sn-accordion-item');

export default Accordion;
