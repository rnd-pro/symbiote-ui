export default /*css*/ `
:host,
layout-shell-menu {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background:
    linear-gradient(to bottom, var(--sn-node-bg, #202020), transparent var(--sn-shell-menu-top-fade, 78px)),
    var(--sn-bg, #1a1a1a);
  color: var(--sn-text);
  font-family: var(--sn-font, Inter, system-ui, sans-serif);
}

.app-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: var(--sn-shell-menu-z, 10);
  flex: 0 0 auto;
  height: var(--sn-app-topbar-height, 40px);
  min-width: 0;
  padding: var(--sn-app-topbar-padding, 0 16px);
  background: transparent;
}

.topbar-left,
.topbar-center,
.topbar-right {
  display: flex;
  align-items: center;
  min-width: 0;
}

.topbar-left {
  flex: 0 0 auto;
  gap: var(--sn-app-title-gap, 8px);
}

.topbar-center {
  position: absolute;
  left: 50%;
  max-width: min(50vw, var(--sn-shell-menu-center-max, 640px));
  gap: var(--sn-shell-menu-center-gap, 6px);
  color: var(--sn-text-dim);
  font-size: var(--sn-app-topbar-meta-size, 11px);
  line-height: 1;
  transform: translateX(-50%);
  white-space: nowrap;
}

.topbar-right {
  justify-content: flex-end;
  flex: 0 1 auto;
  gap: var(--sn-shell-menu-action-gap, 8px);
}

.app-title-icon {
  flex: 0 0 auto;
  color: var(--sn-node-selected);
  font-size: var(--sn-app-title-icon-size, 16px);
}

.app-title {
  overflow: hidden;
  color: var(--sn-text);
  font-size: var(--sn-app-title-size, 13px);
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-project-icon {
  flex: 0 0 auto;
  color: var(--sn-text-dim);
  font-size: var(--sn-shell-menu-path-icon-size, 12px);
}

.topbar-project-path {
  overflow: hidden;
  text-overflow: ellipsis;
}

.shell-menu-toggle,
.topbar-right button,
.shell-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sn-shell-menu-action-inner-gap, 5px);
  min-height: var(--sn-shell-menu-action-height, 26px);
  padding: var(--sn-shell-menu-action-padding, 4px 10px);
  border: 1px solid transparent;
  border-radius: var(--sn-layout-header-button-radius, 4px);
  background: transparent;
  color: var(--sn-text-dim);
  font: inherit;
  font-size: var(--sn-shell-menu-action-size, 11px);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.shell-menu-toggle {
  box-sizing: border-box;
  flex: 0 0 auto;
  width: var(--sn-shell-menu-toggle-size, calc(var(--sn-app-topbar-height, 40px) - 12px));
  min-width: var(--sn-shell-menu-toggle-size, calc(var(--sn-app-topbar-height, 40px) - 12px));
  min-height: var(--sn-shell-menu-toggle-size, calc(var(--sn-app-topbar-height, 40px) - 12px));
  padding: 0;
}

.shell-menu-toggle .material-symbols-outlined {
  font-size: var(--sn-shell-menu-toggle-icon-size, 18px);
}

.shell-menu-toggle[active] {
  border-color: color-mix(in srgb, var(--sn-node-selected) 48%, var(--sn-node-border));
  background: color-mix(in srgb, var(--sn-node-selected) 16%, transparent);
  color: var(--sn-text);
}

.shell-menu-toggle:hover,
.topbar-right button:hover,
.topbar-right button[active],
.shell-action:hover,
.shell-action[active] {
  border-color: var(--sn-node-border);
  background: var(--sn-node-hover);
  color: var(--sn-text);
}

.topbar-right button .material-symbols-outlined,
.shell-action .material-symbols-outlined {
  font-size: var(--sn-shell-menu-action-icon-size, 16px);
}

.shell-menu-drawer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  flex: 0 0 auto;
  min-width: 0;
  max-height: var(--sn-shell-menu-drawer-max-block-size, calc(var(--sn-app-topbar-height, 40px) * 4));
  border-top: var(--sn-shell-menu-drawer-border-width, 1px) solid var(--sn-node-border);
  border-bottom: var(--sn-shell-menu-drawer-border-width, 1px) solid var(--sn-node-border);
  background:
    linear-gradient(to bottom, color-mix(in srgb, var(--sn-node-bg) 86%, transparent), transparent),
    var(--sn-tabs-bg, var(--sn-node-bg));
  overflow: auto hidden;
  scrollbar-color: var(--sn-scrollbar-thumb, currentColor) var(--sn-scrollbar-track, transparent);
  scrollbar-width: thin;
}

.shell-menu-drawer[hidden] {
  display: none;
}

.shell-menu-tabs {
  min-width: 0;
  overflow: hidden;
}

.shell-tabs {
  flex: 0 0 auto;
  min-width: 0;
}

.shell-menu-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sn-shell-menu-action-gap, 8px);
  min-width: 0;
  padding: var(--sn-shell-menu-actions-padding, 0 12px);
  overflow: auto hidden;
  scrollbar-color: var(--sn-scrollbar-thumb, currentColor) var(--sn-scrollbar-track, transparent);
  scrollbar-width: thin;
}

.app-workspace {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.app-workspace > * {
  min-width: 0;
  min-height: 0;
}

@media (max-width: 860px) {
  .app-topbar {
    align-items: stretch;
    flex-direction: column;
    height: auto;
    min-height: var(--sn-app-topbar-height, 40px);
    padding: var(--sn-app-topbar-mobile-padding, 8px 10px);
  }

  .topbar-center {
    position: static;
    order: 3;
    max-width: 100%;
    transform: none;
  }

  .topbar-right {
    justify-content: flex-start;
  }

  .shell-menu-drawer {
    grid-template-columns: minmax(0, 1fr);
    max-height: var(--sn-shell-menu-drawer-mobile-max-block-size, calc(var(--sn-app-topbar-height, 40px) * 5));
  }

  .shell-menu-actions {
    justify-content: flex-start;
    min-height: var(--sn-app-topbar-height, 40px);
  }
}
`;
