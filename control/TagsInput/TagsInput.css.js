export default /*css*/ `
sn-tags-input {
  display: block;
  font-family: var(--sn-font, sans-serif);
  width: 100%;
}

.sn-tags-container {
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: calc(36px * var(--sn-theme-density, 1));
  padding: 4px calc(12px * var(--sn-theme-density, 1));
  background: var(--sn-field-control-bg, var(--sn-bg, #0c0c0e));
  border: 1px solid var(--sn-field-control-border, var(--sn-outline-color-soft, rgba(255,255,255,0.08)));
  border-radius: var(--sn-field-control-radius, var(--sn-panel-radius, 6px));
  transition: border-color var(--sn-transition-fast, 120ms);
}

.sn-tags-container:focus-within {
  border-color: var(--sn-field-control-focus-border, var(--sn-node-selected, #2e90fa));
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--sn-node-selected, #2e90fa) 25%, transparent);
}

.sn-tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sn-space-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.sn-tags-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--sn-space-xs);
  padding: 2px 8px;
  background-color: var(--sn-panel-bg, #1e1e24);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  border-radius: var(--sn-radius-sm);
  font-size: calc(12px * var(--sn-theme-type-scale, 1));
  color: var(--sn-text);
  user-select: none;
}

.sn-tags-chip-remove {
  background: none;
  border: none;
  color: var(--sn-text-dim, rgba(255,255,255,0.5));
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
}

.sn-tags-chip-remove:hover {
  color: var(--sn-status-error, #ff4d4f);
}

.sn-tags-chip-remove-icon {
  font-size: var(--sn-text-lg);
}

.sn-tags-input-field {
  flex: 1;
  min-width: 60px;
  background: transparent;
  border: none;
  outline: none;
  color: var(--sn-text);
  font-size: calc(13px * var(--sn-theme-type-scale, 1));
  padding: var(--sn-space-xs) 0;
}

sn-tags-input[disabled] .sn-tags-container {
  cursor: not-allowed;
  opacity: 0.6;
}
`;
