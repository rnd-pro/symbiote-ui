import Symbiote from '@symbiotejs/symbiote';
import template from './DatePicker.tpl.js';
import css from './DatePicker.css.js';

class DatePicker extends Symbiote {
  static observedAttributes = ['value', 'disabled', 'name', 'placeholder'];

  #isOpen = false;
  #currentDate = new Date();
  #viewDate = new Date();

  #onTriggerClick = (event) => {
    if (this.disabled) return;
    this.#isOpen ? this.close() : this.open();
  };

  #onOutsideClick = (event) => {
    if (this.#isOpen && !this.contains(event.target)) {
      this.close();
    }
  };

  #onPrevMonth = (event) => {
    event.stopPropagation();
    this.#viewDate.setMonth(this.#viewDate.getMonth() - 1);
    this.#renderCalendar();
  };

  #onNextMonth = (event) => {
    event.stopPropagation();
    this.#viewDate.setMonth(this.#viewDate.getMonth() + 1);
    this.#renderCalendar();
  };

  constructor() {
    super();
    this.init$ = {
      displayLabel: '',
      calendarTitle: '',
    };
  }

  connectedCallback() {
    super.connectedCallback?.();
    this.ref.trigger?.addEventListener('click', this.#onTriggerClick);
    this.ref.prevBtn?.addEventListener('click', this.#onPrevMonth);
    this.ref.nextBtn?.addEventListener('click', this.#onNextMonth);
    document.addEventListener('click', this.#onOutsideClick);

    this.#syncValue();
    this.#renderCalendar();
  }

  disconnectedCallback() {
    this.ref.trigger?.removeEventListener('click', this.#onTriggerClick);
    this.ref.prevBtn?.removeEventListener('click', this.#onPrevMonth);
    this.ref.nextBtn?.removeEventListener('click', this.#onNextMonth);
    document.removeEventListener('click', this.#onOutsideClick);
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

  get placeholder() {
    return this.getAttribute('placeholder') || 'Select date...';
  }

  set placeholder(val) {
    this.setAttribute('placeholder', String(val));
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
      this.#syncValue();
      this.#renderCalendar();
    } else {
      this.#syncControlAttributes();
      if (name === 'placeholder' && !this.value) {
        this.$.displayLabel = this.placeholder;
      }
    }
  }

  open() {
    if (this.disabled || this.#isOpen) return;
    this.#isOpen = true;
    this.ref.trigger?.setAttribute('aria-expanded', 'true');
    this.ref.dropdown?.setAttribute('data-visible', '');
    this.dispatchEvent(new CustomEvent('sn-date-picker-open', { bubbles: true, composed: true }));
  }

  close() {
    if (!this.#isOpen) return;
    this.#isOpen = false;
    this.ref.trigger?.setAttribute('aria-expanded', 'false');
    this.ref.dropdown?.removeAttribute('data-visible');
    this.dispatchEvent(new CustomEvent('sn-date-picker-close', { bubbles: true, composed: true }));
  }

  #syncValue() {
    const val = this.value;
    if (val) {
      const parsed = this.#parseDateValue(val);
      if (parsed) {
        this.#currentDate = parsed;
        this.#viewDate = new Date(parsed);
        this.$.displayLabel = val;
        if (this.ref.nativeInput) {
          this.ref.nativeInput.value = val;
        }
        this.#syncControlAttributes();
        return;
      }
    }
    this.$.displayLabel = this.placeholder;
    if (this.ref.nativeInput) {
      this.ref.nativeInput.value = '';
    }
    this.#syncControlAttributes();
  }

  #syncControlAttributes() {
    if (!this.ref.nativeInput) return;
    this.ref.nativeInput.disabled = this.disabled;
    this.ref.nativeInput.name = this.name;
    this.ref.nativeInput.placeholder = this.placeholder;
  }

  #parseDateValue(val) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(val));
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return null;
    }
    return parsed;
  }

  #renderCalendar() {
    const grid = this.ref.calendarGrid;
    if (!grid) return;

    grid.innerHTML = '';

    const year = this.#viewDate.getFullYear();
    const month = this.#viewDate.getMonth();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    this.$.calendarTitle = `${monthNames[month]} ${year}`;

    // Render weekday headers
    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    weekdays.forEach(day => {
      const header = document.createElement('div');
      header.className = 'sn-calendar-weekday';
      header.textContent = day;
      grid.appendChild(header);
    });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Padding for prev month days
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayVal = prevMonthTotalDays - i;
      const cell = this.#createDayCell(dayVal, true);
      grid.appendChild(cell);
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const cell = this.#createDayCell(i, false);
      grid.appendChild(cell);
    }

    // Remaining slots to round up the grid
    const totalCells = grid.children.length - 7; // exclude headers
    const remaining = 42 - totalCells;
    for (let i = 1; i <= remaining; i++) {
      const cell = this.#createDayCell(i, true);
      grid.appendChild(cell);
    }
  }

  #createDayCell(day, isOtherMonth) {
    const cell = document.createElement('div');
    cell.className = 'sn-calendar-day';
    cell.textContent = String(day);
    if (isOtherMonth) {
      cell.setAttribute('data-other-month', '');
    }

    const monthOffset = isOtherMonth ? (day > 15 ? -1 : 1) : 0;
    const cellDate = new Date(this.#viewDate.getFullYear(), this.#viewDate.getMonth() + monthOffset, day);

    // Format target value
    const cellValue = this.#formatDate(cellDate);

    // Selected state
    if (!isOtherMonth && this.value === cellValue) {
      cell.setAttribute('data-selected', '');
    }

    cell.addEventListener('click', (event) => {
      event.stopPropagation();
      if (this.disabled) return;
      const oldValue = this.value;
      this.value = cellValue;
      this.close();

      if (oldValue !== cellValue) {
        const detail = { value: cellValue };
        this.dispatchEvent(new CustomEvent('sn-control-change', { bubbles: true, composed: true, detail }));
        this.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true, detail }));
      }
    });

    return cell;
  }

  #formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

DatePicker.template = template;
DatePicker.rootStyles = css;
DatePicker.reg('sn-date-picker');

export default DatePicker;
