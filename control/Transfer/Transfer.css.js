export default /*css*/ `
sn-transfer {
  display: block;
  font-family: var(--sn-font, sans-serif);
  width: 100%;
}

.sn-transfer-container {
  display: flex;
  align-items: center;
  gap: var(--sn-step-8);
  width: 100%;
}

.sn-transfer-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--sn-field-control-bg, var(--sn-bg, #0c0c0e));
  border: 1px solid var(--sn-field-control-border, var(--sn-outline-color-soft, rgba(255,255,255,0.08)));
  border-radius: var(--sn-panel-radius, 6px);
  min-height: 200px;
  max-height: 300px;
  box-sizing: border-box;
  overflow: hidden;
}

.sn-transfer-panel-header {
  padding: var(--sn-step-4) var(--sn-step-6);
  background: var(--sn-panel-bg, #1e1e24);
  border-bottom: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  font-size: var(--sn-text-sm);
  color: var(--sn-text);
  font-weight: 500;
}

.sn-transfer-list {
  list-style: none;
  margin: 0;
  padding: var(--sn-step-2);
  overflow-y: auto;
  flex: 1;
}

.sn-transfer-item {
  display: flex;
  align-items: center;
  gap: var(--sn-step-4);
  padding: calc(6px * var(--sn-theme-density, 1)) calc(8px * var(--sn-theme-density, 1));
  font-size: calc(12px * var(--sn-theme-type-scale, 1));
  color: var(--sn-text);
  border-radius: var(--sn-radius-sm);
  cursor: pointer;
  user-select: none;
}

.sn-transfer-item:hover {
  background-color: var(--sn-node-hover, rgba(255,255,255,0.04));
}

.sn-transfer-item:focus-visible {
  outline: var(--sn-focus-outline, 2px solid var(--sn-focus-ring-color, currentColor));
  outline-offset: var(--sn-focus-outline-offset, -1px);
}

.sn-transfer-item[data-selected] {
  background-color: color-mix(in oklab, var(--sn-node-selected, #2e90fa) 10%, transparent);
}

.sn-transfer-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--sn-step-4);
}

.sn-transfer-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--sn-panel-bg, #1e1e24);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  border-radius: var(--sn-radius-md);
  color: var(--sn-text);
  cursor: pointer;
}

.sn-transfer-btn:hover:not([disabled]) {
  background: var(--sn-node-hover, rgba(255,255,255,0.05));
  border-color: var(--sn-node-selected, #2e90fa);
}

.sn-transfer-btn:focus-visible {
  outline: var(--sn-focus-outline, 2px solid var(--sn-focus-ring-color, currentColor));
  outline-offset: var(--sn-focus-outline-offset, 2px);
}

.sn-transfer-btn[disabled] {
  opacity: 0.4;
  cursor: not-allowed;
}

sn-transfer[disabled] .sn-transfer-panel {
  opacity: 0.6;
  cursor: not-allowed;
}
`;
