export default /*css*/ `
sn-status-light {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  gap: var(--sn-status-light-gap, 6px);
  font-family: var(--sn-font, sans-serif);
  font-size: var(--sn-status-light-font-size, 12px);
  color: var(--sn-status-light-color, var(--sn-text, #ffffff));
}

sn-status-light[hidden] {
  display: none !important;
}

.sn-status-light-dot {
  width: var(--sn-status-light-size, 8px);
  height: var(--sn-status-light-size, 8px);
  border-radius: 50%;
  background: var(--sn-status-light-bg, var(--sn-text-dim-extra, rgba(255, 255, 255, 0.4)));
  transition: background var(--sn-transition-normal, 240ms);
  flex-shrink: 0;
}

sn-status-light[variant="success"] .sn-status-light-dot {
  background: var(--sn-status-light-success, var(--sn-success-color, #4caf50));
  box-shadow: 0 0 4px var(--sn-status-light-success, var(--sn-success-color, #4caf50));
}

sn-status-light[variant="warning"] .sn-status-light-dot {
  background: var(--sn-status-light-warning, var(--sn-warning-color, #ff9800));
  box-shadow: 0 0 4px var(--sn-status-light-warning, var(--sn-warning-color, #ff9800));
}

sn-status-light[variant="error"] .sn-status-light-dot {
  background: var(--sn-status-light-error, var(--sn-danger-color, #f44336));
  box-shadow: 0 0 4px var(--sn-status-light-error, var(--sn-danger-color, #f44336));
}

sn-status-light[variant="info"] .sn-status-light-dot {
  background: var(--sn-status-light-info, var(--sn-node-selected, #2196f3));
  box-shadow: 0 0 4px var(--sn-status-light-info, var(--sn-node-selected, #2196f3));
}

sn-status-light[variant="neutral"] .sn-status-light-dot {
  background: var(--sn-status-light-neutral, var(--sn-text-dim-extra, rgba(255, 255, 255, 0.4)));
  box-shadow: none;
}
`;
