export default /*css*/ `
sn-pin-input {
  display: block;
  font-family: var(--sn-font, sans-serif);
  width: 100%;
}

.sn-pin-container {
  display: flex;
  align-items: center;
  gap: var(--sn-step-4);
}

.sn-pin-cells {
  display: flex;
  gap: var(--sn-step-4);
}

.sn-pin-cell {
  box-sizing: border-box;
  width: calc(40px * var(--sn-theme-density, 1));
  height: calc(40px * var(--sn-theme-density, 1));
  text-align: center;
  background: var(--sn-field-control-bg, var(--sn-bg, #0c0c0e));
  border: 1px solid var(--sn-field-control-border, var(--sn-outline-color-soft, rgba(255,255,255,0.08)));
  border-radius: var(--sn-field-control-radius, var(--sn-panel-radius, 6px));
  color: var(--sn-text);
  font-size: calc(16px * var(--sn-theme-type-scale, 1));
  font-weight: 600;
  outline: none;
  transition: border-color var(--sn-transition-fast, 120ms);
}

.sn-pin-cell:focus {
  border-color: var(--sn-field-control-focus-border, var(--sn-node-selected, #2e90fa));
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--sn-node-selected, #2e90fa) 25%, transparent);
}

.sn-pin-mask-toggle {
  background: none;
  border: none;
  color: var(--sn-text-dim, rgba(255,255,255,0.6));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  padding: var(--sn-step-2);
}

.sn-pin-mask-toggle:hover {
  color: var(--sn-text);
}

sn-pin-input[disabled] .sn-pin-cell {
  cursor: not-allowed;
  opacity: 0.6;
}
`;
