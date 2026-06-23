export default /*css*/ `
sn-floating-panel {
  display: block;
  position: fixed;
  font-family: var(--sn-font, sans-serif);
  z-index: 900;
  box-sizing: border-box;
}

.sn-floating-container {
  display: flex;
  flex-direction: column;
  background-color: var(--sn-panel-bg, #1e1e24);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  border-radius: var(--sn-panel-radius, 6px);
  box-shadow: var(--sn-panel-shadow, 0 10px 25px rgba(0,0,0,0.35));
  width: 100%;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.sn-floating-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sn-step-4) var(--sn-step-6);
  background-color: var(--sn-panel-bg, #1e1e24);
  border-bottom: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  cursor: move;
  user-select: none;
}

.sn-floating-title {
  font-size: calc(13px * var(--sn-theme-type-scale, 1));
  font-weight: 500;
  color: var(--sn-text);
}

.sn-floating-actions {
  display: flex;
  align-items: center;
  gap: var(--sn-step-3);
}

.sn-floating-action-btn {
  background: none;
  border: none;
  color: var(--sn-text-dim, rgba(255,255,255,0.6));
  cursor: pointer;
  padding: var(--sn-step-1);
  border-radius: var(--sn-radius-sm);
  display: inline-flex;
  align-items: center;
}

.sn-floating-action-btn:hover {
  color: var(--sn-text);
  background-color: var(--sn-node-hover, rgba(255,255,255,0.05));
}

.sn-floating-action-icon {
  font-size: var(--sn-text-xl);
}

.sn-floating-action-btn[data-action="close"]:hover {
  color: var(--sn-status-error, #ff4d4f);
}

.sn-floating-body {
  flex: 1;
  overflow: auto;
  padding: var(--sn-step-6);
  box-sizing: border-box;
}

sn-floating-panel[minimized] {
  height: auto !important;
}

sn-floating-panel[minimized] .sn-floating-body {
  display: none;
}

sn-floating-panel[maximized] {
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
}
`;
