export default /*css*/ `
sn-menu {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: var(--sn-menu-bg, var(--sn-panel-bg, #1e1e24));
  border: 1px solid var(--sn-menu-border, var(--sn-outline-color-soft, rgba(255, 255, 255, 0.08)));
  border-radius: var(--sn-menu-radius, 4px);
  padding: var(--sn-menu-padding, 4px 0);
  box-shadow: var(--sn-menu-shadow, var(--sn-panel-shadow, 0 4px 12px rgba(0, 0, 0, 0.25)));
  min-width: var(--sn-menu-min-width, 160px);
}

sn-menu[hidden] {
  display: none !important;
}

sn-menu-item {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  padding: var(--sn-menu-item-padding, 6px 12px);
  font-family: var(--sn-font, sans-serif);
  font-size: var(--sn-menu-item-font-size, 12px);
  color: var(--sn-menu-item-color, var(--sn-text-dim, rgba(255, 255, 255, 0.7)));
  cursor: pointer;
  user-select: none;
  gap: var(--sn-menu-item-gap, 8px);
  outline: none;
  position: relative;
}

sn-menu-item[disabled] {
  cursor: not-allowed;
  opacity: var(--sn-menu-item-disabled-opacity, 0.45);
}

sn-menu-item:focus,
sn-menu-item:hover:not([disabled]) {
  background: var(--sn-menu-item-hover-bg, var(--sn-node-hover, rgba(255, 255, 255, 0.05)));
  color: var(--sn-menu-item-hover-color, var(--sn-text, #ffffff));
}

sn-menu-item[checked] {
  color: var(--sn-menu-item-checked-color, var(--sn-text, #ffffff));
}

.sn-menu-item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--sn-menu-item-icon-size, 16px);
  width: 1.25em;
  height: 1.25em;
}

.sn-menu-item-label {
  flex: 1;
}

.sn-menu-item-shortcut {
  font-size: calc(var(--sn-menu-item-font-size, 12px) - 2px);
  color: var(--sn-menu-item-shortcut-color, var(--sn-text-dim-extra, rgba(255, 255, 255, 0.4)));
  margin-left: auto;
  padding-left: 12px;
}

sn-menu-separator {
  display: block;
  height: 1px;
  background: var(--sn-menu-separator-color, var(--sn-outline-color-soft, rgba(255, 255, 255, 0.08)));
  margin: var(--sn-menu-separator-margin, 4px 0);
}

sn-menu-group {
  display: flex;
  flex-direction: column;
}

.sn-menu-group-label {
  font-family: var(--sn-font, sans-serif);
  font-size: var(--sn-menu-group-label-size, 10px);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--sn-menu-group-label-color, var(--sn-text-dim-extra, rgba(255, 255, 255, 0.4)));
  padding: var(--sn-menu-group-label-padding, 6px 12px 2px 12px);
  font-weight: 600;
}

sn-dropdown {
  display: inline-block;
  position: relative;
}

sn-dropdown[hidden] {
  display: none !important;
}
`;
