export default /*css*/ `
sn-select {
  display: block;
  font-family: var(--sn-font, sans-serif);
  position: relative;
  width: 100%;
  box-sizing: border-box;
}

.sn-select-container {
  position: relative;
  width: 100%;
}

.sn-select-trigger {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: calc(36px * var(--sn-theme-density, 1));
  padding: 0 calc(12px * var(--sn-theme-density, 1));
  background: var(--sn-field-control-bg, var(--sn-bg, #0c0c0e));
  border: 1px solid var(--sn-field-control-border, var(--sn-outline-color-soft, rgba(255,255,255,0.08)));
  border-radius: var(--sn-field-control-radius, var(--sn-panel-radius, 6px));
  color: var(--sn-text);
  font-size: calc(13px * var(--sn-theme-type-scale, 1));
  cursor: pointer;
  text-align: left;
  transition: border-color var(--sn-transition-fast, 120ms), box-shadow var(--sn-transition-fast, 120ms);
}

.sn-select-trigger:focus-visible {
  outline: none;
  border-color: var(--sn-field-control-focus-border, var(--sn-node-selected, #2e90fa));
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--sn-node-selected, #2e90fa) 25%, transparent);
}

.sn-select-arrow {
  color: var(--sn-text-dim, rgba(255,255,255,0.6));
  transition: transform var(--sn-transition-fast, 120ms) ease;
}

.sn-select-trigger[aria-expanded="true"] .sn-select-arrow {
  transform: rotate(180deg);
}

.sn-select-dropdown {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  z-index: 1000;
  margin-top: var(--sn-space-xs);
  background-color: var(--sn-panel-bg, #1e1e24);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  border-radius: var(--sn-panel-radius, 6px);
  box-shadow: var(--sn-panel-shadow, 0 10px 25px rgba(0,0,0,0.35));
  overflow-y: auto;
  max-height: 240px;
  box-sizing: border-box;
}

.sn-select-dropdown[data-visible] {
  display: block;
  animation: snSelectFadeIn var(--sn-transition-fast, 120ms) ease;
}

.sn-select-options-list {
  list-style: none;
  margin: 0;
  padding: var(--sn-space-xs);
}

.sn-select-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(8px * var(--sn-theme-density, 1)) calc(12px * var(--sn-theme-density, 1));
  font-size: calc(13px * var(--sn-theme-type-scale, 1));
  color: var(--sn-text);
  border-radius: calc(var(--sn-panel-radius, 6px) - 2px);
  cursor: pointer;
  user-select: none;
  transition: background-color var(--sn-transition-fast, 120ms), color var(--sn-transition-fast, 120ms);
}

.sn-select-option:hover,
.sn-select-option[data-focused] {
  background-color: var(--sn-node-hover, rgba(255,255,255,0.05));
  color: var(--sn-text);
}

.sn-select-option[data-selected] {
  background-color: color-mix(in oklab, var(--sn-node-selected, #2e90fa) 15%, transparent);
  color: var(--sn-node-selected, #2e90fa);
  font-weight: 500;
}

sn-select[disabled] .sn-select-trigger {
  cursor: not-allowed;
  opacity: 0.6;
  background: var(--sn-field-control-disabled-bg, color-mix(in oklab, var(--sn-text) 5%, transparent));
}

sn-select[invalid] .sn-select-trigger {
  border-color: var(--sn-status-error, #ff4d4f);
}

@keyframes snSelectFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`;
