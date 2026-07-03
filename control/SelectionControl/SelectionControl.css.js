export default /*css*/ `
sn-checkbox,
sn-radio,
sn-switch {
  display: inline-flex;
  box-sizing: border-box;
  max-width: 100%;
  color: var(--sn-selection-color, var(--sn-text));
  font-family: var(--sn-font);
  font-size: var(--sn-selection-font-size, var(--sn-field-control-font-size, 12px));
  line-height: var(--sn-selection-line-height, var(--sn-field-control-line-height, 1.35));
}

sn-checkbox[hidden],
sn-radio[hidden],
sn-switch[hidden] {
  display: none !important;
}

.sn-selection-control {
  display: inline-grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--sn-selection-gap, var(--sn-field-control-gap, 8px));
  max-width: 100%;
  cursor: pointer;
}

.sn-selection-input-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: var(--sn-selection-control-size, 16px);
  block-size: var(--sn-selection-control-size, 16px);
  min-inline-size: var(--sn-selection-control-size, 16px);
  margin-block-start: var(--sn-selection-control-offset, 1px);
}

.sn-selection-input {
  position: absolute;
  inset: 0;
  z-index: 1;
  inline-size: 100%;
  block-size: 100%;
  margin: 0;
  opacity: 0;
  cursor: inherit;
}

.sn-selection-visual {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  inline-size: 100%;
  block-size: 100%;
  border: 1px solid var(--sn-selection-border, var(--sn-field-control-border));
  border-radius: var(--sn-selection-radius, var(--sn-field-control-radius, 4px));
  background: var(--sn-selection-bg, var(--sn-field-control-bg));
  color: var(--sn-selection-mark-color, var(--sn-button-primary-color, var(--sn-text, #fff)));
  transition:
    background var(--sn-transition-normal, 150ms) var(--sn-transition-easing, ease),
    border-color var(--sn-transition-normal, 150ms) var(--sn-transition-easing, ease),
    box-shadow var(--sn-transition-normal, 150ms) var(--sn-transition-easing, ease),
    transform var(--sn-transition-fast, 100ms) var(--sn-transition-easing, ease);
}

.sn-selection-mark {
  display: block;
  opacity: 0;
  transform: scale(0.82);
  transition:
    opacity var(--sn-transition-fast, 100ms) var(--sn-transition-easing, ease),
    transform var(--sn-transition-fast, 100ms) var(--sn-transition-easing, ease);
}

.sn-selection-content {
  display: grid;
  gap: var(--sn-selection-content-gap, 3px);
  min-width: 0;
}

.sn-selection-label {
  min-width: 0;
}

.sn-selection-hint,
.sn-selection-error {
  display: block;
  font-size: var(--sn-selection-hint-size, var(--sn-field-hint-size, 11px));
  line-height: var(--sn-selection-hint-line-height, var(--sn-field-hint-line-height, 1.35));
}

.sn-selection-hint {
  color: var(--sn-selection-hint-color, var(--sn-field-hint-color, var(--sn-text-dim)));
}

.sn-selection-error {
  color: var(--sn-selection-error-color, var(--sn-status-error, var(--sn-danger-color, var(--sn-sys-danger))));
}

sn-checkbox:not([invalid]) .sn-selection-error,
sn-radio:not([invalid]) .sn-selection-error,
sn-switch:not([invalid]) .sn-selection-error {
  display: none !important;
}

sn-checkbox:hover:not([disabled]):not([readonly]) .sn-selection-visual,
sn-radio:hover:not([disabled]):not([readonly]) .sn-selection-visual,
sn-switch:hover:not([disabled]):not([readonly]) .sn-selection-visual {
  border-color: var(--sn-selection-hover-border, color-mix(in oklch, var(--sn-sys-accent) var(--sn-sys-state-hover-mix), var(--sn-field-control-border, var(--sn-sys-outline))));
}

.sn-selection-input:focus-visible + .sn-selection-visual {
  outline: var(--sn-selection-focus-ring, var(--sn-button-focus-ring, 2px solid var(--sn-focus-ring-color, currentColor)));
  outline-offset: var(--sn-selection-focus-offset, 2px);
}

.sn-selection-input:checked + .sn-selection-visual,
sn-checkbox[indeterminate] .sn-selection-visual {
  border-color: var(--sn-selection-checked-border, var(--sn-node-selected));
  background: var(--sn-selection-checked-bg, var(--sn-node-selected));
}

.sn-selection-input:checked + .sn-selection-visual .sn-selection-mark,
sn-checkbox[indeterminate] .sn-selection-mark {
  opacity: 1;
  transform: scale(1);
}

sn-checkbox .sn-selection-mark {
  inline-size: 8px;
  block-size: 5px;
  border-inline-start: 0;
  border-block-start: 0;
  border-inline-end: 2px solid currentColor;
  border-block-end: 2px solid currentColor;
  transform: translateY(-1px) rotate(45deg) scale(0.82);
}

sn-checkbox .sn-selection-input:checked + .sn-selection-visual .sn-selection-mark {
  transform: translateY(-1px) rotate(45deg) scale(1);
}

sn-checkbox[indeterminate] .sn-selection-mark {
  inline-size: 8px;
  block-size: 2px;
  border: 0;
  border-radius: var(--sn-radius-full);
  background: currentColor;
  transform: scale(1);
}

sn-radio .sn-selection-visual {
  border-radius: var(--sn-radius-full);
}

sn-radio .sn-selection-mark {
  inline-size: var(--sn-selection-radio-dot-size, 6px);
  block-size: var(--sn-selection-radio-dot-size, 6px);
  border-radius: var(--sn-radius-full);
  background: currentColor;
}

sn-switch .sn-selection-control {
  grid-template-columns: auto minmax(0, 1fr);
}

sn-switch .sn-selection-input-wrap {
  inline-size: var(--sn-selection-switch-width, 32px);
  block-size: var(--sn-selection-switch-height, 18px);
  min-inline-size: var(--sn-selection-switch-width, 32px);
}

sn-switch .sn-selection-visual {
  border-radius: var(--sn-radius-full);
  background: var(--sn-selection-switch-bg, var(--sn-field-toggle-bg, color-mix(in oklab, var(--sn-text) 12%, transparent)));
}

sn-switch .sn-selection-mark {
  position: absolute;
  inset-inline-start: var(--sn-selection-switch-padding, 2px);
  inline-size: var(--sn-selection-switch-thumb-size, 14px);
  block-size: var(--sn-selection-switch-thumb-size, 14px);
  border-radius: var(--sn-radius-full);
  background: var(--sn-selection-switch-thumb-bg, var(--sn-field-toggle-thumb-bg, var(--sn-node-bg, #fff)));
  box-shadow: var(--sn-selection-switch-thumb-shadow, 0 1px 2px var(--sn-shadow-color, var(--sn-sys-shadow-raised)));
  opacity: 1;
  transform: translateX(0);
}

sn-switch .sn-selection-input:checked + .sn-selection-visual .sn-selection-mark {
  background: var(--sn-selection-switch-thumb-active-bg, var(--sn-field-toggle-thumb-active-bg, var(--sn-node-bg, #fff)));
  transform: translateX(calc(var(--sn-selection-switch-width, 32px) - var(--sn-selection-switch-thumb-size, 14px) - (var(--sn-selection-switch-padding, 2px) * 2)));
}

sn-checkbox[invalid] .sn-selection-visual,
sn-radio[invalid] .sn-selection-visual,
sn-switch[invalid] .sn-selection-visual {
  border-color: var(--sn-selection-error-border, var(--sn-status-error, var(--sn-danger-color, var(--sn-sys-danger))));
}

sn-checkbox[disabled],
sn-radio[disabled],
sn-switch[disabled] {
  opacity: var(--sn-selection-disabled-opacity, var(--sn-button-disabled-opacity, 0.5));
}

sn-checkbox[disabled] .sn-selection-control,
sn-radio[disabled] .sn-selection-control,
sn-switch[disabled] .sn-selection-control {
  cursor: not-allowed;
}

sn-checkbox[readonly] .sn-selection-control,
sn-radio[readonly] .sn-selection-control,
sn-switch[readonly] .sn-selection-control {
  cursor: default;
}

sn-checkbox[readonly] .sn-selection-visual,
sn-radio[readonly] .sn-selection-visual,
sn-switch[readonly] .sn-selection-visual {
  border-style: dashed;
}

@media (prefers-reduced-motion: reduce) {
  .sn-selection-visual,
  .sn-selection-mark {
    transition: none !important;
  }
}

@media (forced-colors: active) {
  .sn-selection-visual {
    border-color: ButtonText;
    background: Canvas;
    color: ButtonText;
    forced-color-adjust: none;
  }

  .sn-selection-input:checked + .sn-selection-visual,
  sn-checkbox[indeterminate] .sn-selection-visual {
    background: Highlight;
    color: HighlightText;
  }
}
`;
