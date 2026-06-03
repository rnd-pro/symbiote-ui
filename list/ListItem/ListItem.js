import Symbiote from '@symbiotejs/symbiote';
import template from './ListItem.tpl.js';
import css from './ListItem.css.js';

function emit(el, type, detail = {}) {
  el.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

export class ListItem extends Symbiote {
  init$ = {
    label: '',
    description: '',
    icon: '',
    meta: '',
    active: false,
    disabled: false,
    item: null,

    onSelect: (event) => {
      if (this.$.disabled) {
        event.preventDefault();
        return;
      }
      emit(this, 'sn-list-item-select', { item: this.$.item });
    },

    onKeydown: (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      this.$.onSelect(event);
    },
  };

  renderCallback() {
    this.sub('active', (value) => {
      this.toggleAttribute('active', Boolean(value));
    });

    this.sub('disabled', (value) => {
      let disabled = Boolean(value);
      this.toggleAttribute('disabled', disabled);
      this.ref.item.setAttribute('aria-disabled', String(disabled));
      this.ref.item.tabIndex = disabled ? -1 : 0;
    });
  }

  setItem(item = null) {
    this.$.item = item;
    if (!item || typeof item !== 'object') return;

    this.set$({
      label: item.label || '',
      description: item.description || '',
      icon: item.icon || '',
      meta: item.meta || '',
      active: Boolean(item.active),
      disabled: Boolean(item.disabled),
    });
  }
}

ListItem.template = template;
ListItem.rootStyles = css;
ListItem.reg('sn-list-item');

export default ListItem;
