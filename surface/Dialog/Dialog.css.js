export default /*css*/ `
sn-dialog {
  display: contents;
}

.sn-dialog {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--sn-text);
  max-width: min(calc(100% - 32px), var(--sn-dialog-max-width, 560px));
  max-height: min(calc(100% - 32px), var(--sn-dialog-max-height, 80vh));
  border-radius: var(--sn-panel-radius, 8px);
  box-shadow: var(--sn-panel-shadow, 0 12px 32px rgba(0,0,0,0.4));
  overflow: hidden;
  box-sizing: border-box;
}

.sn-dialog::backdrop {
  background-color: var(--sn-dialog-backdrop-bg, rgba(0, 0, 0, 0.45));
  backdrop-filter: blur(4px);
  transition: backdrop-filter var(--sn-transition-normal, 240ms) ease;
}

.sn-dialog-panel {
  display: flex;
  flex-direction: column;
  background-color: var(--sn-panel-bg, #1e1e24);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  border-radius: var(--sn-panel-radius, 8px);
  overflow: hidden;
}

.sn-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(16px * var(--sn-theme-density, 1)) calc(20px * var(--sn-theme-density, 1));
  border-bottom: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
}

.sn-dialog-title {
  margin: 0;
  font-family: var(--sn-font, sans-serif);
  font-size: calc(18px * var(--sn-theme-type-scale, 1) * var(--sn-theme-heading-scale, 1));
  font-weight: 600;
  color: var(--sn-text);
}

.sn-dialog-close-btn {
  background: transparent;
  border: none;
  color: var(--sn-text-dim, rgba(255,255,255,0.6));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--sn-space-xs);
  border-radius: var(--sn-radius-sm);
  transition: background-color var(--sn-transition-fast, 120ms), color var(--sn-transition-fast, 120ms);
}

.sn-dialog-close-btn:hover {
  background-color: var(--sn-node-hover, rgba(255,255,255,0.05));
  color: var(--sn-text);
}

.sn-dialog-body {
  padding: calc(20px * var(--sn-theme-density, 1));
  overflow-y: auto;
  font-family: var(--sn-font, sans-serif);
  font-size: calc(13px * var(--sn-theme-type-scale, 1));
  line-height: 1.5;
}

.sn-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sn-space-md);
  padding: calc(16px * var(--sn-theme-density, 1)) calc(20px * var(--sn-theme-density, 1));
  border-top: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  background-color: color-mix(in oklab, var(--sn-panel-bg) 95%, var(--sn-text) 5%);
}
`;
