export default /*css*/ `
sn-rich-text-editor {
  display: block;
  font-family: var(--sn-font, sans-serif);
  width: 100%;
  box-sizing: border-box;
}

.sn-editor-container {
  display: flex;
  flex-direction: column;
  background: var(--sn-field-control-bg, var(--sn-bg, #0c0c0e));
  border: 1px solid var(--sn-field-control-border, var(--sn-outline-color-soft, rgba(255,255,255,0.08)));
  border-radius: var(--sn-panel-radius, 6px);
  overflow: hidden;
  width: 100%;
}

.sn-editor-toolbar {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sn-step-2);
  padding: var(--sn-step-3);
  background-color: var(--sn-panel-bg, #1e1e24);
  border-bottom: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
}

.sn-editor-btn {
  background: none;
  border: none;
  color: var(--sn-text-dim, rgba(255,255,255,0.6));
  cursor: pointer;
  padding: var(--sn-step-2);
  border-radius: var(--sn-radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sn-editor-btn:hover {
  color: var(--sn-text);
  background-color: var(--sn-node-hover, rgba(255,255,255,0.05));
}

.sn-editor-btn[data-active] {
  color: var(--sn-node-selected, #2e90fa);
  background-color: color-mix(in oklab, var(--sn-node-selected, #2e90fa) 10%, transparent);
}

.sn-editor-icon {
  font-size: var(--sn-text-2xl);
}

.sn-editor-link-overlay {
  display: flex;
  align-items: center;
  gap: var(--sn-step-3);
  position: absolute;
  right: var(--sn-step-3);
  top: 50%;
  transform: translateY(-50%);
  background-color: var(--sn-panel-bg, #1e1e24);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  border-radius: var(--sn-radius-sm);
  padding: var(--sn-step-2) var(--sn-step-3);
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.sn-editor-link-overlay[hidden] {
  display: none;
}

.sn-editor-link-input {
  background: var(--sn-field-control-bg, var(--sn-bg, #0c0c0e));
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  border-radius: var(--sn-radius-sm);
  color: var(--sn-text);
  padding: var(--sn-step-2) var(--sn-step-4);
  font-size: var(--sn-text-sm);
  outline: none;
}

.sn-editor-link-input:focus {
  border-color: var(--sn-node-selected, #2e90fa);
}

.sn-editor-link-btn {
  background: var(--sn-node-hover, rgba(255,255,255,0.05));
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  color: var(--sn-text);
  border-radius: var(--sn-radius-sm);
  padding: var(--sn-step-2) var(--sn-step-4);
  font-size: var(--sn-text-sm);
  cursor: pointer;
}

.sn-editor-link-btn:hover {
  background: var(--sn-node-hover, rgba(255,255,255,0.1));
}

.sn-editor-link-btn.confirm {
  background: var(--sn-node-selected, #2e90fa);
  color: #fff;
  border: none;
}

.sn-editor-link-btn.confirm:hover {
  background: color-mix(in oklab, var(--sn-node-selected, #2e90fa) 90%, #fff);
}

.sn-editor-body {
  min-height: 120px;
  max-height: 300px;
  overflow-y: auto;
  padding: var(--sn-step-6);
  color: var(--sn-text);
  font-size: calc(13px * var(--sn-theme-type-scale, 1));
  outline: none;
  box-sizing: border-box;
  background-color: transparent;
}

sn-rich-text-editor[disabled] .sn-editor-container {
  cursor: not-allowed;
  opacity: 0.6;
}
`;
