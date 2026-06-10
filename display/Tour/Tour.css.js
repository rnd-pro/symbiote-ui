export default /*css*/ `
sn-tour {
  display: block;
  position: fixed;
  z-index: 1500;
  font-family: var(--sn-font, sans-serif);
  box-sizing: border-box;
}

.sn-tour-popover {
  display: none;
  background-color: var(--sn-panel-bg, #1e1e24);
  border: 1px solid var(--sn-node-selected, #2e90fa);
  border-radius: var(--sn-panel-radius, 6px);
  box-shadow: var(--sn-panel-shadow, 0 10px 25px rgba(0,0,0,0.35));
  padding: 12px;
  width: 240px;
  box-sizing: border-box;
  flex-direction: column;
  gap: 8px;
}

.sn-tour-popover[data-visible] {
  display: flex;
}

.sn-tour-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sn-tour-title {
  font-size: calc(13px * var(--sn-theme-type-scale, 1));
  font-weight: 600;
  color: var(--sn-text);
}

.sn-tour-close-btn {
  background: none;
  border: none;
  color: var(--sn-text-dim, rgba(255,255,255,0.6));
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
}

.sn-tour-icon {
  font-size: 16px;
}

.sn-tour-body {
  font-size: calc(12px * var(--sn-theme-type-scale, 1));
  color: var(--sn-text-dim, rgba(255,255,255,0.8));
  line-height: 1.4;
}

.sn-tour-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.sn-tour-progress {
  font-size: 11px;
  color: var(--sn-text-dim, rgba(255,255,255,0.5));
}

.sn-tour-buttons {
  display: flex;
  gap: 6px;
}

.sn-tour-btn {
  background: var(--sn-panel-bg, #1e1e24);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  color: var(--sn-text);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.sn-tour-btn:hover {
  background: var(--sn-node-hover, rgba(255,255,255,0.05));
}

.sn-tour-btn[data-primary] {
  background: var(--sn-node-selected, #2e90fa);
  border-color: var(--sn-node-selected, #2e90fa);
  color: #fff;
}
`;
