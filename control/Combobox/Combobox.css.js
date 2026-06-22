export default /*css*/ `
sn-combobox {
  display: block;
}

.sn-combobox-wrapper {
  position: relative;
  width: 100%;
}

.sn-combobox-input-container {
  display: flex;
  align-items: center;
  background-color: var(--sn-field-bg, #1a1a1f);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  border-radius: var(--sn-panel-radius, 8px);
  overflow: hidden;
  box-sizing: border-box;
  transition: border-color var(--sn-transition-fast, 120ms) ease;
}

.sn-combobox-input-container:focus-within {
  border-color: var(--sn-primary, #3b82f6);
}

.sn-combobox-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--sn-text, #ffffff);
  padding: calc(8px * var(--sn-theme-density, 1)) calc(12px * var(--sn-theme-density, 1));
  font-family: var(--sn-font, sans-serif);
  font-size: calc(13px * var(--sn-theme-type-scale, 1));
  outline: none;
}

.sn-combobox-trigger {
  background: transparent;
  border: none;
  color: var(--sn-text-dim, rgba(255,255,255,0.6));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--sn-space-sm);
  transition: color var(--sn-transition-fast, 120ms);
}

.sn-combobox-trigger:hover {
  color: var(--sn-text, #ffffff);
}

.sn-combobox-dropdown {
  display: none;
  position: fixed;
  z-index: var(--sn-overlay-z-base, 20000);
  background-color: var(--sn-panel-bg, #1e1e24);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  border-radius: var(--sn-panel-radius, 8px);
  box-shadow: var(--sn-panel-shadow, 0 8px 24px rgba(0, 0, 0, 0.3));
  max-height: 240px;
  overflow-y: auto;
  box-sizing: border-box;
  padding: var(--sn-space-xs);
}

.sn-combobox-dropdown[data-visible] {
  display: block;
}

.sn-combobox-options {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sn-combobox-option {
  padding: calc(8px * var(--sn-theme-density, 1)) calc(12px * var(--sn-theme-density, 1));
  font-family: var(--sn-font, sans-serif);
  font-size: calc(13px * var(--sn-theme-type-scale, 1));
  color: var(--sn-text, #ffffff);
  border-radius: calc(var(--sn-panel-radius, 8px) - 4px);
  cursor: pointer;
  user-select: none;
  transition: background-color var(--sn-transition-fast, 120ms), color var(--sn-transition-fast, 120ms);
  margin-bottom: 2px;
}

.sn-combobox-option:hover {
  background-color: var(--sn-node-hover, rgba(255,255,255,0.05));
}

.sn-combobox-option[data-focused] {
  background-color: rgba(59, 130, 246, 0.15);
}

.sn-combobox-option[aria-selected="true"] {
  background-color: var(--sn-primary, #3b82f6);
  color: #ffffff;
}

.sn-combobox-empty {
  display: none;
  padding: calc(12px * var(--sn-theme-density, 1));
  text-align: center;
  color: var(--sn-text-dim, rgba(255,255,255,0.6));
  font-family: var(--sn-font, sans-serif);
  font-size: calc(13px * var(--sn-theme-type-scale, 1));
}

.sn-combobox-empty[data-visible] {
  display: block;
}
`;
