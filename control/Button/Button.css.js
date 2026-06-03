export default /*css*/ `
sn-button {
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  gap: var(--sn-button-gap);
  min-width: 0;
  min-height: var(--sn-button-min-height);
  padding: var(--sn-button-padding);
  border: 1px solid var(--sn-button-border);
  border-radius: var(--sn-button-radius);
  background: var(--sn-button-bg);
  color: var(--sn-button-color);
  font-family: var(--sn-font);
  font-size: var(--sn-button-font-size);
  font-weight: var(--sn-button-font-weight);
  line-height: var(--sn-button-line-height);
  cursor: pointer;
  user-select: none;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease, filter 150ms ease;
}

sn-button[hidden] {
  display: none !important;
}

sn-button:hover:not([disabled]) {
  border-color: var(--sn-button-hover-border);
  background: var(--sn-button-hover-bg);
}

sn-button:focus-visible {
  outline: var(--sn-button-focus-ring);
  outline-offset: 2px;
}

sn-button[disabled] {
  cursor: not-allowed;
  opacity: var(--sn-button-disabled-opacity);
}

sn-button[variant="primary"] {
  border-color: var(--sn-button-primary-border);
  background: var(--sn-button-primary-bg);
  color: var(--sn-button-primary-color);
}

sn-button[variant="primary"]:hover:not([disabled]) {
  filter: var(--sn-button-primary-hover-filter);
}

sn-button[variant="success"] {
  border-color: var(--sn-button-success-border);
  background: var(--sn-button-success-bg);
  color: var(--sn-button-success-color);
}

sn-button[variant="success"]:hover:not([disabled]) {
  border-color: var(--sn-button-success-hover-border);
  background: var(--sn-button-success-hover-bg);
  color: var(--sn-button-success-hover-color);
}

sn-button[variant="danger"] {
  border-color: var(--sn-button-danger-border);
  background: var(--sn-button-danger-bg);
  color: var(--sn-button-danger-color);
}

sn-button[variant="danger"]:hover:not([disabled]) {
  border-color: var(--sn-button-danger-hover-border);
  background: var(--sn-button-danger-hover-bg);
  color: var(--sn-button-danger-hover-color);
}

sn-button[variant="icon"] {
  width: var(--sn-button-icon-size);
  min-height: var(--sn-button-icon-size);
  padding: 0;
  border-color: transparent;
  background: transparent;
  color: var(--sn-text-dim);
}

sn-button[variant="icon"]:hover:not([disabled]) {
  color: var(--sn-text);
}

sn-button .material-symbols-outlined {
  font-size: var(--sn-button-icon-font-size);
}
`;
