import Symbiote from '@symbiotejs/symbiote';
import template from './SourceEditor.tpl.js';
import css from './SourceEditor.css.js';

function emit(component, name, detail = {}) {
  component.dispatchEvent(new CustomEvent(name, {
    bubbles: true,
    composed: true,
    detail,
  }));
}

export class SourceEditor extends Symbiote {
  init$ = {
    value: '',
    language: 'plain',
    placeholder: '',
    ariaLabel: 'Source editor',
    readonly: false,
    disabled: false,
    dirty: false,
    onInput: () => this._handleInput(),
    onKeyDown: (event) => this._handleKeyDown(event),
  };

  renderCallback() {
    this.sub('value', (value) => {
      let editor = this.ref?.editor;
      if (editor && editor.value !== value) {
        editor.value = value || '';
      }
    });

    this.sub('language', (value) => {
      this.setAttribute('data-language', value || 'plain');
    });

    this.sub('dirty', (value) => {
      this.toggleAttribute('dirty', Boolean(value));
    });
  }

  get value() {
    return this.getContent();
  }

  set value(value) {
    this.setContent(value);
  }

  get disabled() {
    return Boolean(this.$.disabled);
  }

  set disabled(value) {
    this.$.disabled = Boolean(value);
  }

  get readOnly() {
    return Boolean(this.$.readonly);
  }

  set readOnly(value) {
    this.$.readonly = Boolean(value);
  }

  getContent() {
    return this.ref?.editor?.value ?? this.$.value ?? '';
  }

  setContent(value, options = {}) {
    let content = String(value ?? '');
    this.$.value = content;
    if (this.ref?.editor && this.ref.editor.value !== content) {
      this.ref.editor.value = content;
    }
    this.setDirty(Boolean(options.dirty));
  }

  setEditable(editable) {
    this.$.disabled = !editable;
  }

  setLanguage(language) {
    this.$.language = language || 'plain';
  }

  setDirty(dirty) {
    this.$.dirty = Boolean(dirty);
  }

  focus() {
    this.ref?.editor?.focus();
  }

  select() {
    this.ref?.editor?.select();
  }

  _handleInput() {
    let value = this.getContent();
    this.$.value = value;
    this.setDirty(true);
    emit(this, 'source-editor-input', {
      value,
      dirty: this.$.dirty,
      language: this.$.language,
    });
  }

  _handleKeyDown(event) {
    if (event.key !== 'Tab' || event.metaKey || event.ctrlKey || event.altKey) return;

    let editor = this.ref?.editor;
    if (!editor || editor.disabled || editor.readOnly) return;

    event.preventDefault();
    let start = editor.selectionStart;
    let end = editor.selectionEnd;
    let tab = '  ';
    editor.value = `${editor.value.slice(0, start)}${tab}${editor.value.slice(end)}`;
    editor.selectionStart = editor.selectionEnd = start + tab.length;
    this._handleInput();
  }
}

SourceEditor.template = template;
SourceEditor.rootStyles = css;
SourceEditor.reg('source-editor');
