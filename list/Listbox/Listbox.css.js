export default /*css*/ `
sn-listbox {
  display: block;
}

.sn-listbox {
  outline: none;
  background-color: var(--sn-listbox-bg, var(--sn-panel-bg, #1e1e24));
  border: 1px solid var(--sn-listbox-border, var(--sn-outline-color-soft, rgba(255,255,255,0.08)));
  border-radius: var(--sn-listbox-radius, var(--sn-panel-radius, 8px));
  padding: var(--sn-space-xs);
  max-height: var(--sn-listbox-max-height, 280px);
  overflow-y: auto;
  box-sizing: border-box;
  box-shadow: var(--sn-listbox-shadow, 0 4px 16px rgba(0,0,0,0.2));
  transition: border-color var(--sn-transition-fast, 120ms) ease;
}

.sn-listbox:focus-within {
  border-color: var(--sn-listbox-border-focus, var(--sn-outline-color-hover, #3b82f6));
}

.sn-listbox [role="option"] {
  display: flex;
  align-items: center;
  padding: calc(8px * var(--sn-theme-density, 1)) calc(12px * var(--sn-theme-density, 1));
  font-family: var(--sn-font, sans-serif);
  font-size: calc(13px * var(--sn-theme-type-scale, 1));
  color: var(--sn-listbox-text, var(--sn-text, #ffffff));
  border-radius: calc(var(--sn-panel-radius, 8px) - 4px);
  cursor: pointer;
  user-select: none;
  transition: background-color var(--sn-transition-fast, 120ms) ease, color var(--sn-transition-fast, 120ms) ease;
  margin-bottom: 2px;
}

.sn-listbox [role="option"]:last-child {
  margin-bottom: 0;
}

.sn-listbox [role="option"]:hover:not([disabled]):not([aria-disabled="true"]) {
  background-color: var(--sn-listbox-hover-bg, var(--sn-node-hover, rgba(255,255,255,0.05)));
  color: var(--sn-listbox-hover-text, var(--sn-text, #ffffff));
}

.sn-listbox [role="option"][data-focused] {
  background-color: var(--sn-listbox-focus-bg, rgba(59, 130, 246, 0.15));
  color: var(--sn-listbox-focus-text, var(--sn-text, #ffffff));
}

.sn-listbox [role="option"][aria-selected="true"] {
  background-color: var(--sn-listbox-selected-bg, var(--sn-primary, #3b82f6));
  color: var(--sn-listbox-selected-text, #ffffff);
  font-weight: 500;
}

.sn-listbox [role="option"][disabled],
.sn-listbox [role="option"][aria-disabled="true"] {
  opacity: 0.4;
  cursor: not-allowed;
}
`;
