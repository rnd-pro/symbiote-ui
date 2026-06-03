export default /*css*/ `
sn-field {
  display: block;
  box-sizing: border-box;
  margin-block-end: var(--sn-field-margin-block-end);
  color: var(--sn-text);
  font-family: var(--sn-font);
}

sn-field[hidden] {
  display: none !important;
}

sn-field > label,
sn-field > [slot="label"],
sn-field > .sn-field-label {
  display: block;
  margin-block-end: var(--sn-field-label-margin-block-end);
  color: var(--sn-field-label-color);
  font-size: var(--sn-field-label-size);
  font-weight: var(--sn-field-label-weight);
  line-height: var(--sn-field-label-line-height);
  text-transform: var(--sn-field-label-transform);
}

sn-field input,
sn-field select,
sn-field textarea {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--sn-field-control-border);
  border-radius: var(--sn-field-control-radius);
  background: var(--sn-field-control-bg);
  color: var(--sn-field-control-color);
  padding: var(--sn-field-control-padding);
  font-family: var(--sn-font);
  font-size: var(--sn-field-control-font-size);
  line-height: var(--sn-field-control-line-height);
  transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
}

sn-field input::placeholder,
sn-field textarea::placeholder {
  color: var(--sn-field-placeholder-color);
}

sn-field input:focus,
sn-field select:focus,
sn-field textarea:focus {
  outline: none;
  border-color: var(--sn-field-control-focus-border);
  box-shadow: var(--sn-field-control-focus-shadow);
}

sn-field textarea {
  min-height: var(--sn-field-textarea-min-height);
  resize: vertical;
}

sn-field [slot="hint"],
sn-field .sn-field-hint {
  display: block;
  margin-block-start: var(--sn-field-hint-margin-block-start);
  color: var(--sn-field-hint-color);
  font-size: var(--sn-field-hint-size);
  line-height: var(--sn-field-hint-line-height);
}

sn-field[variant="inline"] {
  display: flex;
  align-items: center;
  gap: var(--sn-field-inline-gap);
}

sn-field[variant="inline"] > label,
sn-field[variant="inline"] > [slot="label"],
sn-field[variant="inline"] > .sn-field-label {
  margin-block-end: 0;
}

sn-field[variant="compact"] {
  margin-block-end: var(--sn-field-compact-margin-block-end);
}

sn-field[variant="compact"] input,
sn-field[variant="compact"] select,
sn-field[variant="compact"] textarea {
  padding: var(--sn-field-compact-control-padding);
}
`;
