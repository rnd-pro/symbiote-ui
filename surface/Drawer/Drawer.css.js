export default /*css*/ `
sn-drawer {
  display: contents;
}

.sn-drawer-backdrop {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: var(--sn-drawer-backdrop-bg, rgba(0, 0, 0, 0.45));
  backdrop-filter: blur(4px);
  z-index: var(--sn-overlay-z-base, 20000);
  opacity: 0;
  transition: opacity var(--sn-transition-normal, 240ms) ease;
}

.sn-drawer-backdrop[data-visible] {
  display: block;
  opacity: 1;
}

.sn-drawer-panel {
  display: flex;
  flex-direction: column;
  position: fixed;
  background-color: var(--sn-drawer-bg, var(--sn-panel-bg, #1e1e24));
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  box-shadow: var(--sn-panel-shadow, 0 12px 32px rgba(0,0,0,0.4));
  z-index: calc(var(--sn-overlay-z-base, 20000) + 1);
  overflow: hidden;
  box-sizing: border-box;
  transition: transform var(--sn-transition-normal, 240ms) ease;
}

.sn-drawer-panel[data-placement="right"] {
  top: 0;
  right: 0;
  width: var(--sn-drawer-size, 380px);
  max-width: 100vw;
  height: 100vh;
  transform: translateX(100%);
}

.sn-drawer-panel[data-placement="left"] {
  top: 0;
  left: 0;
  width: var(--sn-drawer-size, 380px);
  max-width: 100vw;
  height: 100vh;
  transform: translateX(-100%);
}

.sn-drawer-panel[data-placement="top"] {
  top: 0;
  left: 0;
  width: 100vw;
  height: var(--sn-drawer-size, 320px);
  max-height: 100vh;
  transform: translateY(-100%);
}

.sn-drawer-panel[data-placement="bottom"] {
  bottom: 0;
  left: 0;
  width: 100vw;
  height: var(--sn-drawer-size, 320px);
  max-height: 100vh;
  transform: translateY(100%);
}

.sn-drawer-panel[data-visible] {
  transform: none;
}

.sn-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(16px * var(--sn-theme-density, 1)) calc(20px * var(--sn-theme-density, 1));
  border-bottom: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
}

.sn-drawer-title {
  margin: 0;
  font-family: var(--sn-font, sans-serif);
  font-size: calc(18px * var(--sn-theme-type-scale, 1) * var(--sn-theme-heading-scale, 1));
  font-weight: 600;
  color: var(--sn-text);
}

.sn-drawer-close-btn {
  background: transparent;
  border: none;
  color: var(--sn-text-dim, rgba(255,255,255,0.6));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--sn-space-xs);
  border-radius: 4px;
  transition: background-color var(--sn-transition-fast, 120ms), color var(--sn-transition-fast, 120ms);
}

.sn-drawer-close-btn:hover {
  background-color: var(--sn-node-hover, rgba(255,255,255,0.05));
  color: var(--sn-text);
}

.sn-drawer-body {
  flex: 1;
  padding: calc(20px * var(--sn-theme-density, 1));
  overflow-y: auto;
  font-family: var(--sn-font, sans-serif);
  font-size: calc(13px * var(--sn-theme-type-scale, 1));
  line-height: 1.5;
}

.sn-drawer-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sn-space-md);
  padding: calc(16px * var(--sn-theme-density, 1)) calc(20px * var(--sn-theme-density, 1));
  border-top: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  background-color: color-mix(in oklab, var(--sn-panel-bg) 95%, var(--sn-text) 5%);
}
`;
