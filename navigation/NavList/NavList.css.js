export default /*css*/ `
sn-nav-list {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  gap: var(--sn-nav-list-gap, 2px);
  padding: var(--sn-nav-list-padding, 4px 0);
}

sn-nav-list[hidden] {
  display: none !important;
}

sn-nav-item {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  padding: var(--sn-nav-item-padding, 6px 12px);
  font-family: var(--sn-font, sans-serif);
  font-size: var(--sn-nav-item-font-size, 12px);
  color: var(--sn-nav-item-color, var(--sn-text-dim, rgba(255, 255, 255, 0.7)));
  cursor: pointer;
  user-select: none;
  gap: var(--sn-nav-item-gap, 8px);
  border-radius: var(--sn-nav-item-radius, 4px);
  text-decoration: none;
  transition: background var(--sn-transition-fast, 120ms), color var(--sn-transition-fast, 120ms);
  outline: none;
}

sn-nav-item:hover,
sn-nav-item:focus-visible {
  background: var(--sn-nav-item-hover-bg, var(--sn-node-hover, rgba(255, 255, 255, 0.05)));
  color: var(--sn-nav-item-hover-color, var(--sn-text, #ffffff));
}

sn-nav-item:focus-visible {
  outline: 2px solid var(--sn-focus-ring-color, currentColor);
  outline-offset: -2px;
}

sn-nav-item[active] {
  background: var(--sn-nav-item-active-bg, var(--sn-node-selected, rgba(255, 255, 255, 0.15)));
  color: var(--sn-nav-item-active-color, var(--sn-text, #ffffff));
  font-weight: 500;
}

sn-nav-item[disabled] {
  cursor: not-allowed;
  opacity: var(--sn-nav-item-disabled-opacity, 0.45);
  pointer-events: none;
}

.sn-nav-item-icon {
  font-size: var(--sn-nav-item-icon-size, 16px);
}

.sn-nav-item-label {
  flex: 1;
}

.sn-nav-item-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: var(--sn-nav-item-badge-bg, var(--sn-outline-color, rgba(255, 255, 255, 0.12)));
  color: var(--sn-nav-item-badge-color, var(--sn-text, #ffffff));
  font-size: 9px;
  font-weight: 600;
}
`;
