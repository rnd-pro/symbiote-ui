import Symbiote from '@symbiotejs/symbiote';
import template from './Select.tpl.js';
import css from './Select.css.js';

export class Select extends Symbiote {
  static observedAttributes = ['value', 'disabled', 'required', 'placeholder', 'invalid', 'name'];

  #observer = null;
  #options = [];
  #isOpen = false;
  #focusedIndex = -1;

  #onTriggerClick = (event) => {
    if (this.disabled) return;
    this.#isOpen ? this.close() : this.open();
  };

  #onTriggerKeyDown = (event) => {
    if (this.disabled) return;

    switch (event.key) {
      case ' ':
      case 'Enter':
        event.preventDefault();
        this.#isOpen ? this.#selectFocused() : this.open();
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!this.#isOpen) {
          this.open();
        } else {
          this.#focusOption(this.#focusedIndex + 1);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.#isOpen) {
          this.open();
        } else {
          this.#focusOption(this.#focusedIndex - 1);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'Tab':
        if (this.#isOpen) {
          this.close();
        }
        break;
    }
  };

  #onOutsideClick = (event) => {
    if (this.#isOpen && !this.contains(event.target)) {
      this.close();
    }
  };

  constructor() {
    super();
    this.init$ = {
      displayLabel: '',
    };
  }

  connectedCallback() {
    super.connectedCallback?.();
    this.ref.trigger?.addEventListener('click', this.#onTriggerClick);
    this.ref.trigger?.addEventListener('keydown', this.#onTriggerKeyDown);
    document.addEventListener('click', this.#onOutsideClick);

    this.#observer = new MutationObserver(() => {
      this.#syncOptions();
    });
    this.#observer.observe(this, { childList: true, characterData: true });

    this.#syncOptions();
  }

  disconnectedCallback() {
    this.ref.trigger?.removeEventListener('click', this.#onTriggerClick);
    this.ref.trigger?.removeEventListener('keydown', this.#onTriggerKeyDown);
    document.removeEventListener('click', this.#onOutsideClick);
    this.#observer?.disconnect();
    this.#observer = null;
    super.disconnectedCallback?.();
  }

  get value() {
    return this.getAttribute('value') || '';
  }

  set value(val) {
    this.setAttribute('value', String(val));
  }

  get disabled() {
    return this.hasAttribute('disabled');
  }

  set disabled(val) {
    this.toggleAttribute('disabled', Boolean(val));
  }

  get required() {
    return this.hasAttribute('required');
  }

  set required(val) {
    this.toggleAttribute('required', Boolean(val));
  }

  get placeholder() {
    return this.getAttribute('placeholder') || 'Select...';
  }

  set placeholder(val) {
    this.setAttribute('placeholder', String(val));
  }

  get invalid() {
    return this.hasAttribute('invalid');
  }

  set invalid(val) {
    this.toggleAttribute('invalid', Boolean(val));
  }

  get name() {
    return this.getAttribute('name') || '';
  }

  set name(val) {
    this.setAttribute('name', String(val));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'value') {
      this.#syncActiveSelection();
    } else if (name === 'disabled' && newValue != null && this.#isOpen) {
      this.close();
    } else {
      this.#syncNativeAttributes();
    }
  }

  open() {
    if (this.disabled || this.#isOpen) return;
    this.#isOpen = true;
    this.ref.trigger?.setAttribute('aria-expanded', 'true');
    this.ref.dropdown?.setAttribute('data-visible', '');

    // Set focused option to selected option or first option
    const activeIndex = this.#options.findIndex(opt => opt.value === this.value);
    this.#focusOption(activeIndex >= 0 ? activeIndex : 0);

    this.dispatchEvent(new CustomEvent('sn-select-open', { bubbles: true, composed: true }));
  }

  close() {
    if (!this.#isOpen) return;
    this.#isOpen = false;
    this.ref.trigger?.setAttribute('aria-expanded', 'false');
    this.ref.dropdown?.removeAttribute('data-visible');
    this.ref.trigger?.focus();

    this.dispatchEvent(new CustomEvent('sn-select-close', { bubbles: true, composed: true }));
  }

  #syncOptions() {
    if (this.#observer) {
      this.#observer.disconnect();
    }
    try {
      const optionElements = Array.from(this.querySelectorAll('option'));
      this.#options = optionElements.map(opt => ({
        value: opt.value || opt.textContent.trim(),
        label: opt.textContent.trim(),
      }));

      // Rebuild native select children
      if (this.ref.nativeSelect) {
        this.ref.nativeSelect.innerHTML = '';
        optionElements.forEach(opt => {
          const nativeOpt = document.createElement('option');
          nativeOpt.value = opt.value;
          nativeOpt.textContent = opt.textContent;
          this.ref.nativeSelect.appendChild(nativeOpt);
        });
      }

      // Rebuild custom dropdown options
      const container = this.ref.optionsContainer;
      if (container) {
        container.innerHTML = '';
        this.#options.forEach((opt, index) => {
          const li = document.createElement('li');
          li.className = 'sn-select-option';
          li.role = 'option';
          li.id = `sn-select-opt-${index}-${this.uid || '0'}`;
          li.textContent = opt.label;
          li.setAttribute('data-value', opt.value);
          li.addEventListener('click', (event) => {
            event.stopPropagation();
            this.#selectOptionIndex(index);
          });
          container.appendChild(li);
        });
      }

      this.#syncActiveSelection();
      this.#syncNativeAttributes();
    } finally {
      if (this.#observer) {
        this.#observer.observe(this, { childList: true, characterData: true });
      }
    }
  }

  #syncActiveSelection() {
    const val = this.value;
    const selectedOpt = this.#options.find(opt => opt.value === val);

    if (this.ref.nativeSelect) {
      try {
        this.ref.nativeSelect.value = val;
      } catch (e) {
        const option = Array.from(this.ref.nativeSelect.options || []).find(opt => opt.value === val);
        if (option) {
          option.selected = true;
        }
      }
    }

    if (selectedOpt) {
      this.$.displayLabel = selectedOpt.label;
    } else {
      this.$.displayLabel = this.placeholder;
    }

    // Sync elements selected attribute/style
    const items = this.ref.optionsContainer?.children || [];
    Array.from(items).forEach(item => {
      const isSelected = item.getAttribute('data-value') === val;
      item.toggleAttribute('data-selected', isSelected);
      item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
  }

  #syncNativeAttributes() {
    const native = this.ref.nativeSelect;
    if (!native) return;
    native.disabled = this.disabled;
    native.required = this.required;
    if (this.name) {
      native.setAttribute('name', this.name);
    } else {
      native.removeAttribute('name');
    }
  }

  #focusOption(index) {
    if (this.#options.length === 0) return;

    // Wrap-around
    if (index < 0) index = this.#options.length - 1;
    if (index >= this.#options.length) index = 0;

    this.#focusedIndex = index;
    const items = this.ref.optionsContainer?.children || [];

    Array.from(items).forEach((item, idx) => {
      if (idx === index) {
        item.setAttribute('data-focused', '');
        this.ref.trigger?.setAttribute('aria-activedescendant', item.id);
        // Scroll into view if needed
        item.scrollIntoView?.({ block: 'nearest' });
      } else {
        item.removeAttribute('data-focused');
      }
    });
  }

  #selectFocused() {
    if (this.#focusedIndex >= 0 && this.#focusedIndex < this.#options.length) {
      this.#selectOptionIndex(this.#focusedIndex);
    }
  }

  #selectOptionIndex(index) {
    const opt = this.#options[index];
    if (!opt) return;

    const oldValue = this.value;
    this.value = opt.value;

    this.#syncActiveSelection();
    this.close();

    if (oldValue !== opt.value) {
      const detail = { value: opt.value, label: opt.label };
      this.dispatchEvent(new CustomEvent('sn-select-change', {
        bubbles: true,
        composed: true,
        detail,
      }));
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true,
        composed: true,
        detail,
      }));
    }
  }
}

Select.template = template;
Select.rootStyles = css;
Select.reg('sn-select');

export default Select;
